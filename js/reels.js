// Reels Operator & Consistency Logic
let activeAccount = null;
let currentKeywords = [];

document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  await loadReelsDashboard();
});

async function loadReelsDashboard() {
  const reelsGrid = document.getElementById('reelsGrid');
  const noAccountsWarning = document.getElementById('noAccountsWarning');
  const noReelsWarning = document.getElementById('noReelsWarning');
  const reelsLoading = document.getElementById('reelsLoading');

  reelsLoading.classList.remove('hidden');
  reelsGrid.innerHTML = '';
  noAccountsWarning.classList.add('hidden');
  noReelsWarning.classList.add('hidden');

  const { success, data: accounts } = await instagram.getConnectedAccounts();

  if (!success || accounts.length === 0) {
    reelsLoading.classList.add('hidden');
    noAccountsWarning.classList.remove('hidden');
    return;
  }

  // Use user-selected account (stored in localStorage), default to first
  const preferredId = localStorage.getItem('activeInstagramAccountId');
  activeAccount = accounts.find(a => String(a.id) === String(preferredId)) || accounts[0];

  // Fetch reels from Graph API (optional cache table may not exist)
  let reels = [];
  let error = null;
  try {
    const token = activeAccount.long_lived_token || activeAccount.access_token;
    const igId = activeAccount.instagram_account_id || activeAccount.id;
    const res = await fetch(
      `https://graph.facebook.com/v23.0/${igId}/media?fields=id,media_type,thumbnail_url,permalink,like_count,comments_count,caption,timestamp&access_token=${encodeURIComponent(token)}`
    );
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    reels = (json.data || []).filter(m => m.media_type === 'VIDEO' || m.media_type === 'REELS');
  } catch (e) {
    error = e;
  }

  reelsLoading.classList.add('hidden');

  if (error) {
    showToast('Failed to load reels: ' + error.message, 'error');
    return;
  }

  // Generate Consistency Calendar and Stats
  generateCalendar(reels || []);
  calculateStats(reels || []);

  if (!reels || reels.length === 0) {
    noReelsWarning.classList.remove('hidden');
    return;
  }

  // Fetch active comment/reel automation flows for this account
  const { data: flows } = await supabase.from('flows').select('*').eq('is_active', true);

  // Render reels grid
  reelsGrid.innerHTML = reels.map(reel => {
    // Check if this specific reel has automation
    const isAutomated = !!(flows && flows.length);

    return `
      <div class="reel-card">
        <div class="reel-media">
          <img src="${reel.thumbnail_url || reel.media_url || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500'}" alt="Reel Thumbnail" onerror="this.src='https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500'">
          
          <div class="reel-overlay">
            ${isAutomated ? `
              <span class="reel-badge automated">
                ⚡ Automated
              </span>
            ` : `
              <span class="reel-badge">
                🎬 Standard
              </span>
            `}
          </div>

          <div class="reel-stats-overlay">
            <span class="reel-stat">💬 ${formatNumber(reel.comments_count)}</span>
            <span class="reel-stat">❤️ ${formatNumber(reel.like_count)}</span>
          </div>
        </div>
        
        <div class="reel-content">
          <p class="reel-caption">${escapeHtml(reel.caption) || '<i>No caption provided.</i>'}</p>
          <div class="reel-footer">
            <span class="posted-date">${formatDate(reel.posted_at)}</span>
            <button class="btn btn-secondary btn-sm" onclick="openAutomationModalForReel('${reel.instagram_media_id}', '${reel.thumbnail_url || reel.media_url}', \`${escapeHtml(reel.caption.replace(/`/g, '\\`'))}\`)">
              ${isAutomated ? 'Edit Flow' : 'Automate'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Sync reels via Supabase Edge Function
async function syncAllReels() {
  if (!activeAccount) {
    showToast('No connected Instagram account found!', 'error');
    return;
  }

  const syncBtn = document.getElementById('syncReelsBtn');
  const originalHtml = syncBtn.innerHTML;
  
  showLoading(syncBtn);
  const { success, error } = await instagram.syncAccount(activeAccount.id);
  hideLoading(syncBtn, originalHtml);

  if (success) {
    await loadReelsDashboard();
  }
}

// Generate the visual Posting Consistency Calendar
function generateCalendar(reels) {
  const calendarGrid = document.getElementById('calendarGrid');
  const calendarTitle = document.getElementById('calendarTitle');
  
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  
  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  
  calendarTitle.innerText = `${monthNames[currentMonth]} ${currentYear}`;
  
  // Clear grid
  calendarGrid.innerHTML = '';
  
  // Weekday Headers
  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  weekdays.forEach(day => {
    calendarGrid.innerHTML += `<div class="calendar-weekday">${day}</div>`;
  });
  
  // First day of current month
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  // Empty slots for padding
  for (let i = 0; i < firstDay; i++) {
    calendarGrid.innerHTML += `<div></div>`;
  }
  
  // Get set of days in current month that have posts
  const postedDays = new Set();
  reels.forEach(reel => {
    const postDate = new Date(reel.posted_at);
    if (postDate.getFullYear() === currentYear && postDate.getMonth() === currentMonth) {
      postedDays.add(postDate.getDate());
    }
  });
  
  // Draw month days
  for (let day = 1; day <= totalDays; day++) {
    const isPosted = postedDays.has(day);
    const isToday = day === today.getDate();
    
    calendarGrid.innerHTML += `
      <div class="calendar-day ${isPosted ? 'active-post' : ''} ${isToday ? 'today' : ''}">
        ${day}
      </div>
    `;
  }
}

// Compute posting streaks, frequencies, and target consistency score
function calculateStats(reels) {
  const postStreakEl = document.getElementById('postStreak');
  const postFrequencyEl = document.getElementById('postFrequency');
  const consistencyScoreEl = document.getElementById('consistencyScore');
  const totalReelsCountEl = document.getElementById('totalReelsCount');

  totalReelsCountEl.innerText = formatNumber(reels.length);

  if (reels.length === 0) {
    postStreakEl.innerText = '0 Days';
    postFrequencyEl.innerText = '0.0/wk';
    consistencyScoreEl.innerText = '0%';
    return;
  }

  // Calculate Streak
  let streak = 0;
  const postDates = reels.map(r => new Date(r.posted_at).toDateString());
  const uniquePostDates = [...new Set(postDates)].map(d => new Date(d));
  uniquePostDates.sort((a, b) => b - a); // descending

  let checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  // If the last post was not today or yesterday, streak is broken
  const latestPostDate = uniquePostDates[0];
  if (latestPostDate) {
    const diffTime = Math.abs(checkDate - latestPostDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) {
      // Trace backwards
      for (let i = 0; i < uniquePostDates.length; i++) {
        const d = uniquePostDates[i];
        const timeDiff = Math.abs(checkDate - d);
        const dayDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        
        if (dayDiff <= 1 || (i > 0 && Math.ceil(Math.abs(uniquePostDates[i-1] - d) / (1000 * 60 * 60 * 24)) === 1)) {
          streak++;
          checkDate = d;
        } else {
          break;
        }
      }
    }
  }
  postStreakEl.innerText = `${streak} Day${streak === 1 ? '' : 's'}`;

  // Calculate Posting Frequency (Posts per week in past 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentReels = reels.filter(r => new Date(r.posted_at) >= thirtyDaysAgo);
  
  const frequency = (recentReels.length / 4.2).toFixed(1);
  postFrequencyEl.innerText = `${frequency}/wk`;

  // Calculate Consistency Index (percentage of past 30 days posted)
  const activeDays = new Set(recentReels.map(r => new Date(r.posted_at).toDateString())).size;
  const targetDays = 12; // Standard target of 3 posts/week (12 posts/month)
  const indexScore = Math.min(Math.round((activeDays / targetDays) * 100), 100);
  consistencyScoreEl.innerText = `${indexScore}%`;
}

// Modal handling
window.openAutomationModalForReel = async (mediaId, thumbUrl, caption) => {
  const modal = document.getElementById('automationModal');
  const form = document.getElementById('automationForm');
  
  // Set modal visual targets
  document.getElementById('modalMediaId').value = mediaId;
  document.getElementById('modalReelThumb').src = thumbUrl;
  document.getElementById('modalReelCaption').innerHTML = caption || '<i>No caption.</i>';
  
  // Clear form default
  document.getElementById('modalFlowId').value = '';
  document.getElementById('commentReplyText').value = '';
  document.getElementById('dmMessage').value = '';
  document.getElementById('aiSystemPrompt').value = '';
  document.getElementById('matchCondition').value = 'contains';
  document.getElementById('responseType').value = 'text';
  currentKeywords = [];
  renderKeywordChips();
  togglePrivateReplyFields();

  // Search if a flow already exists for this media ID
  const { data: flows } = await supabase
    .from('flows')
    .select('*')
    .eq('instagram_media_id', mediaId)
    .eq('instagram_account_id', activeAccount.id)
    .limit(1);

  if (flows && flows.length > 0) {
    const flow = flows[0];
    document.getElementById('modalFlowId').value = flow.id;
    document.getElementById('commentReplyText').value = flow.comment_response_text || '';
    document.getElementById('dmMessage').value = flow.response_message || '';
    document.getElementById('aiSystemPrompt').value = flow.ai_system_prompt || '';
    document.getElementById('matchCondition').value = flow.trigger_condition || 'contains';
    document.getElementById('responseType').value = flow.response_type || 'text';
    currentKeywords = flow.trigger_keywords || [];
    renderKeywordChips();
    togglePrivateReplyFields();
  }

  modal.classList.remove('hidden');
};

window.closeAutomationModal = () => {
  document.getElementById('automationModal').classList.add('hidden');
};

window.togglePrivateReplyFields = () => {
  const rType = document.getElementById('responseType').value;
  const textGroup = document.getElementById('textResponseGroup');
  const aiGroup = document.getElementById('aiResponseGroup');

  if (rType === 'ai') {
    textGroup.classList.add('hidden');
    aiGroup.classList.remove('hidden');
    document.getElementById('dmMessage').required = false;
  } else {
    textGroup.classList.remove('hidden');
    aiGroup.classList.add('hidden');
    document.getElementById('dmMessage').required = true;
  }
};

// Keyword chips
window.addKeyword = () => {
  const input = document.getElementById('keywordInput');
  const val = input.value.trim().toLowerCase();
  
  if (val && !currentKeywords.includes(val)) {
    currentKeywords.push(val);
    renderKeywordChips();
    input.value = '';
  }
};

function renderKeywordChips() {
  const container = document.getElementById('keywordChips');
  container.innerHTML = currentKeywords.map(kw => `
    <span class="keyword-chip">
      ${escapeHtml(kw)}
      <button type="button" onclick="removeKeyword('${kw}')">✕</button>
    </span>
  `).join('');
}

window.removeKeyword = (kw) => {
  currentKeywords = currentKeywords.filter(k => k !== kw);
  renderKeywordChips();
};

// Save Form Automation
document.getElementById('automationForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const mediaId = document.getElementById('modalMediaId').value;
  const flowId = document.getElementById('modalFlowId').value;
  const commentReplyText = document.getElementById('commentReplyText').value;
  const dmMessage = document.getElementById('dmMessage').value;
  const aiSystemPrompt = document.getElementById('aiSystemPrompt').value;
  const matchCondition = document.getElementById('matchCondition').value;
  const responseType = document.getElementById('responseType').value;

  const btn = document.getElementById('saveAutomationBtn');
  showLoading(btn);

  const user = await getCurrentUser();
  const flowData = {
    user_id: user.id,
    instagram_account_id: activeAccount.id,
    instagram_media_id: mediaId,
    name: `Operator: Reel ${mediaId.slice(-6)}`,
    trigger_type: 'reel_comment',
    trigger_keywords: currentKeywords,
    trigger_condition: matchCondition,
    response_type: responseType,
    response_message: responseType === 'text' ? dmMessage : null,
    ai_system_prompt: responseType === 'ai' ? aiSystemPrompt : null,
    comment_response_text: commentReplyText,
    is_active: true
  };

  let error = null;

  if (flowId) {
    // Update existing
    const { error: err } = await supabase
      .from('flows')
      .update(flowData)
      .eq('id', flowId);
    error = err;
  } else {
    // Insert new
    const { error: err } = await supabase
      .from('flows')
      .insert(flowData);
    error = err;
  }

  hideLoading(btn, 'Save Operator Flow');

  if (error) {
    showToast('Failed to save automation: ' + error.message, 'error');
  } else {
    showToast('Reel automation flow saved successfully!');
    closeAutomationModal();
    await loadReelsDashboard();
  }
});

// Helper utilities
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
