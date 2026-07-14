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
  _currentPlant = { id: plantId, tree_code: treeCode, public_slug: publicSlug, nfc_uid: currentNfcUid };

  _setEl('nfc-modal-plant-name', treeCode || `Cay #${plantId}`);
  const uidBadge = currentNfcUid
    ? `<span class="badge badge-green"><i class="fa-solid fa-tag"></i> ${currentNfcUid}</span>`
    : `<span class="badge badge-gray"><i class="fa-solid fa-link-slash"></i> Chua gan the</span>`;
  _setEl('nfc-modal-current-uid', uidBadge, true);

  const manualInput = document.getElementById('nfc-manual-uid');
  if (manualInput) manualInput.value = '';

  const deactivateBtn = document.getElementById('nfc-deactivate-btn');
  if (deactivateBtn) deactivateBtn.style.display = currentNfcUid ? 'flex' : 'none';

  _setNfcStatus('idle');

  const modal = document.getElementById('nfc-modal');
  if (modal) { modal.classList.add('open'); document.body.style.overflow = 'hidden'; }

  if ('NDEFReader' in window) { startNfcScan(); } else { _setNfcStatus('unsupported'); }
}

export function closeNfcModal() {
  _stopNfcScan();
  const modal = document.getElementById('nfc-modal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
  _currentPlant = null;
}

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
      const plantUrl = `${location.origin}/plant/${_currentPlant.public_slug}`;
      try {
        await _nfcReader.write({ records: [{ recordType: 'url', data: plantUrl }] });
        toast(`Da ghi URL cay vao the: ${_currentPlant.tree_code}`);
      } catch (writeErr) {
        console.warn('NFC write skipped:', writeErr.message);
      }
      await _saveUid(uid);
    });
    _nfcReader.addEventListener('readingerror', () => { _stopNfcScan(); _setNfcStatus('error'); });
  } catch (err) {
    _scanning = false;
    _setNfcStatus(err.name === 'NotAllowedError' ? 'permission_denied' : 'error');
  }
}

function _stopNfcScan() { _scanning = false; _nfcReader = null; }

export async function saveNfcUidManually() {
  const uid = (document.getElementById('nfc-manual-uid')?.value || '').trim().toUpperCase();
  if (!uid) { toast('Vui long nhap ma the dinh danh.', 'error'); return; }
  if (!_currentPlant) return;
  await _saveUid(uid);
}

export async function deactivateNfcTag() {
  if (!_currentPlant) return;
  if (!confirm(`Huy kich hoat the dinh danh cho cay ${_currentPlant.tree_code || _currentPlant.id}?`)) return;
  await _saveUid(null);
}

async function _saveUid(uid) {
  if (!_currentPlant) return;
  try {
    const res = await api(`/plants/${_currentPlant.id}/nfc`, {
      method: 'PUT',
      body: JSON.stringify({ nfc_uid: uid })
    });
    toast(res.message || 'Da cap nhat dinh danh the.');
    closeNfcModal();
    const cache = getPlantsCache();
    const idx   = cache.findIndex(p => p.id === _currentPlant.id);
    if (idx !== -1) { cache[idx].nfc_uid = uid; renderUserPlantsTable(cache); }
  } catch (err) {
    toast(err.message || 'Loi cap nhat dinh danh the.', 'error');
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
    idle:             { icon: 'fa-wifi',          color: '#6b7280', spin: false, label: 'Nhan "Bat dau quet" de cham the', btnText: '<i class="fa-solid fa-rss"></i> Bat dau quet NFC' },
    scanning:         { icon: 'fa-circle-notch',  color: '#3b82f6', spin: true,  label: 'Dang cho... Cham dien thoai vao the NFC', btnText: '<i class="fa-solid fa-stop"></i> Dung quet' },
    detected:         { icon: 'fa-circle-check',  color: '#22c55e', spin: false, label: `Da phat hien the: ${uid}`, btnText: '<i class="fa-solid fa-rss"></i> Quet lai' },
    error:            { icon: 'fa-circle-xmark',  color: '#ef4444', spin: false, label: 'Khong doc duoc the. Thu lai hoac nhap thu cong.', btnText: '<i class="fa-solid fa-rss"></i> Thu lai' },
    unsupported:      { icon: 'fa-mobile-screen-button', color: '#f59e0b', spin: false, label: 'Trinh duyet chua ho tro NFC. Vui long nhap ma the thu cong.', btnText: null },
    permission_denied:{ icon: 'fa-lock',          color: '#ef4444', spin: false, label: 'Quyen NFC bi tu choi. Kiem tra cai dat trinh duyet.', btnText: '<i class="fa-solid fa-rss"></i> Thu lai' }
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
