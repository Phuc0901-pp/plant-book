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

function closeForgotPasswordModal() {
  const modal = document.getElementById('forgot-modal');
  if (modal) modal.style.display = 'none';
}

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

