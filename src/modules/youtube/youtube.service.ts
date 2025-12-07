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

      // Get custom feed details (including channelName)
      const customFeed = await this.prisma.customYouTubeFeed.findUnique({
        where: { slug },
      });

      // Get active live video ID by checking /channel/ID/live page
      let activeLiveVideoId: string | null = null;
      try {
        if (customFeed?.channelId) {
          this.logger.log(`Checking for active live on custom feed ${slug} (channel: ${customFeed.channelId})`);
          activeLiveVideoId = await this.youtubeiService.getActiveLiveVideoId(customFeed.channelId);

          if (activeLiveVideoId) {
            this.logger.log(`Active live found for custom feed ${slug}: ${activeLiveVideoId}`);
          }
        }
      } catch (e) {
        this.logger.warn(`Failed to check active live for custom feed ${slug}: ${e}`);
      }

      // Transform FeedItem to video-like format
      // First, get basic info for all videos using youtubei.js (for accurate classification)
      const videoInfoPromises = feedItems.slice(0, 15).map(async (item) => {
        const videoIdMatch = item.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
        const videoId = videoIdMatch ? videoIdMatch[1] : null;
        if (!videoId) return null;

        // Get video info from youtubei.js
        const info = await this.youtubeiService.getVideoBasicInfo(videoId);
        return { item, videoId, info };
      });

      const videoInfoResults = await Promise.all(videoInfoPromises);

      let videos = videoInfoResults
        .filter((result): result is NonNullable<typeof result> => result !== null)
        .map((result) => {
          const { item, videoId, info } = result;
          const isLive = activeLiveVideoId === videoId || (info?.isLive ?? false);
          const isLiveContent = info?.isLiveContent ?? false;
          const duration = info?.duration ?? null;
          const videoType = classifyVideoType(duration, isLive, isLiveContent, item.title);

          return {
            id: item.id,
            videoId: videoId,
            title: item.title,
            description: item.excerpt,
            thumbnailUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            duration: duration,
            publishedAt: item.publishedAt,
            fetchedAt: item.fetchedAt,
            url: item.url,
            isLive,
            videoType,
          };
        });

      // Debug: log all video IDs in feed
      this.logger.log(`Feed has ${videos.length} videos. Active live: ${activeLiveVideoId}`);
      this.logger.log(`Video IDs in feed: ${videos.slice(0, 5).map(v => v.videoId).join(', ')}`);
      const liveInFeed = videos.find(v => v.videoId === activeLiveVideoId);
      this.logger.log(`Live video in feed? ${liveInFeed ? 'YES - isLive: ' + liveInFeed.isLive : 'NO'}`);

      // If there's an active live that's not in the feed, add it dynamically at the top
      if (activeLiveVideoId && !videos.some(v => v.videoId === activeLiveVideoId)) {
        this.logger.log(`Active live ${activeLiveVideoId} not in feed, adding dynamically`);

        // Get live video info from youtubei.js
        const liveInfo = await this.youtubeiService.getLiveVideoInfo(activeLiveVideoId);
        if (liveInfo) {
          videos = [
            {
              id: `live-${activeLiveVideoId}`,
              videoId: activeLiveVideoId,
              title: liveInfo.title || '🔴 Live agora',
              description: liveInfo.description || '',
              thumbnailUrl: liveInfo.thumbnail || `https://i.ytimg.com/vi/${activeLiveVideoId}/hqdefault.jpg`,
              duration: null,
              publishedAt: new Date(),
              fetchedAt: new Date(),
              url: `https://www.youtube.com/watch?v=${activeLiveVideoId}`,
              isLive: true,
              videoType: 'live' as VideoType,
            },
            ...videos,
          ];
        }
      }

      // Sort videos: lives first, then by publishedAt
      videos.sort((a, b) => {
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return dateB - dateA;
      });

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

    // Get active live video ID using youtubei.js
    let activeLiveVideoId: string | null = null;
    try {
      if (channel.channelId) {
        this.logger.log(`Checking for active live on channel: ${channel.channelId}`);
        activeLiveVideoId = await this.youtubeiService.getActiveLiveVideoId(channel.channelId);

        if (activeLiveVideoId) {
          this.logger.log(`Active live found: ${activeLiveVideoId}`);
        } else {
          this.logger.log(`No active live detected for channel ${channel.title}`);
        }
      }
    } catch (e) {
      this.logger.warn(`Failed to check active live for channel ${channel.channelId}: ${e}`);
    }

    // Add isLive and videoType fields to videos using youtubei.js
    this.logger.log(`Active live videoId: ${activeLiveVideoId}, checking ${videos.length} videos for type`);

    // Get video info from youtubei.js for classification
    const videoInfoPromises = videos.slice(0, 20).map(async (video) => {
      const info = await this.youtubeiService.getVideoBasicInfo(video.videoId);
      return { video, info };
    });

    const videoInfoResults = await Promise.all(videoInfoPromises);

    const videosWithType = videoInfoResults.map(({ video, info }) => {
      const isLive = activeLiveVideoId === video.videoId || (info?.isLive ?? false);
      const isLiveContent = info?.isLiveContent ?? false;
      const duration = info?.duration ?? null;
      const videoType = classifyVideoType(duration, isLive, isLiveContent, video.title);
      return {
        ...video,
        isLive,
        videoType,
        duration,
      };
    });

    const liveCount = videosWithType.filter(v => v.isLive).length;
    this.logger.log(`Videos marked as live: ${liveCount}`);

    return {
      channel: {
        id: channel.id,
        channelId: channel.channelId,
        title: channel.title,
        thumbnailUrl: channel.thumbnailUrl,
      },
      data: videosWithType,
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
   * Uses the public XML feed: https://www.youtube.com/feeds/videos.xml?channel_id=...
   */
  async fetchAndSaveVideosFromRss(channelDbId: string) {
    const channel = await this.getChannelById(channelDbId);
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`;

    this.logger.log(`Fetching RSS feed for ${channel.title}: ${rssUrl}`);

    try {
      const parsed = await this.rssParserService.parseUrl(rssUrl);

      if (!parsed || !parsed.items || parsed.items.length === 0) {
        this.logger.log(`No items in RSS feed for ${channel.title}`);
        await this.prisma.youTubeChannel.update({
          where: { id: channelDbId },
          data: { lastCheckedAt: new Date() },
        });
        return { created: 0, skipped: 0 };
      }

      const results = { created: 0, skipped: 0 };

      for (const item of parsed.items.slice(0, 15)) {
        try {
          // Extract videoId from URL
          const videoIdMatch = item.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
          const videoId = videoIdMatch ? videoIdMatch[1] : null;

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

          // Get video classification info
          const videoInfo = await this.youtubeiService.getVideoBasicInfo(videoId);

          let isLive = false;
          let isLiveContent = false;
          let durationSecs: number | null = null;
          let videoType: string = 'video';

          if (videoInfo) {
            isLive = videoInfo.isLive;
            isLiveContent = videoInfo.isLiveContent;
            durationSecs = videoInfo.duration > 0 ? videoInfo.duration : null;

            // Classify video type
            if (isLive) {
              videoType = 'live';
            } else if (isLiveContent) {
              videoType = 'vod';
            } else if (durationSecs && durationSecs <= 90) {
              videoType = 'short';
            } else {
              videoType = 'video';
            }
          }

          // Create new video with classification
          await this.prisma.youTubeVideo.create({
            data: {
              videoId,
              channelDbId,
              title: item.title || 'Untitled',
              description: item.excerpt?.slice(0, 500) || null,
              thumbnailUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              duration: null,
              publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
              // Classification fields
              videoType,
              isLive,
              isLiveContent,
              durationSecs,
              classifiedAt: new Date(),
            },
          });

          results.created++;
          this.logger.debug(`New video: ${videoId} → ${videoType}`);
        } catch (error) {
          this.logger.error(`Failed to save video from RSS: ${error}`);
          results.skipped++;
        }
      }

      // Update lastCheckedAt
      await this.prisma.youTubeChannel.update({
        where: { id: channelDbId },
        data: { lastCheckedAt: new Date() },
      });

      this.logger.log(`RSS update for ${channel.title}: ${results.created} new, ${results.skipped} skipped`);
      return results;
    } catch (error) {
      this.logger.error(`Failed to fetch RSS feed for ${channel.title}: ${error}`);
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



