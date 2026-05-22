-- Meta OAuth one-click connect columns
ALTER TABLE public.instagram_accounts ADD COLUMN IF NOT EXISTS page_name TEXT;
ALTER TABLE public.instagram_accounts ADD COLUMN IF NOT EXISTS webhook_subscribed BOOLEAN DEFAULT false;
ALTER TABLE public.instagram_accounts ADD COLUMN IF NOT EXISTS connection_method TEXT DEFAULT 'manual';
