/* ═══════════════════════════════════════════════════════════════
   Plant Book — IndexedDB Offline Storage & Auto-Sync Engine
   Cho phép lưu Nhật ký & Chi phí khi mất mạng 4G/Wifi
   Tự động đồng bộ (Auto-Sync) khi có mạng trở lại.
   ═══════════════════════════════════════════════════════════════ */

const DB_NAME = 'PlantBookOfflineDB';
const DB_VERSION = 1;
let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('pending_logs')) {
          db.createObjectStore('pending_logs', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('pending_costs')) {
          db.createObjectStore('pending_costs', { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }
  return dbPromise;
}

// ── Save Offline Log Entry ─────────────────────────────────────
export async function saveOfflineLog(plantId, logData) {
  try {
    const db = await getDB();
    const tx = db.transaction('pending_logs', 'readwrite');
    const store = tx.objectStore('pending_logs');
    await store.add({
      plant_id: plantId,
      log_date: logData.log_date || new Date().toISOString().split('T')[0],
      log_type: logData.log_type,
      note: logData.note || '',
      details: logData.details || {},
      created_at: new Date().toISOString()
    });
    console.log('📦 Đã lưu nhật ký vào Offline IndexedDB');
    if (window.toast) window.toast('Đã lưu ngoại tuyến (Chờ kết nối mạng để đồng bộ)', 'info');
  } catch (err) {
    console.error('❌ Error saving log offline:', err);
  }
}

// ── Auto-Sync Pending Offline Logs when Online ─────────────────
export async function syncPendingLogs() {
  if (!navigator.onLine) return;
  try {
    const db = await getDB();
    const tx = db.transaction('pending_logs', 'readwrite');
    const store = tx.objectStore('pending_logs');

    const getAllReq = store.getAll();
    getAllReq.onsuccess = async () => {
      const pendingItems = getAllReq.result || [];
      if (pendingItems.length === 0) return;

      console.log(`🔄 Bắt đầu đồng bộ ${pendingItems.length} bản ghi ngoại tuyến...`);
      let syncedCount = 0;

      for (const item of pendingItems) {
        try {
          const res = await fetch(`/api/plants/${item.plant_id}/logs`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('pb_token') || ''}`
            },
            body: JSON.stringify(item)
          });

          if (res.ok) {
            syncedCount++;
            const deleteTx = db.transaction('pending_logs', 'readwrite');
            deleteTx.objectStore('pending_logs').delete(item.id);
          }
        } catch (e) {
          console.warn('Sync failed for item:', item.id, e);
        }
      }

      if (syncedCount > 0) {
        console.log(`✅ Đã đồng bộ thành công ${syncedCount} bản ghi ngoại tuyến!`);
        if (window.toast) window.toast(`Đã tự động đồng bộ ${syncedCount} bản ghi nhật ký ngoại tuyến!`, 'success');
        if (window.loadUserDashboard) window.loadUserDashboard();
      }
    };
  } catch (err) {
    console.error('❌ Error syncing offline logs:', err);
  }
}

// Listen for network reconnect event
window.addEventListener('online', () => {
  console.log('🌐 Kết nối mạng đã khôi phục! Đang kiểm tra dữ liệu chờ đồng bộ...');
  syncPendingLogs();
});
