CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Contacts table (Instagram users)
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_user_id text NOT NULL,
  username text,
  profile_pic text,
  tags jsonb DEFAULT '{}'::jsonb,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Conversations (DM threads)
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  account_id uuid REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  last_message_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Messages (inbound/outbound)
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  direction text CHECK (direction IN ('in','out')) NOT NULL,
  content text,
  media_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Flows (automation workflows)
CREATE TABLE IF NOT EXISTS flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text CHECK (status IN ('draft','active')) DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

-- Flow nodes (graph nodes)
CREATE TABLE IF NOT EXISTS flow_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid REFERENCES flows(id) ON DELETE CASCADE,
  type text NOT NULL,
  config jsonb DEFAULT '{}'::jsonb,
  position_x int,
  position_y int,
  created_at timestamptz DEFAULT now()
);

-- Flow edges (directed connections)
CREATE TABLE IF NOT EXISTS flow_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_node uuid REFERENCES flow_nodes(id) ON DELETE CASCADE,
  target_node uuid REFERENCES flow_nodes(id) ON DELETE CASCADE,
  condition jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Analytics events (low‑level logs)
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Event queue for background processing
CREATE TABLE IF NOT EXISTS event_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- Disable RLS for development (will be enabled later)
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE flows DISABLE ROW LEVEL SECURITY;
ALTER TABLE flow_nodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE flow_edges DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_queue DISABLE ROW LEVEL SECURITY;
