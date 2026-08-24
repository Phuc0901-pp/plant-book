/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   core/router.js — RESTful Hash Router with Obfuscated Security Hashing
   URL Format: #/u/:userHash/:page (e.g., #/u/usr-5a96/farms/farm-5a9f)
   ═══════════════════════════════════════════════════════════════ */

const SALT = 0x5a9e;

/** Encode numeric ID to obfuscated hash token (International Security Standard) */
export function encodeId(prefix, numId) {
  if (!numId && numId !== 0) return '';
  const n = parseInt(numId) || 0;
  const val = (n ^ SALT) + 0x1000;
  const hex = val.toString(16);
  return `${prefix}-${hex}`;
}

/** Decode obfuscated hash token back to numeric ID */
export function decodeId(hashStr) {
  if (!hashStr || typeof hashStr !== 'string') return null;
  const parts = hashStr.split('-');
  const hex = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  const val = parseInt(hex, 16);
  if (isNaN(val)) return null;
  return (val - 0x1000) ^ SALT;
}

window.encodeId = encodeId;
window.decodeId = decodeId;

/** Get current logged-in user hash token */
/** Get current logged-in user hash token */
export function getUserHash() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.public_id) return user.public_id;
    if (user.id) return `usr-${user.id}`;
    return 'usr-1';
  } catch (_) {
    return 'usr-1';
  }
}
window.getUserHash = getUserHash;

/** Page titles mapping */
export const PAGE_TITLES = {
  home:     'Trang chủ',
  myplants: 'Trang trại',
  farms:    'Trang trại',
  supplies: 'Quản lý & Giám sát Vật tư',
  logs:     'Lịch sử Hoạt động Canh tác',
  wiki:     'Bách khoa & Hướng dẫn',
  settings: 'Cài đặt tài khoản',
};

/** Alias map for standard RESTful URL names */
const PAGE_ALIASES = {
  dashboard: 'home',
  home: 'home',
  farms: 'myplants',
  myplants: 'myplants',
  supplies: 'supplies',
  logs: 'logs',
  history: 'logs',
  wiki: 'wiki',
  settings: 'settings'
};

/**
 * Show page section & synchronize URL path & hash
 * @param {string} page 
 * @param {boolean} updateHash 
 */
export function showPage(page, updateHash = true) {
  const targetPage = PAGE_ALIASES[page] || page;
  
  // Tắt tất cả sections
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  // Tắt nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));

  // Bật section mục tiêu
  const section = document.getElementById(`page-${targetPage}`);
  if (section) section.classList.add('active');

  // Đánh dấu nav active
  const navKey = targetPage === 'myplants' ? 'myplants' : targetPage;
  const navEl = document.querySelector(`[data-page="${navKey}"]`);
  if (navEl) navEl.classList.add('active');

  const bottomNavEl = document.querySelector(`.bottom-nav-item[data-page="${navKey}"]`);
  if (bottomNavEl) bottomNavEl.classList.add('active');

  // Cập nhật tiêu đề trang
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[targetPage] || targetPage;

  closeMobileSidebar();

  // Synchronize RESTful path & hash in browser address bar (e.g. /usr-15/farms)
  if (updateHash) {
    const userHash = getUserHash();
    const restPageName = targetPage === 'myplants' ? 'farms' : targetPage;
    const targetUrl = `/${userHash}/${restPageName}`;
    if (window.history && window.history.pushState && window.location.pathname !== targetUrl) {
      window.history.pushState({ page: targetPage }, '', targetUrl);
    }
    window.location.hash = `#/u/${userHash}/${restPageName}`;
  }

  // Lazy load dữ liệu khi chuyển tab
  if (targetPage === 'home') {
    if (typeof window.loadUserDashboard === 'function') window.loadUserDashboard();
  }

  if (targetPage === 'myplants') {
    import('../modules/map.js').then(mapModule => {
      if (mapModule.userMap) {
        setTimeout(() => {
          try { mapModule.userMap.resize(); } catch (_) {}
        }, 150);
      }
    });
  }

  if (targetPage === 'supplies') {
    if (typeof window.loadSupplies === 'function') window.loadSupplies();
  }

  if (targetPage === 'settings') {
    if (typeof window.loadUserSettings === 'function') window.loadUserSettings();
  }
}
window.showPage = showPage;

/**
 * Handle URL path & hash changes for initial page load routing
 * Example URLs: /usr-15/farms or #/u/usr-15/farms
 */
export function handleRouteFromHash() {
  const userToken = localStorage.getItem('pb_token');
  if (!userToken) return; // Do not execute routing if user is logged out!

  const pathname = window.location.pathname || '';
  const hash = window.location.hash || '';

  let restPage = 'home';
  let farmHash = null;

  if (pathname.includes('usr-') || pathname.includes('/user/')) {
    const cleanPath = pathname.replace(/^\/+|\/+$/g, '');
    const parts = cleanPath.split('/');
    if (parts[0] === 'user') parts.shift();
    if (parts[0] && parts[0].startsWith('usr-')) parts.shift();
    if (parts[0]) restPage = parts[0];
    if (parts[1]) farmHash = parts[1];
  } else if (hash.startsWith('#/')) {
    const parts = hash.replace('#/', '').split('/');
    if (parts[0] === 'u' && parts.length >= 3) {
      restPage = parts[2];
      if (parts.length >= 4) farmHash = parts[3];
    } else if (parts.length >= 1) {
      restPage = parts[0];
      if (parts.length >= 2) farmHash = parts[1];
    }
  }

  const targetPage = PAGE_ALIASES[restPage] || 'home';
  showPage(targetPage, false);

  // If a specific farm hash is provided in URL
  if (targetPage === 'myplants' && farmHash) {
    const farmId = decodeId(farmHash);
    if (farmId && typeof window.openFarmDetailView === 'function') {
      setTimeout(() => {
        window.openFarmDetailView(farmId, false);
      }, 350);
    }
  }
}

// Attach Hash & Popstate change listeners for browser Back/Forward & Direct URL entry
window.addEventListener('hashchange', handleRouteFromHash);
window.addEventListener('popstate', handleRouteFromHash);
window.addEventListener('DOMContentLoaded', () => {
  handleRouteFromHash();
});

export function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (!sidebar) return;
  sidebar.classList.toggle('open');
  if (overlay) overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
}
window.toggleMobileSidebar = toggleMobileSidebar;

export function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    if (overlay) overlay.style.display = 'none';
  }
}
window.closeMobileSidebar = closeMobileSidebar;
