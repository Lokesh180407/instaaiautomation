const AI_SETTINGS_ID = '00000000-0000-0000-0000-000000000003';

const settings = {
  async getAISettings() {
    try {
      const { data, error } = await supabase.from('ai_settings').select('*').eq('id', AI_SETTINGS_ID).maybeSingle();
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async updateAISettings({ provider, apiKey, openaiKey, geminiKey, claudeKey, enabled, systemPrompt }) {
    try {
      const patch = {
        provider: provider || 'openai',
        enabled: !!enabled,
        system_prompt: systemPrompt || null
      };
      if (openaiKey) patch.openai_key = openaiKey;
      if (geminiKey) patch.gemini_key = geminiKey;
      if (claudeKey) patch.claude_key = claudeKey;
      if (apiKey) patch.api_key = apiKey;

      const { error } = await supabase.from('ai_settings').upsert({ id: AI_SETTINGS_ID, ...patch }, { onConflict: 'id' });
      if (error) throw error;
      showToast('AI settings saved');
      return { success: true };
    } catch (error) {
      showToast(error.message, 'error');
      return { success: false, error: error.message };
    }
  },

  async testAIConnection(provider, apiKey) {
    try {
      const { error } = await supabase.functions.invoke('ai-reply', {
        body: { provider, api_key: apiKey, test: true }
      });
      if (error) throw error;
      showToast('AI connection OK');
      return { success: true };
    } catch (error) {
      showToast(error.message, 'error');
      return { success: false, error: error.message };
    }
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  if (window.location.pathname.includes('settings')) {
    await requireAuth();
    initSettingsPage();
  }
});

function initSettingsPage() {
  initTabs();
  loadAISettings();
  initAISettingsForm();
  initInstagramSettings();
}

function initTabs() {
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.settings-content').forEach(c => c.classList.add('hidden'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab)?.classList.remove('hidden');
    });
  });
}

async function loadAISettings() {
  const { data } = await settings.getAISettings();
  if (!data) return;
  const providerEl = document.getElementById('aiProvider');
  if (providerEl) providerEl.value = data.provider || 'openai';
  const keyMap = { openai: data.openai_key, gemini: data.gemini_key, claude: data.claude_key };
  const apiEl = document.getElementById('aiApiKey');
  if (apiEl) apiEl.value = keyMap[data.provider] || data.api_key || '';
  const promptEl = document.getElementById('defaultSystemPrompt');
  if (promptEl) promptEl.value = data.system_prompt || '';
  const toggle = document.getElementById('globalAIToggle');
  if (toggle && data.enabled) toggle.classList.add('active');
}

function initAISettingsForm() {
  const form = document.getElementById('aiSettingsForm');
  const testBtn = document.getElementById('testAIConnection');
  const apiKeyInput = document.getElementById('aiApiKey');
  document.getElementById('showHideApiKey')?.addEventListener('click', () => {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
  });
  testBtn?.addEventListener('click', async () => {
    showLoading(testBtn);
    await settings.testAIConnection(
      document.getElementById('aiProvider').value,
      document.getElementById('aiApiKey').value
    );
    hideLoading(testBtn, 'Test Connection');
  });
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const provider = document.getElementById('aiProvider').value;
    const apiKey = document.getElementById('aiApiKey').value;
    const enabled = document.getElementById('globalAIToggle')?.classList.contains('active');
    const keys = { openai: {}, gemini: {}, claude: {} };
    keys[provider] = apiKey;
    const btn = e.target.querySelector('button[type="submit"]');
    showLoading(btn);
    await settings.updateAISettings({
      provider,
      apiKey,
      openaiKey: provider === 'openai' ? apiKey : undefined,
      geminiKey: provider === 'gemini' ? apiKey : undefined,
      claudeKey: provider === 'claude' ? apiKey : undefined,
      enabled,
      systemPrompt: document.getElementById('defaultSystemPrompt')?.value
    });
    hideLoading(btn, 'Save Changes');
  });
  document.getElementById('globalAIToggle')?.addEventListener('click', function () {
    this.classList.toggle('active');
  });
}

async function initInstagramSettings() {
  const { data } = await instagram.getConnectedAccounts();
  const container = document.getElementById('instagramSettings');
  if (!container) return;
  if (data?.length) {
    const a = data[0];
    container.innerHTML = `
      <div class="account-card">
        <img src="${a.profile_picture_url || ''}" class="account-avatar" alt="">
        <div class="account-info">
          <div class="account-username">@${a.username}</div>
          <div class="account-stats">ID ${a.instagram_account_id}</div>
        </div>
        <button class="btn btn-secondary" onclick="instagram.syncAccount()">Sync</button>
        <button class="btn btn-danger" onclick="instagram.disconnectAccount().then(() => location.reload())">Disconnect</button>
      </div>`;
  } else {
    container.innerHTML = '<p style="color:var(--text-secondary)">Not connected. <a href="connect.html">Connect Instagram</a></p>';
  }
}
