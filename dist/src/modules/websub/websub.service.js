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
var WebSubService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSubService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const youtube_service_1 = require("../youtube/youtube.service");
const push_service_1 = require("../push/push.service");
const crypto = require("crypto");
const xml2js_1 = require("xml2js");
const YOUTUBE_HUB_URL = 'https://pubsubhubbub.appspot.com/subscribe';
let WebSubService = WebSubService_1 = class WebSubService {
    constructor(prisma, configService, youtubeService, pushService) {
        this.prisma = prisma;
        this.configService = configService;
        this.youtubeService = youtubeService;
        this.pushService = pushService;
        this.logger = new common_1.Logger(WebSubService_1.name);
        this.callbackUrl = this.configService.get('WEBSUB_CALLBACK_URL', '');
        this.verifyToken = this.configService.get('WEBSUB_VERIFY_TOKEN', '');
        if (!this.callbackUrl) {
            this.logger.warn('WEBSUB_CALLBACK_URL not configured');
        }
    }
    async subscribeToChannel(channelId) {
        const topicUrl = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;
        const secret = crypto.randomBytes(32).toString('hex');
        await this.prisma.webSubSubscription.upsert({
            where: {
                topicUrl_callbackUrl: {
                    topicUrl,
                    callbackUrl: this.callbackUrl,
                },
            },
            update: {
                secret,
                verified: false,
            },
            create: {
                topicUrl,
                hubUrl: YOUTUBE_HUB_URL,
                callbackUrl: this.callbackUrl,
                secret,
                verified: false,
            },
        });
        const formData = new URLSearchParams({
            'hub.callback': this.callbackUrl,
            'hub.topic': topicUrl,
            'hub.verify': 'async',
            'hub.mode': 'subscribe',
            'hub.verify_token': this.verifyToken,
            'hub.secret': secret,
            'hub.lease_seconds': '864000',
        });
        try {
            const response = await fetch(YOUTUBE_HUB_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString(),
            });
            if (response.status === 202) {
                this.logger.log(`WebSub subscription initiated for channel: ${channelId}`);
                return { success: true, message: 'Subscription request sent' };
            }
            else {
                const text = await response.text();
                this.logger.error(`WebSub subscription failed: ${response.status} ${text}`);
                return { success: false, message: `Hub returned ${response.status}` };
            }
        }
        catch (error) {
            this.logger.error(`WebSub subscription error: ${error}`);
            return { success: false, message: String(error) };
        }
    }
    async unsubscribeFromChannel(channelId) {
        const topicUrl = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;
        const formData = new URLSearchParams({
            'hub.callback': this.callbackUrl,
            'hub.topic': topicUrl,
            'hub.mode': 'unsubscribe',
            'hub.verify': 'async',
            'hub.verify_token': this.verifyToken,
        });
        try {
            const response = await fetch(YOUTUBE_HUB_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString(),
            });
            if (response.status === 202) {
                await this.prisma.webSubSubscription.deleteMany({
                    where: { topicUrl, callbackUrl: this.callbackUrl },
                });
                this.logger.log(`WebSub unsubscription initiated for channel: ${channelId}`);
                return { success: true };
            }
            return { success: false };
        }
        catch (error) {
            this.logger.error(`WebSub unsubscription error: ${error}`);
            return { success: false };
        }
    }
    async verifyIntent(topic, challenge, mode, leaseSeconds, verifyToken) {
        if (verifyToken && verifyToken !== this.verifyToken) {
            this.logger.warn(`Invalid verify token received`);
            return null;
        }
        const subscription = await this.prisma.webSubSubscription.findFirst({
            where: {
                topicUrl: topic,
                callbackUrl: this.callbackUrl,
            },
        });
        if (!subscription) {
            this.logger.warn(`No subscription found for topic: ${topic}`);
            return null;
        }
        if (mode === 'subscribe') {
            const expiresAt = leaseSeconds
                ? new Date(Date.now() + leaseSeconds * 1000)
                : null;
            await this.prisma.webSubSubscription.update({
                where: { id: subscription.id },
                data: {
                    verified: true,
                    leaseSeconds,
                    expiresAt,
                },
            });
            const channelIdMatch = topic.match(/channel_id=([^&]+)/);
            if (channelIdMatch) {
                await this.prisma.youTubeChannel.updateMany({
                    where: { channelId: channelIdMatch[1] },
                    data: {
                        websubExpiresAt: expiresAt,
                        websubTopicUrl: topic,
                    },
                });
            }
            this.logger.log(`WebSub subscription verified for: ${topic}`);
        }
        else if (mode === 'unsubscribe') {
            await this.prisma.webSubSubscription.delete({
                where: { id: subscription.id },
            });
            this.logger.log(`WebSub unsubscription verified for: ${topic}`);
        }
        return challenge;
    }
    async handleNotification(body, signature) {
        try {
            const parsed = await (0, xml2js_1.parseStringPromise)(body, {
                explicitArray: false,
            });
            const feed = parsed.feed;
            if (!feed) {
                this.logger.warn('Invalid WebSub notification: no feed element');
                return { success: false, videosProcessed: 0 };
            }
            const channelId = feed['yt:channelId'];
            if (!channelId) {
                this.logger.warn('No channel ID in WebSub notification');
                return { success: false, videosProcessed: 0 };
            }
            const channel = await this.youtubeService.getChannelByYouTubeId(channelId);
            if (!channel) {
                this.logger.warn(`Channel not found: ${channelId}`);
                return { success: false, videosProcessed: 0 };
            }
            if (signature && channel.websubSecret) {
                const expectedSignature = crypto
                    .createHmac('sha1', channel.websubSecret)
                    .update(body)
                    .digest('hex');
                const providedSig = signature.replace('sha1=', '');
                if (providedSig !== expectedSignature) {
                    this.logger.warn('Invalid WebSub signature');
                }
            }
            const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry].filter(Boolean);
            let videosProcessed = 0;
            for (const entry of entries) {
                const videoId = entry['yt:videoId'];
                const title = entry.title;
                const published = entry.published;
                if (!videoId)
                    continue;
                const existing = await this.prisma.youTubeVideo.findUnique({
                    where: { videoId },
                });
                if (existing) {
                    continue;
                }
                await this.prisma.youTubeVideo.create({
                    data: {
                        videoId,
                        channelDbId: channel.id,
                        title: title || 'Untitled',
                        description: '',
                        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                        publishedAt: published ? new Date(published) : new Date(),
                    },
                });
                videosProcessed++;
                await this.pushService.notifyNewVideo(channel.id, channel.title, title || 'New Video', videoId);
            }
            this.logger.log(`WebSub notification processed: ${videosProcessed} new videos for channel ${channel.title}`);
            return { success: true, videosProcessed };
        }
        catch (error) {
            this.logger.error(`Error processing WebSub notification: ${error}`);
            return { success: false, videosProcessed: 0 };
        }
    }
    async renewExpiringSubscriptions() {
        const expiringTime = new Date(Date.now() + 60 * 60 * 1000);
        const expiring = await this.prisma.webSubSubscription.findMany({
            where: {
                verified: true,
                expiresAt: { lt: expiringTime },
            },
        });
        let renewed = 0;
        for (const sub of expiring) {
            const channelIdMatch = sub.topicUrl.match(/channel_id=([^&]+)/);
            if (channelIdMatch) {
                const result = await this.subscribeToChannel(channelIdMatch[1]);
                if (result.success) {
                    renewed++;
                }
            }
        }
        this.logger.log(`Renewed ${renewed} WebSub subscriptions`);
        return { renewed, total: expiring.length };
    }
};
exports.WebSubService = WebSubService;
exports.WebSubService = WebSubService = WebSubService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        youtube_service_1.YouTubeService,
        push_service_1.PushService])
], WebSubService);
//# sourceMappingURL=websub.service.js.map