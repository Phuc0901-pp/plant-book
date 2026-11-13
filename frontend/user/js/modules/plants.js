/* Plant Book Agtech (c) 2026 TBSG Agtech. All Rights Reserved. Enterprise Protected Asset */
/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/plants.js — Plant list rendering & search filter
   ═══════════════════════════════════════════════════════════════ */

import { esc, healthBadge, sanitizeCoordinates, formatSmartArea, toast, getCropImageSrc, isGrowthMedia, isDiseaseMedia, formatDate } from '../core/utils.js';
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
        <h4 style="font-size:13px;font-weight:700;color:var(--green-dark);margin-bottom:4px;display:flex;align-items:center;gap:6px;"><i data-lucide="home" class="lucide-xs"></i> ${esc(f.name)}</h4>
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
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i data-lucide="sprout" class="lucide-sm"></i><p>Không có cây trồng nào được giao</p></td></tr>';
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
    ? `<span class="badge-nfc-tag" title="Mã thẻ NFC: ${esc(p.nfc_uid)}" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-family:monospace;font-weight:700;color:#059669;background:#ecfdf5;border:1px solid #a7f3d0;padding:2px 7px;border-radius:6px;"><i data-lucide="tag" class="lucide-xs"></i> ${esc(p.nfc_uid)}</span>`
    : `<span title="Chưa gắn thẻ NFC" style="display:inline-flex;align-items:center;gap:3px;font-size:10.5px;color:#94a3b8;background:#f8fafc;border:1px dashed #cbd5e1;padding:2px 6px;border-radius:6px;"><i data-lucide="unlink" class="lucide-xs"></i> Chưa thẻ</span>`;

  const treeCodeSafe = esc(p.tree_code || String(p.id));
  const plantTypeSafe = esc(p.plant_type || '');
  const plantTypeFormatted = plantTypeSafe.replace(/([^\s])\(/g, '$1 (');
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

  const nfcBtnText = p.nfc_uid ? 'Đổi thẻ NFC' : 'Gán thẻ NFC';
  const nfcBtnClass = p.nfc_uid ? 'btn-erp-plant-action btn-erp-plant-nfc btn-erp-plant-nfc-active' : 'btn-erp-plant-action btn-erp-plant-nfc';
  const nfcBtnTitle = p.nfc_uid ? `Thẻ hiện tại: ${esc(p.nfc_uid)} (Bấm để đổi thẻ hoặc cập nhật GPS)` : 'Gán hoặc định danh thẻ NFC cho cây';

  return `
    <tr id="plant-row-${p.id}" style="transition:all 0.3s ease;">
      <td data-label="Mã cây">
        <div class="plant-code-cell-wrap" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <strong style="font-family:var(--font-mono); font-size:13px; color:#0f172a; font-weight:800;">${treeCodeSafe}</strong>
          ${nfcBadge}
        </div>
      </td>
      <td data-label="Loại & Giống">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:8px;overflow:hidden;border:1px solid #cbd5e1;background:#f8fafc;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
            <img src="${getCropImageSrc(p)}" alt="${esc(p.plant_type || 'Cây')}" style="width:100%;height:100%;object-fit:cover;" onerror="this.onerror=null;this.src='/assets/crop/durian.png';">
          </div>
          <div style="min-width:0;">
            <strong>${plantTypeFormatted}</strong>
            ${p.plant_variety ? `<br><small style="color:var(--gray-400)">${esc(p.plant_variety)}</small>` : ''}
          </div>
        </div>
      </td>
      <td data-label="Tuổi cây">
        <div>
          ${esc(p.plant_age || '—')}
          ${p.planting_date ? `<br><small style="color:var(--text-muted); font-size:11px;"><i data-lucide="calendar" class="lucide-xs"></i> ${esc(p.planting_date)}</small>` : ''}
        </div>
      </td>
      <td data-label="Sức khỏe">
        <div>
          ${healthBadge(p.health_status)}
          ${(p.data?.initial_yield || p.initial_yield) ? `<div style="margin-top:3px;font-size:11px;color:#047857;font-weight:700;"><i data-lucide="trending-up" class="lucide-xs"></i> Vụ trước: ${esc(p.data?.initial_yield || p.initial_yield)}</div>` : ''}
          ${((p.data?.past_diseases && (Array.isArray(p.data.past_diseases) ? p.data.past_diseases.length : p.data.past_diseases)) || (p.past_diseases && p.past_diseases.length)) ? `
            <div style="margin-top:2px;font-size:10.5px;color:#b45309;line-height:1.2;" title="Tiền sử bệnh: ${esc(Array.isArray(p.data?.past_diseases) ? p.data.past_diseases.join(', ') : (p.data?.past_diseases || p.past_diseases))}">
              <i data-lucide="shield-alert" class="lucide-xs"></i> ${esc(Array.isArray(p.data?.past_diseases) ? p.data.past_diseases.slice(0, 2).join(', ') + (p.data.past_diseases.length > 2 ? '...' : '') : String(p.data?.past_diseases || p.past_diseases))}
            </div>` : ''}
        </div>
      </td>
      <td data-label="Vị trí"><div>${esc(p.location || '—')}</div></td>
      <td data-label="URL Công khai"><div>${publicUrlCell}</div></td>
      <td data-label="Thao tác" class="plant-actions-cell">
        <div class="erp-plant-action-btns">
          <button type="button" class="btn-erp-plant-action btn-erp-plant-profile" onclick="openPlantProfileModal(${p.id})" title="Xem hồ sơ nội bộ cây trồng (Bảo toàn GPS)">
            <i data-lucide="file-text" class="lucide-sm"></i> <span>Hồ sơ ERP</span>
          </button>
          <button type="button" class="btn-erp-plant-action btn-erp-plant-care" onclick="openCareModal(${p.id}, '${treeCodeSafe}', '${plantTypeSafe}')" title="Ghi chép hoạt động chăm sóc & canh tác">
            <i data-lucide="file-check" class="lucide-sm"></i> <span>Ghi nhật ký</span>
          </button>
          <button type="button" class="${nfcBtnClass}" onclick="openNfcModal(${p.id}, '${treeCodeSafe}', '${slugSafe}', ${uidVal})" title="${nfcBtnTitle}">
            <i data-lucide="tag" class="lucide-sm"></i> <span>${nfcBtnText}</span>
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

  // Sync Mapbox markers with filtered plant results
  if (typeof window.updateUserMapMarkers === 'function') {
    window.updateUserMapMarkers(filtered, false);
  }
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

  if (!farms || !farms.length) {
    if (gridContainer) {
      gridContainer.innerHTML = `
        <div onclick="openSelfInitFarmModal()" class="user-farm-card-create">
          <div class="user-farm-create-icon">
            <i data-lucide="plus" class="lucide-md"></i>
          </div>
          <div style="font-size:16px; font-weight:800; color:#047857; margin-bottom:4px;">+ Khởi tạo Trang trại mới (GPS)</div>
          <div style="font-size:13px; color:#166534; font-weight:500;">Bấm vào đây để lấy tọa độ thực tế từ GPS thiết bị</div>
        </div>
      `;
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    }
    return;
  }

  if (gridContainer) {
    let html = farms.map(f => {
      const totalPlants = f.plant_count || f.total_plants || 0;
      const rawAreaFormatted = f.area ? Math.round(parseFloat(f.area)).toLocaleString('vi-VN') + ' m²' : '0 m²';
      const smartArea = formatSmartArea(f.area);
      const desc = f.description ? esc(f.description) : 'Chưa cập nhật địa chỉ thực địa';
      const isCustomDesc = !!f.description;

      return `
        <div class="user-farm-card" onclick="openFarmDetailView(${f.id})">
          <div>
            <!-- Header Row -->
            <div class="user-farm-card-head">
              <div class="user-farm-card-title-group">
                <div class="user-farm-card-icon">
                  <i data-lucide="home" class="lucide-md"></i>
                </div>
                <div class="user-farm-card-title-wrap">
                  <h4 class="user-farm-card-name" title="${esc(f.name)}">${esc(f.name)}</h4>
                  <div class="user-farm-card-type-tag">
                    <i data-lucide="satellite" class="lucide-xs"></i>
                    <span>Trang trại số GIS</span>
                  </div>
                </div>
              </div>
              <span class="user-farm-card-owner-badge">Trang trại của tôi</span>
            </div>

            <!-- Location / Address Row -->
            <div class="user-farm-card-location" title="${desc}">
              <i data-lucide="map-pin" class="lucide-xs" style="color:#10b981; flex-shrink:0;"></i>
              <span style="${!isCustomDesc ? 'font-style:italic; opacity:0.8;' : ''}">${desc}</span>
            </div>

            <!-- Metrics 2-column Grid -->
            <div class="user-farm-card-metrics">
              <div class="user-farm-metric-item">
                <div class="user-farm-metric-label">
                  <i data-lucide="sprout" class="lucide-xs" style="color:#059669;"></i> Tổng Cây
                </div>
                <div class="user-farm-metric-val plants">${totalPlants.toLocaleString('vi-VN')} <span style="font-size:12px; font-weight:600; color:#64748b;">cây</span></div>
              </div>
              <div class="user-farm-metric-item">
                <div class="user-farm-metric-label">
                  <i data-lucide="maximize" class="lucide-xs" style="color:#0284c7;"></i> Diện Tích
                </div>
                <div class="user-farm-metric-val area" title="Tổng diện tích: ${rawAreaFormatted}">${smartArea}</div>
              </div>
            </div>

            <!-- Certifications & PUC Badges -->
            <div class="user-farm-card-certs">
              ${f.vietgap_cert_number 
                ? `<span class="user-farm-cert-tag vietgap-active" title="Mã chứng nhận VietGAP"><i data-lucide="shield-check" class="lucide-xs"></i> VietGAP: ${esc(f.vietgap_cert_number)}</span>` 
                : `<span class="user-farm-cert-tag muted"><i data-lucide="shield" class="lucide-xs"></i> VietGAP: Chưa cấp</span>`}
              ${f.puc_code 
                ? `<span class="user-farm-cert-tag puc-active" title="Mã số vùng trồng PUC"><i data-lucide="globe" class="lucide-xs"></i> PUC: ${esc(f.puc_code)}</span>` 
                : `<span class="user-farm-cert-tag muted"><i data-lucide="globe" class="lucide-xs"></i> PUC: Chưa cấp</span>`}
            </div>
          </div>

          <!-- Actions Bar (Fixed to bottom) -->
          <div class="user-farm-card-actions">
            <button type="button" onclick="openFarmDetailView(${f.id})" class="user-farm-btn-main" title="Mở buồng điều khiển bản đồ GIS và quản lý cây trồng">
              <i data-lucide="map" class="lucide-sm"></i> <span>Xem Bản đồ & Chi tiết</span>
            </button>
            <button type="button" onclick="event.stopPropagation(); openEditFarmModal(${f.id})" class="user-farm-btn-sub" title="Chỉnh sửa thông tin trang trại">
              <i data-lucide="edit-3" class="lucide-sm" style="color:#059669;"></i> <span>Sửa</span>
            </button>
            <button type="button" onclick="event.stopPropagation(); deleteUserFarm(${f.id}, '${esc(f.name)}')" class="user-farm-btn-delete" title="Xóa hoặc ẩn trang trại này">
              <i data-lucide="trash-2" class="lucide-sm"></i> <span>Xóa</span>
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
        <div onclick="openSelfInitFarmModal()" class="user-farm-card-create">
          <div class="user-farm-create-icon">
            <i data-lucide="plus" class="lucide-md"></i>
          </div>
          <div style="font-size:15px; font-weight:800; color:#047857; margin-bottom:4px;">+ Khởi tạo Trang trại mới (GPS)</div>
          <div style="font-size:12.5px; color:#166534; font-weight:500;">Bấm để định vị GPS thêm trang trại</div>
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

    // Resize map when switching back to map tab & refresh plant markers
    setTimeout(() => {
      if (window.userMap) {
        try { window.userMap.resize(); } catch (_) {}
      }
      if (typeof window.updateUserMapMarkers === 'function') {
        const farmPlants = _activeFarmId ? (_plantsCache || []).filter(p => String(p.farm_id) === String(_activeFarmId)) : _plantsCache;
        window.updateUserMapMarkers(farmPlants, false);
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

// [Modularized] IoT & Open-Meteo weather moved to plants-iot-weather.js
export function getActiveFarmId() { return _activeFarmId; }
export { selectSoilDepth, refreshIoTDemoData, fetchLiveOpenMeteoForecast, renderUser24HourHourlySection, selectUserHourlyForecastDay, renderIoTDemoData } from './plants-iot-weather.js';
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
            <strong style="color:#0f172a; font-size:13px; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="sprout" class="lucide-xs" style="color:#059669;"></i> ${esc(treeCodeText)}</strong> 
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
    statusPillEl.style.display = 'inline-flex';
    statusPillEl.style.alignItems = 'center';
    statusPillEl.style.gap = '4px';
    if (p.nfc_uid) {
      statusPillEl.innerHTML = '<i data-lucide="check-circle-2" class="lucide-xs"></i> ĐÃ GÁN THẺ';
      statusPillEl.style.background = '#ecfdf5';
      statusPillEl.style.color = '#047857';
      statusPillEl.style.border = '1px solid #a7f3d0';
    } else {
      statusPillEl.innerHTML = '<i data-lucide="circle-dashed" class="lucide-xs"></i> CHƯA GÁN';
      statusPillEl.style.background = '#f1f5f9';
      statusPillEl.style.color = '#64748b';
      statusPillEl.style.border = '1px solid #e2e8f0';
    }
    if (window.lucide) { try { lucide.createIcons(); } catch (_) {} }
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


// ── 12. FARMER PLANT CREATION (CHUẨN VIETGAP & GIS GPS) ───────────
let _userPlantCreateMode = 'single';
let _userPlantMatrix = [];
let _singlePlantPhotoFile = null;

export function onSinglePlantPhotoSelected(input) {
  if (!input || !input.files || !input.files[0]) return;
  const file = input.files[0];
  _singlePlantPhotoFile = file;

  const preview = document.getElementById('user-single-photo-preview');
  const placeholder = document.getElementById('user-single-photo-placeholder');
  const removeBtn = document.getElementById('user-single-photo-remove-btn');

  const reader = new FileReader();
  reader.onload = (e) => {
    if (preview) {
      preview.src = e.target.result;
      preview.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'inline-flex';
    if (window.refreshIcons) window.refreshIcons();
  };
  reader.readAsDataURL(file);
}
window.onSinglePlantPhotoSelected = onSinglePlantPhotoSelected;

export function removeSinglePlantPhoto() {
  _singlePlantPhotoFile = null;
  const fileInput = document.getElementById('user-single-photo-file');
  if (fileInput) fileInput.value = '';
  const preview = document.getElementById('user-single-photo-preview');
  const placeholder = document.getElementById('user-single-photo-placeholder');
  const removeBtn = document.getElementById('user-single-photo-remove-btn');

  if (preview) {
    preview.src = '';
    preview.style.display = 'none';
  }
  if (placeholder) placeholder.style.display = 'block';
  if (removeBtn) removeBtn.style.display = 'none';
  if (window.refreshIcons) window.refreshIcons();
}
window.removeSinglePlantPhoto = removeSinglePlantPhoto;

export function onMatrixRowPhotoSelected(idx, input) {
  if (!_userPlantMatrix[idx] || !input || !input.files || !input.files[0]) return;
  const file = input.files[0];
  const stage = document.getElementById('user-matrix-bulk-growth-stage')?.value || 'Xuống giống / Cây con';

  const reader = new FileReader();
  reader.onload = (e) => {
    _userPlantMatrix[idx].photo_file = file;
    _userPlantMatrix[idx].photo_preview = e.target.result;
    _userPlantMatrix[idx].growth_stage = stage;
    renderUserPlantMatrix();
  };
  reader.readAsDataURL(file);
}
window.onMatrixRowPhotoSelected = onMatrixRowPhotoSelected;

export function removeMatrixRowPhoto(idx) {
  if (!_userPlantMatrix[idx]) return;
  _userPlantMatrix[idx].photo_file = null;
  _userPlantMatrix[idx].photo_preview = null;
  renderUserPlantMatrix();
}
window.removeMatrixRowPhoto = removeMatrixRowPhoto;

export function onMatrixBulkPhotoSelected(input) {
  if (!input || !input.files || !input.files[0]) return;
  const file = input.files[0];
  const nameLabel = document.getElementById('user-matrix-bulk-photo-name');
  if (nameLabel) nameLabel.textContent = file.name;

  const stage = document.getElementById('user-matrix-bulk-growth-stage')?.value || 'Xuống giống / Cây con';

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    _userPlantMatrix.forEach(item => {
      item.photo_file = file;
      item.photo_preview = dataUrl;
      item.growth_stage = stage;
    });
    renderUserPlantMatrix();
    if (window.toast) {
      window.toast(`📸 Đã áp dụng ảnh "${file.name}" cho toàn bộ ${_userPlantMatrix.length} cây trong ma trận!`, 'success');
    }
  };
  reader.readAsDataURL(file);
}
window.onMatrixBulkPhotoSelected = onMatrixBulkPhotoSelected;

export function calculatePlantAge(plantingDateStr) {
  if (!plantingDateStr) return '';
  const plantingDate = new Date(plantingDateStr);
  if (isNaN(plantingDate.getTime())) return '';
  
  const today = new Date();
  if (plantingDate > today) return 'Mới ươm (Chưa đến ngày trồng)';

  let years = today.getFullYear() - plantingDate.getFullYear();
  let months = today.getMonth() - plantingDate.getMonth();
  let days = today.getDate() - plantingDate.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} năm`);
  if (months > 0) parts.push(`${months} tháng`);
  if (years === 0 && months === 0) {
    parts.push(`${days} ngày`);
  } else if (years === 0 && days > 0 && months < 3) {
    parts.push(`${days} ngày`);
  }

  return parts.join(' ') || '0 ngày';
}
window.calculatePlantAge = calculatePlantAge;

export function onUserPlantingDateChange() {
  const dateInput = document.getElementById('user-plant-planting-date');
  const ageInput = document.getElementById('user-plant-age');
  if (dateInput && ageInput && dateInput.value) {
    const calculatedAge = calculatePlantAge(dateInput.value);
    if (calculatedAge) {
      ageInput.value = calculatedAge;
    }
  }
}
window.onUserPlantingDateChange = onUserPlantingDateChange;

export function onUserBatchPlantingDateChange() {
  const dateInput = document.getElementById('user-batch-planting-date');
  const ageInput = document.getElementById('user-batch-plant-age');
  if (dateInput && ageInput && dateInput.value) {
    const calculatedAge = calculatePlantAge(dateInput.value);
    if (calculatedAge) {
      ageInput.value = calculatedAge;
    }
  }
}
window.onUserBatchPlantingDateChange = onUserBatchPlantingDateChange;

export function autoCalcMatrixAge(idx) {
  if (!_userPlantMatrix[idx]) return;
  const dateVal = _userPlantMatrix[idx].planting_date;
  if (dateVal) {
    const calculatedAge = calculatePlantAge(dateVal);
    if (calculatedAge) {
      _userPlantMatrix[idx].plant_age = calculatedAge;
      const inp = document.getElementById(`matrix-age-${idx}`);
      if (inp) inp.value = calculatedAge;
    }
  }
}
window.autoCalcMatrixAge = autoCalcMatrixAge;

export function normalizePlotName(val) {
  if (!val || typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (!trimmed) return '';
  if (/^l[ôo]\s+/i.test(trimmed)) {
    return 'Lô ' + trimmed.replace(/^l[ôo]\s+/i, '').trim();
  }
  return 'Lô ' + trimmed;
}
window.normalizePlotName = normalizePlotName;

export function autoSequenceRowsInPlot(matrix) {
  if (!Array.isArray(matrix)) return;
  const plotCounters = {};
  matrix.forEach(item => {
    const plot = item.plot_code ? normalizePlotName(item.plot_code) : (item.location ? normalizePlotName(item.location) : '');
    if (plot) {
      item.plot_code = plot;
      if (!plotCounters[plot]) plotCounters[plot] = 1;
      item.row_number = Math.min(plotCounters[plot], 99);
      plotCounters[plot]++;
      item.location = `${plot} - Hàng ${item.row_number}`;
    }
  });
}
window.autoSequenceRowsInPlot = autoSequenceRowsInPlot;

export function onUserSinglePlotChange() {
  const plotInput = document.getElementById('user-plant-plot');
  const rowInput = document.getElementById('user-plant-row');
  const locInput = document.getElementById('user-plant-location');

  let plotVal = plotInput ? plotInput.value.trim() : '';
  if (plotVal) {
    plotVal = normalizePlotName(plotVal);
  }

  let rowVal = rowInput ? parseInt(rowInput.value, 10) : 1;
  if (isNaN(rowVal) || rowVal < 1) rowVal = 1;
  if (rowVal > 99) rowVal = 99;

  const composite = plotVal ? `${plotVal} - Hàng ${rowVal}` : '';
  if (locInput) locInput.value = composite;
}
window.onUserSinglePlotChange = onUserSinglePlotChange;

export function toggleUserPlantCreateMode(mode) {
  _userPlantCreateMode = mode;
  const wrapSingle = document.getElementById('user-wrap-single-code');
  const wrapRange = document.getElementById('user-wrap-range-code');
  const labelSingle = document.getElementById('user-label-mode-single');
  const labelRange = document.getElementById('user-label-mode-range');
  const singleAgronomyCard = document.getElementById('user-single-agronomy-card');
  const singleGpsCard = document.getElementById('user-single-gps-card');
  const matrixCard = document.getElementById('user-plant-matrix-card');
  const btnText = document.getElementById('user-plant-save-btn-text');

  if (mode === 'range') {
    if (wrapSingle) wrapSingle.style.display = 'none';
    if (wrapRange) wrapRange.style.display = 'block';
    if (singleAgronomyCard) singleAgronomyCard.style.display = 'none';
    if (singleGpsCard) singleGpsCard.style.display = 'none';
    if (matrixCard) matrixCard.style.display = 'block';
    if (labelSingle) {
      labelSingle.style.background = '#ffffff';
      labelSingle.style.borderColor = '#cbd5e1';
      labelSingle.style.color = '#334155';
    }
    if (labelRange) {
      labelRange.style.background = '#ecfdf5';
      labelRange.style.borderColor = '#34d399';
      labelRange.style.color = '#065f46';
    }
    updateUserRangePreview();
  } else {
    if (wrapSingle) wrapSingle.style.display = 'grid';
    if (wrapRange) wrapRange.style.display = 'none';
    if (singleAgronomyCard) singleAgronomyCard.style.display = 'block';
    if (singleGpsCard) singleGpsCard.style.display = 'block';
    if (matrixCard) matrixCard.style.display = 'none';
    if (labelSingle) {
      labelSingle.style.background = '#ecfdf5';
      labelSingle.style.borderColor = '#34d399';
      labelSingle.style.color = '#065f46';
    }
    if (labelRange) {
      labelRange.style.background = '#ffffff';
      labelRange.style.borderColor = '#cbd5e1';
      labelRange.style.color = '#334155';
    }
    if (btnText) btnText.textContent = 'Lưu Cây Trồng';
  }
  if (window.lucide) { try { lucide.createIcons(); } catch (_) {} }
}
window.toggleUserPlantCreateMode = toggleUserPlantCreateMode;

export function updateUserRangePreview() {
  if (_userPlantCreateMode !== 'range') return;
  const prefix = (document.getElementById('user-plant-range-prefix')?.value || '').trim();
  const rawStart = document.getElementById('user-plant-range-start')?.value;
  const rawEnd = document.getElementById('user-plant-range-end')?.value;
  const padZeros = document.getElementById('user-plant-range-pad-zeros')?.checked;
  const previewEl = document.getElementById('user-plant-range-preview-text');
  const btnText = document.getElementById('user-plant-save-btn-text');

  const start = parseInt(rawStart, 10);
  const end = parseInt(rawEnd, 10);

  if (isNaN(start) || isNaN(end)) {
    if (previewEl) {
      previewEl.innerHTML = '<span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="info" class="lucide-xs"></i> Nhập số bắt đầu và số kết thúc để xem trước danh sách cây.</span>';
      if (window.lucide) { try { lucide.createIcons(); } catch (_) {} }
    }
    if (btnText) btnText.textContent = 'Tạo Cây Hàng Loạt';
    return;
  }

  if (start > end) {
    if (previewEl) {
      previewEl.innerHTML = '<span style="color:#dc2626; font-weight:800; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="alert-circle" class="lucide-xs"></i> Số bắt đầu phải nhỏ hơn hoặc bằng số kết thúc!</span>';
      if (window.lucide) { try { lucide.createIcons(); } catch (_) {} }
    }
    if (btnText) btnText.textContent = 'Tạo Cây Hàng Loạt';
    return;
  }

  const count = end - start + 1;
  if (count > 500) {
    if (previewEl) {
      previewEl.innerHTML = `<span style="color:#dc2626; font-weight:800; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="alert-triangle" class="lucide-xs"></i> Số lượng ${count} cây vượt quá giới hạn 500 cây mỗi lần!</span>`;
      if (window.lucide) { try { lucide.createIcons(); } catch (_) {} }
    }
    return;
  }

  const padLen = padZeros ? Math.max(String(rawStart).length, String(rawEnd).length) : 0;
  const formatNum = (num) => padLen > 1 ? String(num).padStart(padLen, '0') : String(num);

  const firstCode = `${prefix}${formatNum(start)}`;
  const lastCode = `${prefix}${formatNum(end)}`;
  const secondCode = count > 2 ? `${prefix}${formatNum(start + 1)}` : '';

  let previewStr = `<span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="check-circle-2" class="lucide-xs" style="color:#059669;"></i> Sẽ tạo <strong>${count} cây</strong>: <code>${esc(firstCode)}</code></span>`;
  if (secondCode) previewStr += `, <code>${esc(secondCode)}</code>`;
  if (count > 3) previewStr += `, ...`;
  if (count > 1) previewStr += `, <code>${esc(lastCode)}</code>`;

  if (previewEl) {
    previewEl.innerHTML = previewStr;
    if (window.lucide) { try { lucide.createIcons(); } catch (_) {} }
  }
  if (btnText) btnText.textContent = `Tạo ${count} Cây Hàng Loạt`;
}
window.updateUserRangePreview = updateUserRangePreview;

// ── Batch Range Data Matrix Helpers ──
export function generateUserPlantMatrix() {
  const prefix = (document.getElementById('user-plant-range-prefix')?.value || '').trim();
  const rawStart = document.getElementById('user-plant-range-start')?.value;
  const rawEnd = document.getElementById('user-plant-range-end')?.value;
  const padZeros = document.getElementById('user-plant-range-pad-zeros')?.checked;
  const bulkPlotRaw = (document.getElementById('user-matrix-bulk-plot')?.value || document.getElementById('user-plant-plot')?.value || '').trim();
  const bulkPlot = bulkPlotRaw ? normalizePlotName(bulkPlotRaw) : '';
  
  const start = parseInt(rawStart, 10);
  const end = parseInt(rawEnd, 10);

  if (isNaN(start) || isNaN(end)) {
    if (window.toast) window.toast('Vui lòng nhập đầy đủ Số bắt đầu và Số kết thúc!', 'warning');
    else alert('Vui lòng nhập đầy đủ Số bắt đầu và Số kết thúc!');
    return;
  }
  if (start > end) {
    if (window.toast) window.toast('Số bắt đầu phải nhỏ hơn hoặc bằng số kết thúc!', 'warning');
    else alert('Số bắt đầu phải nhỏ hơn hoặc bằng số kết thúc!');
    return;
  }

  const count = end - start + 1;
  if (count > 500) {
    if (window.toast) window.toast(`Số lượng ${count} cây vượt quá giới hạn 500 cây mỗi lần!`, 'error');
    else alert(`Số lượng ${count} cây vượt quá giới hạn 500 cây mỗi lần!`);
    return;
  }

  const defaultLat = document.getElementById('user-plant-lat')?.value || '';
  const defaultLng = document.getElementById('user-plant-lng')?.value || '';
  const defaultPlantingDate = document.getElementById('user-batch-planting-date')?.value || document.getElementById('user-plant-planting-date')?.value || '';
  const defaultPlantAge = (document.getElementById('user-batch-plant-age')?.value || document.getElementById('user-plant-age')?.value || '').trim();
  const defaultHealth = document.getElementById('user-batch-health')?.value || document.getElementById('user-plant-health')?.value || 'Tốt';
  const defaultYield = (document.getElementById('user-batch-initial-yield')?.value || document.getElementById('user-plant-initial-yield')?.value || '').trim();
  const batchDiseases = getSelectedBatchPastDiseases();
  const defaultDiseases = (batchDiseases && batchDiseases.length) ? batchDiseases : getSelectedPastDiseases();

  const padLen = padZeros ? Math.max(String(rawStart).length, String(rawEnd).length) : 0;
  const formatNum = (num) => padLen > 1 ? String(num).padStart(padLen, '0') : String(num);

  _userPlantMatrix = [];
  let rowCounter = 1;
  for (let i = start; i <= end; i++) {
    const code = `${prefix}${formatNum(i)}`;
    const rowNum = bulkPlot ? Math.min(rowCounter, 99) : (rowCounter <= 99 ? rowCounter : 1);
    const loc = bulkPlot ? `${bulkPlot} - Hàng ${rowNum}` : '';
    _userPlantMatrix.push({
      tree_code: code,
      plot_code: bulkPlot || '',
      row_number: rowNum,
      location: loc,
      latitude: defaultLat && !isNaN(parseFloat(defaultLat)) ? parseFloat(defaultLat) : null,
      longitude: defaultLng && !isNaN(parseFloat(defaultLng)) ? parseFloat(defaultLng) : null,
      planting_date: defaultPlantingDate || null,
      plant_age: defaultPlantAge || '',
      health_status: defaultHealth || 'Tốt',
      initial_yield: defaultYield || '',
      past_diseases: Array.isArray(defaultDiseases) ? [...defaultDiseases] : [],
      photo_file: null,
      photo_preview: null,
      growth_stage: document.getElementById('user-matrix-bulk-growth-stage')?.value || 'Xuống giống / Cây con'
    });
    rowCounter++;
  }

  renderUserPlantMatrix();

  const card = document.getElementById('user-plant-matrix-card');
  if (card) {
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
window.generateUserPlantMatrix = generateUserPlantMatrix;

export function renderUserPlantMatrix() {
  const tbody = document.getElementById('user-plant-matrix-tbody');
  const countBadge = document.getElementById('user-matrix-count-badge');
  const card = document.getElementById('user-plant-matrix-card');

  if (countBadge) {
    countBadge.textContent = `${_userPlantMatrix.length} cây trong ma trận`;
  }

  if (!tbody) return;

  if (!_userPlantMatrix.length) {
    tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; padding:18px; color:#94a3b8;">Chưa có cây nào trong ma trận. Bấm <strong>Tạo Bảng Ma Trận Lô, GPS &amp; Nông Học</strong> hoặc <strong>+ Thêm 1 cây</strong>.</td></tr>`;
    if (card) card.style.display = 'block';
    return;
  }

  if (card) card.style.display = 'block';

  tbody.innerHTML = _userPlantMatrix.map((item, idx) => {
    const diseasesStr = Array.isArray(item.past_diseases) ? item.past_diseases.join(', ') : (item.past_diseases || '');
    const hasPhoto = !!item.photo_preview;
    const photoCellHtml = hasPhoto
      ? `<div style="display:flex;align-items:center;justify-content:center;gap:4px;">
           <img src="${item.photo_preview}" style="width:28px;height:28px;object-fit:cover;border-radius:6px;border:1.5px solid #059669;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.1);" onclick="document.getElementById('matrix-photo-input-${idx}').click()" title="Đổi ảnh (${esc(item.growth_stage || 'Cây con')})">
           <button type="button" onclick="removeMatrixRowPhoto(${idx})" title="Xóa ảnh" style="background:#fee2e2;border:1px solid #fecaca;color:#ef4444;border-radius:4px;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;font-weight:bold;line-height:1;padding:0;">×</button>
           <input type="file" id="matrix-photo-input-${idx}" accept="image/*" style="display:none;" onchange="onMatrixRowPhotoSelected(${idx}, this)">
         </div>`
      : `<div style="text-align:center;">
           <button type="button" onclick="document.getElementById('matrix-photo-input-${idx}').click()" style="background:#f8fafc;border:1px dashed #cbd5e1;color:#64748b;border-radius:6px;padding:3px 6px;font-size:10.5px;font-weight:600;display:inline-flex;align-items:center;gap:3px;cursor:pointer;white-space:nowrap;">
             <i data-lucide="camera" class="lucide-xs"></i> <span>Chọn ảnh</span>
           </button>
           <input type="file" id="matrix-photo-input-${idx}" accept="image/*" style="display:none;" onchange="onMatrixRowPhotoSelected(${idx}, this)">
         </div>`;

    return `
    <tr style="border-bottom:1px solid #f1f5f9; ${idx % 2 === 1 ? 'background:#f8fafc;' : ''}">
      <td style="padding:5px 6px; text-align:center; font-weight:700; color:#64748b;">${idx + 1}</td>
      <td style="padding:5px 6px;">
        <input type="text" value="${esc(item.tree_code)}" onchange="updateMatrixItem(${idx}, 'tree_code', this.value)" style="width:100%; min-width:85px; padding:4px 6px; border:1px solid #cbd5e1; border-radius:6px; font-weight:700; font-size:11.5px; color:#064e3b; outline:none; box-sizing:border-box; background:#fff;">
      </td>
      <td style="padding:5px 6px; text-align:center;">
        ${photoCellHtml}
      </td>
      <td style="padding:5px 6px;">
        <input type="text" value="${esc(item.plot_code || '')}" placeholder="VD: Lô A1" onblur="updateMatrixPlot(${idx}, this.value)" onchange="updateMatrixPlot(${idx}, this.value)" style="width:100%; min-width:95px; padding:4px 6px; border:1px solid #cbd5e1; border-radius:6px; font-weight:600; font-size:11.5px; outline:none; box-sizing:border-box; background:#fff;">
      </td>
      <td style="padding:5px 6px;">
        <input type="number" min="1" max="99" step="1" value="${item.row_number || 1}" onchange="updateMatrixRow(${idx}, this.value)" style="width:100%; min-width:65px; padding:4px 6px; border:1px solid #cbd5e1; border-radius:6px; font-size:11.5px; font-weight:700; outline:none; box-sizing:border-box; background:#fff;">
      </td>
      <td style="padding:5px 6px;">
        <input type="number" step="any" value="${item.latitude !== null && item.latitude !== undefined ? item.latitude : ''}" placeholder="Vĩ độ" onchange="updateMatrixItem(${idx}, 'latitude', this.value)" style="width:100%; min-width:80px; padding:4px 6px; border:1px solid #cbd5e1; border-radius:6px; font-size:11px; font-family:monospace; outline:none; box-sizing:border-box; background:#fff;">
      </td>
      <td style="padding:5px 6px;">
        <input type="number" step="any" value="${item.longitude !== null && item.longitude !== undefined ? item.longitude : ''}" placeholder="Kinh độ" onchange="updateMatrixItem(${idx}, 'longitude', this.value)" style="width:100%; min-width:80px; padding:4px 6px; border:1px solid #cbd5e1; border-radius:6px; font-size:11px; font-family:monospace; outline:none; box-sizing:border-box; background:#fff;">
      </td>
      <td style="padding:5px 6px;">
        <input type="date" value="${item.planting_date || ''}" onchange="updateMatrixItem(${idx}, 'planting_date', this.value); autoCalcMatrixAge(${idx});" style="width:100%; min-width:115px; padding:4px 6px; border:1px solid #cbd5e1; border-radius:6px; font-size:11px; outline:none; box-sizing:border-box; background:#fff;">
      </td>
      <td style="padding:5px 6px;">
        <input type="text" id="matrix-age-${idx}" value="${esc(item.plant_age || '')}" placeholder="VD: 2 năm" onchange="updateMatrixItem(${idx}, 'plant_age', this.value)" style="width:100%; min-width:85px; padding:4px 6px; border:1px solid #cbd5e1; border-radius:6px; font-size:11.5px; outline:none; box-sizing:border-box; background:#fff;">
      </td>
      <td style="padding:5px 6px;">
        <select onchange="updateMatrixItem(${idx}, 'health_status', this.value)" style="width:100%; min-width:90px; padding:4px 5px; border:1px solid #cbd5e1; border-radius:6px; font-size:11.5px; font-weight:700; outline:none; box-sizing:border-box; background:#fff;">
          <option value="Tốt" ${item.health_status === 'Tốt' ? 'selected' : ''}>Tốt</option>
          <option value="Bình thường" ${item.health_status === 'Bình thường' ? 'selected' : ''}>Bình thường</option>
          <option value="Cần chú ý" ${item.health_status === 'Cần chú ý' ? 'selected' : ''}>Cần chú ý</option>
          <option value="Bệnh" ${item.health_status === 'Bệnh' ? 'selected' : ''}>Bệnh</option>
        </select>
      </td>
      <td style="padding:5px 6px;">
        <input type="text" value="${esc(item.initial_yield || '')}" placeholder="VD: 80 kg" onchange="updateMatrixItem(${idx}, 'initial_yield', this.value)" style="width:100%; min-width:85px; padding:4px 6px; border:1px solid #cbd5e1; border-radius:6px; font-size:11px; outline:none; box-sizing:border-box; background:#fff;">
      </td>
      <td style="padding:5px 6px;">
        <input type="text" value="${esc(diseasesStr)}" placeholder="VD: Rệp sáp..." onchange="updateMatrixPastDiseases(${idx}, this.value)" style="width:100%; min-width:110px; padding:4px 6px; border:1px solid #cbd5e1; border-radius:6px; font-size:11px; outline:none; box-sizing:border-box; background:#fff;">
      </td>
      <td style="padding:5px 6px; text-align:center;">
        <button type="button" onclick="deleteMatrixRow(${idx})" title="Xóa cây này khỏi ma trận" style="background:#fee2e2; border:1px solid #fecaca; color:#ef4444; border-radius:6px; width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; font-size:13px; font-weight:bold; transition:all 0.15s;">
          ×
        </button>
      </td>
    </tr>`;
  }).join('');

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    try { window.lucide.createIcons(); } catch (_) {}
  }
}
window.renderUserPlantMatrix = renderUserPlantMatrix;

export function updateMatrixPlot(idx, value) {
  if (!_userPlantMatrix[idx]) return;
  const raw = (value || '').trim();
  const normPlot = raw ? normalizePlotName(raw) : '';
  _userPlantMatrix[idx].plot_code = normPlot;

  if (normPlot) {
    const usedRows = new Set(
      _userPlantMatrix
        .filter((it, i) => i !== idx && it.plot_code === normPlot && it.row_number)
        .map(it => it.row_number)
    );
    let targetRow = _userPlantMatrix[idx].row_number || 1;
    if (usedRows.has(targetRow)) {
      for (let r = 1; r <= 99; r++) {
        if (!usedRows.has(r)) {
          targetRow = r;
          break;
        }
      }
    }
    _userPlantMatrix[idx].row_number = Math.min(targetRow, 99);
    _userPlantMatrix[idx].location = `${normPlot} - Hàng ${_userPlantMatrix[idx].row_number}`;
  } else {
    _userPlantMatrix[idx].location = '';
  }
  renderUserPlantMatrix();
}
window.updateMatrixPlot = updateMatrixPlot;

export function updateMatrixRow(idx, value) {
  if (!_userPlantMatrix[idx]) return;
  let row = parseInt(value, 10);
  if (isNaN(row) || row < 1) row = 1;
  if (row > 99) row = 99;

  const currentPlot = _userPlantMatrix[idx].plot_code;
  if (currentPlot) {
    const isDup = _userPlantMatrix.some((it, i) => i !== idx && it.plot_code === currentPlot && it.row_number === row);
    if (isDup) {
      if (window.toast) window.toast(`⚠️ Hàng ${row} đã tồn tại trong ${currentPlot}! Vui lòng chọn số hàng không trùng lặp (1-99).`, 'warning');
    }
    _userPlantMatrix[idx].location = `${currentPlot} - Hàng ${row}`;
  }
  _userPlantMatrix[idx].row_number = row;
}
window.updateMatrixRow = updateMatrixRow;

export function updateMatrixItem(idx, field, value) {
  if (!_userPlantMatrix[idx]) return;
  if (field === 'latitude' || field === 'longitude') {
    const num = parseFloat(value);
    _userPlantMatrix[idx][field] = (!isNaN(num)) ? num : null;
  } else {
    _userPlantMatrix[idx][field] = value;
  }
}
window.updateMatrixItem = updateMatrixItem;

export function updateMatrixPastDiseases(idx, val) {
  if (!_userPlantMatrix[idx]) return;
  const parts = (val || '').split(',').map(s => s.trim()).filter(Boolean);
  _userPlantMatrix[idx].past_diseases = parts;
}
window.updateMatrixPastDiseases = updateMatrixPastDiseases;

export function deleteMatrixRow(idx) {
  if (idx >= 0 && idx < _userPlantMatrix.length) {
    const removed = _userPlantMatrix.splice(idx, 1);
    renderUserPlantMatrix();
    if (window.toast) {
      window.toast(`Đã xóa cây ${removed[0]?.tree_code || ''} khỏi ma trận`, 'info');
    }
  }
}
window.deleteMatrixRow = deleteMatrixRow;

export function applyBulkPlotToMatrix() {
  const bulkInput = document.getElementById('user-matrix-bulk-plot');
  const val = (bulkInput?.value || '').trim();
  if (!val) {
    if (window.toast) window.toast('Vui lòng nhập tên Lô trồng cần áp dụng (VD: A1 hoặc Lô A1)!', 'warning');
    else alert('Vui lòng nhập tên Lô trồng cần áp dụng (VD: A1 hoặc Lô A1)!');
    return;
  }
  if (!_userPlantMatrix.length) {
    if (window.toast) window.toast('Chưa có cây nào trong ma trận. Vui lòng tạo bảng trước!', 'warning');
    else alert('Chưa có cây nào trong ma trận. Vui lòng tạo bảng trước!');
    return;
  }
  const normPlot = normalizePlotName(val);
  if (bulkInput) bulkInput.value = normPlot;

  let rowCounter = 1;
  _userPlantMatrix.forEach(item => {
    item.plot_code = normPlot;
    item.row_number = Math.min(rowCounter, 99);
    item.location = `${normPlot} - Hàng ${item.row_number}`;
    rowCounter++;
  });

  renderUserPlantMatrix();
  if (window.toast) window.toast(`✅ Đã áp dụng "${normPlot}" với số hàng tăng dần (1-${Math.min(rowCounter - 1, 99)}) không trùng lặp!`, 'success');
}
window.applyBulkPlotToMatrix = applyBulkPlotToMatrix;
export const applyBulkLocationToMatrix = applyBulkPlotToMatrix;
window.applyBulkLocationToMatrix = applyBulkPlotToMatrix;

export function applyBulkGpsToMatrix() {
  if (!_userPlantMatrix.length) {
    if (window.toast) window.toast('Chưa có cây nào trong ma trận!', 'warning');
    else alert('Chưa có cây nào trong ma trận!');
    return;
  }
  if (!navigator.geolocation) {
    if (window.toast) window.toast('Trình duyệt không hỗ trợ định vị GPS!', 'error');
    else alert('Trình duyệt không hỗ trợ định vị GPS!');
    return;
  }
  if (window.toast) window.toast('📡 Đang lấy GPS thiết bị...');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = parseFloat(pos.coords.latitude.toFixed(6));
      const lng = parseFloat(pos.coords.longitude.toFixed(6));
      _userPlantMatrix.forEach(item => {
        item.latitude = lat;
        item.longitude = lng;
      });
      renderUserPlantMatrix();
      if (window.toast) window.toast(`📍 Đã điền GPS (${lat}, ${lng}) cho ${_userPlantMatrix.length} cây!`, 'success');
    },
    (err) => {
      if (window.toast) window.toast('Không thể lấy tọa độ GPS: ' + err.message, 'error');
      else alert('Không thể lấy tọa độ GPS: ' + err.message);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}
window.applyBulkGpsToMatrix = applyBulkGpsToMatrix;

export function applyBulkAgronomyToMatrix() {
  if (!_userPlantMatrix || !_userPlantMatrix.length) {
    if (window.toast) window.toast('Chưa có cây nào trong ma trận để áp dụng!', 'warning');
    else alert('Chưa có cây nào trong ma trận để áp dụng!');
    return;
  }
  const dateVal = document.getElementById('user-batch-planting-date')?.value || '';
  const ageVal = (document.getElementById('user-batch-plant-age')?.value || '').trim();
  const healthVal = document.getElementById('user-batch-health')?.value || 'Tốt';
  const yieldVal = (document.getElementById('user-batch-initial-yield')?.value || '').trim();
  const diseasesVal = getSelectedBatchPastDiseases();

  _userPlantMatrix.forEach(item => {
    if (dateVal) item.planting_date = dateVal;
    if (ageVal) item.plant_age = ageVal;
    if (healthVal) item.health_status = healthVal;
    if (yieldVal) item.initial_yield = yieldVal;
    if (diseasesVal && diseasesVal.length) item.past_diseases = [...diseasesVal];
  });

  renderUserPlantMatrix();
  if (window.toast) {
    window.toast(`✅ Đã áp dụng thông số nông học cho tất cả ${_userPlantMatrix.length} cây!`, 'success');
  }
}
window.applyBulkAgronomyToMatrix = applyBulkAgronomyToMatrix;

export function addCustomMatrixRow() {
  const nextNum = _userPlantMatrix.length + 1;
  const prefix = (document.getElementById('user-plant-range-prefix')?.value || '').trim();
  const bulkPlotRaw = (document.getElementById('user-matrix-bulk-plot')?.value || document.getElementById('user-plant-plot')?.value || '').trim();
  const bulkPlot = bulkPlotRaw ? normalizePlotName(bulkPlotRaw) : '';
  const defaultLat = document.getElementById('user-plant-lat')?.value || '';
  const defaultLng = document.getElementById('user-plant-lng')?.value || '';
  const defaultPlantingDate = document.getElementById('user-batch-planting-date')?.value || document.getElementById('user-plant-planting-date')?.value || '';
  const defaultPlantAge = (document.getElementById('user-batch-plant-age')?.value || document.getElementById('user-plant-age')?.value || '').trim();
  const defaultHealth = document.getElementById('user-batch-health')?.value || document.getElementById('user-plant-health')?.value || 'Tốt';
  const defaultYield = (document.getElementById('user-batch-initial-yield')?.value || document.getElementById('user-plant-initial-yield')?.value || '').trim();
  const batchDiseases = getSelectedBatchPastDiseases();
  const defaultDiseases = (batchDiseases && batchDiseases.length) ? batchDiseases : getSelectedPastDiseases();

  let nextRow = 1;
  if (bulkPlot) {
    const used = new Set(_userPlantMatrix.filter(it => it.plot_code === bulkPlot).map(it => it.row_number));
    for (let r = 1; r <= 99; r++) {
      if (!used.has(r)) {
        nextRow = r;
        break;
      }
    }
  }

  _userPlantMatrix.push({
    tree_code: `${prefix}${nextNum}`,
    plot_code: bulkPlot || '',
    row_number: Math.min(nextRow, 99),
    location: bulkPlot ? `${bulkPlot} - Hàng ${Math.min(nextRow, 99)}` : '',
    latitude: defaultLat && !isNaN(parseFloat(defaultLat)) ? parseFloat(defaultLat) : null,
    longitude: defaultLng && !isNaN(parseFloat(defaultLng)) ? parseFloat(defaultLng) : null,
    planting_date: defaultPlantingDate || null,
    plant_age: defaultPlantAge || '',
    health_status: defaultHealth || 'Tốt',
    initial_yield: defaultYield || '',
    past_diseases: Array.isArray(defaultDiseases) ? [...defaultDiseases] : [],
    photo_file: null,
    photo_preview: null,
    growth_stage: document.getElementById('user-matrix-bulk-growth-stage')?.value || 'Xuống giống / Cây con'
  });
  renderUserPlantMatrix();
}
window.addCustomMatrixRow = addCustomMatrixRow;

export function getUserPlantGPS() {
  if (!navigator.geolocation) {
    if (typeof toast === 'function') toast('Trình duyệt không hỗ trợ định vị GPS!', 'error');
    else if (window.toast) window.toast('Trình duyệt không hỗ trợ định vị GPS!', 'error');
    return;
  }
  if (typeof toast === 'function') toast('📡 Đang định vị vệ tinh GPS thiết bị...');
  else if (window.toast) window.toast('📡 Đang định vị vệ tinh GPS thiết bị...');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const latEl = document.getElementById('user-plant-lat');
      const lngEl = document.getElementById('user-plant-lng');
      if (latEl) latEl.value = lat;
      if (lngEl) lngEl.value = lng;
      const successMsg = `📍 Đã lấy GPS: ${lat}, ${lng} (±${Math.round(pos.coords.accuracy || 0)}m)`;
      if (typeof toast === 'function') toast(successMsg, 'success');
      else if (window.toast) window.toast(successMsg, 'success');
    },
    (err) => {
      const errMsg = 'Không thể lấy tọa độ GPS: ' + err.message;
      if (typeof toast === 'function') toast(errMsg, 'error');
      else if (window.toast) window.toast(errMsg, 'error');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}
window.getUserPlantGPS = getUserPlantGPS;

export function onUserPlantNfcSelectChange() {
  const sel = document.getElementById('user-plant-nfc-select');
  const uidInput = document.getElementById('user-plant-nfc-uid');
  if (sel && uidInput && sel.value) {
    uidInput.value = sel.value;
  }
}
window.onUserPlantNfcSelectChange = onUserPlantNfcSelectChange;

export async function onUserPlantFarmChange() {
  const farmId = document.getElementById('user-plant-farm-id')?.value;
  if (!farmId) return;
  const nfcSelect = document.getElementById('user-plant-nfc-select');
  if (!nfcSelect) return;
  try {
    const res = await api(`/nfc/farm/${farmId}/tags`);
    const tags = Array.isArray(res) ? res : (res?.tags || res?.items || []);
    const unassigned = tags.filter(t => !t.plant_id && !t.is_assigned && t.status !== 'assigned');
    nfcSelect.innerHTML = '<option value="">— Chọn từ kho thẻ chưa gán —</option>' +
      unassigned.map(t => `<option value="${esc(t.nfc_uid || t.tag_uid)}">${esc(t.nfc_uid || t.tag_uid)} ${t.note ? `(${esc(t.note)})` : ''}</option>`).join('');
  } catch (_) {
    nfcSelect.innerHTML = '<option value="">— Nhập thủ công UID —</option>';
  }
}
window.onUserPlantFarmChange = onUserPlantFarmChange;

export async function openUserCreatePlantModal() {
  const modal = document.getElementById('user-create-plant-modal');
  if (!modal) return;

  // 1. Populate Farms
  const farmSelect = document.getElementById('user-plant-farm-id');
  if (farmSelect) {
    const farms = _farmsCache || [];
    if (!farms.length) {
      alert('Bạn cần khởi tạo ít nhất 1 Trang trại trước khi thêm cây trồng!');
      return;
    }
    farmSelect.innerHTML = farms.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
    if (_activeFarmId) {
      farmSelect.value = _activeFarmId;
    }
  }

  // 2. Reset Fields
  ['user-plant-tree-code', 'user-plant-nfc-uid', 'user-plant-type', 'user-plant-variety', 'user-plant-planting-date', 'user-plant-age', 'user-plant-plot', 'user-plant-row', 'user-plant-location', 'user-plant-lat', 'user-plant-lng', 'user-plant-range-prefix', 'user-plant-range-start', 'user-plant-range-end', 'user-matrix-bulk-plot', 'user-plant-initial-yield', 'user-plant-custom-past-disease', 'user-batch-planting-date', 'user-batch-plant-age', 'user-batch-initial-yield', 'user-batch-custom-past-disease'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = (id === 'user-plant-row') ? '1' : '';
    }
  });
  const healthEl = document.getElementById('user-plant-health');
  if (healthEl) healthEl.value = 'Tốt';
  const batchHealthEl = document.getElementById('user-batch-health');
  if (batchHealthEl) batchHealthEl.value = 'Tốt';
  const publicEl = document.getElementById('user-plant-is-public');
  if (publicEl) publicEl.value = 'true';
  resetPastDiseaseChips();
  resetBatchPastDiseaseChips();
  removeSinglePlantPhoto();
  const bulkPhotoInput = document.getElementById('user-matrix-bulk-photo-file');
  if (bulkPhotoInput) bulkPhotoInput.value = '';
  const bulkPhotoLbl = document.getElementById('user-matrix-bulk-photo-name');
  if (bulkPhotoLbl) bulkPhotoLbl.textContent = '';

  _userPlantMatrix = [];
  const matrixCard = document.getElementById('user-plant-matrix-card');
  if (matrixCard) matrixCard.style.display = 'none';
  const matrixTbody = document.getElementById('user-plant-matrix-tbody');
  if (matrixTbody) matrixTbody.innerHTML = '';
  const matrixCountBadge = document.getElementById('user-matrix-count-badge');
  if (matrixCountBadge) matrixCountBadge.textContent = '0 cây trong ma trận';

  // 3. Default mode single
  const radioSingle = document.querySelector('input[name="user-plant-mode"][value="single"]');
  if (radioSingle) radioSingle.checked = true;
  toggleUserPlantCreateMode('single');

  // 4. Load unassigned NFC for active farm
  onUserPlantFarmChange();

  // 5. If farm has GPS, autofill coordinates
  const activeFarm = getActiveFarm();
  if (activeFarm && activeFarm.latitude && activeFarm.longitude) {
    const latEl = document.getElementById('user-plant-lat');
    const lngEl = document.getElementById('user-plant-lng');
    if (latEl && !latEl.value) latEl.value = Number(activeFarm.latitude).toFixed(6);
    if (lngEl && !lngEl.value) lngEl.value = Number(activeFarm.longitude).toFixed(6);
  }

  modal.style.display = 'flex';
  if (window.lucide) { try { lucide.createIcons(); } catch (_) {} }
}
window.openUserCreatePlantModal = openUserCreatePlantModal;

export function closeUserCreatePlantModal() {
  const modal = document.getElementById('user-create-plant-modal');
  if (modal) modal.style.display = 'none';
  resetPastDiseaseChips();
  resetBatchPastDiseaseChips();
  removeSinglePlantPhoto();
  const bulkPhotoInput = document.getElementById('user-matrix-bulk-photo-file');
  if (bulkPhotoInput) bulkPhotoInput.value = '';
  const bulkPhotoLbl = document.getElementById('user-matrix-bulk-photo-name');
  if (bulkPhotoLbl) bulkPhotoLbl.textContent = '';
}
window.closeUserCreatePlantModal = closeUserCreatePlantModal;

// ── Selectable Past Diseases Badges / Chips Handlers ──
export function togglePastDiseaseChip(btn, diseaseName) {
  if (!btn) return;
  const isBatch = btn.closest('#batch-past-disease-chips-container') !== null;
  const container = isBatch ? document.getElementById('batch-past-disease-chips-container') : document.getElementById('past-disease-chips-container');
  const customWrap = isBatch ? document.getElementById('user-batch-custom-disease-wrap') : document.getElementById('user-plant-custom-disease-wrap');

  if (diseaseName === 'Chưa từng nhiễm bệnh') {
    if (container) {
      container.querySelectorAll('.past-disease-chip').forEach(chip => {
        if (chip !== btn) chip.classList.remove('active');
      });
    }
    btn.classList.toggle('active');
    if (customWrap) customWrap.style.display = 'none';
    return;
  }

  // If another disease is selected, deselect "Chưa từng nhiễm bệnh"
  if (container) {
    const healthyChip = Array.from(container.querySelectorAll('.past-disease-chip'))
      .find(c => c.textContent.includes('Chưa từng nhiễm bệnh'));
    if (healthyChip) healthyChip.classList.remove('active');
  }

  btn.classList.toggle('active');

  if (diseaseName === 'Bệnh khác') {
    if (customWrap) {
      customWrap.style.display = btn.classList.contains('active') ? 'block' : 'none';
      if (btn.classList.contains('active')) {
        const inp = isBatch ? document.getElementById('user-batch-custom-past-disease') : document.getElementById('user-plant-custom-past-disease');
        if (inp) inp.focus();
      }
    }
  }
}
window.togglePastDiseaseChip = togglePastDiseaseChip;

export function getSelectedPastDiseases() {
  const container = document.getElementById('past-disease-chips-container');
  if (!container) return [];
  const selected = [];
  container.querySelectorAll('.past-disease-chip.active').forEach(chip => {
    const text = chip.querySelector('span')?.textContent?.trim() || chip.textContent.trim();
    if (text === 'Bệnh khác...') {
      const customVal = (document.getElementById('user-plant-custom-past-disease')?.value || '').trim();
      if (customVal) selected.push(customVal);
    } else if (text) {
      selected.push(text);
    }
  });
  return selected;
}
window.getSelectedPastDiseases = getSelectedPastDiseases;

export function getSelectedBatchPastDiseases() {
  const container = document.getElementById('batch-past-disease-chips-container');
  if (!container) return [];
  const selected = [];
  container.querySelectorAll('.past-disease-chip.active').forEach(chip => {
    const text = chip.querySelector('span')?.textContent?.trim() || chip.textContent.trim();
    if (text === 'Bệnh khác...') {
      const customVal = (document.getElementById('user-batch-custom-past-disease')?.value || '').trim();
      if (customVal) selected.push(customVal);
    } else if (text) {
      selected.push(text);
    }
  });
  return selected;
}
window.getSelectedBatchPastDiseases = getSelectedBatchPastDiseases;

export function resetPastDiseaseChips() {
  const container = document.getElementById('past-disease-chips-container');
  if (container) {
    container.querySelectorAll('.past-disease-chip').forEach(chip => chip.classList.remove('active'));
  }
  const customWrap = document.getElementById('user-plant-custom-disease-wrap');
  if (customWrap) customWrap.style.display = 'none';
  const customInp = document.getElementById('user-plant-custom-past-disease');
  if (customInp) customInp.value = '';
  const yieldInp = document.getElementById('user-plant-initial-yield');
  if (yieldInp) yieldInp.value = '';
}
window.resetPastDiseaseChips = resetPastDiseaseChips;

export function resetBatchPastDiseaseChips() {
  const container = document.getElementById('batch-past-disease-chips-container');
  if (container) {
    container.querySelectorAll('.past-disease-chip').forEach(chip => chip.classList.remove('active'));
  }
  const customWrap = document.getElementById('user-batch-custom-disease-wrap');
  if (customWrap) customWrap.style.display = 'none';
  const customInp = document.getElementById('user-batch-custom-past-disease');
  if (customInp) customInp.value = '';
  const dateInp = document.getElementById('user-batch-planting-date');
  if (dateInp) dateInp.value = '';
  const ageInp = document.getElementById('user-batch-plant-age');
  if (ageInp) ageInp.value = '';
  const healthInp = document.getElementById('user-batch-health');
  if (healthInp) healthInp.value = 'Tốt';
  const yieldInp = document.getElementById('user-batch-initial-yield');
  if (yieldInp) yieldInp.value = '';
}
window.resetBatchPastDiseaseChips = resetBatchPastDiseaseChips;

export async function submitUserCreatePlant() {
  const farmId = document.getElementById('user-plant-farm-id')?.value;
  if (!farmId) {
    if (typeof toast === 'function') toast('Vui lòng chọn trang trại!', 'error');
    else alert('Vui lòng chọn trang trại!');
    return;
  }

  const plantType = (document.getElementById('user-plant-type')?.value || '').trim();
  if (!plantType) {
    if (typeof toast === 'function') toast('Vui lòng nhập loại cây trồng!', 'error');
    else alert('Vui lòng nhập loại cây trồng!');
    return;
  }

  const plantVariety = (document.getElementById('user-plant-variety')?.value || '').trim();
  const plantingDate = document.getElementById('user-plant-planting-date')?.value || null;
  const plantAge = (document.getElementById('user-plant-age')?.value || '').trim();
  const healthStatus = document.getElementById('user-plant-health')?.value || 'Tốt';
  const initialYield = (document.getElementById('user-plant-initial-yield')?.value || '').trim();
  const pastDiseases = getSelectedPastDiseases();
  const latVal = document.getElementById('user-plant-lat')?.value;
  const lngVal = document.getElementById('user-plant-lng')?.value;
  const isPublic = document.getElementById('user-plant-is-public')?.value === 'true';

  const latitude = latVal && !isNaN(parseFloat(latVal)) ? parseFloat(latVal) : null;
  const longitude = lngVal && !isNaN(parseFloat(lngVal)) ? parseFloat(lngVal) : null;

  const btn = document.getElementById('btn-submit-user-create-plant');
  const originalBtnText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang lưu...';
    btn.disabled = true;
  }

  try {
    if (_userPlantCreateMode === 'range') {
      let payload;
      if (_userPlantMatrix && _userPlantMatrix.length > 0) {
        payload = {
          farm_id: parseInt(farmId, 10),
          plant_type: plantType,
          plant_variety: plantVariety,
          planting_date: plantingDate,
          plant_age: plantAge,
          health_status: healthStatus,
          initial_yield: initialYield,
          past_diseases: pastDiseases,
          is_public: isPublic,
          items: _userPlantMatrix.map(it => {
            const itemPlot = it.plot_code ? normalizePlotName(it.plot_code) : '';
            const itemRow = it.row_number || null;
            const itemLoc = it.location || (itemPlot ? `${itemPlot}${itemRow ? ' - Hàng ' + itemRow : ''}` : '');
            const itemDate = it.planting_date || plantingDate || null;
            const itemAge = (it.plant_age !== undefined && it.plant_age !== '') ? it.plant_age : plantAge;
            const itemHealth = it.health_status || healthStatus || 'Tốt';
            const itemYield = (it.initial_yield !== undefined && it.initial_yield !== '') ? it.initial_yield : initialYield;
            const itemDiseases = (it.past_diseases && it.past_diseases.length) ? it.past_diseases : pastDiseases;
            return {
              tree_code: it.tree_code,
              plot_code: itemPlot,
              row_number: itemRow,
              location: itemLoc,
              latitude: it.latitude !== undefined && it.latitude !== null && !isNaN(parseFloat(it.latitude)) ? parseFloat(it.latitude) : latitude,
              longitude: it.longitude !== undefined && it.longitude !== null && !isNaN(parseFloat(it.longitude)) ? parseFloat(it.longitude) : longitude,
              plant_type: plantType,
              plant_variety: plantVariety,
              planting_date: itemDate,
              plant_age: itemAge,
              health_status: itemHealth,
              initial_yield: itemYield,
              past_diseases: itemDiseases
            };
          }),
          data: {
            initial_yield: initialYield,
            past_diseases: pastDiseases
          }
        };
      } else {
        const prefix = (document.getElementById('user-plant-range-prefix')?.value || '').trim();
        const rawStart = document.getElementById('user-plant-range-start')?.value;
        const rawEnd = document.getElementById('user-plant-range-end')?.value;
        const padZeros = document.getElementById('user-plant-range-pad-zeros')?.checked;

        const start = parseInt(rawStart, 10);
        const end = parseInt(rawEnd, 10);

        if (isNaN(start) || isNaN(end) || start > end) {
          throw new Error('Dải số thứ tự không hợp lệ (số bắt đầu phải <= số kết thúc)!');
        }

        const plotVal = normalizePlotName(document.getElementById('user-plant-plot')?.value || '');
        const rowVal = parseInt(document.getElementById('user-plant-row')?.value, 10) || 1;
        const locationVal = plotVal ? `${plotVal} - Hàng ${rowVal}` : (document.getElementById('user-plant-location')?.value || '');

        payload = {
          farm_id: parseInt(farmId, 10),
          plant_type: plantType,
          plant_variety: plantVariety,
          planting_date: plantingDate,
          plant_age: plantAge,
          health_status: healthStatus,
          location: locationVal,
          plot_code: plotVal || undefined,
          row_number: rowVal || undefined,
          latitude,
          longitude,
          is_public: isPublic,
          start_num: start,
          end_num: end,
          prefix,
          pad_zeros: !!padZeros,
          initial_yield: initialYield,
          past_diseases: pastDiseases,
          data: {
            initial_yield: initialYield,
            past_diseases: pastDiseases
          }
        };
      }

      const res = await api('/plants/batch-range', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // Upload photos for any matrix trees that had photos attached
      if (_userPlantMatrix && _userPlantMatrix.length > 0 && res && res.inserted_ids) {
        const token = localStorage.getItem('token') || localStorage.getItem('pb_token');
        const uploadPromises = [];
        _userPlantMatrix.forEach((item, idx) => {
          if (item.photo_file && res.inserted_ids[idx]) {
            const pId = res.inserted_ids[idx];
            const formData = new FormData();
            formData.append('files', item.photo_file);
            formData.append('growth_stage', item.growth_stage || 'Xuống giống / Cây con');
            uploadPromises.push(
              fetch(`/api/plants/${pId}/growth-photo`, {
                method: 'POST',
                headers: {
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: formData
              }).catch(err => console.warn(`[Batch Matrix] Error uploading photo for tree #${pId}:`, err))
            );
          }
        });
        if (uploadPromises.length > 0) {
          await Promise.allSettled(uploadPromises);
        }
      }

      const successMsg = res.message || `Đã tạo thành công ${res.count || (_userPlantMatrix.length || 'hàng loạt')} cây!`;
      if (typeof toast === 'function') toast(successMsg, 'success');
      else if (window.toast) window.toast(successMsg, 'success');
    } else {
      const treeCode = (document.getElementById('user-plant-tree-code')?.value || '').trim();
      const nfcUid = (document.getElementById('user-plant-nfc-uid')?.value || '').trim().toUpperCase();
      const plotVal = normalizePlotName(document.getElementById('user-plant-plot')?.value || '');
      const rowVal = parseInt(document.getElementById('user-plant-row')?.value, 10) || 1;
      const compositeLocation = plotVal ? `${plotVal} - Hàng ${rowVal}` : (document.getElementById('user-plant-location')?.value || '');

      const payload = {
        farm_id: parseInt(farmId, 10),
        plant_type: plantType,
        plant_variety: plantVariety,
        planting_date: plantingDate,
        plant_age: plantAge,
        health_status: healthStatus,
        location: compositeLocation,
        plot_code: plotVal || undefined,
        row_number: rowVal || undefined,
        latitude,
        longitude,
        is_public: isPublic,
        tree_code: treeCode || undefined,
        nfc_uid: nfcUid || undefined,
        initial_yield: initialYield,
        past_diseases: pastDiseases,
        data: {
          initial_yield: initialYield,
          past_diseases: pastDiseases
        }
      };

      const res = await api('/plants', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // Upload single plant initial photo if provided
      if (_singlePlantPhotoFile && res && res.id) {
        try {
          const token = localStorage.getItem('token') || localStorage.getItem('pb_token');
          const formData = new FormData();
          formData.append('files', _singlePlantPhotoFile);
          const stage = document.getElementById('user-single-photo-growth-stage')?.value || 'Xuống giống / Cây con';
          formData.append('growth_stage', stage);

          await fetch(`/api/plants/${res.id}/growth-photo`, {
            method: 'POST',
            headers: {
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: formData
          });
        } catch (uploadErr) {
          console.warn('[Single Plant] Error uploading initial growth photo:', uploadErr);
        }
      }

      const successMsg = `Đã tạo cây ${res.tree_code || ''} thành công!`;
      if (typeof toast === 'function') toast(successMsg, 'success');
      else if (window.toast) window.toast(successMsg, 'success');
    }

    closeUserCreatePlantModal();

    // Reload Dashboard & plants data
    if (window.loadUserDashboard) {
      await window.loadUserDashboard();
    }
    // If inside active farm detail view, refresh view
    if (_activeFarmId && window.openFarmDetailView) {
      window.openFarmDetailView(_activeFarmId, false);
    }
  } catch (err) {
    console.error('Lỗi khi thêm cây:', err);
    const errMsg = 'Lỗi khi thêm cây: ' + err.message;
    if (typeof toast === 'function') toast(errMsg, 'error');
    else if (window.toast) window.toast(errMsg, 'error');
    else alert(errMsg);
  } finally {
    if (btn) {
      btn.innerHTML = originalBtnText || '<i data-lucide="plus-circle" class="lucide-sm"></i> <span>Lưu Cây Trồng</span>';
      btn.disabled = false;
    }
  }
}
window.submitUserCreatePlant = submitUserCreatePlant;

// ── Enterprise Plant Profile Modal Controller (Bảo toàn GPS 100%) ──
// [Modularized] ERP Plant Profile Modal & Growth Gallery moved to plants-profile-erp.js
export { openPlantProfileModal, closePlantProfileModal, switchErpProfileTab, onErpProfileCareClick, onErpProfileNfcClick, _renderGrowthPhotoGallery, openErpUploadGrowthPhotoModal, closeErpUploadGrowthPhotoModal, onErpGrowthModalFileChange, submitErpGrowthPhoto } from './plants-profile-erp.js';