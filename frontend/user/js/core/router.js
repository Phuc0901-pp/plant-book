const SALT = 0x5a9e;

export function encodeId(prefix, numId) {
  if (!numId && numId !== 0) return '';
  const n = parseInt(numId) || 0;
  const val = (n ^ SALT) + 0x1000;
  const hex = val.toString(16);
  return `${prefix}-${hex}`;
}

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

function generateIsoPublicId(role, numId) {
  const prefix = role === 'admin' ? 'adm' : 'usr';
  const id = parseInt(numId) || 0;
  const val = Math.abs(((id * 1664525 + 1013904223) ^ 0x5B9A4C21) % 90000000) + 10000000;
  return `${prefix}-${val}`;
}

export function getUserHash() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.public_id) return user.public_id;
    if (user.id) return generateIsoPublicId(user.role || 'user', user.id);
    return 'usr-84729104';
  } catch (_) {
    return 'usr-84729104';
  }
}
window.getUserHash = getUserHash;

export const PAGE_TITLES = {
  home:     'Trang chủ',
  myplants: 'Trang trại GIS',
  farms:    'Trang trại GIS',
  supplies: 'Vật tư & Tồn kho',
  logs:     'Lịch sử Canh tác',
  wiki:     'HDSD & Bách khoa',
  settings: 'Cài đặt',
};

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

export function syncUserUrl(params = {}) {
  if (!window.history || !window.history.pushState) return;

  const userHash = getUserHash();
  const matchedPage = params.page || 'home';
  const restPageName = matchedPage === 'myplants' ? 'farms' : matchedPage;

  const currentSearch = new URLSearchParams(window.location.search);

  if ('tab' in params) {
    if (params.tab) currentSearch.set('tab', params.tab);
    else currentSearch.delete('tab');
  }
  if ('farm' in params) {
    if (params.farm) currentSearch.set('farm', params.farm);
    else currentSearch.delete('farm');
  }
  if ('modal' in params) {
    if (params.modal) currentSearch.set('modal', params.modal);
    else currentSearch.delete('modal');
  }
  if ('id' in params) {
    if (params.id) currentSearch.set('id', params.id);
    else currentSearch.delete('id');
  }

  const queryString = currentSearch.toString();
  const basePath = `/${userHash}/${restPageName}`;
  const finalUrl = queryString ? `${basePath}?${queryString}` : basePath;

  if (window.location.pathname + window.location.search !== finalUrl) {
    if (params.replace) {
      window.history.replaceState({ page: matchedPage }, '', finalUrl);
    } else {
      window.history.pushState({ page: matchedPage }, '', finalUrl);
    }
  }
}
window.syncUserUrl = syncUserUrl;

export function showPage(page, updateHash = true) {
  const targetPage = PAGE_ALIASES[page] || page;

  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));

  const section = document.getElementById(`page-${targetPage}`);
  if (section) section.classList.add('active');

  if (typeof window.refreshIcons === 'function') {
    window.refreshIcons();
    setTimeout(window.refreshIcons, 40);
    setTimeout(window.refreshIcons, 250);
  }

  const navKey = targetPage === 'myplants' ? 'myplants' : targetPage;
  const navEl = document.querySelector(`[data-page="${navKey}"]`);
  if (navEl) navEl.classList.add('active');

  const bottomNavEl = document.querySelector(`.bottom-nav-item[data-page="${navKey}"]`);
  if (bottomNavEl) bottomNavEl.classList.add('active');

  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[targetPage] || targetPage;

  closeMobileSidebar();

  if (updateHash) {
    syncUserUrl({ page: targetPage, tab: null, farm: null, modal: null, id: null });
  }

  if (targetPage === 'home') {
    if (typeof window.loadUserDashboard === 'function') window.loadUserDashboard();
  }

  if (targetPage === 'myplants' || targetPage === 'farms') {
    import('../modules/map.js').then(mapModule => {
      if (mapModule.userMap) {
        setTimeout(() => {
          try {
            mapModule.userMap.resize();
            if (typeof mapModule.updateUserMapMarkers === 'function') {
              mapModule.updateUserMapMarkers(window._allPlantsCache, false);
            }
          } catch (_) {}
        }, 150);
      }
    });
  }

  if (targetPage === 'supplies') {
    if (typeof window.loadSupplies === 'function') window.loadSupplies();
    if (typeof window.loadSuppliesAnalytics === 'function') window.loadSuppliesAnalytics();
  }

  if (targetPage === 'logs') {
    if (typeof window.applyLogsRoleArchitecture === 'function') window.applyLogsRoleArchitecture();
    if (typeof window.filterUserLogs === 'function') window.filterUserLogs();
  }

  if (targetPage === 'wiki') {
    if (typeof window.switchWikiSubtab === 'function') window.switchWikiSubtab('roles');
    if (typeof window.initGuideRoleView === 'function') window.initGuideRoleView();
  }

  if (targetPage === 'settings') {
    if (typeof window.loadUserSettings === 'function') window.loadUserSettings();
  }

  setTimeout(() => {
    if (typeof window.triggerPageCountUpAnimations === 'function') {
      window.triggerPageCountUpAnimations(targetPage);
    }
  }, 300);
}
window.showPage = showPage;

export function handleRouteFromHash() {
  const userToken = localStorage.getItem('pb_token');
  if (!userToken) return;

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

  if (targetPage === 'myplants' && farmHash) {
    const farmId = decodeId(farmHash);
    if (farmId && typeof window.openFarmDetailView === 'function') {
      setTimeout(() => {
        window.openFarmDetailView(farmId, false);
      }, 350);
    }
  }
}

window.handleRouteFromHash = handleRouteFromHash;
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
