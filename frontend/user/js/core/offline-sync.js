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

  const PERMANENT_REJECT_CODES = new Set([
    'PHI_VIOLATION_BLOCKED',
    'SUPPLY_EXPIRED',
    'READONLY_ROLE_FORBIDDEN',
    'PLANT_ACCESS_DENIED',
    'FARM_ACCESS_DENIED',
    'INVALID_GPS_ISO19115',
    'INVALID_NFC_UID',
    'INVALID_PLANT_ID',
    'INVALID_MUTATION_TYPE',
    'PLANT_NOT_FOUND',
    'FORBIDDEN'
  ]);

  const isPermanentError = (err) => {
    if (!err) return false;
    if (err.code && PERMANENT_REJECT_CODES.has(err.code)) return true;
    return err.status === 400 || err.status === 403 || err.status === 404 || err.status === 409;
  };

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
      if (Array.isArray(batchRes.synced_uuids) || Array.isArray(batchRes.rejected_items)) {
        const syncedSet = new Set(Array.isArray(batchRes.synced_uuids) ? batchRes.synced_uuids : []);
        const rejectedMap = new Map();
        for (const r of (batchRes.rejected_items || [])) {
          if (!r || !r.client_uuid) continue;
          if (!rejectedMap.has(r.client_uuid)) rejectedMap.set(r.client_uuid, []);
          rejectedMap.get(r.client_uuid).push(r);
        }

        for (const item of pendingLogs) {
          if (syncedSet.has(item.client_uuid)) {
            await deleteOfflineCareLog(item.client_uuid);
            successCount++;
          } else if (rejectedMap.has(item.client_uuid)) {
            const rejs = rejectedMap.get(item.client_uuid);
            const permRejectedPids = new Set(
              rejs.filter(r => PERMANENT_REJECT_CODES.has(r.code)).map(r => Number(r.plant_id))
            );
            const firstPerm = rejs.find(r => PERMANENT_REJECT_CODES.has(r.code));
            if (firstPerm) {
              toast(firstPerm.error || 'Bản ghi ngoại tuyến bị từ chối theo quy chuẩn VietGAP/RBAC.', 'error');
            }
            if (Array.isArray(item.plant_ids) && item.plant_ids.length > 1) {
              const remainingPids = item.plant_ids.filter(pid => !permRejectedPids.has(Number(pid)));
              if (remainingPids.length === 0) {
                await deleteOfflineCareLog(item.client_uuid);
              } else if (remainingPids.length < item.plant_ids.length && typeof saveOfflineCareLog === 'function') {
                await saveOfflineCareLog({ ...item, plant_ids: remainingPids });
                failCount++;
              } else {
                failCount++;
              }
            } else if (rejs.every(r => PERMANENT_REJECT_CODES.has(r.code))) {
              await deleteOfflineCareLog(item.client_uuid);
            } else {
              failCount++;
            }
          } else {
            failCount++;
          }
        }

        for (const mut of pendingMutations) {
          if (syncedSet.has(mut.client_uuid)) {
            await deleteOfflineFieldMutation(mut.client_uuid);
            successCount++;
          } else if (rejectedMap.has(mut.client_uuid)) {
            const rejs = rejectedMap.get(mut.client_uuid);
            const firstPerm = rejs.find(r => PERMANENT_REJECT_CODES.has(r.code));
            if (firstPerm) {
              toast(firstPerm.error || 'Thao tác thực địa bị từ chối.', 'error');
            }
            if (rejs.every(r => PERMANENT_REJECT_CODES.has(r.code))) {
              await deleteOfflineFieldMutation(mut.client_uuid);
            } else {
              failCount++;
            }
          } else {
            failCount++;
          }
        }
      } else {
        for (const item of pendingLogs) {
          await deleteOfflineCareLog(item.client_uuid);
          successCount++;
        }
        for (const mut of pendingMutations) {
          await deleteOfflineFieldMutation(mut.client_uuid);
          successCount++;
        }
      }
      batchSucceeded = true;
    }
  } catch (batchErr) {
    if (batchErr && batchErr.code === 'READONLY_ROLE_FORBIDDEN') {
      toast(batchErr.message || 'Tài khoản Chỉ đọc không được phép đồng bộ ngoại tuyến.', 'error');
      for (const item of pendingLogs) await deleteOfflineCareLog(item.client_uuid);
      for (const mut of pendingMutations) await deleteOfflineFieldMutation(mut.client_uuid);
      batchSucceeded = true;
    } else {
      console.warn('[OfflineSync] Batch sync fallback to individual item sync:', batchErr.message);
    }
  }

  if (!batchSucceeded) {
    for (const item of pendingLogs) {
      try {
        if (Array.isArray(item.plant_ids) && item.plant_ids.length > 0) {
          const remainingPids = [];
          for (const pid of item.plant_ids) {
            const singlePayload = {
              plant_id: pid,
              client_uuid: item.plant_ids.length > 1 ? `${item.client_uuid}::${pid}` : item.client_uuid,
              log_date: item.log_date,
              log_type: item.log_type,
              note: item.note ? `${item.note} (Đồng bộ từ thiết bị ngoại tuyến)` : '(Đồng bộ từ ngoại tuyến)',
              media_urls: item.media_urls || [],
              details: item.details || {},
              operator_name: item.operator_name,
              equipment_used: item.equipment_used,
              created_at: item.created_at_offline ? new Date(item.created_at_offline).toISOString() : new Date().toISOString()
            };
            try {
              await api(`/plants/${pid}/logs`, {
                method: 'POST',
                body: JSON.stringify(singlePayload)
              });
            } catch (pidErr) {
              if (isPermanentError(pidErr)) {
                toast(pidErr.message || `Cây #${pid} bị từ chối đồng bộ.`, 'error');
              } else {
                remainingPids.push(pid);
              }
            }
          }
          if (remainingPids.length === 0) {
            await deleteOfflineCareLog(item.client_uuid);
            successCount++;
          } else {
            if (remainingPids.length < item.plant_ids.length && typeof saveOfflineCareLog === 'function') {
              await saveOfflineCareLog({ ...item, plant_ids: remainingPids });
            }
            failCount++;
          }
        } else if (item.plant_id) {
          const singlePayload = {
            plant_id: item.plant_id,
            client_uuid: item.client_uuid,
            log_date: item.log_date,
            log_type: item.log_type,
            note: item.note,
            media_urls: item.media_urls || [],
            details: item.details || {},
            operator_name: item.operator_name,
            equipment_used: item.equipment_used,
            created_at: item.created_at_offline ? new Date(item.created_at_offline).toISOString() : new Date().toISOString()
          };
          await api(`/plants/${item.plant_id}/logs`, {
            method: 'POST',
            body: JSON.stringify(singlePayload)
          });
          await deleteOfflineCareLog(item.client_uuid);
          successCount++;
        }
      } catch (err) {
        if (isPermanentError(err)) {
          toast(err.message || 'Bản ghi ngoại tuyến bị từ chối.', 'error');
          await deleteOfflineCareLog(item.client_uuid);
        } else {
          console.error('Error syncing offline log:', item.client_uuid, err.message);
          failCount++;
        }
      }
    }

    for (const mut of pendingMutations) {
      try {
        if (mut.mutation_type === 'gps_update' && mut.plant_id) {
          await api(`/plants/${mut.plant_id}/gps`, {
            method: 'PUT',
            body: JSON.stringify({ latitude: mut.latitude, longitude: mut.longitude, location: mut.location })
          });
        } else if (mut.mutation_type === 'nfc_assign' && mut.plant_id) {
          await api(`/plants/${mut.plant_id}/nfc`, {
            method: 'PUT',
            body: JSON.stringify({ nfc_uid: mut.nfc_uid, latitude: mut.latitude, longitude: mut.longitude })
          });
        } else if (mut.mutation_type === 'location_update' && mut.plant_id) {
          await api(`/plants/${mut.plant_id}/gps`, {
            method: 'PUT',
            body: JSON.stringify({
              latitude: mut.latitude,
              longitude: mut.longitude,
              location: mut.location,
              plot_code: mut.plot_code,
              row_number: mut.row_number
            })
          });
        }
        await deleteOfflineFieldMutation(mut.client_uuid);
        successCount++;
      } catch (mutErr) {
        if (isPermanentError(mutErr)) {
          toast(mutErr.message || 'Thao tác thực địa bị từ chối.', 'error');
          await deleteOfflineFieldMutation(mut.client_uuid);
        } else {
          console.error('Error syncing offline field mutation:', mut.client_uuid, mutErr.message);
          failCount++;
        }
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

setTimeout(() => {
  updateOfflineSyncBadge();
  if (navigator.onLine) {
    triggerOfflineSync();
  }
}, 1500);

window.updateOfflineSyncBadge = updateOfflineSyncBadge;
window.triggerOfflineSync = triggerOfflineSync;
