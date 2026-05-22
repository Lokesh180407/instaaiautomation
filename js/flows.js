// Flows — production Supabase schema
const flows = {
  async getFlows() {
    try {
      const user = await getCurrentUser();
      const { data, error } = await supabase
        .from('flows')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async createFlow(flowData) {
    try {
      const user = await getCurrentUser();
      const { data, error } = await supabase
        .from('flows')
        .insert({ ...flowData, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      showToast('Flow created');
      return { success: true, data };
    } catch (error) {
      showToast(error.message, 'error');
      return { success: false, error: error.message };
    }
  },

  async updateFlow(flowId, flowData) {
    try {
      const { data, error } = await supabase.from('flows').update(flowData).eq('id', flowId).select().single();
      if (error) throw error;
      showToast('Flow updated');
      return { success: true, data };
    } catch (error) {
      showToast(error.message, 'error');
      return { success: false, error: error.message };
    }
  },

  async deleteFlow(flowId) {
    const { error } = await supabase.from('flows').delete().eq('id', flowId);
    if (error) { showToast(error.message, 'error'); return { success: false }; }
    showToast('Flow deleted');
    return { success: true };
  },

  async toggleFlow(flowId, isActive) {
    const { error } = await supabase.from('flows').update({ is_active: isActive }).eq('id', flowId);
    if (error) { showToast(error.message, 'error'); return { success: false }; }
    showToast(isActive ? 'Flow enabled' : 'Flow disabled');
    return { success: true };
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  if (window.location.pathname.includes('flows')) {
    await requireAuth();
    initFlowsPage();
  }
});

function initFlowsPage() { loadFlows(); initFlowModal(); }

async function loadFlows() {
  const { success, data } = await flows.getFlows();
  const container = document.getElementById('flowsTable');
  if (!container) return;

  if (success && data?.length) {
    container.innerHTML = data.map(flow => `
      <tr>
        <td><strong>${flow.name}</strong></td>
        <td><span class="badge badge-purple">${flow.trigger_type}</span></td>
        <td>${(flow.trigger_keywords || []).map(k => `<span class="chip">${k}</span>`).join(' ') || '—'}</td>
        <td><span class="badge ${flow.is_active ? 'badge-success' : 'badge-warning'}">${flow.is_active ? 'Active' : 'Off'}</span></td>
        <td>
          <button class="btn btn-secondary" onclick="openFlowModal('${flow.id}')">Edit</button>
          <button class="btn btn-secondary" onclick="flows.toggleFlow('${flow.id}', ${!flow.is_active})">Toggle</button>
          <button class="btn btn-danger" onclick="deleteFlow('${flow.id}')">Delete</button>
        </td>
      </tr>`).join('');
  } else {
    container.innerHTML = `<tr><td colspan="5"><div class="empty-state"><button class="btn btn-primary" onclick="openFlowModal()">Create first flow</button></div></td></tr>`;
  }
}

function initFlowModal() {
  const modal = document.getElementById('flowModal');
  const form = document.getElementById('flowForm');
  let keywords = [];

  document.getElementById('keywords')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      e.preventDefault();
      keywords.push(e.target.value.trim());
      e.target.value = '';
      document.getElementById('keywordsChips').innerHTML = keywords.map((k, i) =>
        `<span class="chip">${k} <span onclick="keywords.splice(${i},1);this.parentElement.parentElement.innerHTML=keywords.map((kw,j)=>'<span class=chip>'+kw+'</span>').join('')">×</span></span>`
      ).join('');
    }
  });

  document.getElementById('closeFlowModal')?.addEventListener('click', () => modal?.classList.add('hidden'));

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const flowId = form.dataset.flowId;
    const flowData = {
      name: document.getElementById('flowName').value,
      trigger_type: document.getElementById('triggerType').value,
      trigger_keywords: keywords.length ? keywords : [document.getElementById('flowName').value],
      trigger_condition: document.getElementById('triggerCondition')?.value || 'contains',
      response_type: document.getElementById('responseType')?.value || 'text',
      response_message: document.getElementById('responseMessage').value,
      ai_enabled: document.getElementById('responseType')?.value === 'ai',
      is_active: true
    };
    const btn = e.target.querySelector('button[type="submit"]');
    showLoading(btn);
    if (flowId) await flows.updateFlow(flowId, flowData);
    else await flows.createFlow(flowData);
    hideLoading(btn, 'Save Flow');
    modal?.classList.add('hidden');
    loadFlows();
  });
}

window.openFlowModal = async (flowId = null) => {
  const modal = document.getElementById('flowModal');
  const form = document.getElementById('flowForm');
  if (flowId) {
    const { data } = await flows.getFlows();
    const flow = data?.find(f => f.id === flowId);
    if (flow) {
      form.dataset.flowId = flowId;
      document.getElementById('flowName').value = flow.name;
      document.getElementById('triggerType').value = flow.trigger_type;
      document.getElementById('responseMessage').value = flow.response_message || '';
    }
  } else {
    form.dataset.flowId = '';
    form.reset();
  }
  modal?.classList.remove('hidden');
};

window.deleteFlow = async (id) => {
  if (confirm('Delete this flow?')) { await flows.deleteFlow(id); loadFlows(); }
};
