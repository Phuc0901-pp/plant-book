/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   core/offline-sync.js — Autonomous Offline Synchronization Engine
   ═══════════════════════════════════════════════════════════════ */

import { api, token } from './api.js';
import { toast } from './utils.js';
import { getPendingOfflineCareLogs, deleteOfflineCareLog, countPendingOfflineLogs } from './offline-db.js';

let isSyncing = false;

/**
 * Update the Topbar offline/online sync badge UI
 */
export async function updateOfflineSyncBadge() {
  const badge = document.getElementById('offline-sync-badge');
  const textEl = document.getElementById('sync-status-text');
  if (!badge || !textEl) return;

  const count = await countPendingOfflineLogs();
  const isOnline = navigator.onLine;

  if (isSyncing) {
    badge.style.background = '#eff6ff';
    badge.style.borderColor = '#93c5fd';
    badge.style.color = '#1d4ed8';
    badge.innerHTML = `
      <i class="fa-solid fa-arrows-rotate fa-spin" style="color:#2563eb;"></i>
      <span id="sync-status-text">Đang đồng bộ (${count})...</span>
    `;
    return;
  }

  if (!isOnline) {
    badge.style.background = '#fef3c7';
    badge.style.borderColor = '#fde68a';
    badge.style.color = '#b45309';
    badge.innerHTML = `
      <span style="width:8px; height:8px; border-radius:50%; background:#f59e0b; display:inline-block;"></span>
      <span id="sync-status-text">Ngoại tuyến${count > 0 ? ` (${count} chờ)` : ''}</span>
    `;
  } else if (count > 0) {
    badge.style.background = '#eff6ff';
    badge.style.borderColor = '#bfdbfe';
    badge.style.color = '#1e40af';
    badge.innerHTML = `
      <i class="fa-solid fa-cloud-arrow-up" style="color:#2563eb;"></i>
      <span id="sync-status-text">Chờ gửi (${count})</span>
    `;
  } else {
    badge.style.background = '#ecfdf5';
    badge.style.borderColor = '#a7f3d0';
    badge.style.color = '#047857';
    badge.innerHTML = `
      <span style="width:8px; height:8px; border-radius:50%; background:#10b981; display:inline-block;"></span>
      <span id="sync-status-text">Trực tuyến</span>
    `;
  }
}

/**
 * Trigger synchronization of all pending offline care logs
 * @param {boolean} isManual - Whether invoked manually by user click
 */
export async function triggerOfflineSync(isManual = false) {
  if (isSyncing) return;
  if (!token) return;

  if (!navigator.onLine) {
    updateOfflineSyncBadge();
    if (isManual) {
      toast('Thiết bị đang ngoại tuyến. Dữ liệu sẽ tự động gửi khi có kết nối 3G/4G/Wifi!', 'warning');
    }
    return;
  }

  const pendingLogs = await getPendingOfflineCareLogs();
  if (pendingLogs.length === 0) {
    updateOfflineSyncBadge();
    if (isManual) {
      toast('Toàn bộ nhật ký đã được đồng bộ với máy chủ!', 'info');
    }
    return;
  }

  isSyncing = true;
  updateOfflineSyncBadge();

  let successCount = 0;
  let failCount = 0;

  for (const item of pendingLogs) {
    try {
      // 1. If batch log with multi plants
      if (Array.isArray(item.plant_ids) && item.plant_ids.length > 0) {
        for (const pid of item.plant_ids) {
          const singlePayload = {
            plant_id: pid,
            log_date: item.log_date,
            log_type: item.log_type,
            note: item.note ? `${item.note} (Đồng bộ từ thiết bị ngoại tuyến)` : '(Đồng bộ từ ngoại tuyến)',
            media_urls: item.media_urls || [],
            details: item.details || {},
            operator_name: item.operator_name,
            equipment_used: item.equipment_used,
            created_at: item.created_at_offline ? new Date(item.created_at_offline).toISOString() : new Date().toISOString()
          };
          await api(`/plants/${pid}/care-log`, {
            method: 'POST',
            body: JSON.stringify(singlePayload)
          });
        }
      } else if (item.plant_id) {
        // Single plant log
        const singlePayload = {
          plant_id: item.plant_id,
          log_date: item.log_date,
          log_type: item.log_type,
          note: item.note,
          media_urls: item.media_urls || [],
          details: item.details || {},
          operator_name: item.operator_name,
          equipment_used: item.equipment_used,
          created_at: item.created_at_offline ? new Date(item.created_at_offline).toISOString() : new Date().toISOString()
        };
        await api(`/plants/${item.plant_id}/care-log`, {
          method: 'POST',
          body: JSON.stringify(singlePayload)
        });
      }

      await deleteOfflineCareLog(item.client_uuid);
      successCount++;
    } catch (err) {
      console.error('❌ Error syncing offline log:', item.client_uuid, err.message);
      failCount++;
    }
  }

  isSyncing = false;
  await updateOfflineSyncBadge();

  if (successCount > 0) {
    toast(`✅ Đã đồng bộ thành công ${successCount} nhật ký lên máy chủ!`, 'success');
    if (typeof window.loadUserDashboard === 'function') window.loadUserDashboard();
    if (typeof window.loadLogs === 'function') window.loadLogs();
  }

  if (failCount > 0) {
    toast(`⚠️ Có ${failCount} nhật ký chưa đồng bộ được do lỗi định dạng. Sẽ thử lại sau.`, 'warning');
  }
}

// ── Event Listeners for Autonomous Sync ──
window.addEventListener('online', () => {
  console.log('📶 [Network] Connection restored. Triggering offline sync...');
  updateOfflineSyncBadge();
  triggerOfflineSync();
});

window.addEventListener('offline', () => {
  console.log('📴 [Network] Device is now offline.');
  updateOfflineSyncBadge();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && navigator.onLine) {
    triggerOfflineSync();
  }
});

// Auto-check on initialization
setTimeout(() => {
  updateOfflineSyncBadge();
  if (navigator.onLine) {
    triggerOfflineSync();
  }
}, 1500);

window.updateOfflineSyncBadge = updateOfflineSyncBadge;
window.triggerOfflineSync = triggerOfflineSync;
