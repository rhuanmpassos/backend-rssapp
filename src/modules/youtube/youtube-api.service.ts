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

  async getChannelByHandle(handle: string): Promise<YouTubeChannelInfo | null> {
    // Remove @ if present
    const cleanHandle = handle.replace(/^@/, '');

    try {
      await this.trackApiCall('channels.list', 1);

      const params = new URLSearchParams({
        part: 'snippet',
        forHandle: cleanHandle,
        key: this.apiKey,
      });

      const response = await fetch(`${this.baseUrl}/channels?${params}`);
      const data = await response.json();

      if (data.error || !data.items || data.items.length === 0) {
        // Fallback to search
        return this.searchChannel(cleanHandle);
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



