/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/logs.js — Care log rendering & search/type filter
   ═══════════════════════════════════════════════════════════════ */

import { esc, formatDate } from '../core/utils.js';
import { buildMediaThumbnailsHtml } from './media.js';

// ── State ─────────────────────────────────────────────────────
let _logsCache = [];

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

// ── Render ────────────────────────────────────────────────────

/**
 * Render tóm tắt tối đa 3 dòng nhật ký gần đây ở Trang chủ.
 * Bao gồm thumbnail ảnh/video cho nhật ký Bệnh cây.
 * @param {Array} logs — nhật ký 3 ngày gần nhất
 */
export function renderUserLogsTable(logs) {
  const tbody   = document.getElementById('user-logs-table');
  const moreWrap = document.getElementById('user-logs-more-btn-wrap');
  if (!tbody) return;

  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fa-solid fa-clipboard-list"></i><p>Không có hoạt động canh tác nào trong 3 ngày qua</p></td></tr>';
    if (moreWrap) moreWrap.style.display = 'none';
    return;
  }

  if (moreWrap) moreWrap.style.display = logs.length > 3 ? 'block' : 'none';

  tbody.innerHTML = logs.slice(0, 3).map(l => _logRow(l)).join('');
}

/**
 * Render toàn bộ nhật ký 30 ngày ở tab Lịch sử.
 * @param {Array} logs
 */
export function renderUserLogsTableFull(logs) {
  const tbody = document.getElementById('user-logs-table-full');
  if (!tbody) return;
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fa-solid fa-clipboard-list"></i><p>Không tìm thấy hoạt động nào được ghi nhận</p></td></tr>';
    return;
  }
  tbody.innerHTML = logs.map(l => _logRow(l)).join('');
}

/**
 * Tạo HTML một hàng nhật ký.
 * @private
 */
function _logRow(l) {
  // Tạo chuỗi chi tiết
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
      detailsStr = `<span style="color:var(--green)">[${parts.join(', ')}]</span>` + (l.note ? ` - ${esc(l.note)}` : '');
    }
  }

  // Thumbnail media cho Bệnh cây
  const mediaHtml = l.log_type === 'Bệnh cây'
    ? buildMediaThumbnailsHtml(l.media_urls, 40)
    : '';

  const badgeMap = {
    'Tưới nước': 'badge-blue',
    'Bón phân':  'badge-brown',
    'Phun thuốc': 'badge-purple',
    'Cắt lá':    'badge-green',
    'Tỉa hoa':   'badge-amber',
    'Bệnh cây':  'badge-red'
  };
  const badgeClass = badgeMap[l.log_type] || 'badge-gray';

  return `
    <tr>
      <td data-label="Thời gian"><div>${formatDate(l.log_date)}</div></td>
      <td data-label="Cây trồng"><div><strong>Cây #${l.plant_id}</strong> <small style="color:var(--gray-400)">(${esc(l.plant_type)})</small></div></td>
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

// ── Search / Filter ───────────────────────────────────────────

/**
 * Lọc nhật ký theo từ khoá và loại hoạt động.
 * Input: #user-log-search, #user-log-filter-type
 */
export function filterUserLogs() {
  const query      = (document.getElementById('user-log-search')?.value || '').trim().toLowerCase();
  const filterType = document.getElementById('user-log-filter-type')?.value || 'all';

  let filtered = _logsCache;

  if (filterType !== 'all') {
    filtered = filtered.filter(l => l.log_type === filterType);
  }

  if (query) {
    filtered = filtered.filter(l => {
      const detailsStr = l.details ? JSON.stringify(l.details).toLowerCase() : '';
      return [String(l.plant_id), l.note, l.log_type, l.creator_name, detailsStr]
        .some(v => (v || '').toLowerCase().includes(query));
    });
  }

  renderUserLogsTableFull(filtered);
}
