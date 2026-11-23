import { esc, formatDate, toast } from '../core/utils.js';
import { api, getCurrentUserRbac } from '../core/api.js';
import { buildMediaThumbnailsHtml } from './media.js';
import { getPlantsCache, getFarmsCache } from './plants.js';

let _logsCache = [];
let _diseaseOnlyFilterActive = false;

let _currentLogPage = 1;
const _logPageSize = 20;
let _currentFilteredLogs = [];

let _batchSelectMode = false;
const _selectedLogIds = new Set();

const dayOfWeekArr = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const DAY_OF_WEEK_ARR = dayOfWeekArr;

const LEGACY_LABOR_ALIASES = ['Nhân công', 'Cắt lá', 'Cắt tỉa', 'Cắt cành', 'Tỉa cành/lá', 'Tỉa hoa', 'Tỉa quả', 'Tỉa quả/hoa', 'Thụ phấn', 'Làm cỏ'];

function isFruitAuditLog(logOrType) {
  if (!logOrType) return false;
  const lt = typeof logOrType === 'string' ? logOrType : (logOrType.log_type || '');
  const norm = String(lt).trim().toLowerCase();
  if (norm === 'kiểm toán quả' || norm === 'kiểm đếm quả' || norm === 'fruit_audit' || norm === 'fruit audit' || norm.startsWith('kiểm toán quả')) {
    return true;
  }
  if (typeof logOrType === 'object' && logOrType.details && (logOrType.details.audit_stage || logOrType.details.fruit_stage) && norm !== 'thu hoạch') {
    return true;
  }
  return false;
}

function toLocalYmd(dVal) {
  if (!dVal) return '';
  const s = String(dVal).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$/i.test(s)) return s.slice(0, 10);
  const d = new Date(dVal);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function matchesUserLogCategory(selectedList, logOrType) {
  if (!selectedList || selectedList.length === 0) return true;
  const logType = typeof logOrType === 'string' ? logOrType : (logOrType?.log_type || '');
  if (selectedList.includes(logType)) return true;
  if (selectedList.includes('Kiểm toán quả') && isFruitAuditLog(logOrType)) return true;
  if (selectedList.includes('Nhân công') && LEGACY_LABOR_ALIASES.includes(logType)) return true;
  return false;
}

function _fmtViShortDateLog(dVal) {
  if (!dVal) return '';
  const s = String(dVal).slice(0, 10);
  const p = s.split('-');
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  const d = new Date(dVal);
  return !isNaN(d) ? d.toLocaleDateString('vi-VN') : s;
}

export function enrichLogsWithFruitAuditChain(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return logs || [];
  const byPlant = new Map();
  logs.forEach((l) => {
    if (!l || (l.log_type !== 'Kiểm toán quả' && l.log_type !== 'Thu hoạch')) return;
    const pKey = String(l.plant_id || 0);
    if (!byPlant.has(pKey)) byPlant.set(pKey, []);
    byPlant.get(pKey).push(l);
  });

  byPlant.forEach((pLogs) => {
    pLogs.sort((a, b) => {
      const dA = a.log_date ? new Date(a.log_date).toISOString().slice(0, 10) : '';
      const dB = b.log_date ? new Date(b.log_date).toISOString().slice(0, 10) : '';
      if (dA !== dB) return dA.localeCompare(dB);
      const tA = (a.details?.audit_time || a.details?.time || a.created_at || '');
      const tB = (b.details?.audit_time || b.details?.time || b.created_at || '');
      if (tA !== tB) return String(tA).localeCompare(String(tB));
      return (a.id || 0) - (b.id || 0);
    });

    let lastAudit = null;
    for (const l of pLogs) {
      if (!l.details || typeof l.details !== 'object') l.details = {};
      const d = l.details;
      const dDateIso = l.log_date ? new Date(l.log_date).toISOString().slice(0, 10) : '';

      if (l.log_type === 'Kiểm toán quả') {
        const currStage = d.audit_stage || 'Đậu quả';
        const currCount = parseInt(d.fruit_count ?? d.amount, 10);
        if (!isNaN(currCount)) {
          if (lastAudit) {
            const delta = currCount - lastAudit.count;
            const pct = lastAudit.count > 0 ? Number(((delta / lastAudit.count) * 100).toFixed(1)) : 0;
            const deltaLabel = delta < 0
              ? `Suy giảm ${Math.abs(delta)} quả (${pct}%)`
              : (delta > 0 ? `Tăng ${delta} quả (+${pct}%)` : 'Giữ nguyên số quả (0%)');
            d.prev_stage = lastAudit.stage;
            d.prev_fruit_count = lastAudit.count;
            d.prev_log_date = lastAudit.dateIso;
            d.delta_count = delta;
            d.delta_pct = pct;
            d.comparison_text = `${lastAudit.stage} (${_fmtViShortDateLog(lastAudit.dateIso)}): ${lastAudit.count} quả → ${currStage} (${_fmtViShortDateLog(dDateIso)}): ${currCount} quả (${deltaLabel})`;
          } else {
            d.comparison_text = d.comparison_text || `Khởi tạo mốc ${currStage} (${_fmtViShortDateLog(dDateIso)}): ${currCount} quả`;
          }
          lastAudit = { stage: currStage, count: currCount, dateIso: dDateIso };
        }
      } else if (l.log_type === 'Thu hoạch') {
        const hCount = parseInt(d.fruit_count, 10);
        if (lastAudit && !isNaN(hCount) && hCount > 0) {
          const delta = hCount - lastAudit.count;
          const pct = lastAudit.count > 0 ? Number(((delta / lastAudit.count) * 100).toFixed(1)) : 0;
          const deltaLabel = delta < 0
            ? `Suy giảm ${Math.abs(delta)} quả (${pct}%)`
            : (delta > 0 ? `Tăng ${delta} quả (+${pct}%)` : 'Khớp 100% số quả (0%)');
          d.prev_audit_stage = lastAudit.stage;
          d.prev_audit_count = lastAudit.count;
          d.prev_audit_date = lastAudit.dateIso;
          d.harvest_delta_count = delta;
          d.harvest_delta_pct = pct;
          d.harvest_comparison_text = `So với Kiểm toán ${lastAudit.stage} (${_fmtViShortDateLog(lastAudit.dateIso)}: ${lastAudit.count} quả): Thu hoạch ${hCount} quả (${deltaLabel})`;
        }
      }
    }
  });
  return logs;
}

function _buildFruitDeltaBadgeHtml(details, isHarvest = false) {
  if (!details) return '';
  const text = isHarvest ? details.harvest_comparison_text : details.comparison_text;
  if (!text) return '';
  const delta = isHarvest ? details.harvest_delta_count : details.delta_count;
  let bg = '#f0fdfa';
  let color = '#0f766e';
  let border = '#99f6e4';
  if (typeof delta === 'number') {
    if (delta < 0) { bg = '#fef2f2'; color = '#dc2626'; border = '#fecaca'; }
    else if (delta > 0) { bg = '#f0fdf4'; color = '#059669'; border = '#bbf7d0'; }
    else { bg = '#eff6ff'; color = '#0284c7'; border = '#bfdbfe'; }
  }
  return `<div style="margin-top:4px; display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:8px; font-size:11.5px; font-weight:700; background:${bg}; color:${color}; border:1px solid ${border};"><i data-lucide="git-compare" class="lucide-xs"></i> ${esc(text)}</div>`;
}

export function setLogsCache(logs) {
  _logsCache = enrichLogsWithFruitAuditChain(logs || []);
  window._allLogsCache = _logsCache;
}

export function getLogsCache() {
  return _logsCache;
}
window.getLogsCache = getLogsCache;

export function populateLogFarmFilter(farms) {
  const sel = document.getElementById('user-log-filter-farm');
  if (!sel) return;
  sel.innerHTML = `<option value="all">Tất cả trang trại</option>`
    + (farms || []).map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
}

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

export function groupCareLogs(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return [];
  enrichLogsWithFruitAuditChain(logs);

  const grouped = [];
  const regularGroups = new Map();

  for (const rawLog of logs) {
    const log = JSON.parse(JSON.stringify(rawLog));

    if (log.log_type === 'Bệnh cây' || isFruitAuditLog(log)) {
      grouped.push({
        ...log,
        isDiseaseLog: log.log_type === 'Bệnh cây',
        isFruitAuditLog: isFruitAuditLog(log),
        targetDisplay: `Cây #${log.tree_code || log.plant_id}${log.farm_name ? ' (' + log.farm_name + ')' : ''}`
      });
      continue;
    }

    const dateStr = log.log_date ? new Date(log.log_date).toISOString().slice(0, 10) : '';
    const farmId = log.farm_id || 0;
    const logType = log.log_type || 'Chăm sóc';

    const supplyName = (log.details?.supply_name || log.details?.fertilizer_name || log.details?.pesticide_name || log.details?.foliar_nutrition || log.details?.fertilizer || log.details?.pesticide || '').trim().toLowerCase();

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

    if (log.plant_id) {
      groupObj.plantsMap.set(log.plant_id, log.tree_code || String(log.plant_id));
    }

    const qVal = parseFloat(log.details?.quantity ?? log.details?.amount ?? log.details?.qty ?? log.details?.dosage ?? log.details?.volume ?? log.details?.yield_kg ?? 0) || 0;
    groupObj.totalQuantity += qVal;
    if (!groupObj.unit && (log.details?.unit || log.details?.package_unit)) {
      groupObj.unit = log.details?.unit || log.details?.package_unit;
    }

    const cVal = parseFloat(log.details?.total_cost || 0) || 0;
    groupObj.totalCost += cVal;

    const rVal = parseFloat(log.details?.total_revenue || 0) || 0;
    groupObj.totalRevenue += rVal;

    const fVal = parseInt(log.details?.fruit_count || 0) || 0;
    groupObj.totalFruitCount += fVal;

    const logTime = log.details?.time || (log.log_date ? new Date(log.log_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');
    if (logTime && !groupObj.timesList.includes(logTime)) {
      groupObj.timesList.push(logTime);
    }

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
        if (l.details.work_content)    parts.push(`Công việc: ${l.details.work_content}`);
        if (l.details.worker_count)    parts.push(`Số người: ${l.details.worker_count} người`);
        if (l.details.time_range)      parts.push(`Giờ làm: ${l.details.time_range}`);
        if (l.details.method)          parts.push(`Cách: ${l.details.method}`);
        if (l.details.amount && l.details.unit && !l.details.worker_count) parts.push(`Lượng: ${l.details.amount} ${l.details.unit}`);
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

      const mediaHtml = (l.log_type === 'Bệnh cây' || l.log_type === 'Nhân công')
        ? buildMediaThumbnailsHtml(l.media_urls, 36)
        : '';

      const badgeMap = {
        'Tưới nước': 'badge-blue',
        'Bón phân':  'badge-brown',
        'Phun thuốc': 'badge-purple',
        'Nhân công': 'badge-blue',
        'Kiểm toán quả': 'badge-green',
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

export function renderUserLogsTable(logs) {
  const tbody   = document.getElementById('user-logs-table');
  const moreWrap = document.getElementById('user-logs-more-btn-wrap');
  if (!tbody) return;

  if (!logs || !logs.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i data-lucide="clipboard-list" class="lucide-sm"></i><p>Không có hoạt động canh tác nào trong 3 ngày qua</p></td></tr>';
    if (moreWrap) moreWrap.style.display = 'none';
    return;
  }

  enrichLogsWithFruitAuditChain(logs);
  if (moreWrap) moreWrap.style.display = 'block';

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
    .slice(0, 3);

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

    const dayGroupedItems = groupCareLogs(dayLogs);

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

    dayGroupedItems.forEach(l => {
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

      const targetDisplay = l.targetDisplay || (l.plant_id ? `Cây #${l.tree_code || l.plant_id}` : 'Toàn vườn');
      const farmName = l.farm_name ? ` (${esc(l.farm_name)})` : '';

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
      } else if (l.log_type === 'Nhân công') {
        badgeClass = 'badge-blue';
        icon = 'users';
      } else if (l.log_type === 'Kiểm toán quả') {
        badgeClass = 'badge-green';
        icon = 'apple';
      }

      let detailsStr = esc(l.note || '');
      let auditDeltaHtml = '';
      if (l.details && Object.keys(l.details).length > 0) {
        const parts = [];
        const qtyVal = l.details.quantity ?? l.details.amount ?? l.details.qty ?? l.details.dosage ?? l.details.volume ?? l.details.yield_kg;
        const unitVal = l.details.unit || l.details.package_unit || '';
        const supName = l.details.supply_name || l.details.fertilizer_name || l.details.pesticide_name || l.details.foliar_nutrition || l.details.fertilizer || l.details.pesticide;

        if (l.log_type === 'Nhân công') {
          if (l.details.work_content) parts.push(`Nội dung: <strong style="color:#0f172a;">${esc(l.details.work_content)}</strong>`);
          if (l.details.worker_count) parts.push(`Số lượng: <strong style="color:#0284c7;">${esc(l.details.worker_count)} người</strong>`);
          if (l.details.time_range) parts.push(`Giờ làm: <strong>${esc(l.details.time_range)}</strong>`);
        } else if (l.log_type === 'Kiểm toán quả') {
          if (l.details.audit_stage) parts.push(`Giai đoạn: <strong style="color:#0f766e;">${esc(l.details.audit_stage)}</strong>`);
          if (l.details.fruit_count !== undefined) parts.push(`Đếm thực tế: <strong style="color:#0f172a;">${esc(l.details.fruit_count)} quả</strong>`);
          if (l.details.reason) parts.push(`Nguyên nhân: ${esc(l.details.reason)}`);
          auditDeltaHtml = _buildFruitDeltaBadgeHtml(l.details, false);
        } else {
          if (supName) parts.push(`Vật tư: <strong style="color:#0f172a;">${esc(supName)}</strong>`);
          if (qtyVal !== undefined && qtyVal !== null && qtyVal !== '' && qtyVal > 0) parts.push(`Tổng lượng: <strong style="color:#059669;">${esc(qtyVal)} ${esc(unitVal)}</strong>`);
        }
        if (l.log_type !== 'Kiểm toán quả' && l.details.fruit_count) parts.push(`Số trái: <strong>${esc(l.details.fruit_count)}</strong>`);
        if (l.log_type === 'Thu hoạch' && l.details.harvest_comparison_text) auditDeltaHtml = _buildFruitDeltaBadgeHtml(l.details, true);
        if (l.details.total_cost) parts.push(`Chi phí: <strong style="color:#dc2626;">${Number(l.details.total_cost).toLocaleString('vi-VN')} đ</strong>`);
        if (l.details.total_revenue) parts.push(`Doanh thu: <strong style="color:#059669;">${Number(l.details.total_revenue).toLocaleString('vi-VN')} đ</strong>`);
        if (l.details.avg_price_per_fruit) parts.push(`TB/quả: <strong style="color:#d97706;">${Number(l.details.avg_price_per_fruit).toLocaleString('vi-VN')} đ</strong>`);
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
            ${farmName ? `<span style="font-size: 11px; color: #64748b; display: block; margin-top: 2px;">${esc(farmName)}</span>` : ''}
          </td>
          <td data-label="Hoạt động" style="vertical-align: middle; padding: 12px 14px; white-space: nowrap;">
            <span class="badge ${badgeClass}" style="font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px;">
              <i data-lucide="${icon}" class="lucide-xs"></i> ${esc(l.log_type)}
            </span>
            ${l.occurrenceCount > 1 ? `<span class="badge" style="font-size: 10px; font-weight: 800; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 2px 6px; border-radius: 10px; margin-left: 4px;" title="Gom nhóm ${l.occurrenceCount} lượt trong cùng ngày"><i data-lucide="layers" class="lucide-sm" style="font-size: 9px;"></i> ${l.occurrenceCount} lượt</span>` : ''}
          </td>
          <td data-label="Chi tiết / Ghi chú" style="vertical-align: middle; padding: 12px 14px; font-size: 13px; color: #334155; line-height: 1.5;">
            <div>${detailsStr || 'Đã hoàn thành công việc theo quy trình chuẩn.'}</div>
            ${auditDeltaHtml}
            ${mediaHtml ? `<div style="margin-top: 4px;">${mediaHtml}</div>` : ''}
          </td>
          <td data-label="Người thực hiện" style="vertical-align: middle; padding: 12px 14px; white-space: nowrap; font-size: 12.5px; color: #475569;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <i data-lucide="user" class="lucide-sm" style="color: #94a3b8; font-size: 11px;"></i>
              <span style="font-weight: 600; color: #334155;">${esc(creatorName)}</span>
            </div>
          </td>
          <td data-label="Thao tác" style="vertical-align: middle; padding: 12px 14px; text-align: right; white-space: nowrap;">
            <div class="log-action-btns" style="display: inline-flex; align-items: center; gap: 6px; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary btn-xs" onclick="openCareModal(${l.plant_id || 'null'}, '${esc(l.tree_code || '')}', '${esc(l.plant_type || '')}', ${l.id})" style="padding: 4px 10px; font-size: 11.5px; font-weight: 700; border-radius: 6px;">
                <i data-lucide="edit-3" class="lucide-sm"></i> Sửa
              </button>
              <button type="button" class="btn btn-danger btn-xs" onclick="deleteCareLog(${l.id})" style="padding: 4px 10px; font-size: 11.5px; font-weight: 700; border-radius: 6px;">
                <i data-lucide="trash-2" class="lucide-sm"></i> Xóa
              </button>
            </div>
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

  const rbac = getCurrentUserRbac();
  const isFinanceRedacted = rbac.isFinanceRedacted;
  const canDelete = rbac.isFarmOwner || rbac.isManager;
  const canEdit = !rbac.isAuditor;

  const totalLogs = _currentFilteredLogs.length;
  const totalPages = Math.ceil(totalLogs / _logPageSize) || 1;

  if (_currentLogPage < 1) _currentLogPage = 1;
  if (_currentLogPage > totalPages) _currentLogPage = totalPages;

  const startIndex = (_currentLogPage - 1) * _logPageSize;
  const endIndex = Math.min(startIndex + _logPageSize, totalLogs);
  const pageLogs = _currentFilteredLogs.slice(startIndex, endIndex);

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
    'Nhân công': 'users',
    'Kiểm toán quả': 'apple',
    'Cắt tỉa': 'scissors',
    'Cắt lá': 'scissors',
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
            ${_batchSelectMode && canDelete ? `<input type="checkbox" class="log-day-select-all" onchange="toggleSelectAllDay('${esc(dateStr)}', this.checked)" style="width:17px; height:17px; cursor:pointer; accent-color:#10b981; margin-right:4px;" title="Chọn tất cả mục trong ngày này">` : ''}
            <i data-lucide="calendar-days" class="lucide-sm" style="color:#10b981;"></i> <span>${dateHeaderTitle}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4); font-size:11.5px; font-weight:700; padding:3px 12px; border-radius:20px;">
              ${dayItems.length} nhật ký hoạt động
            </span>
            ${canDelete ? `
            <button type="button" class="btn btn-xs" onclick="deleteDayLogs('${esc(dateStr)}')" style="background:rgba(220,38,38,0.25); color:#fca5a5; border:1px solid rgba(220,38,38,0.4); border-radius:8px; padding:4px 10px; font-size:11.5px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:5px;" title="Xóa mềm toàn bộ hoạt động trong ngày ${esc(dateStr)}">
              <i data-lucide="trash-2" class="lucide-sm"></i> Xóa ngày này
            </button>
            ` : ''}
          </div>
        </div>

        <div style="padding:16px; display:flex; flex-direction:column; gap:10px;">
    `;

    dayItems.forEach(l => {
      let detailsStr = esc(l.note || '');
      let itemDeltaBadgeHtml = '';
      if (l.details && Object.keys(l.details).length > 0) {
        const parts = [];
        const qtyVal = l.details.quantity ?? l.details.amount ?? l.details.qty ?? l.details.dosage ?? l.details.volume ?? l.details.yield_kg;
        const unitVal = l.details.unit || l.details.package_unit || '';
        const supName = l.details.supply_name || l.details.fertilizer_name || l.details.pesticide_name || l.details.foliar_nutrition || l.details.fertilizer || l.details.pesticide;

        if (l.log_type === 'Nhân công') {
          if (l.details.work_content) parts.push(`Nội dung: ${l.details.work_content}`);
          if (l.details.worker_count) parts.push(`Số người: ${l.details.worker_count} người`);
          if (l.details.time_range)   parts.push(`Giờ làm: ${l.details.time_range}`);
        } else if (l.log_type === 'Kiểm toán quả') {
          if (l.details.audit_stage) parts.push(`Giai đoạn: ${l.details.audit_stage}`);
          if (l.details.fruit_count !== undefined) parts.push(`Số quả đếm được: ${l.details.fruit_count} quả`);
          if (l.details.audit_time) parts.push(`Giờ đếm: ${l.details.audit_time}`);
          itemDeltaBadgeHtml = _buildFruitDeltaBadgeHtml(l.details, false);
        } else {
          if (supName) parts.push(`Vật tư: ${supName}`);
          if (qtyVal !== undefined && qtyVal !== null && qtyVal !== '') parts.push(`Lượng: ${qtyVal} ${unitVal}`);
        }
        if (l.log_type !== 'Kiểm toán quả' && l.details.fruit_count) parts.push(`Số trái: ${l.details.fruit_count}`);
        if (l.log_type === 'Thu hoạch' && l.details.harvest_comparison_text) itemDeltaBadgeHtml = _buildFruitDeltaBadgeHtml(l.details, true);
        if (l.details.total_revenue && !isFinanceRedacted)   parts.push(`Doanh thu: ${Number(l.details.total_revenue).toLocaleString('vi-VN')} đ`);
        if (l.details.total_cost && !isFinanceRedacted)      parts.push(`Chi phí: ${Number(l.details.total_cost).toLocaleString('vi-VN')} đ`);
        if (l.details.method)          parts.push(`Cách: ${l.details.method}`);
        if (l.details.reason)          parts.push(`Lý do: ${l.details.reason}`);
        if (l.details.disease_name)    parts.push(`Bệnh: ${l.details.disease_name}`);
        if (l.details.severity)        parts.push(`Mức độ: ${l.details.severity}`);
        if (parts.length > 0) {
          detailsStr = `[${parts.join(', ')}]` + (l.note ? ` - ${esc(l.note)}` : '');
        }
      }

      if (isFinanceRedacted && detailsStr) {
        detailsStr = detailsStr.replace(/,?\s*(?:Doanh thu|Chi phí|Đơn giá):\s*[\d\.,\s]+(?:đ|VNĐ|vnd)/gi, '');
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
              ${_batchSelectMode && canDelete && l.id ? `<input type="checkbox" class="log-item-checkbox log-cb-day-${esc(dateStr)}" value="${l.id}" ${isSelected ? 'checked' : ''} onchange="toggleLogSelection(${l.id}, this.checked)" style="width:18px; height:18px; cursor:pointer; accent-color:#059669; flex-shrink:0;">` : ''}
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
              ${canEdit ? `
              <button class="btn btn-secondary btn-sm" onclick="openCareModal(${l.plant_id}, '${esc(l.tree_code || l.plant_id)}', '${esc(l.plant_type)}', ${l.id})" style="border-color:#fca5a5; color:#dc2626;">
                <i data-lucide="edit-3" class="lucide-sm"></i> Sửa
              </button>
              ` : ''}
              ${canDelete ? `
              <button class="btn btn-danger btn-sm" onclick="deleteCareLog(${l.id}, ${l.plant_id || 'null'})" title="Xóa mềm nhật ký này">
                <i data-lucide="trash-2" class="lucide-sm"></i>
              </button>
              ` : ''}
            </div>
          </div>
        `;
      } else {
        html += `
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:240px;">
              ${_batchSelectMode && canDelete && l.id ? `<input type="checkbox" class="log-item-checkbox log-cb-day-${esc(dateStr)}" value="${l.id}" ${isSelected ? 'checked' : ''} onchange="toggleLogSelection(${l.id}, this.checked)" style="width:18px; height:18px; cursor:pointer; accent-color:#059669; flex-shrink:0;">` : ''}
              <div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span class="badge badge-green" style="font-size:11px; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                    <i data-lucide="${iconKey}" class="lucide-xs"></i> ${esc(l.log_type)}
                  </span>
                  <strong style="color:#0f172a; font-size:14px;">${esc(targetDisplay)}</strong>
                </div>
                ${detailsStr ? `<div style="font-size:12.5px; color:#475569; margin-top:4px;">${detailsStr}</div>` : ''}
                ${itemDeltaBadgeHtml || ''}
                ${mediaHtml ? `<div style="margin-top:6px;">${mediaHtml}</div>` : ''}
                <div style="font-size:11.5px; color:#64748b; margin-top:4px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="user" class="lucide-xs" style="color:#059669;"></i> Thực hiện: <strong>${esc(l.creator_name || 'Nông hộ')}</strong></span>
                  ${l.farm_name ? `<span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="home" class="lucide-xs" style="color:#059669;"></i> ${esc(l.farm_name)}</span>` : ''}
                </div>
              </div>
            </div>

            <div style="display:flex; gap:6px;">
              ${canEdit ? `
              <button class="btn btn-secondary btn-sm" onclick="openCareModal(${l.plant_id}, '${esc(l.tree_code || l.plant_id)}', '${esc(l.plant_type)}', ${l.id})">
                <i data-lucide="edit-3" class="lucide-sm"></i> Sửa
              </button>
              ` : ''}
              ${canDelete ? `
              <button class="btn btn-danger btn-sm" onclick="deleteCareLog(${l.id}, ${l.plant_id || 'null'})" title="Xóa mềm nhật ký này">
                <i data-lucide="trash-2" class="lucide-sm"></i>
              </button>
              ` : ''}
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

export function renderUserLogsTableFull(logs) {
  _currentFilteredLogs = logs || [];
  _currentLogPage = 1;
  _renderLogPage();
}

function _logRow(l) {
  let detailsStr = esc(l.note || '');
  if (l.details && Object.keys(l.details).length > 0) {
    const parts = [];
    if (l.log_type === 'Kiểm toán quả') {
      if (l.details.audit_stage) parts.push(`Giai đoạn: ${l.details.audit_stage}`);
      if (l.details.fruit_count !== undefined) parts.push(`Số quả: ${l.details.fruit_count} quả`);
      if (l.details.comparison_text) parts.push(l.details.comparison_text);
      if (l.details.reason) parts.push(`Nguyên nhân: ${l.details.reason}`);
    } else {
      if (l.details.work_content)    parts.push(`Nội dung: ${l.details.work_content}`);
      if (l.details.worker_count)    parts.push(`Số người: ${l.details.worker_count} người`);
      if (l.details.time_range)      parts.push(`Giờ làm: ${l.details.time_range}`);
      if (l.details.method)          parts.push(`Cách: ${l.details.method}`);
      if (l.details.amount && !l.details.worker_count) parts.push(`Lượng: ${l.details.amount} ${l.details.unit || ''}`);
      if (l.details.fertilizer_name) parts.push(`Phân: ${l.details.fertilizer_name}`);
      if (l.details.pesticide_name)  parts.push(`Thuốc: ${l.details.pesticide_name}`);
      if (l.details.reason)          parts.push(`Lý do: ${l.details.reason}`);
      if (l.details.disease_name)    parts.push(`Bệnh: ${l.details.disease_name}`);
      if (l.details.severity)        parts.push(`Mức độ: ${l.details.severity}`);
      if (l.details.harvest_comparison_text) parts.push(l.details.harvest_comparison_text);
    }
    if (parts.length > 0) {
      detailsStr = `<span style="${l.log_type === 'Bệnh cây' ? 'color:#991b1b;font-weight:700;' : 'color:var(--green)'}">[${parts.join(', ')}]</span>` + (l.note ? ` - ${esc(l.note)}` : '');
    }
  }

  const mediaHtml = (l.log_type === 'Bệnh cây' || l.log_type === 'Nhân công' || l.log_type === 'Kiểm toán quả')
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

export function applyLogsRoleArchitecture() {
  const rbac = getCurrentUserRbac();
  const btnSelectiveDelete = document.getElementById('btn-open-selective-log-delete');
  const btnBatchSelect = document.getElementById('btn-toggle-batch-log-mode');
  const bannerEl = document.getElementById('logs-role-scope-banner');

  const canManage = rbac.isFarmOwner || rbac.isManager;
  if (btnSelectiveDelete) btnSelectiveDelete.style.display = canManage ? 'inline-flex' : 'none';
  if (btnBatchSelect) btnBatchSelect.style.display = canManage ? 'inline-flex' : 'none';

  if (bannerEl) {
    if (rbac.viewPlantsScope === 'assigned') {
      const plantCount = (rbac.assignedPlantIds || []).length;
      bannerEl.style.display = 'flex';
      bannerEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <i data-lucide="shield-check" class="lucide-sm" style="color:#0284c7;"></i>
          <span><strong>Phạm vi phụ trách:</strong> Hiển thị nhật ký canh tác của <strong>${plantCount} cây trồng</strong> được giao cho bạn (${esc(rbac.roleName || 'Nhân sự phụ trách')}).</span>
        </div>
      `;
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    } else {
      bannerEl.style.display = 'none';
    }
  }
}
window.applyLogsRoleArchitecture = applyLogsRoleArchitecture;

export function filterUserLogs() {
  applyLogsRoleArchitecture();

  const rbac = getCurrentUserRbac();
  const query       = (document.getElementById('user-log-search')?.value || '').trim().toLowerCase();
  const farmId      = document.getElementById('user-log-filter-farm')?.value || 'all';
  const filterType  = document.getElementById('user-log-filter-type')?.value || 'all';
  const sortBy      = document.getElementById('user-log-sort-by')?.value || 'date_desc';

  let filtered = [..._logsCache];

  if (rbac.viewPlantsScope === 'assigned') {
    const assignedIds = new Set((rbac.assignedPlantIds || []).map(String));
    if (assignedIds.size > 0) {
      filtered = filtered.filter(l => !l.plant_id || assignedIds.has(String(l.plant_id)) || (l.assigned_to_user_id && String(l.assigned_to_user_id) === String(rbac.userId)));
    }
  }

  if (farmId !== 'all') {
    filtered = filtered.filter(l => String(l.farm_id) === farmId);
  }

  if (filterType !== 'all') {
    filtered = filtered.filter(l => matchesUserLogCategory([filterType], l));
  }

  if (_diseaseOnlyFilterActive) {
    filtered = filtered.filter(l => l.log_type === 'Bệnh cây');
  }

  if (query) {
    filtered = filtered.filter(l => {
      const detailsStr = l.details ? JSON.stringify(l.details).toLowerCase() : '';
      return [String(l.plant_id), String(l.tree_code || ''), l.farm_name, l.note, l.log_type, l.creator_name, detailsStr]
        .some(v => (v || '').toLowerCase().includes(query));
    });
  }

  let resultList = groupCareLogs(filtered);

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

export async function reloadUserLogs() {
  try {
    const freshLogs = await api('/plants/logs/recent?days=30');
    setLogsCache(freshLogs || []);
    filterUserLogs();
    refreshReportLibraryBadge().catch(() => {});
  } catch (err) {
    console.warn('Could not reload logs cache:', err);
  }
}
window.reloadUserLogs = reloadUserLogs;

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

export function toggleLogSelection(logId, isChecked) {
  if (isChecked) {
    _selectedLogIds.add(logId);
  } else {
    _selectedLogIds.delete(logId);
  }
  updateBatchSelectionUI();
}
window.toggleLogSelection = toggleLogSelection;

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

export function openSelectiveDeleteModal() {
  const modal = document.getElementById('selective-log-delete-modal');
  if (!modal) return;

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

function mergeLogsIntoCache(incomingLogs) {
  const existing = Array.isArray(_logsCache) ? _logsCache : [];
  const byKey = new Map();
  const keyOf = (l) => (l && l.id != null) ? `id_${l.id}` : `tmp_${l?.plant_id}_${l?.log_date}_${l?.log_type}_${l?.created_at}`;
  existing.forEach(l => { if (l) byKey.set(keyOf(l), l); });
  (incomingLogs || []).forEach(l => {
    if (!l) return;
    const k = keyOf(l);
    const prev = byKey.get(k);
    byKey.set(k, prev ? { ...prev, ...l } : l);
  });
  setLogsCache(enrichLogsWithFruitAuditChain(Array.from(byKey.values())));
}

function getScopedLogsForExportModal() {
  const farmId = document.getElementById('modal-export-farm')?.value || 'all';
  const plantId = document.getElementById('modal-export-plant')?.value || 'all';
  let list = [...(_logsCache || [])];
  if (farmId !== 'all') list = list.filter(l => String(l.farm_id) === String(farmId));
  if (plantId !== 'all') list = list.filter(l => String(l.plant_id) === String(plantId));
  return list;
}

function updateUserExportCategoryCounts() {
  const scoped = getScopedLogsForExportModal();
  const countEls = document.querySelectorAll('[data-export-cat-count]');
  countEls.forEach(el => {
    const cat = el.getAttribute('data-export-cat-count');
    if (!cat) return;
    el.textContent = String(scoped.filter(l => matchesUserLogCategory([cat], l)).length);
  });
}

export function updateUserExportMatchSummary() {
  updateUserExportCategoryCounts();
  const summaryEl = document.getElementById('modal-export-match-summary');
  if (!summaryEl) return 0;
  const fromDate = document.getElementById('modal-export-date-from')?.value || '';
  const toDate = document.getElementById('modal-export-date-to')?.value || '';

  const checkedCats = [];
  document.querySelectorAll('input[name="user_export_cat"]:checked').forEach(cb => checkedCats.push(cb.value));

  if (checkedCats.length === 0) {
    summaryEl.textContent = 'Vui lòng chọn ít nhất 1 hạng mục canh tác để xuất báo cáo.';
    summaryEl.style.background = '#fef2f2';
    summaryEl.style.borderColor = '#fecaca';
    summaryEl.style.color = '#991b1b';
    return 0;
  }

  let list = getScopedLogsForExportModal();
  if (fromDate) list = list.filter(l => {
    const d = toLocalYmd(l.log_date || l.created_at);
    return d && d >= fromDate;
  });
  if (toDate) list = list.filter(l => {
    const d = toLocalYmd(l.log_date || l.created_at);
    return d && d <= toDate;
  });
  list = list.filter(l => matchesUserLogCategory(checkedCats, l));

  summaryEl.style.background = '#ecfdf5';
  summaryEl.style.borderColor = '#a7f3d0';
  summaryEl.style.color = '#065f46';
  summaryEl.textContent = `Đã chọn ${checkedCats.length} hạng mục · Tìm thấy ${list.length} bản ghi nhật ký phù hợp chuẩn VietGAP / GlobalG.A.P.`;
  return list.length;
}
window.updateUserExportMatchSummary = updateUserExportMatchSummary;

function renderUserExportCategoryGrid() {
  const catsContainer = document.getElementById('modal-export-categories-grid');
  if (!catsContainer) return;
  const standardCats = ['Kiểm toán quả', 'Phun thuốc', 'Bón phân', 'Tưới nước', 'Nhân công', 'Bệnh cây', 'Thu hoạch'];
  const logs = getScopedLogsForExportModal();
  catsContainer.innerHTML = standardCats.map(cat => {
    const label = cat === 'Nhân công' ? 'Thuê nhân công' : cat;
    const cnt = logs.filter(l => matchesUserLogCategory([cat], l)).length;
    return `
      <label style="display:flex; align-items:center; justify-content:space-between; gap:6px; background:#f8fafc; border:1px solid #e2e8f0; padding:7px 10px; border-radius:8px; font-size:12.5px; font-weight:600; color:#334155; cursor:pointer;">
        <span style="display:inline-flex; align-items:center; gap:6px;">
          <input type="checkbox" name="user_export_cat" value="${esc(cat)}" checked onchange="updateUserExportMatchSummary()" style="accent-color:#059669; cursor:pointer;">
          <span>${esc(label)}</span>
        </span>
        <span data-export-cat-count="${esc(cat)}" style="font-size:11px; font-weight:800; color:#047857; background:#ecfdf5; border:1px solid #a7f3d0; padding:1px 6px; border-radius:999px;">${cnt}</span>
      </label>
    `;
  }).join('');
}

export async function openUserExportLogsModal(defaultMode, presetFarmId, presetPlantId, presetPlantObj) {
  const farmSel = document.getElementById('modal-export-farm');
  const plantSel = document.getElementById('modal-export-plant');
  const fromDateInput = document.getElementById('modal-export-date-from');
  const toDateInput = document.getElementById('modal-export-date-to');
  const titleInput = document.getElementById('modal-export-report-title');

  const erpPlant = presetPlantObj || null;
  const rawPlantLogs = (erpPlant && Array.isArray(erpPlant.logs) && erpPlant.logs.length > 0)
    ? erpPlant.logs
    : ((presetPlantId && presetPlantId !== 'all' && typeof window !== 'undefined' && Array.isArray(window._currentErpEnrichedLogs)) ? window._currentErpEnrichedLogs : []);

  if (rawPlantLogs.length > 0) {
    const normalizedErpLogs = rawPlantLogs.map(l => ({
      ...l,
      farm_id: l.farm_id || erpPlant?.farm_id || (presetFarmId && presetFarmId !== 'all' ? presetFarmId : null),
      farm_name: l.farm_name || erpPlant?.farm_name || '',
      plant_id: l.plant_id || erpPlant?.id || (presetPlantId && presetPlantId !== 'all' ? presetPlantId : null),
      tree_code: l.tree_code || erpPlant?.tree_code || erpPlant?.id || '',
      plant_type: l.plant_type || erpPlant?.plant_type || '',
      plant_variety: l.plant_variety || erpPlant?.plant_variety || ''
    }));
    mergeLogsIntoCache(normalizedErpLogs);
  }

  const filterFarmSel = document.getElementById('user-log-filter-farm');
  if (farmSel) {
    if (filterFarmSel && filterFarmSel.options && filterFarmSel.options.length > 1) {
      farmSel.innerHTML = filterFarmSel.innerHTML;
    } else {
      let farms = [];
      try { farms = getFarmsCache() || []; } catch (_) { farms = []; }
      farmSel.innerHTML = '<option value="all">Tất cả trang trại</option>'
        + farms.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
    }
    const targetFarmVal = (presetFarmId && presetFarmId !== 'all') ? String(presetFarmId) : ((filterFarmSel && filterFarmSel.value) || 'all');
    const existingFarmOpts = farmSel.options ? Array.from(farmSel.options) : [];
    if (targetFarmVal !== 'all' && !existingFarmOpts.some(o => String(o.value) === targetFarmVal) && typeof document !== 'undefined' && typeof document.createElement === 'function' && typeof farmSel.appendChild === 'function') {
      const fOpt = document.createElement('option');
      fOpt.value = targetFarmVal;
      fOpt.textContent = erpPlant?.farm_name || `Trang trại #${targetFarmVal}`;
      farmSel.appendChild(fOpt);
    }
    farmSel.value = targetFarmVal;
    if (!farmSel.value) farmSel.value = 'all';
  }

  onModalExportFarmChange();
  if (plantSel && presetPlantId && presetPlantId !== 'all') {
    const existingOpts = plantSel.options ? Array.from(plantSel.options) : [];
    if (!existingOpts.some(o => String(o.value) === String(presetPlantId)) && typeof document !== 'undefined' && typeof document.createElement === 'function' && typeof plantSel.appendChild === 'function') {
      const opt = document.createElement('option');
      opt.value = String(presetPlantId);
      const tCode = erpPlant?.tree_code || presetPlantId;
      const pType = erpPlant?.plant_type ? ` (${erpPlant.plant_type})` : '';
      opt.textContent = `Cây #${tCode}${pType}`;
      plantSel.appendChild(opt);
    }
    plantSel.value = String(presetPlantId);
  }

  if (titleInput && !titleInput.dataset.userEdited) {
    const selectedFarmOpt = (farmSel && farmSel.options && farmSel.selectedIndex >= 0) ? farmSel.options[farmSel.selectedIndex] : null;
    const fLabel = (selectedFarmOpt && farmSel.value !== 'all') ? ` — ${selectedFarmOpt.text}` : '';
    const pLabel = (plantSel && plantSel.value !== 'all' && erpPlant) ? ` · Cây #${erpPlant.tree_code || erpPlant.id}` : '';
    titleInput.value = `SỔ NHẬT KÝ CANH TÁC & KIỂM ĐỊNH CHẤT LƯỢNG CÂY TRỒNG${fLabel}${pLabel}`;
  }

  const today = toLocalYmd(new Date());
  const scopedLogs = getScopedLogsForExportModal();
  const baseLogsForDates = scopedLogs.length > 0 ? scopedLogs : (_logsCache || []);
  const logDates = baseLogsForDates
    .map(l => toLocalYmd(l.log_date || l.created_at))
    .filter(Boolean)
    .sort();
  if (fromDateInput) fromDateInput.value = logDates.length > 0 ? logDates[0] : '';
  if (toDateInput) toDateInput.value = today;

  renderUserExportCategoryGrid();
  updateUserExportMatchSummary();

  const modal = document.getElementById('user-export-logs-modal');
  if (modal) {
    if (typeof document !== 'undefined' && document.body && typeof document.body.appendChild === 'function' && modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
    if (modal.style && typeof modal.style.setProperty === 'function') {
      modal.style.setProperty('z-index', '100050', 'important');
    } else if (modal.style) {
      modal.style.zIndex = '100050';
    }
    modal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
    if (window.PlantBookI18n && typeof window.PlantBookI18n.applyDomTranslations === 'function') {
      window.PlantBookI18n.applyDomTranslations();
    }
  }

  try {
    const freshRes = await api('/plants/logs/recent?days=all');
    if (Array.isArray(freshRes) && freshRes.length > 0) {
      mergeLogsIntoCache(freshRes);
      const mergedScoped = getScopedLogsForExportModal();
      const datePool = mergedScoped.length > 0 ? mergedScoped : (_logsCache || []);
      const dates = datePool
        .map(l => toLocalYmd(l.log_date || l.created_at))
        .filter(Boolean)
        .sort();
      if (fromDateInput && dates.length > 0 && (!fromDateInput.value || dates[0] < fromDateInput.value)) {
        fromDateInput.value = dates[0];
      }
      renderUserExportCategoryGrid();
      updateUserExportMatchSummary();
    }
  } catch (_) {}
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
  updateUserExportMatchSummary();
}
window.toggleAllUserExportCats = toggleAllUserExportCats;

export function selectUserExportPreset(preset) {
  const checkboxes = document.querySelectorAll('input[name="user_export_cat"]');
  checkboxes.forEach(cb => {
    if (preset === 'all') cb.checked = true;
    else if (preset === 'none') cb.checked = false;
    else if (preset === 'fruit_audit') cb.checked = (cb.value === 'Kiểm toán quả' || cb.value === 'Thu hoạch');
    else if (preset === 'phi_safety') cb.checked = (cb.value === 'Phun thuốc' || cb.value === 'Bón phân' || cb.value === 'Bệnh cây');
  });
  updateUserExportMatchSummary();
}
window.selectUserExportPreset = selectUserExportPreset;

function formatLogDetailsText(log) {
  const d = log.details || {};
  const parts = [];
  const qty = d.amount ?? d.quantity ?? d.qty ?? d.dosage ?? d.volume ?? '';
  if (log.log_type === 'Tưới nước') {
    if (d.method || log.equipment_used) parts.push(`Phương pháp: ${d.method || log.equipment_used}`);
    if (d.water_liters) parts.push(`Lượng nước: ${d.water_liters} Lít`);
    else if (qty) parts.push(`Lượng nước: ${qty} ${d.unit || 'm³'}`);
  } else if (log.log_type === 'Bón phân') {
    if (d.supply_name || d.fertilizer_name || d.material_name) parts.push(`Tên phân: ${d.supply_name || d.fertilizer_name || d.material_name}`);
    if (d.type) parts.push(`Loại: ${d.type}`);
    if (qty) parts.push(`Lượng: ${qty} ${d.unit || 'kg'}`);
  } else if (log.log_type === 'Phun thuốc') {
    if (d.supply_name || d.pesticide_name || d.material_name) parts.push(`Tên thuốc: ${d.supply_name || d.pesticide_name || d.material_name}`);
    if (d.type) parts.push(`Loại thuốc: ${d.type}`);
    if (qty) parts.push(`Liều lượng: ${qty} ${d.unit || ''}`.trim());
    if (d.active_ingredient) parts.push(`Hoạt chất: ${d.active_ingredient}`);
    if (d.phi_days || d.phi) parts.push(`Cách ly PHI: ${d.phi_days || d.phi} ngày`);
    if (d.reason) parts.push(`Đối tượng phòng trừ: ${d.reason}`);
  } else if (log.log_type === 'Nhân công') {
    if (d.work_content) parts.push(`Nội dung: ${d.work_content}`);
    if (d.worker_count) parts.push(`Số người: ${d.worker_count} người`);
    if (d.time_range) parts.push(`Giờ làm: ${d.time_range}`);
    if (d.batch_total_cost || d.total_cost) parts.push(`Chi phí: ${Number(d.batch_total_cost || d.total_cost).toLocaleString('vi-VN')} đ`);
  } else if (log.log_type === 'Cắt lá' || log.log_type === 'Cắt tỉa') {
    if (qty) parts.push(`Số lượng cành/lá: ${qty}`);
    if (d.reason) parts.push(`Mục đích: ${d.reason}`);
  } else if (log.log_type === 'Tỉa hoa') {
    if (qty) parts.push(`Số lượng hoa/quả: ${qty}`);
    if (d.reason) parts.push(`Mục đích: ${d.reason}`);
  } else if (log.log_type === 'Kiểm toán quả') {
    if (d.audit_stage || d.fruit_stage) parts.push(`Giai đoạn: ${d.audit_stage || d.fruit_stage}`);
    if (d.fruit_count !== undefined) parts.push(`Số quả: ${d.fruit_count} quả`);
    if (d.dropped_or_culled_count > 0) parts.push(`Rụng/Tỉa bỏ: ${d.dropped_or_culled_count} quả`);
    if (d.audit_time) parts.push(`Giờ đếm: ${d.audit_time}`);
    if (d.comparison_text) parts.push(d.comparison_text);
    if (d.reason) parts.push(`Nguyên nhân/Ghi nhận: ${d.reason}`);
  } else if (log.log_type === 'Thu hoạch') {
    if (d.amount || d.yield_kg) parts.push(`Sản lượng: ${d.amount || d.yield_kg} ${d.unit || 'kg'}`);
    if (d.fruit_count) parts.push(`Số lượng trái: ${d.fruit_count} trái`);
    if (d.harvest_comparison_text) parts.push(d.harvest_comparison_text);
    if (d.total_revenue) parts.push(`Doanh thu: ${Number(d.total_revenue).toLocaleString('vi-VN')} đ`);
    if (d.avg_price_per_fruit) parts.push(`TB/quả: ${Number(d.avg_price_per_fruit).toLocaleString('vi-VN')} đ`);
    if (d.quality) parts.push(`Chất lượng: ${d.quality}`);
  } else if (log.log_type === 'Bệnh cây') {
    if (d.disease_name) parts.push(`Tên bệnh/sâu hại: ${d.disease_name}`);
    if (d.severity) parts.push(`Mức độ: ${d.severity}`);
    if (d.description) parts.push(`Mô tả triệu chứng: ${d.description}`);
  } else {
    if (d.method) parts.push(d.method);
    if (qty) parts.push(`${qty} ${d.unit || ''}`.trim());
  }
  return parts.join(' | ');
}

export function exportLogsToCsv(logs, filename = 'NhatKyCanhTac.csv', meta = {}) {
  if (!Array.isArray(logs) || logs.length === 0) {
    toast('Không có nhật ký canh tác nào để xuất file.', 'warning');
    return;
  }

  const tr = (txt) => {
    if (window.PlantBookI18n && typeof window.PlantBookI18n.translateDynamicTerm === 'function') {
      const lang = window.PlantBookI18n.getLanguage ? window.PlantBookI18n.getLanguage() : 'vi';
      if (lang && lang !== 'vi') return window.PlantBookI18n.translateDynamicTerm(String(txt), lang);
    }
    return String(txt);
  };

  const stdLabel = meta.standardLabel || 'VietGAP (TCVN 11892-1:2017) · GlobalG.A.P. (IFA v6.0) · ISO 22005:2007';

  const headers = [
    "STT",
    "Tiêu Chuẩn Hồ Sơ",
    "Ngày Canh Tác",
    "Mã Cây / Lô",
    "Loại Cây",
    "Giống Cây",
    "Trang Trại",
    "Hoạt Động Canh Tác",
    "Chi Tiết Kỹ Thuật (Vật tư, Thuốc, Kiểm toán quả)",
    "Thiết Bị & Mã Lô",
    "Đơn Giá (VNĐ)",
    "Thành Tiền (VNĐ)",
    "Người Thực Hiện",
    "Ghi Chú Bổ Sung",
    "Hình Ảnh / Video Bằng Chứng"
  ].map(tr);

  function escapeCsvCell(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  const rows = [];
  rows.push(headers.map(escapeCsvCell).join(','));

  logs.forEach((log, index) => {
    const detailsStr = tr(formatLogDetailsText(log));
    const mediaUrls = (log.media_urls && Array.isArray(log.media_urls))
      ? log.media_urls.map(m => m.url || m).join('; ')
      : '';

    const d = log.details || {};
    const unitPrice = d.unit_price || d.package_price || '';
    const totalCost = d.total_cost || d.cost || '';
    const equipBatch = [log.equipment_used, log.batch_code].filter(Boolean).join(' · ');
    const operatorStr = log.operator_name || log.creator_name || d.operator_name || 'Kỹ thuật viên trang trại';

    const dateStr = log.log_date ? new Date(log.log_date).toLocaleDateString('vi-VN') : '';

    const row = [
      index + 1,
      stdLabel,
      dateStr,
      log.tree_code || log.plant_id || 'Toàn vườn',
      tr(log.plant_type || ''),
      log.plant_variety || '',
      log.farm_name || '',
      tr(log.log_type || ''),
      detailsStr,
      equipBatch,
      unitPrice,
      totalCost,
      operatorStr,
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
  openUserExportLogsModal('csv');
}
window.exportUserFilteredLogsCsv = exportUserFilteredLogsCsv;

export async function executeUserExport(mode = 'csv') {
  const farmId = document.getElementById('modal-export-farm')?.value || 'all';
  const plantId = document.getElementById('modal-export-plant')?.value || 'all';
  const fromDate = document.getElementById('modal-export-date-from')?.value || '';
  const toDate = document.getElementById('modal-export-date-to')?.value || '';
  const stdCode = document.getElementById('modal-export-standard')?.value || 'vietgap_globalgap_iso';
  const stdMap = {
    vietgap: 'VietGAP (TCVN 11892-1:2017)',
    globalgap_gacc: 'GlobalG.A.P. IFA v6.0 · Nghị định thư GACC',
    vietgap_globalgap_iso: 'VietGAP (TCVN 11892-1:2017) · GlobalG.A.P. (IFA v6.0) · ISO 22005:2007'
  };
  const standardLabel = stdMap[stdCode] || stdMap.vietgap_globalgap_iso;

  const checkedCats = [];
  document.querySelectorAll('input[name="user_export_cat"]:checked').forEach(cb => {
    checkedCats.push(cb.value);
  });

  if (checkedCats.length === 0) {
    alert('Vui lòng chọn ít nhất một hạng mục hoạt động để xuất.');
    return;
  }

  let allLogs = enrichLogsWithFruitAuditChain([..._logsCache]);
  try {
    const freshRes = await api('/plants/logs/recent?days=all');
    if (Array.isArray(freshRes) && freshRes.length > 0) {
      mergeLogsIntoCache(freshRes);
      allLogs = [..._logsCache];
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
      const d = toLocalYmd(l.log_date || l.created_at);
      return d && d >= fromDate;
    });
  }
  if (toDate) {
    filtered = filtered.filter(l => {
      const d = toLocalYmd(l.log_date || l.created_at);
      return d && d <= toDate;
    });
  }
  if (checkedCats.length > 0) {
    filtered = filtered.filter(l => matchesUserLogCategory(checkedCats, l));
  }

  filtered.sort((a, b) => new Date(a.log_date) - new Date(b.log_date));

  if (filtered.length === 0) {
    alert('Không tìm thấy nhật ký canh tác nào khớp với các tiêu chí lọc đã chọn.');
    return;
  }

  const customTitle = (document.getElementById('modal-export-report-title')?.value || '').trim()
    || 'SỔ NHẬT KÝ CANH TÁC & KIỂM ĐỊNH CHẤT LƯỢNG CÂY TRỒNG';

  closeUserExportLogsModal();

  const farmSel = document.getElementById('modal-export-farm');
  const selectedFarmOpt = (farmSel && farmSel.options && farmSel.selectedIndex >= 0) ? farmSel.options[farmSel.selectedIndex] : null;
  const farmName = selectedFarmOpt ? selectedFarmOpt.text : 'NongTrang';
  const cleanFarmName = farmName.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
  const dateSuffix = toLocalYmd(new Date());

  if (mode === 'csv') {
    exportLogsToCsv(filtered, `So_Nhat_Ky_VietGAP_GlobalGAP_${cleanFarmName}_${dateSuffix}.csv`, { standardLabel });
  } else {
    const metaPayload = {
      title: customTitle,
      farmId: farmId,
      plantId: plantId,
      farmName: farmName === 'Tất cả trang trại' ? 'Toàn bộ trang trại' : farmName,
      fromDate: fromDate,
      toDate: toDate,
      totalLogs: filtered.length,
      standardCode: stdCode,
      standardLabel,
      categories: checkedCats,
      categoriesLabel: checkedCats.map(c => c === 'Nhân công' ? 'Thuê nhân công' : c).join(', ')
    };
    if (mode === 'save_pdf') {
      const htmlDoc = buildPrintableVietGapReportHtml(filtered, metaPayload);
      const saved = await saveReportToAppLibrary({
        title: customTitle,
        farm_id: farmId,
        plant_id: plantId,
        standard_code: stdCode,
        standard_label: standardLabel,
        categories: checkedCats,
        from_date: fromDate,
        to_date: toDate,
        total_logs: filtered.length,
        report_html: htmlDoc,
        report_meta: metaPayload
      });
      metaPayload.savedReportId = saved?.id || null;
      metaPayload.autoPrint = true;
    }
    openPrintableVietGapReport(filtered, metaPayload);
  }
}
window.executeUserExport = executeUserExport;

function buildPrintableVietGapReportHtml(logs, meta = {}) {
  const now = new Date();
  const printTimeStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const fromStr = meta.fromDate ? new Date(meta.fromDate).toLocaleDateString('vi-VN') : 'Ngày đầu số hóa';
  const toStr = meta.toDate ? new Date(meta.toDate).toLocaleDateString('vi-VN') : 'Hiện tại';
  const stdLabel = meta.standardLabel || 'VietGAP (TCVN 11892-1:2017) · GlobalG.A.P. (IFA v6.0) · ISO 22005:2007';
  const reportTitle = meta.title || 'SỔ NHẬT KÝ CANH TÁC & KIỂM ĐỊNH CHẤT LƯỢNG CÂY TRỒNG';
  const originBase = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') ? window.location.origin : '';
  const logoUrl = `${originBase}/assets/logo.png`;

  let tableRowsHtml = '';
  logs.forEach((log, index) => {
    const detailsStr = formatLogDetailsText(log);
    const dateStr = log.log_date ? new Date(log.log_date).toLocaleDateString('vi-VN') : '—';
    const treeCodeStr = log.tree_code || log.plant_id || 'Toàn vườn';
    const plantTypeStr = log.plant_type ? `${log.plant_type}${log.plant_variety ? ' (' + log.plant_variety + ')' : ''}` : '—';
    const d = log.details || {};
    const operatorName = log.operator_name || log.creator_name || d.operator_name || 'Kỹ thuật viên trang trại';
    const equipBatch = [log.equipment_used ? `TB: ${log.equipment_used}` : '', log.batch_code ? `Lô: ${log.batch_code}` : ''].filter(Boolean).join(' · ');

    tableRowsHtml += `
      <tr>
        <td style="text-align:center;">${index + 1}</td>
        <td style="text-align:center; font-weight:600;">${dateStr}</td>
        <td style="font-weight:700;">#${esc(treeCodeStr)} <small style="font-weight:400; color:#475569; display:block;">${esc(plantTypeStr)}</small></td>
        <td style="font-weight:700; color:#065f46;">${esc(log.log_type || 'Chăm sóc')}</td>
        <td>
          <div style="font-weight:500;">${esc(detailsStr || 'Thực hiện theo quy trình chuẩn')}</div>
          ${equipBatch ? `<div style="font-size:11px; color:#0369a1; margin-top:2px;">${esc(equipBatch)}</div>` : ''}
          ${log.note ? `<div style="font-size:11.5px; color:#64748b; margin-top:2px;"><em>Ghi chú:</em> ${esc(log.note)}</div>` : ''}
        </td>
        <td style="text-align:center;">${esc(operatorName)}</td>
        <td style="text-align:center; color:#15803d; font-weight:700;">Đạt Chuẩn</td>
      </tr>
    `;
  });

  const safeMetaJson = JSON.stringify({
    savedReportId: meta.savedReportId || null,
    farm_id: meta.farmId || 'all',
    plant_id: meta.plantId || 'all',
    standard_code: meta.standardCode || 'vietgap_globalgap_iso',
    standard_label: stdLabel,
    categories: Array.isArray(meta.categories) ? meta.categories : [],
    from_date: meta.fromDate || null,
    to_date: meta.toDate || null,
    total_logs: logs.length,
    farmName: meta.farmName || 'Nông Trại'
  }).replace(/</g, '\\u003c');

  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>${esc(reportTitle)} — ${esc(meta.farmName || 'Nông Trại')}</title>
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
          align-items: center;
          border-bottom: 2px solid #047857;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .org-info { display: flex; align-items: center; gap: 12px; text-align: left; }
        .org-logo { height: 48px; width: auto; max-width: 190px; object-fit: contain; display: block; }
        .report-title-box { text-align: center; margin-bottom: 16px; }
        .report-title-row { display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; }
        .report-title { font-size: 18px; font-weight: 800; color: #064e3b; text-transform: uppercase; margin: 0; }
        .edit-title-btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 7px; border: 1px solid #cbd5e1;
          background: #f8fafc; color: #047857; cursor: pointer; font-size: 13px;
        }
        .edit-title-btn:hover { background: #ecfdf5; border-color: #10b981; }
        .title-edit-wrap {
          display: none; justify-content: center; align-items: center; gap: 8px; margin: 6px auto 4px; max-width: 680px;
        }
        .title-edit-input {
          flex: 1; padding: 7px 12px; border: 1.5px solid #059669; border-radius: 8px;
          font-size: 14px; font-weight: 700; color: #064e3b; outline: none;
        }
        .title-save-btn {
          background: #059669; color: #ffffff; border: none; padding: 7px 14px;
          border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer;
        }
        .report-sub { font-size: 12.5px; color: #334155; font-weight: 600; margin-top: 4px; }
        .meta-strip {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
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
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
          border-radius: 8px;
        }
        .bar-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .bar-btn {
          border: none; padding: 6px 14px; border-radius: 6px; font-weight: 700;
          cursor: pointer; font-size: 12.5px; display: inline-flex; align-items: center; gap: 6px;
        }
        .bar-btn-lib { background: #0284c7; color: #ffffff; }
        .bar-btn-save-pdf { background: #10b981; color: #ffffff; }
        .bar-btn-print { background: #334155; color: #ffffff; }
        .save-status-pill { font-size: 11.5px; color: #6ee7b7; font-weight: 700; }
        @media print {
          .no-print-bar, .edit-title-btn, .title-edit-wrap { display: none !important; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="no-print-bar">
        <div>
          <strong>Bản in Sổ Nhật Ký Canh Tác ${esc(stdLabel)}</strong> · Số lượng: ${logs.length} dòng ghi chép
          <span id="printable-save-status" class="save-status-pill">${meta.savedReportId ? ' · Đã lưu vào Thư viện' : ''}</span>
        </div>
        <div class="bar-actions">
          <button type="button" id="btn-save-report-library" class="bar-btn bar-btn-lib" onclick="saveCurrentReportToLibrary(false)">Lưu vào Thư viện</button>
          <button type="button" id="btn-save-and-export-pdf" class="bar-btn bar-btn-save-pdf" onclick="saveCurrentReportToLibrary(true)">Lưu &amp; Xuất PDF</button>
          <button type="button" id="btn-print-only" class="bar-btn bar-btn-print" onclick="window.print()">In / Xuất PDF</button>
        </div>
      </div>

      <div class="header-grid">
        <div class="org-info">
          <img src="${logoUrl}" alt="TanBao AgTech Logo" class="org-logo" onerror="this.style.display='none'">
        </div>
        <div style="text-align: right; font-size: 11px; color: #64748b;">
          <div>Tiêu chuẩn áp dụng: <strong>${esc(stdLabel)}</strong></div>
          <div>Thời gian trích xuất: ${printTimeStr}</div>
        </div>
      </div>

      <div class="report-title-box">
        <div class="report-title-row">
          <h1 class="report-title" id="printable-report-title">${esc(reportTitle)}</h1>
          <button type="button" id="btn-edit-printable-title" class="edit-title-btn" onclick="togglePrintableTitleEdit(true)" title="Đổi tên báo cáo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
          </button>
        </div>
        <div id="printable-title-edit-wrap" class="title-edit-wrap">
          <input type="text" id="printable-title-input" class="title-edit-input" value="${esc(reportTitle)}">
          <button type="button" class="title-save-btn" onclick="savePrintableTitleEdit()">Lưu tên</button>
          <button type="button" class="title-save-btn" style="background:#64748b;" onclick="togglePrintableTitleEdit(false)">Hủy</button>
        </div>
        <div class="report-sub">Trang trại: <strong>${esc(meta.farmName || 'Nông Trại')}</strong>${meta.categoriesLabel ? ` · Hạng mục: <strong>${esc(meta.categoriesLabel)}</strong>` : ''}</div>
      </div>

      <div class="meta-strip">
        <div>Khoảng thời gian: <strong>${fromStr}</strong> đến <strong>${toStr}</strong></div>
        <div>Tổng số hoạt động: <strong>${logs.length}</strong> nhật ký</div>
        <div>Tình trạng dữ liệu: <strong>Hợp Lệ &amp; Đã Xác Thực SHA-256</strong></div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 4%">STT</th>
            <th style="width: 10%">Ngày</th>
            <th style="width: 13%">Mã Cây / Giống</th>
            <th style="width: 13%">Hoạt Động</th>
            <th style="width: 42%">Nội Dung Kỹ Thuật (Vật tư, Thuốc BVTV/PHI, Kiểm toán quả, Ghi chú)</th>
            <th style="width: 10%">Người Thực Hiện</th>
            <th style="width: 8%">Đánh Giá</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      <div class="signature-grid">
        <div>
          <div class="sig-title">1. KỸ THUẬT VIÊN / NGƯỜI LẬP SỔ</div>
          <div class="sig-sub">(Ký và ghi rõ họ tên)</div>
          <div class="sig-space"></div>
          <div class="sig-name">${esc(logs[0]?.operator_name || logs[0]?.creator_name || 'Kỹ thuật viên trang trại')}</div>
        </div>
        <div>
          <div class="sig-title">2. KIỂM SOÁT NỘI BỘ (ICS / GLOBALG.A.P.)</div>
          <div class="sig-sub">(Thẩm định quy trình &amp; PHI)</div>
          <div class="sig-space"></div>
          <div class="sig-name">................................................</div>
        </div>
        <div>
          <div class="sig-title">3. CHỦ TRANG TRẠI / GIÁM SÁT VIETGAP</div>
          <div class="sig-sub">(Ký, đóng dấu hoặc xác nhận)</div>
          <div class="sig-space"></div>
          <div class="sig-name">................................................</div>
        </div>
      </div>

      <script>
        window.__REPORT_META__ = ${safeMetaJson};
        function togglePrintableTitleEdit(open) {
          var wrap = document.getElementById('printable-title-edit-wrap');
          var inp = document.getElementById('printable-title-input');
          if (!wrap) return;
          wrap.style.display = open ? 'flex' : 'none';
          if (open && inp) { inp.focus(); inp.select(); }
        }
        async function savePrintableTitleEdit() {
          var inp = document.getElementById('printable-title-input');
          var h1 = document.getElementById('printable-report-title');
          if (!inp || !h1) return;
          var newTitle = inp.value.trim();
          if (!newTitle) return;
          h1.textContent = newTitle;
          document.title = newTitle + ' — ' + (window.__REPORT_META__.farmName || 'Nông Trại');
          togglePrintableTitleEdit(false);
          if (window.__REPORT_META__.savedReportId && window.opener && typeof window.opener.renameReportInAppLibrary === 'function') {
            await window.opener.renameReportInAppLibrary(window.__REPORT_META__.savedReportId, newTitle);
            var st = document.getElementById('printable-save-status');
            if (st) st.textContent = ' · Đã cập nhật tên trong Thư viện';
          }
        }
        async function saveCurrentReportToLibrary(andPrint) {
          var h1 = document.getElementById('printable-report-title');
          var title = h1 ? h1.textContent.trim() : 'Báo cáo canh tác';
          var m = window.__REPORT_META__ || {};
          var payload = {
            id: m.savedReportId || undefined,
            title: title,
            farm_id: m.farm_id,
            plant_id: m.plant_id,
            standard_code: m.standard_code,
            standard_label: m.standard_label,
            categories: m.categories,
            from_date: m.from_date,
            to_date: m.to_date,
            total_logs: m.total_logs,
            report_html: '<!DOCTYPE html>\\n' + document.documentElement.outerHTML,
            report_meta: m
          };
          var saved = null;
          if (window.opener && typeof window.opener.saveReportToAppLibrary === 'function') {
            saved = await window.opener.saveReportToAppLibrary(payload);
          }
          if (saved && saved.id) {
            window.__REPORT_META__.savedReportId = saved.id;
          }
          var st = document.getElementById('printable-save-status');
          if (st) st.textContent = ' · Đã lưu vào Thư viện';
          if (andPrint) {
            setTimeout(function () { window.print(); }, 150);
          }
        }
      </script>
    </body>
    </html>
  `;
}

export function openPrintableVietGapReport(logs, meta = {}) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Trình duyệt đang chặn cửa sổ pop-up. Vui lòng cho phép mở pop-up để xem bản in báo cáo.');
    return;
  }
  const htmlDoc = buildPrintableVietGapReportHtml(logs, meta);
  printWindow.document.open();
  printWindow.document.write(htmlDoc);
  printWindow.document.close();
  if (meta.autoPrint) {
    setTimeout(() => {
      try { printWindow.print(); } catch (_) {}
    }, 300);
  }
}
window.openPrintableVietGapReport = openPrintableVietGapReport;

const REPORT_LIBRARY_LOCAL_KEY = 'plantbook_saved_reports_v1';
let _reportLibraryCache = [];

function getLocalReportLibrary() {
  try {
    const raw = localStorage.getItem(REPORT_LIBRARY_LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function setLocalReportLibrary(items) {
  try {
    localStorage.setItem(REPORT_LIBRARY_LOCAL_KEY, JSON.stringify((items || []).slice(0, 50)));
  } catch (_) {}
}

export async function refreshReportLibraryBadge() {
  const badge = document.getElementById('report-library-count-badge');
  try {
    const list = await api('/plants/reports');
    if (Array.isArray(list)) {
      _reportLibraryCache = list;
      if (badge) {
        badge.textContent = String(list.length);
        badge.style.display = list.length > 0 ? 'inline-block' : 'none';
      }
      return list;
    }
  } catch (_) {}
  const localList = getLocalReportLibrary();
  _reportLibraryCache = localList;
  if (badge) {
    badge.textContent = String(localList.length);
    badge.style.display = localList.length > 0 ? 'inline-block' : 'none';
  }
  return localList;
}
window.refreshReportLibraryBadge = refreshReportLibraryBadge;

export async function saveReportToAppLibrary(payload) {
  try {
    let saved = null;
    if (payload.id && !String(payload.id).startsWith('local_')) {
      saved = await api(`/plants/reports/${payload.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: payload.title })
      });
    } else {
      saved = await api('/plants/reports', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
    if (saved && saved.id) {
      toast('Đã lưu báo cáo vào Thư viện ứng dụng!', 'success');
      await refreshReportLibraryBadge();
      return saved;
    }
  } catch (_) {}
  const localList = getLocalReportLibrary();
  const id = payload.id || `local_${Date.now()}`;
  const item = {
    id,
    title: payload.title || 'Báo cáo canh tác',
    standard_label: payload.standard_label || '',
    total_logs: payload.total_logs || 0,
    from_date: payload.from_date || null,
    to_date: payload.to_date || null,
    report_html: payload.report_html || '',
    report_meta: payload.report_meta || {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const next = [item, ...localList.filter(r => String(r.id) !== String(id))];
  setLocalReportLibrary(next);
  _reportLibraryCache = next;
  toast('Đã lưu báo cáo vào Thư viện cục bộ!', 'success');
  await refreshReportLibraryBadge();
  return item;
}
window.saveReportToAppLibrary = saveReportToAppLibrary;

export async function renameReportInAppLibrary(id, newTitle) {
  const cleanTitle = String(newTitle || '').trim();
  if (!cleanTitle) return null;
  try {
    if (!String(id).startsWith('local_')) {
      const updated = await api(`/plants/reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: cleanTitle })
      });
      await refreshReportLibraryBadge();
      toast('Đã đổi tên báo cáo thành công!', 'success');
      return updated;
    }
  } catch (_) {}
  const localList = getLocalReportLibrary();
  const next = localList.map(r => String(r.id) === String(id) ? { ...r, title: cleanTitle, updated_at: new Date().toISOString() } : r);
  setLocalReportLibrary(next);
  _reportLibraryCache = next;
  toast('Đã đổi tên báo cáo thành công!', 'success');
  return next.find(r => String(r.id) === String(id)) || null;
}
window.renameReportInAppLibrary = renameReportInAppLibrary;

export function renderUserReportLibraryList() {
  const container = document.getElementById('user-report-library-list');
  if (!container) return;
  const q = (document.getElementById('report-library-search')?.value || '').trim().toLowerCase();
  const items = (_reportLibraryCache || []).filter(r => {
    if (!q) return true;
    return [r.title, r.farm_name, r.standard_label, r.report_meta?.farmName].some(v => String(v || '').toLowerCase().includes(q));
  });
  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:36px 20px; text-align:center; color:#64748b;">
      <i data-lucide="folder-open" class="lucide-sm" style="width:28px; height:28px; color:#94a3b8; margin-bottom:8px;"></i>
      <div style="font-weight:700; color:#334155; margin-bottom:4px;">Thư viện báo cáo đang trống</div>
      <div style="font-size:12.5px;">Nhấn <strong>"Lưu &amp; Xuất PDF"</strong> khi xuất báo cáo để lưu trữ vào thư viện ứng dụng.</div>
    </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }
  container.innerHTML = items.map(r => {
    const dt = r.updated_at || r.created_at;
    const dtStr = dt ? new Date(dt).toLocaleString('vi-VN') : '—';
    const farmLbl = r.farm_name || r.report_meta?.farmName || 'Nông trại';
    return `
      <div style="border:1px solid #e2e8f0; border-radius:12px; padding:12px 16px; background:#ffffff; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:220px;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <strong style="font-size:14px; color:#0f172a;">${esc(r.title)}</strong>
            <button type="button" onclick="promptRenameSavedReport('${esc(String(r.id))}')" title="Đổi tên báo cáo" style="background:#f8fafc; border:1px solid #cbd5e1; color:#047857; border-radius:6px; width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer;">
              <i data-lucide="pencil" class="lucide-xs"></i>
            </button>
          </div>
          <div style="font-size:12px; color:#64748b; margin-top:4px;">
            ${esc(farmLbl)} · <strong>${r.total_logs || 0}</strong> bản ghi · ${esc(r.standard_label || 'VietGAP / GlobalG.A.P.')}
          </div>
          <div style="font-size:11px; color:#94a3b8; margin-top:2px;">Lưu lúc: ${dtStr}</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button type="button" onclick="openSavedReportFromLibrary('${esc(String(r.id))}', false)" class="btn btn-secondary btn-sm" style="padding:6px 12px; font-size:12px; font-weight:700; border-radius:8px; display:inline-flex; align-items:center; gap:5px;">
            <i data-lucide="eye" class="lucide-xs"></i> Xem
          </button>
          <button type="button" onclick="openSavedReportFromLibrary('${esc(String(r.id))}', true)" class="btn btn-primary btn-sm" style="padding:6px 12px; font-size:12px; font-weight:700; border-radius:8px; background:#059669; border:none; color:#ffffff; display:inline-flex; align-items:center; gap:5px;">
            <i data-lucide="printer" class="lucide-xs"></i> Xuất PDF
          </button>
          <button type="button" onclick="deleteSavedReportFromLibrary('${esc(String(r.id))}')" title="Xóa báo cáo" style="background:#fff1f2; border:1px solid #fecaca; color:#dc2626; border-radius:8px; padding:6px 9px; cursor:pointer; display:inline-flex; align-items:center;">
            <i data-lucide="trash-2" class="lucide-xs"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
  if (window.lucide) lucide.createIcons();
}
window.renderUserReportLibraryList = renderUserReportLibraryList;

export async function openUserReportLibraryModal() {
  const modal = document.getElementById('user-report-library-modal');
  if (modal) {
    if (typeof document !== 'undefined' && document.body && typeof document.body.appendChild === 'function' && modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
    if (modal.style && typeof modal.style.setProperty === 'function') {
      modal.style.setProperty('z-index', '100060', 'important');
    } else if (modal.style) {
      modal.style.zIndex = '100060';
    }
    modal.style.display = 'flex';
  }
  await refreshReportLibraryBadge();
  renderUserReportLibraryList();
}
window.openUserReportLibraryModal = openUserReportLibraryModal;

export function closeUserReportLibraryModal() {
  const modal = document.getElementById('user-report-library-modal');
  if (modal) modal.style.display = 'none';
}
window.closeUserReportLibraryModal = closeUserReportLibraryModal;

export async function promptRenameSavedReport(id) {
  const item = (_reportLibraryCache || []).find(r => String(r.id) === String(id));
  const currentTitle = item ? item.title : '';
  const nextTitle = prompt('Nhập tên mới cho báo cáo:', currentTitle);
  if (!nextTitle || !nextTitle.trim()) return;
  await renameReportInAppLibrary(id, nextTitle.trim());
  await refreshReportLibraryBadge();
  renderUserReportLibraryList();
}
window.promptRenameSavedReport = promptRenameSavedReport;

export async function openSavedReportFromLibrary(id, autoPrint = false) {
  let detail = null;
  if (!String(id).startsWith('local_')) {
    try {
      detail = await api(`/plants/reports/${id}`);
    } catch (_) {}
  }
  if (!detail) {
    detail = (_reportLibraryCache || []).find(r => String(r.id) === String(id));
  }
  if (!detail || !detail.report_html) {
    toast('Không tìm thấy nội dung báo cáo đã lưu.', 'error');
    return;
  }
  const win = window.open('', '_blank');
  if (!win) {
    alert('Trình duyệt đang chặn cửa sổ pop-up. Vui lòng cho phép mở pop-up để xem báo cáo.');
    return;
  }
  win.document.open();
  win.document.write(detail.report_html);
  win.document.close();
  if (autoPrint) {
    setTimeout(() => {
      try { win.print(); } catch (_) {}
    }, 300);
  }
}
window.openSavedReportFromLibrary = openSavedReportFromLibrary;

export async function deleteSavedReportFromLibrary(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa báo cáo này khỏi Thư viện?')) return;
  try {
    if (!String(id).startsWith('local_')) {
      await api(`/plants/reports/${id}`, { method: 'DELETE' });
    }
  } catch (_) {}
  const localList = getLocalReportLibrary().filter(r => String(r.id) !== String(id));
  setLocalReportLibrary(localList);
  await refreshReportLibraryBadge();
  renderUserReportLibraryList();
  toast('Đã xóa báo cáo khỏi Thư viện.', 'success');
}
window.deleteSavedReportFromLibrary = deleteSavedReportFromLibrary;
