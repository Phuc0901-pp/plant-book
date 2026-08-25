/**
 * modules/mascot-chibi.js - Bé Mầm Ôm Nút Dấu Cộng (+) Đa Năng
 * Gom Bé Mầm và Nút Thao Tác (+) thành 1 thực thể thống nhất:
 * Khi bấm vào -> Mở Menu 2 mục:
 * 1. 📝 Ghi nhật ký chăm sóc (mở modal ghi chép chăm sóc cây)
 * 2. 🌱 Bé Mầm tư vấn & hỏi đáp (mở khung Chat Google Gemini AI)
 */

let _isUserChatOpen = false;
let _isActionMenuOpen = false;
let _userChatHistory = [];
let _isUserAiResponding = false;

export function initChibiMascot() {
  let mascotContainer = document.getElementById('chibi-mascot-widget');
  if (!mascotContainer) {
    mascotContainer = document.createElement('div');
    mascotContainer.id = 'chibi-mascot-widget';
    mascotContainer.className = 'user-unified-mascot-container';
    document.body.appendChild(mascotContainer);
  }

  // Hide old separate FAB button
  const oldFab = document.getElementById('fab-btn');
  if (oldFab) {
    oldFab.style.display = 'none';
  }

  // Inject styles & animations
  if (!document.getElementById('user-chibi-unified-style')) {
    const style = document.createElement('style');
    style.id = 'user-chibi-unified-style';
    style.textContent = `
      #fab-btn {
        display: none !important;
      }
      .user-unified-mascot-container {
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
      }
      @media (max-width: 768px) {
        .user-unified-mascot-container {
          bottom: 74px;
          right: 18px;
        }
      }
      @keyframes mascot-hugging-pulse {
        0%, 100% { transform: translateY(0) scale(1); filter: drop-shadow(0 10px 18px rgba(16,185,129,0.3)); }
        50% { transform: translateY(-8px) scale(1.04); filter: drop-shadow(0 16px 26px rgba(16,185,129,0.5)); }
      }
      @keyframes leaf-gentle-sway {
        0%, 100% { transform: rotate(0deg); }
        50% { transform: rotate(14deg); }
      }
      @keyframes menu-pop-up {
        0% { transform: scale(0.8) translateY(20px); opacity: 0; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }
      @keyframes chat-pop-in {
        0% { transform: scale(0.85) translateY(30px); opacity: 0; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }
      .chibi-hugging-avatar {
        cursor: pointer;
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .chibi-hugging-avatar:hover {
        transform: scale(1.15) translateY(-6px) !important;
      }
      .chibi-action-item {
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .chibi-action-item:hover {
        transform: translateY(-3px) scale(1.02);
        box-shadow: 0 8px 20px -4px rgba(16,185,129,0.25) !important;
      }
      .ai-user-prompt-pill {
        transition: all 0.2s ease;
      }
      .ai-user-prompt-pill:hover {
        background: #ecfdf5 !important;
        border-color: #10b981 !important;
        color: #047857 !important;
        transform: translateY(-1px);
      }
    `;
    document.head.appendChild(style);
  }

  // Close menu only when clicking truly outside the widget
  document.addEventListener('click', (e) => {
    const widget = document.getElementById('chibi-mascot-widget');
    if (!widget) return;
    if (_isActionMenuOpen && !widget.contains(e.target)) {
      _isActionMenuOpen = false;
      renderMascot();
    }
  });

  renderMascot();
}

export function onMascotClick(e) {
  if (e) {
    e.stopPropagation();
  }
  if (_isUserChatOpen) return;
  _isActionMenuOpen = !_isActionMenuOpen;
  renderMascot();
}

export function toggleUserAiChat(e) {
  if (e) {
    e.stopPropagation();
  }
  _isActionMenuOpen = false;
  _isUserChatOpen = !_isUserChatOpen;
  renderMascot();
  if (_isUserChatOpen) {
    setTimeout(() => {
      const input = document.getElementById('user-ai-chat-input');
      if (input) input.focus();
      const messagesBox = document.getElementById('user-ai-chat-messages');
      if (messagesBox) messagesBox.scrollTop = messagesBox.scrollHeight;
    }, 100);
  }
}

export function selectAction(actionType, e) {
  if (e) {
    e.stopPropagation();
  }
  _isActionMenuOpen = false;
  renderMascot();
  if (actionType === 'log') {
    if (typeof window.openCareModal === 'function') {
      window.openCareModal();
    }
  } else if (actionType === 'chat') {
    toggleUserAiChat();
  }
}

export function setMascotState(stateKey) {
  // Compatibility stub
  if (stateKey) renderMascot();
}

/**
 * 🌟 SVG BÉ MẦM ÔM NÚT DẤU CỘNG (+) 3D
 */
function _renderChibiHuggingPlusSVG() {
  return `
    <svg width="100" height="115" viewBox="0 0 100 115" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- 3D Body Lighting -->
        <radialGradient id="hugBodyGrad" cx="36%" cy="28%" r="72%">
          <stop offset="0%" stop-color="#86efac" />
          <stop offset="35%" stop-color="#34d399" />
          <stop offset="75%" stop-color="#10b981" />
          <stop offset="100%" stop-color="#047857" />
        </radialGradient>

        <!-- Soft Belly -->
        <radialGradient id="hugBellyGrad" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="60%" stop-color="#f0fdf4" />
          <stop offset="100%" stop-color="#dcfce7" />
        </radialGradient>

        <!-- Big Sparkling Anime Eyes -->
        <radialGradient id="hugEyeIris" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="45%" stop-color="#0284c7" />
          <stop offset="85%" stop-color="#0f172a" />
        </radialGradient>

        <!-- Leaves -->
        <radialGradient id="hugLeafGrad" cx="30%" cy="25%" r="70%">
          <stop offset="0%" stop-color="#bbf7d0" />
          <stop offset="50%" stop-color="#4ade80" />
          <stop offset="100%" stop-color="#15803d" />
        </radialGradient>

        <!-- 3D Circular Green Plus Button Gradient -->
        <radialGradient id="hugPlusBtnGrad" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stop-color="#34d399" />
          <stop offset="40%" stop-color="#10b981" />
          <stop offset="85%" stop-color="#059669" />
          <stop offset="100%" stop-color="#047857" />
        </radialGradient>
      </defs>

      <!-- 🌿 Sprout Leaves on Head -->
      <g style="transform-origin: 50px 24px; animation: leaf-gentle-sway 2s infinite ease-in-out;">
        <path d="M50 24 C46 10 32 8 36 18 C38 24 47 22 50 24Z" fill="url(#hugLeafGrad)" stroke="#15803d" stroke-width="1.2" />
        <path d="M50 24 C54 10 68 8 64 18 C62 24 53 22 50 24Z" fill="url(#hugLeafGrad)" stroke="#15803d" stroke-width="1.2" />
        <circle cx="50" cy="14" r="3" fill="#fef08a" />
      </g>

      <!-- 🍐 Chubby Sprout Body -->
      <path d="M50 22 C75 22 86 48 83 75 C80 96 66 105 50 105 C34 105 20 96 17 75 C14 48 25 22 50 22Z" fill="url(#hugBodyGrad)" stroke="#ffffff" stroke-width="2" />

      <!-- Soft Belly -->
      <ellipse cx="50" cy="74" rx="22" ry="18" fill="url(#hugBellyGrad)" opacity="0.9" />

      <!-- 👀 Big Anime Left Eye with Star Highlights -->
      <g transform="translate(36, 52)">
        <ellipse cx="0" cy="0" rx="7.5" ry="10" fill="#ffffff" stroke="#0f172a" stroke-width="1" />
        <ellipse cx="1" cy="1" rx="6.2" ry="8.5" fill="url(#hugEyeIris)" />
        <ellipse cx="1" cy="2" rx="3.8" ry="5.5" fill="#020617" />
        <circle cx="-1.8" cy="-2.5" r="2.8" fill="#ffffff" />
        <circle cx="2" cy="3" r="1.2" fill="#ffffff" />
        <path d="M-7 -7 Q0 -11 7 -7" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" fill="none" />
      </g>

      <!-- 👀 Big Anime Right Eye with Star Highlights -->
      <g transform="translate(64, 52)">
        <ellipse cx="0" cy="0" rx="7.5" ry="10" fill="#ffffff" stroke="#0f172a" stroke-width="1" />
        <ellipse cx="-1" cy="1" rx="6.2" ry="8.5" fill="url(#hugEyeIris)" />
        <ellipse cx="-1" cy="2" rx="3.8" ry="5.5" fill="#020617" />
        <circle cx="-2.8" cy="-2.5" r="2.8" fill="#ffffff" />
        <circle cx="1" cy="3" r="1.2" fill="#ffffff" />
        <path d="M-7 -7 Q0 -11 7 -7" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" fill="none" />
      </g>

      <!-- 🌸 Rosy Cheeks -->
      <ellipse cx="27" cy="62" rx="6" ry="3.5" fill="#fb7185" opacity="0.65" />
      <ellipse cx="73" cy="62" rx="6" ry="3.5" fill="#fb7185" opacity="0.65" />

      <!-- Cute Smiling Mouth -->
      <path d="M46 63 Q50 69 54 63" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round" fill="#fda4af" />

      <!-- 🟢 THE 3D CIRCULAR PLUS BUTTON BEING HUGGED IN FRONT -->
      <g transform="translate(50, 84)">
        <!-- Button Drop Shadow -->
        <circle cx="0" cy="4" r="26" fill="rgba(0,0,0,0.18)" />
        <!-- Button Outer Ring -->
        <circle cx="0" cy="0" r="26" fill="url(#hugPlusBtnGrad)" stroke="#ffffff" stroke-width="3" />
        <!-- White Plus Symbol (+) -->
        <rect x="-3.5" y="-14" width="7" height="28" rx="3.5" fill="#ffffff" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))" />
        <rect x="-14" y="-3.5" width="28" height="7" rx="3.5" fill="#ffffff" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))" />
      </g>

      <!-- 🤗 Chubby Green Arms Hugging the Button Left & Right -->
      <g>
        <!-- Left Arm -->
        <path d="M22 68 C15 76 18 88 28 88 C32 88 34 83 34 80" fill="#34d399" stroke="#047857" stroke-width="1.5" stroke-linecap="round" />
        <ellipse cx="28" cy="85" rx="5" ry="4" fill="#86efac" />
        <!-- Right Arm -->
        <path d="M78 68 C85 76 82 88 72 88 C68 88 66 83 66 80" fill="#34d399" stroke="#047857" stroke-width="1.5" stroke-linecap="round" />
        <ellipse cx="72" cy="85" rx="5" ry="4" fill="#86efac" />
      </g>

      <!-- 🥾 Tiny Cute Boots -->
      <ellipse cx="38" cy="106" rx="7.5" ry="5" fill="#d97706" stroke="#78350f" stroke-width="1.2" />
      <ellipse cx="62" cy="106" rx="7.5" ry="5" fill="#d97706" stroke="#78350f" stroke-width="1.2" />
    </svg>
  `;
}

export function renderMascot() {
  const container = document.getElementById('chibi-mascot-widget');
  if (!container) return;

  if (_isUserChatOpen) {
    // 💬 1. CHATBOX GEMINI AI DRAWER
    container.innerHTML = `
      <div id="user-ai-chat-box" onclick="event.stopPropagation()" style="
        width: 380px;
        max-width: calc(100vw - 32px);
        height: 520px;
        max-height: calc(100vh - 90px);
        background: #ffffff;
        border: 2px solid #10b981;
        border-radius: 20px;
        box-shadow: 0 20px 40px -10px rgba(0,0,0,0.3), 0 8px 16px rgba(16,185,129,0.15);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: chat-pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      ">
        <!-- Chat Header -->
        <div style="background: linear-gradient(135deg, #065f46 0%, #047857 50%, #059669 100%); color: white; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 38px; height: 38px; border-radius: 50%; background: #ffffff; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 2px solid #a7f3d0;">
              ${_renderChibiHuggingPlusSVG()}
            </div>
            <div>
              <div style="font-size: 14.5px; font-weight: 800; display: flex; align-items: center; gap: 6px;">
                Bé Mầm AI AgTech
                <span style="background: #fbbf24; color: #78350f; font-size: 9.5px; font-weight: 900; padding: 1px 6px; border-radius: 8px;">GEMINI AI</span>
              </div>
              <div style="font-size: 11px; color: #a7f3d0; font-weight: 600;">Tư vấn canh tác, sâu bệnh & kỹ thuật vườn</div>
            </div>
          </div>
          <button onclick="toggleUserAiChat(event)" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Chat Messages Container -->
        <div id="user-ai-chat-messages" style="flex: 1; padding: 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background: #f8fafc;">
          <!-- Welcome Message -->
          <div style="display: flex; gap: 8px; align-items: flex-start;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #10b981; color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0;">🌱</div>
            <div style="background: #ffffff; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; color: #1e293b; max-width: 85%; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
              Dạ chào Bác! Em là <strong>Bé Mầm AI</strong>. Bác có thắc mắc gì về sâu bệnh, phân bón, tưới nước, chi phí hay các trang trại của mình cứ hỏi em nhé! ✨🧑‍🌾
            </div>
          </div>

          <!-- History Render -->
          ${_userChatHistory.map(item => `
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

          ${_isUserAiResponding ? `
            <div style="display: flex; gap: 8px; align-items: center;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #10b981; color: white; display: flex; align-items: center; justify-content: center; font-size: 13px;">🌱</div>
              <div style="background: #ffffff; border: 1px solid #e2e8f0; padding: 8px 14px; border-radius: 14px; font-size: 12.5px; color: #64748b;">
                <i class="fa-solid fa-spinner fa-spin" style="color:#10b981; margin-right:6px;"></i> Bé Mầm đang tra cứu giải đáp cho Bác...
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Suggested Prompt Chips -->
        <div style="padding: 6px 12px; background: #ffffff; border-top: 1px solid #f1f5f9; display: flex; gap: 6px; overflow-x: auto; white-space: nowrap;">
          <button class="ai-user-prompt-pill" onclick="sendUserPrompt('Tôi đang có những trang trại nào và trồng cây gì?')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #475569; cursor: pointer;">🏡 Trang trại của tôi</button>
          <button class="ai-user-prompt-pill" onclick="sendUserPrompt('Tổng chi phí vật tư tôi đã dùng là bao nhiêu?')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #475569; cursor: pointer;">💰 Chi phí vật tư</button>
          <button class="ai-user-prompt-pill" onclick="sendUserPrompt('Nhật ký chăm sóc gần đây của vườn tôi')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #475569; cursor: pointer;">📝 Nhật ký gần đây</button>
          <button class="ai-user-prompt-pill" onclick="sendUserPrompt('Cách xử lý khi cây bị vàng lá thối rễ')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #475569; cursor: pointer;">🩺 Trị vàng lá</button>
        </div>

        <!-- Chat Input Bar -->
        <form onsubmit="handleUserAiSubmit(event)" style="padding: 10px 14px; background: #ffffff; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; align-items: center;">
          <input type="text" id="user-ai-chat-input" placeholder="Hỏi Bé Mầm về cây trồng, sâu bệnh, chi phí..." autocomplete="off" style="flex: 1; border: 1.5px solid #cbd5e1; border-radius: 20px; padding: 9px 16px; font-size: 13px; outline: none; transition: border 0.2s;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#cbd5e1'">
          <button type="submit" style="background: #10b981; color: white; border: none; width: 38px; height: 38px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 4px 10px rgba(16,185,129,0.3);">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </form>
      </div>
    `;
  } else if (_isActionMenuOpen) {
    // 📋 2. QUICK ACTION POPUP MENU (2 MỤC: GHI NHẬT KÝ & CHAT AI)
    container.innerHTML = `
      <!-- Action Popup Box -->
      <div id="mascot-action-menu-box" onclick="event.stopPropagation()" style="
        background: #ffffff;
        border: 2.5px solid #10b981;
        border-radius: 20px;
        padding: 14px;
        margin-bottom: 12px;
        width: 300px;
        box-shadow: 0 20px 40px -6px rgba(0,0,0,0.3), 0 8px 16px rgba(16,185,129,0.2);
        display: flex;
        flex-direction: column;
        gap: 10px;
        animation: menu-pop-up 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        position: relative;
      ">
        <div style="font-size: 12px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
          <span>🌱 BÉ MẦM AGTECH</span>
          <span style="background: #ecfdf5; color: #10b981; font-size: 10px; padding: 2px 8px; border-radius: 8px; font-weight: 800;">Chọn thao tác</span>
        </div>

        <!-- Option 1: Ghi nhật ký chăm sóc -->
        <div onclick="selectAction('log', event)" class="chibi-action-item" style="
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
          border: 1.5px solid #86efac;
          border-radius: 14px;
          cursor: pointer;
        ">
          <div style="width: 40px; height: 40px; border-radius: 12px; background: #10b981; color: white; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; box-shadow: 0 4px 10px rgba(16,185,129,0.35);">
            <i class="fa-solid fa-pen-to-square"></i>
          </div>
          <div>
            <div style="font-size: 14px; font-weight: 800; color: #065f46;">Ghi nhật ký chăm sóc</div>
            <div style="font-size: 11px; color: #475569; font-weight: 600;">Tưới nước, bón phân, xịt thuốc</div>
          </div>
        </div>

        <!-- Option 2: Bé Mầm tư vấn & hỏi đáp (Gemini AI) -->
        <div onclick="selectAction('chat', event)" class="chibi-action-item" style="
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 1.5px solid #7dd3fc;
          border-radius: 14px;
          cursor: pointer;
        ">
          <div style="width: 40px; height: 40px; border-radius: 12px; background: #0284c7; color: white; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; box-shadow: 0 4px 10px rgba(2,132,199,0.35);">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
          </div>
          <div>
            <div style="font-size: 14px; font-weight: 800; color: #075985;">Bé Mầm tư vấn & hỏi đáp</div>
            <div style="font-size: 11px; color: #475569; font-weight: 600;">Hỏi sâu bệnh, thời tiết & chi phí AI</div>
          </div>
        </div>

        <!-- Triangle Pointer -->
        <div style="
          position: absolute;
          bottom: -10px;
          right: 38px;
          width: 0;
          height: 0;
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-top: 10px solid #10b981;
        "></div>
      </div>

      <!-- 🌟 UNIFIED MASCOT HUGGING PLUS BUTTON -->
      <div onclick="onMascotClick(event)" class="chibi-hugging-avatar" title="Bấm vào để chọn: Ghi nhật ký chăm sóc hoặc Chat với Bé Mầm AI!" style="
        display: flex;
        align-items: flex-end;
        justify-content: center;
        animation: mascot-hugging-pulse 2.5s infinite ease-in-out;
      ">
        ${_renderChibiHuggingPlusSVG()}
      </div>
    `;
  } else {
    // 🌟 3. NORMAL STATE: BÉ MẦM ÔM NÚT DẤU CỘNG (+) NẰM GÓC PHẢI
    container.innerHTML = `
      <div onclick="onMascotClick(event)" class="chibi-hugging-avatar" title="Bấm vào để chọn: Ghi nhật ký chăm sóc hoặc Chat với Bé Mầm AI!" style="
        display: flex;
        align-items: flex-end;
        justify-content: center;
        animation: mascot-hugging-pulse 2.5s infinite ease-in-out;
      ">
        ${_renderChibiHuggingPlusSVG()}
      </div>
    `;
  }
}

export async function sendUserPrompt(promptText) {
  const input = document.getElementById('user-ai-chat-input');
  if (input) input.value = promptText;
  await handleUserAiSubmit();
}

export async function handleUserAiSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('user-ai-chat-input');
  if (!input) return;
  const userText = input.value.trim();
  if (!userText || _isUserAiResponding) return;

  _userChatHistory.push({ role: 'user', text: userText });
  input.value = '';
  _isUserAiResponding = true;
  renderMascot();

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('pb_token') || ''}`
      },
      body: JSON.stringify({
        message: userText,
        history: _userChatHistory.slice(-8),
        userRole: 'user'
      })
    });

    const data = await res.json();
    const botReply = data.reply || 'Dạ, Bé Mầm đã nhận được thông tin!';
    _userChatHistory.push({ role: 'model', text: botReply });
  } catch (err) {
    _userChatHistory.push({ role: 'model', text: 'Dạ, có gián đoạn kết nối tới máy chủ AI. Bé Mầm vẫn đang đồng hành cùng vườn cây của bác ạ! 🌱' });
  } finally {
    _isUserAiResponding = false;
    renderMascot();
    setTimeout(() => {
      const messagesBox = document.getElementById('user-ai-chat-messages');
      if (messagesBox) messagesBox.scrollTop = messagesBox.scrollHeight;
    }, 50);
  }
}

window.onMascotClick = onMascotClick;
window.selectAction = selectAction;
window.toggleUserAiChat = toggleUserAiChat;
window.initChibiMascot = initChibiMascot;
window.sendUserPrompt = sendUserPrompt;
window.handleUserAiSubmit = handleUserAiSubmit;
window.setMascotState = setMascotState;
