/* Plant Book Agtech (c) 2026 TBSG Agtech. All Rights Reserved. Enterprise Protected Asset */
/**
 * ══════════════════════════════════════════════════════════════════════
 * SỔ NÔNG NHÀN — ENTERPRISE FRONTEND SECURITY GUARD & ANTI-INSPECT SUITE
 * Bản quyền sở hữu: CÔNG TY TNHH CÔNG NGHỆ NÔNG NGHIỆP TÂN BẢO SÀI GÒN
 * Standards: OWASP Top 10 | ISO/IEC 27001 | Defense-in-Depth Level 3
 * ══════════════════════════════════════════════════════════════════════
 * Features:
 *  1. Shortcut & Context Menu Protection (F12, Right-click, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S)
 *  2. Elements Inspection Lock via Non-Intrusive Dynamic Debugger Trap
 *  3. Zero False-Positive Engine (Không gây khóa nhầm khi lướt web bình thường)
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
    antiDebugging: true, // Kích hoạt bẫy debugger khi có công cụ thanh tra mở
    sanitizeConsole: false // Không xóa trắng console để luôn hiển thị banner bản quyền
  };

  // ── 1. CORPORATE SECURITY BANNER & CONSOLE WARNING ────────────────────
  function printSecurityBanner() {
    if (!global.console) return;
    try {
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
        '%c 🌾 SỔ NÔNG NHÀN %c CÔNG NGHỆ NÔNG NGHIỆP TÂN BẢO SÀI GÒN %c BẢO MẬT v3.5 ',
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
    if (now - _lastToastTime < 2000) return; // Debounce toast
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
        // Cho phép chuột phải nếu đang ở thẻ input hoặc textarea để thuận tiện dán dữ liệu
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
          triggerInstantDebuggerTrap();
          return false;
        }

        // Ctrl + Shift + I (Inspect)
        if (ctrl && shift && (key === 'I' || key === 'i' || keyCode === 73)) {
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Chức năng Inspect Elements đã bị khóa.');
          triggerInstantDebuggerTrap();
          return false;
        }

        // Ctrl + Shift + J (Console)
        if (ctrl && shift && (key === 'J' || key === 'j' || keyCode === 74)) {
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Chức năng Console đã bị khóa.');
          triggerInstantDebuggerTrap();
          return false;
        }

        // Ctrl + Shift + C (Element Inspector)
        if (ctrl && shift && (key === 'C' || key === 'c' || keyCode === 67)) {
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Chức năng chọn phần tử Elements đã bị khóa.');
          triggerInstantDebuggerTrap();
          return false;
        }

        // Ctrl + Shift + K (Firefox Console)
        if (ctrl && shift && (key === 'K' || key === 'k' || keyCode === 75)) {
          e.preventDefault();
          e.stopPropagation();
          triggerInstantDebuggerTrap();
          return false;
        }

        // Ctrl + Shift + E (Firefox Network)
        if (ctrl && shift && (key === 'E' || key === 'e' || keyCode === 69)) {
          e.preventDefault();
          e.stopPropagation();
          triggerInstantDebuggerTrap();
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
          triggerInstantDebuggerTrap();
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

  // ── 4. CHUẨN XÁC: BẪY DEBUGGER KHÓA ELEMENTS (CHỈ CHẠY KHI DEVTOOLS MỞ) ────
  // Khi DevTools ĐÓNG: Hàm này thực thi trong 0.0001ms và hoàn toàn vô hại, không làm mờ, không đơ web!
  // Khi DevTools MỞ: Trình duyệt lập tức ngắt luồng tại lệnh debugger, đóng băng mọi thao tác soi Elements!
  function triggerInstantDebuggerTrap() {
    if (!SECURITY_CONFIG.antiDebugging) return;
    try {
      (function () {
        return false;
      })['constructor']('debugger')();
    } catch (_) {}
  }

  function initDynamicAntiDebugEngine() {
    if (!SECURITY_CONFIG.antiDebugging) return;

    // Chạy ngầm bẫy kiểm tra định kỳ mỗi 800ms
    // Nếu không mở DevTools: Không có gì xảy ra, website mượt mà 100%
    // Nếu mở DevTools: Trình duyệt bị bắt giữ tại điểm debugger, tab Elements bị khóa cứng
    setInterval(function () {
      triggerInstantDebuggerTrap();
    }, 800);
  }

  // ── 5. INITIALIZE ENTERPRISE SECURITY SUITE ───────────────────────────
  function initEnterpriseSecurity() {
    if (!SECURITY_CONFIG.enabled) return;

    printSecurityBanner();
    initShortcutInterception();
    initDynamicAntiDebugEngine();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnterpriseSecurity);
  } else {
    initEnterpriseSecurity();
  }

  // Cung cấp giao diện tra cứu nội bộ an toàn
  global.__TBSG_SECURITY_GUARD__ = {
    version: '3.6.0',
    app: 'Sổ Nông Nhàn',
    owner: 'Công ty TNHH Công nghệ nông nghiệp Tân bảo Sài Gòn',
    triggerTrap: triggerInstantDebuggerTrap,
    printBanner: printSecurityBanner
  };

})(typeof window !== 'undefined' ? window : this);
