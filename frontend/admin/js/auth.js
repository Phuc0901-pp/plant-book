// ── Auth ─────────────────────────────────────────────────

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
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
    if (data.user.role !== 'admin') {
      localStorage.setItem('pb_token', data.token);
      window.location.href = '/user';
      return;
    }

    token = data.token;
    localStorage.setItem('pb_token', token);
    currentUser = data.user;
    showApp();

  } catch (err) {
    const errText = document.getElementById('login-error-text');
    if (errText) errText.textContent = err.message;
    else errEl.textContent = err.message;
    errEl.style.display  = 'flex';
    btn.innerHTML = '<span id="login-btn-text"><i class="fa fa-right-to-bracket"></i> Đăng nhập</span>';
    btn.disabled  = false;
  }
}

document.getElementById('login-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

async function logout() {
  closeWebSocket();
  if (token) {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Admin API logout error:', e);
    }
  }
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
  connectWebSocket();
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

