// public/app.js

/** ------------------------------------------------------------
 *  Supabase client – replace with your project credentials
 *  ------------------------------------------------------------ */
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"; // TODO: set actual URL
const SUPABASE_ANON_KEY = "YOUR-ANON-KEY"; // TODO: set actual anon key
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** ------------------------------------------------------------
 *  UI element references (Apple‑inspired IDs)
 *  ------------------------------------------------------------ */
const userNameEl = document.getElementById("user-name");
const flowsCountEl = document.getElementById("flows-count");
const messagesCountEl = document.getElementById("messages-count");
const contactsCountEl = document.getElementById("contacts-count");
const flowsListEl = document.getElementById("flows-list");
const flowsGridEl = document.getElementById("flows-grid");
const messagesGridEl = document.getElementById("messages-grid");
const reelsGridEl = document.getElementById("reels-grid");
const analyticsCanvas = document.getElementById("analytics-canvas");
const loginBtn = document.getElementById("login-btn");
const themeToggleBtn = document.getElementById("theme-toggle");

/** ------------------------------------------------------------
 *  Theme handling (dark ↔ light)
 *  ------------------------------------------------------------ */
function applyTheme(isDark) {
  if (isDark) {
    document.body.classList.add("dark");
    document.body.classList.remove("light-theme");
    themeToggleBtn.textContent = "Toggle Light";
  } else {
    document.body.classList.remove("dark");
    document.body.classList.add("light-theme");
    themeToggleBtn.textContent = "Toggle Dark";
  }
  localStorage.setItem("darkMode", isDark);
}
let darkMode = localStorage.getItem("darkMode");
if (darkMode === null) darkMode = true; // default to dark per design
applyTheme(darkMode === "true" || darkMode === true);

themeToggleBtn.addEventListener("click", () => {
  darkMode = !darkMode;
  applyTheme(darkMode);
});

/** ------------------------------------------------------------
 *  Navigation – show/hide sections
 *  ------------------------------------------------------------ */
const sections = {
  dashboard: document.getElementById("dashboard"),
  flows: document.getElementById("flows"),
  messages: document.getElementById("messages"),
  reels: document.getElementById("reels"),
  analytics: document.getElementById("analytics"),
};
function showSection(name) {
  Object.entries(sections).forEach(([key, el]) => {
    if (key === name) {
      el.classList.remove("hidden");
      el.classList.add("active");
    } else {
      el.classList.add("hidden");
      el.classList.remove("active");
    }
  });
}
// nav button listeners
document.getElementById("btn-dashboard").addEventListener("click", () => showSection("dashboard"));
document.getElementById("btn-flows").addEventListener("click", () => showSection("flows"));
document.getElementById("btn-messages").addEventListener("click", () => showSection("messages"));
document.getElementById("btn-reels").addEventListener("click", () => showSection("reels"));
document.getElementById("btn-analytics").addEventListener("click", () => showSection("analytics"));

/** ------------------------------------------------------------
 *  Authentication (Supabase auth)
 *  ------------------------------------------------------------ */
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const name = session.user.email.split("@")[0];
    userNameEl.textContent = name;
    loginBtn.textContent = "Logout";
    // load real data after auth
    await loadAllData();
  } else {
    userNameEl.textContent = "Guest";
    loginBtn.textContent = "Log In";
    clearAllData();
  }
}
loginBtn.addEventListener("click", async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.auth.signOut();
    location.reload();
  } else {
    const email = prompt("Enter email");
    const password = prompt("Enter password");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert("Check your inbox for the confirmation link.");
  }
});

/** ------------------------------------------------------------
 *  Data loading helpers – fetch from Supabase tables
 *  ------------------------------------------------------------ */
async function loadFlows() {
  const { data, error } = await supabase.from("flows").select("id, name");
  if (error) return console.error("loadFlows error", error);
  flowsCountEl.textContent = data.length;
  // list view
  flowsListEl.innerHTML = "";
  data.forEach(f => {
    const li = document.createElement("li");
    li.textContent = f.name;
    flowsListEl.appendChild(li);
  });
  // grid view (cards)
  if (flowsGridEl) {
    flowsGridEl.innerHTML = "";
    data.forEach(f => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<h3>${f.name}</h3><p>ID: ${f.id}</p>`;
      flowsGridEl.appendChild(card);
    });
  }
}

async function loadMessages() {
  const { data, error } = await supabase.from("instagram_messages").select("id, message_text, direction, created_at");
  if (error) return console.error("loadMessages error", error);
  messagesCountEl.textContent = data.length;
  if (messagesGridEl) {
    messagesGridEl.innerHTML = "";
    data.forEach(m => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<p>${m.message_text}</p><small>${m.direction} • ${new Date(m.created_at).toLocaleString()}</small>`;
      messagesGridEl.appendChild(card);
    });
  }
}

async function loadReels() {
  const { data, error } = await supabase.from("instagram_reels").select("id, caption, thumbnail_url");
  if (error) return console.error("loadReels error", error);
  if (reelsGridEl) {
    reelsGridEl.innerHTML = "";
    data.forEach(r => {
      const card = document.createElement("div");
      card.className = "card";
      const img = r.thumbnail_url || "https://via.placeholder.com/150";
      card.innerHTML = `<img src="${img}" alt="${r.caption}" style="width:100%;border-radius:8px;"/><p>${r.caption || "Reel"}</p>`;
      reelsGridEl.appendChild(card);
    });
  }
}

async function loadAnalytics() {
  const { data, error } = await supabase.from("instagram_analytics").select("metric, value, date");
  if (error) return console.error("loadAnalytics error", error);
  if (!analyticsCanvas) return;
  const ctx = analyticsCanvas.getContext("2d");
  const groups = {};
  data.forEach(row => {
    if (!groups[row.metric]) groups[row.metric] = [];
    groups[row.metric].push({ x: row.date, y: Number(row.value) });
  });
  const datasets = Object.entries(groups).map(([metric, points]) => ({
    label: metric,
    data: points,
    borderColor: getComputedStyle(document.body).getPropertyValue("--primary"),
    fill: false,
    tension: 0.3,
  }));
  new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

async function loadAllData() {
  await Promise.all([loadFlows(), loadMessages(), loadReels(), loadAnalytics()]);
}

function clearAllData() {
  flowsCountEl.textContent = "0";
  messagesCountEl.textContent = "0";
  contactsCountEl.textContent = "0";
  flowsListEl.innerHTML = "";
  if (flowsGridEl) flowsGridEl.innerHTML = "";
  if (messagesGridEl) messagesGridEl.innerHTML = "";
  if (reelsGridEl) reelsGridEl.innerHTML = "";
  if (analyticsCanvas) analyticsCanvas.getContext("2d").clearRect(0, 0, analyticsCanvas.width, analyticsCanvas.height);
}

/** ------------------------------------------------------------
 *  Initialize
 *  ------------------------------------------------------------ */
checkAuth();

/** ------------------------------------------------------------
 *  Create Flow UI (simple insert)
 *  ------------------------------------------------------------ */
const createFlowBtn = document.getElementById("create-flow");
if (createFlowBtn) {
  createFlowBtn.addEventListener("click", async () => {
    const name = prompt("Flow name:");
    if (!name) return;
    const { error } = await supabase.from("flows").insert({ name, flow_json: {} });
    if (error) alert(error.message);
    else await loadFlows();
  });
}
