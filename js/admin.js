// Admin Dashboard Logic & Operations
document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  const isAdmin = await verifyAdminAccess();
  if (isAdmin) {
    await loadAdminDashboard();
  }
});

// Verify if the logged-in user is an admin
async function verifyAdminAccess() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      window.location.href = 'auth.html';
      return false;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      showToast('Unauthorized access to Admin Panel', 'error');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1500);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error verifying admin access:', error);
    window.location.href = 'dashboard.html';
    return false;
  }
}

async function loadAdminDashboard() {
  const tableBody = document.getElementById('userTableBody');
  tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;"><div class="loading"></div><p style="margin-top: 8px; color: var(--text-secondary);">Querying SaaS registry...</p></td></tr>`;

  try {
    // 1. Fetch platform overview telemetry
    const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: accountsCount } = await supabase.from('instagram_accounts').select('*', { count: 'exact', head: true });
    const { count: activeFlowsCount } = await supabase.from('flows').select('*', { count: 'exact', head: true }).eq('is_active', true);
    
    // Aggregate aggregate DMs sent from all profiles
    const { data: dmAggregates } = await supabase.from('profiles').select('total_dms_sent');
    const totalDMsPlatform = dmAggregates ? dmAggregates.reduce((acc, p) => acc + (p.total_dms_sent || 0), 0) : 0;

    document.getElementById('adminTotalUsers').innerText = usersCount || 0;
    document.getElementById('adminConnectedAccounts').innerText = accountsCount || 0;
    document.getElementById('adminActiveFlows').innerText = activeFlowsCount || 0;
    document.getElementById('adminTotalDMs').innerText = formatNumber(totalDMsPlatform);

    // 2. Fetch profiles lists
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!profiles || profiles.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No registered platform users found.</td></tr>`;
      return;
    }

    // 3. Render registry
    tableBody.innerHTML = profiles.map(profile => {
      const isAiConfigured = profile.ai_api_key ? 'Badge Configured' : 'Inactive';
      const badgeClass = profile.plan === 'pro' ? 'badge-purple' : (profile.plan === 'starter' ? 'badge-success' : 'badge-warning');
      const subBadgeClass = profile.subscription_status === 'active' ? 'badge-success' : 'badge-error';

      return `
        <tr>
          <td>
            <div class="user-meta">
              <img src="${profile.avatar_url || '/placeholder-avatar.png'}" alt="Avatar" class="user-avatar" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'">
              <div>
                <div style="font-weight: 600; color: white;">${escapeHtml(profile.full_name) || 'Anonymous User'}</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">ID: ${profile.id.slice(0, 8)}...</div>
              </div>
            </div>
          </td>
          <td style="color: var(--text-secondary);">${escapeHtml(profile.email)}</td>
          <td>
            <span class="badge ${badgeClass}">${profile.plan ? profile.plan.toUpperCase() : 'FREE'}</span>
          </td>
          <td>
            <span class="badge ${subBadgeClass}">${profile.subscription_status ? profile.subscription_status.toUpperCase() : 'INACTIVE'}</span>
          </td>
          <td>
            ${profile.ai_api_key ? `
              <span class="badge badge-success" style="font-size: 11px;">
                🤖 ${profile.ai_provider.toUpperCase()} Enabled
              </span>
            ` : `
              <span class="badge badge-error" style="font-size: 11px;">
                ✕ Disabled
              </span>
            `}
          </td>
          <td style="font-weight: 600;">${formatNumber(profile.total_dms_sent || 0)} DMs</td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-sm" onclick="openPlanModal('${profile.id}', '${profile.plan}', '${profile.subscription_status}')" style="padding: 6px 12px; font-size: 12px;">
              Manage Tier
            </button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (error) {
    showToast('Failed to load admin telemetry: ' + error.message, 'error');
  }
}

// Wizard Plan edit
window.openPlanModal = (userId, plan, status) => {
  document.getElementById('modalUserId').value = userId;
  document.getElementById('modalPlanSelect').value = plan || 'free';
  document.getElementById('modalStatusSelect').value = status || 'inactive';
  document.getElementById('planModal').classList.remove('hidden');
};

window.closePlanModal = () => {
  document.getElementById('planModal').classList.add('hidden');
};

// Form subscription save
document.getElementById('planForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const userId = document.getElementById('modalUserId').value;
  const plan = document.getElementById('modalPlanSelect').value;
  const status = document.getElementById('modalStatusSelect').value;
  const btn = document.getElementById('savePlanBtn');

  showLoading(btn);

  try {
    const updateData = {
      plan: plan,
      subscription_status: status,
      subscription_end_date: status === 'active' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null
    };

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (error) throw error;

    showToast('User subscription updated successfully!');
    closePlanModal();
    await loadAdminDashboard();
  } catch (error) {
    showToast('Failed to update subscription: ' + error.message, 'error');
  } finally {
    hideLoading(btn, 'Modify User Subscription');
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
