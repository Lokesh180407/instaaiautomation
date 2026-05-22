# InstaFlow Pro — Build Roadmap

Master spec: [instaflow-saas-master-prompt.md](./instaflow-saas-master-prompt.md)

## Current codebase (InstaAutomate / aiauto)

| Area | Status |
|------|--------|
| Landing, auth, OAuth callback | Exists (`index.html`, `auth.html`, `oauth-callback.html`) |
| Dashboard, inbox, flows, campaigns, analytics, settings | Exists (flat HTML + `js/*`) |
| Edge functions | `instagram-oauth`, `instagram-webhook`, `send-dm`, `ai-reply`, `flow-executor`, `sync-account` |
| Schema | Simpler `flows` (keywords + response_message), not visual nodes/edges |
| Admin panel | Single `admin.html` — no separate admin auth |
| Flow builder canvas | Not built |
| Razorpay / Resend | Not wired |
| `admin-api`, `execute-flow`, `run-campaign`, `send-message` | Missing (partial overlap with existing functions) |

## Build order (from master prompt)

1. **Foundation** — Run `supabase/migrations/20260522_instaflow_pro_foundation.sql` in Supabase SQL Editor
2. **Admin** — `admin-login.html` + `admin/*` pages + `admin-api` edge function
3. **Onboarding** — `app/onboarding.html` with OAuth + manual connect
4. **App shell** — Move pages under `app/` with shared sidebar
5. **Inbox** — Three-panel Tidio-style (enhance `inbox.html`)
6. **Flow builder** — `app/flow-builder.html` + canvas editor
7. **Webhook engine** — Extend `instagram-webhook` for visual flow execution
8. **Campaigns + Realtime** — `run-campaign` function
9. **Billing** — Razorpay
10. **Deploy + Meta review**

## Next implementation slice (recommended)

Phase A from `TODO.md` plus InstaFlow foundation migration and admin login API.
