"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const Sentry = require("@sentry/node");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });
    const configService = app.get(config_1.ConfigService);
    const sentryDsn = configService.get('SENTRY_DSN');
    if (sentryDsn) {
        Sentry.init({
            dsn: sentryDsn,
            environment: configService.get('NODE_ENV', 'development'),
            tracesSampleRate: 0.1,
        });
    }
    app.setGlobalPrefix(configService.get('API_PREFIX', 'api/v1'));
    app.enableVersioning({
        type: common_1.VersioningType.URI,
    });
    app.enableCors({
        origin: true,
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }));
    const config = new swagger_1.DocumentBuilder()
        .setTitle('RSS Aggregator API')
        .setDescription('Backend API for RSS/YouTube news aggregator app')
        .setVersion('1.0')
        .addBearerAuth()
        .addTag('auth', 'Authentication endpoints')
        .addTag('subscriptions', 'User subscriptions management')
        .addTag('feeds', 'RSS feeds and items')
        .addTag('youtube', 'YouTube channels and videos')
        .addTag('push', 'Push notifications')
        .addTag('websub', 'WebSub callbacks')
        .addTag('admin', 'Admin endpoints')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('docs', app, document);
    const port = configService.get('PORT', 3000);
    await app.listen(port);
    console.log(`🚀 Application is running on: http://localhost:${port}`);
    console.log(`📚 Swagger docs available at: http://localhost:${port}/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map