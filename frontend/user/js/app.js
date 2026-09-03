/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   app.js — Entry point (Slim)
   Imports tất cả module và expose ra window cho HTML inline handlers
   ═══════════════════════════════════════════════════════════════ */
// Passive Event Listeners Patch for 60fps smooth scrolling
(function() {
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (['touchstart', 'touchmove', 'wheel', 'mousewheel'].includes(type)) {
      if (typeof options === 'boolean') {
        options = { capture: options, passive: true };
      } else if (typeof options === 'object' && options !== null && options.passive === undefined) {
        options = Object.assign({}, options, { passive: true });
      } else if (options === undefined) {
        options = { passive: true };
      }
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
})();

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
import { initWeatherClockWidget, refreshDeviceWeather } from './modules/weather-clock.js';
import { animateValue, triggerPageCountUpAnimations } from './modules/countup.js';
import { initChibiMascot, onMascotClick, setMascotState } from './modules/mascot-chibi.js';
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
  } else if (type === 'vietgap') {
    titleEl.innerHTML = '<i class="fa-solid fa-shield-halved" style="color:#6ee7b7"></i> Tiêu Chuẩn VietGAP & Quản Lý PHI';
    imgEl.src = '/user/img/gis_contour_map.jpg';
    imgEl.style.objectFit = 'cover';
    headerEl.style.background = 'linear-gradient(135deg, #064e3b, #047857)';
    contentEl.innerHTML = `
      <h4 style="margin:0 0 10px 0; font-size:16px; color:#0f172a; font-weight:800;">Bộ Tiêu Chuẩn VietGAP 100% & Quản Lý Cách Ly PHI</h4>
      <p style="margin-bottom:12px; color:#475569;">
        Giải pháp phần mềm tự động hóa toàn bộ quy trình kiểm soát an toàn vệ sinh thực phẩm theo tiêu chuẩn VietGAP:
      </p>
      <ul style="margin:0 0 16px 0; padding-left:20px; color:#334155; line-height:1.7;">
        <li><strong>Tự động quản lý PHI:</strong> Khi phun thuốc BVTV, hệ thống tự động tính ngày hết hạn cách ly và khóa thu hoạch đối với từng gốc cây.</li>
        <li><strong>Cảnh báo vi phạm đỏ:</strong> Cảnh báo ngăn chặn thu hoạch sớm trong thời gian cách ly và tự động ghi nhận cờ vi phạm chất lượng.</li>
        <li><strong>Mã Lô Nông Sản Tự Động:</strong> Tự động sinh mã lô theo cú pháp [Mã PUC]-[YYYYMMDD]-[Mã Cây] phục vụ dán tem QR truy xuất.</li>
        <li><strong>Ghi nhận Người & Dụng cụ:</strong> Đầy đủ thông tin người thực hiện và thiết bị phục vụ kiểm tra chứng nhận.</li>
      </ul>
      <div style="background:#ecfdf5; border-left:4px solid #059669; padding:10px 14px; font-size:13px; color:#065f46; border-radius:0 8px 8px 0; font-weight:600;">
        💡 Hỗ trợ hồ sơ số hóa 100% chuẩn bị cho các đợt đánh giá chứng nhận VietGAP / GlobalGAP.
      </div>
    `;
  } else if (type === 'voice') {
    titleEl.innerHTML = '<i class="fa-solid fa-microphone-lines" style="color:#93c5fd"></i> AI Voice-to-Text Nông Nghiệp';
    imgEl.src = '/user/img/gis_contour_map.jpg';
    imgEl.style.objectFit = 'cover';
    headerEl.style.background = 'linear-gradient(135deg, #1e3a8a, #3b82f6)';
    contentEl.innerHTML = `
      <h4 style="margin:0 0 10px 0; font-size:16px; color:#0f172a; font-weight:800;">Nhận Diện Giọng Nói Nông Nghiệp Bằng AI</h4>
      <p style="margin-bottom:12px; color:#475569;">
        Công nghệ xử lý ngôn ngữ tự nhiên tối ưu riêng cho phương ngữ nông dân 3 miền:
      </p>
      <ul style="margin:0 0 16px 0; padding-left:20px; color:#334155; line-height:1.7;">
        <li><strong>Ghi sổ rảnh tay ngoài vườn:</strong> Không cần gõ phím khi tay đang dính bùn đất hay đeo găng tay.</li>
        <li><strong>Trích xuất dữ liệu thông minh:</strong> Tự động nhận diện hoạt động (Tưới nước, Bón phân NPK, Phun thuốc) và số lượng.</li>
        <li><strong>Tự động điền biểu mẫu:</strong> Khớp nối tên vật tư có sẵn trong kho nông hộ.</li>
      </ul>
      <div style="background:#eff6ff; border-left:4px solid #2563eb; padding:10px 14px; font-size:13px; color:#1e40af; border-radius:0 8px 8px 0; font-weight:600;">
        💡 Bấm nút Microphone ở thanh tiêu đề hoặc trong modal nhật ký để trải nghiệm ngay.
      </div>
    `;
  } else if (type === 'cost') {
    titleEl.innerHTML = '<i class="fa-solid fa-calculator" style="color:#fed7aa"></i> Kế Toán Chi Phí Agri-ERP';
    imgEl.src = '/user/img/gis_contour_map.jpg';
    imgEl.style.objectFit = 'cover';
    headerEl.style.background = 'linear-gradient(135deg, #7c2d12, #ea580c)';
    contentEl.innerHTML = `
      <h4 style="margin:0 0 10px 0; font-size:16px; color:#0f172a; font-weight:800;">Hạch Toán Chi Phí Canh Tác Chuẩn Agri-ERP</h4>
      <p style="margin-bottom:12px; color:#475569;">
        Kiểm soát dòng tiền và chi phí sản xuất từng vụ mùa theo tiêu chuẩn ERP doanh nghiệp:
      </p>
      <ul style="margin:0 0 16px 0; padding-left:20px; color:#334155; line-height:1.7;">
        <li><strong>Quản lý 4 nhóm chi phí:</strong> Bón phân, Phun thuốc, Tiền nước m³ và Chi phí Nhân công.</li>
        <li><strong>Tự động trừ kho & tính giá vốn:</strong> Quy đổi giá theo từng gram/ml và trừ tồn kho ngay khi ghi nhật ký.</li>
        <li><strong>Báo cáo Lợi nhuận Ròng:</strong> Tự động so sánh Doanh thu thu hoạch với Tổng chi phí vật tư đã chi.</li>
      </ul>
      <div style="background:#fff7ed; border-left:4px solid #ea580c; padding:10px 14px; font-size:13px; color:#9a3412; border-radius:0 8px 8px 0; font-weight:600;">
        💡 Quản lý tài chính rõ ràng, minh bạch giúp tối ưu hóa lợi nhuận mùa vụ.
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
  const btnVietgap = document.getElementById('btn-wiki-sub-vietgap');

  const paneAdv = document.getElementById('wiki-subtab-advanced');
  const paneGuide = document.getElementById('wiki-subtab-guide');
  const paneVietgap = document.getElementById('wiki-subtab-vietgap');

  // Reset all panes
  if (paneAdv) paneAdv.style.display = 'none';
  if (paneGuide) paneGuide.style.display = 'none';
  if (paneVietgap) paneVietgap.style.display = 'none';

  // Reset all buttons
  const resetBtn = (btn) => {
    if (!btn) return;
    btn.className = 'wiki-subtab';
    btn.style.background = '#ffffff';
    btn.style.color = '#334155';
    btn.style.border = '1.5px solid #cbd5e1';
    btn.style.boxShadow = 'none';
  };

  const activateBtn = (btn) => {
    if (!btn) return;
    btn.className = 'wiki-subtab active';
    btn.style.background = '#059669';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.boxShadow = '0 4px 12px rgba(5,150,105,0.25)';
  };

  resetBtn(btnAdv);
  resetBtn(btnGuide);
  resetBtn(btnVietgap);

  if (tabName === 'guide') {
    if (paneGuide) paneGuide.style.display = 'block';
    activateBtn(btnGuide);
  } else if (tabName === 'vietgap') {
    if (paneVietgap) paneVietgap.style.display = 'block';
    activateBtn(btnVietgap);
  } else {
    if (paneAdv) paneAdv.style.display = 'block';
    activateBtn(btnAdv);
  }
};

window.searchGuideContent = function(query) {
  const q = (query || '').trim().toLowerCase();
  const cards = document.querySelectorAll('.guide-searchable-card');

  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    if (!q || text.includes(q)) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
};

window.filterGuideTopics = function(topic, btnEl) {
  // Update button active styles
  const allBtns = document.querySelectorAll('.guide-filter-btn');
  allBtns.forEach(btn => {
    btn.classList.remove('active');
    btn.style.background = '#ffffff';
    btn.style.color = '#334155';
    btn.style.border = '1px solid #cbd5e1';
    btn.style.boxShadow = 'none';
    btn.style.fontWeight = '700';
  });

  if (btnEl) {
    btnEl.classList.add('active');
    btnEl.style.background = '#059669';
    btnEl.style.color = 'white';
    btnEl.style.border = 'none';
    btnEl.style.boxShadow = '0 2px 8px rgba(5,150,105,0.2)';
    btnEl.style.fontWeight = '800';
  }

  // Filter cards
  const cards = document.querySelectorAll('.guide-card');
  cards.forEach(card => {
    const cardTopic = card.getAttribute('data-guide-topic');
    if (topic === 'all' || cardTopic === topic) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
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

window.refreshDeviceWeather = refreshDeviceWeather;
window.initWeatherClockWidget = initWeatherClockWidget;
window.animateValue          = animateValue;
window.triggerPageCountUpAnimations = triggerPageCountUpAnimations;
window.initChibiMascot      = initChibiMascot;
window.onMascotClick        = onMascotClick;
window.setMascotState       = setMascotState;

// Initialize Live Clock & GPS Weather Widget
try {
  initWeatherClockWidget();
} catch (err) {
  console.warn('[App] Weather Clock Widget init warning:', err);
}

// Initialize 3D Chibi Plant Mascot Assistant
try {
  initChibiMascot();
} catch (err) {
  console.warn('[App] Chibi Mascot init warning:', err);
}

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

