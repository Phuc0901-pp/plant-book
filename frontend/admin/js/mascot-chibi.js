/**
 * admin/js/mascot-chibi.js - Pure Minimal 3D Anime Chibi Plant Mascot with Gemini AI Chatbot
 * Xóa hoàn toàn bong bóng thông tin rườm rà; chỉ hiển thị Bé Mầm Chibi góc phải, click là mở Chat AI Gemini!
 */

let _isChatOpen = false;
let _chatHistory = [];
let _isAiResponding = false;

function initAdminChibiMascot() {
  let mascotContainer = document.getElementById('admin-chibi-mascot-widget');
  if (!mascotContainer) {
    mascotContainer = document.createElement('div');
    mascotContainer.id = 'admin-chibi-mascot-widget';
    mascotContainer.style.cssText = `
      position: fixed;
      bottom: 18px;
      right: 22px;
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
  if (!document.getElementById('admin-chibi-clean-style')) {
    const style = document.createElement('style');
    style.id = 'admin-chibi-clean-style';
    style.textContent = `
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
      .admin-clean-avatar {
        cursor: pointer;
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .admin-clean-avatar:hover {
        transform: scale(1.15) translateY(-8px) !important;
      }
      .ai-chat-prompt-pill {
        transition: all 0.2s ease;
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

function _renderCleanAnimeMascotSVG() {
  return `
    <svg width="105" height="120" viewBox="0 0 120 135" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 12px 22px rgba(0,0,0,0.25));">
      <defs>
        <radialGradient id="cleanBodyLight" cx="38%" cy="28%" r="70%">
          <stop offset="0%" stop-color="#86efac" />
          <stop offset="35%" stop-color="#34d399" />
          <stop offset="75%" stop-color="#10b981" />
          <stop offset="100%" stop-color="#047857" />
        </radialGradient>
        <radialGradient id="cleanBellyLight" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="60%" stop-color="#f0fdf4" />
          <stop offset="100%" stop-color="#dcfce7" />
        </radialGradient>
        <radialGradient id="cleanEyeIris" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="45%" stop-color="#0284c7" />
          <stop offset="85%" stop-color="#0f172a" />
        </radialGradient>
        <radialGradient id="cleanLeafLight" cx="30%" cy="25%" r="70%">
          <stop offset="0%" stop-color="#bbf7d0" />
          <stop offset="50%" stop-color="#4ade80" />
          <stop offset="100%" stop-color="#15803d" />
        </radialGradient>
      </defs>

      <!-- Sprout Leaves on Head with Physics Sway -->
      <g style="transform-origin: 60px 32px; animation: leaf-gentle-sway 2s infinite ease-in-out;">
        <path d="M60 30 C56 12 38 10 42 22 C45 30 56 28 60 30Z" fill="url(#cleanLeafLight)" stroke="#15803d" stroke-width="1.2" />
        <path d="M60 30 C64 12 82 10 78 22 C75 30 64 28 60 30Z" fill="url(#cleanLeafLight)" stroke="#15803d" stroke-width="1.2" />
        <circle cx="60" cy="18" r="3.5" fill="#fef08a" />
      </g>

      <!-- Chubby Pear-shaped Sprout Body -->
      <path d="M60 28 C90 28 102 60 98 90 C95 116 78 126 60 126 C42 126 25 116 22 90 C18 60 30 28 60 28Z" fill="url(#cleanBodyLight)" stroke="#ffffff" stroke-width="2.5" />

      <!-- Soft Belly -->
      <ellipse cx="60" cy="94" rx="26" ry="22" fill="url(#cleanBellyLight)" opacity="0.9" />

      <!-- Big Sparkling Anime Left Eye -->
      <g transform="translate(42, 66)">
        <ellipse cx="0" cy="0" rx="9" ry="12" fill="#ffffff" stroke="#0f172a" stroke-width="1.2" />
        <ellipse cx="1" cy="1" rx="7.5" ry="10" fill="url(#cleanEyeIris)" />
        <ellipse cx="1" cy="2" rx="4.5" ry="6.5" fill="#020617" />
        <circle cx="-2" cy="-3" r="3.5" fill="#ffffff" />
        <circle cx="2.5" cy="4" r="1.5" fill="#ffffff" />
        <path d="M-9 -8 Q0 -14 9 -8" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" fill="none" />
      </g>

      <!-- Big Sparkling Anime Right Eye -->
      <g transform="translate(78, 66)">
        <ellipse cx="0" cy="0" rx="9" ry="12" fill="#ffffff" stroke="#0f172a" stroke-width="1.2" />
        <ellipse cx="-1" cy="1" rx="7.5" ry="10" fill="url(#cleanEyeIris)" />
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

      <!-- High-tech HUD Visor -->
      <rect x="28" y="58" width="28" height="16" rx="5" fill="rgba(14,165,233,0.18)" stroke="#38bdf8" stroke-width="1.5" />
      <rect x="64" y="58" width="28" height="16" rx="5" fill="rgba(14,165,233,0.18)" stroke="#38bdf8" stroke-width="1.5" />
      <line x1="56" y1="66" x2="64" y2="66" stroke="#38bdf8" stroke-width="2" />

      <!-- Tiny Cute Hands -->
      <circle cx="26" cy="94" r="6.5" fill="#34d399" stroke="#059669" stroke-width="1.2" />
      <circle cx="94" cy="94" r="6.5" fill="#34d399" stroke="#059669" stroke-width="1.2" />

      <!-- Tiny Cute Boots -->
      <ellipse cx="48" cy="126" rx="8" ry="5.5" fill="#0f172a" stroke="#ffffff" stroke-width="1.2" />
      <ellipse cx="72" cy="126" rx="8" ry="5.5" fill="#0f172a" stroke="#ffffff" stroke-width="1.2" />
    </svg>
  `;
}

function renderAdminMascot() {
  const container = document.getElementById('admin-chibi-mascot-widget');
  if (!container) return;

  if (_isChatOpen) {
    // 💬 CHATBOX GEMINI AI DRAWER
    container.innerHTML = `
      <div id="admin-ai-chat-box" style="
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
              <div style="font-size: 11px; color: #a7f3d0; font-weight: 600;">Hỏi đáp mọi kiến thức & quản trị trang trại</div>
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
              Xin chào Admin! Em là <strong>Bé Mầm AI</strong>. Em đã kết nối trực tiếp với Google Gemini và hệ thống dữ liệu. Admin có thể hỏi em bất kỳ câu hỏi nào về nông nghiệp, CSDL, đời sống hay kiến thức chung ạ! ✨
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
          <button class="ai-chat-prompt-pill" onclick="sendAdminPrompt('Tóm tắt sức khỏe toàn bộ cây trồng hôm nay')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #475569; cursor: pointer;">🌿 Sức khỏe cây</button>
          <button class="ai-chat-prompt-pill" onclick="sendAdminPrompt('Kiểm tra trạng thái cảm biến IoT đất và khí tượng')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #475569; cursor: pointer;">📡 Cảm biến IoT</button>
          <button class="ai-chat-prompt-pill" onclick="sendAdminPrompt('Gợi ý xử lý các cây đang ủ bệnh')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #475569; cursor: pointer;">🩺 Cây bệnh</button>
          <button class="ai-chat-prompt-pill" onclick="sendAdminPrompt('Tư vấn tối ưu chi phí phân bón và nước tưới')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #475569; cursor: pointer;">💰 Tối ưu chi phí</button>
        </div>

        <!-- Chat Input Bar -->
        <form onsubmit="handleAdminAiSubmit(event)" style="padding: 10px 14px; background: #ffffff; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; align-items: center;">
          <input type="text" id="admin-ai-chat-input" placeholder="Nhập câu hỏi bất kỳ cho Bé Mầm AI..." autocomplete="off" style="flex: 1; border: 1.5px solid #cbd5e1; border-radius: 20px; padding: 9px 16px; font-size: 13px; outline: none; transition: border 0.2s;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#cbd5e1'">
          <button type="submit" style="background: #10b981; color: white; border: none; width: 38px; height: 38px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 4px 10px rgba(16,185,129,0.3);">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </form>
      </div>
    `;
  } else {
    // 🌿 ONLY RENDER CUTE 3D ANIME CHIBI MASCOT AT BOTTOM-RIGHT
    container.innerHTML = `
      <div onclick="toggleAdminAiChat()" class="admin-clean-avatar" title="Nhấn vào Bé Mầm để mở Khung Chat AI Gemini!" style="
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
    const botReply = data.reply || 'Dạ, Bé Mầm đã nhận được thông tin!';
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
window.initAdminChibiMascot = initAdminChibiMascot;
window.sendAdminPrompt = sendAdminPrompt;
window.handleAdminAiSubmit = handleAdminAiSubmit;
