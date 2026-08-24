/**
 * modules/mascot-chibi.js - Interactive 3D Chibi Plant Mascot ("Bé Mầm AgTech")
 */

let _mascotState = 'happy'; // 'happy', 'thirsty', 'rain', 'doctor', 'sleep'
let _talkTimeout = null;

const MASCOT_PRESETS = {
  happy: {
    emoji: '🌱',
    badgeText: 'Vui tươi',
    badgeColor: '#10b981',
    leafAngle: 'rotate(0deg)',
    eyes: '^^',
    mouth: 'ᴗ',
    speech: 'Vườn hôm nay rất xanh tốt và đầy sức sống, chủ vườn ơi! ✨',
    anim: 'mascot-dance 2.5s infinite ease-in-out'
  },
  thirsty: {
    emoji: '💧',
    badgeText: 'Khát nước',
    badgeColor: '#f59e0b',
    leafAngle: 'rotate(-15deg)',
    eyes: '><',
    mouth: 'o',
    speech: 'Độ ẩm đất hơi thấp rồi, cho vườn uống thêm nước mát đi bác ơi! 🚰',
    anim: 'mascot-thirst 1.8s infinite ease-in-out'
  },
  rain: {
    emoji: '🌧️',
    badgeText: 'Trú mưa',
    badgeColor: '#3b82f6',
    leafAngle: 'rotate(20deg)',
    eyes: '•.•',
    mouth: 'o',
    speech: 'Dự báo trời sắp mưa rào, nhớ hoãn bón phân để tránh bị rửa trôi nhé! ☂️',
    anim: 'mascot-rain 2s infinite ease-in-out'
  },
  doctor: {
    emoji: '🩺',
    badgeText: 'Bác sĩ cây',
    badgeColor: '#ef4444',
    leafAngle: 'rotate(-5deg)',
    eyes: 'ʘ.ʘ',
    mouth: '—',
    speech: 'Có cây đang ủ bệnh hoặc cần tỉa cành, bác kiểm tra mục Cây bệnh nhé! 🌿',
    anim: 'mascot-float 2.2s infinite ease-in-out'
  },
  sleep: {
    emoji: '🌙',
    badgeText: 'Nghỉ ngơi',
    badgeColor: '#8b5cf6',
    leafAngle: 'rotate(-25deg)',
    eyes: '--',
    mouth: 'u',
    speech: 'Đã hoàn thành công việc cả ngày, chúc chủ vườn ngủ ngon giấc! zZz',
    anim: 'mascot-sleep 3s infinite ease-in-out'
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
      left: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      pointer-events: auto;
      font-family: inherit;
      user-select: none;
    `;
    document.body.appendChild(mascotContainer);
  }

  // Inject 3D keyframe animations into head
  if (!document.getElementById('mascot-keyframes-style')) {
    const style = document.createElement('style');
    style.id = 'mascot-keyframes-style';
    style.textContent = `
      @keyframes mascot-dance {
        0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
        25% { transform: translateY(-8px) rotate(-4deg) scale(1.03); }
        75% { transform: translateY(-4px) rotate(4deg) scale(0.98); }
      }
      @keyframes mascot-thirst {
        0%, 100% { transform: translateY(0) scale(0.96); }
        50% { transform: translateY(4px) scale(0.92); }
      }
      @keyframes mascot-rain {
        0%, 100% { transform: translateY(0) rotate(2deg); }
        50% { transform: translateY(-5px) rotate(-2deg); }
      }
      @keyframes mascot-sleep {
        0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.95; }
        50% { transform: translateY(4px) rotate(3deg); opacity: 0.8; }
      }
      @keyframes mascot-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      @keyframes pop-in {
        0% { transform: scale(0.6) translateY(20px); opacity: 0; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }
      .mascot-avatar:hover {
        transform: scale(1.12) translateY(-4px) !important;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  renderMascot();
  _evaluateMascotState();
}

function _evaluateMascotState() {
  const hour = new Date().getHours();
  if (hour >= 21 || hour < 5) {
    setMascotState('sleep');
  } else {
    setMascotState('happy');
  }
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
    <!-- Speech Bubble -->
    <div id="mascot-speech-bubble" style="
      background: #ffffff;
      color: #0f172a;
      border: 2px solid ${preset.badgeColor};
      border-radius: 16px;
      padding: 10px 14px;
      font-size: 12.5px;
      font-weight: 700;
      line-height: 1.45;
      max-width: 240px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1);
      margin-bottom: 10px;
      position: relative;
      animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    ">
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
        <span style="background:${preset.badgeColor}; color:white; font-size:10px; font-weight:800; padding:2px 8px; border-radius:10px;">
          ${preset.emoji} Bé Mầm
        </span>
        <span style="font-size:10.5px; color:#64748b; font-weight:600;">${preset.badgeText}</span>
      </div>
      <div>${speechText}</div>
      <!-- Triangle Pointer -->
      <div style="
        position: absolute;
        bottom: -8px;
        left: 28px;
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 8px solid #ffffff;
      "></div>
    </div>

    <!-- 3D Chibi Mascot Body -->
    <div class="mascot-avatar" onclick="onMascotClick()" title="Bấm vào để tương tác với Bé Mầm!" style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #10b981 0%, #059669 60%, #047857 100%);
      box-shadow: 0 12px 24px -4px rgba(5,150,105,0.4), inset 0 2px 6px rgba(255,255,255,0.6);
      border: 3px solid #ffffff;
      position: relative;
      animation: ${preset.anim};
      transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    ">
      <!-- Mini Vietnamese Conical Hat (Nón lá) -->
      <div style="
        position: absolute;
        top: -14px;
        left: 18px;
        width: 36px;
        height: 20px;
        background: linear-gradient(135deg, #fef08a 0%, #eab308 100%);
        clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
        transform: rotate(-10deg);
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));
      "></div>

      <!-- Sprout Leaves on Head -->
      <div style="
        position: absolute;
        top: -18px;
        right: 18px;
        font-size: 20px;
        transform: ${preset.leafAngle};
        transition: transform 0.3s ease;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
      ">🌱</div>

      <!-- Cute Chibi Face -->
      <div style="text-align: center; color: white;">
        <div style="font-size: 16px; font-weight: 900; letter-spacing: 4px; line-height: 1;">
          ${preset.eyes}
        </div>
        <div style="font-size: 13px; font-weight: 900; margin-top: 1px;">
          ${preset.mouth}
        </div>
      </div>

      <!-- Rosy Cheeks -->
      <div style="position: absolute; bottom: 22px; left: 12px; width: 8px; height: 5px; background: #f43f5e; border-radius: 50%; opacity: 0.6;"></div>
      <div style="position: absolute; bottom: 22px; right: 12px; width: 8px; height: 5px; background: #f43f5e; border-radius: 50%; opacity: 0.6;"></div>
    </div>
  `;
}

export function onMascotClick() {
  const greetings = [
    'Chào bác nông hộ! Hôm nay vườn của mình rất tươi tốt ạ! 🌱✨',
    'Bác nhớ tưới cây vào buổi sáng sớm hoặc chiều mát nhé! 💧',
    'Em luôn túc trực 24/7 theo dõi các trạm cảm biến IoT giúp bác! 📡',
    'Bác có muốn ghi nhanh nhật ký chăm sóc cây không? Bấm nút (+) màu xanh nhé! 📝',
    'Em là Bé Mầm AgTech - Bạn đồng hành thông minh của nhà nông! 🧑‍🌾'
  ];
  const randomGreet = greetings[Math.floor(Math.random() * greetings.length)];
  
  // Jump animation
  const avatar = document.querySelector('.mascot-avatar');
  if (avatar) {
    avatar.style.transform = 'scale(1.25) translateY(-14px) rotate(15deg)';
    setTimeout(() => {
      avatar.style.transform = 'scale(1) translateY(0) rotate(0deg)';
    }, 400);
  }

  setMascotState('happy', randomGreet);
}
window.onMascotClick = onMascotClick;
window.setMascotState = setMascotState;
window.initChibiMascot = initChibiMascot;
