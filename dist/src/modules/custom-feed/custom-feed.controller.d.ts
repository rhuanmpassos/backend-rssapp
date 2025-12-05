import { Response } from 'express';
import { CustomFeedService } from './custom-feed.service';
import { CreateCustomFeedDto } from './dto/create-custom-feed.dto';
import { UpdateCustomFeedDto } from './dto/update-custom-feed.dto';
import { CreateCustomFeedItemDto } from './dto/create-custom-feed-item.dto';
export declare class CustomFeedController {
    private readonly customFeedService;
    constructor(customFeedService: CustomFeedService);
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
        category: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
        } | null;
        _count: {
            items: number;
        };
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
            link: string;
            content: string | null;
            publishedAt: Date;
            subtitle: string | null;
            imageUrl: string | null;
        }[];
        category: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
        } | null;
        _count: {
            items: number;
        };
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
    getRssXml(slug: string, res: Response): Promise<void>;
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
    addItem(id: string, dto: CreateCustomFeedItemDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        feedId: string;
        link: string;
        content: string | null;
        publishedAt: Date;
        subtitle: string | null;
        imageUrl: string | null;
    }>;
    updateItem(itemId: string, dto: Partial<CreateCustomFeedItemDto>): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        feedId: string;
        link: string;
        content: string | null;
        publishedAt: Date;
        subtitle: string | null;
        imageUrl: string | null;
    }>;
    deleteItem(itemId: string): Promise<{
        message: string;
    }>;
    getCategories(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    createCategory(body: {
        name: string;
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
