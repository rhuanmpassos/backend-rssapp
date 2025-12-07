import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBookmarkDto, SyncBookmarksDto } from './dto/bookmark.dto';
import { CreateReadItemDto, SyncReadItemsDto } from './dto/read-item.dto';

@Injectable()
export class BookmarkService {
  private readonly logger = new Logger(BookmarkService.name);

  constructor(private prisma: PrismaService) { }

  // =============================================
  // BOOKMARKS
  // =============================================

  async getBookmarks(userId: string, page: number = 1, limit: number = 50) {
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

  async addBookmark(userId: string, dto: CreateBookmarkDto) {
    // Upsert to handle duplicates gracefully
    const bookmark = await this.prisma.userBookmark.upsert({
      where: {
        userId_itemType_itemId: {
          userId,
          itemType: dto.itemType,
          itemId: dto.itemId,
        },
      },
      update: {
        // Update if exists (in case title/thumbnail changed)
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

  async removeBookmark(userId: string, idOrItemId: string) {
    // Try to delete by id first
    let deleted = await this.prisma.userBookmark.deleteMany({
      where: {
        id: idOrItemId,
        userId,
      },
    });

    // If not found by id, try by itemId
    if (deleted.count === 0) {
      deleted = await this.prisma.userBookmark.deleteMany({
        where: {
          itemId: idOrItemId,
          userId,
        },
      });
    }

    if (deleted.count === 0) {
      throw new NotFoundException('Bookmark not found');
    }

    return { success: true, deleted: deleted.count };
  }

  async syncBookmarks(userId: string, dto: SyncBookmarksDto) {
    const { bookmarks } = dto;

    // Get all server bookmarks for this user
    const serverBookmarks = await this.prisma.userBookmark.findMany({
      where: { userId },
    });

    // Items to add/update on server (from client)
    const toUpsert = bookmarks.filter((clientItem) => {
      const serverItem = serverBookmarks.find(
        (s) => s.itemType === clientItem.itemType && s.itemId === clientItem.itemId
      );
      // Add if not on server, or update if client version is newer
      return !serverItem || (clientItem.savedAt && new Date(clientItem.savedAt) > serverItem.savedAt);
    });

    // Items to return to client (server has, client might not)
    const toSync = serverBookmarks.filter((serverItem) => {
      const clientItem = bookmarks.find(
        (c) => c.itemType === serverItem.itemType && c.itemId === serverItem.itemId
      );
      // Return if client doesn't have it or if server version is newer
      return !clientItem || !clientItem.savedAt || serverItem.savedAt > new Date(clientItem.savedAt);
    });

    // Upsert items from client to server
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

  // =============================================
  // READ ITEMS
  // =============================================

  async getReadItems(userId: string, page: number = 1, limit: number = 100) {
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

  async markAsRead(userId: string, dto: CreateReadItemDto) {
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

  async markAsUnread(userId: string, idOrItemId: string) {
    // Try to delete by id first
    let deleted = await this.prisma.userReadItem.deleteMany({
      where: {
        id: idOrItemId,
        userId,
      },
    });

    // If not found by id, try by itemId
    if (deleted.count === 0) {
      deleted = await this.prisma.userReadItem.deleteMany({
        where: {
          itemId: idOrItemId,
          userId,
        },
      });
    }

    if (deleted.count === 0) {
      throw new NotFoundException('Read item not found');
    }

    return { success: true, deleted: deleted.count };
  }

  async syncReadItems(userId: string, dto: SyncReadItemsDto) {
    const { readItems } = dto;

    // Get all server read items for this user
    const serverReadItems = await this.prisma.userReadItem.findMany({
      where: { userId },
    });

    // Items to add on server (from client)
    const toAdd = readItems.filter((clientItem) => {
      return !serverReadItems.some(
        (s) => s.itemType === clientItem.itemType && s.itemId === clientItem.itemId
      );
    });

    // Items to return to client (server has, client doesn't)
    const toSync = serverReadItems.filter((serverItem) => {
      return !readItems.some(
        (c) => c.itemType === serverItem.itemType && c.itemId === serverItem.itemId
      );
    });

    // Add items from client to server
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
}

