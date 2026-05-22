import { moderateReply } from './moderation.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPENROUTER_KEY = Deno.env.get('OPENROUTER_API_KEY') || '';

const DEFAULT_PROMPT = `You are a friendly and professional AI assistant managing Instagram DMs.

- Be warm and conversational — match the person's tone.
- Be concise — short replies, no walls of text.
- Be helpful — answer clearly; if unsure, say you'll check and follow up.
- Ask one question at a time.
- Do not make promises you cannot keep or share sensitive business info.`;

const OPENROUTER_FALLBACK_MODELS = [
  Deno.env.get('AI_MODEL'),
  'google/gemma-3-12b-it:free',
  'google/gemma-3-4b-it:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'openai/gpt-4o-mini',
].filter(Boolean) as string[];

export type AIConfig = {
  provider: string;
  api_key: string;
  system_prompt?: string;
  model?: string;
  temperature?: number;
};

export async function loadAIConfig(supabase: any, ownerUserId: string): Promise<AIConfig | null> {
  const { data: ai } = await supabase
    .from('ai_settings')
    .select('*')
    .eq('user_id', ownerUserId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ai?.enabled) {
    const key = ai.openai_key || ai.gemini_key || ai.claude_key || ai.api_key;
    if (key) {
      return {
        provider: ai.provider || 'openai',
        api_key: key,
        system_prompt: ai.system_prompt || DEFAULT_PROMPT,
        model: ai.model,
        temperature: ai.temperature ?? 0.7,
      };
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('ai_enabled, ai_provider, ai_api_key, ai_model, ai_system_prompt')
    .eq('id', ownerUserId)
    .maybeSingle();

  if (profile?.ai_enabled && profile?.ai_api_key) {
    return {
      provider: profile.ai_provider || 'openai',
      api_key: profile.ai_api_key,
      system_prompt: profile.ai_system_prompt || DEFAULT_PROMPT,
      model: profile.ai_model || 'gpt-4o-mini',
    };
  }

  return null;
}

export async function fetchConversationHistory(
  supabase: any,
  conversationId: string,
  limit = 20,
): Promise<Array<{ direction: string; content: string }>> {
  const { data } = await supabase
    .from('messages')
    .select('direction, content, message_text, sent_at, created_at')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: false })
    .limit(limit);

  return (data || [])
    .reverse()
    .map((m: any) => ({
      direction: m.direction === 'incoming' || m.direction === 'in' ? 'incoming' : 'outgoing',
      content: m.content || m.message_text || '',
    }))
    .filter((m: { content: string }) => m.content);
}

export async function generateAIReply(
  config: AIConfig,
  userMessage: string,
  history: Array<{ direction: string; content: string }>,
  memorySummary?: string,
): Promise<string> {
  const system = [
    config.system_prompt || DEFAULT_PROMPT,
    memorySummary ? `\nCustomer context: ${memorySummary}` : '',
  ].join('');

  if (OPENROUTER_KEY) {
    const reply = await callOpenRouter(config, system, userMessage, history);
    const mod = moderateReply(reply);
    return mod.ok ? mod.text : '';
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-reply`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider: config.provider,
      api_key: config.api_key,
      user_message: userMessage,
      system_prompt: system,
      messages: history,
    }),
  });
  const data = await res.json();
  const mod = moderateReply(data.reply || '');
  return mod.ok ? mod.text : '';
}

async function callOpenRouter(
  config: AIConfig,
  system: string,
  userMessage: string,
  history: Array<{ direction: string; content: string }>,
): Promise<string> {
  const messages = [
    { role: 'system', content: system },
    ...history.map((m) => ({
      role: m.direction === 'incoming' ? 'user' : 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const models = config.model
    ? [config.model, ...OPENROUTER_FALLBACK_MODELS.filter((m) => m !== config.model)]
    : OPENROUTER_FALLBACK_MODELS;

  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': SUPABASE_URL,
          'X-Title': 'InstaFlow Pro',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 400,
          temperature: config.temperature ?? 0.7,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const status = res.status;
        if (status === 429 || status === 404) continue;
        throw new Error(data?.error?.message || 'openrouter_error');
      }
      const text = data.choices?.[0]?.message?.content;
      if (text) return text;
    } catch (e) {
      console.warn(`OpenRouter model ${model} failed`, e);
    }
  }
  return "Sorry, I'm temporarily unavailable. Please try again shortly.";
}
