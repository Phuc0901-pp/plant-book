// ── Auth ─────────────────────────────────────────────────

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  errEl.style.display = 'none';
  btn.innerHTML = '<span class="spinner"></span>';
  btn.disabled = true;
  try {
    const res  = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại');

    /* Phân luồng theo role */
    if (data.user.role !== 'admin') {
      /* User thường đăng nhập ở trang admin → redirect sang /user */
      localStorage.setItem('pb_token', data.token);
      window.location.href = '/user';
      return;
    }

    token = data.token;
    localStorage.setItem('pb_token', token);
    currentUser = data.user;
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.innerHTML = '<span id="login-btn-text">Đăng nhập</span>';
    btn.disabled = false;
  }
}

document.getElementById('login-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

function logout() {
  token = '';
  localStorage.removeItem('pb_token');
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
}

async function showApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('sb-user-name').textContent = currentUser?.name || '';
  document.getElementById('sb-user-email').textContent = currentUser?.email || '';
  await ensureMapboxToken();
  loadDashboard();
  loadSchemasDropdown();
}

// Check existing token on load – guard: chỉ admin mới được ở /admin
window.addEventListener('load', async () => {
  if (token) {
    try {
      const me = await api('/auth/me');
      if (me.role !== 'admin') {
        /* Token hợp lệ nhưng không phải admin → redirect /user */
        window.location.href = '/user';
        return;
      }
      currentUser = me;
      showApp();
    } catch { logout(); }
  }
});

