document.addEventListener('DOMContentLoaded', async () => {
  if (!window.location.pathname.includes('dashboard')) return;
  await requireAuth();

  const statusEl = document.getElementById('connection-status');
  const { success, data: cfg } = await instagram.getConfig();

  if (statusEl) {
    if (success && cfg) {
      statusEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px">
          <img src="${cfg.profile_picture_url || ''}" style="width:48px;height:48px;border-radius:50%" onerror="this.remove()">
          <div>
            <strong>@${cfg.username}</strong>
            <div style="color:var(--text-secondary);font-size:13px">Connected · ID ${cfg.instagram_account_id || cfg.instagram_user_id}</div>
          </div>
          <span class="badge badge-success">Live</span>
        </div>`;
      const followers = document.getElementById('metric-followers');
      if (followers) followers.querySelector('p').textContent = '—';
    } else {
      statusEl.innerHTML = `<p>Instagram not connected. <a href="connect.html" class="btn btn-primary">Connect now</a></p>`;
    }
  }

  const { data: stats } = await supabase.from('analytics').select('*').eq('id', '00000000-0000-0000-0000-000000000002').maybeSingle();
  if (stats) {
    const set = (id, v) => { const n = document.getElementById(id); if (n?.querySelector('p')) n.querySelector('p').textContent = formatNumber(v); };
    set('metric-dms', stats.messages_sent);
    set('metric-comments', stats.comments_replied);
    set('metric-ai', stats.ai_replies);
  }
});
