/* Plant Book Agtech (c) 2026 TBSG Agtech. All Rights Reserved. Enterprise Protected Asset */
/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   core/offline-sync.js — Autonomous Offline Synchronization Engine
   ═══════════════════════════════════════════════════════════════ */

import { api, token } from './api.js';
import { toast } from './utils.js';
import {
  getPendingOfflineCareLogs,
  deleteOfflineCareLog,
  getPendingOfflineFieldMutations,
  deleteOfflineFieldMutation,
  countPendingOfflineLogs
} from './offline-db.js';

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
      <i data-lucide="refresh-cw" class="lucide-spin lucide-sm" style="color:#2563eb;"></i>
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
      <i data-lucide="upload-cloud" class="lucide-sm" style="color:#2563eb;"></i>
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
 * Trigger synchronization of all pending offline care logs and field mutations
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

  const [pendingLogs, pendingMutations] = await Promise.all([
    getPendingOfflineCareLogs(),
    getPendingOfflineFieldMutations()
  ]);

  if (pendingLogs.length === 0 && pendingMutations.length === 0) {
    updateOfflineSyncBadge();
    if (isManual) {
      toast('Toàn bộ dữ liệu thực địa đã được đồng bộ với máy chủ!', 'info');
    }
    return;
  }

  isSyncing = true;
  updateOfflineSyncBadge();

  let successCount = 0;
  let failCount = 0;

  // 1. Try High-Speed Single-Request Batch Sync first
  let batchSucceeded = false;
  try {
    const batchRes = await api('/plants/offline-batch-sync', {
      method: 'POST',
      body: JSON.stringify({
        care_logs: pendingLogs,
        field_mutations: pendingMutations
      })
    });
    if (batchRes && batchRes.success) {
      for (const item of pendingLogs) {
        await deleteOfflineCareLog(item.client_uuid);
        successCount++;
      }
      for (const mut of pendingMutations) {
        await deleteOfflineFieldMutation(mut.client_uuid);
        successCount++;
      }
      batchSucceeded = true;
    }
  } catch (batchErr) {
    console.warn('[OfflineSync] Batch sync fallback to individual item sync:', batchErr.message);
  }

  // 2. Fallback: Individual item sync if batch endpoint was unavailable
  if (!batchSucceeded) {
    for (const item of pendingLogs) {
      try {
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
        console.error('Error syncing offline log:', item.client_uuid, err.message);
        failCount++;
      }
    }

    for (const mut of pendingMutations) {
      try {
        if (mut.mutation_type === 'gps_update' && mut.plant_id) {
          await api(`/plants/${mut.plant_id}/gps`, {
            method: 'PUT',
            body: JSON.stringify({ latitude: mut.latitude, longitude: mut.longitude })
          });
        } else if (mut.mutation_type === 'nfc_assign' && mut.plant_id) {
          await api(`/plants/${mut.plant_id}/nfc-assign`, {
            method: 'POST',
            body: JSON.stringify({ nfc_uid: mut.nfc_uid, latitude: mut.latitude, longitude: mut.longitude })
          });
        } else if (mut.mutation_type === 'location_update' && mut.plant_id) {
          await api(`/plants/${mut.plant_id}/location`, {
            method: 'PUT',
            body: JSON.stringify({ location: mut.location, plot_code: mut.plot_code, row_number: mut.row_number })
          });
        }
        await deleteOfflineFieldMutation(mut.client_uuid);
        successCount++;
      } catch (mutErr) {
        console.error('Error syncing offline field mutation:', mut.client_uuid, mutErr.message);
        failCount++;
      }
    }
  }

  isSyncing = false;
  await updateOfflineSyncBadge();

  if (successCount > 0) {
    toast(`Đã đồng bộ thành công ${successCount} tác vụ thực địa lên máy chủ!`, 'success');
    if (typeof window.loadUserDashboard === 'function') window.loadUserDashboard();
    if (typeof window.loadLogs === 'function') window.loadLogs();
  }

  if (failCount > 0) {
    toast(`Có ${failCount} tác vụ chưa đồng bộ được. Sẽ tự động thử lại sau.`, 'warning');
  }
}

// ── Event Listeners for Autonomous Sync ──
window.addEventListener('online', () => {
  console.log('[Network] Connection restored. Triggering offline sync...');
  updateOfflineSyncBadge();
  triggerOfflineSync();
});

window.addEventListener('offline', () => {
  console.log('[Network] Device is now offline.');
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
