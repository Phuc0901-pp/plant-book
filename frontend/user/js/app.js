/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Panel  /  app.js
   Router, sidebar toggle, toast, api helper
   ═══════════════════════════════════════════════════════════════ */

const API = '/api';
let token       = localStorage.getItem('pb_token') || '';
let currentUser = null;

/* ── Các trang trong user panel ─────────────────────────────── */
const PAGE_TITLES = {
  home:     'Trang chủ',
  myplants: 'Cây trồng của tôi',
  logs:     'Nhật ký canh tác',
  reports:  'Báo cáo',
  settings: 'Cài đặt tài khoản',
};

/* ── Router ─────────────────────────────────────────────────── */
function showPage(page) {
  /* Ẩn tất cả sections */
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  /* Bỏ active nav */
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  /* Active section */
  const section = document.getElementById(`page-${page}`);
  if (section) section.classList.add('active');

  /* Active nav item */
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  } else {
    const navEl = document.querySelector(`[data-page="${page}"]`);
    if (navEl) navEl.classList.add('active');
  }

  /* Cập nhật tiêu đề topbar */
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[page] || page;

  /* Đóng mobile sidebar */
  closeMobileSidebar();
}

/* ── Mobile sidebar ─────────────────────────────────────────── */
function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (!sidebar) return;
  sidebar.classList.toggle('open');
  if (overlay) overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
}

function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    if (overlay) overlay.style.display = 'none';
  }
}

/* ── API helper ─────────────────────────────────────────────── */
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ── Toast notification ─────────────────────────────────────── */
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
