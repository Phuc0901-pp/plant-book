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
