import type { AlertNotificationPayload, INotificationChannelAdapter, NotificationSendResult } from './types.js';

export class TelegramNotificationAdapter implements INotificationChannelAdapter {
  channel = 'telegram' as const;
  private defaultBotToken?: string;

  constructor(defaultBotToken?: string) {
    this.defaultBotToken = defaultBotToken;
  }

  async send(
    config: Record<string, unknown>,
    payload: AlertNotificationPayload
  ): Promise<NotificationSendResult> {
    const botToken = String(config.botToken || this.defaultBotToken || '').trim();
    const chatId = String(config.chatId || '').trim();

    if (!botToken || !chatId) {
      return { success: false, error: 'Missing Telegram bot token or chat ID' };
    }

    const messageText = `🔔 *[PagePulse] ${payload.changeType} Alert*\n\n` +
      `*Watch:* ${escapeMarkdown(payload.watchName)}\n` +
      `*Host:* \`${escapeMarkdown(payload.hostname)}\`\n` +
      `*Summary:* ${escapeMarkdown(payload.changeSummary)}\n` +
      `*Time:* ${payload.timestamp.toISOString()}\n\n` +
      `[👉 View Diff & History](${payload.diffUrl})`;

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: 'Markdown',
          disable_web_page_preview: false,
        }),
      });

      const data = (await res.json()) as { ok: boolean; description?: string; result?: { message_id: number } };
      if (!data.ok) {
        return { success: false, error: data.description || 'Telegram API rejected request' };
      }

      return {
        success: true,
        providerMessageId: String(data.result?.message_id),
      };
    } catch (err: unknown) {
      const error = err as Error;
      return { success: false, error: error.message };
    }
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
