# Software Design Document (SDD)
## PagePulse - Website Change Detector

**Document version:** 1.0  
**Status:** Implementation-ready specification  
**Prepared:** 15 October 2026  
**Primary audience:** Coding agent / implementation team  
**Proposed GitHub repository:** `pagepulse-web-change-detector`  
**Project type:** Full-stack web application with a scheduled browser-monitoring worker

---

## 1. Executive Summary

PagePulse monitors publicly accessible web pages and reports meaningful text or visual changes while suppressing noisy differences such as timestamps, counters, rotating promotions, advertisements, and random tokens. A user creates a watch by entering a public URL, a display name, and a check interval from 15 minutes to 24 hours. PagePulse renders the page in a headless browser, extracts and normalizes content, captures a screenshot, compares it to the relevant baseline, stores a new version only when a meaningful change is detected, and delivers deduplicated alerts through email and Telegram or Discord webhooks.

The system must distinguish a genuine page change from a failed request, outage, CAPTCHA, or bot-block page. It must also deduplicate monitoring work: when many users watch the same page using the same rendering profile, PagePulse should share browser captures instead of issuing one request per user. Watch-specific CSS regions and noise rules are still evaluated separately for each subscriber.

The implementation must be secure by default, observable, testable, deployable as separate web/scheduler/worker processes, and straightforward for a coding agent to build in phases.

## 2. Goals and Non-Goals

### 2.1 Goals

1. Monitor public HTTP/HTTPS pages at intervals between 15 minutes and 24 hours.
2. Use Playwright Chromium to render client-side pages and capture visible text plus screenshots.
3. Separate meaningful content changes from transient noise and infrastructure failures.
4. Support watch and ignore regions through a visual CSS-selector picker.
5. Show text diffs, highlighted screenshot diffs, side-by-side versions, and a per-watch history timeline.
6. Alert through email, Telegram, and Discord with a concise summary and a link to the diff.
7. Prevent duplicate work and duplicate alerts, enforce per-domain fairness, and handle retries safely.
8. Include a high-quality dashboard, health signals, automated tests, deployment instructions, and a polished public GitHub repository.

### 2.2 Non-goals for the initial release

- Logging into monitored sites, storing target-site passwords/cookies, or monitoring private authenticated pages.
- Bypassing CAPTCHA, paywalls, bot protection, or other access controls.
- Full browser recording, arbitrary user scripts, or unrestricted JavaScript injection.
- Guaranteed semantic interpretation of every visual change; rule-based text/visual comparison is the source of truth.
- An AI API being required for core change detection. Optional AI summaries may be added behind an explicit feature flag later.

## 3. Product Scope and User Stories

### 3.1 Core user journeys

1. **Create a watch:** Sign in, enter a public URL, name it, choose a 15-minute to 24-hour interval, select sensitivity, run a test capture, review the normalized-content preview, configure optional watch/ignore selectors, and save the baseline.
2. **Review a change:** Receive an alert only after a meaningful change; open the diff link to see additions/deletions, a highlighted screenshot diff, and a side-by-side comparison.
3. **Tune noise:** Use the selector picker or explicit ignore rules to exclude a timestamp, advertisement container, counter, random token, rotating banner, or other unstable region.
4. **Manage history:** Browse snapshots in a timeline, compare any two retained versions, run a rate-limited manual check, pause/resume a watch, or delete it.
5. **Manage notifications:** Configure email, Telegram, or Discord destinations, test a destination, suppress duplicate deliveries, and optionally receive a daily digest.
6. **Understand failures:** See separate `OK`, `ERROR`, and `BLOCKED` states. A timeout, 5xx outage, CAPTCHA, or access-denial page must not silently replace a valid content baseline.

### 3.2 Core acceptance outcomes

- Creating a watch validates the URL, interval, limits, and user ownership.
- The first successful capture establishes a baseline and does not trigger a change alert.
- An unchanged page creates a check-run record but not a new version snapshot.
- A meaningful change creates one new snapshot and one logical alert event per affected watch.
- A failed/blocked capture updates status and failure metadata, not the content baseline.
- Concurrent jobs for the same target are coalesced and a target hostname is not hammered by parallel workers.
- A user cannot access another user's watches, screenshots, diffs, or notification destinations.

## 4. Recommended Technology Stack

Use the latest **stable** compatible releases available when implementation begins. Do not pin prerelease/RC packages for the recruitment submission. Commit the lockfile and pin the runtime major version.

| Layer | Recommendation | Purpose |
|---|---|---|
| Runtime | Node.js 24 LTS, TypeScript strict mode | Shared typed code across web and worker |
| Package manager | pnpm workspaces | Reproducible monorepo and shared packages |
| Web application | Next.js App Router, React | Server-rendered dashboard, route handlers, auth UI |
| UI | Tailwind CSS, shadcn/ui, Lucide icons | Accessible, consistent interface |
| Forms/validation | React Hook Form + Zod | Validated inputs and shared request schemas |
| Authentication | Better Auth with PostgreSQL/Drizzle adapter | Email/password or OAuth; secure sessions |
| Database | PostgreSQL, managed in production | Relational data, history, constraints, due-watch queries |
| ORM/migrations | Drizzle ORM + drizzle-kit | Typed schema and versioned migrations |
| Queue/cache | Redis + BullMQ | Durable jobs, retries, priorities, rate limiting, deduplication |
| Browser automation | Playwright Chromium | JavaScript rendering, DOM extraction, screenshots |
| Text diff | `diff` (or an equivalent maintained TypeScript diff library) | Line/word-level additions and deletions |
| Image diff | `pixelmatch` + `pngjs` or equivalent | Pixel-level highlighted screenshot comparison |
| Object storage | S3-compatible API; Cloudflare R2/AWS S3 in production | Screenshots and visual-diff artifacts |
| Email | Resend behind a provider adapter | Email alerts and daily digests |
| Chat alerts | Telegram Bot API and Discord incoming webhooks | Messaging integrations |
| Testing | Vitest, Playwright Test, Testcontainers or disposable Docker services | Unit, integration, end-to-end coverage |
| Logging | Pino structured JSON logs | Worker/web diagnostics and correlation IDs |
| Error monitoring | Sentry or equivalent, optional | Production exceptions and traces |
| Local infrastructure | Docker Compose | PostgreSQL, Redis, optional MinIO object storage |
| CI | GitHub Actions | Lint, typecheck, tests, build, dependency/security checks |

**Architecture choice:** this is not a serverless-only application. Deploy the web service, scheduler, and browser worker as independently scalable Node.js processes. The web UI can be deployed separately, but the Playwright worker must run in an environment that supports Chromium and its system dependencies.

## 5. High-Level Architecture

**Data flow at a glance**

1. The user configures a watch in the Next.js dashboard; the web process stores it in PostgreSQL.
2. The scheduler finds due watches, groups them by shared target/render profile, and enqueues one idempotent job per group in Redis/BullMQ.
3. The Playwright worker captures the public page and records the result. PostgreSQL remains the source of truth for check runs, snapshots, and alert events.
4. Text/screenshots and diff artifacts are stored in private S3-compatible object storage; the database stores their keys and checksums.
5. A separate notification worker delivers committed alert events through email, Telegram, or Discord and records delivery status.

### 5.1 Process responsibilities

- **Web process:** authentication, dashboard, CRUD APIs, visual selector picker UI, timeline, diff views, notification settings, manual-check requests, health endpoint.
- **Scheduler process:** periodically finds due watches, groups due watches by shared target, enqueues idempotent jobs, and advances scheduling state transactionally.
- **Browser worker:** validates the target again, acquires target/domain concurrency controls, navigates with Playwright, detects success/outage/blocking, captures text and screenshots, runs normalization/diff logic, persists results, and emits alert events.
- **Notification worker:** renders templates, sends email/chat notifications, handles provider failures/retries, and records delivery status with idempotency keys.
- **Database:** source of truth for users, watches, target identities, scheduling, check runs, snapshots, alert events, and deliveries.
- **Redis:** queue/short-lived coordination only; loss of Redis must not lose the durable watch configuration or snapshot history.
- **Object storage:** screenshot artifacts and screenshot-diff PNGs. Store object keys, checksums, sizes, and content types in the database; use private buckets and expiring signed URLs.

### 5.2 Monorepo layout

```text
pagepulse-web-change-detector/
  apps/web/, apps/worker/
  packages/db/, packages/core/, packages/browser/
  packages/notifications/, packages/config/
  docs/SDD.md, docs/ARCHITECTURE.md, docs/OPERATIONS.md
  .github/workflows/ci.yml, .github/dependabot.yml
  .env.example, .gitignore, docker-compose.yml
  package.json, pnpm-workspace.yaml, README.md
```

Keep domain logic in `packages/core`, not embedded in React components or route handlers. Share validation schemas and types between the web app and worker.

## 6. Functional Requirements

### FR-01 - Watch management

- Create a watch with `name`, canonical public URL, interval, sensitivity, watched CSS selectors, ignored CSS selectors, and notification preferences.
- Valid intervals: integer minutes from 15 through 1,440. UI presets: 15m, 30m, 1h, 3h, 6h, 12h, 24h; permit valid custom integers if useful.
- Support pause, resume, rename, edit, manual check, and delete.
- Show validation feedback for malformed URLs, blocked/private targets, invalid selectors, and exhausted per-account limits.
- The first healthy capture establishes a baseline; no change alert is sent for baseline creation.

### FR-02 - Scheduled checks and queueing

- The scheduler runs on a short fixed tick (recommended 30-60 seconds), finds due watches using indexed `nextCheckAt`, and groups jobs by shared target/render profile.
- Use DB transactions and row locks (`FOR UPDATE SKIP LOCKED`, or an equivalent safe lease) so multiple scheduler replicas do not enqueue the same due work unnecessarily.
- Queue payloads contain IDs, not entire page contents or secrets. Job IDs must be deterministic per target and check window so duplicates coalesce.
- Browser navigation timeout default: 30 seconds; configurable within a safe upper bound. Overall job timeout must include navigation, extraction, screenshot, and persistence.
- Retry transient network/5xx/rate-limit errors a small bounded number of times with exponential backoff and jitter. Respect `Retry-After` when present. Do not repeatedly retry a CAPTCHA or explicit block page.
- Track attempts, run duration, retry reason, queue delay, and final outcome.

### FR-03 - Rendering and capture

- Use a fresh, isolated browser context for each capture or tightly controlled context reuse. Do not load any user-site cookies or credentials.
- Default rendering profile: desktop Chromium, stable viewport (for example 1440x900), `en-US`, UTC timezone, light color scheme, no user-selected cookies. Persist the profile as a target identity input.
- Wait for `domcontentloaded`; then use a short configurable stabilization period. Attempt a bounded `networkidle` wait when safe, but do not hang indefinitely on pages with long-polling/websockets.
- Disable CSS animations/transitions and hide the caret during capture. Use bounded full-page screenshots by default and cap maximum page height/bytes to protect worker memory.
- Extract visible body text and watch-selector text. If a selector is missing, store a diagnostic warning and follow a configurable policy; do not silently reinterpret a selector as the entire page.
- Capture HTTP status, final URL after redirects, page title, timing, content type, browser errors, response classification, text output, and screenshot.

### FR-04 - Change detection and version storage

- Compute a canonical normalized text representation and cryptographic hash, such as SHA-256, for each watch's selected content.
- The first successful capture creates the baseline snapshot.
- Each check creates a `CheckRun` record with status, timing, response metadata, content hash, and diagnostic information. A new `WatchSnapshot` is created only when the normalized content hash changes or the visual comparison passes the configured meaningful-change threshold.
- Every successful check captures page text and a screenshot. To balance observability and storage, a check may keep a screenshot/text artifact in temporary storage while processing; persist long-term artifacts according to retention policy, with snapshot-bound artifacts retained longer. If the requirement is interpreted literally as retaining artifacts for every check, keep a configurable audit-retention window for unchanged-run artifacts and then garbage-collect them.
- Use unique constraints and transaction boundaries to prevent concurrent duplicate snapshots for the same watch/content hash.
- Maintain text history for the watch; each snapshot records the prior snapshot reference, content hash, normalized text (or a compressed object reference), screenshot object key, and change summary.

### FR-05 - Noise filtering and sensitivity

Provide layered, explainable filtering rather than an opaque AI-only decision:

1. **Built-in normalization:** normalize line endings and whitespace; remove empty duplicate lines where safe; normalize common timestamp patterns, relative-time labels, and volatile query parameters only when configured.
2. **Built-in dynamic patterns:** optional rules for common timestamps, elapsed-time strings, random nonce/token patterns, and counters. Every default rule must be conservative and inspectable.
3. **Watch selectors:** `includeSelectors` restrict extraction to selected regions. If empty, use visible page content after common noise filtering.
4. **Ignore selectors:** remove selected nodes before text extraction and mask their corresponding screenshot regions for visual comparison where possible.
5. **Custom ignore rules:** user-supplied regular expressions must have length/complexity limits, be validated, and execute with protections against catastrophic backtracking. Prefer safe string patterns over arbitrary regex.
6. **Sensitivity levels:** `Low`, `Normal`, `High`, plus an advanced threshold setting. Use normalized text changed-ratio and visual pixel-difference ratio thresholds; retain raw metrics in the check record.
7. **Change preview:** show what was removed by noise rules and explain why a detected change crossed the threshold.

Do not permanently discard meaningful content simply because it looks dynamic. Defaults should be conservative; allow users to tune each watch.

### FR-06 - Visual selector picker

- Provide a browser-based preview page and an overlay/picker mode. Hovering highlights the DOM element under the pointer; clicking selects it and generates a stable CSS selector.
- Display the proposed selector and a text preview; let the user confirm, rename, or remove it.
- Offer separate “Watch this region” and “Ignore this region” actions.
- Generate selectors from IDs/data attributes where reliable; otherwise use a bounded ancestor path. Warn when the selector is broad, unstable, or matches multiple nodes.
- Persist selector strings and allow testing them against the next capture. Do not require the monitored website to install any script.

### FR-07 - Diff experience and history

- Text diff view: word/line-level additions and deletions, with a plain-text accessible fallback.
- Visual diff view: prior screenshot, current screenshot, highlighted diff image, and percentage of changed pixels. Apply ignored selector masks before comparison when feasible.
- Side-by-side comparison of any two retained snapshots, with version timestamps and links to their check runs.
- Per-watch version timeline with change summary, status badges, manual/automatic origin, and retention state.
- Allow downloading a text diff and an individual screenshot; use expiring signed artifact URLs, not public object URLs.

### FR-08 - Notifications and digests

- Email, Telegram bot, and Discord incoming webhook destinations.
- Notification content: watch name, hostname, timestamp, concise text summary, change type, status, and an authenticated diff URL. Do not include large page dumps in the message.
- “Send test notification” action for each destination.
- Idempotency key: `(watchId, snapshotId, channelEndpointId, notificationType)`. Enforce uniqueness in the database to avoid duplicate logical notifications.
- Retry provider/network failures with bounded backoff. Record `PENDING`, `SENT`, `FAILED`, or `SUPPRESSED`.
- Optional daily digest, grouped by watch/host, with links to each diff. Do not send a second instant alert for the same snapshot through a channel already delivered unless explicitly configured.
- Support alert cooldown/dedup rules and a single incident alert on repeated outage/block status, with optional recovery notification.

### FR-09 - Dashboard and statuses

Dashboard columns/cards: watch name, hostname, selected interval, last checked, last changed, status, latest change, next check, and notification state. Support filtering by status, searching by name/hostname, sorting by last changed/last checked, and empty/loading/error states.

Status definitions:
- `OK`: latest scheduled capture succeeded.
- `ERROR`: transient or persistent network/HTTP/rendering failure.
- `BLOCKED`: CAPTCHA, bot challenge, 401/403 access restriction, or explicit anti-automation rejection.
- `PAUSED`: watch intentionally disabled.
- `UNKNOWN`: no successful baseline yet or monitoring state is not yet established.

A status change is not automatically a content change. Failures must never replace a valid snapshot.

### FR-10 - Shared target deduplication

- Canonicalize URL and derive a target key from canonical URL plus render profile. Remove URL fragments; normalize default ports; normalize host case; do not blindly remove query parameters because they can affect page content.
- Multiple user watches may reference one shared target. One browser capture can be used to evaluate multiple due watches against their watch-specific selectors and noise settings.
- The scheduler groups due watches by target and coalesces concurrent jobs. If a sufficiently recent capture exists, reuse it for due watches only when its profile and freshness policy match.
- Enforce per-host concurrency and minimum request spacing even when multiple distinct targets on the same host exist.
- Users have independent watch names, selectors, sensitivity, alert configuration, and history access; no cross-user data is exposed.

## 7. Failure Classification: Outage vs. CAPTCHA vs. Real Change

This distinction is a major quality criterion.

1. **Transport/timeout error:** navigation timeout, DNS/TLS issue, connection reset. Record failed run; keep the prior baseline.
2. **HTTP outage:** repeated 5xx responses or clear maintenance/unavailable response. Mark `ERROR`; optionally create an incident event after a configurable number of consecutive failures. Do not create a content snapshot from the error page.
3. **Rate limited:** 429 or an equivalent signal. Record status, honor `Retry-After`, slow down the host, and do not treat the response body as content.
4. **Blocked/CAPTCHA:** detect known challenge signals such as challenge title/text, captcha iframe/provider markers, or a 401/403 response. Mark `BLOCKED`, stop aggressive retries, and notify at most once per incident or state transition.
5. **Healthy page:** response is acceptable and rendered content passes classification checks. Only then run watch-specific content comparison.
6. **Recovery:** on the next healthy check after an incident, restore `OK`. Optionally send one recovery notification; do not invent a content change unless the healthy page also differs from the last healthy snapshot.

Heuristics must be testable and explainable. Make challenge detection configurable and avoid classifying an ordinary page as blocked based on a single generic word.

## 8. Core Processing Algorithm

```text
scheduler tick:
  select due watches in a transaction
  group by target and render profile
  enqueue one idempotent job per group
  advance leases and due timestamps safely

capture worker(job):
  acquire target lock and per-host permit
  validate URL and every redirect/navigation
  reuse a recent compatible capture only if allowed
  otherwise launch an isolated Playwright context
  navigate using bounded timeouts and safe request policies
  classify response as OK, ERROR, or BLOCKED
  persist CheckRun metadata for every attempt
  if ERROR or BLOCKED:
    update status/incident; retain the healthy baseline; return
  capture text and screenshot; process due watches separately
  for each watch:
    apply selectors and normalization rules
    compute text hash and text/visual change metrics
    if no baseline:
      create baseline snapshot; do not send a change alert
    else if meaningful change:
      persist snapshot and artifact references transactionally
      create one idempotent AlertEvent
    update this watch's due time and last-run metadata
  enqueue delivery jobs from committed AlertEvents
  release locks and clean temporary artifacts
```

Do not hold a database transaction open while launching a browser or calling external notification APIs. Persist a durable alert event in the same transaction as the snapshot, then deliver asynchronously.

## 9. Data Model (Logical)

The coding agent may refine names, but preserve the relationships and constraints below.

| Entity | Key fields | Purpose / constraints |
|---|---|---|
| `User` | id, email, displayName, createdAt | Application identity; use Better Auth-managed auth tables/session model |
| `Target` | id, canonicalUrl, targetKey, renderProfileJson, hostname, nextFetchAt, lastHealthyAt | Shared monitoring target; unique `targetKey`; not user-owned |
| `Watch` | id, userId, targetId, name, intervalMinutes, enabled, sensitivity, includeSelectors, ignoreSelectors, normalizationRules, nextCheckAt, baselineEstablishedAt, lastCheckedAt, lastChangedAt, status | Per-user subscription/configuration; indexed by `(enabled, nextCheckAt)` and targetId |
| `CheckRun` | id, targetId, startedAt, finishedAt, outcome, httpStatus, finalUrl, durationMs, errorCode, textHash, changedPixelRatio, metadataJson | One row per attempted scheduled/manual capture; failures are first-class records |
| `WatchSnapshot` | id, watchId, checkRunId, sequenceNo, contentHash, normalizedText/objectKey, screenshotObjectKey, previousSnapshotId, createdAt, changeSummaryJson | New row only on baseline or meaningful watch-specific change; unique `(watchId, contentHash)` where appropriate |
| `Artifact` | id, storageKey, checksum, contentType, byteSize, retentionUntil, createdAt | Private screenshot/diff/text artifacts with integrity metadata |
| `NotificationEndpoint` | id, userId, channel, encryptedConfig, enabled, createdAt | Provider configuration; encrypt webhook URLs/tokens at rest; never log secrets |
| `AlertEvent` | id, watchId, snapshotId, type, idempotencyKey, createdAt | Durable logical alert; unique idempotency key |
| `NotificationDelivery` | id, alertEventId, endpointId, status, attempts, providerMessageId, lastErrorCode, sentAt | Delivery history and retry state; unique alert/endpoint/type combination |
| `DailyDigest` (optional) | id, userId, digestDate, status, sentAt | Prevent duplicate digests for a given user/date |

### 9.1 Database rules

- Use UUID or similarly unguessable primary keys.
- Put foreign keys and cascades on all ownership relationships. Deleting a user must remove their watches and endpoint configurations while retaining or deleting shared targets according to reference count.
- Store all timestamps in UTC (`timestamptz`); format in the viewer's timezone in the UI.
- Use indexes for due-watch queries, target lookup, watch timeline retrieval, snapshot ordering, delivery retries, and incident status queries.
- Use a unique constraint for `Target.targetKey`; protect snapshots and alert events with uniqueness/idempotency constraints.
- Keep large text/screenshot blobs out of the hot relational tables when they become large. Use compressed text columns for modest snapshots and object storage for large payloads.
- Apply migrations in CI and staging; never silently mutate production schema at application startup.

## 10. API Design

Use Next.js Route Handlers with Zod validation. Return a consistent error shape: `{ error: { code, message, requestId } }`. Use cursor pagination for history lists. All private endpoints require an authenticated session and ownership checks.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/watches` | List current user's watches with status and pagination |
| `POST` | `/api/watches` | Validate URL and create watch/target association |
| `GET` | `/api/watches/:watchId` | Read one owned watch |
| `PATCH` | `/api/watches/:watchId` | Update name, interval, selectors, sensitivity, status, notifications |
| `DELETE` | `/api/watches/:watchId` | Delete an owned watch and schedule cleanup |
| `POST` | `/api/watches/:watchId/check-now` | Enqueue a rate-limited manual check |
| `GET` | `/api/watches/:watchId/snapshots` | Cursor-paginated history |
| `GET` | `/api/watches/:watchId/diff?from=...&to=...` | Compare two owned snapshots |
| `POST` | `/api/watches/:watchId/selector-test` | Validate selectors against a safe recent or test capture |
| `GET` | `/api/notification-endpoints` | List current user's masked destinations |
| `POST` | `/api/notification-endpoints` | Create destination with server-side secret encryption |
| `POST` | `/api/notification-endpoints/:id/test` | Queue a test notification |
| `PATCH` | `/api/notification-endpoints/:id` | Enable/disable or update destination |
| `DELETE` | `/api/notification-endpoints/:id` | Remove destination |
| `GET` | `/api/health/live` | Process liveness, no sensitive details |
| `GET` | `/api/health/ready` | Readiness checks for DB and required dependencies |

Protect manual checks and selector tests with per-user and per-host rate limits. Do not expose arbitrary browser navigation as an unauthenticated URL-fetching endpoint.

## 11. Security, Privacy, and Abuse Prevention

### 11.1 SSRF and browser safety (release blocker)

Because users submit URLs that a server-side browser will visit, SSRF defense is mandatory.

- Accept only `http:` and `https:` schemes. Reject embedded username/password, malformed hosts, unsupported ports unless explicitly configured, and overly long URLs.
- Reject loopback, private, link-local, multicast, reserved, and metadata-service addresses for both IPv4 and IPv6. Validate DNS resolution at fetch time, not only when the watch is created.
- Revalidate every redirect and every browser request/navigation. Prevent DNS rebinding by combining application checks with outbound network rules/egress firewalling that denies private/internal ranges.
- Block `file:`, `data:`, `javascript:`, browser extensions, localhost service endpoints, and unsafe protocols. Do not permit user scripts or arbitrary headers.
- Run Chromium in a non-privileged container with sandboxing where supported, restrictive filesystem permissions, resource limits, and no host mounts except required temporary storage.
- Add navigation count, response-size, download, page-height, request-duration, and total-job limits. Block or tightly constrain websocket/event-stream traffic that causes indefinite waits.
- Use a small, documented User-Agent that identifies the service; do not bypass CAPTCHA or access restrictions.

### 11.2 Authentication and authorization

- Use secure, HTTP-only, SameSite cookies and HTTPS in production.
- Enforce authorization on the server for every watch, snapshot, diff, endpoint, and artifact access. Hiding UI elements is not authorization.
- Add CSRF protection where required by the auth/session model, request origin checks, and rate limiting for login and sensitive actions.
- Never return webhook tokens, bot tokens, encrypted settings, raw stack traces, or infrastructure connection strings to the browser.

### 11.3 Secrets and data retention

- Include `.env.example`, but never commit `.env`, API keys, provider URLs, or private keys.
- Encrypt notification secrets at rest using an application encryption key from the deployment secret store; use authenticated encryption (for example AES-256-GCM) with versioned key IDs. Rotate keys without logging plaintext.
- Keep target-site credentials unsupported. Notification endpoint secrets are the only integration secrets stored, encrypted.
- Private object storage only; serve screenshots through authorization-checked, short-lived signed URLs.
- Default retention proposal: changed snapshots 90 days; unchanged CheckRun metadata 30 days; unchanged-run screenshot artifacts 7 days; generated diff artifacts 30 days. Make retention configurable and display it in settings/docs. Run a scheduled garbage collector that removes expired objects and then their metadata safely.
- Support user export/delete and document that monitored content may itself contain information visible to any public visitor.

### 11.4 Fairness and responsible monitoring

- Per-host concurrency default 1, short minimum spacing between requests, and bounded global worker concurrency.
- Honor `Retry-After`; add exponential backoff with jitter for 429/5xx/network errors.
- Detect repeated blocks and slow/stop monitoring rather than hammering the host.
- Respect applicable site terms and robots guidance where feasible; only monitor public pages and do not evade technical access controls.

## 12. UI/UX Requirements

The interface should look like a polished developer tool, not a generic admin template.

- **Dashboard:** overview counts (active watches, changes today, errors/blocked), searchable table/cards, status filter, next-check time, and clear empty state with “Add your first watch”.
- **Add-watch wizard:** URL/name, interval/sensitivity, initial test capture, preview normalized text, watch/ignore selector setup, alert destinations, save baseline.
- **Watch detail:** status panel, last checked/changed, last error, timeline, text diff, visual diff, compare-two-versions control, configuration drawer.
- **Selector picker:** highlighted DOM nodes, selector confidence warning, selected-text preview, and watch/ignore controls.
- **Notifications:** channel setup guide, masked token/URL, send-test result, enable/disable controls.
- **Accessibility:** keyboard navigation, visible focus indicators, semantic headings, contrast, alt text for screenshots, non-color-only status indication, reduced-motion support.
- **Responsive layout:** desktop optimized, usable on tablet/mobile; diffs should have stacked mode on small screens.
- **Polish:** loading skeletons, informative error states, confirmation before delete, toast feedback, empty/first-run walkthrough, and demo data clearly separated from real monitored data.

## 13. Observability and Operations

- Emit structured logs with `requestId`, `jobId`, `targetId`, `watchId`, `checkRunId`, `host`, `outcome`, `durationMs`, and `attempt`. Never log full page content or secret values by default.
- Metrics: due-watch backlog, queue wait time, capture duration, successful/failed/blocked checks, snapshot-change rate, duplicate-job suppression, per-host request rate, screenshot bytes, notification delivery latency/failures, and object-storage errors.
- Implement liveness and readiness checks. Readiness should fail if essential dependencies are unavailable; liveness should only answer whether the process is alive.
- Add worker heartbeat/staleness detection and a dashboard or operational command for failed jobs and queue depth.
- Include documented backup/restore instructions for PostgreSQL and object storage, migration/rollback guidance, and a way to pause all scheduled checks during an incident.
- Add alerting for scheduler inactivity, rapidly growing queue depth, repeated DB errors, high blocked/error rate, and failed notification delivery.

## 14. Configuration and Environment Variables

Validate environment variables on startup and fail with a clear, non-secret error if required values are missing.

| Variable | Required | Description |
|---|---:|---|
| `NODE_ENV` | Yes | Runtime mode |
| `APP_URL` | Yes | Canonical public application origin |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string for BullMQ |
| `BETTER_AUTH_SECRET` | Yes | Auth signing/encryption secret; sufficiently random |
| `BETTER_AUTH_URL` | Yes | Base URL used by Better Auth |
| `ARTIFACT_STORAGE_DRIVER` | Yes | `local` in development, `s3` in production |
| `ARTIFACT_LOCAL_DIR` | Dev | Local artifact directory ignored by Git |
| `S3_ENDPOINT` | S3 | Optional S3-compatible endpoint |
| `S3_BUCKET` | S3 | Private artifact bucket |
| `S3_REGION` | S3 | Storage region |
| `S3_ACCESS_KEY_ID` | S3 | Secret from deployment environment |
| `S3_SECRET_ACCESS_KEY` | S3 | Secret from deployment environment |
| `ARTIFACT_ENCRYPTION_KEY` | Yes | Versioned key for integration-secret encryption |
| `RESEND_API_KEY` | Email | Resend key; optional in local mode |
| `EMAIL_FROM` | Email | Verified sender address |
| `TELEGRAM_BOT_TOKEN` | Optional | App-level bot token only if using a shared bot; never exposed to clients |
| `CAPTURE_TIMEOUT_MS` | No | Default 30000, bounded range |
| `GLOBAL_WORKER_CONCURRENCY` | No | Conservative default, adjustable to machine capacity |
| `PER_HOST_CONCURRENCY` | No | Default 1 |
| `DEFAULT_SNAPSHOT_RETENTION_DAYS` | No | Default 90 |
| `SENTRY_DSN` | No | Optional error-monitoring DSN |

If a user supplies a Telegram token or Discord webhook URL for their own destination, encrypt the configuration at rest; do not use the example variables as a substitute for per-user notification configuration.

## 15. Local Development and Deployment

### 15.1 Local setup requirements

- Node.js 24 LTS and pnpm.
- Docker with Compose.
- Playwright Chromium and its Linux system dependencies in the worker environment.
- Optional provider credentials for real notifications; implement a console/no-op development provider when credentials are not set.

### 15.2 Required local commands

The coding agent should create and document scripts equivalent to:

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm --filter @pagepulse/worker worker
pnpm --filter @pagepulse/worker scheduler
```

The exact script names may be refined, but the README must show reliable copy/paste commands. `pnpm dev` may run the web, worker, and scheduler concurrently in development after dependencies are available.

### 15.3 Deployment topology

Deploy separate services for:

1. **Web:** Next.js Node server, HTTPS, auth callback URL configured.
2. **Scheduler:** one or more instances using DB leases/locking to prevent duplicate scheduling.
3. **Browser worker:** Chromium dependencies installed, bounded CPU/memory, outbound egress restrictions applied.
4. **Notification worker:** can share the worker process initially, but use a separate queue/worker concurrency pool to keep slow email delivery from blocking page capture.
5. **Managed services:** PostgreSQL, Redis configured for durable queue semantics, and private S3-compatible object storage.

For first deployment, choose a platform that supports persistent background processes and Playwright. If the web frontend is placed on a serverless platform, the scheduler and worker still need a separate long-running host.

## 16. Testing Strategy

### 16.1 Unit tests (Vitest)

- URL canonicalization, public-IP/hostname rejection, redirect rules, and URL edge cases.
- Text normalization: whitespace, timestamps, counters, dynamic tokens, selector allow/ignore behavior.
- Sensitivity thresholds and meaningful-change decisions.
- Diff formatting and snapshot hash/idempotency logic.
- Challenge/outage classification for representative fixtures.
- Scheduler interval math, due-watch grouping, and alert cooldown logic.
- Notification idempotency key and retry/backoff behavior.

### 16.2 Integration tests

Use disposable PostgreSQL and Redis services or Testcontainers where available.

- Migration from an empty database and from the previous migration.
- Concurrent schedulers claim due watches without duplicate work.
- Two users watching the same URL share target fetch work while retaining separate configuration/history.
- Failed and blocked runs do not alter the last healthy baseline.
- Repeated delivery attempts cannot duplicate one logical alert.
- Artifact persistence/expiry and user deletion clean up storage safely.

### 16.3 Browser and end-to-end tests

Serve fixture pages locally from the test suite; do not depend on arbitrary public websites in CI. Include fixtures for:

1. Stable page, no change.
2. Text addition/deletion.
3. Rotating timestamp/counter with noise suppression.
4. Ad/banner region that is ignored by CSS selector.
5. Meaningful visual-only change.
6. HTTP 500 outage.
7. CAPTCHA/mock challenge page.
8. 429 with `Retry-After`.
9. Redirect to loopback/private address, which must be blocked.
10. Selector missing or ambiguous.

### 16.4 Quality gates

- ESLint, formatting, TypeScript strict typecheck, unit tests, integration tests, production build, and critical Playwright E2E suite pass in GitHub Actions.
- Test coverage target: at least 80% for `packages/core` decision logic; do not inflate coverage with trivial tests.
- No known high/critical dependency or secret-scanning findings should merge without documented resolution.

## 17. GitHub Repository Creation and Project Hygiene

### 17.1 Repository specification

- **Name:** `pagepulse-web-change-detector`
- **Fallback if taken:** `pagepulse-web-change-detector-vit`
- **Description:** `Monitor public web pages for meaningful text and visual changes with noise filtering, snapshots, and alerts.`
- **Visibility:** Public is recommended for club recruitment/showcase, provided no secrets, personal data, or private datasets are committed. Use private if the club requests it.
- **Default branch:** `main`
- **Initial labels:** `bug`, `enhancement`, `documentation`, `security`, `good first issue`, `agent-task`.

### 17.2 Required repository contents

Create `README.md`, this document at `docs/SDD.md`, `LICENSE` (MIT is a reasonable default unless the club specifies otherwise), `.gitignore`, `.env.example`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, a pull-request template, and issue templates. Add architecture and operations notes under `docs/`.

### 17.3 Creation with GitHub CLI

The coding agent should initialize the local project, make an initial clean commit, and then create/push the repository only if GitHub CLI is installed and authenticated. Never report successful remote creation unless the command succeeds.

```bash
git init
git branch -M main
git add .
git commit -m "chore: bootstrap PagePulse website change detector"
gh auth status
# Authenticate first if needed: gh auth login
gh repo create pagepulse-web-change-detector \
  --public \
  --source=. \
  --remote=origin \
  --push
```

If the name already exists, check availability and use the fallback name. If the authenticated environment cannot create remote repositories, preserve the local Git repository and print the exact command the owner must run. Do not commit `.env`, local artifacts, Playwright output, or storage files.

### 17.4 GitHub settings and CI

- Require pull requests for `main`; require CI status checks before merge when supported.
- Enable Dependabot version updates and security alerts; enable secret scanning/push protection where available.
- Add `CODEOWNERS` if the club/team requires review ownership.
- Use short-lived feature branches and descriptive commits; do not work directly on `main` for implementation features.
- CI must not need production secrets. Use mock notification providers and local fixtures.
- Add badges for CI and license to README only after their targets are valid.

## 18. Implementation Plan for the Coding Agent

Implement in working increments. Do not stop after generating a plan or static mockup; build a runnable project, execute the checks, and document what actually passed.

### Phase 1 - Repository and foundation

1. Create the monorepo, workspace scripts, strict TypeScript, lint/format, environment validation, Docker Compose, and README.
2. Add GitHub Actions CI and repository hygiene files.
3. Configure PostgreSQL, Drizzle migrations, Better Auth, and tenant-safe data access.

### Phase 2 - Watch lifecycle and scheduler

4. Implement Target/Watch creation, validation, pause/resume/delete, and dashboard.
5. Implement due-watch scheduler, Redis/BullMQ, deterministic job IDs, target locking, per-host rate limiting, and manual checks.

### Phase 3 - Browser capture and safe classification

6. Implement secure URL/redirect validation and network egress policy documentation.
7. Implement Playwright capture, status classification, text extraction, and baseline creation.
8. Add CheckRun persistence and storage adapters for local/S3 artifacts.

### Phase 4 - Change engine

9. Add normalization and ignore selectors, sensitivity thresholds, stable screenshot capture, text diff, pixel diff, and snapshot timeline.
10. Implement shared-target capture with separate watch-specific evaluation and change snapshots.

### Phase 5 - Alerts and complete product flow

11. Implement email, Telegram, and Discord adapters; tests; delivery retries; idempotency; and daily digest.
12. Add selector picker, compare-two-versions view, filtering/search, and notification settings.

### Phase 6 - Production quality

13. Add end-to-end security tests, SSRF fixtures, accessibility pass, retention cleanup, health/readiness, logging, metrics, and operational docs.
14. Deploy web, scheduler, worker, DB, Redis, and storage in a documented topology.
15. Run every CI check; fix failures; verify first-user onboarding; update README with actual screenshots/demo URL only after they exist.
16. Create/push the GitHub repository if authenticated, and provide the final repository URL and test report.

### Delivery expectations

At the end, report: repository URL (only if real), commit hash, implemented features, setup commands, environment variables needed, migration status, tests executed and results, deployment URL (only if actually deployed), and known limitations. Clearly label integrations that need owner-provided tokens. No fake/demo status should be presented as a real successful capture.

## 19. Acceptance Checklist (Definition of Done)

### Functionality
- [ ] A user can register/sign in and manage watches.
- [ ] URLs and check intervals are validated; 15 minutes and 24 hours work at the boundaries.
- [ ] Playwright captures public pages with bounded navigation and screenshot limits.
- [ ] Baseline snapshot is created on first healthy capture without an alert.
- [ ] Unchanged checks do not create duplicate version snapshots.
- [ ] Text changes and meaningful visual-only changes produce correct diffs and snapshots.
- [ ] Timestamps/counters/ignored selectors can be filtered without suppressing all meaningful updates.
- [ ] Outages/CAPTCHAs/blocks are statuses, not content updates.
- [ ] Same target can serve multiple users with a shared capture and isolated watch histories.
- [ ] Alerts work via email, Telegram, and Discord; duplicates are suppressed; digest is optional.
- [ ] Timeline and side-by-side comparison of any two retained versions work.

### Security and reliability
- [ ] SSRF tests cover IPv4/IPv6 private addresses, redirects, DNS validation, and blocked protocols.
- [ ] Tenant isolation tests prevent cross-user watch/artifact access.
- [ ] Secrets are absent from Git and logs; notification secrets are encrypted at rest.
- [ ] Retries are bounded and respect `Retry-After`; per-host concurrency is enforced.
- [ ] Retention cleanup deletes expired objects and metadata safely.
- [ ] Scheduler/worker failures are observable; health and readiness endpoints exist.

### Engineering quality
- [ ] Strict TypeScript, lint, tests, build, and migrations pass in CI.
- [ ] README covers architecture, prerequisites, local setup, environment, testing, and deployment.
- [ ] `.env.example` contains placeholders only; `.gitignore` excludes local secrets/artifacts.
- [ ] GitHub repository exists only if remote creation succeeded; branch rules and security settings are documented.
- [ ] No central behavior remains as an unimplemented placeholder.

## 20. Optional Enhancements After Core Completion

Implement only after the core acceptance checklist passes:

1. **AI-assisted change summaries (opt-in):** summarize a diff with a provider adapter; do not send page content to a third party unless the user explicitly enables it. AI output must never decide whether a snapshot is stored.
2. **Watch templates:** presets for pricing pages, documentation/release notes, job pages, status pages, and policy pages.
3. **Exports:** export timeline metadata and text diffs to JSON/CSV; artifact export remains access-controlled.
4. **RSS/webhook output:** expose an authenticated per-watch feed or signed outbound webhook for teams.
5. **Change rules:** alert only when selected text appears/disappears, a keyword changes, or a CSS region changes.
6. **Team workspaces:** shared ownership, member roles, and audit log after individual-user MVP is stable.
7. **Public demo mode:** sample fixture website with synthetic changes, clearly marked as demo and isolated from real user data.
8. **Performance dashboard:** per-domain capture frequency, queue latency, duplicate work avoided, and storage usage.

## 21. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| SSRF through user-supplied URL or redirect | Validate schemes/hosts/DNS, revalidate every navigation, deny private egress at network level, test hostile redirects |
| Alert storms on noisy pages | Conservative normalization, ignore selectors, per-watch sensitivity, cooldown, idempotency constraints |
| CAPTCHA mistaken for a change | Explicit challenge classification; never update healthy baseline from blocked content |
| A website is overloaded by monitoring | Shared targets, due-watch grouping, per-host spacing/concurrency, `Retry-After`, bounded retries |
| Browser memory/cpu exhaustion | Resource/page-size/time limits, worker concurrency caps, process isolation, periodic worker restart policy if needed |
| Storage costs grow with screenshots | Separate artifact retention windows, object lifecycle policy, image compression, cleanup worker, size metrics |
| Notification provider outage | Durable alert events, separate notification queue, retry/backoff, delivery status and dead-letter handling |
| Rendering differences cause false positives | Fixed rendering profile, disabled animations/caret, stable viewport/locale/timezone, sensitivity thresholds, user-selectable regions |
| Duplicate scheduling across replicas | DB locks/leases, deterministic queue IDs, idempotent processing, unique DB constraints |
| Scope too large for a recruitment project | Finish core flow end-to-end first; enhancements remain optional until all P0 acceptance tests pass |

## 22. Official Technical References

Use these as implementation references; verify the current stable versions at the time code is generated.

- Next.js App Router: https://nextjs.org/docs/app
- Next.js deployment: https://nextjs.org/docs/app/getting-started/deploying
- Node.js release status: https://nodejs.org/en/about/previous-releases
- Playwright browser installation and versioning: https://playwright.dev/docs/browsers
- BullMQ queues: https://docs.bullmq.io/guide/queues/
- BullMQ rate limiting: https://docs.bullmq.io/guide/rate-limiting
- BullMQ production guidance: https://docs.bullmq.io/guide/going-to-production
- Better Auth installation: https://better-auth.com/docs/installation
- Better Auth email/password: https://better-auth.com/docs/authentication/email-password
- Better Auth PostgreSQL: https://better-auth.com/docs/adapters/postgresql
- Resend Node.js SDK: https://resend.com/nodejs
- Discord incoming webhooks: https://docs.discord.com/developers/platform/webhooks
- GitHub repository creation: https://docs.github.com/en/repositories/creating-and-managing-repositories/quickstart-for-repositories
- GitHub Actions documentation: https://docs.github.com/en/actions

---

**Final instruction to the coding agent:** Treat this document as the source of truth. Build the complete core workflow, not just the front end. Prioritize security, correct outage/block classification, shared-target deduplication, and idempotent alerts. Keep the app runnable after each phase, add tests alongside behavior, and never claim that a repository, deployment, notification, or test succeeded unless the relevant command or integration confirms it.
