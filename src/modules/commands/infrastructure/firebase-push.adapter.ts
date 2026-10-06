import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getMessaging, Message } from 'firebase-admin/messaging';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  PushNotificationPayload,
  PushNotificationPort,
  PushNotificationResult,
} from '../domain/push-notification.port.js';

@Injectable()
export class FirebasePushAdapter implements PushNotificationPort {
  private readonly logger = new Logger(FirebasePushAdapter.name);
  private firebaseApp!: App;

  constructor(private readonly configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    const relativePath = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_PATH',
    );

    if (!relativePath) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_PATH is required but not configured.',
      );
    }

    const fullPath = resolve(process.cwd(), relativePath);

    if (!existsSync(fullPath)) {
      throw new Error(
        `Firebase service account file not found at path: ${fullPath}`,
      );
    }

    try {
      const serviceAccount = JSON.parse(readFileSync(fullPath, 'utf8'));
      const apps = getApps();

      if (apps.length > 0) {
        this.firebaseApp = apps[0];
      } else {
        this.firebaseApp = initializeApp({
          credential: cert(serviceAccount),
        });
      }

      this.logger.log(
        `Firebase Admin SDK initialized successfully with project: ${serviceAccount.project_id}`,
      );
    } catch (err) {
      throw new Error(
        `Failed to initialize Firebase Admin SDK from ${fullPath}: ${(err as Error).message}`,
      );
    }
  }

  async sendDataMessage(
    payload: PushNotificationPayload,
  ): Promise<PushNotificationResult> {
    try {
      const message: Message = {
        token: payload.fcmToken,
        data: {
          commandId: payload.commandId,
          type: payload.type,
          payload: payload.payloadString,
          issuedAt: payload.issuedAt,
        },
        android: {
          priority: 'high',
          ttl: payload.ttlSeconds * 1000,
        },
      };

      const messageId = await getMessaging(this.firebaseApp).send(message);
      this.logger.log(`FCM message sent successfully. ID: ${messageId}`);

      return {
        success: true,
        messageId,
      };
    } catch (error: any) {
      const errorCode = error?.code || '';
      this.logger.warn(`FCM send failed: ${errorCode} - ${error.message}`);

      // Check for unregistered or invalid token error codes
      if (
        errorCode === 'messaging/registration-token-not-registered' ||
        errorCode === 'messaging/invalid-registration-token' ||
        errorCode === 'messaging/invalid-argument'
      ) {
        return {
          success: false,
          error: 'FCM_TOKEN_INVALID',
          details: error.message,
        };
      }

      return {
        success: false,
        error: 'FCM_ERROR',
        details: error.message,
      };
    }
  }
}
