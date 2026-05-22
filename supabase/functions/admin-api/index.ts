import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const JWT_SECRET = Deno.env.get("ADMIN_JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (hash.startsWith("$2")) {
    const bcrypt = await import("https://esm.sh/bcryptjs@2.4.3");
    return bcrypt.compareSync(plain, hash);
  }
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(plain));
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === hash;
}

async function signAdminJwt(admin: { id: string; account_id: string; role: string }) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 12;
  const payload = btoa(JSON.stringify({ sub: admin.id, account_id: admin.account_id, role: admin.role, exp, aud: "admin" }));
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${data}.${sigB64}`;
}

function parseAdminToken(req: Request): { sub: string; account_id: string; role: string } | null {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token || !JWT_SECRET) return null;
  try {
    const [, payload] = token.split(".");
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    if (decoded.aud !== "admin") return null;
    return decoded;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const path = url.pathname.includes("/admin-api")
    ? url.pathname.split("/admin-api/")[1]?.replace(/^\//, "") ?? ""
    : url.pathname.replace(/^\//, "");
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  if (req.method === "POST" && (path === "login" || path === "")) {
    const { account_id, password } = await req.json();
    if (!account_id || !password) return json({ error: "account_id and password required" }, 400);

    const { data: admin, error } = await supabase
      .from("admin_accounts")
      .select("id, account_id, username, full_name, email, role, password_hash, is_active")
      .eq("account_id", account_id)
      .maybeSingle();

    if (error || !admin || !admin.is_active) return json({ error: "Invalid credentials" }, 401);
    const ok = await verifyPassword(password, admin.password_hash);
    if (!ok) return json({ error: "Invalid credentials" }, 401);

    await supabase.from("admin_accounts").update({ last_login_at: new Date().toISOString() }).eq("id", admin.id);

    const token = await signAdminJwt({ id: admin.id, account_id: admin.account_id, role: admin.role });
    return json({
      token,
      admin: {
        id: admin.id,
        account_id: admin.account_id,
        username: admin.username,
        full_name: admin.full_name,
        email: admin.email,
        role: admin.role,
      },
    });
  }

  const session = parseAdminToken(req);
  if (!session) return json({ error: "Unauthorized" }, 401);

  if (req.method === "GET" && path === "stats") {
    const { count: totalUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    const { count: igAccounts } = await supabase.from("instagram_accounts").select("*", { count: "exact", head: true });
    const today = new Date().toISOString().slice(0, 10);
    const { count: flowsToday } = await supabase
      .from("analytics_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "flow_triggered")
      .gte("created_at", `${today}T00:00:00Z`);

    const { data: recent_signups } = await supabase
      .from("profiles")
      .select("email, plan_name, created_at")
      .order("created_at", { ascending: false })
      .limit(8);

    return json({
      total_users: totalUsers ?? 0,
      active_today: 0,
      instagram_accounts: igAccounts ?? 0,
      flows_today: flowsToday ?? 0,
      recent_signups: recent_signups ?? [],
    });
  }

  if (req.method === "GET" && path === "users") {
    const page = Number(url.searchParams.get("page") || 1);
    const limit = Math.min(Number(url.searchParams.get("limit") || 20), 100);
    const from = (page - 1) * limit;
    const { data, count } = await supabase
      .from("profiles")
      .select("id, email, full_name, plan_name, subscription_status, contacts_count, messages_today, is_active, created_at", { count: "exact" })
      .range(from, from + limit - 1)
      .order("created_at", { ascending: false });
    return json({ users: data ?? [], total: count ?? 0, page, limit });
  }

  return json({ error: "Not found" }, 404);
});
