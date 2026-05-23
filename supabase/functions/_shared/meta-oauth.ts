/**
 * Meta Facebook OAuth + Instagram discovery + webhook subscription
 * InstaFlow Pro / ManyChat-style Instagram Connect
 */

const GRAPH = "https://graph.facebook.com/v23.0";
const FACEBOOK_OAUTH = "https://www.facebook.com/v23.0/dialog/oauth";

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
  const oauth = new URL(FACEBOOK_OAUTH);

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

  if (!res.ok || data.error) {
    console.error("exchangeCodeForToken:", data);

    throw new Error(
      data?.error?.message || "token_exchange_failed",
    );
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

  if (!res.ok || data.error) {
    console.error("exchangeLongLivedUserToken:", data);

    throw new Error(
      data?.error?.message || "long_lived_exchange_failed",
    );
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
  const url =
    `${GRAPH}/me/accounts` +
    `?fields=id,name,access_token,instagram_business_account` +
    `&access_token=${encodeURIComponent(userAccessToken)}`;

  const accountsRes = await fetch(url);

  const accountsData = await accountsRes.json();

  if (!accountsRes.ok || accountsData.error) {
    console.error("discoverInstagramBusinessAccount:", accountsData);

    throw new Error(
      accountsData?.error?.message ||
        "failed_to_fetch_pages",
    );
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

  // fallback for pages missing inline IG object
  const first = pages[0];

  const fallbackUrl =
    `${GRAPH}/${first.id}` +
    `?fields=instagram_business_account` +
    `&access_token=${encodeURIComponent(
      first.access_token || userAccessToken,
    )}`;

  const pageRes = await fetch(fallbackUrl);

  const pageData = await pageRes.json();

  if (!pageRes.ok || pageData.error) {
    console.error("fallback page lookup:", pageData);

    throw new Error(
      pageData?.error?.message ||
        "failed_to_fetch_instagram_account",
    );
  }

  const igId = pageData.instagram_business_account?.id;

  if (!igId) {
    throw new Error(
      "No Instagram Business account linked to your Facebook Page.",
    );
  }

  return {
    page_id: first.id,
    page_name: first.name,
    page_access_token:
      first.access_token || userAccessToken,
    instagram_business_account_id: igId,
  };
}

export async function subscribePageWebhooks(
  pageId: string,
  pageAccessToken: string,
): Promise<{ success: boolean; error?: string }> {
  const url =
    `${GRAPH}/${pageId}/subscribed_apps` +
    `?access_token=${encodeURIComponent(pageAccessToken)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscribed_fields:
        WEBHOOK_SUBSCRIBED_FIELDS.split(","),
    }),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    console.error("subscribePageWebhooks:", data);

    return {
      success: false,
      error:
        data?.error?.message ||
        "webhook_subscription_failed",
    };
  }

  return {
    success: true,
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
  const url =
    `${GRAPH}/${igBusinessId}` +
    `?fields=username,name,profile_picture_url,followers_count` +
    `&access_token=${encodeURIComponent(accessToken)}`;

  const res = await fetch(url);

  const data = await res.json();

  if (!res.ok || data.error) {
    console.error("fetchIgProfile:", data);

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
  console.log("STEP 1 START: exchangeCodeForToken");
  // Step 1 — short-lived token
  const short = await exchangeCodeForToken(
    appId,
    appSecret,
    redirectUri,
    code,
  );
  console.log("SHORT TOKEN:", { ok: !!short?.access_token, len: short?.access_token?.length });

  console.log("STEP 2 START: exchangeLongLivedUserToken");

  // Step 2 — long-lived token
  const long = await exchangeLongLivedUserToken(
    appId,
    appSecret,
    short.access_token,
  );
  console.log("LONG TOKEN:", { ok: !!long?.access_token, len: long?.access_token?.length, expires_in: long?.expires_in });

  const userToken = long.access_token;

  const expiresIn =
    typeof long.expires_in === "number"
      ? long.expires_in
      : 5184000;

  const tokenExpiresAt = new Date(
    Date.now() + expiresIn * 1000,
  ).toISOString();

  console.log("STEP 3 START: discoverInstagramBusinessAccount");
  // Step 3 — discover FB page + IG account
  const page =
    await discoverInstagramBusinessAccount(
      userToken,
    );
  console.log("PAGE RESULT:", {
    page_id: page?.page_id,
    page_name: page?.page_name,
    has_page_access_token: !!page?.page_access_token,
    instagram_business_account_id: page?.instagram_business_account_id,
  });

  console.log("STEP 4 START: subscribePageWebhooks");
  // Step 4 — subscribe webhooks
  const webhook =
    await subscribePageWebhooks(
      page.page_id,
      page.page_access_token,
    );
  console.log("WEBHOOK RESULT:", { success: webhook?.success, error: webhook?.error });

  console.log("STEP 5 START: fetchIgProfile");
  // Step 5 — fetch IG profile
  const profile = await fetchIgProfile(
    page.instagram_business_account_id,
    page.page_access_token,
  );
  console.log("PROFILE RESULT:", {
    username: profile?.username,
    has_name: !!profile?.name,
    followers_count: profile?.followers_count,
  });

  return {
    instagram_user_id:
      page.instagram_business_account_id,

    username:
      profile.username || page.page_name,

    name: profile.name,

    profile_picture_url:
      profile.profile_picture_url || "",

    followers_count:
      profile.followers_count || 0,

    access_token: page.page_access_token,

    page_id: page.page_id,

    page_name: page.page_name,

    page_access_token:
      page.page_access_token,

    token_expires_at: tokenExpiresAt,

    webhook_subscribed:
      webhook.success,

    connection_method: "meta_oauth",
  };
}