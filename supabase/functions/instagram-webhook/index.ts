/**
 * Instagram AI Agent — Core webhook pipeline
 * Instagram DM → Meta Webhook → Store → AI Orchestrator → Moderation → Graph API Reply
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendInstagramMessage } from "../_shared/instagram-api.ts";
import {
  completeWebhookEvent,
  getAccountByIgId,
  markWebhookEvent,
  storeMessage,
  upsertConversation,
} from "../_shared/conversation-store.ts";
import {
  fetchConversationHistory,
  generateAIReply,
  loadAIConfig,
} from "../_shared/ai-orchestrator.ts";
import { moderateReply } from "../_shared/moderation.ts";

const WEBHOOK_VERIFY_TOKEN = Deno.env.get("WEBHOOK_VERIFY_TOKEN") || "instaautomate_verify";
const WEBHOOK_APP_SECRET = Deno.env.get("INSTAGRAM_APP_SECRET") || Deno.env.get("META_APP_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function verifyXHubSignature256(req: Request, rawBody: Uint8Array, appSecret: string): Promise<boolean> {
  if (!appSecret) return true;
  const sigHeader = req.headers.get("X-Hub-Signature-256") || "";
  if (!sigHeader.startsWith("sha256=")) return false;
  const expected = sigHeader.slice("sha256=".length);
  const actual = await hmacSha256Hex(appSecret, rawBody);
  return actual.toLowerCase() === expected.toLowerCase();
}

async function hmacSha256Hex(secret: string, data: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function matchFlow(text: string, flow: any): boolean {
  const lower = text.toLowerCase();
  const keywords = flow.trigger_keywords?.length
    ? flow.trigger_keywords
    : flow.trigger_config?.keywords || [flow.trigger_keyword || flow.name].filter(Boolean);
  const condition = flow.trigger_condition || flow.trigger_config?.condition || "contains";
  const caseSensitive = flow.match_case_sensitive ?? flow.trigger_config?.case_sensitive ?? false;

  return keywords.some((kw: string) => {
    if (!kw) return false;
    const hay = caseSensitive ? text : lower;
    const needle = caseSensitive ? kw : String(kw).toLowerCase();
    if (condition === "exact") return hay === needle;
    if (condition === "starts_with") return hay.startsWith(needle);
    return hay.includes(needle);
  });
}

async function resolveFlowReply(
  supabase: any,
  ownerUserId: string,
  text: string,
  conversationId: string,
  memorySummary?: string,
): Promise<{ reply: string; isAi: boolean; flowName?: string } | null> {
  const { data: flows } = await supabase
    .from("flows")
    .select("*")
    .eq("is_active", true)
    .eq("user_id", ownerUserId);

  for (const flow of flows || []) {
    if (!matchFlow(text, flow)) continue;

    let reply = flow.response_message || "";
    let isAi = false;

    if (flow.ai_enabled || flow.response_type === "ai") {
      const cfg = await loadAIConfig(supabase, ownerUserId);
      if (cfg) {
        const history = await fetchConversationHistory(supabase, conversationId);
        reply = await generateAIReply(cfg, text, history, memorySummary);
        isAi = true;
      }
    }

    const mod = moderateReply(reply);
    if (!mod.ok || !mod.text) continue;
    return { reply: mod.text, isAi, flowName: flow.name };
  }
  return null;
}

async function resolveDefaultAIReply(
  supabase: any,
  ownerUserId: string,
  text: string,
  conversationId: string,
  memorySummary?: string,
): Promise<string | null> {
  const cfg = await loadAIConfig(supabase, ownerUserId);
  if (!cfg) return null;
  const history = await fetchConversationHistory(supabase, conversationId);
  const reply = await generateAIReply(cfg, text, history, memorySummary);
  const mod = moderateReply(reply);
  return mod.ok ? mod.text : null;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = new Uint8Array(await req.arrayBuffer());
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (!(await verifyXHubSignature256(req, raw, WEBHOOK_APP_SECRET))) {
      return new Response("Invalid signature", { status: 403 });
    }

    const payload = JSON.parse(new TextDecoder().decode(raw));

    if (payload.object && payload.object !== "instagram") {
      return new Response("OK", { status: 200 });
    }

    for (const entry of payload.entry || []) {
      const igAccountId = entry.id;

      for (const messaging of entry.messaging || []) {
        if (messaging.message?.is_echo) continue;
        if (!messaging.message?.text) continue;

        const eventId = messaging.message?.mid || `dm-${messaging.sender?.id}-${messaging.timestamp}`;
        if (!(await markWebhookEvent(supabase, eventId, "dm", igAccountId, messaging))) continue;

        try {
          await processDM(supabase, igAccountId, messaging);
          await completeWebhookEvent(supabase, eventId);
        } catch (e) {
          await completeWebhookEvent(supabase, eventId, String(e));
        }
      }

      for (const change of entry.changes || []) {
        if (change.field !== "comments") continue;
        const comment = change.value;
        const eventId = comment?.id || `comment-${Date.now()}`;
        if (!(await markWebhookEvent(supabase, eventId, "comment", igAccountId, comment))) continue;
        try {
          await processComment(supabase, igAccountId, comment);
          await completeWebhookEvent(supabase, eventId);
        } catch (e) {
          await completeWebhookEvent(supabase, eventId, String(e));
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("OK", { status: 200 });
  }
});

async function processDM(supabase: any, igAccountId: string, messaging: any) {
  const text = messaging.message.text;
  const senderId = messaging.sender?.id;
  const messageMid = messaging.message.mid;

  const ctx = await getAccountByIgId(supabase, igAccountId);
  if (!ctx?.token) return;

  const ownerUserId = ctx.userId || (await getOwnerFallback(supabase, igAccountId));
  const conv = await upsertConversation(supabase, ctx, senderId, undefined, text);
  const conversationId = conv?.id;

  const stored = await storeMessage(supabase, {
    conversationId,
    instagramMessageId: messageMid,
    direction: "incoming",
    content: text,
    userId: ownerUserId,
  });
  if (!stored) return;

  // Human mode (reference: mode === 'human') — store only, no auto-reply
  if (!conv || conv.human_handoff || conv.bot_enabled === false) return;

  const { data: mem } = conversationId
    ? await supabase.from("conversation_memory").select("summary").eq("conversation_id", conversationId).maybeSingle()
    : { data: null };

  let result = ownerUserId ? await resolveFlowReply(supabase, ownerUserId, text, conversationId!, mem?.summary) : null;

  // Agent mode — default AI when no keyword flow matches (reference always replies in agent mode)
  if (!result && ownerUserId) {
    const reply = await resolveDefaultAIReply(supabase, ownerUserId, text, conversationId!, mem?.summary);
    if (reply) result = { reply, isAi: true };
  }

  if (!result?.reply) return;

  const sent = await sendInstagramMessage(ctx.igId, ctx.token, senderId, result.reply);
  if (!sent.ok) return;

  const outId = crypto.randomUUID();
  await storeMessage(supabase, {
    conversationId,
    instagramMessageId: outId,
    direction: "outgoing",
    content: result.reply,
    isAutoReply: !result.isAi,
    isAiReply: result.isAi,
    userId: ownerUserId,
  });

  if (conversationId) {
    await supabase.from("conversations").update({
      last_message: result.reply,
      last_message_at: new Date().toISOString(),
      last_message_direction: "outgoing",
    }).eq("id", conversationId);
  }

  await logEvent(supabase, result.isAi ? "ai_reply" : "dm_auto_reply", {
    flow: result.flowName,
    conversation_id: conversationId,
  });
}

async function processComment(supabase: any, igAccountId: string, comment: any) {
  const text = comment.text || "";
  const commentId = comment.id;
  if (!text || !commentId) return;

  const ctx = await getAccountByIgId(supabase, igAccountId);
  if (!ctx?.token) return;

  const ownerUserId = ctx.userId || (await getOwnerFallback(supabase, igAccountId));

  await storeMessage(supabase, {
    instagramMessageId: commentId,
    direction: "incoming",
    content: text,
    userId: ownerUserId,
  });

  await logEvent(supabase, "comment_received", { text });

  const { data: flows } = await supabase
    .from("flows")
    .select("*")
    .eq("is_active", true)
    .eq("user_id", ownerUserId);

  for (const flow of flows || []) {
    if (!matchFlow(text, flow)) continue;
    let reply = flow.response_message || "";
    if (flow.ai_enabled || flow.response_type === "ai") {
      const cfg = await loadAIConfig(supabase, ownerUserId);
      if (cfg) reply = await generateAIReply(cfg, text, [], undefined);
    }
    const mod = moderateReply(reply);
    if (!mod.ok || !mod.text || !comment.from?.id) continue;
    await sendInstagramMessage(ctx.igId, ctx.token, comment.from.id, mod.text, commentId);
    await logEvent(supabase, "comment_replied", { flow: flow.name });
    break;
  }
}

async function getOwnerFallback(supabase: any, igId: string): Promise<string> {
  const { data: acct } = await supabase
    .from("instagram_accounts")
    .select("user_id")
    .eq("instagram_user_id", igId)
    .maybeSingle();
  return acct?.user_id || "";
}

async function logEvent(supabase: any, eventType: string, metadata: Record<string, unknown>) {
  await supabase.from("analytics_events").insert({
    event_type: eventType,
    metadata,
    created_at: new Date().toISOString(),
  }).catch(() => {});
}
