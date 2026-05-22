-- Enable Supabase Realtime for live inbox (required — from Insta-agent reference)
-- Run in Supabase SQL Editor

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS: allow authenticated users to read their conversations/messages in inbox
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversations_select_own ON public.conversations;
CREATE POLICY conversations_select_own ON public.conversations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS conversations_update_own ON public.conversations;
CREATE POLICY conversations_update_own ON public.conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS messages_select_own ON public.messages;
CREATE POLICY messages_select_own ON public.messages
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );
