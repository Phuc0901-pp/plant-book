/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/settings.js — Account settings & Threshold Rules Engine
   ═══════════════════════════════════════════════════════════════ */

import { api, API, token } from '../core/api.js';
import { toast } from '../core/utils.js';

let _currentRules = [];

// ── Khởi tạo trang Cài đặt ──────────────────────────────────────
export async function loadUserSettings() {
  try {
    const user = await api('/auth/me');
    _populateProfileForm(user);
    _renderAvatar(user.avatar_url, user.full_name);
    _bindEvents();
    loadThresholdRules();
  } catch (err) {
    toast('Không thể tải thông tin tài khoản.', 'error');
  }
}

// ── Sub-Tab Switching ──────────────────────────────────────────
export function switchSettingsSubtab(subtab) {
  const paneThresholds = document.getElementById('subtab-pane-thresholds');
  const paneProfile = document.getElementById('subtab-pane-profile');
  const btnThresholds = document.getElementById('subtab-btn-thresholds');
  const btnProfile = document.getElementById('subtab-btn-profile');

  if (!paneThresholds || !paneProfile || !btnThresholds || !btnProfile) return;

  if (subtab === 'profile') {
    paneThresholds.style.display = 'none';
    paneProfile.style.display = 'block';

    btnThresholds.classList.remove('active');
    btnThresholds.style.color = '#64748b';
    btnThresholds.style.borderBottomColor = 'transparent';

    btnProfile.classList.add('active');
    btnProfile.style.color = '#059669';
    btnProfile.style.borderBottomColor = '#059669';
  } else {
    paneThresholds.style.display = 'block';
    paneProfile.style.display = 'none';

    btnProfile.classList.remove('active');
    btnProfile.style.color = '#64748b';
    btnProfile.style.borderBottomColor = 'transparent';

    btnThresholds.classList.add('active');
    btnThresholds.style.color = '#059669';
    btnThresholds.style.borderBottomColor = '#059669';

    loadThresholdRules();
  }
}
window.switchSettingsSubtab = switchSettingsSubtab;

// ── Threshold Rules CRUD ──────────────────────────────────────
export async function loadThresholdRules() {
  const container = document.getElementById('threshold-rules-list');
  if (!container) return;

  try {
    const res = await api('/notifications/rules');
    if (res && res.success) {
      _currentRules = res.rules || [];
      renderThresholdRulesUI(_currentRules);
    }
  } catch (err) {
    console.warn('Lỗi tải quy tắc ngưỡng:', err);
    container.innerHTML = `
      <div style="text-align:center; padding:24px; color:#ef4444; font-size:13px;">
        Không thể tải danh sách quy tắc cài đặt ngưỡng.
      </div>
    `;
  }
}
window.loadThresholdRules = loadThresholdRules;

export function renderThresholdRulesUI(rules) {
  const container = document.getElementById('threshold-rules-list');
  if (!container) return;

  if (!rules || rules.length === 0) {
    container.innerHTML = `
      <div style="background:#ffffff; border:2px dashed #cbd5e1; border-radius:16px; padding:32px 20px; text-align:center;">
        <i class="fa-solid fa-sliders" style="font-size:32px; color:#cbd5e1; margin-bottom:10px; display:block;"></i>
        <h4 style="margin:0 0 6px 0; color:#334155; font-size:15px; font-weight:800;">Chưa có quy tắc cài đặt ngưỡng nào</h4>
        <p style="margin:0 0 16px 0; color:#64748b; font-size:13px;">Bấm nút bên dưới để tạo điều kiện thông báo tự động theo giá trị cảm biến và canh tác.</p>
        <button onclick="openAddThresholdRuleModal()" style="background:#059669; color:white; border:none; padding:9px 18px; font-size:13px; font-weight:800; border-radius:10px; cursor:pointer;">
          + Thêm quy tắc đầu tiên
        </button>
      </div>
    `;
    return;
  }

  const levelStyles = {
    danger: { badgeBg: '#fef2f2', badgeText: '#dc2626', border: '#fecaca', label: '🚨 Cảnh báo Khẩn cấp' },
    warning: { badgeBg: '#fff7ed', badgeText: '#d97706', border: '#fed7aa', label: '🌦️ Cảnh báo Thời tiết' },
    info: { badgeBg: '#f0fdf4', badgeText: '#16a34a', border: '#bbf7d0', label: '🌱 Khuyến nghị Canh tác' }
  };

  container.innerHTML = rules.map(r => {
    const st = levelStyles[r.alert_level] || levelStyles.info;
    const isEnabled = r.is_enabled;

    return `
      <div style="background:#ffffff; border:1.5px solid ${r.is_enabled ? '#e2e8f0' : '#f1f5f9'}; border-radius:16px; padding:18px 20px; box-shadow:0 2px 10px rgba(0,0,0,0.02); opacity:${isEnabled ? 1 : 0.65}; transition:all 0.2s ease;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div style="flex:1; min-width:260px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px; flex-wrap:wrap;">
              <span class="badge" style="background:${st.badgeBg}; color:${st.badgeText}; border:1px solid ${st.border}; font-size:11px; font-weight:800;">${st.label}</span>
              <span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:11px; font-weight:700;"><i class="fa-solid fa-seedling"></i> ${r.action_type || 'Canh tác'}</span>
            </div>
            
            <h4 style="margin:0 0 6px 0; font-size:15px; font-weight:900; color:#0f172a; display:flex; align-items:center; gap:8px;">
              <span>${r.metric_name}</span>
              <span style="background:#f1f5f9; color:#0f172a; padding:2px 8px; border-radius:6px; font-size:13px; font-weight:800;">${r.operator} ${r.threshold_value} ${r.unit || ''}</span>
            </h4>

            <p style="margin:0; font-size:13px; color:#475569; line-height:1.5; background:#f8fafc; padding:8px 12px; border-radius:10px; border-left:3px solid #059669;">
              💬 <strong>Khuyến nghị tự động:</strong> ${r.action_recommendation}
            </p>
          </div>

          <div style="display:flex; align-items:center; gap:12px;">
            <!-- Toggle Switch -->
            <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:12px; font-weight:700; color:${isEnabled ? '#059669' : '#94a3b8'};">
              <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleThresholdRuleEnabled(${r.id}, this.checked)" style="width:18px; height:18px; accent-color:#059669; cursor:pointer;" />
              ${isEnabled ? 'Đang bật' : 'Đã tắt'}
            </label>

            <button onclick="editThresholdRule(${r.id})" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#334155; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
              <i class="fa-solid fa-pen"></i> Sửa
            </button>

            <button onclick="deleteThresholdRule(${r.id})" style="background:#fef2f2; border:1px solid #fecaca; color:#dc2626; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
              <i class="fa-solid fa-trash-can"></i> Xóa
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

export function openAddThresholdRuleModal() {
  const modal = document.getElementById('threshold-rule-modal');
  const form = document.getElementById('threshold-rule-form');
  const title = document.getElementById('threshold-modal-title');
  if (!modal || !form) return;

  form.reset();
  document.getElementById('rule-id').value = '';
  if (title) title.textContent = 'Thêm Quy tắc Cài đặt Ngưỡng';
  updateMetricUnitLabel();

  modal.style.display = 'flex';
}
window.openAddThresholdRuleModal = openAddThresholdRuleModal;

export function editThresholdRule(id) {
  const rule = _currentRules.find(r => r.id === id);
  if (!rule) return;

  const modal = document.getElementById('threshold-rule-modal');
  const title = document.getElementById('threshold-modal-title');
  if (!modal) return;

  document.getElementById('rule-id').value = rule.id;
  document.getElementById('rule-metric').value = rule.metric_key;
  document.getElementById('rule-operator').value = rule.operator;
  document.getElementById('rule-threshold-value').value = rule.threshold_value;
  document.getElementById('rule-action-type').value = rule.action_type || 'Tưới nước';
  document.getElementById('rule-recommendation').value = rule.action_recommendation;
  document.getElementById('rule-alert-level').value = rule.alert_level || 'warning';

  if (title) title.textContent = 'Chỉnh sửa Quy tắc Cài đặt Ngưỡng';
  updateMetricUnitLabel();

  modal.style.display = 'flex';
}
window.editThresholdRule = editThresholdRule;

export function closeThresholdRuleModal() {
  const modal = document.getElementById('threshold-rule-modal');
  if (modal) modal.style.display = 'none';
}
window.closeThresholdRuleModal = closeThresholdRuleModal;

export function updateMetricUnitLabel() {
  const metricSel = document.getElementById('rule-metric');
  const unitBadge = document.getElementById('rule-unit-badge');
  if (!metricSel || !unitBadge) return;

  const units = {
    soil_moisture_20cm: '%',
    soil_moisture_50cm: '%',
    air_temp: '°C',
    air_humidity: '%',
    soil_ph: 'pH',
    soil_ec: 'mS/cm',
    rain_chance: '%',
    water_level: '%'
  };
  unitBadge.textContent = units[metricSel.value] || '%';
}
window.updateMetricUnitLabel = updateMetricUnitLabel;

export async function saveThresholdRule(e) {
  if (e && e.preventDefault) e.preventDefault();

  const id = document.getElementById('rule-id').value;
  const payload = {
    metric_key: document.getElementById('rule-metric').value,
    operator: document.getElementById('rule-operator').value,
    threshold_value: parseFloat(document.getElementById('rule-threshold-value').value),
    action_type: document.getElementById('rule-action-type').value,
    action_recommendation: document.getElementById('rule-recommendation').value,
    alert_level: document.getElementById('rule-alert-level').value
  };

  try {
    let res;
    if (id) {
      res = await api(`/notifications/rules/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      res = await api('/notifications/rules', { method: 'POST', body: JSON.stringify(payload) });
    }

    if (res && res.success) {
      toast(res.message || 'Đã lưu quy tắc thành công!', 'success');
      closeThresholdRuleModal();
      loadThresholdRules();
    }
  } catch (err) {
    toast('Lỗi lưu quy tắc: ' + err.message, 'error');
  }
}
window.saveThresholdRule = saveThresholdRule;

export async function toggleThresholdRuleEnabled(id, isEnabled) {
  try {
    await api(`/notifications/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_enabled: isEnabled })
    });
    toast(isEnabled ? 'Đã bật quy tắc cảnh báo.' : 'Đã tắt quy tắc cảnh báo.', 'info');
    loadThresholdRules();
  } catch (err) {
    toast('Lỗi cập nhật trạng thái quy tắc: ' + err.message, 'error');
  }
}
window.toggleThresholdRuleEnabled = toggleThresholdRuleEnabled;

export async function deleteThresholdRule(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa quy tắc cài đặt ngưỡng này?')) return;
  try {
    await api(`/notifications/rules/${id}`, { method: 'DELETE' });
    toast('Đã xóa quy tắc cảnh báo thành công.', 'success');
    loadThresholdRules();
  } catch (err) {
    toast('Lỗi xóa quy tắc: ' + err.message, 'error');
  }
}
window.deleteThresholdRule = deleteThresholdRule;


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
      headers: { Authorization: `Bearer ${localStorage.getItem('pb_token') || ''}` },
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
      toast('Đã cập nhật thông tin cá nhân!', 'success');
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
