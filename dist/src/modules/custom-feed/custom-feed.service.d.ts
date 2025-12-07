import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCustomFeedDto } from './dto/create-custom-feed.dto';
import { UpdateCustomFeedDto } from './dto/update-custom-feed.dto';
import { CreateCustomFeedItemDto } from './dto/create-custom-feed-item.dto';
import { PlaywrightService } from '../../scraper/playwright.service';
import { RssParserService } from '../../scraper/rss-parser.service';
export declare class CustomFeedService {
    private prisma;
    private playwrightService;
    private rssParserService;
    private readonly logger;
    constructor(prisma: PrismaService, playwrightService: PlaywrightService, rssParserService: RssParserService);
    create(dto: CreateCustomFeedDto): Promise<{
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
        slug: string;
        categoryId: string | null;
        siteUrl: string | null;
        articleSelector: string | null;
        selectors: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    findAll(): Promise<({
        _count: {
            items: number;
        };
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
        slug: string;
        categoryId: string | null;
        siteUrl: string | null;
        articleSelector: string | null;
        selectors: import("@prisma/client/runtime/library").JsonValue | null;
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
        slug: string;
        categoryId: string | null;
        siteUrl: string | null;
        articleSelector: string | null;
        selectors: import("@prisma/client/runtime/library").JsonValue | null;
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
        slug: string;
        categoryId: string | null;
        siteUrl: string | null;
        articleSelector: string | null;
        selectors: import("@prisma/client/runtime/library").JsonValue | null;
    })[]>;
    findOne(slug: string): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            feedId: string;
            publishedAt: Date;
            link: string;
            content: string | null;
            subtitle: string | null;
            imageUrl: string | null;
        }[];
        _count: {
            items: number;
        };
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
        slug: string;
        categoryId: string | null;
        siteUrl: string | null;
        articleSelector: string | null;
        selectors: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    findOneById(id: string): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            feedId: string;
            publishedAt: Date;
            link: string;
            content: string | null;
            subtitle: string | null;
            imageUrl: string | null;
        }[];
        _count: {
            items: number;
        };
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
        slug: string;
        categoryId: string | null;
        siteUrl: string | null;
        articleSelector: string | null;
        selectors: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    update(id: string, dto: UpdateCustomFeedDto): Promise<{
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
        slug: string;
        categoryId: string | null;
        siteUrl: string | null;
        articleSelector: string | null;
        selectors: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    delete(id: string): Promise<{
        message: string;
    }>;
    addItem(feedId: string, dto: CreateCustomFeedItemDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        feedId: string;
        publishedAt: Date;
        link: string;
        content: string | null;
        subtitle: string | null;
        imageUrl: string | null;
    }>;
    updateItem(itemId: string, dto: Partial<CreateCustomFeedItemDto>): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        feedId: string;
        publishedAt: Date;
        link: string;
        content: string | null;
        subtitle: string | null;
        imageUrl: string | null;
    }>;
    deleteItem(itemId: string): Promise<{
        message: string;
    }>;
    getRssXml(slug: string): Promise<string>;
    private resolveImageUrl;
    private discoverRssFeed;
    private extractWithHeuristics;
    private extractArticlesDynamically;
    getCategories(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    createCategory(name: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
