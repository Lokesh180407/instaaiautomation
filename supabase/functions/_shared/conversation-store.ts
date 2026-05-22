import { fetchInstagramProfile } from './instagram-api.ts';

export type AccountContext = {
  token: string;
  igId: string;
  userId: string;
  accountRowId?: string;
};

export async function getAccountByIgId(supabase: any, igId: string): Promise<AccountContext | null> {
  const { data: acct } = await supabase
    .from('instagram_accounts')
    .select('id, user_id, instagram_user_id, access_token, page_access_token, page_id, is_active')
    .or(`instagram_user_id.eq.${igId},page_id.eq.${igId},id.eq.${igId}`)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (acct?.access_token) {
    return {
      token: acct.page_access_token || acct.access_token,
      igId: acct.instagram_user_id || igId,
      userId: acct.user_id,
      accountRowId: acct.id,
    };
  }

  const CONFIG_ID = '00000000-0000-0000-0000-000000000001';
  const { data: cfg } = await supabase
    .from('instagram_config')
    .select('*')
    .eq('id', CONFIG_ID)
    .eq('connected', true)
    .maybeSingle();

  if (cfg?.long_lived_token) {
    return {
      token: cfg.page_access_token || cfg.long_lived_token,
      igId: cfg.instagram_account_id || igId,
      userId: '',
      accountRowId: CONFIG_ID,
    };
  }
  return null;
}

export async function upsertConversation(
  supabase: any,
  ctx: AccountContext,
  participantId: string,
  participantUsername?: string,
  lastMessage?: string,
): Promise<{ id: string; ai_enabled: boolean; bot_enabled: boolean; human_handoff: boolean } | null> {
  const accountKey = ctx.accountRowId || ctx.igId;
  const profile = await fetchInstagramProfile(participantId, ctx.token);

  const { data: existing } = await supabase
    .from('conversations')
    .select('id, ai_enabled, bot_enabled, human_handoff')
    .eq('instagram_account_id', accountKey)
    .eq('participant_instagram_id', participantId)
    .maybeSingle();

  const profileFields = {
    participant_name: profile.name,
    participant_username: profile.username || participantUsername,
    participant_avatar: profile.profile_pic,
    is_follower: profile.is_user_follow_business ?? false,
    last_message: lastMessage,
    last_message_at: new Date().toISOString(),
    last_message_direction: 'incoming',
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    await supabase.from('conversations').update(profileFields).eq('id', existing.id);
    return existing;
  }

  const insert: Record<string, unknown> = {
    user_id: ctx.userId || null,
    instagram_account_id: accountKey,
    participant_instagram_id: participantId,
    conversation_id: participantId,
    ...profileFields,
    bot_enabled: true,
    ai_enabled: true,
    human_handoff: false,
    status: 'open',
  };

  const { data: created, error } = await supabase
    .from('conversations')
    .insert(insert)
    .select('id, ai_enabled, bot_enabled, human_handoff')
    .single();

  if (error) {
    console.error('upsertConversation', error);
    return null;
  }
  return created;
}

export async function storeMessage(
  supabase: any,
  opts: {
    conversationId?: string;
    instagramMessageId: string;
    direction: 'incoming' | 'outgoing';
    content: string;
    isAutoReply?: boolean;
    isAiReply?: boolean;
    userId?: string;
  },
): Promise<boolean> {
  const { data: dup } = await supabase
    .from('messages')
    .select('id')
    .eq('instagram_message_id', opts.instagramMessageId)
    .maybeSingle();

  if (dup) return false;

  const row: Record<string, unknown> = {
    conversation_id: opts.conversationId,
    instagram_message_id: opts.instagramMessageId,
    message_id: opts.instagramMessageId,
    direction: opts.direction,
    content: opts.content,
    message_text: opts.content,
    is_auto_reply: opts.isAutoReply ?? false,
    is_ai_reply: opts.isAiReply ?? false,
    sent_at: new Date().toISOString(),
    user_id: opts.userId,
  };

  const { error } = await supabase.from('messages').insert(row);
  return !error;
}

export async function markWebhookEvent(
  supabase: any,
  eventId: string,
  eventType: string,
  igAccountId: string,
  payload: unknown,
): Promise<boolean> {
  const { error } = await supabase.from('webhook_events').insert({
    event_id: eventId,
    event_type: eventType,
    instagram_account_id: igAccountId,
    payload,
    processed: false,
  });
  if (error?.code === '23505') return false;
  return true;
}

export async function completeWebhookEvent(supabase: any, eventId: string, err?: string) {
  await supabase.from('webhook_events').update({
    processed: true,
    processed_at: new Date().toISOString(),
    error: err || null,
  }).eq('event_id', eventId);
}
