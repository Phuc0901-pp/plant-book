/**
 * modules/mascot-chibi.js - Interactive Bé Mầm Chibi Mascot Widget (Fixed at Bottom-Right)
 */

let _mascotState = 'happy';

const MASCOT_PRESETS = {
  happy: {
    emoji: '🌱',
    badgeText: 'Vui vẻ & Xanh tốt',
    badgeColor: '#10b981',
    speech: 'Xin chào chủ vườn! Cây trồng hôm nay đang phát triển rất xanh tốt ạ! ✨',
    anim: 'chibi-float 2.5s infinite ease-in-out'
  },
  thirsty: {
    emoji: '💧',
    badgeText: 'Khát nước',
    badgeColor: '#f59e0b',
    speech: 'Độ ẩm đất hơi thấp rồi, em chuẩn bị sẵn bình tưới nước mát cho vườn đây bác ơi! 🚰',
    anim: 'chibi-bounce 1.6s infinite ease-in-out'
  },
  rain: {
    emoji: '🌧️',
    badgeText: 'Trú mưa bão',
    badgeColor: '#3b82f6',
    speech: 'Dự báo trời sắp mưa rào, bác nhớ hoãn bón phân để tránh bị rửa trôi nhé! ☂️',
    anim: 'chibi-float 2s infinite ease-in-out'
  },
  doctor: {
    emoji: '🩺',
    badgeText: 'Bác sĩ cây trồng',
    badgeColor: '#ef4444',
    speech: 'Có cây đang ủ bệnh hoặc cần xới gốc, em đã chuẩn bị sẵn xẻng làm vườn giúp bác nhé! 🌿',
    anim: 'chibi-bounce 2s infinite ease-in-out'
  },
  sleep: {
    emoji: '🌙',
    badgeText: 'Nghỉ ngơi ban đêm',
    badgeColor: '#8b5cf6',
    speech: 'Vườn đã tưới đủ, công việc hoàn tất. Chúc chủ vườn ngủ ngon giấc! zZz',
    anim: 'chibi-sleep 3s infinite ease-in-out'
  }
};

export function initChibiMascot() {
  let mascotContainer = document.getElementById('chibi-mascot-widget');
  if (!mascotContainer) {
    mascotContainer = document.createElement('div');
    mascotContainer.id = 'chibi-mascot-widget';
    mascotContainer.style.cssText = `
      position: fixed;
      bottom: 24px;
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

  // Inject animation styles
  if (!document.getElementById('chibi-keyframes-style')) {
    const style = document.createElement('style');
    style.id = 'chibi-keyframes-style';
    style.textContent = `
      @keyframes chibi-float {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        50% { transform: translateY(-10px) rotate(2deg); }
      }
      @keyframes chibi-bounce {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-14px) scale(1.04); }
      }
      @keyframes chibi-sleep {
        0%, 100% { transform: translateY(0); opacity: 0.95; }
        50% { transform: translateY(4px); opacity: 0.85; }
      }
      @keyframes pop-in {
        0% { transform: scale(0.6) translateY(20px); opacity: 0; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }
      .chibi-avatar-img:hover {
        transform: scale(1.12) rotate(4deg) !important;
        cursor: pointer;
      }
      .chibi-state-btn:hover {
        transform: scale(1.1);
        filter: brightness(1.1);
      }
    `;
    document.head.appendChild(style);
  }

  renderMascot();
}

export function setMascotState(stateName, customSpeech = null) {
  if (MASCOT_PRESETS[stateName]) {
    _mascotState = stateName;
  }
  renderMascot(customSpeech);
}

export function renderMascot(customSpeech = null) {
  const container = document.getElementById('chibi-mascot-widget');
  if (!container) return;

  const preset = MASCOT_PRESETS[_mascotState] || MASCOT_PRESETS.happy;
  const speechText = customSpeech || preset.speech;

  container.innerHTML = `
    <!-- Speech Bubble with Status & Emotion Switcher -->
    <div id="mascot-speech-bubble" style="
      background: #ffffff;
      color: #0f172a;
      border: 2px solid ${preset.badgeColor};
      border-radius: 18px;
      padding: 12px 16px;
      font-size: 12.5px;
      font-weight: 700;
      line-height: 1.45;
      max-width: 260px;
      box-shadow: 0 12px 30px -6px rgba(0,0,0,0.22), 0 6px 12px -4px rgba(0,0,0,0.1);
      margin-bottom: 12px;
      position: relative;
      animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    ">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:6px;">
        <span style="background:${preset.badgeColor}; color:white; font-size:10.5px; font-weight:800; padding:2px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;">
          ${preset.emoji} Bé Mầm AgTech
        </span>
        <span style="font-size:11px; color:#64748b; font-weight:700;">${preset.badgeText}</span>
      </div>
      
      <div style="color:#1e293b; margin-bottom:8px;">${speechText}</div>

      <!-- Emotion Selector -->
      <div style="border-top:1px solid #f1f5f9; padding-top:6px; display:flex; gap:5px; justify-content:space-between;">
        <button class="chibi-state-btn" onclick="setMascotState('happy')" title="Vui vẻ" style="background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding:2px 7px; cursor:pointer; font-size:12px;">🌱</button>
        <button class="chibi-state-btn" onclick="setMascotState('thirsty')" title="Khát nước" style="background:#fffbeb; border:1px solid #f59e0b; border-radius:8px; padding:2px 7px; cursor:pointer; font-size:12px;">💧</button>
        <button class="chibi-state-btn" onclick="setMascotState('rain')" title="Trú mưa" style="background:#eff6ff; border:1px solid #3b82f6; border-radius:8px; padding:2px 7px; cursor:pointer; font-size:12px;">🌧️</button>
        <button class="chibi-state-btn" onclick="setMascotState('doctor')" title="Bác sĩ cây" style="background:#fef2f2; border:1px solid #ef4444; border-radius:8px; padding:2px 7px; cursor:pointer; font-size:12px;">🩺</button>
        <button class="chibi-state-btn" onclick="setMascotState('sleep')" title="Ngủ đêm" style="background:#faf5ff; border:1px solid #8b5cf6; border-radius:8px; padding:2px 7px; cursor:pointer; font-size:12px;">🌙</button>
      </div>

      <!-- Triangle Pointer to Mascot on the right -->
      <div style="
        position: absolute;
        bottom: -9px;
        right: 36px;
        width: 0;
        height: 0;
        border-left: 9px solid transparent;
        border-right: 9px solid transparent;
        border-top: 9px solid #ffffff;
      "></div>
    </div>

    <!-- Cute Chibi Character Image (From User Artwork) -->
    <div onclick="onMascotClick()" class="chibi-avatar-img" title="Bấm vào Bé Mầm để trò chuyện!" style="
      width: 92px;
      height: 92px;
      border-radius: 50%;
      background: #ffffff;
      border: 3.5px solid ${preset.badgeColor};
      box-shadow: 0 12px 28px -4px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.1);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: ${preset.anim};
      transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    ">
      <img src="/user/img/chibi_mascot.png" alt="Bé Mầm AgTech" style="width:100%; height:100%; object-fit:cover; object-position:center top; display:block;">
    </div>
  `;
}

export function onMascotClick() {
  const greetings = [
    'Chào bác nông hộ! Em đã tưới nước và chăm chút cho luống cây rất kỹ rồi ạ! 🌱✨',
    'Bác nhớ tưới cây vào sáng sớm hoặc chiều mát nhé! 💧',
    'Em luôn túc trực 24/7 theo dõi các trạm cảm biến IoT và vườn cây giúp bác! 📡',
    'Bác có muốn ghi nhanh nhật ký chăm sóc cây không? Bấm nút (+) màu xanh nhé! 📝',
    'Em là Bé Mầm AgTech - Bạn đồng hành đáng yêu của nhà nông! 🧑‍🌾'
  ];
  const randomGreet = greetings[Math.floor(Math.random() * greetings.length)];
  
  const avatar = document.querySelector('.chibi-avatar-img');
  if (avatar) {
    avatar.style.transform = 'scale(1.25) translateY(-16px) rotate(10deg)';
    setTimeout(() => {
      avatar.style.transform = 'scale(1) translateY(0) rotate(0deg)';
    }, 400);
  }

  setMascotState(_mascotState, randomGreet);
}

window.onMascotClick = onMascotClick;
window.setMascotState = setMascotState;
window.initChibiMascot = initChibiMascot;
