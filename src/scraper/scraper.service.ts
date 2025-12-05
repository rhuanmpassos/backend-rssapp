import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { RssParserService } from './rss-parser.service';
import { PlaywrightService } from './playwright.service';
import { RobotsService } from './robots.service';
import { FeedService } from '../modules/feed/feed.service';
import { FeedItemService } from '../modules/feed/feed-item.service';
import { PushService } from '../modules/push/push.service';
import { FeedStatus, JobStatus, JobType } from '@prisma/client';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly politenessDelay: number;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private configService: ConfigService,
    private rssParser: RssParserService,
    private playwright: PlaywrightService,
    private robots: RobotsService,
    @Inject(forwardRef(() => FeedService))
    private feedService: FeedService,
    @Inject(forwardRef(() => FeedItemService))
    private feedItemService: FeedItemService,
    private pushService: PushService,
  ) {
    this.politenessDelay = this.configService.get<number>(
      'SCRAPER_POLITENESS_DELAY',
      2000,
    );
  }

  async queueFeedDiscovery(feedId: string) {
    await this.prisma.jobLog.create({
      data: {
        jobType: JobType.scrape_feed,
        target: feedId,
        status: JobStatus.pending,
      },
    });

    // Process immediately and don't wait (fire and forget for speed)
    this.logger.log(`Queueing feed discovery for feed: ${feedId}`);
    
    // Execute immediately without blocking
    this.discoverAndScrapeFeed(feedId).catch((err) => {
      this.logger.error(`Feed discovery failed for ${feedId}: ${err.message}`, err.stack);
    });
  }

  async queueFeedScrape(feedId: string) {
    await this.prisma.jobLog.create({
      data: {
        jobType: JobType.scrape_feed,
        target: feedId,
        status: JobStatus.pending,
      },
    });

    setImmediate(() => {
      this.scrapeFeed(feedId).catch((err) => {
        this.logger.error(`Feed scrape failed: ${err}`);
      });
    });
  }

  async discoverAndScrapeFeed(feedId: string) {
    const lockKey = `feed-discovery:${feedId}`;
    const lockAcquired = await this.redis.acquireLock(lockKey, 300);

    if (!lockAcquired) {
      this.logger.debug(`Feed discovery already in progress: ${feedId}`);
      return;
    }

    try {
      this.logger.log(`Starting feed discovery for feed: ${feedId}`);
      const feed = await this.feedService.getFeedById(feedId);
      this.logger.log(`Feed URL: ${feed.url}, Status: ${feed.status}`);

      // Update job status
      await this.prisma.jobLog.updateMany({
        where: {
          jobType: JobType.scrape_feed,
          target: feedId,
          status: JobStatus.pending,
        },
        data: { status: JobStatus.running },
      });

      // If feed already has rssUrl (e.g., custom YouTube feed), use it directly
      if (feed.rssUrl) {
        this.logger.log(`Feed already has RSS URL, using it directly: ${feed.rssUrl}`);
        
        // Check if it's a custom YouTube feed RSS
        const isCustomYouTubeFeed = feed.rssUrl.includes('/custom-youtube-feeds/');
        if (isCustomYouTubeFeed) {
          // For custom YouTube feeds, mark as active and scrape directly
          await this.feedService.updateFeed(feedId, {
            status: FeedStatus.active,
          });
        } else {
          // For other feeds with rssUrl, just update status
          await this.feedService.updateFeed(feedId, {
            status: FeedStatus.active,
          });
        }
        
        // Now scrape the feed
        this.logger.log(`Starting feed scrape for: ${feedId}`);
        try {
          await this.scrapeFeed(feedId);
        } catch (error) {
          this.logger.error(`RSS scraping failed: ${error}`);
          // For custom feeds, don't try HTML extraction as fallback
          if (!isCustomYouTubeFeed) {
            await this.scrapeFeedFromHtml(feedId, feed.url);
          }
        }
        return;
      }

      // Check robots.txt
      this.logger.debug(`Checking robots.txt for: ${feed.url}`);
      const canScrape = await this.robots.isAllowed(feed.url);
      if (!canScrape) {
        this.logger.warn(`Feed ${feedId} blocked by robots.txt`);
        await this.feedService.markFeedBlocked(feedId);
        await this.prisma.jobLog.updateMany({
          where: {
            jobType: JobType.scrape_feed,
            target: feedId,
            status: JobStatus.running,
          },
          data: {
            status: JobStatus.failed,
            lastError: 'Blocked by robots.txt',
          },
        });
        return;
      }

      // Try to discover RSS feed (fast path)
      this.logger.log(`Discovering RSS feed for: ${feed.url}`);
      const rssUrl = await this.discoverRssFeed(feed.url);

      if (rssUrl) {
        this.logger.log(`RSS feed discovered: ${rssUrl}`);

        // Update feed with RSS URL
        await this.feedService.updateFeed(feedId, {
          rssUrl,
          status: FeedStatus.active,
        });

        // Now scrape the feed
        this.logger.log(`Starting feed scrape for: ${feedId}`);
        try {
          await this.scrapeFeed(feedId);
        } catch (error) {
          this.logger.error(`RSS scraping failed, trying HTML extraction: ${error}`);
          // If RSS scraping fails, try HTML extraction as fallback
          await this.scrapeFeedFromHtml(feedId, feed.url);
        }
      } else {
        // No RSS found - extract directly from HTML
        this.logger.log(`No RSS feed found, extracting articles directly from HTML: ${feed.url}`);
        await this.scrapeFeedFromHtml(feedId, feed.url);
      }
    } catch (error) {
      this.logger.error(`Feed discovery error: ${error}`);
      await this.feedService.markFeedError(feedId, String(error));
      await this.prisma.jobLog.updateMany({
        where: {
          jobType: JobType.scrape_feed,
          target: feedId,
          status: JobStatus.running,
        },
        data: {
          status: JobStatus.failed,
          lastError: String(error),
        },
      });
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  async scrapeFeed(feedId: string) {
    const lockKey = `feed-scrape:${feedId}`;
    const lockAcquired = await this.redis.acquireLock(lockKey, 300);

    if (!lockAcquired) {
      this.logger.debug(`Feed scrape already in progress: ${feedId}`);
      return;
    }

    try {
      const feed = await this.feedService.getFeedById(feedId);

      if (!feed.rssUrl) {
        throw new Error('RSS URL not set');
      }

      // Update job status
      await this.prisma.jobLog.updateMany({
        where: {
          jobType: JobType.scrape_feed,
          target: feedId,
          status: JobStatus.pending,
        },
        data: { status: JobStatus.running },
      });

      // Check if it's a custom YouTube feed - if so, get channel ID and use YouTube RSS directly
      const customYouTubeFeedMatch = feed.rssUrl.match(/\/custom-youtube-feeds\/([^\/]+)\/rss\.xml/);
      let actualRssUrl = feed.rssUrl;
      
      if (customYouTubeFeedMatch) {
        const slug = customYouTubeFeedMatch[1];
        this.logger.log(`Detected custom YouTube feed: ${slug}, fetching channel info...`);
        
        // Get the custom YouTube feed to find the channel ID
        const customYouTubeFeed = await this.prisma.customYouTubeFeed.findUnique({
          where: { slug },
          select: { channelId: true, title: true },
        });
        
        if (customYouTubeFeed?.channelId) {
          // Use YouTube's native RSS directly instead of our endpoint
          actualRssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${customYouTubeFeed.channelId}`;
          this.logger.log(`Using YouTube native RSS: ${actualRssUrl}`);
        } else {
          this.logger.warn(`Custom YouTube feed ${slug} has no channelId, cannot scrape`);
          throw new Error(`Custom YouTube feed ${slug} has no channelId configured`);
        }
      }

      // Parse RSS feed
      const parsed = await this.rssParser.parseUrl(actualRssUrl);

      if (!parsed) {
        throw new Error('Failed to parse RSS feed');
      }

      // Update feed metadata
      await this.feedService.updateFeed(feedId, {
        title: parsed.title,
      });

      // Process items
      let newItemsCount = 0;
      for (const item of parsed.items) {
        const existing = await this.prisma.feedItem.findFirst({
          where: {
            feedId: feed.id,
            url: item.url,
          },
        });

        if (existing) {
          continue; // Skip existing items
        }

        await this.feedItemService.createOrUpdate({
          feedId: feed.id,
          url: item.url,
          title: item.title,
          excerpt: item.excerpt || '',
          thumbnailUrl: item.thumbnailUrl,
          author: item.author,
          publishedAt: item.publishedAt || new Date(),
        });

        newItemsCount++;

        // Notify subscribers of new item
        const subscriptions = await this.prisma.subscription.findMany({
          where: {
            feedId: feed.id,
            enabled: true,
          },
          include: {
            user: {
              select: {
                id: true,
                preferences: true,
              },
            },
          },
        });

        for (const subscription of subscriptions) {
          if (
            subscription.user.preferences &&
            (subscription.user.preferences as any).notificationsEnabled
          ) {
            await this.pushService.sendToUser(
              subscription.user.id,
              {
                title: parsed.title,
                body: item.title,
                data: {
                  type: 'feed_item',
                  feedId: feed.id,
                  itemUrl: item.url,
                },
              },
            ).catch((err: any) => {
              this.logger.error(`Failed to send notification: ${err}`);
            });
          }
        }
      }

      // Update job status
      await this.prisma.jobLog.updateMany({
        where: {
          jobType: JobType.scrape_feed,
          target: feedId,
          status: JobStatus.running,
        },
        data: {
          status: JobStatus.completed,
          result: { newItemsCount },
        },
      });

      this.logger.log(
        `Feed ${feedId} scraped: ${newItemsCount} new items`,
      );
    } catch (error) {
      this.logger.error(`Feed scrape error: ${error}`);
      await this.feedService.markFeedError(feedId, String(error));
      await this.prisma.jobLog.updateMany({
        where: {
          jobType: JobType.scrape_feed,
          target: feedId,
          status: JobStatus.running,
        },
        data: {
          status: JobStatus.failed,
          lastError: String(error),
        },
      });
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  private async discoverRssFeed(siteUrl: string): Promise<string | null> {
    try {
      const baseUrl = new URL(siteUrl);
      const baseHref = baseUrl.href.replace(/\/$/, '');
      const hostname = baseUrl.hostname.toLowerCase();

      // Site-specific RSS paths
      const siteSpecificPaths: Record<string, string[]> = {
        'g1.globo.com': [
          'https://g1.globo.com/rss/g1/',
          'https://g1.globo.com/rss/g1/index.xml',
          '/rss/g1/',
          '/rss/g1/index.xml',
          '/rss/g1',
          '/feed',
          '/rss',
          '/rss.xml',
        ],
        'oglobo.globo.com': [
          '/rss',
          '/feed',
        ],
        'extra.globo.com': [
          '/rss',
          '/feed',
        ],
        'folha.uol.com.br': [
          '/rss',
          '/feed',
        ],
        'estadao.com.br': [
          '/rss',
          '/feed',
        ],
      };

      // Get site-specific paths or use common paths
      const specificPaths = siteSpecificPaths[hostname] || [];
      const commonPaths = [
        '/feed',
        '/rss',
        '/rss.xml',
        '/feed.xml',
        '/atom.xml',
        '/index.xml',
      ];

      // Try site-specific paths first
      const allPaths = [...specificPaths, ...commonPaths];

      for (const path of allPaths) {
        const testUrl = path.startsWith('http') ? path : `${baseHref}${path}`;
        try {
          this.logger.log(`Trying RSS path: ${testUrl}`);
          
          const parsed = await this.rssParser.parseUrl(testUrl);
          if (parsed && parsed.items && parsed.items.length > 0) {
            this.logger.log(`Found RSS feed at: ${testUrl} with ${parsed.items.length} items`);
            return testUrl;
          } else {
            this.logger.debug(`RSS feed at ${testUrl} has no items`);
          }
        } catch (error) {
          this.logger.debug(`Failed to parse ${testUrl}: ${error}`);
          // Continue to next path
        }
      }

      // Try to scrape the page and look for RSS links
      try {
        const scraped = await this.playwright.scrapePage(siteUrl);
        if (scraped && scraped.html) {
          // Parse HTML to find RSS links
          const rssLinkRegex = /<link[^>]+type=["'](?:application\/rss\+xml|application\/atom\+xml|text\/xml)["'][^>]+href=["']([^"']+)["']/gi;
          const matches = Array.from(scraped.html.matchAll(rssLinkRegex));
          
          if (matches.length > 0) {
            const rssUrl = new URL(matches[0][1], siteUrl).href;
            this.logger.log(`Found RSS feed via page scraping: ${rssUrl}`);
            return rssUrl;
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to scrape page for RSS links: ${error}`);
      }

      return null;
    } catch (error) {
      this.logger.error(`RSS discovery error: ${error}`);
      return null;
    }
  }

  async scrapeFeedFromHtml(feedId: string, siteUrl: string) {
    const lockKey = `feed-html-scrape:${feedId}`;
    const lockAcquired = await this.redis.acquireLock(lockKey, 300);

    if (!lockAcquired) {
      this.logger.debug(`HTML scraping already in progress: ${feedId}`);
      return;
    }

    try {
      this.logger.log(`Extracting articles from HTML for: ${siteUrl}`);
      
      const feed = await this.feedService.getFeedById(feedId);
      
      // Extract article links from the homepage
      this.logger.log(`Scraping article links from: ${siteUrl}`);
      const articleLinks = await this.playwright.scrapeArticleLinks(siteUrl);
      
      if (!articleLinks || articleLinks.length === 0) {
        this.logger.warn(`No article links found on: ${siteUrl}`);
        this.logger.warn(`This might be due to: 1) Site blocking scrapers, 2) JavaScript required, 3) Incorrect selectors`);
        await this.feedService.markFeedError(
          feedId,
          'No article links found on page - may need manual RSS URL or different selectors',
        );
        return;
      }

      this.logger.log(`Found ${articleLinks.length} article links, processing first 20...`);
      this.logger.debug(`Sample links: ${articleLinks.slice(0, 3).join(', ')}`);

      // Process first 20 articles (to be fast)
      const linksToProcess = articleLinks.slice(0, 20);
      let newItemsCount = 0;

      // Process articles in parallel (but limit concurrency)
      const batchSize = 5;
      for (let i = 0; i < linksToProcess.length; i += batchSize) {
        const batch = linksToProcess.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (articleUrl) => {
            try {
              // Check if item already exists
              const existing = await this.prisma.feedItem.findFirst({
                where: {
                  feedId: feed.id,
                  url: articleUrl,
                },
              });

              if (existing) {
                return; // Skip existing items
              }

              // Scrape article metadata
              const scraped = await this.playwright.scrapePage(articleUrl);
              
              if (!scraped || !scraped.title) {
                return; // Skip if no title
              }

              // Create feed item
              await this.feedItemService.createOrUpdate({
                feedId: feed.id,
                url: articleUrl,
                title: scraped.title,
                excerpt: scraped.excerpt,
                thumbnailUrl: scraped.thumbnailUrl,
                author: scraped.author,
                publishedAt: scraped.publishedAt || new Date(),
                canonicalUrl: scraped.canonicalUrl,
              });

              newItemsCount++;

              // Notify subscribers
              const subscriptions = await this.prisma.subscription.findMany({
                where: {
                  feedId: feed.id,
                  enabled: true,
                },
                include: {
                  user: {
                    select: {
                      id: true,
                      preferences: true,
                    },
                  },
                },
              });

              for (const subscription of subscriptions) {
                if (
                  subscription.user.preferences &&
                  (subscription.user.preferences as any).notificationsEnabled
                ) {
                  await this.pushService.sendToUser(
                    subscription.user.id,
                    {
                      title: feed.title || feed.siteDomain,
                      body: scraped.title,
                      data: {
                        type: 'feed_item',
                        feedId: feed.id,
                        itemUrl: articleUrl,
                      },
                    },
                  ).catch((err: any) => {
                    this.logger.error(`Failed to send notification: ${err}`);
                  });
                }
              }
            } catch (error) {
              this.logger.debug(`Failed to scrape article ${articleUrl}: ${error}`);
              // Continue with next article
            }
          })
        );

        // Small delay between batches
        if (i + batchSize < linksToProcess.length) {
          await this.delay(500);
        }
      }

      // Update feed status
      await this.feedService.updateFeed(feedId, {
        status: FeedStatus.active,
        title: feed.title || new URL(siteUrl).hostname,
      });

      // Update job status
      await this.prisma.jobLog.updateMany({
        where: {
          jobType: JobType.scrape_feed,
          target: feedId,
          status: JobStatus.running,
        },
        data: {
          status: JobStatus.completed,
          result: { newItemsCount, method: 'html_scraping' },
        },
      });

      this.logger.log(
        `HTML scraping completed for ${feedId}: ${newItemsCount} new items`,
      );
    } catch (error) {
      this.logger.error(`HTML scraping error: ${error}`);
      await this.feedService.markFeedError(feedId, String(error));
      await this.prisma.jobLog.updateMany({
        where: {
          jobType: JobType.scrape_feed,
          target: feedId,
          status: JobStatus.running,
        },
        data: {
          status: JobStatus.failed,
          lastError: String(error),
        },
      });
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

