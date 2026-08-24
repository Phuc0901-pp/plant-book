/**
 * modules/countup.js - Smooth Universal Number Count-Up Animation (0 -> target)
 */

export function animateValue(el, start, end, duration = 1000, decimals = 0, suffix = '') {
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

export function triggerPageCountUpAnimations(pageId) {
  const container = document.getElementById(`page-${pageId}`) || document;
  
  // Find all counters with data-count-to or specific metric IDs
  const countElements = [
    { id: 'user-plant-count', decimals: 0, suffix: '' },
    { id: 'myplants-total-count', decimals: 0, suffix: '' },
    { id: 'supplies-total-items', decimals: 0, suffix: '' },
    { id: 'supplies-total-value', decimals: 0, suffix: ' đ' },
    { id: 'logs-total-count', decimals: 0, suffix: '' },
    { selector: '.metric-count-up' }
  ];

  countElements.forEach(item => {
    if (item.id) {
      const el = document.getElementById(item.id);
      if (el) {
        const rawText = el.getAttribute('data-target-val') || el.textContent.replace(/[^0-9.-]/g, '');
        const target = parseFloat(rawText);
        if (!isNaN(target) && target > 0) {
          el.setAttribute('data-target-val', target);
          animateValue(el, 0, target, 1100, item.decimals, item.suffix);
        }
      }
    }
  });

  // Also query elements with .stat-number or .count-animate
  const statNumbers = container.querySelectorAll('.stat-number, .count-animate, strong[data-count]');
  statNumbers.forEach(el => {
    const raw = el.getAttribute('data-count') || el.textContent.replace(/[^0-9.-]/g, '');
    const num = parseFloat(raw);
    if (!isNaN(num) && num > 0) {
      animateValue(el, 0, num, 1000);
    }
  });
}
window.animateValue = animateValue;
window.triggerPageCountUpAnimations = triggerPageCountUpAnimations;
