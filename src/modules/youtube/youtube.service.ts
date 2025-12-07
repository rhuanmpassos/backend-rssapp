import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { YouTubeApiService, YouTubeChannelInfo, YouTubeVideoInfo } from './youtube-api.service';
import { RssParserService } from '../../scraper/rss-parser.service';
import { PlaywrightService } from '../../scraper/playwright.service';
import { YoutubeiService } from './youtubei.service';

// Video type classification
export type VideoType = 'video' | 'short' | 'vod' | 'live';

// Shorts threshold: videos under 90 seconds are likely shorts
const SHORTS_DURATION_THRESHOLD = 90;

/**
 * Classify video type based on duration, live status, and title patterns
 * @param duration Video duration in seconds (from youtubei.js)
 * @param isLive Is currently live
 * @param isLiveContent Was originally a live stream (VOD if not live)
 * @param title Video title for fallback pattern matching
 */
function classifyVideoType(
  duration: number | null,
  isLive: boolean,
  isLiveContent: boolean,
  title: string
): VideoType {
  // Currently live
  if (isLive) {
    return 'live';
  }

  // VOD: was originally a live stream but not currently live
  if (isLiveContent) {
    return 'vod';
  }

  // Short: duration under threshold (typically 90 seconds)
  if (duration !== null && duration > 0 && duration <= SHORTS_DURATION_THRESHOLD) {
    return 'short';
  }

  // Otherwise, it's a regular video
  return 'video';
}

@Injectable()
export class YouTubeService {
  private readonly logger = new Logger(YouTubeService.name);

  constructor(
    private prisma: PrismaService,
    private youtubeApi: YouTubeApiService,
    private rssParserService: RssParserService,
    private playwrightService: PlaywrightService,
    private youtubeiService: YoutubeiService,
  ) { }

  async resolveChannel(input: string): Promise<any> {
    let channelInfo: YouTubeChannelInfo | null = null;
    let wasExplicitIdentifier = false; // Track if input was a URL, handle, or channel ID

    // Try to parse as YouTube URL
    const urlMatch = input.match(
      /(?:youtube\.com\/(?:channel\/|c\/|@|user\/)?|youtu\.be\/)([^\/\?\s]+)/,
    );

    if (urlMatch) {
      const identifier = urlMatch[1];
      wasExplicitIdentifier = true;

      // Check if it's a channel ID (starts with UC)
      if (identifier.startsWith('UC')) {
        channelInfo = await this.youtubeApi.getChannelById(identifier);
      } else {
        // Try as handle
        channelInfo = await this.youtubeApi.getChannelByHandle(identifier);
      }
    } else if (input.startsWith('@')) {
      // Handle format
      wasExplicitIdentifier = true;
      channelInfo = await this.youtubeApi.getChannelByHandle(input);
    } else if (input.startsWith('UC')) {
      // Direct channel ID
      wasExplicitIdentifier = true;
      channelInfo = await this.youtubeApi.getChannelById(input);
    } else {
      // Search by name - only for plain text input (not URLs or handles)
      channelInfo = await this.youtubeApi.searchChannel(input);
    }

    // If we had an explicit identifier (URL/handle/channelId) but didn't find the channel,
    // DO NOT fall back to search - return null instead
    if (!channelInfo) {
      if (wasExplicitIdentifier) {
        this.logger.warn(`Could not resolve explicit channel identifier: ${input}`);
      }
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

      // Extract slug from RSS URL for channelId
      const slugMatch = subscription.feed.rssUrl?.match(/\/custom-youtube-feeds\/([^\/]+)\/rss\.xml/);
      const slug = slugMatch ? slugMatch[1] : 'unknown';

      // Get custom feed details (including channelName and channelId)
      const customFeed = await this.prisma.customYouTubeFeed.findUnique({
        where: { slug },
      });

      if (!customFeed?.channelId) {
        throw new NotFoundException('Custom YouTube feed channel ID not found');
      }

      const channelId = customFeed.channelId;

      // === DUAL-FEED APPROACH ===
      // UULF{baseId} = Regular videos only
      // UULV{baseId} = Lives and VODs only
      // This eliminates per-video youtubei.js calls for classification!
      const baseId = channelId.startsWith('UC') ? channelId.substring(2) : channelId;
      const videosRssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULF${baseId}`;
      const livesRssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULV${baseId}`;

      this.logger.log(`Fetching dual feeds for ${slug}: UULF and UULV`);

      // Fetch both RSS feeds and check for active live in parallel
      const [videosFeed, livesFeed, activeLiveVideoId] = await Promise.all([
        this.rssParserService.parseUrl(videosRssUrl).catch((e) => {
          this.logger.warn(`Failed to fetch UULF feed: ${e}`);
          return null;
        }),
        this.rssParserService.parseUrl(livesRssUrl).catch((e) => {
          this.logger.warn(`Failed to fetch UULV feed: ${e}`);
          return null;
        }),
        this.youtubeiService.getActiveLiveVideoId(channelId).catch((e) => {
          this.logger.warn(`Failed to check active live: ${e}`);
          return null;
        }),
      ]);

      // Helper to extract video ID from URL
      const extractVideoId = (url: string): string | null => {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
        return match ? match[1] : null;
      };

      // Helper to parse RSS item to video format
      const parseRssItem = (item: any, videoType: VideoType) => {
        const videoId = extractVideoId(item.url || '');
        if (!videoId) return null;

        return {
          id: `${videoType}-${videoId}`,
          videoId,
          title: item.title || 'Untitled',
          description: item.excerpt || '',
          thumbnailUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          duration: null,
          publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
          fetchedAt: new Date(),
          url: item.url || `https://www.youtube.com/watch?v=${videoId}`,
          isLive: false,
          videoType,
        };
      };

      // Parse UULF feed → Regular videos
      const regularVideos = (videosFeed?.items || [])
        .slice(0, 15)
        .map(item => parseRssItem(item, 'video'))
        .filter((v): v is NonNullable<typeof v> => v !== null);

      // Parse UULV feed → Lives/VODs
      const livesVods = (livesFeed?.items || [])
        .slice(0, 15)
        .map(item => parseRssItem(item, 'vod'))
        .filter((v): v is NonNullable<typeof v> => v !== null);

      // Mark active live
      if (activeLiveVideoId) {
        this.logger.log(`Active live found: ${activeLiveVideoId}`);
        for (const video of livesVods) {
          if (video.videoId === activeLiveVideoId) {
            video.isLive = true;
            video.videoType = 'live';
            video.id = `live-${video.videoId}`;
          }
        }
      }

      // Combine: lives/VODs first (active lives on top), then regular videos
      let allVideos = [...livesVods, ...regularVideos];

      // Remove duplicates (same video might appear in both feeds)
      const seenIds = new Set<string>();
      allVideos = allVideos.filter(v => {
        if (seenIds.has(v.videoId)) return false;
        seenIds.add(v.videoId);
        return true;
      });

      // Sort: lives first, then by publishedAt
      allVideos.sort((a, b) => {
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return dateB - dateA;
      });

      // Apply pagination
      const paginatedVideos = allVideos.slice(skip, skip + limit);
      const total = allVideos.length;

      // Log summary
      const videoCount = allVideos.filter(v => v.videoType === 'video').length;
      const vodCount = allVideos.filter(v => v.videoType === 'vod').length;
      const liveCount = allVideos.filter(v => v.videoType === 'live').length;
      this.logger.log(`Dual-feed result: ${videoCount} videos, ${vodCount} VODs, ${liveCount} lives`);

      // Use channelName from customFeed if available, otherwise use feed title
      const channelTitle = customFeed?.channelName || subscription.feed.title || 'Custom YouTube Feed';

      return {
        channel: {
          id: channelDbId,
          channelId: slug,
          title: channelTitle,
          thumbnailUrl: null,
          isCustomFeed: true,
        },
        data: paginatedVideos,
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

    // === DUAL-FEED APPROACH FOR REGULAR CHANNELS ===
    // Same logic as custom feeds: UULF for videos, UULV for lives/VODs
    const channelId = channel.channelId;
    const baseId = channelId.startsWith('UC') ? channelId.substring(2) : channelId;
    const videosRssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULF${baseId}`;
    const livesRssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULV${baseId}`;

    this.logger.log(`Fetching dual feeds for channel ${channel.title}: UULF and UULV`);

    // Fetch both RSS feeds and check for active live in parallel
    const [videosFeed, livesFeed, activeLiveVideoId] = await Promise.all([
      this.rssParserService.parseUrl(videosRssUrl).catch((e) => {
        this.logger.warn(`Failed to fetch UULF feed for ${channel.title}: ${e}`);
        return null;
      }),
      this.rssParserService.parseUrl(livesRssUrl).catch((e) => {
        this.logger.warn(`Failed to fetch UULV feed for ${channel.title}: ${e}`);
        return null;
      }),
      this.youtubeiService.getActiveLiveVideoId(channelId).catch((e) => {
        this.logger.warn(`Failed to check active live: ${e}`);
        return null;
      }),
    ]);

    // Helper to extract video ID from URL
    const extractVideoId = (url: string): string | null => {
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
      return match ? match[1] : null;
    };

    // Helper to parse RSS item to video format
    const parseRssItem = (item: any, videoType: VideoType) => {
      const videoId = extractVideoId(item.url || '');
      if (!videoId) return null;

      return {
        id: `${videoType}-${videoId}`,
        videoId,
        title: item.title || 'Untitled',
        description: item.excerpt || '',
        thumbnailUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: null,
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
        fetchedAt: new Date(),
        url: item.url || `https://www.youtube.com/watch?v=${videoId}`,
        isLive: false,
        videoType,
      };
    };

    // Parse UULF feed → Regular videos
    const regularVideos = (videosFeed?.items || [])
      .slice(0, 20)
      .map(item => parseRssItem(item, 'video'))
      .filter((v): v is NonNullable<typeof v> => v !== null);

    // Parse UULV feed → Lives/VODs
    const livesVods = (livesFeed?.items || [])
      .slice(0, 20)
      .map(item => parseRssItem(item, 'vod'))
      .filter((v): v is NonNullable<typeof v> => v !== null);

    // Mark active live
    if (activeLiveVideoId) {
      this.logger.log(`Active live found: ${activeLiveVideoId}`);
      for (const video of livesVods) {
        if (video.videoId === activeLiveVideoId) {
          video.isLive = true;
          video.videoType = 'live';
          video.id = `live-${video.videoId}`;
        }
      }
    }

    // Combine: lives/VODs first (active lives on top), then regular videos
    let allVideos = [...livesVods, ...regularVideos];

    // Remove duplicates (same video might appear in both feeds)
    const seenIds = new Set<string>();
    allVideos = allVideos.filter(v => {
      if (seenIds.has(v.videoId)) return false;
      seenIds.add(v.videoId);
      return true;
    });

    // Sort: lives first, then by publishedAt
    allVideos.sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return dateB - dateA;
    });

    // Apply pagination
    const paginatedVideos = allVideos.slice(skip, skip + limit);
    const total = allVideos.length;

    // Log summary
    const videoCount = allVideos.filter(v => v.videoType === 'video').length;
    const vodCount = allVideos.filter(v => v.videoType === 'vod').length;
    const liveCount = allVideos.filter(v => v.videoType === 'live').length;
    this.logger.log(`Dual-feed result for ${channel.title}: ${videoCount} videos, ${vodCount} VODs, ${liveCount} lives`);

    return {
      channel: {
        id: channel.id,
        channelId: channel.channelId,
        title: channel.title,
        thumbnailUrl: channel.thumbnailUrl,
      },
      data: paginatedVideos,
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

  /**
   * Fetch and save videos from YouTube RSS feed (NO API QUOTA USED)
   * Uses dual-feed approach: UULF for videos, UULV for lives/VODs
   */
  async fetchAndSaveVideosFromRss(channelDbId: string) {
    const channel = await this.getChannelById(channelDbId);
    const channelId = channel.channelId;

    // === DUAL-FEED APPROACH ===
    // UULF{baseId} = Regular videos only
    // UULV{baseId} = Lives and VODs only
    const baseId = channelId.startsWith('UC') ? channelId.substring(2) : channelId;
    const videosRssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULF${baseId}`;
    const livesRssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULV${baseId}`;

    this.logger.log(`Fetching dual RSS feeds for ${channel.title}`);

    try {
      // Fetch both feeds in parallel
      const [videosFeed, livesFeed] = await Promise.all([
        this.rssParserService.parseUrl(videosRssUrl).catch((e) => {
          this.logger.warn(`Failed to fetch UULF feed: ${e}`);
          return null;
        }),
        this.rssParserService.parseUrl(livesRssUrl).catch((e) => {
          this.logger.warn(`Failed to fetch UULV feed: ${e}`);
          return null;
        }),
      ]);

      const results = { created: 0, skipped: 0 };

      // Helper to extract video ID from URL
      const extractVideoId = (url: string): string | null => {
        const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
        return match ? match[1] : null;
      };

      // Process videos from UULF feed (regular videos)
      if (videosFeed?.items) {
        for (const item of videosFeed.items.slice(0, 15)) {
          try {
            const videoId = extractVideoId(item.url || '');
            if (!videoId) {
              results.skipped++;
              continue;
            }

            // Check if video already exists
            const existing = await this.prisma.youTubeVideo.findUnique({
              where: { videoId },
            });

            if (existing) {
              results.skipped++;
              continue;
            }

            // Create new video - type is 'video' because it's from UULF feed
            await this.prisma.youTubeVideo.create({
              data: {
                videoId,
                channelDbId,
                title: item.title || 'Untitled',
                description: item.excerpt?.slice(0, 500) || null,
                thumbnailUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                duration: null,
                publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
                // Classification from UULF = regular video
                videoType: 'video',
                isLive: false,
                isLiveContent: false,
                durationSecs: null,
                classifiedAt: new Date(),
              },
            });

            results.created++;
            this.logger.debug(`New video: ${videoId} → video (from UULF)`);
          } catch (error) {
            this.logger.error(`Failed to save video from RSS: ${error}`);
            results.skipped++;
          }
        }
      }

      // Process videos from UULV feed (lives/VODs)
      if (livesFeed?.items) {
        for (const item of livesFeed.items.slice(0, 15)) {
          try {
            const videoId = extractVideoId(item.url || '');
            if (!videoId) {
              results.skipped++;
              continue;
            }

            // Check if video already exists
            const existing = await this.prisma.youTubeVideo.findUnique({
              where: { videoId },
            });

            if (existing) {
              results.skipped++;
              continue;
            }

            // Create new video - type is 'vod' because it's from UULV feed
            // (will be marked as 'live' if currently live during getChannelVideos)
            await this.prisma.youTubeVideo.create({
              data: {
                videoId,
                channelDbId,
                title: item.title || 'Untitled',
                description: item.excerpt?.slice(0, 500) || null,
                thumbnailUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                duration: null,
                publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
                // Classification from UULV = VOD (will be updated to 'live' if streaming)
                videoType: 'vod',
                isLive: false,
                isLiveContent: true, // From UULV = was/is a live stream
                durationSecs: null,
                classifiedAt: new Date(),
              },
            });

            results.created++;
            this.logger.debug(`New video: ${videoId} → vod (from UULV)`);
          } catch (error) {
            this.logger.error(`Failed to save live/VOD from RSS: ${error}`);
            results.skipped++;
          }
        }
      }

      // Update lastCheckedAt
      await this.prisma.youTubeChannel.update({
        where: { id: channelDbId },
        data: { lastCheckedAt: new Date() },
      });

      this.logger.log(`Dual-feed RSS update for ${channel.title}: ${results.created} new, ${results.skipped} skipped`);
      return results;
    } catch (error) {
      this.logger.error(`Failed to fetch RSS feeds for ${channel.title}: ${error}`);
      return { created: 0, skipped: 0 };
    }
  }

  /**
   * Reclassify videos that need updating
   * - Lives that ended (need to become VODs)
   * - Videos without classification (legacy data)
   */
  async reclassifyVideos(limit: number = 50) {
    // Find videos that need reclassification:
    // 1. isLive = true (may have ended)
    // 2. classifiedAt is null (never classified)
    // 3. classifiedAt is older than 1 hour and isLive was true
    const videosToReclassify = await this.prisma.youTubeVideo.findMany({
      where: {
        OR: [
          { isLive: true }, // Active lives - check if still live
          { classifiedAt: null }, // Never classified
          { videoType: null }, // Missing classification
        ],
      },
      orderBy: { fetchedAt: 'desc' },
      take: limit,
    });

    if (videosToReclassify.length === 0) {
      return { updated: 0, unchanged: 0 };
    }

    this.logger.log(`Reclassifying ${videosToReclassify.length} videos`);

    let updated = 0;
    let unchanged = 0;

    for (const video of videosToReclassify) {
      try {
        const info = await this.youtubeiService.getVideoBasicInfo(video.videoId);

        if (!info) {
          unchanged++;
          continue;
        }

        // Classify
        let videoType = 'video';
        if (info.isLive) {
          videoType = 'live';
        } else if (info.isLiveContent) {
          videoType = 'vod';
        } else if (info.duration > 0 && info.duration <= 90) {
          videoType = 'short';
        }

        const durationSecs = info.duration > 0 ? info.duration : null;

        // Check if changed
        if (
          video.videoType === videoType &&
          video.isLive === info.isLive &&
          video.isLiveContent === info.isLiveContent
        ) {
          // Only update classifiedAt if nothing changed
          await this.prisma.youTubeVideo.update({
            where: { id: video.id },
            data: { classifiedAt: new Date() },
          });
          unchanged++;
        } else {
          // Update classification
          await this.prisma.youTubeVideo.update({
            where: { id: video.id },
            data: {
              videoType,
              isLive: info.isLive,
              isLiveContent: info.isLiveContent,
              durationSecs,
              classifiedAt: new Date(),
            },
          });
          this.logger.log(`Reclassified ${video.videoId}: ${video.videoType || 'null'} → ${videoType}`);
          updated++;
        }
      } catch (error) {
        this.logger.debug(`Failed to reclassify ${video.videoId}: ${error}`);
        unchanged++;
      }
    }

    this.logger.log(`Reclassification complete: ${updated} updated, ${unchanged} unchanged`);
    return { updated, unchanged };
  }
}



