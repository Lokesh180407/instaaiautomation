const GRAPH_FB = 'https://graph.facebook.com/v23.0';
const GRAPH_IG = 'https://graph.instagram.com/v24.0';

export type InstagramProfile = {
  name: string | null;
  username: string | null;
  profile_pic: string | null;
  follower_count: number | null;
  is_user_follow_business: boolean | null;
  is_business_follow_user: boolean | null;
};

/** Fetch DM sender profile (Insta-agent reference pattern) */
export async function fetchInstagramProfile(
  igsid: string,
  accessToken: string,
): Promise<InstagramProfile> {
  const url = new URL(`${GRAPH_IG}/${igsid}`);
  url.searchParams.set(
    'fields',
    'name,username,profile_pic,follower_count,is_user_follow_business,is_business_follow_user',
  );
  url.searchParams.set('access_token', accessToken);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return {
      name: data.name ?? null,
      username: data.username ?? null,
      profile_pic: data.profile_pic ?? null,
      follower_count: data.follower_count ?? null,
      is_user_follow_business: data.is_user_follow_business ?? null,
      is_business_follow_user: data.is_business_follow_user ?? null,
    };
  } catch {
    return {
      name: null,
      username: null,
      profile_pic: null,
      follower_count: null,
      is_user_follow_business: null,
      is_business_follow_user: null,
    };
  }
}

export async function sendInstagramMessage(
  igUserId: string,
  accessToken: string,
  recipientId: string,
  text: string,
  commentId?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (commentId) {
    return sendViaFacebookGraph(igUserId, accessToken, recipientId, text, commentId);
  }

  // Prefer Instagram Graph /me/messages (reference Insta-agent)
  const igResult = await sendViaInstagramMe(accessToken, recipientId, text);
  if (igResult.ok) return igResult;

  return sendViaFacebookGraph(igUserId, accessToken, recipientId, text);
}

async function sendViaInstagramMe(
  accessToken: string,
  recipientId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const url = new URL(`${GRAPH_IG}/me/messages`);
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data?.error?.message || 'ig_send_failed' };
  return { ok: true };
}

async function sendViaFacebookGraph(
  igUserId: string,
  accessToken: string,
  recipientId: string,
  text: string,
  commentId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const recipient = commentId ? { comment_id: commentId } : { id: recipientId };
  const res = await fetch(
    `${GRAPH_FB}/${igUserId}/messages?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, message: { text } }),
    },
  );
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data?.error?.message || 'fb_send_failed' };
  return { ok: true };
}
