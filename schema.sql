-- SocialSyncs Database Schema for HTML/CSS/JS App
-- Run this in your Supabase SQL Editor

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Platform Credentials
CREATE TABLE public.platform_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

ALTER TABLE public.platform_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credentials"
  ON public.platform_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials"
  ON public.platform_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials"
  ON public.platform_credentials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials"
  ON public.platform_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- Posts
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  post_type TEXT NOT NULL,
  caption TEXT,
  media_urls TEXT[] NOT NULL DEFAULT '{}',
  cover_url TEXT,
  audio_name TEXT,
  container_id TEXT,
  published_media_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'finished', 'published', 'error')),
  error_message TEXT,
  platform_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own posts"
  ON public.posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create posts"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON public.posts FOR UPDATE
  USING (auth.uid() = user_id);

-- OAuth Connections
CREATE TABLE public.platform_oauth_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  account_id TEXT NOT NULL,
  account_title TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  access_token_encrypted TEXT,
  token_expiry TIMESTAMPTZ,
  oauth_provider TEXT NOT NULL CHECK (oauth_provider IN ('system', 'custom')),
  client_id_used TEXT NOT NULL,
  client_secret_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'disconnected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, platform)
);

ALTER TABLE public.platform_oauth_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own platform oauth connections"
  ON public.platform_oauth_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own platform oauth connections"
  ON public.platform_oauth_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own platform oauth connections"
  ON public.platform_oauth_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own platform oauth connections"
  ON public.platform_oauth_connections FOR DELETE
  USING (auth.uid() = user_id);

-- User Media Gallery
CREATE TABLE public.user_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  media_type TEXT NOT NULL,
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  duration_seconds NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own media"
  ON public.user_media FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own media"
  ON public.user_media FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own media"
  ON public.user_media FOR DELETE
  USING (auth.uid() = user_id);

-- YouTube Videos
CREATE TABLE public.youtube_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ,
  transcript TEXT,
  transcript_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, video_id)
);

ALTER TABLE public.youtube_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own youtube videos"
  ON public.youtube_videos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own youtube videos"
  ON public.youtube_videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own youtube videos"
  ON public.youtube_videos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own youtube videos"
  ON public.youtube_videos FOR DELETE
  USING (auth.uid() = user_id);

-- YouTube Automation Configs
CREATE TABLE public.youtube_automation_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  auto_post BOOLEAN NOT NULL DEFAULT FALSE,
  like_comments BOOLEAN NOT NULL DEFAULT FALSE,
  system_prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, video_id)
);

ALTER TABLE public.youtube_automation_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own youtube configs"
  ON public.youtube_automation_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own youtube configs"
  ON public.youtube_automation_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own youtube configs"
  ON public.youtube_automation_configs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own youtube configs"
  ON public.youtube_automation_configs FOR DELETE
  USING (auth.uid() = user_id);

-- YouTube Comment Replies
CREATE TABLE public.youtube_comment_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  comment_id TEXT NOT NULL UNIQUE,
  comment_text TEXT NOT NULL,
  author_name TEXT,
  ai_reply TEXT,
  timestamp_reference TEXT,
  should_like BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'posted', 'skipped', 'liked_only')),
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.youtube_comment_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own youtube replies"
  ON public.youtube_comment_replies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own youtube replies"
  ON public.youtube_comment_replies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own youtube replies"
  ON public.youtube_comment_replies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own youtube replies"
  ON public.youtube_comment_replies FOR DELETE
  USING (auth.uid() = user_id);

-- User API Keys
CREATE TABLE public.user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api keys"
  ON public.user_api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api keys"
  ON public.user_api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api keys"
  ON public.user_api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own api keys"
  ON public.user_api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_status ON public.posts(status);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_posts_user_platform ON public.posts(user_id, platform);
CREATE INDEX idx_credentials_user_id ON public.platform_credentials(user_id);
CREATE INDEX idx_platform_oauth_connections_user_platform ON public.platform_oauth_connections(user_id, platform);
CREATE INDEX idx_platform_oauth_connections_status ON public.platform_oauth_connections(status);
CREATE INDEX idx_user_media_user_id ON public.user_media(user_id);
CREATE INDEX idx_youtube_videos_user_video ON public.youtube_videos(user_id, video_id);
CREATE INDEX idx_youtube_videos_created_at ON public.youtube_videos(created_at DESC);
CREATE INDEX idx_youtube_automation_configs_user_video ON public.youtube_automation_configs(user_id, video_id);
CREATE INDEX idx_youtube_comment_replies_user_video ON public.youtube_comment_replies(user_id, video_id);
CREATE INDEX idx_youtube_comment_replies_status ON public.youtube_comment_replies(status);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER credentials_updated_at
  BEFORE UPDATE ON public.platform_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER platform_oauth_connections_updated_at
  BEFORE UPDATE ON public.platform_oauth_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER youtube_automation_configs_updated_at
  BEFORE UPDATE ON public.youtube_automation_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Storage bucket for post media
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'post-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Public read on post-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-media');

CREATE POLICY "Users delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'post-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );