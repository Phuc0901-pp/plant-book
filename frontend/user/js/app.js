/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   app.js — Entry point (Slim)
   Imports tất cả module và expose ra window cho HTML inline handlers
   ═══════════════════════════════════════════════════════════════ */

// ── Core ──────────────────────────────────────────────────────
import { showPage, toggleMobileSidebar, closeMobileSidebar } from './core/router.js';

// ── Modules ───────────────────────────────────────────────────
import { loadUserDashboard }          from './modules/dashboard.js';
import { filterUserPlants, openSelfInitFarmModal, closeSelfInitFarmModal, getDeviceGPSPosition, submitSelfInitFarm, selectUserFarm, openEditFarmModal, closeEditFarmModal, getEditDeviceGPSPosition, submitEditFarm, renderUserFarmsGrid } from './modules/plants.js';

window.openSelfInitFarmModal = openSelfInitFarmModal;
window.closeSelfInitFarmModal = closeSelfInitFarmModal;
window.getDeviceGPSPosition = getDeviceGPSPosition;
window.submitSelfInitFarm = submitSelfInitFarm;

window.selectUserFarm = selectUserFarm;
window.openEditFarmModal = openEditFarmModal;
window.closeEditFarmModal = closeEditFarmModal;
window.getEditDeviceGPSPosition = getEditDeviceGPSPosition;
window.submitEditFarm = submitEditFarm;
window.renderUserFarmsGrid = renderUserFarmsGrid;


window.switchWikiSubtab = function(tabName) {
  const btnAdv = document.getElementById('btn-wiki-sub-advanced');
  const btnGuide = document.getElementById('btn-wiki-sub-guide');
  const paneAdv = document.getElementById('wiki-subtab-advanced');
  const paneGuide = document.getElementById('wiki-subtab-guide');

  if (tabName === 'guide') {
    if (paneAdv) paneAdv.style.display = 'none';
    if (paneGuide) paneGuide.style.display = 'block';

    if (btnAdv) {
      btnAdv.className = 'wiki-subtab';
      btnAdv.style.background = '#ffffff';
      btnAdv.style.color = '#334155';
      btnAdv.style.border = '1.5px solid #cbd5e1';
      btnAdv.style.boxShadow = 'none';
    }
    if (btnGuide) {
      btnGuide.className = 'wiki-subtab active';
      btnGuide.style.background = '#059669';
      btnGuide.style.color = 'white';
      btnGuide.style.border = 'none';
      btnGuide.style.boxShadow = '0 4px 12px rgba(5,150,105,0.25)';
    }
  } else {
    if (paneAdv) paneAdv.style.display = 'block';
    if (paneGuide) paneGuide.style.display = 'none';

    if (btnAdv) {
      btnAdv.className = 'wiki-subtab active';
      btnAdv.style.background = '#059669';
      btnAdv.style.color = 'white';
      btnAdv.style.border = 'none';
      btnAdv.style.boxShadow = '0 4px 12px rgba(5,150,105,0.25)';
    }
    if (btnGuide) {
      btnGuide.className = 'wiki-subtab';
      btnGuide.style.background = '#ffffff';
      btnGuide.style.color = '#334155';
      btnGuide.style.border = '1.5px solid #cbd5e1';
      btnGuide.style.boxShadow = 'none';
    }
  }
};

import { filterUserLogs }             from './modules/logs.js';
import { renderUserReminders, quickCare, quickCareAll } from './modules/reminders.js';
import { openCareModal, closeCareModal, saveCareLog, onCareLogTypeChange, startVoiceInput } from './modules/care-modal.js?v=2.8.0';
import { onCareMediaSelected, openLightbox } from './modules/media.js';
import { loadUserSettings, saveUserProfile, changeUserPassword, uploadUserAvatar } from './modules/settings.js';
import { openNfcModal, closeNfcModal, startNfcScan, saveNfcUidManually, deactivateNfcTag } from './modules/nfc.js';
import { togglePlantMenu, closePlantMenu } from './modules/plants.js';
import './supplies.js?v=2.8.0';

// ── Expose to Window (for HTML inline onclick="..." handlers) ──
// Cần thiết vì ES Modules có scope riêng, không tự trở thành global.
window.showPage             = showPage;
window.toggleMobileSidebar  = toggleMobileSidebar;
window.closeMobileSidebar   = closeMobileSidebar;

window.loadUserDashboard    = loadUserDashboard;

window.filterUserPlants     = filterUserPlants;
window.filterUserLogs       = filterUserLogs;

window.renderUserReminders  = renderUserReminders;
window.quickCare            = quickCare;
window.quickCareAll         = quickCareAll;

window.openCareModal        = openCareModal;
window.closeCareModal       = closeCareModal;
window.saveCareLog          = saveCareLog;
window.onCareLogTypeChange  = onCareLogTypeChange;
window.startVoiceInput      = startVoiceInput;


window.onCareMediaSelected  = onCareMediaSelected;
window.openLightbox         = openLightbox;

window.loadUserSettings     = loadUserSettings;
window.saveUserProfile      = saveUserProfile;
window.changeUserPassword   = changeUserPassword;
window.uploadUserAvatar     = uploadUserAvatar;

window.openNfcModal         = openNfcModal;
window.closeNfcModal        = closeNfcModal;
window.startNfcScan         = startNfcScan;
window.saveNfcUidManually   = saveNfcUidManually;
window.deactivateNfcTag     = deactivateNfcTag;

window.togglePlantMenu      = togglePlantMenu;
window.closePlantMenu       = closePlantMenu;

// ── Field UX Mode (Outdoor Sunlight Mode) ───────────────────
window.toggleFieldMode = function(forceState) {
  const isField = typeof forceState === 'boolean' ? forceState : !document.body.classList.contains('field-mode');
  document.body.classList.toggle('field-mode', isField);
  localStorage.setItem('pb_field_mode', isField ? 'true' : 'false');
  const btn = document.getElementById('btn-field-mode');
  if (btn) {
    btn.innerHTML = isField 
      ? '<i class="fa-solid fa-cloud-sun" style="color:#10b981;"></i> Chế độ chuẩn'
      : '<i class="fa-solid fa-sun" style="color:#f59e0b;"></i> Chế độ ngoài vườn';
  }
};

// Initialize Field Mode preference on load
if (localStorage.getItem('pb_field_mode') === 'true') {
  window.toggleFieldMode(true);
}

// Register PWA service worker for offline support and mobile install option
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/user/sw.js')
      .then(reg => console.log('✅ ServiceWorker registered successfully:', reg.scope))
      .catch(err => console.warn('❌ ServiceWorker registration failed:', err));
  });
}

