/**
 * admin/js/countup.js - Universal Number Count-Up Animation (0 -> target) for Admin Portal
 */

function animateValue(el, start, end, duration = 1000, decimals = 0, suffix = '') {
  if (!el) return;
  const startTime = performance.now();
  const startVal = typeof start === 'number' ? start : 0;
  const endVal = typeof end === 'number' ? end : parseFloat(end) || 0;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing: easeOutExpo
    const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const current = startVal + (endVal - startVal) * ease;

    let formatted = decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString('vi-VN');
    el.textContent = `${formatted}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      let finalFormatted = decimals > 0 ? endVal.toFixed(decimals) : Math.round(endVal).toLocaleString('vi-VN');
      el.textContent = `${finalFormatted}${suffix}`;
    }
  }

  requestAnimationFrame(update);
}

function triggerAdminPageCountUpAnimations(pageId) {
  const container = document.getElementById(`page-${pageId}`) || document;
  
  const countIds = [
    'stat-plants', 'stat-healthy', 'stat-watch', 'stat-schemas',
    'total-plants-count', 'total-users-count', 'total-farms-count'
  ];

  countIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const rawText = el.getAttribute('data-target-val') || el.textContent.replace(/[^0-9.-]/g, '');
      const target = parseFloat(rawText);
      if (!isNaN(target) && target > 0) {
        el.setAttribute('data-target-val', target);
        animateValue(el, 0, target, 1100);
      }
    }
  });

  const statNumbers = container.querySelectorAll('.stat-number, .metric-val, strong[data-count]');
  statNumbers.forEach(el => {
    const raw = el.getAttribute('data-count') || el.textContent.replace(/[^0-9.-]/g, '');
    const num = parseFloat(raw);
    if (!isNaN(num) && num > 0) {
      animateValue(el, 0, num, 1000);
    }
  });
}

window.animateValue = animateValue;
window.triggerAdminPageCountUpAnimations = triggerAdminPageCountUpAnimations;
