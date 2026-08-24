/**
 * modules/mascot-chibi.js - Interactive 3D Animated Chibi Plant Mascot ("Bé Mầm AgTech")
 * Tự động chạy tuần tra, nhảy múa và biến đổi 5 trạng thái cảm xúc theo IoT & Thời tiết
 */

let _mascotState = 'happy'; // 'happy', 'thirsty', 'rain', 'doctor', 'sleep', 'running'
let _isWalking = true;
let _posX = 40;
let _walkDirection = 1; // 1: right, -1: left
let _walkInterval = null;

const MASCOT_PRESETS = {
  happy: {
    name: 'Vui vẻ & Xanh tốt',
    emoji: '🌱',
    badgeText: 'Cây khỏe mạnh',
    badgeColor: '#10b981',
    leafAngle: 'rotate(5deg)',
    eyes: '^^',
    mouth: 'ᴗ',
    speech: 'Vườn hôm nay rất xanh tốt và đầy sức sống, chủ vườn ơi! ✨',
    anim: 'mascot-dance 2.2s infinite ease-in-out'
  },
  thirsty: {
    name: 'Khát nước',
    emoji: '💧',
    badgeText: 'Cần tưới nước',
    badgeColor: '#f59e0b',
    leafAngle: 'rotate(-20deg)',
    eyes: '><',
    mouth: 'o',
    speech: 'Độ ẩm đất hơi thấp rồi, cho vườn uống thêm nước mát đi bác ơi! 🚰',
    anim: 'mascot-thirst 1.5s infinite ease-in-out'
  },
  rain: {
    name: 'Trú mưa bão',
    emoji: '🌧️',
    badgeText: 'Dự báo mưa lớn',
    badgeColor: '#3b82f6',
    leafAngle: 'rotate(25deg)',
    eyes: '•.•',
    mouth: 'o',
    speech: 'Dự báo trời sắp mưa rào, nhớ hoãn bón phân để tránh bị rửa trôi nhé! ☂️',
    anim: 'mascot-rain 1.8s infinite ease-in-out'
  },
  doctor: {
    name: 'Bác sĩ cây trồng',
    emoji: '🩺',
    badgeText: 'Chẩn đoán bệnh',
    badgeColor: '#ef4444',
    leafAngle: 'rotate(-10deg)',
    eyes: 'ʘ.ʘ',
    mouth: '—',
    speech: 'Có cây đang ủ bệnh hoặc cần tỉa cành, bác kiểm tra mục Cây bệnh nhé! 🌿',
    anim: 'mascot-float 2s infinite ease-in-out'
  },
  sleep: {
    name: 'Nghỉ ngơi ban đêm',
    emoji: '🌙',
    badgeText: 'Ngủ đêm',
    badgeColor: '#8b5cf6',
    leafAngle: 'rotate(-30deg)',
    eyes: '--',
    mouth: 'u',
    speech: 'Vườn đã tưới đủ, công việc hoàn tất. Chúc chủ vườn ngủ ngon giấc! zZz',
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
      bottom: 80px;
      left: 20px;
      z-index: 9990;
      display: flex;
      flex-direction: column;
      align-items: center;
      pointer-events: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      user-select: none;
      transition: left 0.1s linear;
    `;
    document.body.appendChild(mascotContainer);
  }

  // Inject 3D keyframe animations & styles
  if (!document.getElementById('mascot-keyframes-style')) {
    const style = document.createElement('style');
    style.id = 'mascot-keyframes-style';
    style.textContent = `
      @keyframes mascot-dance {
        0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
        25% { transform: translateY(-12px) rotate(-6deg) scale(1.05); }
        75% { transform: translateY(-6px) rotate(6deg) scale(0.98); }
      }
      @keyframes mascot-thirst {
        0%, 100% { transform: translateY(0) scale(0.96); }
        50% { transform: translateY(6px) scale(0.90); }
      }
      @keyframes mascot-rain {
        0%, 100% { transform: translateY(0) rotate(3deg); }
        50% { transform: translateY(-8px) rotate(-3deg); }
      }
      @keyframes mascot-sleep {
        0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.95; }
        50% { transform: translateY(5px) rotate(4deg); opacity: 0.8; }
      }
      @keyframes mascot-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-14px); }
      }
      @keyframes mascot-walk-legs {
        0%, 100% { transform: rotate(-25deg); }
        50% { transform: rotate(25deg); }
      }
      @keyframes pop-in {
        0% { transform: scale(0.6) translateY(20px); opacity: 0; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }
      .mascot-avatar:hover {
        transform: scale(1.15) translateY(-6px) !important;
        cursor: pointer;
      }
      .mascot-state-btn:hover {
        transform: scale(1.08);
        filter: brightness(1.1);
      }
    `;
    document.head.appendChild(style);
  }

  renderMascot();
  _startAutoPatrol();
  _evaluateMascotState();
}

function _startAutoPatrol() {
  if (_walkInterval) clearInterval(_walkInterval);

  _walkInterval = setInterval(() => {
    if (!_isWalking) return;
    const widget = document.getElementById('chibi-mascot-widget');
    if (!widget) return;

    const maxRight = Math.min(window.innerWidth - 120, 260); // Patrol in left zone
    const minLeft = 16;

    _posX += _walkDirection * 1.5;
    if (_posX >= maxRight) {
      _posX = maxRight;
      _walkDirection = -1;
    } else if (_posX <= minLeft) {
      _posX = minLeft;
      _walkDirection = 1;
    }

    widget.style.left = `${_posX}px`;
    const avatar = widget.querySelector('.mascot-avatar');
    if (avatar) {
      avatar.style.transform = _walkDirection === 1 ? 'scaleX(1)' : 'scaleX(-1)';
    }
  }, 100);
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

export function toggleMascotWalking() {
  _isWalking = !_isWalking;
  renderMascot(_isWalking ? 'Em đang chạy tuần tra quanh vườn giúp bác! 🏃💨' : 'Em tạm dừng chân nghỉ ngơi ở đây nha! 🌿');
}

export function renderMascot(customSpeech = null) {
  const container = document.getElementById('chibi-mascot-widget');
  if (!container) return;

  const preset = MASCOT_PRESETS[_mascotState] || MASCOT_PRESETS.happy;
  const speechText = customSpeech || preset.speech;

  container.innerHTML = `
    <!-- Speech Bubble with Quick Status Changer -->
    <div id="mascot-speech-bubble" style="
      background: #ffffff;
      color: #0f172a;
      border: 2px solid ${preset.badgeColor};
      border-radius: 18px;
      padding: 12px 16px;
      font-size: 12.5px;
      font-weight: 700;
      line-height: 1.45;
      max-width: 250px;
      box-shadow: 0 12px 30px -6px rgba(0,0,0,0.2), 0 6px 12px -4px rgba(0,0,0,0.1);
      margin-bottom: 12px;
      position: relative;
      animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    ">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:6px;">
        <span style="background:${preset.badgeColor}; color:white; font-size:10.5px; font-weight:800; padding:2px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;">
          ${preset.emoji} Bé Mầm 3D
        </span>
        <span style="font-size:11px; color:#64748b; font-weight:700;">${preset.badgeText}</span>
      </div>
      
      <div style="color:#1e293b; margin-bottom:8px;">${speechText}</div>

      <!-- Quick Interactive Emotion Switcher -->
      <div style="border-top:1px solid #f1f5f9; padding-top:6px; display:flex; gap:4px; justify-content:space-between;">
        <button class="mascot-state-btn" onclick="setMascotState('happy')" title="Vui vẻ" style="background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding:2px 6px; cursor:pointer; font-size:12px;">🌱</button>
        <button class="mascot-state-btn" onclick="setMascotState('thirsty')" title="Khát nước" style="background:#fffbeb; border:1px solid #f59e0b; border-radius:8px; padding:2px 6px; cursor:pointer; font-size:12px;">💧</button>
        <button class="mascot-state-btn" onclick="setMascotState('rain')" title="Trú mưa" style="background:#eff6ff; border:1px solid #3b82f6; border-radius:8px; padding:2px 6px; cursor:pointer; font-size:12px;">🌧️</button>
        <button class="mascot-state-btn" onclick="setMascotState('doctor')" title="Bác sĩ cây" style="background:#fef2f2; border:1px solid #ef4444; border-radius:8px; padding:2px 6px; cursor:pointer; font-size:12px;">🩺</button>
        <button class="mascot-state-btn" onclick="setMascotState('sleep')" title="Ngủ đêm" style="background:#faf5ff; border:1px solid #8b5cf6; border-radius:8px; padding:2px 6px; cursor:pointer; font-size:12px;">🌙</button>
        <button class="mascot-state-btn" onclick="toggleMascotWalking()" title="Bật/Tắt chạy tuần tra" style="background:#f1f5f9; border:1px solid #94a3b8; border-radius:8px; padding:2px 6px; cursor:pointer; font-size:12px;">🏃</button>
      </div>

      <!-- Triangle Pointer -->
      <div style="
        position: absolute;
        bottom: -9px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 9px solid transparent;
        border-right: 9px solid transparent;
        border-top: 9px solid #ffffff;
      "></div>
    </div>

    <!-- 3D Chibi Mascot Body -->
    <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
      <div class="mascot-avatar" onclick="onMascotClick()" title="Bấm vào để tương tác và nghe Bé Mầm đọc lời khuyên!" style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 76px;
        height: 76px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 35%, #34d399 0%, #10b981 40%, #047857 100%);
        box-shadow: 0 14px 28px -4px rgba(4, 120, 87, 0.45), inset 0 3px 8px rgba(255,255,255,0.7), inset 0 -4px 8px rgba(0,0,0,0.25);
        border: 3.5px solid #ffffff;
        position: relative;
        animation: ${preset.anim};
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      ">
        <!-- Mini Vietnamese Conical Hat (Nón lá 3D) -->
        <div style="
          position: absolute;
          top: -16px;
          left: 18px;
          width: 40px;
          height: 22px;
          background: linear-gradient(135deg, #fef08a 0%, #eab308 70%, #ca8a04 100%);
          clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
          transform: rotate(-12deg);
          filter: drop-shadow(0 3px 5px rgba(0,0,0,0.3));
        "></div>

        <!-- Sprout Leaves on Head -->
        <div style="
          position: absolute;
          top: -20px;
          right: 18px;
          font-size: 22px;
          transform: ${preset.leafAngle};
          transition: transform 0.3s ease;
          filter: drop-shadow(0 3px 5px rgba(0,0,0,0.25));
        ">🌱</div>

        <!-- Cute Chibi Face -->
        <div style="text-align: center; color: white;">
          <div style="font-size: 18px; font-weight: 900; letter-spacing: 5px; line-height: 1;">
            ${preset.eyes}
          </div>
          <div style="font-size: 14px; font-weight: 900; margin-top: 1px;">
            ${preset.mouth}
          </div>
        </div>

        <!-- Rosy Cheeks -->
        <div style="position: absolute; bottom: 24px; left: 12px; width: 9px; height: 6px; background: #f43f5e; border-radius: 50%; opacity: 0.65;"></div>
        <div style="position: absolute; bottom: 24px; right: 12px; width: 9px; height: 6px; background: #f43f5e; border-radius: 50%; opacity: 0.65;"></div>
      </div>

      <!-- Tiny 3D Running Feet -->
      <div style="display:flex; gap:16px; margin-top:-6px; z-index:-1;">
        <div style="width:12px; height:10px; background:#047857; border-radius:6px; border:2px solid #ffffff; animation: mascot-walk-legs 0.5s infinite alternate;"></div>
        <div style="width:12px; height:10px; background:#047857; border-radius:6px; border:2px solid #ffffff; animation: mascot-walk-legs 0.5s infinite alternate-reverse;"></div>
      </div>
    </div>
  `;
}

export function onMascotClick() {
  const greetings = [
    'Chào bác nông hộ! Hôm nay vườn cây xanh tốt, rễ tơ hút ẩm rất đều ạ! 🌱✨',
    'Bác nhớ tưới cây vào buổi sáng sớm hoặc chiều mát để đạt hiệu quả cao nhất nhé! 💧',
    'Em luôn túc trực 24/7 theo dõi các trạm cảm biến IoT và thời tiết giúp bác! 📡',
    'Bác có muốn ghi nhanh nhật ký chăm sóc cây không? Bấm nút (+) màu xanh nhé! 📝',
    'Em là Bé Mầm AgTech - Bạn đồng hành số thông minh của nhà nông! 🧑‍🌾'
  ];
  const randomGreet = greetings[Math.floor(Math.random() * greetings.length)];
  
  // Jump animation
  const avatar = document.querySelector('.mascot-avatar');
  if (avatar) {
    avatar.style.transform = 'scale(1.3) translateY(-18px) rotate(15deg)';
    setTimeout(() => {
      avatar.style.transform = 'scale(1) translateY(0) rotate(0deg)';
    }, 400);
  }

  setMascotState(_mascotState, randomGreet);
}

window.onMascotClick = onMascotClick;
window.setMascotState = setMascotState;
window.toggleMascotWalking = toggleMascotWalking;
window.initChibiMascot = initChibiMascot;
