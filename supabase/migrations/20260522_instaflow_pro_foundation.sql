-- InstaFlow Pro — incremental foundation (safe on existing InstaAutomate DB)
-- Run in Supabase SQL Editor after supabase_schema.sql / RUN_THIS_FIRST.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- PLANS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  price_monthly INTEGER DEFAULT 0,
  price_yearly INTEGER DEFAULT 0,
  contact_limit INTEGER DEFAULT 500,
  flow_limit INTEGER DEFAULT 3,
  messages_per_day INTEGER DEFAULT 100,
  team_members INTEGER DEFAULT 1,
  ai_replies BOOLEAN DEFAULT false,
  broadcast_campaigns BOOLEAN DEFAULT false,
  advanced_analytics BOOLEAN DEFAULT false,
  priority_support BOOLEAN DEFAULT false,
  webhook_access BOOLEAN DEFAULT false,
  api_access BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.plans (name, display_name, price_monthly, price_yearly, contact_limit, flow_limit, messages_per_day, team_members, ai_replies, broadcast_campaigns, advanced_analytics, priority_support, webhook_access, api_access)
VALUES
  ('free', 'Free', 0, 0, 500, 3, 100, 1, false, false, false, false, false, false),
  ('starter', 'Starter', 19900, 179100, -1, -1, 1000, 3, true, true, true, false, true, false),
  ('pro', 'Pro', 49900, 449100, -1, -1, -1, 10, true, true, true, true, true, true),
  ('enterprise', 'Enterprise', 0, 0, -1, -1, -1, -1, true, true, true, true, true, true)
ON CONFLICT (name) DO NOTHING;

-- ================================================================
-- ADMIN SYSTEM
-- ================================================================
CREATE TABLE IF NOT EXISTS public.admin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.admin_accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  description TEXT,
  updated_by UUID REFERENCES public.admin_accounts(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.admin_settings (key, value, description) VALUES
  ('maintenance_mode', 'false', 'Put platform in maintenance mode'),
  ('allow_signups', 'true', 'Allow new user registrations'),
  ('platform_name', '"InstaFlow Pro"', 'Platform display name')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- PROFILES — extend existing
-- ================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_name TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contacts_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS flows_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS messages_today INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS messages_today_reset TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'gpt-4o-mini';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_system_prompt TEXT DEFAULT 'You are a helpful assistant. Reply in the same language as the user. Keep responses concise and friendly.';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

UPDATE public.profiles p
SET plan_id = pl.id, plan_name = COALESCE(p.plan, 'free')
FROM public.plans pl
WHERE pl.name = COALESCE(p.plan, 'free') AND p.plan_id IS NULL;

-- ================================================================
-- FLOWS — visual builder columns (keep legacy columns)
-- ================================================================
ALTER TABLE public.flows ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.flows ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE public.flows ADD COLUMN IF NOT EXISTS trigger_config JSONB DEFAULT '{}';
ALTER TABLE public.flows ADD COLUMN IF NOT EXISTS nodes JSONB DEFAULT '[]';
ALTER TABLE public.flows ADD COLUMN IF NOT EXISTS edges JSONB DEFAULT '[]';
ALTER TABLE public.flows ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '{}';
ALTER TABLE public.flows ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE public.flows ADD COLUMN IF NOT EXISTS reply_once_cooldown INTEGER DEFAULT 24;
ALTER TABLE public.flows ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
ALTER TABLE public.flows ADD COLUMN IF NOT EXISTS run_count INTEGER DEFAULT 0;
ALTER TABLE public.flows ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0;
ALTER TABLE public.flows ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ;

-- ================================================================
-- FLOW TEMPLATES
-- ================================================================
CREATE TABLE IF NOT EXISTS public.flow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  thumbnail_url TEXT,
  nodes JSONB DEFAULT '[]',
  edges JSONB DEFAULT '[]',
  trigger_type TEXT,
  trigger_config JSONB DEFAULT '{}',
  is_featured BOOLEAN DEFAULT false,
  use_count INTEGER DEFAULT 0,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.flow_templates (name, description, category, trigger_type, trigger_config, nodes, edges, is_featured)
SELECT * FROM (VALUES
  ('Welcome New DM', 'Automatically greet anyone who DMs you for the first time', 'welcome', 'dm_first', '{}'::jsonb,
   '[{"id":"1","type":"trigger","label":"First DM","x":100,"y":200},{"id":"2","type":"send_message","label":"Send Welcome","config":{"message":"Hey {{name}}! Thanks for reaching out. How can I help you today?"},"x":350,"y":200}]'::jsonb,
   '[{"from":"1","to":"2"}]'::jsonb, true),
  ('Price Inquiry Auto Reply', 'Reply with pricing when someone asks about price', 'sales', 'dm_keyword',
   '{"keywords":["price","cost","rate"],"condition":"contains"}'::jsonb,
   '[{"id":"1","type":"trigger","label":"Keyword: price","x":100,"y":200},{"id":"2","type":"send_message","label":"Send Price Info","config":{"message":"Hi {{name}}! Here are our pricing details."},"x":350,"y":200}]'::jsonb,
   '[{"from":"1","to":"2"}]'::jsonb, true)
) AS v(name, description, category, trigger_type, trigger_config, nodes, edges, is_featured)
WHERE NOT EXISTS (SELECT 1 FROM public.flow_templates LIMIT 1);

-- ================================================================
-- CONTACTS (CRM) — extend if table exists from RUN_THIS_FIRST
-- ================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contacts') THEN
    ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
    ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS instagram_account_id UUID;
    ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS instagram_user_id TEXT;
    ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
    ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS opted_in BOOLEAN DEFAULT true;
    ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
  ELSE
    CREATE TABLE public.contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      instagram_account_id TEXT,
      instagram_user_id TEXT NOT NULL,
      username TEXT,
      name TEXT,
      avatar_url TEXT,
      tags TEXT[] DEFAULT '{}',
      custom_fields JSONB DEFAULT '{}',
      opted_in BOOLEAN DEFAULT true,
      last_message_at TIMESTAMPTZ,
      total_messages INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
    CREATE POLICY contacts_own ON public.contacts FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ================================================================
-- NOTIFICATIONS & DAILY STATS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_own ON public.notifications;
CREATE POLICY notifications_own ON public.notifications FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  instagram_account_id TEXT,
  date DATE NOT NULL,
  dms_received INTEGER DEFAULT 0,
  dms_sent INTEGER DEFAULT 0,
  auto_replies INTEGER DEFAULT 0,
  ai_replies INTEGER DEFAULT 0,
  flows_triggered INTEGER DEFAULT 0,
  new_contacts INTEGER DEFAULT 0,
  UNIQUE(user_id, instagram_account_id, date)
);

ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_stats_own ON public.daily_stats;
CREATE POLICY daily_stats_own ON public.daily_stats FOR ALL USING (auth.uid() = user_id);

-- ================================================================
-- handle_new_user — attach free plan_id
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  free_plan_id UUID;
BEGIN
  SELECT id INTO free_plan_id FROM public.plans WHERE name = 'free' LIMIT 1;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, plan, plan_id, plan_name, subscription_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'free',
    free_plan_id,
    'free',
    'inactive'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
