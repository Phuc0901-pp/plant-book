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

// ── Helpers & Translation ───────────────────────────────

const CROP_TRANSLATIONS = {
  // Trái cây / Fruits
  "sầu riêng": "durian",
  "cà phê": "coffee",
  "ca cao": "cacao",
  "bơ": "avocado",
  "mít": "jackfruit",
  "điều": "cashew",
  "cao su": "rubber",
  "lúa nước": "rice",
  "lúa": "rice",
  "khoai tây": "potato",
  "khoai lang": "sweet potato",
  "ngô": "corn",
  "bắp": "corn",
  "tiêu": "pepper",
  "hồ tiêu": "pepper",
  "chè": "tea",
  "trà": "tea",
  "cam": "orange",
  "quýt": "mandarin",
  "bưởi": "pomelo",
  "chanh": "lemon",
  "xoài": "mango",
  "chuối": "banana",
  "nhãn": "longan",
  "vải": "lychee",
  "vải thiều": "lychee",
  "chôm chôm": "rambutan",
  "măng cụt": "mangosteen",
  "dừa": "coconut",
  "thanh long": "dragonfruit",
  "đu đủ": "papaya",
  "dứa": "pineapple",
  "thơm": "pineapple",
  "khóm": "pineapple",
  "ổi": "guava",
  "mận": "plum",
  "đào": "peach",
  "na": "custard apple",
  "mãng cầu": "custard apple",
  "mãng cầu xiêm": "soursop",
  "hồng": "persimmon",
  "táo": "apple",
  "nho": "grape",
  "dâu tây": "strawberry",
  "dưa hấu": "watermelon",
  "dưa lưới": "cantaloupe",
  "ớt": "chili",
  "tỏi": "garlic",
  "hành": "onion",
  "hành tây": "onion",
  "hành lá": "scallion",
  "gừng": "ginger",
  "nghệ": "turmeric",
  "sả": "lemongrass",
  "sen": "lotus",
  "khoai mì": "cassava",
  "sắn": "cassava",
  "mắc ca": "macadamia",
  "macca": "macadamia",
  "hạt điều": "cashew",
  "muống": "water spinach",
  "rau muống": "water spinach",
  "cải": "cabbage",
  "rau cải": "cabbage",
  "xà lách": "lettuce",
  "rau xà lách": "lettuce",
  "cà chua": "tomato",
  "cà tím": "eggplant",
  "dưa leo": "cucumber",
  "dưa chuột": "cucumber",
  "đậu": "bean",
  "đậu nành": "soybean",
  "đậu tương": "soybean",
  "đậu phộng": "peanut",
  "lạc": "peanut",
  "mướp": "luffa",
  "bầu": "gourd",
  "bí": "squash",
  "bí đỏ": "pumpkin",
  "bí ngô": "pumpkin",
  "khổ qua": "bitter melon",
  "mướp đắng": "bitter melon",

  // Không dấu / Diacritic-free
  "sau rieng": "durian",
  "ca phe": "coffee",
  "ca-phe": "coffee",
  "ca phay": "coffee",
  "ca cao": "cacao",
  "bo": "avocado",
  "mit": "jackfruit",
  "dieu": "cashew",
  "cao su": "rubber",
  "lua": "rice",
  "lua nuoc": "rice",
  "khoai tay": "potato",
  "khoai lang": "sweet potato",
  "ngo": "corn",
  "bap": "corn",
  "tieu": "pepper",
  "ho tieu": "pepper",
  "che": "tea",
  "tra": "tea",
  "cam": "orange",
  "quyt": "mandarin",
  "buoi": "pomelo",
  "chanh": "lemon",
  "xoai": "mango",
  "chuoi": "banana",
  "nhan": "longan",
  "vai": "lychee",
  "vai thieu": "lychee",
  "chom chom": "rambutan",
  "mang cut": "mangosteen",
  "dua": "coconut",
  "thanh long": "dragonfruit",
  "du du": "papaya",
  "dua": "pineapple",
  "thom": "pineapple",
  "khom": "pineapple",
  "oi": "guava",
  "man": "plum",
  "dao": "peach",
  "na": "custard apple",
  "mang cau": "custard apple",
  "mang cau xiem": "soursop",
  "hong": "persimmon",
  "tao": "apple",
  "nho": "grape",
  "dau tay": "strawberry",
  "dua hau": "watermelon",
  "dua luoi": "cantaloupe",
  "ot": "chili",
  "toi": "garlic",
  "hanh": "onion",
  "hanh tay": "onion",
  "hanh la": "scallion",
  "gung": "ginger",
  "nghe": "turmeric",
  "sa": "lemongrass",
  "sen": "lotus",
  "khoai mi": "cassava",
  "san": "cassava",
  "mac ca": "macadamia",
  "macca": "macadamia",
  "hat dieu": "cashew",
  "muong": "water spinach",
  "rau muong": "water spinach",
  "cai": "cabbage",
  "rau cai": "cabbage",
  "xa lach": "lettuce",
  "rau xa lach": "lettuce",
  "ca chua": "tomato",
  "ca tim": "eggplant",
  "dua leo": "cucumber",
  "dua chuot": "cucumber",
  "dau": "bean",
  "dau nanh": "soybean",
  "dau tuong": "soybean",
  "dau phong": "peanut",
  "lac": "peanut",
  "muop": "luffa",
  "bau": "gourd",
  "bi": "squash",
  "bi do": "pumpkin",
  "bi ngo": "pumpkin",
  "kho qua": "bitter melon",
  "muop dang": "bitter melon"
};

function removeDiacritics(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d");
}

async function translateCropName(viName) {
  const cleanVi = viName.trim().toLowerCase();
  if (!cleanVi) return "";
  
  // 1. Check direct match in dictionary
  if (CROP_TRANSLATIONS[cleanVi]) {
    return CROP_TRANSLATIONS[cleanVi];
  }
  
  // 2. Check normalized match (no diacritics)
  const normVi = removeDiacritics(cleanVi);
  if (CROP_TRANSLATIONS[normVi]) {
    return CROP_TRANSLATIONS[normVi];
  }
  
  // 3. Fallback to MyMemory translation API
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(viName)}&langpair=vi|en`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      let enText = data?.responseData?.translatedText;
      if (enText) {
        enText = enText.replace(/\./g, "").trim().toLowerCase();
        if (enText.startsWith("the ")) {
          enText = enText.slice(4).trim();
        }
        return enText;
      }
    }
  } catch (e) {
    console.error("MyMemory translation error:", e);
  }
  
  // 4. Ultimate fallback: use the normalized name itself
  return normVi.replace(/[^a-z0-9]/g, "_");
}


function api(path, opts = {}) {
  return fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(opts.headers || {})
    }
  }).then(async r => {
    if (r.status === 401) { logout(); return; }
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Lỗi server');
    return data;
  });
}

function apiForm(path, body) {
  return fetch(API + path, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Lỗi upload');
    return data;
  });
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  document.getElementById('toast-icon').innerHTML = type === 'success'
    ? '<i class="fa-solid fa-circle-check" style="color:#4ade80"></i>'
    : '<i class="fa-solid fa-circle-xmark" style="color:#f87171"></i>';
  document.getElementById('toast-msg').textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric'});
}

function healthBadge(h) {
  const map = { 'Tốt':'badge-green','Bình thường':'badge-blue','Cần chú ý':'badge-amber','Bệnh':'badge-red' };
  return `<span class="badge ${map[h]||'badge-gray'}">${esc(h)}</span>`;
}

// ── Auth ─────────────────────────────────────────────────

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  errEl.style.display = 'none';
  btn.innerHTML = '<span class="spinner"></span>';
  btn.disabled = true;
  try {
    const data = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Đăng nhập thất bại');
      return d;
    });
    token = data.token;
    localStorage.setItem('pb_token', token);
    currentUser = data.user;
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.innerHTML = '<span id="login-btn-text">Đăng nhập</span>';
    btn.disabled = false;
  }
}

document.getElementById('login-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

function logout() {
  token = '';
  localStorage.removeItem('pb_token');
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
}

async function showApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('sb-user-name').textContent = currentUser?.name || '';
  document.getElementById('sb-user-email').textContent = currentUser?.email || '';
  await ensureMapboxToken();
  loadDashboard();
  loadSchemasDropdown();
}

// Check existing token on load
window.addEventListener('load', async () => {
  if (token) {
    try {
      currentUser = await api('/auth/me');
      showApp();
    } catch { logout(); }
  }
});

// ── Pages ─────────────────────────────────────────────────

function showPage(page) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }
  const titles = { dashboard:'Dashboard', plants:'Danh sách cây trồng', schemas:'Cấu hình', media:'Thư viện Media', gis:'Quản lý GIS' };
  document.getElementById('page-title').textContent = titles[page] || page;

  if (page === 'dashboard') loadDashboard();
  if (page === 'plants') loadPlants();
  if (page === 'schemas') {
    loadSchemas();
    loadCareConfigs();
  }
  if (page === 'gis') initGisPage();
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

// ── Dashboard ─────────────────────────────────────────────

async function loadDashboard() {
  try {
    const [plants, schemas, farms, recentLogs] = await Promise.all([
      api('/plants'),
      api('/schemas'),
      api('/farms'),
      api('/plants/logs/recent')
    ]);
    allPlants = plants;
    allFarms = farms;
    allRecentLogs = recentLogs;

    const healthy = plants.filter(p => p.health_status === 'Tốt').length;
    const watch = plants.filter(p => ['Cần chú ý','Bệnh'].includes(p.health_status)).length;
    document.getElementById('stat-plants').textContent = plants.length;
    document.getElementById('stat-healthy').textContent = healthy;
    document.getElementById('stat-watch').textContent = watch;
    document.getElementById('stat-schemas').textContent = schemas.length;

    // Reset and update filter buttons
    currentDashboardFilter = 'all';
    document.querySelectorAll('.dashboard-filter-bar .filter-chip').forEach(btn => btn.classList.remove('active'));
    const btnAll = document.getElementById('btn-filter-all');
    if (btnAll) btnAll.classList.add('active');

    // Load Overview map
    initDashboardMap(farms, plants);

    // Initial render of dashboard logs table
    renderDashboardLogsTable(recentLogs);
  } catch (err) {
    toast('Lỗi tải dashboard: ' + err.message, 'error');
  }
}

function renderDashboardLogsTable(logs) {
  const tbody = document.getElementById('dashboard-logs-table');
  if (!tbody) return;

  const filteredLogs = logs.filter(log => {
    const plant = allPlants.find(p => p.id === log.plant_id);
    if (!plant) return false;
    return matchesFilter(plant, currentDashboardFilter);
  });

  if (!filteredLogs.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fa fa-list-check"></i><p>Không có hoạt động canh tác nào trong 3 ngày qua</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = filteredLogs.map(l => {
    const plant = allPlants.find(p => p.id === l.plant_id) || {};
    const plantLabel = `<strong>Cây #${l.plant_id}</strong> (${esc(l.plant_type || plant.plant_type || '—')})`;
    
    // Build details text or use note
    let detailsStr = esc(l.note || '');
    if (l.details && Object.keys(l.details).length > 0) {
      const parts = [];
      if (l.details.method) parts.push(`Cách: ${l.details.method}`);
      if (l.details.amount) parts.push(`Lượng: ${l.details.amount} ${l.details.unit || ''}`);
      if (l.details.fertilizer_name) parts.push(`Phân: ${l.details.fertilizer_name}`);
      if (l.details.pesticide_name) parts.push(`Thuốc: ${l.details.pesticide_name}`);
      if (l.details.reason) parts.push(`Lý do: ${l.details.reason}`);
      if (parts.length > 0) {
        detailsStr = `<span style="color:var(--green)">[${parts.join(', ')}]</span>` + (l.note ? ` - ${esc(l.note)}` : '');
      }
    }

    return `
      <tr>
        <td>${fmtDate(l.log_date)}</td>
        <td>${plantLabel}</td>
        <td><span class="log-type-tag">${esc(l.log_type || 'Ghi chú')}</span></td>
        <td>${detailsStr}</td>
        <td><small>${esc(l.creator_name || 'Khách/Công nhân')}</small></td>
      </tr>
    `;
  }).join('');
}

function matchesFilter(plant, type) {
  if (type === 'all') return true;
  if (type === 'sick') return plant.health_status === 'Bệnh';
  if (type === 'watch') return plant.health_status === 'Cần chú ý';
  
  const now = new Date();
  if (type === 'not-watered') {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return plant.last_watered !== todayStr;
  }
  
  if (type === 'not-fertilized') {
    if (!plant.last_fertilized) return true;
    const lastFertDate = new Date(plant.last_fertilized + 'T00:00:00');
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 7);
    limitDate.setHours(0,0,0,0);
    return lastFertDate < limitDate;
  }
  return true;
}

function filterDashboard(type) {
  currentDashboardFilter = type;
  document.querySelectorAll('.dashboard-filter-bar .filter-chip').forEach(btn => btn.classList.remove('active'));
  
  let btnId = 'btn-filter-all';
  if (type === 'sick') btnId = 'btn-filter-sick';
  else if (type === 'watch') btnId = 'btn-filter-watch';
  else if (type === 'not-watered') btnId = 'btn-filter-not-watered';
  else if (type === 'not-fertilized') btnId = 'btn-filter-not-fertilized';
  
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');

  // Toggle map markers visibility/opacity
  dashboardMarkers.forEach(({ marker, plant, element }) => {
    if (matchesFilter(plant, type)) {
      element.classList.remove('filtered-out');
    } else {
      element.classList.add('filtered-out');
    }
  });

  // Filter logs table
  renderDashboardLogsTable(allRecentLogs);
}

// ── Plants ─────────────────────────────────────────────────

async function loadPlants() {
  const search = document.getElementById('plant-search')?.value || '';
  const health = document.getElementById('plant-filter-health')?.value || '';
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (health) params.append('health_status', health);

  try {
    const plants = await api(`/plants?${params}`);
    const tbody = document.getElementById('plants-table');
    if (!plants.length) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fa fa-seedling"></i><p>Không có cây nào</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = plants.map(p => `
      <tr>
        <td>${p.cover_image ? `<img src="${esc(p.cover_image)}" class="plant-cover" style="width:44px;height:44px">` :
          `<div class="plant-cover" style="width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;font-size:16px;color:var(--green)"><i class="fa-solid fa-seedling"></i></div>`}</td>
        <td>
          <strong>${esc(p.plant_type)}</strong>
          ${p.plant_variety ? `<br><small style="color:var(--gray-400)">${esc(p.plant_variety)}</small>` : ''}
        </td>
        <td>${esc(p.plant_age||'—')}</td>
        <td>${healthBadge(p.health_status)}</td>
        <td>${esc(p.location||'—')}</td>
        <td>${p.is_public
          ? `<span class="badge badge-green">Công khai</span>`
          : `<span class="badge badge-gray">Riêng tư</span>`}
        </td>
        <td>
          <div class="actions-cell">
            <button class="btn btn-secondary btn-sm" onclick="openPlantModal(${p.id})" title="Chỉnh sửa">
              <i class="fa fa-pen"></i>
            </button>
            ${p.is_public ? `
            <a href="/plant/${esc(p.public_slug)}" target="_blank" class="btn btn-primary btn-sm" title="Xem trang công khai">
              <i class="fa fa-arrow-up-right-from-square"></i>
            </a>` : ''}
            <button class="btn btn-danger btn-sm" onclick="deletePlant(${p.id},'${esc(p.plant_type)}')" title="Xóa">
              <i class="fa fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`).join('');
  } catch (err) {
    toast('Lỗi tải danh sách cây: ' + err.message, 'error');
  }
}

async function openPlantModal(id = null) {
  editingPlantId = id;
  resetPlantForm();
  document.getElementById('plant-modal-title').innerHTML = id
    ? '<i class="fa-solid fa-pen" style="color:var(--green)"></i> Chỉnh sửa cây'
    : '<i class="fa-solid fa-seedling" style="color:var(--green)"></i> Thêm cây mới';
  document.getElementById('public-url-section').style.display = 'none';

  // Load farms dropdown
  await loadFarmsDropdown();

  if (id) {
    try {
      const plant = await api(`/plants/${id}`);
      document.getElementById('f-plant-type').value = plant.plant_type || '';
      document.getElementById('f-plant-variety').value = plant.plant_variety || '';
      document.getElementById('f-plant-age').value = plant.plant_age || '';
      document.getElementById('f-health-status').value = plant.health_status || 'Tốt';
      document.getElementById('f-location').value = plant.location || '';
      document.getElementById('f-schema-id').value = plant.schema_id || '';
      document.getElementById('f-is-public').value = plant.is_public ? 'true' : 'false';
      document.getElementById('f-farm-id').value = plant.farm_id || '';
      document.getElementById('f-latitude').value = plant.latitude !== null && plant.latitude !== undefined ? plant.latitude : '';
      document.getElementById('f-longitude').value = plant.longitude !== null && plant.longitude !== undefined ? plant.longitude : '';

      // Show public URL
      if (plant.is_public && plant.public_slug) {
        showPublicURL(plant.public_slug);
      }

      // Store extra data for rendering
      window._currentPlantData = plant.data || {};
      window._currentSchemaFields = plant.schema_fields || [];
    } catch (err) {
      toast('Lỗi tải thông tin cây: ' + err.message, 'error');
    }
  }

  document.getElementById('plant-modal').style.display = 'flex';
}

function closePlantModal() {
  document.getElementById('plant-modal').style.display = 'none';
  editingPlantId = null;
  window._currentPlantData = {};
}

function resetPlantForm() {
  ['f-plant-type','f-plant-variety','f-plant-age','f-location','f-farm-id','f-latitude','f-longitude'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-health-status').value = 'Tốt';
  document.getElementById('f-schema-id').value = '';
  document.getElementById('f-is-public').value = 'true';
  document.getElementById('extra-fields-container').innerHTML = '<div class="empty-state" style="padding:24px"><i class="fa fa-layer-group"></i><p>Chọn schema ở tab Thông tin cơ bản để hiển thị các trường mở rộng</p></div>';
  document.getElementById('plant-media-container').innerHTML = '<p style="font-size:13px;color:var(--gray-400)">Lưu cây trước để upload ảnh/video.</p>';
  document.getElementById('plant-logs-container').innerHTML = '<p style="font-size:13px;color:var(--gray-400)">Lưu cây trước để ghi nhật ký.</p>';
  // Reset to first tab
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', i===0));
  document.querySelectorAll('.tab-pane').forEach((p,i) => p.classList.toggle('active', i===0));
  window._currentPlantData = {};
}

function showPublicURL(slug) {
  const url = `${window.location.origin}/plant/${slug}`;
  document.getElementById('public-url-input').value = url;
  document.getElementById('public-url-link').href = url;
  document.getElementById('public-url-section').style.display = 'block';
}

function copyURL() {
  const input = document.getElementById('public-url-input');
  input.select();
  document.execCommand('copy');
  toast('Đã copy đường dẫn!');
}

async function savePlant() {
  const plant_type = document.getElementById('f-plant-type').value.trim();
  if (!plant_type) { toast('Vui lòng nhập loại cây!', 'error'); return; }

  const schema_id = document.getElementById('f-schema-id').value;
  const extraData = collectExtraFields();

  const body = {
    plant_type,
    plant_variety: document.getElementById('f-plant-variety').value.trim(),
    plant_age: document.getElementById('f-plant-age').value.trim(),
    health_status: document.getElementById('f-health-status').value,
    location: document.getElementById('f-location').value.trim(),
    schema_id: schema_id || null,
    is_public: document.getElementById('f-is-public').value === 'true',
    farm_id: document.getElementById('f-farm-id').value || null,
    latitude: document.getElementById('f-latitude').value,
    longitude: document.getElementById('f-longitude').value,
    data: extraData
  };

  const btn = document.getElementById('plant-save-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    let plant;
    if (editingPlantId) {
      plant = await api(`/plants/${editingPlantId}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      plant = await api('/plants', { method: 'POST', body: JSON.stringify(body) });
      editingPlantId = plant.id;
    }

    if (plant.is_public && plant.public_slug) {
      showPublicURL(plant.public_slug);
    }

    // Refresh media/logs sections
    document.getElementById('plant-media-container').innerHTML = renderMediaSection(plant.id);
    loadPlantMedia(plant.id);
    document.getElementById('plant-logs-container').innerHTML = renderLogsSection(plant.id);
    loadPlantLogs(plant.id);

    toast(editingPlantId ? 'Đã cập nhật cây!' : 'Đã tạo cây mới!');
    loadPlants();
    loadDashboard();
    document.getElementById('plant-modal-title').textContent = '✏️ Chỉnh sửa cây';
  } catch (err) {
    toast('Lỗi lưu cây: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span id="plant-save-text"><i class="fa fa-floppy-disk"></i> Lưu cây</span>';
  }
}

async function deletePlant(id, name) {
  if (!confirm(`Xóa cây "${name}"? Hành động này không thể hoàn tác.`)) return;
  try {
    await api(`/plants/${id}`, { method: 'DELETE' });
    toast('Đã xóa cây.');
    loadPlants();
    loadDashboard();
  } catch (err) {
    toast('Lỗi xóa: ' + err.message, 'error');
  }
}

// ── Schema extra fields ─────────────────────────────────────

document.getElementById('f-schema-id').addEventListener('change', renderExtraFields);

async function renderExtraFields() {
  const schemaId = document.getElementById('f-schema-id').value;
  const container = document.getElementById('extra-fields-container');
  if (!schemaId) {
    container.innerHTML = '<div class="empty-state" style="padding:24px"><i class="fa fa-layer-group"></i><p>Chọn schema để hiển thị các trường mở rộng</p></div>';
    return;
  }
  try {
    const schema = schemasCache.find(s => s.id == schemaId);
    const fields = schema?.fields || [];
    if (!fields.length) {
      container.innerHTML = '<p style="font-size:13px;color:var(--gray-400)">Schema này chưa có trường nào.</p>';
      return;
    }
    const data = window._currentPlantData || {};
    container.innerHTML = fields.map(f => {
      const val = esc(data[f.name] || '');
      const key = `ef-${f.name.replace(/\s+/g,'-')}`;
      const type = f.type || 'text';
      let input;
      if (type === 'textarea') {
        input = `<textarea id="${key}" data-field="${esc(f.name)}">${val}</textarea>`;
      } else if (type === 'select' && f.options) {
        const opts = f.options.map(o => `<option ${val===o?'selected':''}>${esc(o)}</option>`).join('');
        input = `<select id="${key}" data-field="${esc(f.name)}">${opts}</select>`;
      } else {
        input = `<input type="${type}" id="${key}" data-field="${esc(f.name)}" value="${val}" placeholder="${esc(f.name)}">`;
      }
      return `<div class="field"><label>${esc(f.name)}</label>${input}</div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = '<p style="color:red">Lỗi tải schema</p>';
  }
}

function collectExtraFields() {
  const data = {};
  document.querySelectorAll('#extra-fields-container [data-field]').forEach(el => {
    data[el.dataset.field] = el.value;
  });
  return data;
}

// ── Media ─────────────────────────────────────────────────

function renderMediaSection(plantId) {
  return `
    <div class="upload-zone" id="upload-zone-${plantId}" onclick="document.getElementById('file-input-${plantId}').click()"
      ondragover="event.preventDefault();this.classList.add('drag')"
      ondragleave="this.classList.remove('drag')"
      ondrop="handleDrop(event,${plantId})">
      <i class="fa fa-cloud-arrow-up"></i>
      <p>Nhấn hoặc kéo thả ảnh/video vào đây</p>
      <small>Hỗ trợ: JPG, PNG, GIF, WebP, MP4, MOV (tối đa 100MB/file)</small>
    </div>
    <input type="file" id="file-input-${plantId}" multiple accept="image/*,video/*" style="display:none"
      onchange="uploadMedia(${plantId}, this.files)">
    <div class="media-grid" id="media-grid-${plantId}" style="margin-top:16px"></div>
  `;
}

async function loadPlantMedia(plantId) {
  const container = document.getElementById('plant-media-container');
  if (!container.querySelector('.media-grid')) {
    container.innerHTML = renderMediaSection(plantId);
  }
  try {
    const plant = await api(`/plants/${plantId}`);
    const grid = document.getElementById(`media-grid-${plantId}`);
    if (!grid) return;
    if (!plant.media?.length) {
      grid.innerHTML = '<p style="font-size:13px;color:var(--gray-400)">Chưa có ảnh/video nào.</p>';
      return;
    }
    grid.innerHTML = plant.media.map(m => `
      <div class="media-thumb">
        ${m.media_type === 'video'
          ? `<video src="${esc(m.url)}" controls></video>`
          : `<img src="${esc(m.url)}" alt="${esc(m.caption||'')}">` }
        <button class="del-btn" onclick="deleteMedia(${plantId},${m.id})">×</button>
      </div>`).join('');
  } catch (err) { /* ignore */ }
}

async function uploadMedia(plantId, files) {
  if (!files.length) return;
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  try {
    await apiForm(`/plants/${plantId}/media`, fd);
    toast('Upload thành công!');
    loadPlantMedia(plantId);
    loadPlants();
  } catch (err) {
    toast('Upload thất bại: ' + err.message, 'error');
  }
}

function handleDrop(e, plantId) {
  e.preventDefault();
  document.getElementById(`upload-zone-${plantId}`)?.classList.remove('drag');
  uploadMedia(plantId, e.dataTransfer.files);
}

async function deleteMedia(plantId, mediaId) {
  if (!confirm('Xóa ảnh/video này?')) return;
  try {
    await api(`/plants/${plantId}/media/${mediaId}`, { method: 'DELETE' });
    toast('Đã xóa media.');
    loadPlantMedia(plantId);
  } catch (err) {
    toast('Lỗi xóa: ' + err.message, 'error');
  }
}

// ── Logs ─────────────────────────────────────────────────

function renderLogsSection(plantId) {
  return `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><h3>Ghi nhật ký chăm sóc</h3></div>
      <div style="padding:16px">
        <div class="form-row">
          <div class="field">
            <label>Ngày</label>
            <input type="date" id="log-date-${plantId}" value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div class="field">
            <label>Loại nhật ký</label>
            <select id="log-type-${plantId}">
              <option>Tưới nước</option>
              <option>Bón phân</option>
              <option>Phun thuốc</option>
              <option>Thu hoạch</option>
              <option>Kiểm tra sức khỏe</option>
              <option>Cắt tỉa</option>
              <option>Ghi chú khác</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Ghi chú</label>
          <textarea id="log-note-${plantId}" placeholder="Ghi chi tiết công việc, quan sát, tình trạng cây..."></textarea>
        </div>
        <button class="btn btn-primary btn-sm" onclick="addLog(${plantId})">
          <i class="fa fa-plus"></i> Thêm nhật ký
        </button>
      </div>
    </div>
    <div id="logs-list-${plantId}"></div>
  `;
}

async function loadPlantLogs(plantId) {
  const container = document.getElementById('plant-logs-container');
  if (!container.querySelector(`#logs-list-${plantId}`)) {
    container.innerHTML = renderLogsSection(plantId);
  }
  try {
    const plant = await api(`/plants/${plantId}`);
    const el = document.getElementById(`logs-list-${plantId}`);
    if (!el) return;
    if (!plant.logs?.length) {
      el.innerHTML = '<p style="font-size:13px;color:var(--gray-400)">Chưa có nhật ký nào.</p>';
      return;
    }
    el.innerHTML = plant.logs.map(l => `
      <div class="log-item">
        <div class="log-date-badge">${fmtDate(l.log_date)}</div>
        <div style="flex:1">
          <div class="log-type-tag">${esc(l.log_type||'Ghi chú')}</div>
          <div class="log-note">${esc(l.note||'')}</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteLog(${plantId},${l.id})">
          <i class="fa fa-trash"></i>
        </button>
      </div>`).join('');
  } catch (err) { /* ignore */ }
}

async function addLog(plantId) {
  const body = {
    log_date: document.getElementById(`log-date-${plantId}`).value,
    log_type: document.getElementById(`log-type-${plantId}`).value,
    note: document.getElementById(`log-note-${plantId}`).value.trim()
  };
  if (!body.note) { toast('Vui lòng nhập ghi chú!', 'error'); return; }
  try {
    await api(`/plants/${plantId}/logs`, { method: 'POST', body: JSON.stringify(body) });
    document.getElementById(`log-note-${plantId}`).value = '';
    toast('Đã thêm nhật ký!');
    loadPlantLogs(plantId);
  } catch (err) {
    toast('Lỗi: ' + err.message, 'error');
  }
}

async function deleteLog(plantId, logId) {
  if (!confirm('Xóa nhật ký này?')) return;
  try {
    await api(`/plants/${plantId}/logs/${logId}`, { method: 'DELETE' });
    toast('Đã xóa nhật ký.');
    loadPlantLogs(plantId);
  } catch (err) {
    toast('Lỗi: ' + err.message, 'error');
  }
}

// ── Schemas ─────────────────────────────────────────────────

async function loadSchemas() {
  try {
    const schemas = await api('/schemas');
    schemasCache = schemas;
    const tbody = document.getElementById('schemas-table');
    if (!schemas.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fa fa-layer-group"></i><p>Chưa có schema nào</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = schemas.map(s => `
      <tr>
        <td><strong>${esc(s.name)}</strong></td>
        <td style="color:var(--gray-600);font-size:12px">${esc(s.description||'—')}</td>
        <td><span class="badge badge-blue">${(s.fields||[]).length} trường</span></td>
        <td>${fmtDate(s.created_at)}</td>
        <td>
          <div class="actions-cell">
            <button class="btn btn-secondary btn-sm" onclick="openSchemaModal(${s.id})"><i class="fa fa-pen"></i></button>
            <button class="btn btn-danger btn-sm" onclick="deleteSchema(${s.id},'${esc(s.name)}')"><i class="fa fa-trash"></i></button>
          </div>
        </td>
      </tr>`).join('');
  } catch (err) {
    toast('Lỗi tải schema: ' + err.message, 'error');
  }
}

async function loadSchemasDropdown() {
  try {
    const schemas = await api('/schemas');
    schemasCache = schemas;
    
    // Populate f-plant-type select
    const pTypeSel = document.getElementById('f-plant-type');
    if (pTypeSel) {
      pTypeSel.innerHTML = '<option value="">— Chọn loại cây —</option>' +
        schemas.map(s => `<option value="${esc(s.name)}" data-schema-id="${s.id}">${esc(s.name)}</option>`).join('');
    }
    
    // Populate csv-plant-type select
    const csvTypeSel = document.getElementById('csv-plant-type');
    if (csvTypeSel) {
      csvTypeSel.innerHTML = '<option value="">— Chọn loại cây —</option>' +
        schemas.map(s => `<option value="${esc(s.name)}" data-schema-id="${s.id}">${esc(s.name)}</option>`).join('');
    }
  } catch (err) {
    console.error('Lỗi tải schemas dropdown:', err);
  }
}

function onPlantTypeChange() {
  const pTypeSel = document.getElementById('f-plant-type');
  const selectedOpt = pTypeSel.options[pTypeSel.selectedIndex];
  const schemaId = selectedOpt ? selectedOpt.getAttribute('data-schema-id') : '';
  
  document.getElementById('f-schema-id').value = schemaId || '';
  renderExtraFields();
}

function onCsvPlantTypeChange() {
  const csvTypeSel = document.getElementById('csv-plant-type');
  const selectedOpt = csvTypeSel.options[csvTypeSel.selectedIndex];
  const schemaId = selectedOpt ? selectedOpt.getAttribute('data-schema-id') : '';
  
  document.getElementById('csv-schema-id').value = schemaId || '';
}

async function openSchemaModal(id = null) {
  editingSchemaId = id;
  schemaFields = [];
  document.getElementById('schema-modal-title').innerHTML = id
    ? '<i class="fa-solid fa-pen" style="color:var(--green)"></i> Chỉnh sửa Schema'
    : '<i class="fa-solid fa-sliders" style="color:var(--green)"></i> Tạo Schema loại cây';
  document.getElementById('s-name').value = '';
  document.getElementById('s-desc').value = '';

  if (id) {
    try {
      const schema = await api(`/schemas/${id}`);
      document.getElementById('s-name').value = schema.name || '';
      document.getElementById('s-desc').value = schema.description || '';
      schemaFields = schema.fields || [];
    } catch (err) { toast('Lỗi: ' + err.message, 'error'); return; }
  }
  renderSchemaFields();
  document.getElementById('schema-modal').style.display = 'flex';
}

function closeSchemaModal() {
  document.getElementById('schema-modal').style.display = 'none';
  editingSchemaId = null;
  schemaFields = [];
}

function renderSchemaFields() {
  const list = document.getElementById('schema-fields-list');
  if (!schemaFields.length) {
    list.innerHTML = '<p style="font-size:12px;color:var(--gray-400);padding:8px">Chưa có trường nào. Thêm bên dưới.</p>';
    return;
  }
  const typeLabels = { text:'Văn bản', number:'Số', date:'Ngày', select:'Lựa chọn', textarea:'Đoạn văn' };
  list.innerHTML = schemaFields.map((f, i) => `
    <div class="schema-field-item">
      <div class="field-info">
        <div><strong>${esc(f.name)}</strong></div>
        <div class="field-type">${typeLabels[f.type]||f.type}</div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="removeSchemaField(${i})">
        <i class="fa fa-trash"></i>
      </button>
    </div>`).join('');
}

function addSchemaField() {
  const name = document.getElementById('new-field-name').value.trim();
  const type = document.getElementById('new-field-type').value;
  if (!name) { toast('Vui lòng nhập tên trường!', 'error'); return; }
  if (schemaFields.find(f => f.name === name)) { toast('Trường đã tồn tại!', 'error'); return; }
  schemaFields.push({ name, type });
  document.getElementById('new-field-name').value = '';
  renderSchemaFields();
}

function removeSchemaField(i) {
  schemaFields.splice(i, 1);
  renderSchemaFields();
}

async function saveSchema() {
  let name = document.getElementById('s-name').value.trim();
  if (!name) { toast('Tên schema là bắt buộc!', 'error'); return; }
  
  const btn = document.querySelector('#schema-modal .modal-footer button.btn-primary');
  let oldHtml = '';
  if (btn) {
    oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Đang dịch & lưu...';
  }

  try {
    // Automatically translate and append English name in parentheses if not already present
    if (!/\([^)]+\)/.test(name)) {
      const translated = await translateCropName(name);
      if (translated) {
        name = `${name}(${translated})`;
        document.getElementById('s-name').value = name;
      }
    }

    const body = { name, description: document.getElementById('s-desc').value.trim(), fields: schemaFields };
    if (editingSchemaId) {
      await api(`/schemas/${editingSchemaId}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await api('/schemas', { method: 'POST', body: JSON.stringify(body) });
    }
    toast('Đã lưu schema!');
    closeSchemaModal();
    loadSchemas();
    loadSchemasDropdown();
  } catch (err) {
    toast('Lỗi: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }
  }
}

async function deleteSchema(id, name) {
  if (!confirm(`Xóa schema "${name}"?`)) return;
  try {
    await api(`/schemas/${id}`, { method: 'DELETE' });
    toast('Đã xóa schema.');
    loadSchemas();
    loadSchemasDropdown();
  } catch (err) {
    toast('Lỗi: ' + err.message, 'error');
  }
}

// Enter key for add field
document.getElementById('new-field-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') addSchemaField();
});

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

// ── Mapbox GIS & Farm Management ──────────────────────────────

let mapboxTokenFetched = false;
async function ensureMapboxToken() {
  if (mapboxTokenFetched) return;
  const res = await fetch(API + '/config/mapbox-token');
  if (!res.ok) throw new Error('Không thể lấy cấu hình Mapbox từ server');
  const data = await res.json();
  if (!data || !data.token) throw new Error('Cấu hình Mapbox không hợp lệ hoặc thiếu token');
  mapboxgl.accessToken = data.token;
  mapboxTokenFetched = true;
}
let dbMap = null;
let gMap = null;
let drawControl = null;
let activeFarmId = null;
let currentFarms = [];
let currentPlants = [];

// Populate farms select in plant modal
async function loadFarmsDropdown() {
  try {
    const farms = await api('/farms');
    const select = document.getElementById('f-farm-id');
    if (select) {
      select.innerHTML = '<option value="">— Không thuộc trang trại nào —</option>' + 
        farms.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
    }
  } catch (err) {
    console.error('Error loading farms for dropdown:', err);
  }
}

// Initialize Overview map on Dashboard
function initDashboardMap(farms, plants) {
  const mapContainer = document.getElementById('dashboard-map');
  if (!mapContainer) return;
  
  if (dashboardMap) {
    try {
      dashboardMap.remove();
    } catch (e) {}
    dashboardMap = null;
  }
  dashboardMarkers = [];

  mapContainer.innerHTML = '';
  const mapDiv = document.createElement('div');
  mapDiv.style.width = '100%';
  mapDiv.style.height = '100%';
  mapContainer.appendChild(mapDiv);

  const map = new mapboxgl.Map({
    container: mapDiv,
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center: [106.3, 12.5],
    zoom: 5
  });
  dashboardMap = map;

  map.addControl(new mapboxgl.NavigationControl());

  map.on('load', () => {
    const bounds = new mapboxgl.LngLatBounds();
    let hasBounds = false;

    // Render farms boundaries
    farms.forEach(farm => {
      let coords = [];
      try {
        coords = typeof farm.polygon_coordinates === 'string' ? JSON.parse(farm.polygon_coordinates) : farm.polygon_coordinates;
      } catch(e) {}
      
      if (coords && coords.length > 0) {
        const farmSourceId = `farm-source-${farm.id}`;
        const farmLayerId = `farm-layer-${farm.id}`;
        const farmOutlineId = `farm-outline-${farm.id}`;

        const polygonCoords = [...coords];
        if (polygonCoords.length > 0 && 
            (polygonCoords[0][0] !== polygonCoords[polygonCoords.length - 1][0] || 
             polygonCoords[0][1] !== polygonCoords[polygonCoords.length - 1][1])) {
          polygonCoords.push(polygonCoords[0]);
        }

        map.addSource(farmSourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [polygonCoords]
            }
          }
        });

        map.addLayer({
          id: farmLayerId,
          type: 'fill',
          source: farmSourceId,
          layout: {},
          paint: {
            'fill-color': '#10b981',
            'fill-opacity': 0.25
          }
        });

        map.addLayer({
          id: farmOutlineId,
          type: 'line',
          source: farmSourceId,
          layout: {},
          paint: {
            'line-color': '#10b981',
            'line-width': 2
          }
        });

        coords.forEach(pt => {
          bounds.extend(pt);
          hasBounds = true;
        });

        map.on('click', farmLayerId, (e) => {
          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
              <div class="map-tooltip">
                <h4><i class="fa-solid fa-wheat-awn" style="color:#10b981"></i> Trang trại: ${esc(farm.name)}</h4>
                <p>${esc(farm.description || 'Không có mô tả.')}</p>
                <p>Diện tích: <strong>${farm.area ? Math.round(parseFloat(farm.area)).toLocaleString('vi-VN') : 0} m²</strong></p>
              </div>
            `)
            .addTo(map);
        });

        map.on('mouseenter', farmLayerId, () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', farmLayerId, () => map.getCanvas().style.cursor = '');
      }
    });

    // Render plant markers using custom HTML with ID and health color wrapped in a container
    plants.forEach(plant => {
      if (plant.latitude && plant.longitude) {
        const lat = parseFloat(plant.latitude);
        const lng = parseFloat(plant.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          const wrapper = document.createElement('div');
          wrapper.className = 'plant-marker-wrap';

          const el = document.createElement('div');
          let healthClass = 'health-default';
          if (plant.health_status === 'Tốt') healthClass = 'health-tot';
          else if (plant.health_status === 'Cần chú ý') healthClass = 'health-watch';
          else if (plant.health_status === 'Bệnh') healthClass = 'health-sick';

          el.className = `plant-id-marker ${healthClass}`;
          el.innerHTML = `<span>${plant.id}</span>`;
          wrapper.appendChild(el);

          const marker = new mapboxgl.Marker(wrapper)
            .setLngLat([lng, lat])
            .setPopup(new mapboxgl.Popup({ offset: 25 })
              .setHTML(`
                <div class="map-tooltip">
                  <h4><i class="fa-solid fa-tree" style="color:#10b981"></i> Cây #${plant.id}: ${esc(plant.plant_type)}</h4>
                  ${plant.plant_variety ? `<p>Giống: <strong>${esc(plant.plant_variety)}</strong></p>` : ''}
                  <p>Sức khỏe: <strong>${esc(plant.health_status)}</strong></p>
                  <p>Vị trí: ${esc(plant.location || 'Chưa ghi nhận')}</p>
                  <div style="margin-top:8px">
                    <button class="btn btn-primary btn-sm" onclick="openPlantModal(${plant.id})">Chi tiết</button>
                  </div>
                </div>
              `)
            )
            .addTo(map);

          dashboardMarkers.push({ marker, plant, element: el });
          bounds.extend([lng, lat]);
          hasBounds = true;
        }
      }
    });

    if (hasBounds) {
      map.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 1000 });
    }

    // Apply active filter state on load if it was set
    if (currentDashboardFilter !== 'all') {
      filterDashboard(currentDashboardFilter);
    }
  });
}

// Initialize GIS Page
async function initGisPage() {
  activeFarmId = null;
  document.getElementById('gis-back-btn').style.display = 'none';
  document.getElementById('gis-sidebar-title').innerHTML = '<i class="fa-solid fa-map" style="color:var(--green)"></i> Trang trại';
  document.getElementById('gis-header-actions').style.display = 'block';
  switchGisView('list');
  
  try {
    await ensureMapboxToken();
    const [farms, plants] = await Promise.all([
      api('/farms'),
      api('/plants')
    ]);
    currentFarms = farms;
    currentPlants = plants;
    renderFarmsList(farms);
    initGisMap(farms, plants);
  } catch (err) {
    toast('Lỗi tải dữ liệu GIS: ' + err.message, 'error');
  }
}

function switchGisView(view) {
  document.getElementById('gis-view-list').style.display = view === 'list' ? 'block' : 'none';
  document.getElementById('gis-view-form').style.display = view === 'form' ? 'block' : 'none';
  document.getElementById('gis-view-details').style.display = view === 'details' ? 'block' : 'none';
}

function renderFarmsList(farms) {
  const container = document.getElementById('farms-list-container');
  if (!farms.length) {
    container.innerHTML = '<div class="empty-state"><i class="fa fa-map-location-dot"></i><p>Chưa có trang trại nào. Hãy thêm mới!</p></div>';
    return;
  }
  container.innerHTML = farms.map(f => `
    <div class="farm-item" onclick="selectFarm(${f.id})">
      <div class="farm-item-name">${esc(f.name)}</div>
      <div class="farm-item-meta">
        <span><i class="fa-solid fa-ruler-combined" style="color:var(--green-dark)"></i> ${f.area ? Math.round(parseFloat(f.area)).toLocaleString('vi-VN') : 0} m²</span>
        <span><i class="fa-solid fa-seedling" style="color:var(--green)"></i> ${f.plant_count} cây</span>
      </div>
    </div>
  `).join('');
}

function initGisMap(farms, plants) {
  const container = document.getElementById('gis-map');
  if (!container) return;
  container.innerHTML = '';
  
  gMap = new mapboxgl.Map({
    container: 'gis-map',
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center: [106.3, 12.5],
    zoom: 5
  });

  gMap.addControl(new mapboxgl.NavigationControl());

  drawControl = new MapboxDraw({
    displayControlsDefault: false,
    controls: {
      polygon: true,
      trash: true
    },
    defaultMode: 'simple_select'
  });
  gMap.addControl(drawControl);

  gMap.on('draw.create', updateAreaDisplay);
  gMap.on('draw.update', updateAreaDisplay);
  gMap.on('draw.delete', updateAreaDisplay);

  gMap.on('load', () => {
    drawFarmsAndPlantsLayers(farms, plants);
  });
}

function drawFarmsAndPlantsLayers(farms, plants) {
  if (!gMap) return;
  const bounds = new mapboxgl.LngLatBounds();
  let hasBounds = false;

  farms.forEach(farm => {
    let coords = [];
    try {
      coords = typeof farm.polygon_coordinates === 'string' ? JSON.parse(farm.polygon_coordinates) : farm.polygon_coordinates;
    } catch(e) {}

    if (coords && coords.length > 0) {
      const srcId = `gis-farm-src-${farm.id}`;
      const layerId = `gis-farm-layer-${farm.id}`;
      const outlineId = `gis-farm-outline-${farm.id}`;

      const polyCoords = [...coords];
      if (polyCoords.length > 0 && 
          (polyCoords[0][0] !== polyCoords[polyCoords.length - 1][0] || 
           polyCoords[0][1] !== polyCoords[polyCoords.length - 1][1])) {
        polyCoords.push(polyCoords[0]);
      }

      gMap.addSource(srcId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [polyCoords] }
        }
      });

      gMap.addLayer({
        id: layerId,
        type: 'fill',
        source: srcId,
        paint: {
          'fill-color': '#10b981',
          'fill-opacity': activeFarmId === farm.id ? 0.45 : 0.25
        }
      });

      gMap.addLayer({
        id: outlineId,
        type: 'line',
        source: srcId,
        paint: {
          'line-color': '#10b981',
          'line-width': activeFarmId === farm.id ? 3 : 1.5
        }
      });

      gMap.on('click', layerId, () => {
        selectFarm(farm.id);
      });
      
      gMap.on('mouseenter', layerId, () => gMap.getCanvas().style.cursor = 'pointer');
      gMap.on('mouseleave', layerId, () => gMap.getCanvas().style.cursor = '');

      coords.forEach(pt => {
        bounds.extend(pt);
        hasBounds = true;
      });
    }
  });

  plants.forEach(plant => {
    if (plant.latitude && plant.longitude) {
      const lat = parseFloat(plant.latitude);
      const lng = parseFloat(plant.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        let color = '#3b82f6';
        if (plant.health_status === 'Tốt') color = '#22c55e';
        else if (plant.health_status === 'Cần chú ý') color = '#eab308';
        else if (plant.health_status === 'Bệnh') color = '#ef4444';

        const marker = new mapboxgl.Marker({ color })
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div class="map-tooltip">
                <h4><i class="fa-solid fa-tree" style="color:#10b981"></i> ${esc(plant.plant_type)}</h4>
                ${plant.plant_variety ? `<p>Giống: <strong>${esc(plant.plant_variety)}</strong></p>` : ''}
                <p>Sức khỏe: <strong>${esc(plant.health_status)}</strong></p>
                <p>Vị trí: ${esc(plant.location || 'Chưa ghi nhận')}</p>
                <div style="margin-top:8px">
                  <button class="btn btn-primary btn-sm" onclick="openPlantModal(${plant.id})">Chi tiết</button>
                </div>
              </div>
            `)
          )
          .addTo(gMap);

        bounds.extend([lng, lat]);
        hasBounds = true;
      }
    }
  });

  if (hasBounds && !activeFarmId) {
    gMap.fitBounds(bounds, { padding: 50, maxZoom: 16, duration: 1000 });
  }
}

function updateAreaDisplay() {
  const data = drawControl.getAll();
  if (data.features.length > 0) {
    const polygon = data.features[0];
    const areaVal = turf.area(polygon);
    document.getElementById('farm-area-display').textContent = Math.round(areaVal).toLocaleString('vi-VN') + ' m²';
    document.getElementById('farm-area-ha').textContent = (areaVal / 10000).toFixed(2);
    window._lastDrawnArea = areaVal;
  } else {
    document.getElementById('farm-area-display').textContent = '0 m²';
    document.getElementById('farm-area-ha').textContent = '0';
    window._lastDrawnArea = 0;
  }
}

function openFarmForm() {
  activeFarmId = null;
  document.getElementById('gis-back-btn').style.display = 'block';
  document.getElementById('gis-sidebar-title').textContent = 'Tạo Trang trại';
  document.getElementById('gis-header-actions').style.display = 'none';
  switchGisView('form');
  
  document.getElementById('farm-name').value = '';
  document.getElementById('farm-desc').value = '';
  document.getElementById('farm-area-display').textContent = '0 m²';
  document.getElementById('farm-area-ha').textContent = '0';
  window._lastDrawnArea = 0;

  drawControl.deleteAll();
  drawControl.changeMode('draw_polygon');
}

function cancelFarmForm() {
  drawControl.changeMode('simple_select');
  drawControl.deleteAll();
  initGisPage();
}

async function saveFarm() {
  const name = document.getElementById('farm-name').value.trim();
  const description = document.getElementById('farm-desc').value.trim();
  if (!name) {
    toast('Vui lòng nhập tên trang trại!', 'error');
    return;
  }

  const data = drawControl.getAll();
  if (data.features.length === 0) {
    toast('Vui lòng vẽ ranh giới trang trại trên bản đồ!', 'error');
    return;
  }

  const coordinates = data.features[0].geometry.coordinates[0];
  const area = window._lastDrawnArea || 0;

  const body = {
    name,
    description,
    polygon_coordinates: coordinates,
    area
  };

  try {
    const method = activeFarmId ? 'PUT' : 'POST';
    const url = activeFarmId ? `/farms/${activeFarmId}` : '/farms';
    
    const savedFarm = await api(url, {
      method,
      body: JSON.stringify(body)
    });

    toast(activeFarmId ? 'Đã cập nhật ranh giới trang trại!' : 'Đã tạo trang trại thành công!');
    drawControl.changeMode('simple_select');
    drawControl.deleteAll();
    
    await initGisPage();
    if (savedFarm && savedFarm.id) {
      selectFarm(savedFarm.id);
    }
  } catch (err) {
    toast('Lỗi lưu trang trại: ' + err.message, 'error');
  }
}

async function selectFarm(farmId) {
  activeFarmId = farmId;
  document.getElementById('gis-back-btn').style.display = 'block';
  document.getElementById('gis-header-actions').style.display = 'none';
  switchGisView('details');
  
  try {
    const farm = await api(`/farms/${farmId}`);
    document.getElementById('gis-sidebar-title').textContent = farm.name;
    document.getElementById('farm-details-desc').textContent = farm.description || 'Không có mô tả.';
    document.getElementById('farm-details-area').textContent = Math.round(parseFloat(farm.area || 0)).toLocaleString('vi-VN') + ' m²';
    document.getElementById('farm-details-plant-count').textContent = farm.plants.length;

    const listEl = document.getElementById('farm-details-plants-list');
    if (farm.plants.length === 0) {
      listEl.innerHTML = '<p style="font-size:12px;color:var(--gray-400);text-align:center;padding:12px">Chưa có cây nào trong trang trại này.</p>';
    } else {
      listEl.innerHTML = farm.plants.map(p => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:var(--gray-50); border-radius:6px; font-size:12px; border:1px solid var(--gray-200);">
          <div>
            <strong>${esc(p.plant_type)}</strong>
            ${p.plant_variety ? `<span style="color:var(--gray-400)"> - ${esc(p.plant_variety)}</span>` : ''}
          </div>
          <div style="display:flex; align-items:center;">
            ${healthBadge(p.health_status)}
            <button class="btn btn-secondary btn-sm" style="padding: 2px 6px; margin-left: 6px;" onclick="openPlantModal(${p.id})">
              <i class="fa fa-pen"></i>
            </button>
          </div>
        </div>
      `).join('');
    }

    let coords = [];
    try {
      coords = typeof farm.polygon_coordinates === 'string' ? JSON.parse(farm.polygon_coordinates) : farm.polygon_coordinates;
    } catch(e) {}

    if (coords && coords.length > 0 && gMap) {
      const bounds = new mapboxgl.LngLatBounds();
      coords.forEach(pt => bounds.extend(pt));
      gMap.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 1000 });
    }
  } catch (err) {
    toast('Lỗi tải chi tiết trang trại: ' + err.message, 'error');
  }
}

function backToFarmsList() {
  initGisPage();
}

async function editFarm() {
  if (!activeFarmId) return;
  try {
    const farm = currentFarms.find(f => f.id === activeFarmId);
    if (!farm) return;

    switchGisView('form');
    document.getElementById('gis-sidebar-title').textContent = 'Sửa Trang trại';
    document.getElementById('farm-name').value = farm.name;
    document.getElementById('farm-desc').value = farm.description || '';
    document.getElementById('farm-area-display').textContent = Math.round(parseFloat(farm.area || 0)).toLocaleString('vi-VN') + ' m²';
    document.getElementById('farm-area-ha').textContent = ((farm.area || 0) / 10000).toFixed(2);
    window._lastDrawnArea = farm.area || 0;

    let coords = [];
    try {
      coords = typeof farm.polygon_coordinates === 'string' ? JSON.parse(farm.polygon_coordinates) : farm.polygon_coordinates;
    } catch(e) {}

    if (coords && coords.length > 0) {
      const polyCoords = [...coords];
      if (polyCoords.length > 0 && 
          (polyCoords[0][0] !== polyCoords[polyCoords.length - 1][0] || 
           polyCoords[0][1] !== polyCoords[polyCoords.length - 1][1])) {
        polyCoords.push(polyCoords[0]);
      }

      drawControl.deleteAll();
      drawControl.add({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [polyCoords]
        }
      });
    }
  } catch (err) {
    toast('Lỗi khi sửa trang trại: ' + err.message, 'error');
  }
}

async function deleteFarm() {
  if (!activeFarmId) return;
  if (!confirm('Bạn có chắc chắn muốn xóa trang trại này? Các cây liên kết sẽ được giữ lại nhưng không thuộc trang trại nào nữa.')) return;
  
  try {
    await api(`/farms/${activeFarmId}`, { method: 'DELETE' });
    toast('Đã xóa trang trại thành công.');
    initGisPage();
  } catch (err) {
    toast('Lỗi xóa trang trại: ' + err.message, 'error');
  }
}

// ── CSV Import & Plant Association ───────────────────────────

async function openAddPlantsManual() {
  if (!activeFarmId) {
    toast('Vui lòng chọn trang trại trước!', 'error');
    return;
  }
  // Open modal
  await openPlantModal();
  // Pre-select the farm
  const select = document.getElementById('f-farm-id');
  if (select) {
    select.value = activeFarmId;
  }
}

async function openCsvImportModal() {
  if (!activeFarmId) {
    toast('Vui lòng chọn trang trại trước!', 'error');
    return;
  }
  
  // Reset form
  document.getElementById('csv-file-input').value = '';
  document.getElementById('csv-plant-type').value = '';
  document.getElementById('csv-plant-variety').value = '';
  document.getElementById('csv-plant-age').value = '';
  document.getElementById('csv-health-status').value = 'Tốt';
  document.getElementById('csv-is-public').value = 'true';
  
  // Populate schemas
  const schemaSelect = document.getElementById('csv-schema-id');
  if (schemaSelect) {
    schemaSelect.innerHTML = '<option value="">— Không dùng schema —</option>' +
      schemasCache.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  }
  
  document.getElementById('csv-preview-section').style.display = 'none';
  document.getElementById('csv-preview-table-body').innerHTML = '';
  document.getElementById('csv-import-submit-btn').disabled = true;
  window._parsedCsvItems = [];
  
  document.getElementById('csv-import-modal').style.display = 'flex';
}

function closeCsvImportModal() {
  document.getElementById('csv-import-modal').style.display = 'none';
  window._parsedCsvItems = [];
}

// Local CSV parser
function parseCsvContent(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const sttIdx = headers.findIndex(h => h === 'stt' || h === 'id' || h === 'no');
  const eIdx = headers.findIndex(h => h === 'e' || h === 'easting' || h === 'lng' || h === 'longitude' || h === 'kinh độ');
  const nIdx = headers.findIndex(h => h === 'n' || h === 'northing' || h === 'lat' || h === 'latitude' || h === 'vĩ độ');

  if (eIdx === -1 || nIdx === -1) {
    toast('File CSV phải chứa tiêu đề "E" (hoặc Lng) và "N" (hoặc Lat) để định vị!', 'error');
    return [];
  }

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/['"]/g, ''));
    if (cols.length < Math.max(eIdx, nIdx) + 1) continue;

    const stt = sttIdx !== -1 ? cols[sttIdx] : String(i);
    const eVal = parseFloat(cols[eIdx]);
    const nVal = parseFloat(cols[nIdx]);

    if (isNaN(eVal) || isNaN(nVal)) continue;

    items.push({ stt, e: eVal, n: nVal });
  }
  return items;
}

// Bind CSV file input changes
const csvInput = document.getElementById('csv-file-input');
if (csvInput) {
  csvInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      const text = evt.target.result;
      const items = parseCsvContent(text);
      
      if (items.length === 0) {
        document.getElementById('csv-preview-section').style.display = 'none';
        document.getElementById('csv-import-submit-btn').disabled = true;
        window._parsedCsvItems = [];
        return;
      }

      window._parsedCsvItems = items;
      document.getElementById('csv-preview-count').textContent = items.length;
      
      const tbody = document.getElementById('csv-preview-table-body');
      tbody.innerHTML = items.map(item => `
        <tr>
          <td style="padding:4px 6px;">${esc(item.stt)}</td>
          <td style="padding:4px 6px;">${item.e.toFixed(6)}</td>
          <td style="padding:4px 6px;">${item.n.toFixed(6)}</td>
        </tr>
      `).join('');
      
      document.getElementById('csv-preview-section').style.display = 'block';
      document.getElementById('csv-import-submit-btn').disabled = false;
    };
    reader.readAsText(file);
  });
}

async function submitCsvImport() {
  const plant_type = document.getElementById('csv-plant-type').value.trim();
  if (!plant_type) {
    toast('Vui lòng nhập loại cây!', 'error');
    return;
  }
  if (!window._parsedCsvItems || window._parsedCsvItems.length === 0) {
    toast('Vui lòng chọn file CSV hợp lệ!', 'error');
    return;
  }

  const submitBtn = document.getElementById('csv-import-submit-btn');
  const oldText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang import...';

  const body = {
    farm_id: activeFarmId,
    plant_type,
    plant_variety: document.getElementById('csv-plant-variety').value.trim(),
    plant_age: document.getElementById('csv-plant-age').value.trim(),
    health_status: document.getElementById('csv-health-status').value,
    schema_id: document.getElementById('csv-schema-id').value || null,
    is_public: document.getElementById('csv-is-public').value === 'true',
    items: window._parsedCsvItems
  };

  try {
    const res = await api('/plants/batch', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    toast(`Đã import thành công ${res.count} cây vào trang trại!`);
    closeCsvImportModal();
    // Refresh farm details and map to show the new plants
    if (activeFarmId) {
      await initGisPage();
      selectFarm(activeFarmId);
    }
  } catch (err) {
    toast('Lỗi import CSV: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = oldText;
  }
}
