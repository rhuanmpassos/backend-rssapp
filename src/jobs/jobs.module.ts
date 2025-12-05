import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { FeedCronService } from './feed-cron.service';
import { YouTubeCronService } from './youtube-cron.service';
import { WebSubCronService } from './websub-cron.service';
import { FeedModule } from '../modules/feed/feed.module';
import { YouTubeModule } from '../modules/youtube/youtube.module';
import { WebSubModule } from '../modules/websub/websub.module';
import { PushModule } from '../modules/push/push.module';
import { ScraperModule } from '../scraper/scraper.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    FeedModule,
    YouTubeModule,
    WebSubModule,
    PushModule,
    ScraperModule,
  ],
  providers: [FeedCronService, YouTubeCronService, WebSubCronService],
  exports: [FeedCronService, YouTubeCronService, WebSubCronService],
})
export class JobsModule {}

