const DB_NAME = 'plantbook_offline_db';
const DB_VERSION = 2;

let dbInstance = null;

export function openOfflineDb() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.warn('IndexedDB is not supported in this browser environment.');
      return resolve(null);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('offline_care_logs')) {
        const logStore = db.createObjectStore('offline_care_logs', { keyPath: 'client_uuid' });
        logStore.createIndex('sync_status', 'sync_status', { unique: false });
        logStore.createIndex('created_at', 'created_at', { unique: false });
      }

      if (!db.objectStoreNames.contains('cached_meta')) {
        db.createObjectStore('cached_meta', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('offline_field_mutations')) {
        const mutStore = db.createObjectStore('offline_field_mutations', { keyPath: 'client_uuid' });
        mutStore.createIndex('sync_status', 'sync_status', { unique: false });
        mutStore.createIndex('mutation_type', 'mutation_type', { unique: false });
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

export async function saveOfflineCareLog(logPayload) {
  const db = await openOfflineDb();
  const clientUuid = logPayload.client_uuid || `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const record = {
    client_uuid: clientUuid,
    ...logPayload,
    sync_status: 'pending',
    created_at_offline: Date.now(),
    sync_attempts: 0,
    last_error: null
  };

  if (!db) {
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

export async function saveOfflineFieldMutation(mutationPayload) {
  const db = await openOfflineDb();
  const clientUuid = mutationPayload.client_uuid || `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const record = {
    client_uuid: clientUuid,
    ...mutationPayload,
    sync_status: 'pending',
    created_at_offline: Date.now(),
    sync_attempts: 0
  };

  if (!db || !db.objectStoreNames.contains('offline_field_mutations')) {
    try {
      const existing = JSON.parse(localStorage.getItem('pb_offline_mutations') || '[]');
      existing.push(record);
      localStorage.setItem('pb_offline_mutations', JSON.stringify(existing));
      return clientUuid;
    } catch (_) {
      return clientUuid;
    }
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_field_mutations', 'readwrite');
    const store = tx.objectStore('offline_field_mutations');
    const req = store.put(record);
    req.onsuccess = () => resolve(clientUuid);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getPendingOfflineFieldMutations() {
  const db = await openOfflineDb();
  if (!db || !db.objectStoreNames.contains('offline_field_mutations')) {
    try {
      return JSON.parse(localStorage.getItem('pb_offline_mutations') || '[]');
    } catch (_) {
      return [];
    }
  }

  return new Promise((resolve) => {
    const tx = db.transaction('offline_field_mutations', 'readonly');
    const store = tx.objectStore('offline_field_mutations');
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result || []).filter(m => m.sync_status === 'pending' || m.sync_status === 'failed');
      resolve(items);
    };
    req.onerror = () => resolve([]);
  });
}

export async function deleteOfflineFieldMutation(clientUuid) {
  const db = await openOfflineDb();
  if (!db || !db.objectStoreNames.contains('offline_field_mutations')) {
    try {
      const existing = JSON.parse(localStorage.getItem('pb_offline_mutations') || '[]');
      const filtered = existing.filter(m => m.client_uuid !== clientUuid);
      localStorage.setItem('pb_offline_mutations', JSON.stringify(filtered));
    } catch (_) {}
    return;
  }

  return new Promise((resolve) => {
    const tx = db.transaction('offline_field_mutations', 'readwrite');
    const store = tx.objectStore('offline_field_mutations');
    const req = store.delete(clientUuid);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
}

export async function countPendingOfflineLogs() {
  const [logs, mutations] = await Promise.all([
    getPendingOfflineCareLogs(),
    getPendingOfflineFieldMutations()
  ]);
  return logs.length + mutations.length;
}

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

window.openOfflineDb = openOfflineDb;
window.saveOfflineCareLog = saveOfflineCareLog;
window.getPendingOfflineCareLogs = getPendingOfflineCareLogs;
window.deleteOfflineCareLog = deleteOfflineCareLog;
window.saveOfflineFieldMutation = saveOfflineFieldMutation;
window.getPendingOfflineFieldMutations = getPendingOfflineFieldMutations;
window.deleteOfflineFieldMutation = deleteOfflineFieldMutation;
window.countPendingOfflineLogs = countPendingOfflineLogs;
window.cacheAppData = cacheAppData;
window.getCachedAppData = getCachedAppData;
