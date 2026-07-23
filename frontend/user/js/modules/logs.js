/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/logs.js — Care log rendering, grouping, search & filters
   ═══════════════════════════════════════════════════════════════ */

import { esc, formatDate } from '../core/utils.js';
import { buildMediaThumbnailsHtml } from './media.js';

// ── State ─────────────────────────────────────────────────────
let _logsCache = [];
let _diseaseOnlyFilterActive = false;

/**
 * Cập nhật cache nhật ký (30 ngày).
 * @param {Array} logs
 */
export function setLogsCache(logs) {
  _logsCache = logs;
}

/** Lấy cache nhật ký hiện tại */
export function getLogsCache() {
  return _logsCache;
}

/**
 * Nạp danh sách trang trại vào dropdown #user-log-filter-farm
 * @param {Array} farms
 */
export function populateLogFarmFilter(farms) {
  const sel = document.getElementById('user-log-filter-farm');
  if (!sel) return;
  sel.innerHTML = `<option value="all">🏡 Tất cả trang trại</option>`
    + (farms || []).map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
}

/** Bật/tắt bộ lọc nhanh "Chỉ cây bệnh" */
export function toggleDiseaseOnlyFilter() {
  _diseaseOnlyFilterActive = !_diseaseOnlyFilterActive;
  const btn = document.getElementById('user-log-disease-toggle');
  if (btn) {
    if (_diseaseOnlyFilterActive) {
      btn.style.background = '#dc2626';
      btn.style.color = '#ffffff';
      btn.style.borderColor = '#b91c1c';
      btn.style.boxShadow = '0 2px 8px rgba(220,38,38,0.3)';
    } else {
      btn.style.background = '#fff1f2';
      btn.style.color = '#dc2626';
      btn.style.borderColor = '#fca5a5';
      btn.style.boxShadow = 'none';
    }
  }
  filterUserLogs();
}
window.toggleDiseaseOnlyFilter = toggleDiseaseOnlyFilter;

// ── Grouping Algorithm ────────────────────────────────────────

/**
 * Gom nhóm các nhật ký canh tác theo Ngày + Loại hoạt động + Nông trại.
 * - Ngoại trừ 'Bệnh cây' (giữ nguyên từng dòng riêng biệt).
 * - Nếu gom được tất cả cây thuộc nông trại/nông hộ -> Hiển thị "Toàn vườn [Tên vườn]".
 * - Nếu gom được nhiều cây -> Hiển thị "Cây #1, #2, #4".
 */
export function groupCareLogs(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return [];

  const grouped = [];
  const regularGroups = new Map();

  for (const log of logs) {
    // Bệnh cây: Không gom nhóm, giữ nguyên dòng riêng biệt
    if (log.log_type === 'Bệnh cây') {
      grouped.push({
        ...log,
        isDiseaseLog: true,
        targetDisplay: `Cây #${log.tree_code || log.plant_id}${log.farm_name ? ' (' + log.farm_name + ')' : ''}`
      });
      continue;
    }

    const dateStr = log.log_date ? new Date(log.log_date).toISOString().slice(0, 10) : '';
    const detailsKey = JSON.stringify(log.details || {});
    const key = `${dateStr}_${log.log_type}_${log.farm_id || 0}_${log.created_by || 0}_${detailsKey}_${log.note || ''}`;

    if (!regularGroups.has(key)) {
      regularGroups.set(key, {
        baseLog: log,
        plantsMap: new Map(),
        farmId: log.farm_id,
        farmName: log.farm_name
      });
    }

    const groupObj = regularGroups.get(key);
    groupObj.plantsMap.set(log.plant_id, log.tree_code || String(log.plant_id));
  }

  for (const [key, groupObj] of regularGroups.entries()) {
    const log = { ...groupObj.baseLog };
    const plantIds = Array.from(groupObj.plantsMap.keys());
    const treeCodes = Array.from(groupObj.plantsMap.values());

    treeCodes.sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

    const allPlants = window._allPlantsCache || [];
    let farmPlantsCount = 0;
    if (groupObj.farmId) {
      farmPlantsCount = allPlants.filter(p => p.farm_id == groupObj.farmId).length;
    } else {
      farmPlantsCount = allPlants.length;
    }

    let targetDisplay = '';
    if (farmPlantsCount > 0 && plantIds.length >= farmPlantsCount) {
      targetDisplay = `Toàn vườn${groupObj.farmName ? ' ' + groupObj.farmName : ''}`;
    } else if (treeCodes.length > 1) {
      targetDisplay = `Cây #${treeCodes.join(', #')}${groupObj.farmName ? ' (' + groupObj.farmName + ')' : ''}`;
    } else {
      targetDisplay = `Cây #${treeCodes[0] || log.plant_id}${groupObj.farmName ? ' (' + groupObj.farmName + ')' : ''}`;
    }

    log.targetDisplay = targetDisplay;
    log.isGrouped = treeCodes.length > 1 || targetDisplay.startsWith('Toàn vườn');
    log.groupedPlantCount = treeCodes.length;

    grouped.push(log);
  }

  grouped.sort((a, b) => {
    const timeA = new Date(a.log_date).getTime();
    const timeB = new Date(b.log_date).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return (b.id || 0) - (a.id || 0);
  });

  return grouped;
}

// ── Render ────────────────────────────────────────────────────

/**
 * Render tóm tắt tối đa 3 dòng nhật ký gần đây ở Trang chủ.
 * @param {Array} logs — nhật ký 3 ngày gần nhất
 */
export function renderUserLogsTable(logs) {
  const tbody   = document.getElementById('user-logs-table');
  const moreWrap = document.getElementById('user-logs-more-btn-wrap');
  if (!tbody) return;

  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-clipboard-list"></i><p>Không có hoạt động canh tác nào trong 3 ngày qua</p></td></tr>';
    if (moreWrap) moreWrap.style.display = 'none';
    return;
  }

  const grouped = groupCareLogs(logs);

  if (moreWrap) moreWrap.style.display = grouped.length > 3 ? 'block' : 'none';

  tbody.innerHTML = grouped.slice(0, 3).map(l => _logRow(l)).join('');
}

/**
 * Render toàn bộ nhật ký 30 ngày ở tab Lịch sử.
 * @param {Array} logs
 */
export function renderUserLogsTableFull(logs) {
  const tbody = document.getElementById('user-logs-table-full');
  if (!tbody) return;
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-clipboard-list"></i><p>Không tìm thấy hoạt động nào được ghi nhận</p></td></tr>';
    return;
  }
  tbody.innerHTML = logs.map(l => _logRow(l)).join('');
}

/**
 * Tạo HTML một hàng nhật ký.
 * Nổi bật màu đỏ rực đối với Bệnh cây.
 * @private
 */
function _logRow(l) {
  let detailsStr = esc(l.note || '');
  if (l.details && Object.keys(l.details).length > 0) {
    const parts = [];
    if (l.details.method)          parts.push(`Cách: ${l.details.method}`);
    if (l.details.amount)          parts.push(`Lượng: ${l.details.amount} ${l.details.unit || ''}`);
    if (l.details.fertilizer_name) parts.push(`Phân: ${l.details.fertilizer_name}`);
    if (l.details.pesticide_name)  parts.push(`Thuốc: ${l.details.pesticide_name}`);
    if (l.details.reason)          parts.push(`Lý do: ${l.details.reason}`);
    if (l.details.disease_name)    parts.push(`Bệnh: ${l.details.disease_name}`);
    if (l.details.severity)        parts.push(`Mức độ: ${l.details.severity}`);
    if (parts.length > 0) {
      detailsStr = `<span style="${l.log_type === 'Bệnh cây' ? 'color:#991b1b;font-weight:700;' : 'color:var(--green)'}">[${parts.join(', ')}]</span>` + (l.note ? ` - ${esc(l.note)}` : '');
    }
  }

  const mediaHtml = l.log_type === 'Bệnh cây'
    ? buildMediaThumbnailsHtml(l.media_urls, 40)
    : '';

  // ── Xử lý giao diện màu đỏ rực cho CÂY BỆNH ──
  if (l.isDiseaseLog || l.log_type === 'Bệnh cây') {
    return `
      <tr style="background: linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%); border-left: 4px solid #ef4444;">
        <td data-label="Thời gian"><div style="font-weight:600; color:#991b1b;">${formatDate(l.log_date)}</div></td>
        <td data-label="Cây trồng">
          <div style="font-weight:700; color:#dc2626;">
            <i class="fa-solid fa-triangle-exclamation" style="color:#ef4444; margin-right:4px;"></i>
            ${esc(l.targetDisplay || `Cây #${l.tree_code || l.plant_id}`)}
            <small style="color:#b91c1c; display:block; font-weight:500;">(${esc(l.plant_type || '')})</small>
          </div>
        </td>
        <td data-label="Hoạt động">
          <div>
            <span class="badge" style="background:#dc2626; color:#ffffff; font-weight:700; box-shadow:0 2px 8px rgba(220,38,38,0.35); text-transform:none; padding:4px 10px; border-radius:6px; font-size:12px;">
              🐛 Bệnh cây
            </span>
          </div>
        </td>
        <td data-label="Chi tiết / Ghi chú">
          <div style="color:#7f1d1d; font-weight:600;">
            ${detailsStr}${mediaHtml}
          </div>
        </td>
        <td data-label="Người thực hiện"><div><small style="color:#991b1b; font-weight:600;">${esc(l.creator_name || 'Khách/Nông hộ')}</small></div></td>
        <td data-label="Thao tác">
          <div>
            <button class="btn btn-secondary btn-xs" onclick="openCareModal(${l.plant_id}, '${esc(l.tree_code || l.plant_id)}', '${esc(l.plant_type)}', ${l.id})" style="gap:4px; padding:6px 10px; border-color:#fca5a5; color:#dc2626;">
              <i class="fa-solid fa-pen-to-square" style="color:#dc2626"></i> Sửa
            </button>
          </div>
        </td>
      </tr>`;
  }

  const badgeMap = {
    'Tưới nước': 'badge-blue',
    'Bón phân':  'badge-brown',
    'Phun thuốc': 'badge-purple',
    'Cắt lá':    'badge-green',
    'Tỉa hoa':   'badge-amber'
  };
  const badgeClass = badgeMap[l.log_type] || 'badge-gray';

  const plantText = l.targetDisplay ? esc(l.targetDisplay) : `Cây #${l.tree_code || l.plant_id}`;

  return `
    <tr>
      <td data-label="Thời gian"><div>${formatDate(l.log_date)}</div></td>
      <td data-label="Cây trồng"><div><strong>${plantText}</strong> <small style="color:var(--gray-400)">(${esc(l.plant_type || '')})</small></div></td>
      <td data-label="Hoạt động"><div><span class="badge ${badgeClass}" style="text-transform:none;font-weight:500;">${esc(l.log_type)}</span></div></td>
      <td data-label="Chi tiết / Ghi chú"><div>${detailsStr}${mediaHtml}</div></td>
      <td data-label="Người thực hiện"><div><small>${esc(l.creator_name || 'Khách/Nông hộ')}</small></div></td>
      <td data-label="Thao tác">
        <div>
          <button class="btn btn-secondary btn-xs" onclick="openCareModal(${l.plant_id}, '${esc(l.tree_code || l.plant_id)}', '${esc(l.plant_type)}', ${l.id})" style="gap:4px; padding:6px 10px;">
            <i class="fa-solid fa-pen-to-square" style="color:var(--green)"></i> Sửa
          </button>
        </div>
      </td>
    </tr>`;
}

// ── Search / Filter / Sort ────────────────────────────────────

/**
 * Lọc và sắp xếp nhật ký canh tác ở tab Lịch sử.
 * Hỗ trợ lọc Trang trại, loại hoạt động, nút xem cây bệnh và kiểu sắp xếp.
 */
export function filterUserLogs() {
  const query       = (document.getElementById('user-log-search')?.value || '').trim().toLowerCase();
  const farmId      = document.getElementById('user-log-filter-farm')?.value || 'all';
  const filterType  = document.getElementById('user-log-filter-type')?.value || 'all';
  const sortBy      = document.getElementById('user-log-sort-by')?.value || 'date_desc';

  let filtered = [..._logsCache];

  // 1. Lọc theo Trang trại
  if (farmId !== 'all') {
    filtered = filtered.filter(l => String(l.farm_id) === farmId);
  }

  // 2. Lọc theo Loại hoạt động
  if (filterType !== 'all') {
    filtered = filtered.filter(l => l.log_type === filterType);
  }

  // 3. Lọc nút nhanh "Chỉ Cây bệnh"
  if (_diseaseOnlyFilterActive) {
    filtered = filtered.filter(l => l.log_type === 'Bệnh cây');
  }

  // 4. Tìm kiếm từ khóa
  if (query) {
    filtered = filtered.filter(l => {
      const detailsStr = l.details ? JSON.stringify(l.details).toLowerCase() : '';
      return [String(l.plant_id), String(l.tree_code || ''), l.farm_name, l.note, l.log_type, l.creator_name, detailsStr]
        .some(v => (v || '').toLowerCase().includes(query));
    });
  }

  // 5. Gom nhóm các nhật ký phù hợp
  let resultList = groupCareLogs(filtered);

  // 6. Sắp xếp (Sorting)
  resultList.sort((a, b) => {
    if (sortBy === 'date_desc') {
      const tA = new Date(a.log_date).getTime();
      const tB = new Date(b.log_date).getTime();
      if (tB !== tA) return tB - tA;
      return (b.id || 0) - (a.id || 0);
    } else if (sortBy === 'date_asc') {
      const tA = new Date(a.log_date).getTime();
      const tB = new Date(b.log_date).getTime();
      if (tA !== tB) return tA - tB;
      return (a.id || 0) - (b.id || 0);
    } else if (sortBy === 'disease_first') {
      const isDiseaseA = a.log_type === 'Bệnh cây';
      const isDiseaseB = b.log_type === 'Bệnh cây';
      if (isDiseaseA && !isDiseaseB) return -1;
      if (!isDiseaseA && isDiseaseB) return 1;
      return new Date(b.log_date).getTime() - new Date(a.log_date).getTime();
    } else if (sortBy === 'plant_asc') {
      const codeA = parseInt(a.tree_code || a.plant_id) || a.plant_id;
      const codeB = parseInt(b.tree_code || b.plant_id) || b.plant_id;
      return codeA - codeB;
    } else if (sortBy === 'activity_asc') {
      return (a.log_type || '').localeCompare(b.log_type || '', 'vi');
    }
    return 0;
  });

  renderUserLogsTableFull(resultList);
}
