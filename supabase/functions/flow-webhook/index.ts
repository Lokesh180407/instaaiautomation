import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// supabase/functions/flow-webhook/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const SUPABASE_WEBHOOK_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET') || Deno.env.get('META_APP_SECRET') || '';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);


/** Simple HMAC SHA256 verification for Facebook/Instagram *
 * The request should contain a `X-Hub-Signature-256` header.
 */
async function verifyXHubSignature256(req: Request, rawBody: Uint8Array, appSecret: string): Promise<boolean> {
  if (!appSecret) return true; // fallback if secret not configured yet

  const sigHeader = req.headers.get('X-Hub-Signature-256') || '';
  if (!sigHeader.startsWith('sha256=')) return false;

  const expected = sigHeader.slice('sha256='.length);
  const actual = await hmacSha256Hex(appSecret, rawBody);
  return actual.toLowerCase() === expected.toLowerCase();
}

async function hmacSha256Hex(secret: string, data: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, data as unknown as BufferSource);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}



// Main handler
export async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const raw = new Uint8Array(await req.arrayBuffer());

  // Verify Meta/Instagram webhook signature (X-Hub-Signature-256)
  if (!await verifyXHubSignature256(req, raw, SUPABASE_WEBHOOK_SECRET)) {
    return new Response("Invalid signature", { status: 403 });
  }

  const payload = JSON.parse(new TextDecoder().decode(raw));

  // Basic validation – ensure we have an entry array.
  if (!payload.entry) {
    return new Response("Bad payload", { status: 400 });
  }

  for (const entry of payload.entry) {
    // Process messaging events (DMs)
    if (entry.messaging) {
      for (const msg of entry.messaging) {
        const senderId = msg.sender?.id;
        const text = msg.message?.text ?? "";
        if (!senderId) continue;
        // Upsert contact
        const { data: contact, error: contactErr } = await supabase
          .from("contacts")
          .upsert({
            external_user_id: senderId,
            bot_id: "PLACEHOLDER_BOT_ID", // Replace with actual bot id lookup logic
            last_interaction_at: new Date().toISOString(),
          }, { onConflict: ["external_user_id"] });
        // Insert event into queue
        await supabase.from("event_queue").insert({
          contact_id: contact?.[0]?.id,
          payload: msg,
          processed: false,
        });
      }
    }
    // Process changes (e.g., comments)
    if (entry.changes) {
      for (const ch of entry.changes) {
        // Insert generic change event
        await supabase.from("event_queue").insert({
          contact_id: null,
          payload: ch,
          processed: false,
        });
      }
    }
  }

  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
