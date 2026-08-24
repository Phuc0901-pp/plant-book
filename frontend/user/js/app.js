/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   app.js — Entry point (Slim)
   Imports tất cả module và expose ra window cho HTML inline handlers
   ═══════════════════════════════════════════════════════════════ */

// ── Core ──────────────────────────────────────────────────────
import { showPage, toggleMobileSidebar, closeMobileSidebar } from './core/router.js';

// ── Modules ───────────────────────────────────────────────────
import './modules/notifications.js';
import { loadUserDashboard }          from './modules/dashboard.js';
import { filterUserPlants, openSelfInitFarmModal, closeSelfInitFarmModal, getDeviceGPSPosition, submitSelfInitFarm, selectUserFarm, openEditFarmModal, closeEditFarmModal, getEditDeviceGPSPosition, submitEditFarm, deleteUserFarm, renderUserFarmsGrid, openFarmDetailView, closeFarmDetailView, getActiveFarm, getFarmsCache, togglePlantMenu, closePlantMenu } from './modules/plants.js';
import { filterUserLogs }             from './modules/logs.js';
import { renderUserReminders, quickCare, quickCareAll } from './modules/reminders.js';
import { openCareModal, closeCareModal, saveCareLog, onCareLogTypeChange, startVoiceInput } from './modules/care-modal.js?v=2.8.0';
import { onCareMediaSelected, openLightbox } from './modules/media.js';
import { 
  loadUserSettings, saveUserProfile, changeUserPassword, uploadUserAvatar, 
  switchSettingsSubtab, loadThresholdRules, openAddThresholdRuleModal, 
  closeThresholdRuleModal, saveThresholdRule, addConditionRow, 
  removeConditionRow, onConditionMetricChange, updateRuleConditionsSummary, 
  getConditionsFromUI, onNotifyTimeTypeChange, onConditionDeviceChange, 
  onCustomUnitInput 
} from './modules/settings.js';
import { openNfcModal, closeNfcModal, startNfcScan, saveNfcUidManually, deactivateNfcTag } from './modules/nfc.js';
import './supplies.js?v=2.8.0';

window.openSelfInitFarmModal = openSelfInitFarmModal;
window.closeSelfInitFarmModal = closeSelfInitFarmModal;
window.getDeviceGPSPosition = getDeviceGPSPosition;
window.submitSelfInitFarm = submitSelfInitFarm;

window.selectUserFarm = selectUserFarm;
window.openEditFarmModal = openEditFarmModal;
window.closeEditFarmModal = closeEditFarmModal;
window.getEditDeviceGPSPosition = getEditDeviceGPSPosition;
window.submitEditFarm = submitEditFarm;
window.deleteUserFarm = deleteUserFarm;
window.renderUserFarmsGrid = renderUserFarmsGrid;

window.openFarmDetailView = openFarmDetailView;
window.closeFarmDetailView = closeFarmDetailView;

window.getActiveFarm = getActiveFarm;
window.getFarmsCache = getFarmsCache;

window.openProUpgradeModal = function() {
  const modal = document.getElementById('pro-upgrade-modal');
  if (modal) modal.style.display = 'flex';
};

window.closeProUpgradeModal = function() {
  const modal = document.getElementById('pro-upgrade-modal');
  if (modal) modal.style.display = 'none';
};


window.openFeatureDetailModal = function(type) {
  const modal = document.getElementById('feature-detail-modal');
  const titleEl = document.getElementById('feature-modal-title');
  const imgEl = document.getElementById('feature-modal-img');
  const contentEl = document.getElementById('feature-modal-body-content');
  const headerEl = document.getElementById('feature-modal-header');

  if (!modal) return;

  if (type === 'gis') {
    titleEl.innerHTML = '<i class="fa-solid fa-earth-asia" style="color:#6ee7b7"></i> Bản đồ GIS Vệ tinh & 3D Contour';
    imgEl.src = '/user/img/gis_contour_map.jpg';
    imgEl.style.objectFit = 'cover';
    headerEl.style.background = 'linear-gradient(135deg, #064e3b, #047857)';
    contentEl.innerHTML = `
      <h4 style="margin:0 0 10px 0; font-size:16px; color:#0f172a; font-weight:800;">Công nghệ Bản đồ GIS Vệ tinh & Đường đồng mức 3D</h4>
      <p style="margin-bottom:12px; color:#475569;">
        Tính năng này hỗ trợ số hóa toàn bộ diện tích trang trại với độ chính xác cao:
      </p>
      <ul style="margin:0 0 16px 0; padding-left:20px; color:#334155; line-height:1.7;">
        <li><strong>Ranh giới thửa đất chuẩn xác:</strong> Vẽ ranh giới vườn, đo đạc diện tích (ha), chu vi và hiển thị chiều dài từng cạnh thực địa (AB, BC, CD...).</li>
        <li><strong>Bản đồ đường đồng mức 3D (Contour):</strong> Phủ độ cao địa hình 3D giúp tính toán độ dốc, hướng thoát nước và quy hoạch khu vực trồng trọt.</li>
        <li><strong>Định vị GPS thời gian thực:</strong> Định vị chính xác tọa độ lô vườn, liên kết trực tiếp với dữ liệu bản đồ vệ tinh Mapbox.</li>
      </ul>
      <div style="background:#f0fdf4; border-left:4px solid #059669; padding:10px 14px; font-size:13px; color:#166534; border-radius:0 8px 8px 0; font-weight:600;">
        💡 Tính năng dành cho các trang trại cần vẽ ranh giới chính xác và thiết kế bản đồ địa hình 3D.
      </div>
    `;
  } else if (type === 'nfc') {
    titleEl.innerHTML = '<i class="fa-solid fa-rss" style="color:#93c5fd"></i> Thẻ Định danh NFC & Mã QR Cây';
    imgEl.src = '/user/img/nfc_tag.png';
    imgEl.style.objectFit = 'contain';
    imgEl.style.background = '#f8fafc';
    imgEl.style.padding = '16px';
    headerEl.style.background = 'linear-gradient(135deg, #1e3a8a, #2563eb)';
    contentEl.innerHTML = `
      <h4 style="margin:0 0 10px 0; font-size:16px; color:#0f172a; font-weight:800;">Hệ thống Thẻ Định danh Chip NFC TANBAO AgTech & Mã QR</h4>
      <p style="margin-bottom:12px; color:#475569;">
        Thẻ chip NFC chống nước chống tia UV cao cấp kết hợp mã QR độc bản giúp làm bản đồ số hóa cho từng cây trồng:
      </p>
      <ul style="margin:0 0 16px 0; padding-left:20px; color:#334155; line-height:1.7;">
        <li><strong>Bản đồ số hóa cây trồng:</strong> Thẻ định danh chip NFC và mã QR độc bản gắn cố định trên từng gốc cây.</li>
        <li><strong>Ghi nhật ký 1 chạm:</strong> Chỉ cần áp điện thoại thông minh vào thẻ NFC để mở ngay nhật ký chăm sóc, bón phân, tưới nước hoặc bệnh cây thực địa.</li>
        <li><strong>Truy xuất nguồn gốc VietGAP:</strong> Khách hàng scan mã QR để xem toàn bộ lịch sử canh tác minh bạch của trái cây.</li>
      </ul>
      <div style="background:#eff6ff; border-left:4px solid #2563eb; padding:10px 14px; font-size:13px; color:#1e40af; border-radius:0 8px 8px 0; font-weight:600;">
        💡 Thẻ chip NFC cao cấp Tân Bảo AgTech sẵn sàng cung cấp và cài đặt tận nơi cho nông hộ.
      </div>
    `;
  } else if (type === 'iot') {
    titleEl.innerHTML = '<i class="fa-solid fa-microchip" style="color:#fde047"></i> Tích hợp Thiết bị IoT & Cảm biến Tự động';
    imgEl.src = '/user/img/iot_sensors.jpg';
    imgEl.style.objectFit = 'cover';
    headerEl.style.background = 'linear-gradient(135deg, #78350f, #d97706)';
    contentEl.innerHTML = `
      <h4 style="margin:0 0 10px 0; font-size:16px; color:#0f172a; font-weight:800;">Nền sinh thái IoT & Trạm cảm biến Thông minh</h4>
      <p style="margin-bottom:12px; color:#475569;">
        Mô hình tích hợp dữ liệu cảm biến đa dạng tạo nên nền sinh thái nông nghiệp tự động hóa 100%:
      </p>
      <ul style="margin:0 0 16px 0; padding-left:20px; color:#334155; line-height:1.7;">
        <li><strong>Cảm biến đất đa tầng (Soil NPK & Moisture):</strong> Tích hợp dữ liệu cảm biến đất đo liên tục độ ẩm, nhiệt độ, độ pH và dinh dưỡng NPK.</li>
        <li><strong>Trạm thời tiết thông minh (Weather Station):</strong> Tích hợp cảm biến thời tiết đo lượng mưa, hướng gió, bức xạ mặt trời và nhiệt độ môi trường.</li>
        <li><strong>Nền sinh thái đa dạng tự động:</strong> Tự động kích hoạt hệ thống tưới tiêu và điều khiển thiết bị theo thời gian thực, tiết kiệm 40% chi phí.</li>
      </ul>
      <div style="background:#fffbeb; border-left:4px solid #d97706; padding:10px 14px; font-size:13px; color:#92400e; border-radius:0 8px 8px 0; font-weight:600;">
        💡 Tích hợp trọn gói phần cứng cảm biến và van điều khiển thông minh tận vườn.
      </div>
    `;
  }

  modal.style.display = 'flex';
};

window.closeFeatureDetailModal = function() {
  const modal = document.getElementById('feature-detail-modal');
  if (modal) modal.style.display = 'none';
};





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
window.switchSettingsSubtab = switchSettingsSubtab;
window.loadThresholdRules   = loadThresholdRules;
window.openAddThresholdRuleModal = openAddThresholdRuleModal;
window.closeThresholdRuleModal = closeThresholdRuleModal;
window.saveThresholdRule    = saveThresholdRule;
window.addConditionRow       = addConditionRow;
window.removeConditionRow    = removeConditionRow;
window.onConditionMetricChange = onConditionMetricChange;
window.updateRuleConditionsSummary = updateRuleConditionsSummary;
window.getConditionsFromUI   = getConditionsFromUI;
window.onNotifyTimeTypeChange = onNotifyTimeTypeChange;
window.onConditionDeviceChange = onConditionDeviceChange;
window.onCustomUnitInput     = onCustomUnitInput;

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

