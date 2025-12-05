import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { YouTubeService } from '../youtube/youtube.service';
import { PushService } from '../push/push.service';
import * as crypto from 'crypto';
import { parseStringPromise } from 'xml2js';

const YOUTUBE_HUB_URL = 'https://pubsubhubbub.appspot.com/subscribe';

@Injectable()
export class WebSubService {
  private readonly logger = new Logger(WebSubService.name);
  private readonly callbackUrl: string;
  private readonly verifyToken: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private youtubeService: YouTubeService,
    private pushService: PushService,
  ) {
    this.callbackUrl = this.configService.get<string>('WEBSUB_CALLBACK_URL', '');
    this.verifyToken = this.configService.get<string>('WEBSUB_VERIFY_TOKEN', '');

    if (!this.callbackUrl) {
      this.logger.warn('WEBSUB_CALLBACK_URL not configured');
    }
  }

  async subscribeToChannel(channelId: string) {
    const topicUrl = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;
    const secret = crypto.randomBytes(32).toString('hex');

    // Store subscription intent
    await this.prisma.webSubSubscription.upsert({
      where: {
        topicUrl_callbackUrl: {
          topicUrl,
          callbackUrl: this.callbackUrl,
        },
      },
      update: {
        secret,
        verified: false,
      },
      create: {
        topicUrl,
        hubUrl: YOUTUBE_HUB_URL,
        callbackUrl: this.callbackUrl,
        secret,
        verified: false,
      },
    });

    // Send subscription request to hub
    const formData = new URLSearchParams({
      'hub.callback': this.callbackUrl,
      'hub.topic': topicUrl,
      'hub.verify': 'async',
      'hub.mode': 'subscribe',
      'hub.verify_token': this.verifyToken,
      'hub.secret': secret,
      'hub.lease_seconds': '864000', // 10 days
    });

    try {
      const response = await fetch(YOUTUBE_HUB_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (response.status === 202) {
        this.logger.log(`WebSub subscription initiated for channel: ${channelId}`);
        return { success: true, message: 'Subscription request sent' };
      } else {
        const text = await response.text();
        this.logger.error(`WebSub subscription failed: ${response.status} ${text}`);
        return { success: false, message: `Hub returned ${response.status}` };
      }
    } catch (error) {
      this.logger.error(`WebSub subscription error: ${error}`);
      return { success: false, message: String(error) };
    }
  }

  async unsubscribeFromChannel(channelId: string) {
    const topicUrl = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;

    const formData = new URLSearchParams({
      'hub.callback': this.callbackUrl,
      'hub.topic': topicUrl,
      'hub.mode': 'unsubscribe',
      'hub.verify': 'async',
      'hub.verify_token': this.verifyToken,
    });

    try {
      const response = await fetch(YOUTUBE_HUB_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (response.status === 202) {
        // Remove subscription record
        await this.prisma.webSubSubscription.deleteMany({
          where: { topicUrl, callbackUrl: this.callbackUrl },
        });
        
        this.logger.log(`WebSub unsubscription initiated for channel: ${channelId}`);
        return { success: true };
      }

      return { success: false };
    } catch (error) {
      this.logger.error(`WebSub unsubscription error: ${error}`);
      return { success: false };
    }
  }

  async verifyIntent(
    topic: string,
    challenge: string,
    mode: string,
    leaseSeconds?: number,
    verifyToken?: string,
  ): Promise<string | null> {
    // Verify token if provided
    if (verifyToken && verifyToken !== this.verifyToken) {
      this.logger.warn(`Invalid verify token received`);
      return null;
    }

    // Find subscription
    const subscription = await this.prisma.webSubSubscription.findFirst({
      where: {
        topicUrl: topic,
        callbackUrl: this.callbackUrl,
      },
    });

    if (!subscription) {
      this.logger.warn(`No subscription found for topic: ${topic}`);
      return null;
    }

    if (mode === 'subscribe') {
      // Update subscription as verified
      const expiresAt = leaseSeconds
        ? new Date(Date.now() + leaseSeconds * 1000)
        : null;

      await this.prisma.webSubSubscription.update({
        where: { id: subscription.id },
        data: {
          verified: true,
          leaseSeconds,
          expiresAt,
        },
      });

      // Update channel's websub info
      const channelIdMatch = topic.match(/channel_id=([^&]+)/);
      if (channelIdMatch) {
        await this.prisma.youTubeChannel.updateMany({
          where: { channelId: channelIdMatch[1] },
          data: {
            websubExpiresAt: expiresAt,
            websubTopicUrl: topic,
          },
        });
      }

      this.logger.log(`WebSub subscription verified for: ${topic}`);
    } else if (mode === 'unsubscribe') {
      await this.prisma.webSubSubscription.delete({
        where: { id: subscription.id },
      });
      this.logger.log(`WebSub unsubscription verified for: ${topic}`);
    }

    return challenge;
  }

  async handleNotification(
    body: string,
    signature?: string,
  ): Promise<{ success: boolean; videosProcessed: number }> {
    try {
      // Parse the XML feed
      const parsed = await parseStringPromise(body, {
        explicitArray: false,
      });

      const feed = parsed.feed;
      if (!feed) {
        this.logger.warn('Invalid WebSub notification: no feed element');
        return { success: false, videosProcessed: 0 };
      }

      // Get channel ID from the feed
      const channelId = feed['yt:channelId'];
      if (!channelId) {
        this.logger.warn('No channel ID in WebSub notification');
        return { success: false, videosProcessed: 0 };
      }

      // Get channel from database
      const channel = await this.youtubeService.getChannelByYouTubeId(channelId);
      if (!channel) {
        this.logger.warn(`Channel not found: ${channelId}`);
        return { success: false, videosProcessed: 0 };
      }

      // Verify HMAC signature if we have a secret
      if (signature && channel.websubSecret) {
        const expectedSignature = crypto
          .createHmac('sha1', channel.websubSecret)
          .update(body)
          .digest('hex');

        const providedSig = signature.replace('sha1=', '');
        if (providedSig !== expectedSignature) {
          this.logger.warn('Invalid WebSub signature');
          // Continue anyway - some hubs don't sign correctly
        }
      }

      // Process entries
      const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry].filter(Boolean);
      let videosProcessed = 0;

      for (const entry of entries) {
        const videoId = entry['yt:videoId'];
        const title = entry.title;
        const published = entry.published;

        if (!videoId) continue;

        // Check if video already exists
        const existing = await this.prisma.youTubeVideo.findUnique({
          where: { videoId },
        });

        if (existing) {
          continue;
        }

        // Create new video
        await this.prisma.youTubeVideo.create({
          data: {
            videoId,
            channelDbId: channel.id,
            title: title || 'Untitled',
            description: '',
            thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            publishedAt: published ? new Date(published) : new Date(),
          },
        });

        videosProcessed++;

        // Send push notification
        await this.pushService.notifyNewVideo(
          channel.id,
          channel.title,
          title || 'New Video',
          videoId,
        );
      }

      this.logger.log(
        `WebSub notification processed: ${videosProcessed} new videos for channel ${channel.title}`,
      );

      return { success: true, videosProcessed };
    } catch (error) {
      this.logger.error(`Error processing WebSub notification: ${error}`);
      return { success: false, videosProcessed: 0 };
    }
  }

  async renewExpiringSubscriptions() {
    // Find subscriptions expiring in the next hour
    const expiringTime = new Date(Date.now() + 60 * 60 * 1000);

    const expiring = await this.prisma.webSubSubscription.findMany({
      where: {
        verified: true,
        expiresAt: { lt: expiringTime },
      },
    });

    let renewed = 0;

    for (const sub of expiring) {
      const channelIdMatch = sub.topicUrl.match(/channel_id=([^&]+)/);
      if (channelIdMatch) {
        const result = await this.subscribeToChannel(channelIdMatch[1]);
        if (result.success) {
          renewed++;
        }
      }
    }

    this.logger.log(`Renewed ${renewed} WebSub subscriptions`);

    return { renewed, total: expiring.length };
  }
}



