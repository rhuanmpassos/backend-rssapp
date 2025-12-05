-- CreateTable
CREATE TABLE "custom_youtube_feeds" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "channel_id" TEXT,
    "channel_url" TEXT,
    "category_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_youtube_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_youtube_feeds_slug_key" ON "custom_youtube_feeds"("slug");

-- CreateIndex
CREATE INDEX "custom_youtube_feeds_slug_idx" ON "custom_youtube_feeds"("slug");

-- CreateIndex
CREATE INDEX "custom_youtube_feeds_category_id_idx" ON "custom_youtube_feeds"("category_id");

-- CreateIndex
CREATE INDEX "custom_youtube_feeds_channel_id_idx" ON "custom_youtube_feeds"("channel_id");

-- AddForeignKey
ALTER TABLE "custom_youtube_feeds" ADD CONSTRAINT "custom_youtube_feeds_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
