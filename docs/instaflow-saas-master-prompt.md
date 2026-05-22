# InstaFlow Pro — Production SaaS Master Build Prompt
## ManyChat + Tidio + AiSensy Alternative | Full Stack | Supabase Backend

---

## PRODUCT VISION

Build **InstaFlow Pro** — a production-grade Instagram automation SaaS platform combining the best of ManyChat (automation flows), Tidio (live chat inbox), and AiSensy (WhatsApp/Instagram broadcast campaigns). The platform supports two connection methods: one-click OAuth setup and manual token setup. Features a fully isolated admin panel with account generation, complete user management, visual n8n-style flow builder, and AI-powered automation.

**Reference Projects (study these on GitHub):**
- `n8n-io/n8n` — visual node-based flow builder UI
- `typebot-io/typebot.io` — conversation flow builder
- `chatwoot/chatwoot` — live inbox UI
- `calcom/cal.com` — SaaS dashboard structure
- `supabase/supabase` — auth and RLS patterns

---

## TECH STACK

| Layer | Technology |
|---|---|
| Frontend | HTML5 + CSS3 + Vanilla JS (modular ES6) |
| Backend | Supabase Edge Functions (Deno/TypeScript) |
| Database | Supabase PostgreSQL + RLS |
| Auth | Supabase Auth (email + Google OAuth) |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime (WebSockets) |
| Payments | Razorpay (INR) |
| AI | User's own OpenAI / Anthropic / Gemini key |
| Email | Resend.com (free tier) |
| Hosting | Netlify (frontend) + Supabase (backend) |
| Charts | Chart.js |
| Flow Builder | Custom canvas-based node editor (vanilla JS) |

---

## COMPLETE DATABASE SCHEMA

```sql
-- ================================================================
-- EXTENSION & UTILITIES
-- ================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- ADMIN SYSTEM
-- ================================================================
CREATE TABLE admin_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id TEXT UNIQUE NOT NULL, -- e.g. ADM-2024-001
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- bcrypt hashed
  full_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'admin', -- super_admin, admin, support
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  description TEXT,
  updated_by UUID REFERENCES admin_accounts(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default admin settings
INSERT INTO admin_settings (key, value, description) VALUES
('maintenance_mode', 'false', 'Put platform in maintenance mode'),
('allow_signups', 'true', 'Allow new user registrations'),
('free_plan_limits', '{"contacts": 500, "flows": 3, "messages_per_day": 100}', 'Free plan limits'),
('starter_plan_limits', '{"contacts": -1, "flows": -1, "messages_per_day": 1000}', 'Starter plan limits'),
('pro_plan_limits', '{"contacts": -1, "flows": -1, "messages_per_day": -1}', 'Pro plan limits'),
('razorpay_enabled', 'true', 'Enable Razorpay payments'),
('ai_enabled', 'true', 'Allow users to use AI features'),
('platform_name', '"InstaFlow Pro"', 'Platform display name'),
('support_email', '"support@instaflow.pro"', 'Support email address');

CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_type TEXT NOT NULL, -- admin, user
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- PLANS & BILLING
-- ================================================================
CREATE TABLE plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, -- free, starter, pro, enterprise
  display_name TEXT NOT NULL,
  price_monthly INTEGER DEFAULT 0, -- in paise (INR)
  price_yearly INTEGER DEFAULT 0,
  contact_limit INTEGER DEFAULT 500, -- -1 = unlimited
  flow_limit INTEGER DEFAULT 3, -- -1 = unlimited
  messages_per_day INTEGER DEFAULT 100, -- -1 = unlimited
  team_members INTEGER DEFAULT 1,
  ai_replies BOOLEAN DEFAULT false,
  broadcast_campaigns BOOLEAN DEFAULT false,
  advanced_analytics BOOLEAN DEFAULT false,
  priority_support BOOLEAN DEFAULT false,
  custom_branding BOOLEAN DEFAULT false,
  webhook_access BOOLEAN DEFAULT false,
  api_access BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plans (name, display_name, price_monthly, price_yearly, contact_limit, flow_limit, messages_per_day, team_members, ai_replies, broadcast_campaigns, advanced_analytics, priority_support, webhook_access, api_access) VALUES
('free', 'Free', 0, 0, 500, 3, 100, 1, false, false, false, false, false, false),
('starter', 'Starter', 19900, 179100, -1, -1, 1000, 3, true, true, true, false, true, false),
('pro', 'Pro', 49900, 449100, -1, -1, -1, 10, true, true, true, true, true, true),
('enterprise', 'Enterprise', 0, 0, -1, -1, -1, -1, true, true, true, true, true, true);

-- ================================================================
-- USER PROFILES
-- ================================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  company_name TEXT,
  website TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  language TEXT DEFAULT 'en',
  plan_id UUID REFERENCES plans(id),
  plan_name TEXT DEFAULT 'free',
  subscription_id TEXT,
  subscription_status TEXT DEFAULT 'inactive',
  subscription_start TIMESTAMPTZ,
  subscription_end TIMESTAMPTZ,
  razorpay_customer_id TEXT,
  ai_api_key TEXT,
  ai_provider TEXT DEFAULT 'openai',
  ai_model TEXT DEFAULT 'gpt-4o-mini',
  ai_enabled BOOLEAN DEFAULT false,
  ai_system_prompt TEXT DEFAULT 'You are a helpful assistant. Reply in the same language as the user. Keep responses concise and friendly.',
  contacts_count INTEGER DEFAULT 0,
  flows_count INTEGER DEFAULT 0,
  messages_today INTEGER DEFAULT 0,
  messages_today_reset TIMESTAMPTZ DEFAULT NOW(),
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step INTEGER DEFAULT 0,
  referral_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  referred_by TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT, -- admin notes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'agent', -- owner, admin, agent, viewer
  permissions JSONB DEFAULT '{"inbox": true, "flows": false, "campaigns": false, "analytics": true}',
  invited_email TEXT,
  invite_token TEXT,
  invite_accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_owner_id, user_id)
);

-- ================================================================
-- INSTAGRAM INTEGRATION
-- ================================================================
CREATE TABLE instagram_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  instagram_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  name TEXT,
  bio TEXT,
  profile_picture_url TEXT,
  account_type TEXT, -- BUSINESS, CREATOR
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  media_count INTEGER DEFAULT 0,
  website TEXT,
  access_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'page', -- user, page, system
  token_expires_at TIMESTAMPTZ,
  page_id TEXT,
  page_name TEXT,
  page_access_token TEXT,
  app_id TEXT,
  app_secret TEXT,
  webhook_subscribed BOOLEAN DEFAULT false,
  connection_method TEXT DEFAULT 'manual', -- oauth, manual
  is_active BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, instagram_user_id)
);

-- ================================================================
-- CONTACTS (Instagram users who DM'd)
-- ================================================================
CREATE TABLE contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  instagram_account_id UUID REFERENCES instagram_accounts(id),
  instagram_user_id TEXT NOT NULL,
  username TEXT,
  name TEXT,
  avatar_url TEXT,
  bio TEXT,
  follower_count INTEGER,
  is_follower BOOLEAN DEFAULT false,
  is_following BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  notes TEXT,
  opted_in BOOLEAN DEFAULT true,
  opted_in_at TIMESTAMPTZ DEFAULT NOW(),
  opted_out_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  total_messages INTEGER DEFAULT 0,
  flow_history UUID[],
  assigned_to UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'active', -- active, blocked, opted_out
  source TEXT, -- dm, comment, story_mention, campaign
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, instagram_user_id)
);

CREATE TABLE contact_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#7C3AED',
  contacts_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- ================================================================
-- FLOW BUILDER (n8n-style visual)
-- ================================================================
CREATE TABLE flows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  instagram_account_id UUID REFERENCES instagram_accounts(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  trigger_type TEXT NOT NULL,
  -- Trigger types:
  -- dm_keyword, dm_first, dm_any
  -- comment_keyword, comment_any
  -- story_mention
  -- post_comment_keyword
  -- follow, unfollow
  -- scheduled
  trigger_config JSONB DEFAULT '{}',
  -- Example: {"keywords": ["hi", "hello"], "condition": "contains", "case_sensitive": false}
  nodes JSONB DEFAULT '[]',
  -- Array of node objects with position, type, config
  edges JSONB DEFAULT '[]',
  -- Array of edge connections between nodes
  variables JSONB DEFAULT '{}',
  -- Flow-level variables
  is_active BOOLEAN DEFAULT true,
  is_published BOOLEAN DEFAULT false,
  reply_once_per_contact BOOLEAN DEFAULT true,
  reply_once_cooldown INTEGER DEFAULT 24, -- hours
  priority INTEGER DEFAULT 0,
  run_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE flow_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- Built-in flow templates
INSERT INTO flow_templates (name, description, category, trigger_type, trigger_config, nodes, edges, is_featured) VALUES
('Welcome New DM', 'Automatically greet anyone who DMs you for the first time', 'welcome', 'dm_first', 
 '{}',
 '[{"id":"1","type":"trigger","label":"First DM","x":100,"y":200},{"id":"2","type":"send_message","label":"Send Welcome","config":{"message":"Hey {{name}}! 👋 Thanks for reaching out. How can I help you today?"},"x":350,"y":200}]',
 '[{"from":"1","to":"2"}]',
 true),
('Price Inquiry Auto Reply', 'Reply with pricing when someone asks about price', 'sales', 'dm_keyword',
 '{"keywords":["price","cost","rate","charge","fee"],"condition":"contains"}',
 '[{"id":"1","type":"trigger","label":"Keyword: price","x":100,"y":200},{"id":"2","type":"send_message","label":"Send Price Info","config":{"message":"Hi {{name}}! 😊 Here are our pricing details:\n\n📦 Basic: ₹999/month\n🚀 Pro: ₹1999/month\n\nReply with BASIC or PRO to know more!"},"x":350,"y":200}]',
 '[{"from":"1","to":"2"}]',
 true),
('Story Mention Reply', 'Thank users who mention you in stories', 'engagement', 'story_mention',
 '{}',
 '[{"id":"1","type":"trigger","label":"Story Mention","x":100,"y":200},{"id":"2","type":"send_message","label":"Thank Them","config":{"message":"Aww thank you for the mention {{name}}! 🙏❤️ Really appreciate your support!"},"x":350,"y":200}]',
 '[{"from":"1","to":"2"}]',
 true);

-- ================================================================
-- CONVERSATIONS & MESSAGES
-- ================================================================
CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  instagram_account_id UUID REFERENCES instagram_accounts(id),
  contact_id UUID REFERENCES contacts(id),
  instagram_conversation_id TEXT,
  participant_instagram_id TEXT NOT NULL,
  participant_username TEXT,
  participant_name TEXT,
  participant_avatar TEXT,
  is_follower BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'open', -- open, resolved, snoozed, spam
  assigned_to UUID REFERENCES profiles(id),
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_direction TEXT, -- incoming, outgoing
  unread_count INTEGER DEFAULT 0,
  ai_enabled BOOLEAN DEFAULT false,
  ai_context TEXT,
  bot_enabled BOOLEAN DEFAULT true,
  window_open BOOLEAN DEFAULT true,
  window_closes_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  labels TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instagram_account_id, participant_instagram_id)
);

CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  instagram_message_id TEXT UNIQUE,
  direction TEXT NOT NULL, -- incoming, outgoing
  message_type TEXT DEFAULT 'text', -- text, image, video, audio, story_mention, story_reply, share, reaction
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  media_size INTEGER,
  story_url TEXT,
  story_type TEXT,
  reaction TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_auto_reply BOOLEAN DEFAULT false,
  is_ai_reply BOOLEAN DEFAULT false,
  flow_id UUID REFERENCES flows(id),
  flow_node_id TEXT,
  sent_by UUID REFERENCES profiles(id),
  sent_by_name TEXT,
  delivery_status TEXT DEFAULT 'sent', -- sent, delivered, read, failed
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

-- ================================================================
-- CAMPAIGNS (Broadcast)
-- ================================================================
CREATE TABLE campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  instagram_account_id UUID REFERENCES instagram_accounts(id),
  name TEXT NOT NULL,
  description TEXT,
  message_type TEXT DEFAULT 'text', -- text, template
  message_content TEXT NOT NULL,
  media_url TEXT,
  template_id UUID,
  target_type TEXT DEFAULT 'all_contacts', -- all_contacts, tag, segment, manual
  target_tags TEXT[],
  target_contact_ids UUID[],
  target_filters JSONB DEFAULT '{}',
  followers_only BOOLEAN DEFAULT true,
  exclude_tags TEXT[],
  status TEXT DEFAULT 'draft', -- draft, scheduled, running, paused, completed, failed, cancelled
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_targets INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  rate_limit_per_hour INTEGER DEFAULT 200,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaign_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  instagram_user_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, sent, delivered, read, failed, skipped
  message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

-- ================================================================
-- MESSAGE TEMPLATES
-- ================================================================
CREATE TABLE templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  variables TEXT[] DEFAULT '{}',
  -- Supported: {{name}}, {{username}}, {{date}}, {{time}}, {{custom_1}} etc.
  shortcut TEXT,
  use_count INTEGER DEFAULT 0,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- ANALYTICS
-- ================================================================
CREATE TABLE analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  instagram_account_id UUID REFERENCES instagram_accounts(id),
  event_type TEXT NOT NULL,
  -- Event types: dm_received, dm_sent, comment_received, comment_replied,
  -- story_mention, flow_triggered, flow_completed, flow_failed,
  -- ai_reply, campaign_sent, contact_created, contact_opted_out
  flow_id UUID REFERENCES flows(id),
  campaign_id UUID REFERENCES campaigns(id),
  conversation_id UUID REFERENCES conversations(id),
  contact_id UUID REFERENCES contacts(id),
  metadata JSONB DEFAULT '{}',
  date DATE DEFAULT CURRENT_DATE,
  hour INTEGER DEFAULT EXTRACT(HOUR FROM NOW()),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE daily_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  instagram_account_id UUID REFERENCES instagram_accounts(id),
  date DATE NOT NULL,
  dms_received INTEGER DEFAULT 0,
  dms_sent INTEGER DEFAULT 0,
  auto_replies INTEGER DEFAULT 0,
  ai_replies INTEGER DEFAULT 0,
  flows_triggered INTEGER DEFAULT 0,
  comments_replied INTEGER DEFAULT 0,
  new_contacts INTEGER DEFAULT 0,
  campaign_messages_sent INTEGER DEFAULT 0,
  story_mentions INTEGER DEFAULT 0,
  UNIQUE(user_id, instagram_account_id, date)
);

-- ================================================================
-- WEBHOOKS & LOGS
-- ================================================================
CREATE TABLE webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instagram_account_id TEXT,
  event_type TEXT,
  entry_id TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  processing_time_ms INTEGER,
  error TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE api_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  endpoint TEXT,
  method TEXT,
  status_code INTEGER,
  response_time_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- NOTIFICATIONS
-- ================================================================
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "own_instagram" ON instagram_accounts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_contacts" ON contacts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_flows" ON flows FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_conversations" ON conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_messages" ON messages FOR ALL USING (
  conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
);
CREATE POLICY "own_campaigns" ON campaigns FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_templates" ON templates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_analytics" ON analytics_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_notifications" ON notifications FOR ALL USING (auth.uid() = user_id);

-- ================================================================
-- FUNCTIONS & TRIGGERS
-- ================================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url, plan_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    (SELECT id FROM plans WHERE name = 'free' LIMIT 1)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_flows_updated_at BEFORE UPDATE ON flows FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## SUPABASE EDGE FUNCTIONS (7 Total)

### 1. `instagram-oauth/index.ts`
Handles the OAuth connect button flow:
- Validates state parameter to prevent CSRF
- Exchanges authorization code for short-lived token
- Exchanges for long-lived token (60 days)
- Fetches full account profile from Graph API
- Checks if Business/Creator account type
- Upserts record in instagram_accounts table
- Subscribes to webhooks automatically
- Returns success redirect to dashboard

### 2. `instagram-webhook/index.ts`
Core automation engine — processes all incoming events:
- GET: Responds to hub.challenge for webhook verification
- POST: Processes events with these handlers:
  - `handleIncomingDM()` — matches against active flows, sends auto-reply or AI reply
  - `handleIncomingComment()` — matches comment keyword flows
  - `handleStoryMention()` — triggers story mention flows
  - `handleReaction()` — handles message reactions
  - `handleRead()` — updates message read status
- Flow execution engine: evaluates trigger conditions, executes node chain
- Logs all events to analytics_events and daily_stats
- Must respond 200 within 5 seconds — use background tasks for heavy work

### 3. `send-message/index.ts`
Unified message sending function:
- Accepts: instagram_account_id, recipient_id, message, type, media_url
- Validates 24-hour messaging window
- Checks daily message limits based on plan
- Sends via Graph API POST /{ig-user-id}/messages
- Handles retry on rate limit (429) with exponential backoff
- Logs to messages table with delivery status
- Updates conversation last_message

### 4. `execute-flow/index.ts`
Flow execution engine:
- Takes flow_id, contact_id, trigger_data
- Walks through nodes array sequentially
- Supported node types:
  - send_message: sends text/media message
  - condition: branches based on contact data or message content
  - wait: delays execution (use pg_cron or store pending state)
  - tag_contact: adds/removes tags
  - set_variable: sets flow variable
  - ai_reply: generates AI response using contact's API key
  - subscribe/unsubscribe: manages contact opt-in
  - webhook_call: calls external URL
  - assign_agent: assigns conversation to team member
  - add_note: adds note to conversation
- Records execution in analytics_events

### 5. `ai-reply/index.ts`
AI response generation:
- Supports OpenAI (gpt-4o-mini), Anthropic (claude-haiku-4-5), Gemini Flash
- Fetches last 10 messages as context
- Applies user's system prompt
- Applies per-conversation custom prompt if set
- Returns generated text
- Logs token usage

### 6. `run-campaign/index.ts`
Background campaign execution:
- Fetches pending campaign recipients
- Sends messages in batches of 50
- Respects rate limit (200/hour by default)
- Updates sent_count, failed_count in real time
- Handles errors gracefully, marks failed recipients
- Updates campaign status (running → completed)

### 7. `admin-api/index.ts`
Admin panel backend (separate auth from regular users):
- POST /admin/login — validates account_id + password, returns JWT
- GET /admin/users — paginated user list with stats
- PATCH /admin/users/:id — update user plan, status, notes
- POST /admin/accounts — generate new admin account with ID + password
- GET /admin/stats — platform-wide stats
- POST /admin/broadcast — send platform announcement
- PATCH /admin/settings — update platform settings
- DELETE /admin/users/:id/data — GDPR data deletion

---

## FRONTEND PAGES & COMPONENTS

### Design System
```css
:root {
  /* Brand Colors */
  --brand-purple: #7C3AED;
  --brand-purple-light: #8B5CF6;
  --brand-purple-dark: #6D28D9;
  --brand-gradient: linear-gradient(135deg, #7C3AED, #EC4899);

  /* Dark Theme */
  --bg-primary: #0A0F1E;
  --bg-secondary: #111827;
  --bg-card: #1F2937;
  --bg-card-hover: #374151;
  --border: rgba(255,255,255,0.08);
  --border-hover: rgba(255,255,255,0.16);

  /* Text */
  --text-primary: #F9FAFB;
  --text-secondary: #9CA3AF;
  --text-muted: #6B7280;

  /* Status */
  --success: #10B981;
  --warning: #F59E0B;
  --danger: #EF4444;
  --info: #3B82F6;

  /* Typography */
  --font-display: 'Clash Display', sans-serif;
  --font-body: 'Plus Jakarta Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

---

### PAGE STRUCTURE

```
instaflow/
├── index.html                  # Landing page
├── auth.html                   # Login / Signup
├── admin-login.html            # Admin-only login page
├── admin/
│   ├── dashboard.html          # Admin overview
│   ├── users.html              # User management
│   ├── accounts.html           # Generate admin accounts
│   ├── settings.html           # Platform settings
│   ├── analytics.html          # Platform analytics
│   └── plans.html              # Plan management
├── app/
│   ├── dashboard.html          # User dashboard
│   ├── onboarding.html         # Onboarding wizard
│   ├── connect.html            # Connect Instagram
│   ├── inbox.html              # Chat inbox (Tidio-style)
│   ├── flows.html              # Flow list
│   ├── flow-builder.html       # Visual flow editor (n8n-style)
│   ├── contacts.html           # Contact management
│   ├── campaigns.html          # Broadcast campaigns
│   ├── templates.html          # Message templates
│   ├── analytics.html          # Analytics dashboard
│   ├── team.html               # Team management
│   └── settings.html           # Account settings
├── oauth-callback.html         # Instagram OAuth redirect
├── privacy.html
└── terms.html
```

---

### PAGE 1: Landing Page (`index.html`)
Hero: "Automate Instagram. Grow Faster. Pay Less."
Subtext: "The ManyChat alternative built for Indian creators and businesses. All features. 70% cheaper."
- Animated hero with mockup of the dashboard
- Stats: "500+ businesses", "1M+ messages automated", "₹0 to start"
- Feature sections with screenshots:
  - Visual Flow Builder (n8n-style)
  - Live Inbox (Tidio-style)
  - AI Auto-replies
  - Broadcast Campaigns
  - Deep Analytics
- Pricing table (3 tiers + enterprise)
- ManyChat comparison table
- Testimonials section
- FAQ section
- Footer with all links

---

### PAGE 2: Auth (`auth.html`)
- Tabs: Sign Up / Log In
- Email + password
- Google OAuth button
- On login: check if admin account → redirect to /admin/dashboard
- On login: check onboarding_completed → redirect to /app/onboarding or /app/dashboard
- Forgot password flow

---

### PAGE 3: Admin Login (`admin-login.html`)
Completely separate from user auth:
- Account ID field (e.g. ADM-2024-001)
- Password field
- "Admin Portal" branding — different visual than user login
- On login: validate against admin_accounts table
- Store admin JWT in localStorage with `admin_` prefix
- Redirect to /admin/dashboard

---

### PAGE 4: Admin Dashboard (`admin/dashboard.html`)

**Admin Sidebar:**
- Overview
- Users
- Admin Accounts
- Plans & Billing
- Platform Settings
- Analytics
- Audit Logs
- Announcements
- Logout

**Overview Cards:**
- Total users, Active today, New this week
- Total revenue (MRR), Churn rate
- Messages sent today (platform-wide)
- Active Instagram accounts
- Flows triggered today

**Recent Activity:**
- New signups feed
- Recent errors log
- Webhook failure alerts

**Quick Actions:**
- Generate new admin account
- Send platform announcement
- Toggle maintenance mode
- Export user data (CSV)

---

### PAGE 5: Admin Users (`admin/users.html`)
Table columns: Avatar, Name, Email, Plan badge, Instagram connected, Messages today, Joined date, Status, Actions

Actions per user:
- View full profile
- Edit plan (upgrade/downgrade)
- Add notes
- Reset password
- Suspend/Activate
- Delete account + data
- Impersonate (view their dashboard as them)

Filters: All / Free / Starter / Pro / Suspended / Active today

Search: by email, name, Instagram username

---

### PAGE 6: Generate Admin Accounts (`admin/accounts.html`)
Table of existing admin accounts:
- Account ID, Username, Role, Last login, Status

"Generate New Account" button opens modal:
- Full name input
- Role dropdown: admin / support / viewer
- System auto-generates:
  - Account ID: ADM-YYYY-XXX format
  - Random secure password (12 chars)
  - Shows credentials once in modal with copy button
  - Sends to email if provided
- Save button

---

### PAGE 7: Onboarding Wizard (`app/onboarding.html`)
5-step animated wizard:

Step 1 — Welcome
- "Welcome to InstaFlow! Let's get you set up in 3 minutes"
- Animated confetti, user's name

Step 2 — Connect Instagram
- Two option cards side by side:
  **Option A — Quick Setup (OAuth)**
  Instagram icon + "Connect with Instagram" gradient button
  "Best for most users — takes 30 seconds"
  
  **Option B — Manual Setup**
  Code icon + "Enter credentials manually"
  "For advanced users with existing API access"

Step 3 (OAuth path) — OAuth Flow
- Large Instagram connect button
- Opens OAuth popup
- Shows connecting animation
- On success: shows account connected with follower count

Step 3 (Manual path) — Manual Credentials
- App ID field with "Where to find this?" tooltip
- App Secret field
- Access Token field (large, monospace)
- Token Type dropdown: User Token / Page Token
- Test Connection button → shows success/error
- "How to get these?" expandable guide with screenshots

Step 4 — Create First Flow
- 3 template cards to choose from:
  - Welcome new DMs
  - Reply to price inquiries
  - Story mention thanks
- Or "Skip for now"

Step 5 — Done!
- "You're all set! 🎉"
- Stats preview (empty state)
- "Go to Dashboard" button

---

### PAGE 8: Dashboard (`app/dashboard.html`)

**Sidebar (all app pages):**
```
[Logo] InstaFlow Pro

[Account selector dropdown if multiple IGs]

📊 Dashboard
💬 Inbox          [unread badge]
🤖 Flows
👥 Contacts
📢 Campaigns
📝 Templates
📈 Analytics
👥 Team
⚙️ Settings

[Bottom]
💎 Upgrade Plan
❓ Help
🔔 Notifications
[Avatar] Profile
```

**Dashboard Content:**
- Instagram account card: avatar, @username, follower count, connection status
- 24-hour window indicator for active conversations
- Stats row (today): DMs received, Auto-replies, Flows triggered, AI replies, New contacts
- Quick action buttons: New Flow, New Campaign, View Inbox
- Activity chart (last 7 days)
- Recent conversations list (top 5)
- Top triggered flows (top 3)
- Usage bar (contacts used / plan limit)

---

### PAGE 9: Inbox (`app/inbox.html`)
**Tidio/Chatwoot-style three-panel layout:**

**Left panel — Conversation list (300px):**
- Search bar
- Filter tabs: All / Open / Resolved / Bot Off / Assigned to me
- Sort: Latest / Oldest / Unread
- Each row: Avatar, username, last message preview, time, unread count
- Status indicators: 🤖 bot active, 👤 human agent, ⏰ window closing
- Right-click context menu: Resolve, Snooze, Spam, Assign

**Middle panel — Chat thread (flex-1):**
- Header: Avatar, @username, follower badge, "Open in Instagram" link, Assign dropdown
- Toggle bar: 
  - 🤖 Bot: [ON/OFF toggle]
  - 🧠 AI: [ON/OFF toggle] 
  - Labels dropdown
- Message thread:
  - Incoming: left-aligned gray bubble
  - Outgoing: right-aligned purple bubble
  - System messages: center gray text
  - Story mentions: special card with story preview
  - Image/video: rendered inline
  - Auto-reply badge: small "🤖 Auto" tag
  - AI reply badge: small "🧠 AI" tag
  - Timestamps on hover
- 24-hour window warning banner when closing soon
- Message input area:
  - Text field (auto-resize)
  - Template picker button 📝
  - Emoji picker 😊
  - Image upload 📎
  - Send button (Enter to send)
  - "Press Enter to send, Shift+Enter for new line" hint

**Right panel — Contact info (280px, collapsible):**
- Contact avatar, name, @username
- Follower/Following counts
- Follower status badge
- Tags (add/remove chips)
- Custom fields
- Notes textarea
- Conversation history count
- Flows triggered list
- Contact since date
- "Block" / "Opt out" buttons

---

### PAGE 10: Flow Builder (`app/flow-builder.html`)
**n8n/Typebot-inspired visual canvas editor:**

**Top bar:**
- Back to flows list
- Flow name (editable inline)
- Status toggle (Active/Inactive)
- Save button
- Publish button
- Test flow button

**Left panel — Node palette:**
Categories with drag-to-canvas nodes:
- **Triggers**: DM Keyword, First DM, Any DM, Comment Keyword, Story Mention, Follow
- **Messages**: Send Text, Send Image, Send Video, Quick Reply Buttons
- **Logic**: Condition (if/else), Random Split, Wait/Delay
- **Actions**: Tag Contact, Assign Agent, Set Variable, AI Reply, Webhook Call
- **Flow**: Start, End, Jump to Flow

**Canvas (main area):**
- Infinite scrollable canvas with grid dots
- Nodes are draggable cards with:
  - Node type icon + label
  - Input port (left) and output port(s) (right)
  - Click to configure in right panel
  - Delete button on hover
- Edges are curved bezier lines connecting nodes
- Click empty space to add node from menu
- Minimap in bottom-right corner
- Zoom controls
- "Fit to screen" button

**Right panel — Node configuration:**
Changes based on selected node type:
- Send Text: textarea with variable picker, emoji picker, character count
- Condition: condition builder (contact.is_follower = true, message contains "price", etc.)
- Wait: duration input (minutes/hours/days)
- Tag Contact: tag selector (create new or existing)
- AI Reply: system prompt override textarea
- Webhook: URL input, method, headers, body

**Bottom bar:**
- Flow stats: runs, success rate, last triggered

---

### PAGE 11: Contacts (`app/contacts.html`)
**CRM-style contact management:**

Table: Avatar, @username, Name, Follower status, Tags, Last message, Total messages, Status, Actions

**Filters:** All / Followers / Non-followers / Tagged / Opted out

**Contact detail side panel:**
- Full profile info
- Conversation history
- Tags management
- Custom fields (key-value pairs)
- Notes
- Flow history
- Export contact

**Bulk actions:** Tag, Export CSV, Opt-out, Delete

---

### PAGE 12: Campaigns (`app/campaigns.html`)
**AiSensy-style broadcast:**

Campaign list: Name, Status badge, Target count, Sent/Total progress, Date

**Create Campaign modal (multi-step):**

Step 1 — Audience:
- Target type: All contacts / By tag / By filter / Manual list
- Filter options: followers only, last active, tagged with
- Estimated reach count updates live

Step 2 — Message:
- Message type: Text / Image
- Message composer with {{variable}} picker
- Optional link field
- Preview on right

Step 3 — Schedule:
- Send now / Schedule (datetime picker)
- Rate limit: 50/100/200 messages per hour

Step 4 — Review:
- Summary: audience count, message preview, schedule
- Important disclaimer notice about Instagram policy
- Confirm & Start button

**Campaign detail page:**
- Progress bar with live updates (Supabase Realtime)
- Sent / Delivered / Read / Failed counts
- Recipient table with status per contact
- Pause / Resume / Cancel buttons

---

### PAGE 13: Analytics (`app/analytics.html`)

**Date range picker:** Today / 7d / 30d / 90d / Custom

**Metric cards row:**
- DMs received, Auto-replies sent, AI replies, Flows triggered, New contacts, Campaign messages

**Charts (Chart.js):**
- Line: DMs received vs sent (7/30/90 days)
- Bar: Top 5 most triggered flows
- Donut: Reply type breakdown (manual/auto/AI)
- Heatmap: Messages by hour of day × day of week
- Line: New contacts over time

**Tables:**
- Top conversations (by message count)
- Flow performance (runs, success rate, avg completion time)
- Campaign performance (sent, open rate equivalent)

**Export:** CSV button for all data

---

### PAGE 14: Settings (`app/settings.html`)

**Tabs:**

**Profile:** Name, email, avatar, phone, company, timezone, language

**Instagram:** 
- Connected accounts list
- Connection status per account
- Disconnect / Reconnect button
- Webhook status indicator (green/red)
- Token expiry date + Refresh button
- Manual token update form

**AI Assistant:**
- Global AI toggle (on/off)
- Provider: OpenAI / Anthropic / Gemini
- API Key (masked, show/hide, test button)
- AI Model selector
- Default system prompt (textarea with preview)
- "Test AI Response" button with sample conversation

**Notifications:**
- Email notifications: new DMs, flow errors, campaign complete, weekly report
- In-app notifications toggles

**Team:** (if plan allows)
- List of team members with roles
- Invite by email
- Role management

**Billing:**
- Current plan card with usage bars
- Plan comparison table
- Upgrade button (Razorpay)
- Payment history
- Cancel subscription

**Developer:**
- Webhook URL (your app's URL)
- Webhook secret
- API key generation (for Pro/Enterprise)
- API documentation link

**Danger Zone:**
- Export all data
- Delete all data
- Delete account

---

## INSTAGRAM CONNECT — TWO METHODS

### Method A: One-Click OAuth Button

```html
<!-- Single button, handles everything -->
<button id="oauth-connect-btn" class="btn-instagram-connect">
  <svg><!-- Instagram icon --></svg>
  Connect Instagram
</button>
```

```javascript
function connectInstagramOAuth() {
  const APP_ID = config.INSTAGRAM_APP_ID;
  const REDIRECT = encodeURIComponent(config.REDIRECT_URI);
  const SCOPES = 'instagram_business_basic,instagram_manage_messages,instagram_manage_comments';
  const STATE = generateRandomState(); // store in sessionStorage

  const url = `https://www.instagram.com/oauth/authorize?client_id=${APP_ID}&redirect_uri=${REDIRECT}&scope=${SCOPES}&response_type=code&state=${STATE}`;

  const popup = window.open(url, 'ig_oauth', 'width=600,height=700');

  // Listen for success message from oauth-callback.html
  window.addEventListener('message', (e) => {
    if (e.data.type === 'INSTAGRAM_CONNECTED') {
      popup.close();
      showConnectionSuccess(e.data.account);
    }
  });
}
```

### Method B: Manual Token Setup

Four fields:
1. App ID (from Meta Developer Console)
2. App Secret (optional but recommended)
3. Access Token (User token or Page token)
4. Instagram User ID (optional — fetched automatically)

"Test & Connect" button:
- Calls `/validate-token` edge function
- Validates token by calling `GET /me?fields=id,username,account_type`
- If valid: saves to instagram_accounts table
- Shows account profile confirmation

---

## ADMIN PANEL — COMPLETE FEATURE LIST

### Account Generation System
```javascript
function generateAdminAccount(fullName, role, email) {
  const year = new Date().getFullYear();
  const sequence = getNextSequence(); // ADM-2024-001, ADM-2024-002...
  const accountId = `ADM-${year}-${String(sequence).padStart(3, '0')}`;
  const password = generateSecurePassword(12);
  const passwordHash = bcrypt(password);

  // Save to admin_accounts table
  // Show credentials ONCE in modal
  // Optionally email if email provided
  return { accountId, password }; // show to admin creating it
}
```

### Admin Login Flow
```javascript
// admin-login.html
async function adminLogin(accountId, password) {
  const response = await fetch('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ account_id: accountId, password })
  });

  if (response.ok) {
    const { token, admin } = await response.json();
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_data', JSON.stringify(admin));
    window.location.href = '/admin/dashboard.html';
  }
}

// On any page load — check if admin or user
function checkAuthAndRedirect() {
  const adminToken = localStorage.getItem('admin_token');
  const userSession = supabase.auth.getSession();

  if (adminToken && isAdminPage()) return; // allow
  if (adminToken && !isAdminPage()) redirect('/admin/dashboard.html');
  if (userSession && isAdminPage()) redirect('/app/dashboard.html');
  if (!adminToken && !userSession) redirect('/auth.html');
}
```

---

## META / INSTAGRAM COMPLIANCE

For easy Meta App Review approval:

1. Privacy policy at `/privacy.html` — clearly states:
   - What data is collected (Instagram username, messages with consent)
   - Why (automation on user's behalf)
   - How long stored (until account deletion)
   - Data deletion instructions

2. Terms of service at `/terms.html`

3. Only messages users who initiated contact first — enforced in backend

4. 24-hour window enforcement — backend checks timestamp before sending

5. Campaigns only target contacts who previously messaged — enforced in campaign targeting

6. All API calls server-side only (Edge Functions) — never expose tokens in frontend

7. Webhook verification responds to hub.challenge correctly

8. Rate limiting: 750 calls/hour enforced in Edge Functions

9. Data deletion: deletes all Instagram tokens and messages when user deletes account

10. App description for Meta Review:
"InstaFlow Pro helps Instagram Business and Creator account owners automate responses to messages and comments from their followers using keyword-based rules and AI. All features use the official Instagram Graph API within Meta's platform policies."

---

## ENVIRONMENT VARIABLES

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Meta / Instagram
INSTAGRAM_APP_ID=1503208814932037
INSTAGRAM_APP_SECRET=
INSTAGRAM_REDIRECT_URI=https://yourapp.netlify.app/oauth-callback.html
WEBHOOK_VERIFY_TOKEN=your_random_secret

# Email (Resend)
RESEND_API_KEY=

# Encryption
ENCRYPTION_KEY=32_char_random_string

# Admin
ADMIN_JWT_SECRET=

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

---

## BUILD ORDER

1. Setup Supabase project, run complete SQL schema
2. Configure Supabase Auth (email + Google)
3. Build auth.html + admin-login.html
4. Build admin panel (5 pages) with admin API edge function
5. Build onboarding wizard with both connect methods
6. Build dashboard with sidebar layout
7. Build inbox (most complex — do this fully)
8. Build flow builder canvas editor
9. Implement webhook edge function (core automation engine)
10. Build contacts CRM page
11. Build campaigns with Supabase Realtime progress
12. Build analytics with Chart.js
13. Build templates page
14. Build settings with all tabs
15. Add Razorpay billing integration
16. Add AI reply integration
17. Privacy + Terms pages
18. Deploy to Netlify + Supabase
19. Test end-to-end with real Instagram account
20. Submit Meta App Review

---

## ADDITIONAL NOTES FOR AGENT

- Use existing files from the previously built version as the base
- Keep the dark purple (#7C3AED) brand identity consistent
- All modals use a slide-up animation on mobile, fade-scale on desktop
- Supabase Realtime on conversations table for live inbox updates
- Flow builder canvas uses HTML5 Canvas API or SVG for node connections
- Admin panel has a completely different visual theme (lighter, more corporate) from user dashboard
- All tables are sortable and have pagination (20 per page)
- Error states, empty states, and loading skeletons for every component
- Mobile responsive for all pages except flow builder canvas (desktop only)
- Keyboard shortcuts: Ctrl+K for quick search, Ctrl+/ for shortcuts help