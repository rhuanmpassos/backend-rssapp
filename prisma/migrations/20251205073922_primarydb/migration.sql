-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('site', 'youtube');

-- CreateEnum
CREATE TYPE "FeedStatus" AS ENUM ('active', 'blocked', 'error', 'pending');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('ios', 'android', 'web');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('scrape_feed', 'scrape_article', 'check_youtube', 'send_notification', 'websub_subscribe', 'websub_renew');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "preferences" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "SubscriptionType" NOT NULL,
    "target" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "feed_id" TEXT,
    "channel_id" TEXT,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feeds" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "site_domain" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "rss_url" TEXT,
    "favicon_url" TEXT,
    "last_scrape_at" TIMESTAMP(3),
    "status" "FeedStatus" NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_items" (
    "id" TEXT NOT NULL,
    "feed_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "canonical_url" TEXT,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "thumbnail_url" TEXT,
    "author" TEXT,
    "published_at" TIMESTAMP(3),
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content_hash" TEXT NOT NULL,

    CONSTRAINT "feed_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "youtube_channels" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail_url" TEXT,
    "custom_url" TEXT,
    "last_checked_at" TIMESTAMP(3),
    "websub_topic_url" TEXT,
    "websub_expires_at" TIMESTAMP(3),
    "websub_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "youtube_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "youtube_videos" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "channel_db_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail_url" TEXT,
    "duration" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "youtube_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_logs" (
    "id" TEXT NOT NULL,
    "job_type" "JobType" NOT NULL,
    "target" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "result" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_logs" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "quota" INTEGER,

    CONSTRAINT "rate_limit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "websub_subscriptions" (
    "id" TEXT NOT NULL,
    "topic_url" TEXT NOT NULL,
    "hub_url" TEXT NOT NULL,
    "callback_url" TEXT NOT NULL,
    "secret" TEXT,
    "lease_seconds" INTEGER,
    "expires_at" TIMESTAMP(3),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "websub_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_type_idx" ON "subscriptions"("type");

-- CreateIndex
CREATE INDEX "subscriptions_target_idx" ON "subscriptions"("target");

-- CreateIndex
CREATE UNIQUE INDEX "feeds_url_key" ON "feeds"("url");

-- CreateIndex
CREATE INDEX "feeds_site_domain_idx" ON "feeds"("site_domain");

-- CreateIndex
CREATE INDEX "feeds_status_idx" ON "feeds"("status");

-- CreateIndex
CREATE INDEX "feeds_last_scrape_at_idx" ON "feeds"("last_scrape_at");

-- CreateIndex
CREATE INDEX "feed_items_feed_id_idx" ON "feed_items"("feed_id");

-- CreateIndex
CREATE INDEX "feed_items_published_at_idx" ON "feed_items"("published_at");

-- CreateIndex
CREATE INDEX "feed_items_fetched_at_idx" ON "feed_items"("fetched_at");

-- CreateIndex
CREATE UNIQUE INDEX "feed_items_feed_id_content_hash_key" ON "feed_items"("feed_id", "content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "feed_items_feed_id_url_key" ON "feed_items"("feed_id", "url");

-- CreateIndex
CREATE UNIQUE INDEX "youtube_channels_channel_id_key" ON "youtube_channels"("channel_id");

-- CreateIndex
CREATE INDEX "youtube_channels_channel_id_idx" ON "youtube_channels"("channel_id");

-- CreateIndex
CREATE INDEX "youtube_channels_last_checked_at_idx" ON "youtube_channels"("last_checked_at");

-- CreateIndex
CREATE UNIQUE INDEX "youtube_videos_video_id_key" ON "youtube_videos"("video_id");

-- CreateIndex
CREATE INDEX "youtube_videos_channel_db_id_idx" ON "youtube_videos"("channel_db_id");

-- CreateIndex
CREATE INDEX "youtube_videos_published_at_idx" ON "youtube_videos"("published_at");

-- CreateIndex
CREATE INDEX "youtube_videos_fetched_at_idx" ON "youtube_videos"("fetched_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");

-- CreateIndex
CREATE INDEX "push_tokens_is_active_idx" ON "push_tokens"("is_active");

-- CreateIndex
CREATE INDEX "job_logs_job_type_idx" ON "job_logs"("job_type");

-- CreateIndex
CREATE INDEX "job_logs_status_idx" ON "job_logs"("status");

-- CreateIndex
CREATE INDEX "job_logs_target_idx" ON "job_logs"("target");

-- CreateIndex
CREATE INDEX "job_logs_created_at_idx" ON "job_logs"("created_at");

-- CreateIndex
CREATE INDEX "rate_limit_logs_service_idx" ON "rate_limit_logs"("service");

-- CreateIndex
CREATE INDEX "rate_limit_logs_period_start_idx" ON "rate_limit_logs"("period_start");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_logs_service_period_start_key" ON "rate_limit_logs"("service", "period_start");

-- CreateIndex
CREATE INDEX "websub_subscriptions_expires_at_idx" ON "websub_subscriptions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "websub_subscriptions_topic_url_callback_url_key" ON "websub_subscriptions"("topic_url", "callback_url");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "feeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "youtube_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_items" ADD CONSTRAINT "feed_items_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "youtube_videos" ADD CONSTRAINT "youtube_videos_channel_db_id_fkey" FOREIGN KEY ("channel_db_id") REFERENCES "youtube_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
