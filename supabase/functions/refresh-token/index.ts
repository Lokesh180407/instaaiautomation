import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const INSTAGRAM_APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { account_id } = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get account details
    const { data: account } = await supabase
      .from('instagram_accounts')
      .select('*')
      .eq('id', account_id)
      .single();

    if (!account) {
      return new Response('Account not found', { status: 404 });
    }

    // Refresh Instagram long-lived token
    const response = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${account.access_token}`
    );

    const data = await response.json();

    if (data.error || !data.access_token) {
      throw new Error(data.error?.message || 'Token is invalid or expired. Please reconnect your Instagram account.');
    }

    const expiresAt = new Date(Date.now() + (data.expires_in || 5183999) * 1000).toISOString();

    await supabase
      .from('instagram_accounts')
      .update({
        access_token: data.access_token,
        token_expires_at: expiresAt,
        last_synced_at: new Date().toISOString()
      })
      .eq('id', account_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        expires_at: expiresAt
      }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
