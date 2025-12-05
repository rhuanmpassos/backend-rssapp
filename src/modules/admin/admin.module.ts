import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { FeedModule } from '../feed/feed.module';
import { YouTubeModule } from '../youtube/youtube.module';
import { WebSubModule } from '../websub/websub.module';
import { ScraperModule } from '../../scraper/scraper.module';

@Module({
  imports: [FeedModule, YouTubeModule, WebSubModule, ScraperModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}



