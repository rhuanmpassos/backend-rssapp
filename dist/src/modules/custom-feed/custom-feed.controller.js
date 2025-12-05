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
exports.CustomFeedController = void 0;
const common_1 = require("@nestjs/common");
const custom_feed_service_1 = require("./custom-feed.service");
const create_custom_feed_dto_1 = require("./dto/create-custom-feed.dto");
const update_custom_feed_dto_1 = require("./dto/update-custom-feed.dto");
const create_custom_feed_item_dto_1 = require("./dto/create-custom-feed-item.dto");
const public_decorator_1 = require("../auth/decorators/public.decorator");
let CustomFeedController = class CustomFeedController {
    constructor(customFeedService) {
        this.customFeedService = customFeedService;
    }
    create(dto) {
        return this.customFeedService.create(dto);
    }
    findAll() {
        return this.customFeedService.findAll();
    }
    findPublicFeeds() {
        return this.customFeedService.findPublicFeeds();
    }
    searchPublicFeeds(query) {
        return this.customFeedService.searchPublicFeeds(query);
    }
    findOne(slug) {
        return this.customFeedService.findOne(slug);
    }
    async getRssXml(slug, res) {
        try {
            const xml = await this.customFeedService.getRssXml(slug);
            res.setHeader('Content-Type', 'application/xml');
            res.send(xml);
        }
        catch (error) {
            res.status(404).json({ message: 'Feed not found' });
        }
    }
    update(id, dto) {
        return this.customFeedService.update(id, dto);
    }
    delete(id) {
        return this.customFeedService.delete(id);
    }
    addItem(id, dto) {
        return this.customFeedService.addItem(id, dto);
    }
    updateItem(itemId, dto) {
        return this.customFeedService.updateItem(itemId, dto);
    }
    deleteItem(itemId) {
        return this.customFeedService.deleteItem(itemId);
    }
    getCategories() {
        return this.customFeedService.getCategories();
    }
    createCategory(body) {
        return this.customFeedService.createCategory(body.name);
    }
};
exports.CustomFeedController = CustomFeedController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_custom_feed_dto_1.CreateCustomFeedDto]),
    __metadata("design:returntype", void 0)
], CustomFeedController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomFeedController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('public'),
    (0, public_decorator_1.Public)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomFeedController.prototype, "findPublicFeeds", null);
__decorate([
    (0, common_1.Get)('public/search'),
    (0, public_decorator_1.Public)(),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CustomFeedController.prototype, "searchPublicFeeds", null);
__decorate([
    (0, common_1.Get)(':slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CustomFeedController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':slug/rss.xml'),
    (0, public_decorator_1.Public)(),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CustomFeedController.prototype, "getRssXml", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_custom_feed_dto_1.UpdateCustomFeedDto]),
    __metadata("design:returntype", void 0)
], CustomFeedController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CustomFeedController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)(':id/items'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_custom_feed_item_dto_1.CreateCustomFeedItemDto]),
    __metadata("design:returntype", void 0)
], CustomFeedController.prototype, "addItem", null);
__decorate([
    (0, common_1.Put)('items/:itemId'),
    __param(0, (0, common_1.Param)('itemId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CustomFeedController.prototype, "updateItem", null);
__decorate([
    (0, common_1.Delete)('items/:itemId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('itemId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CustomFeedController.prototype, "deleteItem", null);
__decorate([
    (0, common_1.Get)('categories/all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomFeedController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Post)('categories'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CustomFeedController.prototype, "createCategory", null);
exports.CustomFeedController = CustomFeedController = __decorate([
    (0, common_1.Controller)('custom-feeds'),
    __metadata("design:paramtypes", [custom_feed_service_1.CustomFeedService])
], CustomFeedController);
//# sourceMappingURL=custom-feed.controller.js.map