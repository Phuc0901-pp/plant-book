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
    const tbody = document.getElementById('plants-table');
    if (!plants.length) {
      tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><i class="fa fa-seedling"></i><p>Không có cây nào</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = plants.map(p => `
      <tr>
        <td><div class="plant-cover" style="width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;font-size:18px;color:var(--green);background:rgba(34,197,94,0.1);border-radius:10px;"><i class="fa-solid fa-seedling"></i></div></td>
        <td>
          <strong>${esc(p.tree_code || '—')}</strong>
          <br><small style="color:var(--gray-400)">ID: ${p.id}</small>
        </td>
        <td>
          <strong>${esc(p.plant_type)}</strong>
          ${p.plant_variety ? `<br><small style="color:var(--gray-400)">${esc(p.plant_variety)}</small>` : ''}
        </td>
        <td>${esc(p.farm_owner_name || '—')}</td>
        <td>${esc(p.farm_name || '—')}</td>
        <td>${esc(p.plant_age||'—')}</td>
        <td>${healthBadge(p.health_status)}</td>
        <td>${esc(p.location||'—')}</td>
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
