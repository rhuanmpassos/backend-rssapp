import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeedService } from './feed.service';
import * as crypto from 'crypto';

export interface CreateFeedItemData {
  feedId: string;
  url: string;
  canonicalUrl?: string;
  title: string;
  excerpt?: string;
  thumbnailUrl?: string;
  author?: string;
  publishedAt?: Date;
}

@Injectable()
export class FeedItemService {
  private readonly logger = new Logger(FeedItemService.name);

  constructor(
    private prisma: PrismaService,
    private feedService: FeedService,
  ) { }

  async createOrUpdate(data: CreateFeedItemData) {
    const normalizedUrl = this.feedService.normalizeUrl(data.url);
    const contentHash = this.generateContentHash(data);

    // Check for existing item by URL or content hash (deduplication)
    const existingItem = await this.prisma.feedItem.findFirst({
      where: {
        feedId: data.feedId,
        OR: [
          { url: normalizedUrl },
          { contentHash },
        ],
      },
    });

    if (existingItem) {
      // Update if content changed
      if (existingItem.contentHash !== contentHash) {
        this.logger.debug(`Updating existing item: ${data.title}`);
        return this.prisma.feedItem.update({
          where: { id: existingItem.id },
          data: {
            title: data.title,
            excerpt: data.excerpt,
            thumbnailUrl: data.thumbnailUrl,
            contentHash,
          },
        });
      }
      return existingItem;
    }

    // Create new item (with race condition handling)
    this.logger.log(`Creating new feed item: ${data.title}`);

    try {
      return await this.prisma.feedItem.create({
        data: {
          feedId: data.feedId,
          url: normalizedUrl,
          canonicalUrl: data.canonicalUrl,
          title: data.title,
          excerpt: this.truncateExcerpt(data.excerpt),
          thumbnailUrl: data.thumbnailUrl,
          author: data.author,
          publishedAt: data.publishedAt || new Date(),
          contentHash,
        },
      });
    } catch (error: any) {
      // Handle unique constraint violation (race condition - another process created it)
      if (error?.code === 'P2002') {
        this.logger.debug(`Item already exists (race condition), skipping: ${data.title}`);
        // Return the existing item
        const existing = await this.prisma.feedItem.findFirst({
          where: {
            feedId: data.feedId,
            OR: [
              { url: normalizedUrl },
              { contentHash },
            ],
          },
        });
        return existing;
      }
      throw error;
    }
  }

  async bulkCreate(feedId: string, items: Omit<CreateFeedItemData, 'feedId'>[]) {
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
    };

    for (const item of items) {
      try {
        const existing = await this.prisma.feedItem.findFirst({
          where: {
            feedId,
            url: this.feedService.normalizeUrl(item.url),
          },
        });

        if (existing) {
          results.skipped++;
        } else {
          await this.createOrUpdate({ ...item, feedId });
          results.created++;
        }
      } catch (error) {
        this.logger.error(`Failed to create item ${item.url}: ${error}`);
        results.skipped++;
      }
    }

    return results;
  }

  async getRecentItems(feedId: string, limit: number = 50) {
    return this.prisma.feedItem.findMany({
      where: { feedId },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }

  async getItemById(itemId: string) {
    return this.prisma.feedItem.findUnique({
      where: { id: itemId },
      include: {
        feed: {
          select: {
            id: true,
            title: true,
            siteDomain: true,
          },
        },
      },
    });
  }

  async getNewItemsSince(feedId: string, since: Date) {
    return this.prisma.feedItem.findMany({
      where: {
        feedId,
        fetchedAt: { gt: since },
      },
      orderBy: { fetchedAt: 'desc' },
    });
  }

  private generateContentHash(data: CreateFeedItemData): string {
    const content = `${data.url}|${data.title}`;
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 32);
  }

  private truncateExcerpt(excerpt?: string): string | undefined {
    if (!excerpt) return undefined;
    // Limit to 500 characters (NO LLM summarization!)
    if (excerpt.length > 500) {
      return excerpt.slice(0, 497) + '...';
    }
    return excerpt;
  }
}



