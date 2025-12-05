import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { YouTubeApiService, YouTubeChannelInfo, YouTubeVideoInfo } from './youtube-api.service';

@Injectable()
export class YouTubeService {
  private readonly logger = new Logger(YouTubeService.name);

  constructor(
    private prisma: PrismaService,
    private youtubeApi: YouTubeApiService,
  ) {}

  async resolveChannel(input: string): Promise<any> {
    let channelInfo: YouTubeChannelInfo | null = null;

    // Try to parse as YouTube URL
    const urlMatch = input.match(
      /(?:youtube\.com\/(?:channel\/|c\/|@|user\/)?|youtu\.be\/)([^\/\?\s]+)/,
    );

    if (urlMatch) {
      const identifier = urlMatch[1];

      // Check if it's a channel ID (starts with UC)
      if (identifier.startsWith('UC')) {
        channelInfo = await this.youtubeApi.getChannelById(identifier);
      } else {
        // Try as handle
        channelInfo = await this.youtubeApi.getChannelByHandle(identifier);
      }
    } else if (input.startsWith('@')) {
      // Handle format
      channelInfo = await this.youtubeApi.getChannelByHandle(input);
    } else if (input.startsWith('UC')) {
      // Direct channel ID
      channelInfo = await this.youtubeApi.getChannelById(input);
    } else {
      // Search by name
      channelInfo = await this.youtubeApi.searchChannel(input);
    }

    if (!channelInfo) {
      return null;
    }

    // Get or create channel in database
    return this.getOrCreateChannel(channelInfo);
  }

  async getOrCreateChannel(info: YouTubeChannelInfo) {
    let channel = await this.prisma.youTubeChannel.findUnique({
      where: { channelId: info.channelId },
    });

    if (channel) {
      return channel;
    }

    // Create new channel
    channel = await this.prisma.youTubeChannel.create({
      data: {
        channelId: info.channelId,
        title: info.title,
        description: info.description?.slice(0, 500),
        thumbnailUrl: info.thumbnailUrl,
        customUrl: info.customUrl,
        websubTopicUrl: `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${info.channelId}`,
      },
    });

    this.logger.log(`Created YouTube channel: ${info.title}`);

    return channel;
  }

  async getChannelById(id: string) {
    // Check if it's a custom YouTube feed (starts with "custom-")
    if (id.startsWith('custom-')) {
      const subscriptionId = id.replace('custom-', '');
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          feed: {
            select: {
              id: true,
              title: true,
              rssUrl: true,
              siteDomain: true,
            },
          },
        },
      });

      if (!subscription || !subscription.feed) {
        throw new NotFoundException('Custom YouTube feed not found');
      }

      // Return in channel-like format
      const slugMatch = subscription.feed.rssUrl?.match(/\/custom-youtube-feeds\/([^\/]+)\/rss\.xml/);
      return {
        id: id,
        channelId: slugMatch ? slugMatch[1] : 'unknown',
        title: subscription.feed.title || 'Custom YouTube Feed',
        thumbnailUrl: null,
        description: null,
        customUrl: null,
        websubTopicUrl: null,
        lastCheckedAt: subscription.createdAt,
        isCustomFeed: true,
      };
    }

    // Regular YouTube channel
    const channel = await this.prisma.youTubeChannel.findUnique({
      where: { id },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    return channel;
  }

  async getChannelByYouTubeId(channelId: string) {
    return this.prisma.youTubeChannel.findUnique({
      where: { channelId },
    });
  }

  async listChannels(userId: string, page: number = 1, limit: number = 20) {
    this.logger.log(`Listing channels for user ${userId}, page ${page}, limit ${limit}`);
    const skip = (page - 1) * limit;

    // Get regular YouTube channel subscriptions
    const [youtubeChannels, youtubeChannelsTotal] = await Promise.all([
      this.prisma.youTubeChannel.findMany({
        where: {
          subscriptions: {
            some: {
              userId,
              type: 'youtube',
              enabled: true,
            },
          },
        },
        orderBy: { lastCheckedAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { videos: true },
          },
        },
      }),
      this.prisma.youTubeChannel.count({
        where: {
          subscriptions: {
            some: {
              userId,
              type: 'youtube',
              enabled: true,
            },
          },
        },
      }),
    ]);

    // Get custom YouTube feed subscriptions (subscriptions of type 'site' that point to custom YouTube feeds)
    // Check both the target URL and the feed's rssUrl or siteDomain
    const customYouTubeSubscriptions = await this.prisma.subscription.findMany({
      where: {
        userId,
        type: 'site',
        enabled: true,
        OR: [
          // Target URL contains custom-youtube-feeds
          { target: { contains: '/custom-youtube-feeds/' } },
          // Or feed's rssUrl contains custom-youtube-feeds
          { feed: { rssUrl: { contains: '/custom-youtube-feeds/' } } },
          // Or feed's siteDomain is youtube.com (for feeds created from YouTube URLs)
          { feed: { siteDomain: 'www.youtube.com' } },
        ],
      },
      include: {
        feed: {
          select: {
            id: true,
            title: true,
            rssUrl: true,
            siteDomain: true,
          },
        },
      },
    });

    // Transform custom YouTube feeds into channel-like format
    const customYouTubeChannels = await Promise.all(
      customYouTubeSubscriptions.map(async (sub) => {
        // Extract slug from target URL or RSS URL
        let slug: string | null = null;
        const targetMatch = sub.target?.match(/\/custom-youtube-feeds\/([^\/]+)\/rss\.xml/);
        const rssMatch = sub.feed?.rssUrl?.match(/\/custom-youtube-feeds\/([^\/]+)\/rss\.xml/);
        slug = targetMatch ? targetMatch[1] : (rssMatch ? rssMatch[1] : null);
        
        // If no slug found, try to extract channel ID from YouTube RSS URL
        if (!slug && sub.feed?.rssUrl?.includes('youtube.com/feeds/videos.xml')) {
          const channelIdMatch = sub.feed.rssUrl.match(/channel_id=([^&]+)/);
          slug = channelIdMatch ? channelIdMatch[1] : 'youtube';
        }
        
        // Count feed items
        const videoCount = sub.feed?.id
          ? await this.prisma.feedItem.count({
              where: { feedId: sub.feed.id },
            })
          : 0;
        
        return {
          id: `custom-${sub.id}`, // Use subscription ID with prefix
          channelId: slug || 'unknown',
          title: sub.feed?.title || 'Custom YouTube Feed',
          thumbnailUrl: null,
          lastCheckedAt: sub.createdAt,
          isCustomFeed: true,
          subscriptionId: sub.id,
          feedId: sub.feed?.id,
          rssUrl: sub.feed?.rssUrl,
          _count: {
            videos: videoCount,
          },
        };
      })
    );

    // Combine both types of channels
    const allChannels = [...youtubeChannels, ...customYouTubeChannels];
    const total = youtubeChannelsTotal + customYouTubeChannels.length;
    
    this.logger.log(`Found ${youtubeChannelsTotal} regular channels and ${customYouTubeChannels.length} custom feeds for user ${userId}`);

    // Sort by lastCheckedAt or createdAt
    allChannels.sort((a, b) => {
      const dateA = a.lastCheckedAt ? new Date(a.lastCheckedAt).getTime() : 0;
      const dateB = b.lastCheckedAt ? new Date(b.lastCheckedAt).getTime() : 0;
      return dateB - dateA;
    });

    return {
      data: allChannels.slice(skip, skip + limit),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getChannelVideos(channelDbId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    // Check if it's a custom YouTube feed
    if (channelDbId.startsWith('custom-')) {
      const subscriptionId = channelDbId.replace('custom-', '');
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          feed: {
            select: {
              id: true,
              title: true,
              rssUrl: true,
            },
          },
        },
      });

      if (!subscription || !subscription.feed) {
        throw new NotFoundException('Custom YouTube feed not found');
      }

      // Get videos from FeedItem table
      const [feedItems, total] = await Promise.all([
        this.prisma.feedItem.findMany({
          where: { feedId: subscription.feed.id },
          orderBy: { publishedAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.feedItem.count({ where: { feedId: subscription.feed.id } }),
      ]);

      // Extract slug from RSS URL for channelId
      const slugMatch = subscription.feed.rssUrl?.match(/\/custom-youtube-feeds\/([^\/]+)\/rss\.xml/);
      const slug = slugMatch ? slugMatch[1] : 'unknown';

      // Transform FeedItem to video-like format
      const videos = feedItems.map((item) => {
        // Extract videoId from YouTube URL
        const videoIdMatch = item.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
        const videoId = videoIdMatch ? videoIdMatch[1] : item.id;

        return {
          id: item.id,
          videoId: videoId,
          title: item.title,
          description: item.excerpt,
          thumbnailUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          duration: null,
          publishedAt: item.publishedAt,
          fetchedAt: item.fetchedAt,
          url: item.url,
        };
      });

      return {
        channel: {
          id: channelDbId,
          channelId: slug,
          title: subscription.feed.title || 'Custom YouTube Feed',
          thumbnailUrl: null,
          isCustomFeed: true,
        },
        data: videos,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    // Regular YouTube channel
    const channel = await this.getChannelById(channelDbId);

    const [videos, total] = await Promise.all([
      this.prisma.youTubeVideo.findMany({
        where: { channelDbId: channel.id },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.youTubeVideo.count({ where: { channelDbId: channel.id } }),
    ]);

    return {
      channel: {
        id: channel.id,
        channelId: channel.channelId,
        title: channel.title,
        thumbnailUrl: channel.thumbnailUrl,
      },
      data: videos,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async saveVideos(channelDbId: string, videos: YouTubeVideoInfo[]) {
    const results = {
      created: 0,
      skipped: 0,
    };

    for (const video of videos) {
      try {
        const existing = await this.prisma.youTubeVideo.findUnique({
          where: { videoId: video.videoId },
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        await this.prisma.youTubeVideo.create({
          data: {
            videoId: video.videoId,
            channelDbId,
            title: video.title,
            description: video.description,
            thumbnailUrl: video.thumbnailUrl,
            duration: video.duration,
            publishedAt: video.publishedAt,
          },
        });

        results.created++;
      } catch (error) {
        this.logger.error(`Failed to save video ${video.videoId}: ${error}`);
        results.skipped++;
      }
    }

    // Update lastCheckedAt
    await this.prisma.youTubeChannel.update({
      where: { id: channelDbId },
      data: { lastCheckedAt: new Date() },
    });

    return results;
  }

  async fetchAndSaveNewVideos(channelDbId: string) {
    const channel = await this.getChannelById(channelDbId);

    // Get videos published after last check (or last 7 days if never checked)
    const publishedAfter = channel.lastCheckedAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const videos = await this.youtubeApi.getRecentVideos(
      channel.channelId,
      publishedAfter,
      20,
    );

    if (videos.length === 0) {
      await this.prisma.youTubeChannel.update({
        where: { id: channelDbId },
        data: { lastCheckedAt: new Date() },
      });
      return { created: 0, skipped: 0 };
    }

    return this.saveVideos(channelDbId, videos);
  }

  async getChannelsToCheck(limit: number = 10) {
    const staleTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

    return this.prisma.youTubeChannel.findMany({
      where: {
        OR: [
          { lastCheckedAt: null },
          { lastCheckedAt: { lt: staleTime } },
        ],
      },
      orderBy: { lastCheckedAt: 'asc' },
      take: limit,
    });
  }

  async getNewVideosSince(channelDbId: string, since: Date) {
    return this.prisma.youTubeVideo.findMany({
      where: {
        channelDbId,
        fetchedAt: { gt: since },
      },
      orderBy: { fetchedAt: 'desc' },
    });
  }
}



