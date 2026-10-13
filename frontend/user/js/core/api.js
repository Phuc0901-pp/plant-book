/* Plant Book Agtech (c) 2026 TBSG Agtech. All Rights Reserved. Enterprise Protected Asset */
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
  localStorage.removeItem('user');
}

/**
 * Lưu thông tin người dùng hiện tại.
 * @param {object|null} u
 */
export function setCurrentUser(u) {
  currentUser = u;
  if (!u) {
    localStorage.removeItem('user');
  }
}

/**
 * Kiểm tra xem người dùng hiện tại có phải Hạng PRO hay không.
 * @returns {boolean}
 */
export function isProUser() {
  const user = currentUser || JSON.parse(localStorage.getItem('user') || localStorage.getItem('pb_user') || '{}');
  return user && user.account_tier === 'pro';
}
window.isProUser = isProUser;

/**
 * Standard Role-Based Access Control (RBAC) resolver
 */
export function getCurrentUserRbac() {
  let u = window._currentUserProfile || currentUser;
  if (!u || !u.id) {
    try {
      u = JSON.parse(localStorage.getItem('user') || localStorage.getItem('pb_user') || '{}');
    } catch (_) {
      u = {};
    }
  }
  const role = u.role || 'user';
  const subRole = u.sub_role || 'farm_owner';
  const isOwner = role === 'admin' || (!u.parent_user_id && subRole === 'farm_owner');
  const isSubAccount = Boolean(u.parent_user_id) || ['manager', 'care_worker', 'auditor_readonly'].includes(subRole);
  
  const isFinanceRestrictedRole = ['care_worker', 'auditor_readonly'].includes(subRole);
  const isFinanceRedacted = role !== 'admin' && (
    u.allow_view_finance === false ||
    (isFinanceRestrictedRole && u.allow_view_finance !== true)
  );

  const isReadonlyAuditor = subRole === 'auditor_readonly';
  const isCareWorker = subRole === 'care_worker';
  const isManager = subRole === 'manager';
  const viewPlantsScope = u.view_plants_scope || (isCareWorker ? 'assigned' : 'all');
  const allowViewSupplies = u.allow_view_supplies !== false;
  const allowSharedHistory = u.allow_shared_history !== false;
  const assignedPlantIds = Array.isArray(u.assigned_plant_ids) ? u.assigned_plant_ids : [];

  return {
    user: u,
    role,
    subRole,
    isOwner,
    isSubAccount,
    isFinanceRedacted,
    isReadonlyAuditor,
    isCareWorker,
    isManager,
    viewPlantsScope,
    allowViewSupplies,
    allowSharedHistory,
    assignedPlantIds
  };
}
window.getCurrentUserRbac = getCurrentUserRbac;

/**
 * Gọi REST API với Bearer token tự động và cơ chế tự động thử lại nếu gặp 429.
 * Ném lỗi nếu response không OK.
 * @param {string} path  — đường dẫn API, ví dụ '/plants'
 * @param {RequestInit} opts — tuỳ chọn fetch
 * @param {number} retries — số lần thử lại
 * @returns {Promise<any>}
 */
export async function api(path, opts = {}, retries = 2) {
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

  // Handle Rate Limiter 429 with automatic jitter backoff
  if (res.status === 429 && retries > 0) {
    const delay = (3 - retries) * 350 + Math.random() * 200;
    await new Promise(r => setTimeout(r, delay));
    return api(path, opts, retries - 1);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(res.ok ? 'Phản hồi không phải dạng JSON' : `Lỗi máy chủ (${res.status})`);
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
