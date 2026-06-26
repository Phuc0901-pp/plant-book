/* ════════════════════════════════════════════════════════
   Plant Book Admin — app.js
   ════════════════════════════════════════════════════════ */
const API = '/api';
let token = localStorage.getItem('pb_token') || '';
let currentUser = null;
let editingPlantId = null;
let editingSchemaId = null;
let schemaFields = [];
let schemasCache = [];

// Dashboard state variables
let dashboardMap = null;
let dashboardMarkers = [];
let allFarms = [];
let allPlants = [];
let allRecentLogs = [];
let currentDashboardFilter = 'all';


// ── Pages ─────────────────────────────────────────────────

function showPage(page) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }
  const titles = { dashboard:'Dashboard', plants:'Danh sách cây trồng', schemas:'Cấu hình', media:'Thư viện Media', gis:'Quản lý GIS', users:'Quản lý người dùng' };
  document.getElementById('page-title').textContent = titles[page] || page;

  // Auto-close mobile sidebar
  const sidebar = document.querySelector('.sidebar');
  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  if (page === 'dashboard') loadDashboard();
  if (page === 'plants') {
    initPlantFilters().then(() => loadPlants());
  }
  if (page === 'schemas') {
    loadSchemas();
    loadCareConfigs();
  }
  if (page === 'gis') initGisPage();
  if (page === 'users') loadUsers();
}

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
  el.classList.add('active');
  document.getElementById(tabId).classList.add('active');

  if (tabId === 'tab-extra') renderExtraFields();
  if (tabId === 'tab-media' && editingPlantId) loadPlantMedia(editingPlantId);
  if (tabId === 'tab-logs' && editingPlantId) loadPlantLogs(editingPlantId);
}


// ── Configuration tabs & care options ──────────────────────

function switchConfigTab(tab) {
  document.getElementById('config-tab-schema').classList.toggle('active', tab === 'schema');
  document.getElementById('config-tab-care').classList.toggle('active', tab === 'care');
  document.getElementById('pane-config-schema').style.display = tab === 'schema' ? 'block' : 'none';
  document.getElementById('pane-config-care').style.display = tab === 'care' ? 'block' : 'none';
}

async function loadCareConfigs() {
  try {
    const configs = await api('/config');
    document.getElementById('cfg-water-methods').value = (configs.water_methods || []).join('\n');
    document.getElementById('cfg-fertilizers').value = (configs.fertilizers || []).join('\n');
    document.getElementById('cfg-pesticides').value = (configs.pesticides || []).join('\n');
    document.getElementById('cfg-leaf-reasons').value = (configs.leaf_cut_reasons || []).join('\n');
    document.getElementById('cfg-flower-reasons').value = (configs.flower_prune_reasons || []).join('\n');
  } catch (err) {
    toast('Lỗi tải cấu hình quy trình: ' + err.message, 'error');
  }
}

async function saveCareConfigs() {
  const btn = document.getElementById('save-care-cfg-btn');
  const oldText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Đang lưu...';
  btn.disabled = true;

  const parseTextarea = (id) => {
    return document.getElementById(id).value
      .split('\n')
      .map(x => x.trim())
      .filter(x => x.length > 0);
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

