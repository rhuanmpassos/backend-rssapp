import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
export interface NotificationPayload {
    title: string;
    body: string;
    data?: Record<string, unknown>;
}
export declare class PushService {
    private prisma;
    private configService;
    private readonly logger;
    private readonly expo;
    constructor(prisma: PrismaService, configService: ConfigService);
    registerToken(userId: string, token: string, platform: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        token: string;
        platform: import(".prisma/client").$Enums.Platform;
        isActive: boolean;
    }>;
    unregisterToken(userId: string, token: string): Promise<{
        success: boolean;
        message: string;
    } | {
        success: boolean;
        message?: undefined;
    }>;
    getUserTokens(userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        token: string;
        platform: import(".prisma/client").$Enums.Platform;
        isActive: boolean;
    }[]>;
    sendToUser(userId: string, notification: NotificationPayload): Promise<{
        sent: number;
        failed: number;
    }>;
    sendToUsers(userIds: string[], notification: NotificationPayload): Promise<{
        sent: number;
        failed: number;
    }>;
    sendNotifications(pushTokens: string[], notification: NotificationPayload): Promise<{
        sent: number;
        failed: number;
    }>;
    notifyNewFeedItem(feedId: string, feedTitle: string, itemTitle: string, itemUrl: string): Promise<{
        sent: number;
        failed: number;
    }>;
    notifyNewVideo(channelDbId: string, channelTitle: string, videoTitle: string, videoId: string): Promise<{
        sent: number;
        failed: number;
    }>;
    private handlePushError;
}
