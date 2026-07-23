/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/nfc.js — NFC Tag Definition & Reassignment
   ═══════════════════════════════════════════════════════════════ */

import { api }        from '../core/api.js';
import { toast }      from '../core/utils.js';
import { getPlantsCache, renderUserPlantsTable } from './plants.js';

// ── State ──────────────────────────────────────────────────────
let _currentPlant  = null;   // { id, tree_code, public_slug, nfc_uid }
let _nfcReader     = null;   // NDEFReader instance (Web NFC)
let _scanning      = false;

// ── Open / Close ───────────────────────────────────────────────

export function openNfcModal(plantId, treeCode, publicSlug, currentNfcUid) {
  const cache = getPlantsCache();
  const plantObj = cache.find(p => p.id == plantId) || {};
  _currentPlant = { id: plantId, tree_code: treeCode, public_slug: publicSlug || plantId, nfc_uid: currentNfcUid, farm_id: plantObj.farm_id, user_id: plantObj.user_id };

  _setEl('nfc-modal-plant-name', treeCode || `Cây #${plantId}`);

  const uidBadge = currentNfcUid
    ? `<span class="badge badge-green" style="font-size:12px; padding:4px 8px; font-weight:700;"><i class="fa-solid fa-tag"></i> ${currentNfcUid}</span>`
    : `<span class="badge badge-gray" style="font-size:12px; padding:4px 8px;"><i class="fa-solid fa-link-slash"></i> Chưa gắn thẻ</span>`;
  _setEl('nfc-modal-current-uid', uidBadge, true);

  // 1. Direct Plant Page URL
  const slug = publicSlug || plantId;
  const plantUrl = `${window.location.origin}/plant/${slug}`;
  const urlInput = document.getElementById('nfc-public-url-input');
  const urlLink = document.getElementById('nfc-public-url-link');
  if (urlInput) urlInput.value = plantUrl;
  if (urlLink) urlLink.href = plantUrl;

  // 2. NFC Redirect URL by UID
  const tagUrlWrap = document.getElementById('nfc-tag-url-wrap');
  const tagUrlInput = document.getElementById('nfc-tag-url-input');
  const tagUrlLink = document.getElementById('nfc-tag-url-link');
  if (currentNfcUid) {
    if (tagUrlWrap) tagUrlWrap.style.display = 'block';
    const tagUrl = `${window.location.origin}/nfc/${currentNfcUid}`;
    if (tagUrlInput) tagUrlInput.value = tagUrl;
    if (tagUrlLink) tagUrlLink.href = tagUrl;
  } else {
    if (tagUrlWrap) tagUrlWrap.style.display = 'none';
  }

  // 3. Associated Metadata IDs
  _setEl('nfc-meta-plant-id', `#${plantId}`);
  _setEl('nfc-meta-farm-id', plantObj.farm_id ? `#${plantObj.farm_id}` : '#—');
  _setEl('nfc-meta-user-id', plantObj.user_id ? `#${plantObj.user_id}` : '#—');

  const manualInput = document.getElementById('nfc-manual-uid');
  if (manualInput) manualInput.value = currentNfcUid || '';

  const deactivateBtn = document.getElementById('nfc-deactivate-btn');
  if (deactivateBtn) deactivateBtn.style.display = currentNfcUid ? 'flex' : 'none';

  _setNfcStatus('idle');

  const modal = document.getElementById('nfc-modal');
  if (modal) { modal.classList.add('open'); document.body.style.overflow = 'hidden'; }

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
}

export function copyNfcPublicUrl() {
  const input = document.getElementById('nfc-public-url-input');
  if (input && input.value) {
    navigator.clipboard.writeText(input.value);
    toast('Đã sao chép đường dẫn URL cây công khai!');
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
      const plantUrl = `${location.origin}/plant/${_currentPlant.public_slug || _currentPlant.id}`;
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
  await _saveUid(uid);
}

export async function deactivateNfcTag() {
  if (!_currentPlant) return;
  if (!confirm(`Hủy kích hoạt thẻ định danh cho cây ${_currentPlant.tree_code || _currentPlant.id}?`)) return;
  await _saveUid(null);
}

async function _saveUid(uid) {
  if (!_currentPlant) return;
  try {
    const res = await api(`/plants/${_currentPlant.id}/nfc`, {
      method: 'PUT',
      body: JSON.stringify({ nfc_uid: uid })
    });
    
    toast(res.message || (uid ? 'Đã gán thẻ định danh thành công!' : 'Đã hủy kích hoạt thẻ thành công.'));
    
    _currentPlant.nfc_uid = uid;

    // Update modal UI live
    const uidBadge = uid
      ? `<span class="badge badge-green" style="font-size:12px; padding:4px 8px; font-weight:700;"><i class="fa-solid fa-tag"></i> ${uid}</span>`
      : `<span class="badge badge-gray" style="font-size:12px; padding:4px 8px;"><i class="fa-solid fa-link-slash"></i> Chưa gắn thẻ</span>`;
    _setEl('nfc-modal-current-uid', uidBadge, true);

    const tagUrlWrap = document.getElementById('nfc-tag-url-wrap');
    const tagUrlInput = document.getElementById('nfc-tag-url-input');
    const tagUrlLink = document.getElementById('nfc-tag-url-link');
    if (uid) {
      if (tagUrlWrap) tagUrlWrap.style.display = 'block';
      const tagUrl = `${window.location.origin}/nfc/${uid}`;
      if (tagUrlInput) tagUrlInput.value = tagUrl;
      if (tagUrlLink) tagUrlLink.href = tagUrl;
    } else {
      if (tagUrlWrap) tagUrlWrap.style.display = 'none';
    }

    const deactivateBtn = document.getElementById('nfc-deactivate-btn');
    if (deactivateBtn) deactivateBtn.style.display = uid ? 'flex' : 'none';

    // Update cache & table
    const cache = getPlantsCache();
    const idx   = cache.findIndex(p => p.id === _currentPlant.id);
    if (idx !== -1) {
      cache[idx].nfc_uid = uid;
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
