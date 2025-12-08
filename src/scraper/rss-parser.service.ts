import { Injectable, Logger } from '@nestjs/common';
const RSSParser = require('rss-parser');

export interface ParsedFeedItem {
  url: string;
  title: string;
  excerpt?: string;
  thumbnailUrl?: string;
  author?: string;
  publishedAt?: Date;
}

export interface ParsedFeed {
  title: string;
  description?: string;
  link?: string;
  items: ParsedFeedItem[];
}

@Injectable()
export class RssParserService {
  private readonly logger = new Logger(RssParserService.name);
  private readonly parser: any;

  constructor() {
    this.parser = new RSSParser({
      timeout: 10000,
      customFields: {
        item: [
          ['media:thumbnail', 'mediaThumbnail'],
          ['media:content', 'mediaContent'],
          ['media:group', 'mediaGroup'],
          ['yt:videoId', 'ytVideoId'],
          ['enclosure', 'enclosure'],
        ],
      },
    });
  }

  /**
   * Sanitize XML content to fix common entity issues
   * This fixes "Invalid character in entity name" errors from feeds with unescaped & or HTML entities
   */
  private sanitizeXmlContent(xml: string): string {
    // Replace common HTML entities with their XML equivalents
    const htmlEntities: Record<string, string> = {
      '&nbsp;': '&#160;',
      '&copy;': '&#169;',
      '&reg;': '&#174;',
      '&trade;': '&#8482;',
      '&mdash;': '&#8212;',
      '&ndash;': '&#8211;',
      '&lsquo;': '&#8216;',
      '&rsquo;': '&#8217;',
      '&ldquo;': '&#8220;',
      '&rdquo;': '&#8221;',
      '&bull;': '&#8226;',
      '&hellip;': '&#8230;',
      '&eacute;': '&#233;',
      '&aacute;': '&#225;',
      '&iacute;': '&#237;',
      '&oacute;': '&#243;',
      '&uacute;': '&#250;',
      '&atilde;': '&#227;',
      '&otilde;': '&#245;',
      '&ccedil;': '&#231;',
      '&Aacute;': '&#193;',
      '&Eacute;': '&#201;',
      '&Iacute;': '&#205;',
      '&Oacute;': '&#211;',
      '&Uacute;': '&#218;',
      '&Atilde;': '&#195;',
      '&Otilde;': '&#213;',
      '&Ccedil;': '&#199;',
      '&agrave;': '&#224;',
      '&egrave;': '&#232;',
      '&ograve;': '&#242;',
      '&acirc;': '&#226;',
      '&ecirc;': '&#234;',
      '&ocirc;': '&#244;',
      '&uuml;': '&#252;',
      '&ouml;': '&#246;',
      '&auml;': '&#228;',
      '&ntilde;': '&#241;',
    };

    let sanitized = xml;

    // Replace known HTML entities
    for (const [entity, replacement] of Object.entries(htmlEntities)) {
      sanitized = sanitized.replace(new RegExp(entity, 'gi'), replacement);
    }

    // Fix unescaped ampersands that aren't part of valid XML entities
    // Valid XML entities: &amp; &lt; &gt; &apos; &quot; and numeric &#nnnn; or &#xhhhh;
    sanitized = sanitized.replace(
      /&(?!(amp|lt|gt|apos|quot|#\d+|#x[0-9a-fA-F]+);)/g,
      '&amp;'
    );

    return sanitized;
  }

  async parseUrl(rssUrl: string): Promise<ParsedFeed | null> {
    try {
      this.logger.log(`Parsing RSS feed: ${rssUrl}`);

      // Fetch the content manually so we can sanitize it
      const response = await fetch(rssUrl, {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RSSReader/1.0)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
      });

      if (!response.ok) {
        this.logger.error(`Failed to fetch RSS: ${rssUrl} - HTTP ${response.status}`);
        return null;
      }

      const rawXml = await response.text();
      const sanitizedXml = this.sanitizeXmlContent(rawXml);

      const feed = await this.parser.parseString(sanitizedXml);

      if (!feed || !feed.items) {
        this.logger.warn(`RSS feed has no items: ${rssUrl}`);
        return null;
      }

      // Extract base URL for resolving relative URLs
      const baseUrl = feed.link || this.extractBaseUrl(rssUrl);
      this.logger.debug(`Base URL for resolving relative paths: ${baseUrl}`);

      const items: ParsedFeedItem[] = feed.items
        .filter((item: any) => item.link || item.guid) // Only items with URLs
        .map((item: any) => {
          const thumbnailUrl = this.extractThumbnail(item);
          const resolvedThumbnail = thumbnailUrl ? this.resolveUrl(thumbnailUrl, baseUrl) : undefined;

          // Log thumbnail resolution for debugging
          if (thumbnailUrl && thumbnailUrl !== resolvedThumbnail) {
            this.logger.debug(`Resolved thumbnail: ${thumbnailUrl} -> ${resolvedThumbnail}`);
          }

          return {
            url: item.link || item.guid || '',
            title: item.title || 'Untitled',
            excerpt: this.extractExcerpt(item),
            thumbnailUrl: resolvedThumbnail,
            author: item.creator || item.author,
            publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
          };
        });

      if (items.length === 0) {
        this.logger.warn(`RSS feed parsed but has no valid items: ${rssUrl}`);
        return null;
      }

      this.logger.log(`RSS feed parsed successfully: ${items.length} items found`);

      // Log sample of items for debugging
      if (items.length > 0) {
        this.logger.debug(`Sample item: title="${items[0].title}", thumbnail="${items[0].thumbnailUrl}"`);
      }

      return {
        title: feed.title || 'Untitled Feed',
        description: feed.description,
        link: feed.link,
        items,
      };
    } catch (error) {
      this.logger.error(`Failed to parse RSS: ${rssUrl} - ${error}`);
      return null;
    }
  }

  /**
   * Extract base URL from RSS URL for resolving relative paths
   */
  private extractBaseUrl(rssUrl: string): string {
    try {
      const url = new URL(rssUrl);
      return `${url.protocol}//${url.hostname}`;
    } catch {
      return '';
    }
  }

  async parseContent(xmlContent: string): Promise<ParsedFeed | null> {
    try {
      const feed = await this.parser.parseString(xmlContent);

      const items: ParsedFeedItem[] = feed.items.map((item: any) => ({
        url: item.link || item.guid || '',
        title: item.title || 'Untitled',
        excerpt: this.extractExcerpt(item),
        thumbnailUrl: this.extractThumbnail(item),
        author: item.creator || item.author,
        publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
      }));

      return {
        title: feed.title || 'Untitled Feed',
        description: feed.description,
        link: feed.link,
        items,
      };
    } catch (error) {
      this.logger.error(`Failed to parse RSS content: ${error}`);
      return null;
    }
  }

  private extractExcerpt(item: any): string | undefined {
    // Try content:encoded first, then contentSnippet, then content
    let content = item['content:encoded'] || item.contentSnippet || item.content || item.summary;

    if (!content) {
      return undefined;
    }

    // Strip HTML tags
    content = content.replace(/<[^>]*>/g, '').trim();

    // Limit to 500 chars (NO LLM summarization!)
    if (content.length > 500) {
      content = content.slice(0, 497) + '...';
    }

    return content;
  }

  private extractThumbnail(item: any): string | undefined {
    // Try various thumbnail sources
    if (item.mediaThumbnail?.url) {
      return item.mediaThumbnail.url;
    }

    if (item.mediaContent?.url) {
      return item.mediaContent.url;
    }

    // YouTube RSS uses media:group with nested media:thumbnail
    if (item.mediaGroup?.['media:thumbnail']?.[0]?.$?.url) {
      return item.mediaGroup['media:thumbnail'][0].$.url;
    }

    // Try extracting from yt:videoId for YouTube thumbnails
    if (item.ytVideoId) {
      return `https://i.ytimg.com/vi/${item.ytVideoId}/hqdefault.jpg`;
    }

    // Try to extract video ID from link for YouTube
    const link = item.link || item.guid || '';
    const videoIdMatch = link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (videoIdMatch) {
      return `https://i.ytimg.com/vi/${videoIdMatch[1]}/hqdefault.jpg`;
    }

    if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
      return item.enclosure.url;
    }

    // Try to extract from content
    const content = item['content:encoded'] || item.content || '';
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) {
      return imgMatch[1];
    }

    return undefined;
  }

  async discoverRssUrl(pageHtml: string, baseUrl: string): Promise<string | null> {
    // Look for RSS link in HTML head
    const patterns = [
      /<link[^>]+type=["']application\/rss\+xml["'][^>]+href=["']([^"']+)["']/gi,
      /<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/rss\+xml["']/gi,
      /<link[^>]+type=["']application\/atom\+xml["'][^>]+href=["']([^"']+)["']/gi,
      /<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/atom\+xml["']/gi,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(pageHtml);
      if (match && match[1]) {
        const rssUrl = this.resolveUrl(match[1], baseUrl);
        this.logger.debug(`Discovered RSS URL: ${rssUrl}`);
        return rssUrl;
      }
    }

    // Try common RSS paths
    const commonPaths = [
      '/feed',
      '/rss',
      '/rss.xml',
      '/feed.xml',
      '/atom.xml',
      '/feeds/posts/default',
      '/blog/feed',
    ];

    for (const path of commonPaths) {
      const rssUrl = this.resolveUrl(path, baseUrl);
      try {
        const response = await fetch(rssUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (
            contentType.includes('xml') ||
            contentType.includes('rss') ||
            contentType.includes('atom')
          ) {
            this.logger.debug(`Found RSS at common path: ${rssUrl}`);
            return rssUrl;
          }
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private resolveUrl(url: string, baseUrl: string): string {
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return url;
    }
  }
}



