# InstaFlow Pro — Production SaaS Master Build Prompt
## ManyChat + Tidio + AiSensy Alternative | Supabase Backend | Extend Existing Codebase

---

## CRITICAL: READ FIRST

You are building on an **existing project** at `aiauto/`. Do NOT start from scratch. Extend, refactor, and complete what exists.

**Existing files to preserve and extend:**
- Frontend: `index.html`, `auth.html`, `dashboard.html`, `connect.html`, `flows.html`, `inbox.html`, `campaigns.html`, `templates.html`, `analytics.html`, `settings.html`, `admin.html`, `oauth-callback.html`, `privacy.html`, `terms.html`
- JS: `js/config.js`, `js/supabase.js`, `js/auth.js`, `js/instagram.js`, `js/dashboard.js`, `js/flows.js`, `js/inbox.js`, `js/campaigns.js`, `js/analytics.js`, `js/settings.js`, `js/admin.js`
- CSS: `css/main.css`, `css/dashboard.css`, `css/components.css`
- Edge Functions: `supabase/functions/instagram-oauth`, `instagram-webhook`, `send-dm`, `sync-account`, `refresh-token`, `ai-reply`, `flow-executor`, `flow-webhook`
- SQL: `supabase/RUN_THIS_FIRST.sql`, `supabase_schema.sql`, `schema.sql`

**Supabase project:** `ssuqvxfgraphgcnybxcj`  
**Meta App ID (already configured):** `1503208814932037`  
**Brand:** InstaAutomate / InstaFlow Pro — purple `#7C3AED` dark theme

**Priority order:**
1. **Manual Instagram connect** — must work 100% reliably (primary path)
2. **OAuth one-click connect** — secondary path
3. **Webhook + auto-reply flows**
4. **Admin panel** with generated account ID + password
5. **Visual flow builder** (n8n-style)
6. Everything else

---

## PRODUCT VISION

Build **InstaFlow Pro** — production-grade Instagram automation SaaS combining:
- **ManyChat** — keyword flows, comment→DM, story mentions, templates
- **Tidio** — live inbox, assign agents, bot/AI toggles per chat
- **AiSensy** — broadcast campaigns, follower-only targeting, analytics

Two connection methods:
- **One-click OAuth** (ManyChat-style "Connect Instagram" button)
- **Manual setup** (App ID + Secret + Access Token + Instagram User ID) — **must be bulletproof**

Admin panel: separate login (`ADM-2024-001` + password) → full platform control. Normal users → user dashboard.

---

## GITHUB REFERENCES (study patterns, do not copy blindly)

| Project | What to learn |
|---------|---------------|
| `n8n-io/n8n` | Visual node canvas, edges, drag-drop, minimap |
| `typebot-io/typebot` | Conversation flow blocks, conditions |
| `chatwoot/chatwoot` | 3-panel inbox UI, assign/status/labels |
| `calcom/cal.com` | SaaS dashboard layout, settings tabs |
| `supabase/supabase` | RLS policies, auth triggers, Edge Functions |

---

## TECH STACK (DO NOT CHANGE)

| Layer | Technology |
|-------|------------|
| Frontend | HTML5 + CSS3 + Vanilla ES6 modules (no React) |
| Backend | Supabase Edge Functions (Deno/TypeScript) |
| Database | Supabase PostgreSQL + RLS |
| Auth | Supabase Auth (email + Google) + separate `admin_accounts` table |
| Realtime | Supabase Realtime on `conversations`, `messages`, `campaigns` |
| Payments | Razorpay (INR) — optional phase 2 |
| AI | User's own OpenAI / Anthropic / Gemini API key |
| Charts | Chart.js |
| Hosting | Netlify (frontend) + Supabase (backend) |

---

## INSTAGRAM API RULES (MUST ENFORCE IN CODE)

1. **Only reply to users who messaged first** — never proactive cold DMs
2. **24-hour messaging window** — check `window_closes_at` before `send-dm`
3. **Correct OAuth scopes ONLY:**
   ```
   instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments
   ```
   **NEVER use:** `manage_pages`, `pages_show_list` (deprecated, causes OAuth errors)
4. **Rate limits:** 750 comment replies/hour, 200 DMs/hour — enforce in Edge Functions
5. **Tokens:** Store only server-side in Edge Functions / DB; never expose in frontend after save
6. **Manual token validation:** `GET https://graph.facebook.com/v23.0/{ig-user-id}?fields=id,username,account_type&access_token=TOKEN`
7. **Webhook:** Must respond to `hub.challenge` on GET; return 200 within 5s on POST

---

## COMPLETE DATABASE SCHEMA

Run this in Supabase SQL Editor. Merge with existing tables — use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE` where tables already exist.

```sql
-- ================================================================
-- EXTENSIONS
-- ================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- ADMIN SYSTEM (separate from Supabase Auth users)
-- ================================================================
CREATE TABLE IF NOT EXISTS admin_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_by UUID REFERENCES admin_accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO admin_settings (key, value, description) VALUES
('maintenance_mode', 'false', 'Platform maintenance'),
('allow_signups', 'true', 'Allow new registrations'),
('free_plan_limits', '{"contacts": 500, "flows": 3, "messages_per_day": 100}', 'Free limits'),
('platform_name', '"InstaFlow Pro"', 'Display name')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
-- PLANS
-- ================================================================
CREATE TABLE IF NOT EXISTS plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  price_monthly INTEGER DEFAULT 0,
  contact_limit INTEGER DEFAULT 500,
  flow_limit INTEGER DEFAULT 3,
  messages_per_day INTEGER DEFAULT 100,
  ai_replies BOOLEAN DEFAULT false,
  broadcast_campaigns BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO plans (name, display_name, price_monthly, contact_limit, flow_limit, messages_per_day, ai_replies, broadcast_campaigns) VALUES
('free', 'Free', 0, 500, 3, 100, false, false),
('starter', 'Starter', 19900, -1, -1, 1000, true, true),
('pro', 'Pro', 49900, -1, -1, -1, true, true)
ON CONFLICT (name) DO NOTHING;

-- ================================================================
-- PROFILES (extend existing)
-- ================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  plan_name TEXT DEFAULT 'free',
  ai_api_key TEXT,
  ai_provider TEXT DEFAULT 'openai',
  ai_model TEXT DEFAULT 'gpt-4o-mini',
  ai_enabled BOOLEAN DEFAULT false,
  ai_system_prompt TEXT DEFAULT 'Reply helpfully in the user language. Keep it short.',
  contacts_count INTEGER DEFAULT 0,
  messages_today INTEGER DEFAULT 0,
  messages_today_reset TIMESTAMPTZ DEFAULT NOW(),
  onboarding_completed BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- INSTAGRAM (extend existing instagram_accounts + instagram_config)
-- ================================================================
-- Ensure instagram_accounts has these columns (ALTER if missing):
-- connection_method TEXT DEFAULT 'manual'
-- token_type TEXT DEFAULT 'user'
-- page_access_token TEXT
-- webhook_subscribed BOOLEAN DEFAULT false
-- is_primary BOOLEAN DEFAULT false

CREATE TABLE IF NOT EXISTS instagram_config (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  user_id UUID REFERENCES profiles(id),
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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- CONTACTS
-- ================================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  instagram_account_id UUID,
  instagram_user_id TEXT NOT NULL,
  username TEXT,
  name TEXT,
  avatar_url TEXT,
  is_follower BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  opted_in BOOLEAN DEFAULT true,
  last_message_at TIMESTAMPTZ,
  total_messages INTEGER DEFAULT 0,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, instagram_user_id)
);

-- ================================================================
-- FLOWS (visual builder + legacy keyword flows)
-- ================================================================
CREATE TABLE IF NOT EXISTS flows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  instagram_account_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  trigger_keywords TEXT[],
  response_message TEXT,
  nodes JSONB DEFAULT '[]',
  edges JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  is_published BOOLEAN DEFAULT false,
  reply_once_per_contact BOOLEAN DEFAULT true,
  run_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  trigger_type TEXT,
  trigger_config JSONB DEFAULT '{}',
  nodes JSONB DEFAULT '[]',
  edges JSONB DEFAULT '[]',
  is_featured BOOLEAN DEFAULT false
);

-- ================================================================
-- CONVERSATIONS & MESSAGES
-- ================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  instagram_account_id UUID,
  contact_id UUID REFERENCES contacts(id),
  participant_instagram_id TEXT NOT NULL,
  participant_username TEXT,
  status TEXT DEFAULT 'open',
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  ai_enabled BOOLEAN DEFAULT false,
  bot_enabled BOOLEAN DEFAULT true,
  window_open BOOLEAN DEFAULT true,
  window_closes_at TIMESTAMPTZ,
  labels TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instagram_account_id, participant_instagram_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  instagram_message_id TEXT UNIQUE,
  direction TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  content TEXT,
  is_auto_reply BOOLEAN DEFAULT false,
  is_ai_reply BOOLEAN DEFAULT false,
  flow_id UUID REFERENCES flows(id),
  delivery_status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- CAMPAIGNS, TEMPLATES, ANALYTICS
-- ================================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message_content TEXT NOT NULL,
  followers_only BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'draft',
  total_targets INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  event_type TEXT NOT NULL,
  flow_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  date DATE NOT NULL,
  dms_received INTEGER DEFAULT 0,
  dms_sent INTEGER DEFAULT 0,
  auto_replies INTEGER DEFAULT 0,
  flows_triggered INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  error TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- AI SETTINGS (existing — keep compatible)
-- ================================================================
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000002',
  user_id UUID REFERENCES profiles(id),
  enabled BOOLEAN DEFAULT false,
  provider TEXT DEFAULT 'openai',
  api_key TEXT,
  model TEXT DEFAULT 'gpt-4o-mini',
  system_prompt TEXT,
  global_enabled BOOLEAN DEFAULT false
);

-- ================================================================
-- RLS
-- ================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "own_profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY IF NOT EXISTS "own_flows" ON flows FOR ALL USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "own_conversations" ON conversations FOR ALL USING (auth.uid() = user_id);

-- Service role bypasses RLS in Edge Functions

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## EDGE FUNCTIONS (7 required — extend existing)

Deploy to: `https://ssuqvxfgraphgcnybxcj.supabase.co/functions/v1/`

### 1. `validate-token` (NEW — critical for manual connect)
```
POST { access_token, instagram_user_id?, app_id? }
→ GET graph.facebook.com/v23.0/{id}?fields=id,username,account_type,name,profile_picture_url,followers_count
→ If account_type not BUSINESS/CREATOR → return error with fix instructions
→ Upsert instagram_accounts + instagram_config for auth.uid()
→ Return { success, account: { id, username, ... } }
```

### 2. `instagram-oauth` (extend existing)
- Exchange code → long-lived token
- Correct scopes only (see above)
- Upsert instagram_accounts
- Redirect to oauth-callback.html with postMessage

### 3. `instagram-webhook` (extend existing — core engine)
```
GET  → hub.challenge verification (WEBHOOK_VERIFY_TOKEN)
POST → parse entry.messaging / entry.changes
     → find instagram_account by instagram_user_id in payload
     → upsert contact + conversation + message
     → match flows (trigger_type + trigger_config / trigger_keywords)
     → OR call ai-reply if ai_enabled on conversation
     → send via send-dm
     → log analytics_events
     → return 200 immediately
```

### 4. `send-dm` (extend existing)
- Enforce 24h window
- Enforce plan messages_per_day limit
- POST `/{ig-user-id}/messages` with recipient id
- Retry on 429 with backoff
- Insert into messages table

### 5. `execute-flow` / `flow-executor` (merge into one)
Node types to support:
- `trigger`, `send_message`, `condition`, `wait`, `tag_contact`, `ai_reply`, `webhook_call`, `assign_agent`

Walk `nodes` + `edges` JSON from flows table.

### 6. `ai-reply` (extend existing)
- Read user's ai_settings / profiles.ai_api_key
- Last 10 messages as context
- OpenAI / Anthropic / Gemini based on provider
- Return text only; caller sends via send-dm

### 7. `admin-api` (NEW)
```
POST /login        → { account_id, password } → JWT (ADMIN_JWT_SECRET)
GET  /users        → paginated, service role
PATCH /users/:id   → plan, is_active, notes
POST /accounts     → generate admin_accounts row (ADM-YYYY-NNN + random password)
GET  /stats        → platform totals
PATCH /settings    → admin_settings
```

**Secrets (Supabase Dashboard → Edge Functions → Secrets):**
```
INSTAGRAM_APP_ID=1503208814932037
INSTAGRAM_APP_SECRET=
INSTAGRAM_REDIRECT_URI=https://YOUR_NETLIFY_URL/oauth-callback.html
WEBHOOK_VERIFY_TOKEN=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_JWT_SECRET=
ENCRYPTION_KEY=
```

---

## MANUAL CONNECT — MUST WORK PERFECTLY

This is the **primary** path. Extend `connect.html` + `js/instagram.js`.

### UI (already in connect.html — improve it)

**Tab 1: Manual Entry (default)**
Fields:
1. Meta App ID (default: `1503208814932037`)
2. App Secret (password field)
3. Instagram Account ID (IG User ID from Graph API — e.g. `17841479703413737`)
4. Access Token (textarea, monospace)
5. Optional: Page Access Token (for never-expiring)

Buttons:
- **Test Connection** → calls `validate-token` edge function
- **Save & Connect** → saves to DB, shows success card with @username + followers
- **Refresh Token Guide** → expandable steps for Graph API Explorer

**Tab 2: OAuth Popup**
- Single gradient button: "Connect with Instagram"
- Opens popup to `https://www.instagram.com/oauth/authorize?...`
- Correct scopes from `APP_CONFIG.oauthScopes` in config.js

### Manual connect JavaScript logic

```javascript
async function testManualConnection() {
  const token = document.getElementById('manualToken').value.trim();
  const igId = document.getElementById('manualInstagramId').value.trim();
  const appId = document.getElementById('manualAppId').value.trim();

  const res = await fetch(`${APP_CONFIG.supabaseUrl}/functions/v1/validate-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`
    },
    body: JSON.stringify({ access_token: token, instagram_user_id: igId, app_id: appId })
  });
  const data = await res.json();
  // Show success: @username, account type, followers
  // Show error: specific fix (wrong token, personal account, etc.)
}

async function saveManualConnection() {
  // Same as test but also sets webhook_subscribed flag
  // Mirror to instagram_config row id 00000000-0000-0000-0000-000000000001
  // Redirect to dashboard with toast
}
```

### Token guide (show in connect page)

1. Go to `developers.facebook.com/tools/explorer`
2. Generate token with: `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`
3. Exchange for 60-day: `GET /oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=SECRET&fb_exchange_token=SHORT_TOKEN`
4. Optional Page token (never expires): `GET /me/accounts?access_token=LONG_TOKEN`
5. Debug token: `GET /debug_token?input_token=TOKEN&access_token=APP_ID|APP_SECRET`

---

## OAUTH ONE-CLICK BUTTON (ManyChat style)

```javascript
function connectInstagramOAuth() {
  const { defaultAppId, redirectUri, oauthScopes } = APP_CONFIG;
  const state = crypto.randomUUID();
  sessionStorage.setItem('oauth_state', state);

  const url = `https://www.instagram.com/oauth/authorize` +
    `?client_id=${defaultAppId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(oauthScopes)}` +
    `&response_type=code` +
    `&state=${state}`;

  const popup = window.open(url, 'ig_oauth', 'width=600,height=700,scrollbars=yes');

  window.addEventListener('message', (e) => {
    if (e.origin !== window.location.origin) return;
    if (e.data?.type === 'INSTAGRAM_CONNECTED') {
      popup?.close();
      loadConnectedAccounts();
      showToast('Instagram connected!');
    }
  });
}
```

`oauth-callback.html` exchanges code via `instagram-oauth` edge function, then `postMessage` to opener.

---

## ADMIN PANEL

### Separate login: `admin-login.html` (CREATE NEW)

- Fields: Account ID (`ADM-2024-001`), Password
- POST to `admin-api/login`
- Store `admin_token` + `admin_data` in localStorage (prefix `admin_`)
- **Never mix** with Supabase user session

### Auth routing (add to all pages)

```javascript
function routeByAuth() {
  const isAdminPage = location.pathname.includes('/admin');
  const adminToken = localStorage.getItem('admin_token');
  const { data: { session } } = await supabase.auth.getSession();

  if (adminToken && !isAdminPage) location.href = 'admin/dashboard.html';
  if (!adminToken && isAdminPage && !location.pathname.includes('admin-login')) location.href = 'admin-login.html';
  if (!adminToken && !session && !isPublicPage()) location.href = 'auth.html';
}
```

### Extend `admin.html` → split into:

```
admin-login.html
admin/dashboard.html    — stats overview
admin/users.html        — user table, edit plan, suspend
admin/accounts.html     — generate ADM-YYYY-NNN credentials
admin/settings.html     — maintenance mode, plan limits
admin/analytics.html    — platform-wide charts
```

### Generate admin account (admin/accounts.html)

```javascript
// Calls admin-api POST /accounts
// Returns ONCE: { account_id: "ADM-2026-001", password: "xK9#mP2..." }
// Show in modal with copy buttons — never show again
```

### Admin capabilities

- View all users (email, plan, IG connected, messages today)
- Upgrade/downgrade plan manually
- Add notes to user
- Suspend/activate user
- Toggle maintenance mode
- View webhook_logs errors
- Platform stats: total users, DMs today, revenue (phase 2)
- Generate new admin/support accounts

---

## USER APP PAGES

### Onboarding (`app/onboarding.html` — CREATE)

5 steps: Welcome → Connect (Manual default / OAuth) → First flow template → Done

### Dashboard (`dashboard.html` — extend)

- Connection status card (green/red)
- Today's stats: DMs in, auto-replies, flows triggered
- 7-day chart (Chart.js)
- Recent conversations
- Quick actions

### Inbox (`inbox.html` — extend to Tidio-style)

**3 panels:**
- Left: conversation list, filters (All/Open/Resolved), search
- Center: messages, bot toggle, AI toggle, template picker, send
- Right: contact info, tags, notes

**Realtime:** `supabase.channel('conversations').on('postgres_changes', ...)`

### Flow Builder (`flow-builder.html` — CREATE NEW)

Visual canvas (vanilla JS + SVG or Canvas):
- Node palette (left): Triggers, Messages, Logic, Actions
- Canvas (center): drag nodes, connect edges
- Config panel (right): edit selected node
- Save nodes/edges JSON to `flows` table
- Publish toggle

**Node types:**
| Type | Config |
|------|--------|
| dm_keyword | keywords[], match: contains/exact |
| dm_first | — |
| comment_keyword | keywords[], post_id optional |
| story_mention | — |
| send_message | text, media_url, buttons[] |
| condition | field, operator, value |
| wait | minutes |
| ai_reply | prompt override |
| tag_contact | tag name |

### Flows list (`flows.html` — extend)

- Table: name, trigger, status, runs, last triggered
- Duplicate, delete, edit in builder
- Template gallery from `flow_templates`

### Campaigns (`campaigns.html` — extend)

- Create wizard: audience → message → schedule → review
- **followers_only: true** by default
- Only contacts who previously messaged
- Live progress via Realtime

### Templates (`templates.html`)

- CRUD with `{{name}}`, `{{username}}` variables
- Use in inbox + flows

### Analytics (`analytics.html` — extend)

- Date range picker
- Cards + Chart.js (line, bar, donut)
- Export CSV

### Settings (`settings.html` — extend)

Tabs: Profile | Instagram | AI | Notifications | Billing | Developer

**Instagram tab:**
- Connected accounts
- Token expiry + refresh button
- Manual token update form
- Webhook status (call GET webhook subscription check)
- Webhook setup guide with copy URL:
  `https://ssuqvxfgraphgcnybxcj.supabase.co/functions/v1/instagram-webhook`

**AI tab:**
- Global toggle
- Provider + API key (masked) + test button
- System prompt
- Per-conversation override (from inbox)

---

## WEBHOOK SETUP GUIDE (show in connect.html + settings)

Meta Developer → Your App → Instagram → Webhooks:
- **Callback URL:** `https://ssuqvxfgraphgcnybxcj.supabase.co/functions/v1/instagram-webhook`
- **Verify Token:** same as `WEBHOOK_VERIFY_TOKEN` secret
- **Fields:** `messages`, `messaging_postbacks`, `message_reactions` (if available)

For local dev: use ngrok (`npm run tunnel` — already in project) and update callback URL temporarily.

---

## FLOW EXECUTION LOGIC (instagram-webhook)

```typescript
async function processIncomingDM(igAccountId, senderId, messageText, timestamp) {
  // 1. Upsert contact + conversation
  // 2. Check conversation.bot_enabled — if false, return
  // 3. Check conversation.ai_enabled — if true, call ai-reply
  // 4. Else find matching flows:
  const flows = await getActiveFlows(igAccountId);
  for (const flow of flows) {
    if (matchesTrigger(flow, messageText, 'dm')) {
      await executeFlow(flow, senderId);
      if (flow.reply_once_per_contact) break;
    }
  }
}

function matchesTrigger(flow, text, eventType) {
  switch (flow.trigger_type) {
    case 'dm_keyword':
      const keywords = flow.trigger_config?.keywords || flow.trigger_keywords || [];
      return keywords.some(k => text.toLowerCase().includes(k.toLowerCase()));
    case 'dm_first':
      return isFirstMessage(contactId);
    case 'dm_any':
      return true;
    // comment_keyword, story_mention handled in separate handlers
  }
}
```

---

## AI TOGGLE (3 levels)

1. **Global** — `profiles.ai_enabled` + `ai_settings`
2. **Per conversation** — `conversations.ai_enabled` (toggle in inbox)
3. **Per flow node** — `ai_reply` node in flow builder

Priority: flow node > conversation > global

---

## META APP REVIEW PREP

`privacy.html` and `terms.html` must state:
- Data collected: Instagram username, messages (only from users who contacted the business)
- Purpose: automation on behalf of account owner
- Retention: until account deletion
- Deletion: Settings → Delete Account removes all data

App Review description:
> "InstaFlow Pro helps Instagram Business and Creator accounts automate replies to incoming messages and comments using keyword rules and optional AI, via the official Instagram Graph API."

---

## DESIGN SYSTEM (match existing css/)

```css
:root {
  --accent: #7C3AED;
  --accent-pink: #EC4899;
  --bg-primary: #0A0F1E;
  --bg-secondary: #111827;
  --bg-card: #1F2937;
  --border: rgba(255,255,255,0.08);
  --text-primary: #F9FAFB;
  --text-secondary: #9CA3AF;
  --success: #10B981;
  --danger: #EF4444;
}
```

Admin panel: lighter theme (`--bg-primary: #F3F4F6`) to visually separate from user app.

---

## BUILD ORDER (follow exactly)

1. Run full SQL schema in Supabase (merge with RUN_THIS_FIRST.sql)
2. Deploy `validate-token` edge function
3. Fix manual connect end-to-end (test with real token)
4. Fix `instagram-webhook` + test with Meta webhook tester
5. Fix `send-dm` + 24h window check
6. Build `admin-login.html` + `admin-api` edge function
7. Split admin panel pages
8. Build onboarding wizard
9. Upgrade inbox to 3-panel Tidio style
10. Build visual flow-builder.html
11. Extend campaigns + analytics
12. AI settings + per-chat toggle
13. Landing page polish (index.html)
14. Deploy frontend to Netlify
15. Configure Meta webhook + OAuth redirect URIs
16. End-to-end test: DM keyword → auto-reply
17. Meta App Review submission

---

## FIXES REQUIRED IN EXISTING CODE

### config.js
Ensure scopes are:
```javascript
oauthScopes: [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments'
].join(',')
```
NOT `instagram_manage_messages` (old scope names cause errors).

### instagram.js
- Remove any `manage_pages` or `pages_show_list` from OAuth URLs
- Manual save must call `validate-token` not direct Graph API from browser (CORS + security)

### instagram-webhook/index.ts
- Look up account by `instagram_user_id` from webhook payload
- Support both `instagram_accounts` and `instagram_config` tables during migration

### auth.js
- On login: if email in admin allowlist OR valid admin_token → admin dashboard
- Regular users → check onboarding_completed

---

## ENVIRONMENT VARIABLES CHECKLIST

| Variable | Where | Have it? |
|----------|-------|----------|
| INSTAGRAM_APP_ID | Supabase secrets | ✅ 1503208814932037 |
| INSTAGRAM_APP_SECRET | Supabase secrets | ⬜ |
| INSTAGRAM_REDIRECT_URI | Supabase secrets | ⬜ (Netlify URL) |
| WEBHOOK_VERIFY_TOKEN | Supabase secrets | ⬜ |
| SUPABASE_SERVICE_ROLE_KEY | Supabase secrets | ⬜ |
| ADMIN_JWT_SECRET | Supabase secrets | ⬜ |

---

## TESTING CHECKLIST

- [ ] Manual connect: paste token → Test → Save → dashboard shows @username
- [ ] OAuth connect: popup → callback → dashboard connected
- [ ] Webhook verify: Meta sends challenge → returns hub.challenge
- [ ] DM from second account → appears in inbox
- [ ] Keyword flow "price" → auto-reply within 5 seconds
- [ ] AI toggle on conversation → AI reply sent
- [ ] 24h window: cannot send after window closes (show error)
- [ ] Admin login with ADM-2026-001 → admin dashboard only
- [ ] Normal user login → never sees admin panel
- [ ] Campaign sends only to prior contacts

---

## AGENT INSTRUCTIONS

1. **Read all existing files before writing** — extend, don't duplicate
2. **Manual connect is priority #1** — must work without OAuth
3. **Never expose access tokens in frontend** after initial save (mask in UI)
4. **All Instagram API calls from Edge Functions only**
5. **Add loading skeletons, empty states, error toasts on every page**
6. **Mobile responsive** except flow builder canvas
7. **Use existing Supabase project** — don't create new project
8. **Keep InstaAutomate branding** unless renaming to InstaFlow Pro consistently
9. **Comment code only for non-obvious business logic**
10. **Do not break existing reels/analysis features** — keep as optional pages

---

## QUICK START FOR DEVELOPER

```bash
# Local frontend
python -m http.server 8000
# or
npm run tunnel   # ngrok for webhook testing

# Deploy edge functions
supabase functions deploy validate-token
supabase functions deploy instagram-webhook
supabase functions deploy instagram-oauth
supabase functions deploy send-dm
supabase functions deploy admin-api
```

Open `http://localhost:8000/connect.html` → Manual tab → paste token → Test & Connect.

---

*End of master prompt. Paste this entire document into Cursor/Bolt/Lovable and say: "Build exactly as specified, extending the existing aiauto codebase."*
