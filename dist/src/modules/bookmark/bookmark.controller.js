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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookmarkController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const bookmark_service_1 = require("./bookmark.service");
const bookmark_dto_1 = require("./dto/bookmark.dto");
const read_item_dto_1 = require("./dto/read-item.dto");
let BookmarkController = class BookmarkController {
    constructor(bookmarkService) {
        this.bookmarkService = bookmarkService;
    }
    async getBookmarks(req, page = '1', limit = '50') {
        return this.bookmarkService.getBookmarks(req.user.id, parseInt(page), parseInt(limit));
    }
    async addBookmark(req, dto) {
        return this.bookmarkService.addBookmark(req.user.id, dto);
    }
    async removeBookmark(req, id) {
        return this.bookmarkService.removeBookmark(req.user.id, id);
    }
    async syncBookmarks(req, dto) {
        return this.bookmarkService.syncBookmarks(req.user.id, dto);
    }
    async getReadItems(req, page = '1', limit = '100') {
        return this.bookmarkService.getReadItems(req.user.id, parseInt(page), parseInt(limit));
    }
    async markAsRead(req, dto) {
        return this.bookmarkService.markAsRead(req.user.id, dto);
    }
    async markAsUnread(req, id) {
        return this.bookmarkService.markAsUnread(req.user.id, id);
    }
    async syncReadItems(req, dto) {
        return this.bookmarkService.syncReadItems(req.user.id, dto);
    }
};
exports.BookmarkController = BookmarkController;
__decorate([
    (0, common_1.Get)('bookmarks'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], BookmarkController.prototype, "getBookmarks", null);
__decorate([
    (0, common_1.Post)('bookmarks'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bookmark_dto_1.CreateBookmarkDto]),
    __metadata("design:returntype", Promise)
], BookmarkController.prototype, "addBookmark", null);
__decorate([
    (0, common_1.Delete)('bookmarks/:id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BookmarkController.prototype, "removeBookmark", null);
__decorate([
    (0, common_1.Post)('bookmarks/sync'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bookmark_dto_1.SyncBookmarksDto]),
    __metadata("design:returntype", Promise)
], BookmarkController.prototype, "syncBookmarks", null);
__decorate([
    (0, common_1.Get)('read-items'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], BookmarkController.prototype, "getReadItems", null);
__decorate([
    (0, common_1.Post)('read-items'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, read_item_dto_1.CreateReadItemDto]),
    __metadata("design:returntype", Promise)
], BookmarkController.prototype, "markAsRead", null);
__decorate([
    (0, common_1.Delete)('read-items/:id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BookmarkController.prototype, "markAsUnread", null);
__decorate([
    (0, common_1.Post)('read-items/sync'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, read_item_dto_1.SyncReadItemsDto]),
    __metadata("design:returntype", Promise)
], BookmarkController.prototype, "syncReadItems", null);
exports.BookmarkController = BookmarkController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [bookmark_service_1.BookmarkService])
], BookmarkController);
//# sourceMappingURL=bookmark.controller.js.map