const inbox = {
  async getMessages(conversationId, limit = 80) {
    try {
      let q = supabase
        .from('messages')
        .select('*')
        .order('sent_at', { ascending: true })
        .limit(limit);
      if (conversationId) q = q.eq('conversation_id', conversationId);
      const { data, error } = await q;
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: error.message, data: [] };
    }
  },

  async getConversations() {
    try {
      const user = await getCurrentUser();
      let q = supabase
        .from('conversations')
        .select('id, conversation_id, participant_instagram_id, participant_username, participant_name, participant_avatar, unread_count, last_message, last_message_at, ai_enabled, bot_enabled, human_handoff')
        .order('last_message_at', { ascending: false })
        .limit(50);
      if (user?.id) q = q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: error.message, data: [] };
    }
  },

  /** agent = AI auto-reply | human = store only (Insta-agent reference) */
  async setConversationMode(conversationId, mode) {
    const isHuman = mode === 'human';
    const { error } = await supabase
      .from('conversations')
      .update({
        human_handoff: isHuman,
        ai_enabled: !isHuman,
        bot_enabled: true
      })
      .eq('id', conversationId);
    if (error) throw error;
    return { success: true };
  },

  async sendMessage(recipientId, text, conversationId) {
    try {
      const { success, data: cfg } = await instagram.getConfig();
      if (!success || !cfg?.access_token) throw new Error('Instagram not connected');

      const { error } = await supabase.functions.invoke('send-dm', {
        body: { recipient_id: recipientId, message: text, conversation_id: conversationId }
      });
      if (error) throw error;

      await supabase.from('messages').insert({
        conversation_id: conversationId || null,
        message_id: crypto.randomUUID(),
        instagram_message_id: crypto.randomUUID(),
        direction: 'outgoing',
        content: text,
        sent_at: new Date().toISOString(),
        is_ai_reply: false
      }).catch(() => {});

      if (conversationId) {
        await supabase.from('conversations').update({
          last_message: text,
          last_message_at: new Date().toISOString(),
          last_message_direction: 'outgoing'
        }).eq('id', conversationId);
      }

      showToast('Message sent');
      return { success: true };
    } catch (error) {
      showToast(error.message, 'error');
      return { success: false, error: error.message };
    }
  }
};

let conversationsCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (window.location.pathname.includes('inbox')) {
    await requireAuth();
    initInboxPage();
  }
});

function initInboxPage() {
  initConversationList();
  initChatInput();
  subscribeInboxRealtime();
}

function subscribeInboxRealtime() {
  if (!supabase?.channel) return;
  supabase
    .channel('inbox-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
      const convId = document.getElementById('currentConversationId')?.value;
      if (convId) loadMessages(convId);
      refreshConversationList();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
      refreshConversationList();
    })
    .subscribe();
}

async function refreshConversationList() {
  const { success, data } = await inbox.getConversations();
  if (success) conversationsCache = data;
}

async function initConversationList() {
  const listEl = document.getElementById('conversationList');
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendMessage');
  if (!listEl) return;

  listEl.innerHTML = '<div class="loading" style="margin: 24px auto;"></div>';

  const { success, data } = await inbox.getConversations();
  conversationsCache = data || [];

  if (!success || !conversationsCache.length) {
    listEl.innerHTML = '<div class="empty-state"><div class="empty-state-title">No conversations yet</div><p style="color:var(--text-secondary);font-size:13px">DMs appear here when Meta webhook receives messages.</p></div>';
    return;
  }

  renderConversationList(conversationsCache);
  selectConversation(conversationsCache[0].id);

  if (input) input.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
}

function renderConversationList(data) {
  const listEl = document.getElementById('conversationList');
  const activeId = document.getElementById('currentConversationId')?.value;
  listEl.innerHTML = data.map(conv => `
    <div class="conversation-item ${conv.id === activeId ? 'active' : ''}"
         data-id="${conv.id}"
         style="padding:12px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;gap:12px;align-items:center;">
      <img src="${conv.participant_avatar || 'https://ui-avatars.com/api/?name=User&background=E1306C&color=fff'}" style="width:36px;height:36px;border-radius:50%" onerror="this.remove()">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${conv.participant_username || conv.participant_name || 'User'}</div>
        <div style="color:var(--text-secondary);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${conv.last_message || ''}</div>
      </div>
      ${conv.human_handoff ? '<span class="badge" title="Human mode">👤</span>' : '<span class="badge badge-purple" title="Agent mode">🤖</span>'}
      ${conv.unread_count > 0 ? `<span class="badge badge-success">${conv.unread_count}</span>` : ''}
    </div>
  `).join('');

  listEl.querySelectorAll('.conversation-item').forEach(el => {
    el.addEventListener('click', () => selectConversation(el.dataset.id));
  });
}

function selectConversation(conversationId) {
  const conv = conversationsCache.find(c => c.id === conversationId);
  document.getElementById('currentConversationId').value = conversationId;

  let recipientEl = document.getElementById('currentRecipientId');
  if (!recipientEl) {
    recipientEl = document.createElement('input');
    recipientEl.type = 'hidden';
    recipientEl.id = 'currentRecipientId';
    document.body.appendChild(recipientEl);
  }
  recipientEl.value = conv?.participant_instagram_id || conv?.conversation_id || '';

  updateModeUI(conv);

  document.querySelectorAll('.conversation-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === conversationId);
  });

  loadMessages(conversationId);
}

window.__selectConversation = selectConversation;

async function loadMessages(conversationId) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const { success, data } = await inbox.getMessages(conversationId);
  if (!success || !data?.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-title">No messages yet</div></div>';
    return;
  }

  container.innerHTML = data.map(msg => `
    <div class="message ${msg.direction === 'incoming' ? 'incoming' : 'outgoing'}">
      <div class="message-content">${escapeHtml(msg.content || msg.message_text || '')}</div>
      <div class="message-time">${formatTime(msg.sent_at || msg.created_at)}</div>
      ${(msg.is_ai_reply || msg.ai_generated) ? '<span class="badge badge-success">AI</span>' : ''}
      ${msg.is_auto_reply ? '<span class="badge badge-purple">Auto</span>' : ''}
    </div>
  `).join('');
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateModeUI(conv) {
  const badge = document.getElementById('modeBadge');
  const btn = document.getElementById('modeToggleBtn');
  const isHuman = !!conv?.human_handoff;
  if (badge) {
    badge.textContent = isHuman ? 'Human' : 'Agent';
    badge.className = isHuman ? 'badge' : 'badge badge-purple';
  }
  if (btn) btn.textContent = isHuman ? 'Switch to Agent' : 'Switch to Human';
}

async function toggleConversationMode() {
  const conversationId = document.getElementById('currentConversationId')?.value;
  if (!conversationId) {
    showToast('Select a conversation first', 'error');
    return;
  }
  const conv = conversationsCache.find(c => c.id === conversationId);
  const nextMode = conv?.human_handoff ? 'agent' : 'human';
  try {
    await inbox.setConversationMode(conversationId, nextMode);
    if (conv) {
      conv.human_handoff = nextMode === 'human';
      conv.ai_enabled = nextMode === 'agent';
    }
    updateModeUI(conv);
    showToast(nextMode === 'agent' ? 'Agent mode — AI will auto-reply' : 'Human mode — you reply manually');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

window.toggleConversationMode = toggleConversationMode;

function initChatInput() {
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendMessage');

  const send = async () => {
    const text = input?.value?.trim();
    const recipientId = document.getElementById('currentRecipientId')?.value;
    const conversationId = document.getElementById('currentConversationId')?.value;
    if (!text || !recipientId) {
      showToast('Select a conversation with a valid recipient', 'error');
      return;
    }
    await inbox.sendMessage(recipientId, text, conversationId);
    input.value = '';
    if (conversationId) loadMessages(conversationId);
  };

  sendBtn?.addEventListener('click', send);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
}
