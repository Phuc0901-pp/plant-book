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

function closePlantModal() {
  document.getElementById('plant-modal').style.display = 'none';
  editingPlantId = null;
  window._currentPlantData = {};
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
