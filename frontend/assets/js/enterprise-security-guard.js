(function (global) {
  'use strict';

  const SECURITY_CONFIG = {
    enabled: true,
    blockContextMenu: false,
    blockShortcuts: false,
    blockTextDrag: false,
    antiDebugging: false,
    sanitizeConsole: false
  };

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

  let _lastToastTime = 0;
  function showSecurityToast(message) {
    const now = Date.now();
    if (now - _lastToastTime < 2000) return;
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

  function initShortcutInterception() {
    if (!SECURITY_CONFIG.blockContextMenu && !SECURITY_CONFIG.blockShortcuts) return;

    if (SECURITY_CONFIG.blockContextMenu) {
      document.addEventListener('contextmenu', function (e) {
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

    if (SECURITY_CONFIG.blockShortcuts) {
      document.addEventListener('keydown', function (e) {
        const key = e.key || '';
        const keyCode = e.keyCode || e.which || 0;
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const alt = e.altKey;

        if (key === 'F12' || keyCode === 123) {
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Phím tắt F12 đã bị vô hiệu hóa.');
          triggerInstantDebuggerTrap();
          return false;
        }

        if (ctrl && shift && (key === 'I' || key === 'i' || keyCode === 73)) {
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Chức năng Inspect Elements đã bị khóa.');
          triggerInstantDebuggerTrap();
          return false;
        }

        if (ctrl && shift && (key === 'J' || key === 'j' || keyCode === 74)) {
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Chức năng Console đã bị khóa.');
          triggerInstantDebuggerTrap();
          return false;
        }

        if (ctrl && shift && (key === 'C' || key === 'c' || keyCode === 67)) {
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Chức năng chọn phần tử Elements đã bị khóa.');
          triggerInstantDebuggerTrap();
          return false;
        }

        if (ctrl && shift && (key === 'K' || key === 'k' || keyCode === 75)) {
          e.preventDefault();
          e.stopPropagation();
          triggerInstantDebuggerTrap();
          return false;
        }

        if (ctrl && shift && (key === 'E' || key === 'e' || keyCode === 69)) {
          e.preventDefault();
          e.stopPropagation();
          triggerInstantDebuggerTrap();
          return false;
        }

        if (ctrl && (key === 'U' || key === 'u' || keyCode === 85)) {
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Chức năng View Source đã bị vô hiệu hóa.');
          return false;
        }

        if (ctrl && (key === 'S' || key === 's' || keyCode === 83)) {
          e.preventDefault();
          e.stopPropagation();
          showSecurityToast('Chức năng lưu trang đã bị khóa.');
          return false;
        }

        if (ctrl && alt && (key === 'i' || key === 'I' || key === 'j' || key === 'J' || key === 'u' || key === 'U' || key === 'c' || key === 'C')) {
          e.preventDefault();
          e.stopPropagation();
          triggerInstantDebuggerTrap();
          return false;
        }
      }, true);
    }

    if (SECURITY_CONFIG.blockTextDrag) {
      document.addEventListener('dragstart', function (e) {
        if (e.target && e.target.tagName && e.target.tagName.toUpperCase() === 'IMG') {
          e.preventDefault();
          return false;
        }
      }, true);
    }
  }

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

    setInterval(function () {
      triggerInstantDebuggerTrap();
    }, 800);
  }

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

  global.__TBSG_SECURITY_GUARD__ = {
    version: '3.6.0',
    app: 'Sổ Nông Nhàn',
    owner: 'Công ty TNHH Công nghệ nông nghiệp Tân bảo Sài Gòn',
    triggerTrap: triggerInstantDebuggerTrap,
    printBanner: printSecurityBanner
  };

})(typeof window !== 'undefined' ? window : this);
