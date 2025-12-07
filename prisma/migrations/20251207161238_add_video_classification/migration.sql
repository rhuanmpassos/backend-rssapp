-- AlterTable
ALTER TABLE "youtube_videos" ADD COLUMN     "duration_secs" INTEGER,
ADD COLUMN     "is_live" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_live_content" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "video_type" TEXT;

-- CreateIndex
CREATE INDEX "youtube_videos_video_type_idx" ON "youtube_videos"("video_type");

-- CreateIndex
CREATE INDEX "youtube_videos_is_live_idx" ON "youtube_videos"("is_live");
