export function initFloatingActionButton() {
  const fab = document.getElementById('fab-care-btn');
  if (!fab) return;

  if (fab.dataset.initialized) return;
  fab.dataset.initialized = 'true';

  let isDragging     = false;
  let startX, startY;
  let initialLeft, initialTop;
  let longPressTimer = null;

  const startDrag = (clientX, clientY) => {
    startX = clientX;
    startY = clientY;

    const rect = fab.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop  = rect.top;

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

  const moveDrag = (clientX, clientY) => {
    if (longPressTimer && !isDragging) {
      const distance = Math.hypot(clientX - startX, clientY - startY);
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
      if (typeof window.openCareModal === 'function') {
        window.openCareModal(null, null, null);
      }
    }
  };

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

  fab.addEventListener('touchstart', (e) => {
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  fab.addEventListener('touchmove', (e) => {
    if (isDragging) e.preventDefault();
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  fab.addEventListener('touchend', (e) => { endDrag(e); });
}
