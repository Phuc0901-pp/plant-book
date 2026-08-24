/* ════════════════════════════════════════════════════════
   Plant Book Admin — users.js (User/Farmer Management)
   ════════════════════════════════════════════════════════ */
let allUsers = [];
let currentFilterGroup = 'all'; // 'all', 'admin', 'pro', 'normal'
let currentPage = 1;
const USERS_PAGE_SIZE = 10;

async function loadUsers() {
  const tbody = document.getElementById('users-table');
  const tbodyStatus = document.getElementById('users-status-table');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fa fa-spinner fa-spin"></i> Đang tải danh sách...</td></tr>';
  if (tbodyStatus) {
    tbodyStatus.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fa fa-spinner fa-spin"></i> Đang tải...</td></tr>';
  }

  try {
    const users = await api('/users');
    allUsers = users || [];
    updateUserCounters();
    filterUsers();
    renderUserStatusTable(allUsers);
    loadResetRequests();
  } catch (err) {
    toast('Lỗi tải danh sách người dùng: ' + err.message, 'error');
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state text-danger"><i class="fa fa-triangle-exclamation"></i> Lỗi: ${err.message}</td></tr>`;
  }
}

function updateUserCounters() {
  const cntAll = allUsers.length;
  const cntAdmin = allUsers.filter(u => u.role === 'admin').length;
  const cntPro = allUsers.filter(u => u.role !== 'admin' && u.account_tier === 'pro').length;
  const cntNormal = allUsers.filter(u => u.role !== 'admin' && u.account_tier !== 'pro').length;

  if (document.getElementById('cnt-user-all')) document.getElementById('cnt-user-all').textContent = cntAll;
  if (document.getElementById('cnt-user-admin')) document.getElementById('cnt-user-admin').textContent = cntAdmin;
  if (document.getElementById('cnt-user-pro')) document.getElementById('cnt-user-pro').textContent = cntPro;
  if (document.getElementById('cnt-user-normal')) document.getElementById('cnt-user-normal').textContent = cntNormal;
}

function setUserFilterGroup(group) {
  currentFilterGroup = group;
  currentPage = 1;

  document.querySelectorAll('.user-filter-btn').forEach(btn => {
    const isAct = btn.dataset.filter === group;
    btn.classList.toggle('active', isAct);
    if (isAct) {
      btn.style.background = '#059669';
      btn.style.color = '#ffffff';
      btn.style.borderColor = '#059669';
      btn.style.fontWeight = '800';
    } else {
      btn.style.background = '#ffffff';
      btn.style.borderColor = '#cbd5e1';
      btn.style.fontWeight = '700';
      if (btn.dataset.filter === 'admin') btn.style.color = '#b91c1c';
      else if (btn.dataset.filter === 'pro') btn.style.color = '#047857';
      else if (btn.dataset.filter === 'normal') btn.style.color = '#64748b';
      else btn.style.color = '#334155';
    }
  });

  filterUsers();
}

function filterUsers() {
  const q = (document.getElementById('user-search')?.value || '').toLowerCase().trim();

  let filtered = allUsers;

  // 1. Group Filter
  if (currentFilterGroup === 'admin') {
    filtered = filtered.filter(u => u.role === 'admin');
  } else if (currentFilterGroup === 'pro') {
    filtered = filtered.filter(u => u.role !== 'admin' && u.account_tier === 'pro');
  } else if (currentFilterGroup === 'normal') {
    filtered = filtered.filter(u => u.role !== 'admin' && u.account_tier !== 'pro');
  }

  // 2. Search Filter
  if (q) {
    filtered = filtered.filter(u =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.farm_name || '').toLowerCase().includes(q) ||
      (u.public_id || '').toLowerCase().includes(q) ||
      (`adm-${u.id}`).includes(q) ||
      (`usr-${u.id}`).includes(q)
    );
  }

  renderUsersTable(filtered);
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-table');
  const pagInfo = document.getElementById('users-pagination-info');
  const pagBtns = document.getElementById('users-pagination-btns');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Không tìm thấy người dùng nào.</td></tr>';
    if (pagInfo) pagInfo.textContent = 'Hiển thị 0 người dùng';
    if (pagBtns) pagBtns.innerHTML = '';
    return;
  }

  // Pagination Logic (10 items / page)
  const totalItems = users.length;
  const totalPages = Math.ceil(totalItems / USERS_PAGE_SIZE);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * USERS_PAGE_SIZE;
  const endIdx = Math.min(startIdx + USERS_PAGE_SIZE, totalItems);
  const pageUsers = users.slice(startIdx, endIdx);

  tbody.innerHTML = pageUsers.map(u => {
    const isSelf = currentUser && currentUser.id === u.id;
    const selfBadge = isSelf ? ' <span style="font-size: 10px; background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-weight: 600; margin-left: 6px;">Bạn</span>' : '';
    
    const publicId = u.public_id || (typeof generateIsoPublicId === 'function' ? generateIsoPublicId(u.role, u.id) : (u.role === 'admin' ? `adm-${u.id}` : `usr-${u.id}`));

    const roleBadge = u.role === 'admin' 
      ? '<span class="badge badge-admin" style="background:#fef2f2; color:#b91c1c; border: 1px solid #fca5a5; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;"><i class="fa-solid fa-shield-halved"></i> Admin</span>'
      : '<span class="badge badge-user" style="background:#fff7ed; color:#ea580c; border: 1px solid #fdba74; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;"><i class="fa fa-user"></i> Nông hộ</span>';

    let tierBadge = '';
    if (u.account_tier === 'pro') {
      if (u.tier_expires_at) {
        const diffMs = new Date(u.tier_expires_at) - new Date();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          const isWarning = diffDays <= 7;
          const bg = isWarning ? '#fffbeb' : '#ecfdf5';
          const color = isWarning ? '#b45309' : '#047857';
          const border = isWarning ? '#fde68a' : '#a7f3d0';
          tierBadge = `<span class="badge" style="background:${bg}; color:${color}; border:1px solid ${border}; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:800;"><i class="fa-solid fa-crown" style="color:#059669"></i> PRO (${diffDays}d)</span>`;
        } else {
          tierBadge = `<span class="badge" style="background:#fef2f2; color:#dc2626; border:1px solid #fca5a5; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:800;"><i class="fa-solid fa-triangle-exclamation"></i> PRO (Hết hạn)</span>`;
        }
      } else {
        tierBadge = `<span class="badge" style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:800;"><i class="fa-solid fa-crown" style="color:#059669"></i> PRO (Vĩnh viễn)</span>`;
      }
    } else {
      tierBadge = `<span class="badge" style="background:#f8fafc; color:#64748b; border:1px solid #cbd5e1; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700;">⚪ NORMAL</span>`;
    }

    const farmBadge = u.farm_name
      ? `<span class="badge" style="background:#eff6ff; color:#2563eb; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;"><i class="fa-solid fa-earth-asia"></i> ${escapeHtml(u.farm_name)}</span>`
      : '<span style="color:var(--gray-400); font-size:12px;">— Chưa gán —</span>';

    const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }) : '—';

    const deleteBtn = isSelf 
      ? `<button class="btn btn-secondary btn-sm" disabled style="opacity:0.5; cursor:not-allowed;" title="Bạn không thể tự xóa tài khoản của mình"><i class="fa fa-trash"></i> Xóa</button>`
      : `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})"><i class="fa fa-trash"></i> Xóa</button>`;

    return `
      <tr data-user-id="${u.id}">
        <td style="font-weight: 600; color: var(--text-main);">
          <div style="font-size:13.5px; font-weight:800; color:#0f172a;">${escapeHtml(u.full_name)}${selfBadge}</div>
          <div style="margin-top:3px;">
            <span class="badge" style="background:#ecfdf5; color:#047857; border:1.5px solid #a7f3d0; font-size:10.5px; font-weight:800; font-family:monospace; padding:2px 8px; border-radius:10px;" title="Mã ID Mã Hóa chuẩn ISO/IEC 11558 (8 chữ số)">
              <i class="fa-solid fa-key" style="color:#059669; font-size:9.5px;"></i> ID ISO: ${publicId}
            </span>
          </div>
        </td>
        <td>${escapeHtml(u.phone || u.email)}</td>
        <td>${farmBadge}</td>
        <td>${tierBadge}</td>
        <td>${roleBadge}</td>
        <td style="color: var(--text-muted); font-size: 13px;">${dateStr}</td>
        <td>
          <div style="display:flex; gap:4px; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" onclick="openUserTierModal(${u.id})" style="background:#ecfdf5; border:1px solid #a7f3d0; color:#047857; font-weight:800;" title="Quản lý gói cước PRO">
              <i class="fa-solid fa-crown" style="color:#059669"></i> Gói PRO
            </button>
            <button class="btn btn-secondary btn-sm" onclick="openUserModal(${u.id})"><i class="fa fa-pen"></i> Sửa</button>
            ${deleteBtn}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Render Pagination Bar
  if (pagInfo) {
    pagInfo.textContent = `Hiển thị ${startIdx + 1} - ${endIdx} trong tổng số ${totalItems} người dùng (Trang ${currentPage}/${totalPages})`;
  }

  if (pagBtns) {
    let btnsHtml = '';
    btnsHtml += `<button onclick="changeUsersPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} style="padding:6px 12px; font-size:12px; font-weight:700; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#334155; cursor:pointer;">◄ Trang trước</button>`;

    for (let p = 1; p <= totalPages; p++) {
      const isAct = p === currentPage;
      btnsHtml += `<button onclick="changeUsersPage(${p})" style="padding:6px 12px; font-size:12px; font-weight:800; border-radius:8px; border:1px solid ${isAct ? '#059669' : '#cbd5e1'}; background:${isAct ? '#059669' : '#ffffff'}; color:${isAct ? '#ffffff' : '#334155'}; cursor:pointer;">${p}</button>`;
    }

    btnsHtml += `<button onclick="changeUsersPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} style="padding:6px 12px; font-size:12px; font-weight:700; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#334155; cursor:pointer;">Trang sau ►</button>`;

    pagBtns.innerHTML = btnsHtml;
  }
}

function changeUsersPage(page) {
  currentPage = page;
  filterUsers();
}


async function openUserModal(userId = null, syncUrl = true) {
  const modal = document.getElementById('user-modal');
  const title = document.getElementById('user-modal-title');
  const passLabel = document.getElementById('f-user-pass-label');
  const passHelp = document.getElementById('f-user-pass-help');
  const passInput = document.getElementById('f-user-pass');
  const farmSelect = document.getElementById('f-user-farm-id');
  
  if (syncUrl && typeof window.syncAdminUrl === 'function') {
    window.syncAdminUrl({ modal: 'user', id: userId || null });
  }
  
  // Clear fields
  document.getElementById('f-user-id').value = '';
  document.getElementById('f-user-name').value = '';
  document.getElementById('f-user-email').value = '';
  document.getElementById('f-user-role').value = 'user';
  passInput.value = '';

  // Populate initialized farms dropdown
  try {
    const farms = await api('/farms');
    if (farmSelect) {
      farmSelect.innerHTML = '<option value="">— Chưa gán trang trại nào —</option>' +
        (farms || []).map(f => `<option value="${f.id}">🏡 ${escapeHtml(f.name)} (${f.area ? f.area + ' ha' : 'Chưa nhập diện tích'})</option>`).join('');
    }
  } catch (e) {
    console.warn('Lỗi tải danh sách trang trại:', e);
  }

  if (userId) {
    // Edit mode
    const u = allUsers.find(x => x.id === userId);
    if (!u) return;

    title.innerHTML = '<i class="fa-solid fa-user-pen" style="color:var(--green)"></i> Gán Trang trại & Chỉnh sửa Nông hộ';
    document.getElementById('f-user-id').value = u.id;
    document.getElementById('f-user-name').value = u.full_name || '';
    document.getElementById('f-user-email').value = u.email || '';
    document.getElementById('f-user-role').value = u.role || 'user';
    if (farmSelect) farmSelect.value = u.farm_id || '';
    
    if (document.getElementById('f-user-plants-scope')) document.getElementById('f-user-plants-scope').value = u.view_plants_scope || 'all';
    if (document.getElementById('f-user-history-date')) document.getElementById('f-user-history-date').value = u.view_history_from_date ? u.view_history_from_date.split('T')[0] : '';
    if (document.getElementById('f-user-shared-history')) document.getElementById('f-user-shared-history').checked = u.allow_shared_history !== false;
    if (document.getElementById('f-user-view-supplies')) document.getElementById('f-user-view-supplies').checked = u.allow_view_supplies !== false;

    toggleAssignedPlantsPicker(u);

    passLabel.textContent = 'Mật khẩu mới (Tùy chọn)';
    passHelp.style.display = 'block';
    passInput.placeholder = 'Để trống nếu giữ nguyên';
  } else {
    // Create mode
    title.innerHTML = '<i class="fa-solid fa-user-plus" style="color:var(--green)"></i> Thêm người dùng mới';
    passLabel.textContent = 'Mật khẩu *';
    passHelp.style.display = 'none';
    passInput.placeholder = '••••••••';
    if (farmSelect) farmSelect.value = '';
    if (document.getElementById('f-user-plants-scope')) document.getElementById('f-user-plants-scope').value = 'all';
    if (document.getElementById('f-user-history-date')) document.getElementById('f-user-history-date').value = '';
    if (document.getElementById('f-user-shared-history')) document.getElementById('f-user-shared-history').checked = true;
    if (document.getElementById('f-user-view-supplies')) document.getElementById('f-user-view-supplies').checked = true;
    
    toggleAssignedPlantsPicker(null);
  }

  modal.style.display = 'flex';
}

let allPlantsForPicker = [];

async function toggleAssignedPlantsPicker(userObj = null) {
  const scope = document.getElementById('f-user-plants-scope')?.value;
  const container = document.getElementById('assigned-plants-picker-container');
  const checkboxesEl = document.getElementById('assigned-plants-checkboxes');
  
  if (!container || !checkboxesEl) return;

  if (scope !== 'assigned') {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  checkboxesEl.innerHTML = '<div style="font-size:11px; color:#64748b;"><i class="fa fa-spinner fa-spin"></i> Đang tải danh sách cây...</div>';

  try {
    const farmId = document.getElementById('f-user-farm-id')?.value;
    allPlantsForPicker = await api('/plants');

    let filteredPlants = allPlantsForPicker;
    if (farmId) {
      filteredPlants = allPlantsForPicker.filter(p => p.farm_id == farmId);
    }

    if (filteredPlants.length === 0) {
      checkboxesEl.innerHTML = '<div style="font-size:11px; color:#94a3b8; font-style:italic;">Chưa có cây nào trong trang trại này.</div>';
      return;
    }

    const currentUserId = userObj ? userObj.id : (document.getElementById('f-user-id')?.value ? parseInt(document.getElementById('f-user-id').value) : null);
    const assignedIds = (userObj && Array.isArray(userObj.assigned_plant_ids)) ? userObj.assigned_plant_ids.map(x => parseInt(x)) : [];

    checkboxesEl.innerHTML = filteredPlants.map(p => {
      const isChecked = assignedIds.includes(p.id) || (currentUserId && p.assigned_to_user_id == currentUserId);
      return `
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; background:#f8fafc; padding:4px 8px; border-radius:6px; border:1px solid #e2e8f0;">
          <input type="checkbox" class="user-assigned-plant-cb" value="${p.id}" ${isChecked ? 'checked' : ''} style="accent-color:var(--green);">
          <span><strong>Cây #${esc(p.tree_code || p.id)}:</strong> ${esc(p.plant_type)} (${esc(p.plant_variety || 'Giống địa phương')})</span>
        </label>
      `;
    }).join('');
  } catch (err) {
    checkboxesEl.innerHTML = `<div style="font-size:11px; color:#ef4444;">Lỗi tải cây: ${esc(err.message)}</div>`;
  }
}
window.toggleAssignedPlantsPicker = toggleAssignedPlantsPicker;

function closeUserModal(syncUrl = true) {
  document.getElementById('user-modal').style.display = 'none';
  if (syncUrl && typeof window.syncAdminUrl === 'function') {
    window.syncAdminUrl({ modal: null, id: null });
  }
}

function openUserTierModal(userId, syncUrl = true) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  if (syncUrl && typeof window.syncAdminUrl === 'function') {
    window.syncAdminUrl({ modal: 'user-tier', id: userId || null });
  }

  document.getElementById('tier-edit-user-id').value = user.id;
  document.getElementById('tier-edit-user-name').textContent = user.full_name || 'Nông hộ';
  document.getElementById('tier-edit-user-email').textContent = user.phone || user.email || '';
  document.getElementById('tier-admin-note').value = user.tier_admin_note || '';

  const tier = user.account_tier || 'normal';
  const rads = document.getElementsByName('opt-account-tier');
  for (const r of rads) {
    r.checked = (r.value === tier);
  }
  onTierOptionChange(tier);

  const dateInput = document.getElementById('tier-expires-date');
  const chkUnlimited = document.getElementById('chk-tier-unlimited');

  if (user.tier_expires_at) {
    const dStr = new Date(user.tier_expires_at).toISOString().slice(0, 10);
    dateInput.value = dStr;
    chkUnlimited.checked = false;
    dateInput.disabled = false;
  } else {
    dateInput.value = '';
    chkUnlimited.checked = true;
    dateInput.disabled = true;
  }

  document.getElementById('modal-edit-user-tier').style.display = 'flex';
}

function closeUserTierModal(syncUrl = true) {
  const modal = document.getElementById('modal-edit-user-tier');
  if (modal) modal.style.display = 'none';
  if (syncUrl && typeof window.syncAdminUrl === 'function') {
    window.syncAdminUrl({ modal: null, id: null });
  }
}

async function saveUser() {
  const id = document.getElementById('f-user-id').value;
  const full_name = document.getElementById('f-user-name').value.trim();
  const email = document.getElementById('f-user-email').value.trim();
  const password = document.getElementById('f-user-pass').value;
  const role = document.getElementById('f-user-role').value;
  const farm_id = document.getElementById('f-user-farm-id')?.value;
  const view_plants_scope = document.getElementById('f-user-plants-scope')?.value || 'all';
  const view_history_from_date = document.getElementById('f-user-history-date')?.value || null;
  const allow_shared_history = document.getElementById('f-user-shared-history')?.checked;
  const allow_view_supplies = document.getElementById('f-user-view-supplies')?.checked;
  const assigned_plant_ids = Array.from(document.querySelectorAll('.user-assigned-plant-cb:checked')).map(cb => parseInt(cb.value));

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

  const payload = { 
    full_name, 
    email, 
    role, 
    farm_id: farm_id ? parseInt(farm_id) : null,
    view_plants_scope,
    view_history_from_date,
    allow_shared_history,
    allow_view_supplies,
    assigned_plant_ids
  };


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
      toast('Cập nhật & gán trang trại thành công!');
    } else {
      // Create
      await api('/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      toast('Tạo người dùng mới thành công!');
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
  const tabManage = document.getElementById('user-tab-manage');
  const tabStatus = document.getElementById('user-tab-status');
  const tabResets = document.getElementById('user-tab-resets');

  if (tabManage) tabManage.classList.toggle('active', tab === 'manage');
  if (tabStatus) tabStatus.classList.toggle('active', tab === 'status');
  if (tabResets) tabResets.classList.toggle('active', tab === 'resets');

  const paneManage = document.getElementById('pane-user-manage');
  const paneStatus = document.getElementById('pane-user-status');
  const paneResets = document.getElementById('pane-user-resets');

  if (paneManage) paneManage.style.display = tab === 'manage' ? 'block' : 'none';
  if (paneStatus) paneStatus.style.display = tab === 'status' ? 'block' : 'none';
  if (paneResets) paneResets.style.display = tab === 'resets' ? 'block' : 'none';

  if (tab === 'resets') loadResetRequests();
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
    toast('Lỗi xóa lịch sử hoạt động: ' + err.message, 'error');
  }
}

async function loadResetRequests() {
  const tbody = document.getElementById('reset-requests-table');
  const badge = document.getElementById('reset-badge');

  try {
    const requests = await api('/auth/reset-requests');
    const pendingCount = (requests || []).filter(r => r.status === 'pending').length;

    if (badge) {
      if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    if (!tbody) return;

    if (!requests || requests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Không có yêu cầu cấp lại mật khẩu nào.</td></tr>';
      return;
    }

    tbody.innerHTML = requests.map(r => {
      const isPending = r.status === 'pending';
      const statusBadge = isPending 
        ? '<span class="badge" style="background:#fffbeb; color:#b45309; border:1px solid #fef3c7;">Đang chờ duyệt</span>'
        : r.status === 'approved'
          ? '<span class="badge" style="background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0;">Đã phê duyệt</span>'
          : '<span class="badge" style="background:#fef2f2; color:#dc2626; border:1px solid #fee2e2;">Đã từ chối</span>';

      const dateStr = new Date(r.created_at).toLocaleString('vi-VN');

      return `
        <tr>
          <td><strong>${r.full_name || r.email}</strong><br><span style="font-size:12px; color:var(--text-muted);">${r.email}</span></td>
          <td>${r.identity} ${r.note ? `<br><small style="color:var(--gray-500)">Ghi chú: "${escapeHtml(r.note)}"</small>` : ''}</td>
          <td>${dateStr}</td>
          <td>${statusBadge}</td>
          <td>
            ${isPending ? `
              <button class="btn btn-sm btn-primary" onclick="approveResetRequestFromAdmin('${r.token}')" style="background:var(--green); font-size:12px; padding:4px 10px;">
                <i class="fa fa-check"></i> Duyệt & Cấp MK
              </button>
            ` : '—'}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.warn('Lỗi tải yêu cầu cấp mật khẩu:', err);
  }
}

async function approveResetRequestFromAdmin(token) {
  if (!confirm('Bạn có chắc chắn muốn phê duyệt cấp mật khẩu mới cho tài khoản này?')) return;
  try {
    const res = await fetch(`/api/auth/approve-reset-password?token=${token}`);
    if (res.ok) {
      toast('Đã phê duyệt và gửi mật khẩu mới về email khách hàng!');
      loadResetRequests();
    } else {
      toast('Thao tác không thành công', 'error');
    }
  } catch (e) {
    toast('Lỗi: ' + e.message, 'error');
  }
}

async function loadPendingFarmerUsers() {
  const tbody = document.getElementById('pending-users-table');
  const badge = document.getElementById('pending-users-count-badge');
  if (!tbody) return;

  try {
    const pendingUsers = await api('/users/pending');
    const count = pendingUsers ? pendingUsers.length : 0;
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-block' : 'none';
    }

    if (!pendingUsers || pendingUsers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa fa-check-circle" style="color:var(--green)"></i> Tất cả tài khoản nông hộ đã được phê duyệt.</td></tr>';
      return;
    }

    tbody.innerHTML = pendingUsers.map(u => {
      const dateStr = new Date(u.created_at).toLocaleString('vi-VN');
      const areaStr = u.farm_area ? ` - ${u.farm_area} ha` : '';
      const cropInfo = u.plant_type ? `${u.plant_type} (${u.plant_variety || 'Giống địa phương'} - ${u.plant_age || 1} năm)${areaStr}` : 'Chưa khai báo';


      return `
        <tr>
          <td><strong>${escapeHtml(u.full_name)}</strong><br><span style="font-size:12px; color:var(--text-muted);">${escapeHtml(u.phone)}</span></td>
          <td><span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a;">Chờ Admin duyệt</span></td>
          <td>${escapeHtml(cropInfo)}</td>
          <td>${u.gender || '—'} / ${u.dob || '—'}</td>
          <td style="font-size:12px; color:var(--text-muted);">${dateStr}</td>
          <td>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-sm btn-primary" onclick="approveFarmerUser(${u.id})" style="background:var(--green); font-size:12px; padding:5px 12px;">
                <i class="fa fa-check"></i> Phê duyệt & Mở khóa
              </button>
              <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})" style="font-size:12px; padding:5px 10px;">
                <i class="fa fa-times"></i> Từ chối
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.warn('Lỗi tải danh sách chờ duyệt:', err);
  }
}

async function approveFarmerUser(userId) {
  if (!confirm('Bạn có chắc chắn muốn PHÊ DUYỆT và MỞ KHÓA tài khoản Nông hộ này?')) return;
  try {
    const res = await api(`/users/${userId}/approve`, { method: 'PUT' });
    toast(res.message || 'Đã phê duyệt tài khoản nông hộ thành công!');
    loadUsers();
    loadPendingFarmerUsers();
  } catch (e) {
    toast('Lỗi khi phê duyệt: ' + e.message, 'error');
  }
}

// ── Tier Management Modal Handlers ─────────────────────────────────
function openUserTierModal(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  document.getElementById('tier-edit-user-id').value = user.id;
  document.getElementById('tier-edit-user-name').textContent = user.full_name || 'Nông hộ';
  document.getElementById('tier-edit-user-email').textContent = user.phone || user.email || '';
  document.getElementById('tier-admin-note').value = user.tier_admin_note || '';

  const tier = user.account_tier || 'normal';
  const rads = document.getElementsByName('opt-account-tier');
  for (const r of rads) {
    r.checked = (r.value === tier);
  }
  onTierOptionChange(tier);

  const dateInput = document.getElementById('tier-expires-date');
  const chkUnlimited = document.getElementById('chk-tier-unlimited');

  if (user.tier_expires_at) {
    const dStr = new Date(user.tier_expires_at).toISOString().slice(0, 10);
    dateInput.value = dStr;
    chkUnlimited.checked = false;
    dateInput.disabled = false;
  } else {
    dateInput.value = '';
    chkUnlimited.checked = true;
    dateInput.disabled = true;
  }

  document.getElementById('modal-edit-user-tier').style.display = 'flex';
}

function closeUserTierModal() {
  const modal = document.getElementById('modal-edit-user-tier');
  if (modal) modal.style.display = 'none';
}

function onTierOptionChange(tier) {
  const durSec = document.getElementById('pro-duration-section');
  if (durSec) {
    durSec.style.display = (tier === 'pro') ? 'block' : 'none';
  }
}

function toggleUnlimitedTierDate(isUnlimited) {
  const dateInput = document.getElementById('tier-expires-date');
  if (!dateInput) return;
  if (isUnlimited) {
    dateInput.value = '';
    dateInput.disabled = true;
  } else {
    dateInput.disabled = false;
    if (!dateInput.value) {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      dateInput.value = d.toISOString().slice(0, 10);
    }
  }
}

function setQuickTierDuration(preset) {
  const chkUnlimited = document.getElementById('chk-tier-unlimited');
  const dateInput = document.getElementById('tier-expires-date');
  if (!dateInput || !chkUnlimited) return;

  if (preset === 'unlimited') {
    chkUnlimited.checked = true;
    dateInput.value = '';
    dateInput.disabled = true;
    return;
  }

  chkUnlimited.checked = false;
  dateInput.disabled = false;

  const now = new Date();
  if (preset === '14days') {
    now.setDate(now.getDate() + 14);
  } else if (preset === '6months') {
    now.setMonth(now.getMonth() + 6);
  } else if (preset === '1year') {
    now.setFullYear(now.getFullYear() + 1);
  } else if (preset === '2years') {
    now.setFullYear(now.getFullYear() + 2);
  }
  dateInput.value = now.toISOString().slice(0, 10);
}

async function submitUserTierUpdate() {
  const userId = document.getElementById('tier-edit-user-id').value;
  const rads = document.getElementsByName('opt-account-tier');
  let selectedTier = 'normal';
  for (const r of rads) {
    if (r.checked) selectedTier = r.value;
  }

  const isUnlimited = document.getElementById('chk-tier-unlimited').checked;
  const expiresDate = document.getElementById('tier-expires-date').value;
  const adminNote = document.getElementById('tier-admin-note').value;

  let tier_expires_at = null;
  if (selectedTier === 'pro' && !isUnlimited && expiresDate) {
    tier_expires_at = new Date(expiresDate).toISOString();
  }

  const btn = document.getElementById('btn-submit-user-tier');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Đang lưu...'; }

  try {
    await api(`/users/${userId}/tier`, {
      method: 'PUT',
      body: JSON.stringify({
        account_tier: selectedTier,
        tier_expires_at,
        tier_admin_note: adminNote
      })
    });
    toast('Đã cập nhật gói cước tài khoản thành công!');
    closeUserTierModal();
    loadUsers();
  } catch (err) {
    toast('Lỗi cập nhật gói cước: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu Kích Hoạt PRO'; }
  }
}


function switchUserTab(tab) {
  const tabs = ['manage', 'pending', 'status', 'resets'];
  tabs.forEach(t => {
    const tabEl = document.getElementById(`user-tab-${t}`);
    const paneEl = document.getElementById(`pane-user-${t}`);
    if (tabEl) tabEl.classList.toggle('active', t === tab);
    if (paneEl) paneEl.style.display = (t === tab ? 'block' : 'none');
  });

  if (tab === 'pending') loadPendingFarmerUsers();
  if (tab === 'resets') loadResetRequests();
}
window.switchUserTab = switchUserTab;

window.loadPendingFarmerUsers = loadPendingFarmerUsers;
window.approveFarmerUser = approveFarmerUser;
window.openUserTierModal = openUserTierModal;
window.closeUserTierModal = closeUserTierModal;
window.submitUserTierUpdate = submitUserTierUpdate;
window.setQuickTierDuration = setQuickTierDuration;
window.toggleUnlimitedTierDate = toggleUnlimitedTierDate;
window.onTierOptionChange = onTierOptionChange;

window.setUserFilterGroup = setUserFilterGroup;
window.changeUsersPage = changeUsersPage;

// Hook loadPendingFarmerUsers on loadUsers
const originalLoadUsers = loadUsers;
loadUsers = async function() {
  await originalLoadUsers();
  await loadPendingFarmerUsers();
};




