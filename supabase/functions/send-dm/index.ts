import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendInstagramMessage } from "../_shared/instagram-api.ts";
const CONFIG_ID = "00000000-0000-0000-0000-000000000001";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { recipient_id, message, comment_id, conversation_id } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let token = "";
    let igId = "";

    const { data: cfg } = await supabase.from("instagram_config").select("*").eq("id", CONFIG_ID).maybeSingle();
    if (cfg?.long_lived_token) {
      token = cfg.page_access_token || cfg.long_lived_token;
      igId = cfg.instagram_account_id;
    } else {
      const { data: acct } = await supabase
        .from("instagram_accounts")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!acct?.access_token) {
        return new Response(JSON.stringify({ error: "Instagram not connected" }), { status: 400 });
      }
      token = acct.page_access_token || acct.access_token;
      igId = acct.instagram_user_id;
    }

    const sent = await sendInstagramMessage(igId, token, recipient_id, message, comment_id);
    if (!sent.ok) {
      throw new Error(sent.error || "Failed to send message");
    }

    const mid = crypto.randomUUID();
    await supabase.from("messages").insert({
      conversation_id: conversation_id || null,
      message_id: mid,
      instagram_message_id: mid,
      direction: "outgoing",
      content: message,
      message_text: message,
      sent_at: new Date().toISOString(),
      is_ai_reply: false,
    }).catch(() => {});

    if (conversation_id) {
      await supabase.from("conversations").update({
        last_message: message,
        last_message_at: new Date().toISOString(),
        last_message_direction: "outgoing",
      }).eq("id", conversation_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
