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
var YouTubeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const youtube_api_service_1 = require("./youtube-api.service");
const rss_parser_service_1 = require("../../scraper/rss-parser.service");
const playwright_service_1 = require("../../scraper/playwright.service");
const youtubei_service_1 = require("./youtubei.service");
const SHORTS_DURATION_THRESHOLD = 90;
function classifyVideoType(duration, isLive, isLiveContent, title) {
    if (isLive) {
        return 'live';
    }
    if (isLiveContent) {
        return 'vod';
    }
    if (duration !== null && duration > 0 && duration <= SHORTS_DURATION_THRESHOLD) {
        return 'short';
    }
    return 'video';
}
let YouTubeService = YouTubeService_1 = class YouTubeService {
    constructor(prisma, youtubeApi, rssParserService, playwrightService, youtubeiService) {
        this.prisma = prisma;
        this.youtubeApi = youtubeApi;
        this.rssParserService = rssParserService;
        this.playwrightService = playwrightService;
        this.youtubeiService = youtubeiService;
        this.logger = new common_1.Logger(YouTubeService_1.name);
    }
    async resolveChannel(input) {
        let channelInfo = null;
        let wasExplicitIdentifier = false;
        const urlMatch = input.match(/(?:youtube\.com\/(?:channel\/|c\/|@|user\/)?|youtu\.be\/)([^\/\?\s]+)/);
        if (urlMatch) {
            const identifier = urlMatch[1];
            wasExplicitIdentifier = true;
            if (identifier.startsWith('UC')) {
                channelInfo = await this.youtubeApi.getChannelById(identifier);
            }
            else {
                channelInfo = await this.youtubeApi.getChannelByHandle(identifier);
            }
        }
        else if (input.startsWith('@')) {
            wasExplicitIdentifier = true;
            channelInfo = await this.youtubeApi.getChannelByHandle(input);
        }
        else if (input.startsWith('UC')) {
            wasExplicitIdentifier = true;
            channelInfo = await this.youtubeApi.getChannelById(input);
        }
        else {
            channelInfo = await this.youtubeApi.searchChannel(input);
        }
        if (!channelInfo) {
            if (wasExplicitIdentifier) {
                this.logger.warn(`Could not resolve explicit channel identifier: ${input}`);
            }
            return null;
        }
        return this.getOrCreateChannel(channelInfo);
    }
    async getOrCreateChannel(info) {
        let channel = await this.prisma.youTubeChannel.findUnique({
            where: { channelId: info.channelId },
        });
        if (channel) {
            return channel;
        }
        channel = await this.prisma.youTubeChannel.create({
            data: {
                channelId: info.channelId,
                title: info.title,
                description: info.description?.slice(0, 500),
                thumbnailUrl: info.thumbnailUrl,
                customUrl: info.customUrl,
                websubTopicUrl: `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${info.channelId}`,
            },
        });
        this.logger.log(`Created YouTube channel: ${info.title}`);
        return channel;
    }
    async getChannelById(id) {
        if (id.startsWith('custom-')) {
            const subscriptionId = id.replace('custom-', '');
            const subscription = await this.prisma.subscription.findUnique({
                where: { id: subscriptionId },
                include: {
                    feed: {
                        select: {
                            id: true,
                            title: true,
                            rssUrl: true,
                            siteDomain: true,
                        },
                    },
                },
            });
            if (!subscription || !subscription.feed) {
                throw new common_1.NotFoundException('Custom YouTube feed not found');
            }
            const slugMatch = subscription.feed.rssUrl?.match(/\/custom-youtube-feeds\/([^\/]+)\/rss\.xml/);
            return {
                id: id,
                channelId: slugMatch ? slugMatch[1] : 'unknown',
                title: subscription.feed.title || 'Custom YouTube Feed',
                thumbnailUrl: null,
                description: null,
                customUrl: null,
                websubTopicUrl: null,
                lastCheckedAt: subscription.createdAt,
                isCustomFeed: true,
            };
        }
        const channel = await this.prisma.youTubeChannel.findUnique({
            where: { id },
        });
        if (!channel) {
            throw new common_1.NotFoundException('Channel not found');
        }
        return channel;
    }
    async getChannelByYouTubeId(channelId) {
        return this.prisma.youTubeChannel.findUnique({
            where: { channelId },
        });
    }
    async listChannels(userId, page = 1, limit = 20) {
        this.logger.log(`Listing channels for user ${userId}, page ${page}, limit ${limit}`);
        const skip = (page - 1) * limit;
        const [youtubeChannels, youtubeChannelsTotal] = await Promise.all([
            this.prisma.youTubeChannel.findMany({
                where: {
                    subscriptions: {
                        some: {
                            userId,
                            type: 'youtube',
                            enabled: true,
                        },
                    },
                },
                orderBy: { lastCheckedAt: 'desc' },
                skip,
                take: limit,
                include: {
                    _count: {
                        select: { videos: true },
                    },
                },
            }),
            this.prisma.youTubeChannel.count({
                where: {
                    subscriptions: {
                        some: {
                            userId,
                            type: 'youtube',
                            enabled: true,
                        },
                    },
                },
            }),
        ]);
        const customYouTubeSubscriptions = await this.prisma.subscription.findMany({
            where: {
                userId,
                type: 'site',
                enabled: true,
                OR: [
                    { target: { contains: '/custom-youtube-feeds/' } },
                    { feed: { rssUrl: { contains: '/custom-youtube-feeds/' } } },
                    { feed: { siteDomain: 'www.youtube.com' } },
                ],
            },
            include: {
                feed: {
                    select: {
                        id: true,
                        title: true,
                        rssUrl: true,
                        siteDomain: true,
                    },
                },
            },
        });
        const customYouTubeChannels = await Promise.all(customYouTubeSubscriptions.map(async (sub) => {
            let slug = null;
            const targetMatch = sub.target?.match(/\/custom-youtube-feeds\/([^\/]+)\/rss\.xml/);
            const rssMatch = sub.feed?.rssUrl?.match(/\/custom-youtube-feeds\/([^\/]+)\/rss\.xml/);
            slug = targetMatch ? targetMatch[1] : (rssMatch ? rssMatch[1] : null);
            if (!slug && sub.feed?.rssUrl?.includes('youtube.com/feeds/videos.xml')) {
                const channelIdMatch = sub.feed.rssUrl.match(/channel_id=([^&]+)/);
                slug = channelIdMatch ? channelIdMatch[1] : 'youtube';
            }
            const videoCount = sub.feed?.id
                ? await this.prisma.feedItem.count({
                    where: { feedId: sub.feed.id },
                })
                : 0;
            return {
                id: `custom-${sub.id}`,
                channelId: slug || 'unknown',
                title: sub.feed?.title || 'Custom YouTube Feed',
                thumbnailUrl: null,
                lastCheckedAt: sub.createdAt,
                isCustomFeed: true,
                subscriptionId: sub.id,
                feedId: sub.feed?.id,
                rssUrl: sub.feed?.rssUrl,
                _count: {
                    videos: videoCount,
                },
            };
        }));
        const allChannels = [...youtubeChannels, ...customYouTubeChannels];
        const total = youtubeChannelsTotal + customYouTubeChannels.length;
        this.logger.log(`Found ${youtubeChannelsTotal} regular channels and ${customYouTubeChannels.length} custom feeds for user ${userId}`);
        allChannels.sort((a, b) => {
            const dateA = a.lastCheckedAt ? new Date(a.lastCheckedAt).getTime() : 0;
            const dateB = b.lastCheckedAt ? new Date(b.lastCheckedAt).getTime() : 0;
            return dateB - dateA;
        });
        return {
            data: allChannels.slice(skip, skip + limit),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async getChannelVideos(channelDbId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        if (channelDbId.startsWith('custom-')) {
            const subscriptionId = channelDbId.replace('custom-', '');
            const subscription = await this.prisma.subscription.findUnique({
                where: { id: subscriptionId },
                include: {
                    feed: {
                        select: {
                            id: true,
                            title: true,
                            rssUrl: true,
                        },
                    },
                },
            });
            if (!subscription || !subscription.feed) {
                throw new common_1.NotFoundException('Custom YouTube feed not found');
            }
            const slugMatch = subscription.feed.rssUrl?.match(/\/custom-youtube-feeds\/([^\/]+)\/rss\.xml/);
            const slug = slugMatch ? slugMatch[1] : 'unknown';
            const customFeed = await this.prisma.customYouTubeFeed.findUnique({
                where: { slug },
            });
            if (!customFeed?.channelId) {
                throw new common_1.NotFoundException('Custom YouTube feed channel ID not found');
            }
            const channelId = customFeed.channelId;
            const baseId = channelId.startsWith('UC') ? channelId.substring(2) : channelId;
            const videosRssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULF${baseId}`;
            const livesRssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULV${baseId}`;
            this.logger.log(`Fetching dual feeds for ${slug}: UULF and UULV`);
            const [videosFeed, livesFeed, activeLiveVideoId] = await Promise.all([
                this.rssParserService.parseUrl(videosRssUrl).catch((e) => {
                    this.logger.warn(`Failed to fetch UULF feed: ${e}`);
                    return null;
                }),
                this.rssParserService.parseUrl(livesRssUrl).catch((e) => {
                    this.logger.warn(`Failed to fetch UULV feed: ${e}`);
                    return null;
                }),
                this.youtubeiService.getActiveLiveVideoId(channelId).catch((e) => {
                    this.logger.warn(`Failed to check active live: ${e}`);
                    return null;
                }),
            ]);
            const extractVideoId = (url) => {
                const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
                return match ? match[1] : null;
            };
            const parseRssItem = (item, videoType) => {
                const videoId = extractVideoId(item.url || '');
                if (!videoId)
                    return null;
                return {
                    id: `${videoType}-${videoId}`,
                    videoId,
                    title: item.title || 'Untitled',
                    description: item.excerpt || '',
                    thumbnailUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                    duration: null,
                    publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
                    fetchedAt: new Date(),
                    url: item.url || `https://www.youtube.com/watch?v=${videoId}`,
                    isLive: false,
                    videoType,
                };
            };
            const regularVideos = (videosFeed?.items || [])
                .slice(0, 15)
                .map(item => parseRssItem(item, 'video'))
                .filter((v) => v !== null);
            const livesVods = (livesFeed?.items || [])
                .slice(0, 15)
                .map(item => parseRssItem(item, 'vod'))
                .filter((v) => v !== null);
            if (activeLiveVideoId) {
                this.logger.log(`Active live found: ${activeLiveVideoId}`);
                for (const video of livesVods) {
                    if (video.videoId === activeLiveVideoId) {
                        video.isLive = true;
                        video.videoType = 'live';
                        video.id = `live-${video.videoId}`;
                    }
                }
            }
            let allVideos = [...livesVods, ...regularVideos];
            const seenIds = new Set();
            allVideos = allVideos.filter(v => {
                if (seenIds.has(v.videoId))
                    return false;
                seenIds.add(v.videoId);
                return true;
            });
            allVideos.sort((a, b) => {
                if (a.isLive && !b.isLive)
                    return -1;
                if (!a.isLive && b.isLive)
                    return 1;
                const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
                const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
                return dateB - dateA;
            });
            const paginatedVideos = allVideos.slice(skip, skip + limit);
            const total = allVideos.length;
            const videoCount = allVideos.filter(v => v.videoType === 'video').length;
            const vodCount = allVideos.filter(v => v.videoType === 'vod').length;
            const liveCount = allVideos.filter(v => v.videoType === 'live').length;
            this.logger.log(`Dual-feed result: ${videoCount} videos, ${vodCount} VODs, ${liveCount} lives`);
            const channelTitle = customFeed?.channelName || subscription.feed.title || 'Custom YouTube Feed';
            return {
                channel: {
                    id: channelDbId,
                    channelId: slug,
                    title: channelTitle,
                    thumbnailUrl: null,
                    isCustomFeed: true,
                },
                data: paginatedVideos,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }
        const channel = await this.getChannelById(channelDbId);
        const channelId = channel.channelId;
        const baseId = channelId.startsWith('UC') ? channelId.substring(2) : channelId;
        const videosRssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULF${baseId}`;
        const livesRssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULV${baseId}`;
        this.logger.log(`Fetching dual feeds for channel ${channel.title}: UULF and UULV`);
        const [videosFeed, livesFeed, activeLiveVideoId] = await Promise.all([
            this.rssParserService.parseUrl(videosRssUrl).catch((e) => {
                this.logger.warn(`Failed to fetch UULF feed for ${channel.title}: ${e}`);
                return null;
            }),
            this.rssParserService.parseUrl(livesRssUrl).catch((e) => {
                this.logger.warn(`Failed to fetch UULV feed for ${channel.title}: ${e}`);
                return null;
            }),
            this.youtubeiService.getActiveLiveVideoId(channelId).catch((e) => {
                this.logger.warn(`Failed to check active live: ${e}`);
                return null;
            }),
        ]);
        const extractVideoId = (url) => {
            const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
            return match ? match[1] : null;
        };
        const parseRssItem = (item, videoType) => {
            const videoId = extractVideoId(item.url || '');
            if (!videoId)
                return null;
            return {
                id: `${videoType}-${videoId}`,
                videoId,
                title: item.title || 'Untitled',
                description: item.excerpt || '',
                thumbnailUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                duration: null,
                publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
                fetchedAt: new Date(),
                url: item.url || `https://www.youtube.com/watch?v=${videoId}`,
                isLive: false,
                videoType,
            };
        };
        const regularVideos = (videosFeed?.items || [])
            .slice(0, 20)
            .map(item => parseRssItem(item, 'video'))
            .filter((v) => v !== null);
        const livesVods = (livesFeed?.items || [])
            .slice(0, 20)
            .map(item => parseRssItem(item, 'vod'))
            .filter((v) => v !== null);
        if (activeLiveVideoId) {
            this.logger.log(`Active live found: ${activeLiveVideoId}`);
            for (const video of livesVods) {
                if (video.videoId === activeLiveVideoId) {
                    video.isLive = true;
                    video.videoType = 'live';
                    video.id = `live-${video.videoId}`;
                }
            }
        }
        let allVideos = [...livesVods, ...regularVideos];
        const seenIds = new Set();
        allVideos = allVideos.filter(v => {
            if (seenIds.has(v.videoId))
                return false;
            seenIds.add(v.videoId);
            return true;
        });
        allVideos.sort((a, b) => {
            if (a.isLive && !b.isLive)
                return -1;
            if (!a.isLive && b.isLive)
                return 1;
            const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return dateB - dateA;
        });
        const paginatedVideos = allVideos.slice(skip, skip + limit);
        const total = allVideos.length;
        const videoCount = allVideos.filter(v => v.videoType === 'video').length;
        const vodCount = allVideos.filter(v => v.videoType === 'vod').length;
        const liveCount = allVideos.filter(v => v.videoType === 'live').length;
        this.logger.log(`Dual-feed result for ${channel.title}: ${videoCount} videos, ${vodCount} VODs, ${liveCount} lives`);
        return {
            channel: {
                id: channel.id,
                channelId: channel.channelId,
                title: channel.title,
                thumbnailUrl: channel.thumbnailUrl,
            },
            data: paginatedVideos,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async saveVideos(channelDbId, videos) {
        const results = {
            created: 0,
            skipped: 0,
        };
        for (const video of videos) {
            try {
                const existing = await this.prisma.youTubeVideo.findUnique({
                    where: { videoId: video.videoId },
                });
                if (existing) {
                    results.skipped++;
                    continue;
                }
                await this.prisma.youTubeVideo.create({
                    data: {
                        videoId: video.videoId,
                        channelDbId,
                        title: video.title,
                        description: video.description,
                        thumbnailUrl: video.thumbnailUrl,
                        duration: video.duration,
                        publishedAt: video.publishedAt,
                    },
                });
                results.created++;
            }
            catch (error) {
                this.logger.error(`Failed to save video ${video.videoId}: ${error}`);
                results.skipped++;
            }
        }
        await this.prisma.youTubeChannel.update({
            where: { id: channelDbId },
            data: { lastCheckedAt: new Date() },
        });
        return results;
    }
    async fetchAndSaveNewVideos(channelDbId) {
        const channel = await this.getChannelById(channelDbId);
        const publishedAfter = channel.lastCheckedAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const videos = await this.youtubeApi.getRecentVideos(channel.channelId, publishedAfter, 20);
        if (videos.length === 0) {
            await this.prisma.youTubeChannel.update({
                where: { id: channelDbId },
                data: { lastCheckedAt: new Date() },
            });
            return { created: 0, skipped: 0 };
        }
        return this.saveVideos(channelDbId, videos);
    }
    async getChannelsToCheck(limit = 10) {
        const staleTime = new Date(Date.now() - 5 * 60 * 1000);
        return this.prisma.youTubeChannel.findMany({
            where: {
                OR: [
                    { lastCheckedAt: null },
                    { lastCheckedAt: { lt: staleTime } },
                ],
            },
            orderBy: { lastCheckedAt: 'asc' },
            take: limit,
        });
    }
    async getNewVideosSince(channelDbId, since) {
        return this.prisma.youTubeVideo.findMany({
            where: {
                channelDbId,
                fetchedAt: { gt: since },
            },
            orderBy: { fetchedAt: 'desc' },
        });
    }
    async fetchAndSaveVideosFromRss(channelDbId) {
        const channel = await this.getChannelById(channelDbId);
        const channelId = channel.channelId;
        const baseId = channelId.startsWith('UC') ? channelId.substring(2) : channelId;
        const videosRssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULF${baseId}`;
        const livesRssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULV${baseId}`;
        this.logger.log(`Fetching dual RSS feeds for ${channel.title}`);
        try {
            const [videosFeed, livesFeed] = await Promise.all([
                this.rssParserService.parseUrl(videosRssUrl).catch((e) => {
                    this.logger.warn(`Failed to fetch UULF feed: ${e}`);
                    return null;
                }),
                this.rssParserService.parseUrl(livesRssUrl).catch((e) => {
                    this.logger.warn(`Failed to fetch UULV feed: ${e}`);
                    return null;
                }),
            ]);
            const results = { created: 0, skipped: 0 };
            const extractVideoId = (url) => {
                const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
                return match ? match[1] : null;
            };
            if (videosFeed?.items) {
                for (const item of videosFeed.items.slice(0, 15)) {
                    try {
                        const videoId = extractVideoId(item.url || '');
                        if (!videoId) {
                            results.skipped++;
                            continue;
                        }
                        const existing = await this.prisma.youTubeVideo.findUnique({
                            where: { videoId },
                        });
                        if (existing) {
                            results.skipped++;
                            continue;
                        }
                        await this.prisma.youTubeVideo.create({
                            data: {
                                videoId,
                                channelDbId,
                                title: item.title || 'Untitled',
                                description: item.excerpt?.slice(0, 500) || null,
                                thumbnailUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                                duration: null,
                                publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
                                videoType: 'video',
                                isLive: false,
                                isLiveContent: false,
                                durationSecs: null,
                                classifiedAt: new Date(),
                            },
                        });
                        results.created++;
                        this.logger.debug(`New video: ${videoId} → video (from UULF)`);
                    }
                    catch (error) {
                        this.logger.error(`Failed to save video from RSS: ${error}`);
                        results.skipped++;
                    }
                }
            }
            if (livesFeed?.items) {
                for (const item of livesFeed.items.slice(0, 15)) {
                    try {
                        const videoId = extractVideoId(item.url || '');
                        if (!videoId) {
                            results.skipped++;
                            continue;
                        }
                        const existing = await this.prisma.youTubeVideo.findUnique({
                            where: { videoId },
                        });
                        if (existing) {
                            results.skipped++;
                            continue;
                        }
                        await this.prisma.youTubeVideo.create({
                            data: {
                                videoId,
                                channelDbId,
                                title: item.title || 'Untitled',
                                description: item.excerpt?.slice(0, 500) || null,
                                thumbnailUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                                duration: null,
                                publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
                                videoType: 'vod',
                                isLive: false,
                                isLiveContent: true,
                                durationSecs: null,
                                classifiedAt: new Date(),
                            },
                        });
                        results.created++;
                        this.logger.debug(`New video: ${videoId} → vod (from UULV)`);
                    }
                    catch (error) {
                        this.logger.error(`Failed to save live/VOD from RSS: ${error}`);
                        results.skipped++;
                    }
                }
            }
            await this.prisma.youTubeChannel.update({
                where: { id: channelDbId },
                data: { lastCheckedAt: new Date() },
            });
            this.logger.log(`Dual-feed RSS update for ${channel.title}: ${results.created} new, ${results.skipped} skipped`);
            return results;
        }
        catch (error) {
            this.logger.error(`Failed to fetch RSS feeds for ${channel.title}: ${error}`);
            return { created: 0, skipped: 0 };
        }
    }
    async reclassifyVideos(limit = 50) {
        const videosToReclassify = await this.prisma.youTubeVideo.findMany({
            where: {
                OR: [
                    { isLive: true },
                    { classifiedAt: null },
                    { videoType: null },
                ],
            },
            orderBy: { fetchedAt: 'desc' },
            take: limit,
        });
        if (videosToReclassify.length === 0) {
            return { updated: 0, unchanged: 0 };
        }
        this.logger.log(`Reclassifying ${videosToReclassify.length} videos`);
        let updated = 0;
        let unchanged = 0;
        for (const video of videosToReclassify) {
            try {
                const info = await this.youtubeiService.getVideoBasicInfo(video.videoId);
                if (!info) {
                    unchanged++;
                    continue;
                }
                let videoType = 'video';
                if (info.isLive) {
                    videoType = 'live';
                }
                else if (info.isLiveContent) {
                    videoType = 'vod';
                }
                else if (info.duration > 0 && info.duration <= 90) {
                    videoType = 'short';
                }
                const durationSecs = info.duration > 0 ? info.duration : null;
                if (video.videoType === videoType &&
                    video.isLive === info.isLive &&
                    video.isLiveContent === info.isLiveContent) {
                    await this.prisma.youTubeVideo.update({
                        where: { id: video.id },
                        data: { classifiedAt: new Date() },
                    });
                    unchanged++;
                }
                else {
                    await this.prisma.youTubeVideo.update({
                        where: { id: video.id },
                        data: {
                            videoType,
                            isLive: info.isLive,
                            isLiveContent: info.isLiveContent,
                            durationSecs,
                            classifiedAt: new Date(),
                        },
                    });
                    this.logger.log(`Reclassified ${video.videoId}: ${video.videoType || 'null'} → ${videoType}`);
                    updated++;
                }
            }
            catch (error) {
                this.logger.debug(`Failed to reclassify ${video.videoId}: ${error}`);
                unchanged++;
            }
        }
        this.logger.log(`Reclassification complete: ${updated} updated, ${unchanged} unchanged`);
        return { updated, unchanged };
    }
};
exports.YouTubeService = YouTubeService;
exports.YouTubeService = YouTubeService = YouTubeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        youtube_api_service_1.YouTubeApiService,
        rss_parser_service_1.RssParserService,
        playwright_service_1.PlaywrightService,
        youtubei_service_1.YoutubeiService])
], YouTubeService);
//# sourceMappingURL=youtube.service.js.map