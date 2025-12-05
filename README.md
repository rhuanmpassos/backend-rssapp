# RSS Aggregator Backend

Backend API for RSS/YouTube news aggregator mobile app.

Built with **NestJS + TypeScript + Prisma + PostgreSQL**.

## 📋 Features

- 🔐 **Authentication** - JWT-based auth with secure password hashing
- 📰 **RSS Feeds** - Auto-discovery and parsing of RSS/Atom feeds
- 🌐 **Web Scraping** - Playwright-based fallback for sites without RSS
- 📺 **YouTube Integration** - Channel subscriptions via YouTube Data API
- 🔔 **Push Notifications** - Expo Push for real-time updates
- 🔄 **WebSub** - PubSubHubbub for instant YouTube notifications
- ⚡ **Background Jobs** - Scheduled scraping and checking
- 🛡️ **Rate Limiting** - Respects robots.txt and API quotas

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis (optional, for locks and caching)

### Installation

```bash
# Clone repository
cd backend

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Copy environment file
cp env.example .env
# Edit .env with your credentials

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run start:dev
```

### Running with Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

## 📁 Project Structure

```
backend/
├── prisma/
│   └── schema.prisma       # Database schema
├── src/
│   ├── common/             # Shared modules (Prisma, Redis)
│   ├── modules/
│   │   ├── auth/           # Authentication (JWT)
│   │   ├── subscription/   # User subscriptions
│   │   ├── feed/           # RSS feeds and items
│   │   ├── youtube/        # YouTube channels and videos
│   │   ├── push/           # Push notifications
│   │   ├── websub/         # WebSub callbacks
│   │   ├── admin/          # Admin endpoints
│   │   └── health/         # Health checks
│   ├── scraper/            # Playwright + RSS parser
│   ├── jobs/               # Cron jobs
│   └── workers/            # Background worker
├── test/                   # E2E tests
├── Dockerfile              # API container
├── Dockerfile.worker       # Worker container
├── docker-compose.yml      # Local development
└── render.yaml             # Render.com blueprint
```

## 🔑 Environment Variables

See `env.example` for all required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT tokens |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key |
| `WEBSUB_CALLBACK_URL` | Public URL for WebSub callbacks |
| `EXPO_ACCESS_TOKEN` | Expo push notifications token |
| `REDIS_URL` | Redis connection string |

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login with email/password |
| GET | `/auth/me` | Get current user |

### Subscriptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/subscriptions/site` | Subscribe to website |
| POST | `/subscriptions/youtube` | Subscribe to YouTube channel |
| GET | `/subscriptions` | List user subscriptions |
| DELETE | `/subscriptions/:id` | Unsubscribe |

### Feeds

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/feeds` | List all feeds |
| GET | `/feeds/:id` | Get feed details |
| GET | `/feeds/:id/items` | List feed items |

### YouTube

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/youtube/channels` | List channels |
| GET | `/youtube/channels/:id/videos` | List channel videos |
| GET | `/youtube/quota` | Get API quota usage |

### Push Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/push/register` | Register push token |
| DELETE | `/push/unregister` | Unregister push token |

### WebSub

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/websub/callback` | Hub verification |
| POST | `/websub/callback` | Receive notifications |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/stats` | System statistics |
| POST | `/admin/feed/:id/force-scrape` | Force scrape feed |
| POST | `/admin/youtube/:id/force-check` | Force check channel |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Simple health check |
| GET | `/health/detailed` | Detailed status |

## 📝 cURL Examples

### Register User

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "SecureP@ss123"}'
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "SecureP@ss123"}'
```

### Add Site Subscription

```bash
curl -X POST http://localhost:3000/api/v1/subscriptions/site \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"url": "https://techcrunch.com"}'
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "type": "site",
  "target": "https://techcrunch.com",
  "enabled": true,
  "feed": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "title": "TechCrunch",
    "rssUrl": "https://techcrunch.com/feed/",
    "status": "active"
  }
}
```

### Add YouTube Channel

```bash
curl -X POST http://localhost:3000/api/v1/subscriptions/youtube \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"channelNameOrUrl": "@GoogleDevelopers"}'
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "type": "youtube",
  "target": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
  "channel": {
    "title": "Google Developers",
    "thumbnailUrl": "https://yt3.ggpht.com/..."
  }
}
```

### List Feed Items

```bash
curl http://localhost:3000/api/v1/feeds/FEED_ID/items?page=1&limit=20 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "feed": {
    "id": "...",
    "title": "TechCrunch"
  },
  "data": [
    {
      "id": "...",
      "url": "https://techcrunch.com/article-1",
      "title": "Breaking Tech News",
      "excerpt": "First paragraph of the article...",
      "thumbnailUrl": "https://...",
      "publishedAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Register Push Token

```bash
curl -X POST http://localhost:3000/api/v1/push/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"token": "ExponentPushToken[xxx]", "platform": "android"}'
```

### WebSub Verification (Example Response)

When hub sends verification:
```
GET /websub/callback?hub.mode=subscribe&hub.topic=...&hub.challenge=abc123
```

Server responds with:
```
abc123
```

## 🚢 Deploy to Render.com

### Option 1: Blueprint (Recommended)

1. Push code to GitHub
2. In Render dashboard, click "New" → "Blueprint"
3. Connect your repo and select `render.yaml`
4. Configure secret environment variables
5. Deploy!

### Option 2: Manual Setup

1. **Web Service (API)**
   - Build: `npm run build`
   - Start: `npm run start:prod`
   - Health check: `/api/v1/health`

2. **Background Worker**
   - Start: `npm run worker:prod`

3. **Database**
   - Use Render PostgreSQL or Supabase

4. **Environment Variables**
   - Set all variables from `env.example`

## 🧪 Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

## 📊 Monitoring

- **Health endpoint**: `/api/v1/health/detailed`
- **Sentry**: Configure `SENTRY_DSN` for error tracking
- **Logs**: JSON structured logs with jobId, feedId, url

## ⚠️ Important Notes

1. **No LLM Processing**: This backend does NOT generate summaries. It only extracts:
   - Meta description or first paragraph for news
   - Title, thumbnail, and link for YouTube videos

2. **robots.txt**: The scraper respects robots.txt and X-Robots-Tag headers

3. **YouTube Quota**: Default quota is 10,000 units/day. Monitor usage via `/youtube/quota`

4. **WebSub**: For real-time YouTube updates, ensure `WEBSUB_CALLBACK_URL` is publicly accessible

## 📄 License

MIT



