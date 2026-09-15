// ── Media ─────────────────────────────────────────────────

function renderMediaSection(plantId) {
  return `
    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:18px; margin-bottom:16px; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
      <div class="media-dropzone" id="upload-zone-${plantId}" onclick="document.getElementById('file-input-${plantId}').click()"
        ondragover="event.preventDefault();this.classList.add('drag')"
        ondragleave="this.classList.remove('drag')"
        ondrop="handleDrop(event,${plantId})"
        style="border:2px dashed #34d399; border-radius:12px; padding:24px 16px; text-align:center; cursor:pointer; background:#f0fdf4; transition:all 0.2s;"
        onmouseover="this.style.background='#ecfdf5'; this.style.borderColor='#059669';"
        onmouseout="this.style.background='#f0fdf4'; this.style.borderColor='#34d399';">
        <div style="width:48px; height:48px; border-radius:50%; background:#dcfce7; color:#059669; display:inline-flex; align-items:center; justify-content:center; font-size:22px; margin-bottom:8px;">
          <i class="fa-solid fa-cloud-arrow-up"></i>
        </div>
        <div style="font-size:13.5px; font-weight:800; color:#065f46; margin-bottom:3px;">Nhấn hoặc kéo thả Ảnh / Video thực địa vào đây</div>
        <div style="font-size:11.5px; color:#047857;">Hỗ trợ: JPG, PNG, GIF, WebP, MP4, MOV (Tối đa 100MB/file)</div>
      </div>
      <input type="file" id="file-input-${plantId}" multiple accept="image/*,video/*" style="display:none"
        onchange="uploadMedia(${plantId}, this.files)">
    </div>
    <div class="card" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:18px; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
        <div style="font-size:13px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-images" style="color:#059669;"></i> Thư viện ảnh / video cây trồng
        </div>
        <span id="plant-media-header-count" style="font-size:11.5px; font-weight:700; color:#047857; background:#ecfdf5; padding:2px 8px; border-radius:6px; border:1px solid #a7f3d0;">0 tệp</span>
      </div>
      <div class="media-grid" id="media-grid-${plantId}" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:12px; margin-top:0;"></div>
    </div>
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
    const countBadge = document.getElementById('plant-media-count-badge');
    const headerCount = document.getElementById('plant-media-header-count');
    const count = plant.media?.length || 0;

    if (countBadge) {
      countBadge.textContent = count;
      countBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }
    if (headerCount) {
      headerCount.textContent = `${count} tệp`;
    }

    if (!grid) return;
    if (!plant.media?.length) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:32px 20px; background:#f8fafc; border-radius:12px; border:1.5px dashed #cbd5e1;">
          <i class="fa-solid fa-photo-film" style="font-size:32px; color:#94a3b8; margin-bottom:8px; display:inline-block;"></i>
          <p style="font-size:13px; font-weight:700; color:#475569; margin:0 0 4px 0;">Chưa có tệp ảnh hoặc video nào cho cây này.</p>
          <small style="color:#94a3b8;">Kéo thả ảnh thực địa hoặc nhấn vào khung tải lên phía trên.</small>
        </div>`;
      return;
    }
    grid.innerHTML = plant.media.map(m => `
      <div class="media-card-item" style="position:relative; border-radius:10px; overflow:hidden; border:1.5px solid #e2e8f0; background:#0f172a; box-shadow:0 2px 6px rgba(0,0,0,0.04); display:flex; flex-direction:column;">
        <div style="position:relative; width:100%; aspect-ratio:1; display:flex; align-items:center; justify-content:center; overflow:hidden; background:#0f172a;">
          ${m.media_type === 'video'
            ? `<video src="${esc(m.url)}" controls style="width:100%; height:100%; object-fit:cover;"></video>`
            : `<img src="${esc(m.url)}" alt="${esc(m.caption||'')}" style="width:100%; height:100%; object-fit:cover; cursor:pointer;" onclick="window.open('${esc(m.url)}', '_blank')">`
          }
          <span style="position:absolute; top:6px; left:6px; background:rgba(0,0,0,0.7); color:#ffffff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px);">
            ${m.media_type === 'video' ? '🎬 Video' : '📷 Ảnh'}
          </span>
          <button onclick="deleteMedia(${plantId},${m.id})" title="Xóa tệp" style="position:absolute; top:6px; right:6px; width:26px; height:26px; border-radius:50%; background:rgba(239,68,68,0.9); color:#ffffff; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; transition:transform 0.15s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
        <div style="padding:6px 8px; background:#ffffff; display:flex; justify-content:space-between; align-items:center; gap:4px; border-top:1px solid #f1f5f9;">
          <span style="font-size:11px; font-weight:700; color:#334155; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${esc(m.caption || 'Phương tiện')}">${esc(m.caption || (m.uploaded_at ? fmtDate(m.uploaded_at) : 'Ảnh thực địa'))}</span>
          <a href="${esc(m.url)}" target="_blank" download style="color:#059669; font-size:11.5px; text-decoration:none;" title="Tải về">
            <i class="fa-solid fa-arrow-down"></i>
          </a>
        </div>
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

function getAgronomicLogTypeBadge(type) {
  switch (type) {
    case 'Tưới nước':
      return { label: '💧 Tưới nước', style: 'background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;' };
    case 'Bón phân':
      return { label: '🌱 Bón phân', style: 'background:#ecfdf5; color:#047857; border:1px solid #a7f3d0;' };
    case 'Phun thuốc':
      return { label: '🧪 Phun thuốc BVTV', style: 'background:#fffbeb; color:#b45309; border:1px solid #fde68a;' };
    case 'Cắt lá':
    case 'Cắt cành/lá':
      return { label: '✂️ Cắt cành / Tỉa lá', style: 'background:#f5f3ff; color:#6d28d9; border:1px solid #ddd6fe;' };
    case 'Tỉa hoa':
    case 'Tỉa hoa/quả':
      return { label: '🌸 Tỉa hoa / Nuôi quả', style: 'background:#fdf2f8; color:#be185d; border:1px solid #fbcfe8;' };
    case 'Bệnh cây':
      return { label: '⚠️ Bệnh cây & Sâu bọ', style: 'background:#fef2f2; color:#b91c1c; border:1px solid #fecaca;' };
    case 'Thu hoạch':
      return { label: '🧺 Thu hoạch', style: 'background:#ecfeff; color:#0e7490; border:1px solid #a5f3fc;' };
    default:
      return { label: `📝 ${type || 'Ghi chú'}`, style: 'background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;' };
  }
}

function renderLogsSection(plantId) {
  return `
    <div class="card" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:18px; margin-bottom:16px; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
      <div style="font-size:13px; font-weight:800; color:#0f172a; margin-bottom:14px; display:flex; align-items:center; gap:8px; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
        <i class="fa-solid fa-pen-to-square" style="color:#059669;"></i> Ghi nhật ký chăm sóc / canh tác thực địa
      </div>
      <div class="form-row" style="margin-bottom:12px;">
        <div class="field" style="margin-bottom:0;">
          <label style="font-size:12px; font-weight:700; color:#334155; margin-bottom:5px;">Ngày thực hiện *</label>
          <input type="date" id="log-date-${plantId}" value="${new Date().toISOString().slice(0,10)}" style="border:1.5px solid #cbd5e1; border-radius:8px; padding:9px 12px; font-size:13px; font-weight:600; width:100%; box-sizing:border-box;">
        </div>
        <div class="field" style="margin-bottom:0;">
          <label style="font-size:12px; font-weight:700; color:#334155; margin-bottom:5px;">Loại công việc / Hoạt động *</label>
          <select id="log-type-${plantId}" style="border:1.5px solid #cbd5e1; border-radius:8px; padding:9px 12px; font-size:13px; font-weight:700; width:100%; box-sizing:border-box; background:#ffffff;">
            <option value="Tưới nước">💧 Tưới nước</option>
            <option value="Bón phân">🌱 Bón phân</option>
            <option value="Phun thuốc">🧪 Phun thuốc BVTV</option>
            <option value="Cắt lá">✂️ Cắt cành / Tỉa lá</option>
            <option value="Tỉa hoa">🌸 Tỉa hoa / Nuôi quả</option>
            <option value="Bệnh cây">⚠️ Bệnh cây &amp; Xử lý sâu bệnh</option>
            <option value="Thu hoạch">🧺 Thu hoạch trái</option>
            <option value="Ghi chú khác">📝 Ghi chú chung</option>
          </select>
        </div>
      </div>
      <div class="field" style="margin-bottom:12px;">
        <label style="font-size:12px; font-weight:700; color:#334155; margin-bottom:5px;">Chi tiết quan sát &amp; Nội dung thực hiện</label>
        <textarea id="log-note-${plantId}" rows="2" placeholder="VD: Bón 200g phân NPK 20-20-15, tưới đẫm nước quanh tán lá, cây phát triển tốt..." style="border:1.5px solid #cbd5e1; border-radius:8px; padding:9px 12px; font-size:13px; font-weight:500; width:100%; box-sizing:border-box; font-family:inherit; outline:none;"></textarea>
      </div>
      <button class="btn btn-primary btn-sm" onclick="addLog(${plantId})" style="background:linear-gradient(135deg, #10b981, #047857); border:none; font-weight:800; font-size:12.5px; padding:8px 16px; border-radius:8px; box-shadow:0 2px 6px rgba(16,185,129,0.3); cursor:pointer;">
        <i class="fa fa-plus"></i> Thêm nhật ký vào hồ sơ cây
      </button>
    </div>
    <div class="card" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:18px; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
        <div style="font-size:13px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-clock-rotate-left" style="color:#059669;"></i> Dòng thời gian nhật ký chăm sóc
        </div>
        <span id="plant-logs-header-count" style="font-size:11.5px; font-weight:700; color:#047857; background:#ecfdf5; padding:2px 8px; border-radius:6px; border:1px solid #a7f3d0;">0 nhật ký</span>
      </div>
      <div id="logs-list-${plantId}" style="display:flex; flex-direction:column; gap:10px;"></div>
    </div>
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
    const countBadge = document.getElementById('plant-logs-count-badge');
    const headerCount = document.getElementById('plant-logs-header-count');
    const count = plant.logs?.length || 0;

    if (countBadge) {
      countBadge.textContent = count;
      countBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }
    if (headerCount) {
      headerCount.textContent = `${count} nhật ký`;
    }

    if (!el) return;
    if (!plant.logs?.length) {
      el.innerHTML = `
        <div style="text-align:center; padding:32px 20px; background:#f8fafc; border-radius:12px; border:1.5px dashed #cbd5e1;">
          <i class="fa-solid fa-book-open" style="font-size:32px; color:#94a3b8; margin-bottom:8px; display:inline-block;"></i>
          <p style="font-size:13px; font-weight:700; color:#475569; margin:0 0 4px 0;">Chưa có nhật ký chăm sóc nào được ghi nhận.</p>
          <small style="color:#94a3b8;">Nhập thông tin chăm sóc vào biểu mẫu phía trên để bắt đầu ghi nhật ký.</small>
        </div>`;
      return;
    }
    el.innerHTML = plant.logs.map(l => {
      const badgeInfo = getAgronomicLogTypeBadge(l.log_type);
      return `
        <div class="log-item-card" style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:12px 14px; background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; transition:all 0.15s; box-shadow:0 1px 4px rgba(0,0,0,0.02);" onmouseover="this.style.borderColor='#cbd5e1'" onmouseout="this.style.borderColor='#e2e8f0'">
          <div style="display:flex; align-items:flex-start; gap:12px; flex:1;">
            <div style="padding:6px 10px; border-radius:8px; background:#f8fafc; border:1px solid #cbd5e1; text-align:center; flex-shrink:0;">
              <div style="font-size:9.5px; font-weight:800; color:#64748b; text-transform:uppercase;">NGÀY</div>
              <div style="font-size:12px; font-weight:800; color:#0f172a;">${fmtDate(l.log_date)}</div>
            </div>
            <div style="flex:1;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px; flex-wrap:wrap;">
                <span class="badge" style="${badgeInfo.style}; font-weight:700; font-size:11px; padding:2px 8px; border-radius:6px;">${esc(badgeInfo.label)}</span>
                ${l.creator_name ? `<span style="font-size:11px; color:#64748b; font-weight:600;"><i class="fa-solid fa-user-pen" style="color:#059669;"></i> ${esc(l.creator_name)}</span>` : ''}
              </div>
              <div style="font-size:13px; color:#334155; line-height:1.45; font-weight:500;">
                ${esc(l.note || 'Không có ghi chú chi tiết.')}
              </div>
            </div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="deleteLog(${plantId},${l.id})" style="padding:5px 9px; font-size:11px; border-radius:6px; background:#fee2e2; border:1px solid #fca5a5; color:#b91c1c; cursor:pointer;" title="Xóa nhật ký này">
            <i class="fa fa-trash"></i>
          </button>
        </div>
      `;
    }).join('');
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

// ── Global Media Library (Phase 2 & 5-Level Folder Hierarchy) ───────────────────

let allMediaUsers = [];
let allMediaFarms = [];
let allMediaPlants = [];
let currentMediaTab = 'all'; // 'all' or 'pending'
let mediaViewMode = 'folder'; // 'folder' or 'grid'
let currentFolderPath = []; // Folder breadcrumb path array e.g. [{level:'user', id:1, name:'...'}, ...]
let globalMediaCache = [];

function setMediaViewMode(mode) {
  mediaViewMode = mode;
  const btnFolder = document.getElementById('btn-media-mode-folder');
  const btnGrid = document.getElementById('btn-media-mode-grid');
  
  if (btnFolder) {
    btnFolder.style.background = (mode === 'folder') ? '#059669' : 'transparent';
    btnFolder.style.color = (mode === 'folder') ? '#ffffff' : '#475569';
    btnFolder.style.fontWeight = (mode === 'folder') ? '800' : '700';
  }
  if (btnGrid) {
    btnGrid.style.background = (mode === 'grid') ? '#059669' : 'transparent';
    btnGrid.style.color = (mode === 'grid') ? '#ffffff' : '#475569';
    btnGrid.style.fontWeight = (mode === 'grid') ? '800' : '700';
  }

  renderMediaView();
}

async function initGlobalMediaLibrary() {
  try {
    allMediaUsers = await api('/users');
    allMediaFarms = await api('/farms');
    allMediaPlants = await api('/plants');

    const userSelect = document.getElementById('media-filter-user');
    if (userSelect) {
      userSelect.innerHTML = '<option value="">1. Tất cả nông hộ (Khách hàng)</option>' + 
        allMediaUsers.filter(u => u.role === 'user').map(u => `<option value="${u.id}">👤 ${esc(u.full_name)} (${esc(u.phone || u.email)})</option>`).join('');
    }

    const farmSelect = document.getElementById('media-filter-farm');
    if (farmSelect) {
      farmSelect.innerHTML = '<option value="">2. Tất cả trang trại</option>' +
        allMediaFarms.map(f => `<option value="${f.id}">🏡 ${esc(f.name)}</option>`).join('');
    }

    const plantSelect = document.getElementById('media-filter-plant');
    if (plantSelect) {
      plantSelect.innerHTML = '<option value="">3. Tất cả cây trồng</option>' +
        allMediaPlants.map(p => `<option value="${p.id}">🌳 Cây #${p.tree_code || p.id} (${esc(p.plant_type)})</option>`).join('');
    }

    switchMediaTab('all');
  } catch (err) {
    console.error('Error initializing media library:', err);
  }
}

function switchMediaTab(tab) {
  currentMediaTab = tab;
  document.getElementById('media-tab-all')?.classList.toggle('active', tab === 'all');
  document.getElementById('media-tab-pending')?.classList.toggle('active', tab === 'pending');
  currentFolderPath = [];
  loadGlobalMediaGallery();
}

async function onMediaFilterChange() {
  const userId = document.getElementById('media-filter-user')?.value;
  const farmSelect = document.getElementById('media-filter-farm');
  const plantSelect = document.getElementById('media-filter-plant');

  let filteredFarms = allMediaFarms;
  if (userId) {
    filteredFarms = allMediaFarms.filter(f => f.user_id == userId);
    if (farmSelect && farmSelect.value && !filteredFarms.some(f => f.id == farmSelect.value)) {
      farmSelect.value = '';
    }
  }
  if (farmSelect) {
    farmSelect.innerHTML = '<option value="">2. Tất cả trang trại</option>' +
      filteredFarms.map(f => `<option value="${f.id}">🏡 ${esc(f.name)}</option>`).join('');
  }

  let filteredPlants = allMediaPlants;
  const activeFarmId = farmSelect?.value;
  if (activeFarmId) {
    filteredPlants = allMediaPlants.filter(p => p.farm_id == activeFarmId);
  } else if (userId) {
    const userFarmIds = filteredFarms.map(f => f.id);
    filteredPlants = allMediaPlants.filter(p => userFarmIds.includes(p.farm_id));
  }

  if (plantSelect) {
    if (plantSelect.value && !filteredPlants.some(p => p.id == plantSelect.value)) {
      plantSelect.value = '';
    }
    plantSelect.innerHTML = '<option value="">3. Tất cả cây trồng</option>' +
      filteredPlants.map(p => `<option value="${p.id}">🌳 Cây #${p.tree_code || p.id} (${esc(p.plant_type)})</option>`).join('');
  }

  loadGlobalMediaGallery();
}

async function loadGlobalMediaGallery() {
  const userId = document.getElementById('media-filter-user')?.value;
  const farmId = document.getElementById('media-filter-farm')?.value;
  const plantId = document.getElementById('media-filter-plant')?.value;

  const queryParams = new URLSearchParams();
  if (userId) queryParams.set('user_id', userId);
  if (farmId) queryParams.set('farm_id', farmId);
  if (plantId) queryParams.set('plant_id', plantId);
  if (currentMediaTab === 'pending') {
    queryParams.set('pending_only', 'true');
  }

  const grid = document.getElementById('media-gallery-grid');
  const foldersGrid = document.getElementById('media-folders-grid');
  const empty = document.getElementById('media-gallery-empty');

  if (grid) grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--gray-400);"><i class="fa fa-spinner fa-spin" style="font-size:24px; margin-bottom:8px; display:block;"></i> Đang tải dữ liệu thư viện phương tiện...</div>';
  if (foldersGrid) foldersGrid.innerHTML = '';
  if (empty) empty.style.display = 'none';

  try {
    globalMediaCache = await api(`/plants/media/all?${queryParams.toString()}`) || [];
    renderMediaView();
  } catch (err) {
    if (grid) grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: var(--red);"><i class="fa fa-circle-xmark" style="font-size:24px; margin-bottom:8px; display:block;"></i> Lỗi: ${esc(err.message)}</div>`;
  }
}

// ── Standardized Filename Generator ──
// Quy chuẩn: [Mã Trang trại]_[Mã Cây]_[Thời gian YYMMDD_HHMMSS][_STT].ext
function getStandardizedFileName(m, indexInGroup = 0, totalSameTime = 1) {
  // 1. Farm Code
  let farmCode = 'TT01';
  if (m.farm_name) {
    const clean = m.farm_name.replace(/Trang trại|Nông trại|Vườn/gi, '').trim();
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      farmCode = 'TT_' + words.map(w => w[0]?.toUpperCase()).join('').slice(0, 4);
    } else {
      farmCode = `TT${String(m.farm_id || 1).padStart(2, '0')}`;
    }
  }

  // 2. Tree Code
  const treeCode = String(m.tree_code || m.plant_id || 'C01').replace(/[^a-zA-Z0-9-]/g, '_');

  // 3. Timestamp (YYMMDD_HHMMSS)
  const d = m.uploaded_at ? new Date(m.uploaded_at) : new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const timestamp = `${yy}${mm}${dd}_${hh}${min}${ss}`;

  // 4. File extension
  let ext = m.media_type === 'video' ? 'mp4' : 'jpg';
  if (m.url) {
    const rawExt = m.url.split('?')[0].split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov'].includes(rawExt)) {
      ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    }
  }

  // 5. Sequence suffix if multiple files share exact same timestamp
  const seqSuffix = (totalSameTime > 1 && indexInGroup >= 0)
    ? `_${String(indexInGroup + 1).padStart(2, '0')}`
    : '';

  return `${farmCode}_${treeCode}_${timestamp}${seqSuffix}.${ext}`;
}

async function downloadMediaWithStandardName(url, fileName) {
  try {
    toast(`Đang chuẩn bị tải: ${fileName}...`);
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    toast(`Đã tải về thành công tệp: ${fileName}`);
  } catch (err) {
    window.open(url, '_blank');
  }
}

// Helper calculation for Quarter (Q1: T1-T3, Q2: T4-T6, Q3: T7-T9, Q4: T10-T12)
function getQuarterFromDate(dateObj) {
  const m = dateObj.getMonth() + 1;
  if (m <= 3) return 'Quý 1 (Tháng 1-3)';
  if (m <= 6) return 'Quý 2 (Tháng 4-6)';
  if (m <= 9) return 'Quý 3 (Tháng 7-9)';
  return 'Quý 4 (Tháng 10-12)';
}

function renderMediaView() {
  const grid = document.getElementById('media-gallery-grid');
  const foldersGrid = document.getElementById('media-folders-grid');
  const empty = document.getElementById('media-gallery-empty');
  const breadcrumb = document.getElementById('media-breadcrumb-nav');

  if (!grid || !foldersGrid) return;

  grid.innerHTML = '';
  foldersGrid.innerHTML = '';
  if (empty) empty.style.display = 'none';

  // Update Breadcrumb UI
  if (breadcrumb) {
    let bcHtml = `<span style="color:#059669; cursor:pointer;" onclick="navigateToMediaFolder(-1)"><i class="fa-solid fa-folder-tree"></i> Thư viện gốc</span>`;
    currentFolderPath.forEach((item, idx) => {
      bcHtml += ` <span style="color:#94a3b8;">/</span> <span style="color:#047857; cursor:pointer;" onclick="navigateToMediaFolder(${idx})">${item.icon || '📁'} ${esc(item.name)}</span>`;
    });
    breadcrumb.innerHTML = bcHtml;
  }

  if (globalMediaCache.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }

  // Check if Grid Mode
  if (mediaViewMode === 'grid') {
    foldersGrid.style.display = 'none';
    grid.style.display = 'grid';
    renderMediaCardsList(globalMediaCache);
    return;
  }

  // Folder View Mode: Filter items based on current level in path
  foldersGrid.style.display = 'grid';

  const depth = currentFolderPath.length;
  let scopedMedia = [...globalMediaCache];

  // Apply breadcrumb filters
  currentFolderPath.forEach(p => {
    if (p.level === 'farm') scopedMedia = scopedMedia.filter(m => (m.farm_id || 0) == p.id);
    else if (p.level === 'plant') scopedMedia = scopedMedia.filter(m => m.plant_id == p.id);
    else if (p.level === 'year') scopedMedia = scopedMedia.filter(m => new Date(m.uploaded_at).getFullYear() == p.id);
    else if (p.level === 'quarter') scopedMedia = scopedMedia.filter(m => getQuarterFromDate(new Date(m.uploaded_at)) === p.id);
  });

  if (scopedMedia.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }

  // LEVEL 0: Subfolders by Trang Trại (Farm)
  if (depth === 0) {
    const farmGroups = {};
    scopedMedia.forEach(m => {
      const fId = m.farm_id || 0;
      const fName = m.farm_name || (fId === 0 ? '📁 Media chưa gán trang trại' : `Trang trại #${fId}`);
      const owner = m.owner_name ? `Chủ hộ: ${m.owner_name}` : 'Hệ thống Tân Bảo';
      if (!farmGroups[fId]) farmGroups[fId] = { id: fId, name: fName, owner, items: [] };
      farmGroups[fId].items.push(m);
    });

    foldersGrid.innerHTML = Object.values(farmGroups).map(g => `
      <div class="folder-card" onclick="enterMediaFolder('farm', ${g.id}, '${esc(g.name)}', '🏡')" style="background:#ffffff; border:2px solid #a7f3d0; border-radius:14px; padding:16px; cursor:pointer; box-shadow:0 4px 12px rgba(5,150,105,0.08); transition:all 0.2s;" onmouseover="this.style.borderColor='#059669'" onmouseout="this.style.borderColor='#a7f3d0'">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:44px; height:44px; border-radius:12px; background:#ecfdf5; color:#059669; display:flex; align-items:center; justify-content:center; font-size:22px;">
            <i class="fa-solid fa-folder-tree"></i>
          </div>
          <div style="flex:1;">
            <div style="font-size:13.5px; font-weight:800; color:#0f172a;">🏡 ${esc(g.name)}</div>
            <div style="font-size:11.5px; color:#64748b; margin-top:2px;">👤 ${esc(g.owner)}</div>
            <div style="font-size:11px; color:#047857; font-weight:700; margin-top:3px;">
              <span class="badge" style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:10px;">${g.items.length} tệp phương tiện</span>
            </div>
          </div>
        </div>
      </div>
    `).join('');
    grid.style.display = 'none';
  }
  // LEVEL 1: Subfolders by Cây trồng (Plant)
  else if (depth === 1) {
    const plantGroups = {};
    scopedMedia.forEach(m => {
      const pId = m.plant_id || 0;
      const pCode = m.tree_code ? `Cây #${m.tree_code} (${m.plant_type || 'Cây trồng'})` : (pId === 0 ? 'Ảnh chung vườn' : `Cây #${pId}`);
      if (!plantGroups[pId]) plantGroups[pId] = { id: pId, name: pCode, items: [] };
      plantGroups[pId].items.push(m);
    });

    foldersGrid.innerHTML = Object.values(plantGroups).map(g => `
      <div class="folder-card" onclick="enterMediaFolder('plant', ${g.id}, '${esc(g.name)}', '🌳')" style="background:#ffffff; border:2px solid #bfdbfe; border-radius:14px; padding:16px; cursor:pointer; box-shadow:0 4px 12px rgba(37,99,235,0.08); transition:all 0.2s;" onmouseover="this.style.borderColor='#2563eb'" onmouseout="this.style.borderColor='#bfdbfe'">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:44px; height:44px; border-radius:12px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; font-size:22px;">
            <i class="fa-solid fa-folder-closed"></i>
          </div>
          <div style="flex:1;">
            <div style="font-size:13.5px; font-weight:800; color:#0f172a;">🌳 ${esc(g.name)}</div>
            <div style="font-size:11.5px; color:#1d4ed8; font-weight:700; margin-top:2px;">${g.items.length} tệp phương tiện</div>
          </div>
        </div>
      </div>
    `).join('');
    grid.style.display = 'none';
  }
  // LEVEL 2: Subfolders by Năm (Year)
  else if (depth === 2) {
    const yearGroups = {};
    scopedMedia.forEach(m => {
      const yr = new Date(m.uploaded_at).getFullYear();
      if (!yearGroups[yr]) yearGroups[yr] = { id: yr, name: `Năm ${yr}`, items: [] };
      yearGroups[yr].items.push(m);
    });

    foldersGrid.innerHTML = Object.values(yearGroups).map(g => `
      <div class="folder-card" onclick="enterMediaFolder('year', ${g.id}, '${esc(g.name)}', '📅')" style="background:#ffffff; border:2px solid #fde68a; border-radius:14px; padding:16px; cursor:pointer; box-shadow:0 4px 12px rgba(217,119,6,0.08); transition:all 0.2s;" onmouseover="this.style.borderColor='#d97706'" onmouseout="this.style.borderColor='#fde68a'">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:44px; height:44px; border-radius:12px; background:#fffbeb; color:#d97706; display:flex; align-items:center; justify-content:center; font-size:22px;">
            <i class="fa-solid fa-folder"></i>
          </div>
          <div style="flex:1;">
            <div style="font-size:13.5px; font-weight:800; color:#0f172a;">📅 ${esc(g.name)}</div>
            <div style="font-size:11.5px; color:#b45309; font-weight:700; margin-top:2px;">${g.items.length} tệp phương tiện</div>
          </div>
        </div>
      </div>
    `).join('');
    grid.style.display = 'none';
  }
  // LEVEL 3: Subfolders by Quý (Quarter: Q1, Q2, Q3, Q4)
  else if (depth === 3) {
    const qtrGroups = {};
    scopedMedia.forEach(m => {
      const qName = getQuarterFromDate(new Date(m.uploaded_at));
      if (!qtrGroups[qName]) qtrGroups[qName] = { id: qName, name: qName, items: [] };
      qtrGroups[qName].items.push(m);
    });

    foldersGrid.innerHTML = Object.values(qtrGroups).map(g => `
      <div class="folder-card" onclick="enterMediaFolder('quarter', '${esc(g.id)}', '${esc(g.name)}', '📊')" style="background:#ffffff; border:2px solid #ddd6fe; border-radius:14px; padding:16px; cursor:pointer; box-shadow:0 4px 12px rgba(139,92,246,0.08); transition:all 0.2s;" onmouseover="this.style.borderColor='#7c3aed'" onmouseout="this.style.borderColor='#ddd6fe'">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:44px; height:44px; border-radius:12px; background:#f5f3ff; color:#7c3aed; display:flex; align-items:center; justify-content:center; font-size:22px;">
            <i class="fa-solid fa-folder-open"></i>
          </div>
          <div style="flex:1;">
            <div style="font-size:13.5px; font-weight:800; color:#0f172a;">📊 ${esc(g.name)}</div>
            <div style="font-size:11.5px; color:#6d28d9; font-weight:700; margin-top:2px;">${g.items.length} tệp phương tiện</div>
          </div>
        </div>
      </div>
    `).join('');
    grid.style.display = 'none';
  }
  // LEVEL 4: Hiển thị trực tiếp danh sách Media Cards
  else if (depth >= 4) {
    foldersGrid.style.display = 'none';
    grid.style.display = 'grid';
    renderMediaCardsList(scopedMedia);
  }
}

function enterMediaFolder(level, id, name, icon) {
  currentFolderPath.push({ level, id, name, icon });
  renderMediaView();
}

function navigateToMediaFolder(index) {
  if (index < 0) {
    currentFolderPath = [];
  } else {
    currentFolderPath = currentFolderPath.slice(0, index + 1);
  }
  renderMediaView();
}

function renderMediaCardsList(mediaList) {
  const grid = document.getElementById('media-gallery-grid');
  if (!grid) return;

  if (mediaList.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--gray-400);">Không có ảnh/video nào trong thư mục này.</div>';
    return;
  }

  // Count duplicate timestamps for standard filename sequence numbering
  const timeCounts = {};
  mediaList.forEach(m => {
    const key = `${m.farm_id}_${m.plant_id}_${m.uploaded_at}`;
    timeCounts[key] = (timeCounts[key] || 0) + 1;
  });
  const timeIndices = {};

  grid.innerHTML = mediaList.map(m => {
    const key = `${m.farm_id}_${m.plant_id}_${m.uploaded_at}`;
    const idxInGroup = timeIndices[key] || 0;
    timeIndices[key] = idxInGroup + 1;

    const stdName = getStandardizedFileName(m, idxInGroup, timeCounts[key]);
    const typeLabel = m.media_type === 'video' ? 'Video' : 'Ảnh';
    const treeLabel = `Cây #${m.tree_code || m.plant_id} (${m.plant_type})`;
    const farmLabel = m.farm_name || 'Vườn khác';
    const ownerLabel = m.owner_name ? ` · ${m.owner_name}` : '';

    let actionButtonsHtml = '';
    if (currentMediaTab === 'pending') {
      actionButtonsHtml = `
        <div style="margin-top: 8px; display: flex; gap: 8px;">
          <button onclick="approveDeleteMedia(${m.plant_id}, ${m.id})" class="btn btn-danger btn-sm" style="flex: 1; padding: 5px; font-size: 11px; font-weight:800;">
            <i class="fa fa-check"></i> Duyệt xóa
          </button>
          <button onclick="rejectDeleteMedia(${m.plant_id}, ${m.id})" class="btn btn-secondary btn-sm" style="flex: 1; padding: 5px; font-size: 11px; font-weight:700;">
            <i class="fa fa-rotate-left"></i> Khôi phục
          </button>
        </div>
      `;
    } else {
      actionButtonsHtml = `
        <div style="font-size: 10px; color: var(--gray-500); margin-top: 8px; display: flex; justify-content: space-between; align-items: center; background:#f8fafc; padding:6px; border-radius:6px; border:1px solid #e2e8f0;">
          <span title="${esc(stdName)}" style="font-weight:700; color:#334155; max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(stdName)}</span>
          <div style="display:flex; gap:6px; align-items:center;">
            <button onclick="downloadMediaWithStandardName('${esc(m.url)}', '${esc(stdName)}')" style="border: none; background: #ecfdf5; color: #047857; font-weight:800; border-radius:4px; padding: 3px 6px; cursor: pointer; font-size:11px;" title="Tải xuống tên chuẩn: ${esc(stdName)}">
              <i class="fa-solid fa-download"></i>
            </button>
            <button onclick="approveDeleteMedia(${m.plant_id}, ${m.id}, true)" style="border: none; background: none; color: var(--red); cursor: pointer; padding: 2px;" title="Xóa vĩnh viễn">
              <i class="fa fa-trash-can"></i>
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="media-card-item" style="border: 1.5px solid var(--gray-200); border-radius: 12px; background: #fff; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); display: flex; flex-direction: column;">
        <div style="position: relative; width: 100%; padding-top: 75%; background: #000; overflow: hidden;">
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; align-items: center;">
            ${m.media_type === 'video'
              ? `<video src="${esc(m.url)}" controls style="max-width: 100%; max-height: 100%;"></video>`
              : `<img src="${esc(m.url)}" alt="${esc(m.caption||'')}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" onclick="window.open('${esc(m.url)}')">`
            }
          </div>
          <span style="position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.65); color: #fff; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: bold;">
            ${typeLabel}
          </span>
        </div>
        <div style="padding: 12px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="font-size: 12px; font-weight: 800; color: var(--text-main); margin-bottom: 2px;">${esc(treeLabel)}</div>
            <div style="font-size: 11px; color: var(--gray-500);"><i class="fa fa-location-dot" style="margin-right:2px"></i> ${esc(farmLabel)}${esc(ownerLabel)}</div>
          </div>
          ${actionButtonsHtml}
        </div>
      </div>
    `;
  }).join('');
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

window.setMediaViewMode = setMediaViewMode;
window.enterMediaFolder = enterMediaFolder;
window.navigateToMediaFolder = navigateToMediaFolder;
window.downloadMediaWithStandardName = downloadMediaWithStandardName;


