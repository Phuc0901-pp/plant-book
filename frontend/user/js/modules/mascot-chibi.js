/**
 * modules/mascot-chibi.js - Pure Minimal 3D Anime Chibi Plant Mascot with Gemini AI Chatbot for User Portal
 * Vị trí được bố trí thông minh phía trên nút FAB (+) ghi nhật ký, click là mở Chat AI Gemini tư vấn nông nghiệp!
 */

let _isUserChatOpen = false;
let _userChatHistory = [];
let _isUserAiResponding = false;

export function initChibiMascot() {
  let mascotContainer = document.getElementById('chibi-mascot-widget');
  if (!mascotContainer) {
    mascotContainer = document.createElement('div');
    mascotContainer.id = 'chibi-mascot-widget';
    mascotContainer.className = 'user-mascot-container';
    document.body.appendChild(mascotContainer);
  }

  // Inject styles & responsive positioning above FAB button
  if (!document.getElementById('user-chibi-clean-style')) {
    const style = document.createElement('style');
    style.id = 'user-chibi-clean-style';
    style.textContent = `
      .user-mascot-container {
        position: fixed;
        bottom: 102px;
        right: 18px;
        z-index: 9998;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        pointer-events: auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        user-select: none;
      }
      @media (max-width: 768px) {
        .user-mascot-container {
          bottom: 148px;
          right: 14px;
        }
      }
      @keyframes mascot-float-bounce {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        50% { transform: translateY(-10px) rotate(2.5deg); }
      }
      @keyframes leaf-gentle-sway {
        0%, 100% { transform: rotate(0deg); }
        50% { transform: rotate(14deg); }
      }
      @keyframes chat-pop-in {
        0% { transform: scale(0.85) translateY(30px); opacity: 0; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }
      .user-clean-avatar {
        cursor: pointer;
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .user-clean-avatar:hover {
        transform: scale(1.15) translateY(-8px) !important;
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

  renderMascot();
}

export function toggleUserAiChat() {
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

function _renderCleanAnimeMascotSVG() {
  return `
    <svg width="95" height="110" viewBox="0 0 120 135" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 12px 22px rgba(0,0,0,0.25));">
      <defs>
        <radialGradient id="userBodyLight" cx="38%" cy="28%" r="70%">
          <stop offset="0%" stop-color="#86efac" />
          <stop offset="35%" stop-color="#34d399" />
          <stop offset="75%" stop-color="#10b981" />
          <stop offset="100%" stop-color="#047857" />
        </radialGradient>
        <radialGradient id="userBellyLight" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="60%" stop-color="#f0fdf4" />
          <stop offset="100%" stop-color="#dcfce7" />
        </radialGradient>
        <radialGradient id="userEyeIris" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="45%" stop-color="#0284c7" />
          <stop offset="85%" stop-color="#0f172a" />
        </radialGradient>
        <radialGradient id="userLeafLight" cx="30%" cy="25%" r="70%">
          <stop offset="0%" stop-color="#bbf7d0" />
          <stop offset="50%" stop-color="#4ade80" />
          <stop offset="100%" stop-color="#15803d" />
        </radialGradient>
      </defs>

      <!-- Sprout Leaves on Head with Physics Sway -->
      <g style="transform-origin: 60px 32px; animation: leaf-gentle-sway 2s infinite ease-in-out;">
        <path d="M60 30 C56 12 38 10 42 22 C45 30 56 28 60 30Z" fill="url(#userLeafLight)" stroke="#15803d" stroke-width="1.2" />
        <path d="M60 30 C64 12 82 10 78 22 C75 30 64 28 60 30Z" fill="url(#userLeafLight)" stroke="#15803d" stroke-width="1.2" />
        <circle cx="60" cy="18" r="3.5" fill="#fef08a" />
      </g>

      <!-- Chubby Pear-shaped Sprout Body -->
      <path d="M60 28 C90 28 102 60 98 90 C95 116 78 126 60 126 C42 126 25 116 22 90 C18 60 30 28 60 28Z" fill="url(#userBodyLight)" stroke="#ffffff" stroke-width="2.5" />

      <!-- Soft Belly -->
      <ellipse cx="60" cy="94" rx="26" ry="22" fill="url(#userBellyLight)" opacity="0.9" />

      <!-- Big Sparkling Anime Left Eye -->
      <g transform="translate(42, 66)">
        <ellipse cx="0" cy="0" rx="9" ry="12" fill="#ffffff" stroke="#0f172a" stroke-width="1.2" />
        <ellipse cx="1" cy="1" rx="7.5" ry="10" fill="url(#userEyeIris)" />
        <ellipse cx="1" cy="2" rx="4.5" ry="6.5" fill="#020617" />
        <circle cx="-2" cy="-3" r="3.5" fill="#ffffff" />
        <circle cx="2.5" cy="4" r="1.5" fill="#ffffff" />
        <path d="M-9 -8 Q0 -14 9 -8" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" fill="none" />
      </g>

      <!-- Big Sparkling Anime Right Eye -->
      <g transform="translate(78, 66)">
        <ellipse cx="0" cy="0" rx="9" ry="12" fill="#ffffff" stroke="#0f172a" stroke-width="1.2" />
        <ellipse cx="-1" cy="1" rx="7.5" ry="10" fill="url(#userEyeIris)" />
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

      <!-- Tiny Cute Hands -->
      <circle cx="26" cy="94" r="6.5" fill="#34d399" stroke="#059669" stroke-width="1.2" />
      <circle cx="94" cy="94" r="6.5" fill="#34d399" stroke="#059669" stroke-width="1.2" />

      <!-- Tiny Cute Boots -->
      <ellipse cx="48" cy="126" rx="8" ry="5.5" fill="#d97706" stroke="#78350f" stroke-width="1.2" />
      <ellipse cx="72" cy="126" rx="8" ry="5.5" fill="#d97706" stroke="#78350f" stroke-width="1.2" />
    </svg>
  `;
}

export function renderMascot() {
  const container = document.getElementById('chibi-mascot-widget');
  if (!container) return;

  if (_isUserChatOpen) {
    // 💬 CHATBOX GEMINI AI FOR FARMER
    container.innerHTML = `
      <div id="user-ai-chat-box" style="
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
            <div style="width: 36px; height: 36px; border-radius: 50%; background: #ffffff; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 2px solid #a7f3d0;">
              ${_renderCleanAnimeMascotSVG()}
            </div>
            <div>
              <div style="font-size: 14.5px; font-weight: 800; display: flex; align-items: center; gap: 6px;">
                Bé Mầm AI AgTech
                <span style="background: #fbbf24; color: #78350f; font-size: 9.5px; font-weight: 900; padding: 1px 6px; border-radius: 8px;">GEMINI AI</span>
              </div>
              <div style="font-size: 11px; color: #a7f3d0; font-weight: 600;">Tư vấn canh tác, sâu bệnh & kỹ thuật vườn</div>
            </div>
          </div>
          <button onclick="toggleUserAiChat()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Chat Messages Container -->
        <div id="user-ai-chat-messages" style="flex: 1; padding: 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background: #f8fafc;">
          <!-- Welcome Message -->
          <div style="display: flex; gap: 8px; align-items: flex-start;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #10b981; color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0;">🌱</div>
            <div style="background: #ffffff; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; color: #1e293b; max-width: 85%; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
              Dạ chào bác nông hộ! Em là <strong>Bé Mầm AI</strong>. Bác có thắc mắc gì về sâu bệnh, phân bón, tưới nước hay thời tiết cứ hỏi em nhé! ✨🧑‍🌾
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
                <i class="fa-solid fa-spinner fa-spin" style="color:#10b981; margin-right:6px;"></i> Bé Mầm đang tra cứu giải đáp cho bác...
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Suggested Prompt Chips for Farmer -->
        <div style="padding: 6px 12px; background: #ffffff; border-top: 1px solid #f1f5f9; display: flex; gap: 6px; overflow-x: auto; white-space: nowrap;">
          <button class="ai-user-prompt-pill" onclick="sendUserPrompt('Cách xử lý khi cây bị vàng lá đốm nâu')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #475569; cursor: pointer;">🌿 Trị vàng lá đốm nâu</button>
          <button class="ai-user-prompt-pill" onclick="sendUserPrompt('Hướng dẫn liều lượng tưới nước mùa nắng')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #475569; cursor: pointer;">💧 Liều lượng tưới nước</button>
          <button class="ai-user-prompt-pill" onclick="sendUserPrompt('Quy định thời gian cách ly thuốc PHI VietGAP')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #475569; cursor: pointer;">📝 Cách ly PHI VietGAP</button>
          <button class="ai-user-prompt-pill" onclick="sendUserPrompt('Kinh nghiệm bón phân NPK thúc trái lớn')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #475569; cursor: pointer;">🌾 Bón NPK thúc trái</button>
        </div>

        <!-- Chat Input Bar -->
        <form onsubmit="handleUserAiSubmit(event)" style="padding: 10px 14px; background: #ffffff; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; align-items: center;">
          <input type="text" id="user-ai-chat-input" placeholder="Hỏi Bé Mầm về cách chăm sóc cây, sâu bệnh..." autocomplete="off" style="flex: 1; border: 1.5px solid #cbd5e1; border-radius: 20px; padding: 9px 16px; font-size: 13px; outline: none; transition: border 0.2s;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#cbd5e1'">
          <button type="submit" style="background: #10b981; color: white; border: none; width: 38px; height: 38px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 4px 10px rgba(16,185,129,0.3);">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </form>
      </div>
    `;
  } else {
    // 🌿 CLEAN MASCOT AVATAR PLACED RIGHT ABOVE FAB BUTTON (+)
    container.innerHTML = `
      <div onclick="toggleUserAiChat()" class="user-clean-avatar" title="Nhấn vào Bé Mầm để hỏi đáp & tư vấn nông nghiệp AI!" style="
        display: flex;
        align-items: flex-end;
        justify-content: center;
        animation: mascot-float-bounce 2.5s infinite ease-in-out;
      ">
        ${_renderCleanAnimeMascotSVG()}
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

window.onMascotClick = toggleUserAiChat;
window.toggleUserAiChat = toggleUserAiChat;
window.initChibiMascot = initChibiMascot;
window.sendUserPrompt = sendUserPrompt;
window.handleUserAiSubmit = handleUserAiSubmit;
