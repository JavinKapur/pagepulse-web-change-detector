import type { IPagePulseRepository } from '@pagepulse/db';
import type { IJobQueue } from './queue.js';
import { generateDeterministicJobId } from '@pagepulse/core';

export interface SchedulerStats {
  dueWatchesFound: number;
  distinctTargetsEnqueued: number;
  tickTimestamp: Date;
}

export class PagePulseScheduler {
  private repo: IPagePulseRepository;
  private captureQueue: IJobQueue<{ targetId: string }>;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(repo: IPagePulseRepository, captureQueue: IJobQueue<{ targetId: string }>) {
    this.repo = repo;
    this.captureQueue = captureQueue;
  }

  async runTick(now: Date = new Date()): Promise<SchedulerStats> {
    const dueWatches = await this.repo.findDueWatches(now);
    if (dueWatches.length === 0) {
      return {
        dueWatchesFound: 0,
        distinctTargetsEnqueued: 0,
        tickTimestamp: now,
      };
    }

    // Group due watches by targetId (Shared target deduplication)
    const targetGroups = new Map<string, typeof dueWatches>();
    for (const watch of dueWatches) {
      const existing = targetGroups.get(watch.targetId) || [];
      existing.push(watch);
      targetGroups.set(watch.targetId, existing);
    }

    let enqueuedTargetsCount = 0;

    for (const [targetId, watchesInGroup] of targetGroups.entries()) {
      const jobId = generateDeterministicJobId(targetId, now.getTime(), 1);

      await this.captureQueue.add(
        'capture-target',
        { targetId },
        { jobId }
      );
      enqueuedTargetsCount++;

      // Advance nextCheckAt for each watch so replicas don't re-enqueue
      for (const watch of watchesInGroup) {
        const nextCheckAt = new Date(now.getTime() + watch.intervalMinutes * 60 * 1000);
        await this.repo.updateWatch(watch.id, watch.userId, {
          nextCheckAt,
          lastCheckedAt: now,
        });
      }
    }

    return {
      dueWatchesFound: dueWatches.length,
      distinctTargetsEnqueued: enqueuedTargetsCount,
      tickTimestamp: now,
    };
  }

  start(intervalMs = 30000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(async () => {
      try {
        await this.runTick();
      } catch (err) {
        console.error('[Scheduler] Tick error:', err);
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }
}
