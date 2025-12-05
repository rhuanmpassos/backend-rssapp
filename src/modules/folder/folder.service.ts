import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';

@Injectable()
export class FolderService {
  private readonly logger = new Logger(FolderService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateFolderDto) {
    // Check if folder name already exists for this user
    const existing = await this.prisma.folder.findFirst({
      where: {
        userId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new BadRequestException('A folder with this name already exists');
    }

    // Get max order for this user
    const maxOrder = await this.prisma.folder.findFirst({
      where: { userId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const folder = await this.prisma.folder.create({
      data: {
        userId,
        name: dto.name,
        color: dto.color,
        order: (maxOrder?.order ?? -1) + 1,
      },
    });

    this.logger.log(`User ${userId} created folder: ${dto.name}`);
    return folder;
  }

  async findAll(userId: string) {
    return this.prisma.folder.findMany({
      where: { userId },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(userId: string, folderId: string) {
    const folder = await this.prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
      include: {
        subscriptions: {
          include: {
            feed: {
              select: {
                id: true,
                title: true,
                siteDomain: true,
                faviconUrl: true,
                status: true,
              },
            },
            channel: {
              select: {
                id: true,
                title: true,
                thumbnailUrl: true,
                channelId: true,
              },
            },
          },
        },
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return folder;
  }

  async update(userId: string, folderId: string, dto: UpdateFolderDto) {
    const folder = await this.prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    // If name is being updated, check for duplicates
    if (dto.name && dto.name !== folder.name) {
      const existing = await this.prisma.folder.findFirst({
        where: {
          userId,
          name: dto.name,
          id: { not: folderId },
        },
      });

      if (existing) {
        throw new BadRequestException('A folder with this name already exists');
      }
    }

    return this.prisma.folder.update({
      where: { id: folderId },
      data: {
        name: dto.name,
        color: dto.color,
        order: dto.order,
      },
    });
  }

  async delete(userId: string, folderId: string) {
    const folder = await this.prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    // Remove folder from all subscriptions (set to null)
    await this.prisma.subscription.updateMany({
      where: { folderId },
      data: { folderId: null },
    });

    await this.prisma.folder.delete({
      where: { id: folderId },
    });

    this.logger.log(`User ${userId} deleted folder: ${folder.name}`);
    return { message: 'Folder deleted successfully' };
  }

  async reorder(userId: string, folderIds: string[]) {
    // Update order for all folders
    await Promise.all(
      folderIds.map((id, index) =>
        this.prisma.folder.updateMany({
          where: {
            id,
            userId,
          },
          data: { order: index },
        }),
      ),
    );

    return { message: 'Folders reordered successfully' };
  }

  async findOrCreateFolder(userId: string, name: string) {
    let folder = await this.prisma.folder.findFirst({
      where: {
        userId,
        name,
      },
    });

    if (!folder) {
      // Get max order for this user
      const maxOrder = await this.prisma.folder.findFirst({
        where: { userId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      folder = await this.prisma.folder.create({
        data: {
          userId,
          name,
          order: (maxOrder?.order ?? -1) + 1,
        },
      });
      this.logger.log(`User ${userId} automatically created folder: ${name}`);
    }
    return folder;
  }
}

