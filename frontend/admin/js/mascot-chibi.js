/**
 * admin/js/mascot-chibi.js - Interactive 3D Animated Chibi Plant Mascot ("Bé Mầm AgTech") for Admin Portal
 */

let _adminMascotState = 'happy';
let _adminIsWalking = true;
let _adminPosX = 270; // Start near sidebar
let _adminWalkDirection = 1;
let _adminWalkInterval = null;

const ADMIN_MASCOT_PRESETS = {
  happy: {
    emoji: '🌱',
    badgeText: 'Hệ thống tối ưu',
    badgeColor: '#10b981',
    leafAngle: 'rotate(5deg)',
    eyes: '^^',
    mouth: 'ᴗ',
    speech: 'Xin chào Admin! Toàn bộ hệ thống trang trại & IoT đang vận hành ổn định 100%! ✨',
    anim: 'mascot-dance 2.2s infinite ease-in-out'
  },
  thirsty: {
    emoji: '💧',
    badgeText: 'Cần tưới nước',
    badgeColor: '#f59e0b',
    leafAngle: 'rotate(-20deg)',
    eyes: '><',
    mouth: 'o',
    speech: 'Có trang trại ghi nhận độ ẩm đất thấp, cần gửi thông báo nhắc nông hộ tưới! 🚰',
    anim: 'mascot-thirst 1.5s infinite ease-in-out'
  },
  rain: {
    emoji: '🌧️',
    badgeText: 'Khí tượng mưa dông',
    badgeColor: '#3b82f6',
    leafAngle: 'rotate(25deg)',
    eyes: '•.•',
    mouth: 'o',
    speech: 'Hệ thống dự báo khí tượng cảnh báo sắp có mưa dông tại các vùng trồng trọng điểm! ☂️',
    anim: 'mascot-rain 1.8s infinite ease-in-out'
  },
  doctor: {
    emoji: '🩺',
    badgeText: 'Cảnh báo dịch hại',
    badgeColor: '#ef4444',
    leafAngle: 'rotate(-10deg)',
    eyes: 'ʘ.ʘ',
    mouth: '—',
    speech: 'Admin ơi, có cây trồng được báo cáo ủ bệnh, hãy kiểm tra danh sách Cây cần theo dõi nhé! 🌿',
    anim: 'mascot-float 2s infinite ease-in-out'
  },
  sleep: {
    emoji: '🌙',
    badgeText: 'Trực đêm 24/7',
    badgeColor: '#8b5cf6',
    leafAngle: 'rotate(-30deg)',
    eyes: '--',
    mouth: 'u',
    speech: 'Máy chủ CSDL & IoT tự động trực 24/7 an toàn. Chúc Admin buổi tối vui vẻ! zZz',
    anim: 'mascot-sleep 3s infinite ease-in-out'
  }
};

function initAdminChibiMascot() {
  let mascotContainer = document.getElementById('admin-chibi-mascot-widget');
  if (!mascotContainer) {
    mascotContainer = document.createElement('div');
    mascotContainer.id = 'admin-chibi-mascot-widget';
    mascotContainer.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 280px;
      z-index: 9999;
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
  if (!document.getElementById('admin-mascot-keyframes-style')) {
    const style = document.createElement('style');
    style.id = 'admin-mascot-keyframes-style';
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
      .admin-mascot-avatar:hover {
        transform: scale(1.15) translateY(-6px) !important;
        cursor: pointer;
      }
      .admin-mascot-btn:hover {
        transform: scale(1.08);
        filter: brightness(1.1);
      }
    `;
    document.head.appendChild(style);
  }

  renderAdminMascot();
  _startAdminPatrol();
}

function _startAdminPatrol() {
  if (_adminWalkInterval) clearInterval(_adminWalkInterval);

  _adminWalkInterval = setInterval(() => {
    if (!_adminIsWalking) return;
    const widget = document.getElementById('admin-chibi-mascot-widget');
    if (!widget) return;

    const minLeft = 280;
    const maxRight = Math.min(window.innerWidth - 120, 580);

    _adminPosX += _adminWalkDirection * 1.5;
    if (_adminPosX >= maxRight) {
      _adminPosX = maxRight;
      _adminWalkDirection = -1;
    } else if (_adminPosX <= minLeft) {
      _adminPosX = minLeft;
      _adminWalkDirection = 1;
    }

    widget.style.left = `${_adminPosX}px`;
    const avatar = widget.querySelector('.admin-mascot-avatar');
    if (avatar) {
      avatar.style.transform = _adminWalkDirection === 1 ? 'scaleX(1)' : 'scaleX(-1)';
    }
  }, 100);
}

function setAdminMascotState(stateName, customSpeech = null) {
  if (ADMIN_MASCOT_PRESETS[stateName]) {
    _adminMascotState = stateName;
  }
  renderAdminMascot(customSpeech);
}

function toggleAdminMascotWalking() {
  _adminIsWalking = !_adminIsWalking;
  renderAdminMascot(_adminIsWalking ? 'Em đang chạy tuần tra quanh hệ thống giúp Admin! 🏃💨' : 'Em tạm dừng chân ở đây nha! 🌿');
}

function renderAdminMascot(customSpeech = null) {
  const container = document.getElementById('admin-chibi-mascot-widget');
  if (!container) return;

  const preset = ADMIN_MASCOT_PRESETS[_adminMascotState] || ADMIN_MASCOT_PRESETS.happy;
  const speechText = customSpeech || preset.speech;

  container.innerHTML = `
    <!-- Speech Bubble with Quick Status Changer -->
    <div id="admin-mascot-speech-bubble" style="
      background: #ffffff;
      color: #0f172a;
      border: 2px solid ${preset.badgeColor};
      border-radius: 18px;
      padding: 12px 16px;
      font-size: 12px;
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
          ${preset.emoji} Bé Mầm AgTech
        </span>
        <span style="font-size:11px; color:#64748b; font-weight:700;">${preset.badgeText}</span>
      </div>
      
      <div style="color:#1e293b; margin-bottom:8px;">${speechText}</div>

      <!-- Quick Interactive Emotion Switcher -->
      <div style="border-top:1px solid #f1f5f9; padding-top:6px; display:flex; gap:4px; justify-content:space-between;">
        <button class="admin-mascot-btn" onclick="setAdminMascotState('happy')" title="Vui vẻ" style="background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding:2px 6px; cursor:pointer; font-size:12px;">🌱</button>
        <button class="admin-mascot-btn" onclick="setAdminMascotState('thirsty')" title="Khát nước" style="background:#fffbeb; border:1px solid #f59e0b; border-radius:8px; padding:2px 6px; cursor:pointer; font-size:12px;">💧</button>
        <button class="admin-mascot-btn" onclick="setAdminMascotState('rain')" title="Trú mưa" style="background:#eff6ff; border:1px solid #3b82f6; border-radius:8px; padding:2px 6px; cursor:pointer; font-size:12px;">🌧️</button>
        <button class="admin-mascot-btn" onclick="setAdminMascotState('doctor')" title="Bác sĩ cây" style="background:#fef2f2; border:1px solid #ef4444; border-radius:8px; padding:2px 6px; cursor:pointer; font-size:12px;">🩺</button>
        <button class="admin-mascot-btn" onclick="setAdminMascotState('sleep')" title="Ngủ đêm" style="background:#faf5ff; border:1px solid #8b5cf6; border-radius:8px; padding:2px 6px; cursor:pointer; font-size:12px;">🌙</button>
        <button class="admin-mascot-btn" onclick="toggleAdminMascotWalking()" title="Bật/Tắt chạy tuần tra" style="background:#f1f5f9; border:1px solid #94a3b8; border-radius:8px; padding:2px 6px; cursor:pointer; font-size:12px;">🏃</button>
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
      <div class="admin-mascot-avatar" onclick="onAdminMascotClick()" title="Bấm vào để tương tác với Bé Mầm!" style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 74px;
        height: 74px;
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

function onAdminMascotClick() {
  const greetings = [
    'Chào Admin! Các trạm quan trắc IoT đang gửi dữ liệu thời gian thực rất mượt mà! 📡✨',
    'Admin có muốn lọc danh sách các cây đang bệnh để điều phối nhân sự không? 🩺',
    'Em đang tuần tra kiểm tra ranh giới bản đồ GIS cho tất cả các trang trại! 🗺️',
    'CSDL PostgreSQL đang trong trạng thái hoàn hảo, không có lỗi phân mảnh! 🚀',
    'Em là Bé Mầm AgTech - Trợ lý số đắc lực cho Quản trị viên Tanbao Corp! 🧑‍💻🌱'
  ];
  const randomGreet = greetings[Math.floor(Math.random() * greetings.length)];
  
  const avatar = document.querySelector('.admin-mascot-avatar');
  if (avatar) {
    avatar.style.transform = 'scale(1.3) translateY(-18px) rotate(15deg)';
    setTimeout(() => {
      avatar.style.transform = 'scale(1) translateY(0) rotate(0deg)';
    }, 400);
  }

  setAdminMascotState(_adminMascotState, randomGreet);
}

window.onAdminMascotClick = onAdminMascotClick;
window.setAdminMascotState = setAdminMascotState;
window.toggleAdminMascotWalking = toggleAdminMascotWalking;
window.initAdminChibiMascot = initAdminChibiMascot;
