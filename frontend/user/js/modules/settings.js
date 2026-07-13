/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/settings.js — Account settings: avatar, profile, password
   ═══════════════════════════════════════════════════════════════ */

import { api, API, token } from '../core/api.js';
import { toast } from '../core/utils.js';

// ── Khởi tạo trang Cài đặt ──────────────────────────────────────
export async function loadUserSettings() {
  try {
    const user = await api('/auth/me');
    _populateProfileForm(user);
    _renderAvatar(user.avatar_url, user.full_name);
    _bindEvents();
  } catch (err) {
    toast('Không thể tải thông tin tài khoản.', 'error');
  }
}

// ── Điền thông tin vào form ─────────────────────────────────────
function _populateProfileForm(user) {
  _setVal('settings-fullname',  user.full_name  || '');
  _setVal('settings-email',     user.email      || '');
  _setVal('settings-phone',     user.phone      || '');
  _setVal('settings-city',      user.city       || '');
  _setVal('settings-country',   user.country    || '');
  const genderSel = document.getElementById('settings-gender');
  if (genderSel) genderSel.value = user.gender || '';
  const joinEl = document.getElementById('settings-joined');
  if (joinEl && user.created_at) {
    joinEl.textContent = new Date(user.created_at).toLocaleDateString('vi-VN', { year:'numeric', month:'long', day:'numeric' });
  }
}

function _setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

// ── Render avatar ───────────────────────────────────────────────
function _renderAvatar(url, name) {
  const img  = document.getElementById('settings-avatar-img');
  const init = document.getElementById('settings-avatar-initials');
  if (!img || !init) return;
  if (url) {
    img.src = url;
    img.classList.remove('hidden');
    init.classList.add('hidden');
  } else {
    img.classList.add('hidden');
    init.classList.remove('hidden');
    init.textContent = (name || 'N').charAt(0).toUpperCase();
  }
}

// ── Gắn sự kiện một lần ─────────────────────────────────────────
let _bound = false;
function _bindEvents() {
  if (_bound) return;
  _bound = true;

  // Avatar click
  const avatarWrap = document.getElementById('settings-avatar-wrap');
  const avatarInput = document.getElementById('settings-avatar-input');
  if (avatarWrap && avatarInput) {
    avatarWrap.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) uploadUserAvatar(e.target.files[0]);
    });
  }

  // Save profile
  const saveBtn = document.getElementById('settings-save-profile');
  if (saveBtn) saveBtn.addEventListener('click', saveUserProfile);

  // Change password
  const pwBtn = document.getElementById('settings-change-password');
  if (pwBtn) pwBtn.addEventListener('click', changeUserPassword);
}

// ── Upload avatar ────────────────────────────────────────────────
export async function uploadUserAvatar(file) {
  const preview = document.getElementById('settings-avatar-img');
  const wrap    = document.getElementById('settings-avatar-wrap');

  // Show instant local preview
  const reader = new FileReader();
  reader.onload = (e) => {
    if (preview) { preview.src = e.target.result; preview.classList.remove('hidden'); }
    const init = document.getElementById('settings-avatar-initials');
    if (init) init.classList.add('hidden');
  };
  reader.readAsDataURL(file);

  // Spinner on wrap
  wrap && wrap.classList.add('uploading');

  try {
    const form = new FormData();
    form.append('avatar', file);
    const res = await fetch(`${API}/auth/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
      body: form
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi tải ảnh');
    toast('✅ Đã cập nhật ảnh đại diện!', 'success');
  } catch (err) {
    toast('Lỗi: ' + err.message, 'error');
  } finally {
    wrap && wrap.classList.remove('uploading');
  }
}

// ── Lưu thông tin cá nhân ───────────────────────────────────────
export async function saveUserProfile() {
  const btn = document.getElementById('settings-save-profile');
  const orig = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...'; }

  try {
    const payload = {
      full_name: _getVal('settings-fullname'),
      phone:     _getVal('settings-phone'),
      city:      _getVal('settings-city'),
      country:   _getVal('settings-country'),
      gender:    _getVal('settings-gender'),
    };
    if (!payload.full_name.trim()) { toast('Họ và tên không được bỏ trống.', 'error'); return; }

    const data = await api('/auth/me', { method: 'PUT', body: JSON.stringify(payload) });
    if (data.success) {
      toast('✅ Đã cập nhật thông tin cá nhân!', 'success');
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã lưu';
        btn.classList.add('saved');
        setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('saved'); btn.disabled = false; }, 2500);
      }
    }
  } catch (err) {
    toast('Lỗi: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
  }
}

// ── Đổi mật khẩu ────────────────────────────────────────────────
export async function changeUserPassword() {
  const btn = document.getElementById('settings-change-password');
  const orig = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...'; }

  const oldPw  = _getVal('settings-old-password');
  const newPw  = _getVal('settings-new-password');
  const confPw = _getVal('settings-confirm-password');

  if (!oldPw || !newPw || !confPw) {
    toast('Vui lòng điền đầy đủ các trường mật khẩu.', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    return;
  }
  if (newPw !== confPw) {
    toast('Mật khẩu mới và xác nhận không khớp.', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    return;
  }
  if (newPw.length < 6) {
    toast('Mật khẩu mới phải có ít nhất 6 ký tự.', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    return;
  }

  try {
    const data = await api('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw })
    });
    if (data.success) {
      toast('✅ Đổi mật khẩu thành công!', 'success');
      ['settings-old-password','settings-new-password','settings-confirm-password'].forEach(id => _setVal(id,''));
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Thành công';
        btn.classList.add('saved');
        setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('saved'); btn.disabled = false; }, 2500);
      }
    }
  } catch (err) {
    toast('Lỗi: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
  }
}

function _getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
