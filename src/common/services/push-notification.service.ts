import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppConfig } from 'src/common/config/env.validation';

@Injectable()
export class PushNotificationService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private readonly logger = new Logger(PushNotificationService.name);

  onModuleInit() {
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: this.config.get('FIREBASE_PROJECT_ID'),
          clientEmail: this.config.get('FIREBASE_CLIENT_EMAIL'),
          privateKey: this.config
            .get('FIREBASE_PRIVATE_KEY')
            ?.replace(/\\n/g, '\n'),
        }),
      });
    }
  }

  async sendToMultipleTokens(payload: {
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void> {
    const chunks = this.chunkArray(payload.tokens, 500);

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      try {
        const response = await getMessaging().sendEachForMulticast({
          tokens: chunk,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'high_importance_channel',
            },
          },
          ...(payload.data ? { data: payload.data } : {}),
        });

        if (response.failureCount > 0) {
          const staleTokens: string[] = [];

          response.responses.forEach((r, i) => {
            if (!r.success) {
              this.logger.warn(
                `FCM delivery failed — title="${payload.title}" chunkIndex=${chunkIndex} tokenIndex=${i} code=${r.error?.code} message=${r.error?.message}`,
              );
              if (
                r.error?.code === 'messaging/registration-token-not-registered'
              ) {
                staleTokens.push(chunk[i]);
              }
            }
          });

          if (staleTokens.length > 0) {
            this.logger.log(
              `${staleTokens.length} stale FCM token(s) detected — title="${payload.title}" chunkIndex=${chunkIndex}`,
            );
            // Deactivate stale tokens in your UserDevice table, e.g.:
            // await this.prisma.userDevice.updateMany({
            //   where: { fcmToken: { in: staleTokens } },
            //   data: { isActive: false, updatedAt: new Date() },
            // });
          }
        }
      } catch (error) {
        this.logger.error(
          `FCM chunk send failed — title="${payload.title}" chunkIndex=${chunkIndex} chunkSize=${chunk.length} error=${(error as Error)?.message}`,
          (error as Error)?.stack,
        );
      }
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
