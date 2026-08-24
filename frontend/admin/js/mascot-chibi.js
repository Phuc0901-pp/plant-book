/**
 * admin/js/mascot-chibi.js - Advanced Multi-State Chibi Plant Assistant ("Bé Mầm AgTech - Giám Sát Vận Hành")
 * Thiết kế Icon Cây Trồng Chibi 3D Chuyên Biệt Cho Quản Trị Hệ Thống Tanbao Corp
 */

let _adminMascotState = 'admin_optimal'; // admin_optimal, admin_notify, admin_alert, admin_database, admin_weather, admin_night

const ADMIN_MASCOT_STATES = {
  admin_optimal: {
    title: 'Hệ Thống Ổn Định',
    category: 'Vận hành',
    badge: '100% Hoạt động',
    badgeColor: '#10b981',
    badgeBg: '#ecfdf5',
    eyes: '^^',
    mouth: 'ᴗ',
    speech: 'Xin chào Admin! Toàn bộ máy chủ CSDL, trạm IoT và bản đồ GIS đang hoạt động hoàn hảo 100%! ✨',
    tip: 'Tất cả các trạm quan trắc IoT gửi dữ liệu định kỳ đều đặn.'
  },
  admin_notify: {
    title: 'Có Thông Báo Mới',
    category: 'Thông báo',
    badge: 'Tin mới cần duyệt',
    badgeColor: '#0284c7',
    badgeBg: '#f0f9ff',
    eyes: '★.★',
    mouth: 'o',
    speech: 'Admin ơi! Nông hộ vừa gửi nhật ký canh tác mới và có cập nhật dữ liệu kho vật tư cần xem xét! 🔔',
    tip: 'Khuyến nghị: Mở tab "Cơ sở dữ liệu" hoặc "Quản trị Chi phí" để kiểm tra.'
  },
  admin_alert: {
    title: 'CẢNH BÁO HỆ THỐNG',
    category: 'Cảnh báo',
    badge: 'Nguy cơ khẩn cấp!',
    badgeColor: '#ef4444',
    badgeBg: '#fef2f2',
    eyes: '⊙.⊙',
    mouth: '△',
    speech: 'CẢNH BÁO: Phát hiện 2 trạm IoT đất bị mất kết nối hoặc có cây trồng báo dịch hại bùng phát! 🚨⚠️',
    tip: 'Khuyến nghị: Kiểm tra ngay mục "Thiết bị IoT" và "Danh sách cây" để phân bổ xử lý.'
  },
  admin_database: {
    title: 'Giám Sát CSDL PostgreSQL',
    category: 'Hệ thống',
    badge: 'Schema tối ưu',
    badgeColor: '#8b5cf6',
    badgeBg: '#faf5ff',
    eyes: '◕.◕',
    mouth: 'ᴗ',
    speech: 'Em đang soi chiếu cấu trúc bảng CSDL & kiểm tra log kiểm toán, không có lỗi phân mảnh hay rò rỉ dữ liệu! 🔍💾',
    tip: 'Khuyến nghị: Tab "Kiểm tra CSDL" sẵn sàng để truy vấn sâu.'
  },
  admin_weather: {
    title: 'Cảnh Báo Khí Tượng Vùng',
    category: 'Khí tượng',
    badge: 'Dự báo mưa dông',
    badgeColor: '#3b82f6',
    badgeBg: '#eff6ff',
    eyes: '•.•',
    mouth: 'o',
    speech: 'Radar khí tượng Open-Meteo báo dông lốc sắp quét qua khu vực các trang trại trọng điểm phía Nam! 🌧️☂️',
    tip: 'Khuyến nghị: Phát cảnh báo khẩn đến các tài khoản nông hộ trong vùng ảnh hưởng.'
  },
  admin_night: {
    title: 'Trực Vận Hành Ca Đêm',
    category: 'Trực đêm',
    badge: 'Tự động 24/7',
    badgeColor: '#6b21a8',
    badgeBg: '#faf5ff',
    eyes: '--',
    mouth: 'u',
    speech: 'Hệ thống tự động trực đêm 24/7 an toàn. Chúc Admin buổi tối vui vẻ và an tâm nghỉ ngơi! 🌙💤',
    tip: 'Cronjob sao lưu dữ liệu tự động kích hoạt lúc 02:00 sáng.'
  }
};

function initAdminChibiMascot() {
  let mascotContainer = document.getElementById('admin-chibi-mascot-widget');
  if (!mascotContainer) {
    mascotContainer = document.createElement('div');
    mascotContainer.id = 'admin-chibi-mascot-widget';
    mascotContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      pointer-events: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      user-select: none;
    `;
    document.body.appendChild(mascotContainer);
  }

  // Inject 3D keyframe animations
  if (!document.getElementById('admin-chibi-mascot-style')) {
    const style = document.createElement('style');
    style.id = 'admin-chibi-mascot-style';
    style.textContent = `
      @keyframes mascot-idle {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        50% { transform: translateY(-8px) rotate(1.5deg); }
      }
      @keyframes mascot-excited {
        0%, 100% { transform: translateY(0) scale(1); }
        25% { transform: translateY(-12px) scale(1.05) rotate(-3deg); }
        75% { transform: translateY(-6px) scale(0.98) rotate(3deg); }
      }
      @keyframes mascot-alarm {
        0%, 100% { transform: scale(1) rotate(0deg); }
        20%, 60% { transform: scale(1.08) rotate(-4deg); }
        40%, 80% { transform: scale(1.08) rotate(4deg); }
      }
      @keyframes leaf-sway {
        0%, 100% { transform: rotate(0deg); }
        50% { transform: rotate(15deg); }
      }
      @keyframes siren-flash {
        0%, 100% { opacity: 1; filter: drop-shadow(0 0 10px #ef4444); }
        50% { opacity: 0.3; filter: none; }
      }
      @keyframes bell-ring {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-20deg); }
        75% { transform: rotate(20deg); }
      }
      .admin-chibi-avatar-3d {
        cursor: pointer;
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .admin-chibi-avatar-3d:hover {
        transform: scale(1.12) translateY(-6px) !important;
      }
      .admin-chibi-chip {
        transition: all 0.2s ease;
      }
      .admin-chibi-chip:hover {
        transform: translateY(-2px);
        filter: brightness(1.08);
      }
    `;
    document.head.appendChild(style);
  }

  renderAdminMascot();
}

function setAdminMascotState(stateKey, customSpeech = null) {
  if (ADMIN_MASCOT_STATES[stateKey]) {
    _adminMascotState = stateKey;
  }
  renderAdminMascot(customSpeech);
}

function _renderAdminMascotSVG(preset) {
  const isAlert = _adminMascotState === 'admin_alert';
  const isNotify = _adminMascotState === 'admin_notify';
  const isDb = _adminMascotState === 'admin_database';
  const isWeather = _adminMascotState === 'admin_weather';
  const isNight = _adminMascotState === 'admin_night';

  const bodyGradient = isAlert 
    ? ['#f87171', '#ef4444', '#b91c1c']
    : (isNight 
        ? ['#a78bfa', '#8b5cf6', '#6d28d9'] 
        : (isDb ? ['#38bdf8', '#0284c7', '#0369a1'] : ['#4ade80', '#22c55e', '#15803d']));

  return `
    <svg width="105" height="115" viewBox="0 0 100 110" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 10px 18px rgba(0,0,0,0.25));">
      <defs>
        <!-- 3D Spherical Gradients -->
        <radialGradient id="adminMascotBodyGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="${bodyGradient[0]}" />
          <stop offset="60%" stop-color="${bodyGradient[1]}" />
          <stop offset="100%" stop-color="${bodyGradient[2]}" />
        </radialGradient>
        
        <radialGradient id="adminSproutGrad" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#86efac" />
          <stop offset="100%" stop-color="#16a34a" />
        </radialGradient>
      </defs>

      <!-- Head Sprout Leaves -->
      <g style="transform-origin: 50px 32px; animation: leaf-sway 2s infinite ease-in-out;">
        <path d="M50 30 C42 12 25 18 32 30 C38 40 48 35 50 30Z" fill="url(#adminSproutGrad)" />
        <path d="M50 30 C58 12 75 18 68 30 C62 40 52 35 50 30Z" fill="url(#adminSproutGrad)" />
        <path d="M50 30 Q50 20 48 16" stroke="#15803d" stroke-width="2.5" stroke-linecap="round" />
      </g>

      <!-- Flashing Siren (Alert state) -->
      ${isAlert ? `
        <g style="animation: siren-flash 0.6s infinite alternate;">
          <rect x="42" y="10" width="16" height="12" rx="4" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" />
          <polygon points="50,4 44,10 56,10" fill="#dc2626" />
          <circle cx="50" cy="16" r="3" fill="#fef08a" />
        </g>
      ` : ''}

      <!-- Notification Bell (Notify state) -->
      ${isNotify ? `
        <g style="transform-origin: 75px 25px; animation: bell-ring 1s infinite ease-in-out;">
          <path d="M75 18 C71 18 68 22 68 26 L66 30 L84 30 L82 26 C82 22 79 18 75 18 Z" fill="#fbbf24" stroke="#d97706" stroke-width="1.5" />
          <circle cx="75" cy="32" r="2.5" fill="#d97706" />
        </g>
      ` : ''}

      <!-- Radar Weather Cloud (Weather state) -->
      ${isWeather ? `
        <path d="M70 18 C64 18 60 23 60 28 L86 28 C86 23 82 18 70 18 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5" />
        <line x1="66" y1="31" x2="63" y2="36" stroke="#0284c7" stroke-width="1.5" stroke-linecap="round" />
        <line x1="74" y1="31" x2="71" y2="36" stroke="#0284c7" stroke-width="1.5" stroke-linecap="round" />
        <line x1="82" y1="31" x2="79" y2="36" stroke="#0284c7" stroke-width="1.5" stroke-linecap="round" />
      ` : ''}

      <!-- 3D Mascot Body -->
      <circle cx="50" cy="65" r="32" fill="url(#adminMascotBodyGrad)" stroke="#ffffff" stroke-width="3" />

      <!-- High-tech Admin Glasses (Optimal state) -->
      ${!isAlert && !isNight ? `
        <rect x="26" y="56" width="20" height="14" rx="4" fill="rgba(15,23,42,0.75)" stroke="#38bdf8" stroke-width="1.5" />
        <rect x="54" y="56" width="20" height="14" rx="4" fill="rgba(15,23,42,0.75)" stroke="#38bdf8" stroke-width="1.5" />
        <line x1="46" y1="62" x2="54" y2="62" stroke="#38bdf8" stroke-width="2" />
      ` : ''}

      <!-- Cute Anime Rosy Cheeks -->
      <ellipse cx="32" cy="74" rx="5" ry="3.5" fill="#f43f5e" opacity="0.65" />
      <ellipse cx="68" cy="74" rx="5" ry="3.5" fill="#f43f5e" opacity="0.65" />

      <!-- Cute Expressive Eyes -->
      <text x="50" y="65" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="6">${preset.eyes}</text>

      <!-- Cute Mouth -->
      <text x="50" y="78" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">${preset.mouth}</text>

      <!-- Magnifying Glass for Database state -->
      ${isDb ? `
        <circle cx="78" cy="72" r="10" fill="none" stroke="#e2e8f0" stroke-width="3" />
        <line x1="85" y1="79" x2="94" y2="88" stroke="#cbd5e1" stroke-width="3.5" stroke-linecap="round" />
        <circle cx="78" cy="72" r="7" fill="rgba(56,189,248,0.3)" />
      ` : ''}

      <!-- Admin Badge / Mini Shield -->
      <polygon points="50,88 44,83 44,79 56,79 56,83" fill="#fbbf24" stroke="#d97706" stroke-width="1" />

      <!-- Tiny 3D Feet -->
      <ellipse cx="40" cy="96" rx="6" ry="4" fill="#0f172a" stroke="#ffffff" stroke-width="1.5" />
      <ellipse cx="60" cy="96" rx="6" ry="4" fill="#0f172a" stroke="#ffffff" stroke-width="1.5" />
    </svg>
  `;
}

function renderAdminMascot(customSpeech = null) {
  const container = document.getElementById('admin-chibi-mascot-widget');
  if (!container) return;

  const preset = ADMIN_MASCOT_STATES[_adminMascotState] || ADMIN_MASCOT_STATES.admin_optimal;
  const speechText = customSpeech || preset.speech;

  container.innerHTML = `
    <!-- Multi-State Admin Interactive Dialogue Box -->
    <div id="admin-mascot-speech-bubble" style="
      background: #ffffff;
      color: #0f172a;
      border: 2px solid ${preset.badgeColor};
      border-radius: 20px;
      padding: 14px 18px;
      font-size: 12.5px;
      font-weight: 700;
      line-height: 1.5;
      max-width: 330px;
      box-shadow: 0 16px 36px -6px rgba(0,0,0,0.22), 0 8px 16px -4px rgba(0,0,0,0.1);
      margin-bottom: 10px;
      margin-right: 12px;
      position: relative;
      animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    ">
      <!-- Header Badge -->
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;">
        <span style="background:${preset.badgeColor}; color:white; font-size:11px; font-weight:800; padding:3px 10px; border-radius:14px; display:inline-flex; align-items:center; gap:5px; box-shadow:0 2px 6px rgba(0,0,0,0.15);">
          🛡️ ${preset.title}
        </span>
        <span style="font-size:11.5px; color:${preset.badgeColor}; background:${preset.badgeBg}; font-weight:800; padding:2px 8px; border-radius:10px; border:1px solid ${preset.badgeColor};">
          ${preset.badge}
        </span>
      </div>
      
      <!-- Dialogue Body -->
      <div style="color:#1e293b; margin-bottom:8px; font-weight:600;">${speechText}</div>
      
      <!-- Admin Actionable Tip -->
      <div style="font-size:11px; color:#64748b; background:#f8fafc; border-radius:8px; padding:6px 10px; margin-bottom:10px; border-left:3px solid ${preset.badgeColor}; font-weight:600;">
        ⚙️ ${preset.tip}
      </div>

      <!-- Quick Multi-State Selector Toolbar -->
      <div style="border-top:1px solid #f1f5f9; padding-top:8px;">
        <div style="font-size:10.5px; color:#94a3b8; font-weight:700; margin-bottom:5px;">TRẠNG THÁI QUẢN TRỊ VIÊN:</div>
        <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:space-between;">
          <button class="admin-chibi-chip" onclick="setAdminMascotState('admin_optimal')" title="Hệ thống tối ưu" style="background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding:3px 7px; cursor:pointer; font-size:11px; font-weight:700; color:#047857;">🌱 Ổn định</button>
          <button class="admin-chibi-chip" onclick="setAdminMascotState('admin_notify')" title="Có thông báo mới" style="background:#f0f9ff; border:1px solid #0284c7; border-radius:8px; padding:3px 7px; cursor:pointer; font-size:11px; font-weight:700; color:#0284c7;">🔔 Thông báo</button>
          <button class="admin-chibi-chip" onclick="setAdminMascotState('admin_alert')" title="Cảnh báo khẩn" style="background:#fef2f2; border:1px solid #ef4444; border-radius:8px; padding:3px 7px; cursor:pointer; font-size:11px; font-weight:700; color:#b91c1c;">🚨 Cảnh báo</button>
          <button class="admin-chibi-chip" onclick="setAdminMascotState('admin_database')" title="Kiểm tra CSDL" style="background:#faf5ff; border:1px solid #8b5cf6; border-radius:8px; padding:3px 7px; cursor:pointer; font-size:11px; font-weight:700; color:#6d28d9;">🔍 CSDL</button>
          <button class="admin-chibi-chip" onclick="setAdminMascotState('admin_weather')" title="Khí tượng dông lốc" style="background:#eff6ff; border:1px solid #3b82f6; border-radius:8px; padding:3px 7px; cursor:pointer; font-size:11px; font-weight:700; color:#1e40af;">🌧️ Khí tượng</button>
          <button class="admin-chibi-chip" onclick="setAdminMascotState('admin_night')" title="Trực đêm 24/7" style="background:#faf5ff; border:1px solid #6b21a8; border-radius:8px; padding:3px 7px; cursor:pointer; font-size:11px; font-weight:700; color:#581c87;">🌙 Trực đêm</button>
        </div>
      </div>

      <!-- Triangle Pointer -->
      <div style="
        position: absolute;
        bottom: -10px;
        right: 48px;
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-top: 10px solid #ffffff;
      "></div>
    </div>

    <!-- 3D Chibi Plant Mascot Character -->
    <div onclick="onAdminMascotClick()" class="admin-chibi-avatar-3d" title="Bấm vào Bé Mầm để nghe báo cáo!" style="
      display: flex;
      align-items: flex-end;
      justify-content: center;
      animation: ${_adminMascotState === 'admin_alert' ? 'mascot-alarm 0.5s infinite' : (_adminMascotState === 'admin_notify' ? 'mascot-excited 1.5s infinite' : 'mascot-idle 2.5s infinite ease-in-out')};
    ">
      ${_renderAdminMascotSVG(preset)}
    </div>
  `;
}

function onAdminMascotClick() {
  const greetings = [
    'Chào Admin! Bé Mầm đang giám sát 24/7 toàn bộ cụm máy chủ và mạng lưới IoT! 🛡️✨',
    'Các cảm biến đo ẩm đất đa tầng 10-20-50cm đang truyền số liệu rất ổn định! 📡',
    'Cần kiểm tra nhanh các lô cây đang ủ bệnh? Admin mở mục "Danh sách cây" nhé! 🌿',
    'CSDL PostgreSQL đang vận hành tối ưu, chỉ số phản hồi dưới 15ms! 🚀',
    'Bé Mầm AgTech - Trợ lý giám sát & quản trị thông minh cho Tanbao Corp! 🧑‍💻🌱'
  ];
  const randomGreet = greetings[Math.floor(Math.random() * greetings.length)];
  
  const avatar = document.querySelector('.admin-chibi-avatar-3d');
  if (avatar) {
    avatar.style.transform = 'scale(1.25) translateY(-14px) rotate(8deg)';
    setTimeout(() => {
      avatar.style.transform = 'scale(1) translateY(0) rotate(0deg)';
    }, 400);
  }

  setAdminMascotState(_adminMascotState, randomGreet);
}

window.onAdminMascotClick = onAdminMascotClick;
window.setAdminMascotState = setAdminMascotState;
window.initAdminChibiMascot = initAdminChibiMascot;
