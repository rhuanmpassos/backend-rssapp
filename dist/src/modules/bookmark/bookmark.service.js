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
var BookmarkService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookmarkService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let BookmarkService = BookmarkService_1 = class BookmarkService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(BookmarkService_1.name);
    }
    async getBookmarks(userId, page = 1, limit = 50) {
        const skip = (page - 1) * limit;
        const [bookmarks, total] = await Promise.all([
            this.prisma.userBookmark.findMany({
                where: { userId },
                orderBy: { savedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.userBookmark.count({ where: { userId } }),
        ]);
        return {
            data: bookmarks,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async addBookmark(userId, dto) {
        const bookmark = await this.prisma.userBookmark.upsert({
            where: {
                userId_itemType_itemId: {
                    userId,
                    itemType: dto.itemType,
                    itemId: dto.itemId,
                },
            },
            update: {
                title: dto.title,
                excerpt: dto.excerpt,
                thumbnailUrl: dto.thumbnailUrl,
                url: dto.url,
                source: dto.source,
                publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined,
            },
            create: {
                userId,
                itemType: dto.itemType,
                itemId: dto.itemId,
                title: dto.title,
                excerpt: dto.excerpt,
                thumbnailUrl: dto.thumbnailUrl,
                url: dto.url,
                source: dto.source,
                publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined,
                savedAt: dto.savedAt ? new Date(dto.savedAt) : new Date(),
            },
        });
        this.logger.debug(`Bookmark created/updated for user ${userId}: ${dto.title}`);
        return bookmark;
    }
    async removeBookmark(userId, idOrItemId) {
        let deleted = await this.prisma.userBookmark.deleteMany({
            where: {
                id: idOrItemId,
                userId,
            },
        });
        if (deleted.count === 0) {
            deleted = await this.prisma.userBookmark.deleteMany({
                where: {
                    itemId: idOrItemId,
                    userId,
                },
            });
        }
        if (deleted.count === 0) {
            throw new common_1.NotFoundException('Bookmark not found');
        }
        return { success: true, deleted: deleted.count };
    }
    async syncBookmarks(userId, dto) {
        const { bookmarks } = dto;
        const serverBookmarks = await this.prisma.userBookmark.findMany({
            where: { userId },
        });
        const toUpsert = bookmarks.filter((clientItem) => {
            const serverItem = serverBookmarks.find((s) => s.itemType === clientItem.itemType && s.itemId === clientItem.itemId);
            return !serverItem || (clientItem.savedAt && new Date(clientItem.savedAt) > serverItem.savedAt);
        });
        const toSync = serverBookmarks.filter((serverItem) => {
            const clientItem = bookmarks.find((c) => c.itemType === serverItem.itemType && c.itemId === serverItem.itemId);
            return !clientItem || !clientItem.savedAt || serverItem.savedAt > new Date(clientItem.savedAt);
        });
        for (const item of toUpsert) {
            await this.prisma.userBookmark.upsert({
                where: {
                    userId_itemType_itemId: {
                        userId,
                        itemType: item.itemType,
                        itemId: item.itemId,
                    },
                },
                update: {
                    title: item.title,
                    excerpt: item.excerpt,
                    thumbnailUrl: item.thumbnailUrl,
                    url: item.url,
                    source: item.source,
                    publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
                    savedAt: item.savedAt ? new Date(item.savedAt) : undefined,
                },
                create: {
                    userId,
                    itemType: item.itemType,
                    itemId: item.itemId,
                    title: item.title,
                    excerpt: item.excerpt,
                    thumbnailUrl: item.thumbnailUrl,
                    url: item.url,
                    source: item.source,
                    publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
                    savedAt: item.savedAt ? new Date(item.savedAt) : new Date(),
                },
            });
        }
        this.logger.log(`Synced ${toUpsert.length} bookmarks from client, returning ${toSync.length} to client`);
        return {
            added: toUpsert.length,
            toSync,
            syncedAt: new Date().toISOString(),
        };
    }
    async getReadItems(userId, page = 1, limit = 100) {
        const skip = (page - 1) * limit;
        const [readItems, total] = await Promise.all([
            this.prisma.userReadItem.findMany({
                where: { userId },
                orderBy: { readAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    itemType: true,
                    itemId: true,
                    readAt: true,
                },
            }),
            this.prisma.userReadItem.count({ where: { userId } }),
        ]);
        return {
            data: readItems,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async markAsRead(userId, dto) {
        const readItem = await this.prisma.userReadItem.upsert({
            where: {
                userId_itemType_itemId: {
                    userId,
                    itemType: dto.itemType,
                    itemId: dto.itemId,
                },
            },
            update: {
                readAt: dto.readAt ? new Date(dto.readAt) : new Date(),
            },
            create: {
                userId,
                itemType: dto.itemType,
                itemId: dto.itemId,
                readAt: dto.readAt ? new Date(dto.readAt) : new Date(),
            },
        });
        return readItem;
    }
    async markAsUnread(userId, idOrItemId) {
        let deleted = await this.prisma.userReadItem.deleteMany({
            where: {
                id: idOrItemId,
                userId,
            },
        });
        if (deleted.count === 0) {
            deleted = await this.prisma.userReadItem.deleteMany({
                where: {
                    itemId: idOrItemId,
                    userId,
                },
            });
        }
        if (deleted.count === 0) {
            throw new common_1.NotFoundException('Read item not found');
        }
        return { success: true, deleted: deleted.count };
    }
    async syncReadItems(userId, dto) {
        const { readItems } = dto;
        const serverReadItems = await this.prisma.userReadItem.findMany({
            where: { userId },
        });
        const toAdd = readItems.filter((clientItem) => {
            return !serverReadItems.some((s) => s.itemType === clientItem.itemType && s.itemId === clientItem.itemId);
        });
        const toSync = serverReadItems.filter((serverItem) => {
            return !readItems.some((c) => c.itemType === serverItem.itemType && c.itemId === serverItem.itemId);
        });
        if (toAdd.length > 0) {
            await this.prisma.userReadItem.createMany({
                data: toAdd.map((item) => ({
                    userId,
                    itemType: item.itemType,
                    itemId: item.itemId,
                    readAt: item.readAt ? new Date(item.readAt) : new Date(),
                })),
                skipDuplicates: true,
            });
        }
        this.logger.log(`Synced ${toAdd.length} read items from client, returning ${toSync.length} to client`);
        return {
            added: toAdd.length,
            toSync: toSync.map((item) => ({
                itemType: item.itemType,
                itemId: item.itemId,
                readAt: item.readAt,
            })),
            syncedAt: new Date().toISOString(),
        };
    }
};
exports.BookmarkService = BookmarkService;
exports.BookmarkService = BookmarkService = BookmarkService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BookmarkService);
//# sourceMappingURL=bookmark.service.js.map