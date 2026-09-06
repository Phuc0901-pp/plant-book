/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   core/offline-db.js — Client-Side IndexedDB Offline Storage Engine
   ═══════════════════════════════════════════════════════════════ */

const DB_NAME = 'plantbook_offline_db';
const DB_VERSION = 1;

let dbInstance = null;

export function openOfflineDb() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.warn('⚠️ IndexedDB is not supported in this browser environment.');
      return resolve(null);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Store for pending offline care logs
      if (!db.objectStoreNames.contains('offline_care_logs')) {
        const logStore = db.createObjectStore('offline_care_logs', { keyPath: 'client_uuid' });
        logStore.createIndex('sync_status', 'sync_status', { unique: false });
        logStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // 2. Store for cached app metadata (plants list, supplies list, configs)
      if (!db.objectStoreNames.contains('cached_meta')) {
        db.createObjectStore('cached_meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('❌ Failed to open IndexedDB:', event.target.error);
      resolve(null);
    };
  });
}

/**
 * Save a care log locally into IndexedDB when offline
 * @param {Object} logPayload
 * @returns {Promise<string>} client_uuid
 */
export async function saveOfflineCareLog(logPayload) {
  const db = await openOfflineDb();
  const clientUuid = logPayload.client_uuid || `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const record = {
    client_uuid: clientUuid,
    ...logPayload,
    sync_status: 'pending', // 'pending' | 'syncing' | 'failed'
    created_at_offline: Date.now(),
    sync_attempts: 0,
    last_error: null
  };

  if (!db) {
    // Fallback to localStorage if IndexedDB is disabled
    try {
      const existing = JSON.parse(localStorage.getItem('pb_offline_logs') || '[]');
      existing.push(record);
      localStorage.setItem('pb_offline_logs', JSON.stringify(existing));
      return clientUuid;
    } catch (_) {
      return clientUuid;
    }
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_care_logs', 'readwrite');
    const store = tx.objectStore('offline_care_logs');
    const req = store.put(record);

    req.onsuccess = () => resolve(clientUuid);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get all pending offline care logs
 * @returns {Promise<Array>}
 */
export async function getPendingOfflineCareLogs() {
  const db = await openOfflineDb();
  if (!db) {
    try {
      return JSON.parse(localStorage.getItem('pb_offline_logs') || '[]');
    } catch (_) {
      return [];
    }
  }

  return new Promise((resolve) => {
    const tx = db.transaction('offline_care_logs', 'readonly');
    const store = tx.objectStore('offline_care_logs');
    const req = store.getAll();

    req.onsuccess = () => {
      const logs = (req.result || []).filter(l => l.sync_status === 'pending' || l.sync_status === 'failed');
      resolve(logs);
    };
    req.onerror = () => resolve([]);
  });
}

/**
 * Delete a synced offline care log by client_uuid
 * @param {string} clientUuid
 */
export async function deleteOfflineCareLog(clientUuid) {
  const db = await openOfflineDb();
  if (!db) {
    try {
      const existing = JSON.parse(localStorage.getItem('pb_offline_logs') || '[]');
      const filtered = existing.filter(l => l.client_uuid !== clientUuid);
      localStorage.setItem('pb_offline_logs', JSON.stringify(filtered));
    } catch (_) {}
    return;
  }

  return new Promise((resolve) => {
    const tx = db.transaction('offline_care_logs', 'readwrite');
    const store = tx.objectStore('offline_care_logs');
    const req = store.delete(clientUuid);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
}

/**
 * Count total pending offline logs
 * @returns {Promise<number>}
 */
export async function countPendingOfflineLogs() {
  const logs = await getPendingOfflineCareLogs();
  return logs.length;
}

/**
 * Cache app metadata (e.g. plants, supplies, configs) into IndexedDB
 * @param {string} key
 * @param {any} data
 */
export async function cacheAppData(key, data) {
  const db = await openOfflineDb();
  if (!db) {
    try {
      localStorage.setItem(`pb_cache_${key}`, JSON.stringify(data));
    } catch (_) {}
    return;
  }

  return new Promise((resolve) => {
    const tx = db.transaction('cached_meta', 'readwrite');
    const store = tx.objectStore('cached_meta');
    store.put({ key, data, cached_at: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/**
 * Retrieve cached app metadata from IndexedDB
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export async function getCachedAppData(key) {
  const db = await openOfflineDb();
  if (!db) {
    try {
      const raw = localStorage.getItem(`pb_cache_${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  return new Promise((resolve) => {
    const tx = db.transaction('cached_meta', 'readonly');
    const store = tx.objectStore('cached_meta');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.data : null);
    req.onerror = () => resolve(null);
  });
}

// Attach globally for accessibility across modular scripts
window.openOfflineDb = openOfflineDb;
window.saveOfflineCareLog = saveOfflineCareLog;
window.getPendingOfflineCareLogs = getPendingOfflineCareLogs;
window.deleteOfflineCareLog = deleteOfflineCareLog;
window.countPendingOfflineLogs = countPendingOfflineLogs;
window.cacheAppData = cacheAppData;
window.getCachedAppData = getCachedAppData;
