/**
 * Meta Facebook OAuth + Page/IG discovery + auto webhook subscribe
 * ManyChat-style one-click connect backend
 */

const GRAPH = "https://graph.facebook.com/v23.0";

export const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_manage_messages",
  "instagram_business_manage_comments",
].join(",");

export const WEBHOOK_SUBSCRIBED_FIELDS = [
  "messages",
  "messaging_postbacks",
  "message_echoes",
  "message_reads",
].join(",");

export function buildFacebookOAuthUrl(
  appId: string,
  redirectUri: string,
  state: string,
): string {
  const oauth = new URL(`${GRAPH}/dialog/oauth`);

  oauth.searchParams.set("client_id", appId);
  oauth.searchParams.set("redirect_uri", redirectUri);
  oauth.searchParams.set("scope", META_OAUTH_SCOPES);
  oauth.searchParams.set("response_type", "code");
  oauth.searchParams.set("state", state);

  return oauth.toString();
}

export async function exchangeCodeForToken(
  appId: string,
  appSecret: string,
  redirectUri: string,
  code: string,
): Promise<{ access_token: string; token_type?: string }> {
  const url = new URL(`${GRAPH}/oauth/access_token`);

  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message || "token_exchange_failed");
  }

  if (!data.access_token) {
    throw new Error("No access token returned");
  }

  return data;
}

export async function exchangeLongLivedUserToken(
  appId: string,
  appSecret: string,
  shortToken: string,
): Promise<{ access_token: string; expires_in?: number }> {
  const url = new URL(`${GRAPH}/oauth/access_token`);

  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortToken);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message || "long_lived_exchange_failed");
  }

  return data;
}

export type PageWithIg = {
  page_id: string;
  page_name: string;
  page_access_token: string;
  instagram_business_account_id: string;
};

export async function discoverInstagramBusinessAccount(
  userAccessToken: string,
): Promise<PageWithIg> {
  const accountsRes = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(
      userAccessToken,
    )}`,
  );

  const accountsData = await accountsRes.json();

  if (accountsData.error) {
    throw new Error(accountsData.error.message);
  }

  const pages = accountsData.data || [];

  if (!pages.length) {
    throw new Error(
      "No Facebook Pages found. Link your Instagram Professional account to a Facebook Page first.",
    );
  }

  for (const page of pages) {
    const igId = page.instagram_business_account?.id;

    if (igId && page.access_token) {
      return {
        page_id: page.id,
        page_name: page.name,
        page_access_token: page.access_token,
        instagram_business_account_id: igId,
      };
    }
  }

  // fallback fetch
  const first = pages[0];

  const pageRes = await fetch(
    `${GRAPH}/${first.id}?fields=instagram_business_account&access_token=${encodeURIComponent(
      first.access_token || userAccessToken,
    )}`,
  );

  const pageData = await pageRes.json();

  const igId = pageData.instagram_business_account?.id;

  if (!igId) {
    throw new Error(
      "No Instagram Business account linked to your Facebook Page.",
    );
  }

  return {
    page_id: first.id,
    page_name: first.name,
    page_access_token: first.access_token || userAccessToken,
    instagram_business_account_id: igId,
  };
}

export async function subscribePageWebhooks(
  pageId: string,
  pageAccessToken: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(
    `${GRAPH}/${pageId}/subscribed_apps`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscribed_fields: WEBHOOK_SUBSCRIBED_FIELDS.split(","),
        access_token: pageAccessToken,
      }),
    },
  );

  const data = await res.json();

  if (data.error) {
    return {
      success: false,
      error: data.error.message,
    };
  }

  return {
    success: data.success === true || !data.error,
  };
}

export async function fetchIgProfile(
  igBusinessId: string,
  accessToken: string,
): Promise<{
  username?: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
}> {
  const res = await fetch(
    `${GRAPH}/${igBusinessId}?fields=username,name,profile_picture_url,followers_count&access_token=${encodeURIComponent(
      accessToken,
    )}`,
  );

  const data = await res.json();

  if (data.error) {
    console.error("IG Profile Error:", data.error);
    return {};
  }

  return data;
}

export type ConnectResult = {
  instagram_user_id: string;
  username: string;
  name?: string;
  profile_picture_url: string;
  followers_count: number;
  access_token: string;
  page_id: string;
  page_name: string;
  page_access_token: string;
  token_expires_at: string;
  webhook_subscribed: boolean;
  connection_method: "meta_oauth";
};

export async function completeMetaOAuthConnect(
  appId: string,
  appSecret: string,
  redirectUri: string,
  code: string,
): Promise<ConnectResult> {
  // Step 1 - Exchange code
  const short = await exchangeCodeForToken(
    appId,
    appSecret,
    redirectUri,
    code,
  );

  // Step 2 - Long-lived token
  const long = await exchangeLongLivedUserToken(
    appId,
    appSecret,
    short.access_token,
  );

  const userToken = long.access_token;

  const expiresIn = long.expires_in || 5184000;

  const tokenExpiresAt = new Date(
    Date.now() + expiresIn * 1000,
  ).toISOString();

  // Step 3 - Discover Page + IG
  const page = await discoverInstagramBusinessAccount(userToken);

  // Step 4 - Subscribe webhooks
  const webhook = await subscribePageWebhooks(
    page.page_id,
    page.page_access_token,
  );

  // Step 5 - Fetch IG profile
  const profile = await fetchIgProfile(
    page.instagram_business_account_id,
    page.page_access_token,
  );

  return {
    instagram_user_id: page.instagram_business_account_id,
    username: profile.username || page.page_name,
    name: profile.name,
    profile_picture_url: profile.profile_picture_url || "",
    followers_count: profile.followers_count || 0,
    access_token: page.page_access_token,
    page_id: page.page_id,
    page_name: page.page_name,
    page_access_token: page.page_access_token,
    token_expires_at: tokenExpiresAt,
    webhook_subscribed: webhook.success,
    connection_method: "meta_oauth",
  };
}