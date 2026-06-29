/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/fab.js — Draggable Floating Action Button (FAB)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Khởi tạo nút nổi FAB (+) có thể kéo rê.
 *
 * Hành vi:
 *   - Nhấn nhanh (< 400ms)  → mở modal nhật ký chăm sóc (openCareModal từ window)
 *   - Nhấn giữ (>= 400ms)   → bật chế độ kéo rê, rung nhẹ điện thoại
 *   - Kéo rê                → di chuyển FAB đến vị trí tuỳ ý
 *
 * Hỗ trợ cả sự kiện chuột (Mouse) và cảm ứng (Touch).
 * Chỉ gán listener một lần nhờ cờ data-initialized.
 */
export function initFloatingActionButton() {
  const fab = document.getElementById('fab-care-btn');
  if (!fab) return;

  // Tránh gán đè nhiều lần bộ lắng nghe khi reload dashboard
  if (fab.dataset.initialized) return;
  fab.dataset.initialized = 'true';

  let isDragging     = false;
  let startX, startY;
  let initialLeft, initialTop;
  let longPressTimer = null;

  /**
   * Bắt đầu theo dõi nhấn/kéo từ toạ độ clientX, clientY.
   */
  const startDrag = (clientX, clientY) => {
    startX = clientX;
    startY = clientY;

    const rect = fab.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop  = rect.top;

    // Chuyển sang toạ độ tuyệt đối để kéo tự do
    fab.style.right  = 'auto';
    fab.style.bottom = 'auto';
    fab.style.left   = `${initialLeft}px`;
    fab.style.top    = `${initialTop}px`;

    longPressTimer = setTimeout(() => {
      isDragging             = true;
      fab.style.transform    = 'scale(1.15)';
      fab.style.opacity      = '0.9';
      fab.style.background   = '#047857';
      if (navigator.vibrate) navigator.vibrate(40);
    }, 400);
  };

  /**
   * Cập nhật vị trí FAB khi kéo, huỷ timer nếu ngón tay di chuyển quá nhiều.
   */
  const moveDrag = (clientX, clientY) => {
    if (longPressTimer && !isDragging) {
      const distance = Math.hypot(clientX - startX, clientY - startY);
      // Ngưỡng 25px: bỏ qua run tay nhẹ trên cảm ứng
      if (distance > 25) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }

    if (isDragging) {
      const newLeft = Math.max(10, Math.min(window.innerWidth  - 66, initialLeft + (clientX - startX)));
      const newTop  = Math.max(10, Math.min(window.innerHeight - 66, initialTop  + (clientY - startY)));
      fab.style.left = `${newLeft}px`;
      fab.style.top  = `${newTop}px`;
    }
  };

  /**
   * Kết thúc nhấn/kéo:
   * - Nếu đang kéo → hoàn tất kéo, khôi phục style
   * - Nếu chỉ nhấn nhanh → mở modal nhật ký
   */
  const endDrag = (e) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    if (isDragging) {
      isDragging           = false;
      fab.style.transform  = '';
      fab.style.opacity    = '';
      fab.style.background = '';
      if (e) e.preventDefault();
    } else {
      // Mở modal qua window để tránh circular import
      if (typeof window.openCareModal === 'function') {
        window.openCareModal(null, null, null);
      }
    }
  };

  // ── Sự kiện Chuột ──────────────────────────────────────
  fab.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    startDrag(e.clientX, e.clientY);

    const onMove = (ev) => moveDrag(ev.clientX, ev.clientY);
    const onUp   = (ev) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      endDrag(ev);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // ── Sự kiện Cảm ứng ────────────────────────────────────
  fab.addEventListener('touchstart', (e) => {
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  fab.addEventListener('touchmove', (e) => {
    if (isDragging) e.preventDefault();
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  fab.addEventListener('touchend', (e) => { endDrag(e); });
}
