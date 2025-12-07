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
            const proxyHost = process.env.PROXY_HOST || 'brd.superproxy.io';
            const proxyPort = process.env.PROXY_PORT || '33335';
            const proxyUser = process.env.PROXY_USER;
            const proxyPass = process.env.PROXY_PASS;
            if (proxyUser && proxyPass) {
                const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;
                process.env.HTTPS_PROXY = proxyUrl;
                process.env.HTTP_PROXY = proxyUrl;
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
                this.logger.log(`Youtubei.js configured with residential proxy: ${proxyHost}:${proxyPort}`);
            }
            else {
                this.logger.warn('No proxy configured - Youtubei.js may be blocked by YouTube in datacenter environments');
            }
            this.youtube = await youtubei_js_1.default.create({
                generate_session_locally: true,
                retrieve_player: false,
            });
            this.logger.log('Youtubei.js initialized successfully');
        }
        catch (error) {
            this.logger.warn(`Failed to initialize Youtubei.js: ${error?.message || error}`);
            if (error?.cause) {
                this.logger.warn(`Cause: ${error.cause?.message || error.cause}`);
            }
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
                    if (basicInfo?.is_live === undefined && basicInfo?.is_live_content === undefined) {
                        this.logger.debug(`Youtubei.js returned undefined for ${videoId}, trying HTTP fallback in getActiveLiveVideoId`);
                        const httpResult = await this.checkIsLiveViaHttp(videoId);
                        if (httpResult?.isLive) {
                            this.logger.log(`🔴 Active live found via HTTP fallback: ${videoId}`);
                            return videoId;
                        }
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
            const errorMsg = String(error);
            if (errorMsg.includes('Tab') && errorMsg.includes('not found')) {
                this.logger.debug(`getLiveStreams failed for channel ${channelId}, trying /live page fallback`);
                return this.getActiveLiveViaChannelLivePage(channelId);
            }
            this.logger.warn(`Error checking active live for channel ${channelId}: ${error}`);
            return null;
        }
    }
    async getActiveLiveViaChannelLivePage(channelId) {
        try {
            const liveUrl = `https://www.youtube.com/channel/${channelId}/live`;
            this.logger.log(`Checking /live page for channel: ${channelId}`);
            const response = await fetch(liveUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                redirect: 'follow',
            });
            if (!response.ok) {
                return null;
            }
            const html = await response.text();
            const isLive = html.includes('"isLive":true') || html.includes('"isLiveNow":true');
            if (isLive) {
                const videoIdMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
                if (videoIdMatch) {
                    const videoId = videoIdMatch[1];
                    this.logger.log(`🔴 Active live found via /live page: ${videoId}`);
                    return videoId;
                }
            }
            return null;
        }
        catch (error) {
            this.logger.debug(`Failed to check /live page for channel ${channelId}: ${error}`);
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
    async checkIsLiveViaHttp(videoId) {
        try {
            const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
            });
            if (!response.ok) {
                return null;
            }
            const html = await response.text();
            const isLive = html.includes('"isLive":true') ||
                html.includes('"isLiveNow":true') ||
                html.includes('"isLiveBroadcast":true') ||
                html.includes('LIVE_STREAM_OFFLINE') === false && html.includes('"liveBroadcastDetails"');
            const isLiveContent = html.includes('"isLiveContent":true') ||
                html.includes('"liveBroadcastDetails"');
            if (isLive) {
                this.logger.log(`🔴 HTTP fallback detected live video: ${videoId}`);
            }
            return { isLive, isLiveContent };
        }
        catch (error) {
            this.logger.debug(`HTTP fallback check failed for ${videoId}: ${error}`);
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
            let isLive = basicInfo?.is_live === true;
            let isLiveContent = basicInfo?.is_live_content === true;
            const duration = basicInfo?.duration || 0;
            if (basicInfo?.is_live === undefined && basicInfo?.is_live_content === undefined) {
                this.logger.debug(`Youtubei.js returned undefined for live fields on ${videoId}, trying HTTP fallback`);
                const httpResult = await this.checkIsLiveViaHttp(videoId);
                if (httpResult) {
                    isLive = httpResult.isLive;
                    isLiveContent = httpResult.isLiveContent;
                }
            }
            return {
                isLive,
                isLiveContent,
                duration,
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