/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   auth.js — Login, logout, token verification, role routing
   ═══════════════════════════════════════════════════════════════ */

import { API, api, token, setToken, clearToken, setCurrentUser, currentUser } from './core/api.js';
import { showPage } from './core/router.js';

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
    if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
    if (btn)   { btn.innerHTML = '<span id="login-btn-text">Đăng nhập</span>'; btn.disabled = false; }
  }
}

// Phím Enter → đăng nhập
document.getElementById('login-pass')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

// Expose doLogin cho nút HTML onclick
window.doLogin = doLogin;

// ── Đăng xuất ─────────────────────────────────────────────────
export async function logout() {
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
