CREATE EXTENSION IF NOT EXISTS pgcrypto;

/* Migration: add Instagram tables and RLS policies */

create table instagram_messages (
  id uuid primary key default gen_random_uuid(),
  ig_user_id text not null,
  message_id text not null unique,
  conversation_id text,
  sender_id text,
  direction text check (direction in ('incoming','outgoing')),
  content text,
  timestamp timestamptz default now()
);

create table if not exists instagram_reels (
  id uuid primary key default gen_random_uuid(),
  ig_user_id text not null,
  media_id text not null unique,
  media_type text,
  media_url text,
  thumbnail_url text,
  caption text,
  timestamp timestamptz default now()
);

create table instagram_analytics (
  id uuid primary key default gen_random_uuid(),
  ig_user_id text not null,
  metric text not null,
  value numeric,
  period_start timestamptz,
  period_end timestamptz,
  fetched_at timestamptz default now(),
  unique (ig_user_id, metric, period_start, period_end)
);

-- Row Level Security temporarily disabled for development
ALTER TABLE instagram_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_reels DISABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_analytics DISABLE ROW LEVEL SECURITY;
