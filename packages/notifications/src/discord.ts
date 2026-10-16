import type { AlertNotificationPayload, INotificationChannelAdapter, NotificationSendResult } from './types.js';

export class DiscordNotificationAdapter implements INotificationChannelAdapter {
  channel = 'discord' as const;

  async send(
    config: Record<string, unknown>,
    payload: AlertNotificationPayload
  ): Promise<NotificationSendResult> {
    const webhookUrl = String(config.webhookUrl || '').trim();
    if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      return { success: false, error: 'Invalid or missing Discord webhook URL' };
    }

    const color = payload.changeType === 'INCIDENT' ? 0xef4444 : payload.changeType === 'RECOVERY' ? 0x22c55e : 0x3b82f6;

    const embed = {
      title: `🔔 [PagePulse] ${payload.changeType}: ${payload.watchName}`,
      url: payload.diffUrl,
      color,
      fields: [
        { name: 'Target URL', value: payload.targetUrl, inline: false },
        { name: 'Summary', value: payload.changeSummary, inline: false },
        { name: 'Host', value: payload.hostname, inline: true },
        { name: 'Detected At', value: payload.timestamp.toISOString(), inline: true },
      ],
      footer: { text: 'PagePulse Website Change Detector' },
      timestamp: payload.timestamp.toISOString(),
    };

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'PagePulse Alerts',
          embeds: [embed],
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        return {
          success: false,
          error: `Discord webhook failed with HTTP ${res.status}: ${errorText}`,
        };
      }

      return {
        success: true,
        providerMessageId: `discord_${Date.now()}`,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return { success: false, error: error.message };
    }
  }
}
