import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScraperService } from './scraper.service';
import { RssParserService } from './rss-parser.service';
import { PlaywrightService } from './playwright.service';
import { RobotsService } from './robots.service';
import { ScraperController } from './scraper.controller';
import { FeedModule } from '../modules/feed/feed.module';
import { PushModule } from '../modules/push/push.module';

@Module({
  imports: [ConfigModule, forwardRef(() => FeedModule), PushModule],
  controllers: [ScraperController],
  providers: [ScraperService, RssParserService, PlaywrightService, RobotsService],
  exports: [ScraperService, RssParserService, PlaywrightService],
})
export class ScraperModule {}
