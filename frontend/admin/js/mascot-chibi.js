/**
 * admin/js/mascot-chibi.js - High-End 3D Anime Chibi Plant Mascot Engine for Admin ("Bé Mầm Giám Sát")
 * Thiết kế Đồ họa Chibi Anime Cao Cấp Đa Biểu Cảm Chuyên Biệt Quản Trị Hệ Thống
 */

let _adminMascotState = 'admin_optimal';

const ADMIN_MASCOT_STATES = {
  admin_optimal: {
    title: 'Hệ Thống Ổn Định',
    badge: '100% Hoạt động',
    badgeColor: '#10b981',
    badgeBg: '#ecfdf5',
    eyeType: 'happy_sparkle',
    mouthType: 'open_smile',
    accessory: 'hud_glasses',
    speech: 'Xin chào Admin! Toàn bộ máy chủ CSDL, trạm IoT và bản đồ GIS đang hoạt động hoàn hảo 100%! ✨🛡️',
    tip: 'Tất cả các trạm quan trắc IoT gửi dữ liệu định kỳ đều đặn.'
  },
  admin_notify: {
    title: 'Có Thông Báo Mới',
    badge: 'Tin mới cần duyệt',
    badgeColor: '#0284c7',
    badgeBg: '#f0f9ff',
    eyeType: 'excited_stars',
    mouthType: 'small_o',
    accessory: 'bell',
    speech: 'Admin ơi! Nông hộ vừa gửi nhật ký canh tác mới và có cập nhật dữ liệu kho vật tư cần xem xét! 🔔📝',
    tip: 'Khuyến nghị: Mở tab "Cơ sở dữ liệu" hoặc "Quản trị Chi phí" để kiểm tra.'
  },
  admin_alert: {
    title: 'CẢNH BÁO HỆ THỐNG',
    badge: 'Nguy cơ khẩn cấp!',
    badgeColor: '#ef4444',
    badgeBg: '#fef2f2',
    eyeType: 'shocked',
    mouthType: 'worried',
    accessory: 'siren',
    speech: 'CẢNH BÁO: Phát hiện 2 trạm IoT đất bị mất kết nối hoặc có cây trồng báo dịch hại bùng phát! 🚨⚠️',
    tip: 'Khuyến nghị: Kiểm tra ngay mục "Thiết bị IoT" và "Danh sách cây" để phân bổ xử lý.'
  },
  admin_database: {
    title: 'Giám Sát CSDL PostgreSQL',
    badge: 'Schema tối ưu',
    badgeColor: '#8b5cf6',
    badgeBg: '#faf5ff',
    eyeType: 'focused',
    mouthType: 'smile',
    accessory: 'magnifier',
    speech: 'Em đang soi chiếu cấu trúc bảng CSDL & kiểm tra log kiểm toán, không có lỗi phân mảnh hay rò rỉ dữ liệu! 🔍💾',
    tip: 'Khuyến nghị: Tab "Kiểm tra CSDL" sẵn sàng để truy vấn sâu.'
  },
  admin_weather: {
    title: 'Cảnh Báo Khí Tượng Vùng',
    badge: 'Dự báo mưa dông',
    badgeColor: '#3b82f6',
    badgeBg: '#eff6ff',
    eyeType: 'curious',
    mouthType: 'small_o',
    accessory: 'weather_radar',
    speech: 'Radar khí tượng Open-Meteo báo dông lốc sắp quét qua khu vực các trang trại trọng điểm phía Nam! 🌧️☂️',
    tip: 'Khuyến nghị: Phát cảnh báo khẩn đến các tài khoản nông hộ trong vùng ảnh hưởng.'
  },
  admin_night: {
    title: 'Trực Vận Hành Ca Đêm',
    badge: 'Tự động 24/7',
    badgeColor: '#6b21a8',
    badgeBg: '#faf5ff',
    eyeType: 'sleepy',
    mouthType: 'small_smile',
    accessory: 'night_cap',
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
      bottom: 16px;
      right: 20px;
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

  // Inject anime style & animations
  if (!document.getElementById('admin-chibi-anime-style')) {
    const style = document.createElement('style');
    style.id = 'admin-chibi-anime-style';
    style.textContent = `
      @keyframes mascot-float-bounce {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        50% { transform: translateY(-10px) rotate(2deg); }
      }
      @keyframes mascot-excited-jump {
        0%, 100% { transform: translateY(0) scale(1); }
        25% { transform: translateY(-14px) scale(1.05) rotate(-3deg); }
        75% { transform: translateY(-6px) scale(0.98) rotate(3deg); }
      }
      @keyframes mascot-alarm-shake {
        0%, 100% { transform: scale(1) rotate(0deg); }
        20%, 60% { transform: scale(1.1) rotate(-5deg); }
        40%, 80% { transform: scale(1.1) rotate(5deg); }
      }
      @keyframes leaf-gentle-sway {
        0%, 100% { transform: rotate(0deg); }
        50% { transform: rotate(14deg); }
      }
      @keyframes siren-glow-pulse {
        0%, 100% { opacity: 1; filter: drop-shadow(0 0 12px #ef4444); }
        50% { opacity: 0.35; filter: none; }
      }
      @keyframes bell-ring-wiggle {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-25deg); }
        75% { transform: rotate(25deg); }
      }
      .admin-anime-avatar {
        cursor: pointer;
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .admin-anime-avatar:hover {
        transform: scale(1.14) translateY(-8px) !important;
      }
      .admin-anime-chip {
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .admin-anime-chip:hover {
        transform: translateY(-2px);
        filter: brightness(1.1);
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

function _renderAdminAnimeMascotSVG(preset) {
  const isAlert = _adminMascotState === 'admin_alert';
  const isNotify = _adminMascotState === 'admin_notify';
  const isDb = _adminMascotState === 'admin_database';
  const isWeather = _adminMascotState === 'admin_weather';
  const isNight = _adminMascotState === 'admin_night';

  const bodyGradient = isAlert 
    ? ['#f87171', '#ef4444', '#b91c1c']
    : (isNight 
        ? ['#a78bfa', '#8b5cf6', '#6d28d9'] 
        : (isDb ? ['#38bdf8', '#0284c7', '#0369a1'] : ['#86efac', '#34d399', '#047857']));

  return `
    <svg width="120" height="135" viewBox="0 0 120 135" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 12px 20px rgba(0,0,0,0.22));">
      <defs>
        <!-- 3D Body Lighting -->
        <radialGradient id="adminAnimeBodyLight" cx="38%" cy="28%" r="70%">
          <stop offset="0%" stop-color="${bodyGradient[0]}" />
          <stop offset="35%" stop-color="${bodyGradient[1]}" />
          <stop offset="100%" stop-color="${bodyGradient[2]}" />
        </radialGradient>

        <!-- Soft Belly -->
        <radialGradient id="adminAnimeBellyLight" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="60%" stop-color="#f0fdf4" />
          <stop offset="100%" stop-color="#dcfce7" />
        </radialGradient>

        <!-- Sparkling Anime Eyes Iris -->
        <radialGradient id="adminAnimeEyeIris" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="45%" stop-color="#0284c7" />
          <stop offset="85%" stop-color="#0f172a" />
        </radialGradient>

        <!-- Leaves Gradient -->
        <radialGradient id="adminAnimeLeafLight" cx="30%" cy="25%" r="70%">
          <stop offset="0%" stop-color="#bbf7d0" />
          <stop offset="50%" stop-color="#4ade80" />
          <stop offset="100%" stop-color="#15803d" />
        </radialGradient>
      </defs>

      <!-- Sprout Leaves on Head -->
      <g style="transform-origin: 60px 32px; animation: leaf-gentle-sway 2s infinite ease-in-out;">
        <path d="M60 30 C56 12 38 10 42 22 C45 30 56 28 60 30Z" fill="url(#adminAnimeLeafLight)" stroke="#15803d" stroke-width="1.2" />
        <path d="M60 30 C64 12 82 10 78 22 C75 30 64 28 60 30Z" fill="url(#adminAnimeLeafLight)" stroke="#15803d" stroke-width="1.2" />
        <circle cx="60" cy="18" r="3.5" fill="#fef08a" />
      </g>

      <!-- Emergency Siren (Alert state) -->
      ${isAlert ? `
        <g style="animation: siren-glow-pulse 0.5s infinite alternate;">
          <rect x="52" y="6" width="16" height="14" rx="4" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" />
          <polygon points="60,0 54,6 66,6" fill="#dc2626" />
          <circle cx="60" cy="13" r="3.5" fill="#fef08a" />
        </g>
      ` : ''}

      <!-- Notification Bell (Notify state) -->
      ${isNotify ? `
        <g style="transform-origin: 90px 25px; animation: bell-ring-wiggle 1s infinite ease-in-out;">
          <path d="M90 16 C86 16 83 20 83 24 L81 28 L99 28 L97 24 C97 20 94 16 90 16 Z" fill="#fbbf24" stroke="#d97706" stroke-width="1.5" />
          <circle cx="90" cy="30" r="2.5" fill="#d97706" />
        </g>
      ` : ''}

      <!-- Radar Weather Cloud (Weather state) -->
      ${isWeather ? `
        <path d="M88 12 C78 12 74 20 74 26 L102 26 C102 20 98 12 88 12 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5" />
        <line x1="82" y1="28" x2="79" y2="33" stroke="#0284c7" stroke-width="1.5" stroke-linecap="round" />
        <line x1="90" y1="28" x2="87" y2="33" stroke="#0284c7" stroke-width="1.5" stroke-linecap="round" />
        <line x1="98" y1="28" x2="95" y2="33" stroke="#0284c7" stroke-width="1.5" stroke-linecap="round" />
      ` : ''}

      <!-- Chubby Pear-shaped Sprout Body -->
      <path d="M60 28 C90 28 102 60 98 90 C95 116 78 126 60 126 C42 126 25 116 22 90 C18 60 30 28 60 28Z" fill="url(#adminAnimeBodyLight)" stroke="#ffffff" stroke-width="2.5" />

      <!-- Soft Belly -->
      <ellipse cx="60" cy="94" rx="26" ry="22" fill="url(#adminAnimeBellyLight)" opacity="0.9" />

      <!-- Big Sparkling Anime Left Eye -->
      <g transform="translate(42, 66)">
        <ellipse cx="0" cy="0" rx="9" ry="12" fill="#ffffff" stroke="#0f172a" stroke-width="1.2" />
        <ellipse cx="1" cy="1" rx="7.5" ry="10" fill="url(#adminAnimeEyeIris)" />
        <ellipse cx="1" cy="2" rx="4.5" ry="6.5" fill="#020617" />
        <circle cx="-2" cy="-3" r="3.5" fill="#ffffff" />
        <circle cx="2.5" cy="4" r="1.5" fill="#ffffff" />
        <path d="M-9 -8 Q0 -14 9 -8" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" fill="none" />
      </g>

      <!-- Big Sparkling Anime Right Eye -->
      <g transform="translate(78, 66)">
        <ellipse cx="0" cy="0" rx="9" ry="12" fill="#ffffff" stroke="#0f172a" stroke-width="1.2" />
        <ellipse cx="-1" cy="1" rx="7.5" ry="10" fill="url(#adminAnimeEyeIris)" />
        <ellipse cx="-1" cy="2" rx="4.5" ry="6.5" fill="#020617" />
        <circle cx="-3.5" cy="-3" r="3.5" fill="#ffffff" />
        <circle cx="1" cy="4" r="1.5" fill="#ffffff" />
        <path d="M-9 -8 Q0 -14 9 -8" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" fill="none" />
      </g>

      <!-- Soft Rosy Cheeks -->
      <ellipse cx="32" cy="80" rx="7" ry="4" fill="#fb7185" opacity="0.6" />
      <ellipse cx="88" cy="80" rx="7" ry="4" fill="#fb7185" opacity="0.6" />

      <!-- Cute Smiling Mouth -->
      <path d="M55 80 Q60 88 65 80" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" fill="#fda4af" />

      <!-- Magnifying Glass for Database state -->
      ${isDb ? `
        <circle cx="94" cy="74" r="9" fill="rgba(56,189,248,0.25)" stroke="#64748b" stroke-width="2.5" />
        <line x1="100" y1="80" x2="110" y2="90" stroke="#475569" stroke-width="3" stroke-linecap="round" />
      ` : ''}

      <!-- High-tech HUD Visor (Optimal state) -->
      ${(!isAlert && !isNight && !isDb) ? `
        <rect x="28" y="58" width="28" height="16" rx="5" fill="rgba(14,165,233,0.2)" stroke="#38bdf8" stroke-width="1.5" />
        <rect x="64" y="58" width="28" height="16" rx="5" fill="rgba(14,165,233,0.2)" stroke="#38bdf8" stroke-width="1.5" />
        <line x1="56" y1="66" x2="64" y2="66" stroke="#38bdf8" stroke-width="2" />
      ` : ''}

      <!-- Tiny Cute Chubby Hands -->
      <circle cx="26" cy="94" r="6.5" fill="#34d399" stroke="#059669" stroke-width="1.2" />
      <circle cx="94" cy="94" r="6.5" fill="#34d399" stroke="#059669" stroke-width="1.2" />

      <!-- Tiny Cute Boots -->
      <ellipse cx="48" cy="126" rx="8" ry="5.5" fill="#0f172a" stroke="#ffffff" stroke-width="1.2" />
      <ellipse cx="72" cy="126" rx="8" ry="5.5" fill="#0f172a" stroke="#ffffff" stroke-width="1.2" />
    </svg>
  `;
}

function renderAdminMascot(customSpeech = null) {
  const container = document.getElementById('admin-chibi-mascot-widget');
  if (!container) return;

  const preset = ADMIN_MASCOT_STATES[_adminMascotState] || ADMIN_MASCOT_STATES.admin_optimal;
  const speechText = customSpeech || preset.speech;

  container.innerHTML = `
    <!-- Speech Dialogue Box -->
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
      margin-bottom: 8px;
      margin-right: 8px;
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
          <button class="admin-anime-chip" onclick="setAdminMascotState('admin_optimal')" title="Hệ thống tối ưu" style="background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding:3px 7px; cursor:pointer; font-size:11px; font-weight:700; color:#047857;">🌱 Ổn định</button>
          <button class="admin-anime-chip" onclick="setAdminMascotState('admin_notify')" title="Có thông báo mới" style="background:#f0f9ff; border:1px solid #0284c7; border-radius:8px; padding:3px 7px; cursor:pointer; font-size:11px; font-weight:700; color:#0284c7;">🔔 Thông báo</button>
          <button class="admin-anime-chip" onclick="setAdminMascotState('admin_alert')" title="Cảnh báo khẩn" style="background:#fef2f2; border:1px solid #ef4444; border-radius:8px; padding:3px 7px; cursor:pointer; font-size:11px; font-weight:700; color:#b91c1c;">🚨 Cảnh báo</button>
          <button class="admin-anime-chip" onclick="setAdminMascotState('admin_database')" title="Kiểm tra CSDL" style="background:#faf5ff; border:1px solid #8b5cf6; border-radius:8px; padding:3px 7px; cursor:pointer; font-size:11px; font-weight:700; color:#6d28d9;">🔍 CSDL</button>
          <button class="admin-anime-chip" onclick="setAdminMascotState('admin_weather')" title="Khí tượng dông lốc" style="background:#eff6ff; border:1px solid #3b82f6; border-radius:8px; padding:3px 7px; cursor:pointer; font-size:11px; font-weight:700; color:#1e40af;">🌧️ Khí tượng</button>
          <button class="admin-anime-chip" onclick="setAdminMascotState('admin_night')" title="Trực đêm 24/7" style="background:#faf5ff; border:1px solid #6b21a8; border-radius:8px; padding:3px 7px; cursor:pointer; font-size:11px; font-weight:700; color:#581c87;">🌙 Trực đêm</button>
        </div>
      </div>

      <!-- Triangle Pointer -->
      <div style="
        position: absolute;
        bottom: -10px;
        right: 50px;
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-top: 10px solid #ffffff;
      "></div>
    </div>

    <!-- 3D Anime Chibi Plant Character -->
    <div onclick="onAdminMascotClick()" class="admin-anime-avatar" title="Bấm vào Bé Mầm để nghe báo cáo!" style="
      display: flex;
      align-items: flex-end;
      justify-content: center;
      animation: ${_adminMascotState === 'admin_alert' ? 'mascot-alarm-shake 0.5s infinite' : (_adminMascotState === 'admin_notify' ? 'mascot-excited-jump 1.5s infinite' : 'mascot-float-bounce 2.5s infinite ease-in-out')};
    ">
      ${_renderAdminAnimeMascotSVG(preset)}
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
  
  const avatar = document.querySelector('.admin-anime-avatar');
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
