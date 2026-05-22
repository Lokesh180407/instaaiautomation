-- InstaAutomate Database Schema
-- Run this in the Supabase SQL Editor to configure your database.

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

---------------------------------------------------------
-- 1. PROFILES & USERS
---------------------------------------------------------

-- Profile table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free', -- 'free', 'starter', 'pro'
  razorpay_customer_id TEXT,
  subscription_status TEXT DEFAULT 'inactive', -- 'active', 'inactive'
  subscription_end_date TIMESTAMPTZ,
  ai_api_key TEXT,
  ai_provider TEXT DEFAULT 'openai', -- 'openai', 'anthropic', 'gemini'
  ai_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (as requested in the prompt, mirrors profiles for direct compatibility)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

---------------------------------------------------------
-- 2. INSTAGRAM ACCOUNTS
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS instagram_accounts (
  id TEXT PRIMARY KEY, -- The Instagram Business Account ID
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ig_user_id TEXT, -- Alternate column as requested by user
  page_id TEXT NOT NULL,
  page_access_token TEXT NOT NULL, -- Storing Page Access Token (does not expire)
  access_token TEXT, -- Alias for code compatibility
  token_expires_at TIMESTAMPTZ,
  username TEXT NOT NULL,
  profile_picture TEXT, -- Custom picture field
  profile_picture_url TEXT, -- Alias URL field
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  media_count INTEGER DEFAULT 0,
  account_type TEXT DEFAULT 'business',
  is_active BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active', -- Status field
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ
);

---------------------------------------------------------
-- 3. AUTOMATION FLOWS
---------------------------------------------------------

-- Table 'automation_flows' (as requested)
CREATE TABLE IF NOT EXISTS automation_flows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  flow_name TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- 'dm_keyword', 'comment_keyword', 'story_mention'
  trigger_value TEXT, -- Keyword value
  reply_type TEXT DEFAULT 'text', -- 'text', 'ai'
  reply_message TEXT,
  ai_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 'flows' (as queried by frontend JavaScript)
CREATE TABLE IF NOT EXISTS flows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  instagram_account_id TEXT REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- 'dm_keyword', 'comment_keyword', 'reel_comment', 'story_mention'
  trigger_keywords TEXT[],
  trigger_condition TEXT DEFAULT 'contains', -- 'contains', 'exact', 'starts_with'
  response_type TEXT DEFAULT 'text', -- 'text', 'ai', 'template'
  response_message TEXT,
  template_id UUID,
  ai_system_prompt TEXT,
  is_active BOOLEAN DEFAULT true,
  match_case_sensitive BOOLEAN DEFAULT false,
  reply_once_per_user BOOLEAN DEFAULT true,
  comment_response_text TEXT, -- Optional text to reply to public comment
  instagram_media_id TEXT, -- Target specific media
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

---------------------------------------------------------
-- 4. MESSAGE TEMPLATES
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT, -- 'image', 'video'
  variables TEXT[], -- e.g., ['username', 'name']
  created_at TIMESTAMPTZ DEFAULT NOW()
);

---------------------------------------------------------
-- 5. CONVERSATIONS & MESSAGES
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instagram_account_id TEXT REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL, -- Instagram Scoped User ID of sender
  participant_instagram_id TEXT NOT NULL,
  participant_username TEXT,
  participant_name TEXT,
  participant_avatar TEXT,
  is_follower BOOLEAN DEFAULT false,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  unread_count INTEGER DEFAULT 0,
  ai_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instagram_account_id, conversation_id)
);

-- Table 'messages' (Unified to support both custom schemas and flow operations)
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id TEXT, -- Sender ID (for direct mapping)
  message_text TEXT, -- Raw text field
  is_ai_reply BOOLEAN DEFAULT false,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  message_id TEXT UNIQUE NOT NULL,
  direction TEXT NOT NULL, -- 'incoming', 'outgoing'
  content TEXT,
  message_type TEXT DEFAULT 'text', -- 'text', 'image', 'video'
  media_url TEXT,
  is_auto_reply BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

---------------------------------------------------------
-- 6. CAMPAIGNS & REELS
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  instagram_account_id TEXT REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  target TEXT DEFAULT 'followers', -- 'followers', 'custom'
  target_user_ids TEXT[],
  link TEXT,
  status TEXT DEFAULT 'draft', -- 'draft', 'scheduled', 'sending', 'completed', 'paused'
  sent_count INTEGER DEFAULT 0,
  total_targets INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS instagram_reels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instagram_account_id TEXT REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  instagram_media_id TEXT UNIQUE NOT NULL,
  media_type TEXT,
  media_url TEXT,
  permalink TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  comments_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

---------------------------------------------------------
-- 7. ANALYTICS
---------------------------------------------------------

-- Custom analytics table (requested)
CREATE TABLE IF NOT EXISTS analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  messages_sent INTEGER DEFAULT 0,
  comments_replied INTEGER DEFAULT 0,
  ai_replies INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics events (used by analytics engine)
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instagram_account_id TEXT REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'dm_received', 'dm_sent', 'comment_received', 'flow_triggered'
  flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

---------------------------------------------------------
-- 8. WEBHOOK EVENT LOGS
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instagram_account_id TEXT,
  event_type TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  error TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

---------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
---------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- 1. Profiles & Users
CREATE POLICY "Allow users to view/edit their own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Allow users to view/edit their own user record" ON users
  FOR ALL USING (auth.uid() = id);

-- 2. Instagram Accounts
CREATE POLICY "Allow users to manage their connected IG accounts" ON instagram_accounts
  FOR ALL USING (auth.uid() = user_id);

-- 3. Automation Flows
CREATE POLICY "Allow users to manage their automation flows" ON automation_flows
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Allow users to manage flows" ON flows
  FOR ALL USING (auth.uid() = user_id);

-- 4. Templates
CREATE POLICY "Allow users to manage their templates" ON templates
  FOR ALL USING (auth.uid() = user_id);

-- 5. Conversations & Messages
CREATE POLICY "Allow users to view conversations from their accounts" ON conversations
  FOR ALL USING (
    instagram_account_id IN (
      SELECT id FROM instagram_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Allow users to view messages from their conversations" ON messages
  FOR ALL USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN instagram_accounts ia ON c.instagram_account_id = ia.id
      WHERE ia.user_id = auth.uid()
    )
  );

-- 6. Campaigns & Reels
CREATE POLICY "Allow users to manage their campaigns" ON campaigns
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Allow users to view reels from their accounts" ON instagram_reels
  FOR ALL USING (
    instagram_account_id IN (
      SELECT id FROM instagram_accounts WHERE user_id = auth.uid()
    )
  );

-- 7. Analytics
CREATE POLICY "Allow users to view their analytics" ON analytics
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Allow users to view analytics events" ON analytics_events
  FOR ALL USING (
    instagram_account_id IN (
      SELECT id FROM instagram_accounts WHERE user_id = auth.uid()
    )
  );

-- 8. Webhook Logs (Restricted to service-role or webhook handlers, but let users see for debugging)
CREATE POLICY "Allow users to view webhook logs for their accounts" ON webhook_logs
  FOR SELECT USING (
    instagram_account_id IN (
      SELECT id FROM instagram_accounts WHERE user_id = auth.uid()
    )
  );

---------------------------------------------------------
-- TRIGGERS FOR PROFILE CREATION ON USER SIGNUP
---------------------------------------------------------

-- Automatically create a profile and user entry when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, email, full_name, avatar_url, plan, subscription_status)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    'free',
    'inactive'
  );

  -- Insert into users
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);

  -- Initialize analytics
  INSERT INTO public.analytics (user_id, messages_sent, comments_replied, ai_replies)
  VALUES (new.id, 0, 0, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute on auth.users row creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

---------------------------------------------------------
-- INDEXES FOR PERFORMANCE OPTIMIZATION
---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_instagram_accounts_user ON instagram_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_flows_user ON flows(user_id);
CREATE INDEX IF NOT EXISTS idx_flows_ig_account ON flows(instagram_account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_account ON conversations(instagram_account_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_account ON analytics_events(instagram_account_id);
CREATE INDEX IF NOT EXISTS idx_reels_account ON instagram_reels(instagram_account_id);
