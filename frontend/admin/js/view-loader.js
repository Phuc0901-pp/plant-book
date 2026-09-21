/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Plant Book â€“ Admin Portal
   core/view-loader.js â€” Async Micro-Module & Dynamic View Loader
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const ADMIN_VIEW_MAP = {
  dashboard:    '/admin/views/dashboard.html',
  users:        '/admin/views/users.html',
  'ai-training':'/admin/views/ai-training.html',
  database:     '/admin/views/database/cultivation.html',
  'db-check':   '/admin/views/database/check.html',
  devices:      '/admin/views/database/devices.html',
  history:      '/admin/views/database/history.html',
  media:        '/admin/views/database/media.html',
  nfc:          '/admin/views/database/nfc-inventory.html',
  schemas:      '/admin/views/database/schemas.html',
  supplies:     '/admin/views/database/supplies.html',
  version:      '/admin/views/database/version.html'
};

const adminViewCache = new Map();
const adminLoadedModals = new Set();
const adminLoadingPromises = new Map();

/**
 * Ensures admin view section HTML is loaded into the DOM.
 */
async function ensureAdminViewLoaded(viewKey) {
  const targetKey = String(viewKey || 'dashboard').toLowerCase();
  const sectionId = `page-${targetKey}`;
  
  let existing = document.getElementById(sectionId);
  if (existing) return existing;

  const url = ADMIN_VIEW_MAP[targetKey];
  if (!url) {
    console.warn(`[admin-view-loader] No URL mapped for view '${targetKey}'`);
    return null;
  }

  if (adminLoadingPromises.has(targetKey)) {
    return adminLoadingPromises.get(targetKey);
  }

  const promise = (async () => {
    try {
      let html = adminViewCache.get(url);
      if (!html) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
        html = await res.text();
        adminViewCache.set(url, html);
      }

      const contentContainer = document.querySelector('.content') || document.querySelector('main.main');
      if (contentContainer) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        while (temp.firstChild) {
          contentContainer.appendChild(temp.firstChild);
        }
        
        const loadedEl = document.getElementById(sectionId);
        if (window.lucide && typeof window.lucide.createIcons === 'function' && loadedEl) {
          window.lucide.createIcons({ root: loadedEl });
        }
        
        window.dispatchEvent(new CustomEvent('pb:admin-view-loaded', { detail: { view: targetKey, element: loadedEl } }));
        return loadedEl;
      }
    } catch (err) {
      console.error(`[admin-view-loader] Failed to load view '${targetKey}':`, err);
    } finally {
      adminLoadingPromises.delete(targetKey);
    }
    return null;
  })();

  adminLoadingPromises.set(targetKey, promise);
  return promise;
}

/**
 * Preload all admin views in background
 */
function preloadAdminViews(viewKeys = ['dashboard', 'users', 'ai-training', 'database', 'devices', 'nfc']) {
  const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 500));
  idleCallback(() => {
    viewKeys.forEach(key => {
      ensureAdminViewLoaded(key);
    });
  });
}

window.ensureAdminViewLoaded = ensureAdminViewLoaded;
window.preloadAdminViews = preloadAdminViews;