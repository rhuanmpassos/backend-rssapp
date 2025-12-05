import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('RSS Aggregator API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api/v1');

    await app.init();

    prisma = app.get(PrismaService);

    // Clean database before tests
    if (process.env.NODE_ENV !== 'production') {
      await prisma.feedItem.deleteMany();
      await prisma.subscription.deleteMany();
      await prisma.feed.deleteMany();
      await prisma.youTubeVideo.deleteMany();
      await prisma.youTubeChannel.deleteMany();
      await prisma.pushToken.deleteMany();
      await prisma.user.deleteMany();
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('/api/v1/health (GET)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('uptime');
        });
    });

    it('/api/v1/health/detailed (GET)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/detailed')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('services');
          expect(res.body.services).toHaveProperty('database');
        });
    });
  });

  describe('Authentication', () => {
    const testUser = {
      email: 'test@example.com',
      password: 'TestPass123',
    };

    it('/api/v1/auth/register (POST) - should register new user', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user.email).toBe(testUser.email);
          authToken = res.body.accessToken;
        });
    });

    it('/api/v1/auth/register (POST) - should fail with existing email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('/api/v1/auth/login (POST) - should login existing user', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(testUser)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body.user.email).toBe(testUser.email);
        });
    });

    it('/api/v1/auth/login (POST) - should fail with wrong password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: 'wrong' })
        .expect(401);
    });

    it('/api/v1/auth/me (GET) - should return current user', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toBe(testUser.email);
        });
    });

    it('/api/v1/auth/me (GET) - should fail without token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);
    });
  });

  describe('Subscriptions', () => {
    it('/api/v1/subscriptions/site (POST) - should create site subscription', () => {
      return request(app.getHttpServer())
        .post('/api/v1/subscriptions/site')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://example.com' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.type).toBe('site');
          expect(res.body.target).toBe('https://example.com');
        });
    });

    it('/api/v1/subscriptions/site (POST) - should fail with invalid URL', () => {
      return request(app.getHttpServer())
        .post('/api/v1/subscriptions/site')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'not-a-valid-url' })
        .expect(400);
    });

    it('/api/v1/subscriptions (GET) - should list user subscriptions', () => {
      return request(app.getHttpServer())
        .get('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBeGreaterThan(0);
        });
    });
  });

  describe('Feeds', () => {
    it('/api/v1/feeds (GET) - should list feeds', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feeds')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
        });
    });
  });
});



