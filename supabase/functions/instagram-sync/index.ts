import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

/** Simple fetch with retry */
async function graphFetch(url: string, token: string, attempts = 2): Promise<any> {
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (attempts > 0) return await graphFetch(url, token, attempts - 1);
    console.error('Graph fetch failed:', e, url);
    return null;
  }
}

async function syncReels(igId: string, token: string) {
  const url = `https://graph.facebook.com/v23.0/${igId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&access_token=${token}`;
  const data = await graphFetch(url, token);
  if (!data?.data) return;
  const inserts = data.data
    .filter((m: any) => m.media_type === 'REELS' || m.media_product_type === 'REELS')
    .map((m: any) => ({
      ig_user_id: igId,
      instagram_media_id: m.id,
      caption: m.caption,
      media_url: m.media_url,
      thumbnail_url: m.thumbnail_url,
      permalink: m.permalink,
      like_count: m.like_count,
      comments_count: m.comments_count,
      timestamp: m.timestamp,
    }));
  for (const rec of inserts) {
    await supabase.from('reels_cache').upsert(rec, { onConflict: ['instagram_media_id'] });
  }
}

async function syncInsights(igId: string, token: string) {
  const metrics = [
    'follower_count',
    'impressions',
    'reach',
    'profile_views',
    'email_contacts',
    'phone_call_clicks',
  ].join(',');
  const url = `https://graph.facebook.com/v23.0/${igId}/insights?metric=${metrics}&period=day`;
  const data = await graphFetch(url, token);
  if (!data?.data) return;
  const now = new Date();
  for (const metric of data.data) {
    const value = metric.values?.[0]?.value;
    const periodStart = metric.values?.[0]?.end_time ? new Date(metric.values[0].end_time) : now;
    const periodEnd = now;
    await supabase.from('instagram_analytics').upsert(
      {
        ig_user_id: igId,
        metric: metric.name,
        value,
        period_start: periodStart,
        period_end: periodEnd,
      },
      { onConflict: ['ig_user_id', 'metric', 'period_start', 'period_end'] },
    );
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  // fetch all active instagram configs
  const { data: configs } = await supabase
    .from('instagram_config')
    .select('instagram_account_id,long_lived_token')
    .eq('connected', true);
  if (!configs?.length) return new Response('No connected accounts', { status: 200 });
  for (const cfg of configs) {
    const igId = cfg.instagram_account_id;
    const token = cfg.long_lived_token;
    if (!igId || !token) continue;
    await syncReels(igId, token);
    await syncInsights(igId, token);
  }
  return new Response('Sync completed', { status: 200 });
});
