export const API = '/api';

export let token = localStorage.getItem('pb_token') || '';
export let currentUser = null;

export function setToken(t) {
  token = t;
  localStorage.setItem('pb_token', t);
}

export function clearToken() {
  token = '';
  localStorage.removeItem('pb_token');
  localStorage.removeItem('user');
}

export function setCurrentUser(u) {
  currentUser = u;
  if (!u) {
    localStorage.removeItem('user');
  }
}

export function isProUser() {
  const user = currentUser || JSON.parse(localStorage.getItem('user') || localStorage.getItem('pb_user') || '{}');
  return user && user.account_tier === 'pro';
}
window.isProUser = isProUser;

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

let _refreshInFlight = null;

async function tryRefreshJwtToken() {
  if (!token) return false;
  if (_refreshInFlight) return _refreshInFlight;
  _refreshInFlight = (async () => {
    try {
      const r = await fetch(`${API}/auth/refresh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!r.ok) {
        clearToken();
        return false;
      }
      const d = await r.json().catch(() => ({}));
      if (d && d.token) {
        setToken(d.token);
        return true;
      }
      clearToken();
      return false;
    } catch (_) {
      return false;
    } finally {
      _refreshInFlight = null;
    }
  })();
  return _refreshInFlight;
}

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

  if (res.status === 401 && !opts._retriedAfterRefresh && !path.includes('/auth/login') && !path.includes('/auth/refresh') && token) {
    const refreshed = await tryRefreshJwtToken();
    if (refreshed) {
      return api(path, { ...opts, _retriedAfterRefresh: true }, retries);
    }
  }

  if (res.status === 429 && retries > 0) {
    const delay = (3 - retries) * 350 + Math.random() * 200;
    await new Promise(r => setTimeout(r, delay));
    return api(path, opts, retries - 1);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    await res.text();
    const nonJsonErr = new Error(res.ok ? 'Phản hồi không phải dạng JSON' : `Lỗi máy chủ (${res.status})`);
    nonJsonErr.status = res.status;
    throw nonJsonErr;
  }

  const data = await res.json();
  if (!res.ok) {
    const apiErr = new Error(data.error || `HTTP ${res.status}`);
    apiErr.status = res.status;
    apiErr.code = data.code || null;
    apiErr.data = data;
    throw apiErr;
  }
  return data;
}
