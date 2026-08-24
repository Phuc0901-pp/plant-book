/**
 * admin/js/mascot-chibi.js - Interactive Free-Standing Bé Mầm Chibi Character (Bottom-Right Cutout Mascot)
 */

let _adminMascotState = 'happy';

const ADMIN_MASCOT_PRESETS = {
  happy: {
    emoji: '🌱',
    badgeText: 'Hệ thống tối ưu',
    badgeColor: '#10b981',
    speech: 'Xin chào Admin! Em đã kiểm tra và tưới nước cho toàn bộ hệ thống rồi ạ! ✨',
    anim: 'chibi-float 2.5s infinite ease-in-out'
  },
  thirsty: {
    emoji: '💧',
    badgeText: 'Cần tưới nước',
    badgeColor: '#f59e0b',
    speech: 'Có trang trại ghi nhận độ ẩm đất thấp, em xách sẵn bình tưới chuẩn bị hỗ trợ đây ạ! 🚰',
    anim: 'chibi-bounce 1.6s infinite ease-in-out'
  },
  rain: {
    emoji: '🌧️',
    badgeText: 'Khí tượng mưa dông',
    badgeColor: '#3b82f6',
    speech: 'Hệ thống dự báo sắp có mưa dông, Admin nhắc nông hộ tạm hoãn bón phân nhé! ☂️',
    anim: 'chibi-float 2s infinite ease-in-out'
  },
  doctor: {
    emoji: '🩺',
    badgeText: 'Cảnh báo dịch hại',
    badgeColor: '#ef4444',
    speech: 'Có cây trồng đang cần theo dõi, em cầm sẵn xẻng làm vườn đi kiểm tra ngay đây! 🌿',
    anim: 'chibi-bounce 2s infinite ease-in-out'
  },
  sleep: {
    emoji: '🌙',
    badgeText: 'Trực đêm 24/7',
    badgeColor: '#8b5cf6',
    speech: 'Máy chủ CSDL & IoT tự động trực 24/7 an toàn. Chúc Admin buổi tối an lành! zZz',
    anim: 'chibi-sleep 3s infinite ease-in-out'
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

  // Inject animation styles
  if (!document.getElementById('admin-chibi-keyframes-style')) {
    const style = document.createElement('style');
    style.id = 'admin-chibi-keyframes-style';
    style.textContent = `
      @keyframes chibi-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }
      @keyframes chibi-bounce {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-12px) scale(1.03); }
      }
      @keyframes chibi-sleep {
        0%, 100% { transform: translateY(0); opacity: 0.95; }
        50% { transform: translateY(3px); opacity: 0.85; }
      }
      @keyframes pop-in {
        0% { transform: scale(0.6) translateY(20px); opacity: 0; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }
      .admin-chibi-sprite {
        cursor: pointer;
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .admin-chibi-sprite:hover {
        transform: scale(1.1) translateY(-6px) !important;
      }
      .admin-chibi-btn:hover {
        transform: scale(1.1);
        filter: brightness(1.1);
      }
    `;
    document.head.appendChild(style);
  }

  renderAdminMascot();
}

function setAdminMascotState(stateName, customSpeech = null) {
  if (ADMIN_MASCOT_PRESETS[stateName]) {
    _adminMascotState = stateName;
  }
  renderAdminMascot(customSpeech);
}

function renderAdminMascot(customSpeech = null) {
  const container = document.getElementById('admin-chibi-mascot-widget');
  if (!container) return;

  const preset = ADMIN_MASCOT_PRESETS[_adminMascotState] || ADMIN_MASCOT_PRESETS.happy;
  const speechText = customSpeech || preset.speech;

  container.innerHTML = `
    <!-- Speech Bubble with Status & Emotion Switcher -->
    <div id="admin-mascot-speech-bubble" style="
      background: #ffffff;
      color: #0f172a;
      border: 2px solid ${preset.badgeColor};
      border-radius: 18px;
      padding: 12px 16px;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.45;
      max-width: 260px;
      box-shadow: 0 12px 30px -6px rgba(0,0,0,0.22), 0 6px 12px -4px rgba(0,0,0,0.1);
      margin-bottom: 8px;
      margin-right: 12px;
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
      <div style="border-top:1px solid #f1f5f9; padding-top:6px; display:flex; gap:5px; justify-content:space-between;">
        <button class="admin-chibi-btn" onclick="setAdminMascotState('happy')" title="Vui vẻ" style="background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding:2px 7px; cursor:pointer; font-size:12px;">🌱</button>
        <button class="admin-chibi-btn" onclick="setAdminMascotState('thirsty')" title="Khát nước" style="background:#fffbeb; border:1px solid #f59e0b; border-radius:8px; padding:2px 7px; cursor:pointer; font-size:12px;">💧</button>
        <button class="admin-chibi-btn" onclick="setAdminMascotState('rain')" title="Trú mưa" style="background:#eff6ff; border:1px solid #3b82f6; border-radius:8px; padding:2px 7px; cursor:pointer; font-size:12px;">🌧️</button>
        <button class="admin-chibi-btn" onclick="setAdminMascotState('doctor')" title="Bác sĩ cây" style="background:#fef2f2; border:1px solid #ef4444; border-radius:8px; padding:2px 7px; cursor:pointer; font-size:12px;">🩺</button>
        <button class="admin-chibi-btn" onclick="setAdminMascotState('sleep')" title="Ngủ đêm" style="background:#faf5ff; border:1px solid #8b5cf6; border-radius:8px; padding:2px 7px; cursor:pointer; font-size:12px;">🌙</button>
      </div>

      <!-- Triangle Pointer to Mascot Head -->
      <div style="
        position: absolute;
        bottom: -9px;
        right: 48px;
        width: 0;
        height: 0;
        border-left: 9px solid transparent;
        border-right: 9px solid transparent;
        border-top: 9px solid #ffffff;
      "></div>
    </div>

    <!-- Free-standing Cutout Chibi Character Sprite -->
    <div onclick="onAdminMascotClick()" class="admin-chibi-sprite" title="Bấm vào Bé Mầm để trò chuyện!" style="
      display: flex;
      align-items: flex-end;
      justify-content: center;
      animation: ${preset.anim};
    ">
      <img src="/admin/img/chibi_cutout.png" alt="Bé Mầm AgTech" style="
        width: 120px;
        height: auto;
        display: block;
        filter: drop-shadow(0 10px 16px rgba(0,0,0,0.3)) drop-shadow(0 2px 4px rgba(16,185,129,0.3));
      ">
    </div>
  `;
}

function onAdminMascotClick() {
  const greetings = [
    'Chào Admin! Em đã xách bình tưới và chăm sóc rất kỹ các luống cây rồi ạ! 🌱✨',
    'Admin có muốn lọc danh sách các cây đang bệnh để điều phối nhân sự không? 🩺',
    'Em đang theo dõi ranh giới bản đồ GIS cho tất cả các trang trại! 🗺️',
    'CSDL PostgreSQL đang trong trạng thái hoàn hảo, không có lỗi phân mảnh! 🚀',
    'Em là Bé Mầm AgTech - Trợ lý số đắc lực cho Quản trị viên Tanbao Corp! 🧑‍💻🌱'
  ];
  const randomGreet = greetings[Math.floor(Math.random() * greetings.length)];
  
  const sprite = document.querySelector('.admin-chibi-sprite');
  if (sprite) {
    sprite.style.transform = 'scale(1.2) translateY(-14px) rotate(6deg)';
    setTimeout(() => {
      sprite.style.transform = 'scale(1) translateY(0) rotate(0deg)';
    }, 400);
  }

  setAdminMascotState(_adminMascotState, randomGreet);
}

window.onAdminMascotClick = onAdminMascotClick;
window.setAdminMascotState = setAdminMascotState;
window.initAdminChibiMascot = initAdminChibiMascot;
