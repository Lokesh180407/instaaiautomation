CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS instagram_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_message_id text,
  sender_id text,
  sender_username text,
  message_text text,
  direction text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instagram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_user_id text,
  username text,
  page_id text,
  page_access_token text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  trigger_keyword text,
  response_message text,
  ai_enabled boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
