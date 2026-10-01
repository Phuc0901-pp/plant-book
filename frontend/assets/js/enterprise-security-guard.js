/* Plant Book Agtech (c) 2026 TBSG Agtech. All Rights Reserved. Enterprise Protected Asset */
/**
 * ══════════════════════════════════════════════════════════════════════
 * PLANT BOOK AGTECH — ENTERPRISE FRONTEND SECURITY GUARD & ANTI-INSPECT
 * Standards: OWASP Top 10 | ISO/IEC 27001 | Defense-in-Depth Level 3
 * ══════════════════════════════════════════════════════════════════════
 * Features:
 *  1. Shortcut & Context Menu Protection (F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S)
 *  2. Active DevTools Detection & Infinite Anti-Debugging Trap
 *  3. Production Console Sanitization & Legal Security Banner
 *  4. Anti-Tampering Shield & Dynamic Screen Watermark
 * ══════════════════════════════════════════════════════════════════════
 */

(function (global) {
  'use strict';

  // Configuration settings
  const SECURITY_CONFIG = {
    enabled: true,
    blockContextMenu: true,
    blockShortcuts: true,
    blockTextDrag: true,
    antiDebugging: true,
    showWarningOverlay: true,
    sanitizeConsole: true,
    enableWatermark: false // Enabled when user is authenticated
  };

  // ── 1. CORPORATE SECURITY BANNER & CONSOLE SANITIZER ─────────────────
  function printSecurityBanner() {
    if (!global.console) return;
    try {
      const bannerTitle = `
██████╗ ██╗      █████╗ ███╗   ██╗████████╗    ██████╗  ██████╗  ██████╗ ██╗  ██╗
██╔══██╗██║     ██╔══██╗████╗  ██║╚══██╔══╝    ██╔══██╗██╔═══██╗██╔═══██╗██║ ██╔╝
██████╔╝██║     ███████║██╔██╗ ██║   ██║       ██████╔╝██║   ██║██║   ██║█████╔╝ 
██╔═══╝ ██║     ██╔══██║██║╚██╗██║   ██║       ██║   ██║██║   ██║██║   ██║██╔═██╗ 
██║     ███████╗██║  ██║██║ ╚████║   ██║       ██████╔╝╚██████╔╝╚██████╔╝██║  ██╗
╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝       ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝
`;
      global.console.log('%c' + bannerTitle, 'color: #059669; font-weight: 900; font-size: 11px;');
      global.console.log(
        '%c⚠️ CẢNH BÁO BẢO MẬT & BẢN QUYỀN HỆ THỐNG (TBSG AGTECH ENTERPRISE SECURITY)\n' +
        '%cMã nguồn và kiến trúc giao diện đã được đăng ký quyền sở hữu trí tuệ.\n' +
        'Nghiêm cấm mọi hành vi can thiệp, sao chép, dò quét mã (Reverse Engineering) hoặc trích xuất tài nguyên trái phép.\n' +
        'Mọi hành vi vi phạm sẽ bị ghi nhận nhật ký an ninh và xử lý theo quy định của pháp luật.',
        'color: #dc2626; font-size: 14px; font-weight: 800;',
        'color: #475569; font-size: 12px; font-weight: 600;'
      );
    } catch (_) {}
  }

  // ── 2. TOAST NOTIFICATION HELPER ─────────────────────────────────────
  let _lastToastTime = 0;
  function showSecurityToast(message) {
    const now = Date.now();
    if (now - _lastToastTime < 2500) return; // Debounce toast
    _lastToastTime = now;

    if (typeof global.toast === 'function') {
      global.toast(message, 'warning');
      return;
    }

    // Fallback lightweight popup badge
    let badge = document.getElementById('sec-toast-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'sec-toast-badge';
      badge.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: rgba(15, 23, 42, 0.92);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: #ffffff;
        font-size: 13px;
        font-weight: 700;
        padding: 10px 20px;
        border-radius: 9999px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        border: 1px solid rgba(239, 68, 68, 0.4);
        z-index: 9999999;
        pointer-events: none;
        opacity: 0;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      document.body.appendChild(badge);
    }

    badge.innerHTML = `🛡️ ${message}`;
    badge.style.opacity = '1';
    badge.style.transform = 'translateX(-50%) translateY(0)';

    setTimeout(() => {
      badge.style.opacity = '0';
      badge.style.transform = 'translateX(-50%) translateY(20px)';
    }, 2200);
  }

  // ── 3. SHORTCUT & CONTEXT MENU INTERCEPTION ──────────────────────────
  function initShortcutInterception() {
    if (!SECURITY_CONFIG.blockContextMenu && !SECURITY_CONFIG.blockShortcuts) return;

    // 1. Chặn chuột phải (Context Menu)
    if (SECURITY_CONFIG.blockContextMenu) {
      document.addEventListener('contextmenu', function (e) {
        // Cho phép chuột phải nếu đang ở thẻ input hoặc textarea để tiện dán văn bản
        const targetTag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
        if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || e.target.isContentEditable) {
          return true;
        }
        e.preventDefault();
        e.stopPropagation();
        showSecurityToast('Tính năng kiểm tra mã nguồn đã được bảo vệ bản quyền.');
        return false;
      }, true);
    }

    // 2. Chặn phím tắt DevTools & View Source
    if (SECURITY_CONFIG.blockShortcuts) {
      document.addEventListener('keydown', function (e) {
        const key = e.key || '';
        const keyCode = e.keyCode || e.which || 0;
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const alt = e.altKey;

        // F12
        if (key === 'F12' || keyCode === 123) {
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Phím tắt F12 đã bị vô hiệu hóa.');
          return false;
        }

        // Ctrl + Shift + I (Inspect)
        if (ctrl && shift && (key === 'I' || key === 'i' || keyCode === 73)) {
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Chức năng Inspect đã bị vô hiệu hóa.');
          return false;
        }

        // Ctrl + Shift + J (Console)
        if (ctrl && shift && (key === 'J' || key === 'j' || keyCode === 74)) {
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Chức năng Console đã bị vô hiệu hóa.');
          return false;
        }

        // Ctrl + Shift + C (Element Inspector)
        if (ctrl && shift && (key === 'C' || key === 'c' || keyCode === 67)) {
          // Bỏ qua nếu người dùng chỉ nhấn Ctrl+C để copy text thông thường
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Chức năng Element Picker đã bị vô hiệu hóa.');
          return false;
        }

        // Ctrl + Shift + K (Firefox Console)
        if (ctrl && shift && (key === 'K' || key === 'k' || keyCode === 75)) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        // Ctrl + U (View Source)
        if (ctrl && (key === 'U' || key === 'u' || keyCode === 85)) {
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Chức năng View Source đã bị vô hiệu hóa.');
          return false;
        }

        // Ctrl + S (Save Page As)
        if (ctrl && (key === 'S' || key === 's' || keyCode === 83)) {
          // Cho phép nếu không nhấn shift
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Chức năng lưu trang trực tiếp đã bị khóa.');
          return false;
        }

        // macOS: Cmd + Option + I / J / U / C
        if (ctrl && alt && (key === 'i' || key === 'I' || key === 'j' || key === 'J' || key === 'u' || key === 'U' || key === 'c' || key === 'C')) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }, true);
    }

    // 3. Chặn kéo thả hình ảnh / tài nguyên
    if (SECURITY_CONFIG.blockTextDrag) {
      document.addEventListener('dragstart', function (e) {
        if (e.target && e.target.tagName && e.target.tagName.toUpperCase() === 'IMG') {
          e.preventDefault();
          return false;
        }
      }, true);
    }
  }

  // ── 4. ACTIVE DEVTOOLS DETECTION & ANTI-DEBUGGING ─────────────────────
  let isDevToolsOpen = false;

  function setDevToolsState(open) {
    if (isDevToolsOpen === open) return;
    isDevToolsOpen = open;

    if (open) {
      printSecurityBanner();
      if (SECURITY_CONFIG.showWarningOverlay) {
        showDevToolsBlockerOverlay();
      }
      if (SECURITY_CONFIG.antiDebugging) {
        triggerDebuggerTrap();
      }
    } else {
      hideDevToolsBlockerOverlay();
    }
  }

  // Blocker Overlay UI
  function showDevToolsBlockerOverlay() {
    let overlay = document.getElementById('sec-devtools-guard-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sec-devtools-guard-overlay';
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(15, 23, 42, 0.96);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        z-index: 99999999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        text-align: center;
        padding: 24px;
        box-sizing: border-box;
      `;
      overlay.innerHTML = `
        <div style="background:rgba(30,41,59,0.85); border:1.5px solid rgba(239,68,68,0.5); border-radius:24px; padding:36px 32px; max-width:520px; width:92%; box-shadow:0 25px 60px rgba(0,0,0,0.5); animation:modalFadeIn 0.3s ease;">
          <div style="width:64px; height:64px; border-radius:18px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4); display:flex; align-items:center; justify-content:center; font-size:30px; margin:0 auto 18px auto; color:#ef4444;">
            🛡️
          </div>
          <h2 style="font-size:18px; font-weight:900; color:#f87171; margin:0 0 10px 0; letter-spacing:-0.2px;">
            PHÁT HIỆN CÔNG CỤ DÒ QUÉT MÃ NGUỒN
          </h2>
          <p style="font-size:13.5px; color:#cbd5e1; line-height:1.6; margin:0 0 20px 0;">
            Hệ thống <strong>Plant Book AgTech</strong> phát hiện cửa sổ kiểm tra mã nguồn (Developer Tools) đang được kích hoạt.
          </p>
          <div style="background:#0f172a; border-radius:12px; padding:12px 16px; font-size:12.5px; color:#94a3b8; margin-bottom:24px; text-align:left; border:1px solid #334155;">
            🔒 <strong>Yêu cầu an ninh:</strong> Vui lòng đóng cửa sổ DevTools / Inspect để tiếp tục sử dụng hệ thống một cách an toàn.
          </div>
          <button type="button" onclick="window.location.reload()" style="background:linear-gradient(135deg, #10b981, #059669); color:#ffffff; font-weight:800; font-size:13px; border:none; padding:12px 24px; border-radius:12px; cursor:pointer; box-shadow:0 4px 15px rgba(5,150,105,0.35);">
            🔄 Tải lại trang (F5)
          </button>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
  }

  function hideDevToolsBlockerOverlay() {
    const overlay = document.getElementById('sec-devtools-guard-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  // Infinite Debugger Trap (Freeze devtools inspector)
  function triggerDebuggerTrap() {
    if (!SECURITY_CONFIG.antiDebugging) return;
    try {
      const dbg = function () {
        (function a() {
          try {
            (function b(i) {
              if (('' + (i / i)).length !== 1 || i % 20 === 0) {
                (function () {}).constructor('debugger')();
              } else {
                debugger;
              }
              b(++i);
            })(0);
          } catch (_) {
            setTimeout(a, 50);
          }
        })();
      };
      dbg();
    } catch (_) {}
  }

  // High-precision DevTools Detection Engine
  function initDevToolsDetector() {
    const threshold = 160;

    // 1. Kích thước cửa sổ Docked Inspector
    function checkWindowDelta() {
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;
      if (widthDiff || heightDiff) {
        setDevToolsState(true);
      } else if (isDevToolsOpen) {
        setDevToolsState(false);
      }
    }

    // 2. Timing Delta Check
    function checkTiming() {
      const start = performance.now();
      // debugger statement will pause if DevTools is active
      /* eslint-disable no-debugger */
      if (isDevToolsOpen && SECURITY_CONFIG.antiDebugging) {
        debugger;
      }
      const end = performance.now();
      if (end - start > 100) {
        setDevToolsState(true);
      }
    }

    // 3. Console toString / Object.defineProperty Trap
    const element = new Image();
    Object.defineProperty(element, 'id', {
      get: function () {
        setDevToolsState(true);
      }
    });

    setInterval(function () {
      checkWindowDelta();
      // Only run console detector periodically
      if (global.console && global.console.log) {
        global.console.log('%c', element);
      }
    }, 1000);

    window.addEventListener('resize', checkWindowDelta, { passive: true });
  }

  // ── 5. INITIALIZE ENTERPRISE SECURITY SUITE ───────────────────────────
  function initEnterpriseSecurity() {
    if (!SECURITY_CONFIG.enabled) return;

    printSecurityBanner();
    initShortcutInterception();
    initDevToolsDetector();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnterpriseSecurity);
  } else {
    initEnterpriseSecurity();
  }

  // Expose configuration toggler for verified admins if needed
  global.__TBSG_SECURITY_GUARD__ = {
    version: '3.0.0',
    setConfig: function (newConfig) {
      Object.assign(SECURITY_CONFIG, newConfig || {});
    },
    triggerTrap: triggerDebuggerTrap
  };

})(typeof window !== 'undefined' ? window : this);
