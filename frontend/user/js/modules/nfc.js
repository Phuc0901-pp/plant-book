/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/nfc.js — NFC Tag Definition & Reassignment
   ═══════════════════════════════════════════════════════════════ */

import { api }        from '../core/api.js';
import { toast }      from '../core/utils.js';
import { getPlantsCache, renderUserPlantsTable } from './plants.js';

// ── State ──────────────────────────────────────────────────────
let _currentPlant      = null;   // { id, tree_code, public_slug, nfc_uid, farm_id, user_id, plant_type, plant_variety, latitude, longitude }
let _currentFarmPlants = [];     // List of trees in the same farm, sorted by sequential number
let _currentPlantIndex = 0;      // Current active index in _currentFarmPlants
let _nfcReader         = null;   // NDEFReader instance (Web NFC)
let _scanning          = false;
let _capturedGps       = null;   // { latitude, longitude } captured from mobile GPS

// ── Open / Close & Tree Sequential Navigator ───────────────────

function _buildHierarchicalPlantUrl(farmId, plantId, nfcUid) {
  const f = farmId || 0;
  const p = plantId || 0;
  const n = nfcUid ? `/${encodeURIComponent(nfcUid)}` : '';
  const origin = (window.location.origin && !window.location.origin.includes('file://'))
    ? window.location.origin
    : 'https://dev-plantbook.onrender.com';
  return `${origin}/${f}/${p}${n}`;
}

function _renderCurrentNfcPlant() {
  if (!_currentFarmPlants || _currentFarmPlants.length === 0) return;
  const plantObj = _currentFarmPlants[_currentPlantIndex];
  if (!plantObj) return;

  const plantId = plantObj.id;
  const treeCode = plantObj.tree_code || `#${plantId}`;
  const currentNfcUid = plantObj.nfc_uid;
  const publicSlug = plantObj.public_slug || plantId;
  _capturedGps = null;

  _currentPlant = { 
    id: plantId, 
    tree_code: treeCode, 
    public_slug: publicSlug, 
    nfc_uid: currentNfcUid, 
    farm_id: plantObj.farm_id, 
    user_id: plantObj.user_id,
    plant_type: plantObj.plant_type,
    plant_variety: plantObj.plant_variety,
    latitude: plantObj.latitude,
    longitude: plantObj.longitude
  };

  _setEl('nfc-modal-plant-name', `${treeCode}${plantObj.plant_type ? ` (${plantObj.plant_type})` : ''}`);

  // Stepper / Navigator bar UI
  const total = _currentFarmPlants.length;
  const currentNum = _currentPlantIndex + 1;
  _setEl('nfc-nav-tree-info', `Cây #${treeCode}${plantObj.plant_type ? ` · ${plantObj.plant_type}` : ''} (${currentNum}/${total})`);

  const uidBadge = currentNfcUid
    ? `<span class="badge badge-green" style="font-size:12px; padding:4px 8px; font-weight:700;"><i class="fa-solid fa-tag"></i> ${currentNfcUid}</span>`
    : `<span class="badge badge-gray" style="font-size:12px; padding:4px 8px;"><i class="fa-solid fa-link-slash"></i> Chưa gắn thẻ</span>`;
  _setEl('nfc-modal-current-uid', uidBadge, true);

  // Render 3-segment Public Plant URL: https://domain.com/<farm_id>/<plant_id>/<nfc_uid>
  const fullPlantUrl = _buildHierarchicalPlantUrl(plantObj.farm_id, plantId, currentNfcUid);
  const urlInput = document.getElementById('nfc-public-url-input');
  const urlLink = document.getElementById('nfc-public-url-link');
  if (urlInput) urlInput.value = fullPlantUrl;
  if (urlLink) urlLink.href = fullPlantUrl;

  // Render Metadata Component IDs (Standard 3-segment breakdown)
  _setEl('nfc-meta-farm-id', plantObj.farm_id ? `#${plantObj.farm_id}` : '#0');
  _setEl('nfc-meta-plant-id', `#${plantId}`);
  _setEl('nfc-meta-tag-id', currentNfcUid ? currentNfcUid : 'Chưa gắn');

  // Render GPS info
  const hasGps = (plantObj.latitude !== null && plantObj.latitude !== undefined && plantObj.latitude !== '') &&
                 (plantObj.longitude !== null && plantObj.longitude !== undefined && plantObj.longitude !== '');
  const gpsText = hasGps ? `${Number(plantObj.latitude).toFixed(6)}, ${Number(plantObj.longitude).toFixed(6)}` : 'Chưa có tọa độ';
  _setEl('nfc-modal-gps-text', gpsText);
  const gpsBtn = document.getElementById('btn-nfc-get-gps');
  if (gpsBtn) {
    gpsBtn.innerHTML = '<i class="fa-solid fa-crosshairs" style="color: #059669;"></i> Lấy GPS hiện tại';
    gpsBtn.disabled = false;
  }

  const manualInput = document.getElementById('nfc-manual-uid');
  if (manualInput) manualInput.value = currentNfcUid || '';

  const deactivateBtn = document.getElementById('nfc-deactivate-btn');
  if (deactivateBtn) deactivateBtn.style.display = currentNfcUid ? 'flex' : 'none';

  if (_scanning) {
    _setNfcStatus('scanning');
  }
}

export function prevNfcPlant() {
  if (!_currentFarmPlants || _currentFarmPlants.length <= 1) return;
  _currentPlantIndex = (_currentPlantIndex - 1 + _currentFarmPlants.length) % _currentFarmPlants.length;
  _renderCurrentNfcPlant();
}
window.prevNfcPlant = prevNfcPlant;

export function nextNfcPlant() {
  if (!_currentFarmPlants || _currentFarmPlants.length <= 1) return;
  _currentPlantIndex = (_currentPlantIndex + 1) % _currentFarmPlants.length;
  _renderCurrentNfcPlant();
}
window.nextNfcPlant = nextNfcPlant;

export function openNfcModal(plantId, treeCode, publicSlug, currentNfcUid) {
  const cache = getPlantsCache();
  const plantObj = cache.find(p => p.id == plantId) || {};
  const farmId = plantObj.farm_id;

  // Filter all plants belonging to the same farm (or entire cache if unassigned)
  _currentFarmPlants = (farmId !== undefined && farmId !== null && farmId !== '')
    ? cache.filter(p => p.farm_id == farmId)
    : [...cache];

  if (!_currentFarmPlants.length && plantObj.id) {
    _currentFarmPlants = [plantObj];
  }

  // Sort logically and naturally by tree_code or id (1, 2, 3, 4, 10...)
  _currentFarmPlants.sort((a, b) => {
    const rawA = (a.tree_code || a.id || '').toString();
    const rawB = (b.tree_code || b.id || '').toString();
    const numA = parseInt(rawA.replace(/\D/g, ''), 10);
    const numB = parseInt(rawB.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numA - numB;
    }
    return rawA.localeCompare(rawB, undefined, { numeric: true, sensitivity: 'base' });
  });

  _currentPlantIndex = _currentFarmPlants.findIndex(p => p.id == plantId);
  if (_currentPlantIndex === -1) _currentPlantIndex = 0;

  _renderCurrentNfcPlant();
  _setNfcStatus('idle');

  const modal = document.getElementById('nfc-modal');
  if (modal) { 
    modal.classList.add('open'); 
    document.body.style.overflow = 'hidden'; 
  }

  // Check Web NFC support (Web NFC requires HTTPS & Chrome on Android with NFC hardware)
  if ('NDEFReader' in window && 'ontouchstart' in window) {
    startNfcScan();
  } else {
    _setNfcStatus('unsupported');
  }
}

export function closeNfcModal() {
  _stopNfcScan();
  const modal = document.getElementById('nfc-modal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
  _currentPlant = null;
  _currentFarmPlants = [];
}

export function copyNfcPublicUrl() {
  const input = document.getElementById('nfc-public-url-input');
  if (input && input.value) {
    const url = input.value;
    navigator.clipboard.writeText(url).then(() => {
      const hasNfcTag = _currentPlant && _currentPlant.nfc_uid;
      if (hasNfcTag) {
        toast('✨ Đã copy URL public! Đang mở ứng dụng NFC Tools để ghi vào thẻ...', 'success');
        
        // Deep link to NFC Tools app (wakdev NFC Tools)
        const isAndroid = /Android/i.test(navigator.userAgent);
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        
        setTimeout(() => {
          if (isAndroid) {
            window.location.href = 'intent://#Intent;package=com.wakdev.wdnfc;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.wakdev.wdnfc;end';
          } else if (isIOS) {
            window.location.href = 'nfctools://';
          }
        }, 300);
      } else {
        toast('Đã sao chép đường dẫn URL cây công khai!', 'success');
      }
    }).catch(err => {
      console.warn('Clipboard write error:', err);
      toast('Đã sao chép đường dẫn URL!');
    });
  }
}
window.copyNfcPublicUrl = copyNfcPublicUrl;

export function copyNfcTagUrl() {
  const input = document.getElementById('nfc-tag-url-input');
  if (input && input.value) {
    navigator.clipboard.writeText(input.value);
    toast('Đã sao chép đường dẫn Redirect NFC!');
  }
}
window.copyNfcTagUrl = copyNfcTagUrl;

export async function startNfcScan() {
  if (_scanning || !_currentPlant) return;
  if (!('NDEFReader' in window)) { _setNfcStatus('unsupported'); return; }
  try {
    _nfcReader = new NDEFReader();
    _scanning  = true;
    _setNfcStatus('scanning');
    await _nfcReader.scan();
    _nfcReader.addEventListener('reading', async ({ serialNumber }) => {
      _stopNfcScan();
      const uid = serialNumber.toUpperCase();
      _setNfcStatus('detected', uid);
      const plantUrl = _buildHierarchicalPlantUrl(_currentPlant.farm_id, _currentPlant.id, uid);
      try {
        await _nfcReader.write({ records: [{ recordType: 'url', data: plantUrl }] });
        toast(`Đã ghi URL cây vào thẻ: ${_currentPlant.tree_code || _currentPlant.id}`);
      } catch (writeErr) {
        console.warn('NFC write skipped:', writeErr.message);
      }
      await _saveUid(uid);
    });
    _nfcReader.addEventListener('readingerror', () => { _stopNfcScan(); _setNfcStatus('error'); });
  } catch (err) {
    _scanning = false;
    _setNfcStatus(err.name === 'NotAllowedError' ? 'permission_denied' : 'unsupported');
  }
}

function _stopNfcScan() { _scanning = false; _nfcReader = null; }

export async function saveNfcUidManually() {
  const uid = (document.getElementById('nfc-manual-uid')?.value || '').trim().toUpperCase();
  if (!uid) { toast('Vui lòng nhập mã thẻ định danh.', 'warning'); return; }
  if (!_currentPlant) return;
  if (_currentPlant.nfc_uid && _currentPlant.nfc_uid.toUpperCase() !== uid) {
    if (!confirm(`Cây này đang gắn thẻ ${_currentPlant.nfc_uid}.\nBạn có chắc muốn thay thế bằng thẻ mới ${uid}?\n\n⚠️ Lưu ý: Thẻ cũ sẽ bị thu hồi và đường dẫn công khai theo thẻ cũ sẽ bị đóng băng truy cập. Lịch sử canh tác của cây vẫn được giữ nguyên vẹn 100%.`)) {
      return;
    }
  }
  await _saveUid(uid);
}

export async function deactivateNfcTag() {
  if (!_currentPlant) return;
  if (!confirm(`Hủy kích hoạt thẻ định danh cho cây ${_currentPlant.tree_code || _currentPlant.id}?\n\n⚠️ Lưu ý: Tọa độ GPS của cây sẽ được xóa đi. Đường dẫn công khai theo thẻ cũ sẽ bị đóng băng truy cập. Lịch sử canh tác của cây vẫn được giữ nguyên vẹn 100%.`)) return;
  await _saveUid(null);
}

export function getNfcCurrentGps() {
  if (!navigator.geolocation) {
    toast('Trình duyệt không hỗ trợ định vị GPS.', 'error');
    return;
  }
  const btn = document.getElementById('btn-nfc-get-gps');
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang định vị...';
    btn.disabled = true;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      _capturedGps = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      };
      _setEl('nfc-modal-gps-text', `📍 ${_capturedGps.latitude.toFixed(6)}, ${_capturedGps.longitude.toFixed(6)} (Mới lấy)`);
      toast('Đã lấy tọa độ GPS thành công! Bấm Lưu hoặc Ghi thẻ để đồng bộ vào cây.', 'success');
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-check" style="color:#059669;"></i> Đã lấy GPS';
        btn.disabled = false;
      }
    },
    (err) => {
      console.warn('Geolocation error:', err);
      toast('Không thể lấy tọa độ GPS: ' + (err.message || 'Vui lòng cấp quyền vị trí trên điện thoại.'), 'error');
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-crosshairs" style="color:#059669;"></i> Thử lại GPS';
        btn.disabled = false;
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}
window.getNfcCurrentGps = getNfcCurrentGps;

async function _saveUid(uid) {
  if (!_currentPlant) return;
  try {
    const payload = { nfc_uid: uid };
    if (uid && _capturedGps) {
      payload.latitude = _capturedGps.latitude;
      payload.longitude = _capturedGps.longitude;
    }

    const res = await api(`/plants/${_currentPlant.id}/nfc`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    
    toast(res.message || (uid ? 'Đã gán thẻ định danh thành công!' : 'Đã hủy kích hoạt thẻ thành công.'));
    
    _currentPlant.nfc_uid = uid;
    if (!uid) {
      _currentPlant.latitude = null;
      _currentPlant.longitude = null;
      _setEl('nfc-modal-gps-text', 'Chưa có tọa độ');
    } else if (res.plant) {
      if (res.plant.latitude !== undefined) _currentPlant.latitude = res.plant.latitude;
      if (res.plant.longitude !== undefined) _currentPlant.longitude = res.plant.longitude;
      const hasGps = (_currentPlant.latitude !== null && _currentPlant.latitude !== undefined) &&
                     (_currentPlant.longitude !== null && _currentPlant.longitude !== undefined);
      _setEl('nfc-modal-gps-text', hasGps ? `${Number(_currentPlant.latitude).toFixed(6)}, ${Number(_currentPlant.longitude).toFixed(6)}` : 'Chưa có tọa độ');
    }
    _capturedGps = null;
    const gpsBtn = document.getElementById('btn-nfc-get-gps');
    if (gpsBtn) {
      gpsBtn.innerHTML = '<i class="fa-solid fa-crosshairs" style="color: #059669;"></i> Lấy GPS hiện tại';
      gpsBtn.disabled = false;
    }

    // Update modal UI live
    const uidBadge = uid
      ? `<span class="badge badge-green" style="font-size:12px; padding:4px 8px; font-weight:700;"><i class="fa-solid fa-tag"></i> ${uid}</span>`
      : `<span class="badge badge-gray" style="font-size:12px; padding:4px 8px;"><i class="fa-solid fa-link-slash"></i> Chưa gắn thẻ</span>`;
    _setEl('nfc-modal-current-uid', uidBadge, true);

    const fullPlantUrl = _buildHierarchicalPlantUrl(_currentPlant.farm_id, _currentPlant.id, uid);
    const urlInput = document.getElementById('nfc-public-url-input');
    const urlLink = document.getElementById('nfc-public-url-link');
    if (urlInput) urlInput.value = fullPlantUrl;
    if (urlLink) urlLink.href = fullPlantUrl;

    _setEl('nfc-meta-tag-id', uid ? uid : 'Chưa gắn');

    const deactivateBtn = document.getElementById('nfc-deactivate-btn');
    if (deactivateBtn) deactivateBtn.style.display = uid ? 'flex' : 'none';

    // Update cache & table
    if (_currentFarmPlants[_currentPlantIndex]) {
      _currentFarmPlants[_currentPlantIndex].nfc_uid = uid;
      _currentFarmPlants[_currentPlantIndex].public_url = fullPlantUrl;
      _currentFarmPlants[_currentPlantIndex].latitude = _currentPlant.latitude;
      _currentFarmPlants[_currentPlantIndex].longitude = _currentPlant.longitude;
    }
    const cache = getPlantsCache();
    const idx   = cache.findIndex(p => p.id === _currentPlant.id);
    if (idx !== -1) {
      cache[idx].nfc_uid = uid;
      cache[idx].public_url = fullPlantUrl;
      cache[idx].latitude = _currentPlant.latitude;
      cache[idx].longitude = _currentPlant.longitude;
      renderUserPlantsTable(cache);
    }
  } catch (err) {
    toast(err.message || 'Lỗi cập nhật định danh thẻ.', 'error');
  }
}

function _setEl(id, value, isHtml = false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (isHtml) el.innerHTML = value; else el.textContent = value;
}

function _setNfcStatus(status, uid = '') {
  const iconEl  = document.getElementById('nfc-scan-icon');
  const labelEl = document.getElementById('nfc-scan-label');
  const startBtn = document.getElementById('nfc-start-scan-btn');
  if (!iconEl || !labelEl) return;

  const states = {
    idle:             { icon: 'fa-wifi',          color: '#6b7280', spin: false, label: 'Nhấn "Bắt đầu quét" để chạm thẻ', btnText: '<i class="fa-solid fa-rss"></i> Bắt đầu quét NFC' },
    scanning:         { icon: 'fa-circle-notch',  color: '#3b82f6', spin: true,  label: 'Đang chờ... Chạm điện thoại vào thẻ NFC', btnText: '<i class="fa-solid fa-stop"></i> Dừng quét' },
    detected:         { icon: 'fa-circle-check',  color: '#22c55e', spin: false, label: `Đã phát hiện thẻ: ${uid}`, btnText: '<i class="fa-solid fa-rss"></i> Quét lại' },
    error:            { icon: 'fa-circle-xmark',  color: '#ef4444', spin: false, label: 'Không đọc được thẻ. Vui lòng nhập mã thủ công bên dưới.', btnText: '<i class="fa-solid fa-rss"></i> Thử lại' },
    unsupported:      { icon: 'fa-desktop', color: '#f59e0b', spin: false, label: 'Trình duyệt chưa hỗ trợ Web NFC trên máy tính (Web NFC hoạt động trên Chrome Android HTTPS). Vui lòng nhập mã UID thủ công bên dưới hoặc dùng Mobile App.', btnText: null },
    permission_denied:{ icon: 'fa-lock',          color: '#ef4444', spin: false, label: 'Quyền NFC bị từ chối. Kiểm tra cài đặt trình duyệt.', btnText: '<i class="fa-solid fa-rss"></i> Thử lại' }
  };

  const s = states[status] || states.idle;
  iconEl.className   = `fa-solid ${s.icon}${s.spin ? ' fa-spin' : ''}`;
  iconEl.style.color = s.color;
  labelEl.textContent = s.label;

  if (startBtn) {
    if (s.btnText === null) { startBtn.style.display = 'none'; }
    else { startBtn.style.display = 'flex'; startBtn.innerHTML = s.btnText; }
  }
}
