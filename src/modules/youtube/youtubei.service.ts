import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Innertube from 'youtubei.js';

@Injectable()
export class YoutubeiService implements OnModuleInit {
  private readonly logger = new Logger(YoutubeiService.name);
  private youtube: Innertube | null = null;

  async onModuleInit() {
    try {
      // Create Innertube without proxy (dual-feed approach doesn't need it)
      this.youtube = await Innertube.create({
        generate_session_locally: true,
        retrieve_player: false, // Disabled since we use RSS feeds for classification
      });

      this.logger.log('Youtubei.js initialized successfully (no proxy)');
    } catch (error: any) {
      this.logger.warn(`Failed to initialize Youtubei.js: ${error?.message || error}`);
      if (error?.cause) {
        this.logger.warn(`Cause: ${error.cause?.message || error.cause}`);
      }
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

          // Fallback: if Youtubei.js returns undefined, try HTTP
          if (basicInfo?.is_live === undefined && basicInfo?.is_live_content === undefined) {
            this.logger.debug(`Youtubei.js returned undefined for ${videoId}, trying HTTP fallback in getActiveLiveVideoId`);
            const httpResult = await this.checkIsLiveViaHttp(videoId);
            if (httpResult?.isLive) {
              this.logger.log(`🔴 Active live found via HTTP fallback: ${videoId}`);
              return videoId;
            }
          }
        } catch (videoError) {
          this.logger.warn(`Failed to get video info for ${videoId}: ${videoError}`);
        }
      }

      this.logger.log(`No active live found for channel ${channelId}`);
      return null;
    } catch (error) {
      // If getLiveStreams() fails (Tab "streams" not found), try fetching the channel's /live page
      const errorMsg = String(error);
      if (errorMsg.includes('Tab') && errorMsg.includes('not found')) {
        this.logger.debug(`getLiveStreams failed for channel ${channelId}, trying /live page fallback`);
        return this.getActiveLiveViaChannelLivePage(channelId);
      }

      this.logger.warn(`Error checking active live for channel ${channelId}: ${error}`);
      return null;
    }
  }

  /**
   * Fallback: Check for active live by fetching the channel's /live page
   * This works when the channel doesn't have a "streams" tab
   */
  private async getActiveLiveViaChannelLivePage(channelId: string): Promise<string | null> {
    try {
      const liveUrl = `https://www.youtube.com/channel/${channelId}/live`;
      this.logger.log(`Checking /live page for channel: ${channelId}`);

      const response = await fetch(liveUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        return null;
      }

      const html = await response.text();

      // Check if there's an active live and extract video ID
      const isLive = html.includes('"isLive":true') || html.includes('"isLiveNow":true');

      if (isLive) {
        // Try to extract video ID from the page
        const videoIdMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        if (videoIdMatch) {
          const videoId = videoIdMatch[1];
          this.logger.log(`🔴 Active live found via /live page: ${videoId}`);
          return videoId;
        }
      }

      return null;
    } catch (error) {
      this.logger.debug(`Failed to check /live page for channel ${channelId}: ${error}`);
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
   * Fallback method: check video info by fetching the video page directly
   * This works even when Youtubei.js returns undefined (common in datacenters)
   * Returns isLive, isLiveContent, and duration
   */
  private async checkIsLiveViaHttp(videoId: string): Promise<{ isLive: boolean; isLiveContent: boolean; duration: number } | null> {
    try {
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!response.ok) {
        return null;
      }

      const html = await response.text();

      // === PADRÕES IDENTIFICADOS POR TESTES ===
      // LIVE: isLive:true OU isLiveNow:true (duration = 0)
      // VOD: isLiveContent:true (com duration > 0)
      // VIDEO: isLiveContent:false + duration > 90s
      // SHORT: isLiveContent:false + duration <= 90s

      // Check for live indicators
      const isLive = html.includes('"isLive":true') ||
        html.includes('"isLiveNow":true');

      // Check if it's a VOD (recorded live stream)
      // isLiveContent:true is the definitive indicator
      const isLiveContent = html.includes('"isLiveContent":true');

      // Extract duration from the page
      let duration = 0;
      const lengthSecondsMatch = html.match(/"lengthSeconds":"(\d+)"/);
      if (lengthSecondsMatch) {
        duration = parseInt(lengthSecondsMatch[1], 10);
      } else {
        // Try approxDurationMs as fallback
        const durationMsMatch = html.match(/"approxDurationMs":"(\d+)"/);
        if (durationMsMatch) {
          duration = Math.floor(parseInt(durationMsMatch[1], 10) / 1000);
        }
      }

      // Log classification result
      if (isLive) {
        this.logger.log(`🔴 HTTP fallback: LIVE - ${videoId}`);
      } else if (isLiveContent) {
        this.logger.log(`📼 HTTP fallback: VOD - ${videoId}, duration: ${duration}s`);
      } else if (duration > 0 && duration <= 90) {
        this.logger.debug(`📱 HTTP fallback: SHORT - ${videoId}, duration: ${duration}s`);
      } else if (duration > 90) {
        this.logger.debug(`🎬 HTTP fallback: VIDEO - ${videoId}, duration: ${duration}s`);
      }

      return { isLive, isLiveContent, duration };
    } catch (error) {
      this.logger.debug(`HTTP fallback check failed for ${videoId}: ${error}`);
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

      let isLive = basicInfo?.is_live === true;
      let isLiveContent = basicInfo?.is_live_content === true;
      let duration = basicInfo?.duration || 0;

      // If Youtubei.js returns undefined for live fields (common in datacenters),
      // use HTTP fallback to check
      if (basicInfo?.is_live === undefined && basicInfo?.is_live_content === undefined) {
        this.logger.debug(`Youtubei.js returned undefined for live fields on ${videoId}, trying HTTP fallback`);
        const httpResult = await this.checkIsLiveViaHttp(videoId);
        if (httpResult) {
          isLive = httpResult.isLive;
          isLiveContent = httpResult.isLiveContent;
          // Also use duration from HTTP fallback if Youtubei.js returned 0
          if (duration === 0 && httpResult.duration > 0) {
            duration = httpResult.duration;
          }
        }
      }

      return {
        isLive,
        isLiveContent,
        duration,
        title: basicInfo?.title || '',
      };
    } catch (error) {
      this.logger.debug(`Failed to get basic info for ${videoId}: ${error}`);
      return null;
    }
  }
}

