(function () {
  let _adminNotifs = [];
  let _adminFilter = 'all';
  let _adminPrefs = { sound_enabled: true, quiet_hours_enabled: false, quiet_start: '22:00', quiet_end: '06:00' };

  function adminEsc(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isWithinAdminQuietHours() {
    if (!_adminPrefs.quiet_hours_enabled) return false;
    const now = new Date();
    const nowM = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = String(_adminPrefs.quiet_start || '22:00').split(':').map(Number);
    const [eh, em] = String(_adminPrefs.quiet_end || '06:00').split(':').map(Number);
    const sM = sh * 60 + sm;
    const eM = eh * 60 + em;
    return sM < eM ? (nowM >= sM && nowM < eM) : (nowM >= sM || nowM < eM);
  }

  function playAdminSound(typeOrProfile) {
    const p = String(typeOrProfile || 'chime').toLowerCase();
    if (p === 'silent' || p === 'audit_silent') return;
    const isDanger = p === 'danger' || p === 'siren';
    if (!isDanger && (!_adminPrefs.sound_enabled || isWithinAdminQuietHours())) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (isDanger) {
        [0, 0.15, 0.3].forEach(d => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(880, ctx.currentTime + d);
          osc.frequency.exponentialRampToValueAtTime(1174, ctx.currentTime + d + 0.1);
          gain.gain.setValueAtTime(0.32, ctx.currentTime + d);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + d);
          osc.stop(ctx.currentTime + d + 0.12);
        });
      } else if (p === 'warning' || p === 'alert_double') {
        [0, 0.18].forEach(d => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(784, ctx.currentTime + d);
          osc.frequency.setValueAtTime(987.77, ctx.currentTime + d + 0.07);
          gain.gain.setValueAtTime(0.26, ctx.currentTime + d);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.15);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + d);
          osc.stop(ctx.currentTime + d + 0.15);
        });
      } else {
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
          gain.gain.setValueAtTime(0.22, ctx.currentTime + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.08);
          osc.stop(ctx.currentTime + idx * 0.08 + 0.3);
        });
      }
    } catch (_) {}
  }

  async function adminApiFetch(path, opts = {}) {
    const t = (typeof token !== 'undefined' && token) ? token : (localStorage.getItem('pb_token') || '');
    if (!t) return null;
    const res = await fetch('/api' + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + t,
        ...(opts.headers || {})
      }
    });
    if (!res.ok) return null;
    return res.json();
  }

  function renderAdminNotifications() {
    const badge = document.getElementById('admin-notif-badge');
    const listEl = document.getElementById('admin-notif-list');
    const unreadCount = _adminNotifs.filter(n => !n.is_read).length;
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
    if (!listEl) return;

    let items = _adminNotifs;
    if (_adminFilter === 'unread') items = items.filter(n => !n.is_read);
    else if (_adminFilter === 'danger') items = items.filter(n => n.type === 'danger' || n.severity === 'danger');

    if (!items.length) {
      listEl.innerHTML = '<div style="text-align:center; padding:24px 12px; color:#64748b; font-size:12.5px;">Không có thông báo nào.</div>';
      return;
    }

    listEl.innerHTML = items.map(n => {
      const isDanger = n.type === 'danger' || n.severity === 'danger';
      const isWarn = n.type === 'warning' || n.severity === 'warning';
      const color = isDanger ? '#dc2626' : (isWarn ? '#d97706' : '#059669');
      const bg = !n.is_read ? (isDanger ? '#fff5f5' : '#f8fafc') : '#ffffff';
      return `
        <div onclick="readAdminNotification(${Number(n.id) || 0})" style="padding:10px 12px; border:1px solid #e2e8f0; border-left:4px solid ${color}; border-radius:10px; background:${bg}; cursor:pointer;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <strong style="font-size:12.5px; color:#0f172a;">${adminEsc(n.title)}</strong>
            <button onclick="dismissAdminNotification(event, ${Number(n.id) || 0})" style="border:none; background:transparent; color:#94a3b8; cursor:pointer; font-weight:700;">×</button>
          </div>
          <div style="font-size:11.5px; color:#475569; margin-top:3px;">${adminEsc(n.message)}</div>
        </div>
      `;
    }).join('');
  }

  async function loadAdminNotifications() {
    try {
      const data = await adminApiFetch('/notifications');
      if (data && data.success) {
        _adminNotifs = data.notifications || [];
        renderAdminNotifications();
      }
    } catch (_) {}
  }

  window.loadAdminNotifications = loadAdminNotifications;
  window.playAdminNotificationSound = playAdminSound;

  window.toggleAdminNotificationDropdown = function () {
    const panel = document.getElementById('admin-notif-dropdown');
    const overlay = document.getElementById('admin-notif-overlay');
    if (!panel) return;
    const opening = panel.style.display === 'none' || !panel.style.display;
    panel.style.display = opening ? 'flex' : 'none';
    if (overlay) overlay.style.display = opening ? 'block' : 'none';
    if (opening) loadAdminNotifications();
  };

  window.closeAdminNotificationDropdown = function () {
    const panel = document.getElementById('admin-notif-dropdown');
    const overlay = document.getElementById('admin-notif-overlay');
    if (panel) panel.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
  };

  window.filterAdminNotifications = function (f) {
    _adminFilter = f;
    renderAdminNotifications();
  };

  window.readAdminNotification = async function (id) {
    const item = _adminNotifs.find(n => n.id === id);
    if (item) playAdminSound(item.sound_profile || item.type);
    await adminApiFetch('/notifications/' + id + '/read', { method: 'PUT' });
    loadAdminNotifications();
  };

  window.dismissAdminNotification = async function (e, id) {
    if (e) e.stopPropagation();
    await adminApiFetch('/notifications/' + id, { method: 'DELETE' });
    loadAdminNotifications();
  };

  window.markAllAdminNotificationsRead = async function () {
    await adminApiFetch('/notifications/read-all', { method: 'PUT' });
    loadAdminNotifications();
  };

  window.handleAdminRealtimeNotification = function (payload) {
    const row = payload && payload.notification ? payload.notification : payload;
    if (!row) return;
    const idx = _adminNotifs.findIndex(n => n.id === row.id);
    if (idx >= 0) _adminNotifs[idx] = row;
    else _adminNotifs.unshift(row);
    renderAdminNotifications();
    const soundProfile = (payload && payload.sound_profile) || row.sound_profile || row.severity || row.type;
    playAdminSound(soundProfile);
    if (typeof toast === 'function') {
      toast(`${row.title}: ${row.message}`, row.severity === 'danger' ? 'error' : 'info');
    }
  };

  window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('pb_token')) {
      setTimeout(loadAdminNotifications, 1200);
    }
  });
})();
