// ── Plants ─────────────────────────────────────────────────

async function loadPlants() {
  const search = document.getElementById('plant-search')?.value || '';
  const user = document.getElementById('plant-filter-user')?.value || 'all';
  const farm = document.getElementById('plant-filter-farm')?.value || 'all';
  const health = document.getElementById('plant-filter-health')?.value || '';
  
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (user && user !== 'all') params.append('user_id', user);
  if (farm && farm !== 'all') params.append('farm_id', farm);
  if (health) params.append('health_status', health);

  try {
    const plants = await api(`/plants?${params}`);
    const container = document.getElementById('plants-folder-container');
    if (!container) return;

    if (!plants || plants.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:40px; background:#ffffff; border-radius:14px; border:1px solid #e2e8f0; text-align:center;">
          <i class="fa-solid fa-seedling" style="font-size:36px; color:#94a3b8; margin-bottom:10px;"></i>
          <p style="font-size:14px; font-weight:700; color:#475569;">Không tìm thấy cây trồng phù hợp.</p>
        </div>`;
      return;
    }

    // Group plants by farm into folder structure
    const groupedByFarm = {};
    plants.forEach(p => {
      const farmKey = p.farm_id ? `farm_${p.farm_id}` : 'unassigned';
      if (!groupedByFarm[farmKey]) {
        groupedByFarm[farmKey] = {
          farm_id: p.farm_id,
          farm_name: p.farm_name || 'Cây trồng tự do (Chưa gán trang trại)',
          owner_name: p.farm_owner_name || '—',
          plants: []
        };
      }
      groupedByFarm[farmKey].plants.push(p);
    });

    let html = '';
    Object.values(groupedByFarm).forEach((group) => {
      const totHealthy = group.plants.filter(p => p.health_status === 'Tốt').length;
      const totWatch = group.plants.filter(p => p.health_status === 'Cần chú ý').length;
      const totSick = group.plants.filter(p => p.health_status === 'Bệnh').length;

      const folderId = `farm-folder-content-${group.farm_id || '0'}`;

      html += `
        <div class="farm-folder-card" style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:16px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.03);">
          <!-- Folder Header -->
          <div onclick="toggleFarmFolder('${folderId}')" style="background:linear-gradient(135deg, #0f172a, #1e293b); color:#ffffff; padding:14px 20px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <i class="fa-solid fa-folder-open" id="folder-icon-${folderId}" style="font-size:22px; color:#10b981;"></i>
              <div>
                <div style="font-size:15px; font-weight:800; color:#ffffff; display:flex; align-items:center; gap:8px;">
                  ${esc(group.farm_name)}
                  ${group.owner_name !== '—' ? `<span style="background:rgba(255,255,255,0.15); color:#e2e8f0; font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px;">👤 ${esc(group.owner_name)}</span>` : ''}
                </div>
                <div style="font-size:12px; color:#94a3b8; margin-top:2px;">Tổng quy mô: <strong>${group.plants.length} cây trồng</strong></div>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
              <div style="display:flex; gap:6px; font-size:11px; font-weight:700;">
                <span style="background:#ecfdf5; color:#047857; padding:3px 10px; border-radius:12px;">🟢 Tốt: ${totHealthy}</span>
                ${totWatch > 0 ? `<span style="background:#fffbeb; color:#b45309; padding:3px 10px; border-radius:12px;">🟡 Cần chú ý: ${totWatch}</span>` : ''}
                ${totSick > 0 ? `<span style="background:#fef2f2; color:#b91c1c; padding:3px 10px; border-radius:12px;">🔴 Bệnh: ${totSick}</span>` : ''}
              </div>
              <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openPlantModal(null, ${group.farm_id || 'null'})" style="font-size:12px; padding:5px 12px;">
                <i class="fa fa-plus"></i> Thêm cây
              </button>
              <i class="fa-solid fa-chevron-down" id="folder-arrow-${folderId}" style="color:#94a3b8; transition:transform 0.3s;"></i>
            </div>
          </div>

          <!-- Folder Body Content Table -->
          <div id="${folderId}" style="display:block; padding:0; border-top:1px solid #e2e8f0;">
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr style="background:#f8fafc; font-size:12px; color:#64748b; text-align:left;">
                  <th style="padding:10px 16px;">Mã cây</th>
                  <th>Loại &amp; Giống</th>
                  <th>Sức khỏe</th>
                  <th>Tuổi cây</th>
                  <th>Vị trí GPS</th>
                  <th style="width:140px; text-align:center;">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                ${group.plants.map(p => `
                  <tr style="border-bottom:1px solid #f1f5f9; font-size:13px;">
                    <td style="padding:12px 16px;">
                      <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:36px; height:36px; background:#ecfdf5; color:#10b981; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;">
                          <i class="fa-solid fa-tree"></i>
                        </div>
                        <div>
                          <strong style="color:#0f172a; font-size:13.5px;">#${esc(p.tree_code || p.id)}</strong>
                          <div style="font-size:10.5px; color:#94a3b8;">ID: ${p.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong style="color:#0f172a;">${esc(p.plant_type)}</strong>
                      ${p.plant_variety ? `<div style="font-size:11.5px; color:#64748b;">Giống: ${esc(p.plant_variety)}</div>` : ''}
                    </td>
                    <td>${healthBadge(p.health_status)}</td>
                    <td style="color:#475569;">${esc(p.plant_age || '—')}</td>
                    <td style="font-size:11.5px; color:#64748b;">
                      ${p.latitude && p.longitude ? `<i class="fa-solid fa-location-dot" style="color:#10b981;"></i> ${parseFloat(p.latitude).toFixed(4)}, ${parseFloat(p.longitude).toFixed(4)}` : '<span style="color:#cbd5e1;">Chưa định vị</span>'}
                    </td>
                    <td style="text-align:center;">
                      <div style="display:inline-flex; gap:6px;">
                        <button class="btn btn-secondary btn-sm" onclick="openPlantModal(${p.id})" title="Chỉnh sửa">
                          <i class="fa fa-pen"></i>
                        </button>
                        ${p.is_public ? `
                        <a href="/plant/${esc(p.public_slug)}" target="_blank" class="btn btn-primary btn-sm" title="Trang công khai">
                          <i class="fa fa-arrow-up-right-from-square"></i>
                        </a>` : ''}
                        <button class="btn btn-danger btn-sm" onclick="deletePlant(${p.id},'${esc(p.plant_type)}')" title="Xóa">
                          <i class="fa fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (err) {
    toast('Lỗi tải danh sách cây: ' + err.message, 'error');
  }
}

function toggleFarmFolder(folderId) {
  const content = document.getElementById(folderId);
  const icon = document.getElementById(`folder-icon-${folderId}`);
  const arrow = document.getElementById(`folder-arrow-${folderId}`);
  if (!content) return;

  if (content.style.display === 'none') {
    content.style.display = 'block';
    if (icon) icon.className = 'fa-solid fa-folder-open';
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  } else {
    content.style.display = 'none';
    if (icon) icon.className = 'fa-solid fa-folder-closed';
    if (arrow) arrow.style.transform = 'rotate(-90deg)';
  }
}

window.toggleFarmFolder = toggleFarmFolder;


let _plantFiltersLoaded = false;
async function initPlantFilters() {
  if (_plantFiltersLoaded) return;
  try {
    const [users, farms] = await Promise.all([
      api('/users'),
      api('/farms')
    ]);
    window._allFarmsCache = farms;
    
    const userSelect = document.getElementById('plant-filter-user');
    if (userSelect) {
      userSelect.innerHTML = '<option value="all">Tất cả khách hàng (nông hộ)</option>' +
        users.map(u => `<option value="${u.id}">${esc(u.full_name)} (${u.role === 'admin' ? 'Admin' : 'Nông hộ'})</option>`).join('');
    }
    
    updatePlantFarmFilterDropdown(farms);
    _plantFiltersLoaded = true;
  } catch (err) {
    console.error('Lỗi khởi tạo bộ lọc cây:', err);
  }
}

function updatePlantFarmFilterDropdown(farms) {
  const farmSelect = document.getElementById('plant-filter-farm');
  if (farmSelect) {
    farmSelect.innerHTML = '<option value="all">Tất cả trang trại</option>' +
      farms.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
  }
}

function onPlantUserFilterChange() {
  const userId = document.getElementById('plant-filter-user').value;
  const farms = window._allFarmsCache || [];
  
  if (userId === 'all') {
    updatePlantFarmFilterDropdown(farms);
  } else {
    const filteredFarms = farms.filter(f => f.user_id == userId);
    updatePlantFarmFilterDropdown(filteredFarms);
  }
  loadPlants();
}

async function openPlantModal(id = null, syncUrl = true) {
  editingPlantId = id;
  resetPlantForm();
  document.getElementById('plant-modal-title').innerHTML = id
    ? '<i class="fa-solid fa-pen" style="color:var(--green)"></i> Chỉnh sửa cây'
    : '<i class="fa-solid fa-seedling" style="color:var(--green)"></i> Thêm cây mới';
  document.getElementById('public-url-section').style.display = 'none';

  if (syncUrl && typeof window.syncAdminUrl === 'function') {
    window.syncAdminUrl({ modal: 'plant', id: id || null });
  }

  // Load farms dropdown
  await loadFarmsDropdown();

  if (id) {
    try {
      const plant = await api(`/plants/${id}`);
      document.getElementById('f-tree-code').value = plant.tree_code || '';
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

function closePlantModal(syncUrl = true) {
  document.getElementById('plant-modal').style.display = 'none';
  editingPlantId = null;
  window._currentPlantData = {};
  if (syncUrl && typeof window.syncAdminUrl === 'function') {
    window.syncAdminUrl({ modal: null, id: null });
  }
}

function resetPlantForm() {
  ['f-tree-code','f-plant-type','f-plant-variety','f-plant-age','f-location','f-farm-id','f-latitude','f-longitude'].forEach(id => {
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
    tree_code: document.getElementById('f-tree-code').value.trim(),
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
    if (typeof window.onPlantSavedHook === 'function') {
      window.onPlantSavedHook(plant);
    }
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


// ── Web Audio Feedback API for NFC Scan (Ding & Beep-beep) ─────────
let _adminAudioCtx = null;
function getAdminAudioContext() {
  if (!_adminAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) _adminAudioCtx = new AudioContextClass();
  }
  if (_adminAudioCtx && _adminAudioCtx.state === 'suspended') {
    _adminAudioCtx.resume();
  }
  return _adminAudioCtx;
}

function playAdminSuccessDing() {
  const soundEnabled = document.getElementById('nfc-inv-sound-toggle')?.checked ?? true;
  if (!soundEnabled) return;
  try {
    const ctx = getAdminAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch (_) {}
}

function playAdminDuplicateBeep() {
  const soundEnabled = document.getElementById('nfc-inv-sound-toggle')?.checked ?? true;
  if (navigator.vibrate) {
    try { navigator.vibrate([100, 50, 100]); } catch (_) {}
  }
  if (!soundEnabled) return;
  try {
    const ctx = getAdminAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch (_) {}
}

// ── NFC Inventory Management Controller ────────────────────────────
let _currentInvFarmId = null;
let _isContinuousScanning = false;
let _ndefReaderInstance = null;
let _nfcInventoryCache = [];

function getActiveAdminFarmId() {
  if (typeof currentDbSelectedFarmId !== 'undefined' && currentDbSelectedFarmId) {
    return currentDbSelectedFarmId;
  }
  if (typeof activeFarmId !== 'undefined' && activeFarmId) {
    return activeFarmId;
  }
  const dbFarmSel = document.getElementById('db-filter-farm');
  if (dbFarmSel && dbFarmSel.value) return parseInt(dbFarmSel.value);
  const plantFarmSel = document.getElementById('plant-filter-farm');
  if (plantFarmSel && plantFarmSel.value && plantFarmSel.value !== 'all') return parseInt(plantFarmSel.value);
  if (window._allFarmsCache && window._allFarmsCache.length > 0) return window._allFarmsCache[0].id;
  return null;
}

// ── Admin NFC Inventory Management (View & Modal) ────────────────
let _currentInvFarmId = null;
let _nfcInventoryCache = [];
let _isContinuousScanning = false;
let _isContinuousScanningPage = false;
let _ndefReaderInstance = null;
let _ndefReaderInstancePage = null;

function getActiveAdminFarmId() {
  if (typeof _currentInvFarmId !== 'undefined' && _currentInvFarmId) {
    return _currentInvFarmId;
  }
  if (typeof activeFarmId !== 'undefined' && activeFarmId) {
    return activeFarmId;
  }
  const dbFarmSel = document.getElementById('db-filter-farm');
  if (dbFarmSel && dbFarmSel.value) return parseInt(dbFarmSel.value);
  const nfcFarmSel = document.getElementById('db-nfc-filter-farm');
  if (nfcFarmSel && nfcFarmSel.value) return parseInt(nfcFarmSel.value);
  const plantFarmSel = document.getElementById('plant-filter-farm');
  if (plantFarmSel && plantFarmSel.value && plantFarmSel.value !== 'all') return parseInt(plantFarmSel.value);
  if (window._allFarmsCache && window._allFarmsCache.length > 0) return window._allFarmsCache[0].id;
  return null;
}

/**
 * Open Admin NFC Inventory directly in Database sub-tab from Sidebar or anywhere
 */
async function openAdminNfcInventoryView(farmId = null) {
  const targetFarmId = farmId || getActiveAdminFarmId();
  if (typeof showPage === 'function') {
    showPage('database');
  }
  if (typeof switchDatabaseTab === 'function') {
    setTimeout(() => {
      switchDatabaseTab('nfc');
      if (targetFarmId) {
        const sel = document.getElementById('db-nfc-filter-farm');
        if (sel) sel.value = targetFarmId;
        onAdminNfcFarmChange(targetFarmId);
      }
    }, 50);
  }
}
window.openAdminNfcInventoryView = openAdminNfcInventoryView;

/**
 * Initialize Admin NFC Page View (called when clicking db-tab-nfc)
 */
async function initAdminNfcPage(farmId = null) {
  const sel = document.getElementById('db-nfc-filter-farm');
  const farms = window._allFarmsCache || (typeof dbFarmsCache !== 'undefined' ? dbFarmsCache : []);
  if (sel && farms.length > 0 && sel.options.length <= 1) {
    sel.innerHTML = '<option value="">— Vui lòng chọn Trang trại —</option>' +
      farms.map(f => `<option value="${f.id}">🏡 ${esc(f.name)} ${f.owner_name ? `(${esc(f.owner_name)})` : ''}</option>`).join('');
  }

  const targetFarmId = farmId || (sel && sel.value ? parseInt(sel.value) : getActiveAdminFarmId());
  if (targetFarmId) {
    if (sel) sel.value = targetFarmId;
    _currentInvFarmId = targetFarmId;
    await loadAdminNfcPageData(targetFarmId);
  } else if (farms.length > 0) {
    const firstId = farms[0].id;
    if (sel) sel.value = firstId;
    _currentInvFarmId = firstId;
    await loadAdminNfcPageData(firstId);
  }
}
window.initAdminNfcPage = initAdminNfcPage;

async function onAdminNfcFarmChange(farmId) {
  if (!farmId) return;
  const numId = parseInt(farmId);
  _currentInvFarmId = numId;
  await loadAdminNfcPageData(numId);
}
window.onAdminNfcFarmChange = onAdminNfcFarmChange;

async function onAdminNfcModalFarmSelect(farmId) {
  if (!farmId) return;
  const numId = parseInt(farmId);
  _currentInvFarmId = numId;
  await loadNfcInventoryData(numId);
}
window.onAdminNfcModalFarmSelect = onAdminNfcModalFarmSelect;

async function refreshAdminNfcData() {
  if (_currentInvFarmId) {
    await loadAdminNfcPageData(_currentInvFarmId);
    toast('Đã làm mới dữ liệu kho thẻ NFC!');
  }
}
window.refreshAdminNfcData = refreshAdminNfcData;

async function loadAdminNfcPageData(farmId) {
  try {
    const farms = window._allFarmsCache || (typeof dbFarmsCache !== 'undefined' ? dbFarmsCache : []);
    const farmObj = farms.find(f => f.id == farmId);
    const titleEl = document.getElementById('db-nfc-active-farm-title');
    if (titleEl) {
      titleEl.textContent = farmObj ? `Kho Thẻ NFC: ${farmObj.name}` : `Kho Thẻ NFC: Trang trại #${farmId}`;
    }

    const res = await api(`/plants/farms/${farmId}/nfc-inventory`);
    _nfcInventoryCache = res.tags || [];

    const totalEl = document.getElementById('db-nfc-total-count');
    const assignedEl = document.getElementById('db-nfc-assigned-count');
    const unassignedEl = document.getElementById('db-nfc-unassigned-count');
    const badgeEl = document.getElementById('db-nfc-table-count-badge');

    if (totalEl) totalEl.textContent = res.stats?.total || 0;
    if (assignedEl) assignedEl.textContent = res.stats?.assigned || 0;
    if (unassignedEl) unassignedEl.textContent = res.stats?.unassigned || 0;
    if (badgeEl) badgeEl.textContent = `${res.stats?.total || 0} thẻ`;

    renderAdminNfcPageTable(_nfcInventoryCache);
  } catch (err) {
    toast('Lỗi tải danh sách kho thẻ: ' + err.message, 'error');
  }
}
window.loadAdminNfcPageData = loadAdminNfcPageData;

function renderAdminNfcPageTable(tags) {
  const tbody = document.getElementById('db-nfc-inventory-table-body');
  if (!tbody) return;

  if (!tags || tags.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:46px 20px; color:#94a3b8;">
          <i class="fa-solid fa-boxes-stacked" style="font-size:36px; margin-bottom:12px; display:inline-block; color:#cbd5e1;"></i>
          <p style="margin:0 0 6px 0; font-weight:800; font-size:14.5px; color:#475569;">Kho thẻ NFC của trang trại này đang trống (0 thẻ).</p>
          <small style="color:#94a3b8;">Hãy bật "Quét thẻ liên tục" hoặc dùng đầu đọc USB / nhập mã UID ở trên để nạp thẻ vào kho.</small>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = tags.map((t, idx) => {
    const isAssigned = t.status === 'assigned';
    const statusPill = isAssigned
      ? `<span style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:11.5px; font-weight:800; padding:4px 12px; border-radius:12px; display:inline-flex; align-items:center; gap:5px;"><i class="fa-solid fa-link"></i> Đã gán cây</span>`
      : `<span style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-size:11.5px; font-weight:800; padding:4px 12px; border-radius:12px; display:inline-flex; align-items:center; gap:5px;"><i class="fa-solid fa-check"></i> Còn trống (Sẵn sàng)</span>`;

    const plantInfo = isAssigned && t.tree_code
      ? `<strong style="color:#0f172a; font-size:13.5px;">#${esc(t.tree_code)}</strong> <span style="font-size:12px; color:#64748b; font-weight:600;">(${esc(t.plant_type || '')})</span>`
      : `<span style="color:#94a3b8; font-style:italic;">— Sẵn sàng gán —</span>`;

    const timeStr = t.scanned_at ? new Date(t.scanned_at).toLocaleString('vi-VN') : '—';

    return `
      <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
        <td style="padding:12px 14px; text-align:center; font-weight:800; color:#64748b;">${idx + 1}</td>
        <td style="padding:12px 14px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <code style="font-size:13px; font-weight:800; color:#065f46; background:#ecfdf5; border:1px solid #a7f3d0; padding:4px 10px; border-radius:6px; font-family:monospace;">${esc(t.nfc_uid)}</code>
            <button type="button" onclick="navigator.clipboard.writeText('${esc(t.nfc_uid)}'); toast('Đã copy UID: ${esc(t.nfc_uid)}');" title="Sao chép UID" style="border:none; background:transparent; color:#64748b; cursor:pointer; font-size:13px; padding:3px 6px;">
              <i class="fa-regular fa-copy"></i>
            </button>
          </div>
        </td>
        <td style="padding:12px 14px; text-align:center;">${statusPill}</td>
        <td style="padding:12px 14px;">${plantInfo}</td>
        <td style="padding:12px 14px; font-size:12.5px; color:#64748b; font-weight:600;">${timeStr}</td>
        <td style="padding:12px 14px; text-align:center;">
          <button type="button" onclick="deleteAdminNfcTag(${t.id}, '${esc(t.nfc_uid)}')" title="Xóa thẻ khỏi kho" style="border:none; background:#fee2e2; color:#dc2626; border-radius:8px; width:32px; height:32px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all 0.2s ease;">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterAdminNfcTable() {
  const q = (document.getElementById('db-nfc-table-search')?.value || '').trim().toLowerCase();
  if (!q) {
    renderAdminNfcPageTable(_nfcInventoryCache);
    return;
  }
  const filtered = _nfcInventoryCache.filter(t => {
    return (t.nfc_uid && t.nfc_uid.toLowerCase().includes(q)) ||
           (t.tree_code && String(t.tree_code).toLowerCase().includes(q)) ||
           (t.plant_type && t.plant_type.toLowerCase().includes(q));
  });
  renderAdminNfcPageTable(filtered);
}
window.filterAdminNfcTable = filterAdminNfcTable;

async function handleAdminPageQuickNfcInput(event) {
  if (event) event.preventDefault();
  handleAdminPageQuickNfcInputBtn();
}
window.handleAdminPageQuickNfcInput = handleAdminPageQuickNfcInput;

async function handleAdminPageQuickNfcInputBtn() {
  const inputEl = document.getElementById('db-nfc-quick-input');
  if (!inputEl) return;
  const uid = inputEl.value.trim();
  if (!uid) return;

  if (!_currentInvFarmId) {
    toast('Vui lòng chọn trang trại trước!', 'error');
    return;
  }

  try {
    const res = await api(`/plants/farms/${_currentInvFarmId}/nfc-inventory/batch`, {
      method: 'POST',
      body: JSON.stringify({ uids: [uid] })
    });

    if (res.added && res.added.length > 0) {
      playAdminSuccessDing();
      toast(`✅ Đã thêm thẻ ${uid} vào kho!`, 'success');
      inputEl.value = '';
      inputEl.focus();
      await loadAdminNfcPageData(_currentInvFarmId);
    } else if (res.duplicates && res.duplicates.length > 0) {
      playAdminDuplicateBeep();
      toast(`⚠️ Thẻ ${uid} đã tồn tại trong kho hoặc đã gán cây!`, 'error');
      inputEl.select();
    }
  } catch (err) {
    playAdminDuplicateBeep();
    toast(`Lỗi thêm thẻ: ${err.message}`, 'error');
    inputEl.select();
  }
}
window.handleAdminPageQuickNfcInputBtn = handleAdminPageQuickNfcInputBtn;

async function toggleContinuousNfcScanPage() {
  if (_isContinuousScanningPage) {
    stopContinuousNfcScanPage();
  } else {
    await startContinuousNfcScanPage();
  }
}
window.toggleContinuousNfcScanPage = toggleContinuousNfcScanPage;

async function startContinuousNfcScanPage() {
  if (!('NDEFReader' in window)) {
    alert('Trình duyệt hoặc thiết bị này không hỗ trợ Web NFC API trực tiếp (chỉ hỗ trợ Chrome trên Android qua HTTPS).\n\n💡 Bạn có thể dùng đầu đọc thẻ USB, máy quét barcode hoặc nhập trực tiếp mã UID vào ô bên dưới!');
    document.getElementById('db-nfc-quick-input')?.focus();
    return;
  }

  try {
    _ndefReaderInstancePage = new NDEFReader();
    await _ndefReaderInstancePage.scan();
    _isContinuousScanningPage = true;

    const btn = document.getElementById('btn-toggle-continuous-nfc-page');
    if (btn) {
      btn.style.background = '#dc2626';
      btn.innerHTML = '<i class="fa-solid fa-stop"></i> Dừng Quét Liên Tục';
    }

    const pill = document.getElementById('db-nfc-scan-status-pill');
    const text = document.getElementById('db-nfc-scan-status-text');
    if (pill) { pill.style.background = '#fef2f2'; pill.style.color = '#991b1b'; pill.style.borderColor = '#fca5a5'; }
    if (text) text.innerHTML = '<i class="fa-solid fa-rss fa-spin"></i> ĐANG QUÉT LIÊN TỤC — CHẠM THẺ VÀO LƯNG MÁY';

    _ndefReaderInstancePage.addEventListener('reading', async ({ serialNumber }) => {
      if (!serialNumber) return;
      const cleanUid = serialNumber.trim().toUpperCase();

      try {
        const res = await api(`/plants/farms/${_currentInvFarmId}/nfc-inventory/batch`, {
          method: 'POST',
          body: JSON.stringify({ uids: [cleanUid] })
        });

        if (res.added && res.added.length > 0) {
          playAdminSuccessDing();
          toast(`✨ Đã quẹt thành công thẻ: ${cleanUid}`, 'success');
          await loadAdminNfcPageData(_currentInvFarmId);
        } else {
          playAdminDuplicateBeep();
          toast(`⚠️ Trùng lặp: Thẻ ${cleanUid} đã có trong kho!`, 'error');
        }
      } catch (e) {
        playAdminDuplicateBeep();
        toast(`⚠️ ${e.message}`, 'error');
      }
    });

    toast('🚀 Đã kích hoạt Chế độ Quét liên tục. Hãy chạm lần lượt từng thẻ vào mặt sau điện thoại!');
  } catch (err) {
    stopContinuousNfcScanPage();
    alert('Không thể kích hoạt NFC: ' + err.message);
  }
}

function stopContinuousNfcScanPage() {
  _isContinuousScanningPage = false;
  _ndefReaderInstancePage = null;

  const btn = document.getElementById('btn-toggle-continuous-nfc-page');
  if (btn) {
    btn.style.background = 'linear-gradient(135deg, #10b981, #047857)';
    btn.innerHTML = '<i class="fa-solid fa-play"></i> Bật Quét Thẻ Liên Tục (Web NFC)';
  }

  const pill = document.getElementById('db-nfc-scan-status-pill');
  const text = document.getElementById('db-nfc-scan-status-text');
  if (pill) { pill.style.background = '#dcfce7'; pill.style.color = '#15803d'; pill.style.borderColor = '#86efac'; }
  if (text) text.textContent = 'Sẵn sàng nhập kho';
}

async function openNfcInventoryModal(farmId = null) {
  const targetFarmId = farmId || getActiveAdminFarmId();
  if (!targetFarmId) {
    toast('Vui lòng chọn hoặc tạo một Trang trại trước khi mở Kho Thẻ!', 'error');
    return;
  }
  _currentInvFarmId = targetFarmId;

  const farms = window._allFarmsCache || (typeof dbFarmsCache !== 'undefined' ? dbFarmsCache : []);
  const modalFarmSelect = document.getElementById('nfc-inv-farm-select');
  if (modalFarmSelect) {
    if (farms.length > 0) {
      modalFarmSelect.innerHTML = '<option value="">— Vui lòng chọn Trang trại —</option>' +
        farms.map(f => `<option value="${f.id}">🏡 ${esc(f.name)} ${f.owner_name ? `(${esc(f.owner_name)})` : ''}</option>`).join('');
    }
    modalFarmSelect.value = targetFarmId;
  }

  const modal = document.getElementById('nfc-inventory-modal');
  if (modal) modal.style.display = 'flex';

  await loadNfcInventoryData(targetFarmId);

  // Focus quick input
  setTimeout(() => {
    document.getElementById('nfc-inv-quick-input')?.focus();
  }, 200);
}
window.openNfcInventoryModal = openNfcInventoryModal;

function closeNfcInventoryModal() {
  if (_isContinuousScanning) {
    stopContinuousNfcScan();
  }
  const modal = document.getElementById('nfc-inventory-modal');
  if (modal) modal.style.display = 'none';
}
window.closeNfcInventoryModal = closeNfcInventoryModal;

async function loadNfcInventoryData(farmId) {
  try {
    const res = await api(`/plants/farms/${farmId}/nfc-inventory`);
    _nfcInventoryCache = res.tags || [];

    const totalEl = document.getElementById('nfc-inv-total-count');
    const assignedEl = document.getElementById('nfc-inv-assigned-count');
    const unassignedEl = document.getElementById('nfc-inv-unassigned-count');

    if (totalEl) totalEl.textContent = res.stats?.total || 0;
    if (assignedEl) assignedEl.textContent = res.stats?.assigned || 0;
    if (unassignedEl) unassignedEl.textContent = res.stats?.unassigned || 0;

    renderNfcInventoryTable(_nfcInventoryCache);
  } catch (err) {
    toast('Lỗi tải danh sách kho thẻ: ' + err.message, 'error');
  }
}

function renderNfcInventoryTable(tags) {
  const tbody = document.getElementById('nfc-inventory-table-body');
  if (!tbody) return;

  if (!tags || tags.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:36px; color:#94a3b8;">
          <i class="fa-solid fa-boxes-stacked" style="font-size:32px; margin-bottom:10px; display:inline-block; color:#cbd5e1;"></i>
          <p style="margin:0; font-weight:700; font-size:13.5px; color:#64748b;">Kho thẻ NFC của trang trại này chưa có thẻ nào.</p>
          <small style="color:#94a3b8;">Hãy bật chế độ quét liên tục hoặc quẹt thẻ USB để nạp cọc thẻ vào kho.</small>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = tags.map((t, idx) => {
    const isAssigned = t.status === 'assigned';
    const statusPill = isAssigned
      ? `<span style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:11px; font-weight:800; padding:3px 10px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-link"></i> Đã gán</span>`
      : `<span style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-size:11px; font-weight:800; padding:3px 10px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-check"></i> Chưa gán</span>`;

    const plantInfo = isAssigned && t.tree_code
      ? `<strong style="color:#0f172a;">#${esc(t.tree_code)}</strong> <span style="font-size:11px; color:#64748b;">(${esc(t.plant_type || '')})</span>`
      : `<span style="color:#94a3b8;">— Sẵn sàng gán —</span>`;

    const timeStr = t.scanned_at ? new Date(t.scanned_at).toLocaleString('vi-VN') : '—';

    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 12px; text-align:center; font-weight:700; color:#64748b;">${idx + 1}</td>
        <td style="padding:10px 12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <code style="font-size:13px; font-weight:800; color:#065f46; background:#ecfdf5; border:1px solid #a7f3d0; padding:3px 8px; border-radius:6px; font-family:monospace;">${esc(t.nfc_uid)}</code>
            <button type="button" onclick="navigator.clipboard.writeText('${esc(t.nfc_uid)}'); toast('Đã copy mã UID: ${esc(t.nfc_uid)}');" title="Sao chép UID" style="border:none; background:transparent; color:#64748b; cursor:pointer; font-size:12px; padding:2px 4px;">
              <i class="fa-regular fa-copy"></i>
            </button>
          </div>
        </td>
        <td style="padding:10px 12px; text-align:center;">${statusPill}</td>
        <td style="padding:10px 12px;">${plantInfo}</td>
        <td style="padding:10px 12px; font-size:12px; color:#64748b;">${timeStr}</td>
        <td style="padding:10px 12px; text-align:center;">
          <button type="button" onclick="deleteAdminNfcTag(${t.id}, '${esc(t.nfc_uid)}')" title="Xóa thẻ khỏi kho" style="border:none; background:#fee2e2; color:#dc2626; border-radius:6px; width:30px; height:30px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all 0.2s ease;">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleQuickNfcInput(event) {
  if (event) event.preventDefault();
  handleQuickNfcInputBtn();
}
window.handleQuickNfcInput = handleQuickNfcInput;

async function handleQuickNfcInputBtn() {
  const inputEl = document.getElementById('nfc-inv-quick-input');
  if (!inputEl) return;
  const uid = inputEl.value.trim();
  if (!uid) return;

  if (!_currentInvFarmId) {
    toast('Chưa xác định trang trại!', 'error');
    return;
  }

  try {
    const res = await api(`/plants/farms/${_currentInvFarmId}/nfc-inventory/batch`, {
      method: 'POST',
      body: JSON.stringify({ uids: [uid] })
    });

    if (res.added && res.added.length > 0) {
      playAdminSuccessDing();
      toast(`✅ Đã thêm thẻ ${uid} vào kho!`, 'success');
      inputEl.value = '';
      inputEl.focus();
      await loadNfcInventoryData(_currentInvFarmId);
    } else if (res.duplicates && res.duplicates.length > 0) {
      playAdminDuplicateBeep();
      toast(`⚠️ Thẻ ${uid} đã tồn tại trong kho hoặc đã gán cây!`, 'error');
      inputEl.select();
    }
  } catch (err) {
    playAdminDuplicateBeep();
    toast(`Lỗi thêm thẻ: ${err.message}`, 'error');
    inputEl.select();
  }
}
window.handleQuickNfcInputBtn = handleQuickNfcInputBtn;

async function toggleContinuousNfcScan() {
  if (_isContinuousScanning) {
    stopContinuousNfcScan();
  } else {
    await startContinuousNfcScan();
  }
}
window.toggleContinuousNfcScan = toggleContinuousNfcScan;

async function startContinuousNfcScan() {
  if (!('NDEFReader' in window)) {
    alert('Trình duyệt hoặc thiết bị này không hỗ trợ Web NFC API trực tiếp (chỉ hỗ trợ Chrome trên Android qua HTTPS).\n\n💡 Bạn có thể dùng đầu đọc thẻ USB, máy quét cầm tay hoặc nhập trực tiếp mã UID vào ô bên dưới!');
    document.getElementById('nfc-inv-quick-input')?.focus();
    return;
  }

  try {
    _ndefReaderInstance = new NDEFReader();
    await _ndefReaderInstance.scan();
    _isContinuousScanning = true;

    const btn = document.getElementById('btn-toggle-continuous-nfc');
    if (btn) {
      btn.style.background = '#dc2626';
      btn.innerHTML = '<i class="fa-solid fa-stop"></i> Dừng Quét Liên Tục';
    }

    const pill = document.getElementById('nfc-scan-status-pill');
    const text = document.getElementById('nfc-scan-status-text');
    if (pill) { pill.style.background = '#fef2f2'; pill.style.color = '#991b1b'; pill.style.borderColor = '#fca5a5'; }
    if (text) text.innerHTML = '<i class="fa-solid fa-rss fa-spin"></i> ĐANG QUÉT LIÊN TỤC — CHẠM THẺ VÀO LƯNG MÁY';

    _ndefReaderInstance.addEventListener('reading', async ({ serialNumber }) => {
      if (!serialNumber) return;
      const cleanUid = serialNumber.trim().toUpperCase();

      try {
        const res = await api(`/plants/farms/${_currentInvFarmId}/nfc-inventory/batch`, {
          method: 'POST',
          body: JSON.stringify({ uids: [cleanUid] })
        });

        if (res.added && res.added.length > 0) {
          playAdminSuccessDing();
          toast(`✨ Đã quẹt thành công thẻ: ${cleanUid}`, 'success');
          await loadNfcInventoryData(_currentInvFarmId);
        } else {
          playAdminDuplicateBeep();
          toast(`⚠️ Trùng lặp: Thẻ ${cleanUid} đã có trong kho!`, 'error');
        }
      } catch (e) {
        playAdminDuplicateBeep();
        toast(`⚠️ ${e.message}`, 'error');
      }
    });

    toast('🚀 Đã kích hoạt Chế độ Quét liên tục. Hãy chạm lần lượt từng thẻ vào mặt sau điện thoại!');
  } catch (err) {
    stopContinuousNfcScan();
    alert('Không thể kích hoạt NFC: ' + err.message);
  }
}

function stopContinuousNfcScan() {
  _isContinuousScanning = false;
  _ndefReaderInstance = null;

  const btn = document.getElementById('btn-toggle-continuous-nfc');
  if (btn) {
    btn.style.background = 'linear-gradient(135deg, #10b981, #047857)';
    btn.innerHTML = '<i class="fa-solid fa-play"></i> Bật Quét Thẻ Liên Tục (Web NFC)';
  }

  const pill = document.getElementById('nfc-scan-status-pill');
  const text = document.getElementById('nfc-scan-status-text');
  if (pill) { pill.style.background = '#dcfce7'; pill.style.color = '#15803d'; pill.style.borderColor = '#86efac'; }
  if (text) text.textContent = 'Chế độ sẵn sàng';
}

async function deleteAdminNfcTag(tagId, uid) {
  if (!confirm(`Xóa thẻ NFC "${uid}" khỏi kho trang trại?`)) return;
  try {
    await api(`/plants/farms/${_currentInvFarmId}/nfc-inventory/${tagId}`, { method: 'DELETE' });
    toast('Đã xóa thẻ khỏi kho thành công.');
    if (_currentInvFarmId) {
      await loadNfcInventoryData(_currentInvFarmId);
      await loadAdminNfcPageData(_currentInvFarmId);
    }
  } catch (err) {
    toast('Lỗi xóa thẻ: ' + err.message, 'error');
  }
}
window.deleteAdminNfcTag = deleteAdminNfcTag;

// ── In-Field Walk & GPS Tagging Controller ──────────────────────────
let _fieldTagFarmId = null;
let _fieldTagPlants = [];
let _fieldTagIndex = 0;
let _fieldCurrentGps = { lat: null, lng: null, accuracy: null };

async function openFieldTaggingModal(farmId = null) {
  const targetFarmId = farmId || getActiveAdminFarmId();
  if (!targetFarmId) {
    toast('Vui lòng chọn Trang trại trước khi đi vườn gán thẻ!', 'error');
    return;
  }
  _fieldTagFarmId = targetFarmId;

  const farmObj = (window._allFarmsCache || []).find(f => f.id == targetFarmId);
  const farmNameEl = document.getElementById('field-tag-farm-name');
  if (farmNameEl) farmNameEl.textContent = farmObj ? farmObj.name : `Trang trại #${targetFarmId}`;

  // Fetch plants of this farm
  try {
    const plants = await api(`/plants?farm_id=${targetFarmId}`);
    _fieldTagPlants = (plants || []).sort((a,b) => {
      const codeA = parseInt(a.tree_code || a.id) || a.id;
      const codeB = parseInt(b.tree_code || b.id) || b.id;
      return codeA - codeB;
    });
    _fieldTagIndex = 0;
  } catch (e) {
    _fieldTagPlants = [];
  }

  const modal = document.getElementById('field-tagging-modal');
  if (modal) modal.style.display = 'flex';

  renderCurrentFieldTree();
  refreshFieldGps();
}
window.openFieldTaggingModal = openFieldTaggingModal;

function closeFieldTaggingModal() {
  const modal = document.getElementById('field-tagging-modal');
  if (modal) modal.style.display = 'none';
  if (typeof loadPlants === 'function') loadPlants();
}
window.closeFieldTaggingModal = closeFieldTaggingModal;

function renderCurrentFieldTree() {
  if (!_fieldTagPlants || _fieldTagPlants.length === 0) {
    const treeDisplay = document.getElementById('field-tag-current-tree-display');
    if (treeDisplay) treeDisplay.innerHTML = '<span style="color:#ef4444;">Trang trại chưa có cây nào. Hãy tạo cây trước!</span>';
    return;
  }

  const p = _fieldTagPlants[_fieldTagIndex];
  if (!p) return;

  const treeCodeEl = document.getElementById('field-tag-tree-code');
  const plantTypeEl = document.getElementById('field-tag-plant-type');
  const currentUidEl = document.getElementById('field-tag-current-uid');
  const urlPreviewEl = document.getElementById('field-tag-public-url-preview');
  const nextCodeEl = document.getElementById('field-tag-next-code');

  if (treeCodeEl) treeCodeEl.textContent = p.tree_code || p.id;
  if (plantTypeEl) plantTypeEl.textContent = `${p.plant_type || 'Cây'} ${p.plant_variety ? '— ' + p.plant_variety : ''}`;
  
  if (currentUidEl) {
    currentUidEl.textContent = p.nfc_uid ? `Thẻ đã gán: ${p.nfc_uid}` : 'Chưa gán thẻ NFC';
    currentUidEl.style.color = p.nfc_uid ? '#047857' : '#94a3b8';
  }

  const pubUrl = p.public_url || `https://plant-book.onrender.com/${p.farm_id || _fieldTagFarmId}/${p.id}${p.nfc_uid ? '/' + encodeURIComponent(p.nfc_uid) : ''}`;
  if (urlPreviewEl) {
    urlPreviewEl.innerHTML = `<a href="${pubUrl}" target="_blank" style="color:#7c3aed; text-decoration:none; font-weight:700;"><i class="fa-solid fa-link"></i> ${pubUrl}</a>`;
  }

  const nextPlant = _fieldTagPlants[_fieldTagIndex + 1];
  if (nextCodeEl) nextCodeEl.textContent = nextPlant ? (nextPlant.tree_code || nextPlant.id) : 'Hết danh sách';
}

function prevFieldTree() {
  if (_fieldTagIndex > 0) {
    _fieldTagIndex--;
    renderCurrentFieldTree();
  }
}
window.prevFieldTree = prevFieldTree;

function nextFieldTree() {
  if (_fieldTagIndex < _fieldTagPlants.length - 1) {
    _fieldTagIndex++;
    renderCurrentFieldTree();
  }
}
window.nextFieldTree = nextFieldTree;

function refreshFieldGps() {
  const latEl = document.getElementById('field-tag-lat');
  const lngEl = document.getElementById('field-tag-lng');
  const accEl = document.getElementById('field-tag-acc');

  if (latEl) latEl.textContent = 'Đang định vị GPS...';
  if (lngEl) lngEl.textContent = 'Đang định vị GPS...';
  if (accEl) accEl.textContent = 'Đang tính...';

  if (!navigator.geolocation) {
    if (latEl) latEl.textContent = '11.8333';
    if (lngEl) lngEl.textContent = '106.9167';
    if (accEl) accEl.textContent = '±10 m (Fallback)';
    _fieldCurrentGps = { lat: 11.8333, lng: 106.9167, accuracy: 10 };
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = pos.coords.accuracy;
      _fieldCurrentGps = { lat, lng, accuracy: acc };
      if (latEl) latEl.textContent = lat.toFixed(6);
      if (lngEl) lngEl.textContent = lng.toFixed(6);
      if (accEl) accEl.textContent = `±${Math.round(acc)} m`;
    },
    (err) => {
      console.warn('Field GPS error:', err);
      if (latEl) latEl.textContent = '11.8333';
      if (lngEl) lngEl.textContent = '106.9167';
      if (accEl) accEl.textContent = '±15 m (Ước lượng)';
      _fieldCurrentGps = { lat: 11.8333, lng: 106.9167, accuracy: 15 };
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}
window.refreshFieldGps = refreshFieldGps;

async function startFieldNfcTouch() {
  if (!_fieldTagPlants || _fieldTagPlants.length === 0) {
    toast('Chưa có cây trồng nào để gán thẻ!', 'error');
    return;
  }

  const currentPlant = _fieldTagPlants[_fieldTagIndex];
  if (!currentPlant) return;

  if (!('NDEFReader' in window)) {
    alert('Trình duyệt này không hỗ trợ Web NFC trực tiếp.\n\n💡 Vui lòng nhập mã UID thủ công vào ô bên dưới!');
    document.getElementById('field-tag-manual-uid')?.focus();
    return;
  }

  try {
    const ndef = new NDEFReader();
    await ndef.scan();
    toast('📡 Hãy chạm thẻ vào mặt sau điện thoại ngay...');

    ndef.addEventListener('reading', async ({ serialNumber }) => {
      if (!serialNumber) return;
      const cleanUid = serialNumber.trim().toUpperCase();
      await executeFieldTagAssign(currentPlant, cleanUid, ndef);
    }, { once: true });
  } catch (err) {
    alert('Lỗi kích hoạt NFC: ' + err.message);
  }
}
window.startFieldNfcTouch = startFieldNfcTouch;

async function submitFieldTagManual() {
  const input = document.getElementById('field-tag-manual-uid');
  if (!input) return;
  const uid = input.value.trim();
  if (!uid) {
    toast('Vui lòng nhập mã thẻ NFC!', 'error');
    return;
  }
  const currentPlant = _fieldTagPlants[_fieldTagIndex];
  if (!currentPlant) return;

  await executeFieldTagAssign(currentPlant, uid, null);
  input.value = '';
}
window.submitFieldTagManual = submitFieldTagManual;

async function executeFieldTagAssign(plant, uid, ndefInstance) {
  try {
    const lat = _fieldCurrentGps.lat || 11.8333;
    const lng = _fieldCurrentGps.lng || 106.9167;

    const res = await api(`/plants/farms/${_fieldTagFarmId}/tag-nfc-gps`, {
      method: 'POST',
      body: JSON.stringify({
        plant_id: plant.id,
        nfc_uid: uid,
        latitude: lat,
        longitude: lng
      })
    });

    playAdminSuccessDing();
    toast(`🎉 Đã gán thẻ ${uid} và lưu GPS cho Cây #${plant.tree_code || plant.id}!`, 'success');

    // Attempt to write NDEF URL to NFC tag
    if (ndefInstance && res.plant?.public_url) {
      try {
        await ndefInstance.write({
          records: [{ recordType: 'url', data: res.plant.public_url }]
        });
        toast('📝 Đã ghi đường dẫn Public vào chip NFC thành công!', 'success');
      } catch (writeErr) {
        console.warn('NDEF write skipped/failed:', writeErr);
      }
    }

    // Update local cached plant
    plant.nfc_uid = uid;
    plant.latitude = lat;
    plant.longitude = lng;
    plant.public_url = res.plant?.public_url || generatePublicPlantUrl(_fieldTagFarmId, plant.id, uid);

    renderCurrentFieldTree();

    // Check auto advance
    const autoNext = document.getElementById('field-tag-auto-next')?.checked;
    if (autoNext && _fieldTagIndex < _fieldTagPlants.length - 1) {
      setTimeout(() => {
        nextFieldTree();
        refreshFieldGps();
      }, 1000);
    }
  } catch (err) {
    playAdminDuplicateBeep();
    toast('Lỗi gán thẻ: ' + err.message, 'error');
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
