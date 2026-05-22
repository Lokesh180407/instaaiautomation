// supabase/functions/flow-executor/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CONFIG_ID = '00000000-0000-0000-0000-000000000001';

function normalizeText(s: unknown): string {
  return (s ?? '').toString();
}

async function getActiveConfig() {
  const { data: cfg } = await supabase
    .from('instagram_config')
    .select('*')
    .eq('id', CONFIG_ID)
    .eq('connected', true)
    .maybeSingle();

  if (cfg?.long_lived_token) {
    return {
      token: cfg.page_access_token || cfg.long_lived_token,
      igId: cfg.instagram_account_id,
      source: 'config' as const,
    };
  }

  const { data: acct } = await supabase
    .from('instagram_accounts')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (acct?.access_token) {
    return {
      token: acct.access_token,
      igId: acct.instagram_user_id,
      source: 'accounts' as const,
    };
  }

  return null;
}

async function getOwnerUserId(igId: string): Promise<string> {
  const { data: acct } = await supabase
    .from('instagram_accounts')
    .select('user_id')
    .eq('instagram_user_id', igId)
    .maybeSingle();

  return acct?.user_id || '';
}

function keywordMatch(text: string, keywords: string[], condition: string, caseSensitive: boolean) {
  const hay = caseSensitive ? text : text.toLowerCase();
  const normKw = (kw: string) => (caseSensitive ? kw : kw.toLowerCase());

  if (!keywords?.length) return false;

  for (const kw of keywords) {
    if (!kw) continue;
    const needle = normKw(String(kw));

    if (condition === 'exact') {
      if (hay === needle) return true;
    } else if (condition === 'starts_with') {
      if (hay.startsWith(needle)) return true;
    } else {
      // contains default
      if (hay.includes(needle)) return true;
    }
  }

  return false;
}

async function callAI(ownerUserId: string, userMessage: string, overrideSystemPrompt?: string): Promise<string> {
  const { data: ai } = await supabase
    .from('ai_settings')
    .select('*')
    .eq('user_id', ownerUserId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ai?.enabled) return '';

  const key = ai.openai_key || ai.gemini_key || ai.claude_key || ai.api_key;
  if (!key) return '';

  const system_prompt = overrideSystemPrompt ?? ai.system_prompt ?? '';

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-reply`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: ai.provider,
        api_key: key,
        user_message: userMessage,
        system_prompt,
      }),
    });

    const data = await res.json();
    return data?.reply || '';
  } catch {
    return '';
  }
}

async function sendIGMessage(igId: string, token: string, recipientId: string, text: string) {
  await fetch(`https://graph.facebook.com/v23.0/${igId}/messages?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });
}

/** Flow executor: reads event_queue rows, matches flows, sends replies, and marks processed. */
async function processQueue() {
  const active = await getActiveConfig();
  if (!active) {
    return new Response(JSON.stringify({ status: 'no_active_config' }), { status: 200 });
  }

  const ownerUserId = await getOwnerUserId(active.igId);
  if (!ownerUserId) {
    return new Response(JSON.stringify({ status: 'owner_not_found' }), { status: 200 });
  }

  const { data: events, error } = await supabase
    .from('event_queue')
    .select('id,payload,processed')
    .eq('processed', false)
    .limit(10);


  if (error) {
    console.error('Failed to fetch queue:', error);
    return new Response(JSON.stringify({ status: 'error', error }), { status: 500 });
  }

  if (!events?.length) return new Response(JSON.stringify({ status: 'empty' }), { status: 200 });

  // Load flows once per batch
  const { data: flows } = await supabase.from('flows').select('*').eq('is_active', true);

  let processedCount = 0;

  for (const ev of events) {
    try {
      const alreadyMarked = !!ev.processed;
      if (alreadyMarked) continue;

      const payload = ev.payload || {};

      // DM event format (from instagram-webhook/flow-webhook style)
      const dmText = payload?.message?.text ?? payload?.text ?? '';
      const senderId = payload?.sender?.id ?? ev.contact_id ?? '';

      // Only DM execution in this executor pass (comments/reels can be added next)
      if (!senderId || !dmText) {
        await supabase.from('event_queue').update({ processed: true }).eq('id', ev.id);
        processedCount++;
        continue;
      }

      const lower = dmText.toString();

      for (const flow of flows || []) {
        const triggerKeywords = flow.trigger_keywords?.length ? flow.trigger_keywords : [];
        const condition = flow.trigger_condition || 'contains';
        const caseSensitive = !!flow.match_case_sensitive;

        if (!keywordMatch(lower, triggerKeywords, condition, caseSensitive)) {
          continue;
        }

        let reply = flow.response_message || '';
        if (flow.ai_enabled || flow.response_type === 'ai') {
          reply = await callAI(ownerUserId, dmText.toString(), flow.ai_system_prompt);
        }

        if (!reply) break;

        // Idempotency: avoid duplicates by event_queue row id (optional; minimal for now)
        await sendIGMessage(active.igId, active.token, senderId, reply);

        await supabase.from('messages').insert({
          message_id: crypto.randomUUID(),
          user_id: ownerUserId,
          sender_id: senderId,
          conversation_id: null,
          direction: 'outgoing',
          content: reply,
          is_auto_reply: true,
          is_ai_reply: !!flow.ai_enabled,
          sent_at: new Date().toISOString(),
          message_text: reply,
        }).catch(() => {});

        await supabase.from('analytics_events').insert({
          instagram_account_id: active.igId,
          event_type: flow.ai_enabled ? 'dm_ai_reply' : 'dm_auto_reply',
          flow_id: flow.id,
          conversation_id: null,
          metadata: { flow: flow.name },
        }).catch(() => {});

        break;
      }

      await supabase.from('event_queue').update({ processed: true }).eq('id', ev.id);
      processedCount++;
    } catch (e) {
      console.error('Error processing event', ev.id, e);
      // leave processed=false to allow retry
    }
  }

  return new Response(JSON.stringify({ status: 'processed', count: processedCount }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  return await processQueue();
}

