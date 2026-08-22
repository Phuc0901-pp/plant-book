/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/notifications.js — Autonomous Notification Engine & Web Push API
   ═══════════════════════════════════════════════════════════════ */

import { api } from '../core/api.js';

let _notificationsCache = [];

export async function loadNotifications() {
  try {
    const res = await api('/notifications');
    if (res && res.success) {
      _notificationsCache = res.notifications || [];
      renderNotificationsUI(res.unread_count || 0, _notificationsCache);
    }
  } catch (err) {
    console.warn('Lỗi tải thông báo:', err);
  }
}
window.loadNotifications = loadNotifications;

export function renderNotificationsUI(unreadCount, list) {
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

  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:24px 12px; color:#94a3b8; font-size:13px;">
        <i class="fa-solid fa-bell-slash" style="font-size:24px; color:#cbd5e1; margin-bottom:6px; display:block;"></i>
        Chưa có thông báo nào.
      </div>
    `;
    return;
  }

  const typeStyles = {
    danger: { bg: '#fef2f2', border: '#fecaca', icon: 'fa-triangle-exclamation', color: '#ef4444' },
    warning: { bg: '#fff7ed', border: '#ffedd5', icon: 'fa-cloud-sun-rain', color: '#f59e0b' },
    info: { bg: '#f0fdf4', border: '#bbf7d0', icon: 'fa-seedling', color: '#10b981' }
  };

  container.innerHTML = list.map(n => {
    const st = typeStyles[n.type] || typeStyles.info;
    const isUnread = !n.is_read;
    const dateStr = new Date(n.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    return `
      <div onclick="readSingleNotification(${n.id})" style="background:${isUnread ? st.bg : '#ffffff'}; border:1px solid ${isUnread ? st.border : '#f1f5f9'}; border-radius:12px; padding:10px 12px; cursor:pointer; transition:all 0.2s ease; position:relative;">
        ${isUnread ? `<span style="position:absolute; top:12px; right:12px; width:8px; height:8px; background:#ef4444; border-radius:50%;"></span>` : ''}
        <div style="display:flex; align-items:flex-start; gap:10px;">
          <i class="fa-solid ${st.icon}" style="color:${st.color}; font-size:16px; margin-top:2px;"></i>
          <div style="flex:1;">
            <div style="font-size:12.5px; font-weight:800; color:#0f172a; margin-bottom:2px;">${n.title}</div>
            <div style="font-size:12px; color:#475569; line-height:1.4;">${n.message}</div>
            <div style="font-size:10.5px; color:#94a3b8; margin-top:4px; font-weight:600;">${dateStr}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

export function toggleNotificationDropdown() {
  const panel = document.getElementById('notif-dropdown');
  if (!panel) return;
  const isHidden = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) {
    loadNotifications();
  }
}
window.toggleNotificationDropdown = toggleNotificationDropdown;

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
