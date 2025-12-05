-- CreateTable
CREATE TABLE "custom_feeds" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_feed_items" (
    "id" TEXT NOT NULL,
    "feed_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "link" TEXT NOT NULL,
    "image_url" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_feed_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_feeds_slug_key" ON "custom_feeds"("slug");

-- CreateIndex
CREATE INDEX "custom_feeds_slug_idx" ON "custom_feeds"("slug");

-- CreateIndex
CREATE INDEX "custom_feed_items_feed_id_idx" ON "custom_feed_items"("feed_id");

-- CreateIndex
CREATE INDEX "custom_feed_items_published_at_idx" ON "custom_feed_items"("published_at");

-- AddForeignKey
ALTER TABLE "custom_feed_items" ADD CONSTRAINT "custom_feed_items_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "custom_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

