/* ════════════════════════════════════════════════════════
   Plant Book Admin — app.js (Core Application Router & Globals)
   ════════════════════════════════════════════════════════ */
// Passive Event Listeners Patch for 60fps smooth scrolling
(function() {
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (['touchstart', 'touchmove', 'wheel', 'mousewheel'].includes(type)) {
      if (typeof options === 'boolean') {
        options = { capture: options, passive: true };
      } else if (typeof options === 'object' && options !== null && options.passive === undefined) {
        options = Object.assign({}, options, { passive: true });
      } else if (options === undefined) {
        options = { passive: true };
      }
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
})();

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

function generateIsoPublicId(role, numId) {
  const prefix = role === 'admin' ? 'adm' : 'usr';
  const id = parseInt(numId) || 0;
  const val = Math.abs(((id * 1664525 + 1013904223) ^ 0x5B9A4C21) % 90000000) + 10000000;
  return `${prefix}-${val}`;
}

function getAdminPublicId() {
  if (currentUser && currentUser.public_id) return currentUser.public_id;
  if (currentUser && currentUser.id) return generateIsoPublicId(currentUser.role || 'admin', currentUser.id);
  return 'adm-84729104';
}

const adminPageRouteMap = {
  dashboard: 'dashboard',
  database: 'database',
  'db-check': 'database-check',
  gis: 'farms',
  plants: 'plants',
  cost: 'costs',
  devices: 'iot-devices',
  users: 'users',
  schemas: 'crop-schemas',
  media: 'media'
};

const adminRoutePageMap = {
  '': 'dashboard',
  'dashboard': 'dashboard',
  'database': 'database',
  'database-check': 'db-check',
  'db-check': 'db-check',
  'farms': 'gis',
  'gis': 'gis',
  'plants': 'plants',
  'costs': 'cost',
  'cost': 'cost',
  'iot-devices': 'devices',
  'devices': 'devices',
  'users': 'users',
  'crop-schemas': 'schemas',
  'schemas': 'schemas',
  'media': 'media'
};

function getAdminPageUrl(page) {
  const publicId = getAdminPublicId();
  const routeSlug = adminPageRouteMap[page] || page;
  return `/${publicId}/${routeSlug}`;
}

function parseAdminPageFromPath(pathname) {
  const cleanPath = (pathname || '').replace(/^\/+|\/+$/g, '');
  if (!cleanPath) return 'dashboard';
  
  const parts = cleanPath.split('/');
  if (parts[0] === 'admin') parts.shift();
  if (parts[0] && parts[0].startsWith('adm-')) parts.shift();

  const routeSlug = parts[0] || 'dashboard';
  return adminRoutePageMap[routeSlug] || 'dashboard';
}

/**
 * Synchronize deep URL parameters: page, sub-tabs, hidden detail views, and pop-up modals
 */
function syncAdminUrl(params = {}) {
  if (!window.history || !window.history.pushState) return;

  const publicId = getAdminPublicId();
  const matchedPage = params.page || parseAdminPageFromPath(window.location.pathname);
  const routeSlug = adminPageRouteMap[matchedPage] || matchedPage;

  const currentSearch = new URLSearchParams(window.location.search);
  
  if ('tab' in params) {
    if (params.tab) currentSearch.set('tab', params.tab);
    else currentSearch.delete('tab');
  }
  if ('view' in params) {
    if (params.view) currentSearch.set('view', params.view);
    else currentSearch.delete('view');
  }
  if ('farm' in params) {
    if (params.farm) currentSearch.set('farm', params.farm);
    else currentSearch.delete('farm');
  }
  if ('table' in params) {
    if (params.table) currentSearch.set('table', params.table);
    else currentSearch.delete('table');
  }
  if ('modal' in params) {
    if (params.modal) currentSearch.set('modal', params.modal);
    else currentSearch.delete('modal');
  }
  if ('id' in params) {
    if (params.id) currentSearch.set('id', params.id);
    else currentSearch.delete('id');
  }

  const queryString = currentSearch.toString();
  const basePath = `/${publicId}/${routeSlug}`;
  const finalUrl = queryString ? `${basePath}?${queryString}` : basePath;

  if (window.location.pathname + window.location.search !== finalUrl) {
    if (params.replace) {
      window.history.replaceState({ page: matchedPage }, '', finalUrl);
    } else {
      window.history.pushState({ page: matchedPage }, '', finalUrl);
    }
  }
}
window.syncAdminUrl = syncAdminUrl;

function showPage(page, pushUrl = true) {
  if (page === 'gis' || page === 'farms') {
    page = 'dashboard';
  } else if (page === 'plants') {
    page = 'database';
    if (typeof switchDatabaseTab === 'function') {
      setTimeout(() => switchDatabaseTab('cultivation'), 50);
    }
  }

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
  if (pushUrl) {
    syncAdminUrl({ page, tab: null, farm: null, table: null, modal: null, id: null });
  }

  const titles = { 
    dashboard: 'Dashboard & Không Gian GIS Trang Trại', 
    database: 'Cơ sở dữ liệu & Nhật ký Canh tác',
    'db-check': 'Kiểm tra CSDL Schema & Quản trị Dữ liệu',
    plants: 'Danh sách cây trồng', 
    schemas: 'Cấu hình loại cây', 
    media: 'Thư viện Media', 
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
    if (page === 'cost') {
      showPage('database');
      setTimeout(() => {
        if (typeof switchDatabaseTab === 'function') switchDatabaseTab('supplies');
        if (typeof setSupplyGroupMode === 'function') setSupplyGroupMode('chart');
      }, 50);
      return;
    }
  } catch (err) {
    console.error(`Error loading page [${page}]:`, err);
  }

  // Trigger universal smooth count-up animation on all numbers
  setTimeout(() => {
    if (typeof triggerAdminPageCountUpAnimations === 'function') {
      triggerAdminPageCountUpAnimations(page);
    }
  }, 300);
}

function handleAdminUrlRouting() {
  const matchedPage = parseAdminPageFromPath(window.location.pathname);
  showPage(matchedPage, false);

  const searchParams = new URLSearchParams(window.location.search);
  const tab = searchParams.get('tab');
  const farm = searchParams.get('farm');
  const table = searchParams.get('table');
  const modal = searchParams.get('modal');
  const id = searchParams.get('id');

  // Update base path if needed
  syncAdminUrl({ page: matchedPage, replace: true });

  // 1. Sub-tab routing
  if (tab) {
    if (matchedPage === 'database' && typeof window.switchDatabaseTab === 'function') {
      window.switchDatabaseTab(tab, false);
    }
    if (matchedPage === 'cost' && typeof window.switchCostTab === 'function') {
      window.switchCostTab(tab, false);
    }
  }

  // 2. Hidden / Detail View routing
  if (matchedPage === 'gis' && farm && typeof window.selectFarm === 'function') {
    setTimeout(() => { window.selectFarm(parseInt(farm), false); }, 300);
  }
  if (matchedPage === 'db-check' && table && typeof window.viewTableRecords === 'function') {
    setTimeout(() => { window.viewTableRecords(table, false); }, 300);
  }

  // 3. Pop-up Modal routing
  if (modal) {
    setTimeout(() => {
      if (modal === 'plant' && typeof window.openPlantModal === 'function') {
        window.openPlantModal(id ? parseInt(id) : null, false);
      } else if (modal === 'user' && typeof window.openUserModal === 'function') {
        window.openUserModal(id ? parseInt(id) : null, false);
      } else if (modal === 'user-tier' && typeof window.openUserTierModal === 'function') {
        window.openUserTierModal(id ? parseInt(id) : null, false);
      } else if (modal === 'schema' && typeof window.openSchemaModal === 'function') {
        window.openSchemaModal(id ? parseInt(id) : null, false);
      }
    }, 400);
  }
}

window.addEventListener('popstate', (e) => {
  handleAdminUrlRouting();
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

// Initialize 3D Animated Chibi Mascot Assistant for Admin Portal
document.addEventListener('DOMContentLoaded', () => {
  try {
    if (typeof initAdminChibiMascot === 'function') {
      initAdminChibiMascot();
    }
  } catch (err) {
    console.warn('[Admin] Chibi Mascot init warning:', err);
  }
});

// Immediate execution fallback
try {
  if (typeof initAdminChibiMascot === 'function') {
    initAdminChibiMascot();
  }
} catch (_) {}
