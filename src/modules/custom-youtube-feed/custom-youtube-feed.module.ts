import { Module } from '@nestjs/common';
import { CustomYouTubeFeedController } from './custom-youtube-feed.controller';
import { CustomYouTubeFeedService } from './custom-youtube-feed.service';
import { YouTubeModule } from '../youtube/youtube.module';
import { ScraperModule } from '../../scraper/scraper.module';

@Module({
  imports: [YouTubeModule, ScraperModule],
  controllers: [CustomYouTubeFeedController],
  providers: [CustomYouTubeFeedService],
  exports: [CustomYouTubeFeedService],
})
export class CustomYouTubeFeedModule {}

