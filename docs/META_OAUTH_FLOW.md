# Meta OAuth — One-Click Connect (ManyChat-style)

## User flow

```
Signup → Connect Instagram button → Meta popup → Dashboard (bot live)
```

## What happens automatically (backend)

| Step | Action |
|------|--------|
| 1 | User clicks **Connect Instagram** |
| 2 | Redirect to `facebook.com/v23.0/dialog/oauth` |
| 3 | User logs in, selects Page + grants permissions |
| 4 | Meta redirects to `oauth-callback.html?code=…` |
| 5 | Edge function exchanges code → short-lived token |
| 6 | Exchange → **60-day** long-lived user token |
| 7 | `GET /me/accounts` — list Facebook Pages |
| 8 | Find `instagram_business_account` on Page |
| 9 | `POST /{page-id}/subscribed_apps` — **auto webhook subscribe** |
| 10 | Store token, page_id, IG id, webhook flag in Supabase |

## Code locations

| Piece | File |
|-------|------|
| OAuth URL + token exchange | `supabase/functions/_shared/meta-oauth.ts` |
| Edge API | `supabase/functions/instagram-oauth/index.ts` |
| Callback page | `oauth-callback.html` |
| Connect button | `connect.html` + `js/instagram.js` → `connectWithMetaOAuth()` |

## Supabase secrets (required)

```
INSTAGRAM_APP_ID=1503208814932037
INSTAGRAM_APP_SECRET=<from Meta App Dashboard>
INSTAGRAM_REDIRECT_URI=https://YOUR_DOMAIN/oauth-callback.html
WEBHOOK_VERIFY_TOKEN=<random string>
```

For local dev with ngrok:

```
INSTAGRAM_REDIRECT_URI=https://xxxx.ngrok-free.app/oauth-callback.html
```

## Meta App setup

1. [developers.facebook.com](https://developers.facebook.com) → Your App
2. **Facebook Login** → Settings → Valid OAuth Redirect URIs:
   - `http://localhost:8000/oauth-callback.html` (dev)
   - `https://your-domain.com/oauth-callback.html` (prod)
3. **Webhooks** → Callback URL (app-level, still required):
   - `https://ssuqvxfgraphgcnybxcj.supabase.co/functions/v1/instagram-webhook`
   - Verify token = `WEBHOOK_VERIFY_TOKEN`
4. Add **Instagram** product + request permissions:
   - `instagram_manage_messages`
   - `pages_manage_metadata`
   - `pages_show_list`

Page-level subscription is done automatically by our backend; app-level webhook must still be configured once in Meta.

## Deploy

```bash
supabase functions deploy instagram-oauth
```

## Requirements (users)

- Instagram **Professional** account
- Connected to a **Facebook Page**
- User is **admin** on that Page
