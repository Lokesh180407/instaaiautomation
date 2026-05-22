CREATE EXTENSION IF NOT EXISTS pgcrypto;

create table if not exists reels_cache (
  id uuid primary key default gen_random_uuid(),
  ig_user_id text not null,
  instagram_media_id text not null unique,
  caption text,
  media_url text,
  thumbnail_url text,
  permalink text,
  like_count int,
  comments_count int,
  timestamp timestamptz,
  synced_at timestamptz default now()
);

-- RLS temporarily disabled for development
ALTER TABLE reels_cache DISABLE ROW LEVEL SECURITY;;
