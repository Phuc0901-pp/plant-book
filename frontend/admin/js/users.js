/* ════════════════════════════════════════════════════════
   Plant Book Admin — users.js (User/Farmer Management)
   ════════════════════════════════════════════════════════ */
let allUsers = [];

async function loadUsers() {
  const tbody = document.getElementById('users-table');
  const tbodyStatus = document.getElementById('users-status-table');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fa fa-spinner fa-spin"></i> Đang tải danh sách...</td></tr>';
  if (tbodyStatus) {
    tbodyStatus.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fa fa-spinner fa-spin"></i> Đang tải...</td></tr>';
  }

  try {
    const users = await api('/users');
    allUsers = users || [];
    renderUsersTable(allUsers);
    renderUserStatusTable(allUsers);
  } catch (err) {
    toast('Lỗi tải danh sách người dùng: ' + err.message, 'error');
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state text-danger"><i class="fa fa-triangle-exclamation"></i> Lỗi: ${err.message}</td></tr>`;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-table');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Không tìm thấy người dùng nào.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => {
    // Current user label/badge
    const isSelf = currentUser && currentUser.id === u.id;
    const selfBadge = isSelf ? ' <span style="font-size: 10px; background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-weight: 600; margin-left: 6px;">Bạn</span>' : '';
    
    // Role badge
    const roleBadge = u.role === 'admin' 
      ? '<span class="badge badge-admin" style="background:#fef2f2; color:#b91c1c; border: 1px solid #fca5a5; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;"><i class="fa-solid fa-shield-halved"></i> Admin</span>'
      : '<span class="badge badge-user" style="background:#fff7ed; color:#ea580c; border: 1px solid #fdba74; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;"><i class="fa fa-user"></i> Nông hộ</span>';

    const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }) : '—';

    // Actions
    const deleteBtn = isSelf 
      ? `<button class="btn btn-secondary btn-sm" disabled style="opacity:0.5; cursor:not-allowed;" title="Bạn không thể tự xóa tài khoản của mình"><i class="fa fa-trash"></i> Xóa</button>`
      : `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})"><i class="fa fa-trash"></i> Xóa</button>`;

    return `
      <tr data-user-id="${u.id}">
        <td style="font-weight: 600; color: var(--text-main);">${escapeHtml(u.full_name)}${selfBadge}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${roleBadge}</td>
        <td style="color: var(--text-muted); font-size: 13px;">${dateStr}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm" onclick="openUserModal(${u.id})"><i class="fa fa-pen"></i> Sửa</button>
            ${deleteBtn}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterUsers() {
  const q = document.getElementById('user-search').value.toLowerCase().trim();
  if (!q) {
    renderUsersTable(allUsers);
    return;
  }
  const filtered = allUsers.filter(u => 
    (u.full_name || '').toLowerCase().includes(q) || 
    (u.email || '').toLowerCase().includes(q)
  );
  renderUsersTable(filtered);
}

function openUserModal(userId = null) {
  const modal = document.getElementById('user-modal');
  const title = document.getElementById('user-modal-title');
  const passLabel = document.getElementById('f-user-pass-label');
  const passHelp = document.getElementById('f-user-pass-help');
  const passInput = document.getElementById('f-user-pass');
  
  // Clear fields
  document.getElementById('f-user-id').value = '';
  document.getElementById('f-user-name').value = '';
  document.getElementById('f-user-email').value = '';
  document.getElementById('f-user-role').value = 'user';
  passInput.value = '';

  if (userId) {
    // Edit mode
    const u = allUsers.find(x => x.id === userId);
    if (!u) return;

    title.innerHTML = '<i class="fa-solid fa-user-pen" style="color:var(--green)"></i> Chỉnh sửa người dùng';
    document.getElementById('f-user-id').value = u.id;
    document.getElementById('f-user-name').value = u.full_name || '';
    document.getElementById('f-user-email').value = u.email || '';
    document.getElementById('f-user-role').value = u.role || 'user';
    
    passLabel.textContent = 'Mật khẩu mới (Tùy chọn)';
    passHelp.style.display = 'block';
    passInput.placeholder = 'Để trống nếu giữ nguyên';
  } else {
    // Create mode
    title.innerHTML = '<i class="fa-solid fa-user-plus" style="color:var(--green)"></i> Thêm người dùng mới';
    passLabel.textContent = 'Mật khẩu *';
    passHelp.style.display = 'none';
    passInput.placeholder = '••••••••';
  }

  modal.style.display = 'flex';
}

function closeUserModal() {
  document.getElementById('user-modal').style.display = 'none';
}

async function saveUser() {
  const id = document.getElementById('f-user-id').value;
  const full_name = document.getElementById('f-user-name').value.trim();
  const email = document.getElementById('f-user-email').value.trim();
  const password = document.getElementById('f-user-pass').value;
  const role = document.getElementById('f-user-role').value;

  if (!full_name || !email) {
    toast('Họ tên và email là bắt buộc!', 'error');
    return;
  }

  if (!id && !password) {
    toast('Mật khẩu là bắt buộc khi tạo tài khoản mới!', 'error');
    return;
  }

  const btn = document.getElementById('user-save-btn');
  const oldText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Đang lưu...';
  btn.disabled = true;

  const payload = { full_name, email, role };
  if (password) {
    payload.password = password;
  }

  try {
    if (id) {
      // Update
      await api(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      toast('Cập nhật người dùng thành công!');
    } else {
      // Create
      await api('/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      toast('Tạo tài khoản người dùng thành công!');
    }
    window._plantFiltersLoaded = false;
    closeUserModal();
    loadUsers();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.innerHTML = oldText;
    btn.disabled = false;
  }
}

async function deleteUser(id) {
  const u = allUsers.find(x => x.id === id);
  if (!u) return;

  if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản của "${u.full_name}" không?\nThao tác này không thể khôi phục!`)) {
    return;
  }

  try {
    await api(`/users/${id}`, { method: 'DELETE' });
    toast('Đã xóa người dùng thành công.');
    window._plantFiltersLoaded = false;
    loadUsers();
  } catch (err) {
    toast('Lỗi xóa người dùng: ' + err.message, 'error');
  }
}

// Simple HTML escaping to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function switchUserTab(tab) {
  document.getElementById('user-tab-manage').classList.toggle('active', tab === 'manage');
  document.getElementById('user-tab-status').classList.toggle('active', tab === 'status');
  document.getElementById('pane-user-manage').style.display = tab === 'manage' ? 'block' : 'none';
  document.getElementById('pane-user-status').style.display = tab === 'status' ? 'block' : 'none';
}

function formatRelativeTime(dateString) {
  if (!dateString) return 'Chưa từng hoạt động';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (60 * 1000));
  
  if (diffMins < 1) return 'Vừa mới hoạt động';
  if (diffMins < 60) return `${diffMins} phút trước`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  
  return date.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function renderUserStatusTable(users) {
  const tbody = document.getElementById('users-status-table');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Không có dữ liệu.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => {
    const statusHtml = u.is_online
      ? '<span class="badge" style="background:#dcfce7; color:#15803d; border: 1px solid #bbf7d0; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;"><span class="dot-live" style="background:#22c55e; margin-right:4px;"></span> Trực tuyến</span>'
      : '<span class="badge" style="background:#f3f4f6; color:#4b5563; border: 1px solid #e5e7eb; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;">⚪ Ngoại tuyến</span>';

    const lastActiveStr = formatRelativeTime(u.last_active_at);

    return `
      <tr data-user-id="${u.id}">
        <td style="font-weight: 600; color: var(--text-main);">${escapeHtml(u.full_name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${statusHtml}</td>
        <td style="color: var(--text-muted); font-size: 13px;">${lastActiveStr}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="openUserActivityModal(${u.id}, '${escapeHtml(u.full_name)}')">
            <i class="fa fa-clock-rotate-left"></i> Xem lịch sử
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterUserStatuses() {
  const q = document.getElementById('user-status-search').value.toLowerCase().trim();
  if (!q) {
    renderUserStatusTable(allUsers);
    return;
  }
  const filtered = allUsers.filter(u => 
    (u.full_name || '').toLowerCase().includes(q) || 
    (u.email || '').toLowerCase().includes(q)
  );
  renderUserStatusTable(filtered);
}

async function openUserActivityModal(userId, userName) {
  const modal = document.getElementById('user-activity-modal');
  const titleName = document.getElementById('activity-modal-username');
  const timeline = document.getElementById('user-activity-timeline');
  
  if (!modal || !timeline) return;
  
  titleName.textContent = userName;
  timeline.innerHTML = '<div class="empty-state"><i class="fa fa-spinner fa-spin"></i> Đang tải lịch sử hoạt động...</div>';
  modal.style.display = 'flex';
  
  try {
    const activities = await api(`/users/${userId}/activities`);
    if (activities.length === 0) {
      timeline.innerHTML = '<div class="empty-state"><i class="fa-solid fa-clock-rotate-left"></i> Không có lịch sử hoạt động nào gần đây.</div>';
      return;
    }
    
    timeline.innerHTML = activities.map(act => {
      let iconClass = 'info';
      if (act.activity_type === 'Đăng nhập') iconClass = 'login';
      if (act.activity_type === 'Đăng xuất') iconClass = 'logout';
      
      const timeStr = new Date(act.created_at).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      
      return `
        <div class="timeline-item ${iconClass}">
          <div class="timeline-marker"></div>
          <div class="timeline-content">
            <div class="timeline-time">${timeStr}</div>
            <div class="timeline-title">${escapeHtml(act.activity_type)}</div>
            <div class="timeline-desc">${escapeHtml(act.description || '')}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    toast('Lỗi tải lịch sử hoạt động: ' + err.message, 'error');
    timeline.innerHTML = `<div class="empty-state text-danger"><i class="fa fa-triangle-exclamation"></i> Lỗi: ${err.message}</div>`;
  }
}

function closeUserActivityModal() {
  const modal = document.getElementById('user-activity-modal');
  if (modal) modal.style.display = 'none';
}
