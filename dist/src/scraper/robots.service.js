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
var RobotsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RobotsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const robots_parser_1 = require("robots-parser");
let RobotsService = RobotsService_1 = class RobotsService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(RobotsService_1.name);
        this.cache = new Map();
        this.cacheTTL = 60 * 60 * 1000;
        this.userAgent = this.configService.get('USER_AGENT', 'RSSApp/1.0 (+https://github.com/rssapp)');
    }
    async isAllowed(url) {
        try {
            const parsedUrl = new URL(url);
            const origin = parsedUrl.origin;
            const pathname = parsedUrl.pathname;
            const robots = await this.getRobots(origin);
            if (!robots) {
                return true;
            }
            return robots.isAllowed(pathname, this.userAgent) ?? true;
        }
        catch (error) {
            this.logger.warn(`Error checking robots.txt for ${url}: ${error}`);
            return true;
        }
    }
    async getCrawlDelay(url) {
        try {
            const parsedUrl = new URL(url);
            const robots = await this.getRobots(parsedUrl.origin);
            if (!robots) {
                return 0;
            }
            const delay = robots.getCrawlDelay(this.userAgent);
            return delay ? delay * 1000 : 0;
        }
        catch {
            return 0;
        }
    }
    async getSitemaps(url) {
        try {
            const parsedUrl = new URL(url);
            const robots = await this.getRobots(parsedUrl.origin);
            if (!robots) {
                return [];
            }
            return robots.getSitemaps();
        }
        catch {
            return [];
        }
    }
    async getRobots(origin) {
        const cached = this.cache.get(origin);
        if (cached && Date.now() - cached.fetchedAt.getTime() < this.cacheTTL) {
            return cached.robots;
        }
        try {
            const robotsUrl = `${origin}/robots.txt`;
            const response = await fetch(robotsUrl, {
                headers: {
                    'User-Agent': this.userAgent,
                },
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok) {
                this.cache.set(origin, {
                    robots: (0, robots_parser_1.default)(robotsUrl, ''),
                    fetchedAt: new Date(),
                });
                return null;
            }
            const text = await response.text();
            const robots = (0, robots_parser_1.default)(robotsUrl, text);
            this.cache.set(origin, {
                robots,
                fetchedAt: new Date(),
            });
            return robots;
        }
        catch (error) {
            this.logger.debug(`Failed to fetch robots.txt for ${origin}: ${error}`);
            return null;
        }
    }
    clearCache() {
        this.cache.clear();
    }
};
exports.RobotsService = RobotsService;
exports.RobotsService = RobotsService = RobotsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RobotsService);
//# sourceMappingURL=robots.service.js.map