"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const throttler_1 = require("@nestjs/throttler");
const prisma_module_1 = require("./common/prisma/prisma.module");
const redis_module_1 = require("./common/redis/redis.module");
const auth_module_1 = require("./modules/auth/auth.module");
const subscription_module_1 = require("./modules/subscription/subscription.module");
const feed_module_1 = require("./modules/feed/feed.module");
const youtube_module_1 = require("./modules/youtube/youtube.module");
const push_module_1 = require("./modules/push/push.module");
const websub_module_1 = require("./modules/websub/websub.module");
const admin_module_1 = require("./modules/admin/admin.module");
const health_module_1 = require("./modules/health/health.module");
const folder_module_1 = require("./modules/folder/folder.module");
const custom_feed_module_1 = require("./modules/custom-feed/custom-feed.module");
const custom_youtube_feed_module_1 = require("./modules/custom-youtube-feed/custom-youtube-feed.module");
const bookmark_module_1 = require("./modules/bookmark/bookmark.module");
const search_module_1 = require("./modules/search/search.module");
const jobs_module_1 = require("./jobs/jobs.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env.local', '.env'],
            }),
            schedule_1.ScheduleModule.forRoot(),
            throttler_1.ThrottlerModule.forRoot([
                {
                    name: 'short',
                    ttl: 1000,
                    limit: 3,
                },
                {
                    name: 'medium',
                    ttl: 10000,
                    limit: 20,
                },
                {
                    name: 'long',
                    ttl: 60000,
                    limit: 100,
                },
            ]),
            prisma_module_1.PrismaModule,
            redis_module_1.RedisModule,
            auth_module_1.AuthModule,
            subscription_module_1.SubscriptionModule,
            feed_module_1.FeedModule,
            youtube_module_1.YouTubeModule,
            push_module_1.PushModule,
            websub_module_1.WebSubModule,
            admin_module_1.AdminModule,
            health_module_1.HealthModule,
            folder_module_1.FolderModule,
            custom_feed_module_1.CustomFeedModule,
            custom_youtube_feed_module_1.CustomYouTubeFeedModule,
            bookmark_module_1.BookmarkModule,
            search_module_1.SearchModule,
            jobs_module_1.JobsModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map