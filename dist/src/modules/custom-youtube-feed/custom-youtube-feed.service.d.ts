import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCustomYouTubeFeedDto } from './dto/create-custom-youtube-feed.dto';
import { UpdateCustomYouTubeFeedDto } from './dto/update-custom-youtube-feed.dto';
import { YouTubeService } from '../youtube/youtube.service';
import { YouTubeApiService } from '../youtube/youtube-api.service';
import { RssParserService } from '../../scraper/rss-parser.service';
import { PlaywrightService } from '../../scraper/playwright.service';
export declare class CustomYouTubeFeedService {
    private prisma;
    private youtubeService;
    private youtubeApi;
    private rssParserService;
    private playwrightService;
    private readonly logger;
    constructor(prisma: PrismaService, youtubeService: YouTubeService, youtubeApi: YouTubeApiService, rssParserService: RssParserService, playwrightService: PlaywrightService);
    create(dto: CreateCustomYouTubeFeedDto): Promise<{
        category: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string | null;
        channelId: string | null;
        slug: string;
        channelUrl: string | null;
        categoryId: string | null;
    }>;
    findAll(): Promise<({
        category: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string | null;
        channelId: string | null;
        slug: string;
        channelUrl: string | null;
        categoryId: string | null;
    })[]>;
    findPublicFeeds(): Promise<({
        category: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string | null;
        channelId: string | null;
        slug: string;
        channelUrl: string | null;
        categoryId: string | null;
    })[]>;
    searchPublicFeeds(query?: string): Promise<({
        category: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string | null;
        channelId: string | null;
        slug: string;
        channelUrl: string | null;
        categoryId: string | null;
    })[]>;
    findOne(slug: string): Promise<{
        category: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string | null;
        channelId: string | null;
        slug: string;
        channelUrl: string | null;
        categoryId: string | null;
    }>;
    update(id: string, dto: UpdateCustomYouTubeFeedDto): Promise<{
        category: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string | null;
        channelId: string | null;
        slug: string;
        channelUrl: string | null;
        categoryId: string | null;
    }>;
    delete(id: string): Promise<{
        message: string;
    }>;
    getRssXml(slug: string): Promise<string>;
    private extractChannelIdFromUrl;
}
