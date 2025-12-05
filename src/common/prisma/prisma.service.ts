import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase not allowed in production');
    }

    // Delete in order to avoid foreign key constraints
    await this.jobLog.deleteMany();
    await this.rateLimitLog.deleteMany();
    await this.webSubSubscription.deleteMany();
    await this.pushToken.deleteMany();
    await this.feedItem.deleteMany();
    await this.youTubeVideo.deleteMany();
    await this.subscription.deleteMany();
    await this.feed.deleteMany();
    await this.youTubeChannel.deleteMany();
    await this.user.deleteMany();
  }
}

