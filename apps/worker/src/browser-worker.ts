import fs from 'node:fs';
import path from 'node:path';
import type { IPagePulseRepository, WatchRecord } from '@pagepulse/db';
import type { IPageCapturer } from '@pagepulse/browser';
import type { IJobQueue } from './queue.js';
import type { AlertNotificationPayload } from '@pagepulse/notifications';
import {
  classifyResponse,
  normalizeText,
  computeContentHash,
  computeTextDiff,
  evaluateMeaningfulChange,
  createAlertIdempotencyKey,
} from '@pagepulse/core';

// Local directory where screenshots are stored (relative to CWD when worker runs)
const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'screenshots');

/** Saves a screenshot PNG buffer to local disk and returns the file path. */
function saveScreenshotLocally(objectKey: string, data: Buffer): void {
  if (!data || data.length === 0) return;
  const filePath = path.join(SCREENSHOTS_DIR, objectKey);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, data);
}

export interface BrowserWorkerOptions {
  appUrl?: string;
}

export class BrowserWorker {
  private repo: IPagePulseRepository;
  private capturer: IPageCapturer;
  private notificationQueue: IJobQueue<{
    alertEventId: string;
    endpointId: string;
    payload: AlertNotificationPayload;
  }>;
  private appUrl: string;

  constructor(
    repo: IPagePulseRepository,
    capturer: IPageCapturer,
    notificationQueue: IJobQueue<{
      alertEventId: string;
      endpointId: string;
      payload: AlertNotificationPayload;
    }>,
    options: BrowserWorkerOptions = {}
  ) {
    this.repo = repo;
    this.capturer = capturer;
    this.notificationQueue = notificationQueue;
    this.appUrl = options.appUrl || 'http://localhost:3000';
  }

  async processTargetCapture(targetId: string): Promise<void> {
    const target = await this.repo.getTargetById(targetId);
    if (!target) return;

    const watches = await this.repo.listWatchesForTarget(targetId);
    if (watches.length === 0) return;

    const startTime = new Date();

    // Collect combined selectors for the target capture
    const allInclude = Array.from(new Set(watches.flatMap((w) => w.includeSelectors)));
    const allIgnore = Array.from(new Set(watches.flatMap((w) => w.ignoreSelectors)));

    const captureResult = await this.capturer.capture({
      url: target.canonicalUrl,
      includeSelectors: allInclude,
      ignoreSelectors: allIgnore,
    });

    const finishedTime = new Date();
    const classification = classifyResponse({
      httpStatus: captureResult.httpStatus,
      errorMessage: captureResult.errorMessage,
      pageTitle: captureResult.pageTitle,
      htmlContent: captureResult.htmlContent,
      headers: captureResult.responseHeaders,
    });

    // Record CheckRun
    const checkRun = await this.repo.createCheckRun({
      targetId: target.id,
      outcome: classification.classification,
      httpStatus: captureResult.httpStatus,
      finalUrl: captureResult.finalUrl,
      durationMs: captureResult.durationMs,
      errorCode: captureResult.errorMessage || null,
      textHash: captureResult.rawText ? computeContentHash(captureResult.rawText) : null,
      changedPixelRatio: null,
      metadataJson: {
        pageTitle: captureResult.pageTitle,
        reason: classification.reason,
      },
      startedAt: startTime,
      finishedAt: finishedTime,
    });

    // Handle Unhealthy (ERROR, BLOCKED, RATE_LIMITED)
    if (!classification.isHealthy) {
      const watchStatus = classification.classification === 'BLOCKED' ? 'BLOCKED' : 'ERROR';
      for (const watch of watches) {
        await this.repo.updateWatch(watch.id, watch.userId, {
          status: watchStatus,
          lastErrorMessage: classification.reason,
          lastCheckedAt: finishedTime,
        });
      }
      return;
    }

    // Target is healthy! Update target
    await this.repo.updateTargetNextFetch(target.id, new Date(Date.now() + 15 * 60 * 1000), finishedTime);

    // Process each subscribed watch individually
    for (const watch of watches) {
      await this.processWatchChangeDetection(watch, checkRun.id, captureResult, finishedTime);
    }
  }

  private async processWatchChangeDetection(
    watch: WatchRecord,
    checkRunId: string,
    captureResult: { rawText: string; selectedText: string; screenshotPng: Buffer },
    timestamp: Date
  ): Promise<void> {
    const rawContent =
      watch.includeSelectors.length > 0 ? captureResult.selectedText : captureResult.rawText;

    const norm = normalizeText(rawContent, watch.normalizationRules);
    const contentHash = computeContentHash(norm.normalizedText);

    const latestSnapshot = await this.repo.getLatestSnapshotForWatch(watch.id);

    // Baseline creation (First run)
    if (!latestSnapshot) {
      const baselineKey = `screenshots/${watch.id}/baseline.png`;
      saveScreenshotLocally(baselineKey, captureResult.screenshotPng);

      await this.repo.createSnapshot({
        watchId: watch.id,
        checkRunId,
        sequenceNo: 1,
        contentHash,
        normalizedText: norm.normalizedText,
        screenshotObjectKey: baselineKey,
        previousSnapshotId: null,
        changeSummaryJson: {
          isBaseline: true,
          lines: norm.normalizedText ? norm.normalizedText.split('\n').length : 0,
        },
      });

      await this.repo.updateWatch(watch.id, watch.userId, {
        status: 'OK',
        baselineEstablishedAt: timestamp,
        lastCheckedAt: timestamp,
        lastErrorMessage: null,
      });

      // No alert on baseline establishment per SDD FR-01
      return;
    }

    // Check if identical hash
    if (latestSnapshot.contentHash === contentHash) {
      await this.repo.updateWatch(watch.id, watch.userId, {
        status: 'OK',
        lastCheckedAt: timestamp,
        lastErrorMessage: null,
      });
      return;
    }

    // Different hash: Evaluate change
    const diff = computeTextDiff(latestSnapshot.normalizedText, norm.normalizedText);
    const evalResult = evaluateMeaningfulChange(
      watch.sensitivity,
      diff.textChangeRatio,
      0 // Visual diff ratio fallback
    );

    if (!evalResult.isMeaningful) {
      // Noise suppressed
      await this.repo.updateWatch(watch.id, watch.userId, {
        status: 'OK',
        lastCheckedAt: timestamp,
        lastErrorMessage: null,
      });
      return;
    }

    // Meaningful change confirmed!
    const snapKey = `screenshots/${watch.id}/snap_${latestSnapshot.sequenceNo + 1}.png`;
    saveScreenshotLocally(snapKey, captureResult.screenshotPng);

    const newSnapshot = await this.repo.createSnapshot({
      watchId: watch.id,
      checkRunId,
      sequenceNo: latestSnapshot.sequenceNo + 1,
      contentHash,
      normalizedText: norm.normalizedText,
      screenshotObjectKey: snapKey,
      previousSnapshotId: latestSnapshot.id,
      changeSummaryJson: {
        summary: diff.summary,
        addedLines: diff.addedLines,
        deletedLines: diff.deletedLines,
        addedWords: diff.addedWords,
        deletedWords: diff.deletedWords,
        reason: evalResult.reason,
      },
    });

    await this.repo.updateWatch(watch.id, watch.userId, {
      status: 'OK',
      lastCheckedAt: timestamp,
      lastChangedAt: timestamp,
      lastErrorMessage: null,
    });

    // Enqueue Alert Events
    const endpoints = await this.repo.listNotificationEndpoints(watch.userId);
    const target = await this.repo.getTargetById(watch.targetId);

    const alertPayload: AlertNotificationPayload = {
      watchName: watch.name,
      hostname: target?.hostname || 'unknown',
      targetUrl: target?.canonicalUrl || '',
      changeType: 'CHANGE',
      timestamp,
      changeSummary: `${diff.summary}. ${evalResult.reason}`,
      diffUrl: `${this.appUrl}/watches/${watch.id}/diff?from=${latestSnapshot.id}&to=${newSnapshot.id}`,
    };

    for (const ep of endpoints) {
      if (!ep.enabled) continue;
      const idempotencyKey = createAlertIdempotencyKey(watch.id, newSnapshot.id, ep.id, ep.channel);
      const alertEvent = await this.repo.createAlertEvent({
        watchId: watch.id,
        snapshotId: newSnapshot.id,
        type: 'CHANGE',
        idempotencyKey,
      });

      await this.notificationQueue.add('deliver-alert', {
        alertEventId: alertEvent.id,
        endpointId: ep.id,
        payload: alertPayload,
      });
    }
  }
}
