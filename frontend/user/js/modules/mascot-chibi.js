/**
 * modules/mascot-chibi.js - High-End 3D Anime Chibi Plant Mascot Engine ("Bé Mầm AgTech")
 * Thiết kế Đồ họa Chibi Anime Cao Cấp Đa Biểu Cảm & Phụ Kiện Sống Động
 */

let _mascotState = 'optimal';

const MASCOT_STATES = {
  optimal: {
    title: 'Vườn Cây Xanh Tốt',
    badge: 'Tối ưu 100%',
    badgeColor: '#10b981',
    badgeBg: '#ecfdf5',
    eyeType: 'happy_sparkle',
    mouthType: 'open_smile',
    accessory: 'none',
    speech: 'Xin chào chủ vườn! Vườn cây hôm nay rất xanh tốt, rễ tơ hút ẩm rất đều và khỏe mạnh ạ! ✨🌱',
    tip: 'Khuyến nghị: Duy trì chế độ tưới tiêu định kỳ theo chu kỳ sinh trưởng.'
  },
  notify: {
    title: 'Thông Báo Canh Tác',
    badge: 'Có lịch nhắc',
    badgeColor: '#0284c7',
    badgeBg: '#f0f9ff',
    eyeType: 'excited_stars',
    mouthType: 'small_o',
    accessory: 'bell',
    speech: 'Bác ơi, có lịch nhắc bón phân đợt 2 và kiểm tra sâu tơ cho lô A hôm nay nhé! 🔔📝',
    tip: 'Khuyến nghị: Nhấn vào mục "Nhật ký & Nhắc việc" để xem chi tiết.'
  },
  alert: {
    title: 'CẢNH BÁO KHẨN CẤP',
    badge: 'Nguy cơ cao!',
    badgeColor: '#ef4444',
    badgeBg: '#fef2f2',
    eyeType: 'shocked',
    mouthType: 'worried',
    accessory: 'siren',
    speech: 'CẢNH BÁO: Cảm biến phát hiện độ ẩm đất tầng sâu giảm mạnh dưới 45%! Cần bổ sung nước khẩn cấp! 🚨⚠️',
    tip: 'Khuyến nghị: Bật hệ thống tưới nhỏ giọt ngay hoặc kiểm tra van xả.'
  },
  weather_rain: {
    title: 'Dự Báo Mưa Dông',
    badge: 'Khả năng mưa 85%',
    badgeColor: '#3b82f6',
    badgeBg: '#eff6ff',
    eyeType: 'curious',
    mouthType: 'small_o',
    accessory: 'umbrella',
    speech: 'Dự báo trời sắp mưa rào lượng lớn! Bác nhớ tạm hoãn phun thuốc và bón phân để tránh bị rửa trôi nhé! 🌧️☂️',
    tip: 'Khuyến nghị: Khơi thông rãnh thoát nước quanh gốc cây.'
  },
  weather_sun: {
    title: 'Nắng Gắt & UV Cao',
    badge: 'Bức xạ cực cao',
    badgeColor: '#f59e0b',
    badgeBg: '#fffbeb',
    eyeType: 'sunglasses',
    mouthType: 'happy_smile',
    accessory: 'non_la',
    speech: 'Trời nắng gắt, chỉ số bức xạ UV đang ở mức cảnh báo. Cây dễ bị cháy lá non nếu thiếu ẩm! ☀️🕶️',
    tip: 'Khuyến nghị: Tăng lượng tưới giữ ẩm gốc vào sáng sớm hoặc phủ rơm giữ ẩm.'
  },
  thirsty: {
    title: 'Cây Khát Nước',
    badge: 'Độ ẩm thấp',
    badgeColor: '#0ea5e9',
    badgeBg: '#f0f9ff',
    eyeType: 'pleading',
    mouthType: 'pout',
    accessory: 'watering_can',
    speech: 'Em đã xách sẵn bình tưới nước mát lành cho vườn rồi đây! Cho cây uống nước mát đi bác ơi! 🚰💧',
    tip: 'Khuyến nghị: Tưới 10 - 15 Lít/gốc vào buổi chiều mát.'
  },
  doctor: {
    title: 'Chẩn Đoán Sâu Bệnh',
    badge: 'Cần kiểm tra',
    badgeColor: '#dc2626',
    badgeBg: '#fef2f2',
    eyeType: 'focused',
    mouthType: 'flat',
    accessory: 'stethoscope',
    speech: 'Em phát hiện có dấu hiệu đốm lá trên lô cây số 3! Bác cùng em đi kiểm tra và cách ly sớm nhé! 🩺🌿',
    tip: 'Khuyến nghị: Dùng thuốc sinh học có thời gian cách ly PHI ngắn.'
  },
  harvest: {
    title: 'Mùa Vụ Bội Thu',
    badge: 'Sản lượng cao',
    badgeColor: '#16a34a',
    badgeBg: '#f0fdf4',
    eyeType: 'joy_sparkle',
    mouthType: 'big_laugh',
    accessory: 'harvest_basket',
    speech: 'Xin chúc mừng chủ vườn! Trái cây đã đạt độ chín ngọt hoàn hảo, sẵn sàng thu hoạch đóng gói xuất khẩu rồi! 🌾🧺🎉',
    tip: 'Khuyến nghị: Vào mục "Thu hoạch" để phân loại hàng Loại 1 và xuất hóa đơn.'
  }
};

export function initChibiMascot() {
  let mascotContainer = document.getElementById('chibi-mascot-widget');
  if (!mascotContainer) {
    mascotContainer = document.createElement('div');
    mascotContainer.id = 'chibi-mascot-widget';
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
  if (!document.getElementById('chibi-anime-engine-style')) {
    const style = document.createElement('style');
    style.id = 'chibi-anime-engine-style';
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
      .chibi-anime-avatar {
        cursor: pointer;
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .chibi-anime-avatar:hover {
        transform: scale(1.14) translateY(-8px) !important;
      }
      .chibi-state-chip {
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .chibi-state-chip:hover {
        transform: translateY(-2px);
        filter: brightness(1.1);
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

function _renderAnimeMascotSVG(preset) {
  const isAlert = _mascotState === 'alert';
  const isNotify = _mascotState === 'notify';
  const isRain = _mascotState === 'weather_rain';
  const isSun = _mascotState === 'weather_sun';
  const isDoctor = _mascotState === 'doctor';
  const isHarvest = _mascotState === 'harvest';
  const isThirsty = _mascotState === 'thirsty';

  return `
    <svg width="120" height="135" viewBox="0 0 120 135" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 12px 20px rgba(0,0,0,0.22));">
      <defs>
        <!-- 3D Body Lighting -->
        <radialGradient id="animeBodyLight" cx="38%" cy="28%" r="70%">
          <stop offset="0%" stop-color="#86efac" />
          <stop offset="35%" stop-color="#34d399" />
          <stop offset="75%" stop-color="#10b981" />
          <stop offset="100%" stop-color="#047857" />
        </radialGradient>

        <!-- Soft Belly -->
        <radialGradient id="animeBellyLight" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="60%" stop-color="#f0fdf4" />
          <stop offset="100%" stop-color="#dcfce7" />
        </radialGradient>

        <!-- Sparkling Anime Eyes Iris -->
        <radialGradient id="animeEyeIris" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="45%" stop-color="#0284c7" />
          <stop offset="85%" stop-color="#0f172a" />
        </radialGradient>

        <!-- Leaves Gradient -->
        <radialGradient id="animeLeafLight" cx="30%" cy="25%" r="70%">
          <stop offset="0%" stop-color="#bbf7d0" />
          <stop offset="50%" stop-color="#4ade80" />
          <stop offset="100%" stop-color="#15803d" />
        </radialGradient>

        <!-- Conical Hat (Nón Lá) Gradient -->
        <linearGradient id="animeHatLight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a" />
          <stop offset="65%" stop-color="#eab308" />
          <stop offset="100%" stop-color="#ca8a04" />
        </linearGradient>
      </defs>

      <!-- Sprout Leaves on Head -->
      <g style="transform-origin: 60px 32px; animation: leaf-gentle-sway 2s infinite ease-in-out;">
        <path d="M60 30 C56 12 38 10 42 22 C45 30 56 28 60 30Z" fill="url(#animeLeafLight)" stroke="#15803d" stroke-width="1.2" />
        <path d="M60 30 C64 12 82 10 78 22 C75 30 64 28 60 30Z" fill="url(#animeLeafLight)" stroke="#15803d" stroke-width="1.2" />
        <circle cx="60" cy="18" r="3.5" fill="#fef08a" />
      </g>

      <!-- Nón Lá for Sun / Harvest State -->
      ${(isSun || isHarvest) ? `
        <polygon points="60,8 18,32 102,32" fill="url(#animeHatLight)" stroke="#a16207" stroke-width="1.5" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.3))" />
        <line x1="60" y1="8" x2="60" y2="32" stroke="#a16207" stroke-width="1" opacity="0.6" />
        <line x1="60" y1="8" x2="38" y2="32" stroke="#a16207" stroke-width="0.8" opacity="0.4" />
        <line x1="60" y1="8" x2="82" y2="32" stroke="#a16207" stroke-width="0.8" opacity="0.4" />
      ` : ''}

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

      <!-- Umbrella (Rain state) -->
      ${isRain ? `
        <path d="M88 12 C74 12 68 24 68 30 L108 30 C108 24 102 12 88 12 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5" />
        <path d="M88 30 L88 44 C88 47 85 47 84 45" stroke="#0284c7" stroke-width="2.5" fill="none" stroke-linecap="round" />
        <circle cx="76" cy="20" r="2.5" fill="#e0f2fe" />
        <circle cx="100" cy="20" r="2.5" fill="#e0f2fe" />
      ` : ''}

      <!-- Chubby Pear-shaped Sprout Body -->
      <path d="M60 28 C90 28 102 60 98 90 C95 116 78 126 60 126 C42 126 25 116 22 90 C18 60 30 28 60 28Z" fill="url(#animeBodyLight)" stroke="#ffffff" stroke-width="2.5" />

      <!-- Soft Belly -->
      <ellipse cx="60" cy="94" rx="26" ry="22" fill="url(#animeBellyLight)" opacity="0.9" />

      <!-- Big Sparkling Anime Left Eye -->
      <g transform="translate(42, 66)">
        <ellipse cx="0" cy="0" rx="9" ry="12" fill="#ffffff" stroke="#0f172a" stroke-width="1.2" />
        <ellipse cx="1" cy="1" rx="7.5" ry="10" fill="url(#animeEyeIris)" />
        <ellipse cx="1" cy="2" rx="4.5" ry="6.5" fill="#020617" />
        <circle cx="-2" cy="-3" r="3.5" fill="#ffffff" />
        <circle cx="2.5" cy="4" r="1.5" fill="#ffffff" />
        <path d="M-9 -8 Q0 -14 9 -8" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" fill="none" />
      </g>

      <!-- Big Sparkling Anime Right Eye -->
      <g transform="translate(78, 66)">
        <ellipse cx="0" cy="0" rx="9" ry="12" fill="#ffffff" stroke="#0f172a" stroke-width="1.2" />
        <ellipse cx="-1" cy="1" rx="7.5" ry="10" fill="url(#animeEyeIris)" />
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

      <!-- Doctor Stethoscope (Doctor state) -->
      ${isDoctor ? `
        <path d="M48 76 C48 94 72 94 72 76" stroke="#64748b" stroke-width="2.5" fill="none" stroke-linecap="round" />
        <circle cx="60" cy="95" r="4.5" fill="#cbd5e1" stroke="#334155" stroke-width="1.5" />
      ` : ''}

      <!-- Watering Can (Thirsty state) -->
      ${isThirsty ? `
        <rect x="88" y="76" width="16" height="14" rx="3" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5" />
        <path d="M92 76 L92 70 L100 70 L100 76" stroke="#0284c7" stroke-width="1.5" fill="none" />
        <line x1="104" y1="80" x2="114" y2="74" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="116" cy="73" r="1.5" fill="#38bdf8" />
      ` : ''}

      <!-- Harvest Basket (Harvest state) -->
      ${isHarvest ? `
        <ellipse cx="60" cy="112" rx="18" ry="7" fill="#ca8a04" stroke="#854d0e" stroke-width="1.5" />
        <circle cx="53" cy="107" r="4.5" fill="#ef4444" />
        <circle cx="60" cy="106" r="5" fill="#eab308" />
        <circle cx="67" cy="107" r="4.5" fill="#22c55e" />
      ` : ''}

      <!-- Tiny Cute Chubby Hands -->
      <circle cx="26" cy="94" r="6.5" fill="#34d399" stroke="#059669" stroke-width="1.2" />
      <circle cx="94" cy="94" r="6.5" fill="#34d399" stroke="#059669" stroke-width="1.2" />

      <!-- Tiny Cute Boots -->
      <ellipse cx="48" cy="126" rx="8" ry="5.5" fill="#d97706" stroke="#78350f" stroke-width="1.2" />
      <ellipse cx="72" cy="126" rx="8" ry="5.5" fill="#d97706" stroke="#78350f" stroke-width="1.2" />
    </svg>
  `;
}

export function renderMascot(customSpeech = null) {
  const container = document.getElementById('chibi-mascot-widget');
  if (!container) return;

  const preset = MASCOT_STATES[_mascotState] || MASCOT_STATES.optimal;
  const speechText = customSpeech || preset.speech;

  container.innerHTML = `
    <!-- Speech Dialogue Box -->
    <div id="mascot-speech-bubble" style="
      background: #ffffff;
      color: #0f172a;
      border: 2px solid ${preset.badgeColor};
      border-radius: 20px;
      padding: 14px 18px;
      font-size: 13px;
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
          🌱 ${preset.title}
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
        <div style="font-size:10.5px; color:#94a3b8; font-weight:700; margin-bottom:5px;">CHỌN TRẠNG THÁI BÉ MẦM:</div>
        <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:space-between;">
          <button class="chibi-state-chip" onclick="setMascotState('optimal')" title="Tối ưu" style="background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding:3px 6px; cursor:pointer; font-size:11px; font-weight:700; color:#047857;">🌱 Tối ưu</button>
          <button class="chibi-state-chip" onclick="setMascotState('notify')" title="Thông báo" style="background:#f0f9ff; border:1px solid #0284c7; border-radius:8px; padding:3px 6px; cursor:pointer; font-size:11px; font-weight:700; color:#0284c7;">🔔 Nhắc việc</button>
          <button class="chibi-state-chip" onclick="setMascotState('alert')" title="Cảnh báo khẩn" style="background:#fef2f2; border:1px solid #ef4444; border-radius:8px; padding:3px 6px; cursor:pointer; font-size:11px; font-weight:700; color:#b91c1c;">🚨 Cảnh báo</button>
          <button class="chibi-state-chip" onclick="setMascotState('weather_rain')" title="Mưa lớn" style="background:#eff6ff; border:1px solid #3b82f6; border-radius:8px; padding:3px 6px; cursor:pointer; font-size:11px; font-weight:700; color:#1e40af;">🌧️ Mưa dông</button>
          <button class="chibi-state-chip" onclick="setMascotState('weather_sun')" title="Nắng gắt" style="background:#fffbeb; border:1px solid #f59e0b; border-radius:8px; padding:3px 6px; cursor:pointer; font-size:11px; font-weight:700; color:#b45309;">☀️ Nắng gắt</button>
          <button class="chibi-state-chip" onclick="setMascotState('thirsty')" title="Cần tưới" style="background:#f0f9ff; border:1px solid #0ea5e9; border-radius:8px; padding:3px 6px; cursor:pointer; font-size:11px; font-weight:700; color:#0369a1;">🚰 Cần tưới</button>
          <button class="chibi-state-chip" onclick="setMascotState('doctor')" title="Bác sĩ cây" style="background:#fef2f2; border:1px solid #dc2626; border-radius:8px; padding:3px 6px; cursor:pointer; font-size:11px; font-weight:700; color:#991b1b;">🩺 Sâu bệnh</button>
          <button class="chibi-state-chip" onclick="setMascotState('harvest')" title="Thu hoạch" style="background:#f0fdf4; border:1px solid #16a34a; border-radius:8px; padding:3px 6px; cursor:pointer; font-size:11px; font-weight:700; color:#15803d;">🌾 Thu hoạch</button>
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
    <div onclick="onMascotClick()" class="chibi-anime-avatar" title="Bấm vào Bé Mầm để trò chuyện!" style="
      display: flex;
      align-items: flex-end;
      justify-content: center;
      animation: ${_mascotState === 'alert' ? 'mascot-alarm-shake 0.5s infinite' : (_mascotState === 'notify' ? 'mascot-excited-jump 1.5s infinite' : 'mascot-float-bounce 2.5s infinite ease-in-out')};
    ">
      ${_renderAnimeMascotSVG(preset)}
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
  
  const avatar = document.querySelector('.chibi-anime-avatar');
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
