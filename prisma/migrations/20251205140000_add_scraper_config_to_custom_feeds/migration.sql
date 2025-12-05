-- AlterTable
ALTER TABLE "custom_feeds" ADD COLUMN "site_url" TEXT;
ALTER TABLE "custom_feeds" ADD COLUMN "article_selector" TEXT;
ALTER TABLE "custom_feeds" ADD COLUMN "selectors" JSONB;
