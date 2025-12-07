import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { FeedService } from '../modules/feed/feed.service';
import { ScraperService } from '../scraper/scraper.service';

@Injectable()
export class FeedCronService {
  private readonly logger = new Logger(FeedCronService.name);
  private readonly intervalMinutes: number;
  private readonly batchSize: number;
  private readonly concurrency: number;
  private isRunning = false;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private configService: ConfigService,
    private feedService: FeedService,
    private scraperService: ScraperService,
  ) {
    this.intervalMinutes = this.configService.get<number>(
      'CRON_FEED_INTERVAL_MINUTES',
      10,
    );
    // New: configurable batch size and concurrency
    this.batchSize = this.configService.get<number>('CRON_FEED_BATCH_SIZE', 50);
    this.concurrency = this.configService.get<number>('CRON_FEED_CONCURRENCY', 10);
  }

  // Run every 5 minutes for faster updates
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleFeedScraping() {
    if (this.isRunning) {
      this.logger.debug('Feed scraping job already running, skipping');
      return;
    }

    // Acquire global lock with longer timeout for parallel processing
    const hasLock = await this.redis.acquireLock('cron:feed-scraping', 900);
    if (!hasLock) {
      this.logger.debug('Another instance is running feed scraping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log(`Starting scheduled feed scraping (batch: ${this.batchSize}, concurrency: ${this.concurrency})`);

      // Get more feeds that need updating
      const feeds = await this.feedService.getFeedsToScrape(this.batchSize);

      this.logger.log(`Found ${feeds.length} feeds to scrape`);

      // Process feeds in parallel with concurrency limit
      await this.processInBatches(
        feeds,
        this.concurrency,
        async (feed) => {
          try {
            await this.scraperService.scrapeFeed(feed.id);
          } catch (error) {
            this.logger.error(`Error scraping feed ${feed.id}: ${error}`);
          }
        }
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`Finished scheduled feed scraping in ${duration}s (${feeds.length} feeds)`);
    } catch (error) {
      this.logger.error(`Feed cron job error: ${error}`);
    } finally {
      this.isRunning = false;
      await this.redis.releaseLock('cron:feed-scraping');
    }
  }

  // Retry failed feeds every hour with parallel processing
  @Cron(CronExpression.EVERY_HOUR)
  async handleFailedFeedsRetry() {
    const hasLock = await this.redis.acquireLock('cron:feed-retry', 300);
    if (!hasLock) {
      this.logger.debug('Another instance is running feed retry');
      return;
    }

    try {
      this.logger.log('Retrying failed feeds');

      const failedFeeds = await this.prisma.feed.findMany({
        where: {
          status: 'error',
          lastScrapeAt: {
            // Only retry feeds that failed more than 1 hour ago
            lt: new Date(Date.now() - 60 * 60 * 1000),
          },
        },
        take: 20, // Increased from 5
      });

      // Process retries in parallel
      await this.processInBatches(
        failedFeeds,
        5,
        async (feed) => {
          this.logger.debug(`Retrying failed feed: ${feed.url}`);

          // Reset status to pending
          await this.prisma.feed.update({
            where: { id: feed.id },
            data: { status: 'pending', errorMessage: null },
          });

          await this.scraperService.queueFeedDiscovery(feed.id);
        }
      );

      this.logger.log(`Queued ${failedFeeds.length} failed feeds for retry`);
    } catch (error) {
      this.logger.error(`Failed feeds retry error: ${error}`);
    } finally {
      await this.redis.releaseLock('cron:feed-retry');
    }
  }

  /**
   * Process items in parallel with concurrency limit
   */
  private async processInBatches<T>(
    items: T[],
    concurrency: number,
    processor: (item: T) => Promise<void>
  ): Promise<void> {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += concurrency) {
      chunks.push(items.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(processor));
      // Small delay between batches to avoid overwhelming the system
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.delay(500);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}



