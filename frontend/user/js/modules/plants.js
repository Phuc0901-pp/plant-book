/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/plants.js — Plant list rendering & search filter
   ═══════════════════════════════════════════════════════════════ */

import { esc, healthBadge } from '../core/utils.js';

// ── State (chia sẻ với các module khác qua getter) ──────────
let _plantsCache = [];

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

// ── Render ────────────────────────────────────────────────────

/**
 * Render danh sách trang trại ở Trang chủ.
 * @param {Array} farms
 */
export function renderUserFarmsList(farms) {
  const container = document.getElementById('user-farms-container');
  if (!container) return;
  if (!farms.length) {
    container.innerHTML = '<div class="empty-state" style="padding:12px"><p>Bạn chưa được gán phụ trách trang trại nào.</p></div>';
    return;
  }
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
  tbody.innerHTML = plants.slice(0, 3).map(p => _plantRow(p)).join('');
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
  tbody.innerHTML = plants.map(p => _plantRow(p)).join('');
}

/**
 * Tạo HTML một hàng cây trồng trong bảng.
 * @private
 */
function _plantRow(p) {
  return `
    <tr>
      <td data-label="Mã cây"><div><strong>${esc(p.tree_code || p.id)}</strong></div></td>
      <td data-label="Loại & Giống">
        <div>
          <strong>${esc(p.plant_type)}</strong>
          ${p.plant_variety ? `<br><small style="color:var(--gray-400)">${esc(p.plant_variety)}</small>` : ''}
        </div>
      </td>
      <td data-label="Tuổi cây"><div>${esc(p.plant_age || '—')}</div></td>
      <td data-label="Sức khỏe"><div>${healthBadge(p.health_status)}</div></td>
      <td data-label="Vị trí"><div>${esc(p.location || '—')}</div></td>
      <td data-label="Thao tác">
        <button class="btn btn-secondary btn-xs" onclick="openCareModal(${p.id},'${esc(p.tree_code || p.id)}','${esc(p.plant_type)}')">
          <i class="fa-solid fa-file-signature"></i> Nhật ký
        </button>
      </td>
    </tr>`;
}

// ── Search / Filter ───────────────────────────────────────────

/**
 * Lọc danh sách cây theo từ khoá nhập vào #user-plant-search.
 * Kết quả được render vào bảng đầy đủ.
 */
export function filterUserPlants() {
  const query = (document.getElementById('user-plant-search')?.value || '').trim().toLowerCase();
  if (!query) {
    renderUserPlantsTable(_plantsCache);
    return;
  }
  const filtered = _plantsCache.filter(p =>
    [p.tree_code, String(p.id), p.plant_type, p.plant_variety, p.location]
      .some(v => (v || '').toLowerCase().includes(query))
  );
  renderUserPlantsTable(filtered);
}
