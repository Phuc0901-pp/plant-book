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

