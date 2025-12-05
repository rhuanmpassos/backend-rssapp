"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobsModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const feed_cron_service_1 = require("./feed-cron.service");
const youtube_cron_service_1 = require("./youtube-cron.service");
const websub_cron_service_1 = require("./websub-cron.service");
const feed_module_1 = require("../modules/feed/feed.module");
const youtube_module_1 = require("../modules/youtube/youtube.module");
const websub_module_1 = require("../modules/websub/websub.module");
const push_module_1 = require("../modules/push/push.module");
const scraper_module_1 = require("../scraper/scraper.module");
let JobsModule = class JobsModule {
};
exports.JobsModule = JobsModule;
exports.JobsModule = JobsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            schedule_1.ScheduleModule.forRoot(),
            feed_module_1.FeedModule,
            youtube_module_1.YouTubeModule,
            websub_module_1.WebSubModule,
            push_module_1.PushModule,
            scraper_module_1.ScraperModule,
        ],
        providers: [feed_cron_service_1.FeedCronService, youtube_cron_service_1.YouTubeCronService, websub_cron_service_1.WebSubCronService],
        exports: [feed_cron_service_1.FeedCronService, youtube_cron_service_1.YouTubeCronService, websub_cron_service_1.WebSubCronService],
    })
], JobsModule);
//# sourceMappingURL=jobs.module.js.map