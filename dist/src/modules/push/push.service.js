"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PushService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const expo_server_sdk_1 = require("expo-server-sdk");
const client_1 = require("@prisma/client");
let PushService = PushService_1 = class PushService {
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
        this.logger = new common_1.Logger(PushService_1.name);
        const accessToken = this.configService.get('EXPO_ACCESS_TOKEN');
        this.expo = new expo_server_sdk_1.default({
            accessToken: accessToken || undefined,
        });
    }
    async registerToken(userId, token, platform) {
        if (!expo_server_sdk_1.default.isExpoPushToken(token)) {
            throw new Error('Invalid Expo push token');
        }
        let platformEnum;
        switch (platform.toLowerCase()) {
            case 'ios':
                platformEnum = client_1.Platform.ios;
                break;
            case 'android':
                platformEnum = client_1.Platform.android;
                break;
            case 'web':
                platformEnum = client_1.Platform.web;
                break;
            default:
                platformEnum = client_1.Platform.android;
        }
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
    async unregisterToken(userId, token) {
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
    async getUserTokens(userId) {
        return this.prisma.pushToken.findMany({
            where: { userId, isActive: true },
        });
    }
    async sendToUser(userId, notification) {
        const tokens = await this.getUserTokens(userId);
        if (tokens.length === 0) {
            this.logger.debug(`No active push tokens for user ${userId}`);
            return { sent: 0, failed: 0 };
        }
        const pushTokens = tokens.map((t) => t.token);
        return this.sendNotifications(pushTokens, notification);
    }
    async sendToUsers(userIds, notification) {
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
    async sendNotifications(pushTokens, notification) {
        const messages = [];
        for (const token of pushTokens) {
            if (!expo_server_sdk_1.default.isExpoPushToken(token)) {
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
        const chunks = this.expo.chunkPushNotifications(messages);
        const results = { sent: 0, failed: 0 };
        for (const chunk of chunks) {
            try {
                const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
                for (const ticket of ticketChunk) {
                    if (ticket.status === 'ok') {
                        results.sent++;
                    }
                    else {
                        results.failed++;
                        this.handlePushError(ticket);
                    }
                }
            }
            catch (error) {
                this.logger.error(`Failed to send push notifications: ${error}`);
                results.failed += chunk.length;
            }
        }
        this.logger.log(`Push notifications sent: ${results.sent} success, ${results.failed} failed`);
        return results;
    }
    async notifyNewFeedItem(feedId, feedTitle, itemTitle, itemUrl) {
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
    async notifyNewVideo(channelDbId, channelTitle, videoTitle, videoId) {
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
    handlePushError(ticket) {
        if (ticket.status !== 'error')
            return;
        const { message, details } = ticket;
        this.logger.error(`Push error: ${message}`);
        if (details?.error === 'DeviceNotRegistered') {
            this.logger.warn('Device not registered - token should be invalidated');
        }
    }
};
exports.PushService = PushService;
exports.PushService = PushService = PushService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], PushService);
//# sourceMappingURL=push.service.js.map