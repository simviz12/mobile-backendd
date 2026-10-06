export interface PushNotificationPayload {
  fcmToken: string;
  commandId: string;
  type: string;
  payloadString: string;
  issuedAt: string;
  ttlSeconds: number;
}

export interface PushNotificationResult {
  success: boolean;
  messageId?: string;
  error?: 'FCM_TOKEN_INVALID' | 'FCM_ERROR';
  details?: string;
}

export interface PushNotificationPort {
  sendDataMessage(payload: PushNotificationPayload): Promise<PushNotificationResult>;
}

export const PUSH_NOTIFICATION_PORT = Symbol('PUSH_NOTIFICATION_PORT');
