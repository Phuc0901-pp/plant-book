/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/plants.js — Plant list rendering & search filter
   ═══════════════════════════════════════════════════════════════ */

import { esc, healthBadge, sanitizeCoordinates, formatSmartArea } from '../core/utils.js';
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
      container.innerHTML = '<div class="empty-state" style="padding:16px"><i data-lucide="crosshair" class="lucide-sm" style="color:var(--green)"></i><p>Bạn chưa khởi tạo trang trại nào. Mở tab <strong>Trang trại</strong> để tự định vị GPS và khởi tạo ngay!</p></div>';
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
          <span><i data-lucide="ruler" class="lucide-sm"></i> ${f.area ? Math.round(parseFloat(f.area)).toLocaleString('vi-VN') : 0} m²</span>
          <span><i data-lucide="sprout" class="lucide-sm"></i> ${f.plant_count || 0} cây</span>
        </div>
      </div>
    `).join('');
  }
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
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
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i data-lucide="sprout" class="lucide-sm"></i><p>Không có cây trồng nào được giao</p></td></tr>';
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    return;
  }
  const sorted = sortPlantsByHealthThenId(plants);
  tbody.innerHTML = sorted.slice(0, 3).map(p => _plantRow(p)).join('');
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

export const USER_PLANTS_PAGE_SIZE = 10;
let _userPlantsCurrentPage = 1;
let _currentFilteredUserPlants = [];

/**
 * Render danh sách đầy đủ cây trồng ở tab Trang trại (Phân trang 10 bản ghi/trang).
 * @param {Array} plants
 * @param {number} [page=1]
 */
export function renderUserPlantsTable(plants, page = 1) {
  _currentFilteredUserPlants = Array.isArray(plants) ? plants : [];
  _userPlantsCurrentPage = page || 1;
  renderUserPlantsTablePage();
}

export function goToUserPlantsPage(page) {
  const totalPages = Math.ceil(_currentFilteredUserPlants.length / USER_PLANTS_PAGE_SIZE) || 1;
  let targetPage = parseInt(page, 10) || 1;
  if (targetPage < 1) targetPage = 1;
  if (targetPage > totalPages) targetPage = totalPages;
  _userPlantsCurrentPage = targetPage;
  renderUserPlantsTablePage();
}
window.goToUserPlantsPage = goToUserPlantsPage;

export function renderUserPlantsTablePage() {
  const tbody = document.getElementById('user-plants-table');
  const pagInfo = document.getElementById('user-plants-pagination-info');
  const pagBtns = document.getElementById('user-plants-pagination-btns');
  const paginationContainer = document.getElementById('user-plants-pagination');

  if (!tbody) return;

  const total = _currentFilteredUserPlants.length;
  if (!total) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i data-lucide="sprout" class="lucide-sm"></i><p>Không tìm thấy cây trồng phù hợp</p></td></tr>';
    if (pagInfo) pagInfo.textContent = 'Không có cây trồng nào';
    if (pagBtns) pagBtns.innerHTML = '';
    if (paginationContainer) paginationContainer.style.display = 'none';
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    return;
  }

  if (paginationContainer) paginationContainer.style.display = 'flex';

  const sorted = sortPlantsByHealthThenId(_currentFilteredUserPlants);
  const totalPages = Math.ceil(total / USER_PLANTS_PAGE_SIZE) || 1;
  if (_userPlantsCurrentPage > totalPages) _userPlantsCurrentPage = totalPages;
  if (_userPlantsCurrentPage < 1) _userPlantsCurrentPage = 1;

  const startIndex = (_userPlantsCurrentPage - 1) * USER_PLANTS_PAGE_SIZE;
  const endIndex = Math.min(startIndex + USER_PLANTS_PAGE_SIZE, total);
  const pageItems = sorted.slice(startIndex, endIndex);

  tbody.innerHTML = pageItems.map(p => _plantRow(p)).join('');

  if (pagInfo) {
    pagInfo.innerHTML = `Hiển thị <strong>${startIndex + 1} - ${endIndex}</strong> trên tổng số <strong>${total}</strong> cây (${totalPages} trang)`;
  }

  if (pagBtns) {
    if (totalPages <= 1) {
      pagBtns.innerHTML = '';
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
      return;
    }

    let btnsHtml = `
      <button type="button" class="btn btn-secondary btn-sm" onclick="goToUserPlantsPage(${_userPlantsCurrentPage - 1})" ${_userPlantsCurrentPage === 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} style="padding:5px 11px; font-size:12px; font-weight:700; border-radius:6px;">
        <i data-lucide="chevron-left" class="lucide-sm"></i> Trước
      </button>
    `;

    // Max 5 visible page numbers around current page
    let startPage = Math.max(1, _userPlantsCurrentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    if (startPage > 1) {
      btnsHtml += `<button type="button" class="btn btn-secondary btn-sm" onclick="goToUserPlantsPage(1)" style="padding:5px 9px; font-size:12px; font-weight:700; border-radius:6px;">1</button>`;
      if (startPage > 2) btnsHtml += `<span style="padding:2px 4px; color:#94a3b8; font-weight:700;">...</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
      const isActive = p === _userPlantsCurrentPage;
      btnsHtml += `
        <button type="button" class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}" onclick="goToUserPlantsPage(${p})" style="padding:5px 10px; font-size:12px; font-weight:${isActive ? '800' : '700'}; border-radius:6px; ${isActive ? 'background:#059669; border-color:#059669; color:#fff; box-shadow:0 2px 6px rgba(5,150,105,0.25);' : ''}">
          ${p}
        </button>
      `;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) btnsHtml += `<span style="padding:2px 4px; color:#94a3b8; font-weight:700;">...</span>`;
      btnsHtml += `<button type="button" class="btn btn-secondary btn-sm" onclick="goToUserPlantsPage(${totalPages})" style="padding:5px 9px; font-size:12px; font-weight:700; border-radius:6px;">${totalPages}</button>`;
    }

    btnsHtml += `
      <button type="button" class="btn btn-secondary btn-sm" onclick="goToUserPlantsPage(${_userPlantsCurrentPage + 1})" ${_userPlantsCurrentPage === totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} style="padding:5px 11px; font-size:12px; font-weight:700; border-radius:6px;">
        Sau <i data-lucide="chevron-right" class="lucide-sm"></i>
      </button>
    `;

    pagBtns.innerHTML = btnsHtml;
  }
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/**
 * Tạo HTML một hàng cây trồng trong bảng.
 * @private
 */
function _plantRow(p) {
  const nfcBadge = p.nfc_uid
    ? `<span title="Thẻ: ${esc(p.nfc_uid)}" style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:#22c55e;"><i data-lucide="tag" class="lucide-sm"></i></span>`
    : `<span title="Chưa gắn thẻ NFC" style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:#d1d5db;"><i data-lucide="unlink" class="lucide-sm"></i></span>`;

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
        <i data-lucide="copy" class="lucide-sm"></i>
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
      <td data-label="Thao tác" class="plant-actions-cell">
        <div class="erp-plant-action-btns">
          <button type="button" class="btn-erp-plant-action btn-erp-plant-care" onclick="openCareModal(${p.id}, '${treeCodeSafe}', '${plantTypeSafe}')" title="Ghi chép hoạt động chăm sóc & canh tác">
            <i data-lucide="file-check" class="lucide-sm"></i> <span>Ghi nhật ký</span>
          </button>
          <button type="button" class="btn-erp-plant-action btn-erp-plant-nfc" onclick="openNfcModal(${p.id}, '${treeCodeSafe}', '${slugSafe}', ${uidVal})" title="Gán hoặc định danh thẻ NFC cho cây">
            <i data-lucide="tag" class="lucide-sm"></i> <span>Gán thẻ NFC</span>
          </button>
        </div>
      </td>
    </tr>`;
}

// ── Range Filter & GPS Radar State ─────────────────────────────
let _activeRangeFilter = 'all';
let _gpsNearbyPlants = null;

/**
 * Đặt bộ lọc phân đoạn dải cây (1-20, 21-40, 41-60, 61-80)
 * @param {string} range 'all' | '1-20' | '21-40' | '41-60' | '61-80'
 * @param {HTMLElement} btn
 */
export function setPlantRangeFilter(range, btn) {
  _activeRangeFilter = range || 'all';
  _gpsNearbyPlants = null;

  document.querySelectorAll('.range-pill').forEach(el => {
    el.classList.remove('active');
    el.style.background = '#f8fafc';
    el.style.color = '#475569';
    el.style.borderColor = '#cbd5e1';
  });

  if (btn) {
    btn.classList.add('active');
    btn.style.background = '#10b981';
    btn.style.color = '#ffffff';
    btn.style.borderColor = '#10b981';
  }

  const statusEl = document.getElementById('range-filter-status');
  if (statusEl) {
    if (range !== 'all') {
      statusEl.style.display = 'inline';
      statusEl.textContent = `⚡ Lô: ${range}`;
    } else {
      statusEl.style.display = 'none';
    }
  }

  filterUserPlants();
}
window.setPlantRangeFilter = setPlantRangeFilter;

/**
 * Radar định vị và tìm kiếm các cây gần tọa độ GPS của người dùng nhất
 */
export async function locateNearbyPlantsFromGPS() {
  if (!navigator.geolocation) {
    if (window.toast) window.toast('Trình duyệt không hỗ trợ định vị GPS.', 'error');
    return;
  }

  const btn = document.getElementById('btn-gps-nearby-radar');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin lucide-sm" style="color:#16a34a;"></i> <span>Đang dò GPS...</span>';
    btn.disabled = true;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const farmId = document.getElementById('user-plant-filter-farm')?.value || (_activeFarmId || '');

      try {
        const url = `/plants/nearby-gps?lat=${lat}&lng=${lng}&radius=2000${farmId ? `&farm_id=${farmId}` : ''}`;
        const nearbyPlants = await api(url);

        if (!nearbyPlants || !nearbyPlants.length) {
          if (window.toast) window.toast(`Không tìm thấy cây nào quanh tọa độ (${lat.toFixed(4)}, ${lng.toFixed(4)}).`, 'warning');
          _gpsNearbyPlants = null;
        } else {
          _gpsNearbyPlants = nearbyPlants;
          if (window.toast) window.toast(`🛰️ Đã tìm thấy ${nearbyPlants.length} cây gần vị trí bạn nhất!`, 'success');
        }

        filterUserPlants();
      } catch (err) {
        if (window.toast) window.toast('Lỗi truy vấn GPS: ' + err.message, 'error');
      } finally {
        if (btn) {
          btn.innerHTML = originalHtml;
          btn.disabled = false;
        }
      }
    },
    (err) => {
      if (btn) {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }
      let msg = 'Không thể lấy tọa độ GPS.';
      if (err.code === 1) msg = 'Vui lòng cấp quyền truy cập Vị trí (GPS) trên trình duyệt.';
      if (window.toast) window.toast(msg, 'warning');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}
window.locateNearbyPlantsFromGPS = locateNearbyPlantsFromGPS;

// ── Search / Filter ───────────────────────────────────────────

/**
 * Lọc danh sách cây theo từ khoá, dải cây (Range) hoặc khoảng cách GPS.
 * Kết quả được render vào bảng đầy đủ.
 */
export function filterUserPlants() {
  const query  = (document.getElementById('user-plant-search')?.value || '').trim().toLowerCase();
  const farmId = document.getElementById('user-plant-filter-farm')?.value || '';

  let filtered = _gpsNearbyPlants ? [..._gpsNearbyPlants] : [..._plantsCache];

  if (farmId) {
    filtered = filtered.filter(p => String(p.farm_id) === farmId);
  }

  // Lọc theo Dải số thứ tự cây (Range Filter)
  if (!_gpsNearbyPlants && _activeRangeFilter && _activeRangeFilter !== 'all') {
    const parts = _activeRangeFilter.split('-');
    if (parts.length === 2) {
      const min = parseInt(parts[0], 10);
      const max = parseInt(parts[1], 10);
      filtered = filtered.filter(p => {
        const rawCode = String(p.tree_code || p.id || '').replace(/\D/g, '');
        const num = parseInt(rawCode, 10);
        if (!isNaN(num)) {
          return num >= min && num <= max;
        }
        return false;
      });
    }
  }

  if (query) {
    filtered = filtered.filter(p =>
      [p.tree_code, String(p.id), p.plant_type, p.plant_variety, p.location]
        .some(v => (v || '').toLowerCase().includes(query))
    );
  }

  const countFullEl = document.getElementById('user-plant-count-full');
  if (countFullEl) countFullEl.textContent = filtered.length;

  renderUserPlantsTable(filtered, 1);
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

    // VietGAP & PUC Badges in Detail Subheader
    const vietgapBadge = document.getElementById('active-farm-vietgap-badge');
    const vietgapNum = document.getElementById('active-farm-vietgap-number');
    if (vietgapBadge && vietgapNum) {
      if (farm.vietgap_cert_number) {
        vietgapNum.textContent = farm.vietgap_cert_number;
        vietgapBadge.style.display = 'inline-flex';
        vietgapBadge.title = farm.vietgap_cert_org ? `Tổ chức cấp: ${farm.vietgap_cert_org}` : `Chứng nhận: ${farm.vietgap_cert_number}`;
      } else {
        vietgapBadge.style.display = 'none';
      }
    }

    const pucBadge = document.getElementById('active-farm-puc-badge');
    const pucNum = document.getElementById('active-farm-puc-number');
    if (pucBadge && pucNum) {
      if (farm.puc_code) {
        pucNum.textContent = farm.puc_code;
        pucBadge.style.display = 'inline-flex';
      } else {
        pucBadge.style.display = 'none';
      }
    }

    // Fetch and populate Farmer NFC tag status metrics (Holding, Assigned, Unassigned)
    fetchFarmerNfcStats(farm.id);

    // Filter plant table select dropdown for this farm
    const filterSel = document.getElementById('user-plant-filter-farm');
    if (filterSel) {
      filterSel.value = farm.id;
      filterUserPlants();
    }

    // Trigger instant map resize & smooth bounds navigation down to farm!
    const zoomToFarm = () => {
      const targetMap = userMap || window.userMap;
      if (!targetMap) return;
      try { targetMap.resize(); } catch (_) {}

      const bounds = new mapboxgl.LngLatBounds();
      let hasPoints = false;

      const validCoords = sanitizeCoordinates(farm.polygon_coordinates);
      if (validCoords && validCoords.length > 0) {
        validCoords.forEach(pt => {
          bounds.extend(pt);
          hasPoints = true;
        });
      }

      // If no polygon points, find plants in this farm
      if (!hasPoints) {
        const farmPlants = (_plantsCache || []).filter(p => String(p.farm_id) === String(farm.id) && p.latitude && p.longitude);
        farmPlants.forEach(p => {
          let lat = parseFloat(p.latitude);
          let lng = parseFloat(p.longitude);
          if (!isNaN(lat) && !isNaN(lng)) {
            if (lat > 50 && lng < 50) { const tmp = lat; lat = lng; lng = tmp; }
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
              bounds.extend([lng, lat]);
              hasPoints = true;
            }
          }
        });
      }

      if (hasPoints) {
        targetMap.fitBounds(bounds, { padding: 60, maxZoom: 19.5, duration: 800 });
      }
    };

    zoomToFarm();
    setTimeout(zoomToFarm, 80);
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
            <i data-lucide="plus" class="lucide-sm"></i>
          </div>
          <div style="font-size:16px; font-weight:800; color:#047857; margin-bottom:4px;">Khởi tạo Trang trại mới (GPS)</div>
          <div style="font-size:13px; color:#166534;">Bấm vào đây để lấy tọa độ thực tế từ GPS thiết bị</div>
        </div>
      `;
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    }
    return;
  }

  if (gridContainer) {
function formatSmartArea(val) {
  const num = parseFloat(val);
  if (!num || isNaN(num) || num <= 0) return '0 m²';
  if (num >= 10000) {
    const ha = num / 10000;
    const haFormatted = ha.toLocaleString('vi-VN', {
      minimumFractionDigits: (ha % 1 === 0) ? 0 : (ha < 10 ? 2 : 1),
      maximumFractionDigits: 2
    });
    return `${haFormatted} ha`;
  }
  return `${Math.round(num).toLocaleString('vi-VN')} m²`;
}
window.formatSmartArea = formatSmartArea;

    let html = farms.map(f => {
      const totalPlants = f.plant_count || f.total_plants || 0;
      const rawAreaFormatted = f.area ? Math.round(parseFloat(f.area)).toLocaleString('vi-VN') + ' m²' : '0 m²';
      const smartArea = formatSmartArea(f.area);
      return `
        <div onclick="openFarmDetailView(${f.id})" style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:16px; padding:18px; position:relative; cursor:pointer; transition:all 0.2s ease; box-shadow:0 4px 16px rgba(0,0,0,0.04);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <h4 style="margin:0; font-size:15px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
              <i data-lucide="home" class="lucide-sm" style="color:#059669; font-size:16px;"></i> ${esc(f.name)}
            </h4>
            <span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-size:11px; font-weight:800; padding:3px 10px; border-radius:20px;">Trang trại của tôi</span>
          </div>
          <p style="margin:0 0 14px 0; font-size:12.5px; color:#64748b; font-style:italic; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical;">
            ${esc(f.description || 'Chưa có mô tả địa chỉ')}
          </p>
          <div style="background:#f8fafc; border:1px solid #f1f5f9; border-radius:10px; padding:10px 12px; font-size:12.5px; color:#334155; display:flex; justify-content:space-between; margin-bottom:10px; font-weight:700;">
            <span><i data-lucide="sprout" class="lucide-sm" style="color:#059669;"></i> ${totalPlants} cây</span>
            <span title="Tổng diện tích: ${rawAreaFormatted}"><i data-lucide="ruler" class="lucide-sm" style="color:#059669;"></i> ${smartArea}</span>
          </div>
          <div style="font-size:11.5px; margin-bottom:12px; display:flex; flex-wrap:wrap; gap:6px;">
            ${f.vietgap_cert_number ? `<span style="background:#dcfce7; color:#065f46; border:1px solid #86efac; padding:2px 7px; border-radius:6px; font-weight:700;"><i data-lucide="shield-check" class="lucide-sm"></i> VietGAP: ${esc(f.vietgap_cert_number)}</span>` : `<span style="background:#f1f5f9; color:#64748b; padding:2px 7px; border-radius:6px; font-size:11px;">VietGAP: Chưa cấp</span>`}
            ${f.puc_code ? `<span style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; padding:2px 7px; border-radius:6px; font-weight:700;"><i data-lucide="globe" class="lucide-sm"></i> PUC: ${esc(f.puc_code)}</span>` : `<span style="background:#f1f5f9; color:#64748b; padding:2px 7px; border-radius:6px; font-size:11px;">PUC: Chưa cấp</span>`}
          </div>
          <div style="display:flex; gap:8px;">
            <button onclick="openFarmDetailView(${f.id})" style="flex:1; background:linear-gradient(135deg, #10b981, #047857); color:#ffffff; border:none; border-radius:10px; padding:9px 12px; font-size:13px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 3px 10px rgba(16,185,129,0.25);">
              <i data-lucide="map" class="lucide-sm"></i> Xem Bản đồ & Chi tiết
            </button>
            <button onclick="event.stopPropagation(); openEditFarmModal(${f.id})" style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:10px; padding:9px 12px; font-size:13px; font-weight:700; color:#334155; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:4px;" title="Chỉnh sửa trang trại">
              <i data-lucide="edit" class="lucide-sm" style="color:#059669;"></i> Sửa
            </button>
            <button onclick="event.stopPropagation(); deleteUserFarm(${f.id}, '${esc(f.name)}')" style="background:#ffffff; border:1.5px solid #fca5a5; border-radius:10px; padding:9px 12px; font-size:13px; font-weight:700; color:#dc2626; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:4px;" title="Xóa đệm (ẩn) trang trại">
              <i data-lucide="trash-2" class="lucide-sm" style="color:#dc2626;"></i> Xóa
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
            <i data-lucide="plus" class="lucide-sm"></i>
          </div>
          <div style="font-size:14px; font-weight:800; color:#047857;">+ Khởi tạo Trang trại mới (GPS)</div>
          <div style="font-size:12px; color:#166534; margin-top:2px;">Bấm để định vị GPS thêm trang trại</div>
        </div>
      `;
    }

    gridContainer.innerHTML = html;
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }
}


export function selectUserFarm(farmId) {
  _activeFarmId = farmId;
  if (_farmsCache && _farmsCache.length) {
    renderUserFarmsGrid(_farmsCache);
    const farm = _farmsCache.find(f => String(f.id) === String(farmId));
    if (farm && window.userMap && farm.polygon_coordinates) {
      const validCoords = sanitizeCoordinates(farm.polygon_coordinates);
      if (validCoords && validCoords.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        validCoords.forEach(pt => bounds.extend(pt));
        window.userMap.fitBounds(bounds, { padding: 60, maxZoom: 19.5, duration: 800 });
      }
    }
  }
}

// ── Farm Edit Functions ────────────────────────────────────────
export function openEditFarmModal(farmId = null) {
  const targetId = farmId || _activeFarmId;
  const farm = (_farmsCache || []).find(f => String(f.id) === String(targetId));
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
  if (document.getElementById('edit-farm-vietgap-cert')) {
    document.getElementById('edit-farm-vietgap-cert').value = farm.vietgap_cert_number || '';
  }
  if (document.getElementById('edit-farm-vietgap-org')) {
    document.getElementById('edit-farm-vietgap-org').value = farm.vietgap_cert_org || '';
  }
  if (document.getElementById('edit-farm-puc')) {
    document.getElementById('edit-farm-puc').value = farm.puc_code || '';
  }
  document.getElementById('edit-farm-desc').value = farm.description || '';

  let lat = '', lng = '';
  const validCoords = sanitizeCoordinates(farm.polygon_coordinates);
  if (validCoords && validCoords.length > 0) {
    lng = validCoords[0][0];
    lat = validCoords[0][1];
  }

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
  const vietgapCert = document.getElementById('edit-farm-vietgap-cert')?.value?.trim() || null;
  const vietgapOrg = document.getElementById('edit-farm-vietgap-org')?.value?.trim() || null;
  const pucCode = document.getElementById('edit-farm-puc')?.value?.trim() || null;

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
        longitude: lng,
        vietgap_cert_number: vietgapCert,
        vietgap_cert_org: vietgapOrg,
        puc_code: pucCode
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
    setTimeout(() => {
      if (window.lucide) {
        try { lucide.createIcons(); } catch (_) {}
      }
    }, 50);
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

// ── Real Open-Meteo 6-Day Agricultural Weather Forecast ─────────────
const WMO_FORECAST_CONFIG = {
  0: { icon: 'sun', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', label: 'Trời nắng trong xanh', advice: '☀️ Nắng ấm: Rất thích hợp bón phân rễ & tưới nước buổi sáng sớm.' },
  1: { icon: 'sun-medium', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', label: 'Quang mây, ít mây', advice: '⛅ Mát mẻ: Thời điểm lý tưởng để tỉa cành, tạo tán và làm cỏ vườn.' },
  2: { icon: 'cloud-sun', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', label: 'Mây rải rác', advice: '🌤️ Nắng gián đoạn: Thích hợp phun phân bón lá & vi lượng hấp thu nhanh.' },
  3: { icon: 'cloud', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'Nhiều mây âm u', advice: '☁️ Trời nhiều mây: Thuận lợi thu hoạch trái và kiểm tra sâu bệnh hại.' },
  45: { icon: 'cloud-fog', color: '#64748b', bg: '#f8fafc', border: '#cbd5e1', label: 'Sương mù sáng sớm', advice: '🌫️ Sương mù ẩm: Chú ý phòng ngừa nấm bệnh sương mai trên đọt non.' },
  48: { icon: 'cloud-fog', color: '#64748b', bg: '#f8fafc', border: '#cbd5e1', label: 'Sương mù đọng sương', advice: '🌫️ Đọng sương ẩm: Tránh tưới quá ẩm làm tăng nguy cơ thối rễ.' },
  51: { icon: 'cloud-drizzle', color: '#38bdf8', bg: '#f0fdfa', border: '#99f6e4', label: 'Mưa phùn nhẹ', advice: '🌦️ Mưa phùn nhẹ: Có thể giảm lượng tưới nước, theo dõi độ ẩm đất.' },
  53: { icon: 'cloud-drizzle', color: '#0284c7', bg: '#eff6ff', border: '#bfdbfe', label: 'Mưa phùn vừa', advice: '🌧️ Mưa phùn: Hoãn phun thuốc BVTV để tránh lãng phí và trôi thuốc.' },
  55: { icon: 'cloud-rain', color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd', label: 'Mưa phùn nặng', advice: '🌧️ Mưa kéo dài: Cần đảm bảo hệ thống rãnh thoát nước vườn thông thoáng.' },
  61: { icon: 'cloud-rain', color: '#0284c7', bg: '#eff6ff', border: '#bfdbfe', label: 'Mưa rào nhẹ', advice: '🌦️ Mưa rào rải rác: Tận dụng nguồn đạm tự nhiên, tạm hoãn bón phân đạm.' },
  63: { icon: 'cloud-rain-wind', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', label: 'Mưa rào vừa', advice: '🌧️ Mưa rào vừa: Kiểm tra thoát nước gốc cây, tránh đọng nước cổ rễ.' },
  65: { icon: 'cloud-rain-wind', color: '#1d4ed8', bg: '#eff6ff', border: '#60a5fa', label: 'Mưa to nặng hạt', advice: '⛈️ Mưa to nặng hạt: Khơi thông dòng chảy thoát lũ, không đi lại làm nén đất.' },
  80: { icon: 'cloud-sun-rain', color: '#0284c7', bg: '#eff6ff', border: '#bfdbfe', label: 'Mưa rào thoáng qua', advice: '🌦️ Mưa rào ngắn: Thời tiết thuận lợi sau mưa để tiến hành thăm vườn.' },
  81: { icon: 'cloud-rain-wind', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', label: 'Mưa rào từng cơn', advice: '🌧️ Mưa từng đợt: Cắt tỉa cành khô, cành sâu bệnh bị gãy đổ.' },
  82: { icon: 'cloud-rain-wind', color: '#1e40af', bg: '#f1f5f9', border: '#94a3b8', label: 'Mưa rất to xối xả', advice: '⛈️ Mưa xối xả: Kê cao vật tư phân bón, kiểm tra an toàn điện trạm bơm.' },
  95: { icon: 'cloud-lightning', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', label: 'Mưa dông sét', advice: '⚡ Dông sét: Gia cố cọc chống cây trồng lớn, ngắt nguồn điện tưới ngoài trời.' },
  96: { icon: 'cloud-lightning', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Dông lốc, mưa đá nhẹ', advice: '⚠️ Cảnh báo dông lốc: Kiểm tra neo giàn và lưới che chắn nhà màng.' },
  99: { icon: 'cloud-lightning', color: '#991b1b', bg: '#fef2f2', border: '#f87171', label: 'Dông lốc nguy hiểm', advice: '⛔ Dông bão mạnh: Tạm dừng toàn bộ hoạt động ngoài đồng ruộng để an toàn.' }
};

let _userCachedForecastData = null;
let _userSelectedHourlyDayMode = 'live24';

export async function fetchLiveOpenMeteoForecast(lat, lng) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,surface_pressure,et0_fao_evapotranspiration,soil_temperature_0cm,soil_temperature_18cm,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,wind_speed_10m,wind_gusts_10m,uv_index,direct_normal_irradiance&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,rain_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,et0_fao_evapotranspiration,shortwave_radiation_sum&forecast_days=7&timezone=auto`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _userCachedForecastData = data;

    const daily = data.daily || {};
    if (!daily.time || !Array.isArray(daily.time)) return null;

    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const forecastList = [];
    const count = Math.min(daily.time.length, 7);

    for (let i = 0; i < count; i++) {
      const dateStr = daily.time[i];
      const d = new Date(dateStr);
      const code = daily.weather_code ? daily.weather_code[i] : 0;
      const tMax = daily.temperature_2m_max ? Math.round(daily.temperature_2m_max[i]) : 32;
      const tMin = daily.temperature_2m_min ? Math.round(daily.temperature_2m_min[i]) : 25;
      const rain = daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : 10;
      const rainSum = daily.precipitation_sum ? daily.precipitation_sum[i] : 0;
      const humidity = daily.relative_humidity_2m_mean ? Math.round(daily.relative_humidity_2m_mean[i]) : 70;
      const wind = daily.wind_speed_10m_max ? Math.round(daily.wind_speed_10m_max[i]) : 12;
      const windGusts = daily.wind_gusts_10m_max ? Math.round(daily.wind_gusts_10m_max[i]) : null;
      const et0 = daily.et0_fao_evapotranspiration ? Math.round(daily.et0_fao_evapotranspiration[i] * 10) / 10 : 4.2;

      const cfg = WMO_FORECAST_CONFIG[code] || WMO_FORECAST_CONFIG[0];
      let advice = cfg.advice;
      if (rain >= 70 || rainSum >= 15) {
        advice = '⚠️ Khả năng mưa rất cao: Tuyệt đối không bón phân hay phun xịt thuốc BVTV vì sẽ bị rửa trôi.';
      } else if (et0 >= 5.0) {
        advice = `☀️ Bốc thoát hơi nước cao (${et0}mm/ngày): Khuyến nghị tưới bù ~${Math.round(et0 * 30 * 0.85)}L/cây và che phủ gốc.`;
      } else if (windGusts && windGusts >= 35) {
        advice = `💨 Cảnh báo gió giật ${windGusts} km/h: Kiểm tra giàn chống cành mang trái non.`;
      }

      forecastList.push({
        date: dateStr,
        day_index: i,
        day_label: i === 0 ? 'Hôm nay' : dayNames[d.getDay()],
        date_str: `${d.getDate()}/${d.getMonth() + 1}`,
        icon: cfg.icon,
        color: cfg.color,
        bg: cfg.bg,
        border: cfg.border,
        temp: `${tMin}°C - ${tMax}°C`,
        rain: `${rain}%`,
        rainSum: rainSum,
        humidity: `${humidity}%`,
        wind: `${wind} km/h`,
        windGusts: windGusts,
        et0: et0,
        advice: advice,
        is_live_meteo: true
      });
    }

    // Render 24-Hour Continuous Timeline for User Portal
    renderUser24HourHourlySection(data.hourly, data.daily, _userSelectedHourlyDayMode);

    return forecastList;
  } catch (err) {
    console.warn('[IoTWeather] Could not fetch live Open-Meteo forecast, using fallback.', err);
    return null;
  }
}
window.fetchLiveOpenMeteoForecast = fetchLiveOpenMeteoForecast;

export function renderUser24HourHourlySection(hourlyData, dailyData, selectedMode = 'live24') {
  if (!hourlyData || !hourlyData.time || !Array.isArray(hourlyData.time)) return;

  _userSelectedHourlyDayMode = selectedMode;
  const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

  // 1. Render Day Selector Pills
  const pillsContainer = document.getElementById('user-iot-hourly-day-pills');
  if (pillsContainer && dailyData && dailyData.time) {
    let pillsHtml = `
      <button type="button" class="btn btn-sm ${selectedMode === 'live24' ? 'active' : ''}" onclick="selectUserHourlyForecastDay('live24')" style="padding:3px 9px; font-size:11px; font-weight:800; border-radius:6px; white-space:nowrap; cursor:pointer; ${selectedMode === 'live24' ? 'background:#059669; color:#fff; border:1px solid #059669;' : 'background:#ffffff; color:#475569; border:1px solid #cbd5e1;'}">
        <i data-lucide="clock" class="lucide-xs"></i> 24h Tiếp theo (Live)
      </button>
    `;

    const dayCount = Math.min(dailyData.time.length, 7);
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(dailyData.time[i]);
      let dayName = i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : daysOfWeek[d.getDay()];
      const isAct = selectedMode === `day_${i}`;
      pillsHtml += `
        <button type="button" class="btn btn-sm ${isAct ? 'active' : ''}" onclick="selectUserHourlyForecastDay('day_${i}')" style="padding:3px 9px; font-size:11px; font-weight:700; border-radius:6px; white-space:nowrap; cursor:pointer; ${isAct ? 'background:#059669; color:#fff; border:1px solid #059669;' : 'background:#ffffff; color:#475569; border:1px solid #cbd5e1;'}">
          ${dayName} (${d.getDate()}/${d.getMonth() + 1})
        </button>
      `;
    }
    pillsContainer.innerHTML = pillsHtml;
  }

  // 2. Determine 24-hour Slice Range
  let startIdx = 0;
  let viewTitleStr = '';

  if (selectedMode === 'live24') {
    const nowIso = new Date().toISOString().slice(0, 13);
    let curIdx = hourlyData.time.findIndex(t => t.startsWith(nowIso));
    if (curIdx === -1) curIdx = 0;
    // Start from next hour forward (e.g. 4 PM -> 5 PM)
    startIdx = curIdx + 1;
    if (startIdx >= hourlyData.time.length) startIdx = curIdx;

    const startObj = new Date(hourlyData.time[startIdx]);
    const endObj = new Date(hourlyData.time[Math.min(startIdx + 23, hourlyData.time.length - 1)]);
    viewTitleStr = `Dự báo 24 giờ liên tục từ ${startObj.getHours()}:00 ${startObj.getDate()}/${startObj.getMonth() + 1} đến ${endObj.getHours()}:00 ${endObj.getDate()}/${endObj.getMonth() + 1}`;
  } else {
    const dayIdx = parseInt(selectedMode.replace('day_', ''), 10) || 0;
    startIdx = dayIdx * 24;
    if (startIdx >= hourlyData.time.length) startIdx = 0;
    const targetDate = new Date(hourlyData.time[startIdx]);
    let dayLabel = dayIdx === 0 ? 'Hôm nay' : dayIdx === 1 ? 'Ngày mai' : daysOfWeek[targetDate.getDay()];
    viewTitleStr = `Dự báo trọn vẹn 24 khung giờ của ${dayLabel} (${targetDate.toLocaleDateString('vi-VN')}) (00:00 - 23:00)`;
  }

  const titleEl = document.getElementById('user-iot-hourly-title');
  if (titleEl) titleEl.textContent = viewTitleStr;

  const endIdx = Math.min(startIdx + 24, hourlyData.time.length);
  const sliceTimes = hourlyData.time.slice(startIdx, endIdx);
  const sliceTemps = hourlyData.temperature_2m ? hourlyData.temperature_2m.slice(startIdx, endIdx) : [];
  const sliceRainProbs = hourlyData.precipitation_probability ? hourlyData.precipitation_probability.slice(startIdx, endIdx) : [];
  const sliceRainSums = hourlyData.precipitation ? hourlyData.precipitation.slice(startIdx, endIdx) : [];
  const sliceWmoCodes = hourlyData.weather_code ? hourlyData.weather_code.slice(startIdx, endIdx) : [];
  const sliceWinds = hourlyData.wind_speed_10m ? hourlyData.wind_speed_10m.slice(startIdx, endIdx) : [];
  const sliceWindGusts = hourlyData.wind_gusts_10m ? hourlyData.wind_gusts_10m.slice(startIdx, endIdx) : [];
  const sliceEt0s = hourlyData.et0_fao_evapotranspiration ? hourlyData.et0_fao_evapotranspiration.slice(startIdx, endIdx) : [];

  // 3. Render Scrollable 24-Hour Hourly Cards Track
  const track = document.getElementById('user-iot-24h-hourly-track');
  if (track) {
    let cardsHtml = '';
    const firstDateDay = sliceTimes.length > 0 ? new Date(sliceTimes[0]).getDate() : null;

    for (let i = 0; i < sliceTimes.length; i++) {
      const dObj = new Date(sliceTimes[i]);
      const hourNum = dObj.getHours();
      const hourLabel = (hourNum < 10 ? '0' : '') + hourNum + ':00';
      const isNextDay = firstDateDay !== null && dObj.getDate() !== firstDateDay;

      const code = sliceWmoCodes[i] !== undefined ? sliceWmoCodes[i] : 0;
      const cfg = WMO_FORECAST_CONFIG[code] || WMO_FORECAST_CONFIG[0];
      const temp = sliceTemps[i] !== undefined ? Math.round(sliceTemps[i]) : '--';
      const rainP = sliceRainProbs[i] !== undefined ? sliceRainProbs[i] : 0;
      const rainM = sliceRainSums[i] !== undefined ? sliceRainSums[i] : 0;
      const wind = sliceWinds[i] !== undefined ? Math.round(sliceWinds[i]) : 0;
      const gusts = sliceWindGusts[i] !== undefined ? Math.round(sliceWindGusts[i]) : null;
      const et0 = sliceEt0s[i] !== undefined ? (Math.round(sliceEt0s[i] * 10) / 10) : null;

      // Spray Safety Assessment
      let sprayBadge = '<span style="font-size:9.5px; font-weight:800; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:2px 5px; border-radius:6px; display:inline-block;">🟢 Phun tốt</span>';
      if (rainP >= 50 || wind >= 25 || (gusts && gusts >= 35)) {
        sprayBadge = '<span style="font-size:9.5px; font-weight:800; background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; padding:2px 5px; border-radius:6px; display:inline-block;">🔴 Không phun</span>';
      } else if (rainP >= 25 || wind >= 15) {
        sprayBadge = '<span style="font-size:9.5px; font-weight:800; background:#fffbeb; color:#b45309; border:1px solid #fde68a; padding:2px 5px; border-radius:6px; display:inline-block;">🟡 Thận trọng</span>';
      }

      cardsHtml += `
        <div style="min-width:130px; max-width:134px; background:#ffffff; border:1.5px solid ${i === 0 ? '#059669' : '#e2e8f0'}; border-radius:12px; padding:9px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 1px 3px rgba(0,0,0,0.02); flex-shrink:0;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
              <span style="font-size:12px; font-weight:900; color:#0f172a; background:#f1f5f9; padding:2px 5px; border-radius:6px;">${hourLabel}</span>
              ${isNextDay ? '<span style="font-size:9px; font-weight:800; color:#059669; background:#ecfdf5; padding:1px 3px; border-radius:4px;">+1d</span>' : ''}
            </div>

            <div style="text-align:center; padding:5px 0 3px;">
              <i data-lucide="${cfg.icon}" style="width:24px; height:24px; color:${cfg.color}; margin-bottom:2px; display:inline-block;"></i>
              <div style="font-size:16px; font-weight:900; color:#0f172a;">${temp}°C</div>
            </div>

            <div style="font-size:10.5px; color:#475569; display:flex; flex-direction:column; gap:2px; background:#f8fafc; padding:5px 6px; border-radius:6px; margin:3px 0 5px;">
              <div style="display:flex; align-items:center; justify-content:space-between;">
                <span style="color:#0284c7;"><i data-lucide="cloud-rain" class="lucide-xs"></i> Mưa:</span>
                <strong>${rainP}%${rainM > 0 ? ` (${rainM}mm)` : ''}</strong>
              </div>
              <div style="display:flex; align-items:center; justify-content:space-between;">
                <span style="color:#64748b;"><i data-lucide="wind" class="lucide-xs"></i> Gió:</span>
                <strong>${wind}km/h</strong>
              </div>
              ${et0 !== null ? `
              <div style="display:flex; align-items:center; justify-content:space-between;">
                <span style="color:#16a34a;"><i data-lucide="sprout" class="lucide-xs"></i> ET₀:</span>
                <strong style="color:#15803d;">${et0}mm</strong>
              </div>` : ''}
            </div>
          </div>

          <div style="text-align:center;">
            ${sprayBadge}
          </div>
        </div>
      `;
    }
    track.innerHTML = cardsHtml;
  }

  if (window.lucide) {
    try { lucide.createIcons(); } catch (_) {}
  }
}
window.renderUser24HourHourlySection = renderUser24HourHourlySection;

export function selectUserHourlyForecastDay(dayMode) {
  _userSelectedHourlyDayMode = dayMode;
  if (_userCachedForecastData && _userCachedForecastData.hourly && _userCachedForecastData.daily) {
    renderUser24HourHourlySection(_userCachedForecastData.hourly, _userCachedForecastData.daily, dayMode);
  }
}
window.selectUserHourlyForecastDay = selectUserHourlyForecastDay;

export async function renderIoTDemoData(farmId, forceRefresh = false) {
  if (!farmId) return;
  try {
    const endpoint = forceRefresh ? `/farms/${farmId}/iot-data/refresh` : `/farms/${farmId}/iot-data`;
    const method = forceRefresh ? 'POST' : 'GET';
    const res = await api(endpoint, { method });
    if (res && res.success) {
      _currentFarmIoTData = res;
      _applyIoTDemoDataToUI(res);

      // Asynchronously fetch 100% real-time Open-Meteo 7-day & 24h weather forecast based on farm GPS coordinates
      const farmObj = (_farmsCache && _farmsCache.length) ? _farmsCache.find(f => String(f.id) === String(farmId)) : null;
      let lat = null;
      let lng = null;
      if (farmObj) {
        if (farmObj.latitude && farmObj.longitude) {
          lat = parseFloat(farmObj.latitude);
          lng = parseFloat(farmObj.longitude);
        } else if (farmObj.polygon_coordinates) {
          const validPts = sanitizeCoordinates(farmObj.polygon_coordinates);
          if (validPts.length > 0) {
            let sumLat = 0, sumLng = 0;
            validPts.forEach(pt => { sumLng += pt[0]; sumLat += pt[1]; });
            lat = sumLat / validPts.length;
            lng = sumLng / validPts.length;
          }
        }
      }
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        lat = 10.9415; // Default Long Khánh / Mekong Delta
        lng = 107.2418;
      }

      fetchLiveOpenMeteoForecast(lat, lng).then(liveForecast => {
        if (liveForecast && liveForecast.length > 0) {
          _renderForecastGrid(liveForecast);
          const badge = document.getElementById('iot-weather-source-badge');
          if (badge) {
            badge.innerHTML = `<i data-lucide="satellite" class="lucide-xs" style="color:#059669;"></i> Realtime (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`;
          }
          if (window.lucide) {
            try { lucide.createIcons(); } catch (_) {}
          }
        }
      });
    }
  } catch (err) {
    console.warn('Lỗi tải dữ liệu IoT từ Database:', err);
  }
}
window.renderIoTDemoData = renderIoTDemoData;

function _renderForecastGrid(forecast) {
  const grid = document.getElementById('iot-weather-forecast-grid');
  if (!grid || !forecast || !forecast.length) return;

  grid.innerHTML = forecast.map((w, idx) => {
    let iconName = w.icon || 'sun';
    if (iconName.startsWith('fa-')) {
      if (iconName.includes('sun-rain')) iconName = 'cloud-sun-rain';
      else if (iconName.includes('cloud-sun')) iconName = 'cloud-sun';
      else if (iconName.includes('sun')) iconName = 'sun';
      else if (iconName.includes('showers') || iconName.includes('rain')) iconName = 'cloud-rain';
      else if (iconName.includes('bolt') || iconName.includes('lightning')) iconName = 'cloud-lightning';
      else if (iconName.includes('cloud')) iconName = 'cloud';
      else iconName = 'sun';
    }
    const isAct = _userSelectedHourlyDayMode === `day_${idx}`;
    return `
      <div onclick="selectUserHourlyForecastDay('day_${idx}')" style="background:${isAct ? '#ecfdf5' : (w.bg || '#fff7ed')}; border:1.5px solid ${isAct ? '#059669' : (w.border || '#ffedd5')}; border-radius:14px; padding:14px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:${isAct ? '0 2px 8px rgba(5,150,105,0.15)' : '0 2px 8px rgba(0,0,0,0.02)'}; cursor:pointer;" title="Nhấp để xem 24 khung giờ chi tiết của ${w.day_label}">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:13.5px; color:#0f172a;">${w.day_label || 'Hôm nay'}</strong>
            <span style="font-size:11px; color:#64748b; font-weight:700;">${w.date_str || ''}</span>
          </div>
          <div style="text-align:center; padding:8px 0;">
            <i data-lucide="${iconName}" style="width:34px; height:34px; stroke-width:2.2; color:${w.color || '#f59e0b'}; margin-bottom:4px; display:inline-block;"></i>
            <div style="font-size:16px; font-weight:900; color:#0f172a;">${w.temp || '25°C - 33°C'}</div>
          </div>
          <div style="font-size:11px; color:#475569; display:flex; flex-direction:column; gap:5px; margin-bottom:10px; background:rgba(255,255,255,0.75); padding:8px 10px; border-radius:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="cloud-rain" class="lucide-xs" style="color:#0284c7;"></i> Mưa:</span>
              <strong>${w.rain || '10%'}${w.rainSum > 0 ? ` (${w.rainSum}mm)` : ''}</strong>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="sprout" class="lucide-xs" style="color:#16a34a;"></i> Bốc hơi ET₀:</span>
              <strong style="color:#15803d;">${w.et0 ? w.et0 + ' mm' : '--'}</strong>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="wind" class="lucide-xs" style="color:#64748b;"></i> Gió:</span>
              <strong>${w.wind || '12 km/h'}${w.windGusts ? ` (${w.windGusts})` : ''}</strong>
            </div>
          </div>
        </div>
        <div style="font-size:11px; color:#334155; font-weight:700; line-height:1.4; border-top:1px dashed ${w.border || '#ffedd5'}; padding-top:8px; display:flex; justify-content:space-between; align-items:center;">
          <span>${w.advice || ''}</span>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) {
    try { lucide.createIcons(); } catch (_) {}
  }
}
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

  // Initial render of 6-Day Weather Forecast from DB cache
  _renderForecastGrid(forecast);

  if (window.lucide) {
    try { lucide.createIcons(); } catch (_) {}
  }
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

/// ── Farmer NFC Status & Read-only Tag Tracking ──────────────────────────
let _userInvFarmId = null;
let _userNfcInventoryCache = [];

function getActiveUserFarmId() {
  if (_activeFarmId) return _activeFarmId;
  if (_farmsCache && _farmsCache.length > 0) return _farmsCache[0].id;
  const sel = document.getElementById('user-plant-filter-farm');
  if (sel && sel.value) return parseInt(sel.value);
  return null;
}

/**
 * Fetch and update the 3 NFC metric badges on the Farmer Farm Detail header
 */
export async function fetchFarmerNfcStats(farmId) {
  if (!farmId) return;
  try {
    const res = await api(`/plants/farms/${farmId}/nfc-inventory`);
    const total = res.stats?.total || 0;
    const assigned = res.stats?.assigned || 0;
    const unassigned = res.stats?.unassigned || 0;

    const totalEl = document.getElementById('farmer-nfc-total');
    const assignedEl = document.getElementById('farmer-nfc-assigned');
    const unassignedEl = document.getElementById('farmer-nfc-unassigned');

    if (totalEl) animateValue(totalEl, 0, total, 600);
    if (assignedEl) animateValue(assignedEl, 0, assigned, 600);
    if (unassignedEl) animateValue(unassignedEl, 0, unassigned, 600);
  } catch (err) {
    console.warn('[NFC] Error fetching farmer NFC stats:', err.message);
  }
}
window.fetchFarmerNfcStats = fetchFarmerNfcStats;

/**
 * Open Farmer NFC Read-Only Inventory Modal
 */
export async function openFarmerNfcListModal(farmId = null) {
  const targetFarmId = farmId || getActiveUserFarmId();
  if (!targetFarmId) {
    alert('Vui lòng chọn một Trang trại để xem danh sách thẻ NFC!');
    return;
  }
  _userInvFarmId = targetFarmId;

  const farmObj = (_farmsCache || []).find(f => f.id == targetFarmId);
  const farmNameEl = document.getElementById('nfc-inv-farm-name');
  if (farmNameEl) farmNameEl.textContent = farmObj ? farmObj.name : `Trang trại #${targetFarmId}`;

  const modal = document.getElementById('nfc-inventory-modal');
  if (modal) modal.style.display = 'flex';

  await loadUserNfcInventoryData(targetFarmId);
}
window.openFarmerNfcListModal = openFarmerNfcListModal;
window.openNfcInventoryModal = openFarmerNfcListModal;

export function closeNfcInventoryModal() {
  const modal = document.getElementById('nfc-inventory-modal');
  if (modal) modal.style.display = 'none';
}
window.closeNfcInventoryModal = closeNfcInventoryModal;

export async function loadUserNfcInventoryData(farmId) {
  try {
    const res = await api(`/plants/farms/${farmId}/nfc-inventory`);
    _userNfcInventoryCache = res.tags || res.items || [];

    const total = res.stats?.total ?? _userNfcInventoryCache.length;
    const assigned = res.stats?.assigned ?? _userNfcInventoryCache.filter(t => t.status === 'assigned').length;
    const unassigned = res.stats?.unassigned ?? _userNfcInventoryCache.filter(t => t.status !== 'assigned').length;

    const totalEl = document.getElementById('nfc-inv-total-count');
    const assignedEl = document.getElementById('nfc-inv-assigned-count');
    const unassignedEl = document.getElementById('nfc-inv-unassigned-count');

    if (totalEl) totalEl.textContent = total;
    if (assignedEl) assignedEl.textContent = assigned;
    if (unassignedEl) unassignedEl.textContent = unassigned;

    // Also sync the header strip if visible
    const farmerTotalEl = document.getElementById('farmer-nfc-total');
    const farmerAssignedEl = document.getElementById('farmer-nfc-assigned');
    const farmerUnassignedEl = document.getElementById('farmer-nfc-unassigned');
    if (farmerTotalEl) farmerTotalEl.textContent = total;
    if (farmerAssignedEl) farmerAssignedEl.textContent = assigned;
    if (farmerUnassignedEl) farmerUnassignedEl.textContent = unassigned;

    renderUserNfcInventoryTable(_userNfcInventoryCache);
  } catch (err) {
    if (window.toast) window.toast('Lỗi tải danh sách thẻ: ' + err.message, 'error');
  }
}
window.loadUserNfcInventoryData = loadUserNfcInventoryData;

function renderUserNfcInventoryTable(tags) {
  const tbody = document.getElementById('nfc-inventory-table-body');
  if (!tbody) return;

  if (!tags || tags.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:38px 20px; color:#94a3b8;">
          <i data-lucide="cpu" class="lucide-sm" style="font-size:32px; margin-bottom:10px; display:inline-block; color:#cbd5e1;"></i>
          <p style="margin:0 0 6px 0; font-weight:800; font-size:14px; color:#475569;">Trang trại này hiện chưa có thẻ NFC nào.</p>
          <small style="color:#94a3b8;">Ban Quản Trị / Kỹ Thuật Viên sẽ cấp và phân bổ thẻ NFC vào kho trang trại của bạn.</small>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = tags.map((t, idx) => {
    const isAssigned = t.status === 'assigned';
    const statusPill = isAssigned
      ? `<span style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:11.5px; font-weight:800; padding:4px 10px; border-radius:12px; display:inline-flex; align-items:center; gap:5px;"><i data-lucide="link" class="lucide-sm"></i> Đã gán cây</span>`
      : `<span style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-size:11.5px; font-weight:800; padding:4px 10px; border-radius:12px; display:inline-flex; align-items:center; gap:5px;"><i data-lucide="check" class="lucide-sm"></i> Sẵn sàng gán</span>`;

    let plantInfo = `<span style="color:#94a3b8; font-style:italic; display:inline-flex; align-items:center; gap:5px;"><i data-lucide="clock" class="lucide-sm"></i> — Sẵn sàng gán —</span>`;
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
            <strong style="color:#0f172a; font-size:13px;">🌳 ${esc(treeCodeText)}</strong> 
            <span style="font-size:11.5px; color:#64748b; font-weight:600;">${esc(plantTypeDesc)}</span>
          </div>
          ${hasGps ? `
            <div style="display:inline-flex; align-items:center; gap:4px; font-size:11px; color:#047857; font-weight:700;">
              <i data-lucide="map-pin" class="lucide-sm" style="color:#059669;"></i> ${gpsLat}, ${gpsLng}
              <a href="https://www.google.com/maps?q=${gpsLat},${gpsLng}" target="_blank" title="Mở bản đồ Google Maps" style="color:#2563eb; text-decoration:none; margin-left:3px;">
                <i data-lucide="external-link" class="lucide-sm"></i> Bản đồ
              </a>
            </div>
          ` : `
            <span style="color:#d97706; font-size:11px;"><i data-lucide="alert-circle" class="lucide-sm"></i> Chưa lấy tọa độ GPS</span>
          `}
          ${locationText ? `
            <div style="color:#64748b; font-size:11px;">
              <i data-lucide="tag" class="lucide-sm"></i> ${esc(locationText)}
            </div>
          ` : ''}
        </div>
      `;
    }

    const timeStr = t.scanned_at ? new Date(t.scanned_at).toLocaleString('vi-VN') : '—';

    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:12px 14px; text-align:center; font-weight:800; color:#64748b;">${idx + 1}</td>
        <td style="padding:12px 14px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <code style="font-size:13px; font-weight:800; color:#065f46; background:#ecfdf5; border:1px solid #a7f3d0; padding:4px 10px; border-radius:6px; font-family:monospace;">${esc(t.nfc_uid)}</code>
            <button type="button" onclick="navigator.clipboard.writeText('${esc(t.nfc_uid)}'); if(window.toast) window.toast('Đã copy mã UID: ${esc(t.nfc_uid)}');" title="Sao chép UID" style="border:none; background:transparent; color:#64748b; cursor:pointer; font-size:13px; padding:2px 4px;">
              <i data-lucide="copy" class="lucide-sm"></i>
            </button>
          </div>
        </td>
        <td style="padding:12px 14px; text-align:center;">${statusPill}</td>
        <td style="padding:12px 14px;">${plantInfo}</td>
        <td style="padding:12px 14px; font-size:12.5px; color:#64748b; font-weight:600;">${timeStr}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Export Farmer NFC Tags list to CSV with UTF-8 BOM
 */
export async function exportFarmerNfcCsv() {
  try {
    const farmId = _userInvFarmId || getActiveUserFarmId();
    if (!farmId) {
      if (window.toast) window.toast('Chưa xác định trang trại!', 'error');
      return;
    }

    let tags = _userNfcInventoryCache;
    if (!tags || tags.length === 0) {
      const res = await api(`/plants/farms/${farmId}/nfc-inventory`);
      tags = res.tags || res.items || [];
    }

    if (!tags || tags.length === 0) {
      if (window.toast) window.toast('Trang trại hiện chưa có thẻ NFC nào để xuất!', 'error');
      return;
    }

    const farmObj = (_farmsCache || []).find(f => f.id == farmId);
    const farmName = farmObj ? farmObj.name : `TrangTrai_${farmId}`;
    const cleanFarmName = farmName.replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_').replace(/_+/g, '_');

    const headers = [
      'STT',
      'Mã Thẻ NFC (UID)',
      'Trạng Thái',
      'Cây Gán Thực Địa',
      'Loại Cây / Giống',
      'Vị Trí',
      'Vĩ Độ (Lat)',
      'Kinh Độ (Lng)',
      'Thời Gian Cấp'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    const csvRows = [headers.map(escapeCsv).join(',')];
    tags.forEach((t, idx) => {
      const isAssigned = t.status === 'assigned';
      const statusText = isAssigned ? 'Đã gán cây' : 'Chưa gán';
      const treeText = (isAssigned && (t.tree_code || t.plant_id)) ? (t.tree_code ? `Cây #${t.tree_code}` : `Cây #${t.plant_id}`) : '—';
      const plantTypeDesc = t.plant_variety ? `${t.plant_type || 'Cây'} (${t.plant_variety})` : (t.plant_type || '');
      const locationText = t.location || (t.plant_data && (t.plant_data.tag_position || t.plant_data.location)) || '';
      const hasGps = t.latitude != null && t.longitude != null && !isNaN(Number(t.latitude)) && !isNaN(Number(t.longitude)) && (Number(t.latitude) !== 0 || Number(t.longitude) !== 0);
      const latStr = hasGps ? Number(t.latitude).toFixed(6) : '';
      const lngStr = hasGps ? Number(t.longitude).toFixed(6) : '';
      const timeStr = t.scanned_at ? new Date(t.scanned_at).toLocaleString('vi-VN') : '';

      csvRows.push([
        idx + 1,
        t.nfc_uid || '',
        statusText,
        treeText,
        plantTypeDesc,
        locationText,
        latStr,
        lngStr,
        timeStr
      ].map(escapeCsv).join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    link.setAttribute('href', url);
    link.setAttribute('download', `Danh_Sach_The_NFC_${cleanFarmName}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (window.toast) window.toast(`📥 Đã xuất danh sách ${tags.length} thẻ NFC thành công!`, 'success');
  } catch (err) {
    console.error('Error exporting farmer NFC CSV:', err);
    if (window.toast) window.toast('Lỗi xuất file: ' + err.message, 'error');
  }
}
window.exportFarmerNfcCsv = exportFarmerNfcCsv;

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
    if (treeDisplay) treeDisplay.innerHTML = '<span style="color:#ef4444; font-size:14px; font-weight:700;">Trang trại chưa có cây nào. Hãy tạo cây trước!</span>';
    return;
  }

  const p = _userFieldTagPlants[_userFieldTagIndex];
  if (!p) return;

  const total = _userFieldTagPlants.length;
  const currentNum = _userFieldTagIndex + 1;
  const assignedCount = _userFieldTagPlants.filter(item => item.nfc_uid).length;

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
    prevBtn.disabled = _userFieldTagIndex === 0;
    prevBtn.style.opacity = _userFieldTagIndex === 0 ? '0.4' : '1';
    prevBtn.style.cursor = _userFieldTagIndex === 0 ? 'not-allowed' : 'pointer';
  }
  if (nextBtn) {
    nextBtn.disabled = _userFieldTagIndex >= total - 1;
    nextBtn.style.opacity = _userFieldTagIndex >= total - 1 ? '0.4' : '1';
    nextBtn.style.cursor = _userFieldTagIndex >= total - 1 ? 'not-allowed' : 'pointer';
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

  const pubUrl = p.public_url || `https://plant-book.onrender.com/${p.farm_id || _userFieldTagFarmId}/${p.id}${p.nfc_uid ? '/' + encodeURIComponent(p.nfc_uid) : ''}`;
  if (urlPreviewEl) {
    if (p.nfc_uid) {
      urlPreviewEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px;">
          <a href="${pubUrl}" target="_blank" style="color:#4f46e5; text-decoration:none; font-weight:700; font-size:11.5px; display:inline-flex; align-items:center; gap:4px; background:#eef2ff; padding:3px 8px; border-radius:6px; border:1px solid #c7d2fe;" title="Mở trang nhật ký công khai">
            <i data-lucide="external-link" class="lucide-sm"></i> Xem Web Public
          </a>
          <button type="button" onclick="navigator.clipboard.writeText('${pubUrl}'); if(window.toast) toast('Đã sao chép link công khai!'); else alert('Đã sao chép link!');" style="background:#f8fafc; border:1px solid #cbd5e1; color:#475569; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;" title="Sao chép link">
            <i data-lucide="copy" class="lucide-sm"></i>
          </button>
        </div>
      `;
    } else {
      urlPreviewEl.innerHTML = `<span style="color:#94a3b8; font-size:11px;">Sẵn sàng gán URL NDEF</span>`;
    }
  }

  const nextPlant = _userFieldTagPlants[_userFieldTagIndex + 1];
  if (nextCodeEl) nextCodeEl.textContent = nextPlant ? (nextPlant.tree_code || nextPlant.id) : 'Hết vườn';
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

export function jumpToFieldTreeByCode() {
  const jumpInput = document.getElementById('field-tag-jump-code');
  if (!jumpInput || !_userFieldTagPlants || _userFieldTagPlants.length === 0) return;
  const targetCode = parseInt(jumpInput.value.trim());
  if (isNaN(targetCode)) return;

  const idx = _userFieldTagPlants.findIndex(p => (parseInt(p.tree_code || p.id) === targetCode || p.id === targetCode));
  if (idx !== -1) {
    _userFieldTagIndex = idx;
    renderUserCurrentFieldTree();
    refreshFieldGps();
    jumpInput.value = '';
  } else {
    if (window.toast) toast(`Không tìm thấy cây số #${targetCode} trong trang trại này!`, 'warning');
    else alert(`Không tìm thấy cây số #${targetCode} trong trang trại này!`);
  }
}
window.jumpToFieldTreeByCode = jumpToFieldTreeByCode;

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
    alert('Trình duyệt này không hỗ trợ Web NFC trực tiếp.\n\n Vui lòng nhập mã UID thủ công vào ô bên dưới!');
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

// ─── Spatial Tree Reordering by GPS Modal Logic ──────────────────────────────
let _reorderGpsPreviewData = null;

export function openReorderGpsModal(farmId) {
  const modal = document.getElementById('reorder-gps-modal');
  if (!modal) return;

  const farmSelect = document.getElementById('reorder-gps-farm-select');
  if (farmSelect) {
    const farms = _farmsCache && _farmsCache.length ? _farmsCache : [];
    if (!farms.length) {
      if (window.toast) window.toast('Bạn chưa có trang trại nào.', 'warning');
      return;
    }
    const currentActiveFarm = getActiveFarm();
    const targetFarmId = farmId || (currentActiveFarm ? currentActiveFarm.id : farms[0].id);

    farmSelect.innerHTML = farms.map(f => 
      `<option value="${f.id}" ${Number(f.id) === Number(targetFarmId) ? 'selected' : ''}> ${esc(f.name)} (${f.plant_count || 0} cây)</option>`
    ).join('');
  }

  modal.classList.add('open');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  previewReorderGps();
}
window.openReorderGpsModal = openReorderGpsModal;

export function closeReorderGpsModal() {
  const modal = document.getElementById('reorder-gps-modal');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
  document.body.style.overflow = '';
}
window.closeReorderGpsModal = closeReorderGpsModal;

export async function previewReorderGps() {
  const farmSelect = document.getElementById('reorder-gps-farm-select');
  const farmId = farmSelect ? farmSelect.value : null;
  if (!farmId) return;

  const orderMode = document.querySelector('input[name="reorder_mode"]:checked')?.value || 'north_to_south';
  const prefix = document.getElementById('reorder-gps-prefix')?.value || '';
  const startNum = parseInt(document.getElementById('reorder-gps-start-num')?.value, 10) || 1;
  const padDigits = parseInt(document.getElementById('reorder-gps-pad-digits')?.value, 10) || 0;

  const tbody = document.getElementById('reorder-gps-preview-tbody');
  const countEl = document.getElementById('reorder-gps-preview-count');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:18px; color:#64748b;"><i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang tính toán không gian và hướng tọa độ...</td></tr>`;
  }

  try {
    const res = await api(`/plants/farms/${farmId}/reorder-by-gps`, {
      method: 'POST',
      body: JSON.stringify({
        order_mode: orderMode,
        prefix,
        start_number: startNum,
        pad_digits: padDigits,
        dry_run: true
      })
    });

    _reorderGpsPreviewData = res;
    if (countEl) countEl.textContent = `${res.reordered_count} / ${res.total_plants} cây`;

    if (tbody) {
      if (!res.reordered_list || !res.reordered_list.length) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:18px; color:#ef4444;">Không tìm thấy cây có tọa độ GPS để sắp xếp.</td></tr>`;
        return;
      }

      tbody.innerHTML = res.reordered_list.map((item, idx) => `
        <tr style="border-bottom:1px solid #f1f5f9; ${idx % 2 === 1 ? 'background:#f8fafc;' : ''}">
          <td style="padding:7px 10px; text-align:center; font-weight:700; color:#64748b;">${idx + 1}</td>
          <td style="padding:7px 10px;">
            <span style="color:#94a3b8; text-decoration:line-through; font-size:11px;">#${esc(item.old_tree_code)}</span>
            <i data-lucide="arrow-right" class="lucide-sm" style="font-size:10px; color:#10b981; margin:0 4px;"></i>
            <strong style="color:#047857; font-size:13px;">#${esc(item.new_tree_code)}</strong>
          </td>
          <td style="padding:7px 10px; font-family:monospace; font-size:11px; color:#0284c7;">
            ${Number(item.latitude).toFixed(6)}, ${Number(item.longitude).toFixed(6)}
          </td>
          <td style="padding:7px 10px; font-size:11.5px; color:#475569;">
            ${esc(item.location || '—')}
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:18px; color:#dc2626;">Lỗi tải xem trước: ${esc(err.message)}</td></tr>`;
    }
  }
}
window.previewReorderGps = previewReorderGps;

export async function executeReorderGps() {
  const farmSelect = document.getElementById('reorder-gps-farm-select');
  const farmId = farmSelect ? farmSelect.value : null;
  if (!farmId) return;

  const orderMode = document.querySelector('input[name="reorder_mode"]:checked')?.value || 'north_to_south';
  const prefix = document.getElementById('reorder-gps-prefix')?.value || '';
  const startNum = parseInt(document.getElementById('reorder-gps-start-num')?.value, 10) || 1;
  const padDigits = parseInt(document.getElementById('reorder-gps-pad-digits')?.value, 10) || 0;

  const count = _reorderGpsPreviewData ? _reorderGpsPreviewData.reordered_count : 'tất cả';
  if (!confirm(`Bạn có chắc chắn muốn đánh lại toàn bộ mã số cho ${count} cây theo tọa độ GPS?\n\n Lưu ý: Mã cây (tree_code) và đường dẫn công khai sẽ được cập nhật thẳng hàng theo thứ tự vị trí mới.`)) {
    return;
  }

  const btn = document.getElementById('btn-execute-reorder-gps');
  if (btn) {
    btn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang sắp xếp & cập nhật CSDL...';
    btn.disabled = true;
  }

  try {
    const res = await api(`/plants/farms/${farmId}/reorder-by-gps`, {
      method: 'POST',
      body: JSON.stringify({
        order_mode: orderMode,
        prefix,
        start_number: startNum,
        pad_digits: padDigits,
        dry_run: false
      })
    });

    if (window.toast) window.toast(res.message || 'Đã sắp xếp lại mã số cây thành công!', 'success');
    closeReorderGpsModal();

    // Reload plants & map data
    if (window.loadUserDashboard) {
      await window.loadUserDashboard();
    }
  } catch (err) {
    if (window.toast) window.toast('Lỗi sắp xếp mã cây: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.innerHTML = '<i data-lucide="sparkles" class="lucide-sm"></i> Áp dụng &amp; Đánh số lại ngay';
      btn.disabled = false;
    }
  }
}
window.executeReorderGps = executeReorderGps;



