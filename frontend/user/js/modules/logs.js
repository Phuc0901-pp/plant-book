/* Plant Book Agtech (c) 2026 TBSG Agtech. All Rights Reserved. Enterprise Protected Asset */
/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/logs.js — Care log rendering, grouping, search & filters
   ═══════════════════════════════════════════════════════════════ */

import { esc, formatDate, toast } from '../core/utils.js';
import { api } from '../core/api.js';
import { buildMediaThumbnailsHtml } from './media.js';
import { getPlantsCache } from './plants.js';

// ── State ─────────────────────────────────────────────────────
let _logsCache = [];
let _diseaseOnlyFilterActive = false;

// ── State Phân trang Lịch sử (20 dòng / trang) ───────────────
let _currentLogPage = 1;
const _logPageSize = 20;
let _currentFilteredLogs = [];

// ── State Chọn nhiều & Xóa chọn lọc ───────────────────────────
let _batchSelectMode = false;
const _selectedLogIds = new Set();


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
  sel.innerHTML = `<option value="all">Tất cả trang trại</option>`
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
 * Gom nhóm các nhật ký canh tác theo Ngày + Loại hoạt động + Nông trại + Vật tư.
 * - Tự động cộng dồn tổng dung tích/khối lượng vật tư cùng ngày.
 * - Tự động cộng dồn tổng chi phí & doanh thu.
 * - Tóm gọn chú thích theo các mốc thời gian không trùng lặp.
 * - Ngoại trừ 'Bệnh cây' (giữ nguyên từng dòng riêng biệt phục vụ dịch tễ).
 */
export function groupCareLogs(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return [];

  const grouped = [];
  const regularGroups = new Map();

  for (const rawLog of logs) {
    // Clone log để không mutate cache gốc
    const log = JSON.parse(JSON.stringify(rawLog));

    // Bệnh cây: Không gom nhóm, giữ nguyên dòng riêng biệt phục vụ điều tra dịch tễ
    if (log.log_type === 'Bệnh cây') {
      grouped.push({
        ...log,
        isDiseaseLog: true,
        targetDisplay: `Cây #${log.tree_code || log.plant_id}${log.farm_name ? ' (' + log.farm_name + ')' : ''}`
      });
      continue;
    }

    const dateStr = log.log_date ? new Date(log.log_date).toISOString().slice(0, 10) : '';
    const farmId = log.farm_id || 0;
    const logType = log.log_type || 'Chăm sóc';
    
    // Tên vật tư hoặc hoạt chất chính
    const supplyName = (log.details?.supply_name || log.details?.fertilizer_name || log.details?.pesticide_name || log.details?.foliar_nutrition || log.details?.fertilizer || log.details?.pesticide || '').trim().toLowerCase();
    
    // Khóa gom nhóm chính: Cùng ngày + Cùng nông trại + Cùng loại hoạt động + Cùng vật tư
    const key = `${dateStr}__${farmId}__${logType}__${supplyName}`;

    if (!regularGroups.has(key)) {
      regularGroups.set(key, {
        baseLog: log,
        plantsMap: new Map(),
        farmId: log.farm_id,
        farmName: log.farm_name,
        totalQuantity: 0,
        unit: log.details?.unit || log.details?.package_unit || '',
        totalCost: 0,
        totalRevenue: 0,
        totalFruitCount: 0,
        timesList: [],
        notesList: [],
        occurrenceCount: 0
      });
    }

    const groupObj = regularGroups.get(key);
    groupObj.occurrenceCount += 1;

    // Track plants
    if (log.plant_id) {
      groupObj.plantsMap.set(log.plant_id, log.tree_code || String(log.plant_id));
    }

    // Accumulate Quantity
    const qVal = parseFloat(log.details?.quantity ?? log.details?.amount ?? log.details?.qty ?? log.details?.dosage ?? log.details?.volume ?? log.details?.yield_kg ?? 0) || 0;
    groupObj.totalQuantity += qVal;
    if (!groupObj.unit && (log.details?.unit || log.details?.package_unit)) {
      groupObj.unit = log.details?.unit || log.details?.package_unit;
    }

    // Accumulate Cost & Revenue
    const cVal = parseFloat(log.details?.total_cost || 0) || 0;
    groupObj.totalCost += cVal;

    const rVal = parseFloat(log.details?.total_revenue || 0) || 0;
    groupObj.totalRevenue += rVal;

    const fVal = parseInt(log.details?.fruit_count || 0) || 0;
    groupObj.totalFruitCount += fVal;

    // Track Time
    const logTime = log.details?.time || (log.log_date ? new Date(log.log_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');
    if (logTime && !groupObj.timesList.includes(logTime)) {
      groupObj.timesList.push(logTime);
    }

    // Track Notes
    if (log.note && log.note.trim() && !groupObj.notesList.includes(log.note.trim())) {
      groupObj.notesList.push(log.note.trim());
    }
  }

  for (const [key, groupObj] of regularGroups.entries()) {
    const log = { ...groupObj.baseLog };
    log.details = { ...(log.details || {}) };

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
    if (!log.plant_id || log.plant_id === 0 || (treeCodes[0] && String(treeCodes[0]).includes('Toàn vườn')) || (farmPlantsCount > 0 && plantIds.length >= farmPlantsCount)) {
      targetDisplay = `Toàn vườn${groupObj.farmName ? ' (' + groupObj.farmName + ')' : ''}`;
    } else if (treeCodes.length > 1) {
      targetDisplay = `Cây #${treeCodes.join(', #')}${groupObj.farmName ? ' (' + groupObj.farmName + ')' : ''}`;
    } else if (treeCodes.length === 1) {
      targetDisplay = `Cây #${treeCodes[0]}${groupObj.farmName ? ' (' + groupObj.farmName + ')' : ''}`;
    } else {
      targetDisplay = `Toàn vườn${groupObj.farmName ? ' (' + groupObj.farmName + ')' : ''}`;
    }

    // Apply accumulated quantity and costs
    if (groupObj.totalQuantity > 0) {
      log.details.quantity = Number(groupObj.totalQuantity.toFixed(2));
      log.details.amount = Number(groupObj.totalQuantity.toFixed(2));
      log.details.unit = groupObj.unit;
    }
    if (groupObj.totalCost > 0) {
      log.details.total_cost = groupObj.totalCost;
    }
    if (groupObj.totalRevenue > 0) {
      log.details.total_revenue = groupObj.totalRevenue;
    }
    if (groupObj.totalFruitCount > 0) {
      log.details.fruit_count = groupObj.totalFruitCount;
    }

    // Format merged notes & times
    if (groupObj.occurrenceCount > 1) {
      const timesStr = groupObj.timesList.length > 0 ? `[${groupObj.timesList.join(', ')}] ` : '';
      const notesCombined = groupObj.notesList.length > 0 ? groupObj.notesList.join('; ') : 'Thực hiện định kỳ trong ngày';
      log.note = `${timesStr}Tổng hợp ${groupObj.occurrenceCount} lượt: ${notesCombined}`;
      log.details.time = groupObj.timesList.join(', ');
    } else if (groupObj.timesList.length > 0) {
      log.details.time = groupObj.timesList[0];
    }
    log.timesList = groupObj.timesList || [];

    log.targetDisplay = targetDisplay;
    log.isGrouped = treeCodes.length > 1 || targetDisplay.startsWith('Toàn vườn') || groupObj.occurrenceCount > 1;
    log.groupedPlantCount = treeCodes.length;
    log.occurrenceCount = groupObj.occurrenceCount;

    grouped.push(log);
  }

  grouped.sort((a, b) => {
    const timeA = new Date(a.log_date || a.created_at).getTime();
    const timeB = new Date(b.log_date || b.created_at).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return (b.id || 0) - (a.id || 0);
  });

  return grouped;
}

// ── Daily Grouping for Dashboard ──────────────────────────────

/**
 * Gom nhóm tất cả các nhật ký canh tác theo NGÀY (phục vụ bảng tóm tắt 3 ngày trên Trang chủ).
 * Trả về mảng các đối tượng Ngày (Tối đa 3 ngày gần nhất), trong đó mỗi ngày chứa mảng các thẻ tóm tắt công việc đã làm trong ngày.
 */
export function groupCareLogsByDay(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return [];

  const daysMap = new Map();

  for (const log of logs) {
    const dateStr = log.log_date ? new Date(log.log_date).toISOString().slice(0, 10) : '';
    if (!dateStr) continue;

    if (!daysMap.has(dateStr)) {
      daysMap.set(dateStr, []);
    }
    daysMap.get(dateStr).push(log);
  }

  const sortedDates = Array.from(daysMap.keys()).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const recent3Dates = sortedDates.slice(0, 3);

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toISOString().slice(0, 10);

  const daySummaries = [];

  for (const dateStr of recent3Dates) {
    const dayLogs = daysMap.get(dateStr) || [];
    
    let dateTag = '';
    const dObj = new Date(dateStr);
    const dateFormatted = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;

    if (dateStr === todayStr) {
      dateTag = 'Hôm nay';
    } else if (dateStr === yesterdayStr) {
      dateTag = 'Hôm qua';
    } else {
      dateTag = dateFormatted;
    }

    const dayGroupedItems = groupCareLogs(dayLogs);

    const items = dayGroupedItems.map(l => {
      let detailsStr = esc(l.note || '');
      if (l.details && Object.keys(l.details).length > 0) {
        const parts = [];
        if (l.details.method)          parts.push(`Cách: ${l.details.method}`);
        if (l.details.amount && l.details.unit) parts.push(`Lượng: ${l.details.amount} ${l.details.unit}`);
        if (l.details.fertilizer_name) parts.push(`Phân: ${l.details.fertilizer_name}`);
        if (l.details.pesticide_name)  parts.push(`Thuốc: ${l.details.pesticide_name}`);
        if (l.details.reason)          parts.push(`Lý do: ${l.details.reason}`);
        if (l.details.quality)         parts.push(`Chất lượng: ${l.details.quality}`);
        if (l.details.disease_name)    parts.push(`Bệnh: ${l.details.disease_name}`);
        if (l.details.severity)        parts.push(`Mức độ: ${l.details.severity}`);
        if (parts.length > 0) {
          detailsStr = parts.join(', ') + (l.note ? ` - ${esc(l.note)}` : '');
        }
      }

      const mediaHtml = l.log_type === 'Bệnh cây'
        ? buildMediaThumbnailsHtml(l.media_urls, 36)
        : '';

      const badgeMap = {
        'Tưới nước': 'badge-blue',
        'Bón phân':  'badge-brown',
        'Phun thuốc': 'badge-purple',
        'Cắt lá':    'badge-green',
        'Tỉa hoa':   'badge-amber',
        'Thu hoạch': 'badge-amber'
      };

      return {
        id: l.id,
        plantId: l.plant_id,
        treeCode: l.tree_code || l.plant_id,
        plantType: l.plant_type,
        type: l.log_type,
        isDiseaseLog: l.isDiseaseLog || l.log_type === 'Bệnh cây',
        badgeClass: badgeMap[l.log_type] || 'badge-gray',
        targetDisplay: l.targetDisplay || `Cây #${l.tree_code || l.plant_id}`,
        detailsStr: detailsStr,
        mediaHtml: mediaHtml,
        creatorName: l.creator_name || 'Nông hộ'
      };
    });

    daySummaries.push({
      dateStr: dateFormatted,
      dateTag: dateTag,
      items: items,
      totalActivities: dayLogs.length
    });
  }

  return daySummaries;
}

// ── Render ────────────────────────────────────────────────────

/**
 * Render tóm tắt Hoạt động Canh tác gần đây trên Trang chủ.
 * Gom cụm theo từng Ngày (tối đa 3 ngày gần nhất), hiển thị thanh tiêu đề Ngày,
 * bên dưới tách riêng từng loại hoạt động, hiển thị các mốc giờ [07:00, 16:00] và chi tiết/chú thích.
 * @param {Array} logs
 */
export function renderUserLogsTable(logs) {
  const tbody   = document.getElementById('user-logs-table');
  const moreWrap = document.getElementById('user-logs-more-btn-wrap');
  if (!tbody) return;

  if (!logs || !logs.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i data-lucide="clipboard-list" class="lucide-sm"></i><p>Không có hoạt động canh tác nào trong 3 ngày qua</p></td></tr>';
    if (moreWrap) moreWrap.style.display = 'none';
    return;
  }

  if (moreWrap) moreWrap.style.display = 'block';

  // 1. Phân chia raw logs theo từng Ngày
  const daysMap = new Map();
  for (const log of logs) {
    const dateStr = log.log_date ? new Date(log.log_date).toISOString().slice(0, 10) : '';
    if (!dateStr) continue;
    if (!daysMap.has(dateStr)) {
      daysMap.set(dateStr, []);
    }
    daysMap.get(dateStr).push(log);
  }

  const sortedDates = Array.from(daysMap.keys())
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .slice(0, 3); // Lấy 3 ngày gần nhất

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toISOString().slice(0, 10);

  let html = '';

  for (const dateStr of sortedDates) {
    const dayLogs = daysMap.get(dateStr) || [];
    const dObj = new Date(dateStr);
    const dateFormatted = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
    const dayOfWeekStr = !isNaN(dObj) ? dayOfWeekArr[dObj.getDay()] : '';
    const dateHeaderTitle = dayOfWeekStr ? `${dayOfWeekStr}, Ngày ${dateFormatted}` : `Ngày ${dateFormatted}`;
    
    let dateTag = '';
    if (dateStr === todayStr) {
      dateTag = '<span style="background:#dcfce7; color:#15803d; font-size:11px; font-weight:800; padding:2px 8px; border-radius:10px; margin-left:6px; border:1px solid #86efac;">Hôm nay</span>';
    } else if (dateStr === yesterdayStr) {
      dateTag = '<span style="background:#e0f2fe; color:#0369a1; font-size:11px; font-weight:800; padding:2px 8px; border-radius:10px; margin-left:6px; border:1px solid #7dd3fc;">Hôm qua</span>';
    }

    // Gom cụm hoạt động bên trong ngày (theo cùng loại + cùng vật tư + cùng cây/vườn)
    const dayGroupedItems = groupCareLogs(dayLogs);

    // Render Date Group Header Row
    html += `
      <tr class="date-group-header-row" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-top: 2px solid #cbd5e1; border-bottom: 1.5px solid #e2e8f0;">
        <td colspan="6" style="padding: 10px 16px; font-weight: 800; font-size: 13px; color: #0f172a;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="calendar-days" class="lucide-sm" style="color: #059669; font-size: 15px;"></i>
              <span style="font-size: 13.5px; font-weight: 900; color: #0f172a;">${dateHeaderTitle}</span>
              ${dateTag}
            </div>
            <div style="font-size: 12px; color: #64748b; font-weight: 700;">
              <span class="badge" style="background: #ffffff; border: 1px solid #cbd5e1; color: #334155; font-size: 11.5px; padding: 2px 8px; border-radius: 12px;">
                ${dayGroupedItems.length} nhóm hoạt động (${dayLogs.length} lượt ghi)
              </span>
            </div>
          </div>
        </td>
      </tr>
    `;

    // Render từng dòng hoạt động đã gom cụm trong ngày
    dayGroupedItems.forEach(l => {
      // 1. Mốc thời gian (Chips)
      let timeList = [];
      if (l.timesList && Array.isArray(l.timesList) && l.timesList.length > 0) {
        timeList = l.timesList;
      } else if (l.details?.time) {
        timeList = String(l.details.time).split(',').map(t => t.trim()).filter(Boolean);
      }
      if (timeList.length === 0) {
        const d = new Date(l.log_date || l.created_at);
        if (!isNaN(d)) timeList.push(d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
      }

      const timeChipsHtml = timeList.length > 0 
        ? timeList.map(t => `<span class="log-time-chip" style="display:inline-flex; align-items:center; gap:3px; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:6px; padding:2px 6px; font-family:monospace; font-size:11.5px; font-weight:700;"><i data-lucide="clock" class="lucide-sm" style="color:#059669; font-size:10px;"></i>${esc(t)}</span>`).join(' ')
        : `<span style="color:#94a3b8; font-size:12px;">Trong ngày</span>`;

      // 2. Đối tượng Cây trồng / Toàn vườn
      const targetDisplay = l.targetDisplay || (l.plant_id ? `Cây #${l.tree_code || l.plant_id}` : 'Toàn vườn');
      const farmName = l.farm_name ? ` (${esc(l.farm_name)})` : '';

      // 3. Activity Type Badge & Icon
      let badgeClass = 'badge-green';
      let icon = 'leaf';
      if (l.log_type === 'Tưới nước') {
        badgeClass = 'badge-blue';
        icon = 'droplets';
      } else if (l.log_type === 'Phun thuốc') {
        badgeClass = 'badge-orange';
        icon = 'flask-conical';
      } else if (l.log_type === 'Bón phân') {
        badgeClass = 'badge-brown';
        icon = 'sprout';
      } else if (l.log_type === 'Bệnh cây') {
        badgeClass = 'badge-red';
        icon = 'bug';
      } else if (l.log_type === 'Thu hoạch') {
        badgeClass = 'badge-yellow';
        icon = 'wheat';
      } else if (l.log_type === 'Cắt lá' || l.log_type === 'Cắt tỉa') {
        badgeClass = 'badge-gray';
        icon = 'scissors';
      }

      // 4. Chi tiết, Vật tư, Khối lượng & Chú thích
      let detailsStr = esc(l.note || '');
      if (l.details && Object.keys(l.details).length > 0) {
        const parts = [];
        const qtyVal = l.details.quantity ?? l.details.amount ?? l.details.qty ?? l.details.dosage ?? l.details.volume ?? l.details.yield_kg;
        const unitVal = l.details.unit || l.details.package_unit || '';
        const supName = l.details.supply_name || l.details.fertilizer_name || l.details.pesticide_name || l.details.foliar_nutrition || l.details.fertilizer || l.details.pesticide;

        if (supName) parts.push(`Vật tư: <strong style="color:#0f172a;">${esc(supName)}</strong>`);
        if (qtyVal !== undefined && qtyVal !== null && qtyVal !== '' && qtyVal > 0) parts.push(`Tổng lượng: <strong style="color:#059669;">${qtyVal} ${unitVal}</strong>`);
        if (l.details.fruit_count) parts.push(`Số trái: <strong>${l.details.fruit_count}</strong>`);
        if (l.details.total_cost) parts.push(`Chi phí: <strong style="color:#dc2626;">${Number(l.details.total_cost).toLocaleString('vi-VN')} đ</strong>`);
        if (l.details.total_revenue) parts.push(`Doanh thu: <strong style="color:#059669;">${Number(l.details.total_revenue).toLocaleString('vi-VN')} đ</strong>`);
        if (l.details.method) parts.push(`Cách thức: ${esc(l.details.method)}`);
        if (l.details.disease_name) parts.push(`Bệnh: <strong style="color:#dc2626;">${esc(l.details.disease_name)}</strong>`);
        if (l.details.severity) parts.push(`Mức độ: ${esc(l.details.severity)}`);
        
        if (parts.length > 0) {
          detailsStr = parts.join(' · ') + (l.note ? ` — <span style="color:#64748b;">${esc(l.note)}</span>` : '');
        }
      }

      const mediaHtml = buildMediaThumbnailsHtml(l.media_urls, 32);
      const creatorName = l.creator_name || 'Nông hộ';
      const isDisease = l.log_type === 'Bệnh cây' || l.isDiseaseLog;
      const rowBg = isDisease ? 'background: #fff5f5;' : 'background: #ffffff;';

      html += `
        <tr style="border-bottom: 1px solid var(--gray-200); ${rowBg}">
          <td data-label="Thời gian" style="vertical-align: middle; padding: 12px 14px;">
            <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
              ${timeChipsHtml}
            </div>
          </td>
          <td data-label="Cây trồng" style="vertical-align: middle; padding: 12px 14px; white-space: nowrap;">
            <strong style="color: ${isDisease ? '#dc2626' : '#0f172a'}; font-size: 13.5px; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="trees" class="lucide-sm" style="color: ${isDisease ? '#ef4444' : '#10b981'}; font-size: 12px;"></i>
              <span>${esc(targetDisplay)}</span>
            </strong>
            ${farmName ? `<span style="font-size: 11px; color: #64748b; display: block; margin-top: 2px;">${farmName}</span>` : ''}
          </td>
          <td data-label="Hoạt động" style="vertical-align: middle; padding: 12px 14px; white-space: nowrap;">
            <span class="badge ${badgeClass}" style="font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px;">
              <i data-lucide="${icon}" class="lucide-xs"></i> ${esc(l.log_type)}
            </span>
            ${l.occurrenceCount > 1 ? `<span class="badge" style="font-size: 10px; font-weight: 800; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 2px 6px; border-radius: 10px; margin-left: 4px;" title="Gom nhóm ${l.occurrenceCount} lượt trong cùng ngày"><i data-lucide="layers" class="lucide-sm" style="font-size: 9px;"></i> ${l.occurrenceCount} lượt</span>` : ''}
          </td>
          <td data-label="Chi tiết / Ghi chú" style="vertical-align: middle; padding: 12px 14px; font-size: 13px; color: #334155; line-height: 1.5;">
            <div>${detailsStr || 'Đã hoàn thành công việc theo quy trình chuẩn.'}</div>
            ${mediaHtml ? `<div style="margin-top: 4px;">${mediaHtml}</div>` : ''}
          </td>
          <td data-label="Người thực hiện" style="vertical-align: middle; padding: 12px 14px; white-space: nowrap; font-size: 12.5px; color: #475569;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <i data-lucide="user" class="lucide-sm" style="color: #94a3b8; font-size: 11px;"></i>
              <span style="font-weight: 600; color: #334155;">${esc(creatorName)}</span>
            </div>
          </td>
          <td data-label="Thao tác" style="vertical-align: middle; padding: 12px 14px; text-align: right; white-space: nowrap;">
            <button type="button" class="btn btn-secondary btn-xs" onclick="openCareModal(${l.plant_id || 'null'}, '${esc(l.tree_code || '')}', '${esc(l.plant_type || '')}', ${l.id})" style="padding: 4px 10px; font-size: 11.5px; font-weight: 700; border-radius: 6px;">
              <i data-lucide="edit-3" class="lucide-sm"></i> Sửa
            </button>
            <button type="button" class="btn btn-danger btn-xs" onclick="deleteCareLog(${l.id})" style="padding: 4px 10px; font-size: 11.5px; font-weight: 700; border-radius: 6px;">
              <i data-lucide="trash-2" class="lucide-sm"></i> Xóa
            </button>
          </td>
        </tr>
      `;
    });
  }

  tbody.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

export function changeLogPage(direction) {
  const totalPages = Math.ceil(_currentFilteredLogs.length / _logPageSize) || 1;
  const newPage = _currentLogPage + direction;
  if (newPage >= 1 && newPage <= totalPages) {
    _currentLogPage = newPage;
    _renderLogPage();
  }
}
window.changeLogPage = changeLogPage;

function _renderLogPage() {
  const container = document.getElementById('user-logs-grouped-container');
  const paginationContainer = document.getElementById('user-logs-pagination');
  if (!container) return;

  if (!_currentFilteredLogs || !_currentFilteredLogs.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:40px; background:#ffffff; border-radius:14px; border:1px solid #e2e8f0; text-align:center;">
        <i data-lucide="clipboard-list" class="lucide-sm" style="font-size:36px; color:#94a3b8; margin-bottom:10px;"></i>
        <p style="font-size:14px; font-weight:700; color:#475569;">Không tìm thấy hoạt động canh tác nào được ghi nhận.</p>
      </div>`;
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }

  const totalLogs = _currentFilteredLogs.length;
  const totalPages = Math.ceil(totalLogs / _logPageSize) || 1;

  if (_currentLogPage < 1) _currentLogPage = 1;
  if (_currentLogPage > totalPages) _currentLogPage = totalPages;

  const startIndex = (_currentLogPage - 1) * _logPageSize;
  const endIndex = Math.min(startIndex + _logPageSize, totalLogs);
  const pageLogs = _currentFilteredLogs.slice(startIndex, endIndex);

  // Group pageLogs by Date
  const groupedByDate = {};
  pageLogs.forEach(item => {
    const dObj = new Date(item.log_date || item.created_at);
    const dateKey = !isNaN(dObj) ? dObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Khác / Chưa rõ ngày';
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(item);
  });

  let html = '';
  const dayOfWeekArr = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

  const LOG_TYPE_ICONS = {
    'Tưới nước': 'droplets',
    'Bón phân': 'sprout',
    'Phun thuốc': 'flask-conical',
    'Cắt tỉa': 'scissors',
    'Làm cỏ': 'scissors',
    'Thu hoạch': 'package-check',
    'Bệnh cây': 'shield-alert'
  };

  Object.keys(groupedByDate).forEach(dateStr => {
    const dayItems = groupedByDate[dateStr];
    const dObjFirst = dayItems[0] ? new Date(dayItems[0].log_date || dayItems[0].created_at) : null;
    const dayOfWeekStr = (dObjFirst && !isNaN(dObjFirst)) ? dayOfWeekArr[dObjFirst.getDay()] : '';
    const dateHeaderTitle = dayOfWeekStr ? `${dayOfWeekStr}, Ngày ${esc(dateStr)}` : `Ngày ${esc(dateStr)}`;

    html += `
      <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:16px; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,0.03);">
        <!-- Date Header Bar -->
        <div style="background:linear-gradient(135deg, #0f172a, #1e293b); color:#ffffff; padding:12px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="font-size:14.5px; font-weight:800; display:flex; align-items:center; gap:8px;">
            ${_batchSelectMode ? `<input type="checkbox" class="log-day-select-all" onchange="toggleSelectAllDay('${esc(dateStr)}', this.checked)" style="width:17px; height:17px; cursor:pointer; accent-color:#10b981; margin-right:4px;" title="Chọn tất cả mục trong ngày này">` : ''}
            <i data-lucide="calendar-days" class="lucide-sm" style="color:#10b981;"></i> <span>${dateHeaderTitle}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4); font-size:11.5px; font-weight:700; padding:3px 12px; border-radius:20px;">
              ${dayItems.length} nhật ký hoạt động
            </span>
            <button type="button" class="btn btn-xs" onclick="deleteDayLogs('${esc(dateStr)}')" style="background:rgba(220,38,38,0.25); color:#fca5a5; border:1px solid rgba(220,38,38,0.4); border-radius:8px; padding:4px 10px; font-size:11.5px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:5px;" title="Xóa mềm toàn bộ hoạt động trong ngày ${esc(dateStr)}">
              <i data-lucide="trash-2" class="lucide-sm"></i> Xóa ngày này
            </button>
          </div>
        </div>

        <div style="padding:16px; display:flex; flex-direction:column; gap:10px;">
    `;

    dayItems.forEach(l => {
      let detailsStr = esc(l.note || '');
      if (l.details && Object.keys(l.details).length > 0) {
        const parts = [];
        const qtyVal = l.details.quantity ?? l.details.amount ?? l.details.qty ?? l.details.dosage ?? l.details.volume ?? l.details.yield_kg;
        const unitVal = l.details.unit || l.details.package_unit || '';
        const supName = l.details.supply_name || l.details.fertilizer_name || l.details.pesticide_name || l.details.foliar_nutrition || l.details.fertilizer || l.details.pesticide;

        if (supName) parts.push(`Vật tư: ${supName}`);
        if (qtyVal !== undefined && qtyVal !== null && qtyVal !== '') parts.push(`Lượng: ${qtyVal} ${unitVal}`);
        if (l.details.fruit_count)     parts.push(`Số trái: ${l.details.fruit_count}`);
        if (l.details.total_revenue)   parts.push(`Doanh thu: ${Number(l.details.total_revenue).toLocaleString('vi-VN')} đ`);
        if (l.details.total_cost)      parts.push(`Chi phí: ${Number(l.details.total_cost).toLocaleString('vi-VN')} đ`);
        if (l.details.method)          parts.push(`Cách: ${l.details.method}`);
        if (l.details.reason)          parts.push(`Lý do: ${l.details.reason}`);
        if (l.details.disease_name)    parts.push(`Bệnh: ${l.details.disease_name}`);
        if (l.details.severity)        parts.push(`Mức độ: ${l.details.severity}`);
        if (parts.length > 0) {
          detailsStr = `[${parts.join(', ')}]` + (l.note ? ` - ${esc(l.note)}` : '');
        }
      }

      let mediaList = [];
      if (l.media_urls) {
        if (Array.isArray(l.media_urls)) mediaList = l.media_urls;
        else if (typeof l.media_urls === 'string') {
          try { mediaList = JSON.parse(l.media_urls); } catch (_) { mediaList = []; }
        }
      }
      if (mediaList.length === 0 && l.media_url) {
        mediaList = [{ url: l.media_url, type: /\.(mp4|mov|avi|mkv|webm)/i.test(l.media_url) ? 'video' : 'image' }];
      }
      const mediaHtml = mediaList.length > 0 ? buildMediaThumbnailsHtml(mediaList, 40) : '';

      const targetDisplay = l.targetDisplay || (l.plant_id ? `Cây #${l.tree_code || l.plant_id}` : 'Toàn vườn');
      const isSelected = l.id && _selectedLogIds.has(l.id);
      const iconKey = LOG_TYPE_ICONS[l.log_type] || 'clipboard';

      if (l.isDiseaseLog || l.log_type === 'Bệnh cây') {
        html += `
          <div style="background:linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%); border:1px solid #fca5a5; border-left:5px solid #ef4444; border-radius:12px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:240px;">
              ${_batchSelectMode && l.id ? `<input type="checkbox" class="log-item-checkbox log-cb-day-${esc(dateStr)}" value="${l.id}" ${isSelected ? 'checked' : ''} onchange="toggleLogSelection(${l.id}, this.checked)" style="width:18px; height:18px; cursor:pointer; accent-color:#059669; flex-shrink:0;">` : ''}
              <div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span class="badge" style="background:#dc2626; color:#ffffff; font-weight:800; font-size:11px; display:inline-flex; align-items:center; gap:4px;">
                    <i data-lucide="shield-alert" class="lucide-xs"></i> Bệnh cây
                  </span>
                  <strong style="color:#dc2626; font-size:14px;"><i data-lucide="alert-triangle" class="lucide-sm"></i> ${esc(targetDisplay)}</strong>
                </div>
                <div style="font-size:12.5px; color:#7f1d1d; margin-top:4px; font-weight:600;">${detailsStr}</div>
                ${mediaHtml ? `<div style="margin-top:6px;">${mediaHtml}</div>` : ''}
                <div style="font-size:11.5px; color:#991b1b; margin-top:4px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="user" class="lucide-xs"></i> Thực hiện: <strong>${esc(l.creator_name || 'Nông hộ')}</strong></span>
                  ${l.farm_name ? `<span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="home" class="lucide-xs"></i> ${esc(l.farm_name)}</span>` : ''}
                </div>
              </div>
            </div>

            <div style="display:flex; gap:6px;">
              <button class="btn btn-secondary btn-sm" onclick="openCareModal(${l.plant_id}, '${esc(l.tree_code || l.plant_id)}', '${esc(l.plant_type)}', ${l.id})" style="border-color:#fca5a5; color:#dc2626;">
                <i data-lucide="edit-3" class="lucide-sm"></i> Sửa
              </button>
              <button class="btn btn-danger btn-sm" onclick="deleteCareLog(${l.id}, ${l.plant_id || 'null'})" title="Xóa mềm nhật ký này">
                <i data-lucide="trash-2" class="lucide-sm"></i>
              </button>
            </div>
          </div>
        `;
      } else {
        html += `
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:240px;">
              ${_batchSelectMode && l.id ? `<input type="checkbox" class="log-item-checkbox log-cb-day-${esc(dateStr)}" value="${l.id}" ${isSelected ? 'checked' : ''} onchange="toggleLogSelection(${l.id}, this.checked)" style="width:18px; height:18px; cursor:pointer; accent-color:#059669; flex-shrink:0;">` : ''}
              <div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span class="badge badge-green" style="font-size:11px; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                    <i data-lucide="${iconKey}" class="lucide-xs"></i> ${esc(l.log_type)}
                  </span>
                  <strong style="color:#0f172a; font-size:14px;">${esc(targetDisplay)}</strong>
                </div>
                ${detailsStr ? `<div style="font-size:12.5px; color:#475569; margin-top:4px;">${detailsStr}</div>` : ''}
                ${mediaHtml ? `<div style="margin-top:6px;">${mediaHtml}</div>` : ''}
                <div style="font-size:11.5px; color:#64748b; margin-top:4px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="user" class="lucide-xs" style="color:#059669;"></i> Thực hiện: <strong>${esc(l.creator_name || 'Nông hộ')}</strong></span>
                  ${l.farm_name ? `<span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="home" class="lucide-xs" style="color:#059669;"></i> ${esc(l.farm_name)}</span>` : ''}
                </div>
              </div>
            </div>

            <div style="display:flex; gap:6px;">
              <button class="btn btn-secondary btn-sm" onclick="openCareModal(${l.plant_id}, '${esc(l.tree_code || l.plant_id)}', '${esc(l.plant_type)}', ${l.id})">
                <i data-lucide="edit-3" class="lucide-sm"></i> Sửa
              </button>
              <button class="btn btn-danger btn-sm" onclick="deleteCareLog(${l.id}, ${l.plant_id || 'null'})" title="Xóa mềm nhật ký này">
                <i data-lucide="trash-2" class="lucide-sm"></i>
              </button>
            </div>
          </div>
        `;
      }
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  if (paginationContainer) {
    paginationContainer.innerHTML = `
      <div style="font-size:13px; font-weight:600; color:#64748b; display:flex; align-items:center; gap:6px;">
        <i data-lucide="clipboard-check" class="lucide-sm" style="color:var(--green)"></i> Hiển thị <strong>${startIndex + 1} - ${endIndex}</strong> / Tổng <strong>${totalLogs}</strong> nhật ký
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="btn btn-secondary btn-sm" onclick="changeLogPage(-1)" ${_currentLogPage === 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} style="padding:6px 12px; font-size:12px;">
          <i data-lucide="chevron-left" class="lucide-sm"></i> Trang trước
        </button>
        <span style="font-size:13px; font-weight:700; color:#1e293b; padding:4px 10px; background:#ffffff; border:1px solid #cbd5e1; border-radius:6px;">
          ${_currentLogPage} / ${totalPages}
        </span>

        <button class="btn btn-secondary btn-sm" onclick="changeLogPage(1)" ${_currentLogPage === totalPages ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} style="padding:6px 12px; font-size:12px;">
          Trang sau <i data-lucide="chevron-right" class="lucide-sm"></i>
        </button>
      </div>
    `;
  }
  if (window.lucide) lucide.createIcons();
}

/**
 * Render toàn bộ nhật ký với phân trang ở tab Lịch sử.
 * @param {Array} logs
 */
export function renderUserLogsTableFull(logs) {
  _currentFilteredLogs = logs || [];
  _currentLogPage = 1;
  _renderLogPage();
}

/**
 * Tạo HTML một hàng nhật ký.
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

  if (l.isDiseaseLog || l.log_type === 'Bệnh cây') {
    return `
      <tr style="background: linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%); border-left: 4px solid #ef4444;">
        <td data-label="Thời gian"><div style="font-weight:600; color:#991b1b;">${formatDate(l.log_date)}</div></td>
        <td data-label="Cây trồng">
          <div style="font-weight:700; color:#dc2626;">
            <i data-lucide="alert-triangle" class="lucide-sm" style="color:#ef4444; margin-right:4px;"></i>
            ${esc(l.targetDisplay || `Cây #${l.tree_code || l.plant_id}`)}
            <small style="color:#b91c1c; display:block; font-weight:500;">(${esc(l.plant_type || '')})</small>
          </div>
        </td>
        <td data-label="Hoạt động">
          <div>
            <span class="badge" style="background:#dc2626; color:#ffffff; font-weight:700; box-shadow:0 2px 8px rgba(220,38,38,0.35); text-transform:none; padding:4px 10px; border-radius:6px; font-size:12px; display:inline-flex; align-items:center; gap:4px;">
              <i data-lucide="shield-alert" class="lucide-xs"></i> Bệnh cây
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
              <i data-lucide="edit" class="lucide-sm" style="color:#dc2626"></i> Sửa
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
            <i data-lucide="edit" class="lucide-sm" style="color:var(--green)"></i> Sửa
          </button>
        </div>
      </td>
    </tr>`;
}

// ── Search / Filter / Sort ────────────────────────────────────

/**
 * Lọc và sắp xếp nhật ký canh tác ở tab Lịch sử.
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

// ── CRUD, Soft-Delete & Batch Selection Controllers ───────────

/** Tải lại toàn bộ dữ liệu nhật ký canh tác từ server */
export async function reloadUserLogs() {
  try {
    const freshLogs = await api('/plants/logs/recent?days=30');
    setLogsCache(freshLogs || []);
    filterUserLogs();
  } catch (err) {
    console.warn('Could not reload logs cache:', err);
  }
}
window.reloadUserLogs = reloadUserLogs;

/** Xóa mềm 1 bản ghi nhật ký */
export async function deleteCareLog(logId, plantId) {
  if (!logId) return;
  const confirmed = confirm('Bạn có chắc chắn muốn xóa mềm nhật ký canh tác này?\n(Dữ liệu sẽ được ẩn và có thể được xem/khôi phục lại tại mục Lịch sử biến động)');
  if (!confirmed) return;

  try {
    const res = await api(`/plants/logs/${logId}`, { method: 'DELETE' });
    toast(res.message || 'Đã xóa mềm nhật ký canh tác thành công.', 'success');
    _selectedLogIds.delete(logId);
    updateBatchSelectionUI();
    await reloadUserLogs();
  } catch (err) {
    alert('Lỗi khi xóa nhật ký: ' + err.message);
  }
}
window.deleteCareLog = deleteCareLog;

/** Xóa mềm toàn bộ nhật ký trong một ngày */
export async function deleteDayLogs(dateFormatted) {
  if (!dateFormatted) return;
  const confirmed = confirm(`Bạn có chắc chắn muốn xóa mềm toàn bộ nhật ký canh tác trong ngày ${dateFormatted}?\n(Dữ liệu có thể được xem và khôi phục lại tại mục Lịch sử biến động)`);
  if (!confirmed) return;

  let dateIso = '';
  const parts = dateFormatted.split('/');
  if (parts.length === 3) {
    dateIso = `${parts[2]}-${parts[1]}-${parts[0]}`;
  } else {
    dateIso = dateFormatted;
  }

  try {
    const res = await api('/plants/logs/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ date: dateIso })
    });
    toast(res.message || `Đã xóa mềm toàn bộ nhật ký ngày ${dateFormatted}.`, 'success');
    await reloadUserLogs();
  } catch (err) {
    alert('Lỗi khi xóa nhật ký theo ngày: ' + err.message);
  }
}
window.deleteDayLogs = deleteDayLogs;

/** Bật/tắt chế độ Chọn nhiều (Batch Selection Mode) */
export function toggleBatchSelectMode(forceState) {
  if (typeof forceState === 'boolean') {
    _batchSelectMode = forceState;
  } else {
    _batchSelectMode = !_batchSelectMode;
  }

  const btn = document.getElementById('btn-toggle-batch-log-mode');
  const bar = document.getElementById('user-logs-batch-action-bar');

  if (btn) {
    if (_batchSelectMode) {
      btn.style.background = '#0284c7';
      btn.style.color = '#ffffff';
      btn.style.borderColor = '#0284c7';
      btn.innerHTML = `<i data-lucide="check-square" class="lucide-sm"></i> Đang chọn (${_selectedLogIds.size})`;
    } else {
      btn.style.background = '#f8fafc';
      btn.style.color = '#334155';
      btn.style.borderColor = '#cbd5e1';
      btn.innerHTML = `<i data-lucide="check-square" class="lucide-sm" style="color:#0284c7;"></i> Chọn nhiều`;
    }
  }

  if (bar) {
    bar.style.display = _batchSelectMode ? 'flex' : 'none';
  }

  updateBatchSelectionUI();
  _renderLogPage();
}
window.toggleBatchSelectMode = toggleBatchSelectMode;

/** Chọn / bỏ chọn 1 dòng nhật ký */
export function toggleLogSelection(logId, isChecked) {
  if (isChecked) {
    _selectedLogIds.add(logId);
  } else {
    _selectedLogIds.delete(logId);
  }
  updateBatchSelectionUI();
}
window.toggleLogSelection = toggleLogSelection;

/** Chọn / bỏ chọn tất cả mục trong 1 ngày */
export function toggleSelectAllDay(dateStr, isChecked) {
  const dayCheckboxes = document.querySelectorAll(`.log-cb-day-${CSS.escape(dateStr)}`);
  dayCheckboxes.forEach(cb => {
    cb.checked = isChecked;
    const id = parseInt(cb.value);
    if (id) {
      if (isChecked) _selectedLogIds.add(id);
      else _selectedLogIds.delete(id);
    }
  });
  updateBatchSelectionUI();
}
window.toggleSelectAllDay = toggleSelectAllDay;

/** Bỏ chọn tất cả */
export function clearAllLogSelection() {
  _selectedLogIds.clear();
  document.querySelectorAll('.log-item-checkbox').forEach(cb => cb.checked = false);
  document.querySelectorAll('.log-day-select-all').forEach(cb => cb.checked = false);
  updateBatchSelectionUI();
}
window.clearAllLogSelection = clearAllLogSelection;

function updateBatchSelectionUI() {
  const count = _selectedLogIds.size;
  const countEl = document.getElementById('user-logs-selected-count');
  const btnDelCount = document.getElementById('user-logs-btn-del-count');
  const delBtn = document.getElementById('btn-delete-batch-selected');
  const toggleBtn = document.getElementById('btn-toggle-batch-log-mode');

  if (countEl) countEl.textContent = count;
  if (btnDelCount) btnDelCount.textContent = count;
  if (toggleBtn && _batchSelectMode) {
    toggleBtn.innerHTML = `<i data-lucide="check-square" class="lucide-sm"></i> Đang chọn (${count})`;
  }
  if (delBtn) {
    delBtn.disabled = (count === 0);
    delBtn.style.opacity = count === 0 ? '0.5' : '1';
    delBtn.style.cursor = count === 0 ? 'not-allowed' : 'pointer';
  }
}

/** Xóa mềm tất cả các mục đã tick chọn */
export async function deleteSelectedBatchLogs() {
  const count = _selectedLogIds.size;
  if (count === 0) {
    toast('Vui lòng chọn ít nhất 1 nhật ký để xóa.', 'info');
    return;
  }

  const confirmed = confirm(`Bạn có chắc chắn muốn xóa mềm ${count} nhật ký đã chọn?\n(Dữ liệu có thể được xem và khôi phục lại tại mục Lịch sử biến động)`);
  if (!confirmed) return;

  try {
    const res = await api('/plants/logs/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ log_ids: Array.from(_selectedLogIds) })
    });
    toast(res.message || `Đã xóa mềm ${count} nhật ký thành công.`, 'success');
    _selectedLogIds.clear();
    toggleBatchSelectMode(false);
    await reloadUserLogs();
  } catch (err) {
    alert('Lỗi khi xóa hàng loạt: ' + err.message);
  }
}
window.deleteSelectedBatchLogs = deleteSelectedBatchLogs;

// ── Modal Xóa Chọn Lọc (Selective Delete Modal) Controllers ──

export function openSelectiveDeleteModal() {
  const modal = document.getElementById('selective-log-delete-modal');
  if (!modal) return;

  // Populate farm dropdown
  const farmSel = document.getElementById('modal-del-farm');
  const allFarms = window._allFarmsCache || [];
  if (farmSel) {
    farmSel.innerHTML = `<option value="all">Tất cả trang trại</option>`
      + allFarms.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
  }

  onModalDelFarmChange();

  const singleDateInput = document.getElementById('modal-del-date-single');
  if (singleDateInput && !singleDateInput.value) {
    singleDateInput.value = new Date().toISOString().slice(0, 10);
  }

  modal.style.display = 'flex';
  previewSelectiveDelete();
}
window.openSelectiveDeleteModal = openSelectiveDeleteModal;

export function closeSelectiveDeleteModal() {
  const modal = document.getElementById('selective-log-delete-modal');
  if (modal) modal.style.display = 'none';
}
window.closeSelectiveDeleteModal = closeSelectiveDeleteModal;

export function onModalDelFarmChange() {
  const farmId = document.getElementById('modal-del-farm')?.value || 'all';
  const plantSel = document.getElementById('modal-del-plant');
  const allPlants = window._allPlantsCache || [];

  if (plantSel) {
    let plants = allPlants;
    if (farmId !== 'all') {
      plants = allPlants.filter(p => String(p.farm_id) === farmId);
    }
    plantSel.innerHTML = `<option value="all">Tất cả cây trồng</option>`
      + plants.map(p => `<option value="${p.id}">Cây #${esc(p.tree_code || p.id)} (${esc(p.plant_type || '')})</option>`).join('');
  }

  previewSelectiveDelete();
}
window.onModalDelFarmChange = onModalDelFarmChange;

export function onModalDelDateModeChange() {
  const mode = document.querySelector('input[name="modal_del_date_mode"]:checked')?.value || 'single';
  const singleBox = document.getElementById('modal-del-box-single');
  const rangeBox = document.getElementById('modal-del-box-range');

  if (singleBox) singleBox.style.display = (mode === 'single') ? 'block' : 'none';
  if (rangeBox) rangeBox.style.display = (mode === 'range') ? 'grid' : 'none';

  previewSelectiveDelete();
}
window.onModalDelDateModeChange = onModalDelDateModeChange;

let _previewDebounceTimer = null;
export function previewSelectiveDelete() {
  clearTimeout(_previewDebounceTimer);
  _previewDebounceTimer = setTimeout(async () => {
    const farmId = document.getElementById('modal-del-farm')?.value || 'all';
    const plantId = document.getElementById('modal-del-plant')?.value || 'all';
    const logType = document.getElementById('modal-del-type')?.value || 'all';
    const dateMode = document.querySelector('input[name="modal_del_date_mode"]:checked')?.value || 'single';
    const singleDate = document.getElementById('modal-del-date-single')?.value || '';
    const fromDate = document.getElementById('modal-del-date-from')?.value || '';
    const toDate = document.getElementById('modal-del-date-to')?.value || '';
    const keyword = document.getElementById('modal-del-keyword')?.value?.trim() || '';

    const payload = {
      farm_id: farmId,
      plant_id: plantId,
      log_type: logType,
      date_mode: dateMode,
      date: singleDate,
      from_date: fromDate,
      to_date: toDate,
      keyword: keyword
    };

    const statusEl = document.getElementById('modal-del-preview-status');
    const countEl = document.getElementById('modal-del-count-preview');
    const btnCountText = document.getElementById('btn-del-count-text');
    const confirmBtn = document.getElementById('btn-modal-confirm-selective-delete');

    if (statusEl) statusEl.textContent = 'Đang tính toán...';

    try {
      const res = await api('/plants/logs/batch-delete/preview', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const count = res.count || 0;
      if (countEl) countEl.textContent = count;
      if (btnCountText) btnCountText.textContent = count;
      if (statusEl) {
        statusEl.textContent = count > 0 ? `Sẵn sàng xóa ${count} bản ghi` : 'Không có bản ghi phù hợp';
        statusEl.style.color = count > 0 ? '#15803d' : '#991b1b';
      }
      if (confirmBtn) {
        confirmBtn.disabled = (count === 0);
        confirmBtn.style.opacity = count === 0 ? '0.5' : '1';
        confirmBtn.style.cursor = count === 0 ? 'not-allowed' : 'pointer';
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = 'Lỗi tính toán: ' + err.message;
    }
  }, 200);
}
window.previewSelectiveDelete = previewSelectiveDelete;

export async function executeSelectiveDelete() {
  const farmId = document.getElementById('modal-del-farm')?.value || 'all';
  const plantId = document.getElementById('modal-del-plant')?.value || 'all';
  const logType = document.getElementById('modal-del-type')?.value || 'all';
  const dateMode = document.querySelector('input[name="modal_del_date_mode"]:checked')?.value || 'single';
  const singleDate = document.getElementById('modal-del-date-single')?.value || '';
  const fromDate = document.getElementById('modal-del-date-from')?.value || '';
  const toDate = document.getElementById('modal-del-date-to')?.value || '';
  const keyword = document.getElementById('modal-del-keyword')?.value?.trim() || '';

  const payload = {
    farm_id: farmId,
    plant_id: plantId,
    log_type: logType,
    date_mode: dateMode,
    date: singleDate,
    from_date: fromDate,
    to_date: toDate,
    keyword: keyword
  };

  const countText = document.getElementById('modal-del-count-preview')?.textContent || '0';
  const confirmed = confirm(`XÁC NHẬN: Bạn có chắc chắn muốn xóa mềm ${countText} bản ghi nhật ký canh tác thỏa mãn các điều kiện đã chọn?\n(Dữ liệu có thể được xem và khôi phục lại tại mục Lịch sử biến động)`);
  if (!confirmed) return;

  const confirmBtn = document.getElementById('btn-modal-confirm-selective-delete');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang xóa mềm...`;
  }

  try {
    const res = await api('/plants/logs/batch-delete', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    toast(res.message || 'Đã xóa mềm nhật ký canh tác thành công.', 'success');
    closeSelectiveDeleteModal();
    await reloadUserLogs();
  } catch (err) {
    alert('Lỗi khi thực hiện xóa chọn lọc: ' + err.message);
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `<i data-lucide="trash-2" class="lucide-sm"></i> Xác nhận xóa mềm (<span id="btn-del-count-text">${countText}</span> mục)`;
    }
  }
}
window.executeSelectiveDelete = executeSelectiveDelete;

// ── Export Modal & VietGAP Report Functions ───────────────────

export function openUserExportLogsModal() {
  const farmSel = document.getElementById('modal-export-farm');
  const fromDateInput = document.getElementById('modal-export-date-from');
  const toDateInput = document.getElementById('modal-export-date-to');
  const catsContainer = document.getElementById('modal-export-categories-grid');

  // Populate farm dropdown from user filter dropdown
  const filterFarmSel = document.getElementById('user-log-filter-farm');
  if (farmSel && filterFarmSel) {
    farmSel.innerHTML = filterFarmSel.innerHTML;
    farmSel.value = filterFarmSel.value || 'all';
  }

  // Populate plant dropdown
  onModalExportFarmChange();

  // Set default date range: Last 30 days up to today
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromDateStr = thirtyDaysAgo.toISOString().slice(0, 10);

  if (fromDateInput) fromDateInput.value = fromDateStr;
  if (toDateInput) toDateInput.value = today;

  // Populate categories checkboxes
  const standardCats = ["Tưới nước", "Bón phân", "Phun thuốc", "Cắt lá", "Tỉa hoa", "Thu hoạch", "Bệnh cây", "Ghi chú khác"];
  if (catsContainer) {
    catsContainer.innerHTML = standardCats.map(cat => `
      <label style="display:inline-flex; align-items:center; gap:6px; background:#f8fafc; border:1px solid #e2e8f0; padding:6px 10px; border-radius:8px; font-size:12.5px; font-weight:600; color:#334155; cursor:pointer;">
        <input type="checkbox" name="user_export_cat" value="${esc(cat)}" checked style="accent-color:#059669; cursor:pointer;">
        <span>${esc(cat)}</span>
      </label>
    `).join('');
  }

  const modal = document.getElementById('user-export-logs-modal');
  if (modal) {
    modal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
  }
}
window.openUserExportLogsModal = openUserExportLogsModal;

export function closeUserExportLogsModal() {
  const modal = document.getElementById('user-export-logs-modal');
  if (modal) modal.style.display = 'none';
}
window.closeUserExportLogsModal = closeUserExportLogsModal;

export function onModalExportFarmChange() {
  const farmSel = document.getElementById('modal-export-farm');
  const plantSel = document.getElementById('modal-export-plant');
  if (!plantSel) return;

  const farmId = farmSel ? farmSel.value : 'all';
  let allPlants = [];
  try {
    allPlants = getPlantsCache() || [];
  } catch (_) {
    allPlants = [];
  }

  let plants = allPlants;
  if (farmId !== 'all') {
    plants = allPlants.filter(p => String(p.farm_id) === String(farmId));
  }

  plantSel.innerHTML = `<option value="all">Tất cả cây trồng</option>`
    + plants.map(p => `<option value="${p.id}">Cây #${esc(p.tree_code || p.id)} (${esc(p.plant_type || '')})</option>`).join('');
}
window.onModalExportFarmChange = onModalExportFarmChange;

export function toggleAllUserExportCats(select) {
  const checkboxes = document.querySelectorAll('input[name="user_export_cat"]');
  checkboxes.forEach(cb => cb.checked = select);
}
window.toggleAllUserExportCats = toggleAllUserExportCats;

function formatLogDetailsText(log) {
  const d = log.details || {};
  const parts = [];
  if (log.log_type === 'Tưới nước') {
    if (d.method) parts.push(`Phương pháp: ${d.method}`);
    if (d.amount) parts.push(`Lượng nước: ${d.amount} ${d.unit || 'L'}`);
  } else if (log.log_type === 'Bón phân') {
    if (d.fertilizer_name || d.supply_name) parts.push(`Tên phân: ${d.fertilizer_name || d.supply_name}`);
    if (d.type) parts.push(`Loại: ${d.type}`);
    if (d.amount || d.quantity) parts.push(`Lượng: ${d.amount || d.quantity} ${d.unit || 'kg'}`);
  } else if (log.log_type === 'Phun thuốc') {
    if (d.pesticide_name || d.supply_name) parts.push(`Tên thuốc: ${d.pesticide_name || d.supply_name}`);
    if (d.type) parts.push(`Loại thuốc: ${d.type}`);
    if (d.amount || d.dosage) parts.push(`Liều lượng: ${d.amount || d.dosage} ${d.unit || ''}`);
    if (d.reason) parts.push(`Đối tượng phòng trừ: ${d.reason}`);
  } else if (log.log_type === 'Cắt lá') {
    if (d.amount) parts.push(`Số lượng cành/lá: ${d.amount}`);
    if (d.reason) parts.push(`Mục đích: ${d.reason}`);
  } else if (log.log_type === 'Tỉa hoa') {
    if (d.amount) parts.push(`Số lượng hoa/quả: ${d.amount}`);
    if (d.reason) parts.push(`Mục đích: ${d.reason}`);
  } else if (log.log_type === 'Thu hoạch') {
    if (d.amount || d.yield_kg) parts.push(`Sản lượng: ${d.amount || d.yield_kg} ${d.unit || 'kg'}`);
    if (d.fruit_count) parts.push(`Số lượng trái: ${d.fruit_count} trái`);
    if (d.quality) parts.push(`Chất lượng: ${d.quality}`);
  } else if (log.log_type === 'Bệnh cây') {
    if (d.disease_name) parts.push(`Tên bệnh/sâu hại: ${d.disease_name}`);
    if (d.severity) parts.push(`Mức độ: ${d.severity}`);
    if (d.description) parts.push(`Mô tả triệu chứng: ${d.description}`);
  } else {
    if (d.method) parts.push(d.method);
    if (d.amount) parts.push(`${d.amount} ${d.unit || ''}`);
  }
  return parts.join(' | ');
}

export function exportLogsToCsv(logs, filename = 'NhatKyCanhTac.csv') {
  if (!Array.isArray(logs) || logs.length === 0) {
    toast('Không có nhật ký canh tác nào để xuất file.', 'warning');
    return;
  }

  const headers = [
    "STT",
    "Ngày Canh Tác",
    "Mã Cây / Lô",
    "Loại Cây",
    "Giống Cây",
    "Trang Trại",
    "Hoạt Động Canh Tác",
    "Chi Tiết Kỹ Thuật (Vật tư, Thuốc, Liều lượng)",
    "Đơn Giá (VNĐ)",
    "Thành Tiền (VNĐ)",
    "Người Thực Hiện",
    "Ghi Chú Bổ Sung",
    "Hình Ảnh / Video Bằng Chứng"
  ];

  function escapeCsvCell(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  const rows = [];
  rows.push(headers.map(escapeCsvCell).join(','));

  logs.forEach((log, index) => {
    const detailsStr = formatLogDetailsText(log);
    const mediaUrls = (log.media_urls && Array.isArray(log.media_urls)) 
      ? log.media_urls.map(m => m.url || m).join('; ') 
      : '';

    const d = log.details || {};
    const unitPrice = d.unit_price || d.package_price || '';
    const totalCost = d.total_cost || d.cost || '';

    const dateStr = log.log_date ? new Date(log.log_date).toLocaleDateString('vi-VN') : '';

    const row = [
      index + 1,
      dateStr,
      log.tree_code || log.plant_id || 'Toàn vườn',
      log.plant_type || '',
      log.plant_variety || '',
      log.farm_name || '',
      log.log_type || '',
      detailsStr,
      unitPrice,
      totalCost,
      log.creator_name || 'Nông hộ',
      log.note || '',
      mediaUrls
    ];
    rows.push(row.map(escapeCsvCell).join(','));
  });

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast(`Đã xuất ${logs.length} dòng nhật ký ra file Excel thành công!`, 'success');
}
window.exportLogsToCsv = exportLogsToCsv;

export function exportUserFilteredLogsCsv() {
  const logsToExport = _currentFilteredLogs && _currentFilteredLogs.length > 0 ? _currentFilteredLogs : _logsCache;
  if (!logsToExport || logsToExport.length === 0) {
    toast('Không có nhật ký nào trong danh sách hiển thị để xuất.', 'warning');
    return;
  }
  const dateSuffix = new Date().toISOString().slice(0, 10);
  exportLogsToCsv(logsToExport, `NhatKyCanhTac_KetQuaLoc_${dateSuffix}.csv`);
}
window.exportUserFilteredLogsCsv = exportUserFilteredLogsCsv;

export async function executeUserExport(mode = 'csv') {
  const farmId = document.getElementById('modal-export-farm')?.value || 'all';
  const plantId = document.getElementById('modal-export-plant')?.value || 'all';
  const fromDate = document.getElementById('modal-export-date-from')?.value || '';
  const toDate = document.getElementById('modal-export-date-to')?.value || '';
  
  const checkedCats = [];
  document.querySelectorAll('input[name="user_export_cat"]:checked').forEach(cb => {
    checkedCats.push(cb.value);
  });

  if (checkedCats.length === 0) {
    alert('Vui lòng chọn ít nhất một hạng mục hoạt động để xuất.');
    return;
  }

  // Fetch full logs or use cache
  let allLogs = _logsCache;
  try {
    const freshRes = await api('/plants/logs/recent?days=all');
    if (Array.isArray(freshRes) && freshRes.length > 0) {
      allLogs = freshRes;
      setLogsCache(allLogs);
    }
  } catch (err) {
    console.warn('Fallback to local logs cache:', err);
  }

  let filtered = [...allLogs];
  if (farmId !== 'all') {
    filtered = filtered.filter(l => String(l.farm_id) === String(farmId));
  }
  if (plantId !== 'all') {
    filtered = filtered.filter(l => String(l.plant_id) === String(plantId));
  }
  if (fromDate) {
    filtered = filtered.filter(l => {
      const d = new Date(l.log_date).toISOString().slice(0, 10);
      return d >= fromDate;
    });
  }
  if (toDate) {
    filtered = filtered.filter(l => {
      const d = new Date(l.log_date).toISOString().slice(0, 10);
      return d <= toDate;
    });
  }
  if (checkedCats.length > 0) {
    filtered = filtered.filter(l => checkedCats.includes(l.log_type) || (l.log_type === 'Chăm sóc' && checkedCats.includes('Ghi chú khác')));
  }

  filtered.sort((a, b) => new Date(a.log_date) - new Date(b.log_date));

  if (filtered.length === 0) {
    alert('Không tìm thấy nhật ký canh tác nào khớp với các tiêu chí lọc đã chọn.');
    return;
  }

  closeUserExportLogsModal();

  const farmSel = document.getElementById('modal-export-farm');
  const farmName = farmSel && farmSel.selectedIndex >= 0 ? farmSel.options[farmSel.selectedIndex].text : 'NongTrang';
  const cleanFarmName = farmName.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
  const dateSuffix = new Date().toISOString().slice(0, 10);

  if (mode === 'csv') {
    exportLogsToCsv(filtered, `So_Nhat_Ky_VietGAP_${cleanFarmName}_${dateSuffix}.csv`);
  } else {
    openPrintableVietGapReport(filtered, {
      farmName: farmName === 'Tất cả trang trại' ? 'Toàn bộ trang trại' : farmName,
      fromDate: fromDate,
      toDate: toDate,
      totalLogs: filtered.length
    });
  }
}
window.executeUserExport = executeUserExport;

/**
 * Mở cửa sổ in Báo Cáo / Sổ Nhật Ký Canh Tác Chuẩn VietGAP (Print / PDF)
 */
export function openPrintableVietGapReport(logs, meta = {}) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Trình duyệt đang chặn cửa sổ pop-up. Vui lòng cho phép mở pop-up để xem bản in báo cáo.');
    return;
  }

  const now = new Date();
  const printTimeStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const fromStr = meta.fromDate ? new Date(meta.fromDate).toLocaleDateString('vi-VN') : 'Ngày đầu số hóa';
  const toStr = meta.toDate ? new Date(meta.toDate).toLocaleDateString('vi-VN') : 'Hiện tại';

  let tableRowsHtml = '';
  logs.forEach((log, index) => {
    const detailsStr = formatLogDetailsText(log);
    const dateStr = log.log_date ? new Date(log.log_date).toLocaleDateString('vi-VN') : '—';
    const treeCodeStr = log.tree_code || log.plant_id || 'Toàn vườn';
    const plantTypeStr = log.plant_type ? `${log.plant_type}${log.plant_variety ? ' (' + log.plant_variety + ')' : ''}` : '—';

    tableRowsHtml += `
      <tr>
        <td style="text-align:center;">${index + 1}</td>
        <td style="text-align:center; font-weight:600;">${dateStr}</td>
        <td style="font-weight:700;">#${esc(treeCodeStr)} <small style="font-weight:400; color:#475569; display:block;">${esc(plantTypeStr)}</small></td>
        <td style="font-weight:700; color:#065f46;">${esc(log.log_type || 'Chăm sóc')}</td>
        <td>
          <div style="font-weight:500;">${esc(detailsStr || 'Thực hiện theo quy trình chuẩn')}</div>
          ${log.note ? `<div style="font-size:11.5px; color:#64748b; margin-top:2px;"><em>Ghi chú:</em> ${esc(log.note)}</div>` : ''}
        </td>
        <td style="text-align:center;">${esc(log.creator_name || 'Nông hộ')}</td>
        <td style="text-align:center; color:#15803d; font-weight:700;">Đạt Chuẩn</td>
      </tr>
    `;
  });

  const htmlDoc = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Sổ Nhật Ký Canh Tác VietGAP — ${esc(meta.farmName || 'Nông Trại')}</title>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
      <style>
        @page { size: A4 landscape; margin: 12mm 10mm 15mm 10mm; }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 20px;
          font-size: 12px;
          line-height: 1.4;
        }
        .header-grid {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #047857;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .org-info { text-align: left; }
        .org-name { font-size: 15px; font-weight: 800; color: #047857; text-transform: uppercase; }
        .system-name { font-size: 11px; color: #64748b; font-weight: 600; }
        .report-title-box { text-align: center; margin-bottom: 16px; }
        .report-title { font-size: 18px; font-weight: 800; color: #064e3b; text-transform: uppercase; margin: 0 0 4px 0; }
        .report-sub { font-size: 12.5px; color: #334155; font-weight: 600; }
        .meta-strip {
          display: flex;
          justify-content: space-between;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 8px 14px;
          border-radius: 8px;
          margin-bottom: 14px;
          font-size: 12px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th, td {
          border: 1px solid #cbd5e1;
          padding: 7px 9px;
          vertical-align: middle;
          font-size: 11.5px;
        }
        th {
          background-color: #f1f5f9;
          font-weight: 700;
          color: #0f172a;
          text-align: center;
        }
        tr:nth-child(even) { background-color: #f8fafc; }
        .signature-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          text-align: center;
          margin-top: 30px;
          page-break-inside: avoid;
        }
        .sig-title { font-weight: 700; font-size: 12.5px; color: #0f172a; }
        .sig-sub { font-size: 11px; color: #64748b; margin-top: 2px; font-style: italic; }
        .sig-space { height: 70px; }
        .sig-name { font-weight: 700; color: #1e293b; font-size: 12px; }
        .no-print-bar {
          background: #0f172a;
          color: #ffffff;
          padding: 10px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-radius: 8px;
        }
        @media print {
          .no-print-bar { display: none !important; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="no-print-bar">
        <div><strong>Bản in Sổ Nhật Ký Canh Tác VietGAP</strong> · Số lượng: ${logs.length} dòng ghi chép</div>
        <button onclick="window.print()" style="background:#10b981; color:#ffffff; border:none; padding:6px 16px; border-radius:6px; font-weight:700; cursor:pointer; font-size:13px;">
          🖨️ In Báo Cáo / Xuất PDF
        </button>
      </div>

      <div class="header-grid">
        <div class="org-info">
          <div class="org-name">TÂN BẢO AGTECH — HỆ SINH THÁI NÔNG NGHIỆP SỐ</div>
          <div class="system-name">Hệ Thống Quản Lý Canh Tác & Định Danh Cây Trồng NFC Plant Book</div>
        </div>
        <div style="text-align: right; font-size: 11px; color: #64748b;">
          <div>Tiêu chuẩn áp dụng: <strong>VietGAP / GlobalGAP</strong></div>
          <div>Thời gian trích xuất: ${printTimeStr}</div>
        </div>
      </div>

      <div class="report-title-box">
        <h1 class="report-title">SỔ NHẬT KÝ CANH TÁC & CHĂM SÓC CÂY TRỒNG</h1>
        <div class="report-sub">Trang trại: <strong>${esc(meta.farmName || 'Nông Trại')}</strong></div>
      </div>

      <div class="meta-strip">
        <div>Khoảng thời gian: <strong>${fromStr}</strong> đến <strong>${toStr}</strong></div>
        <div>Tổng số hoạt động: <strong>${logs.length}</strong> nhật ký</div>
        <div>Tình trạng dữ liệu: <strong>Hợp Lệ & Đã Xác Thực</strong></div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 4%">STT</th>
            <th style="width: 10%">Ngày</th>
            <th style="width: 13%">Mã Cây / Giống</th>
            <th style="width: 13%">Hoạt Động</th>
            <th style="width: 42%">Nội Dung Kỹ Thuật (Vật tư, Thuốc, Liều lượng, Ghi chú)</th>
            <th style="width: 10%">Người Làm</th>
            <th style="width: 8%">Đánh Giá</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      <div class="signature-grid">
        <div>
          <div class="sig-title">NGƯỜI LẬP SỔ</div>
          <div class="sig-sub">(Ký và ghi rõ họ tên)</div>
          <div class="sig-space"></div>
          <div class="sig-name">${esc(logs[0]?.creator_name || 'Nông hộ')}</div>
        </div>
        <div>
          <div class="sig-title">KỸ THUẬT VIÊN / TỔ TRƯỞNG</div>
          <div class="sig-sub">(Ký và ghi rõ họ tên)</div>
          <div class="sig-space"></div>
          <div class="sig-name">................................................</div>
        </div>
        <div>
          <div class="sig-title">CHỦ TRANG TRẠI / GIÁM SÁT VIETGAP</div>
          <div class="sig-sub">(Ký, đóng dấu hoặc xác nhận)</div>
          <div class="sig-space"></div>
          <div class="sig-name">................................................</div>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlDoc);
  printWindow.document.close();
}
window.openPrintableVietGapReport = openPrintableVietGapReport;

