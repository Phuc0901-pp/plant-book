/* Plant Book Agtech (c) 2026 TBSG Agtech. All Rights Reserved. Enterprise Protected Asset */
/**
 * ══════════════════════════════════════════════════════════════════════
 * SỔ NÔNG NHÀN — ENTERPRISE FRONTEND SECURITY GUARD & ANTI-DEVTOOLS SUITE
 * Bản quyền sở hữu: CÔNG TY TNHH CÔNG NGHỆ NÔNG NGHIỆP TÂN BẢO SÀI GÒN
 * Standards: OWASP Top 10 | ISO/IEC 27001 | Defense-in-Depth Level 3
 * ══════════════════════════════════════════════════════════════════════
 * Features:
 *  1. Shortcut & Context Menu Protection (F12, Right-click, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S)
 *  2. Elements Inspection Lock & Infinite Anti-Debugging Trap
 *  3. Fullscreen Security Lockdown Shield (Freezes & Blurs UI)
 *  4. Official Copyright Banner & Anti-Bot Warning Console Engine
 * ══════════════════════════════════════════════════════════════════════
 */

(function (global) {
  'use strict';

  // Cấu hình an ninh toàn hệ sinh thái Sổ Nông Nhàn
  const SECURITY_CONFIG = {
    enabled: true,
    blockContextMenu: true,
    blockShortcuts: true,
    blockTextDrag: true,
    antiDebugging: true,
    showWarningOverlay: true,
    sanitizeConsole: true,
    enableWatermark: false
  };

  // ── 1. CORPORATE SECURITY BANNER & CONSOLE WARNING ────────────────────
  function printSecurityBanner() {
    if (!global.console) return;
    try {
      if (SECURITY_CONFIG.sanitizeConsole && typeof global.console.clear === 'function') {
        global.console.clear();
      }

      const asciiLogo = `
  ███████╗ ██████╗     ███╗   ██╗ ██████╗ ███╗   ██╗ ██████╗     ███╗   ██╗██╗  ██╗ █████╗ ███╗   ██╗
  ██╔════╝██╔═══██╗    ████╗  ██║██╔═══██╗████╗  ██║██╔════╝     ████╗  ██║██║  ██║██╔══██╗████╗  ██║
  ███████╗██║   ██║    ██╔██╗ ██║██║   ██║██╔██╗ ██║██║  ███╗    ██╔██╗ ██║███████║███████║██╔██╗ ██║
  ╚════██║██║   ██║    ██║╚██╗██║██║   ██║██║╚██╗██║██║   ██║    ██║╚██╗██║██╔══██║██╔══██║██║╚██╗██║
  ███████║╚██████╔╝    ██║ ╚████║╚██████╔╝██║ ╚████║╚██████╔╝    ██║ ╚████║██║  ██║██║  ██║██║ ╚████║
  ╚══════╝ ╚═════╝     ╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝     ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝
               T A N   B A O   S A I   G O N   A G T E C H   S O L U T I O N S
`;

      global.console.log('%c' + asciiLogo, 'color: #10b981; font-weight: 900; font-size: 10px; line-height: 1.2;');

      global.console.log(
        '%c SỔ NÔNG NHÀN %c CÔNG NGHỆ NÔNG NGHIỆP TÂN BẢO SÀI GÒN %c BẢO MẬT v3.5 ',
        'background: #059669; color: #ffffff; font-size: 13px; font-weight: 900; padding: 4px 10px; border-radius: 4px 0 0 4px;',
        'background: #0f172a; color: #38bdf8; font-size: 13px; font-weight: 800; padding: 4px 10px; border-top: 1px solid #38bdf8; border-bottom: 1px solid #38bdf8;',
        'background: #dc2626; color: #ffffff; font-size: 13px; font-weight: 900; padding: 4px 10px; border-radius: 0 4px 4px 0;'
      );

      global.console.log(
        '%c╔══════════════════════════════════════════════════════════════════════════════════════════════════════════╗\n' +
        '║                        ⚠️ CẢNH BÁO BẢO MẬT & BẢN QUYỀN SỞ HỮU TRÍ TUỆ                                    ║\n' +
        '╚══════════════════════════════════════════════════════════════════════════════════════════════════════════╝\n' +
        '%c🔴 Bản quyền ứng dụng Sổ nông nhàn thuộc quyền sở hữu của công ty TNHH Công nghệ nông nghiệp Tân bảo Sài Gòn\n\n' +
        '%c⚠️ Mọi thao tác liên quan đến việc sao chép, ăn cắp trí tuệ --> Đều sẽ bị khởi kiện\n\n' +
        '%c🛑 Hệ thống có anti bot yêu cầu thoát khỏi page này để tránh bị hack ngược lại!!',
        'color: #f59e0b; font-weight: 900; font-size: 13px; line-height: 1.4;',
        'color: #ef4444; font-size: 14.5px; font-weight: 900; line-height: 1.6;',
        'color: #f59e0b; font-size: 14px; font-weight: 800; line-height: 1.6;',
        'color: #ffffff; font-size: 14.5px; font-weight: 900; background: #991b1b; padding: 10px 14px; border-radius: 6px; border: 2px solid #ef4444; display: inline-block; line-height: 1.6;'
      );
    } catch (_) {}
  }

  // ── 2. TOAST NOTIFICATION HELPER ─────────────────────────────────────
  let _lastToastTime = 0;
  function showSecurityToast(message) {
    const now = Date.now();
    if (now - _lastToastTime < 2200) return; // Debounce toast
    _lastToastTime = now;

    if (typeof global.toast === 'function') {
      global.toast(message, 'warning');
      return;
    }

    let badge = document.getElementById('sec-toast-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'sec-toast-badge';
      badge.style.cssText = `
        position: fixed;
        bottom: 28px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: rgba(15, 23, 42, 0.96);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: #ffffff;
        font-family: 'Be Vietnam Pro', system-ui, -apple-system, sans-serif;
        font-size: 13px;
        font-weight: 700;
        padding: 12px 22px;
        border-radius: 9999px;
        box-shadow: 0 12px 35px rgba(0, 0, 0, 0.45);
        border: 1.5px solid rgba(239, 68, 68, 0.6);
        z-index: 2147483647;
        pointer-events: none;
        opacity: 0;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex;
        align-items: center;
        gap: 10px;
      `;
      document.body.appendChild(badge);
    }

    badge.innerHTML = `🛡️ <span>${message}</span>`;
    badge.style.opacity = '1';
    badge.style.transform = 'translateX(-50%) translateY(0)';

    setTimeout(() => {
      badge.style.opacity = '0';
      badge.style.transform = 'translateX(-50%) translateY(20px)';
    }, 2400);
  }

  // ── 3. SHORTCUT & CONTEXT MENU INTERCEPTION ──────────────────────────
  function initShortcutInterception() {
    if (!SECURITY_CONFIG.blockContextMenu && !SECURITY_CONFIG.blockShortcuts) return;

    // 1. Chặn chuột phải (Context Menu)
    if (SECURITY_CONFIG.blockContextMenu) {
      document.addEventListener('contextmenu', function (e) {
        // Cho phép chuột phải nếu đang ở thẻ input hoặc textarea để thuận tiện cho nông dân dán văn bản
        const targetTag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
        if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) {
          return true;
        }
        e.preventDefault();
        e.stopPropagation();
        showSecurityToast('Chuột phải đã bị vô hiệu hóa để bảo vệ bản quyền Sổ Nông Nhàn.');
        return false;
      }, true);
    }

    // 2. Chặn phím tắt DevTools, Elements Picker & View Source
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
          triggerDebuggerTrap();
          return false;
        }

        // Ctrl + Shift + I (Inspect)
        if (ctrl && shift && (key === 'I' || key === 'i' || keyCode === 73)) {
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Chức năng Inspect đã bị khóa bản quyền.');
          triggerDebuggerTrap();
          return false;
        }

        // Ctrl + Shift + J (Console)
        if (ctrl && shift && (key === 'J' || key === 'j' || keyCode === 74)) {
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Chức năng Console đã bị khóa.');
          triggerDebuggerTrap();
          return false;
        }

        // Ctrl + Shift + C (Element Inspector)
        if (ctrl && shift && (key === 'C' || key === 'c' || keyCode === 67)) {
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Chức năng chọn phần tử Elements đã bị khóa.');
          triggerDebuggerTrap();
          return false;
        }

        // Ctrl + Shift + K (Firefox Console)
        if (ctrl && shift && (key === 'K' || key === 'k' || keyCode === 75)) {
          e.preventDefault();
          e.stopPropagation();
          triggerDebuggerTrap();
          return false;
        }

        // Ctrl + Shift + E (Firefox Network)
        if (ctrl && shift && (key === 'E' || key === 'e' || keyCode === 69)) {
          e.preventDefault();
          e.stopPropagation();
          triggerDebuggerTrap();
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
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Chức năng lưu trang đã bị khóa.');
          return false;
        }

        // macOS: Cmd + Option + I / J / U / C
        if (ctrl && alt && (key === 'i' || key === 'I' || key === 'j' || key === 'J' || key === 'u' || key === 'U' || key === 'c' || key === 'C')) {
          e.preventDefault();
          e.stopPropagation();
          triggerDebuggerTrap();
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

  // ── 4. ELEMENTS LOCKING & INFINITE DEBUGGER TRAP ──────────────────────
  let isDevToolsOpen = false;
  let _trapInterval = null;

  function setDevToolsState(open) {
    if (isDevToolsOpen === open) return;
    isDevToolsOpen = open;

    if (open) {
      printSecurityBanner();
      if (SECURITY_CONFIG.showWarningOverlay) {
        showDevToolsBlockerOverlay();
      }
      if (SECURITY_CONFIG.antiDebugging) {
        lockElementsAndTrap();
      }
    } else {
      hideDevToolsBlockerOverlay();
      unlockElements();
    }
  }

  // Infinite Debugger Trap (Freeze Elements inspector & Sources callstack)
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
            setTimeout(a, 30);
          }
        })();
      };
      dbg();
    } catch (_) {}
  }

  function lockElementsAndTrap() {
    // 1. Áp dụng hiệu ứng đóng băng giao diện (blur + pointer lock)
    if (document.body) {
      document.body.style.filter = 'blur(18px) grayscale(60%)';
      document.body.style.pointerEvents = 'none';
      document.body.style.userSelect = 'none';
    }

    // 2. Kích hoạt bẫy ngắt vòng lặp liên tục để khóa cứng tab Elements
    triggerDebuggerTrap();
    if (!_trapInterval) {
      _trapInterval = setInterval(function () {
        if (isDevToolsOpen) {
          triggerDebuggerTrap();
        } else {
          clearInterval(_trapInterval);
          _trapInterval = null;
        }
      }, 300);
    }
  }

  function unlockElements() {
    if (document.body) {
      document.body.style.filter = '';
      document.body.style.pointerEvents = '';
      document.body.style.userSelect = '';
    }
    if (_trapInterval) {
      clearInterval(_trapInterval);
      _trapInterval = null;
    }
  }

  // Blocker Overlay UI - Hiển thị toàn màn hình bảo mật
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
        background: rgba(10, 15, 29, 0.96);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        text-align: center;
        padding: 24px;
        box-sizing: border-box;
        font-family: 'Be Vietnam Pro', system-ui, -apple-system, sans-serif;
      `;
      overlay.innerHTML = `
        <div style="background:rgba(23,32,54,0.92); border:2px solid #ef4444; border-radius:24px; padding:38px 32px; max-width:560px; width:92%; box-shadow:0 30px 80px rgba(0,0,0,0.7); animation:modalFadeIn 0.3s ease;">
          <div style="width:72px; height:72px; border-radius:20px; background:rgba(239,68,68,0.15); border:1.5px solid rgba(239,68,68,0.5); display:flex; align-items:center; justify-content:center; font-size:36px; margin:0 auto 20px auto; color:#ef4444;">
            🛡️
          </div>
          <div style="display:inline-block; background:#dc2626; color:#ffffff; font-size:11px; font-weight:900; letter-spacing:1px; text-transform:uppercase; padding:4px 12px; border-radius:999px; margin-bottom:12px;">
            ANTI-BOT &amp; COPYRIGHT SECURITY LOCK
          </div>
          <h2 style="font-size:20px; font-weight:900; color:#f87171; margin:0 0 14px 0; letter-spacing:-0.3px; line-height:1.4;">
            BẢN QUYỀN ỨNG DỤNG SỔ NÔNG NHÀN
          </h2>
          <div style="background:#0f172a; border-radius:14px; padding:16px 20px; font-size:13.5px; color:#f1f5f9; margin-bottom:18px; text-align:left; border:1px solid #334155; line-height:1.65;">
            <p style="margin:0 0 8px 0; color:#38bdf8; font-weight:700;">
              🏢 Bản quyền ứng dụng Sổ nông nhàn thuộc quyền sở hữu của công ty TNHH Công nghệ nông nghiệp Tân bảo Sài Gòn
            </p>
            <p style="margin:0 0 8px 0; color:#f87171; font-weight:700;">
              ⚖️ Mọi thao tác liên quan đến việc sao chép, ăn cắp trí tuệ --&gt; Đều sẽ bị khởi kiện
            </p>
            <p style="margin:0; color:#ef4444; font-weight:800; background:rgba(220,38,38,0.18); padding:8px 10px; border-radius:8px; border-left:3px solid #ef4444;">
              🛑 Hệ thống có anti bot yêu cầu thoát khỏi page này để tránh bị hack ngược lại!!
            </p>
          </div>
          <p style="font-size:12.5px; color:#94a3b8; margin:0 0 24px 0; line-height:1.5;">
            Khóa an ninh đã được kích hoạt. Vui lòng đóng cửa sổ DevTools / Kiểm tra mã nguồn để tiếp tục sử dụng hệ thống bình thường.
          </p>
          <button type="button" onclick="window.location.reload()" style="background:linear-gradient(135deg, #10b981, #059669); color:#ffffff; font-weight:800; font-size:13.5px; border:none; padding:12px 28px; border-radius:12px; cursor:pointer; box-shadow:0 4px 20px rgba(5,150,105,0.4); display:inline-flex; align-items:center; gap:8px;">
            <span>🔄 Tải lại trang (F5)</span>
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

  // ── 5. HIGH-PRECISION DEVTOOLS DETECTION ENGINE ───────────────────────
  function initDevToolsDetector() {
    const threshold = 160;

    // 1. Phân tích kích thước khung nhìn (Window Outer vs Inner Delta)
    function checkWindowDelta() {
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;
      if (widthDiff || heightDiff) {
        setDevToolsState(true);
      } else if (isDevToolsOpen) {
        setDevToolsState(false);
      }
    }

    // 2. Bẫy Getter đối tượng trong Console (Object.defineProperty Trap)
    const element = new Image();
    Object.defineProperty(element, 'id', {
      get: function () {
        setDevToolsState(true);
      }
    });

    // 3. Bẫy RegExp toString
    const regTrap = /./;
    regTrap.toString = function () {
      setDevToolsState(true);
      return '';
    };

    // Chu kỳ giám sát định kỳ
    setInterval(function () {
      checkWindowDelta();
      if (global.console && global.console.log) {
        global.console.log('%c', element);
        global.console.log(regTrap);
      }
    }, 1200);

    window.addEventListener('resize', checkWindowDelta, { passive: true });
  }

  // ── 6. INITIALIZE ENTERPRISE SECURITY SUITE ───────────────────────────
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

  // Cung cấp giao diện tra cứu nội bộ an toàn
  global.__TBSG_SECURITY_GUARD__ = {
    version: '3.5.0',
    app: 'Sổ Nông Nhàn',
    owner: 'Công ty TNHH Công nghệ nông nghiệp Tân bảo Sài Gòn',
    triggerTrap: triggerDebuggerTrap,
    printBanner: printSecurityBanner
  };

})(typeof window !== 'undefined' ? window : this);
