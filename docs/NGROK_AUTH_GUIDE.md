# Quick Start - 3 Terminal Approach (RECOMMENDED)

## Terminal 1: ngrok Tunnel
```bash
npm run tunnel
```
**Expected Output:**
```
╔════════════════════════════════════════════════════════════════╗
║                   ✅ ngrok Tunnel Started                       ║
╚════════════════════════════════════════════════════════════════╝

🔗 PUBLIC NGROK URL: https://abc123.ngrok.io
📋 IMPORTANT: Add this to Supabase OAuth redirect URLs:
   https://abc123.ngrok.io/oauth-callback.html
```

## Step 2: Configure Supabase
1. Open: https://app.supabase.com
2. Select your project: ssuqvxfgraphgcnybxcj
3. Go to: **Authentication → Settings**
4. Find: **Authorized redirect URLs**
5. **Add** this URL: `https://YOUR_NGROK_URL/oauth-callback.html`
   - Example: `https://abc123.ngrok.io/oauth-callback.html`
6. **Save** the changes

## Terminal 2: Dev Server
```bash
npm run dev
```
**Expected Output:**
```
✔ Accepting connections at http://localhost:8000
```

## Terminal 3: Test (Optional)
```bash
# Test that .env.local was created
cat .env.local

# Should output:
# NGROK_URL=https://abc123.ngrok.io
# NGROK_TIMESTAMP=2026-05-22T10:30:00Z
```

## Access Your App
- **Login Page**: https://abc123.ngrok.io/auth.html
- **Dashboard**: https://abc123.ngrok.io/dashboard.html
- **Admin Panel**: https://abc123.ngrok.io/admin.html

---

# Current Configuration

## Supabase Project Details
- **URL**: https://ssuqvxfgraphgcnybxcj.supabase.co
- **Anon Key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
- **Region**: Unknown (check dashboard)

## App Configuration
- **File**: `js/config.js`
- **Reads from**: `.env.local` (ngrok script creates this)
- **Fallback**: `window.location.origin` if no ngrok URL

---

# How It Works

```
┌─────────────────┐
│  Browser        │
│  Local: 8000    │  Accesses via ngrok public URL
└────────┬────────┘
         │
         │ https://abc123.ngrok.io/auth.html
         │
         ▼
┌─────────────────┐
│  ngrok Tunnel   │ (public HTTPS endpoint)
└────────┬────────┘
         │
         │ http://localhost:8000
         │
         ▼
┌─────────────────┐
│  Dev Server     │
│  Port: 8000     │ (static file server)
└────────┬────────┘
         │
         │ JS/HTML make API calls to Supabase
         │
         ▼
┌─────────────────────────────────────┐
│  Supabase                           │
│  https://ssuqvxfgraphgcnybxcj...    │ (backend + auth)
└─────────────────────────────────────┘
```

### OAuth Flow (Step by Step)

1. **User clicks "Sign in with Google"** at https://abc123.ngrok.io/auth.html
2. **config.js sets**: `redirectUri = "https://abc123.ngrok.io/oauth-callback.html"`
3. **App makes OAuth request** to Supabase with redirect URI
4. **Supabase checks**: "Is this redirect URI in my allowed list?"
   - ✅ If yes: Proceeds with OAuth
   - ❌ If no: Returns error "Invalid redirect_uri"
5. **User logs in** with Google
6. **Google redirects** to: `https://abc123.ngrok.io/oauth-callback.html?code=...`
7. **Supabase handles** the callback (automatic)
8. **User redirected** to: `https://abc123.ngrok.io/dashboard.html`

---

# Common Issues & Fixes

## Issue 1: "Invalid redirect_uri"
**Symptoms:**
- OAuth button shows error
- Console shows: "Invalid redirect_uri"

**Cause:**
- ngrok URL not added to Supabase settings
- OR using old ngrok URL after restart

**Fix:**
```
1. Get new ngrok URL from Terminal 1 output
2. Go to Supabase > Authentication > Settings
3. Update the redirect URL to the NEW ngrok URL
4. Refresh browser and try again
```

## Issue 2: "No .env.local created"
**Symptoms:**
- App uses localhost URL instead of ngrok URL
- OAuth redirects fail

**Cause:**
- ngrok tunnel didn't start properly
- OR ngrok didn't have permission to write file

**Fix:**
```bash
# Check if ngrok process is running
npx ngrok list-tunnels

# If not running, try:
npm run tunnel

# Verify .env.local exists:
ls -la .env.local

# Or manually create it:
echo "NGROK_URL=https://YOUR_URL_HERE" > .env.local
```

## Issue 3: "Cannot reach Supabase"
**Symptoms:**
- Auth fails even after URL update
- Console shows CORS error

**Cause:**
- Browser blocked request
- OR invalid Supabase URL in config.js

**Fix:**
1. Check `js/config.js` has correct URL:
   ```javascript
   supabaseUrl: 'https://ssuqvxfgraphgcnybxcj.supabase.co'
   ```
2. Check browser console for exact error
3. Try accessing Supabase dashboard to verify it's working

## Issue 4: "Port 8000 already in use"
**Symptoms:**
- Dev server fails to start
- Error: "EADDRINUSE 127.0.0.1:8000"

**Fix:**
```bash
# Find what's using port 8000
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Kill the process or use different port
npm run dev -- -l 8001
```

## Issue 5: Sign up works but sign in fails
**Symptoms:**
- Can create account
- But login returns "invalid_credentials"

**Cause:**
- Email confirmation is enabled
- Account not verified yet

**Fix:**
1. Check your email for verification link
2. Click the link
3. Try signing in again
4. OR disable email confirmation in Supabase

---

# Environment Variables Reference

## .env.local (Auto-generated)
```
NGROK_URL=https://abc123.ngrok.io
NGROK_TIMESTAMP=2026-05-22T10:30:00Z
```

## app/config.js (Manual)
```javascript
APP_CONFIG = {
  supabaseUrl: 'https://ssuqvxfgraphgcnybxcj.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIs...',
  defaultAppId: '1503208814932037',
  oauthScopes: 'instagram_business_basic,...',
  webhookUrl: 'https://ssuqvxfgraphgcnybxcj.supabase.co/functions/v1/instagram-webhook',
}
```

---

# Testing OAuth Locally

## Pre-requisites
1. ngrok tunnel running and URL added to Supabase
2. Dev server running
3. Valid Google account for testing

## Test Steps
1. Open: https://YOUR_NGROK_URL/auth.html
2. Click "Sign in with Google"
3. Enter test Google account credentials
4. Check if redirect to dashboard works
5. Verify `supabase.auth.getSession()` returns valid session

## Debug
- Press F12 to open browser DevTools
- Go to **Console** tab
- Look for errors related to auth or redirect
- Check **Network** tab to see if OAuth requests succeed

---

# Advanced: Environment-Specific Config

## Development (with ngrok)
```
BASE_URL: https://abc123.ngrok.io
SUPABASE_URL: https://ssuqvxfgraphgcnybxcj.supabase.co
```

## Localhost Only (no ngrok)
```
BASE_URL: http://localhost:8000
SUPABASE_URL: https://ssuqvxfgraphgcnybxcj.supabase.co
```

## Production
```
BASE_URL: https://yourdomain.com
SUPABASE_URL: https://ssuqvxfgraphgcnybxcj.supabase.co
```

---

# Next Steps

1. ✅ **Start ngrok**: `npm run tunnel`
2. ✅ **Update Supabase**: Add ngrok URL to redirect URIs
3. ✅ **Start dev server**: `npm run dev`
4. ✅ **Test auth**: Visit https://YOUR_NGROK_URL/auth.html
5. ✅ **Sign up**: Create a test account
6. ✅ **Verify**: Check if you reach the dashboard
7. 📱 **Connect Instagram**: Go to Settings and add credentials

---

# Support

If something doesn't work:

1. **Check Console** (F12): Look for red error messages
2. **Check Terminal**: Look for error messages in Terminal 1 or 2
3. **Restart Everything**:
   ```bash
   # Close all terminals (Ctrl+C in each)
   rm .env.local
   npm run tunnel  # Terminal 1
   npm run dev     # Terminal 2 (new)
   ```
4. **Verify Supabase URL**: Make sure redirect URL matches exactly
5. **Clear Cache**: Ctrl+Shift+Delete in browser, clear "All time"

---

**Last Updated**: 2026-05-22  
**Project**: InstaAutomate v1.0  
**Status**: Development with ngrok tunneling
