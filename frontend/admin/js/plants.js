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
          <i data-lucide="sprout" class="lucide-sm" style="font-size:36px; color:#94a3b8; margin-bottom:10px;"></i>
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
              <i data-lucide="folder-open" class="lucide-sm" id="folder-icon-${folderId}" style="font-size:22px; color:#10b981;"></i>
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
                <i data-lucide="plus" class="lucide-sm"></i> Thêm cây
              </button>
              <i data-lucide="chevron-down" class="lucide-sm" id="folder-arrow-${folderId}" style="color:#94a3b8; transition:transform 0.3s;"></i>
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
                  <tr data-plant-id="${p.id}" style="border-bottom:1px solid #f1f5f9; font-size:13px;">
                    <td style="padding:12px 16px;">
                      <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:36px; height:36px; background:#ecfdf5; color:#10b981; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;">
                          <i data-lucide="trees" class="lucide-sm"></i>
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
                      ${p.latitude && p.longitude ? `<i data-lucide="map-pin" class="lucide-sm" style="color:#10b981;"></i> ${parseFloat(p.latitude).toFixed(4)}, ${parseFloat(p.longitude).toFixed(4)}` : '<span style="color:#cbd5e1;">Chưa định vị</span>'}
                    </td>
                    <td style="text-align:center;">
                      <div style="display:inline-flex; gap:6px;">
                        <button class="btn btn-secondary btn-sm" onclick="openPlantModal(${p.id})" title="Chỉnh sửa">
                          <i data-lucide="edit-3" class="lucide-sm"></i>
                        </button>
                        ${p.is_public ? `
                        <a href="/plant/${esc(p.public_slug)}" target="_blank" class="btn btn-primary btn-sm" title="Trang công khai">
                          <i data-lucide="external-link" class="lucide-sm"></i>
                        </a>` : ''}
                        <button class="btn btn-danger btn-sm" onclick="deletePlant(${p.id},'${esc(p.plant_type)}')" title="Xóa">
                          <i data-lucide="trash-2" class="lucide-sm"></i>
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
    if (icon) {
      icon.setAttribute('data-lucide', 'folder-open');
      if (window.lucide) lucide.createIcons({ targets: [icon.parentElement || icon] });
    }
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  } else {
    content.style.display = 'none';
    if (icon) {
      icon.setAttribute('data-lucide', 'folder');
      if (window.lucide) lucide.createIcons({ targets: [icon.parentElement || icon] });
    }
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

let _plantCreateMode = 'single';

function togglePlantCreateMode(mode) {
  _plantCreateMode = mode;
  const singleWrap = document.getElementById('wrap-single-tree-code');
  const rangeWrap = document.getElementById('wrap-range-tree-code');
  const rangeTypeWrap = document.getElementById('wrap-range-type-select');
  const labelSingle = document.getElementById('label-mode-single');
  const labelRange = document.getElementById('label-mode-range');
  const saveText = document.getElementById('plant-save-text');

  if (mode === 'range') {
    if (singleWrap) singleWrap.style.display = 'none';
    if (rangeWrap) rangeWrap.style.display = 'block';
    if (rangeTypeWrap) {
      rangeTypeWrap.style.display = 'flex';
      const typeSelect = document.getElementById('f-plant-type');
      const rangeTypeSelect = document.getElementById('f-plant-type-range');
      if (typeSelect && rangeTypeSelect) {
        rangeTypeSelect.innerHTML = typeSelect.innerHTML;
        rangeTypeSelect.value = typeSelect.value;
      }
    }
    if (labelSingle) { labelSingle.style.background = '#ffffff'; labelSingle.style.borderColor = '#cbd5e1'; labelSingle.style.color = '#334155'; }
    if (labelRange) { labelRange.style.background = '#ecfdf5'; labelRange.style.borderColor = '#34d399'; labelRange.style.color = '#065f46'; }
    updateRangePreview();
  } else {
    if (singleWrap) singleWrap.style.display = 'flex';
    if (rangeWrap) rangeWrap.style.display = 'none';
    if (rangeTypeWrap) rangeTypeWrap.style.display = 'none';
    if (labelSingle) { labelSingle.style.background = '#ecfdf5'; labelSingle.style.borderColor = '#34d399'; labelSingle.style.color = '#065f46'; }
    if (labelRange) { labelRange.style.background = '#ffffff'; labelRange.style.borderColor = '#cbd5e1'; labelRange.style.color = '#334155'; }
    if (saveText) saveText.innerHTML = '<i data-lucide="save" class="lucide-sm"></i> Lưu cây';
  }
}
window.togglePlantCreateMode = togglePlantCreateMode;

function updateRangePreview() {
  if (_plantCreateMode !== 'range') return;
  const prefix = (document.getElementById('f-range-prefix')?.value || '').trim();
  const rawStart = document.getElementById('f-range-start')?.value;
  const rawEnd = document.getElementById('f-range-end')?.value;
  const padZeros = document.getElementById('f-range-pad-zeros')?.checked;
  const previewEl = document.getElementById('range-preview-text');
  const saveText = document.getElementById('plant-save-text');

  const start = parseInt(rawStart, 10);
  const end = parseInt(rawEnd, 10);

  if (isNaN(start) || isNaN(end)) {
    if (previewEl) previewEl.innerHTML = '🔢 Nhập số bắt đầu và số kết thúc để xem trước danh sách cây.';
    if (saveText) saveText.innerHTML = '<i data-lucide="layers" class="lucide-sm"></i> Tạo cây hàng loạt';
    return;
  }

  if (start > end) {
    if (previewEl) previewEl.innerHTML = '<span style="color:#dc2626; font-weight:800;">⚠️ Số bắt đầu phải nhỏ hơn hoặc bằng số kết thúc!</span>';
    if (saveText) saveText.innerHTML = '<i data-lucide="layers" class="lucide-sm"></i> Tạo cây hàng loạt';
    return;
  }

  const count = end - start + 1;
  if (count > 500) {
    if (previewEl) previewEl.innerHTML = `<span style="color:#dc2626; font-weight:800;">⚠️ Số lượng ${count} cây vượt quá giới hạn 500 cây mỗi lần!</span>`;
    return;
  }

  const padLen = padZeros ? Math.max(String(rawStart).length, String(rawEnd).length) : 0;
  const formatNum = (num) => padLen > 1 ? String(num).padStart(padLen, '0') : String(num);

  const firstCode = `${prefix}${formatNum(start)}`;
  const lastCode = `${prefix}${formatNum(end)}`;
  const secondCode = count > 2 ? `${prefix}${formatNum(start + 1)}` : '';

  let previewStr = `✨ Sẽ tạo <strong>${count} cây</strong>: <code>${esc(firstCode)}</code>`;
  if (secondCode) previewStr += `, <code>${esc(secondCode)}</code>`;
  if (count > 3) previewStr += `, ...`;
  if (count > 1) previewStr += `, <code>${esc(lastCode)}</code>`;

  if (previewEl) previewEl.innerHTML = previewStr;
  if (saveText) saveText.innerHTML = `<i data-lucide="layers" class="lucide-sm"></i> Tạo ${count} cây hàng loạt`;
}
window.updateRangePreview = updateRangePreview;

function getCurrentDeviceGpsForPlant() {
  if (!navigator.geolocation) {
    toast('Trình duyệt không hỗ trợ Geolocation GPS!', 'error');
    return;
  }
  toast('Đang lấy tọa độ GPS thực địa...');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const latInput = document.getElementById('f-latitude');
      const lngInput = document.getElementById('f-longitude');
      if (latInput) latInput.value = lat;
      if (lngInput) lngInput.value = lng;
      toast(`📍 Đã lấy GPS: ${lat}, ${lng} (±${Math.round(pos.coords.accuracy || 0)}m)`, 'success');
    },
    (err) => {
      toast('Không thể lấy tọa độ GPS: ' + err.message, 'error');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}
window.getCurrentDeviceGpsForPlant = getCurrentDeviceGpsForPlant;

async function openPlantModal(id = null, syncUrl = true) {
  editingPlantId = id;
  resetPlantForm();

  const titleEl = document.getElementById('plant-modal-title');
  const codeBadge = document.getElementById('plant-modal-code-badge');
  const healthPill = document.getElementById('plant-modal-health-pill');
  const subVariety = document.getElementById('plant-modal-sub-variety');
  const headerIcon = document.getElementById('plant-modal-header-icon');

  if (titleEl) {
    titleEl.innerHTML = id
      ? '<i data-lucide="edit" class="lucide-sm" style="color:#34d399"></i> Chỉnh sửa hồ sơ cây'
      : '<i data-lucide="sprout" class="lucide-sm" style="color:#34d399"></i> Thêm cây trồng mới';
  }
  if (headerIcon) {
    headerIcon.setAttribute('data-lucide', id ? 'trees' : 'sprout');
    if (window.lucide) lucide.createIcons({ targets: [headerIcon.parentElement || headerIcon] });
  }

  document.getElementById('public-url-section').style.display = 'none';

  const modeWrap = document.getElementById('plant-create-mode-wrap');
  if (modeWrap) {
    modeWrap.style.display = id ? 'none' : 'flex';
  }

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

      // Update header badges
      if (codeBadge) {
        codeBadge.textContent = `#${plant.tree_code || plant.id}`;
        codeBadge.style.display = 'inline-block';
      }
      if (healthPill) {
        const hs = plant.health_status || 'Tốt';
        let bg = '#ecfdf5', col = '#047857', dot = '🟢';
        if (hs === 'Cần chú ý') { bg = '#fffbeb'; col = '#b45309'; dot = '🟡'; }
        else if (hs === 'Bệnh') { bg = '#fef2f2'; col = '#b91c1c'; dot = '🔴'; }
        else if (hs === 'Bình thường') { bg = '#f1f5f9'; col = '#475569'; dot = '⚪'; }
        healthPill.style.background = bg;
        healthPill.style.color = col;
        healthPill.innerHTML = `${dot} ${hs}`;
        healthPill.style.display = 'inline-block';
      }
      if (subVariety) {
        const typeStr = plant.plant_type || 'Cây trồng';
        const varStr = plant.plant_variety ? ` · Giống: ${plant.plant_variety}` : '';
        const locStr = plant.location ? ` · Vị trí: ${plant.location}` : '';
        subVariety.textContent = `${typeStr}${varStr}${locStr}`;
      }

      // Show public URL
      if (plant.is_public && plant.public_slug) {
        showPublicURL(plant.public_slug);
      }

      // Preload media & logs for instant tab counters
      const mediaCont = document.getElementById('plant-media-container');
      if (mediaCont) {
        mediaCont.innerHTML = renderMediaSection(plant.id);
        loadPlantMedia(plant.id);
      }
      const logsCont = document.getElementById('plant-logs-container');
      if (logsCont) {
        logsCont.innerHTML = renderLogsSection(plant.id);
        loadPlantLogs(plant.id);
      }

      // Store extra data for rendering
      window._currentPlantData = plant.data || {};
      window._currentSchemaFields = plant.schema_fields || [];
    } catch (err) {
      toast('Lỗi tải thông tin cây: ' + err.message, 'error');
    }
  } else {
    if (codeBadge) codeBadge.style.display = 'none';
    if (healthPill) healthPill.style.display = 'none';
    if (subVariety) subVariety.textContent = 'Điền thông tin và tọa độ thực địa để khởi tạo cây trồng mới';
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
  ['f-tree-code','f-plant-type','f-plant-variety','f-plant-age','f-location','f-farm-id','f-latitude','f-longitude','f-range-prefix','f-range-start','f-range-end'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-health-status').value = 'Tốt';
  document.getElementById('f-schema-id').value = '';
  document.getElementById('f-is-public').value = 'true';
  const extraCont = document.getElementById('extra-fields-container');
  if (extraCont) {
    extraCont.innerHTML = `
      <div class="empty-state" style="padding:40px 20px; text-align:center; background:#f8fafc; border-radius:12px; border:1.5px dashed #cbd5e1;">
        <i data-lucide="shapes" class="lucide-sm" style="font-size:36px; color:#94a3b8; margin-bottom:10px; display:inline-block;"></i>
        <p style="font-size:13px; font-weight:700; color:#475569; margin:0 0 4px 0;">Không có trường thuộc tính đặc thù nào.</p>
        <small style="color:#94a3b8;">Cấu hình schema tại Cài đặt > Quản lý Schema để thêm thuộc tính chuyên sâu (Độ pH, Độ ngọt Brix, Mã PUC...) cho giống cây này.</small>
      </div>`;
  }
  const mediaCont = document.getElementById('plant-media-container');
  if (mediaCont) {
    mediaCont.innerHTML = `
      <div class="empty-state" style="padding:40px 20px; text-align:center; background:#ffffff; border-radius:14px; border:1.5px dashed #cbd5e1;">
        <i data-lucide="images" class="lucide-sm" style="font-size:36px; color:#94a3b8; margin-bottom:10px; display:inline-block;"></i>
        <p style="font-size:13.5px; font-weight:700; color:#475569; margin:0 0 4px 0;">Vui lòng lưu thông tin cây trước khi tải ảnh/video.</p>
        <small style="color:#94a3b8;">Hệ thống tự động liên kết tệp phương tiện với cây trồng sau khi khởi tạo ID.</small>
      </div>`;
  }
  const logsCont = document.getElementById('plant-logs-container');
  if (logsCont) {
    logsCont.innerHTML = `
      <div class="empty-state" style="padding:40px 20px; text-align:center; background:#ffffff; border-radius:14px; border:1.5px dashed #cbd5e1;">
        <i data-lucide="bookmark" class="lucide-sm" style="font-size:36px; color:#94a3b8; margin-bottom:10px; display:inline-block;"></i>
        <p style="font-size:13.5px; font-weight:700; color:#475569; margin:0 0 4px 0;">Vui lòng lưu thông tin cây trước khi ghi nhật ký canh tác.</p>
        <small style="color:#94a3b8;">Nhật ký chăm sóc sẽ ghi nhận lịch sử bón phân, tưới tiêu, phun thuốc và truy xuất nguồn gốc.</small>
      </div>`;
  }
  
  const mediaCountBadge = document.getElementById('plant-media-count-badge');
  if (mediaCountBadge) { mediaCountBadge.textContent = '0'; mediaCountBadge.style.display = 'none'; }
  const logsCountBadge = document.getElementById('plant-logs-count-badge');
  if (logsCountBadge) { logsCountBadge.textContent = '0'; logsCountBadge.style.display = 'none'; }

  _plantCreateMode = 'single';
  const radioSingle = document.querySelector('input[name="plant-create-mode"][value="single"]');
  if (radioSingle) radioSingle.checked = true;
  togglePlantCreateMode('single');

  // Reset to first tab
  const tabs = document.querySelectorAll('.plant-modal-tabs .tab');
  if (tabs.length > 0) {
    tabs.forEach((t, i) => t.classList.toggle('active', i === 0));
  } else {
    document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  }
  document.querySelectorAll('#plant-modal .tab-pane').forEach((p, i) => p.classList.toggle('active', i === 0));
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
  const isRangeMode = !editingPlantId && _plantCreateMode === 'range';
  const plant_type_input = isRangeMode ? document.getElementById('f-plant-type-range') : document.getElementById('f-plant-type');
  const plant_type = (plant_type_input?.value || document.getElementById('f-plant-type')?.value || '').trim();
  if (!plant_type) { toast('Vui lòng chọn loại cây!', 'error'); return; }

  const schema_id = document.getElementById('f-schema-id').value;
  const extraData = collectExtraFields();

  if (isRangeMode) {
    const prefix = (document.getElementById('f-range-prefix')?.value || '').trim();
    const rawStart = document.getElementById('f-range-start')?.value;
    const rawEnd = document.getElementById('f-range-end')?.value;
    const padZeros = document.getElementById('f-range-pad-zeros')?.checked;

    const start = parseInt(rawStart, 10);
    const end = parseInt(rawEnd, 10);

    if (isNaN(start) || isNaN(end)) {
      toast('Vui lòng nhập số thứ tự bắt đầu (XX) và kết thúc (XY)!', 'error');
      return;
    }
    if (start > end) {
      toast('Số bắt đầu phải nhỏ hơn hoặc bằng số kết thúc!', 'error');
      return;
    }
    if (end - start + 1 > 500) {
      toast('Mỗi lần chỉ tạo tối đa 500 cây hàng loạt.', 'error');
      return;
    }

    const btn = document.getElementById('plant-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Đang tạo...';

    try {
      const res = await api('/plants/batch-range', {
        method: 'POST',
        body: JSON.stringify({
          start_num: start,
          end_num: end,
          prefix,
          pad_zeros: padZeros,
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
        })
      });

      toast(res.message || `🎉 Đã tạo thành công ${res.count} cây!`, 'success');
      closePlantModal();
      loadPlants();
      loadDashboard();
    } catch (err) {
      toast('Lỗi tạo hàng loạt: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span id="plant-save-text"><i data-lucide="save" class="lucide-sm"></i> Lưu cây</span>';
    }
    return;
  }

  // Single tree mode
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
    const mediaCont = document.getElementById('plant-media-container');
    if (mediaCont) {
      mediaCont.innerHTML = renderMediaSection(plant.id);
      loadPlantMedia(plant.id);
    }
    const logsCont = document.getElementById('plant-logs-container');
    if (logsCont) {
      logsCont.innerHTML = renderLogsSection(plant.id);
      loadPlantLogs(plant.id);
    }

    toast(editingPlantId ? 'Đã cập nhật cây!' : 'Đã tạo cây mới!');
    document.getElementById('plant-modal-title').innerHTML = '<i data-lucide="edit" class="lucide-sm" style="color:#34d399"></i> Chỉnh sửa hồ sơ cây';
    const codeBadge = document.getElementById('plant-modal-code-badge');
    if (codeBadge) { codeBadge.textContent = `#${plant.tree_code || plant.id}`; codeBadge.style.display = 'inline-block'; }
    const healthPill = document.getElementById('plant-modal-health-pill');
    if (healthPill) {
      const hs = plant.health_status || 'Tốt';
      let bg = '#ecfdf5', col = '#047857', dot = '🟢';
      if (hs === 'Cần chú ý') { bg = '#fffbeb'; col = '#b45309'; dot = '🟡'; }
      else if (hs === 'Bệnh') { bg = '#fef2f2'; col = '#b91c1c'; dot = '🔴'; }
      else if (hs === 'Bình thường') { bg = '#f1f5f9'; col = '#475569'; dot = '⚪'; }
      healthPill.style.background = bg; healthPill.style.color = col;
      healthPill.innerHTML = `${dot} ${hs}`; healthPill.style.display = 'inline-block';
    }
    const subVariety = document.getElementById('plant-modal-sub-variety');
    if (subVariety) {
      subVariety.textContent = `${plant.plant_type || 'Cây trồng'}${plant.plant_variety ? ' · Giống: ' + plant.plant_variety : ''}${plant.location ? ' · Vị trí: ' + plant.location : ''}`;
    }
    if (typeof window.onPlantSavedHook === 'function') {
      window.onPlantSavedHook(plant);
    }
  } catch (err) {
    toast('Lỗi lưu cây: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span id="plant-save-text"><i data-lucide="save" class="lucide-sm"></i> Lưu cây</span>';
  }
}

async function deletePlant(id, name) {
  if (!confirm(`Xóa cây "${name}"? Hành động này không thể hoàn tác.`)) return;

  const row = document.querySelector(`tr[data-plant-id="${id}"]`) || document.querySelector(`[data-id="${id}"]`);
  if (row) {
    row.classList.add('row-deleting');
  }

  try {
    await api(`/plants/${id}`, { method: 'DELETE' });
    toast('Đã xóa cây.');
    setTimeout(() => {
      loadPlants();
      if (typeof loadDashboard === 'function') loadDashboard();
    }, 280);
  } catch (err) {
    if (row) row.classList.remove('row-deleting');
    toast('Lỗi xóa: ' + err.message, 'error');
  }
}

// ── Schema extra fields ─────────────────────────────────────

document.getElementById('f-schema-id').addEventListener('change', renderExtraFields);

async function renderExtraFields() {
  const schemaId = document.getElementById('f-schema-id').value;
  const container = document.getElementById('extra-fields-container');
  if (!schemaId) {
    container.innerHTML = '<div class="empty-state" style="padding:24px"><i data-lucide="layers" class="lucide-sm"></i><p>Chọn schema để hiển thị các trường mở rộng</p></div>';
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
  const soundEnabled = (document.getElementById('db-nfc-sound-toggle')?.checked || document.getElementById('nfc-inv-sound-toggle')?.checked) ?? true;
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
  const soundEnabled = (document.getElementById('db-nfc-sound-toggle')?.checked || document.getElementById('nfc-inv-sound-toggle')?.checked) ?? true;
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
    switchDatabaseTab('nfc');
  }
  await initAdminNfcPage(targetFarmId);
}
window.openAdminNfcInventoryView = openAdminNfcInventoryView;

/**
 * Initialize Admin NFC Page View (called when clicking db-tab-nfc)
 */
async function initAdminNfcPage(farmId = null) {
  const sel = document.getElementById('db-nfc-filter-farm');
  let farms = window._allFarmsCache || (typeof dbFarmsCache !== 'undefined' ? dbFarmsCache : []);
  if (!farms || farms.length === 0) {
    try {
      farms = await api('/farms') || [];
      window._allFarmsCache = farms;
      if (typeof dbFarmsCache !== 'undefined') dbFarmsCache = farms;
    } catch (e) {
      console.error('Failed to load farms in initAdminNfcPage:', e);
    }
  }

  if (sel && farms && farms.length > 0) {
    const prevVal = sel.value;
    sel.innerHTML = '<option value="">— Vui lòng chọn Trang trại —</option>' +
      farms.map(f => `<option value="${f.id}">🏡 ${esc(f.name)} ${f.owner_name ? `(${esc(f.owner_name)})` : ''}</option>`).join('');
    if (prevVal && farms.some(f => f.id == prevVal)) {
      sel.value = prevVal;
    }
  }

  let targetFarmId = farmId;
  if (!targetFarmId && _currentInvFarmId) {
    targetFarmId = _currentInvFarmId;
  }
  if (!targetFarmId && sel && sel.value) {
    targetFarmId = parseInt(sel.value);
  }
  if (!targetFarmId) {
    targetFarmId = getActiveAdminFarmId();
  }
  if (!targetFarmId && farms && farms.length > 0) {
    targetFarmId = farms[0].id;
  }

  if (targetFarmId) {
    if (sel) sel.value = targetFarmId;
    _currentInvFarmId = targetFarmId;
    await loadAdminNfcPageData(targetFarmId);
  } else {
    const tbody = document.getElementById('db-nfc-inventory-table-body');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:46px 20px; color:#94a3b8;">
            <i data-lucide="alert-triangle" class="lucide-sm" style="font-size:36px; margin-bottom:12px; display:inline-block; color:#f59e0b;"></i>
            <p style="margin:0 0 6px 0; font-weight:800; font-size:14.5px; color:#475569;">Chưa có trang trại nào trong hệ thống.</p>
            <small style="color:#94a3b8;">Vui lòng tạo ít nhất một Trang trại trước khi sử dụng Kho thẻ NFC.</small>
          </td>
        </tr>`;
    }
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

let _currentAdminNfcPage = 1;
const ADMIN_NFC_PAGE_SIZE = 10;
let _filteredAdminNfcTags = [];

async function loadAdminNfcPageData(farmId) {
  try {
    const farms = window._allFarmsCache || (typeof dbFarmsCache !== 'undefined' ? dbFarmsCache : []);
    const farmObj = (farms || []).find(f => f.id == farmId);
    const titleEl = document.getElementById('db-nfc-active-farm-title');
    if (titleEl) {
      titleEl.textContent = farmObj ? `Kho Thẻ NFC: ${farmObj.name}` : `Kho Thẻ NFC: Trang trại #${farmId}`;
    }

    const res = await api(`/plants/farms/${farmId}/nfc-inventory`);
    _nfcInventoryCache = res.tags || res.items || [];
    if (typeof _nfcScanEngine !== 'undefined') {
      _nfcScanEngine.syncKnownUids(_nfcInventoryCache);
    }
    _currentAdminNfcPage = 1;

    const total = res.stats?.total ?? _nfcInventoryCache.length;
    const assigned = res.stats?.assigned ?? _nfcInventoryCache.filter(t => t.status === 'assigned').length;
    const unassigned = res.stats?.unassigned ?? _nfcInventoryCache.filter(t => t.status !== 'assigned').length;

    const totalEl = document.getElementById('db-nfc-total-count');
    const assignedEl = document.getElementById('db-nfc-assigned-count');
    const unassignedEl = document.getElementById('db-nfc-unassigned-count');
    const badgeEl = document.getElementById('db-nfc-table-count-badge');

    if (totalEl) totalEl.textContent = total;
    if (assignedEl) assignedEl.textContent = assigned;
    if (unassignedEl) unassignedEl.textContent = unassigned;
    if (badgeEl) badgeEl.textContent = `${total} thẻ`;

    renderAdminNfcPageTable(_nfcInventoryCache);
  } catch (err) {
    toast('Lỗi tải danh sách kho thẻ: ' + err.message, 'error');
  }
}
window.loadAdminNfcPageData = loadAdminNfcPageData;

function renderAdminNfcPageTable(tags) {
  const tbody = document.getElementById('db-nfc-inventory-table-body');
  const pagInfo = document.getElementById('db-nfc-pagination-info');
  const pagBtns = document.getElementById('db-nfc-pagination-btns');
  if (!tbody) return;

  _filteredAdminNfcTags = tags || [];

  if (!_filteredAdminNfcTags || _filteredAdminNfcTags.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:46px 20px; color:#94a3b8;">
          <i data-lucide="package" class="lucide-sm" style="font-size:36px; margin-bottom:12px; display:inline-block; color:#cbd5e1;"></i>
          <p style="margin:0 0 6px 0; font-weight:800; font-size:14.5px; color:#475569;">Kho thẻ NFC của trang trại này đang trống (0 thẻ).</p>
          <small style="color:#94a3b8;">Hãy bật "Quét thẻ liên tục" hoặc dùng đầu đọc USB / nhập mã UID ở trên để nạp thẻ vào kho.</small>
        </td>
      </tr>`;
    if (pagInfo) pagInfo.textContent = 'Hiển thị 0 thẻ';
    if (pagBtns) pagBtns.innerHTML = '';
    return;
  }

  // 10 bản ghi trong 1 trang
  const totalItems = _filteredAdminNfcTags.length;
  const totalPages = Math.ceil(totalItems / ADMIN_NFC_PAGE_SIZE) || 1;
  if (_currentAdminNfcPage > totalPages) _currentAdminNfcPage = totalPages;
  if (_currentAdminNfcPage < 1) _currentAdminNfcPage = 1;

  const startIdx = (_currentAdminNfcPage - 1) * ADMIN_NFC_PAGE_SIZE;
  const endIdx = Math.min(startIdx + ADMIN_NFC_PAGE_SIZE, totalItems);
  const pageItems = _filteredAdminNfcTags.slice(startIdx, endIdx);

  tbody.innerHTML = pageItems.map((t, idx) => {
    const isAssigned = t.status === 'assigned';
    const statusPill = isAssigned
      ? `<span style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:11.5px; font-weight:800; padding:4px 12px; border-radius:12px; display:inline-flex; align-items:center; gap:5px;"><i data-lucide="link" class="lucide-sm"></i> Đã gán cây</span>`
      : `<span style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-size:11.5px; font-weight:800; padding:4px 12px; border-radius:12px; display:inline-flex; align-items:center; gap:5px;"><i data-lucide="check" class="lucide-sm"></i> Còn trống (Sẵn sàng)</span>`;

    let plantInfo = `<span style="color:#94a3b8; font-style:italic; display:inline-flex; align-items:center; gap:5px;"><i data-lucide="clock" class="lucide-sm"></i> — Sẵn sàng gán —</span>`;
    if (isAssigned && (t.tree_code || t.plant_id)) {
      const treeCodeText = t.tree_code ? `Cây #${t.tree_code}` : `Cây #${t.plant_id}`;
      const plantTypeDesc = t.plant_variety ? `${t.plant_type || 'Cây'} (${t.plant_variety})` : (t.plant_type || 'Cây trồng');
      const hasGps = t.latitude != null && t.longitude != null && !isNaN(Number(t.latitude)) && !isNaN(Number(t.longitude)) && (Number(t.latitude) !== 0 || Number(t.longitude) !== 0);
      const gpsLat = hasGps ? Number(t.latitude).toFixed(6) : null;
      const gpsLng = hasGps ? Number(t.longitude).toFixed(6) : null;
      const locationText = t.location || (t.plant_data && (t.plant_data.tag_position || t.plant_data.location)) || '';

      plantInfo = `
        <div style="display:flex; flex-direction:column; gap:4px;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; font-weight:800; font-size:12.5px; padding:2px 8px; border-radius:6px;">
                🌳 ${esc(treeCodeText)}
              </span>
              <span style="font-size:12px; color:#475569; font-weight:600;">${esc(plantTypeDesc)}</span>
            </div>
            <button type="button" onclick="unassignAdminNfcTag(${t.id}, '${esc(t.nfc_uid)}', ${t.plant_id || 'null'})" title="Gỡ thẻ khỏi cây này (chuyển về trạng thái sẵn sàng trong kho)" style="background:#fff7ed; color:#c2410c; border:1px solid #fdba74; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">
              <i data-lucide="unlink" class="lucide-sm"></i> Gỡ thẻ
            </button>
          </div>

          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:2px;">
            ${hasGps ? `
              <div style="display:inline-flex; align-items:center; gap:4px; font-size:11.5px; color:#047857; font-weight:700; background:#f0fdf4; padding:2px 8px; border-radius:4px; border:1px solid #bbf7d0;">
                <i data-lucide="map-pin" class="lucide-sm" style="color:#059669;"></i> GPS: ${gpsLat}, ${gpsLng}
                <a href="https://www.google.com/maps?q=${gpsLat},${gpsLng}" target="_blank" title="Mở bản đồ Google Maps" style="color:#2563eb; text-decoration:none; margin-left:3px; display:inline-flex; align-items:center; gap:2px;">
                  <i data-lucide="external-link" class="lucide-sm"></i> Bản đồ
                </a>
              </div>
            ` : `
              <span style="color:#d97706; font-size:11px; display:inline-flex; align-items:center; gap:4px; background:#fffbeb; padding:2px 6px; border-radius:4px; border:1px solid #fef3c7;">
                <i data-lucide="alert-circle" class="lucide-sm"></i> Chưa lấy tọa độ GPS
              </span>
            `}
            ${locationText ? `
              <div style="color:#475569; font-size:11px; display:inline-flex; align-items:center; gap:4px; background:#f8fafc; padding:2px 6px; border-radius:4px; border:1px solid #e2e8f0;">
                <i data-lucide="tag" class="lucide-sm" style="color:#0284c7;"></i> Vị trí: <strong>${esc(locationText)}</strong>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    const timeStr = t.scanned_at ? new Date(t.scanned_at).toLocaleString('vi-VN') : '—';
    const rowStt = startIdx + idx + 1;

    return `
      <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
        <td style="padding:12px 14px; text-align:center; font-weight:800; color:#64748b;">${rowStt}</td>
        <td style="padding:12px 14px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <code style="font-size:13px; font-weight:800; color:#065f46; background:#ecfdf5; border:1px solid #a7f3d0; padding:4px 10px; border-radius:6px; font-family:monospace;">${esc(t.nfc_uid)}</code>
            <button type="button" onclick="navigator.clipboard.writeText('${esc(t.nfc_uid)}'); toast('Đã copy UID: ${esc(t.nfc_uid)}');" title="Sao chép UID" style="border:none; background:transparent; color:#64748b; cursor:pointer; font-size:13px; padding:3px 6px;">
              <i data-lucide="copy" class="lucide-sm"></i>
            </button>
          </div>
        </td>
        <td style="padding:12px 14px; text-align:center;">${statusPill}</td>
        <td style="padding:12px 14px;">${plantInfo}</td>
        <td style="padding:12px 14px; font-size:12.5px; color:#64748b; font-weight:600;">${timeStr}</td>
        <td style="padding:12px 14px; text-align:center;">
          <button type="button" onclick="deleteAdminNfcTag(${t.id}, '${esc(t.nfc_uid)}')" title="Xóa thẻ khỏi kho" style="border:none; background:#fee2e2; color:#dc2626; border-radius:8px; width:32px; height:32px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all 0.2s ease;">
            <i data-lucide="trash-2" class="lucide-sm"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Hiển thị thanh phân trang 10 bản ghi / trang
  if (pagInfo) {
    pagInfo.textContent = `Hiển thị ${startIdx + 1} - ${endIdx} trong tổng số ${totalItems} thẻ (Trang ${_currentAdminNfcPage}/${totalPages})`;
  }

  if (pagBtns) {
    let btnsHtml = '';
    btnsHtml += `<button onclick="changeAdminNfcPage(${_currentAdminNfcPage - 1})" ${_currentAdminNfcPage === 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} style="padding:6px 12px; font-size:12px; font-weight:700; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#334155; cursor:pointer;">◄ Trang trước</button>`;

    let startPage = Math.max(1, _currentAdminNfcPage - 2);
    let endPage = Math.min(totalPages, _currentAdminNfcPage + 2);

    if (startPage > 1) {
      btnsHtml += `<button onclick="changeAdminNfcPage(1)" style="padding:6px 10px; font-size:12px; font-weight:700; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#334155; cursor:pointer;">1</button>`;
      if (startPage > 2) btnsHtml += `<span style="color:#94a3b8; padding:0 2px;">...</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
      const isAct = p === _currentAdminNfcPage;
      btnsHtml += `<button onclick="changeAdminNfcPage(${p})" style="padding:6px 12px; font-size:12px; font-weight:800; border-radius:8px; border:1px solid ${isAct ? '#059669' : '#cbd5e1'}; background:${isAct ? '#059669' : '#ffffff'}; color:${isAct ? '#ffffff' : '#334155'}; cursor:pointer;">${p}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) btnsHtml += `<span style="color:#94a3b8; padding:0 2px;">...</span>`;
      btnsHtml += `<button onclick="changeAdminNfcPage(${totalPages})" style="padding:6px 10px; font-size:12px; font-weight:700; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#334155; cursor:pointer;">${totalPages}</button>`;
    }

    btnsHtml += `<button onclick="changeAdminNfcPage(${_currentAdminNfcPage + 1})" ${_currentAdminNfcPage === totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} style="padding:6px 12px; font-size:12px; font-weight:700; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#334155; cursor:pointer;">Trang sau ►</button>`;

    pagBtns.innerHTML = btnsHtml;
  }
}

function changeAdminNfcPage(page) {
  _currentAdminNfcPage = page;
  renderAdminNfcPageTable(_filteredAdminNfcTags);
}
window.changeAdminNfcPage = changeAdminNfcPage;

let _adminNfcSortField = 'time';
let _adminNfcSortOrder = 'desc';

function onAdminNfcSortDropdownChange(val) {
  if (!val) return;
  if (val === 'time_desc') { _adminNfcSortField = 'time'; _adminNfcSortOrder = 'desc'; }
  else if (val === 'time_asc') { _adminNfcSortField = 'time'; _adminNfcSortOrder = 'asc'; }
  else if (val === 'tree_asc') { _adminNfcSortField = 'tree'; _adminNfcSortOrder = 'asc'; }
  else if (val === 'tree_desc') { _adminNfcSortField = 'tree'; _adminNfcSortOrder = 'desc'; }
  else if (val === 'uid_asc') { _adminNfcSortField = 'uid'; _adminNfcSortOrder = 'asc'; }
  else if (val === 'uid_desc') { _adminNfcSortField = 'uid'; _adminNfcSortOrder = 'desc'; }
  else if (val === 'assigned_first') { _adminNfcSortField = 'status'; _adminNfcSortOrder = 'desc'; }
  else if (val === 'unassigned_first') { _adminNfcSortField = 'status'; _adminNfcSortOrder = 'asc'; }
  
  updateAdminNfcSortIcons();
  filterAdminNfcTable();
}
window.onAdminNfcSortDropdownChange = onAdminNfcSortDropdownChange;

function toggleAdminNfcSort(field) {
  if (_adminNfcSortField === field) {
    _adminNfcSortOrder = _adminNfcSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    _adminNfcSortField = field;
    _adminNfcSortOrder = (field === 'time' || field === 'status') ? 'desc' : 'asc';
  }

  const sortSelect = document.getElementById('db-nfc-sort-select');
  if (sortSelect) {
    if (_adminNfcSortField === 'time') sortSelect.value = _adminNfcSortOrder === 'asc' ? 'time_asc' : 'time_desc';
    else if (_adminNfcSortField === 'tree') sortSelect.value = _adminNfcSortOrder === 'asc' ? 'tree_asc' : 'tree_desc';
    else if (_adminNfcSortField === 'uid') sortSelect.value = _adminNfcSortOrder === 'asc' ? 'uid_asc' : 'uid_desc';
    else if (_adminNfcSortField === 'status') sortSelect.value = _adminNfcSortOrder === 'asc' ? 'unassigned_first' : 'assigned_first';
  }

  updateAdminNfcSortIcons();
  filterAdminNfcTable();
}
window.toggleAdminNfcSort = toggleAdminNfcSort;

function updateAdminNfcSortIcons() {
  ['id', 'uid', 'status', 'tree', 'time'].forEach(col => {
    const iconEl = document.getElementById(`sort-icon-${col}`);
    if (!iconEl) return;
    if (_adminNfcSortField === col) {
      iconEl.style.opacity = '1';
      iconEl.style.color = '#059669';
      iconEl.innerHTML = _adminNfcSortOrder === 'asc' 
        ? '<i data-lucide="arrow-up" class="lucide-sm"></i>' 
        : '<i data-lucide="arrow-down" class="lucide-sm"></i>';
    } else {
      iconEl.style.opacity = '0.4';
      iconEl.style.color = '#94a3b8';
      iconEl.innerHTML = '<i data-lucide="arrow-up-down" class="lucide-sm"></i>';
    }
  });
}
window.updateAdminNfcSortIcons = updateAdminNfcSortIcons;

function filterAdminNfcTable() {
  const q = (document.getElementById('db-nfc-table-search')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('db-nfc-status-filter')?.value || 'all';
  _currentAdminNfcPage = 1;

  let list = (_nfcInventoryCache || []).slice();

  // 1. Lọc theo trạng thái & GPS
  if (statusFilter === 'unassigned') {
    list = list.filter(t => t.status !== 'assigned');
  } else if (statusFilter === 'assigned') {
    list = list.filter(t => t.status === 'assigned');
  } else if (statusFilter === 'has_gps') {
    list = list.filter(t => t.status === 'assigned' && t.latitude != null && t.longitude != null && !isNaN(Number(t.latitude)) && !isNaN(Number(t.longitude)) && (Number(t.latitude) !== 0 || Number(t.longitude) !== 0));
  } else if (statusFilter === 'no_gps') {
    list = list.filter(t => t.status === 'assigned' && (t.latitude == null || t.longitude == null || isNaN(Number(t.latitude)) || isNaN(Number(t.longitude)) || (Number(t.latitude) === 0 && Number(t.longitude) === 0)));
  }

  // 2. Lọc theo từ khóa tìm kiếm (UID, số cây, loại cây, giống cây, vị trí, GPS)
  if (q) {
    list = list.filter(t => {
      const matchUid = t.nfc_uid && t.nfc_uid.toLowerCase().includes(q);
      const matchTree = t.tree_code && String(t.tree_code).toLowerCase().includes(q);
      const matchPlantId = t.plant_id && String(t.plant_id).includes(q);
      const matchType = t.plant_type && t.plant_type.toLowerCase().includes(q);
      const matchVariety = t.plant_variety && t.plant_variety.toLowerCase().includes(q);
      const matchLoc = t.location && t.location.toLowerCase().includes(q);
      const matchGps = (t.latitude && String(t.latitude).includes(q)) || (t.longitude && String(t.longitude).includes(q));
      return matchUid || matchTree || matchPlantId || matchType || matchVariety || matchLoc || matchGps;
    });
  }

  // 3. Sắp xếp danh sách
  list.sort((a, b) => {
    let cmp = 0;
    if (_adminNfcSortField === 'id') {
      cmp = (a.id || 0) - (b.id || 0);
    } else if (_adminNfcSortField === 'uid') {
      cmp = String(a.nfc_uid || '').localeCompare(String(b.nfc_uid || ''));
    } else if (_adminNfcSortField === 'status') {
      const aVal = a.status === 'assigned' ? 1 : 0;
      const bVal = b.status === 'assigned' ? 1 : 0;
      cmp = aVal - bVal;
    } else if (_adminNfcSortField === 'tree') {
      const aTree = a.tree_code != null ? a.tree_code : (a.plant_id || '');
      const bTree = b.tree_code != null ? b.tree_code : (b.plant_id || '');
      const aNum = parseInt(String(aTree).replace(/\D/g, ''));
      const bNum = parseInt(String(bTree).replace(/\D/g, ''));
      if (!isNaN(aNum) && !isNaN(bNum)) {
        cmp = aNum - bNum;
      } else {
        cmp = String(aTree).localeCompare(String(bTree));
      }
    } else if (_adminNfcSortField === 'time') {
      const aTime = a.scanned_at ? new Date(a.scanned_at).getTime() : (a.id || 0);
      const bTime = b.scanned_at ? new Date(b.scanned_at).getTime() : (b.id || 0);
      cmp = aTime - bTime;
    }
    return _adminNfcSortOrder === 'asc' ? cmp : -cmp;
  });

  renderAdminNfcPageTable(list);
}
window.filterAdminNfcTable = filterAdminNfcTable;

// ═══════════════════════════════════════════════════════════════
// SMART NFC INVENTORY SCAN ENGINE (RATE LIMIT 3 REQ/S & 3S DEBOUNCE)
// ═══════════════════════════════════════════════════════════════
const NFC_SCAN_RATE_LIMIT_MS = 333; // Tối đa 3 req/s
const NFC_SAME_TAG_WAIT_MS = 3000;  // 3s yên lặng chờ với cùng 1 thẻ

const _nfcScanEngine = {
  lastUid: null,
  lastScanTime: 0,
  lastReqTime: 0,
  isProcessing: false,
  knownUids: new Set(),

  resetState() {
    this.lastUid = null;
    this.lastScanTime = 0;
    this.lastReqTime = 0;
    this.isProcessing = false;
  },

  syncKnownUids(tags) {
    this.knownUids.clear();
    if (Array.isArray(tags)) {
      tags.forEach(t => {
        if (t && t.nfc_uid) this.knownUids.add(t.nfc_uid.trim().toUpperCase());
      });
    }
  },

  async processScan(rawUid, source = 'page') {
    if (!rawUid || typeof rawUid !== 'string') return;
    const cleanUid = rawUid.trim().toUpperCase();
    if (!cleanUid) return;

    if (!_currentInvFarmId) {
      toast('Vui lòng chọn trang trại quản lý kho thẻ trước!', 'error');
      return;
    }

    const now = Date.now();

    // ── QUY TẮC 1: NẾU VẪN LÀ THẺ ĐÓ ──
    if (this.lastUid === cleanUid) {
      const elapsed = now - this.lastScanTime;

      // Trong vòng 3s: Vẫn là ID thẻ đó -> Yên lặng đợi (không cảnh báo, không thông báo rác)
      if (elapsed < NFC_SAME_TAG_WAIT_MS) {
        return;
      }

      // Sau 3s: Vẫn là thẻ đó -> Cảnh báo thẻ đã tồn tại trong kho
      this.lastScanTime = now; // Cập nhật mốc thời gian để tránh spam chuỗi beep
      playAdminDuplicateBeep();
      toast(`⚠️ Thẻ ${cleanUid} đã tồn tại trong kho trang trại!`, 'error');
      return;
    }

    // ── QUY TẮC 2: THẺ MỚI KHÁC BIỆT HOẶC LẦN QUÉT ĐẦU TIÊN ──
    // Kiểm tra Rate Limit: Tối đa 3 requests/giây (khoảng cách 333ms)
    if (now - this.lastReqTime < NFC_SCAN_RATE_LIMIT_MS) {
      return;
    }

    if (this.isProcessing) return;
    this.isProcessing = true;
    this.lastReqTime = now;

    // Kiểm tra nhanh bộ nhớ cục bộ nếu thẻ đã có sẵn trong kho
    if (this.knownUids.has(cleanUid)) {
      this.lastUid = cleanUid;
      this.lastScanTime = now;
      this.isProcessing = false;
      playAdminDuplicateBeep();
      toast(`⚠️ Trùng lặp: Thẻ ${cleanUid} đã có trong kho!`, 'error');
      return;
    }

    // Gửi API lưu kho thẻ mới
    try {
      const res = await api(`/plants/farms/${_currentInvFarmId}/nfc-inventory/batch`, {
        method: 'POST',
        body: JSON.stringify({ uids: [cleanUid] })
      });

      this.lastUid = cleanUid;
      this.lastScanTime = Date.now();
      this.knownUids.add(cleanUid);

      if (res.added && res.added.length > 0) {
        playAdminSuccessDing();
        toast(`✨ Đã quẹt thành công và lưu kho thẻ: ${cleanUid}`, 'success');
        if (source === 'page') {
          await loadAdminNfcPageData(_currentInvFarmId);
        } else {
          await loadNfcInventoryData(_currentInvFarmId);
        }
      } else {
        playAdminDuplicateBeep();
        toast(`⚠️ Trùng lặp: Thẻ ${cleanUid} đã có trong kho!`, 'error');
      }
    } catch (err) {
      this.lastUid = cleanUid;
      this.lastScanTime = Date.now();
      this.knownUids.add(cleanUid);
      playAdminDuplicateBeep();
      toast(`⚠️ ${err.message || `Thẻ ${cleanUid} đã có trong kho!`}`, 'error');
    } finally {
      this.isProcessing = false;
    }
  }
};

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

  await _nfcScanEngine.processScan(uid, 'page');
  inputEl.value = '';
  inputEl.focus();
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
    _nfcScanEngine.resetState();

    const btn = document.getElementById('btn-toggle-continuous-nfc-page');
    if (btn) {
      btn.style.background = '#dc2626';
      btn.innerHTML = '<i data-lucide="square" class="lucide-sm"></i> Dừng Quét Liên Tục';
    }

    const pill = document.getElementById('db-nfc-scan-status-pill');
    const text = document.getElementById('db-nfc-scan-status-text');
    if (pill) { pill.style.background = '#fef2f2'; pill.style.color = '#991b1b'; pill.style.borderColor = '#fca5a5'; }
    if (text) text.innerHTML = '<i data-lucide="radio" class="lucide-spin lucide-sm"></i> ĐANG QUÉT LIÊN TỤC — CHẠM THẺ VÀO LƯNG MÁY';

    _ndefReaderInstancePage.addEventListener('reading', async ({ serialNumber }) => {
      if (!serialNumber) return;
      await _nfcScanEngine.processScan(serialNumber, 'page');
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
  _nfcScanEngine.resetState();

  const btn = document.getElementById('btn-toggle-continuous-nfc-page');
  if (btn) {
    btn.style.background = 'linear-gradient(135deg, #10b981, #047857)';
    btn.innerHTML = '<i data-lucide="play" class="lucide-sm"></i> Bật Quét Thẻ Liên Tục (Web NFC)';
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

let _currentModalNfcPage = 1;
const MODAL_NFC_PAGE_SIZE = 10;
let _filteredModalNfcTags = [];

async function loadNfcInventoryData(farmId) {
  try {
    const res = await api(`/plants/farms/${farmId}/nfc-inventory`);
    _nfcInventoryCache = res.tags || res.items || [];
    if (typeof _nfcScanEngine !== 'undefined') {
      _nfcScanEngine.syncKnownUids(_nfcInventoryCache);
    }
    _currentModalNfcPage = 1;

    const total = res.stats?.total ?? _nfcInventoryCache.length;
    const assigned = res.stats?.assigned ?? _nfcInventoryCache.filter(t => t.status === 'assigned').length;
    const unassigned = res.stats?.unassigned ?? _nfcInventoryCache.filter(t => t.status !== 'assigned').length;

    const totalEl = document.getElementById('nfc-inv-total-count');
    const assignedEl = document.getElementById('nfc-inv-assigned-count');
    const unassignedEl = document.getElementById('nfc-inv-unassigned-count');

    if (totalEl) totalEl.textContent = total;
    if (assignedEl) assignedEl.textContent = assigned;
    if (unassignedEl) unassignedEl.textContent = unassigned;

    renderNfcInventoryTable(_nfcInventoryCache);
  } catch (err) {
    toast('Lỗi tải danh sách kho thẻ: ' + err.message, 'error');
  }
}

function renderNfcInventoryTable(tags) {
  const tbody = document.getElementById('nfc-inventory-table-body');
  const pagInfo = document.getElementById('nfc-modal-pagination-info');
  const pagBtns = document.getElementById('nfc-modal-pagination-btns');
  if (!tbody) return;

  _filteredModalNfcTags = tags || [];

  if (!_filteredModalNfcTags || _filteredModalNfcTags.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:36px; color:#94a3b8;">
          <i data-lucide="package" class="lucide-sm" style="font-size:32px; margin-bottom:10px; display:inline-block; color:#cbd5e1;"></i>
          <p style="margin:0; font-weight:700; font-size:13.5px; color:#64748b;">Kho thẻ NFC của trang trại này chưa có thẻ nào.</p>
          <small style="color:#94a3b8;">Hãy bật chế độ quét liên tục hoặc quẹt thẻ USB để nạp cọc thẻ vào kho.</small>
        </td>
      </tr>`;
    if (pagInfo) pagInfo.textContent = 'Hiển thị 0 thẻ';
    if (pagBtns) pagBtns.innerHTML = '';
    return;
  }

  // 10 bản ghi trong 1 trang
  const totalItems = _filteredModalNfcTags.length;
  const totalPages = Math.ceil(totalItems / MODAL_NFC_PAGE_SIZE) || 1;
  if (_currentModalNfcPage > totalPages) _currentModalNfcPage = totalPages;
  if (_currentModalNfcPage < 1) _currentModalNfcPage = 1;

  const startIdx = (_currentModalNfcPage - 1) * MODAL_NFC_PAGE_SIZE;
  const endIdx = Math.min(startIdx + MODAL_NFC_PAGE_SIZE, totalItems);
  const pageItems = _filteredModalNfcTags.slice(startIdx, endIdx);

  tbody.innerHTML = pageItems.map((t, idx) => {
    const isAssigned = t.status === 'assigned';
    const statusPill = isAssigned
      ? `<span style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:11px; font-weight:800; padding:3px 10px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="link" class="lucide-sm"></i> Đã gán</span>`
      : `<span style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-size:11px; font-weight:800; padding:3px 10px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="check" class="lucide-sm"></i> Chưa gán</span>`;

    let plantInfo = `<span style="color:#94a3b8; font-style:italic;">— Sẵn sàng gán —</span>`;
    if (isAssigned && (t.tree_code || t.plant_id)) {
      const treeCodeText = t.tree_code ? `Cây #${t.tree_code}` : `Cây #${t.plant_id}`;
      const plantTypeDesc = t.plant_variety ? `${t.plant_type || 'Cây'} (${t.plant_variety})` : (t.plant_type || 'Cây trồng');
      const hasGps = t.latitude != null && t.longitude != null && !isNaN(Number(t.latitude)) && !isNaN(Number(t.longitude)) && (Number(t.latitude) !== 0 || Number(t.longitude) !== 0);
      const gpsLat = hasGps ? Number(t.latitude).toFixed(6) : null;
      const gpsLng = hasGps ? Number(t.longitude).toFixed(6) : null;
      const locationText = t.location || (t.plant_data && (t.plant_data.tag_position || t.plant_data.location)) || '';

      plantInfo = `
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div>
            <strong style="color:#0f172a; font-size:12.5px;">🌳 ${esc(treeCodeText)}</strong> 
            <span style="font-size:11px; color:#64748b; font-weight:600;">${esc(plantTypeDesc)}</span>
          </div>
          ${hasGps ? `
            <div style="display:inline-flex; align-items:center; gap:3px; font-size:11px; color:#047857; font-weight:700;">
              <i data-lucide="map-pin" class="lucide-sm" style="color:#059669;"></i> ${gpsLat}, ${gpsLng}
              <a href="https://www.google.com/maps?q=${gpsLat},${gpsLng}" target="_blank" title="Mở Google Maps" style="color:#2563eb; text-decoration:none; margin-left:2px;">
                <i data-lucide="external-link" class="lucide-sm"></i>
              </a>
            </div>
          ` : `
            <span style="color:#d97706; font-size:10.5px;"><i data-lucide="alert-circle" class="lucide-sm"></i> Chưa lấy GPS</span>
          `}
          ${locationText ? `
            <div style="color:#64748b; font-size:10.5px;">
              <i data-lucide="tag" class="lucide-sm"></i> ${esc(locationText)}
            </div>
          ` : ''}
        </div>
      `;
    }

    const timeStr = t.scanned_at ? new Date(t.scanned_at).toLocaleString('vi-VN') : '—';
    const rowStt = startIdx + idx + 1;

    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 12px; text-align:center; font-weight:700; color:#64748b;">${rowStt}</td>
        <td style="padding:10px 12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <code style="font-size:13px; font-weight:800; color:#065f46; background:#ecfdf5; border:1px solid #a7f3d0; padding:3px 8px; border-radius:6px; font-family:monospace;">${esc(t.nfc_uid)}</code>
            <button type="button" onclick="navigator.clipboard.writeText('${esc(t.nfc_uid)}'); toast('Đã copy mã UID: ${esc(t.nfc_uid)}');" title="Sao chép UID" style="border:none; background:transparent; color:#64748b; cursor:pointer; font-size:12px; padding:2px 4px;">
              <i data-lucide="copy" class="lucide-sm"></i>
            </button>
          </div>
        </td>
        <td style="padding:10px 12px; text-align:center;">${statusPill}</td>
        <td style="padding:10px 12px;">${plantInfo}</td>
        <td style="padding:10px 12px; font-size:12px; color:#64748b;">${timeStr}</td>
        <td style="padding:10px 12px; text-align:center;">
          <button type="button" onclick="deleteAdminNfcTag(${t.id}, '${esc(t.nfc_uid)}')" title="Xóa thẻ khỏi kho" style="border:none; background:#fee2e2; color:#dc2626; border-radius:6px; width:30px; height:30px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all 0.2s ease;">
            <i data-lucide="trash-2" class="lucide-sm"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (pagInfo) {
    pagInfo.textContent = `Hiển thị ${startIdx + 1} - ${endIdx} trong tổng số ${totalItems} thẻ (Trang ${_currentModalNfcPage}/${totalPages})`;
  }

  if (pagBtns) {
    let btnsHtml = '';
    btnsHtml += `<button onclick="changeModalNfcPage(${_currentModalNfcPage - 1})" ${_currentModalNfcPage === 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} style="padding:5px 10px; font-size:12px; font-weight:700; border-radius:6px; border:1px solid #cbd5e1; background:#ffffff; color:#334155; cursor:pointer;">◄</button>`;

    let startPage = Math.max(1, _currentModalNfcPage - 2);
    let endPage = Math.min(totalPages, _currentModalNfcPage + 2);

    if (startPage > 1) {
      btnsHtml += `<button onclick="changeModalNfcPage(1)" style="padding:5px 8px; font-size:12px; font-weight:700; border-radius:6px; border:1px solid #cbd5e1; background:#ffffff; color:#334155; cursor:pointer;">1</button>`;
      if (startPage > 2) btnsHtml += `<span style="color:#94a3b8; padding:0 2px;">...</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
      const isAct = p === _currentModalNfcPage;
      btnsHtml += `<button onclick="changeModalNfcPage(${p})" style="padding:5px 10px; font-size:12px; font-weight:800; border-radius:6px; border:1px solid ${isAct ? '#059669' : '#cbd5e1'}; background:${isAct ? '#059669' : '#ffffff'}; color:${isAct ? '#ffffff' : '#334155'}; cursor:pointer;">${p}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) btnsHtml += `<span style="color:#94a3b8; padding:0 2px;">...</span>`;
      btnsHtml += `<button onclick="changeModalNfcPage(${totalPages})" style="padding:5px 8px; font-size:12px; font-weight:700; border-radius:6px; border:1px solid #cbd5e1; background:#ffffff; color:#334155; cursor:pointer;">${totalPages}</button>`;
    }

    btnsHtml += `<button onclick="changeModalNfcPage(${_currentModalNfcPage + 1})" ${_currentModalNfcPage === totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} style="padding:5px 10px; font-size:12px; font-weight:700; border-radius:6px; border:1px solid #cbd5e1; background:#ffffff; color:#334155; cursor:pointer;">►</button>`;

    pagBtns.innerHTML = btnsHtml;
  }
}

function changeModalNfcPage(page) {
  _currentModalNfcPage = page;
  renderNfcInventoryTable(_filteredModalNfcTags);
}
window.changeModalNfcPage = changeModalNfcPage;

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

  await _nfcScanEngine.processScan(uid, 'modal');
  inputEl.value = '';
  inputEl.focus();
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
    _nfcScanEngine.resetState();

    const btn = document.getElementById('btn-toggle-continuous-nfc');
    if (btn) {
      btn.style.background = '#dc2626';
      btn.innerHTML = '<i data-lucide="square" class="lucide-sm"></i> Dừng Quét Liên Tục';
    }

    const pill = document.getElementById('nfc-scan-status-pill');
    const text = document.getElementById('nfc-scan-status-text');
    if (pill) { pill.style.background = '#fef2f2'; pill.style.color = '#991b1b'; pill.style.borderColor = '#fca5a5'; }
    if (text) text.innerHTML = '<i data-lucide="radio" class="lucide-spin lucide-sm"></i> ĐANG QUÉT LIÊN TỤC — CHẠM THẺ VÀO LƯNG MÁY';

    _ndefReaderInstance.addEventListener('reading', async ({ serialNumber }) => {
      if (!serialNumber) return;
      await _nfcScanEngine.processScan(serialNumber, 'modal');
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
  _nfcScanEngine.resetState();

  const btn = document.getElementById('btn-toggle-continuous-nfc');
  if (btn) {
    btn.style.background = 'linear-gradient(135deg, #10b981, #047857)';
    btn.innerHTML = '<i data-lucide="play" class="lucide-sm"></i> Bật Quét Thẻ Liên Tục (Web NFC)';
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

async function unassignAdminNfcTag(tagId, uid, plantId) {
  if (!_currentInvFarmId) return;
  if (!confirm(`Bạn có chắc chắn muốn gỡ thẻ NFC "${uid}" khỏi cây trồng?\n\nThẻ sẽ được chuyển về trạng thái "Còn trống (Sẵn sàng)" trong kho, lịch sử canh tác của cây vẫn được giữ nguyên 100%.`)) return;

  try {
    const res = await api(`/plants/farms/${_currentInvFarmId}/nfc-inventory/${tagId}/unassign`, {
      method: 'POST'
    });
    toast(res.message || `Đã gỡ thẻ ${uid} khỏi cây thành công!`, 'success');
    await loadAdminNfcPageData(_currentInvFarmId);
    if (typeof loadPlants === 'function') loadPlants();
  } catch (err) {
    toast('Lỗi gỡ thẻ: ' + err.message, 'error');
  }
}
window.unassignAdminNfcTag = unassignAdminNfcTag;

async function unassignAllAdminNfcTags() {
  if (!_currentInvFarmId) {
    toast('Vui lòng chọn Trang trại trước!', 'error');
    return;
  }
  const farms = window._allFarmsCache || (typeof dbFarmsCache !== 'undefined' ? dbFarmsCache : []);
  const farmObj = (farms || []).find(f => f.id == _currentInvFarmId);
  const farmName = farmObj ? farmObj.name : `Trang trại #${_currentInvFarmId}`;

  if (!confirm(`⚠️ XÁC NHẬN GỠ TOÀN BỘ THẺ NFC CỦA TRANG TRẠI "${farmName.toUpperCase()}"?\n\n- Toàn bộ cây đang gắn thẻ trong trang trại này sẽ được gỡ mã thẻ.\n- Toàn bộ thẻ trong kho sẽ chuyển về trạng thái "Còn trống (Sẵn sàng)".\n- 100% Nhật ký chăm sóc, phân bón, tưới tiêu và lịch sử canh tác của cây vẫn được bảo lưu nguyên vẹn trong hệ thống.`)) {
    return;
  }

  try {
    const res = await api(`/plants/farms/${_currentInvFarmId}/nfc-inventory/unassign-all`, {
      method: 'POST'
    });
    toast(`🎉 ${res.message}`, 'success');
    await loadAdminNfcPageData(_currentInvFarmId);
    if (typeof loadPlants === 'function') loadPlants();
  } catch (err) {
    toast('Lỗi gỡ toàn bộ thẻ: ' + err.message, 'error');
  }
}
window.unassignAllAdminNfcTags = unassignAllAdminNfcTags;

// ─── NFC Inventory Export & Symmetrical Import Controller ───────────────────
let _parsedNfcImportData = null;

/**
 * Export Admin NFC Inventory to CSV / Excel with UTF-8 BOM
 */
async function exportAdminNfcInventoryCsv(farmId = null) {
  const targetFarmId = farmId || _currentInvFarmId || getActiveAdminFarmId();
  if (!targetFarmId) {
    toast('Vui lòng chọn Trang trại trước khi xuất dữ liệu!', 'error');
    return;
  }

  try {
    const farms = window._allFarmsCache || (typeof dbFarmsCache !== 'undefined' ? dbFarmsCache : []);
    const farmObj = (farms || []).find(f => f.id == targetFarmId);
    const farmName = farmObj ? farmObj.name : `TrangTrai_${targetFarmId}`;
    const cleanFarmName = farmName.replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_').replace(/_+/g, '_');

    let tags = _nfcInventoryCache;
    if (!tags || tags.length === 0 || (_currentInvFarmId != targetFarmId)) {
      const res = await api(`/plants/farms/${targetFarmId}/nfc-inventory`);
      tags = res.tags || res.items || [];
    }

    if (!tags || tags.length === 0) {
      toast('Kho thẻ NFC của trang trại này đang trống, không có dữ liệu để xuất!', 'error');
      return;
    }

    const headers = [
      'STT',
      'Mã Thẻ NFC (UID)',
      'Trạng Thái',
      'Mã Cây Gắn',
      'Loại Cây / Giống',
      'Vị Trí',
      'Vĩ Độ (Lat)',
      'Kinh Độ (Lng)',
      'Link Public URL',
      'Thời Gian Nhập Kho'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    const csvRows = [headers.map(escapeCsv).join(',')];

    tags.forEach((t, idx) => {
      const isAssigned = t.status === 'assigned';
      const statusText = isAssigned ? 'Đã gán cây' : 'Còn trống (Sẵn sàng)';
      const treeCodeText = t.tree_code != null ? String(t.tree_code) : (t.plant_id ? String(t.plant_id) : '');
      const plantTypeDesc = t.plant_variety ? `${t.plant_type || ''} (${t.plant_variety})` : (t.plant_type || '');
      const locationText = t.location || (t.plant_data && (t.plant_data.tag_position || t.plant_data.location)) || '';
      
      const hasGps = t.latitude != null && t.longitude != null && !isNaN(Number(t.latitude)) && !isNaN(Number(t.longitude)) && (Number(t.latitude) !== 0 || Number(t.longitude) !== 0);
      const latStr = hasGps ? Number(t.latitude).toFixed(6) : '';
      const lngStr = hasGps ? Number(t.longitude).toFixed(6) : '';
      
      let publicUrl = t.public_url || '';
      if (publicUrl && !publicUrl.startsWith('http')) {
        publicUrl = `${window.location.origin}${publicUrl}`;
      }

      const timeStr = t.scanned_at ? new Date(t.scanned_at).toLocaleString('vi-VN') : '';

      const row = [
        idx + 1,
        t.nfc_uid || '',
        statusText,
        treeCodeText,
        plantTypeDesc,
        locationText,
        latStr,
        lngStr,
        publicUrl,
        timeStr
      ];

      csvRows.push(row.map(escapeCsv).join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    link.setAttribute('href', url);
    link.setAttribute('download', `Kho_The_NFC_${cleanFarmName}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast(`📥 Đã xuất thành công ${tags.length} thẻ NFC ra file CSV / Excel!`, 'success');
  } catch (err) {
    console.error('Error exporting NFC CSV:', err);
    toast('Lỗi khi xuất file CSV: ' + err.message, 'error');
  }
}
window.exportAdminNfcInventoryCsv = exportAdminNfcInventoryCsv;

/**
 * Download standard sample CSV template for NFC inventory import
 */
function downloadNfcSampleCsv() {
  const sampleHeaders = [
    'STT',
    'Mã Thẻ NFC (UID)',
    'Trạng Thái',
    'Mã Cây Gắn',
    'Loại Cây / Giống',
    'Vị Trí',
    'Vĩ Độ (Lat)',
    'Kinh Độ (Lng)',
    'Link Public URL',
    'Thời Gian Nhập Kho'
  ];

  const sampleRows = [
    ['1', '04:20:CF:5A:25:20:91', 'Đã gán cây', '1', 'Sầu riêng (Ri6)', 'Hàng 1 Cây 1', '10.762622', '106.660172', '', ''],
    ['2', '04:21:D1:5A:25:20:92', 'Đã gán cây', '2', 'Sầu riêng (Ri6)', 'Hàng 1 Cây 2', '10.762635', '106.660190', '', ''],
    ['3', '04:22:E3:5A:25:20:93', 'Còn trống (Sẵn sàng)', '', '', '', '', '', '', ''],
    ['4', '04:23:F4:5A:25:20:94', 'Còn trống (Sẵn sàng)', '', '', '', '', '', '', ''],
    ['5', '04:24:A5:5A:25:20:95', 'Còn trống (Sẵn sàng)', '', '', '', '', '', '', '']
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const csvContent = '\uFEFF' + [
    sampleHeaders.map(escapeCsv).join(','),
    ...sampleRows.map(r => r.map(escapeCsv).join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'Mau_Import_Kho_The_NFC_Chuan.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast('📄 Đã tải file CSV mẫu chuẩn về máy!', 'success');
}
window.downloadNfcSampleCsv = downloadNfcSampleCsv;

/**
 * Open Admin NFC Import Modal
 */
async function openAdminNfcImportModal(farmId = null) {
  const targetFarmId = farmId || _currentInvFarmId || getActiveAdminFarmId();
  if (!targetFarmId) {
    toast('Vui lòng chọn hoặc tạo Trang trại trước khi import thẻ!', 'error');
    return;
  }

  const farms = window._allFarmsCache || (typeof dbFarmsCache !== 'undefined' ? dbFarmsCache : []);
  const selectEl = document.getElementById('nfc-import-farm-select');
  if (selectEl && farms && farms.length > 0) {
    selectEl.innerHTML = farms.map(f => `<option value="${f.id}">🏡 ${esc(f.name)} ${f.owner_name ? `(${esc(f.owner_name)})` : ''}</option>`).join('');
    selectEl.value = targetFarmId;
  }

  // Reset modal state
  _parsedNfcImportData = null;
  const fileInput = document.getElementById('nfc-import-file-input');
  if (fileInput) fileInput.value = '';
  
  const fileBadge = document.getElementById('nfc-import-file-badge');
  if (fileBadge) fileBadge.style.display = 'none';

  const previewSec = document.getElementById('nfc-import-preview-section');
  if (previewSec) previewSec.style.display = 'none';

  const progressBox = document.getElementById('nfc-import-progress-box');
  if (progressBox) progressBox.style.display = 'none';

  const submitBtn = document.getElementById('btn-submit-nfc-import');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.style.background = '#cbd5e1';
    submitBtn.style.color = '#64748b';
    submitBtn.style.cursor = 'not-allowed';
    submitBtn.innerHTML = '<i data-lucide="upload-cloud" class="lucide-sm"></i> Bắt Đầu Import Vào Kho';
  }

  const modal = document.getElementById('nfc-import-modal');
  if (modal) modal.style.display = 'flex';
}
window.openAdminNfcImportModal = openAdminNfcImportModal;

function closeAdminNfcImportModal() {
  const modal = document.getElementById('nfc-import-modal');
  if (modal) modal.style.display = 'none';
}
window.closeAdminNfcImportModal = closeAdminNfcImportModal;

/**
 * Handle Drag and Drop for CSV Import
 */
function handleNfcImportDrop(event) {
  event.preventDefault();
  const dropzone = document.getElementById('nfc-import-dropzone');
  if (dropzone) {
    dropzone.style.borderColor = '#cbd5e1';
    dropzone.style.background = '#f8fafc';
  }

  if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
    const file = event.dataTransfer.files[0];
    processNfcImportFile(file);
  }
}
window.handleNfcImportDrop = handleNfcImportDrop;

/**
 * Handle File Selection from Input
 */
function handleNfcImportFileSelect(event) {
  if (event.target && event.target.files && event.target.files.length > 0) {
    const file = event.target.files[0];
    processNfcImportFile(file);
  }
}
window.handleNfcImportFileSelect = handleNfcImportFileSelect;

/**
 * Process and Read CSV/TXT File
 */
function processNfcImportFile(file) {
  if (!file) return;

  const fileNameEl = document.getElementById('nfc-import-file-name');
  const fileBadge = document.getElementById('nfc-import-file-badge');
  if (fileNameEl) fileNameEl.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  if (fileBadge) fileBadge.style.display = 'inline-flex';

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const parsed = parseNfcCsvContent(text);
    _parsedNfcImportData = parsed;
    renderNfcImportPreview(parsed);
  };
  reader.onerror = function() {
    toast('Không thể đọc file đã chọn!', 'error');
  };
  reader.readAsText(file, 'utf-8');
}

/**
 * Parse CSV Content with Symmetrical Detection
 */
function parseNfcCsvContent(text) {
  if (!text || typeof text !== 'string') {
    return { totalRows: 0, items: [], validTags: [], duplicates: [], treeCount: 0 };
  }

  // Remove BOM if present
  let cleanText = text.replace(/^\uFEFF/, '').trim();
  if (!cleanText) {
    return { totalRows: 0, items: [], validTags: [], duplicates: [], treeCount: 0 };
  }

  const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) {
    return { totalRows: 0, items: [], validTags: [], duplicates: [], treeCount: 0 };
  }

  // Detect delimiter
  const firstLine = lines[0];
  let delimiter = ',';
  if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) delimiter = ';';
  else if ((firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length) delimiter = '\t';

  // Helper to split CSV row handling quotes
  const parseRow = (line) => {
    const cells = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (c === delimiter && !inQuote) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    cells.push(cur.trim());
    return cells;
  };

  // Header detection
  const headerCells = parseRow(firstLine).map(c => c.toLowerCase().trim());
  let uidIdx = -1;
  let treeIdx = -1;
  let latIdx = -1;
  let lngIdx = -1;
  let locIdx = -1;
  let hasHeader = false;

  headerCells.forEach((h, idx) => {
    if (h.includes('mã thẻ') || h.includes('uid') || h.includes('nfc') || h === 'tag' || h === 'mã uid') {
      if (uidIdx === -1) uidIdx = idx;
      hasHeader = true;
    } else if ((h.includes('mã cây') || h.includes('số cây') || h.includes('tree_code') || h.includes('plant_id') || h === 'cây' || h === 'tree' || h === 'mã cây gắn') && !h.includes('loại cây') && !h.includes('giống')) {
      if (treeIdx === -1) treeIdx = idx;
      hasHeader = true;
    } else if (h.includes('vĩ độ') || h.includes('latitude') || h === 'lat') {
      if (latIdx === -1) latIdx = idx;
      hasHeader = true;
    } else if (h.includes('kinh độ') || h.includes('longitude') || h === 'lng' || h === 'lon') {
      if (lngIdx === -1) lngIdx = idx;
      hasHeader = true;
    } else if (h.includes('vị trí') || h.includes('location') || h.includes('khu')) {
      if (locIdx === -1) locIdx = idx;
      hasHeader = true;
    }
  });

  let startRow = hasHeader ? 1 : 0;
  if (uidIdx === -1) {
    // If no header found with 'uid', default to column 1 (index 1 if STT exists, or index 0)
    uidIdx = (headerCells.length > 1 && /^\d+$/.test(headerCells[0])) ? 1 : 0;
  }

  const items = [];
  const seenUids = new Set();
  const duplicates = [];
  let treeCount = 0;

  for (let r = startRow; r < lines.length; r++) {
    const row = parseRow(lines[r]);
    if (!row || row.length === 0 || row.every(c => !c)) continue;

    let rawUid = row[uidIdx] || row[0] || '';
    rawUid = rawUid.replace(/["']/g, '').trim().toUpperCase();

    // Check if valid hex UID (colon, dash, space, or raw hex 8-20 chars)
    const isFormattedHex = /^[0-9A-F]{2}([:\-\s][0-9A-F]{2}){3,9}$/i.test(rawUid);
    const isRawHex = /^[0-9A-F]{8,20}$/i.test(rawUid);
    const isLikelyUid = isFormattedHex || isRawHex || (rawUid.length >= 8 && /^[0-9A-F:\-\s]+$/i.test(rawUid));

    if (!rawUid || !isLikelyUid) {
      // If single column or unformatted, try to extract hex pattern
      const match = rawUid.match(/[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){3,7}/);
      if (match) {
        rawUid = match[0].toUpperCase();
      } else {
        continue; // Skip invalid line
      }
    }

    // Format raw hex into standard colon-separated if raw (e.g. 0420CF5A252091 -> 04:20:CF:5A:25:20:91)
    let formattedUid = rawUid;
    if (/^[0-9A-F]{14}$/i.test(rawUid)) {
      formattedUid = rawUid.match(/.{2}/g).join(':').toUpperCase();
    } else if (rawUid.includes('-')) {
      formattedUid = rawUid.replace(/-/g, ':').toUpperCase();
    } else if (rawUid.includes(' ')) {
      formattedUid = rawUid.replace(/\s+/g, ':').toUpperCase();
    }

    if (seenUids.has(formattedUid)) {
      duplicates.push(formattedUid);
      continue;
    }
    seenUids.add(formattedUid);

    const rawTree = treeIdx !== -1 && row[treeIdx] ? row[treeIdx].replace(/["']/g, '').trim() : '';
    const rawLat = latIdx !== -1 && row[latIdx] ? row[latIdx].replace(/["']/g, '').trim() : null;
    const rawLng = lngIdx !== -1 && row[lngIdx] ? row[lngIdx].replace(/["']/g, '').trim() : null;
    const rawLoc = locIdx !== -1 && row[locIdx] ? row[locIdx].replace(/["']/g, '').trim() : '';

    if (rawTree) treeCount++;

    items.push({
      uid: formattedUid,
      tree_code: rawTree,
      latitude: rawLat,
      longitude: rawLng,
      location: rawLoc,
      row_num: r + 1
    });
  }

  return {
    totalRows: lines.length - (hasHeader ? 1 : 0),
    items,
    validTags: items,
    duplicates,
    treeCount
  };
}

/**
 * Render Live Preview for Parsed Import Data
 */
function renderNfcImportPreview(parsed) {
  const previewSec = document.getElementById('nfc-import-preview-section');
  const tbody = document.getElementById('nfc-import-preview-tbody');
  const submitBtn = document.getElementById('btn-submit-nfc-import');
  if (!previewSec || !tbody) return;

  const totalEl = document.getElementById('nfc-preview-total-rows');
  const validEl = document.getElementById('nfc-preview-valid-tags');
  const treeEl = document.getElementById('nfc-preview-tree-count');
  const dupEl = document.getElementById('nfc-preview-duplicate-tags');
  const noteEl = document.getElementById('nfc-preview-table-note');

  if (totalEl) totalEl.textContent = parsed.totalRows;
  if (validEl) validEl.textContent = parsed.items.length;
  if (treeEl) treeEl.textContent = parsed.treeCount;
  if (dupEl) dupEl.textContent = parsed.duplicates.length;

  if (noteEl) {
    noteEl.textContent = `Hiển thị ${Math.min(10, parsed.items.length)} / ${parsed.items.length} thẻ hợp lệ`;
  }

  if (parsed.items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:20px; color:#dc2626; font-weight:700;">
          <i data-lucide="alert-triangle" class="lucide-sm"></i> Không phát hiện mã UID thẻ NFC hợp lệ nào trong file!
        </td>
      </tr>`;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.style.background = '#cbd5e1';
      submitBtn.style.color = '#64748b';
      submitBtn.style.cursor = 'not-allowed';
    }
  } else {
    const previewRows = parsed.items.slice(0, 10);
    tbody.innerHTML = previewRows.map((it, idx) => {
      const hasGps = it.latitude && it.longitude;
      const gpsText = hasGps ? `${it.latitude}, ${it.longitude}` : '<span style="color:#94a3b8;">—</span>';
      const treeText = it.tree_code ? `<span style="background:#ecfdf5; color:#065f46; font-weight:800; padding:2px 8px; border-radius:4px; border:1px solid #a7f3d0;">🌳 Cây #${esc(it.tree_code)}</span>` : '<span style="color:#94a3b8;">— Còn trống —</span>';
      const locText = it.location ? esc(it.location) : '<span style="color:#94a3b8;">—</span>';

      return `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:8px 12px; text-align:center; font-weight:700; color:#64748b;">${idx + 1}</td>
          <td style="padding:8px 12px;">
            <code style="background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; padding:2px 8px; border-radius:4px; font-weight:800; font-family:monospace;">${esc(it.uid)}</code>
          </td>
          <td style="padding:8px 12px;">${treeText}</td>
          <td style="padding:8px 12px; font-size:11.5px; color:#475569;">${gpsText}</td>
          <td style="padding:8px 12px; font-size:11.5px; color:#475569;">${locText}</td>
          <td style="padding:8px 12px; text-align:center;">
            <span style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-size:11px; font-weight:800; padding:2px 8px; border-radius:10px; display:inline-flex; align-items:center; gap:4px;">
              <i data-lucide="check" class="lucide-sm"></i> Sẵn sàng
            </span>
          </td>
        </tr>
      `;
    }).join('');

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.style.background = 'linear-gradient(135deg, #10b981, #047857)';
      submitBtn.style.color = '#ffffff';
      submitBtn.style.cursor = 'pointer';
      submitBtn.innerHTML = `<i data-lucide="upload-cloud" class="lucide-sm"></i> Bắt Đầu Import Vào Kho (${parsed.items.length} Thẻ)`;
    }
  }

  previewSec.style.display = 'flex';
}

/**
 * Submit Parsed NFC Tags to Backend API
 */
async function submitAdminNfcImport() {
  if (!_parsedNfcImportData || !_parsedNfcImportData.items || _parsedNfcImportData.items.length === 0) {
    toast('Chưa có dữ liệu thẻ hợp lệ để import!', 'error');
    return;
  }

  const selectEl = document.getElementById('nfc-import-farm-select');
  const targetFarmId = selectEl && selectEl.value ? parseInt(selectEl.value) : (_currentInvFarmId || getActiveAdminFarmId());

  if (!targetFarmId) {
    toast('Vui lòng chọn Trang trại đích trước!', 'error');
    return;
  }

  const autoAssign = document.getElementById('nfc-import-opt-assign')?.checked ?? true;
  const updateGps = document.getElementById('nfc-import-opt-gps')?.checked ?? true;
  const skipDuplicates = document.getElementById('nfc-import-opt-skip')?.checked ?? true;

  const progressBox = document.getElementById('nfc-import-progress-box');
  const progressText = document.getElementById('nfc-import-progress-text');
  const submitBtn = document.getElementById('btn-submit-nfc-import');

  if (progressBox) progressBox.style.display = 'block';
  if (progressText) progressText.textContent = `Đang import ${_parsedNfcImportData.items.length} thẻ NFC vào kho...`;
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await api(`/plants/farms/${targetFarmId}/nfc-inventory/import`, {
      method: 'POST',
      body: JSON.stringify({
        items: _parsedNfcImportData.items,
        auto_assign: autoAssign,
        update_gps: updateGps,
        skip_duplicates: skipDuplicates
      })
    });

    playAdminSuccessDing();
    closeAdminNfcImportModal();

    toast(res.message || `🎉 Import thành công ${res.added_count || 0} thẻ NFC vào kho!`, 'success');
    
    // Refresh page data
    _currentInvFarmId = targetFarmId;
    const pageFarmSelect = document.getElementById('db-nfc-filter-farm');
    if (pageFarmSelect) pageFarmSelect.value = targetFarmId;
    await loadAdminNfcPageData(targetFarmId);
    if (typeof loadPlants === 'function') loadPlants();
  } catch (err) {
    console.error('Error importing NFC inventory:', err);
    playAdminDuplicateBeep();
    toast('Lỗi import kho thẻ: ' + err.message, 'error');
    if (progressBox) progressBox.style.display = 'none';
    if (submitBtn) submitBtn.disabled = false;
  }
}
window.submitAdminNfcImport = submitAdminNfcImport;

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
    if (treeDisplay) treeDisplay.innerHTML = '<span style="color:#ef4444; font-size:14px; font-weight:700;">Trang trại chưa có cây nào. Hãy tạo cây trước!</span>';
    return;
  }

  const p = _fieldTagPlants[_fieldTagIndex];
  if (!p) return;

  const total = _fieldTagPlants.length;
  const currentNum = _fieldTagIndex + 1;
  const assignedCount = _fieldTagPlants.filter(item => item.nfc_uid).length;

  const progressBadgeEl = document.getElementById('field-tag-progress-badge');
  if (progressBadgeEl) {
    progressBadgeEl.innerHTML = `Cây ${currentNum}/${total} &nbsp;·&nbsp; Đã gán: <strong>${assignedCount}/${total}</strong>`;
  }

  const treeCodeEl = document.getElementById('field-tag-tree-code');
  const plantTypeEl = document.getElementById('field-tag-plant-type');
  const currentUidEl = document.getElementById('field-tag-current-uid');
  const statusPillEl = document.getElementById('field-tag-status-pill');
  const urlPreviewEl = document.getElementById('field-tag-public-url-preview');
  const nextCodeEl = document.getElementById('field-tag-next-code');
  const prevBtn = document.getElementById('btn-field-prev-tree');
  const nextBtn = document.getElementById('btn-field-next-tree');

  if (prevBtn) {
    prevBtn.disabled = _fieldTagIndex === 0;
    prevBtn.style.opacity = _fieldTagIndex === 0 ? '0.4' : '1';
    prevBtn.style.cursor = _fieldTagIndex === 0 ? 'not-allowed' : 'pointer';
  }
  if (nextBtn) {
    nextBtn.disabled = _fieldTagIndex >= total - 1;
    nextBtn.style.opacity = _fieldTagIndex >= total - 1 ? '0.4' : '1';
    nextBtn.style.cursor = _fieldTagIndex >= total - 1 ? 'not-allowed' : 'pointer';
  }

  if (treeCodeEl) treeCodeEl.textContent = p.tree_code || p.id;
  if (plantTypeEl) {
    const typeStr = p.plant_type || 'Cây ăn trái';
    const varietyStr = p.plant_variety ? ` — Giống: ${p.plant_variety.replace(/\(durian\)|\(mango\)|\(avocado\)/gi, '').trim()}` : '';
    plantTypeEl.textContent = `${typeStr}${varietyStr}`;
  }
  
  if (currentUidEl) {
    if (p.nfc_uid) {
      currentUidEl.innerHTML = `<span style="color:#059669; font-weight:800; font-family:ui-monospace, monospace;">${p.nfc_uid}</span>`;
    } else {
      currentUidEl.innerHTML = `<span style="color:#94a3b8; font-style:italic; font-weight:600;">Chưa liên kết thẻ NFC</span>`;
    }
  }

  if (statusPillEl) {
    if (p.nfc_uid) {
      statusPillEl.textContent = '✅ ĐÃ GÁN THẺ';
      statusPillEl.style.background = '#ecfdf5';
      statusPillEl.style.color = '#047857';
      statusPillEl.style.border = '1px solid #a7f3d0';
    } else {
      statusPillEl.textContent = '⚪ CHƯA GÁN';
      statusPillEl.style.background = '#f1f5f9';
      statusPillEl.style.color = '#64748b';
      statusPillEl.style.border = '1px solid #e2e8f0';
    }
  }

  const pubUrl = p.public_url || `https://plant-book.onrender.com/${p.farm_id || _fieldTagFarmId}/${p.id}${p.nfc_uid ? '/' + encodeURIComponent(p.nfc_uid) : ''}`;
  if (urlPreviewEl) {
    if (p.nfc_uid) {
      urlPreviewEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px;">
          <a href="${pubUrl}" target="_blank" style="color:#4f46e5; text-decoration:none; font-weight:700; font-size:11.5px; display:inline-flex; align-items:center; gap:4px; background:#eef2ff; padding:3px 8px; border-radius:6px; border:1px solid #c7d2fe;" title="Mở trang nhật ký công khai">
            <i data-lucide="external-link" class="lucide-sm"></i> Xem Web Public
          </a>
          <button type="button" onclick="navigator.clipboard.writeText('${pubUrl}'); toast('Đã sao chép link công khai!');" style="background:#f8fafc; border:1px solid #cbd5e1; color:#475569; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;" title="Sao chép link">
            <i data-lucide="copy" class="lucide-sm"></i>
          </button>
        </div>
      `;
    } else {
      urlPreviewEl.innerHTML = `<span style="color:#94a3b8; font-size:11px;">Sẵn sàng gán URL NDEF</span>`;
    }
  }

  const nextPlant = _fieldTagPlants[_fieldTagIndex + 1];
  if (nextCodeEl) nextCodeEl.textContent = nextPlant ? (nextPlant.tree_code || nextPlant.id) : 'Hết vườn';
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

function jumpToFieldTreeByCode() {
  const jumpInput = document.getElementById('field-tag-jump-code');
  if (!jumpInput || !_fieldTagPlants || _fieldTagPlants.length === 0) return;
  const targetCode = parseInt(jumpInput.value.trim());
  if (isNaN(targetCode)) return;

  const idx = _fieldTagPlants.findIndex(p => (parseInt(p.tree_code || p.id) === targetCode || p.id === targetCode));
  if (idx !== -1) {
    _fieldTagIndex = idx;
    renderCurrentFieldTree();
    refreshFieldGps();
    jumpInput.value = '';
  } else {
    toast(`Không tìm thấy cây số #${targetCode} trong trang trại này!`, 'warning');
  }
}
window.jumpToFieldTreeByCode = jumpToFieldTreeByCode;

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
  submitBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang import...';

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
