import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface YouTubeChannelInfo {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  customUrl?: string;
}

export interface YouTubeVideoInfo {
  videoId: string;
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: Date;
  duration?: string;
  isLive?: boolean;
  liveBroadcastContent?: 'none' | 'upcoming' | 'live';
}

@Injectable()
export class YouTubeApiService {
  private readonly logger = new Logger(YouTubeApiService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://www.googleapis.com/youtube/v3';

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.apiKey = this.configService.get<string>('YOUTUBE_API_KEY', '');
    if (!this.apiKey) {
      this.logger.warn('YOUTUBE_API_KEY not configured');
    }
  }

  async searchChannel(query: string): Promise<YouTubeChannelInfo | null> {
    try {
      await this.trackApiCall('search.list', 100);

      const params = new URLSearchParams({
        part: 'snippet',
        q: query,
        type: 'channel',
        maxResults: '1',
        key: this.apiKey,
      });

      const response = await fetch(`${this.baseUrl}/search?${params}`);
      const data = await response.json();

      if (data.error) {
        this.logger.error(`YouTube API error: ${data.error.message}`);
        return null;
      }

      if (!data.items || data.items.length === 0) {
        return null;
      }

      const item = data.items[0];
      return {
        channelId: item.snippet.channelId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnailUrl: item.snippet.thumbnails?.default?.url || '',
      };
    } catch (error) {
      this.logger.error(`Failed to search channel: ${error}`);
      return null;
    }
  }

  async getChannelById(channelId: string): Promise<YouTubeChannelInfo | null> {
    try {
      await this.trackApiCall('channels.list', 1);

      const params = new URLSearchParams({
        part: 'snippet',
        id: channelId,
        key: this.apiKey,
      });

      const response = await fetch(`${this.baseUrl}/channels?${params}`);
      const data = await response.json();

      if (data.error || !data.items || data.items.length === 0) {
        return null;
      }

      const item = data.items[0];
      return {
        channelId: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnailUrl: item.snippet.thumbnails?.default?.url || '',
        customUrl: item.snippet.customUrl,
      };
    } catch (error) {
      this.logger.error(`Failed to get channel: ${error}`);
      return null;
    }
  }

  /**
   * Scrape channel info directly from YouTube page
   * This is the primary method for getting channel data without using API
   */
  async scrapeChannelInfo(handle: string): Promise<YouTubeChannelInfo | null> {
    const cleanHandle = handle.replace(/^@/, '');

    try {
      this.logger.log(`Scraping channel info for @${cleanHandle}...`);

      const response = await fetch(`https://www.youtube.com/@${cleanHandle}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!response.ok) {
        this.logger.warn(`Failed to fetch YouTube page for @${cleanHandle}: ${response.status}`);
        return null;
      }

      const html = await response.text();

      // Extract channelId - use patterns that are specific to the page OWNER
      // NOT from recommended videos or other content
      let channelId: string | null = null;

      // Pattern 1: Look for browseId in page metadata (most reliable)
      const browseIdMatch = html.match(/"browseId":"(UC[a-zA-Z0-9_-]{22})"/);

      // Pattern 2: Look for canonical link to channel
      const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})">/);

      // Pattern 3: Look for externalId in channel metadata
      const externalIdMatch = html.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/);

      // Pattern 4: Look for channel URL in the about/header section
      const channelUrlMatch = html.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);

      // Pattern 5: Look for RSS feed link with channel_id
      const rssMatch = html.match(/channel_id=(UC[a-zA-Z0-9_-]{22})/);

      // Use the first match found (ordered by reliability)
      if (canonicalMatch && canonicalMatch[1]) {
        channelId = canonicalMatch[1];
        this.logger.log(`Found channelId via canonical link: ${channelId}`);
      } else if (browseIdMatch && browseIdMatch[1]) {
        channelId = browseIdMatch[1];
        this.logger.log(`Found channelId via browseId: ${channelId}`);
      } else if (externalIdMatch && externalIdMatch[1]) {
        channelId = externalIdMatch[1];
        this.logger.log(`Found channelId via externalId: ${channelId}`);
      } else if (rssMatch && rssMatch[1]) {
        channelId = rssMatch[1];
        this.logger.log(`Found channelId via RSS link: ${channelId}`);
      } else if (channelUrlMatch && channelUrlMatch[1]) {
        channelId = channelUrlMatch[1];
        this.logger.log(`Found channelId via channel URL: ${channelId}`);
      }

      if (!channelId) {
        this.logger.warn(`Could not find channelId in page HTML for @${cleanHandle}`);
        return null;
      }

      // Extract title from og:title or page title
      let title = cleanHandle;
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].replace(/ - YouTube$/, '');
      } else {
        const pageTitleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (pageTitleMatch && pageTitleMatch[1]) {
          title = pageTitleMatch[1].replace(/ - YouTube$/, '');
        }
      }

      // Extract description from og:description
      let description = '';
      const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
      if (descMatch && descMatch[1]) {
        description = descMatch[1];
      }

      // Extract thumbnail from og:image
      let thumbnailUrl = '';
      const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
      if (thumbMatch && thumbMatch[1]) {
        thumbnailUrl = thumbMatch[1];
      }

      this.logger.log(`Successfully scraped channel: ${title} (${channelId})`);

      return {
        channelId,
        title,
        description,
        thumbnailUrl,
        customUrl: `@${cleanHandle}`,
      };
    } catch (error) {
      this.logger.error(`Failed to scrape channel page for @${cleanHandle}: ${error}`);
      return null;
    }
  }

  /**
   * Get channel by handle - tries API first, falls back to scraping
   */
  async getChannelByHandle(handle: string): Promise<YouTubeChannelInfo | null> {
    const cleanHandle = handle.replace(/^@/, '');

    // Try scraping first (more reliable for handles)
    const scrapedInfo = await this.scrapeChannelInfo(cleanHandle);
    if (scrapedInfo) {
      return scrapedInfo;
    }

    // Fallback to API if scraping fails
    try {
      if (!this.apiKey) {
        this.logger.warn('No API key configured and scraping failed');
        return null;
      }

      await this.trackApiCall('channels.list', 1);

      const params = new URLSearchParams({
        part: 'snippet',
        forHandle: cleanHandle,
        key: this.apiKey,
      });

      const response = await fetch(`${this.baseUrl}/channels?${params}`);
      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        return {
          channelId: item.id,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnailUrl: item.snippet.thumbnails?.default?.url || '',
          customUrl: item.snippet.customUrl,
        };
      }

      this.logger.warn(`Channel @${cleanHandle} not found via API or scraping`);
      return null;
    } catch (error) {
      this.logger.error(`Failed to get channel by handle: ${error}`);
      return null;
    }
  }

  async getRecentVideos(
    channelId: string,
    publishedAfter?: Date,
    maxResults: number = 10,
  ): Promise<YouTubeVideoInfo[]> {
    try {
      await this.trackApiCall('search.list', 100);

      const params = new URLSearchParams({
        part: 'snippet',
        channelId,
        order: 'date',
        type: 'video',
        maxResults: maxResults.toString(),
        key: this.apiKey,
      });

      if (publishedAfter) {
        params.set('publishedAfter', publishedAfter.toISOString());
      }

      const response = await fetch(`${this.baseUrl}/search?${params}`);
      const data = await response.json();

      if (data.error || !data.items) {
        return [];
      }

      return data.items.map((item: any) => {
        // Verificar se é live stream
        const liveBroadcastContent = item.snippet?.liveBroadcastContent || 'none';
        const isLive = liveBroadcastContent === 'live';

        return {
          videoId: item.id.videoId,
          channelId: item.snippet.channelId,
          title: item.snippet.title,
          description: this.truncateDescription(item.snippet.description),
          thumbnailUrl:
            item.snippet.thumbnails?.high?.url ||
            item.snippet.thumbnails?.default?.url ||
            '',
          publishedAt: new Date(item.snippet.publishedAt),
          isLive: isLive,
          liveBroadcastContent: liveBroadcastContent,
        };
      });
    } catch (error) {
      this.logger.error(`Failed to get recent videos: ${error}`);
      return [];
    }
  }

  async getVideoDetails(videoIds: string[]): Promise<YouTubeVideoInfo[]> {
    if (videoIds.length === 0) return [];

    try {
      await this.trackApiCall('videos.list', 1);

      const params = new URLSearchParams({
        part: 'snippet,contentDetails',
        id: videoIds.join(','),
        key: this.apiKey,
      });

      const response = await fetch(`${this.baseUrl}/videos?${params}`);
      const data = await response.json();

      if (data.error || !data.items) {
        return [];
      }

      return data.items.map((item: any) => {
        // Verificar se é live stream
        // liveBroadcastContent pode ser: 'none', 'upcoming', 'live'
        const liveBroadcastContent = item.snippet?.liveBroadcastContent || 'none';
        const isLive = liveBroadcastContent === 'live';

        return {
          videoId: item.id,
          channelId: item.snippet.channelId,
          title: item.snippet.title,
          description: this.truncateDescription(item.snippet.description),
          thumbnailUrl:
            item.snippet.thumbnails?.high?.url ||
            item.snippet.thumbnails?.default?.url ||
            '',
          publishedAt: new Date(item.snippet.publishedAt),
          duration: item.contentDetails?.duration,
          isLive: isLive,
          liveBroadcastContent: liveBroadcastContent,
        };
      });
    } catch (error) {
      this.logger.error(`Failed to get video details: ${error}`);
      return [];
    }
  }

  private truncateDescription(description?: string): string {
    if (!description) return '';
    // Limit to 500 characters (NO LLM summarization!)
    if (description.length > 500) {
      return description.slice(0, 497) + '...';
    }
    return description;
  }

  private async trackApiCall(endpoint: string, units: number) {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 1);

    try {
      await this.prisma.rateLimitLog.upsert({
        where: {
          service_periodStart: {
            service: `youtube:${endpoint}`,
            periodStart,
          },
        },
        update: {
          calls: { increment: units },
        },
        create: {
          service: `youtube:${endpoint}`,
          calls: units,
          periodStart,
          periodEnd,
          quota: 10000, // YouTube daily quota
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to track API call: ${error}`);
    }
  }

  async getQuotaUsage(): Promise<{ used: number; limit: number }> {
    const periodStart = new Date();
    periodStart.setHours(0, 0, 0, 0);

    const logs = await this.prisma.rateLimitLog.findMany({
      where: {
        service: { startsWith: 'youtube:' },
        periodStart,
      },
    });

    const used = logs.reduce((sum, log) => sum + log.calls, 0);

    return {
      used,
      limit: 10000,
    };
  }
}



