import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { YouTubeController } from './youtube.controller';
import { YouTubeService } from './youtube.service';
import { YouTubeApiService } from './youtube-api.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  controllers: [YouTubeController],
  providers: [YouTubeService, YouTubeApiService],
  exports: [YouTubeService, YouTubeApiService],
})
export class YouTubeModule {}



