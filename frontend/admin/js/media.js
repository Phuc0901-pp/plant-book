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
              <option value="Tưới nước">Tưới cây</option>
              <option value="Bón phân">Bón phân</option>
              <option value="Phun thuốc">Phun thuốc</option>
              <option value="Cắt lá">Cắt cành/lá</option>
              <option value="Tỉa hoa">Tỉa hoa/quả</option>
              <option value="Bệnh cây">Bệnh cây</option>
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

// ── Global Media Library (Phase 2) ───────────────────────────

let allMediaUsers = [];
let allMediaFarms = [];
let allMediaPlants = [];
let currentMediaTab = 'all'; // 'all' or 'pending'

async function initGlobalMediaLibrary() {
  try {
    // 1. Fetch filter metadata
    allMediaUsers = await api('/users');
    allMediaFarms = await api('/farms');
    allMediaPlants = await api('/plants');

    // 2. Populate user dropdown
    const userSelect = document.getElementById('media-filter-user');
    userSelect.innerHTML = '<option value="">Tất cả nông hộ</option>' + 
      allMediaUsers.filter(u => u.role === 'user').map(u => `<option value="${u.id}">${esc(u.full_name)} (${esc(u.email)})</option>`).join('');

    // 3. Populate farm dropdown
    const farmSelect = document.getElementById('media-filter-farm');
    farmSelect.innerHTML = '<option value="">Tất cả trang trại</option>' +
      allMediaFarms.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');

    // 4. Populate plant dropdown
    const plantSelect = document.getElementById('media-filter-plant');
    plantSelect.innerHTML = '<option value="">Tất cả cây trồng</option>' +
      allMediaPlants.map(p => `<option value="${p.id}">Cây #${p.tree_code || p.id} (${esc(p.plant_type)})</option>`).join('');

    // Reset tab to all
    switchMediaTab('all');
  } catch (err) {
    console.error('Error initializing media library:', err);
  }
}

function switchMediaTab(tab) {
  currentMediaTab = tab;
  document.getElementById('media-tab-all').classList.toggle('active', tab === 'all');
  document.getElementById('media-tab-pending').classList.toggle('active', tab === 'pending');
  loadGlobalMediaGallery();
}

async function onMediaFilterChange() {
  const userId = document.getElementById('media-filter-user').value;
  const farmSelect = document.getElementById('media-filter-farm');
  const plantSelect = document.getElementById('media-filter-plant');

  // Filter farms by User
  let filteredFarms = allMediaFarms;
  if (userId) {
    filteredFarms = allMediaFarms.filter(f => f.user_id == userId);
    const currentFarmVal = farmSelect.value;
    if (currentFarmVal && !filteredFarms.some(f => f.id == currentFarmVal)) {
      farmSelect.value = '';
    }
  }
  farmSelect.innerHTML = '<option value="">Tất cả trang trại</option>' +
    filteredFarms.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');

  // Filter plants by Farm (and implicitly User)
  let filteredPlants = allMediaPlants;
  const activeFarmId = farmSelect.value;
  if (activeFarmId) {
    filteredPlants = allMediaPlants.filter(p => p.farm_id == activeFarmId);
  } else if (userId) {
    const userFarmIds = filteredFarms.map(f => f.id);
    filteredPlants = allMediaPlants.filter(p => userFarmIds.includes(p.farm_id));
  }

  const currentPlantVal = plantSelect.value;
  if (currentPlantVal && !filteredPlants.some(p => p.id == currentPlantVal)) {
    plantSelect.value = '';
  }
  plantSelect.innerHTML = '<option value="">Tất cả cây trồng</option>' +
    filteredPlants.map(p => `<option value="${p.id}">Cây #${p.tree_code || p.id} (${esc(p.plant_type)})</option>`).join('');

  loadGlobalMediaGallery();
}

async function loadGlobalMediaGallery() {
  const userId = document.getElementById('media-filter-user').value;
  const farmId = document.getElementById('media-filter-farm').value;
  const plantId = document.getElementById('media-filter-plant').value;

  const queryParams = new URLSearchParams();
  if (userId) queryParams.set('user_id', userId);
  if (farmId) queryParams.set('farm_id', farmId);
  if (plantId) queryParams.set('plant_id', plantId);
  if (currentMediaTab === 'pending') {
    queryParams.set('pending_only', 'true');
  }

  const grid = document.getElementById('media-gallery-grid');
  const empty = document.getElementById('media-gallery-empty');

  grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--gray-400);"><i class="fa fa-spinner fa-spin" style="font-size:24px; margin-bottom:8px; display:block;"></i> Đang tải phương tiện...</div>';
  empty.style.display = 'none';

  try {
    const mediaList = await api(`/plants/media/all?${queryParams.toString()}`);
    if (mediaList.length === 0) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    grid.innerHTML = mediaList.map(m => {
      const typeLabel = m.media_type === 'video' ? 'Video' : 'Ảnh';
      const treeLabel = `Cây #${m.tree_code || m.plant_id} (${m.plant_type})`;
      const farmLabel = m.farm_name || 'Vườn khác';
      const ownerLabel = m.owner_name ? ` · ${m.owner_name}` : '';

      let actionButtonsHtml = '';
      if (currentMediaTab === 'pending') {
        actionButtonsHtml = `
          <div style="margin-top: 8px; display: flex; gap: 8px;">
            <button onclick="approveDeleteMedia(${m.plant_id}, ${m.id})" class="btn btn-danger btn-sm" style="flex: 1; padding: 4px; font-size: 11px;">
              <i class="fa fa-check"></i> Duyệt xóa
            </button>
            <button onclick="rejectDeleteMedia(${m.plant_id}, ${m.id})" class="btn btn-secondary btn-sm" style="flex: 1; padding: 4px; font-size: 11px;">
              <i class="fa fa-rotate-left"></i> Khôi phục
            </button>
          </div>
        `;
      } else {
        // In All tab, admin can delete permanently directly if they wish
        actionButtonsHtml = `
          <div style="font-size: 10px; color: var(--gray-400); margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span>${fmtDate(m.uploaded_at)}</span>
            <button onclick="approveDeleteMedia(${m.plant_id}, ${m.id}, true)" style="border: none; background: none; color: var(--red); cursor: pointer; padding: 2px;" title="Xóa vĩnh viễn">
              <i class="fa fa-trash-can"></i>
            </button>
          </div>
        `;
      }

      return `
        <div class="media-card-item" style="border: 1px solid var(--gray-200); border-radius: 12px; background: #fff; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03); display: flex; flex-direction: column;">
          <div style="position: relative; width: 100%; padding-top: 75%; background: #000; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; align-items: center;">
              ${m.media_type === 'video'
                ? `<video src="${esc(m.url)}" controls style="max-width: 100%; max-height: 100%;"></video>`
                : `<img src="${esc(m.url)}" alt="${esc(m.caption||'')}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" onclick="window.open('${esc(m.url)}')">`
              }
            </div>
            <span style="position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.6); color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">
              ${typeLabel}
            </span>
          </div>
          <div style="padding: 12px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 12px; font-weight: bold; color: var(--text-main); margin-bottom: 2px;">${esc(treeLabel)}</div>
              <div style="font-size: 11px; color: var(--gray-500);"><i class="fa fa-location-dot" style="margin-right:2px"></i> ${esc(farmLabel)}${esc(ownerLabel)}</div>
            </div>
            ${actionButtonsHtml}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: var(--red);"><i class="fa fa-circle-xmark" style="font-size:24px; margin-bottom:8px; display:block;"></i> Lỗi: ${esc(err.message)}</div>`;
  }
}

async function approveDeleteMedia(plantId, mediaId, direct = false) {
  const msg = direct ? 'Xóa vĩnh viễn ảnh/video này?' : 'Duyệt yêu cầu và xóa vĩnh viễn ảnh/video này khỏi hệ thống?';
  if (!confirm(msg)) return;
  try {
    await api(`/plants/${plantId}/media/${mediaId}`, { method: 'DELETE' });
    toast('Đã xóa vĩnh viễn media thành công!');
    await loadGlobalMediaGallery();
  } catch (err) {
    toast('Lỗi xóa: ' + err.message, 'error');
  }
}

async function rejectDeleteMedia(plantId, mediaId) {
  if (!confirm('Khôi phục ảnh/video này (Từ chối xóa)?')) return;
  try {
    await api(`/plants/${plantId}/media/${mediaId}/reject-delete`, { method: 'POST' });
    toast('Đã từ chối xóa và khôi phục ảnh thành công!');
    await loadGlobalMediaGallery();
  } catch (err) {
    toast('Lỗi khôi phục: ' + err.message, 'error');
  }
}

