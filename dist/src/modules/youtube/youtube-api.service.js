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
var YouTubeApiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeApiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let YouTubeApiService = YouTubeApiService_1 = class YouTubeApiService {
    constructor(configService, prisma) {
        this.configService = configService;
        this.prisma = prisma;
        this.logger = new common_1.Logger(YouTubeApiService_1.name);
        this.baseUrl = 'https://www.googleapis.com/youtube/v3';
        this.apiKey = this.configService.get('YOUTUBE_API_KEY', '');
        if (!this.apiKey) {
            this.logger.warn('YOUTUBE_API_KEY not configured');
        }
    }
    async searchChannel(query) {
        try {
            await this.trackApiCall('search.list', 100);
            const params = new URLSearchParams({
                part: 'snippet',
                q: query,
                type: 'channel',
                maxResults: '1',
                key: this.apiKey,
            });
            const response = await fetch(`${this.baseUrl}/search?${params}`);
            const data = await response.json();
            if (data.error) {
                this.logger.error(`YouTube API error: ${data.error.message}`);
                return null;
            }
            if (!data.items || data.items.length === 0) {
                return null;
            }
            const item = data.items[0];
            return {
                channelId: item.snippet.channelId,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnailUrl: item.snippet.thumbnails?.default?.url || '',
            };
        }
        catch (error) {
            this.logger.error(`Failed to search channel: ${error}`);
            return null;
        }
    }
    async getChannelById(channelId) {
        try {
            await this.trackApiCall('channels.list', 1);
            const params = new URLSearchParams({
                part: 'snippet',
                id: channelId,
                key: this.apiKey,
            });
            const response = await fetch(`${this.baseUrl}/channels?${params}`);
            const data = await response.json();
            if (data.error || !data.items || data.items.length === 0) {
                return null;
            }
            const item = data.items[0];
            return {
                channelId: item.id,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnailUrl: item.snippet.thumbnails?.default?.url || '',
                customUrl: item.snippet.customUrl,
            };
        }
        catch (error) {
            this.logger.error(`Failed to get channel: ${error}`);
            return null;
        }
    }
    async getChannelByHandle(handle) {
        const cleanHandle = handle.replace(/^@/, '');
        try {
            await this.trackApiCall('channels.list', 1);
            const params = new URLSearchParams({
                part: 'snippet',
                forHandle: cleanHandle,
                key: this.apiKey,
            });
            const response = await fetch(`${this.baseUrl}/channels?${params}`);
            const data = await response.json();
            if (data.error || !data.items || data.items.length === 0) {
                return this.searchChannel(cleanHandle);
            }
            const item = data.items[0];
            return {
                channelId: item.id,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnailUrl: item.snippet.thumbnails?.default?.url || '',
                customUrl: item.snippet.customUrl,
            };
        }
        catch (error) {
            this.logger.error(`Failed to get channel by handle: ${error}`);
            return null;
        }
    }
    async getRecentVideos(channelId, publishedAfter, maxResults = 10) {
        try {
            await this.trackApiCall('search.list', 100);
            const params = new URLSearchParams({
                part: 'snippet',
                channelId,
                order: 'date',
                type: 'video',
                maxResults: maxResults.toString(),
                key: this.apiKey,
            });
            if (publishedAfter) {
                params.set('publishedAfter', publishedAfter.toISOString());
            }
            const response = await fetch(`${this.baseUrl}/search?${params}`);
            const data = await response.json();
            if (data.error || !data.items) {
                return [];
            }
            return data.items.map((item) => {
                const liveBroadcastContent = item.snippet?.liveBroadcastContent || 'none';
                const isLive = liveBroadcastContent === 'live';
                return {
                    videoId: item.id.videoId,
                    channelId: item.snippet.channelId,
                    title: item.snippet.title,
                    description: this.truncateDescription(item.snippet.description),
                    thumbnailUrl: item.snippet.thumbnails?.high?.url ||
                        item.snippet.thumbnails?.default?.url ||
                        '',
                    publishedAt: new Date(item.snippet.publishedAt),
                    isLive: isLive,
                    liveBroadcastContent: liveBroadcastContent,
                };
            });
        }
        catch (error) {
            this.logger.error(`Failed to get recent videos: ${error}`);
            return [];
        }
    }
    async getVideoDetails(videoIds) {
        if (videoIds.length === 0)
            return [];
        try {
            await this.trackApiCall('videos.list', 1);
            const params = new URLSearchParams({
                part: 'snippet,contentDetails',
                id: videoIds.join(','),
                key: this.apiKey,
            });
            const response = await fetch(`${this.baseUrl}/videos?${params}`);
            const data = await response.json();
            if (data.error || !data.items) {
                return [];
            }
            return data.items.map((item) => {
                const liveBroadcastContent = item.snippet?.liveBroadcastContent || 'none';
                const isLive = liveBroadcastContent === 'live';
                return {
                    videoId: item.id,
                    channelId: item.snippet.channelId,
                    title: item.snippet.title,
                    description: this.truncateDescription(item.snippet.description),
                    thumbnailUrl: item.snippet.thumbnails?.high?.url ||
                        item.snippet.thumbnails?.default?.url ||
                        '',
                    publishedAt: new Date(item.snippet.publishedAt),
                    duration: item.contentDetails?.duration,
                    isLive: isLive,
                    liveBroadcastContent: liveBroadcastContent,
                };
            });
        }
        catch (error) {
            this.logger.error(`Failed to get video details: ${error}`);
            return [];
        }
    }
    truncateDescription(description) {
        if (!description)
            return '';
        if (description.length > 500) {
            return description.slice(0, 497) + '...';
        }
        return description;
    }
    async trackApiCall(endpoint, units) {
        const now = new Date();
        const periodStart = new Date(now);
        periodStart.setHours(0, 0, 0, 0);
        const periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 1);
        try {
            await this.prisma.rateLimitLog.upsert({
                where: {
                    service_periodStart: {
                        service: `youtube:${endpoint}`,
                        periodStart,
                    },
                },
                update: {
                    calls: { increment: units },
                },
                create: {
                    service: `youtube:${endpoint}`,
                    calls: units,
                    periodStart,
                    periodEnd,
                    quota: 10000,
                },
            });
        }
        catch (error) {
            this.logger.warn(`Failed to track API call: ${error}`);
        }
    }
    async getQuotaUsage() {
        const periodStart = new Date();
        periodStart.setHours(0, 0, 0, 0);
        const logs = await this.prisma.rateLimitLog.findMany({
            where: {
                service: { startsWith: 'youtube:' },
                periodStart,
            },
        });
        const used = logs.reduce((sum, log) => sum + log.calls, 0);
        return {
            used,
            limit: 10000,
        };
    }
};
exports.YouTubeApiService = YouTubeApiService;
exports.YouTubeApiService = YouTubeApiService = YouTubeApiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], YouTubeApiService);
//# sourceMappingURL=youtube-api.service.js.map