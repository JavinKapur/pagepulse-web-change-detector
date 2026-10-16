import { decryptSecret, type IPagePulseRepository, type NotificationEndpointRecord } from '@pagepulse/db';
import type { AlertNotificationPayload, INotificationChannelAdapter, NotificationSendResult } from './types.js';
import { EmailNotificationAdapter } from './email.js';
import { TelegramNotificationAdapter } from './telegram.js';
import { DiscordNotificationAdapter } from './discord.js';

export interface DispatcherOptions {
  encryptionKey: string;
  emailApiKey?: string;
  emailFrom?: string;
  telegramBotToken?: string;
}

export class NotificationDispatcher {
  private adapters: Map<string, INotificationChannelAdapter> = new Map();
  private encryptionKey: string;

  constructor(options: DispatcherOptions) {
    this.encryptionKey = options.encryptionKey;
    this.registerAdapter(new EmailNotificationAdapter(options.emailApiKey, options.emailFrom));
    this.registerAdapter(new TelegramNotificationAdapter(options.telegramBotToken));
    this.registerAdapter(new DiscordNotificationAdapter());
  }

  registerAdapter(adapter: INotificationChannelAdapter): void {
    this.adapters.set(adapter.channel, adapter);
  }

  async dispatchAlert(
    repo: IPagePulseRepository,
    alertEventId: string,
    endpoint: NotificationEndpointRecord,
    payload: AlertNotificationPayload
  ): Promise<NotificationSendResult> {
    const adapter = this.adapters.get(endpoint.channel);
    if (!adapter) {
      return { success: false, error: `No registered adapter for channel: ${endpoint.channel}` };
    }

    if (!endpoint.enabled) {
      return { success: false, error: 'Endpoint is disabled' };
    }

    let config: Record<string, unknown>;
    try {
      config = decryptSecret<Record<string, unknown>>(endpoint.encryptedConfig, this.encryptionKey);
    } catch (err: unknown) {
      const error = err as Error;
      return { success: false, error: `Failed to decrypt endpoint configuration: ${error.message}` };
    }

    // Create pending delivery record
    const delivery = await repo.createNotificationDelivery({
      alertEventId,
      endpointId: endpoint.id,
      status: 'PENDING',
      attempts: 0,
      providerMessageId: null,
      lastErrorCode: null,
      sentAt: null,
    });

    let attempts = 0;
    const maxAttempts = 3;
    let lastError: string | undefined;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const result = await adapter.send(config, payload);
        if (result.success) {
          await repo.updateDeliveryStatus(
            delivery.id,
            'SENT',
            attempts,
            result.providerMessageId
          );
          return result;
        }
        lastError = result.error;
      } catch (err: unknown) {
        lastError = (err as Error).message;
      }

      // Exponential backoff wait between retries (brief in workers)
      if (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempts)));
      }
    }

    await repo.updateDeliveryStatus(
      delivery.id,
      'FAILED',
      attempts,
      undefined,
      lastError
    );

    return {
      success: false,
      error: `Delivery failed after ${attempts} attempts: ${lastError}`,
    };
  }

  async sendTestNotification(
    endpoint: NotificationEndpointRecord,
    payload: AlertNotificationPayload
  ): Promise<NotificationSendResult> {
    const adapter = this.adapters.get(endpoint.channel);
    if (!adapter) {
      return { success: false, error: `No registered adapter for channel: ${endpoint.channel}` };
    }

    let config: Record<string, unknown>;
    try {
      config = decryptSecret<Record<string, unknown>>(endpoint.encryptedConfig, this.encryptionKey);
    } catch (err: unknown) {
      return { success: false, error: `Failed to decrypt endpoint config: ${(err as Error).message}` };
    }

    return adapter.send(config, payload);
  }
}
