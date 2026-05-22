-- InstaAutomate schema (matches live Supabase + optional instagram_config)
-- Prefer RUN_THIS_FIRST.sql if manual connect fails

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.instagram_config (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  instagram_account_id TEXT NOT NULL,
  meta_app_id TEXT,
  meta_app_secret TEXT,
  long_lived_token TEXT NOT NULL,
  page_id TEXT,
  page_access_token TEXT,
  username TEXT,
  profile_picture_url TEXT,
  followers_count INTEGER DEFAULT 0,
  connected BOOLEAN DEFAULT true,
  token_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.instagram_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all" ON public.instagram_config;
CREATE POLICY "authenticated_all" ON public.instagram_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- instagram_accounts is created by supabase_schema.sql (production)
-- flows, messages, templates already exist in your project
