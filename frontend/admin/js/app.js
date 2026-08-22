/* ════════════════════════════════════════════════════════
   Plant Book Admin — app.js (Core Application Router & Globals)
   ════════════════════════════════════════════════════════ */
var API = '/api';
var token = localStorage.getItem('pb_token') || '';
var currentUser = null;
var editingPlantId = null;
var editingSchemaId = null;
var schemaFields = [];
var schemasCache = [];

// Dashboard state variables
var dashboardMap = null;
var dashboardMarkers = [];
var allFarms = [];
var allPlants = [];
var allRecentLogs = [];
var currentDashboardFilter = 'all';

/**
 * Common REST API helper
 */
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(opts.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      if (typeof logout === 'function') logout();
    }
    throw new Error(data.error || `Lỗi HTTP ${res.status}`);
  }
  return data;
}

/**
 * Toast Notification Helper
 */
function toast(msg, type = 'success') {
  const toastEl = document.getElementById('toast');
  const iconEl = document.getElementById('toast-icon');
  const msgEl = document.getElementById('toast-msg');

  if (!toastEl || !msgEl) {
    console.log(`[TOAST ${type.toUpperCase()}] ${msg}`);
    return;
  }

  if (iconEl) {
    iconEl.innerHTML = type === 'success'
      ? '<i class="fa-solid fa-circle-check" style="color:#4ade80"></i>'
      : (type === 'error' ? '<i class="fa-solid fa-circle-xmark" style="color:#f87171"></i>' : '<i class="fa-solid fa-circle-info" style="color:#60a5fa"></i>');
  }
  msgEl.textContent = msg;
  toastEl.style.display = 'block';
  setTimeout(() => { toastEl.style.display = 'none'; }, 3500);
}

/**
 * HTML Escaper
 */
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * Date Formatter
 */
function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch(e) {
    return String(d);
  }
}

// ── Main Page Switcher & URL Router ─────────────────────────────

const adminPageRouteMap = {
  dashboard: '/admin/dashboard',
  database: '/admin/database',
  'db-check': '/admin/database-check',
  gis: '/admin/farms',
  plants: '/admin/plants',
  cost: '/admin/costs',
  devices: '/admin/iot-devices',
  users: '/admin/users',
  schemas: '/admin/crop-schemas',
  media: '/admin/media'
};

const adminRoutePageMap = {
  '/admin': 'dashboard',
  '/admin/': 'dashboard',
  '/admin/dashboard': 'dashboard',
  '/admin/database': 'database',
  '/admin/database-check': 'db-check',
  '/admin/db-check': 'db-check',
  '/admin/farms': 'gis',
  '/admin/gis': 'gis',
  '/admin/plants': 'plants',
  '/admin/costs': 'cost',
  '/admin/cost': 'cost',
  '/admin/iot-devices': 'devices',
  '/admin/devices': 'devices',
  '/admin/users': 'users',
  '/admin/crop-schemas': 'schemas',
  '/admin/schemas': 'schemas',
  '/admin/media': 'media'
};

function showPage(page, pushUrl = true) {
  const targetSection = document.getElementById(`page-${page}`);
  if (!targetSection) {
    console.warn(`Page section #page-${page} not found.`);
    return;
  }

  // Remove active state from all page sections and nav items
  document.querySelectorAll('.page-section, .page-content').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target section
  targetSection.classList.add('active');
  targetSection.style.display = 'block';

  // Highlight active sidebar menu item safely
  const navItem = document.querySelector(`.nav-item[onclick*="'${page}'"]`);
  if (navItem) navItem.classList.add('active');

  // Push URL to browser address bar for professional standards
  if (pushUrl && window.history && window.history.pushState) {
    const targetUrl = adminPageRouteMap[page] || `/admin/${page}`;
    if (window.location.pathname !== targetUrl) {
      window.history.pushState({ page }, '', targetUrl);
    }
  }

  const titles = { 
    dashboard: 'Dashboard Overview', 
    database: 'Cơ sở dữ liệu & Nhật ký Canh tác',
    'db-check': 'Kiểm tra CSDL Schema & Quản trị Dữ liệu',
    plants: 'Danh sách cây trồng', 
    schemas: 'Cấu hình loại cây', 
    media: 'Thư viện Media', 
    gis: 'Quản lý GIS Trang trại', 
    users: 'Quản lý Nông hộ & Người dùng',
    devices: 'Quản lý thiết bị IoT',
    cost: 'Quản trị Chi phí Đầu tư'
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[page] || page;

  // Auto-close mobile sidebar if open
  const sidebar = document.querySelector('.sidebar');
  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  // Safe execution of page loaders
  try {
    if (page === 'dashboard' && typeof loadDashboard === 'function') loadDashboard();
    if (page === 'database' && typeof initDatabasePage === 'function') initDatabasePage();
    if (page === 'db-check' && typeof loadDbSchemaCheck === 'function') loadDbSchemaCheck();
    if (page === 'plants') {
      if (typeof initPlantFilters === 'function') {
        initPlantFilters().then(() => { if (typeof loadPlants === 'function') loadPlants(); });
      } else if (typeof loadPlants === 'function') {
        loadPlants();
      }
    }
    if (page === 'schemas') {
      if (typeof loadSchemas === 'function') loadSchemas();
      if (typeof loadCareConfigs === 'function') loadCareConfigs();
    }
    if (page === 'gis' && typeof initGisPage === 'function') initGisPage();
    if (page === 'users' && typeof loadUsers === 'function') loadUsers();
    if (page === 'devices' && typeof loadDevices === 'function') loadDevices();
    if (page === 'media' && typeof initGlobalMediaLibrary === 'function') initGlobalMediaLibrary();
    if (page === 'cost' && typeof initCostPage === 'function') initCostPage();
  } catch (err) {
    console.error(`Error loading page [${page}]:`, err);
  }
}

function handleAdminUrlRouting() {
  const rawPath = window.location.pathname.replace(/\/$/, '') || '/admin';
  const matchedPage = adminRoutePageMap[rawPath] || 'dashboard';
  showPage(matchedPage, false);
}

window.addEventListener('popstate', (e) => {
  if (e.state && e.state.page) {
    showPage(e.state.page, false);
  } else {
    handleAdminUrlRouting();
  }
});

window.handleAdminUrlRouting = handleAdminUrlRouting;

function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (!sidebar) return;
  sidebar.classList.toggle('open');
  if (sidebar.classList.contains('open')) {
    if (overlay) overlay.style.display = 'block';
  } else {
    if (overlay) overlay.style.display = 'none';
  }
}

function switchTab(el, tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  const pane = document.getElementById(tabId);
  if (pane) pane.classList.add('active');

  if (tabId === 'tab-extra' && typeof renderExtraFields === 'function') renderExtraFields();
  if (tabId === 'tab-media' && editingPlantId && typeof loadPlantMedia === 'function') loadPlantMedia(editingPlantId);
  if (tabId === 'tab-logs' && editingPlantId && typeof loadPlantLogs === 'function') loadPlantLogs(editingPlantId);
}

// ── Configuration tabs & care options ──────────────────────

function switchConfigTab(tab) {
  document.getElementById('config-tab-schema')?.classList.toggle('active', tab === 'schema');
  document.getElementById('config-tab-care')?.classList.toggle('active', tab === 'care');
  const paneSchema = document.getElementById('pane-config-schema');
  const paneCare = document.getElementById('pane-config-care');
  if (paneSchema) paneSchema.style.display = tab === 'schema' ? 'block' : 'none';
  if (paneCare) paneCare.style.display = tab === 'care' ? 'block' : 'none';
}

async function loadCareConfigs() {
  try {
    const configs = await api('/config');
    const wEl = document.getElementById('cfg-water-methods');
    const fEl = document.getElementById('cfg-fertilizers');
    const pEl = document.getElementById('cfg-pesticides');
    const lEl = document.getElementById('cfg-leaf-reasons');
    const flEl = document.getElementById('cfg-flower-reasons');

    if (wEl) wEl.value = (configs.water_methods || []).join('\n');
    if (fEl) fEl.value = (configs.fertilizers || []).join('\n');
    if (pEl) pEl.value = (configs.pesticides || []).join('\n');
    if (lEl) lEl.value = (configs.leaf_cut_reasons || []).join('\n');
    if (flEl) flEl.value = (configs.flower_prune_reasons || []).join('\n');
  } catch (err) {
    toast('Lỗi tải cấu hình quy trình: ' + err.message, 'error');
  }
}

async function saveCareConfigs() {
  const btn = document.getElementById('save-care-cfg-btn');
  if (!btn) return;
  const oldText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Đang lưu...';
  btn.disabled = true;

  const parseTextarea = (id) => {
    const el = document.getElementById(id);
    if (!el) return [];
    return el.value.split('\n').map(x => x.trim()).filter(x => x.length > 0);
  };

  const body = {
    water_methods: parseTextarea('cfg-water-methods'),
    fertilizers: parseTextarea('cfg-fertilizers'),
    pesticides: parseTextarea('cfg-pesticides'),
    leaf_cut_reasons: parseTextarea('cfg-leaf-reasons'),
    flower_prune_reasons: parseTextarea('cfg-flower-reasons')
  };

  try {
    await api('/config', {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    toast('Lưu cấu hình quy trình thành công!');
  } catch (err) {
    toast('Lỗi lưu cấu hình: ' + err.message, 'error');
  } finally {
    btn.innerHTML = oldText;
    btn.disabled = false;
  }
}

window.api = api;
window.toast = toast;
window.esc = esc;
window.fmtDate = fmtDate;
window.showPage = showPage;
