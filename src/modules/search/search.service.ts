import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface SearchParams {
  userId: string;
  query: string;
  type: 'all' | 'feed' | 'video';
  author?: string;
  feedId?: string;
  channelId?: string;
  page: number;
  limit: number;
}

interface SearchBookmarksParams {
  userId: string;
  query: string;
  type: 'all' | 'feed' | 'video';
  page: number;
  limit: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private prisma: PrismaService) { }

  async search(params: SearchParams) {
    const { userId, query, type, author, feedId, channelId, page, limit } = params;
    const offset = (page - 1) * limit;

    if (!query || query.trim().length === 0) {
      return {
        data: [],
        meta: { page, limit, total: 0, totalPages: 0 },
      };
    }

    // Sanitize query for PostgreSQL full-text search
    const sanitizedQuery = this.sanitizeQuery(query);

    const results: any[] = [];
    let feedTotal = 0;
    let videoTotal = 0;

    // Search feed items
    if (type === 'all' || type === 'feed') {
      const feedItems = await this.searchFeedItems(sanitizedQuery, {
        author,
        feedId,
        userId,
        limit: type === 'all' ? Math.ceil(limit / 2) : limit,
        offset: type === 'all' ? Math.ceil(offset / 2) : offset,
      });

      feedTotal = feedItems.total;
      results.push(...feedItems.data.map((item: any) => ({
        ...item,
        resultType: 'feed',
      })));
    }

    // Search YouTube videos
    if (type === 'all' || type === 'video') {
      const videos = await this.searchVideos(sanitizedQuery, {
        channelId,
        userId,
        limit: type === 'all' ? Math.floor(limit / 2) : limit,
        offset: type === 'all' ? Math.floor(offset / 2) : offset,
      });

      videoTotal = videos.total;
      results.push(...videos.data.map((item: any) => ({
        ...item,
        resultType: 'video',
      })));
    }

    // Sort combined results by relevance and date
    results.sort((a, b) => {
      // Higher relevance first
      if (a.relevance !== b.relevance) {
        return (b.relevance || 0) - (a.relevance || 0);
      }
      // Then by date
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

  private async searchFeedItems(
    query: string,
    options: { author?: string; feedId?: string; userId: string; limit: number; offset: number }
  ) {
    const { author, feedId, userId, limit, offset } = options;

    // Get user's subscribed feeds
    const userFeeds = await this.prisma.subscription.findMany({
      where: { userId, type: 'site', enabled: true },
      select: { feedId: true },
    });
    const feedIds = userFeeds.map((s) => s.feedId).filter(Boolean) as string[];

    if (feedIds.length === 0) {
      return { data: [], total: 0 };
    }

    // Build the filter
    const feedIdFilter = feedId ? [feedId] : feedIds;

    // Use raw query for full-text search with ranking
    const items = await this.prisma.$queryRaw<any[]>`
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
        ${author ? Prisma.sql`AND author ILIKE ${`%${author}%`}` : Prisma.empty}
      ORDER BY relevance DESC, published_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Get total count
    const countResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM feed_items
      WHERE 
        feed_id = ANY(${feedIdFilter}::text[])
        AND to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE(author, ''))
            @@ plainto_tsquery('portuguese', ${query})
        ${author ? Prisma.sql`AND author ILIKE ${`%${author}%`}` : Prisma.empty}
    `;

    return {
      data: items,
      total: Number(countResult[0]?.count || 0),
    };
  }

  private async searchVideos(
    query: string,
    options: { channelId?: string; userId: string; limit: number; offset: number }
  ) {
    const { channelId, userId, limit, offset } = options;

    // Get user's subscribed channels
    const userChannels = await this.prisma.subscription.findMany({
      where: { userId, type: 'youtube', enabled: true },
      select: { channelId: true },
    });
    const channelIds = userChannels.map((s) => s.channelId).filter(Boolean) as string[];

    if (channelIds.length === 0) {
      return { data: [], total: 0 };
    }

    const channelIdFilter = channelId ? [channelId] : channelIds;

    // Use raw query for full-text search with ranking
    const videos = await this.prisma.$queryRaw<any[]>`
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

    // Get total count
    const countResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
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

  async searchBookmarks(params: SearchBookmarksParams) {
    const { userId, query, type, page, limit } = params;
    const offset = (page - 1) * limit;

    if (!query || query.trim().length === 0) {
      return {
        data: [],
        meta: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const sanitizedQuery = this.sanitizeQuery(query);

    // Build type filter
    const typeFilter = type !== 'all' ? Prisma.sql`AND item_type = ${type}` : Prisma.empty;

    const bookmarks = await this.prisma.$queryRaw<any[]>`
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

    const countResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
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

  /**
   * Sanitize query for PostgreSQL full-text search
   * Removes special characters that could break the query
   */
  private sanitizeQuery(query: string): string {
    return query
      .trim()
      .replace(/[^\w\s\u00C0-\u017F]/g, ' ') // Keep only word chars, spaces, and accented chars
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }
}
