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
  private readonly batchSize: number;
  private readonly concurrency: number;
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
    // New: configurable batch size and concurrency
    this.batchSize = this.configService.get<number>('CRON_YOUTUBE_BATCH_SIZE', 30);
    this.concurrency = this.configService.get<number>('CRON_YOUTUBE_CONCURRENCY', 6);
  }

  // Run every 3 minutes for faster updates
  @Cron('*/3 * * * *')
  async handleYouTubePolling() {
    if (this.isRunning) {
      this.logger.debug('YouTube polling job already running, skipping');
      return;
    }

    // Acquire global lock with longer timeout for parallel processing
    const hasLock = await this.redis.acquireLock('cron:youtube-polling', 600);
    if (!hasLock) {
      this.logger.debug('Another instance is running YouTube polling');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log(`Starting scheduled YouTube polling (batch: ${this.batchSize}, concurrency: ${this.concurrency})`);

      // Get channels that need checking
      const channels = await this.youtubeService.getChannelsToCheck(this.batchSize);

      this.logger.log(`Found ${channels.length} channels to check`);

      // Filter out channels with active WebSub
      const channelsToProcess = channels.filter((channel) => {
        if (channel.websubExpiresAt && channel.websubExpiresAt > new Date()) {
          this.logger.debug(
            `Skipping ${channel.title} - WebSub active until ${channel.websubExpiresAt}`,
          );
          return false;
        }
        return true;
      });

      this.logger.log(`Processing ${channelsToProcess.length} channels (${channels.length - channelsToProcess.length} skipped due to WebSub)`);

      // Process channels in parallel with concurrency limit
      await this.processInBatches(
        channelsToProcess,
        this.concurrency,
        async (channel) => {
          try {
            // Use RSS-based method (NO API QUOTA)
            const result = await this.youtubeService.fetchAndSaveVideosFromRss(
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

              // Send notifications in parallel (max 3)
              await Promise.all(
                newVideos.slice(0, 3).map((video) =>
                  this.pushService.notifyNewVideo(
                    channel.id,
                    channel.title,
                    video.title,
                    video.videoId,
                  ).catch((err) => {
                    this.logger.error(`Failed to send notification: ${err}`);
                  })
                )
              );
            }
          } catch (error) {
            this.logger.error(
              `Error checking channel ${channel.title}: ${error}`,
            );
          }
        }
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`Finished scheduled YouTube polling in ${duration}s (${channelsToProcess.length} channels)`);
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

  // Reclassify videos every 5 minutes
  // Updates: lives that ended → VODs, legacy videos without classification
  @Cron('*/5 * * * *')
  async handleVideoReclassification() {
    const hasLock = await this.redis.acquireLock('cron:video-reclassification', 300);
    if (!hasLock) {
      this.logger.debug('Another instance is running video reclassification');
      return;
    }

    try {
      const startTime = Date.now();
      this.logger.log('Starting video reclassification');

      const result = await this.youtubeService.reclassifyVideos(30);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`Video reclassification completed in ${duration}s: ${result.updated} updated, ${result.unchanged} unchanged`);
    } catch (error) {
      this.logger.error(`Video reclassification error: ${error}`);
    } finally {
      await this.redis.releaseLock('cron:video-reclassification');
    }
  }

  /**
   * Process items in parallel with concurrency limit
   */
  private async processInBatches<T>(
    items: T[],
    concurrency: number,
    processor: (item: T) => Promise<void>
  ): Promise<void> {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += concurrency) {
      chunks.push(items.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(processor));
      // Small delay between batches to avoid rate limiting
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.delay(1000);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}




