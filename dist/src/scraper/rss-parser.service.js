"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RssParserService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RssParserService = void 0;
const common_1 = require("@nestjs/common");
const RSSParser = require('rss-parser');
let RssParserService = RssParserService_1 = class RssParserService {
    constructor() {
        this.logger = new common_1.Logger(RssParserService_1.name);
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
    sanitizeXmlContent(xml) {
        const htmlEntities = {
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
        for (const [entity, replacement] of Object.entries(htmlEntities)) {
            sanitized = sanitized.replace(new RegExp(entity, 'gi'), replacement);
        }
        sanitized = sanitized.replace(/&(?!(amp|lt|gt|apos|quot|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
        return sanitized;
    }
    async parseUrl(rssUrl) {
        try {
            this.logger.log(`Parsing RSS feed: ${rssUrl}`);
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
            const baseUrl = feed.link || this.extractBaseUrl(rssUrl);
            this.logger.debug(`Base URL for resolving relative paths: ${baseUrl}`);
            const items = feed.items
                .filter((item) => item.link || item.guid)
                .map((item) => {
                const thumbnailUrl = this.extractThumbnail(item);
                const resolvedThumbnail = thumbnailUrl ? this.resolveUrl(thumbnailUrl, baseUrl) : undefined;
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
            if (items.length > 0) {
                this.logger.debug(`Sample item: title="${items[0].title}", thumbnail="${items[0].thumbnailUrl}"`);
            }
            return {
                title: feed.title || 'Untitled Feed',
                description: feed.description,
                link: feed.link,
                items,
            };
        }
        catch (error) {
            this.logger.error(`Failed to parse RSS: ${rssUrl} - ${error}`);
            return null;
        }
    }
    extractBaseUrl(rssUrl) {
        try {
            const url = new URL(rssUrl);
            return `${url.protocol}//${url.hostname}`;
        }
        catch {
            return '';
        }
    }
    async parseContent(xmlContent) {
        try {
            const feed = await this.parser.parseString(xmlContent);
            const items = feed.items.map((item) => ({
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
        }
        catch (error) {
            this.logger.error(`Failed to parse RSS content: ${error}`);
            return null;
        }
    }
    extractExcerpt(item) {
        let content = item['content:encoded'] || item.contentSnippet || item.content || item.summary;
        if (!content) {
            return undefined;
        }
        content = content.replace(/<[^>]*>/g, '').trim();
        if (content.length > 500) {
            content = content.slice(0, 497) + '...';
        }
        return content;
    }
    extractThumbnail(item) {
        if (item.mediaThumbnail?.url) {
            return item.mediaThumbnail.url;
        }
        if (item.mediaContent?.url) {
            return item.mediaContent.url;
        }
        if (item.mediaGroup?.['media:thumbnail']?.[0]?.$?.url) {
            return item.mediaGroup['media:thumbnail'][0].$.url;
        }
        if (item.ytVideoId) {
            return `https://i.ytimg.com/vi/${item.ytVideoId}/hqdefault.jpg`;
        }
        const link = item.link || item.guid || '';
        const videoIdMatch = link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
        if (videoIdMatch) {
            return `https://i.ytimg.com/vi/${videoIdMatch[1]}/hqdefault.jpg`;
        }
        if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
            return item.enclosure.url;
        }
        const content = item['content:encoded'] || item.content || '';
        const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch) {
            return imgMatch[1];
        }
        return undefined;
    }
    async discoverRssUrl(pageHtml, baseUrl) {
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
                    if (contentType.includes('xml') ||
                        contentType.includes('rss') ||
                        contentType.includes('atom')) {
                        this.logger.debug(`Found RSS at common path: ${rssUrl}`);
                        return rssUrl;
                    }
                }
            }
            catch {
                continue;
            }
        }
        return null;
    }
    resolveUrl(url, baseUrl) {
        try {
            return new URL(url, baseUrl).href;
        }
        catch {
            return url;
        }
    }
};
exports.RssParserService = RssParserService;
exports.RssParserService = RssParserService = RssParserService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], RssParserService);
//# sourceMappingURL=rss-parser.service.js.map