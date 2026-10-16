import { MemoryRepository, encryptSecret } from '@pagepulse/db';
import { MockCapturer } from '@pagepulse/browser';
import { NotificationDispatcher } from '@pagepulse/notifications';
import { BrowserWorker } from '@pagepulse/worker';
import { InMemoryJobQueue } from '@pagepulse/worker';
import { deriveTargetKey } from '@pagepulse/core';

// Global singleton instance for Next.js development and runtime persistence
declare global {
  // eslint-disable-next-line no-var
  var __pagepulse_repo: MemoryRepository | undefined;
  // eslint-disable-next-line no-var
  var __pagepulse_capturer: MockCapturer | undefined;
  // eslint-disable-next-line no-var
  var __pagepulse_worker: BrowserWorker | undefined;
}

export const repo = globalThis.__pagepulse_repo || new MemoryRepository();
if (!globalThis.__pagepulse_repo) globalThis.__pagepulse_repo = repo;

export const capturer = globalThis.__pagepulse_capturer || new MockCapturer();
if (!globalThis.__pagepulse_capturer) globalThis.__pagepulse_capturer = capturer;

const notificationQueue = new InMemoryJobQueue<any>();
export const worker =
  globalThis.__pagepulse_worker ||
  new BrowserWorker(repo, capturer, notificationQueue, {
    appUrl: process.env.APP_URL || 'http://localhost:3000',
  });
if (!globalThis.__pagepulse_worker) globalThis.__pagepulse_worker = worker;

export const encryptionKey =
  process.env.ARTIFACT_ENCRYPTION_KEY ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

export const dispatcher = new NotificationDispatcher({
  encryptionKey,
  emailApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
});

// Seed default demo user and initial watch if empty
async function seedDefaultData() {
  const users = Array.from(repo.users.values());
  if (users.length === 0) {
    const user = await repo.createUser({
      email: 'demo@pagepulse.dev',
      displayName: 'Javin Kapur',
    });

    const targetUrl = 'https://news.ycombinator.com';
    const target = await repo.findOrCreateTarget(
      targetUrl,
      deriveTargetKey(targetUrl),
      'news.ycombinator.com'
    );

    const watch = await repo.createWatch({
      userId: user.id,
      targetId: target.id,
      name: 'Hacker News Frontpage',
      intervalMinutes: 15,
      enabled: true,
      sensitivity: 'normal',
      includeSelectors: ['.titleline'],
      ignoreSelectors: ['.subline'],
      normalizationRules: { stripTimestamps: true, stripCounters: true },
      status: 'OK',
      nextCheckAt: new Date(Date.now() + 15 * 60 * 1000),
      baselineEstablishedAt: new Date(Date.now() - 3600000),
      lastCheckedAt: new Date(Date.now() - 60000),
      lastChangedAt: new Date(Date.now() - 300000),
    });

    const run = await repo.createCheckRun({
      targetId: target.id,
      outcome: 'OK',
      httpStatus: 200,
      finalUrl: targetUrl,
      durationMs: 420,
      errorCode: null,
      textHash: 'hash-demo-1',
      changedPixelRatio: '0.015',
      metadataJson: { pageTitle: 'Hacker News' },
      startedAt: new Date(Date.now() - 3600000),
      finishedAt: new Date(Date.now() - 3600000 + 420),
    });

    await repo.createSnapshot({
      watchId: watch.id,
      checkRunId: run.id,
      sequenceNo: 1,
      contentHash: 'hash-demo-1',
      normalizedText: '1. Show HN: PagePulse - Modern Web Change Detector\n2. Announcing TypeScript 5.8\n3. PostgreSQL 18 Released',
      screenshotObjectKey: 'screenshots/demo/1.png',
      previousSnapshotId: null,
      changeSummaryJson: { isBaseline: true },
    });

    await repo.createSnapshot({
      watchId: watch.id,
      checkRunId: run.id,
      sequenceNo: 2,
      contentHash: 'hash-demo-2',
      normalizedText: '1. Show HN: PagePulse - Modern Web Change Detector (Trending #1)\n2. Announcing TypeScript 5.8\n3. PostgreSQL 18 Released\n4. Deep Learning in 2026',
      screenshotObjectKey: 'screenshots/demo/2.png',
      previousSnapshotId: 'snap-1',
      changeSummaryJson: {
        summary: '+1 line, 0 deleted (+8 words)',
        addedLines: 1,
        deletedLines: 0,
      },
    });

    // Add demo notification endpoint
    await repo.createNotificationEndpoint({
      userId: user.id,
      channel: 'email',
      encryptedConfig: encryptSecret({ email: 'demo@pagepulse.dev' }, encryptionKey),
      enabled: true,
    });
  }
}

seedDefaultData().catch(console.error);

export async function getCurrentUserId(): Promise<string> {
  const users = Array.from(repo.users.values());
  if (users.length > 0) return users[0].id;
  const user = await repo.createUser({
    email: 'demo@pagepulse.dev',
    displayName: 'Javin Kapur',
  });
  return user.id;
}
