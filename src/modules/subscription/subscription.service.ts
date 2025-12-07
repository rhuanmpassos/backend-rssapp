import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeedService } from '../feed/feed.service';
import { YouTubeService } from '../youtube/youtube.service';
import { FolderService } from '../folder/folder.service';
import { CustomYouTubeFeedService } from '../custom-youtube-feed/custom-youtube-feed.service';
import { CreateSiteSubscriptionDto } from './dto/create-site-subscription.dto';
import { CreateYouTubeSubscriptionDto } from './dto/create-youtube-subscription.dto';
import { SubscriptionType, FeedStatus } from '@prisma/client';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private prisma: PrismaService,
    private feedService: FeedService,
    private youtubeService: YouTubeService,
    private folderService: FolderService,
    @Inject(forwardRef(() => CustomYouTubeFeedService))
    private customYouTubeFeedService: CustomYouTubeFeedService,
  ) { }

  async createSiteSubscription(userId: string, dto: CreateSiteSubscriptionDto) {
    this.logger.log(`Creating site subscription for user ${userId} with URL: ${dto.url}`);

    // Validate URL format
    let validUrl: URL;
    try {
      validUrl = new URL(dto.url);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    // Check if this is a direct YouTube channel URL (e.g., youtube.com/@handle or youtube.com/channel/UC...)
    const isYouTubeChannel = validUrl.hostname.includes('youtube.com') &&
      (validUrl.pathname.startsWith('/@') ||
        validUrl.pathname.startsWith('/channel/') ||
        validUrl.pathname.startsWith('/c/') ||
        validUrl.pathname.startsWith('/user/'));

    if (isYouTubeChannel) {
      this.logger.log(`Detected YouTube channel URL: ${dto.url}, creating custom feed...`);

      // Extract a slug from the URL (handle or channel ID)
      let slug: string;
      if (validUrl.pathname.startsWith('/@')) {
        slug = validUrl.pathname.substring(2).split('/')[0].toLowerCase();
      } else if (validUrl.pathname.startsWith('/channel/')) {
        slug = validUrl.pathname.split('/')[2].toLowerCase().substring(0, 20);
      } else if (validUrl.pathname.startsWith('/c/')) {
        slug = validUrl.pathname.split('/')[2].toLowerCase();
      } else if (validUrl.pathname.startsWith('/user/')) {
        slug = validUrl.pathname.split('/')[2].toLowerCase();
      } else {
        slug = `youtube-${Date.now()}`;
      }

      // Check if custom YouTube feed already exists
      let customYouTubeFeed = await this.prisma.customYouTubeFeed.findUnique({
        where: { slug },
      });

      if (!customYouTubeFeed) {
        // Create the custom YouTube feed automatically
        try {
          customYouTubeFeed = await this.customYouTubeFeedService.create({
            title: slug.charAt(0).toUpperCase() + slug.slice(1),
            slug,
            channelUrl: dto.url,
          });
          this.logger.log(`Created custom YouTube feed: ${slug}`);
        } catch (error: any) {
          // If slug already exists (race condition), try to find it
          if (error.message?.includes('already exists')) {
            customYouTubeFeed = await this.prisma.customYouTubeFeed.findUnique({
              where: { slug },
            });
          } else {
            throw error;
          }
        }
      }

      if (customYouTubeFeed) {
        // Redirect to use the custom feed RSS URL
        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        dto.url = `${baseUrl}/api/v1/custom-youtube-feeds/${customYouTubeFeed.slug}/rss.xml`;
        this.logger.log(`Redirecting subscription to custom feed RSS: ${dto.url}`);

        // Update validUrl with the new RSS URL
        validUrl = new URL(dto.url);
      }
    }

    // Check if this is a custom feed RSS URL (site or YouTube)
    const customFeedMatch = validUrl.pathname.match(/\/custom-feeds\/([^\/]+)\/rss\.xml$/);
    const customYouTubeFeedMatch = validUrl.pathname.match(/\/custom-youtube-feeds\/([^\/]+)\/rss\.xml$/);
    let folderId = dto.folderId;
    let targetUrl = validUrl.href;

    if (customFeedMatch) {
      // This is a custom feed RSS URL (site)
      const slug = customFeedMatch[1];
      const customFeed = await this.prisma.customFeed.findUnique({
        where: { slug },
        include: { category: true },
      });

      if (customFeed && customFeed.siteUrl) {
        // Use the siteUrl for the feed, but keep the RSS URL as target
        targetUrl = customFeed.siteUrl;

        // If custom feed has a category and no folder was provided, create/get folder
        if (customFeed.category && !folderId) {
          const categoryName = customFeed.category.name;
          const folder = await this.folderService.findOrCreateFolder(userId, categoryName);
          folderId = folder.id;
        }
      }
    } else if (customYouTubeFeedMatch) {
      // This is a custom YouTube feed RSS URL
      const slug = customYouTubeFeedMatch[1];
      const customYouTubeFeed = await this.prisma.customYouTubeFeed.findUnique({
        where: { slug },
        include: { category: true },
      });

      if (customYouTubeFeed && customYouTubeFeed.channelUrl) {
        // Use the channelUrl for the feed, but keep the RSS URL as target
        targetUrl = customYouTubeFeed.channelUrl;

        // If custom feed has a category and no folder was provided, create/get folder
        if (customYouTubeFeed.category && !folderId) {
          const categoryName = customYouTubeFeed.category.name;
          const folder = await this.folderService.findOrCreateFolder(userId, categoryName);
          folderId = folder.id;
        }
      }
    }

    // Check for existing subscription by target URL or RSS URL
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        type: SubscriptionType.site,
        OR: [
          { target: validUrl.href },
          { target: targetUrl },
        ],
      },
    });

    if (existingSubscription) {
      // If already subscribed, return existing subscription
      this.logger.log(`Subscription already exists for user ${userId}, returning existing: ${existingSubscription.id}`);
      return this.prisma.subscription.findUnique({
        where: { id: existingSubscription.id },
        include: {
          feed: true,
          folder: true,
        },
      });
    }

    // Check if feed already exists by URL or RSS URL (correlate with existing feed)
    let feed = await this.prisma.feed.findFirst({
      where: {
        OR: [
          { url: validUrl.href },
          { url: targetUrl },
          { rssUrl: validUrl.href },
        ],
      },
    });

    if (!feed) {
      // For custom YouTube feeds, create feed with RSS URL directly
      if (customYouTubeFeedMatch) {
        const slug = customYouTubeFeedMatch[1];
        const customYouTubeFeedForTitle = await this.prisma.customYouTubeFeed.findUnique({
          where: { slug },
          select: { title: true },
        });

        const domain = new URL(validUrl.href).hostname;
        feed = await this.prisma.feed.create({
          data: {
            url: targetUrl, // Use channelUrl as base URL
            rssUrl: validUrl.href, // Save the custom RSS URL
            siteDomain: domain,
            status: FeedStatus.pending,
            title: `YouTube: ${customYouTubeFeedForTitle?.title || 'Custom Feed'}`,
          },
        });
        this.logger.log(`Created feed for custom YouTube feed with RSS URL: ${validUrl.href}`);

        // Mark as active and trigger scrape - the scraper will detect rssUrl and use it directly
        await this.prisma.feed.update({
          where: { id: feed.id },
          data: { status: FeedStatus.active },
        });

        // Queue feed discovery - the scraper will see rssUrl exists and use it directly
        this.feedService.queueFeedDiscovery(feed.id).catch((err) => {
          this.logger.error(`Failed to queue feed discovery: ${err.message}`);
        });
      } else {
        // Get or create the feed normally
        feed = await this.feedService.getOrCreateFeed(targetUrl);
      }
    } else {
      // If feed exists but doesn't have rssUrl for custom YouTube feed, update it
      if (customYouTubeFeedMatch && !feed.rssUrl) {
        feed = await this.prisma.feed.update({
          where: { id: feed.id },
          data: { rssUrl: validUrl.href },
        });
        this.logger.log(`Updated feed ${feed.id} with custom YouTube RSS URL: ${validUrl.href}`);
      } else {
        this.logger.log(`Correlated subscription with existing feed: ${feed.id}`);
      }
    }

    // Validate folder if provided
    if (folderId) {
      const folder = await this.prisma.folder.findFirst({
        where: {
          id: folderId,
          userId,
        },
      });

      if (!folder) {
        throw new BadRequestException('Folder not found');
      }
    }

    // Create subscription
    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        type: SubscriptionType.site,
        target: validUrl.href, // Keep original URL (RSS or site)
        feedId: feed.id,
        folderId: folderId,
      },
      include: {
        feed: true,
        folder: true,
      },
    });

    this.logger.log(`User ${userId} subscribed to site: ${validUrl.href}`);

    // If feed is new (status pending), ensure discovery is triggered immediately
    if (feed.status === 'pending') {
      this.logger.log(`Feed ${feed.id} is pending, discovery should be queued automatically`);
    }

    return subscription;
  }

  async createYouTubeSubscription(
    userId: string,
    dto: CreateYouTubeSubscriptionDto,
  ) {
    // Resolve channel (from URL, handle, or search)
    const channel = await this.youtubeService.resolveChannel(
      dto.channelNameOrUrl,
    );

    if (!channel) {
      throw new NotFoundException('YouTube channel not found');
    }

    // Check for existing subscription
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        type: SubscriptionType.youtube,
        target: channel.channelId,
      },
    });

    if (existingSubscription) {
      throw new BadRequestException(
        'You are already subscribed to this channel',
      );
    }

    // Create subscription
    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        type: SubscriptionType.youtube,
        target: channel.channelId,
        channelId: channel.id,
      },
      include: {
        channel: true,
      },
    });

    this.logger.log(
      `User ${userId} subscribed to YouTube channel: ${channel.title}`,
    );

    return subscription;
  }

  async getUserSubscriptions(
    userId: string,
    page: number = 1,
    limit: number = 20,
    type?: 'site' | 'youtube',
  ) {
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (type) {
      where.type = type;

      // If filtering by 'site', exclude YouTube channel subscriptions
      // (subscriptions that target custom-youtube-feeds or have youtube.com as siteDomain)
      if (type === 'site') {
        where.AND = [
          {
            NOT: {
              target: { contains: '/custom-youtube-feeds/' },
            },
          },
          {
            OR: [
              { feed: null },
              { feed: { siteDomain: { not: 'www.youtube.com' } } },
            ],
          },
        ];
      }
    }

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        include: {
          feed: {
            select: {
              id: true,
              title: true,
              siteDomain: true,
              faviconUrl: true,
              status: true,
            },
          },
          channel: {
            select: {
              id: true,
              title: true,
              thumbnailUrl: true,
              channelId: true,
            },
          },
          folder: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      data: subscriptions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSubscriptionById(userId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId,
      },
      include: {
        feed: true,
        channel: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async deleteSubscription(userId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    await this.prisma.subscription.delete({
      where: { id: subscriptionId },
    });

    this.logger.log(`User ${userId} unsubscribed from: ${subscription.target}`);

    return { message: 'Subscription deleted successfully' };
  }

  async toggleSubscription(userId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { enabled: !subscription.enabled },
    });

    return updated;
  }
}
