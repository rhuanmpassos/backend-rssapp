/**
 * Standalone Worker Process
 * 
 * This file can be run separately from the main API server
 * to handle background jobs (scraping, YouTube checking, etc.)
 * 
 * Run with: npm run worker
 * 
 * In production, you would deploy this as a separate Render service.
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { AppModule } from '../app.module';
import { FeedCronService } from '../jobs/feed-cron.service';
import { YouTubeCronService } from '../jobs/youtube-cron.service';
import { WebSubCronService } from '../jobs/websub-cron.service';

const logger = new Logger('Worker');

async function bootstrap() {
  logger.log('Starting RSS Aggregator Worker...');

  // Create application context (no HTTP server)
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);

  // Initialize Sentry
  const sentryDsn = configService.get<string>('SENTRY_DSN');
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: configService.get<string>('NODE_ENV', 'development'),
    });
  }

  // Get cron services (they will auto-schedule when module is loaded)
  const feedCron = app.get(FeedCronService);
  const youtubeCron = app.get(YouTubeCronService);
  const websubCron = app.get(WebSubCronService);

  logger.log('Worker started successfully!');
  logger.log('Cron jobs are now active:');
  logger.log('  - Feed scraping: every 10 minutes');
  logger.log('  - Failed feeds retry: every hour');
  logger.log('  - YouTube polling: every 5 minutes');
  logger.log('  - WebSub renewal: every hour');
  logger.log('  - Job log cleanup: weekly');

  // Run initial check on startup
  logger.log('Running initial jobs...');

  try {
    await feedCron.handleFeedScraping();
    await youtubeCron.handleYouTubePolling();
  } catch (error) {
    logger.error(`Initial job run error: ${error}`);
  }

  // Keep the worker running
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



