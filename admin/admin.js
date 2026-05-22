const ADMIN_API = () => {
  const base = window.APP_CONFIG?.supabaseUrl || 'https://ssuqvxfgraphgcnybxcj.supabase.co';
  return `${base.replace(/\/$/, '')}/functions/v1/admin-api`;
};

function requireAdminAuth() {
  const token = localStorage.getItem('admin_token');
  if (!token) {
    window.location.href = '../admin-login.html';
    return null;
  }
  return token;
}

function adminHeaders() {
  const token = localStorage.getItem('admin_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
}

function logoutAdmin() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_data');
  window.location.href = '../admin-login.html';
}

document.getElementById('logoutBtn')?.addEventListener('click', logoutAdmin);

async function loadAdminStats() {
  const admin = JSON.parse(localStorage.getItem('admin_data') || '{}');
  const greet = document.getElementById('adminGreeting');
  if (greet) greet.textContent = admin.full_name ? `Signed in as ${admin.full_name}` : 'Admin session';

  try {
    const res = await fetch(`${ADMIN_API()}/stats`, { headers: adminHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    document.getElementById('statUsers').textContent = data.total_users ?? '0';
    document.getElementById('statActive').textContent = data.active_today ?? '0';
    document.getElementById('statIg').textContent = data.instagram_accounts ?? '0';
    document.getElementById('statFlows').textContent = data.flows_today ?? '0';
    const list = document.getElementById('recentSignups');
    if (list && data.recent_signups?.length) {
      list.innerHTML = data.recent_signups.map(u =>
        `<div style="padding:8px 0;border-bottom:1px solid #E2E8F0">${u.email} · ${u.plan_name || 'free'} · ${new Date(u.created_at).toLocaleDateString()}</div>`
      ).join('');
      list.classList.remove('empty');
    }
  } catch (_) {
    /* admin-api not deployed yet */
  }
}
