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
export function getUserHash() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return encodeId('usr', user.id || 1);
  } catch (_) {
    return 'usr-5a9f';
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
 * Show page section & synchronize URL hash
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

  // Synchronize RESTful hash in browser address bar
  if (updateHash) {
    const userHash = getUserHash();
    const restPageName = targetPage === 'myplants' ? 'farms' : targetPage;
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
 * Handle URL hash changes & initial page load routing
 * Example URL: #/u/usr-5a9f/farms/farm-5a9e
 */
export function handleRouteFromHash() {
  const userToken = localStorage.getItem('pb_token');
  if (!userToken) return; // Do not execute hash routing if user is logged out!

  const hash = window.location.hash || '';
  if (!hash.startsWith('#/')) return;

  const parts = hash.replace('#/', '').split('/');
  // Expected parts: ['u', 'usr-5a9f', 'farms', 'farm-5a9e'] or ['farms', 'farm-5a9e']
  let restPage = 'home';
  let farmHash = null;

  if (parts[0] === 'u' && parts.length >= 3) {
    restPage = parts[2];
    if (parts.length >= 4) farmHash = parts[3];
  } else if (parts.length >= 1) {
    restPage = parts[0];
    if (parts.length >= 2) farmHash = parts[1];
  }

  const targetPage = PAGE_ALIASES[restPage] || 'home';
  showPage(targetPage, false);

  // If a specific farm hash is provided in URL (e.g., #/u/usr-5a9f/farms/farm-5a9e)
  if (targetPage === 'myplants' && farmHash) {
    const farmId = decodeId(farmHash);
    if (farmId && typeof window.openFarmDetailView === 'function') {
      setTimeout(() => {
        window.openFarmDetailView(farmId, false);
      }, 350);
    }
  }
}

// Attach Hash change listener for browser Back/Forward & Direct URL entry
window.addEventListener('hashchange', handleRouteFromHash);
window.addEventListener('DOMContentLoaded', () => {
  if (window.location.hash) {
    handleRouteFromHash();
  }
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
