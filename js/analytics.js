const analytics = {
  async getTotals() {
    try {
      const { count: dm } = await supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'dm_sent');
      const { count: ai } = await supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'dm_ai_reply');
      const { count: comments } = await supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'comment_received');
      return { success: true, data: { messages_sent: dm || 0, ai_replies: ai || 0, comments_replied: comments || 0 } };
    } catch (error) {
      return { success: true, data: { messages_sent: 0, comments_replied: 0, ai_replies: 0 } };
    }
  },

  async getMessagesInRange(startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .gte('sent_at', startDate)
        .lte('sent_at', endDate)
        .order('sent_at', { ascending: true });
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: error.message, data: [] };
    }
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  if (window.location.pathname.includes('analytics')) {
    await requireAuth();
    initAnalyticsPage();
  }
});

let currentStartDate = null;
let currentEndDate = null;

function initAnalyticsPage() {
  document.querySelectorAll('[data-range]').forEach(preset => {
    preset.addEventListener('click', () => {
      const endDate = new Date();
      const startDate = new Date();
      const range = preset.dataset.range;
      if (range === '7d') startDate.setDate(endDate.getDate() - 7);
      else if (range === '30d') startDate.setDate(endDate.getDate() - 30);
      else startDate.setDate(endDate.getDate() - 90);
      currentStartDate = startDate.toISOString();
      currentEndDate = endDate.toISOString();
      document.querySelectorAll('[data-range]').forEach(p => p.classList.remove('active'));
      preset.classList.add('active');
      loadAnalytics();
    });
  });
  document.querySelector('[data-range="7d"]')?.click();
}

async function loadAnalytics() {
  const [{ data: totals }, { data: msgs }] = await Promise.all([
    analytics.getTotals(),
    analytics.getMessagesInRange(currentStartDate, currentEndDate)
  ]);

  const el = (id, val) => { const n = document.getElementById(id); if (n) n.textContent = formatNumber(val ?? 0); };
  el('totalDMs', totals?.messages_sent ?? msgs?.length ?? 0);
  el('autoReplyRate', totals?.ai_replies ?? 0);
  if (document.getElementById('metric-dms')) document.getElementById('metric-dms').querySelector('p').textContent = formatNumber(totals?.messages_sent ?? 0);
  if (document.getElementById('metric-comments')) document.getElementById('metric-comments').querySelector('p').textContent = formatNumber(totals?.comments_replied ?? 0);
  if (document.getElementById('metric-ai')) document.getElementById('metric-ai').querySelector('p').textContent = formatNumber(totals?.ai_replies ?? 0);

  loadMessagesChart(msgs || []);
}

async function loadMessagesChart(data) {
  const ctx = document.getElementById('messagesChart')?.getContext('2d');
  if (!ctx || typeof Chart === 'undefined') return;
  const byDate = {};
  data.forEach(msg => {
        const date = new Date(msg.sent_at || msg.created_at).toLocaleDateString();
    if (!byDate[date]) byDate[date] = { incoming: 0, outgoing: 0 };
    if (msg.direction === 'incoming') byDate[date].incoming++;
    else byDate[date].outgoing++;
  });
  const labels = Object.keys(byDate);
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Received', data: labels.map(d => byDate[d].incoming), borderColor: '#7C3AED', tension: 0.4 },
        { label: 'Sent', data: labels.map(d => byDate[d].outgoing), borderColor: '#10B981', tension: 0.4 }
      ]
    },
    options: { responsive: true, plugins: { legend: { labels: { color: '#fff' } } } }
  });
}
