-- ============================================================
-- RUN THIS IN SUPABASE SQL EDITOR (fixes manual connect errors)
-- Project: ssuqvxfgraphgcnybxcj
-- ============================================================

-- 1) Simple config table (app uses this OR instagram_accounts)
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
CREATE POLICY "authenticated_all" ON public.instagram_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2) Link YOUR Instagram to YOUR login (lokeshreddy180407@gmail.com)
UPDATE public.instagram_accounts
SET
  user_id = 'b2e67d3a-baca-402b-aa74-d173f4e8cf5a',
  instagram_user_id = '1286299316995794',
  username = 'lokesh180407',
  access_token = 'PASTE_YOUR_ACCESS_TOKEN_HERE',
  is_active = true,
  profile_picture_url = COALESCE(profile_picture_url, 'https://ui-avatars.com/api/?name=lokesh180407&background=E1306C&color=fff'),
  connected_at = NOW()
WHERE instagram_user_id = '1286299316995794'
   OR id = 'c0a80101-0000-0000-0000-000000000001'::uuid;

-- If no row updated, insert one for your user
INSERT INTO public.instagram_accounts (
  user_id, instagram_user_id, username, access_token, is_active, profile_picture_url
)
SELECT
  'b2e67d3a-baca-402b-aa74-d173f4e8cf5a',
  '1286299316995794',
  'lokesh180407',
  'PASTE_YOUR_ACCESS_TOKEN_HERE',
  true,
  'https://ui-avatars.com/api/?name=lokesh180407&background=E1306C&color=fff'
WHERE NOT EXISTS (
  SELECT 1 FROM public.instagram_accounts
  WHERE user_id = 'b2e67d3a-baca-402b-aa74-d173f4e8cf5a'
);

-- 3) Mirror into instagram_config (single row)
INSERT INTO public.instagram_config (
  id, instagram_account_id, meta_app_id, long_lived_token,
  page_id, page_access_token, username, connected
)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '1286299316995794',
  '1503208814932037',
  access_token,
  '1286299316995794',
  access_token,
  username,
  true
FROM public.instagram_accounts
WHERE user_id = 'b2e67d3a-baca-402b-aa74-d173f4e8cf5a'
LIMIT 1
ON CONFLICT (id) DO UPDATE SET
  instagram_account_id = EXCLUDED.instagram_account_id,
  long_lived_token = EXCLUDED.long_lived_token,
  username = EXCLUDED.username,
  connected = true,
  updated_at = NOW();

-- 4) Sample automation flow
INSERT INTO public.flows (user_id, name, trigger_type, trigger_keywords, response_message, is_active)
SELECT
  'b2e67d3a-baca-402b-aa74-d173f4e8cf5a',
  'Price DM Reply',
  'dm_keyword',
  ARRAY['price', 'cost', 'rate'],
  'Thanks for reaching out! Our price starts at ₹999. Reply HELP for more.',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.flows WHERE user_id = 'b2e67d3a-baca-402b-aa74-d173f4e8cf5a' LIMIT 1
);

-- ============================================================
-- Bootstrap missing tables expected by Edge Functions
-- (Phase A: align schema with code, source-of-truth = supabase_schema.sql)
-- ============================================================

-- ai_settings (used by instagram-webhook callAI)
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'openai',
  api_key TEXT,
  openai_key TEXT,
  gemini_key TEXT,
  claude_key TEXT,
  system_prompt TEXT,
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_settings' AND policyname='ai_settings_select_own'
  ) THEN
    CREATE POLICY ai_settings_select_own
      ON public.ai_settings FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_settings' AND policyname='ai_settings_write_own'
  ) THEN
    CREATE POLICY ai_settings_write_own
      ON public.ai_settings FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- reels_cache (used by instagram-sync)
CREATE TABLE IF NOT EXISTS public.reels_cache (
  instagram_media_id TEXT PRIMARY KEY,
  ig_user_id TEXT,
  media_type TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  permalink TEXT,
  caption TEXT,
  like_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reels_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS reels_cache_select_own
  ON public.reels_cache FOR SELECT
  USING (
    ig_user_id IN (SELECT instagram_user_id::text FROM public.instagram_accounts WHERE user_id = auth.uid())
  );

-- instagram_analytics (used by instagram-sync)
CREATE TABLE IF NOT EXISTS public.instagram_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_user_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  value NUMERIC,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ig_user_id, metric, period_start, period_end)
);

ALTER TABLE public.instagram_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS instagram_analytics_select_own
  ON public.instagram_analytics FOR SELECT
  USING (
    ig_user_id IN (SELECT instagram_user_id::text FROM public.instagram_accounts WHERE user_id = auth.uid())
  );

-- contacts + event_queue (optional but needed by flow-webhook/flow-executor)
-- If you are not using flow-webhook currently, we still create them to avoid runtime failures.
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_user_id TEXT UNIQUE NOT NULL,
  bot_id TEXT,
  last_interaction_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS contacts_select_own
  ON public.contacts FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS public.event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.event_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS event_queue_select_own
  ON public.event_queue FOR SELECT
  USING (true);

-- ============================================================
-- Verify
SELECT 'instagram_accounts' AS t, id, user_id, instagram_user_id, username, is_active FROM public.instagram_accounts WHERE user_id = 'b2e67d3a-baca-402b-aa74-d173f4e8cf5a';
SELECT 'instagram_config' AS t, * FROM public.instagram_config;
SELECT 'flows' AS t, id, name, trigger_keywords, is_active FROM public.flows WHERE user_id = 'b2e67d3a-baca-402b-aa74-d173f4e8cf5a';

