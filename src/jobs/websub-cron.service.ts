import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { WebSubService } from '../modules/websub/websub.service';

@Injectable()
export class WebSubCronService {
  private readonly logger = new Logger(WebSubCronService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private websubService: WebSubService,
  ) {}

  // Renew WebSub subscriptions every hour
  @Cron(CronExpression.EVERY_HOUR)
  async handleSubscriptionRenewal() {
    // Acquire lock
    const hasLock = await this.redis.acquireLock('cron:websub-renewal', 300);
    if (!hasLock) {
      this.logger.debug('Another instance is renewing WebSub subscriptions');
      return;
    }

    try {
      this.logger.log('Starting WebSub subscription renewal check');

      const result = await this.websubService.renewExpiringSubscriptions();

      this.logger.log(
        `WebSub renewal: ${result.renewed}/${result.total} subscriptions renewed`,
      );
    } catch (error) {
      this.logger.error(`WebSub renewal error: ${error}`);
    } finally {
      await this.redis.releaseLock('cron:websub-renewal');
    }
  }

  // Subscribe new channels to WebSub daily
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleNewSubscriptions() {
    try {
      this.logger.log('Checking for channels without WebSub subscription');

      // Find channels without active WebSub
      const channels = await this.prisma.youTubeChannel.findMany({
        where: {
          OR: [
            { websubExpiresAt: null },
            { websubExpiresAt: { lt: new Date() } },
          ],
        },
        take: 20,
      });

      this.logger.log(`Found ${channels.length} channels to subscribe via WebSub`);

      let subscribed = 0;

      for (const channel of channels) {
        try {
          const result = await this.websubService.subscribeToChannel(
            channel.channelId,
          );

          if (result.success) {
            subscribed++;
          }

          // Delay between subscriptions
          await this.delay(1000);
        } catch (error) {
          this.logger.error(
            `Failed to subscribe channel ${channel.channelId}: ${error}`,
          );
        }
      }

      this.logger.log(`WebSub: subscribed ${subscribed}/${channels.length} channels`);
    } catch (error) {
      this.logger.error(`WebSub new subscriptions error: ${error}`);
    }
  }

  // Clean up old job logs weekly
  @Cron(CronExpression.EVERY_WEEK)
  async handleJobLogCleanup() {
    try {
      this.logger.log('Cleaning up old job logs');

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const result = await this.prisma.jobLog.deleteMany({
        where: {
          createdAt: { lt: oneWeekAgo },
          status: { in: ['completed', 'cancelled'] },
        },
      });

      this.logger.log(`Deleted ${result.count} old job logs`);
    } catch (error) {
      this.logger.error(`Job log cleanup error: ${error}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}



