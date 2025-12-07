-- =============================================
-- FULL-TEXT SEARCH INDEXES (PostgreSQL GIN)
-- =============================================
-- Execute this AFTER running prisma migrate

-- Create full-text search index on feed_items for search functionality
-- Supports Portuguese language for better stemming and stopwords
CREATE INDEX IF NOT EXISTS "feed_items_search_idx" ON "feed_items" 
USING GIN (to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE(author, '')));

-- Create full-text search index on youtube_videos
CREATE INDEX IF NOT EXISTS "youtube_videos_search_idx" ON "youtube_videos" 
USING GIN (to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(description, '')));

-- Create index on user_bookmarks for search
CREATE INDEX IF NOT EXISTS "user_bookmarks_search_idx" ON "user_bookmarks"
USING GIN (to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE(source, '')));
