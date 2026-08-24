/**
 * admin/js/mascot-chibi.js - Advanced 3D Anime Chibi Plant Mascot with Gemini AI Chatbot ("Bé Mầm AI AgTech")
 */

let _adminMascotState = 'admin_optimal';
let _isChatOpen = false;
let _chatHistory = [];
let _isAiResponding = false;

const ADMIN_MASCOT_STATES = {
  admin_optimal: {
    title: 'Hệ Thống Ổn Định',
    badge: '100% Hoạt động',
    badgeColor: '#10b981',
    badgeBg: '#ecfdf5',
    speech: 'Xin chào Admin! Nhấn vào em để mở khung Chat AI thông minh cùng Google Gemini nhé! 💬✨',
    tip: 'Bé Mầm có thể giải đáp mọi dữ liệu CSDL, sâu bệnh, cây trồng & IoT.'
  },
  admin_notify: {
    title: 'Có Thông Báo Mới',
    badge: 'Tin mới cần duyệt',
    badgeColor: '#0284c7',
    badgeBg: '#f0f9ff',
    speech: 'Admin ơi! Nông hộ vừa gửi nhật ký canh tác mới và có cập nhật dữ liệu kho vật tư cần xem xét! 🔔📝',
    tip: 'Khuyến nghị: Mở tab "Cơ sở dữ liệu" hoặc "Quản trị Chi phí" để kiểm tra.'
  },
  admin_alert: {
    title: 'CẢNH BÁO HỆ THỐNG',
    badge: 'Nguy cơ khẩn cấp!',
    badgeColor: '#ef4444',
    badgeBg: '#fef2f2',
    speech: 'CẢNH BÁO: Phát hiện 2 trạm IoT đất bị mất kết nối hoặc có cây trồng báo dịch hại bùng phát! 🚨⚠️',
    tip: 'Khuyến nghị: Kiểm tra ngay mục "Thiết bị IoT" và "Danh sách cây" để phân bổ xử lý.'
  },
  admin_database: {
    title: 'Giám Sát CSDL PostgreSQL',
    badge: 'Schema tối ưu',
    badgeColor: '#8b5cf6',
    badgeBg: '#faf5ff',
    speech: 'Em đang soi chiếu cấu trúc bảng CSDL & kiểm tra log kiểm toán, không có lỗi phân mảnh hay rò rỉ dữ liệu! 🔍💾',
    tip: 'Khuyến nghị: Tab "Kiểm tra CSDL" sẵn sàng để truy vấn sâu.'
  },
  admin_weather: {
    title: 'Cảnh Báo Khí Tượng Vùng',
    badge: 'Dự báo mưa dông',
    badgeColor: '#3b82f6',
    badgeBg: '#eff6ff',
    speech: 'Radar khí tượng Open-Meteo báo dông lốc sắp quét qua khu vực các trang trại trọng điểm phía Nam! 🌧️☂️',
    tip: 'Khuyến nghị: Phát cảnh báo khẩn đến các tài khoản nông hộ trong vùng ảnh hưởng.'
  },
  admin_night: {
    title: 'Trực Vận Hành Ca Đêm',
    badge: 'Tự động 24/7',
    badgeColor: '#6b21a8',
    badgeBg: '#faf5ff',
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

  // Inject styles & animations
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
      @keyframes chat-open-anim {
        0% { transform: scale(0.85) translateY(30px); opacity: 0; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
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
      .ai-chat-prompt-pill:hover {
        background: #e0f2fe !important;
        border-color: #0284c7 !important;
        color: #0369a1 !important;
        transform: translateY(-1px);
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

function toggleAdminAiChat() {
  _isChatOpen = !_isChatOpen;
  renderAdminMascot();
  if (_isChatOpen) {
    setTimeout(() => {
      const input = document.getElementById('admin-ai-chat-input');
      if (input) input.focus();
      const messagesBox = document.getElementById('admin-ai-chat-messages');
      if (messagesBox) messagesBox.scrollTop = messagesBox.scrollHeight;
    }, 100);
  }
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
    <svg width="115" height="130" viewBox="0 0 120 135" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 12px 20px rgba(0,0,0,0.22));">
      <defs>
        <radialGradient id="adminAnimeBodyLight" cx="38%" cy="28%" r="70%">
          <stop offset="0%" stop-color="${bodyGradient[0]}" />
          <stop offset="35%" stop-color="${bodyGradient[1]}" />
          <stop offset="100%" stop-color="${bodyGradient[2]}" />
        </radialGradient>
        <radialGradient id="adminAnimeBellyLight" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="60%" stop-color="#f0fdf4" />
          <stop offset="100%" stop-color="#dcfce7" />
        </radialGradient>
        <radialGradient id="adminAnimeEyeIris" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="45%" stop-color="#0284c7" />
          <stop offset="85%" stop-color="#0f172a" />
        </radialGradient>
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

  if (_isChatOpen) {
    // RENDER GEMINI AI CHAT DRAWER
    container.innerHTML = `
      <div id="admin-ai-chat-box" style="
        width: 380px;
        max-width: calc(100vw - 32px);
        height: 520px;
        max-height: calc(100vh - 100px);
        background: #ffffff;
        border: 2px solid #10b981;
        border-radius: 20px;
        box-shadow: 0 20px 40px -10px rgba(0,0,0,0.3), 0 8px 16px rgba(16,185,129,0.15);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: chat-open-anim 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      ">
        <!-- Chat Header -->
        <div style="background: linear-gradient(135deg, #065f46 0%, #047857 50%, #059669 100%); color: white; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: #ffffff; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 2px solid #a7f3d0;">
              ${_renderAdminAnimeMascotSVG(preset)}
            </div>
            <div>
              <div style="font-size: 14.5px; font-weight: 800; display: flex; align-items: center; gap: 6px;">
                Bé Mầm AI AgTech
                <span style="background: #fbbf24; color: #78350f; font-size: 9.5px; font-weight: 900; padding: 1px 6px; border-radius: 8px;">GEMINI AI</span>
              </div>
              <div style="font-size: 11px; color: #a7f3d0; font-weight: 600;">Trợ lý quản trị & tư vấn canh tác 24/7</div>
            </div>
          </div>
          <button onclick="toggleAdminAiChat()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Chat Messages Container -->
        <div id="admin-ai-chat-messages" style="flex: 1; padding: 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background: #f8fafc;">
          <!-- Welcome Message -->
          <div style="display: flex; gap: 8px; align-items: flex-start;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #10b981; color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0;">🌱</div>
            <div style="background: #ffffff; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; color: #1e293b; max-width: 85%; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
              Xin chào Admin! Em là <strong>Bé Mầm AI</strong>. Em đã kết nối trực tiếp với Database, IoT và Google Gemini. Admin cần em hỗ trợ phân tích hay tra cứu dữ liệu gì ạ? ✨
            </div>
          </div>

          <!-- History Render -->
          ${_chatHistory.map(item => `
            <div style="display: flex; gap: 8px; align-items: flex-start; justify-content: ${item.role === 'user' ? 'flex-end' : 'flex-start'};">
              ${item.role !== 'user' ? `<div style="width: 28px; height: 28px; border-radius: 50%; background: #10b981; color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0;">🌱</div>` : ''}
              <div style="
                background: ${item.role === 'user' ? 'linear-gradient(135deg, #047857, #10b981)' : '#ffffff'};
                color: ${item.role === 'user' ? '#ffffff' : '#1e293b'};
                border: ${item.role === 'user' ? 'none' : '1px solid #e2e8f0'};
                padding: 10px 14px;
                border-radius: 14px;
                font-size: 13px;
                line-height: 1.5;
                max-width: 85%;
                box-shadow: 0 2px 6px rgba(0,0,0,0.04);
                white-space: pre-wrap;
              ">${item.text}</div>
            </div>
          `).join('')}

          ${_isAiResponding ? `
            <div style="display: flex; gap: 8px; align-items: center;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #10b981; color: white; display: flex; align-items: center; justify-content: center; font-size: 13px;">🌱</div>
              <div style="background: #ffffff; border: 1px solid #e2e8f0; padding: 8px 14px; border-radius: 14px; font-size: 12.5px; color: #64748b;">
                <i class="fa-solid fa-spinner fa-spin" style="color:#10b981; margin-right:6px;"></i> Bé Mầm đang suy nghĩ câu trả lời...
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Suggested Prompt Chips -->
        <div style="padding: 6px 12px; background: #ffffff; border-top: 1px solid #f1f5f9; display: flex; gap: 6px; overflow-x: auto; white-space: nowrap;">
          <button class="ai-chat-prompt-pill" onclick="sendAdminPrompt('Tóm tắt sức khỏe toàn bộ cây trồng hôm nay')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #475569; cursor: pointer;">🌿 Tóm tắt sức khỏe cây</button>
          <button class="ai-chat-prompt-pill" onclick="sendAdminPrompt('Kiểm tra trạng thái cảm biến IoT đất và khí tượng')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #475569; cursor: pointer;">📡 Đo cảm biến IoT</button>
          <button class="ai-chat-prompt-pill" onclick="sendAdminPrompt('Gợi ý xử lý các lô cây đang ủ bệnh')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #475569; cursor: pointer;">🩺 Xử lý cây bệnh</button>
          <button class="ai-chat-prompt-pill" onclick="sendAdminPrompt('Tư vấn tối ưu chi phí phân bón và nước tưới')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #475569; cursor: pointer;">💰 Tối ưu chi phí</button>
        </div>

        <!-- Chat Input Bar -->
        <form onsubmit="handleAdminAiSubmit(event)" style="padding: 10px 14px; background: #ffffff; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; align-items: center;">
          <input type="text" id="admin-ai-chat-input" placeholder="Hỏi Bé Mầm về CSDL, IoT, cây trồng..." autocomplete="off" style="flex: 1; border: 1.5px solid #cbd5e1; border-radius: 20px; padding: 9px 16px; font-size: 13px; outline: none; transition: border 0.2s;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#cbd5e1'">
          <button type="submit" style="background: #10b981; color: white; border: none; width: 38px; height: 38px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 4px 10px rgba(16,185,129,0.3);">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </form>
      </div>
    `;
  } else {
    // RENDER FLOATING CHIBI MASCOT WIDGET
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
        
        <!-- Action Button: Open Gemini AI Chat -->
        <div style="margin-bottom:8px;">
          <button onclick="toggleAdminAiChat()" style="width:100%; background:linear-gradient(135deg, #10b981, #059669); color:white; border:none; border-radius:12px; padding:7px 12px; font-size:12px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 4px 10px rgba(16,185,129,0.3);">
            <i class="fa-solid fa-comments"></i> Nhấn để Chat với Bé Mầm AI
          </button>
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

      <!-- 3D Anime Chibi Plant Character (Click to Open Chat) -->
      <div onclick="toggleAdminAiChat()" class="admin-anime-avatar" title="Bấm vào Bé Mầm để mở Khung Chat AI Gemini!" style="
        display: flex;
        align-items: flex-end;
        justify-content: center;
        animation: ${_adminMascotState === 'admin_alert' ? 'mascot-alarm-shake 0.5s infinite' : (_adminMascotState === 'admin_notify' ? 'mascot-excited-jump 1.5s infinite' : 'mascot-float-bounce 2.5s infinite ease-in-out')};
      ">
        ${_renderAdminAnimeMascotSVG(preset)}
      </div>
    `;
  }
}

async function sendAdminPrompt(promptText) {
  const input = document.getElementById('admin-ai-chat-input');
  if (input) input.value = promptText;
  await handleAdminAiSubmit();
}

async function handleAdminAiSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('admin-ai-chat-input');
  if (!input) return;
  const userText = input.value.trim();
  if (!userText || _isAiResponding) return;

  // Add user message to history
  _chatHistory.push({ role: 'user', text: userText });
  input.value = '';
  _isAiResponding = true;
  renderAdminMascot();

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('pb_token') || ''}`
      },
      body: JSON.stringify({
        message: userText,
        history: _chatHistory.slice(-8),
        userRole: 'admin'
      })
    });

    const data = await res.json();
    const botReply = data.reply || 'Dạ, Bé Mầm đã nhận được thông tin nhưng chưa thể phản hồi ngay lúc này.';
    _chatHistory.push({ role: 'model', text: botReply });
  } catch (err) {
    _chatHistory.push({ role: 'model', text: 'Dạ, có gián đoạn kết nối tới máy chủ AI. Bé Mầm vẫn đang giám sát hệ thống bình thường ạ! 🌱' });
  } finally {
    _isAiResponding = false;
    renderAdminMascot();
    setTimeout(() => {
      const messagesBox = document.getElementById('admin-ai-chat-messages');
      if (messagesBox) messagesBox.scrollTop = messagesBox.scrollHeight;
    }, 50);
  }
}

window.onAdminMascotClick = toggleAdminAiChat;
window.toggleAdminAiChat = toggleAdminAiChat;
window.setAdminMascotState = setAdminMascotState;
window.initAdminChibiMascot = initAdminChibiMascot;
window.sendAdminPrompt = sendAdminPrompt;
window.handleAdminAiSubmit = handleAdminAiSubmit;
