/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/logs.js — Care log rendering, grouping, search & filters
   ═══════════════════════════════════════════════════════════════ */

import { esc, formatDate } from '../core/utils.js';
import { buildMediaThumbnailsHtml } from './media.js';

// ── State ─────────────────────────────────────────────────────
let _logsCache = [];
let _diseaseOnlyFilterActive = false;

// ── State Phân trang Lịch sử (20 dòng / trang) ───────────────
let _currentLogPage = 1;
const _logPageSize = 20;
let _currentFilteredLogs = [];


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
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-clipboard-list"></i><p>Không có hoạt động canh tác nào trong 3 ngày qua</p></td></tr>';
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
              <i class="fa-regular fa-calendar-days" style="color: #059669; font-size: 15px;"></i>
              <span style="font-size: 13.5px; font-weight: 900; color: #0f172a;">Ngày ${dateFormatted}</span>
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
        ? timeList.map(t => `<span class="log-time-chip" style="display:inline-flex; align-items:center; gap:3px; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:6px; padding:2px 6px; font-family:monospace; font-size:11.5px; font-weight:700;"><i class="fa-regular fa-clock" style="color:#059669; font-size:10px;"></i>${esc(t)}</span>`).join(' ')
        : `<span style="color:#94a3b8; font-size:12px;">Trong ngày</span>`;

      // 2. Đối tượng Cây trồng / Toàn vườn
      const targetDisplay = l.targetDisplay || (l.plant_id ? `Cây #${l.tree_code || l.plant_id}` : 'Toàn vườn');
      const farmName = l.farm_name ? ` (${esc(l.farm_name)})` : '';

      // 3. Activity Type Badge & Icon
      let badgeClass = 'badge-green';
      let icon = 'fa-solid fa-leaf';
      if (l.log_type === 'Tưới nước') {
        badgeClass = 'badge-blue';
        icon = 'fa-solid fa-droplet';
      } else if (l.log_type === 'Phun thuốc') {
        badgeClass = 'badge-orange';
        icon = 'fa-solid fa-flask';
      } else if (l.log_type === 'Bón phân') {
        badgeClass = 'badge-brown';
        icon = 'fa-solid fa-seedling';
      } else if (l.log_type === 'Bệnh cây') {
        badgeClass = 'badge-red';
        icon = 'fa-solid fa-virus';
      } else if (l.log_type === 'Thu hoạch') {
        badgeClass = 'badge-yellow';
        icon = 'fa-solid fa-wheat-awn';
      } else if (l.log_type === 'Cắt lá' || l.log_type === 'Cắt tỉa') {
        badgeClass = 'badge-gray';
        icon = 'fa-solid fa-scissors';
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
        if (l.details.phi_days) parts.push(`Cách ly PHI: ${l.details.phi_days} ngày`);
        
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
              <i class="fa-solid fa-tree" style="color: ${isDisease ? '#ef4444' : '#10b981'}; font-size: 12px;"></i>
              <span>${esc(targetDisplay)}</span>
            </strong>
            ${farmName ? `<span style="font-size: 11px; color: #64748b; display: block; margin-top: 2px;">${farmName}</span>` : ''}
          </td>
          <td data-label="Hoạt động" style="vertical-align: middle; padding: 12px 14px; white-space: nowrap;">
            <span class="badge ${badgeClass}" style="font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px;">
              <i class="${icon}"></i> ${esc(l.log_type)}
            </span>
            ${l.occurrenceCount > 1 ? `<span class="badge" style="font-size: 10px; font-weight: 800; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 2px 6px; border-radius: 10px; margin-left: 4px;" title="Gom nhóm ${l.occurrenceCount} lượt trong cùng ngày"><i class="fa-solid fa-layer-group" style="font-size: 9px;"></i> ${l.occurrenceCount} lượt</span>` : ''}
          </td>
          <td data-label="Chi tiết / Ghi chú" style="vertical-align: middle; padding: 12px 14px; font-size: 13px; color: #334155; line-height: 1.5;">
            <div>${detailsStr || 'Đã hoàn thành công việc theo quy trình chuẩn.'}</div>
            ${mediaHtml ? `<div style="margin-top: 4px;">${mediaHtml}</div>` : ''}
          </td>
          <td data-label="Người thực hiện" style="vertical-align: middle; padding: 12px 14px; white-space: nowrap; font-size: 12.5px; color: #475569;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-user" style="color: #94a3b8; font-size: 11px;"></i>
              <span style="font-weight: 600; color: #334155;">${esc(creatorName)}</span>
            </div>
          </td>
          <td data-label="Thao tác" style="vertical-align: middle; padding: 12px 14px; text-align: right; white-space: nowrap;">
            <button type="button" class="btn btn-secondary btn-xs" onclick="openCareModal(${l.plant_id || 'null'}, '${esc(l.tree_code || '')}', '${esc(l.plant_type || '')}', ${l.id})" style="padding: 4px 10px; font-size: 11.5px; font-weight: 700; border-radius: 6px;">
              <i class="fa-solid fa-pen" style="color: #059669;"></i> Sửa
            </button>
          </td>
        </tr>
      `;
    });
  }

  tbody.innerHTML = html;
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
        <i class="fa-solid fa-clipboard-list" style="font-size:36px; color:#94a3b8; margin-bottom:10px;"></i>
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
  Object.keys(groupedByDate).forEach(dateStr => {
    const dayItems = groupedByDate[dateStr];

    html += `
      <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:16px; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,0.03);">
        <!-- Date Header Bar -->
        <div style="background:linear-gradient(135deg, #0f172a, #1e293b); color:#ffffff; padding:12px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="font-size:14.5px; font-weight:800; display:flex; align-items:center; gap:8px;">
            <i class="fa-regular fa-calendar-days" style="color:#10b981;"></i> Ngày ${esc(dateStr)}
          </div>
          <span style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4); font-size:11.5px; font-weight:700; padding:3px 12px; border-radius:20px;">
            ${dayItems.length} nhật ký hoạt động
          </span>
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
        if (l.details.phi_days)        parts.push(`Cách ly PHI: ${l.details.phi_days} ngày`);
        if (parts.length > 0) {
          detailsStr = `[${parts.join(', ')}]` + (l.note ? ` - ${esc(l.note)}` : '');
        }
      }

      const mediaHtml = l.log_type === 'Bệnh cây'
        ? buildMediaThumbnailsHtml(l.media_urls, 36)
        : '';

      const targetDisplay = l.targetDisplay || (l.plant_id ? `Cây #${l.tree_code || l.plant_id}` : 'Toàn vườn');

      if (l.isDiseaseLog || l.log_type === 'Bệnh cây') {
        html += `
          <div style="background:linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%); border:1px solid #fca5a5; border-left:5px solid #ef4444; border-radius:12px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span class="badge" style="background:#dc2626; color:#ffffff; font-weight:800; font-size:11px;">🐛 Bệnh cây</span>
                <strong style="color:#dc2626; font-size:14px;"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(targetDisplay)}</strong>
              </div>
              <div style="font-size:12.5px; color:#7f1d1d; margin-top:4px; font-weight:600;">${detailsStr}</div>
              ${mediaHtml ? `<div style="margin-top:6px;">${mediaHtml}</div>` : ''}
              <div style="font-size:11.5px; color:#991b1b; margin-top:4px;">
                👤 Thực hiện: <strong>${esc(l.creator_name || 'Nông hộ')}</strong> ${l.farm_name ? `· 🏡 ${esc(l.farm_name)}` : ''}
              </div>
            </div>

            <div style="display:flex; gap:6px;">
              <button class="btn btn-secondary btn-sm" onclick="openCareModal(${l.plant_id}, '${esc(l.tree_code || l.plant_id)}', '${esc(l.plant_type)}', ${l.id})" style="border-color:#fca5a5; color:#dc2626;">
                <i class="fa fa-pen"></i> Sửa
              </button>
              <button class="btn btn-danger btn-sm" onclick="deleteCareLog(${l.id})">
                <i class="fa fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      } else {
        html += `
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span class="badge badge-green" style="font-size:11px; font-weight:700;">${esc(l.log_type)}</span>
                <strong style="color:#0f172a; font-size:14px;">${esc(targetDisplay)}</strong>
              </div>
              ${detailsStr ? `<div style="font-size:12.5px; color:#475569; margin-top:4px;">${detailsStr}</div>` : ''}
              <div style="font-size:11.5px; color:#64748b; margin-top:4px;">
                👤 Thực hiện: <strong>${esc(l.creator_name || 'Nông hộ')}</strong> ${l.farm_name ? `· 🏡 ${esc(l.farm_name)}` : ''}
              </div>
            </div>

            <div style="display:flex; gap:6px;">
              <button class="btn btn-secondary btn-sm" onclick="openCareModal(${l.plant_id}, '${esc(l.tree_code || l.plant_id)}', '${esc(l.plant_type)}', ${l.id})">
                <i class="fa fa-pen"></i> Sửa
              </button>
              <button class="btn btn-danger btn-sm" onclick="deleteCareLog(${l.id})">
                <i class="fa fa-trash"></i>
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
        <i class="fa-solid fa-list-check" style="color:var(--green)"></i> Hiển thị <strong>${startIndex + 1} - ${endIndex}</strong> / Tổng <strong>${totalLogs}</strong> nhật ký
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="btn btn-secondary btn-sm" onclick="changeLogPage(-1)" ${_currentLogPage === 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} style="padding:6px 12px; font-size:12px;">
          <i class="fa-solid fa-chevron-left"></i> Trang trước
        </button>
        <span style="font-size:13px; font-weight:700; color:#1e293b; padding:4px 10px; background:#ffffff; border:1px solid #cbd5e1; border-radius:6px;">
          ${_currentLogPage} / ${totalPages}
        </span>

        <button class="btn btn-secondary btn-sm" onclick="changeLogPage(1)" ${_currentLogPage === totalPages ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} style="padding:6px 12px; font-size:12px;">
          Trang sau <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    `;
  }
}


/**
 * Render toàn bộ nhật ký với phân trang 10 dòng/trang ở tab Lịch sử.
 * @param {Array} logs
 */
export function renderUserLogsTableFull(logs) {
  _currentFilteredLogs = logs || [];
  _currentLogPage = 1;
  _renderLogPage();
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
