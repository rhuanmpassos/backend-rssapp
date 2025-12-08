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
export declare class RssParserService {
    private readonly logger;
    private readonly parser;
    constructor();
    private sanitizeXmlContent;
    parseUrl(rssUrl: string): Promise<ParsedFeed | null>;
    private extractBaseUrl;
    parseContent(xmlContent: string): Promise<ParsedFeed | null>;
    private extractExcerpt;
    private extractThumbnail;
    discoverRssUrl(pageHtml: string, baseUrl: string): Promise<string | null>;
    private resolveUrl;
}
