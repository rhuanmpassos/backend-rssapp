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
var SearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const client_1 = require("@prisma/client");
let SearchService = SearchService_1 = class SearchService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(SearchService_1.name);
    }
    async search(params) {
        const { userId, query, type, author, feedId, channelId, page, limit } = params;
        const offset = (page - 1) * limit;
        if (!query || query.trim().length === 0) {
            return {
                data: [],
                meta: { page, limit, total: 0, totalPages: 0 },
            };
        }
        const sanitizedQuery = this.sanitizeQuery(query);
        const results = [];
        let feedTotal = 0;
        let videoTotal = 0;
        if (type === 'all' || type === 'feed') {
            const feedItems = await this.searchFeedItems(sanitizedQuery, {
                author,
                feedId,
                userId,
                limit: type === 'all' ? Math.ceil(limit / 2) : limit,
                offset: type === 'all' ? Math.ceil(offset / 2) : offset,
            });
            feedTotal = feedItems.total;
            results.push(...feedItems.data.map((item) => ({
                ...item,
                resultType: 'feed',
            })));
        }
        if (type === 'all' || type === 'video') {
            const videos = await this.searchVideos(sanitizedQuery, {
                channelId,
                userId,
                limit: type === 'all' ? Math.floor(limit / 2) : limit,
                offset: type === 'all' ? Math.floor(offset / 2) : offset,
            });
            videoTotal = videos.total;
            results.push(...videos.data.map((item) => ({
                ...item,
                resultType: 'video',
            })));
        }
        results.sort((a, b) => {
            if (a.relevance !== b.relevance) {
                return (b.relevance || 0) - (a.relevance || 0);
            }
            return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        });
        const total = feedTotal + videoTotal;
        return {
            data: results.slice(0, limit),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                feedCount: feedTotal,
                videoCount: videoTotal,
            },
        };
    }
    async searchFeedItems(query, options) {
        const { author, feedId, userId, limit, offset } = options;
        const userFeeds = await this.prisma.subscription.findMany({
            where: { userId, type: 'site', enabled: true },
            select: { feedId: true },
        });
        const feedIds = userFeeds.map((s) => s.feedId).filter(Boolean);
        if (feedIds.length === 0) {
            return { data: [], total: 0 };
        }
        const feedIdFilter = feedId ? [feedId] : feedIds;
        const items = await this.prisma.$queryRaw `
      SELECT 
        id,
        feed_id as "feedId",
        url,
        title,
        excerpt,
        thumbnail_url as "thumbnailUrl",
        author,
        published_at as "publishedAt",
        ts_rank(
          to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE(author, '')),
          plainto_tsquery('portuguese', ${query})
        ) as relevance
      FROM feed_items
      WHERE 
        feed_id = ANY(${feedIdFilter}::text[])
        AND to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE(author, ''))
            @@ plainto_tsquery('portuguese', ${query})
        ${author ? client_1.Prisma.sql `AND author ILIKE ${`%${author}%`}` : client_1.Prisma.empty}
      ORDER BY relevance DESC, published_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
        const countResult = await this.prisma.$queryRaw `
      SELECT COUNT(*) as count
      FROM feed_items
      WHERE 
        feed_id = ANY(${feedIdFilter}::text[])
        AND to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE(author, ''))
            @@ plainto_tsquery('portuguese', ${query})
        ${author ? client_1.Prisma.sql `AND author ILIKE ${`%${author}%`}` : client_1.Prisma.empty}
    `;
        return {
            data: items,
            total: Number(countResult[0]?.count || 0),
        };
    }
    async searchVideos(query, options) {
        const { channelId, userId, limit, offset } = options;
        const userChannels = await this.prisma.subscription.findMany({
            where: { userId, type: 'youtube', enabled: true },
            select: { channelId: true },
        });
        const channelIds = userChannels.map((s) => s.channelId).filter(Boolean);
        if (channelIds.length === 0) {
            return { data: [], total: 0 };
        }
        const channelIdFilter = channelId ? [channelId] : channelIds;
        const videos = await this.prisma.$queryRaw `
      SELECT 
        v.id,
        v.video_id as "videoId",
        v.channel_db_id as "channelDbId",
        v.title,
        v.description,
        v.thumbnail_url as "thumbnailUrl",
        v.duration,
        v.published_at as "publishedAt",
        c.title as "channelTitle",
        ts_rank(
          to_tsvector('portuguese', COALESCE(v.title, '') || ' ' || COALESCE(v.description, '')),
          plainto_tsquery('portuguese', ${query})
        ) as relevance
      FROM youtube_videos v
      JOIN youtube_channels c ON v.channel_db_id = c.id
      WHERE 
        v.channel_db_id = ANY(${channelIdFilter}::text[])
        AND to_tsvector('portuguese', COALESCE(v.title, '') || ' ' || COALESCE(v.description, ''))
            @@ plainto_tsquery('portuguese', ${query})
      ORDER BY relevance DESC, v.published_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
        const countResult = await this.prisma.$queryRaw `
      SELECT COUNT(*) as count
      FROM youtube_videos v
      WHERE 
        v.channel_db_id = ANY(${channelIdFilter}::text[])
        AND to_tsvector('portuguese', COALESCE(v.title, '') || ' ' || COALESCE(v.description, ''))
            @@ plainto_tsquery('portuguese', ${query})
    `;
        return {
            data: videos,
            total: Number(countResult[0]?.count || 0),
        };
    }
    async searchBookmarks(params) {
        const { userId, query, type, page, limit } = params;
        const offset = (page - 1) * limit;
        if (!query || query.trim().length === 0) {
            return {
                data: [],
                meta: { page, limit, total: 0, totalPages: 0 },
            };
        }
        const sanitizedQuery = this.sanitizeQuery(query);
        const typeFilter = type !== 'all' ? client_1.Prisma.sql `AND item_type = ${type}` : client_1.Prisma.empty;
        const bookmarks = await this.prisma.$queryRaw `
      SELECT 
        id,
        item_type as "itemType",
        item_id as "itemId",
        title,
        excerpt,
        thumbnail_url as "thumbnailUrl",
        url,
        source,
        published_at as "publishedAt",
        saved_at as "savedAt",
        ts_rank(
          to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE(source, '')),
          plainto_tsquery('portuguese', ${sanitizedQuery})
        ) as relevance
      FROM user_bookmarks
      WHERE 
        user_id = ${userId}
        AND to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE(source, ''))
            @@ plainto_tsquery('portuguese', ${sanitizedQuery})
        ${typeFilter}
      ORDER BY relevance DESC, saved_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
        const countResult = await this.prisma.$queryRaw `
      SELECT COUNT(*) as count
      FROM user_bookmarks
      WHERE 
        user_id = ${userId}
        AND to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE(source, ''))
            @@ plainto_tsquery('portuguese', ${sanitizedQuery})
        ${typeFilter}
    `;
        const total = Number(countResult[0]?.count || 0);
        return {
            data: bookmarks,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    sanitizeQuery(query) {
        return query
            .trim()
            .replace(/[^\w\s\u00C0-\u017F]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
};
exports.SearchService = SearchService;
exports.SearchService = SearchService = SearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SearchService);
//# sourceMappingURL=search.service.js.map