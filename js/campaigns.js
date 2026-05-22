// Campaigns — stored in templates-style simple list (optional table extension)
const campaigns = {
  async getCampaigns() {
    try {
      const { data, error } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return { success: true, data: data?.map(t => ({ ...t, name: t.name, message: t.content, status: 'draft' })) };
    } catch (error) {
      return { success: false, error: error.message, data: [] };
    }
  },

  async createCampaign({ name, message }) {
    try {
      const { data, error } = await supabase.from('templates').insert({ name, content: message }).select().single();
      if (error) throw error;
      showToast('Campaign template saved');
      return { success: true, data };
    } catch (error) {
      showToast(error.message, 'error');
      return { success: false, error: error.message };
    }
  },

  async deleteCampaign(id) {
    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return { success: false }; }
    showToast('Deleted');
    return { success: true };
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  if (window.location.pathname.includes('campaigns')) {
    await requireAuth();
    loadCampaigns();
    document.getElementById('campaignForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await campaigns.createCampaign({
        name: document.getElementById('campaignName')?.value,
        message: document.getElementById('campaignMessage')?.value
      });
      loadCampaigns();
    });
  }
});

async function loadCampaigns() {
  const { data } = await campaigns.getCampaigns();
  const el = document.getElementById('campaignsList');
  if (!el) return;
  el.innerHTML = (data || []).map(c => `
    <div class="card" style="margin-bottom:12px;padding:16px">
      <strong>${c.name}</strong>
      <p style="color:var(--text-secondary);font-size:13px">${(c.message || c.content || '').substring(0, 80)}</p>
      <button class="btn btn-danger" onclick="campaigns.deleteCampaign('${c.id}').then(loadCampaigns)">Delete</button>
    </div>`).join('') || '<p>No campaigns yet</p>';
}
