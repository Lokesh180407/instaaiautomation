// comments.js – Handles loading and rendering of Instagram comments for a connected account
// Uses the shared instagram helper (js/instagram.js) and the automation modal defined in reels.html

// Global state
let activeCommentAccount = null;
let commentFlows = [];

// Initialise on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadCommentsDashboard();
});

/**
 * Load the dashboard: fetch the connected Instagram account, then its recent media
 * (reels & videos) and finally the comments for each piece of media.
 */
async function loadCommentsDashboard() {
  const loadingEl = document.getElementById('commentsLoading');
  const container = document.getElementById('commentsGrid');
  const noCommentsEl = document.getElementById('noCommentsWarning');
  loadingEl?.classList.remove('hidden');
  container.innerHTML = '';
  noCommentsEl?.classList.add('hidden');

  // 1️⃣ Get the connected account (single for demo)
  const { success, data: accounts } = await instagram.getConnectedAccounts();
  if (!success || !accounts.length) {
    loadingEl?.classList.add('hidden');
    noCommentsEl?.classList.remove('hidden');
    noCommentsEl.textContent = 'No Instagram account connected – use Manual Setup first.';
    return;
  }
  const preferredId = localStorage.getItem('activeInstagramAccountId');
  activeCommentAccount = accounts.find(a => String(a.id) === String(preferredId)) || accounts[0];

  // 2️⃣ Pull recent media (reels & videos) – reuse the same endpoint as reels.js
  const token = activeCommentAccount.long_lived_token || activeCommentAccount.access_token;
  const igId = activeCommentAccount.instagram_account_id || activeCommentAccount.id;
  let media = [];
  try {
    const res = await fetch(
      `https://graph.facebook.com/v23.0/${igId}/media?fields=id,media_type,caption,media_url,thumbnail_url,permalink&access_token=${encodeURIComponent(token)}`
    );
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    media = (json.data || []).filter(m => m.media_type === 'VIDEO' || m.media_type === 'REELS');
  } catch (e) {
    showToast('Failed to load media: ' + e.message, 'error');
    loadingEl?.classList.add('hidden');
    return;
  }

  if (!media.length) {
    loadingEl?.classList.add('hidden');
    noCommentsEl?.classList.remove('hidden');
    return;
  }

  // 3️⃣ For each media item, fetch its comments (first 20 for brevity)
  const commentPromises = media.map(async m => {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v23.0/${m.id}/comments?fields=id,text,username,like_count,timestamp&limit=20&access_token=${encodeURIComponent(token)}`
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      return { media: m, comments: json.data || [] };
    } catch (e) {
      console.error('Comment fetch error for', m.id, e);
      return { media: m, comments: [] };
    }
  });

  const mediaComments = await Promise.all(commentPromises);
  loadingEl?.classList.add('hidden');

  // 4️⃣ Render comments grid – each comment becomes a card with an "Automate" button
  container.innerHTML = mediaComments
    .map(mc => renderCommentsBlock(mc.media, mc.comments))
    .join('');

  // Load existing automation flows for the account (used by the modal)
  const { data: flows } = await supabase.from('flows').select('*').eq('is_active', true);
  commentFlows = flows || [];
}

/** Render a block containing a media thumbnail and its comment cards */
function renderCommentsBlock(media, comments) {
  const thumb = media.thumbnail_url || media.media_url || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500';
  const commentCards = comments
    .map(c => {
      const isAutomated = !!commentFlows.find(f => f.instagram_media_id === media.id && f.comment_id === c.id);
      return `
        <div class="comment-card ${isAutomated ? 'automated' : ''}">
          <div class="comment-header">
            <span class="comment-username">@${c.username}</span>
            <span class="comment-like">❤️ ${formatNumber(c.like_count)}</span>
          </div>
          <p class="comment-text">${escapeHtml(c.text)}</p>
          <div class="comment-actions">
            <button class="btn btn-sm btn-primary" onclick="openCommentAutomationModal('${media.id}', '${c.id}', '${escapeHtml(c.text)}')">
              ${isAutomated ? 'Edit Flow' : 'Automate'}
            </button>
          </div>
        </div>`;
    })
    .join('');

  return `
    <div class="media-comments-block">
      <div class="media-header">
        <img src="${thumb}" alt="Media thumbnail" class="media-thumb" />
        <span class="media-caption">${escapeHtml(media.caption || '—')}</span>
      </div>
      <div class="comments-grid-inner">
        ${commentCards || `<div class="empty-state">No comments found for this media.</div>`}
      </div>
    </div>`;
}

/** Open the automation modal pre‑filled for a given comment */
function openCommentAutomationModal(mediaId, commentId, commentText) {
  const modal = document.getElementById('automationModal');
  const form = document.getElementById('automationForm');

  document.getElementById('modalMediaId').value = mediaId;
  document.getElementById('modalCommentId').value = commentId;

  // Reset fields
  document.getElementById('modalFlowId').value = '';
  document.getElementById('keywordInput').value = '';
  document.getElementById('keywordChips').innerHTML = '';
  document.getElementById('matchCondition').value = 'contains';
  document.getElementById('dmMessage').value = '';
  document.getElementById('aiSystemPrompt').value = '';
  document.getElementById('responseType').value = 'text';
  togglePrivateReplyFields();

  // Look for existing flow for this comment
  const existing = commentFlows.find(f => f.instagram_media_id === mediaId && f.comment_id === commentId);
  if (existing) {
    document.getElementById('modalFlowId').value = existing.id;
    document.getElementById('keywordChips').innerHTML = (existing.trigger_keywords || []).map(kw => `
      <span class="keyword-chip">
        ${escapeHtml(kw)}
        <button type="button" onclick="removeKeyword('${kw}')">✕</button>
      </span>`).join('');
    document.getElementById('matchCondition').value = existing.trigger_condition || 'contains';
    document.getElementById('dmMessage').value = existing.response_message || '';
    document.getElementById('aiSystemPrompt').value = existing.ai_system_prompt || '';
    document.getElementById('responseType').value = existing.response_type || 'text';
    togglePrivateReplyFields();
  }

  // Show the modal
  modal.classList.remove('hidden');
}

/** Form submission – create or update a flow for a comment */
document.getElementById('automationForm').addEventListener('submit', async e => {
  e.preventDefault();
  const flowId = document.getElementById('modalFlowId').value;
  const mediaId = document.getElementById('modalMediaId').value;
  const commentId = document.getElementById('modalCommentId').value;
  const keywords = currentKeywords;
  const matchCondition = document.getElementById('matchCondition').value;
  const responseType = document.getElementById('responseType').value;
  const dmMessage = document.getElementById('dmMessage').value;
  const aiPrompt = document.getElementById('aiSystemPrompt').value;

  const user = await getCurrentUser();
  const flowData = {
    user_id: user.id,
    instagram_account_id: activeCommentAccount.id,
    instagram_media_id: mediaId,
    comment_id: commentId,
    name: `Comment Flow ${mediaId.slice(-4)}`,
    trigger_type: 'comment',
    trigger_keywords: keywords,
    trigger_condition: matchCondition,
    response_type: responseType,
    response_message: responseType === 'text' ? dmMessage : null,
    ai_system_prompt: responseType === 'ai' ? aiPrompt : null,
    is_active: true
  };

  let error = null;
  if (flowId) {
    const { error: err } = await supabase.from('flows').update(flowData).eq('id', flowId);
    error = err;
  } else {
    const { error: err } = await supabase.from('flows').insert(flowData);
    error = err;
  }

  if (error) {
    showToast('Failed to save automation: ' + error.message, 'error');
  } else {
    showToast('Comment automation saved!');
    closeAutomationModal();
    await loadCommentsDashboard();
  }
});

/** Helper utilities – reuse from reels.js */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatNumber(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Number(n).toLocaleString();
}

// Keyword chip handling – same as reels.js (shared globals)
let currentKeywords = [];
function addKeyword() {
  const input = document.getElementById('keywordInput');
  const val = input.value.trim().toLowerCase();
  if (val && !currentKeywords.includes(val)) {
    currentKeywords.push(val);
    renderKeywordChips();
    input.value = '';
  }
}
function renderKeywordChips() {
  const container = document.getElementById('keywordChips');
  container.innerHTML = currentKeywords
    .map(kw => `
      <span class="keyword-chip">
        ${escapeHtml(kw)}
        <button type="button" onclick="removeKeyword('${kw}')">✕</button>
      </span>`)
    .join('');
}
function removeKeyword(kw) {
  currentKeywords = currentKeywords.filter(k => k !== kw);
  renderKeywordChips();
}
function togglePrivateReplyFields() {
  const type = document.getElementById('responseType').value;
  const textGroup = document.getElementById('textResponseGroup');
  const aiGroup = document.getElementById('aiResponseGroup');
  if (type === 'ai') {
    textGroup.classList.add('hidden');
    aiGroup.classList.remove('hidden');
  } else {
    textGroup.classList.remove('hidden');
    aiGroup.classList.add('hidden');
  }
}

/** Close modal helper (shared with reels.js) */
function closeAutomationModal() {
  document.getElementById('automationModal').classList.add('hidden');
}

/** Refresh button */
document.getElementById('refreshCommentsBtn')?.addEventListener('click', loadCommentsDashboard);
