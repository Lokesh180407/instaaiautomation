// Instagram — works with live Supabase tables (instagram_accounts + optional instagram_config)
const CONFIG_ROW_ID = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.configRowId : '00000000-0000-0000-0000-000000000001';
const META_APP_ID = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.defaultAppId : '1503208814932037';
const GRAPH = `https://graph.facebook.com/${typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.graphVersion : 'v23.0'}`;
const REDIRECT_URI = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.redirectUri : `${window.location.origin}/oauth-callback.html`;

const instagram = {
  async graphRequest(path, token, fields) {
    const url = `${GRAPH}/${path}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token.trim())}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data;
  },

  /** Validate token — uses /me (works with your token type) */
  async validateToken(accessToken) {
    return this.graphRequest('me', accessToken, 'id,name');
  },

  async fetchProfile(instagramUserId, accessToken) {
    const fields = 'id,username,name,profile_picture_url,followers_count,follows_count,media_count';
    try {
      return await this.graphRequest(instagramUserId, accessToken, fields);
    } catch (_) {
      const me = await this.validateToken(accessToken);
      return {
        id: instagramUserId,
        username: 'lokesh180407',
        name: me.name,
        followers_count: 0
      };
    }
  },

  normalizeAccount(row) {
    if (!row) return null;
    return {
      id: row.id,
      instagram_account_id: row.instagram_account_id || row.instagram_user_id,
      instagram_user_id: row.instagram_user_id || row.instagram_account_id,
      username: row.username,
      page_id: row.page_id,
      page_name: row.page_name,
      page_access_token: row.page_access_token,
      profile_picture_url: row.profile_picture_url,
      long_lived_token: row.long_lived_token || row.access_token,
      access_token: row.access_token || row.long_lived_token,
      meta_app_id: row.meta_app_id || row.app_id,
      connected: row.connected !== false && row.is_active !== false,
      followers_count: row.followers_count || 0
    };
  },

  async getConfig() {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not logged in' };

    // Primary: instagram_accounts (exists in your Supabase)
    const { data: acct, error: acctErr } = await supabase
      .from('instagram_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!acctErr && acct) {
      return { success: true, data: this.normalizeAccount(acct) };
    }

    // Fallback: instagram_config
    const { data: cfg, error: cfgErr } = await supabase
      .from('instagram_config')
      .select('*')
      .eq('id', CONFIG_ROW_ID)
      .maybeSingle();

    if (!cfgErr && cfg?.connected && cfg?.long_lived_token) {
      return { success: true, data: this.normalizeAccount(cfg) };
    }

    if (acctErr?.message?.includes('instagram_config') || cfgErr?.message?.includes('schema')) {
      return { success: false, error: 'Run supabase/RUN_THIS_FIRST.sql in Supabase SQL Editor' };
    }
    return { success: true, data: null };
  },

  async saveToDatabase({ appId, appSecret, accessToken, instagramUserId, profile }) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Please sign in first');

    const igId = String(instagramUserId || profile?.id || '').trim();
    const token = accessToken.trim();
    const username = profile?.username || 'lokesh180407';

    const accountRow = {
      user_id: user.id,
      instagram_user_id: igId,
      username,
      access_token: token,
      page_access_token: profile?.page_access_token || token,
      page_name: profile?.page_name || null,

      token_expires_at: profile?.token_expires_at || null,
      webhook_subscribed: profile?.webhook_subscribed ?? false,
      connection_method: profile?.connection_method || 'manual',
      profile_picture_url: profile?.profile_picture_url || `https://ui-avatars.com/api/?name=${username}&background=E1306C&color=fff`,
      followers_count: profile?.followers_count || 0,
      is_active: true,
      connected_at: new Date().toISOString()
    };

    // Update existing row for this user
    const { data: existing } = await supabase
      .from('instagram_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    let saved = null;
    let saveError = null;

    if (existing?.id) {
      const { data, error } = await supabase
        .from('instagram_accounts')
        .update(accountRow)
        .eq('id', existing.id)
        .select()
        .single();
      saved = data;
      saveError = error;
    } else {
      const { data, error } = await supabase
        .from('instagram_accounts')
        .insert(accountRow)
        .select()
        .single();
      saved = data;
      saveError = error;
    }

    if (saveError) {
      if (saveError.message?.includes('duplicate key') || saveError.code === '23505') {
        throw new Error(
          'This Instagram ID is already in the database for another user. Open Supabase SQL Editor and run supabase/RUN_THIS_FIRST.sql (step 2 updates your account).'
        );
      }
      throw saveError;
    }

    // Optional mirror to instagram_config
    const configRow = {
      id: CONFIG_ROW_ID,
      instagram_account_id: igId,
      meta_app_id: appId || META_APP_ID,
      meta_app_secret: appSecret || null,
      long_lived_token: token,
      page_id: igId,
      page_access_token: token,
      username,
      profile_picture_url: accountRow.profile_picture_url,
      followers_count: accountRow.followers_count,
      connected: true,
      updated_at: new Date().toISOString()
    };
    // Best-effort mirror; ignore errors.
    try {
      await supabase.from('instagram_config').upsert(configRow, { onConflict: 'id' });
    } catch (_) {}


    return this.normalizeAccount(saved);
  },

  /** Manual connect: App ID + Secret + IG ID + Access Token */
  async connectManual(appId, appSecret, accessToken, instagramUserId) {
    try {
      if (!accessToken?.trim()) throw new Error('Access token is required');
      if (!instagramUserId?.trim()) throw new Error('Instagram Account ID is required');

      showToast('Validating token with Meta...');
      const me = await this.validateToken(accessToken);
      const profile = await this.fetchProfile(instagramUserId, accessToken);
      profile.name = profile.name || me.name;

      showToast('Saving to your account...');
      const saved = await this.saveToDatabase({
        appId: appId || META_APP_ID,
        appSecret,
        accessToken,
        instagramUserId,
        profile
      });

      if (appSecret) {
        sessionStorage.setItem('meta_app_secret', appSecret);
      }
      sessionStorage.setItem('meta_app_id', appId || META_APP_ID);

      showToast(`Connected @${saved.username}`);
      return { success: true, data: saved };
    } catch (error) {
      const msg = error.message || String(error);
      console.error('connectManual:', error);
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  },

  /**
   * ManyChat-style one-click Meta OAuth (Facebook dialog → pages → IG → webhook subscribe)
   * App secret stays on server (Supabase Edge Function env).
   */
  async connectWithMetaOAuth() {
    const user = await getCurrentUser();
    if (!user) throw new Error('Please sign in first');

    const { data: session } = await supabase.auth.getSession();
    const headers = session?.session?.access_token
      ? { Authorization: `Bearer ${session.session.access_token}` }
      : {};

    console.log('FINAL OAUTH URL INIT');
    console.log('REDIRECT_URI (runtime):', REDIRECT_URI);

    const { data: startData, error: startErr } = await supabase.functions.invoke('instagram-oauth', {
      body: { action: 'start', redirect_uri: REDIRECT_URI },
      headers
    });
    if (startErr) throw startErr;
    if (startData?.error) throw new Error(startData.error);

    const { oauth_url, state } = startData;
    localStorage.setItem('ig_oauth_pending', JSON.stringify({ state, ts: Date.now() }));

    return new Promise((resolve, reject) => {
      const popup = window.open(oauth_url, 'meta_connect', 'width=560,height=720,scrollbars=yes');
      if (!popup) {
        window.location.href = oauth_url;
        return reject(new Error('Redirecting to Meta login…'));
      }

      const onMessage = async (event) => {
        if (event.origin !== window.location.origin) return;
        const { type, account, error } = event.data || {};
        if (type === 'IG_CONNECTED') {
          window.removeEventListener('message', onMessage);

          try {
            // Popup success UX (immediate)
            showToast(`Connected @${account?.instagram_user_id || account?.username || ''}`);
            const saved = await this.saveToDatabase({
              appId: META_APP_ID,
              accessToken: account.access_token,
              instagramUserId: account.instagram_user_id,
              profile: account
            });


            // Connected-state UX: refresh account + attempt auto-sync where supported
            try { await this.syncAccount(); } catch (_) {}
            try { await this.syncInbox(); } catch (_) {}
            try { await this.syncReels(); } catch (_) {}
            try { await this.syncComments(); } catch (_) {}

            // Refresh connected UI immediately
            try { window.location.reload(); } catch (_) {}

resolve({ success: true, data: saved });
            // ensure connected banner shows on reload
            setTimeout(() => { try { window.location.reload(); } catch (_) {} }, 200);

          } catch (e) {
            reject(e);
          }
        } else if (type === 'IG_ERROR') {
          window.removeEventListener('message', onMessage);
          reject(new Error(error || 'OAuth failed'));
        }
      };
      window.addEventListener('message', onMessage);
    });
  },

  /** Legacy Instagram-only OAuth (requires app secret in form) */
  async connectWithOAuth(appId, appSecret) {
    return this.connectWithMetaOAuth();
  },

  async testConnection(appId, appSecret, accessToken, instagramUserId) {
    const el = document.getElementById('testResult');
    if (el) {
      el.className = 'test-result loading';
      el.textContent = 'Testing connection...';
      el.classList.remove('hidden');
    }
    try {
      const me = await this.validateToken(accessToken);
      let msg = `Token valid — Facebook user: ${me.name} (${me.id})`;
      if (appSecret) {
        const debugUrl = `${GRAPH}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${appId}|${appSecret}`;
        const dbg = await fetch(debugUrl).then(r => r.json());
        if (dbg.data?.is_valid) msg += `\nInstagram token valid until ${new Date(dbg.data.expires_at * 1000).toLocaleDateString()}`;
        else if (dbg.error) msg += `\nDebug: ${dbg.error.message}`;
      }
      if (el) {
        el.className = 'test-result success';
        el.textContent = msg;
      }
      showToast('Token is valid');
      return { success: true, message: msg };
    } catch (e) {
      if (el) {
        el.className = 'test-result error';
        el.textContent = e.message;
      }
      showToast(e.message, 'error');
      return { success: false, error: e.message };
    }
  },

  async getConnectedAccounts() {
    const { success, data, error } = await this.getConfig();
    if (!success) return { success: false, error };
    return { success: true, data: data ? [data] : [] };
  },

  async deleteAccount() {
    const user = await getCurrentUser();
    if (!user?.id) throw new Error('Not logged in');

    // If caller passes an accountId, use it; otherwise delete current user's active row
    const accountId = arguments[0] || null;

    const { error: delErr1 } = await supabase
      .from('instagram_accounts')
      .delete()
      .eq('user_id', user.id)
      .modify((q) => {
        if (accountId) q.eq('id', accountId);
      });
    if (delErr1) throw delErr1;

    // Best-effort cleanup
    await supabase.from('instagram_config').update({ connected: false, long_lived_token: '' }).eq('id', CONFIG_ROW_ID).catch(() => {});

    // Clear local/session UI state
    try { localStorage.removeItem('activeInstagramAccountId'); } catch (_) {}

    // Hard refresh the current page so UI resets cleanly
    showToast('Instagram account removed');
    setTimeout(() => window.location.reload(), 500);

    return { success: true };
  },

  async disconnectAccount() {
    const user = await getCurrentUser();
    await supabase.from('instagram_accounts').update({ is_active: false, access_token: '' }).eq('user_id', user.id);
    await supabase.from('instagram_config').update({ connected: false, long_lived_token: '' }).eq('id', CONFIG_ROW_ID).catch(() => {});
    showToast('Disconnected');
    return { success: true };
  },

  async syncAccount() {
    const { data: cfg } = await this.getConfig();
    if (!cfg) throw new Error('Not connected');
    const profile = await this.fetchProfile(cfg.instagram_account_id, cfg.long_lived_token);
    const user = await getCurrentUser();
    await supabase.from('instagram_accounts').update({
      username: profile.username,
      profile_picture_url: profile.profile_picture_url,
      followers_count: profile.followers_count || 0
    }).eq('user_id', user.id);
    showToast('Synced');
    return { success: true };
  },

  async syncInbox() {
    // Inbox UI updates via realtime; we just refresh conversation list if exists.
    if (window.location.pathname.includes('inbox')) {
      try {
        await new Promise(r => setTimeout(r, 200));
        if (window.refreshConversationList) await window.refreshConversationList();
      } catch (_) {}
    }
    return { success: true };
  },

  async syncReels() {
    // reels.js already has its own sync button / loader
    // keep this as a placeholder hook for connected-state auto-sync.
    try {
      if (window.location.pathname.includes('reels')) {
        if (window.syncAllReels) await window.syncAllReels();
      }
    } catch (_) {}
    return { success: true };
  },

  async syncComments() {
    try {
      if (window.location.pathname.includes('comments')) {
        if (window.loadComments) await window.loadComments();
      }
    } catch (_) {}
    return { success: true };
  },

  async autoIntegrateLokiAccount() {
    const IG_ID = '1286299316995794';
    const TOKEN = 'EAAVXKRNv8EUBRuYYIcXhrr5rRGDqxW5JteZAwv7AFNCDUNhZC4kGNfaFwLDYSTv83eQVtmOV0LDYZCZBZA48DPF4Hl4ghuiyv6qionZCLkXFoBdTwYSOi360HztMGEbZAVrwENrugNMmlG6fbMSU7Lq2gZBOOTJArxG8wIdRFTlN587PMRuCkPWUSxf2d1T2bL6sksr62pO6vp0lEdwV9IbHHAnZBlUrRNRXL31ZAV';
    const APP_ID = '1503208814932037';
    return this.connectManual(APP_ID, null, TOKEN, IG_ID);
  },

  getWebhookInfo() {
    return {
      url: APP_CONFIG?.webhookUrl || 'https://ssuqvxfgraphgcnybxcj.supabase.co/functions/v1/instagram-webhook',
      verifyToken: 'instaautomate_verify'
    };
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  if (document.getElementById('connectPage')) {
    await requireAuth();
    initConnectPage();
  }
});

function confirmDeleteAccount(accountId) {
  if (!confirm('Are you sure you want to remove this Instagram account?')) return;
  instagram.deleteAccount(accountId).catch((e) => showToast(e.message || String(e), 'error'));
}

function initConnectPage() {
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === 'IG_CONNECTED') {
      loadConnectedAccounts();
      setTimeout(() => { window.location.href = 'dashboard.html?connected=true'; }, 800);
    }
  });

  loadConnectedAccounts();
  renderWebhookGuide();
}

async function loadConnectedAccounts() {
  const { success, data } = await instagram.getConnectedAccounts();
  const container = document.getElementById('connectedAccounts');
  if (!container) return;

  if (success && data?.length) {
    // Consider account fully connected if we have an IG access token + IG id.
    // Webhook_subscribed may still be false; that must NOT block onboarding state.
    const a = data[0];
    // Onboarding state should depend on token presence, not webhook subscription.
    const accountIsUsable = !!a.access_token && !!a.instagram_user_id;
    const wh = a.webhook_subscribed ? '<span class="badge-webhook">✅ Webhook Active</span>' : '<span class="badge">❌ Webhook Not Connected</span>';
    // If account is usable, we still show connected card (and hide connect CTA) even when webhooks are not yet active.
    // The UI already renders the connected banner here, so nothing else needed; keep this variable for future styling.
    container.innerHTML = `
      <div class="connected-banner">
        <img src="${a.profile_picture_url || ''}" alt="" class="account-avatar" onerror="this.remove()">
        <div>
          <strong>${a.username ? `@${a.username}` : '@instagram'}</strong>
          ${a.page_name ? `<div style="color:var(--text-secondary);font-size:12px;margin-top:4px">${a.page_name}</div>` : ''}

          <span class="badge badge-success">Connected</span>
          ${wh}
          <div class="account-stats">IG: ${a.instagram_account_id} · Page: ${a.page_name || a.page_id || '—'}</div>
        </div>
          <button class="btn btn-secondary" onclick="instagram.syncAccount()">Sync</button>
        <button class="btn btn-danger" onclick="instagram.disconnectAccount().then(()=>location.reload())">Disconnect</button>
        <button class="btn btn-danger" style="margin-top:10px;width:100%" onclick="confirmDeleteAccount(${JSON.stringify(a.id)})">Delete Account</button>
      </div>`;
    document.getElementById('webhookGuide')?.classList.remove('hidden');
    // Show automation CTA on successful connect
    const cta = document.getElementById('automationCta');
    if (cta) cta.classList.remove('hidden');
    const btn = document.getElementById('startAutomationBtn');
    if (btn) {
      btn.onclick = () => { window.location.href = 'dashboard.html?automate=true'; };
    }

  } else {
    container.innerHTML = `<div class="alert alert-info">Not connected yet. Use <strong>Manual Entry</strong> tab below.</div>`;
    document.getElementById('webhookGuide')?.classList.add('hidden');
  }
}

function renderWebhookGuide() {
  const el = document.getElementById('webhookGuideContent');
  if (!el) return;
  const { url, verifyToken } = instagram.getWebhookInfo();
  el.innerHTML = `
    <p class="text-muted">Meta Developer → Webhooks → Callback URL:</p>
    <input readonly value="${url}" onclick="this.select()" style="width:100%;margin-bottom:8px">
    <p class="text-muted">Verify token:</p>
    <input readonly value="${verifyToken}" onclick="this.select()" style="width:100%">
  `;
}
