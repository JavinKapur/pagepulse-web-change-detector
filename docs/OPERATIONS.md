# PagePulse Operations & Deployment Guide

This document describes operations, deployments, scaling, database migrations, and disaster recovery for PagePulse.

## 1. Service Topologies

PagePulse consists of three primary processes:

1. **Web Service (`apps/web`):**
   - Serves the Next.js App Router UI and REST APIs.
   - Stateless, scales horizontally behind an HTTPS reverse proxy/load balancer.
   - Requires access to PostgreSQL and Redis (for rate limiting / job dispatch).

2. **Scheduler Process (`apps/worker/src/scheduler.ts`):**
   - Polls PostgreSQL for due watches using `FOR UPDATE SKIP LOCKED`.
   - Enqueues deduplicated jobs into Redis/BullMQ.
   - Safe to run in active-passive or active-active configurations with lock leases.

3. **Capture & Notification Worker (`apps/worker/src/index.ts`):**
   - Manages Playwright Chromium processes and executes jobs.
   - Must run in an environment with Chromium OS dependencies (or official Playwright Docker container).
   - Enforces per-host rate limits and global concurrency bounds.

## 2. Health & Liveness Endpoints

- `GET /api/health/live`: Returns `200 OK` `{ "status": "alive" }` if the process is responsive.
- `GET /api/health/ready`: Performs live connectivity checks to PostgreSQL, Redis, and Storage, returning `200 OK` or `503 Service Unavailable`.

## 3. Database Operations

### Migrations
```bash
# Generate SQL migrations after schema changes:
pnpm db:generate

# Apply migrations to the target database:
pnpm db:migrate
```

### Backup & Restore
- **PostgreSQL:**
  ```bash
  # Backup
  pg_dump -Fc -U postgres -d pagepulse > pagepulse_backup.dump

  # Restore
  pg_restore -U postgres -d pagepulse -c pagepulse_backup.dump
  ```

## 4. Retention Policy & Garbage Collection

- **Snapshots with changes:** Retained 90 days by default.
- **Unchanged CheckRun records:** Retained 30 days.
- **Unchanged screenshot artifacts:** Retained 7 days.
- A scheduled cleanup job removes expired artifact objects from S3/local storage followed by their database metadata.
