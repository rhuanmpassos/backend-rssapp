import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { Platform } from '@prisma/client';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo: Expo;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const accessToken = this.configService.get<string>('EXPO_ACCESS_TOKEN');
    this.expo = new Expo({
      accessToken: accessToken || undefined,
    });
  }

  async registerToken(
    userId: string,
    token: string,
    platform: string,
  ) {
    // Validate Expo push token format
    if (!Expo.isExpoPushToken(token)) {
      throw new Error('Invalid Expo push token');
    }

    // Determine platform
    let platformEnum: Platform;
    switch (platform.toLowerCase()) {
      case 'ios':
        platformEnum = Platform.ios;
        break;
      case 'android':
        platformEnum = Platform.android;
        break;
      case 'web':
        platformEnum = Platform.web;
        break;
      default:
        platformEnum = Platform.android;
    }

    // Upsert token (update if exists, create if not)
    const pushToken = await this.prisma.pushToken.upsert({
      where: { token },
      update: {
        userId,
        platform: platformEnum,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId,
        token,
        platform: platformEnum,
        isActive: true,
      },
    });

    this.logger.log(`Push token registered for user ${userId}`);

    return pushToken;
  }

  async unregisterToken(userId: string, token: string) {
    const existing = await this.prisma.pushToken.findFirst({
      where: { userId, token },
    });

    if (!existing) {
      return { success: false, message: 'Token not found' };
    }

    await this.prisma.pushToken.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    this.logger.log(`Push token unregistered for user ${userId}`);

    return { success: true };
  }

  async getUserTokens(userId: string) {
    return this.prisma.pushToken.findMany({
      where: { userId, isActive: true },
    });
  }

  async sendToUser(userId: string, notification: NotificationPayload) {
    const tokens = await this.getUserTokens(userId);

    if (tokens.length === 0) {
      this.logger.debug(`No active push tokens for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    const pushTokens = tokens.map((t) => t.token);
    return this.sendNotifications(pushTokens, notification);
  }

  async sendToUsers(userIds: string[], notification: NotificationPayload) {
    const tokens = await this.prisma.pushToken.findMany({
      where: {
        userId: { in: userIds },
        isActive: true,
      },
    });

    if (tokens.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const pushTokens = tokens.map((t) => t.token);
    return this.sendNotifications(pushTokens, notification);
  }

  async sendNotifications(pushTokens: string[], notification: NotificationPayload) {
    const messages: ExpoPushMessage[] = [];

    for (const token of pushTokens) {
      if (!Expo.isExpoPushToken(token)) {
        this.logger.warn(`Invalid push token: ${token}`);
        continue;
      }

      messages.push({
        to: token,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
      });
    }

    if (messages.length === 0) {
      return { sent: 0, failed: 0 };
    }

    // Chunk messages (Expo recommends batches of ~100)
    const chunks = this.expo.chunkPushNotifications(messages);
    const results = { sent: 0, failed: 0 };

    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        
        for (const ticket of ticketChunk) {
          if (ticket.status === 'ok') {
            results.sent++;
          } else {
            results.failed++;
            this.handlePushError(ticket);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to send push notifications: ${error}`);
        results.failed += chunk.length;
      }
    }

    this.logger.log(
      `Push notifications sent: ${results.sent} success, ${results.failed} failed`,
    );

    return results;
  }

  async notifyNewFeedItem(feedId: string, feedTitle: string, itemTitle: string, itemUrl: string) {
    // Get all users subscribed to this feed
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        feedId,
        enabled: true,
      },
      select: { userId: true },
    });

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const userIds = subscriptions.map((s) => s.userId);

    return this.sendToUsers(userIds, {
      title: feedTitle,
      body: itemTitle,
      data: {
        type: 'feed_item',
        feedId,
        url: itemUrl,
      },
    });
  }

  async notifyNewVideo(channelDbId: string, channelTitle: string, videoTitle: string, videoId: string) {
    // Get all users subscribed to this channel
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        channelId: channelDbId,
        enabled: true,
      },
      select: { userId: true },
    });

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const userIds = subscriptions.map((s) => s.userId);

    return this.sendToUsers(userIds, {
      title: `📺 ${channelTitle}`,
      body: videoTitle,
      data: {
        type: 'youtube_video',
        channelId: channelDbId,
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      },
    });
  }

  private handlePushError(ticket: ExpoPushTicket) {
    if (ticket.status !== 'error') return;

    const { message, details } = ticket;
    this.logger.error(`Push error: ${message}`);

    // Handle specific error types
    if (details?.error === 'DeviceNotRegistered') {
      // Token is invalid, should be removed
      // This would require the token info to be passed through
      this.logger.warn('Device not registered - token should be invalidated');
    }
  }
}



