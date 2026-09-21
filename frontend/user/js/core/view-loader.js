/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Plant Book â€“ User Portal
   core/view-loader.js â€” Async Micro-Module & Dynamic View Loader
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const VIEW_MAP = {
  home:     '/user/views/dashboard.html',
  dashboard:'/user/views/dashboard.html',
  myplants: '/user/views/plants.html',
  farms:    '/user/views/plants.html',
  supplies: '/user/views/supplies.html',
  logs:     '/user/views/logs.html',
  wiki:     '/user/views/guide.html',
  guide:    '/user/views/guide.html',
  settings: '/user/views/profile.html',
  profile:  '/user/views/profile.html',
  reminders:'/user/views/reminders.html'
};

const VIEW_SECTION_ID = {
  home:     'page-home',
  dashboard:'page-home',
  myplants: 'page-myplants',
  farms:    'page-myplants',
  supplies: 'page-supplies',
  logs:     'page-logs',
  wiki:     'page-wiki',
  guide:    'page-wiki',
  settings: 'page-settings',
  profile:  'page-settings',
  reminders:'page-reminders'
};

const MODAL_MAP = {
  'care-modal':             '/user/modals/care-modal.html',
  'nfc-modal':              '/user/modals/nfc-modal.html',
  'farmer-nfc-list-modal':  '/user/modals/nfc-inventory-modal.html',
  'field-tagging-modal':    '/user/modals/field-tagging-modal.html',
  'add-supply-modal':       '/user/modals/supply-modals.html',
  'supply-history-modal':   '/user/modals/supply-modals.html',
  'self-init-farm-modal':   '/user/modals/farm-modals.html',
  'edit-farm-modal':        '/user/modals/farm-modals.html',
  'pro-upgrade-modal':      '/user/modals/pro-modal.html',
  'feature-detail-modal':   '/user/modals/pro-modal.html',
  'notification-rule-modal':'/user/modals/notification-rule-modal.html',
  'reorder-gps-modal':      '/user/modals/reorder-gps-modal.html'
};

const viewCache = new Map();
const loadedModals = new Set();
const loadingPromises = new Map();

/**
 * Ensures a specific view section HTML is loaded into the DOM.
 * @param {string} viewKey 
 * @returns {Promise<HTMLElement>}
 */
export async function ensureViewLoaded(viewKey) {
  const targetKey = String(viewKey || 'home').toLowerCase();
  const sectionId = VIEW_SECTION_ID[targetKey] || `page-${targetKey}`;
  
  let existing = document.getElementById(sectionId);
  if (existing) return existing;

  const url = VIEW_MAP[targetKey];
  if (!url) {
    console.warn(`[view-loader] No URL mapped for view '${targetKey}'`);
    return null;
  }

  if (loadingPromises.has(targetKey)) {
    return loadingPromises.get(targetKey);
  }

  const promise = (async () => {
    try {
      let html = viewCache.get(url);
      if (!html) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
        html = await res.text();
        viewCache.set(url, html);
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
        
        // Dispatch view loaded event for module rehydration
        window.dispatchEvent(new CustomEvent('pb:view-loaded', { detail: { view: targetKey, element: loadedEl } }));
        return loadedEl;
      }
    } catch (err) {
      console.error(`[view-loader] Failed to load view '${targetKey}':`, err);
    } finally {
      loadingPromises.delete(targetKey);
    }
    return null;
  })();

  loadingPromises.set(targetKey, promise);
  return promise;
}

/**
 * Ensures a modal HTML template is injected into #dynamic-modal-root
 * @param {string} modalId 
 * @returns {Promise<boolean>}
 */
export async function ensureModalLoaded(modalId) {
  if (document.getElementById(modalId)) return true;

  const url = MODAL_MAP[modalId];
  if (!url) {
    console.warn(`[view-loader] Modal ID '${modalId}' not mapped to any modal template`);
    return false;
  }

  if (loadedModals.has(url)) return true;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    
    let modalRoot = document.getElementById('dynamic-modal-root');
    if (!modalRoot) {
      modalRoot = document.createElement('div');
      modalRoot.id = 'dynamic-modal-root';
      document.body.appendChild(modalRoot);
    }

    const temp = document.createElement('div');
    temp.innerHTML = html;
    while (temp.firstChild) {
      modalRoot.appendChild(temp.firstChild);
    }

    loadedModals.add(url);
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: modalRoot });
    }
    return true;
  } catch (err) {
    console.error(`[view-loader] Failed to load modal template '${url}':`, err);
    return false;
  }
}

/**
 * Pre-fetches and hydrates remaining views in background idle time for 0ms instant tab switching
 */
export function preloadViews(viewKeys = ['home', 'myplants', 'supplies', 'logs', 'wiki', 'settings']) {
  const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 500));
  idleCallback(() => {
    viewKeys.forEach(key => {
      ensureViewLoaded(key);
    });
    Object.keys(MODAL_MAP).forEach(modalId => {
      ensureModalLoaded(modalId);
    });
  });
}

// Expose on window for inline modal triggers
window.ensureModalLoaded = ensureModalLoaded;
window.ensureViewLoaded = ensureViewLoaded;