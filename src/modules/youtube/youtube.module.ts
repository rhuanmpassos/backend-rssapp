import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { YouTubeController } from './youtube.controller';
import { YouTubeService } from './youtube.service';
import { YouTubeApiService } from './youtube-api.service';
import { YoutubeiService } from './youtubei.service';
import { ScraperModule } from '../../scraper/scraper.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    ConfigModule,
    ScraperModule,
  ],
  controllers: [YouTubeController],
  providers: [YouTubeService, YouTubeApiService, YoutubeiService],
  exports: [YouTubeService, YouTubeApiService, YoutubeiService],
})
export class YouTubeModule { }



