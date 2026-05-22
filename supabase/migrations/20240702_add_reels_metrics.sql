CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS reels_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_user_id text NOT NULL,
  total_reels integer,
  posts_per_week numeric,
  posting_streak integer,
  consistency_score numeric,
  avg_like_count numeric,
  avg_comments_count numeric,
  last_synced_at timestamptz DEFAULT now(),
  UNIQUE (ig_user_id)
);
