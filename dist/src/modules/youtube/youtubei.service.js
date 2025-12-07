"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var YoutubeiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.YoutubeiService = void 0;
const common_1 = require("@nestjs/common");
const youtubei_js_1 = require("youtubei.js");
let YoutubeiService = YoutubeiService_1 = class YoutubeiService {
    constructor() {
        this.logger = new common_1.Logger(YoutubeiService_1.name);
        this.youtube = null;
    }
    async onModuleInit() {
        try {
            this.youtube = await youtubei_js_1.default.create();
            this.logger.log('Youtubei.js initialized successfully');
        }
        catch (error) {
            this.logger.warn(`Failed to initialize Youtubei.js: ${error}`);
        }
    }
    async getActiveLiveVideoId(channelId) {
        if (!this.youtube) {
            this.logger.warn('Youtubei.js not initialized');
            return null;
        }
        try {
            this.logger.log(`Checking for active live on channel: ${channelId}`);
            const channel = await this.youtube.getChannel(channelId);
            const liveTab = await channel.getLiveStreams();
            if (!liveTab?.videos?.length) {
                this.logger.log(`No live streams found for channel ${channelId}`);
                return null;
            }
            for (const video of liveTab.videos.slice(0, 5)) {
                const videoId = video.id;
                try {
                    const videoInfo = await this.youtube.getInfo(videoId);
                    const basicInfo = videoInfo.basic_info;
                    this.logger.debug(`Video ${videoId}: is_live=${basicInfo?.is_live}, is_live_content=${basicInfo?.is_live_content}, duration=${basicInfo?.duration}`);
                    if (basicInfo?.is_live === true) {
                        this.logger.log(`🔴 Active live found: ${videoId} - ${basicInfo?.title}`);
                        return videoId;
                    }
                    if (basicInfo?.is_live_content === true && (!basicInfo?.duration || basicInfo?.duration === 0)) {
                        this.logger.log(`🔴 Active live found (no duration): ${videoId} - ${basicInfo?.title}`);
                        return videoId;
                    }
                }
                catch (videoError) {
                    this.logger.warn(`Failed to get video info for ${videoId}: ${videoError}`);
                }
            }
            this.logger.log(`No active live found for channel ${channelId}`);
            return null;
        }
        catch (error) {
            this.logger.warn(`Error checking active live for channel ${channelId}: ${error}`);
            return null;
        }
    }
    async getLiveVideoInfo(videoId) {
        if (!this.youtube) {
            this.logger.warn('Youtubei.js not initialized');
            return null;
        }
        try {
            const videoInfo = await this.youtube.getInfo(videoId);
            const basicInfo = videoInfo.basic_info;
            return {
                title: basicInfo?.title || '🔴 Live',
                description: basicInfo?.short_description || '',
                thumbnail: basicInfo?.thumbnail?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            };
        }
        catch (error) {
            this.logger.warn(`Failed to get live video info for ${videoId}: ${error}`);
            return null;
        }
    }
    async getVideoType(videoId) {
        if (!this.youtube) {
            this.logger.warn('Youtubei.js not initialized');
            return null;
        }
        try {
            const videoInfo = await this.youtube.getInfo(videoId);
            const basicInfo = videoInfo.basic_info;
            if (basicInfo?.is_live === true) {
                return 'live';
            }
            if (basicInfo?.is_live_content === true && basicInfo?.is_live === false) {
                return 'vod';
            }
            const duration = basicInfo?.duration || 0;
            if (duration > 0 && duration <= 60) {
                return 'short';
            }
            return 'video';
        }
        catch (error) {
            this.logger.warn(`Failed to get video type for ${videoId}: ${error}`);
            return null;
        }
    }
    async getVideoBasicInfo(videoId) {
        if (!this.youtube) {
            return null;
        }
        try {
            const videoInfo = await this.youtube.getInfo(videoId);
            const basicInfo = videoInfo.basic_info;
            return {
                isLive: basicInfo?.is_live === true,
                isLiveContent: basicInfo?.is_live_content === true,
                duration: basicInfo?.duration || 0,
                title: basicInfo?.title || '',
            };
        }
        catch (error) {
            this.logger.debug(`Failed to get basic info for ${videoId}: ${error}`);
            return null;
        }
    }
};
exports.YoutubeiService = YoutubeiService;
exports.YoutubeiService = YoutubeiService = YoutubeiService_1 = __decorate([
    (0, common_1.Injectable)()
], YoutubeiService);
//# sourceMappingURL=youtubei.service.js.map