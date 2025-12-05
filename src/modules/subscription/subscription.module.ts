import { Module, forwardRef } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { FeedModule } from '../feed/feed.module';
import { YouTubeModule } from '../youtube/youtube.module';
import { FolderModule } from '../folder/folder.module';
import { CustomYouTubeFeedModule } from '../custom-youtube-feed/custom-youtube-feed.module';

@Module({
  imports: [FeedModule, YouTubeModule, FolderModule, forwardRef(() => CustomYouTubeFeedModule)],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}



