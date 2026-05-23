# Webhook + Supabase Inbox Setup Guide

Ported from the Insta-agent reference into **InstaFlow / InstaAutomate** (vanilla JS + Supabase Edge Functions).

## Architecture

```
Instagram DM → Meta Webhook → instagram-webhook (Edge) → Supabase → AI → Graph API → User
                                                                    ↓
                                                          inbox.html (Realtime)
```

| Reference (Next.js) | This project |
|---------------------|--------------|
| `POST /api/webhook` | `POST …/functions/v1/instagram-webhook` |
| `instagram_conversations` | `conversations` |
| `instagram_messages` | `messages` |
| `mode: agent \| human` | `human_handoff` (false = AI agent, true = human only) |
| Next.js Realtime | `js/inbox.js` channel `inbox-live` |

---

## Step 1 — Supabase SQL (run in order)

1. `supabase_schema.sql` or existing schema
2. `supabase/migrations/20260522_instaflow_pro_foundation.sql`
3. `supabase/migrations/20260522_ai_agent_pipeline.sql`
4. `supabase/migrations/20260522_realtime_inbox.sql` ← **required for live inbox**
5. `supabase/RUN_THIS_FIRST.sql` — link your Instagram account + token

---

## Step 2 — Supabase Edge Function secrets

In [Supabase Dashboard](https://app.supabase.com) → Project → Edge Functions → Secrets:

| Secret | Example | Purpose |
|--------|---------|---------|
| `WEBHOOK_VERIFY_TOKEN` | `my_random_verify_123` | Meta webhook GET verification |
| `INSTAGRAM_APP_SECRET` | From Meta app | `X-Hub-Signature-256` validation |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | DB writes from webhook |
| `OPENROUTER_API_KEY` | Optional | AI with free model fallback chain |
| `AI_MODEL` | `google/gemma-3-12b-it:free` | Preferred OpenRouter model |

Deploy functions:

```bash
cd c:\Users\lokes\OneDrive\Desktop\aiauto
supabase functions deploy instagram-webhook
supabase functions deploy ai-reply
supabase functions deploy send-dm
```

---

## Step 3 — Meta Developer Console (Webhook)

1. Open [Meta for Developers](https://developers.facebook.com/) → Your App → **Instagram** → **Webhooks**
2. **Callback URL:**

   ```
   https://ssuqvxfgraphgcnybxcj.supabase.co/functions/v1/instagram-webhook
   ```

3. **Verify token:** same as `WEBHOOK_VERIFY_TOKEN` in Supabase secrets
4. Click **Verify and save**
5. Subscribe to field: **`messages`** (and `comments` if using comment flows)
6. Ensure app has permissions:
   - `instagram_business_basic`
   - `instagram_business_manage_messages`
   - `instagram_business_manage_comments`

### Webhook payload rules (implemented)

- Only `object: "instagram"` events processed
- **Echo messages** (`message.is_echo`) ignored — avoids reply loops
- **Text-only** DMs processed
- Duplicate `mid` deduped via `webhook_events` + unique `instagram_message_id`

---

## Step 4 — Instagram access token

Store token in **one** of:

- `instagram_accounts.access_token` (per user, recommended)
- `instagram_config.long_lived_token` (single-tenant fallback)

**One-click connect (recommended):**

1. Edge secrets: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`
2. Meta → Facebook Login → redirect URI: `http://localhost:8000/oauth-callback.html`
3. `supabase functions deploy instagram-oauth`
4. `http://localhost:8000/connect.html` → **Connect Instagram**

See **`docs/META_OAUTH_FLOW.md`**. Manual: Advanced section on connect page or `RUN_THIS_FIRST.sql`.

Send API uses (in order):

1. `https://graph.instagram.com/v24.0/me/messages` (reference pattern)
2. Fallback: `https://graph.facebook.com/v23.0/{ig-id}/messages`

---

## Step 5 — AI configuration

**Option A — OpenRouter (platform key)**

Set `OPENROUTER_API_KEY` in Supabase secrets. All tenants can use fallback models.

**Option B — Per-user keys**

`http://localhost:8000/settings.html` → AI tab → provider + API key + system prompt.

---

## Step 6 — Inbox + Realtime

1. Run migration `20260522_realtime_inbox.sql`
2. Open `http://localhost:8000/inbox.html` (logged in)
3. **Agent mode** — AI auto-replies (default for new chats)
4. **Human mode** — messages stored only; you reply manually

Toggle: header button **Agent / Human** (maps to `conversations.human_handoff`).

Realtime listens on:

- `INSERT` on `messages`
- changes on `conversations`

---

## Step 7 — Test webhook

1. Send a DM to your connected Instagram business account
2. Check Supabase → `webhook_events` (processed = true)
3. Check `conversations` + `messages` rows
4. Inbox should update live (if Realtime migration ran)

Test GET verification manually:

```
https://ssuqvxfgraphgcnybxcj.supabase.co/functions/v1/instagram-webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123
```

Should return plain text: `test123`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Webhook verify fails | Match `WEBHOOK_VERIFY_TOKEN` in Meta + Supabase |
| 403 Invalid signature | Set `INSTAGRAM_APP_SECRET` in Edge secrets |
| No auto-reply | Check `human_handoff = false`, token in `instagram_accounts`, AI key or OpenRouter |
| Inbox not live | Run `20260522_realtime_inbox.sql` |
| Duplicate replies | Echo filter + `webhook_events` dedup (already in code) |
| Profile empty | Token needs `instagram_business_manage_messages` scope |

---

## Local dev

```powershell
cd c:\Users\lokes\OneDrive\Desktop\aiauto
npm run dev
```

App: **http://localhost:8000**

For OAuth/webhooks from Meta to local machine, use ngrok (`npm run tunnel`) and add ngrok URL to Meta redirect + Supabase auth URLs.
