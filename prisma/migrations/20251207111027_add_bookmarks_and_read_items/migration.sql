-- CreateTable
CREATE TABLE "user_bookmarks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "thumbnail_url" TEXT,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_read_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_read_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_bookmarks_user_id_idx" ON "user_bookmarks"("user_id");

-- CreateIndex
CREATE INDEX "user_bookmarks_saved_at_idx" ON "user_bookmarks"("saved_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_bookmarks_user_id_item_type_item_id_key" ON "user_bookmarks"("user_id", "item_type", "item_id");

-- CreateIndex
CREATE INDEX "user_read_items_user_id_idx" ON "user_read_items"("user_id");

-- CreateIndex
CREATE INDEX "user_read_items_read_at_idx" ON "user_read_items"("read_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_read_items_user_id_item_type_item_id_key" ON "user_read_items"("user_id", "item_type", "item_id");

-- AddForeignKey
ALTER TABLE "user_bookmarks" ADD CONSTRAINT "user_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_read_items" ADD CONSTRAINT "user_read_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
