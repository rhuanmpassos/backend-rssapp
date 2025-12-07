import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Innertube from 'youtubei.js';

@Injectable()
export class YoutubeiService implements OnModuleInit {
  private readonly logger = new Logger(YoutubeiService.name);
  private youtube: Innertube | null = null;

  async onModuleInit() {
    try {
      this.youtube = await Innertube.create();
      this.logger.log('Youtubei.js initialized successfully');
    } catch (error) {
      this.logger.warn(`Failed to initialize Youtubei.js: ${error}`);
    }
  }

  /**
   * Check if a channel has an active live stream
   * Returns the video ID of the active live or null if no live is active
   */
  async getActiveLiveVideoId(channelId: string): Promise<string | null> {
    if (!this.youtube) {
      this.logger.warn('Youtubei.js not initialized');
      return null;
    }

    try {
      this.logger.log(`Checking for active live on channel: ${channelId}`);

      // Get channel and its live streams tab
      const channel = await this.youtube.getChannel(channelId);

      // Get live streams from the channel
      const liveTab = await channel.getLiveStreams();

      if (!liveTab?.videos?.length) {
        this.logger.log(`No live streams found for channel ${channelId}`);
        return null;
      }

      // Check the first few videos for an active live
      for (const video of liveTab.videos.slice(0, 5)) {
        const videoId = (video as any).id;

        // Get detailed info about the video to check if it's actually live
        try {
          const videoInfo = await this.youtube.getInfo(videoId);
          const basicInfo = videoInfo.basic_info;

          this.logger.debug(`Video ${videoId}: is_live=${basicInfo?.is_live}, is_live_content=${basicInfo?.is_live_content}, duration=${basicInfo?.duration}`);

          // Check if video is currently live
          if (basicInfo?.is_live === true) {
            this.logger.log(`🔴 Active live found: ${videoId} - ${basicInfo?.title}`);
            return videoId;
          }

          // Alternative check: is_live_content true AND duration is 0 (still streaming)
          if (basicInfo?.is_live_content === true && (!basicInfo?.duration || basicInfo?.duration === 0)) {
            this.logger.log(`🔴 Active live found (no duration): ${videoId} - ${basicInfo?.title}`);
            return videoId;
          }
        } catch (videoError) {
          this.logger.warn(`Failed to get video info for ${videoId}: ${videoError}`);
        }
      }

      this.logger.log(`No active live found for channel ${channelId}`);
      return null;
    } catch (error) {
      this.logger.warn(`Error checking active live for channel ${channelId}: ${error}`);
      return null;
    }
  }

  /**
   * Get video info for a live stream
   * Returns title, description, and thumbnail
   */
  async getLiveVideoInfo(videoId: string): Promise<{ title: string; description: string; thumbnail: string } | null> {
    if (!this.youtube) {
      this.logger.warn('Youtubei.js not initialized');
      return null;
    }

    try {
      const videoInfo = await this.youtube.getInfo(videoId);
      const basicInfo = videoInfo.basic_info;

      return {
        title: basicInfo?.title || '🔴 Live',
        description: basicInfo?.short_description || '',
        thumbnail: (basicInfo?.thumbnail as any)?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      };
    } catch (error) {
      this.logger.warn(`Failed to get live video info for ${videoId}: ${error}`);
      return null;
    }
  }

  /**
   * Get detailed video type classification
   * Returns: 'video' | 'short' | 'vod' | 'live'
   */
  async getVideoType(videoId: string): Promise<'video' | 'short' | 'vod' | 'live' | null> {
    if (!this.youtube) {
      this.logger.warn('Youtubei.js not initialized');
      return null;
    }

    try {
      const videoInfo = await this.youtube.getInfo(videoId);
      const basicInfo = videoInfo.basic_info;

      // Currently live
      if (basicInfo?.is_live === true) {
        return 'live';
      }

      // VOD: was a live stream but is no longer live
      if (basicInfo?.is_live_content === true && basicInfo?.is_live === false) {
        return 'vod';
      }

      // Short: duration under 60 seconds (YouTube Shorts)
      const duration = basicInfo?.duration || 0;
      if (duration > 0 && duration <= 60) {
        return 'short';
      }

      // Regular video
      return 'video';
    } catch (error) {
      this.logger.warn(`Failed to get video type for ${videoId}: ${error}`);
      return null;
    }
  }

  /**
   * Get video type info for batch classification
   * Returns basic info needed to classify video type
   */
  async getVideoBasicInfo(videoId: string): Promise<{
    isLive: boolean;
    isLiveContent: boolean;
    duration: number;
    title: string;
  } | null> {
    if (!this.youtube) {
      return null;
    }

    try {
      const videoInfo = await this.youtube.getInfo(videoId);
      const basicInfo = videoInfo.basic_info;

      return {
        isLive: basicInfo?.is_live === true,
        isLiveContent: basicInfo?.is_live_content === true,
        duration: basicInfo?.duration || 0,
        title: basicInfo?.title || '',
      };
    } catch (error) {
      this.logger.debug(`Failed to get basic info for ${videoId}: ${error}`);
      return null;
    }
  }
}
