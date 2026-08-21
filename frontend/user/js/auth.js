/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   auth.js — Login, logout, token verification, role routing
   ═══════════════════════════════════════════════════════════════ */

import { API, api, token, setToken, clearToken, setCurrentUser, currentUser } from './core/api.js';
import { showPage } from './core/router.js';
import { connectWebSocket, closeWebSocket } from './core/websocket.js';

// ── Đăng nhập ──────────────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('login-email')?.value.trim();
  const pass  = document.getElementById('login-pass')?.value;
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('login-btn');

  if (errEl) errEl.style.display = 'none';
  if (btn)   { btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true; }

  try {
    const res  = await fetch(`${API}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại');

    // Phân luồng theo role
    if (data.user.role === 'admin') {
      localStorage.setItem('pb_token', data.token);
      window.location.href = '/admin';
      return;
    }

    // Role user (hoặc bất kỳ role nào không phải admin)
    setToken(data.token);
    setCurrentUser(data.user);
    showApp();

  } catch (err) {
    if (errEl) {
      const errText = document.getElementById('login-error-text');
      if (errText) errText.textContent = err.message;
      else errEl.textContent = err.message;
      errEl.style.display = 'flex';
    }
    if (btn)   { btn.innerHTML = '<span id="login-btn-text"><i class="fa fa-right-to-bracket"></i> Đăng nhập</span>'; btn.disabled = false; }
  }
}

// Phím Enter → đăng nhập
document.getElementById('login-pass')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

// Expose doLogin cho nút HTML onclick
window.doLogin = doLogin;

// ── Password Visibility Toggle ─────────────────────────────────
function togglePasswordVisibility() {
  const passInput = document.getElementById('login-pass');
  const icon = document.getElementById('toggle-pass-icon');
  if (!passInput || !icon) return;
  if (passInput.type === 'password') {
    passInput.type = 'text';
    icon.className = 'fa fa-eye-slash';
  } else {
    passInput.type = 'password';
    icon.className = 'fa fa-eye';
  }
}
window.togglePasswordVisibility = togglePasswordVisibility;

// ── Forgot Password Modal Handlers ─────────────────────────────
function openForgotPasswordModal() {
  const modal = document.getElementById('forgot-modal');
  const errEl = document.getElementById('forgot-error');
  const identity = document.getElementById('forgot-identity');
  const note = document.getElementById('forgot-note');
  if (errEl) errEl.style.display = 'none';
  if (identity) identity.value = '';
  if (note) note.value = '';
  if (modal) modal.style.display = 'flex';
}
window.openForgotPasswordModal = openForgotPasswordModal;

function closeForgotPasswordModal() {
  const modal = document.getElementById('forgot-modal');
  if (modal) modal.style.display = 'none';
}
window.closeForgotPasswordModal = closeForgotPasswordModal;

async function submitForgotPasswordRequest() {
  const identity = document.getElementById('forgot-identity')?.value.trim();
  const note = document.getElementById('forgot-note')?.value.trim();
  const errEl = document.getElementById('forgot-error');
  const btn = document.getElementById('forgot-submit-btn');

  if (!identity) {
    if (errEl) {
      document.getElementById('forgot-error-text').textContent = 'Vui lòng nhập Email hoặc Số điện thoại.';
      errEl.style.display = 'flex';
    }
    return;
  }

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.innerHTML = '<span class="spinner"></span> Đang gửi...'; btn.disabled = true; }

  try {
    const res = await fetch(`${API}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, note })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gửi yêu cầu thất bại.');

    alert(data.message);
    closeForgotPasswordModal();
  } catch (err) {
    if (errEl) {
      document.getElementById('forgot-error-text').textContent = err.message;
      errEl.style.display = 'flex';
    }
  } finally {
    if (btn) { btn.innerHTML = '<span id="forgot-submit-text"><i class="fa fa-paper-plane"></i> Gửi yêu cầu</span>'; btn.disabled = false; }
  }
}
window.submitForgotPasswordRequest = submitForgotPasswordRequest;

// ── Đăng xuất ─────────────────────────────────────────────────
export async function logout() {
  closeWebSocket();
  if (token) {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('API logout error:', e);
    }
  }
  clearToken();
  setCurrentUser(null);
  const app       = document.getElementById('app');
  const loginPage = document.getElementById('login-page');
  if (app)       app.style.display       = 'none';
  if (loginPage) loginPage.style.display = 'flex';
}

window.logout = logout;

// ── Hiển thị App sau đăng nhập thành công ─────────────────────
function showApp() {
  const app       = document.getElementById('app');
  const loginPage = document.getElementById('login-page');
  if (loginPage) loginPage.style.display = 'none';
  if (app)       app.style.display       = 'flex';

  const user = currentUser;
  const nameEl  = document.getElementById('sb-user-name');
  const emailEl = document.getElementById('sb-user-email');
  if (nameEl)  nameEl.textContent  = user?.name || user?.full_name || '—';
  if (emailEl) emailEl.textContent = user?.phone || user?.email || '—';

  const rolePill = document.getElementById('sb-role-pill');
  if (rolePill) {
    if (user?.account_tier === 'pro') {
      rolePill.innerHTML = '<i class="fa-solid fa-crown" style="font-size:10px; color:#fde047"></i> Nông hộ PRO';
      rolePill.style.background = 'linear-gradient(135deg, #064e3b, #047857)';
      rolePill.style.color = '#ffffff';
      rolePill.style.border = '1px solid #059669';
    } else {
      rolePill.innerHTML = '<i class="fa fa-user" style="font-size:9px"></i> Nông hộ NORMAL';
      rolePill.style.background = '#f1f5f9';
      rolePill.style.color = '#475569';
      rolePill.style.border = '1px solid #cbd5e1';
    }
  }

  // Cập nhật thông tin ở tab Cài đặt
  const settingNameEl  = document.getElementById('setting-user-name');
  const settingEmailEl = document.getElementById('setting-user-email');
  if (settingNameEl)  settingNameEl.textContent  = user?.full_name || user?.name || '—';
  if (settingEmailEl) settingEmailEl.textContent = user?.phone || user?.email || '—';


  showPage('home');
  connectWebSocket();
}

// ── Kiểm tra token lưu sẵn khi tải trang ──────────────────────
window.addEventListener('load', async () => {
  if (!token) return; // không có token → hiện màn login

  try {
    const me = await api('/auth/me');

    // Admin nhầm vào trang user → chuyển về admin
    if (me.role === 'admin') {
      window.location.href = '/admin';
      return;
    }

    setCurrentUser(me);
    showApp();
  } catch {
    // Token hết hạn / không hợp lệ
    logout();
  }
});

// ── 3-Step Farmer Registration Wizard ──────────────────────────
let currentRegStep = 1;

function openRegisterModal() {

  currentRegStep = 1;
  updateRegStepUI();
  const modal = document.getElementById('register-modal');
  const errEl = document.getElementById('reg-error');
  if (errEl) errEl.style.display = 'none';

  // Clear inputs
  document.getElementById('reg-phone').value = '';
  document.getElementById('reg-pass').value = '';
  document.getElementById('reg-pass-confirm').value = '';
  document.getElementById('reg-name').value = '';
  document.getElementById('reg-dob').value = '';
  document.getElementById('reg-plant-type').value = '';
  document.getElementById('reg-plant-variety').value = '';
  document.getElementById('reg-plant-age').value = '';
  document.getElementById('reg-farm-area').value = '';


  if (modal) modal.style.display = 'flex';
}
window.openRegisterModal = openRegisterModal;

function closeRegisterModal() {
  const modal = document.getElementById('register-modal');
  if (modal) modal.style.display = 'none';
}
window.closeRegisterModal = closeRegisterModal;

function updateRegStepUI() {
  const errEl = document.getElementById('reg-error');
  if (errEl) errEl.style.display = 'none';

  document.getElementById('reg-step-1').style.display = currentRegStep === 1 ? 'block' : 'none';
  document.getElementById('reg-step-2').style.display = currentRegStep === 2 ? 'block' : 'none';
  document.getElementById('reg-step-3').style.display = currentRegStep === 3 ? 'block' : 'none';

  const titleEl = document.getElementById('reg-modal-title');
  if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-user-plus" style="color:var(--green)"></i> Đăng ký tài khoản Nông hộ (Bước ${currentRegStep}/3)`;

  // Dots
  const dot1 = document.getElementById('step-dot-1');
  const dot2 = document.getElementById('step-dot-2');
  const dot3 = document.getElementById('step-dot-3');

  if (dot1) {
    dot1.style.background = currentRegStep >= 1 ? 'var(--green)' : '#e2e8f0';
    dot1.style.color = currentRegStep >= 1 ? 'white' : '#64748b';
  }
  if (dot2) {
    dot2.style.background = currentRegStep >= 2 ? 'var(--green)' : '#e2e8f0';
    dot2.style.color = currentRegStep >= 2 ? 'white' : '#64748b';
  }
  if (dot3) {
    dot3.style.background = currentRegStep >= 3 ? 'var(--green)' : '#e2e8f0';
    dot3.style.color = currentRegStep >= 3 ? 'white' : '#64748b';
  }

  // Buttons
  const prevBtn = document.getElementById('reg-prev-btn');
  const nextBtn = document.getElementById('reg-next-btn');

  if (prevBtn) prevBtn.style.display = currentRegStep > 1 ? 'inline-flex' : 'none';
  if (nextBtn) {
    nextBtn.innerHTML = currentRegStep === 3
      ? '<i class="fa fa-paper-plane"></i> Gửi yêu cầu đăng ký'
      : 'Tiếp theo <i class="fa fa-arrow-right"></i>';
  }
}

async function nextRegStep() {
  const errEl = document.getElementById('reg-error');
  const errText = document.getElementById('reg-error-text');
  const nextBtn = document.getElementById('reg-next-btn');

  if (currentRegStep === 1) {
    const phone = document.getElementById('reg-phone')?.value.trim();
    const pass = document.getElementById('reg-pass')?.value;
    const confirm = document.getElementById('reg-pass-confirm')?.value;

    if (!phone) {
      if (errText) errText.textContent = 'Vui lòng nhập số điện thoại đăng ký.';
      if (errEl) errEl.style.display = 'flex';
      return;
    }
    if (!pass || pass.length < 6) {
      if (errText) errText.textContent = 'Mật khẩu phải chứa ít nhất 6 ký tự.';
      if (errEl) errEl.style.display = 'flex';
      return;
    }
    if (pass !== confirm) {
      if (errText) errText.textContent = 'Mật khẩu xác nhận không khớp.';
      if (errEl) errEl.style.display = 'flex';
      return;
    }

    // Pre-check if phone exists on server
    if (nextBtn) { nextBtn.innerHTML = '<span class="spinner"></span> Đang kiểm tra...'; nextBtn.disabled = true; }
    try {
      const checkRes = await fetch(`${API}/auth/check-phone?phone=${encodeURIComponent(phone)}`);
      const checkData = await checkRes.json();

      if (checkData.exists) {
        if (errText) errText.textContent = checkData.message;
        if (errEl) errEl.style.display = 'flex';
        return;
      }
    } catch (e) {
      console.warn('Check phone error:', e);
    } finally {
      if (nextBtn) { nextBtn.innerHTML = 'Tiếp theo <i class="fa fa-arrow-right"></i>'; nextBtn.disabled = false; }
    }

    currentRegStep = 2;
    updateRegStepUI();
    return;
  }


  if (currentRegStep === 2) {
    currentRegStep = 3;
    // Populate review step
    const phone = document.getElementById('reg-phone')?.value.trim();
    const name = document.getElementById('reg-name')?.value.trim() || `Nông hộ ${phone}`;
    const plantType = document.getElementById('reg-plant-type')?.value.trim() || 'Chưa khai báo';
    const farmArea = document.getElementById('reg-farm-area')?.value.trim();

    document.getElementById('review-phone').textContent = phone;
    document.getElementById('review-name').textContent = name;
    document.getElementById('review-crop').textContent = plantType;
    document.getElementById('review-area').textContent = farmArea ? `${farmArea} ha` : 'Chưa khai báo';

    updateRegStepUI();
    return;
  }

  if (currentRegStep === 3) {
    submitRegister();
  }
}
window.nextRegStep = nextRegStep;

function prevRegStep() {
  if (currentRegStep > 1) {
    currentRegStep--;
    updateRegStepUI();
  }
}
window.prevRegStep = prevRegStep;

async function submitRegister() {
  const phone = document.getElementById('reg-phone')?.value.trim();
  const password = document.getElementById('reg-pass')?.value;
  const full_name = document.getElementById('reg-name')?.value.trim();
  const gender = document.getElementById('reg-gender')?.value;
  const dob = document.getElementById('reg-dob')?.value;
  const plant_type = document.getElementById('reg-plant-type')?.value.trim();
  const plant_variety = document.getElementById('reg-plant-variety')?.value.trim();
  const plant_age = document.getElementById('reg-plant-age')?.value.trim();
  const farm_area = document.getElementById('reg-farm-area')?.value.trim();

  const errEl = document.getElementById('reg-error');
  const errText = document.getElementById('reg-error-text');
  const nextBtn = document.getElementById('reg-next-btn');

  if (errEl) errEl.style.display = 'none';
  if (nextBtn) { nextBtn.innerHTML = '<span class="spinner"></span> Đang gửi đăng ký...'; nextBtn.disabled = true; }

  try {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        password,
        full_name,
        gender,
        dob,
        plant_type,
        plant_variety,
        plant_age,
        farm_area
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Đăng ký không thành công.');

    alert(data.message);
    closeRegisterModal();
    // Fill login phone for fast login
    const loginEmailInput = document.getElementById('login-email');
    if (loginEmailInput) loginEmailInput.value = phone;

  } catch (err) {
    if (errEl) {
      if (errText) errText.textContent = err.message;
      errEl.style.display = 'flex';
    }
  } finally {
    if (nextBtn) { nextBtn.innerHTML = '<i class="fa fa-paper-plane"></i> Gửi yêu cầu đăng ký'; nextBtn.disabled = false; }
  }
}
window.submitRegister = submitRegister;

