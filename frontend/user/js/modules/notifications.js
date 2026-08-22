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

export async function readSingleNotification(id) {
  try {
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
