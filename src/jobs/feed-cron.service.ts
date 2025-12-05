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
  }

  // Run every 10 minutes by default
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleFeedScraping() {
    if (this.isRunning) {
      this.logger.debug('Feed scraping job already running, skipping');
      return;
    }

    // Acquire global lock
    const hasLock = await this.redis.acquireLock('cron:feed-scraping', 600);
    if (!hasLock) {
      this.logger.debug('Another instance is running feed scraping');
      return;
    }

    this.isRunning = true;

    try {
      this.logger.log('Starting scheduled feed scraping');

      // Get feeds that need updating
      const feeds = await this.feedService.getFeedsToScrape(10);

      this.logger.log(`Found ${feeds.length} feeds to scrape`);

      for (const feed of feeds) {
        try {
          await this.scraperService.scrapeFeed(feed.id);
          
          // Small delay between feeds
          await this.delay(1000);
        } catch (error) {
          this.logger.error(`Error scraping feed ${feed.id}: ${error}`);
        }
      }

      this.logger.log('Finished scheduled feed scraping');
    } catch (error) {
      this.logger.error(`Feed cron job error: ${error}`);
    } finally {
      this.isRunning = false;
      await this.redis.releaseLock('cron:feed-scraping');
    }
  }

  // Retry failed feeds every hour
  @Cron(CronExpression.EVERY_HOUR)
  async handleFailedFeedsRetry() {
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
        take: 5,
      });

      for (const feed of failedFeeds) {
        this.logger.debug(`Retrying failed feed: ${feed.url}`);
        
        // Reset status to pending
        await this.prisma.feed.update({
          where: { id: feed.id },
          data: { status: 'pending', errorMessage: null },
        });

        await this.scraperService.queueFeedDiscovery(feed.id);
      }

      this.logger.log(`Queued ${failedFeeds.length} failed feeds for retry`);
    } catch (error) {
      this.logger.error(`Failed feeds retry error: ${error}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}



