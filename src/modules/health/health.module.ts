import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { YouTubeModule } from '../youtube/youtube.module';

@Module({
  imports: [YouTubeModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}



