/**
 * Meta OAuth — one-click Instagram connect
 * GET/POST start → OAuth URL | POST code → token + pages + IG + webhook subscribe
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildFacebookOAuthUrl,
  completeMetaOAuthConnect,
} from "../_shared/meta-oauth.ts";

const APP_ID = Deno.env.get("INSTAGRAM_APP_ID") || Deno.env.get("META_APP_ID") || "";
const APP_SECRET = Deno.env.get("INSTAGRAM_APP_SECRET") || Deno.env.get("META_APP_SECRET") || "";
const REDIRECT_URI = Deno.env.get("INSTAGRAM_REDIRECT_URI") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = new URL(req.url);
    let body: Record<string, string> = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const action = body.action || url.searchParams.get("action") || "";
    const appId = body.app_id || APP_ID;
    const appSecret = body.app_secret || APP_SECRET;
    const redirectUri = body.redirect_uri || REDIRECT_URI;

    if (!appId) return json({ error: "INSTAGRAM_APP_ID not configured" }, 500);

    // --- Start OAuth (Step 1–2): return Facebook dialog URL ---
    if (action === "start" || (!body.code && req.method === "POST" && !action)) {
      const state = crypto.randomUUID();
      const oauth_url = buildFacebookOAuthUrl(appId, redirectUri, state);
      return json({ oauth_url, state, redirect_uri: redirectUri });
    }

    // --- Complete OAuth (Steps 4–10): exchange code + auto webhook ---
    if (body.code) {
      if (!appSecret) return json({ error: "INSTAGRAM_APP_SECRET required on server" }, 500);
      if (!redirectUri) return json({ error: "INSTAGRAM_REDIRECT_URI not configured" }, 500);

      const result = await completeMetaOAuthConnect(appId, appSecret, redirectUri, body.code);

      // Optional: persist if user_id passed (service role)
      const userId = body.user_id;
      if (userId && SERVICE_KEY) {
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
        const row = {
          user_id: userId,
          instagram_user_id: result.instagram_user_id,
          username: result.username,
          name: result.name,
          profile_picture_url: result.profile_picture_url,
          followers_count: result.followers_count,
          access_token: result.access_token,
          page_id: result.page_id,
          page_access_token: result.page_access_token,
          page_name: result.page_name,
          token_expires_at: result.token_expires_at,
          webhook_subscribed: result.webhook_subscribed,
          connection_method: result.connection_method,
          is_active: true,
          connected_at: new Date().toISOString(),
        };

        const { data: existing } = await supabase
          .from("instagram_accounts")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existing?.id) {
          await supabase.from("instagram_accounts").update(row).eq("id", existing.id);
        } else {
          await supabase.from("instagram_accounts").insert(row);
        }

        await supabase.from("instagram_config").upsert({
          id: "00000000-0000-0000-0000-000000000001",
          instagram_account_id: result.instagram_user_id,
          meta_app_id: appId,
          long_lived_token: result.access_token,
          page_id: result.page_id,
          page_access_token: result.page_access_token,
          username: result.username,
          connected: true,
        }, { onConflict: "id" }).catch(() => {});
      }

      return json({ success: true, ...result });
    }

    // Legacy: Instagram-only OAuth URL
    if (action === "instagram_url") {
      const state = crypto.randomUUID();
      const scopes =
        "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments";
      const oauth_url =
        `https://www.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${state}`;
      return json({ oauth_url, state });
    }

    return json({ error: "Invalid request. Use action=start or pass code." }, 400);
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
});
