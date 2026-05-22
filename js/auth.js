// Authentication Functions
function getBaseUrl() {
  return window.BASE_URL || window.location.origin;
}
const auth = {
  // Helper to map complex error responses into clean, user-friendly messages
  mapErrorMessage(error) {
    const msg = error.message || String(error);
    const errCode = error.error_code || error.code || "";

    if (errCode === 'email_provider_disabled' || msg.includes('Email logins are disabled')) {
      return "✉️ Email Logins are currently disabled by the administrator. Please use the Google option below to connect instantly!";
    }
    if (msg.includes('invalid_credentials') || msg.includes('Invalid login credentials')) {
      return "🔒 Invalid email address or password. Please double-check your credentials and try again.";
    }
    if (msg.includes('Email not confirmed')) {
      return "⚠️ Your email address has not been verified yet. Please check your inbox for the confirmation link.";
    }
    if (msg.includes('Password should be')) {
      return "🔑 Password must be at least 6 characters long.";
    }
    if (msg.includes('User already registered')) {
      return "👤 An account with this email address already exists. Try signing in instead!";
    }
    
    return msg;
  },

  async signUp(email, password, fullName) {
    try {
      hideAuthAlert();
      console.log('Attempting sign up with:', email);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          },
          emailRedirectTo: `${getBaseUrl()}/dashboard.html`
        }
      });

      console.log('Sign up response:', { data, error });

      if (error) throw error;

      // If email confirmation is required and session does not exist yet
      if (data.user && !data.session) {
        showToast('Activation email sent!');
        showSignupSuccess(email);
        return { success: true };
      }

      // If email confirmation is disabled and session exists immediately
      if (data.session) {
        showToast('Account created successfully!');
        window.location.href = `${getBaseUrl()}/dashboard.html`;
        return { success: true };
      }

      showAuthAlert('Account created successfully!', 'success');
      return { success: true };
    } catch (error) {
      console.error('Sign up error:', error);
      const friendlyMsg = this.mapErrorMessage(error);
      showAuthAlert(friendlyMsg, 'error');
      showToast(error.message, 'error');
      return { success: false, error: error.message };
    }
  },

  async signIn(email, password) {
    try {
      hideAuthAlert();
      console.log('Attempting sign in with:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      console.log('Sign in response:', { data, error });

      if (error) throw error;
      if (!data.session) {
        showToast('Signed in. Please check your email if confirmation is required.', 'success');
        return { success: true };
      }

      showToast('Signed in successfully!');
      window.location.href = `${getBaseUrl()}/dashboard.html`;
      return { success: true };
    } catch (error) {
      console.error('Sign in error:', error);
      const friendlyMsg = this.mapErrorMessage(error);
      showAuthAlert(friendlyMsg, 'error');
      showToast(error.message, 'error');
      return { success: false, error: error.message };
    }
  },

  async signInWithGoogle() {
    try {
      hideAuthAlert();
      console.log('Attempting Google sign in');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${getBaseUrl()}/dashboard.html`
        }
      });

      console.log('Google OAuth response:', { data, error });

      if (error) throw error;

      if (data.url) {
        window.location.href = data.url;
      }
      return { success: true };
    } catch (error) {
      console.error('Google sign in error:', error);
      const friendlyMsg = this.mapErrorMessage(error);
      showAuthAlert(friendlyMsg, 'error');
      showToast(error.message, 'error');
      return { success: false, error: error.message };
    }
  },

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      showToast('Signed out successfully!');
      window.location.href = `${getBaseUrl()}/index.html`;
      return { success: true };
    } catch (error) {
      showToast(error.message, 'error');
      return { success: false, error: error.message };
    }
  },

  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getBaseUrl()}/auth.html?reset=true`
      });

      if (error) throw error;

      showToast('Password reset email sent!');
      showAuthAlert('Password reset email dispatched. Please check your inbox.', 'success');
      return { success: true };
    } catch (error) {
      const friendlyMsg = this.mapErrorMessage(error);
      showAuthAlert(friendlyMsg, 'error');
      showToast(error.message, 'error');
      return { success: false, error: error.message };
    }
  }
};

// Expose auth globally for inline event handlers
window.auth = auth;

// Beautiful custom signup success visual transition
function showSignupSuccess(email) {
  const authCard = document.getElementById('authCard');
  if (!authCard) return;
  
  authCard.innerHTML = `
    <div class="success-panel" style="text-align: center; padding: 12px 0;">
      <div class="success-icon-wrapper">
        <div class="success-checkmark">✓</div>
      </div>
      <h2 class="auth-title" style="margin-top: 24px; margin-bottom: 12px; background: linear-gradient(135deg, #FFFFFF, #94A3B8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Check Your Inbox!</h2>
      <p class="auth-subtitle" style="margin-bottom: 32px; line-height: 1.7; font-size: 14px; color: var(--text-secondary);">
        We have dispatched a secure confirmation link to <br>
        <span style="color: #fff; font-weight: 600; text-decoration: underline;">${email}</span>.<br><br>
        Click the link in the email to instantly activate your account and start automating!
      </p>
      <div style="border-top: 1px solid var(--border-glass); padding-top: 24px; width: 100%;">
        <button onclick="window.location.reload()" class="btn btn-secondary btn-full" style="height: 48px; border-radius: 10px; font-size: 14.5px; width: 100%; border: 1px solid var(--border-glass); background: rgba(255,255,255,0.05); color: #fff;">
          <span>Back to Sign In</span>
        </button>
      </div>
    </div>
  `;
}

// Inline Alert Display Box Controllers
function showAuthAlert(message, type = 'error') {
  const alertContainer = document.getElementById('authAlert');
  const alertMsg = document.getElementById('authAlertMsg');
  if (!alertContainer || !alertMsg) return;

  alertMsg.textContent = message;
  
  if (type === 'success') {
    alertContainer.className = 'auth-alert success';
    alertContainer.querySelector('.alert-icon').textContent = '✓';
  } else {
    alertContainer.className = 'auth-alert';
    alertContainer.querySelector('.alert-icon').textContent = '✕';
  }
  
  alertContainer.classList.remove('hidden');
}

function hideAuthAlert() {
  const alertContainer = document.getElementById('authAlert');
  if (alertContainer) {
    alertContainer.classList.add('hidden');
  }
}

// Dynamic sidebar navigation injector
async function renderSidebar() {
  const sidebarNav = document.querySelector('.sidebar-nav');
  if (!sidebarNav) return;

  const currentPath = window.location.pathname;
  const currentFile = currentPath.split('/').pop() || 'dashboard.html';
  const normalize = (f) => f.replace(/\.html$/, '');
  const normalizedCurrent = normalize(currentFile);

  const navItems = [
    {
      href: 'dashboard.html',
      label: 'Dashboard',
      icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>`
    },
    {
      href: 'connect.html',
      label: 'Connect Instagram',
      icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>`
    },
    {
      href: 'reels.html',
      label: 'Reels Operator',
      icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>`
    },
    {
      href: 'flows.html',
      label: 'Flows',
      icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>`
    },
    {
      href: 'inbox.html',
      label: 'Inbox',
      icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>`
    },
    {
      href: 'campaigns.html',
      label: 'Campaigns',
      icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path></svg>`
    },
    {
      href: 'templates.html',
      label: 'Templates',
      icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`
    },
    {
      href: 'analytics.html',
      label: 'Analytics',
      icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>`
    },
    {
      href: 'analysis.html',
      label: 'AI Audit',
      icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>`
    },
    {
      href: 'settings.html',
      label: 'Settings',
      icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
    },
    {
      href: 'myaccount.html',
      label: 'My Account',
      icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A9 9 0 1118.879 6.196 9 9 0 015.121 17.804z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-5.656 0 3 3 0 015.656 0z"/></svg>`
    },
    {
      href: 'youtube.html',
      label: 'YouTube Automator',
      icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 15l5-3-5-3v6z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
    },
    {
        href: 'comments.html',
        label: 'Comments',
        icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v8a2 2 0 01-2 2h-2M7 8H5a2 2 0 00-2 2v8a2 2 0 002 2h2m5-12v12"/></svg>`
      }
  ];

  const itemsHtml = navItems.map(item => {
    const isActive = normalize(item.href) === normalizedCurrent;
    return `
      <a href="${item.href}" class="sidebar-nav-item ${isActive ? 'active' : ''}">
        ${item.icon}
        <span>${item.label}</span>
      </a>
    `;
  }).join('');

  sidebarNav.innerHTML = itemsHtml;
}

// Auth page initialization
document.addEventListener('DOMContentLoaded', async () => {
  const authCard = document.getElementById('authCard');
  if (authCard) {
    try {
      await redirectIfAuth();
    } catch (e) {
      console.warn('redirectIfAuth failed:', e);
    }
    initAuthPage();
  } else {
    await renderSidebar();
  }
});

function initAuthPage() {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const loginTab = document.getElementById('loginTab');
  const signupTab = document.getElementById('signupTab');
  const googleBtn = document.getElementById('googleBtn');

  // Clear alerts when switching inputs
  const inputs = document.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      hideAuthAlert();
    });
  });

  // Password dynamic criteria checks
  const signupPassword = document.getElementById('signupPassword');
  const criteriaLength = document.getElementById('criteriaLength');
  const criteriaNumber = document.getElementById('criteriaNumber');
  
  signupPassword?.addEventListener('input', () => {
    const val = signupPassword.value;
    
    // Check 6+ chars
    if (val.length >= 6) {
      criteriaLength.classList.add('met');
      criteriaLength.querySelector('.status-icon').textContent = '✅';
    } else {
      criteriaLength.classList.remove('met');
      criteriaLength.querySelector('.status-icon').textContent = '❌';
    }
    
    // Check number or special char
    const hasNumOrSpecial = /[\d!@#$%^&*(),.?":{}|<>]/.test(val);
    if (hasNumOrSpecial) {
      criteriaNumber.classList.add('met');
      criteriaNumber.querySelector('.status-icon').textContent = '✅';
    } else {
      criteriaNumber.classList.remove('met');
      criteriaNumber.querySelector('.status-icon').textContent = '❌';
    }
  });

  // Robust tab switching helper (exposed for testing)
  function switchAuthTab(tab) {
    hideAuthAlert();
    if (tab === 'signup') {
      signupForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
      signupTab?.classList.add('active');
      loginTab?.classList.remove('active');
    } else {
      loginForm.classList.remove('hidden');
      signupForm.classList.add('hidden');
      loginTab?.classList.add('active');
      signupTab?.classList.remove('active');
    }
  }

  // Expose for debugging / external control
  window.switchAuthTab = switchAuthTab;

  // Attach click handlers using the robust helper
  loginTab?.addEventListener('click', (e) => { e.preventDefault(); switchAuthTab('login'); });
  signupTab?.addEventListener('click', (e) => { e.preventDefault(); switchAuthTab('signup'); });

  // Support opening signup via URL param: ?signup=1 or #signup
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('signup') === '1' || window.location.hash === '#signup') {
      switchAuthTab('signup');
    }
  } catch (e) {
    // ignore
  }

  // Toggle Password Visibility Eye-Buttons
  const toggleButtons = document.querySelectorAll('.password-toggle');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const input = btn.previousElementSibling;
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
      } else {
        input.type = 'password';
        btn.textContent = '👁️';
      }
    });
  });

  // Login form submission
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAuthAlert();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const btn = e.target.querySelector('button[type="submit"]');
    
    showLoading(btn);
    await auth.signIn(email, password);
    hideLoading(btn, '<span>Sign In</span><span class="btn-arrow">→</span>');
  });

  // Signup form submission
  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAuthAlert();
    
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const fullName = document.getElementById('signupFullName').value;
    const btn = e.target.querySelector('button[type="submit"]');
    
    showLoading(btn);
    await auth.signUp(email, password, fullName);
    hideLoading(btn, '<span>Create Account</span><span class="btn-arrow">→</span>');
  });

  // Google sign in button click
  googleBtn?.addEventListener('click', () => {
    auth.signInWithGoogle();
  });

  // Direct/Demo login button click
  const directLoginBtn = document.getElementById('directLoginBtn');
  directLoginBtn?.addEventListener('click', async () => {
    hideAuthAlert();
    showLoading(directLoginBtn);
    await auth.signIn('admin@loki.com', 'admin123456');
    hideLoading(directLoginBtn, '<span>⚡ Demo Login</span>');
  });

  // Loki auto-setup removed — no client-side handler needed

  // Reset password handler
  const resetLink = document.getElementById('resetPassword');
  resetLink?.addEventListener('click', async (e) => {
    e.preventDefault();
    hideAuthAlert();
    
    const email = prompt('Please enter your registered email address:');
    if (email) {
      await auth.resetPassword(email.trim());
    }
  });
}

// Expose supabase helper wrappers for debugging and external access
try {
  window.supabaseFunctions = {
    signUp: async (email, password, fullName) => await auth.signUp(email, password, fullName),
    signIn: async (email, password) => await auth.signIn(email, password),
    signOut: async () => await auth.signOut(),
    resetPassword: async (email) => await auth.resetPassword(email),
    getUser: async () => (window.supabase ? (await window.supabase.auth.getUser()).data.user : null),
    getSession: async () => (window.supabase ? (await window.supabase.auth.getSession()).data.session : null),
    rpc: async (fn, params) => (window.supabase ? await window.supabase.rpc(fn, params) : null),
    callFunction: async (name, opts) => (window.supabase && window.fetch ? await fetch((window.APP_CONFIG && window.APP_CONFIG.webhookUrl) || name, opts) : null)
  };
} catch (e) {
  console.warn('Could not expose supabaseFunctions', e);
}
