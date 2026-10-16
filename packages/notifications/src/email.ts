import { Resend } from 'resend';
import type { AlertNotificationPayload, INotificationChannelAdapter, NotificationSendResult } from './types.js';

export class EmailNotificationAdapter implements INotificationChannelAdapter {
  channel = 'email' as const;
  private resend: Resend | null = null;
  private fromEmail: string;

  constructor(apiKey?: string, fromEmail = 'alerts@pagepulse.dev') {
    this.fromEmail = fromEmail;
    if (apiKey && apiKey.trim().length > 0) {
      this.resend = new Resend(apiKey.trim());
    }
  }

  async send(
    config: Record<string, unknown>,
    payload: AlertNotificationPayload
  ): Promise<NotificationSendResult> {
    const recipient = String(config.email || config.recipient || '').trim();
    if (!recipient) {
      return { success: false, error: 'Missing recipient email address' };
    }

    const subject = `[PagePulse] ${payload.changeType}: ${payload.watchName} (${payload.hostname})`;
    const bodyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0;">PagePulse Change Alert</h2>
        <p style="font-size: 16px; color: #334155;">A meaningful change was detected on <strong>${payload.watchName}</strong>.</p>
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Target URL:</strong> <a href="${payload.targetUrl}" style="color: #2563eb;">${payload.targetUrl}</a></p>
          <p style="margin: 4px 0;"><strong>Status / Type:</strong> <span style="background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${payload.changeType}</span></p>
          <p style="margin: 4px 0;"><strong>Summary:</strong> ${payload.changeSummary}</p>
          <p style="margin: 4px 0;"><strong>Detected At:</strong> ${payload.timestamp.toUTCString()}</p>
        </div>
        <div style="margin-top: 24px; text-align: center;">
          <a href="${payload.diffUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">View Diff & Snapshot History</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 32px;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">You are receiving this alert because you configured a watch on PagePulse.</p>
      </div>
    `;

    // If no Resend API key is provided, log to console in development
    if (!this.resend) {
      console.log(`[EmailNotificationAdapter] [MOCK DEV SEND] To: ${recipient} | Subject: ${subject}`);
      return { success: true, providerMessageId: `mock_email_${Date.now()}` };
    }

    try {
      const response = await this.resend.emails.send({
        from: this.fromEmail,
        to: recipient,
        subject,
        html: bodyHtml,
      });

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      return { success: true, providerMessageId: response.data?.id };
    } catch (err: unknown) {
      const error = err as Error;
      return { success: false, error: error.message };
    }
  }
}
