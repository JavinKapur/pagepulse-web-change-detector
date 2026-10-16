import type { IPagePulseRepository } from '@pagepulse/db';
import type { AlertNotificationPayload, NotificationDispatcher } from '@pagepulse/notifications';
import type { IJobQueue, QueueJob } from './queue.js';

export interface NotificationDeliveryJobData {
  alertEventId: string;
  endpointId: string;
  payload: AlertNotificationPayload;
}

export class NotificationWorker {
  private repo: IPagePulseRepository;
  private dispatcher: NotificationDispatcher;
  private queue: IJobQueue<NotificationDeliveryJobData>;

  constructor(
    repo: IPagePulseRepository,
    dispatcher: NotificationDispatcher,
    queue: IJobQueue<NotificationDeliveryJobData>
  ) {
    this.repo = repo;
    this.dispatcher = dispatcher;
    this.queue = queue;
  }

  start(): void {
    this.queue.process(async (job: QueueJob<NotificationDeliveryJobData>) => {
      const { alertEventId, endpointId, payload } = job.data;
      // In MemoryRepository, endpoint can be fetched directly from map
      const endpoint = Array.from((this.repo as any).endpoints.values()).find(
        (e: any) => e.id === endpointId
      ) as any;

      if (!endpoint) {
        console.warn(`[NotificationWorker] Endpoint ${endpointId} not found, skipping.`);
        return;
      }

      await this.dispatcher.dispatchAlert(this.repo, alertEventId, endpoint, payload);
    });
  }
}
