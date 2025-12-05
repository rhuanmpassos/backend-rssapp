import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebSubController } from './websub.controller';
import { WebSubService } from './websub.service';
import { YouTubeModule } from '../youtube/youtube.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [ConfigModule, YouTubeModule, PushModule],
  controllers: [WebSubController],
  providers: [WebSubService],
  exports: [WebSubService],
})
export class WebSubModule {}



