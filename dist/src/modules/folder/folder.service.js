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
var FolderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FolderService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let FolderService = FolderService_1 = class FolderService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(FolderService_1.name);
    }
    async create(userId, dto) {
        const existing = await this.prisma.folder.findFirst({
            where: {
                userId,
                name: dto.name,
            },
        });
        if (existing) {
            throw new common_1.BadRequestException('A folder with this name already exists');
        }
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
    async findAll(userId) {
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
    async findOne(userId, folderId) {
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
            throw new common_1.NotFoundException('Folder not found');
        }
        return folder;
    }
    async update(userId, folderId, dto) {
        const folder = await this.prisma.folder.findFirst({
            where: {
                id: folderId,
                userId,
            },
        });
        if (!folder) {
            throw new common_1.NotFoundException('Folder not found');
        }
        if (dto.name && dto.name !== folder.name) {
            const existing = await this.prisma.folder.findFirst({
                where: {
                    userId,
                    name: dto.name,
                    id: { not: folderId },
                },
            });
            if (existing) {
                throw new common_1.BadRequestException('A folder with this name already exists');
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
    async delete(userId, folderId) {
        const folder = await this.prisma.folder.findFirst({
            where: {
                id: folderId,
                userId,
            },
        });
        if (!folder) {
            throw new common_1.NotFoundException('Folder not found');
        }
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
    async reorder(userId, folderIds) {
        await Promise.all(folderIds.map((id, index) => this.prisma.folder.updateMany({
            where: {
                id,
                userId,
            },
            data: { order: index },
        })));
        return { message: 'Folders reordered successfully' };
    }
    async findOrCreateFolder(userId, name) {
        let folder = await this.prisma.folder.findFirst({
            where: {
                userId,
                name,
            },
        });
        if (!folder) {
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
};
exports.FolderService = FolderService;
exports.FolderService = FolderService = FolderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FolderService);
//# sourceMappingURL=folder.service.js.map