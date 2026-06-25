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

// ── Helpers ─────────────────────────────────────────────

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
  document.getElementById('toast-icon').textContent = type === 'success' ? '✅' : '❌';
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
  event.currentTarget.classList.add('active');
  const titles = { dashboard:'Dashboard', plants:'Danh sách cây trồng', schemas:'Cấu hình loại cây', media:'Thư viện Media' };
  document.getElementById('page-title').textContent = titles[page] || page;

  if (page === 'dashboard') loadDashboard();
  if (page === 'plants') loadPlants();
  if (page === 'schemas') loadSchemas();
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
    const [plants, schemas] = await Promise.all([
      api('/plants'),
      api('/schemas')
    ]);
    const healthy = plants.filter(p => p.health_status === 'Tốt').length;
    const watch = plants.filter(p => ['Cần chú ý','Bệnh'].includes(p.health_status)).length;
    document.getElementById('stat-plants').textContent = plants.length;
    document.getElementById('stat-healthy').textContent = healthy;
    document.getElementById('stat-watch').textContent = watch;
    document.getElementById('stat-schemas').textContent = schemas.length;

    const tbody = document.getElementById('dashboard-plants-table');
    const recent = plants.slice(0, 8);
    if (!recent.length) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fa fa-seedling"></i><p>Chưa có cây nào</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = recent.map(p => `
      <tr>
        <td>
          ${p.cover_image ? `<img src="${esc(p.cover_image)}" class="plant-cover">` :
            `<div class="plant-cover" style="display:inline-flex;align-items:center;justify-content:center;font-size:18px">🌱</div>`}
        </td>
        <td><strong>${esc(p.plant_type)}</strong><br><small style="color:var(--gray-400)">${esc(p.plant_variety||'')}</small></td>
        <td>${healthBadge(p.health_status)}</td>
        <td>${esc(p.location||'—')}</td>
        <td>${fmtDate(p.created_at)}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="openPlantModal(${p.id})">
            <i class="fa fa-pen"></i>
          </button>
        </td>
      </tr>`).join('');
  } catch (err) {
    toast('Lỗi tải dashboard: ' + err.message, 'error');
  }
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
          `<div class="plant-cover" style="width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;font-size:20px">🌱</div>`}</td>
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
  document.getElementById('plant-modal-title').textContent = id ? '✏️ Chỉnh sửa cây' : '🌱 Thêm cây mới';
  document.getElementById('public-url-section').style.display = 'none';

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
  ['f-plant-type','f-plant-variety','f-plant-age','f-location'].forEach(id => document.getElementById(id).value = '');
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
    const sel = document.getElementById('f-schema-id');
    sel.innerHTML = '<option value="">— Không dùng schema —</option>' +
      schemas.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  } catch { /* ignore */ }
}

async function openSchemaModal(id = null) {
  editingSchemaId = id;
  schemaFields = [];
  document.getElementById('schema-modal-title').textContent = id ? '✏️ Chỉnh sửa Schema' : '⚙️ Tạo Schema loại cây';
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
  const name = document.getElementById('s-name').value.trim();
  if (!name) { toast('Tên schema là bắt buộc!', 'error'); return; }
  const body = { name, description: document.getElementById('s-desc').value.trim(), fields: schemaFields };
  try {
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
