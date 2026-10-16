import { MemoryRepository } from '@pagepulse/db';
import { PlaywrightCapturer } from '@pagepulse/browser';
import { NotificationDispatcher } from '@pagepulse/notifications';
import { InMemoryJobQueue } from './queue.js';
import { PagePulseScheduler } from './scheduler.js';
import { BrowserWorker } from './browser-worker.js';
import { NotificationWorker, type NotificationDeliveryJobData } from './notification-worker.js';

export * from './queue.js';
export * from './scheduler.js';
export * from './browser-worker.js';
export * from './notification-worker.js';

async function main() {
  const args = process.argv.slice(2);
  const runScheduler = args.includes('--scheduler') || args.includes('--all') || args.length === 0;
  const runWorker = args.includes('--worker') || args.includes('--all') || args.length === 0;

  console.log(`[PagePulse Worker Process] Starting (Scheduler: ${runScheduler}, Worker: ${runWorker})...`);

  const repo = new MemoryRepository();
  const captureQueue = new InMemoryJobQueue<{ targetId: string }>();
  const notificationQueue = new InMemoryJobQueue<NotificationDeliveryJobData>();

  const encryptionKey = process.env.ARTIFACT_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const dispatcher = new NotificationDispatcher({
    encryptionKey,
    emailApiKey: process.env.RESEND_API_KEY,
    emailFrom: process.env.EMAIL_FROM,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  });

  const capturer = new PlaywrightCapturer();
  const browserWorker = new BrowserWorker(repo, capturer, notificationQueue, {
    appUrl: process.env.APP_URL || 'http://localhost:3000',
  });

  const notificationWorker = new NotificationWorker(repo, dispatcher, notificationQueue);

  if (runWorker) {
    captureQueue.process(async (job) => {
      console.log(`[BrowserWorker] Processing capture for target ${job.data.targetId}`);
      await browserWorker.processTargetCapture(job.data.targetId);
    });
    notificationWorker.start();
    console.log('[PagePulse Worker] Worker queues active.');
  }

  if (runScheduler) {
    const scheduler = new PagePulseScheduler(repo, captureQueue);
    scheduler.start(30000);
    console.log('[PagePulse Scheduler] Scheduler started (interval 30s).');
  }
}

if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  main().catch((err) => {
    console.error('[Worker Process Error]:', err);
    process.exit(1);
  });
}
