// Supabase client — load AFTER @supabase/supabase-js CDN
const SUPABASE_URL =
  typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.supabaseUrl : 'https://ssuqvxfgraphgcnybxcj.supabase.co';
const SUPABASE_ANON_KEY =
  typeof APP_CONFIG !== 'undefined'
    ? APP_CONFIG.supabaseAnonKey
    : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdXF2eGZncmFwaGdjbnlieGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTM1NjEsImV4cCI6MjA5NDc2OTU2MX0.90N1IDt5QUffn2BVixbpCot-fsuvEHsPpusa-ecACOo';

function initSupabaseClient() {
  if (window.supabaseClient?.auth) return window.supabaseClient;

  const lib = window.supabase;
  if (lib && typeof lib.createClient === 'function') {
    window.supabaseClient = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabase = window.supabaseClient;
    return window.supabaseClient;
  }

  console.error('Supabase JS not loaded. Include @supabase/supabase-js before js/supabase.js');
  return null;
}

initSupabaseClient();

if (typeof SocialSyncsClient !== 'undefined' && window.supabaseClient) {
  window.socialSyncs = new SocialSyncsClient(window.supabaseClient);
}

async function isAuthenticated() {
  if (!window.supabaseClient) initSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return true;

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('code')) {
    return new Promise((resolve) => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
          subscription.unsubscribe();
          resolve(true);
        }
      });
      setTimeout(() => {
        subscription.unsubscribe();
        supabase.auth.getSession().then(({ data: { session } }) => resolve(!!session));
      }, 4000);
    });
  }
  return false;
}

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function requireAuth() {
  if (!(await isAuthenticated())) {
    window.location.href = `${window.BASE_URL || window.location.origin}/auth.html`;
    return false;
  }
  return true;
}

async function redirectIfAuth() {
  if (await isAuthenticated()) {
    window.location.href = `${window.BASE_URL || window.location.origin}/dashboard.html`;
    return true;
  }
  return false;
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : '✕'}</span><span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showLoading(element) {
  element.innerHTML = '<div class="loading"></div>';
  element.disabled = true;
}

function hideLoading(element, originalText) {
  element.innerHTML = originalText;
  element.disabled = false;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatNumber(num) {
  return String(num ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
