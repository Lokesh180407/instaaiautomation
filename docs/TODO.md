# InstaFlow Pro — Build Checklist

> Master spec: `docs/instaflow-saas-master-prompt.md` · Roadmap: `docs/INSTAFLOW_BUILD_ROADMAP.md`

## Phase A — Foundation & Compliance
- [x] InstaFlow foundation migration (`supabase/migrations/20260522_instaflow_pro_foundation.sql`)
- [x] Admin login page + `admin-api` edge function scaffold
- [ ] Run foundation migration + seed first admin (`supabase/scripts/seed_first_admin.sql`)
- [ ] Deploy `admin-api` edge function with `ADMIN_JWT_SECRET` env
- [ ] Review and align Supabase schema with current code expectations (flows/templates/ai settings).
- [ ] Implement correct webhook signature verification (X-Hub-Signature-256) in webhook edge functions.
- [ ] Ensure Meta webhook callback URL in dashboard matches this endpoint: https://ssuqvxfgraphgcnybxcj.supabase.co/functions/v1/instagram-webhook
- [ ] Ensure Meta webhook verify token matches WEBHOOK_VERIFY_TOKEN env var.

- [ ] Add policy enforcement in backend before sending: DM 24h window + only reply to initiated contacts + campaign targeting constraints.
- [ ] Implement queue + rate limiting so webhook responds <20s and Meta 750 calls/hour is respected.

## Phase B — Core Automation Engines
- [x] AI Agent pipeline (`instagram-webhook` + `_shared/*` + `20260522_ai_agent_pipeline.sql`)
- [x] Architecture doc: `docs/AI_AGENT_ARCHITECTURE.md`
- [x] Normalize flow types and ensure trigger keyword matching (contains/exact/starts_with + case sensitivity).
- [x] Webhook dedup via `webhook_events` table
- [ ] Enforce reply-once-per-user cooldown (DB column exists on flows)




- [ ] Wire AI replies strictly per-user AI API key/provider/system prompt.
- [ ] Add conversation history retrieval for AI context.

## Phase C — Operator Features (Reels + Comments + Templates)
- [ ] Verify reel caching sync and ensure per-reel automation rules work end-to-end.
- [ ] Implement comment auto-reply engine with correct recipient mapping and per-user limits.
- [ ] Render templates variables ({{username}}, {{name}}, {{link}}) when executing flows.

## Phase D — UI / Product Pages
- [ ] Ensure flows UI maps correctly to DB columns (including comment/reel automation fields).
- [ ] Implement inbox UI with per-conversation AI toggle and badges.
- [ ] Ensure reels page modal saves/edits correct flow rows.
- [ ] Ensure comments page modal saves/edits correct flow rows.
- [ ] Add analytics charts + CSV export + date range.
- [ ] Settings page: masked API key, test connection, webhook status.
- [ ] Add admin controls + usage tracking (as required).

## Phase E — Deploy & Meta Review
- [ ] Deploy frontend to Netlify and backend to Supabase.
- [ ] Create Meta App Review package: privacy/terms, webhook verification, screencast instructions.
- [ ] Validate with a test Instagram account and webhook event testing.

