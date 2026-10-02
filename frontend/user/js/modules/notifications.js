/* Plant Book Agtech (c) 2026 TBSG Agtech. All Rights Reserved. Enterprise Protected Asset */
/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/notifications.js — Autonomous Notification Engine & Web Push API
   ═══════════════════════════════════════════════════════════════ */

import { api } from '../core/api.js';

let _notificationsCache = [];
let _activeNotifFilter = 'all';

export async function loadNotifications() {
  try {
    const res = await api('/notifications');
    if (res && res.success) {
      _notificationsCache = res.notifications || [];
      renderNotificationsUI(res.unread_count || 0, _notificationsCache, _activeNotifFilter);
    }
  } catch (err) {
    console.warn('Lỗi tải thông báo:', err);
  }
}
window.loadNotifications = loadNotifications;

export function filterNotifications(filterType) {
  _activeNotifFilter = filterType;
  const unreadCount = _notificationsCache.filter(n => !n.is_read).length;
  renderNotificationsUI(unreadCount, _notificationsCache, filterType);
}
window.filterNotifications = filterNotifications;

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);

  if (diffSec < 60) return 'Vừa xong';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  
  const isToday = d.toDateString() === now.toDateString();
  const timePart = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Hôm nay ${timePart}`;
  return `${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} ${timePart}`;
}

export function renderNotificationsUI(unreadCount, list, activeFilter = 'all') {
  const badge = document.getElementById('notif-badge');
  const container = document.getElementById('notif-list');

  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  // Update active tab buttons if present
  document.querySelectorAll('.notif-filter-tab').forEach(tab => {
    if (tab.dataset.filter === activeFilter) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  if (!container) return;

  // Filter list
  let displayList = list || [];
  if (activeFilter === 'unread') {
    displayList = displayList.filter(n => !n.is_read);
  } else if (activeFilter === 'danger') {
    displayList = displayList.filter(n => n.type === 'danger');
  }

  if (displayList.length === 0) {
    const emptyMsg = activeFilter === 'unread' ? 'Không có thông báo chưa đọc nào.' : (activeFilter === 'danger' ? 'Hiện không có cảnh báo khẩn cấp nào.' : 'Chưa có thông báo nào.');
    container.innerHTML = `
      <div style="text-align:center; padding:32px 16px; color:#64748b; font-size:13px; background:#ffffff; border-radius:14px; border:1px dashed #cbd5e1; margin:8px 0;">
        <div style="width:48px; height:48px; border-radius:50%; background:#f1f5f9; display:flex; align-items:center; justify-content:center; margin:0 auto 10px auto;">
          <i data-lucide="bell-off" style="width:24px; height:24px; color:#94a3b8;"></i>
        </div>
        <div style="font-weight:700; color:#1e293b; margin-bottom:3px;">${emptyMsg}</div>
        <div style="font-size:11.5px; color:#94a3b8;">Hệ thống sẽ gửi cảnh báo tự động khi có biến động môi trường.</div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const typeConfig = {
    danger: {
      tag: 'Cảnh Báo Khẩn',
      tagBg: '#fef2f2',
      tagColor: '#dc2626',
      tagBorder: '#fecaca',
      icon: 'shield-alert',
      iconBg: '#fef2f2',
      iconColor: '#dc2626',
      borderLeft: '4px solid #dc2626',
      cardBg: '#fffbfb'
    },
    warning: {
      tag: 'Khí Tượng & Phòng Ngừa',
      tagBg: '#fffbeb',
      tagColor: '#d97706',
      tagBorder: '#fde68a',
      icon: 'cloud-sun-rain',
      iconBg: '#fffbeb',
      iconColor: '#d97706',
      borderLeft: '4px solid #d97706',
      cardBg: '#fffdf5'
    },
    info: {
      tag: 'Lịch Canh Tác',
      tagBg: '#ecfdf5',
      tagColor: '#059669',
      tagBorder: '#a7f3d0',
      icon: 'sprout',
      iconBg: '#ecfdf5',
      iconColor: '#059669',
      borderLeft: '4px solid #059669',
      cardBg: '#f6fdf9'
    },
    success: {
      tag: 'Hệ Thống IoT',
      tagBg: '#f0f9ff',
      tagColor: '#0284c7',
      tagBorder: '#bae6fd',
      icon: 'check-circle-2',
      iconBg: '#f0f9ff',
      iconColor: '#0284c7',
      borderLeft: '4px solid #0284c7',
      cardBg: '#f8fcff'
    }
  };

  container.innerHTML = displayList.map(n => {
    const cfg = typeConfig[n.type] || typeConfig.info;
    const isUnread = !n.is_read;
    const timeAgo = formatTimeAgo(n.created_at);

    return `
      <div id="notif-item-${n.id}" onclick="readSingleNotification(${n.id})" 
        style="background:${isUnread ? cfg.cardBg : '#ffffff'}; 
               border: 1px solid ${isUnread ? cfg.tagBorder : '#e2e8f0'}; 
               border-left: ${cfg.borderLeft}; 
               border-radius: 14px; 
               padding: 12px 14px; 
               cursor: pointer; 
               transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); 
               box-shadow: ${isUnread ? '0 2px 8px rgba(0,0,0,0.04)' : '0 1px 2px rgba(0,0,0,0.02)'}; 
               position: relative;"
        onmouseenter="this.style.transform='translateY(-1.5px)'; this.style.boxShadow='0 6px 16px rgba(0,0,0,0.06)';"
        onmouseleave="this.style.transform='translateY(0)'; this.style.boxShadow='${isUnread ? '0 2px 8px rgba(0,0,0,0.04)' : '0 1px 2px rgba(0,0,0,0.02)'}';"
      >
        <!-- Header Row: Tag & Close Button -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:20px; font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.3px; background:${cfg.tagBg}; color:${cfg.tagColor}; border:1px solid ${cfg.tagBorder};">
              <i data-lucide="${cfg.icon}" style="width:12px; height:12px;"></i> ${cfg.tag}
            </span>
            ${isUnread ? `<span style="display:inline-flex; align-items:center; gap:3px; font-size:10.5px; font-weight:700; color:#dc2626; background:#fee2e2; padding:2px 6px; border-radius:12px;"><span style="width:5px; height:5px; border-radius:50%; background:#dc2626;"></span> Mới</span>` : ''}
          </div>

          <button onclick="dismissSingleNotification(event, ${n.id})" title="Xóa thông báo này" 
            style="background:transparent; border:none; color:#94a3b8; cursor:pointer; width:24px; height:24px; border-radius:6px; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" 
            onmouseenter="this.style.color='#dc2626'; this.style.background='#fee2e2';" 
            onmouseleave="this.style.color='#94a3b8'; this.style.background='transparent';"
          >
            <i data-lucide="x" style="width:14px; height:14px;"></i>
          </button>
        </div>

        <!-- Body: Icon Box + Title + Message -->
        <div style="display:flex; align-items:flex-start; gap:12px;">
          <div style="width:36px; height:36px; border-radius:10px; background:${cfg.iconBg}; border:1px solid ${cfg.tagBorder}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <i data-lucide="${cfg.icon}" style="width:18px; height:18px; color:${cfg.iconColor};"></i>
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:13px; font-weight:800; color:#0f172a; margin-bottom:3px; line-height:1.35; letter-spacing:-0.2px;">
              ${n.title}
            </div>
            <div style="font-size:12px; color:#334155; line-height:1.45; font-weight:500;">
              ${n.message}
            </div>
            <div style="display:flex; align-items:center; gap:5px; font-size:11px; color:#64748b; margin-top:6px; font-weight:600;">
              <i data-lucide="clock" style="width:12px; height:12px;"></i>
              <span>${timeAgo}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

export async function dismissSingleNotification(e, id) {
  if (e) e.stopPropagation();
  const itemEl = document.getElementById(`notif-item-${id}`);
  if (itemEl) {
    itemEl.style.opacity = '0';
    itemEl.style.transform = 'scale(0.95)';
  }
  try {
    await api(`/notifications/${id}`, { method: 'DELETE' });
    if (window.toast) window.toast('Đã gỡ thông báo.', 'info');
    loadNotifications();
  } catch (err) {
    console.warn('Lỗi xóa thông báo:', err);
  }
}
window.dismissSingleNotification = dismissSingleNotification;
window.dismissSingleNotification = dismissSingleNotification;

export function toggleNotificationDropdown() {
  const panel = document.getElementById('notif-dropdown');
  const overlay = document.getElementById('notif-overlay');
  if (!panel) return;
  const isHidden = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = isHidden ? 'flex' : 'none';
  if (overlay) overlay.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    loadNotifications();
  }
}
window.toggleNotificationDropdown = toggleNotificationDropdown;

export function closeNotificationDropdown() {
  const panel = document.getElementById('notif-dropdown');
  const overlay = document.getElementById('notif-overlay');
  if (panel) panel.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
}
window.closeNotificationDropdown = closeNotificationDropdown;

export async function markAllNotificationsRead() {
  try {
    await api('/notifications/read-all', { method: 'PUT' });
    loadNotifications();
    if (window.toast) window.toast('Đã đánh dấu đọc tất cả thông báo.', 'success');
  } catch (err) {
    console.warn('Lỗi đánh dấu thông báo:', err);
  }
}
window.markAllNotificationsRead = markAllNotificationsRead;

/** Web Audio API Synthesizers for Notification Sounds */
export function playCheerfulChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Cheerful Arpeggio Chime)
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.35);
    });
  } catch (e) {
    console.warn('Audio play prevented:', e);
  }
}
window.playCheerfulChime = playCheerfulChime;

export function playStrongAlert() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    // Strong 3-pulse alarm siren (880Hz A5 & 1174Hz D6)
    [0, 0.15, 0.3].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime + delay);
      osc.frequency.exponentialRampToValueAtTime(1174, ctx.currentTime + delay + 0.1);
      gain.gain.setValueAtTime(0.35, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.12);
    });
  } catch (e) {
    console.warn('Audio play prevented:', e);
  }
}
window.playStrongAlert = playStrongAlert;

export function playNotificationSound(type = 'info') {
  if (type === 'danger') {
    playStrongAlert();
  } else {
    playCheerfulChime();
  }
}
window.playNotificationSound = playNotificationSound;

export async function readSingleNotification(id) {
  try {
    const item = _notificationsCache.find(n => n.id === id);
    if (item) {
      playNotificationSound(item.type);
    }
    await api(`/notifications/${id}/read`, { method: 'PUT' });
    loadNotifications();
  } catch (err) {
    console.warn('Lỗi đọc thông báo:', err);
  }
}
window.readSingleNotification = readSingleNotification;

/** HTML5 Web Push Notification Request */
export function requestWebPushPermission() {
  if (!('Notification' in window)) {
    alert('Trình duyệt của bạn không hỗ trợ thông báo màn hình.');
    return;
  }

  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      playCheerfulChime();
      new Notification('🌱 Tân Bảo AgTech - Đã bật Thông báo Đẩy', {
        body: 'Bạn sẽ nhận được cảnh báo trực tiếp về Độ ẩm đất, Sâu bệnh và Dự báo thời tiết nông nghiệp!',
        icon: '/assets/logo.png'
      });
      if (window.toast) window.toast('🔔 Đã bật thông báo màn hình thiết bị thành công!', 'success');
    } else {
      alert('Bạn đã từ chối quyền thông báo. Vui lòng cấp quyền trong cài đặt trình duyệt.');
    }
  });
}
window.requestWebPushPermission = requestWebPushPermission;

// Auto load notifications when user logs in
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('pb_token')) {
    setTimeout(loadNotifications, 1000);
  }
});
