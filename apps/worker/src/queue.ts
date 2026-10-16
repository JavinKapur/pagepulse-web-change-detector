export interface QueueJob<T> {
  id: string;
  name: string;
  data: T;
}

export interface IJobQueue<T> {
  add(name: string, data: T, opts?: { jobId?: string; delay?: number }): Promise<void>;
  process(handler: (job: QueueJob<T>) => Promise<void>): void;
  close(): Promise<void>;
}

export class InMemoryJobQueue<T> implements IJobQueue<T> {
  private jobs: QueueJob<T>[] = [];
  private handler: ((job: QueueJob<T>) => Promise<void>) | null = null;
  private isProcessing = false;
  private seenJobIds = new Set<string>();

  async add(name: string, data: T, opts?: { jobId?: string; delay?: number }): Promise<void> {
    const id = opts?.jobId || `job_${Date.now()}_${Math.random()}`;
    if (opts?.jobId && this.seenJobIds.has(opts.jobId)) {
      // Coalesce duplicate job ID
      return;
    }
    if (opts?.jobId) {
      this.seenJobIds.add(opts.jobId);
    }

    const job: QueueJob<T> = { id, name, data };
    this.jobs.push(job);
    this.triggerProcessing();
  }

  process(handler: (job: QueueJob<T>) => Promise<void>): void {
    this.handler = handler;
    this.triggerProcessing();
  }

  private async triggerProcessing(): Promise<void> {
    if (this.isProcessing || !this.handler) return;
    this.isProcessing = true;

    while (this.jobs.length > 0) {
      const job = this.jobs.shift();
      if (job && this.handler) {
        try {
          await this.handler(job);
        } catch (err) {
          console.error(`[InMemoryJobQueue] Job ${job.id} failed:`, err);
        }
      }
    }

    this.isProcessing = false;
  }

  async close(): Promise<void> {
    this.jobs = [];
    this.handler = null;
  }
}
