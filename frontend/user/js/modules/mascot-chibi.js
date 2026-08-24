/**
 * modules/mascot-chibi.js - Advanced Multi-State Chibi Plant Assistant ("Bé Mầm AgTech")
 * Thiết kế Icon Cây Trồng Chibi 3D Vector Đa Trạng Thái chuyên biệt cho Quản trị & Canh tác
 */

let _mascotState = 'optimal'; // optimal, notify, alert, weather_rain, weather_sun, thirsty, farming_log, doctor, harvest, sleep

const MASCOT_STATES = {
  optimal: {
    title: 'Vườn Xanh Tốt',
    category: 'Vận hành',
    badge: 'Tối ưu 100%',
    badgeColor: '#10b981',
    badgeBg: '#ecfdf5',
    eyes: '^^',
    mouth: 'ᴗ',
    accessory: 'sunglasses',
    speech: 'Vườn hôm nay rất xanh tốt, chỉ số đất và không khí đều ở mức lý tưởng, chủ vườn nhé! ✨',
    tip: 'Khuyến nghị: Duy trì chế độ tưới tiêu định kỳ theo chu kỳ sinh trưởng.'
  },
  notify: {
    title: 'Thông Báo Canh Tác',
    category: 'Nhắc nhở',
    badge: 'Có tin mới',
    badgeColor: '#0284c7',
    badgeBg: '#f0f9ff',
    eyes: '★.★',
    mouth: 'o',
    accessory: 'bell',
    speech: 'Bác ơi, có lịch nhắc bón phân đợt 2 và kiểm tra sâu tơ cho lô A hôm nay nhé! 🔔',
    tip: 'Khuyến nghị: Nhấn vào mục "Nhật ký & Nhắc việc" để xem chi tiết.'
  },
  alert: {
    title: 'Cảnh Báo Khẩn Cấp',
    category: 'Cảnh báo',
    badge: 'Nguy cơ cao!',
    badgeColor: '#ef4444',
    badgeBg: '#fef2f2',
    eyes: '⊙.⊙',
    mouth: '△',
    accessory: 'siren',
    speech: 'CẢNH BÁO: Cảm biến phát hiện độ ẩm đất tầng sâu giảm mạnh dưới 45%! Cần bổ sung nước khẩn cấp! 🚨',
    tip: 'Khuyến nghị: Bật hệ thống tưới nhỏ giọt ngay hoặc kiểm tra van xả.'
  },
  weather_rain: {
    title: 'Dự Báo Mưa Lớn',
    category: 'Khí tượng',
    badge: 'Mưa dông 85%',
    badgeColor: '#3b82f6',
    badgeBg: '#eff6ff',
    eyes: '•.•',
    mouth: 'o',
    accessory: 'umbrella',
    speech: 'Dự báo chiều nay có mưa dông lượng lớn! Bác nhớ tạm hoãn phun thuốc và bón phân để tránh bị rửa trôi nhé! 🌧️☂️',
    tip: 'Khuyến nghị: Khơi thông mương thoát nước quanh gốc cây.'
  },
  weather_sun: {
    title: 'Nắng Gắt & Bức Xạ Cao',
    category: 'Khí tượng',
    badge: 'UV Cực cao',
    badgeColor: '#f59e0b',
    badgeBg: '#fffbeb',
    eyes: '⌐■_■',
    mouth: 'ᴗ',
    accessory: 'sun_hat',
    speech: 'Trời nắng gắt, chỉ số bức xạ UV đang ở mức cảnh báo. Cây dễ bị cháy lá non nếu thiếu ẩm! ☀️🕶️',
    tip: 'Khuyến nghị: Tăng lượng tưới giữ ẩm gốc vào sáng sớm hoặc phủ rơm giữ ẩm.'
  },
  thirsty: {
    title: 'Cây Khát Nước',
    category: 'Tưới tiêu',
    badge: 'Độ ẩm thấp',
    badgeColor: '#0ea5e9',
    badgeBg: '#f0f9ff',
    eyes: '><',
    mouth: 'o',
    accessory: 'watering_can',
    speech: 'Em đã chuẩn bị sẵn bình tưới nước mát lành cho vườn rồi đây! Cho cây uống nước mát đi bác ơi! 🚰💧',
    tip: 'Khuyến nghị: Tưới 10 - 15 Lít/gốc vào buổi chiều mát.'
  },
  farming_log: {
    title: 'Ghi Sổ VietGAP',
    category: 'Nhật ký',
    badge: 'Chờ ghi chép',
    badgeColor: '#8b5cf6',
    badgeBg: '#faf5ff',
    eyes: '◕.◕',
    mouth: 'ᴗ',
    accessory: 'clipboard',
    speech: 'Bác vừa hoàn tất tưới vườn đúng không? Hãy bấm nút (+) để em ghi ngay vào sổ nhật ký VietGAP chuẩn nhé! 📝🌿',
    tip: 'Khuyến nghị: Dùng tính năng Đọc giọng nói (Voice AI) để ghi sổ cực nhanh 10 giây.'
  },
  doctor: {
    title: 'Chẩn Đoán Sâu Bệnh',
    category: 'Bác sĩ cây',
    badge: 'Cần kiểm tra',
    badgeColor: '#dc2626',
    badgeBg: '#fef2f2',
    eyes: 'ʘ.ʘ',
    mouth: '—',
    accessory: 'stethoscope',
    speech: 'Em phát hiện có dấu hiệu đốm lá và rầy phấn trên lô cây số 3! Bác cầm xẻng và kính lúp đi kiểm tra cùng em nhé! 🩺🔍',
    tip: 'Khuyến nghị: Cách ly cây bệnh và dùng thuốc sinh học có thời gian cách ly PHI ngắn.'
  },
  harvest: {
    title: 'Mùa Vụ Bội Thu',
    category: 'Thu hoạch',
    badge: 'Sản lượng cao',
    badgeColor: '#16a34a',
    badgeBg: '#f0fdf4',
    eyes: '≧◡≦',
    mouth: '▽',
    accessory: 'harvest_basket',
    speech: 'Xin chúc mừng chủ vườn! Trái cây đã đạt độ chín ngọt hoàn hảo, sẵn sàng thu hoạch đóng gói xuất khẩu rồi! 🌾🧺🎉',
    tip: 'Khuyến nghị: Vào mục "Thu hoạch" để phân loại hàng Loại 1 và xuất hóa đơn.'
  },
  sleep: {
    title: 'Nghỉ Ngơi Ban Đêm',
    category: 'Trực đêm',
    badge: 'Chế độ ngủ',
    badgeColor: '#6b21a8',
    badgeBg: '#faf5ff',
    eyes: '--',
    mouth: 'u',
    accessory: 'night_cap',
    speech: 'Vườn cây đã tưới đủ ẩm, hệ thống cảm biến tự động trực ca đêm. Chúc chủ vườn ngủ thật ngon giấc! zZz 🌙',
    tip: 'Máy chủ tự động lưu trữ số liệu 30 phút/lần.'
  }
};

export function initChibiMascot() {
  let mascotContainer = document.getElementById('chibi-mascot-widget');
  if (!mascotContainer) {
    mascotContainer = document.createElement('div');
    mascotContainer.id = 'chibi-mascot-widget';
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
  if (!document.getElementById('chibi-mascot-engine-style')) {
    const style = document.createElement('style');
    style.id = 'chibi-mascot-engine-style';
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
        0%, 100% { opacity: 1; filter: drop-shadow(0 0 8px #ef4444); }
        50% { opacity: 0.4; filter: none; }
      }
      @keyframes bell-ring {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-20deg); }
        75% { transform: rotate(20deg); }
      }
      .chibi-avatar-3d {
        cursor: pointer;
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .chibi-avatar-3d:hover {
        transform: scale(1.12) translateY(-6px) !important;
      }
      .chibi-state-chip {
        transition: all 0.2s ease;
      }
      .chibi-state-chip:hover {
        transform: translateY(-2px);
        filter: brightness(1.08);
      }
    `;
    document.head.appendChild(style);
  }

  renderMascot();
}

export function setMascotState(stateKey, customSpeech = null) {
  if (MASCOT_STATES[stateKey]) {
    _mascotState = stateKey;
  }
  renderMascot(customSpeech);
}

function _renderMascotSVG(preset) {
  const isAlert = _mascotState === 'alert';
  const isNotify = _mascotState === 'notify';
  const isRain = _mascotState === 'weather_rain';
  const isSun = _mascotState === 'weather_sun';
  const isDoctor = _mascotState === 'doctor';
  const isHarvest = _mascotState === 'harvest';
  const isLog = _mascotState === 'farming_log';
  const isThirsty = _mascotState === 'thirsty';
  const isSleep = _mascotState === 'sleep';

  const bodyGradient = isAlert 
    ? ['#f87171', '#ef4444', '#b91c1c']
    : (isSleep 
        ? ['#a78bfa', '#8b5cf6', '#6d28d9'] 
        : ['#4ade80', '#22c55e', '#15803d']);

  return `
    <svg width="100" height="110" viewBox="0 0 100 110" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 10px 18px rgba(0,0,0,0.22));">
      <defs>
        <!-- 3D Spherical Gradients -->
        <radialGradient id="mascotBodyGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="${bodyGradient[0]}" />
          <stop offset="60%" stop-color="${bodyGradient[1]}" />
          <stop offset="100%" stop-color="${bodyGradient[2]}" />
        </radialGradient>
        
        <radialGradient id="sproutGrad" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#86efac" />
          <stop offset="100%" stop-color="#16a34a" />
        </radialGradient>

        <linearGradient id="hatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a" />
          <stop offset="70%" stop-color="#eab308" />
          <stop offset="100%" stop-color="#ca8a04" />
        </linearGradient>
      </defs>

      <!-- Mascot Sprout Leaves (Head) -->
      <g style="transform-origin: 50px 32px; animation: leaf-sway 2s infinite ease-in-out;">
        <path d="M50 30 C42 12 25 18 32 30 C38 40 48 35 50 30Z" fill="url(#sproutGrad)" />
        <path d="M50 30 C58 12 75 18 68 30 C62 40 52 35 50 30Z" fill="url(#sproutGrad)" />
        <path d="M50 30 Q50 20 48 16" stroke="#15803d" stroke-width="2.5" stroke-linecap="round" />
      </g>

      <!-- Vietnamese Conical Hat (Nón Lá) for Harvest / Sunny state -->
      ${(isHarvest || isSun) ? `
        <polygon points="50,14 14,40 86,40" fill="url(#hatGrad)" filter="drop-shadow(0 3px 5px rgba(0,0,0,0.3))" />
        <line x1="50" y1="14" x2="50" y2="40" stroke="#a16207" stroke-width="1.2" opacity="0.6" />
        <line x1="50" y1="14" x2="30" y2="40" stroke="#a16207" stroke-width="1" opacity="0.4" />
        <line x1="50" y1="14" x2="70" y2="40" stroke="#a16207" stroke-width="1" opacity="0.4" />
      ` : ''}

      <!-- Siren Alarm Accessory (Alert state) -->
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

      <!-- Umbrella Accessory (Rain state) -->
      ${isRain ? `
        <path d="M72 16 C60 16 54 26 54 32 L90 32 C90 26 84 16 72 16 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5" />
        <path d="M72 32 L72 44 C72 47 69 47 68 45" stroke="#0284c7" stroke-width="2" fill="none" stroke-linecap="round" />
        <circle cx="58" cy="22" r="2" fill="#e0f2fe" />
        <circle cx="86" cy="22" r="2" fill="#e0f2fe" />
      ` : ''}

      <!-- 3D Chibi Mascot Round Body -->
      <circle cx="50" cy="65" r="32" fill="url(#mascotBodyGrad)" stroke="#ffffff" stroke-width="3" />

      <!-- Cute Anime Rosy Cheeks -->
      <ellipse cx="32" cy="73" rx="5" ry="3.5" fill="#f43f5e" opacity="0.65" />
      <ellipse cx="68" cy="73" rx="5" ry="3.5" fill="#f43f5e" opacity="0.65" />

      <!-- Cute Expressive Anime Eyes -->
      <text x="50" y="65" font-family="'Segoe UI', Roboto, sans-serif" font-size="17" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="6">${preset.eyes}</text>

      <!-- Cute Mouth -->
      <text x="50" y="77" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">${preset.mouth}</text>

      <!-- Doctor Stethoscope (Doctor state) -->
      ${isDoctor ? `
        <path d="M35 70 C35 84 65 84 65 70" stroke="#64748b" stroke-width="2.5" fill="none" stroke-linecap="round" />
        <circle cx="50" cy="85" r="5" fill="#cbd5e1" stroke="#475569" stroke-width="1.5" />
      ` : ''}

      <!-- Watering Can (Thirsty state) -->
      ${isThirsty ? `
        <rect x="74" y="66" width="14" height="12" rx="3" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5" />
        <path d="M78 66 L78 61 L84 61 L84 66" stroke="#0284c7" stroke-width="1.5" fill="none" />
        <line x1="88" y1="70" x2="96" y2="64" stroke="#0284c7" stroke-width="2" stroke-linecap="round" />
      ` : ''}

      <!-- VietGAP Clipboard (Farming log state) -->
      ${isLog ? `
        <rect x="70" y="64" width="16" height="22" rx="2" fill="#f8fafc" stroke="#475569" stroke-width="1.5" />
        <rect x="74" y="62" width="8" height="4" rx="1" fill="#94a3b8" />
        <line x1="74" y1="70" x2="82" y2="70" stroke="#10b981" stroke-width="1.5" />
        <line x1="74" y1="74" x2="80" y2="74" stroke="#64748b" stroke-width="1.2" />
        <line x1="74" y1="78" x2="82" y2="78" stroke="#64748b" stroke-width="1.2" />
      ` : ''}

      <!-- Harvest Basket (Harvest state) -->
      ${isHarvest ? `
        <ellipse cx="50" cy="94" rx="16" ry="6" fill="#ca8a04" stroke="#854d0e" stroke-width="1.5" />
        <circle cx="44" cy="90" r="4" fill="#ef4444" />
        <circle cx="50" cy="89" r="4.5" fill="#eab308" />
        <circle cx="56" cy="90" r="4" fill="#22c55e" />
      ` : ''}

      <!-- Tiny 3D Feet -->
      <ellipse cx="40" cy="96" rx="6" ry="4" fill="#15803d" stroke="#ffffff" stroke-width="1.5" />
      <ellipse cx="60" cy="96" rx="6" ry="4" fill="#15803d" stroke="#ffffff" stroke-width="1.5" />
    </svg>
  `;
}

export function renderMascot(customSpeech = null) {
  const container = document.getElementById('chibi-mascot-widget');
  if (!container) return;

  const preset = MASCOT_STATES[_mascotState] || MASCOT_STATES.optimal;
  const speechText = customSpeech || preset.speech;

  container.innerHTML = `
    <!-- Multi-State Interactive Dialogue Box -->
    <div id="mascot-speech-bubble" style="
      background: #ffffff;
      color: #0f172a;
      border: 2px solid ${preset.badgeColor};
      border-radius: 20px;
      padding: 14px 18px;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.5;
      max-width: 320px;
      box-shadow: 0 16px 36px -6px rgba(0,0,0,0.22), 0 8px 16px -4px rgba(0,0,0,0.1);
      margin-bottom: 10px;
      margin-right: 12px;
      position: relative;
      animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    ">
      <!-- Header Badge -->
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;">
        <span style="background:${preset.badgeColor}; color:white; font-size:11px; font-weight:800; padding:3px 10px; border-radius:14px; display:inline-flex; align-items:center; gap:5px; box-shadow:0 2px 6px rgba(0,0,0,0.15);">
          ${preset.title}
        </span>
        <span style="font-size:11.5px; color:${preset.badgeColor}; background:${preset.badgeBg}; font-weight:800; padding:2px 8px; border-radius:10px; border:1px solid ${preset.badgeColor};">
          ${preset.badge}
        </span>
      </div>
      
      <!-- Dialogue Body -->
      <div style="color:#1e293b; margin-bottom:8px; font-weight:600;">${speechText}</div>
      
      <!-- Actionable Tip -->
      <div style="font-size:11px; color:#64748b; background:#f8fafc; border-radius:8px; padding:6px 10px; margin-bottom:10px; border-left:3px solid ${preset.badgeColor}; font-weight:600;">
        💡 ${preset.tip}
      </div>

      <!-- Quick Multi-State Selector Toolbar -->
      <div style="border-top:1px solid #f1f5f9; padding-top:8px;">
        <div style="font-size:10.5px; color:#94a3b8; font-weight:700; margin-bottom:5px;">CHUYỂN TRẠNG THÁI THÔNG MINH:</div>
        <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:space-between;">
          <button class="chibi-state-chip" onclick="setMascotState('optimal')" title="Tối ưu / Xanh tốt" style="background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding:3px 6px; cursor:pointer; font-size:11px; font-weight:700; color:#047857;">🌱 Tối ưu</button>
          <button class="chibi-state-chip" onclick="setMascotState('notify')" title="Có thông báo mới" style="background:#f0f9ff; border:1px solid #0284c7; border-radius:8px; padding:3px 6px; cursor:pointer; font-size:11px; font-weight:700; color:#0284c7;">🔔 Tin mới</button>
          <button class="chibi-state-chip" onclick="setMascotState('alert')" title="Cảnh báo khẩn" style="background:#fef2f2; border:1px solid #ef4444; border-radius:8px; padding:3px 6px; cursor:pointer; font-size:11px; font-weight:700; color:#b91c1c;">🚨 Cảnh báo</button>
          <button class="chibi-state-chip" onclick="setMascotState('weather_rain')" title="Thời tiết: Mưa lớn" style="background:#eff6ff; border:1px solid #3b82f6; border-radius:8px; padding:3px 6px; cursor:pointer; font-size:11px; font-weight:700; color:#1e40af;">🌧️ Mưa</button>
          <button class="chibi-state-chip" onclick="setMascotState('weather_sun')" title="Thời tiết: Nắng gắt" style="background:#fffbeb; border:1px solid #f59e0b; border-radius:8px; padding:3px 6px; cursor:pointer; font-size:11px; font-weight:700; color:#b45309;">☀️ Nắng</button>
          <button class="chibi-state-chip" onclick="setMascotState('thirsty')" title="Độ ẩm thấp / Cần tưới" style="background:#f0f9ff; border:1px solid #0ea5e9; border-radius:8px; padding:3px 6px; cursor:pointer; font-size:11px; font-weight:700; color:#0369a1;">🚰 Cần tưới</button>
          <button class="chibi-state-chip" onclick="setMascotState('doctor')" title="Bác sĩ cây trồng" style="background:#fef2f2; border:1px solid #dc2626; border-radius:8px; padding:3px 6px; cursor:pointer; font-size:11px; font-weight:700; color:#991b1b;">🩺 Bệnh cây</button>
          <button class="chibi-state-chip" onclick="setMascotState('harvest')" title="Thu hoạch mùa vụ" style="background:#f0fdf4; border:1px solid #16a34a; border-radius:8px; padding:3px 6px; cursor:pointer; font-size:11px; font-weight:700; color:#15803d;">🌾 Thu hoạch</button>
        </div>
      </div>

      <!-- Triangle Pointer -->
      <div style="
        position: absolute;
        bottom: -10px;
        right: 46px;
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-top: 10px solid #ffffff;
      "></div>
    </div>

    <!-- 3D Chibi Plant Mascot Character -->
    <div onclick="onMascotClick()" class="chibi-avatar-3d" title="Bấm vào Bé Mầm để tương tác!" style="
      display: flex;
      align-items: flex-end;
      justify-content: center;
      animation: ${_mascotState === 'alert' ? 'mascot-alarm 0.5s infinite' : (_mascotState === 'notify' ? 'mascot-excited 1.5s infinite' : 'mascot-idle 2.5s infinite ease-in-out')};
    ">
      ${_renderMascotSVG(preset)}
    </div>
  `;
}

export function onMascotClick() {
  const greetings = [
    'Chào chủ vườn! Bé Mầm luôn túc trực 24/7 bảo vệ và chăm sóc vườn cây cho bác! 🌱✨',
    'Chỉ số độ ẩm và vi khí hậu đang được đồng bộ trực tiếp từ trạm quan trắc IoT! 📡',
    'Bác nhớ kiểm tra lịch tưới nhỏ giọt tự động để tối ưu lượng nước tưới nhé! 💧',
    'Cần chẩn đoán sức khỏe cây trồng? Bấm vào mục Cây bệnh để em hỗ trợ ngay! 🩺',
    'Bé Mầm AgTech - Người bạn đồng hành thông minh của nhà nông thời đại số 4.0! 🧑‍🌾'
  ];
  const randomGreet = greetings[Math.floor(Math.random() * greetings.length)];
  
  const avatar = document.querySelector('.chibi-avatar-3d');
  if (avatar) {
    avatar.style.transform = 'scale(1.25) translateY(-14px) rotate(8deg)';
    setTimeout(() => {
      avatar.style.transform = 'scale(1) translateY(0) rotate(0deg)';
    }, 400);
  }

  setMascotState(_mascotState, randomGreet);
}

window.onMascotClick = onMascotClick;
window.setMascotState = setMascotState;
window.initChibiMascot = initChibiMascot;
