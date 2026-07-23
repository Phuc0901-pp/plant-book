/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   app.js — Entry point (Slim)
   Imports tất cả module và expose ra window cho HTML inline handlers
   ═══════════════════════════════════════════════════════════════ */

// ── Core ──────────────────────────────────────────────────────
import { showPage, toggleMobileSidebar, closeMobileSidebar } from './core/router.js';

// ── Modules ───────────────────────────────────────────────────
import { loadUserDashboard }          from './modules/dashboard.js';
import { filterUserPlants }           from './modules/plants.js';
import { filterUserLogs }             from './modules/logs.js';
import { renderUserReminders, quickCare, quickCareAll } from './modules/reminders.js';
import { openCareModal, closeCareModal, saveCareLog, onCareLogTypeChange } from './modules/care-modal.js?v=2.5.0';
import { onCareMediaSelected, openLightbox } from './modules/media.js';
import { loadUserSettings, saveUserProfile, changeUserPassword, uploadUserAvatar } from './modules/settings.js';
import { openNfcModal, closeNfcModal, startNfcScan, saveNfcUidManually, deactivateNfcTag } from './modules/nfc.js';
import { togglePlantMenu, closePlantMenu } from './modules/plants.js';
import './supplies.js?v=2.5.0';

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

// Register PWA service worker for offline support and mobile install option
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/user/sw.js')
      .then(reg => console.log('✅ ServiceWorker registered successfully:', reg.scope))
      .catch(err => console.warn('❌ ServiceWorker registration failed:', err));
  });
}
