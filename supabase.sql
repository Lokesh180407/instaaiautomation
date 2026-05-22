/* Supabase PostgreSQL schema */

-- Enable RLS for all tables
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;';
  EXECUTE 'ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;';
  EXECUTE 'ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;';
  EXECUTE 'ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;';
  EXECUTE 'ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;';
  EXECUTE 'ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;';
  EXECUTE 'ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;';
  EXECUTE 'ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;';
END $$;

-- Profiles (users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now()
);

-- Instagram accounts linked to a user
CREATE TABLE instagram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  ig_user_id text NOT NULL,
  page_id text NOT NULL,
  page_access_token text NOT NULL,
  long_lived_token text NOT NULL,
  token_expires_at timestamp with time zone NOT NULL,
  username text,
  profile_picture text,
  connected_at timestamp with time zone DEFAULT now()
);

-- Automation flows
CREATE TABLE flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL, -- e.g., keyword, comment, dm
  trigger_value text,
  response_type text NOT NULL, -- text, ai, template
  response_message text,
  ai_enabled boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Messages (sent/received)
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id text NOT NULL,
  sender_username text,
  message_text text NOT NULL,
  direction text NOT NULL, -- inbound / outbound
  ai_generated boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Conversations (DM threads)
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  instagram_user_id text NOT NULL,
  username text,
  last_message text,
  unread_count integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now()
);

-- Message templates
CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  message_content text NOT NULL
);

-- Analytics summary per user
CREATE TABLE analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  messages_sent integer DEFAULT 0,
  comments_replied integer DEFAULT 0,
  ai_replies integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- AI provider settings per user
CREATE TABLE ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  provider text NOT NULL, -- openai, gemini, claude
  api_key text NOT NULL,
  enabled boolean DEFAULT true
);

-- RLS policies (example for instagram_accounts – user can only access own)
CREATE POLICY "own_instagram_accounts" ON instagram_accounts
  USING (auth.uid() = user_id);

-- Add similar policies for other tables as needed.
