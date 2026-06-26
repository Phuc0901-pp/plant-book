/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Panel  /  auth.js
   Xử lý đăng nhập, kiểm tra token, phân luồng role
   ═══════════════════════════════════════════════════════════════ */

/* ── Đăng nhập ─────────────────────────────────────────────── */
async function doLogin() {
  const email  = document.getElementById('login-email').value.trim();
  const pass   = document.getElementById('login-pass').value;
  const errEl  = document.getElementById('login-error');
  const btn    = document.getElementById('login-btn');

  errEl.style.display = 'none';
  btn.innerHTML = '<span class="spinner"></span>';
  btn.disabled  = true;

  try {
    const res  = await fetch(`${API}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại');

    /* Phân luồng theo role */
    if (data.user.role === 'admin') {
      /* Admin đăng nhập ở trang user → điều hướng sang /admin */
      localStorage.setItem('pb_token', data.token);
      window.location.href = '/admin';
      return;
    }

    /* Role user (hoặc bất kỳ role nào không phải admin) */
    token       = data.token;
    currentUser = data.user;
    localStorage.setItem('pb_token', data.token);
    showApp();

  } catch (err) {
    errEl.textContent    = err.message;
    errEl.style.display  = 'block';
    btn.innerHTML = '<span id="login-btn-text">Đăng nhập</span>';
    btn.disabled  = false;
  }
}

/* Phím Enter → đăng nhập */
document.getElementById('login-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

/* ── Đăng xuất ──────────────────────────────────────────────── */
function logout() {
  token = '';
  currentUser = null;
  localStorage.removeItem('pb_token');
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
}

/* ── Hiển thị app sau khi xác thực thành công ───────────────── */
function showApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display        = 'flex';
  document.getElementById('sb-user-name').textContent  = currentUser?.name  || currentUser?.full_name || '—';
  document.getElementById('sb-user-email').textContent = currentUser?.email || '—';
  showPage('home');
}

/* ── Kiểm tra token lưu sẵn khi tải trang ──────────────────── */
window.addEventListener('load', async () => {
  if (!token) return; /* không có token → hiện màn login */

  try {
    const me = await api('/auth/me');

    /* Nếu là admin → chuyển sang trang admin */
    if (me.role === 'admin') {
      window.location.href = '/admin';
      return;
    }

    currentUser = me;
    showApp();
  } catch {
    /* Token hết hạn / không hợp lệ */
    logout();
  }
});
