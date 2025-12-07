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
const rss_parser_service_1 = require("../../scraper/rss-parser.service");
const playwright_service_1 = require("../../scraper/playwright.service");
let CustomYouTubeFeedService = CustomYouTubeFeedService_1 = class CustomYouTubeFeedService {
    constructor(prisma, rssParserService, playwrightService) {
        this.prisma = prisma;
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
        let resolvedChannelName = null;
        if (dto.channelUrl && !dto.channelId) {
            this.logger.log(`Resolving channel from URL via scraping: ${dto.channelUrl}`);
            const scrapedData = await this.scrapeChannelInfo(dto.channelUrl);
            if (scrapedData && scrapedData.channelId) {
                resolvedChannelId = scrapedData.channelId;
                resolvedChannelName = scrapedData.channelName || null;
                this.logger.log(`Scraped channel ID: ${resolvedChannelId}, name: ${resolvedChannelName}`);
            }
            else {
                this.logger.warn(`Failed to resolve channel from URL: ${dto.channelUrl}`);
                throw new common_1.BadRequestException('Could not resolve YouTube channel from the provided URL. Please check if the URL is correct.');
            }
        }
        if (!resolvedChannelId) {
            throw new common_1.BadRequestException('Channel ID or Channel URL is required');
        }
        if (!resolvedChannelName && resolvedChannelId) {
            resolvedChannelName = await this.scrapeChannelName(resolvedChannelId);
        }
        const feed = await this.prisma.customYouTubeFeed.create({
            data: {
                title: dto.title,
                description: dto.description,
                slug: dto.slug,
                channelId: resolvedChannelId,
                channelName: resolvedChannelName,
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
        let resolvedChannelName = feed.channelName;
        if (dto.channelUrl && !dto.channelId) {
            const scrapedData = await this.scrapeChannelInfo(dto.channelUrl);
            if (scrapedData && scrapedData.channelId) {
                resolvedChannelId = scrapedData.channelId;
                resolvedChannelName = scrapedData.channelName || null;
            }
            else {
                throw new common_1.BadRequestException('Could not resolve YouTube channel from the provided URL');
            }
        }
        return this.prisma.customYouTubeFeed.update({
            where: { id },
            data: {
                title: dto.title,
                description: dto.description,
                slug: dto.slug,
                channelId: resolvedChannelId,
                channelName: resolvedChannelName,
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
    async backfillChannelNames() {
        const feedsWithoutName = await this.prisma.customYouTubeFeed.findMany({
            where: {
                channelName: null,
                channelId: { not: null },
            },
        });
        this.logger.log(`Found ${feedsWithoutName.length} feeds without channel name`);
        const results = {
            updated: 0,
            failed: 0,
            feeds: [],
        };
        for (const feed of feedsWithoutName) {
            try {
                this.logger.log(`Scraping channel name for ${feed.slug} (${feed.channelId})`);
                const channelName = await this.scrapeChannelName(feed.channelId);
                if (channelName) {
                    await this.prisma.customYouTubeFeed.update({
                        where: { id: feed.id },
                        data: { channelName },
                    });
                    results.updated++;
                    results.feeds.push({ slug: feed.slug, channelName });
                    this.logger.log(`Updated channel name for ${feed.slug}: ${channelName}`);
                }
                else {
                    results.failed++;
                    results.feeds.push({ slug: feed.slug, channelName: null, error: 'Could not get channel name' });
                    this.logger.warn(`Could not get channel name for ${feed.slug}`);
                }
            }
            catch (error) {
                results.failed++;
                results.feeds.push({ slug: feed.slug, channelName: null, error: String(error) });
                this.logger.error(`Error updating channel name for ${feed.slug}: ${error}`);
            }
        }
        this.logger.log(`Backfill complete: ${results.updated} updated, ${results.failed} failed`);
        return results;
    }
    async scrapeChannelInfo(url) {
        try {
            let normalizedUrl = url.trim();
            if (normalizedUrl.startsWith('@')) {
                normalizedUrl = `https://www.youtube.com/${normalizedUrl}`;
            }
            else if (!normalizedUrl.startsWith('http')) {
                normalizedUrl = `https://www.youtube.com/@${normalizedUrl.replace('@', '')}`;
            }
            this.logger.log(`Scraping channel info from: ${normalizedUrl}`);
            const scraped = await this.playwrightService.scrapePage(normalizedUrl);
            if (!scraped || !scraped.html) {
                return null;
            }
            const html = scraped.html;
            const channelId = this.extractCorrectChannelId(html);
            if (!channelId) {
                this.logger.warn(`Could not extract channel ID from: ${normalizedUrl}`);
                return null;
            }
            let channelName = null;
            const namePatterns = [
                /<meta property="og:title" content="([^"]+)"/,
                /<meta name="title" content="([^"]+)"/,
                /<title>([^<]+) - YouTube<\/title>/,
            ];
            for (const pattern of namePatterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    const name = match[1].trim();
                    if (name && name !== 'YouTube' && !name.startsWith('http')) {
                        channelName = name;
                        break;
                    }
                }
            }
            this.logger.log(`Scraped channel info - ID: ${channelId}, Name: ${channelName}`);
            return { channelId, channelName };
        }
        catch (error) {
            this.logger.error(`Error scraping channel info: ${error}`);
            return null;
        }
    }
    extractCorrectChannelId(html) {
        const candidates = [];
        const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})"/);
        if (canonicalMatch?.[1]) {
            candidates.push({ id: canonicalMatch[1], source: 'canonical', priority: 1 });
        }
        const rssMatch = html.match(/<link rel="alternate" type="application\/rss\+xml"[^>]+channel_id=(UC[a-zA-Z0-9_-]{22})/);
        if (rssMatch?.[1]) {
            candidates.push({ id: rssMatch[1], source: 'rss', priority: 2 });
        }
        const ogUrlMatch = html.match(/<meta property="og:url" content="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})"/);
        if (ogUrlMatch?.[1]) {
            candidates.push({ id: ogUrlMatch[1], source: 'og:url', priority: 3 });
        }
        const metadataMatch = html.match(/"channelMetadataRenderer":\{[^}]*?"externalId":"(UC[a-zA-Z0-9_-]{22})"/);
        if (metadataMatch?.[1]) {
            candidates.push({ id: metadataMatch[1], source: 'metadata', priority: 4 });
        }
        const genericPatterns = [
            /"externalId":"(UC[a-zA-Z0-9_-]{22})"/,
            /channel_id=(UC[a-zA-Z0-9_-]{22})/,
            /\/channel\/(UC[a-zA-Z0-9_-]{22})/,
        ];
        for (const pattern of genericPatterns) {
            const match = html.match(pattern);
            if (match?.[1] && !candidates.find(c => c.id === match[1])) {
                candidates.push({ id: match[1], source: 'generic', priority: 5 });
                break;
            }
        }
        if (candidates.length === 0) {
            return null;
        }
        candidates.sort((a, b) => a.priority - b.priority);
        const selected = candidates[0];
        const agreementCount = candidates.filter(c => c.id === selected.id).length;
        this.logger.log(`Selected channel ID ${selected.id} from ${selected.source} (${agreementCount}/${candidates.length} sources agree)`);
        return selected.id;
    }
    async scrapeChannelName(channelId) {
        try {
            const channelUrl = `https://www.youtube.com/channel/${channelId}`;
            this.logger.log(`Scraping channel name from: ${channelUrl}`);
            const scraped = await this.playwrightService.scrapePage(channelUrl);
            if (!scraped || !scraped.html) {
                return null;
            }
            const patterns = [
                /<meta property="og:title" content="([^"]+)"/,
                /<meta name="title" content="([^"]+)"/,
                /"channelName":"([^"]+)"/,
                /"name":"([^"]+)"/,
                /<title>([^<]+) - YouTube<\/title>/,
            ];
            for (const pattern of patterns) {
                const match = scraped.html.match(pattern);
                if (match && match[1]) {
                    const name = match[1].trim();
                    if (name && name !== 'YouTube' && !name.startsWith('http')) {
                        this.logger.log(`Found channel name via scraping: ${name}`);
                        return name;
                    }
                }
            }
            return null;
        }
        catch (error) {
            this.logger.error(`Error scraping channel name: ${error}`);
            return null;
        }
    }
    extractVideoId(url) {
        const match = url.match(/(?:watch\?v=|youtu\.be\/|v\/)([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : '';
    }
    async getRssXml(slug) {
        const feed = await this.findOne(slug);
        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        const feedUrl = `${baseUrl}/api/v1/custom-youtube-feeds/${slug}/rss.xml`;
        let items = [];
        if (feed.channelId) {
            try {
                this.logger.log(`Fetching videos for YouTube channel: ${feed.channelId}`);
                const baseChannelId = feed.channelId.startsWith('UC')
                    ? feed.channelId.substring(2)
                    : feed.channelId;
                const uploadsRssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${feed.channelId}`;
                const livesRssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULV${baseChannelId}`;
                this.logger.log(`Fetching uploads from: ${uploadsRssUrl}`);
                this.logger.log(`Fetching lives from: ${livesRssUrl}`);
                let videoItems = [];
                try {
                    const uploadsParsed = await this.rssParserService.parseUrl(uploadsRssUrl);
                    if (uploadsParsed && uploadsParsed.items && uploadsParsed.items.length > 0) {
                        videoItems = uploadsParsed.items.slice(0, 20).map(item => ({
                            title: item.title || 'Sem título',
                            subtitle: item.excerpt || '',
                            link: item.url || '',
                            imageUrl: item.thumbnailUrl,
                            publishedAt: item.publishedAt,
                            isLive: false,
                            videoId: this.extractVideoId(item.url || ''),
                        }));
                    }
                }
                catch (uploadsError) {
                    this.logger.warn(`Failed to fetch uploads: ${uploadsError}`);
                }
                let currentLive = null;
                try {
                    const livesParsed = await this.rssParserService.parseUrl(livesRssUrl);
                    if (livesParsed && livesParsed.items && livesParsed.items.length > 0) {
                        const firstLive = livesParsed.items[0];
                        const liveVideoId = this.extractVideoId(firstLive.url || '');
                        const publishedDate = new Date(firstLive.publishedAt || 0);
                        const now = new Date();
                        const hoursAgo = (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60);
                        const isLikelyActive = hoursAgo < 24;
                        currentLive = {
                            title: firstLive.title || 'Live Stream',
                            subtitle: firstLive.excerpt || '',
                            link: firstLive.url || `https://www.youtube.com/watch?v=${liveVideoId}`,
                            imageUrl: firstLive.thumbnailUrl,
                            publishedAt: firstLive.publishedAt,
                            isLive: isLikelyActive,
                            videoId: liveVideoId,
                        };
                        this.logger.log(`Found live stream: ${currentLive.title} (active: ${isLikelyActive}, hours ago: ${hoursAgo.toFixed(1)})`);
                    }
                }
                catch (livesError) {
                    this.logger.warn(`Failed to fetch lives playlist: ${livesError}`);
                }
                if (currentLive && currentLive.isLive) {
                    items = [currentLive];
                    for (const video of videoItems) {
                        if (video.videoId !== currentLive.videoId) {
                            items.push(video);
                        }
                    }
                }
                else {
                    items = videoItems;
                }
                this.logger.log(`Successfully fetched ${items.length} items for feed: ${feed.slug} (lives: ${items.filter(i => i.isLive).length})`);
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
        rss_parser_service_1.RssParserService,
        playwright_service_1.PlaywrightService])
], CustomYouTubeFeedService);
//# sourceMappingURL=custom-youtube-feed.service.js.map