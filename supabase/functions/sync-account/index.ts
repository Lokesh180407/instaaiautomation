import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CONFIG_ID = '00000000-0000-0000-0000-000000000001';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: cfg } = await supabase.from('instagram_config').select('*').eq('id', CONFIG_ID).single();
    if (!cfg) return new Response(JSON.stringify({ error: 'Not connected' }), { status: 404 });

    const token = cfg.long_lived_token;
    const igId = cfg.instagram_account_id;
    const res = await fetch(
      `https://graph.facebook.com/v23.0/${igId}?fields=id,username,profile_picture_url,followers_count&access_token=${token}`
    );
    const userData = await res.json();
    if (userData.error) throw new Error(userData.error.message);

    await supabase.from('instagram_config').update({
      username: userData.username,
      profile_picture_url: userData.profile_picture_url
    }).eq('id', CONFIG_ID);

    return new Response(JSON.stringify({ success: true, data: userData }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});
