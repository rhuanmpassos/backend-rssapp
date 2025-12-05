import {
  Injectable,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ScraperService } from '../../scraper/scraper.service';
import { FeedStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ScraperService))
    private scraperService: ScraperService,
  ) {}

  async getOrCreateFeed(url: string) {
    // Normalize URL
    const normalizedUrl = this.normalizeUrl(url);
    const domain = new URL(normalizedUrl).hostname;

    // Check if feed already exists
    let feed = await this.prisma.feed.findUnique({
      where: { url: normalizedUrl },
    });

    if (feed) {
      return feed;
    }

    // Create new feed
    feed = await this.prisma.feed.create({
      data: {
        url: normalizedUrl,
        siteDomain: domain,
        status: FeedStatus.pending,
      },
    });

    this.logger.log(`Created new feed: ${normalizedUrl}`);

    // Queue feed discovery job (async, don't wait)
    this.scraperService.queueFeedDiscovery(feed.id).catch((err) => {
      this.logger.error(`Failed to queue feed discovery: ${err.message}`);
    });

    return feed;
  }

  async getFeedById(feedId: string) {
    const feed = await this.prisma.feed.findUnique({
      where: { id: feedId },
    });

    if (!feed) {
      throw new NotFoundException('Feed not found');
    }

    return feed;
  }

  async listFeeds(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [feeds, total] = await Promise.all([
      this.prisma.feed.findMany({
        orderBy: { lastScrapeAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { items: true },
          },
        },
      }),
      this.prisma.feed.count(),
    ]);

    return {
      data: feeds,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFeedItems(
    feedId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const feed = await this.getFeedById(feedId);

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.feedItem.findMany({
        where: { feedId: feed.id },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.feedItem.count({ where: { feedId: feed.id } }),
    ]);

    return {
      feed: {
        id: feed.id,
        title: feed.title,
        siteDomain: feed.siteDomain,
      },
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateFeed(
    feedId: string,
    data: {
      title?: string;
      rssUrl?: string;
      faviconUrl?: string;
      status?: FeedStatus;
      errorMessage?: string;
    },
  ) {
    return this.prisma.feed.update({
      where: { id: feedId },
      data: {
        ...data,
        lastScrapeAt: new Date(),
      },
    });
  }

  async markFeedError(feedId: string, error: string) {
    return this.prisma.feed.update({
      where: { id: feedId },
      data: {
        status: FeedStatus.error,
        errorMessage: error,
        lastScrapeAt: new Date(),
      },
    });
  }

  async markFeedBlocked(feedId: string) {
    return this.prisma.feed.update({
      where: { id: feedId },
      data: {
        status: FeedStatus.blocked,
        errorMessage: 'Site blocks scraping (robots.txt or X-Robots-Tag)',
        lastScrapeAt: new Date(),
      },
    });
  }

  async getFeedsToScrape(limit: number = 10) {
    const staleTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

    return this.prisma.feed.findMany({
      where: {
        status: { in: [FeedStatus.active, FeedStatus.pending] },
        OR: [
          { lastScrapeAt: null },
          { lastScrapeAt: { lt: staleTime } },
        ],
      },
      orderBy: { lastScrapeAt: 'asc' },
      take: limit,
    });
  }

  generateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 32);
  }

  normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove trailing slash, lowercase hostname
      parsed.hostname = parsed.hostname.toLowerCase();
      let normalized = parsed.href;
      if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
      }
      return normalized;
    } catch {
      return url;
    }
  }

  queueFeedDiscovery(feedId: string) {
    return this.scraperService.queueFeedDiscovery(feedId);
  }
}
