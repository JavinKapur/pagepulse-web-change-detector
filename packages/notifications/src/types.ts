export interface AlertNotificationPayload {
  watchName: string;
  hostname: string;
  targetUrl: string;
  changeType: 'CHANGE' | 'RECOVERY' | 'INCIDENT' | 'TEST';
  timestamp: Date;
  changeSummary: string;
  diffUrl: string;
}

export interface NotificationSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface INotificationChannelAdapter {
  channel: 'email' | 'telegram' | 'discord';
  send(config: Record<string, unknown>, payload: AlertNotificationPayload): Promise<NotificationSendResult>;
}
