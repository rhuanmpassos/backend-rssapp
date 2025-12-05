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
var CustomYouTubeFeedService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomYouTubeFeedService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const youtube_service_1 = require("../youtube/youtube.service");
const youtube_api_service_1 = require("../youtube/youtube-api.service");
const rss_parser_service_1 = require("../../scraper/rss-parser.service");
const playwright_service_1 = require("../../scraper/playwright.service");
let CustomYouTubeFeedService = CustomYouTubeFeedService_1 = class CustomYouTubeFeedService {
    constructor(prisma, youtubeService, youtubeApi, rssParserService, playwrightService) {
        this.prisma = prisma;
        this.youtubeService = youtubeService;
        this.youtubeApi = youtubeApi;
        this.rssParserService = rssParserService;
        this.playwrightService = playwrightService;
        this.logger = new common_1.Logger(CustomYouTubeFeedService_1.name);
    }
    async create(dto) {
        const existing = await this.prisma.customYouTubeFeed.findUnique({
            where: { slug: dto.slug },
        });
        if (existing) {
            throw new common_1.BadRequestException('A feed with this slug already exists');
        }
        let resolvedChannelId = dto.channelId;
        if (dto.channelUrl && !dto.channelId) {
            this.logger.log(`Resolving channel from URL: ${dto.channelUrl}`);
            let channel = await this.youtubeService.resolveChannel(dto.channelUrl);
            if (!channel) {
                this.logger.log(`API resolution failed, trying scraping for: ${dto.channelUrl}`);
                const scrapedChannelId = await this.extractChannelIdFromUrl(dto.channelUrl);
                if (scrapedChannelId) {
                    resolvedChannelId = scrapedChannelId;
                    this.logger.log(`Extracted channel ID via scraping: ${resolvedChannelId}`);
                }
                else {
                    this.logger.warn(`Failed to resolve channel from URL: ${dto.channelUrl}`);
                    throw new common_1.BadRequestException('Could not resolve YouTube channel from the provided URL. Please check if the URL is correct or configure a valid YouTube API key.');
                }
            }
            else {
                resolvedChannelId = channel.channelId;
                this.logger.log(`Resolved channel ID via API: ${resolvedChannelId}`);
            }
        }
        if (!resolvedChannelId) {
            throw new common_1.BadRequestException('Channel ID or Channel URL is required');
        }
        const feed = await this.prisma.customYouTubeFeed.create({
            data: {
                title: dto.title,
                description: dto.description,
                slug: dto.slug,
                channelId: resolvedChannelId,
                channelUrl: dto.channelUrl,
                categoryId: dto.categoryId,
            },
            include: {
                category: true,
            },
        });
        this.logger.log(`Custom YouTube feed created: ${dto.slug} with channel ID: ${resolvedChannelId}`);
        return feed;
    }
    async findAll() {
        return this.prisma.customYouTubeFeed.findMany({
            include: {
                category: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findPublicFeeds() {
        return this.prisma.customYouTubeFeed.findMany({
            where: {
                channelId: { not: null },
            },
            include: {
                category: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async searchPublicFeeds(query) {
        const where = {
            channelId: { not: null },
        };
        if (query) {
            where.OR = [
                { title: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
                { slug: { contains: query, mode: 'insensitive' } },
            ];
        }
        return this.prisma.customYouTubeFeed.findMany({
            where,
            include: {
                category: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
    }
    async findOne(slug) {
        const feed = await this.prisma.customYouTubeFeed.findUnique({
            where: { slug },
            include: {
                category: true,
            },
        });
        if (!feed) {
            throw new common_1.NotFoundException('Custom YouTube feed not found');
        }
        return feed;
    }
    async update(id, dto) {
        const feed = await this.prisma.customYouTubeFeed.findUnique({
            where: { id },
        });
        if (!feed) {
            throw new common_1.NotFoundException('Custom YouTube feed not found');
        }
        if (dto.slug && dto.slug !== feed.slug) {
            const existing = await this.prisma.customYouTubeFeed.findUnique({
                where: { slug: dto.slug },
            });
            if (existing) {
                throw new common_1.BadRequestException('A feed with this slug already exists');
            }
        }
        let resolvedChannelId = dto.channelId || feed.channelId;
        if (dto.channelUrl && !dto.channelId) {
            let channel = await this.youtubeService.resolveChannel(dto.channelUrl);
            if (!channel) {
                const scrapedChannelId = await this.extractChannelIdFromUrl(dto.channelUrl);
                if (!scrapedChannelId) {
                    throw new common_1.BadRequestException('Could not resolve YouTube channel from the provided URL');
                }
                resolvedChannelId = scrapedChannelId;
            }
            else {
                resolvedChannelId = channel.channelId;
            }
        }
        return this.prisma.customYouTubeFeed.update({
            where: { id },
            data: {
                title: dto.title,
                description: dto.description,
                slug: dto.slug,
                channelId: resolvedChannelId,
                channelUrl: dto.channelUrl,
                categoryId: dto.categoryId,
            },
            include: {
                category: true,
            },
        });
    }
    async delete(id) {
        const feed = await this.prisma.customYouTubeFeed.findUnique({
            where: { id },
        });
        if (!feed) {
            throw new common_1.NotFoundException('Custom YouTube feed not found');
        }
        await this.prisma.customYouTubeFeed.delete({
            where: { id },
        });
        this.logger.log(`Custom YouTube feed deleted: ${feed.slug}`);
        return { message: 'Custom YouTube feed deleted successfully' };
    }
    async getRssXml(slug) {
        const feed = await this.findOne(slug);
        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        const feedUrl = `${baseUrl}/api/v1/custom-youtube-feeds/${slug}/rss.xml`;
        let items = [];
        if (feed.channelId) {
            try {
                this.logger.log(`Fetching videos for YouTube channel: ${feed.channelId}`);
                const youtubeRssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${feed.channelId}`;
                this.logger.log(`Trying YouTube native RSS: ${youtubeRssUrl}`);
                try {
                    const parsed = await this.rssParserService.parseUrl(youtubeRssUrl);
                    this.logger.debug(`YouTube RSS parsed: ${JSON.stringify({
                        hasItems: !!parsed?.items,
                        itemsCount: parsed?.items?.length || 0
                    })}`);
                    if (parsed && parsed.items && parsed.items.length > 0) {
                        items = parsed.items.slice(0, 20).map(item => {
                            const videoLink = item.url || '';
                            let finalLink = videoLink;
                            if (videoLink && !videoLink.includes('watch?v=')) {
                                const videoIdMatch = videoLink.match(/\/video\/([a-zA-Z0-9_-]+)/);
                                if (videoIdMatch) {
                                    finalLink = `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;
                                }
                            }
                            const title = item.title || '';
                            const excerpt = item.excerpt || '';
                            const isLive = /(?:live|ao vivo|streaming|🔴|LIVE)/i.test(title + ' ' + excerpt);
                            return {
                                title: item.title || 'Sem título',
                                subtitle: item.excerpt || '',
                                link: finalLink || videoLink,
                                imageUrl: item.thumbnailUrl,
                                publishedAt: item.publishedAt,
                                isLive: isLive,
                            };
                        });
                        items.sort((a, b) => {
                            if (a.isLive && !b.isLive)
                                return -1;
                            if (!a.isLive && b.isLive)
                                return 1;
                            const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
                            const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
                            return dateB - dateA;
                        });
                        this.logger.log(`Successfully fetched ${items.length} videos from YouTube RSS for feed: ${feed.slug} (${items.filter(i => i.isLive).length} lives)`);
                    }
                    else {
                        this.logger.warn(`YouTube RSS returned no items for channel ${feed.channelId}`);
                        throw new Error('No items in YouTube RSS');
                    }
                }
                catch (rssError) {
                    this.logger.warn(`YouTube RSS failed for channel ${feed.channelId}, trying API: ${rssError}`);
                    const videos = await this.youtubeApi.getRecentVideos(feed.channelId, undefined, 20);
                    items = videos.map((video) => {
                        const isLive = video.isLive || /(?:live|ao vivo|streaming|🔴|LIVE)/i.test(video.title + ' ' + video.description);
                        return {
                            title: video.title,
                            subtitle: video.description,
                            link: `https://www.youtube.com/watch?v=${video.videoId}`,
                            imageUrl: video.thumbnailUrl,
                            publishedAt: video.publishedAt,
                            isLive: isLive,
                        };
                    });
                    items.sort((a, b) => {
                        if (a.isLive && !b.isLive)
                            return -1;
                        if (!a.isLive && b.isLive)
                            return 1;
                        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
                        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
                        return dateB - dateA;
                    });
                    this.logger.log(`Fetched ${items.length} videos from API for feed: ${feed.slug} (${items.filter(i => i.isLive).length} lives)`);
                }
            }
            catch (error) {
                this.logger.error(`Failed to fetch videos for feed ${feed.slug}: ${error}`);
                items = [];
            }
        }
        let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title><![CDATA[${feed.title}]]></title>
    <description><![CDATA[${feed.description || ''}]]></description>
    <link>${feedUrl}</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <pubDate>${feed.updatedAt.toUTCString()}</pubDate>
    <generator>RSS App Custom YouTube Feed Generator</generator>
`;
        for (const item of items) {
            const title = item.isLive ? `🔴 LIVE: ${item.title || 'Sem título'}` : (item.title || 'Sem título');
            rss += `    <item>
      <title><![CDATA[${title}]]></title>
      <description><![CDATA[${item.subtitle || item.title || ''}]]></description>
      <link>${item.link}</link>
      <guid isPermaLink="true">${item.link}</guid>
      <pubDate>${item.publishedAt ? new Date(item.publishedAt).toUTCString() : new Date().toUTCString()}</pubDate>
`;
            if (item.imageUrl) {
                rss += `      <media:content url="${item.imageUrl}" type="image/jpeg" />
      <enclosure url="${item.imageUrl}" type="image/jpeg" />
`;
            }
            rss += `    </item>
`;
        }
        rss += `  </channel>
</rss>`;
        return rss;
    }
    async extractChannelIdFromUrl(url) {
        try {
            let normalizedUrl = url.trim();
            if (normalizedUrl.startsWith('@')) {
                normalizedUrl = `https://www.youtube.com/${normalizedUrl}`;
            }
            else if (!normalizedUrl.startsWith('http')) {
                normalizedUrl = `https://www.youtube.com/@${normalizedUrl.replace('@', '')}`;
            }
            const urlMatch = normalizedUrl.match(/(?:youtube\.com\/(?:channel\/|c\/|@|user\/)?|youtu\.be\/)([^\/\?\s]+)/);
            if (!urlMatch) {
                return null;
            }
            const identifier = urlMatch[1];
            if (identifier.startsWith('UC') && identifier.length === 24) {
                return identifier;
            }
            this.logger.log(`Scraping YouTube page to extract channel ID: ${normalizedUrl}`);
            const scraped = await this.playwrightService.scrapePage(normalizedUrl);
            if (!scraped || !scraped.html) {
                return null;
            }
            const channelIdPatterns = [
                /"channelId":"([^"]+)"/,
                /"externalId":"([^"]+)"/,
                /channel_id=([^&"'\s]+)/,
                /\/channel\/(UC[a-zA-Z0-9_-]{22})/,
                /"browseId":"(UC[a-zA-Z0-9_-]{22})"/,
            ];
            for (const pattern of channelIdPatterns) {
                const match = scraped.html.match(pattern);
                if (match && match[1] && match[1].startsWith('UC')) {
                    this.logger.log(`Found channel ID via scraping: ${match[1]}`);
                    return match[1];
                }
            }
            const metaMatch = scraped.html.match(/<meta[^>]+content="([^"]*channel[^"]*UC[a-zA-Z0-9_-]{22}[^"]*)"/i);
            if (metaMatch) {
                const channelIdMatch = metaMatch[1].match(/(UC[a-zA-Z0-9_-]{22})/);
                if (channelIdMatch) {
                    return channelIdMatch[1];
                }
            }
            this.logger.warn(`Could not extract channel ID from scraped page: ${normalizedUrl}`);
            return null;
        }
        catch (error) {
            this.logger.error(`Error extracting channel ID from URL ${url}: ${error}`);
            return null;
        }
    }
};
exports.CustomYouTubeFeedService = CustomYouTubeFeedService;
exports.CustomYouTubeFeedService = CustomYouTubeFeedService = CustomYouTubeFeedService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        youtube_service_1.YouTubeService,
        youtube_api_service_1.YouTubeApiService,
        rss_parser_service_1.RssParserService,
        playwright_service_1.PlaywrightService])
], CustomYouTubeFeedService);
//# sourceMappingURL=custom-youtube-feed.service.js.map