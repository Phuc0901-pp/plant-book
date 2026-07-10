/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   core/router.js — Tab navigation & mobile sidebar toggle
   ═══════════════════════════════════════════════════════════════ */

/** Tiêu đề hiển thị cho từng tab */
export const PAGE_TITLES = {
  home:     'Trang chủ',
  myplants: 'Trang trại',
  logs:     'Lịch sử',
  settings: 'Cài đặt tài khoản',
};

/**
 * Chuyển sang trang/tab chỉ định.
 * Kích hoạt section HTML tương ứng, cập nhật nav active.
 * Tự động load dashboard khi chuyển về Trang chủ.
 * @param {string} page — key của tab (home | myplants | logs | settings)
 */
export function showPage(page) {
  // Tắt tất cả sections
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  // Tắt nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));

  // Bật section mục tiêu
  const section = document.getElementById(`page-${page}`);
  if (section) section.classList.add('active');

  // Đánh dấu nav active
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  const bottomNavEl = document.querySelector(`.bottom-nav-item[data-page="${page}"]`);
  if (bottomNavEl) bottomNavEl.classList.add('active');

  // Cập nhật tiêu đề trang
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[page] || page;

  closeMobileSidebar();

  // Lazy load dữ liệu khi cần
  if (page === 'home') {
    // Gọi thông qua window để tránh circular import
    if (typeof window.loadUserDashboard === 'function') {
      window.loadUserDashboard();
    }
  }

  if (page === 'myplants') {
    // Force Mapbox viewport recalculation when switching to the map page
    import('../modules/map.js').then(mapModule => {
      if (mapModule.userMap) {
        setTimeout(() => {
          try { mapModule.userMap.resize(); } catch (_) {}
        }, 150);
      }
    });
  }
}

/**
 * Mở/đóng sidebar trên mobile.
 */
export function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (!sidebar) return;
  sidebar.classList.toggle('open');
  if (overlay) overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
}

/**
 * Đóng sidebar nếu đang mở.
 */
export function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    if (overlay) overlay.style.display = 'none';
  }
}
