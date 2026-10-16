import { describe, it, expect, beforeEach } from 'vitest';
import { EmailNotificationAdapter } from './email.js';
import { DiscordNotificationAdapter } from './discord.js';
import { TelegramNotificationAdapter } from './telegram.js';
import { NotificationDispatcher } from './dispatcher.js';
import { MemoryRepository, encryptSecret } from '@pagepulse/db';
import type { AlertNotificationPayload } from './types.js';

describe('Notification Adapters & Dispatcher', () => {
  const testKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  let repo: MemoryRepository;
  const samplePayload: AlertNotificationPayload = {
    watchName: 'Competitor Pricing',
    hostname: 'competitor.com',
    targetUrl: 'https://competitor.com/pricing',
    changeType: 'CHANGE',
    timestamp: new Date(),
    changeSummary: '+10 lines, -2 lines (+45 words)',
    diffUrl: 'https://pagepulse.dev/watches/123/diff',
  };

  beforeEach(() => {
    repo = new MemoryRepository();
  });

  it('email adapter successfully sends mock email when no API key configured', async () => {
    const adapter = new EmailNotificationAdapter();
    const result = await adapter.send({ email: 'user@example.com' }, samplePayload);
    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBeDefined();
  });

  it('email adapter rejects missing email', async () => {
    const adapter = new EmailNotificationAdapter();
    const result = await adapter.send({}, samplePayload);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing recipient');
  });

  it('discord adapter rejects malformed webhook URLs', async () => {
    const adapter = new DiscordNotificationAdapter();
    const result = await adapter.send({ webhookUrl: 'https://malicious.com/hook' }, samplePayload);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid or missing Discord webhook URL');
  });

  it('telegram adapter rejects missing chat ID or bot token', async () => {
    const adapter = new TelegramNotificationAdapter();
    const result = await adapter.send({ botToken: '123:ABC' }, samplePayload);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing Telegram bot token or chat ID');
  });

  it('dispatcher handles full alert dispatch cycle with delivery record creation', async () => {
    const user = await repo.createUser({ email: 'user@example.com', displayName: 'User' });
    const encryptedConfig = encryptSecret({ email: 'user@example.com' }, testKey);

    const endpoint = await repo.createNotificationEndpoint({
      userId: user.id,
      channel: 'email',
      encryptedConfig,
      enabled: true,
    });

    const alertEvent = await repo.createAlertEvent({
      watchId: 'wtc-1',
      snapshotId: 'snp-1',
      type: 'CHANGE',
      idempotencyKey: 'idemp-1',
    });

    const dispatcher = new NotificationDispatcher({ encryptionKey: testKey });
    const result = await dispatcher.dispatchAlert(repo, alertEvent.id, endpoint, samplePayload);

    expect(result.success).toBe(true);
    expect(repo.deliveries.size).toBe(1);

    const delivery = Array.from(repo.deliveries.values())[0];
    expect(delivery.status).toBe('SENT');
    expect(delivery.attempts).toBe(1);
  });
});
