import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCustomYouTubeFeedDto } from './dto/create-custom-youtube-feed.dto';
import { UpdateCustomYouTubeFeedDto } from './dto/update-custom-youtube-feed.dto';
import { YouTubeService } from '../youtube/youtube.service';
import { YouTubeApiService } from '../youtube/youtube-api.service';
import { RssParserService } from '../../scraper/rss-parser.service';
import { PlaywrightService } from '../../scraper/playwright.service';

@Injectable()
export class CustomYouTubeFeedService {
  private readonly logger = new Logger(CustomYouTubeFeedService.name);

  constructor(
    private prisma: PrismaService,
    private youtubeService: YouTubeService,
    private youtubeApi: YouTubeApiService,
    private rssParserService: RssParserService,
    private playwrightService: PlaywrightService,
  ) {}

  async create(dto: CreateCustomYouTubeFeedDto) {
    const existing = await this.prisma.customYouTubeFeed.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException('A feed with this slug already exists');
    }

    // Resolve channel if channelUrl or channelId provided
    let resolvedChannelId = dto.channelId;
    if (dto.channelUrl && !dto.channelId) {
      this.logger.log(`Resolving channel from URL: ${dto.channelUrl}`);
      
      // Try API first
      let channel = await this.youtubeService.resolveChannel(dto.channelUrl);
      
      // If API fails, try scraping
      if (!channel) {
        this.logger.log(`API resolution failed, trying scraping for: ${dto.channelUrl}`);
        const scrapedChannelId = await this.extractChannelIdFromUrl(dto.channelUrl);
        
        if (scrapedChannelId) {
          resolvedChannelId = scrapedChannelId;
          this.logger.log(`Extracted channel ID via scraping: ${resolvedChannelId}`);
        } else {
          this.logger.warn(`Failed to resolve channel from URL: ${dto.channelUrl}`);
          throw new BadRequestException('Could not resolve YouTube channel from the provided URL. Please check if the URL is correct or configure a valid YouTube API key.');
        }
      } else {
        resolvedChannelId = channel.channelId;
        this.logger.log(`Resolved channel ID via API: ${resolvedChannelId}`);
      }
    }

    if (!resolvedChannelId) {
      throw new BadRequestException('Channel ID or Channel URL is required');
    }

    const feed = await this.prisma.customYouTubeFeed.create({
      data: {
        title: dto.title,
        description: dto.description,
        slug: dto.slug,
        channelId: resolvedChannelId,
        channelUrl: dto.channelUrl,
        categoryId: dto.categoryId,
      },
      include: {
        category: true,
      },
    });

    this.logger.log(`Custom YouTube feed created: ${dto.slug} with channel ID: ${resolvedChannelId}`);
    return feed;
  }

  async findAll() {
    return this.prisma.customYouTubeFeed.findMany({
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPublicFeeds() {
    return this.prisma.customYouTubeFeed.findMany({
      where: {
        channelId: { not: null },
      },
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchPublicFeeds(query?: string) {
    const where: any = {
      channelId: { not: null },
    };

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { slug: { contains: query, mode: 'insensitive' } },
      ];
    }

    return this.prisma.customYouTubeFeed.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async findOne(slug: string) {
    const feed = await this.prisma.customYouTubeFeed.findUnique({
      where: { slug },
      include: {
        category: true,
      },
    });

    if (!feed) {
      throw new NotFoundException('Custom YouTube feed not found');
    }

    return feed;
  }

  async update(id: string, dto: UpdateCustomYouTubeFeedDto) {
    const feed = await this.prisma.customYouTubeFeed.findUnique({
      where: { id },
    });

    if (!feed) {
      throw new NotFoundException('Custom YouTube feed not found');
    }

    if (dto.slug && dto.slug !== feed.slug) {
      const existing = await this.prisma.customYouTubeFeed.findUnique({
        where: { slug: dto.slug },
      });

      if (existing) {
        throw new BadRequestException('A feed with this slug already exists');
      }
    }

    // Resolve channel if channelUrl provided
    let resolvedChannelId = dto.channelId || feed.channelId;
    if (dto.channelUrl && !dto.channelId) {
      // Try API first
      let channel = await this.youtubeService.resolveChannel(dto.channelUrl);
      
      // If API fails, try scraping
      if (!channel) {
        const scrapedChannelId = await this.extractChannelIdFromUrl(dto.channelUrl);
        if (!scrapedChannelId) {
          throw new BadRequestException('Could not resolve YouTube channel from the provided URL');
        }
        resolvedChannelId = scrapedChannelId;
      } else {
        resolvedChannelId = channel.channelId;
      }
    }

    return this.prisma.customYouTubeFeed.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        slug: dto.slug,
        channelId: resolvedChannelId,
        channelUrl: dto.channelUrl,
        categoryId: dto.categoryId,
      },
      include: {
        category: true,
      },
    });
  }

  async delete(id: string) {
    const feed = await this.prisma.customYouTubeFeed.findUnique({
      where: { id },
    });

    if (!feed) {
      throw new NotFoundException('Custom YouTube feed not found');
    }

    await this.prisma.customYouTubeFeed.delete({
      where: { id },
    });

    this.logger.log(`Custom YouTube feed deleted: ${feed.slug}`);
    return { message: 'Custom YouTube feed deleted successfully' };
  }

  async getRssXml(slug: string): Promise<string> {
    const feed = await this.findOne(slug);

    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const feedUrl = `${baseUrl}/api/v1/custom-youtube-feeds/${slug}/rss.xml`;

    let items: any[] = [];

    if (feed.channelId) {
      try {
        this.logger.log(`Fetching videos for YouTube channel: ${feed.channelId}`);
        
        // Primeiro, tentar usar o RSS nativo do YouTube
        const youtubeRssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${feed.channelId}`;
        this.logger.log(`Trying YouTube native RSS: ${youtubeRssUrl}`);
        
        try {
          const parsed = await this.rssParserService.parseUrl(youtubeRssUrl);
          this.logger.debug(`YouTube RSS parsed: ${JSON.stringify({ 
            hasItems: !!parsed?.items, 
            itemsCount: parsed?.items?.length || 0 
          })}`);
          
          if (parsed && parsed.items && parsed.items.length > 0) {
            items = parsed.items.slice(0, 20).map(item => {
              // YouTube RSS usa formato Atom, pode ter link diferente
              const videoLink = item.url || '';
              // Se o link não tiver watch?v=, pode ser um link do feed que precisa ser convertido
              let finalLink = videoLink;
              if (videoLink && !videoLink.includes('watch?v=')) {
                // Tentar extrair video ID do link do feed
                const videoIdMatch = videoLink.match(/\/video\/([a-zA-Z0-9_-]+)/);
                if (videoIdMatch) {
                  finalLink = `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;
                }
              }
              
              // Detectar se é live stream
              // Lives geralmente têm "LIVE" no título ou no excerpt
              const title = item.title || '';
              const excerpt = item.excerpt || '';
              const isLive = /(?:live|ao vivo|streaming|🔴|LIVE)/i.test(title + ' ' + excerpt);
              
              return {
                title: item.title || 'Sem título',
                subtitle: item.excerpt || '',
                link: finalLink || videoLink,
                imageUrl: item.thumbnailUrl,
                publishedAt: item.publishedAt,
                isLive: isLive, // Marcar como live
              };
            });
            
            // Priorizar lives: colocar lives primeiro
            items.sort((a, b) => {
              if (a.isLive && !b.isLive) return -1;
              if (!a.isLive && b.isLive) return 1;
              // Se ambos são lives ou ambos não são, ordenar por data
              const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
              const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
              return dateB - dateA;
            });
            
            this.logger.log(`Successfully fetched ${items.length} videos from YouTube RSS for feed: ${feed.slug} (${items.filter(i => i.isLive).length} lives)`);
          } else {
            this.logger.warn(`YouTube RSS returned no items for channel ${feed.channelId}`);
            throw new Error('No items in YouTube RSS');
          }
        } catch (rssError) {
          this.logger.warn(`YouTube RSS failed for channel ${feed.channelId}, trying API: ${rssError}`);
          
          // Fallback: usar YouTube API
          const videos = await this.youtubeApi.getRecentVideos(feed.channelId, undefined, 20);
          
          // Usar informação de live da API se disponível
          items = videos.map((video) => {
            // Verificar se é live: primeiro pela API, depois pelo título
            const isLive = video.isLive || /(?:live|ao vivo|streaming|🔴|LIVE)/i.test(video.title + ' ' + video.description);
            
            return {
              title: video.title,
              subtitle: video.description,
              link: `https://www.youtube.com/watch?v=${video.videoId}`,
              imageUrl: video.thumbnailUrl,
              publishedAt: video.publishedAt,
              isLive: isLive,
            };
          });
          
          // Priorizar lives
          items.sort((a, b) => {
            if (a.isLive && !b.isLive) return -1;
            if (!a.isLive && b.isLive) return 1;
            const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return dateB - dateA;
          });

          this.logger.log(`Fetched ${items.length} videos from API for feed: ${feed.slug} (${items.filter(i => i.isLive).length} lives)`);
        }
      } catch (error) {
        this.logger.error(`Failed to fetch videos for feed ${feed.slug}: ${error}`);
        items = [];
      }
    }

    let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title><![CDATA[${feed.title}]]></title>
    <description><![CDATA[${feed.description || ''}]]></description>
    <link>${feedUrl}</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <pubDate>${feed.updatedAt.toUTCString()}</pubDate>
    <generator>RSS App Custom YouTube Feed Generator</generator>
`;

    for (const item of items) {
      const title = item.isLive ? `🔴 LIVE: ${item.title || 'Sem título'}` : (item.title || 'Sem título');
      rss += `    <item>
      <title><![CDATA[${title}]]></title>
      <description><![CDATA[${item.subtitle || item.title || ''}]]></description>
      <link>${item.link}</link>
      <guid isPermaLink="true">${item.link}</guid>
      <pubDate>${item.publishedAt ? new Date(item.publishedAt).toUTCString() : new Date().toUTCString()}</pubDate>
`;

      if (item.imageUrl) {
        rss += `      <media:content url="${item.imageUrl}" type="image/jpeg" />
      <enclosure url="${item.imageUrl}" type="image/jpeg" />
`;
      }

      rss += `    </item>
`;
    }

    rss += `  </channel>
</rss>`;

    return rss;
  }

  /**
   * Extract YouTube channel ID from URL using scraping as fallback when API is not available
   */
  private async extractChannelIdFromUrl(url: string): Promise<string | null> {
    try {
      // Normalize URL
      let normalizedUrl = url.trim();
      
      // Handle @username format
      if (normalizedUrl.startsWith('@')) {
        normalizedUrl = `https://www.youtube.com/${normalizedUrl}`;
      } else if (!normalizedUrl.startsWith('http')) {
        normalizedUrl = `https://www.youtube.com/@${normalizedUrl.replace('@', '')}`;
      }

      // Extract handle or channel ID from URL
      const urlMatch = normalizedUrl.match(
        /(?:youtube\.com\/(?:channel\/|c\/|@|user\/)?|youtu\.be\/)([^\/\?\s]+)/
      );

      if (!urlMatch) {
        return null;
      }

      const identifier = urlMatch[1];

      // If it's already a channel ID (starts with UC), return it
      if (identifier.startsWith('UC') && identifier.length === 24) {
        return identifier;
      }

      // Otherwise, scrape the page to get channel ID
      this.logger.log(`Scraping YouTube page to extract channel ID: ${normalizedUrl}`);
      
      const scraped = await this.playwrightService.scrapePage(normalizedUrl);
      
      if (!scraped || !scraped.html) {
        return null;
      }

      // Try to extract channel ID from various sources in the HTML
      const channelIdPatterns = [
        /"channelId":"([^"]+)"/,
        /"externalId":"([^"]+)"/,
        /channel_id=([^&"'\s]+)/,
        /\/channel\/(UC[a-zA-Z0-9_-]{22})/,
        /"browseId":"(UC[a-zA-Z0-9_-]{22})"/,
      ];

      for (const pattern of channelIdPatterns) {
        const match = scraped.html.match(pattern);
        if (match && match[1] && match[1].startsWith('UC')) {
          this.logger.log(`Found channel ID via scraping: ${match[1]}`);
          return match[1];
        }
      }

      // Try to find in meta tags or JSON-LD
      const metaMatch = scraped.html.match(/<meta[^>]+content="([^"]*channel[^"]*UC[a-zA-Z0-9_-]{22}[^"]*)"/i);
      if (metaMatch) {
        const channelIdMatch = metaMatch[1].match(/(UC[a-zA-Z0-9_-]{22})/);
        if (channelIdMatch) {
          return channelIdMatch[1];
        }
      }

      this.logger.warn(`Could not extract channel ID from scraped page: ${normalizedUrl}`);
      return null;
    } catch (error) {
      this.logger.error(`Error extracting channel ID from URL ${url}: ${error}`);
      return null;
    }
  }
}

