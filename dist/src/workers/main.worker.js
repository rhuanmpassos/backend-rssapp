"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const Sentry = require("@sentry/node");
const app_module_1 = require("../app.module");
const feed_cron_service_1 = require("../jobs/feed-cron.service");
const youtube_cron_service_1 = require("../jobs/youtube-cron.service");
const websub_cron_service_1 = require("../jobs/websub-cron.service");
const logger = new common_1.Logger('Worker');
async function bootstrap() {
    logger.log('Starting RSS Aggregator Worker...');
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log'],
    });
    const configService = app.get(config_1.ConfigService);
    const sentryDsn = configService.get('SENTRY_DSN');
    if (sentryDsn) {
        Sentry.init({
            dsn: sentryDsn,
            environment: configService.get('NODE_ENV', 'development'),
        });
    }
    const feedCron = app.get(feed_cron_service_1.FeedCronService);
    const youtubeCron = app.get(youtube_cron_service_1.YouTubeCronService);
    const websubCron = app.get(websub_cron_service_1.WebSubCronService);
    logger.log('Worker started successfully!');
    logger.log('Cron jobs are now active:');
    logger.log('  - Feed scraping: every 10 minutes');
    logger.log('  - Failed feeds retry: every hour');
    logger.log('  - YouTube polling: every 5 minutes');
    logger.log('  - WebSub renewal: every hour');
    logger.log('  - Job log cleanup: weekly');
    logger.log('Running initial jobs...');
    try {
        await feedCron.handleFeedScraping();
        await youtubeCron.handleYouTubePolling();
    }
    catch (error) {
        logger.error(`Initial job run error: ${error}`);
    }
    process.on('SIGTERM', async () => {
        logger.log('Received SIGTERM, shutting down...');
        await app.close();
        process.exit(0);
    });
    process.on('SIGINT', async () => {
        logger.log('Received SIGINT, shutting down...');
        await app.close();
        process.exit(0);
    });
}
bootstrap().catch((err) => {
    logger.error(`Worker failed to start: ${err}`);
    process.exit(1);
});
//# sourceMappingURL=main.worker.js.map