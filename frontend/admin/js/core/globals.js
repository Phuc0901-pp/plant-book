/* ═══════════════════════════════════════════════════════════════
   Plant Book – Admin Portal
   core/api.js — Token management & API fetch helper
   ═══════════════════════════════════════════════════════════════ */

const API = '/api';
let token = localStorage.getItem('pb_token') || '';
let currentUser = null;

// State variables (previously scattered across app.js)
let editingPlantId   = null;
let editingSchemaId  = null;
let schemaFields     = [];
let schemasCache     = [];

// Dashboard state
let dashboardMap             = null;
let dashboardMarkers         = [];
let allFarms                 = [];
let allPlants                = [];
let allRecentLogs            = [];
let currentDashboardFilter   = 'all';

/**
 * Gọi REST API với Bearer token tự động.
 * @param {string} path
 * @param {RequestInit} opts
 * @returns {Promise<any>}
 */
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/**
 * Hiển thị thông báo toast tạm thời.
 * @param {string} msg
 * @param {'success'|'error'|'info'} type
 */
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/**
 * Escape ký tự HTML đặc biệt.
 * @param {*} str
 * @returns {string}
 */
function esc(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Trả về HTML badge màu theo trạng thái sức khỏe cây.
 * @param {string} status
 * @returns {string}
 */
function healthBadge(status) {
  const map = {
    'Tốt':        '<span class="badge badge-green">Tốt</span>',
    'Bình thường': '<span class="badge badge-gray">Bình thường</span>',
    'Cần chú ý':  '<span class="badge badge-amber">Cần chú ý</span>',
    'Bệnh':       '<span class="badge badge-red">Bệnh</span>',
  };
  return map[status] || `<span class="badge badge-gray">${esc(status)}</span>`;
}
