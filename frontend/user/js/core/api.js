/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   core/api.js — Token management & API fetch helper
   ═══════════════════════════════════════════════════════════════ */

export const API = '/api';

export let token = localStorage.getItem('pb_token') || '';
export let currentUser = null;

/**
 * Lưu token mới vào localStorage và biến module.
 * @param {string} t
 */
export function setToken(t) {
  token = t;
  localStorage.setItem('pb_token', t);
}

/**
 * Xóa token khỏi bộ nhớ và localStorage.
 */
export function clearToken() {
  token = '';
  localStorage.removeItem('pb_token');
}

/**
 * Lưu thông tin người dùng hiện tại.
 * @param {object|null} u
 */
export function setCurrentUser(u) {
  currentUser = u;
}

/**
 * Gọi REST API với Bearer token tự động.
 * Ném lỗi nếu response không OK.
 * @param {string} path  — đường dẫn API, ví dụ '/plants'
 * @param {RequestInit} opts — tuỳ chọn fetch
 * @returns {Promise<any>}
 */
export async function api(path, opts = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(opts.headers || {})
  };

  const isFormData = opts.isFormData || (opts.body && typeof FormData !== 'undefined' && opts.body instanceof FormData);
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(API + path, {
    ...opts,
    headers
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(res.ok ? 'Phản hồi không phải dạng JSON' : `Lỗi máy chủ (${res.status})`);
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
