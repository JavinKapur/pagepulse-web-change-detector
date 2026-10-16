import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRepository, encryptSecret } from '@pagepulse/db';
import { MockCapturer } from '@pagepulse/browser';
import { NotificationDispatcher } from '@pagepulse/notifications';
import { InMemoryJobQueue } from './queue.js';
import { PagePulseScheduler } from './scheduler.js';
import { BrowserWorker } from './browser-worker.js';
import { NotificationWorker, type NotificationDeliveryJobData } from './notification-worker.js';
import { deriveTargetKey } from '@pagepulse/core';

describe('Worker & Scheduler End-to-End Flow', () => {
  const testKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  let repo: MemoryRepository;
  let mockCapturer: MockCapturer;
  let captureQueue: InMemoryJobQueue<{ targetId: string }>;
  let notificationQueue: InMemoryJobQueue<NotificationDeliveryJobData>;
  let scheduler: PagePulseScheduler;
  let browserWorker: BrowserWorker;
  let notificationWorker: NotificationWorker;
  let dispatcher: NotificationDispatcher;

  beforeEach(() => {
    repo = new MemoryRepository();
    mockCapturer = new MockCapturer();
    captureQueue = new InMemoryJobQueue<{ targetId: string }>();
    notificationQueue = new InMemoryJobQueue<NotificationDeliveryJobData>();

    dispatcher = new NotificationDispatcher({ encryptionKey: testKey });
    browserWorker = new BrowserWorker(repo, mockCapturer, notificationQueue, {
      appUrl: 'http://localhost:3000',
    });
    scheduler = new PagePulseScheduler(repo, captureQueue);
    notificationWorker = new NotificationWorker(repo, dispatcher, notificationQueue);
    notificationWorker.start();
  });

  it('scheduler groups due watches by target and advances check times', async () => {
    const user1 = await repo.createUser({ email: 'u1@test.com', displayName: 'U1' });
    const user2 = await repo.createUser({ email: 'u2@test.com', displayName: 'U2' });

    const target = await repo.findOrCreateTarget(
      'https://example.com/blog',
      deriveTargetKey('https://example.com/blog'),
      'example.com'
    );

    const past = new Date(Date.now() - 1000);
    const watch1 = await repo.createWatch({
      userId: user1.id,
      targetId: target.id,
      name: 'Blog Watch 1',
      intervalMinutes: 15,
      enabled: true,
      sensitivity: 'normal',
      includeSelectors: [],
      ignoreSelectors: [],
      normalizationRules: {},
      status: 'OK',
      nextCheckAt: past,
    });

    const watch2 = await repo.createWatch({
      userId: user2.id,
      targetId: target.id,
      name: 'Blog Watch 2',
      intervalMinutes: 30,
      enabled: true,
      sensitivity: 'normal',
      includeSelectors: [],
      ignoreSelectors: [],
      normalizationRules: {},
      status: 'OK',
      nextCheckAt: past,
    });

    const stats = await scheduler.runTick(new Date());

    expect(stats.dueWatchesFound).toBe(2);
    expect(stats.distinctTargetsEnqueued).toBe(1); // Coalesced into 1 target capture job!

    // Check that nextCheckAt was advanced
    const updatedW1 = await repo.getWatchById(watch1.id, user1.id);
    const updatedW2 = await repo.getWatchById(watch2.id, user2.id);

    expect(updatedW1!.nextCheckAt.getTime()).toBeGreaterThan(Date.now());
    expect(updatedW2!.nextCheckAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('first healthy capture creates baseline without sending alerts', async () => {
    const user = await repo.createUser({ email: 'alice@test.com', displayName: 'Alice' });
    const encryptedConfig = encryptSecret({ email: 'alice@test.com' }, testKey);

    await repo.createNotificationEndpoint({
      userId: user.id,
      channel: 'email',
      encryptedConfig,
      enabled: true,
    });

    const target = await repo.findOrCreateTarget(
      'https://shop.com/sale',
      deriveTargetKey('https://shop.com/sale'),
      'shop.com'
    );

    const watch = await repo.createWatch({
      userId: user.id,
      targetId: target.id,
      name: 'Sale Watch',
      intervalMinutes: 15,
      enabled: true,
      sensitivity: 'normal',
      includeSelectors: [],
      ignoreSelectors: [],
      normalizationRules: {},
      status: 'UNKNOWN',
      nextCheckAt: new Date(),
    });

    mockCapturer.setFixture('https://shop.com/sale', {
      httpStatus: 200,
      pageTitle: 'Summer Sale',
      rawText: 'Item A: $50\nItem B: $100',
    });

    await browserWorker.processTargetCapture(target.id);

    const snapshot = await repo.getLatestSnapshotForWatch(watch.id);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.sequenceNo).toBe(1);
    expect(snapshot!.changeSummaryJson).toHaveProperty('isBaseline', true);

    const updatedWatch = await repo.getWatchById(watch.id, user.id);
    expect(updatedWatch!.status).toBe('OK');
    expect(updatedWatch!.baselineEstablishedAt).not.toBeNull();

    // Baseline creation MUST NOT emit alert deliveries
    expect(repo.alertEvents.size).toBe(0);
    expect(repo.deliveries.size).toBe(0);
  });

  it('unchanged capture does NOT create a new snapshot', async () => {
    const user = await repo.createUser({ email: 'bob@test.com', displayName: 'Bob' });
    const target = await repo.findOrCreateTarget(
      'https://status.io',
      deriveTargetKey('https://status.io'),
      'status.io'
    );

    const watch = await repo.createWatch({
      userId: user.id,
      targetId: target.id,
      name: 'Status Watch',
      intervalMinutes: 15,
      enabled: true,
      sensitivity: 'normal',
      includeSelectors: [],
      ignoreSelectors: [],
      normalizationRules: {},
      status: 'UNKNOWN',
      nextCheckAt: new Date(),
    });

    mockCapturer.setFixture('https://status.io', {
      httpStatus: 200,
      pageTitle: 'All Systems Operational',
      rawText: 'Operational',
    });

    // Run 1: establishes baseline
    await browserWorker.processTargetCapture(target.id);
    expect(repo.snapshots.size).toBe(1);

    // Run 2: same content
    await browserWorker.processTargetCapture(target.id);

    // CheckRun recorded, but NO new snapshot
    expect(repo.checkRuns.size).toBe(2);
    expect(repo.snapshots.size).toBe(1);
  });

  it('meaningful content change creates new snapshot and delivers alert', async () => {
    const user = await repo.createUser({ email: 'carol@test.com', displayName: 'Carol' });
    const encryptedConfig = encryptSecret({ email: 'carol@test.com' }, testKey);

    await repo.createNotificationEndpoint({
      userId: user.id,
      channel: 'email',
      encryptedConfig,
      enabled: true,
    });

    const target = await repo.findOrCreateTarget(
      'https://saas.com/pricing',
      deriveTargetKey('https://saas.com/pricing'),
      'saas.com'
    );

    const watch = await repo.createWatch({
      userId: user.id,
      targetId: target.id,
      name: 'SaaS Pricing',
      intervalMinutes: 15,
      enabled: true,
      sensitivity: 'normal',
      includeSelectors: [],
      ignoreSelectors: [],
      normalizationRules: {},
      status: 'UNKNOWN',
      nextCheckAt: new Date(),
    });

    // Baseline
    mockCapturer.setFixture('https://saas.com/pricing', {
      httpStatus: 200,
      pageTitle: 'Pricing',
      rawText: 'Starter: $10/mo\nBusiness: $50/mo\nEnterprise: Contact us',
    });
    await browserWorker.processTargetCapture(target.id);

    // Update with meaningful change
    mockCapturer.setFixture('https://saas.com/pricing', {
      httpStatus: 200,
      pageTitle: 'Pricing Updated',
      rawText: 'Starter: $29/mo\nBusiness: $99/mo\nEnterprise: Contact sales team today',
    });
    await browserWorker.processTargetCapture(target.id);

    const latestSnap = await repo.getLatestSnapshotForWatch(watch.id);
    expect(latestSnap).not.toBeNull();
    expect(latestSnap!.sequenceNo).toBe(2);

    // Check that alert event was created and dispatched
    expect(repo.alertEvents.size).toBe(1);
    expect(repo.deliveries.size).toBe(1);

    const delivery = Array.from(repo.deliveries.values())[0];
    expect(delivery.status).toBe('SENT');
  });

  it('outage or bot challenge updates status without overwriting baseline snapshot', async () => {
    const user = await repo.createUser({ email: 'dave@test.com', displayName: 'Dave' });
    const target = await repo.findOrCreateTarget(
      'https://api.example.com',
      deriveTargetKey('https://api.example.com'),
      'api.example.com'
    );

    const watch = await repo.createWatch({
      userId: user.id,
      targetId: target.id,
      name: 'API Watch',
      intervalMinutes: 15,
      enabled: true,
      sensitivity: 'normal',
      includeSelectors: [],
      ignoreSelectors: [],
      normalizationRules: {},
      status: 'UNKNOWN',
      nextCheckAt: new Date(),
    });

    // 1. Establish valid baseline
    mockCapturer.setFixture('https://api.example.com', {
      httpStatus: 200,
      pageTitle: 'API v1 Docs',
      rawText: 'API Documentation Version 1.0',
    });
    await browserWorker.processTargetCapture(target.id);

    const baselineSnap = await repo.getLatestSnapshotForWatch(watch.id);
    expect(baselineSnap!.normalizedText).toBe('API Documentation Version 1.0');

    // 2. Target experiences 503 outage
    mockCapturer.setFixture('https://api.example.com', {
      httpStatus: 503,
      pageTitle: '503 Service Unavailable',
      rawText: 'Server temporarily unavailable',
    });
    await browserWorker.processTargetCapture(target.id);

    const updatedWatch = await repo.getWatchById(watch.id, user.id);
    expect(updatedWatch!.status).toBe('ERROR');

    // Baseline snapshot MUST NOT be overwritten by the error page!
    const snapAfterOutage = await repo.getLatestSnapshotForWatch(watch.id);
    expect(snapAfterOutage!.sequenceNo).toBe(1);
    expect(snapAfterOutage!.normalizedText).toBe('API Documentation Version 1.0');

    // 3. Target serves Cloudflare challenge
    mockCapturer.setFixture('https://api.example.com', {
      httpStatus: 200,
      pageTitle: 'Just a moment...',
      htmlContent: '<div>Please verify you are a human</div><div class="cf-turnstile"></div>',
      rawText: 'Security check in progress',
    });
    await browserWorker.processTargetCapture(target.id);

    const blockedWatch = await repo.getWatchById(watch.id, user.id);
    expect(blockedWatch!.status).toBe('BLOCKED');

    // Baseline snapshot STILL preserved intact!
    const snapAfterBlock = await repo.getLatestSnapshotForWatch(watch.id);
    expect(snapAfterBlock!.sequenceNo).toBe(1);
    expect(snapAfterBlock!.normalizedText).toBe('API Documentation Version 1.0');
  });
});
