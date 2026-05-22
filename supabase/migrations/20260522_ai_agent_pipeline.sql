-- AI Agent Pipeline — webhook dedup, queue, conversation modes, memory

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  instagram_account_id TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed
  ON public.webhook_events (created_at) WHERE processed = false;

CREATE TABLE IF NOT EXISTS public.conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  summary TEXT,
  lead_status TEXT DEFAULT 'new',
  sentiment TEXT,
  language TEXT DEFAULT 'en',
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id)
);

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS participant_instagram_id TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS human_handoff BOOLEAN DEFAULT false;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_direction TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS instagram_message_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_ai_reply BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_instagram_mid
  ON public.messages (instagram_message_id) WHERE instagram_message_id IS NOT NULL;
