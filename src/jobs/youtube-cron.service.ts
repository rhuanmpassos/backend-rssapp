import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { YouTubeService } from '../modules/youtube/youtube.service';
import { YouTubeApiService } from '../modules/youtube/youtube-api.service';
import { PushService } from '../modules/push/push.service';

@Injectable()
export class YouTubeCronService {
  private readonly logger = new Logger(YouTubeCronService.name);
  private readonly intervalMinutes: number;
  private isRunning = false;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private configService: ConfigService,
    private youtubeService: YouTubeService,
    private youtubeApi: YouTubeApiService,
    private pushService: PushService,
  ) {
    this.intervalMinutes = this.configService.get<number>(
      'CRON_YOUTUBE_INTERVAL_MINUTES',
      5,
    );
  }

  // Run every 5 minutes by default (fallback polling when WebSub not working)
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleYouTubePolling() {
    if (this.isRunning) {
      this.logger.debug('YouTube polling job already running, skipping');
      return;
    }

    // Check quota before proceeding
    const quota = await this.youtubeApi.getQuotaUsage();
    if (quota.used > quota.limit * 0.9) {
      this.logger.warn('YouTube API quota near limit, skipping polling');
      return;
    }

    // Acquire global lock
    const hasLock = await this.redis.acquireLock('cron:youtube-polling', 300);
    if (!hasLock) {
      this.logger.debug('Another instance is running YouTube polling');
      return;
    }

    this.isRunning = true;

    try {
      this.logger.log('Starting scheduled YouTube polling');

      // Get channels that need checking
      // Prioritize channels without active WebSub
      const channels = await this.youtubeService.getChannelsToCheck(5);

      this.logger.log(`Found ${channels.length} channels to check`);

      for (const channel of channels) {
        try {
          // Skip if WebSub is active and not expired
          if (
            channel.websubExpiresAt &&
            channel.websubExpiresAt > new Date()
          ) {
            this.logger.debug(
              `Skipping ${channel.title} - WebSub active until ${channel.websubExpiresAt}`,
            );
            continue;
          }

          const result = await this.youtubeService.fetchAndSaveNewVideos(
            channel.id,
          );

          if (result.created > 0) {
            this.logger.log(
              `Found ${result.created} new videos for ${channel.title}`,
            );

            // Get the new videos for notifications
            const newVideos = await this.youtubeService.getNewVideosSince(
              channel.id,
              new Date(Date.now() - 10 * 60 * 1000), // Last 10 minutes
            );

            for (const video of newVideos.slice(0, 3)) {
              await this.pushService.notifyNewVideo(
                channel.id,
                channel.title,
                video.title,
                video.videoId,
              );
            }
          }

          // Small delay between channels to avoid rate limiting
          await this.delay(2000);
        } catch (error) {
          this.logger.error(
            `Error checking channel ${channel.title}: ${error}`,
          );
        }
      }

      this.logger.log('Finished scheduled YouTube polling');
    } catch (error) {
      this.logger.error(`YouTube cron job error: ${error}`);
    } finally {
      this.isRunning = false;
      await this.redis.releaseLock('cron:youtube-polling');
    }
  }

  // Check quota usage daily
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleQuotaReset() {
    try {
      this.logger.log('Daily quota check');
      
      const quota = await this.youtubeApi.getQuotaUsage();
      this.logger.log(
        `YouTube API quota: ${quota.used}/${quota.limit} (${((quota.used / quota.limit) * 100).toFixed(1)}%)`,
      );

      // Log warning if quota was high
      if (quota.used > quota.limit * 0.8) {
        this.logger.warn(
          `High YouTube API quota usage yesterday: ${quota.used}/${quota.limit}`,
        );
      }
    } catch (error) {
      this.logger.error(`Quota check error: ${error}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}



