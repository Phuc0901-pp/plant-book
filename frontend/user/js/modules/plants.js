/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/plants.js — Plant list rendering & search filter
   ═══════════════════════════════════════════════════════════════ */

import { esc, healthBadge } from '../core/utils.js';
import { api } from '../core/api.js';
import { animateValue } from './countup.js';


// ── State (chia sẻ với các module khác qua getter) ──────────
let _plantsCache = [];
let _farmsCache  = [];  // Danh sách trang trại của nông hộ

/**
 * Cập nhật cache danh sách cây trồng.
 * Được gọi từ dashboard.js sau khi fetch API.
 * @param {Array} plants
 */
export function setPlantsCache(plants) {
  _plantsCache = plants;
}

/** Lấy danh sách cây trồng hiện tại từ cache */
export function getPlantsCache() {
  return _plantsCache;
}

/** Cập nhật cache trang trại và nạp vào dropdown lọc */
export function setFarmsCache(farms) {
  _farmsCache = farms;
  window._allFarmsCache = farms;
  _populateFarmFilter(farms);
  renderUserFarmsGrid(farms);
}

/** Lấy danh sách trang trại từ cache */
export function getFarmsCache() {
  return _farmsCache;
}

/** Lấy trang trại đang được chọn/kích hoạt hiện tại */
export function getActiveFarm() {
  if (_activeFarmId && _farmsCache && _farmsCache.length) {
    const found = _farmsCache.find(f => f.id == _activeFarmId);
    if (found) return found;
  }
  return _farmsCache && _farmsCache.length > 0 ? _farmsCache[0] : null;
}



/** Nạp danh sách trang trại vào select #user-plant-filter-farm */
function _populateFarmFilter(farms) {
  const sel = document.getElementById('user-plant-filter-farm');
  if (!sel) return;
  sel.innerHTML = `<option value="">Tất cả trang trại</option>`
    + farms.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
}

// ── Render ────────────────────────────────────────────────────

/**
 * Render danh sách trang trại ở Trang chủ.
 * @param {Array} farms
 */
/**
 * Render danh sách trang trại ở Trang chủ & kiểm tra xem nông hộ đã khởi tạo trang trại chưa.
 * @param {Array} farms
 */
export function renderUserFarmsList(farms) {
  const container = document.getElementById('user-farms-container');
  const noFarmNotice = document.getElementById('no-farm-notice');

  if (!farms || !farms.length) {
    if (container) {
      container.innerHTML = '<div class="empty-state" style="padding:16px"><i class="fa-solid fa-location-crosshairs" style="color:var(--green)"></i><p>Bạn chưa khởi tạo trang trại nào. Mở tab <strong>Trang trại</strong> để tự định vị GPS và khởi tạo ngay!</p></div>';
    }
    if (noFarmNotice) {
      noFarmNotice.style.display = 'block';
    }
    return;
  }

  if (noFarmNotice) {
    noFarmNotice.style.display = 'none';
  }

  if (container) {
    container.innerHTML = farms.map(f => `
      <div style="padding:12px;background:var(--gray-50);border:1px solid var(--gray-200);border-radius:8px;">
        <h4 style="font-size:13px;font-weight:700;color:var(--green-dark);margin-bottom:4px;">🏡 ${esc(f.name)}</h4>
        <div style="font-size:11px;color:var(--text-muted);display:flex;gap:12px;flex-wrap:wrap;">
          <span><i class="fa-solid fa-ruler-combined"></i> ${f.area ? Math.round(parseFloat(f.area)).toLocaleString('vi-VN') : 0} m²</span>
          <span><i class="fa-solid fa-seedling"></i> ${f.plant_count || 0} cây</span>
        </div>
      </div>
    `).join('');
  }
}

// ── GPS Self-Init Farm Functions ──────────────────────────────
export function openSelfInitFarmModal() {
  const user = window.currentUser || {};
  const isNormal = user.role !== 'admin' && user.account_tier !== 'pro';
  if (isNormal && _farmsCache && _farmsCache.length >= 1) {
    alert('🔒 Tài khoản Nông hộ NORMAL chỉ được tạo tối đa 1 Trang trại. Bạn có thể bấm nút "Sửa" để thay đổi thông tin trang trại và số lượng cây của mình!');
    return;
  }

  const modal = document.getElementById('self-init-farm-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  
  const nameInput = document.getElementById('self-farm-name');
  if (nameInput && !nameInput.value) {
    nameInput.value = user.full_name || user.name ? `Trang trại ${user.full_name || user.name}` : 'Trang trại Nông hộ';
  }

  const areaInput = document.getElementById('self-farm-area');
  if (areaInput && !areaInput.value && user.farm_area) {
    areaInput.value = user.farm_area;
  }
  
  getDeviceGPSPosition();
}

export function closeSelfInitFarmModal() {
  const modal = document.getElementById('self-init-farm-modal');
  if (modal) modal.style.display = 'none';
}

export function getDeviceGPSPosition() {
  const latEl = document.getElementById('self-farm-lat');
  const lngEl = document.getElementById('self-farm-lng');
  if (latEl) latEl.value = 'Đang lấy GPS...';
  if (lngEl) lngEl.value = 'Đang lấy GPS...';

  if (!navigator.geolocation) {
    if (latEl) latEl.value = '11.8333';
    if (lngEl) lngEl.value = '106.9167';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      if (latEl) latEl.value = lat;
      if (lngEl) lngEl.value = lng;
    },
    (err) => {
      console.warn('Geolocation error:', err);
      if (latEl) latEl.value = '11.8333';
      if (lngEl) lngEl.value = '106.9167';
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

export async function submitSelfInitFarm() {
  const name = document.getElementById('self-farm-name')?.value?.trim();
  const lat = document.getElementById('self-farm-lat')?.value;
  const lng = document.getElementById('self-farm-lng')?.value;
  const area = document.getElementById('self-farm-area')?.value;
  const totalPlants = document.getElementById('self-farm-total-plants')?.value;
  const desc = document.getElementById('self-farm-desc')?.value;

  if (!name) {
    alert('Vui lòng nhập Tên Trang trại.');
    return;
  }

  try {
    const btn = document.getElementById('btn-submit-self-farm');
    if (btn) btn.disabled = true;

    // Use standard api helper which attaches correct pb_token automatically
    const data = await api('/farms/self-init', {
      method: 'POST',
      body: JSON.stringify({ name, description: desc, latitude: lat, longitude: lng, area, total_plants: totalPlants })
    });

    alert(data.message || 'Khởi tạo trang trại bằng GPS thành công!');
    closeSelfInitFarmModal();

    if (window.loadUserDashboard) {
      await window.loadUserDashboard();
    } else {
      window.location.reload();
    }

    // Auto fly map to GPS ping location
    if (window.userMap && lat && lng) {
      try {
        window.userMap.flyTo({
          center: [parseFloat(lng), parseFloat(lat)],
          zoom: 16,
          essential: true
        });
      } catch (_) {}
    }
  } catch (err) {
    alert('Lỗi khi tạo trang trại: ' + err.message);
  } finally {
    const btn = document.getElementById('btn-submit-self-farm');
    if (btn) btn.disabled = false;
  }
}




/**
 * Sắp xếp ưu tiên:
 * 1. Cây bệnh (health_status khác 'Bình thường' và khác 'Tốt') lên đầu (xếp theo ID 1 -> n)
 * 2. Cây bình thường / tốt xuống phía sau (xếp theo ID 1 -> n)
 */
export function sortPlantsByHealthThenId(plants) {
  if (!Array.isArray(plants)) return [];
  return [...plants].sort((a, b) => {
    const isDiseaseA = a.health_status && a.health_status !== 'Bình thường' && a.health_status !== 'Tốt';
    const isDiseaseB = b.health_status && b.health_status !== 'Bình thường' && b.health_status !== 'Tốt';

    if (isDiseaseA && !isDiseaseB) return -1;
    if (!isDiseaseA && isDiseaseB) return 1;

    const codeA = parseInt(a.tree_code || a.id) || a.id;
    const codeB = parseInt(b.tree_code || b.id) || b.id;
    return codeA - codeB;
  });
}

/**
 * Render tóm tắt tối đa 3 cây ở Trang chủ.
 * @param {Array} plants
 */
export function renderUserPlantsSummaryTable(plants) {
  const tbody = document.getElementById('user-plants-summary-table');
  if (!tbody) return;
  if (!plants.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-seedling"></i><p>Không có cây trồng nào được giao</p></td></tr>';
    return;
  }
  const sorted = sortPlantsByHealthThenId(plants);
  tbody.innerHTML = sorted.slice(0, 3).map(p => _plantRow(p)).join('');
}

/**
 * Render danh sách đầy đủ cây trồng ở tab Trang trại.
 * @param {Array} plants
 */
export function renderUserPlantsTable(plants) {
  const tbody = document.getElementById('user-plants-table');
  if (!tbody) return;
  if (!plants.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-seedling"></i><p>Không tìm thấy cây trồng phù hợp</p></td></tr>';
    return;
  }
  const sorted = sortPlantsByHealthThenId(plants);
  tbody.innerHTML = sorted.map(p => _plantRow(p)).join('');
}

/**
 * Tạo HTML một hàng cây trồng trong bảng.
 * @private
 */
function _plantRow(p) {
  const nfcBadge = p.nfc_uid
    ? `<span title="Thẻ: ${esc(p.nfc_uid)}" style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:#22c55e;"><i class="fa-solid fa-tag"></i></span>`
    : `<span title="Chưa gắn thẻ NFC" style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:#d1d5db;"><i class="fa-solid fa-link-slash"></i></span>`;

  const treeCodeSafe = esc(p.tree_code || String(p.id));
  const plantTypeSafe = esc(p.plant_type || '');
  const slugSafe = esc(p.public_slug || '');
  const uidVal = p.nfc_uid ? `'${esc(p.nfc_uid)}'` : 'null';

  // 3-segment public url: https://plant-book.onrender.com/{farm_id}/{plant_id}/{nfc_uid}
  const farmIdVal = p.farm_id || (_activeFarmId || 0);
  const pubUrl = p.public_url || (farmIdVal && p.id ? `https://plant-book.onrender.com/${farmIdVal}/${p.id}${p.nfc_uid ? '/' + encodeURIComponent(p.nfc_uid) : ''}` : '');
  const shortUrlText = farmIdVal && p.id ? `/${farmIdVal}/${p.id}${p.nfc_uid ? '/...' : ''}` : 'Chưa có';

  const publicUrlCell = pubUrl ? `
    <div style="display:flex;align-items:center;gap:6px;">
      <a href="${esc(pubUrl)}" target="_blank" title="${esc(pubUrl)}" style="font-size:11.5px;font-family:monospace;color:#059669;font-weight:700;text-decoration:none;background:#ecfdf5;border:1px solid #a7f3d0;padding:3px 8px;border-radius:6px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;">
        ${esc(shortUrlText)}
      </a>
      <button type="button" onclick="navigator.clipboard.writeText('${esc(pubUrl)}'); if(window.toast) window.toast('📋 Đã copy Public URL!', 'success');" title="Copy URL" style="border:none;background:#f1f5f9;color:#475569;border-radius:4px;padding:4px 7px;font-size:11px;cursor:pointer;">
        <i class="fa-regular fa-copy"></i>
      </button>
    </div>` : `<span style="font-size:11px;color:#94a3b8;">Chưa gán</span>`;

  return `
    <tr>
      <td data-label="Mã cây">
        <div style="display:flex;align-items:center;gap:6px;">
          <strong>${treeCodeSafe}</strong>
          ${nfcBadge}
        </div>
      </td>
      <td data-label="Loại & Giống">
        <div>
          <strong>${esc(p.plant_type || '')}</strong>
          ${p.plant_variety ? `<br><small style="color:var(--gray-400)">${esc(p.plant_variety)}</small>` : ''}
        </div>
      </td>
      <td data-label="Tuổi cây"><div>${esc(p.plant_age || '—')}</div></td>
      <td data-label="Sức khỏe"><div>${healthBadge(p.health_status)}</div></td>
      <td data-label="Vị trí"><div>${esc(p.location || '—')}</div></td>
      <td data-label="URL Công khai"><div>${publicUrlCell}</div></td>
      <td data-label="Thao tác">
        <div class="plant-action-menu">
          <button type="button" class="btn-icon-dots" onclick="togglePlantMenu(this, event)" title="Thao tác" aria-label="Menu thao tác cây">
            <i class="fa-solid fa-ellipsis-vertical"></i>
          </button>
          <div class="plant-action-dropdown">
            <button type="button" onclick="openCareModal(${p.id}, '${treeCodeSafe}', '${plantTypeSafe}'); closePlantMenu(this)">
              <i class="fa-solid fa-file-signature" style="color:var(--green)"></i> Ghi nhật ký
            </button>
            <button type="button" onclick="openNfcModal(${p.id}, '${treeCodeSafe}', '${slugSafe}', ${uidVal}); closePlantMenu(this)">
              <i class="fa-solid fa-tag" style="color:#3b82f6"></i> Định danh thẻ NFC
            </button>
          </div>
        </div>
      </td>
    </tr>`;
}

// ── Search / Filter ───────────────────────────────────────────

/**
 * Lọc danh sách cây theo từ khoá nhập vào #user-plant-search.
 * Kết quả được render vào bảng đầy đủ.
 */
export function filterUserPlants() {
  const query  = (document.getElementById('user-plant-search')?.value || '').trim().toLowerCase();
  const farmId = document.getElementById('user-plant-filter-farm')?.value || '';

  let filtered = _plantsCache;

  if (farmId) {
    filtered = filtered.filter(p => String(p.farm_id) === farmId);
  }

  if (query) {
    filtered = filtered.filter(p =>
      [p.tree_code, String(p.id), p.plant_type, p.plant_variety, p.location]
        .some(v => (v || '').toLowerCase().includes(query))
    );
  }

  const countFullEl = document.getElementById('user-plant-count-full');
  if (countFullEl) countFullEl.textContent = filtered.length;

  renderUserPlantsTable(filtered);
}

// ── Action Menu Toggle ─────────────────────────────────────────
export function togglePlantMenu(elOrId, event) {
  if (event && event.stopPropagation) {
    event.stopPropagation();
  }
  let menu = null;
  if (typeof elOrId === 'object' && elOrId !== null) {
    menu = elOrId.closest('.plant-action-menu')?.querySelector('.plant-action-dropdown');
  } else if (elOrId) {
    menu = document.getElementById(`pad-${elOrId}`);
  }

  const isOpen = menu && menu.classList.contains('open');

  // Close all other open menus first
  document.querySelectorAll('.plant-action-dropdown.open').forEach(d => {
    d.classList.remove('open');
  });

  if (menu && !isOpen) {
    menu.classList.add('open');
  }
}

export function closePlantMenu(elOrId) {
  if (typeof elOrId === 'object' && elOrId !== null) {
    elOrId.closest('.plant-action-dropdown')?.classList.remove('open');
  } else if (elOrId) {
    const dropdown = document.getElementById(`pad-${elOrId}`);
    if (dropdown) dropdown.classList.remove('open');
  }
}

// Close menus on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.plant-action-menu')) {
    document.querySelectorAll('.plant-action-dropdown.open')
      .forEach(d => d.classList.remove('open'));
  }
});


let _activeFarmId = null;

export function openFarmDetailView(farmId, updateHash = true) {
  _activeFarmId = farmId;
  const masterView = document.getElementById('farm-master-view');
  const detailView = document.getElementById('farm-detail-view');

  if (masterView) masterView.style.display = 'none';
  if (detailView) detailView.style.display = 'block';

  // Synchronize URL Hash e.g. #/u/usr-5a9f/farms/farm-5a9e
  if (updateHash && typeof window.encodeId === 'function' && typeof window.getUserHash === 'function') {
    const userHash = window.getUserHash();
    const farmHash = window.encodeId('farm', farmId);
    window.location.hash = `#/u/${userHash}/farms/${farmHash}`;
  }

  switchFarmSubtab('map');

  const farm = (_farmsCache || []).find(f => String(f.id) === String(farmId));
  if (farm) {
    const nameEl = document.getElementById('active-farm-name');
    const countEl = document.getElementById('active-farm-plant-count');
    const areaEl = document.getElementById('active-farm-area');

    if (nameEl) nameEl.textContent = farm.name;
    if (countEl) animateValue(countEl, 0, farm.plant_count || farm.total_plants || 0, 1000);
    if (areaEl) animateValue(areaEl, 0, farm.area ? parseFloat(farm.area) : 0, 1000, 1);

    // Filter plant table select dropdown for this farm
    const filterSel = document.getElementById('user-plant-filter-farm');
    if (filterSel) {
      filterSel.value = farm.id;
      filterUserPlants();
    }

    // Trigger map resize & navigate/fly directly down to farm A!
    setTimeout(() => {
      const targetMap = userMap || window.userMap;
      if (targetMap) {
        try { targetMap.resize(); } catch (_) {}

        let coords = [];
        try {
          coords = typeof farm.polygon_coordinates === 'string' ? JSON.parse(farm.polygon_coordinates) : farm.polygon_coordinates;
        } catch (_) {}

        const bounds = new mapboxgl.LngLatBounds();
        let hasPoints = false;

        if (coords && coords.length > 0) {
          coords.forEach(pt => {
            if (Array.isArray(pt) && pt.length >= 2) {
              let lng = parseFloat(pt[0]);
              let lat = parseFloat(pt[1]);
              if ((lng >= -90 && lng <= 90) && (lat > 90 || lat < -90 || lat > 30)) {
                const tmp = lng; lng = lat; lat = tmp;
              }
              if (!isNaN(lng) && !isNaN(lat) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                bounds.extend([lng, lat]);
                hasPoints = true;
              }
            }
          });
        }

        // If no polygon points, find plants in this farm
        if (!hasPoints) {
          const farmPlants = (_plantsCache || []).filter(p => String(p.farm_id) === String(farm.id) && p.latitude && p.longitude);
          farmPlants.forEach(p => {
            let lat = parseFloat(p.latitude);
            let lng = parseFloat(p.longitude);
            if (!isNaN(lat) && !isNaN(lng)) {
              if ((lat < -90 || lat > 90) && (lng >= -90 && lng <= 90)) {
                const tmp = lat; lat = lng; lng = tmp;
              }
              if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                bounds.extend([lng, lat]);
                hasPoints = true;
              }
            }
          });
        }

        if (hasPoints) {
          targetMap.fitBounds(bounds, { padding: 60, maxZoom: 19.5, duration: 1200 });
        }
      }
    }, 150);
  }
}
window.openFarmDetailView = openFarmDetailView;


export function closeFarmDetailView(updateHash = true) {
  const masterView = document.getElementById('farm-master-view');
  const detailView = document.getElementById('farm-detail-view');

  if (detailView) detailView.style.display = 'none';
  if (masterView) masterView.style.display = 'block';

  if (updateHash && typeof window.getUserHash === 'function') {
    const userHash = window.getUserHash();
    window.location.hash = `#/u/${userHash}/farms`;
  }
}
window.closeFarmDetailView = closeFarmDetailView;

export function renderUserFarmsGrid(farms) {
  const gridContainer = document.getElementById('user-farms-grid');

  if (!farms || !farms.length) {
    if (gridContainer) {
      gridContainer.innerHTML = `
        <div onclick="openSelfInitFarmModal()" style="background:#f0fdf4; border:2px dashed #10b981; border-radius:16px; padding:28px 20px; text-align:center; cursor:pointer; transition:all 0.2s ease; box-shadow:0 4px 14px rgba(16,185,129,0.06);">
          <div style="width:54px; height:54px; border-radius:50%; background:#dcfce7; color:#059669; font-size:24px; display:inline-flex; align-items:center; justify-content:center; margin-bottom:12px; box-shadow:0 4px 12px rgba(5,150,105,0.15);">
            <i class="fa-solid fa-plus"></i>
          </div>
          <div style="font-size:16px; font-weight:800; color:#047857; margin-bottom:4px;">Khởi tạo Trang trại mới (GPS)</div>
          <div style="font-size:13px; color:#166534;">Bấm vào đây để lấy tọa độ thực tế từ GPS thiết bị</div>
        </div>
      `;
    }
    return;
  }

  if (gridContainer) {
    let html = farms.map(f => {
      const totalPlants = f.plant_count || f.total_plants || 0;
      return `
        <div onclick="openFarmDetailView(${f.id})" style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:16px; padding:18px; position:relative; cursor:pointer; transition:all 0.2s ease; box-shadow:0 4px 16px rgba(0,0,0,0.04);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <h4 style="margin:0; font-size:15px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-house-chimney" style="color:#059669; font-size:16px;"></i> ${esc(f.name)}
            </h4>
            <span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-size:11px; font-weight:800; padding:3px 10px; border-radius:20px;">Trang trại của tôi</span>
          </div>
          <p style="margin:0 0 14px 0; font-size:12.5px; color:#64748b; font-style:italic; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical;">
            ${esc(f.description || 'Chưa có mô tả địa chỉ')}
          </p>
          <div style="background:#f8fafc; border:1px solid #f1f5f9; border-radius:10px; padding:10px 12px; font-size:12.5px; color:#334155; display:flex; justify-content:space-between; margin-bottom:14px; font-weight:700;">
            <span><i class="fa-solid fa-seedling" style="color:#059669;"></i> ${totalPlants} cây</span>
            <span><i class="fa-solid fa-ruler-combined" style="color:#059669;"></i> ${f.area ? Math.round(parseFloat(f.area)).toLocaleString('vi-VN') : 0} m²</span>
          </div>
          <div style="display:flex; gap:8px;">
            <button onclick="openFarmDetailView(${f.id})" style="flex:1; background:linear-gradient(135deg, #10b981, #047857); color:#ffffff; border:none; border-radius:10px; padding:9px 12px; font-size:13px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 3px 10px rgba(16,185,129,0.25);">
              <i class="fa-solid fa-map-location-dot"></i> Xem Bản đồ & Chi tiết
            </button>
            <button onclick="event.stopPropagation(); openEditFarmModal(${f.id})" style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:10px; padding:9px 12px; font-size:13px; font-weight:700; color:#334155; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:4px;" title="Chỉnh sửa trang trại">
              <i class="fa-solid fa-pen-to-square" style="color:#059669;"></i> Sửa
            </button>
            <button onclick="event.stopPropagation(); deleteUserFarm(${f.id}, '${esc(f.name)}')" style="background:#ffffff; border:1.5px solid #fca5a5; border-radius:10px; padding:9px 12px; font-size:13px; font-weight:700; color:#dc2626; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:4px;" title="Xóa đệm (ẩn) trang trại">
              <i class="fa-solid fa-trash-can" style="color:#dc2626;"></i> Xóa
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Add + Khởi tạo Trang trại mới card (only if user is PRO/Admin OR hasn't created any farm yet)
    const user = window.currentUser || {};
    const isNormal = user.role !== 'admin' && user.account_tier !== 'pro';
    if (!isNormal || farms.length === 0) {
      html += `
        <div onclick="openSelfInitFarmModal()" style="background:#f0fdf4; border:2px dashed #10b981; border-radius:16px; padding:18px; text-align:center; cursor:pointer; transition:all 0.2s ease; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:150px; box-shadow:0 4px 14px rgba(16,185,129,0.06);">
          <div style="width:42px; height:42px; border-radius:50%; background:#dcfce7; color:#059669; font-size:20px; display:inline-flex; align-items:center; justify-content:center; margin-bottom:8px;">
            <i class="fa-solid fa-plus"></i>
          </div>
          <div style="font-size:14px; font-weight:800; color:#047857;">+ Khởi tạo Trang trại mới (GPS)</div>
          <div style="font-size:12px; color:#166534; margin-top:2px;">Bấm để định vị GPS thêm trang trại</div>
        </div>
      `;
    }

    gridContainer.innerHTML = html;
  }
}


export function selectUserFarm(farmId) {
  _activeFarmId = farmId;
  if (_farmsCache && _farmsCache.length) {
    renderUserFarmsGrid(_farmsCache);
    const farm = _farmsCache.find(f => f.id === farmId);
    if (farm && window.userMap && farm.polygon_coordinates) {
      try {
        let coords = typeof farm.polygon_coordinates === 'string' ? JSON.parse(farm.polygon_coordinates) : farm.polygon_coordinates;
        if (coords && coords.length > 0) {
          let ptLng = coords[0][0];
          let ptLat = coords[0][1];
          if (ptLng < 50 && ptLat > 90) {
            const tmp = ptLng;
            ptLng = ptLat;
            ptLat = tmp;
          }
          window.userMap.flyTo({ center: [ptLng, ptLat], zoom: 16, essential: true });
        }
      } catch (_) {}
    }
  }
}

// ── Farm Edit Functions ────────────────────────────────────────
export function openEditFarmModal(farmId = null) {
  const targetId = farmId || _activeFarmId;
  const farm = (_farmsCache || []).find(f => f.id == targetId);
  if (!farm) {
    alert('Không tìm thấy trang trại để chỉnh sửa.');
    return;
  }

  const modal = document.getElementById('edit-farm-modal');
  if (!modal) return;

  document.getElementById('edit-farm-id').value = farm.id;
  document.getElementById('edit-farm-name').value = farm.name || '';
  document.getElementById('edit-farm-area').value = farm.area || '';
  document.getElementById('edit-farm-total-plants').value = farm.plant_count || farm.total_plants || 0;
  document.getElementById('edit-farm-desc').value = farm.description || '';

  let lat = '', lng = '';
  try {
    let coords = typeof farm.polygon_coordinates === 'string' ? JSON.parse(farm.polygon_coordinates) : farm.polygon_coordinates;
    if (coords && coords.length > 0) {
      let ptLng = coords[0][0];
      let ptLat = coords[0][1];
      if (ptLng < 50 && ptLat > 90) {
        lat = ptLng;
        lng = ptLat;
      } else {
        lat = ptLat;
        lng = ptLng;
      }
    }
  } catch (_) {}

  document.getElementById('edit-farm-lat').value = lat;
  document.getElementById('edit-farm-lng').value = lng;

  modal.style.display = 'flex';
}

export function closeEditFarmModal() {
  const modal = document.getElementById('edit-farm-modal');
  if (modal) modal.style.display = 'none';
}

export function getEditDeviceGPSPosition() {
  const latEl = document.getElementById('edit-farm-lat');
  const lngEl = document.getElementById('edit-farm-lng');
  if (latEl) latEl.value = 'Đang lấy GPS...';
  if (lngEl) lngEl.value = 'Đang lấy GPS...';

  if (!navigator.geolocation) {
    if (latEl) latEl.value = '11.8333';
    if (lngEl) lngEl.value = '106.9167';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (latEl) latEl.value = pos.coords.latitude.toFixed(6);
      if (lngEl) lngEl.value = pos.coords.longitude.toFixed(6);
    },
    (err) => {
      console.warn('Geolocation error:', err);
      if (latEl) latEl.value = '11.8333';
      if (lngEl) lngEl.value = '106.9167';
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

export async function submitEditFarm() {
  const farmId = document.getElementById('edit-farm-id')?.value;
  const name = document.getElementById('edit-farm-name')?.value?.trim();
  const area = document.getElementById('edit-farm-area')?.value;
  const totalPlants = document.getElementById('edit-farm-total-plants')?.value;
  const lat = document.getElementById('edit-farm-lat')?.value;
  const lng = document.getElementById('edit-farm-lng')?.value;
  const desc = document.getElementById('edit-farm-desc')?.value;

  if (!name) {
    alert('Vui lòng nhập Tên Trang trại.');
    return;
  }

  try {
    const btn = document.getElementById('btn-submit-edit-farm');
    if (btn) btn.disabled = true;

    const data = await api(`/farms/${farmId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name,
        description: desc,
        area,
        total_plants: totalPlants,
        latitude: lat,
        longitude: lng
      })
    });

    alert(data.message || 'Cập nhật trang trại thành công!');
    closeEditFarmModal();

    if (window.loadUserDashboard) {
      await window.loadUserDashboard();
    } else {
      window.location.reload();
    }
  } catch (err) {
    alert('Lỗi khi cập nhật trang trại: ' + err.message);
  } finally {
    const btn = document.getElementById('btn-submit-edit-farm');
    if (btn) btn.disabled = false;
  }
}

export async function deleteUserFarm(farmId, farmName) {
  if (!confirm(`Bạn có chắc chắn muốn xóa đệm (ẩn) Trang trại "${farmName}" khỏi danh sách?`)) {
    return;
  }
  try {
    const res = await api(`/farms/${farmId}`, { method: 'DELETE' });
    if (res && (res.success || res.message)) {
      if (window.toast) window.toast('🗑️ Đã xóa đệm (ẩn) trang trại thành công!', 'success');
      if (typeof window.loadUserDashboard === 'function') {
        window.loadUserDashboard();
      }
    }
  } catch (err) {
    alert(err.message || 'Lỗi khi xóa trang trại.');
  }
}
window.deleteUserFarm = deleteUserFarm;

// ── FARM SUBTABS & DEMO IOT / WEATHER FORECAST ──────────────────

export function switchFarmSubtab(tab) {
  const btnMap = document.getElementById('farm-subtab-btn-map');
  const btnIot = document.getElementById('farm-subtab-btn-iot');
  const paneMap = document.getElementById('farm-subtab-pane-map');
  const paneIot = document.getElementById('farm-subtab-pane-iot');

  if (tab === 'map') {
    if (btnMap) { btnMap.style.color = '#059669'; btnMap.style.borderBottomColor = '#059669'; btnMap.style.fontWeight = '800'; }
    if (btnIot) { btnIot.style.color = '#64748b'; btnIot.style.borderBottomColor = 'transparent'; btnIot.style.fontWeight = '700'; }
    if (paneMap) paneMap.style.display = 'block';
    if (paneIot) paneIot.style.display = 'none';

    // Resize map when switching back to map tab
    setTimeout(() => {
      if (window.userMap) {
        try { window.userMap.resize(); } catch (_) {}
      }
    }, 100);
  } else {
    if (btnMap) { btnMap.style.color = '#64748b'; btnMap.style.borderBottomColor = 'transparent'; btnMap.style.fontWeight = '700'; }
    if (btnIot) { btnIot.style.color = '#0284c7'; btnIot.style.borderBottomColor = '#0284c7'; btnIot.style.fontWeight = '800'; }
    if (paneMap) paneMap.style.display = 'none';
    if (paneIot) paneIot.style.display = 'block';

    renderIoTDemoData(_activeFarmId);
  }
}
window.switchFarmSubtab = switchFarmSubtab;

let _currentFarmIoTData = null;
let _selectedSoilDepth = '20cm';

export function selectSoilDepth(depth) {
  if (depth !== '10cm' && typeof window.isProUser === 'function' && !window.isProUser()) {
    if (typeof window.openProUpgradeModal === 'function') {
      window.openProUpgradeModal('soil_depth');
    } else {
      alert('🔒 Tầng đất 20cm & 30cm dành riêng cho Nông hộ PRO. Vui lòng nâng cấp tài khoản!');
    }
    return;
  }
  _selectedSoilDepth = depth;
  const depths = ['10cm', '20cm', '30cm'];
  depths.forEach(d => {
    const btn = document.getElementById(`soil-depth-btn-${d}`);
    if (btn) {
      if (d === depth) {
        btn.style.background = '#fef3c7';
        btn.style.color = '#78350f';
        btn.style.borderColor = '#d97706';
        btn.style.fontWeight = '800';
      } else {
        btn.style.background = '#ffffff';
        btn.style.color = '#854d0e';
        btn.style.borderColor = '#fde68a';
        btn.style.fontWeight = '700';
      }
    }
  });

  if (_currentFarmIoTData && _currentFarmIoTData.soil_data) {
    const soil = _currentFarmIoTData.soil_data;
    const levelData = soil[`depth_${depth}`] || soil.depth_20cm || {};

    if (document.getElementById('iot-soil-moisture')) document.getElementById('iot-soil-moisture').textContent = `${levelData.moisture || 68} %`;
    if (document.getElementById('iot-soil-temp')) document.getElementById('iot-soil-temp').textContent = `${levelData.temperature || 25.5} °C`;
    if (document.getElementById('iot-soil-ph')) document.getElementById('iot-soil-ph').textContent = levelData.ph || 6.5;
    if (document.getElementById('iot-soil-ec')) document.getElementById('iot-soil-ec').innerHTML = `${levelData.ec || 1.2} <span style="font-size:11px;">mS/cm</span>`;
    if (document.getElementById('iot-soil-salinity')) document.getElementById('iot-soil-salinity').textContent = `${levelData.salinity || 0.2} ‰`;
    if (document.getElementById('iot-soil-npk')) {
      const npk = levelData.npk || { n: 45, p: 32, k: 58 };
      document.getElementById('iot-soil-npk').textContent = `N:${npk.n} | P:${npk.p} | K:${npk.k}`;
    }
  }
}
window.selectSoilDepth = selectSoilDepth;

export async function refreshIoTDemoData() {
  if (!_activeFarmId) return;
  try {
    const res = await api(`/farms/${_activeFarmId}/iot-data/refresh`, { method: 'POST' });
    if (res && res.success) {
      _currentFarmIoTData = res;
      _applyIoTDemoDataToUI(res);
      if (window.toast) window.toast('🔄 Đã lưu & làm mới dữ liệu cảm biến IoT trong Database thành công!', 'success');
    }
  } catch (err) {
    console.warn('Lỗi làm mới dữ liệu IoT:', err);
  }
}
window.refreshIoTDemoData = refreshIoTDemoData;

export async function renderIoTDemoData(farmId, forceRefresh = false) {
  if (!farmId) return;
  try {
    const endpoint = forceRefresh ? `/farms/${farmId}/iot-data/refresh` : `/farms/${farmId}/iot-data`;
    const method = forceRefresh ? 'POST' : 'GET';
    const res = await api(endpoint, { method });
    if (res && res.success) {
      _currentFarmIoTData = res;
      _applyIoTDemoDataToUI(res);
    }
  } catch (err) {
    console.warn('Lỗi tải dữ liệu IoT từ Database:', err);
  }
}
window.renderIoTDemoData = renderIoTDemoData;

function _applyIoTDemoDataToUI(res) {
  const air = res.air_data || {};
  const water = res.water_data || {};
  const forecast = res.weather_forecast || [];

  // Update Air Environment
  if (document.getElementById('iot-air-temp')) document.getElementById('iot-air-temp').textContent = `${air.temperature || 28.5} °C`;
  if (document.getElementById('iot-air-humidity')) document.getElementById('iot-air-humidity').textContent = `${air.humidity || 74} %`;
  if (document.getElementById('iot-air-pressure')) document.getElementById('iot-air-pressure').textContent = `${air.pressure || 1012} hPa`;
  if (document.getElementById('iot-air-wind')) document.getElementById('iot-air-wind').textContent = `${air.wind_speed || 12} km/h - ${air.wind_direction || 'Đông Nam'}`;
  if (document.getElementById('iot-air-rain')) document.getElementById('iot-air-rain').textContent = `${air.rainfall || 1.5} mm (${air.rain_intensity || 0.5} mm/h)`;
  if (document.getElementById('iot-air-uv')) document.getElementById('iot-air-uv').innerHTML = `${air.uv_index || 4.2} <span style="font-size:11px; color:#64748b;">(Vừa)</span>`;
  if (document.getElementById('iot-air-solar')) document.getElementById('iot-air-solar').textContent = `${air.solar_radiation || 650} W/m²`;

  // Update Soil Multi-Depth
  selectSoilDepth(_selectedSoilDepth || '20cm');

  // Update Water Environment
  if (document.getElementById('iot-water-ph')) document.getElementById('iot-water-ph').textContent = water.ph || 6.8;
  if (document.getElementById('iot-water-do')) document.getElementById('iot-water-do').innerHTML = `${water.do || 6.5} <span style="font-size:11px;">mg/L</span>`;
  if (document.getElementById('iot-water-turbidity')) document.getElementById('iot-water-turbidity').innerHTML = `${water.turbidity || 12} <span style="font-size:11px;">NTU</span>`;
  if (document.getElementById('iot-water-level')) document.getElementById('iot-water-level').textContent = `${water.level || 85} %`;

  // Render 6-Day Weather Forecast
  const grid = document.getElementById('iot-weather-forecast-grid');
  if (!grid) return;

  grid.innerHTML = forecast.map((w) => {
    return `
      <div style="background:${w.bg || '#fff7ed'}; border:1.5px solid ${w.border || '#ffedd5'}; border-radius:14px; padding:14px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:13.5px; color:#0f172a;">${w.day_label || 'Hôm nay'}</strong>
            <span style="font-size:11px; color:#64748b; font-weight:700;">${w.date_str || ''}</span>
          </div>
          <div style="text-align:center; padding:10px 0;">
            <i class="fa-solid ${w.icon || 'fa-sun'}" style="font-size:32px; color:${w.color || '#f59e0b'}; margin-bottom:6px; display:block;"></i>
            <div style="font-size:16px; font-weight:900; color:#0f172a;">${w.temp || '25°C - 33°C'}</div>
          </div>
          <div style="font-size:11.5px; color:#475569; display:flex; flex-direction:column; gap:4px; margin-bottom:10px; background:rgba(255,255,255,0.7); padding:8px; border-radius:8px;">
            <div><i class="fa-solid fa-cloud-rain" style="color:#0284c7;"></i> Mưa: <strong>${w.rain || '10%'}</strong></div>
            <div><i class="fa-solid fa-droplet" style="color:#0284c7;"></i> Độ ẩm: <strong>${w.humidity || '70%'}</strong></div>
            <div><i class="fa-solid fa-wind" style="color:#64748b;"></i> Gió: <strong>${w.wind || '12 km/h'}</strong></div>
          </div>
        </div>
        <div style="font-size:11px; color:#334155; font-weight:700; line-height:1.4; border-top:1px dashed ${w.border || '#ffedd5'}; padding-top:8px;">
          ${w.advice || ''}
        </div>
      </div>
    `;
  }).join('');
}

// ── Web Audio Feedback API for NFC Scan (Ding & Beep-beep) ─────────
let _userAudioCtx = null;
function getUserAudioContext() {
  if (!_userAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) _userAudioCtx = new AudioContextClass();
  }
  if (_userAudioCtx && _userAudioCtx.state === 'suspended') {
    _userAudioCtx.resume();
  }
  return _userAudioCtx;
}

export function playUserSuccessDing() {
  const soundEnabled = document.getElementById('nfc-inv-sound-toggle')?.checked ?? true;
  if (!soundEnabled) return;
  try {
    const ctx = getUserAudioContext();
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
window.playUserSuccessDing = playUserSuccessDing;

export function playUserDuplicateBeep() {
  const soundEnabled = document.getElementById('nfc-inv-sound-toggle')?.checked ?? true;
  if (navigator.vibrate) {
    try { navigator.vibrate([100, 50, 100]); } catch (_) {}
  }
  if (!soundEnabled) return;
  try {
    const ctx = getUserAudioContext();
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
window.playUserDuplicateBeep = playUserDuplicateBeep;

// ── NFC Inventory Management Controller ────────────────────────────
let _userInvFarmId = null;
let _userIsContinuousScanning = false;
let _userNdefReaderInstance = null;
let _userNfcInventoryCache = [];

function getActiveUserFarmId() {
  if (_activeFarmId) return _activeFarmId;
  if (_farmsCache && _farmsCache.length > 0) return _farmsCache[0].id;
  const sel = document.getElementById('user-plant-filter-farm');
  if (sel && sel.value) return parseInt(sel.value);
  return null;
}

export async function openNfcInventoryModal(farmId = null) {
  const targetFarmId = farmId || getActiveUserFarmId();
  if (!targetFarmId) {
    alert('Vui lòng khởi tạo hoặc chọn một Trang trại trước khi mở Kho Thẻ!');
    return;
  }
  _userInvFarmId = targetFarmId;

  const farmObj = (_farmsCache || []).find(f => f.id == targetFarmId);
  const farmNameEl = document.getElementById('nfc-inv-farm-name');
  if (farmNameEl) farmNameEl.textContent = farmObj ? farmObj.name : `Trang trại #${targetFarmId}`;

  const modal = document.getElementById('nfc-inventory-modal');
  if (modal) modal.style.display = 'flex';

  await loadUserNfcInventoryData(targetFarmId);

  setTimeout(() => {
    document.getElementById('nfc-inv-quick-input')?.focus();
  }, 200);
}
window.openNfcInventoryModal = openNfcInventoryModal;

export function closeNfcInventoryModal() {
  if (_userIsContinuousScanning) {
    stopUserContinuousNfcScan();
  }
  const modal = document.getElementById('nfc-inventory-modal');
  if (modal) modal.style.display = 'none';
}
window.closeNfcInventoryModal = closeNfcInventoryModal;

export async function loadUserNfcInventoryData(farmId) {
  try {
    const res = await api(`/plants/farms/${farmId}/nfc-inventory`);
    _userNfcInventoryCache = res.tags || [];

    const totalEl = document.getElementById('nfc-inv-total-count');
    const assignedEl = document.getElementById('nfc-inv-assigned-count');
    const unassignedEl = document.getElementById('nfc-inv-unassigned-count');

    if (totalEl) totalEl.textContent = res.stats?.total || 0;
    if (assignedEl) assignedEl.textContent = res.stats?.assigned || 0;
    if (unassignedEl) unassignedEl.textContent = res.stats?.unassigned || 0;

    renderUserNfcInventoryTable(_userNfcInventoryCache);
  } catch (err) {
    if (window.toast) window.toast('Lỗi tải danh sách kho thẻ: ' + err.message, 'error');
  }
}
window.loadUserNfcInventoryData = loadUserNfcInventoryData;

function renderUserNfcInventoryTable(tags) {
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
            <button type="button" onclick="navigator.clipboard.writeText('${esc(t.nfc_uid)}'); if(window.toast) window.toast('Đã copy mã UID: ${esc(t.nfc_uid)}');" title="Sao chép UID" style="border:none; background:transparent; color:#64748b; cursor:pointer; font-size:12px; padding:2px 4px;">
              <i class="fa-regular fa-copy"></i>
            </button>
          </div>
        </td>
        <td style="padding:10px 12px; text-align:center;">${statusPill}</td>
        <td style="padding:10px 12px;">${plantInfo}</td>
        <td style="padding:10px 12px; font-size:12px; color:#64748b;">${timeStr}</td>
        <td style="padding:10px 12px; text-align:center;">
          <button type="button" onclick="deleteUserNfcTag(${t.id}, '${esc(t.nfc_uid)}')" title="Xóa thẻ khỏi kho" style="border:none; background:#fee2e2; color:#dc2626; border-radius:6px; width:30px; height:30px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all 0.2s ease;">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

export async function handleQuickNfcInput(event) {
  if (event) event.preventDefault();
  handleQuickNfcInputBtn();
}
window.handleQuickNfcInput = handleQuickNfcInput;

export async function handleQuickNfcInputBtn() {
  const inputEl = document.getElementById('nfc-inv-quick-input');
  if (!inputEl) return;
  const uid = inputEl.value.trim();
  if (!uid) return;

  if (!_userInvFarmId) {
    if (window.toast) window.toast('Chưa xác định trang trại!', 'error');
    return;
  }

  try {
    const res = await api(`/plants/farms/${_userInvFarmId}/nfc-inventory/batch`, {
      method: 'POST',
      body: JSON.stringify({ uids: [uid] })
    });

    if (res.added && res.added.length > 0) {
      playUserSuccessDing();
      if (window.toast) window.toast(`✅ Đã thêm thẻ ${uid} vào kho!`, 'success');
      inputEl.value = '';
      inputEl.focus();
      await loadUserNfcInventoryData(_userInvFarmId);
    } else if (res.duplicates && res.duplicates.length > 0) {
      playUserDuplicateBeep();
      if (window.toast) window.toast(`⚠️ Thẻ ${uid} đã tồn tại trong kho hoặc đã gán cây!`, 'error');
      inputEl.select();
    }
  } catch (err) {
    playUserDuplicateBeep();
    if (window.toast) window.toast(`Lỗi thêm thẻ: ${err.message}`, 'error');
    inputEl.select();
  }
}
window.handleQuickNfcInputBtn = handleQuickNfcInputBtn;

export async function toggleContinuousNfcScan() {
  if (_userIsContinuousScanning) {
    stopUserContinuousNfcScan();
  } else {
    await startUserContinuousNfcScan();
  }
}
window.toggleContinuousNfcScan = toggleContinuousNfcScan;

async function startUserContinuousNfcScan() {
  if (!('NDEFReader' in window)) {
    alert('Trình duyệt hoặc thiết bị này không hỗ trợ Web NFC API trực tiếp (chỉ hỗ trợ Chrome trên Android qua HTTPS).\n\n💡 Bạn có thể dùng đầu đọc thẻ USB, máy quét cầm tay hoặc nhập trực tiếp mã UID vào ô bên dưới!');
    document.getElementById('nfc-inv-quick-input')?.focus();
    return;
  }

  try {
    _userNdefReaderInstance = new NDEFReader();
    await _userNdefReaderInstance.scan();
    _userIsContinuousScanning = true;

    const btn = document.getElementById('btn-toggle-continuous-nfc');
    if (btn) {
      btn.style.background = '#dc2626';
      btn.innerHTML = '<i class="fa-solid fa-stop"></i> Dừng Quét Liên Tục';
    }

    const pill = document.getElementById('nfc-scan-status-pill');
    const text = document.getElementById('nfc-scan-status-text');
    if (pill) { pill.style.background = '#fef2f2'; pill.style.color = '#991b1b'; pill.style.borderColor = '#fca5a5'; }
    if (text) text.innerHTML = '<i class="fa-solid fa-rss fa-spin"></i> ĐANG QUÉT LIÊN TỤC — CHẠM THẺ VÀO LƯNG MÁY';

    _userNdefReaderInstance.addEventListener('reading', async ({ serialNumber }) => {
      if (!serialNumber) return;
      const cleanUid = serialNumber.trim().toUpperCase();

      try {
        const res = await api(`/plants/farms/${_userInvFarmId}/nfc-inventory/batch`, {
          method: 'POST',
          body: JSON.stringify({ uids: [cleanUid] })
        });

        if (res.added && res.added.length > 0) {
          playUserSuccessDing();
          if (window.toast) window.toast(`✨ Đã quẹt thành công thẻ: ${cleanUid}`, 'success');
          await loadUserNfcInventoryData(_userInvFarmId);
        } else {
          playUserDuplicateBeep();
          if (window.toast) window.toast(`⚠️ Trùng lặp: Thẻ ${cleanUid} đã có trong kho!`, 'error');
        }
      } catch (e) {
        playUserDuplicateBeep();
        if (window.toast) window.toast(`⚠️ ${e.message}`, 'error');
      }
    });

    if (window.toast) window.toast('🚀 Đã kích hoạt Chế độ Quét liên tục. Hãy chạm lần lượt từng thẻ vào mặt sau điện thoại!');
  } catch (err) {
    stopUserContinuousNfcScan();
    alert('Không thể kích hoạt NFC: ' + err.message);
  }
}

function stopUserContinuousNfcScan() {
  _userIsContinuousScanning = false;
  _userNdefReaderInstance = null;

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

export async function deleteUserNfcTag(tagId, uid) {
  if (!confirm(`Xóa thẻ NFC "${uid}" khỏi kho trang trại?`)) return;
  try {
    await api(`/plants/farms/${_userInvFarmId}/nfc-inventory/${tagId}`, { method: 'DELETE' });
    if (window.toast) window.toast('Đã xóa thẻ khỏi kho thành công.', 'success');
    await loadUserNfcInventoryData(_userInvFarmId);
  } catch (err) {
    if (window.toast) window.toast('Lỗi xóa thẻ: ' + err.message, 'error');
  }
}
window.deleteUserNfcTag = deleteUserNfcTag;

// ── In-Field Walk & GPS Tagging Controller ──────────────────────────
let _userFieldTagFarmId = null;
let _userFieldTagPlants = [];
let _userFieldTagIndex = 0;
let _userFieldCurrentGps = { lat: null, lng: null, accuracy: null };

export async function openFieldTaggingModal(farmId = null) {
  const targetFarmId = farmId || getActiveUserFarmId();
  if (!targetFarmId) {
    alert('Vui lòng chọn hoặc tạo Trang trại trước khi đi vườn gán thẻ!');
    return;
  }
  _userFieldTagFarmId = targetFarmId;

  const farmObj = (_farmsCache || []).find(f => f.id == targetFarmId);
  const farmNameEl = document.getElementById('field-tag-farm-name');
  if (farmNameEl) farmNameEl.textContent = farmObj ? farmObj.name : `Trang trại #${targetFarmId}`;

  // Filter plants of this farm from cache or fetch
  const farmPlants = (_plantsCache || []).filter(p => String(p.farm_id) === String(targetFarmId));
  _userFieldTagPlants = [...farmPlants].sort((a,b) => {
    const codeA = parseInt(a.tree_code || a.id) || a.id;
    const codeB = parseInt(b.tree_code || b.id) || b.id;
    return codeA - codeB;
  });
  _userFieldTagIndex = 0;

  const modal = document.getElementById('field-tagging-modal');
  if (modal) modal.style.display = 'flex';

  renderUserCurrentFieldTree();
  refreshFieldGps();
}
window.openFieldTaggingModal = openFieldTaggingModal;

export function closeFieldTaggingModal() {
  const modal = document.getElementById('field-tagging-modal');
  if (modal) modal.style.display = 'none';
  if (typeof filterUserPlants === 'function') filterUserPlants();
}
window.closeFieldTaggingModal = closeFieldTaggingModal;

function renderUserCurrentFieldTree() {
  if (!_userFieldTagPlants || _userFieldTagPlants.length === 0) {
    const treeDisplay = document.getElementById('field-tag-current-tree-display');
    if (treeDisplay) treeDisplay.innerHTML = '<span style="color:#ef4444;">Trang trại chưa có cây nào. Hãy tạo cây trước!</span>';
    return;
  }

  const p = _userFieldTagPlants[_userFieldTagIndex];
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

  const pubUrl = p.public_url || `https://plant-book.onrender.com/${p.farm_id || _userFieldTagFarmId}/${p.id}${p.nfc_uid ? '/' + encodeURIComponent(p.nfc_uid) : ''}`;
  if (urlPreviewEl) {
    urlPreviewEl.innerHTML = `<a href="${pubUrl}" target="_blank" style="color:#7c3aed; text-decoration:none; font-weight:700;"><i class="fa-solid fa-link"></i> ${pubUrl}</a>`;
  }

  const nextPlant = _userFieldTagPlants[_userFieldTagIndex + 1];
  if (nextCodeEl) nextCodeEl.textContent = nextPlant ? (nextPlant.tree_code || nextPlant.id) : 'Hết danh sách';
}

export function prevFieldTree() {
  if (_userFieldTagIndex > 0) {
    _userFieldTagIndex--;
    renderUserCurrentFieldTree();
  }
}
window.prevFieldTree = prevFieldTree;

export function nextFieldTree() {
  if (_userFieldTagIndex < _userFieldTagPlants.length - 1) {
    _userFieldTagIndex++;
    renderUserCurrentFieldTree();
  }
}
window.nextFieldTree = nextFieldTree;

export function refreshFieldGps() {
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
    _userFieldCurrentGps = { lat: 11.8333, lng: 106.9167, accuracy: 10 };
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = pos.coords.accuracy;
      _userFieldCurrentGps = { lat, lng, accuracy: acc };
      if (latEl) latEl.textContent = lat.toFixed(6);
      if (lngEl) lngEl.textContent = lng.toFixed(6);
      if (accEl) accEl.textContent = `±${Math.round(acc)} m`;
    },
    (err) => {
      console.warn('Field GPS error:', err);
      if (latEl) latEl.textContent = '11.8333';
      if (lngEl) lngEl.textContent = '106.9167';
      if (accEl) accEl.textContent = '±15 m (Ước lượng)';
      _userFieldCurrentGps = { lat: 11.8333, lng: 106.9167, accuracy: 15 };
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}
window.refreshFieldGps = refreshFieldGps;

export async function startFieldNfcTouch() {
  if (!_userFieldTagPlants || _userFieldTagPlants.length === 0) {
    if (window.toast) window.toast('Chưa có cây trồng nào để gán thẻ!', 'error');
    return;
  }

  const currentPlant = _userFieldTagPlants[_userFieldTagIndex];
  if (!currentPlant) return;

  if (!('NDEFReader' in window)) {
    alert('Trình duyệt này không hỗ trợ Web NFC trực tiếp.\n\n💡 Vui lòng nhập mã UID thủ công vào ô bên dưới!');
    document.getElementById('field-tag-manual-uid')?.focus();
    return;
  }

  try {
    const ndef = new NDEFReader();
    await ndef.scan();
    if (window.toast) window.toast('📡 Hãy chạm thẻ vào mặt sau điện thoại ngay...');

    ndef.addEventListener('reading', async ({ serialNumber }) => {
      if (!serialNumber) return;
      const cleanUid = serialNumber.trim().toUpperCase();
      await executeUserFieldTagAssign(currentPlant, cleanUid, ndef);
    }, { once: true });
  } catch (err) {
    alert('Lỗi kích hoạt NFC: ' + err.message);
  }
}
window.startFieldNfcTouch = startFieldNfcTouch;

export async function submitFieldTagManual() {
  const input = document.getElementById('field-tag-manual-uid');
  if (!input) return;
  const uid = input.value.trim();
  if (!uid) {
    if (window.toast) window.toast('Vui lòng nhập mã thẻ NFC!', 'error');
    return;
  }
  const currentPlant = _userFieldTagPlants[_userFieldTagIndex];
  if (!currentPlant) return;

  await executeUserFieldTagAssign(currentPlant, uid, null);
  input.value = '';
}
window.submitFieldTagManual = submitFieldTagManual;

async function executeUserFieldTagAssign(plant, uid, ndefInstance) {
  try {
    const lat = _userFieldCurrentGps.lat || 11.8333;
    const lng = _userFieldCurrentGps.lng || 106.9167;

    const res = await api(`/plants/farms/${_userFieldTagFarmId}/tag-nfc-gps`, {
      method: 'POST',
      body: JSON.stringify({
        plant_id: plant.id,
        nfc_uid: uid,
        latitude: lat,
        longitude: lng
      })
    });

    playUserSuccessDing();
    if (window.toast) window.toast(`🎉 Đã gán thẻ ${uid} và lưu GPS cho Cây #${plant.tree_code || plant.id}!`, 'success');

    // Attempt to write NDEF URL to NFC tag
    if (ndefInstance && res.plant?.public_url) {
      try {
        await ndefInstance.write({
          records: [{ recordType: 'url', data: res.plant.public_url }]
        });
        if (window.toast) window.toast('📝 Đã ghi đường dẫn Public vào chip NFC thành công!', 'success');
      } catch (writeErr) {
        console.warn('NDEF write skipped/failed:', writeErr);
      }
    }

    // Update local cached plant
    plant.nfc_uid = uid;
    plant.latitude = lat;
    plant.longitude = lng;
    plant.public_url = res.plant?.public_url || `https://plant-book.onrender.com/${_userFieldTagFarmId}/${plant.id}/${encodeURIComponent(uid)}`;

    renderUserCurrentFieldTree();
    filterUserPlants();

    // Check auto advance
    const autoNext = document.getElementById('field-tag-auto-next')?.checked;
    if (autoNext && _userFieldTagIndex < _userFieldTagPlants.length - 1) {
      setTimeout(() => {
        nextFieldTree();
        refreshFieldGps();
      }, 1000);
    }
  } catch (err) {
    playUserDuplicateBeep();
    if (window.toast) window.toast('Lỗi gán thẻ: ' + err.message, 'error');
  }
}


