/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   core/utils.js — Shared UI utilities
   ═══════════════════════════════════════════════════════════════ */

/**
 * Hiển thị thông báo toast tạm thời.
 * @param {string} msg   — nội dung thông báo
 * @param {'success'|'error'|'info'} type
 */
export function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/**
 * Escape ký tự HTML đặc biệt để tránh XSS.
 * @param {*} str
 * @returns {string}
 */
export function esc(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Trả về HTML badge màu theo trạng thái sức khoẻ cây.
 * @param {string} status
 * @returns {string} HTML string
 */
export function healthBadge(status) {
  if (status === 'Tốt')        return '<span class="badge badge-green">Tốt</span>';
  if (status === 'Bình thường') return '<span class="badge badge-gray">Bình thường</span>';
  if (status === 'Cần chú ý')  return '<span class="badge badge-amber">Cần chú ý</span>';
  if (status === 'Bệnh')       return '<span class="badge badge-red">Bệnh</span>';
  return `<span class="badge badge-gray">${esc(status)}</span>`;
}

/**
 * Format ngày theo định dạng Việt Nam (DD/MM/YYYY).
 * @param {string} dateStr — ISO date string
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
}

/**
 * Lấy chuỗi ngày hôm nay dạng YYYY-MM-DD (local time).
 * @returns {string}
 */
export function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Format diện tích thông minh (ha nếu >= 10.000 m2, m2 nếu < 10.000 m2)
 * @param {number|string} areaVal
 * @returns {string}
 */
export function formatSmartArea(areaVal) {
  if (!areaVal && areaVal !== 0) return '0 m²';
  const num = parseFloat(areaVal);
  if (isNaN(num) || num <= 0) return '0 m²';
  if (num >= 10000) {
    const ha = (num / 10000).toFixed(2).replace(/\.00$/, '');
    return `${ha} ha <span style="font-size:11px; font-weight:500; color:#64748b;">(${Math.round(num).toLocaleString('vi-VN')} m²)</span>`;
  }
  return `${Math.round(num).toLocaleString('vi-VN')} m²`;
}

/**
 * Robust Multi-dimensional GeoJSON Polygon coordinates parser and sanitizer
 * @param {*} rawCoords
 * @returns {Array<[number, number]>} Array of [lng, lat]
 */
export function sanitizeCoordinates(rawCoords) {
  let coords = [];
  try {
    coords = typeof rawCoords === 'string' ? JSON.parse(rawCoords) : (rawCoords || []);
  } catch(e) { return []; }

  while (Array.isArray(coords) && coords.length > 0 && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
    coords = coords[0];
  }

  if (!Array.isArray(coords)) return [];

  const validPts = [];
  coords.forEach(pt => {
    if (Array.isArray(pt) && pt.length >= 2) {
      let v1 = parseFloat(pt[0]);
      let v2 = parseFloat(pt[1]);
      if (!isNaN(v1) && !isNaN(v2)) {
        let lng = v1 > 50 ? v1 : v2;
        let lat = v2 < 50 ? v2 : v1;
        if (lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
          validPts.push([lng, lat]);
        }
      }
    }
  });
  return validPts;
}

if (typeof window !== 'undefined') {
  window.sanitizeCoordinates = sanitizeCoordinates;
  window.formatSmartArea = formatSmartArea;
}
