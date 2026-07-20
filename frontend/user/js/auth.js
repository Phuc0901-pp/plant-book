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
  if (emailEl) emailEl.textContent = user?.email || '—';

  // Cập nhật thông tin ở tab Cài đặt
  const settingNameEl  = document.getElementById('setting-user-name');
  const settingEmailEl = document.getElementById('setting-user-email');
  if (settingNameEl)  settingNameEl.textContent  = user?.full_name || user?.name || '—';
  if (settingEmailEl) settingEmailEl.textContent = user?.email || '—';

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
