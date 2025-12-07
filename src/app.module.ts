import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

// Core modules
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { FeedModule } from './modules/feed/feed.module';
import { YouTubeModule } from './modules/youtube/youtube.module';
import { PushModule } from './modules/push/push.module';
import { WebSubModule } from './modules/websub/websub.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { FolderModule } from './modules/folder/folder.module';
import { CustomFeedModule } from './modules/custom-feed/custom-feed.module';
import { CustomYouTubeFeedModule } from './modules/custom-youtube-feed/custom-youtube-feed.module';
import { BookmarkModule } from './modules/bookmark/bookmark.module';
import { SearchModule } from './modules/search/search.module';

// Workers/Jobs
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Scheduling for cron jobs
    ScheduleModule.forRoot(),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Core
    PrismaModule,
    RedisModule,

    // Features
    AuthModule,
    SubscriptionModule,
    FeedModule,
    YouTubeModule,
    PushModule,
    WebSubModule,
    AdminModule,
    HealthModule,
    FolderModule,
    CustomFeedModule,
    CustomYouTubeFeedModule,
    BookmarkModule,
    SearchModule,

    // Jobs/Workers
    JobsModule,
  ],
})
export class AppModule { }

