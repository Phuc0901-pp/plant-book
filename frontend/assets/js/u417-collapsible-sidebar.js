/* Lucian UX/UI Prompt #417 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#417 */
(function () {
  if (window.__u417SidebarInitialized) return;
  window.__u417SidebarInitialized = true;

  var STORAGE_KEY = 'pb_u417_sidebar_rail';

  function readRailPref() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function writeRailPref(isRail) {
    try {
      localStorage.setItem(STORAGE_KEY, isRail ? '1' : '0');
    } catch (_) {}
  }

  function initSidebar(sb) {
    if (!sb || sb.dataset.u417Bound === '1') return;
    sb.dataset.u417Bound = '1';

    var nav = sb.querySelector('.u417-nav');
    var pl = sb.querySelector('.u417-pl');
    var tg = sb.querySelector('.u417-tg');
    if (!nav || !pl || !tg) return;

    var uid = 'u417-' + Math.random().toString(36).slice(2, 7);
    if (!sb.id) sb.id = uid + '-sb';
    tg.setAttribute('aria-controls', sb.id);

    function getItems() {
      return Array.prototype.slice.call(nav.querySelectorAll('.u417-it'));
    }

    function getActiveItem() {
      var items = getItems();
      for (var i = 0; i < items.length; i++) {
        if (items[i].classList.contains('active') || items[i].getAttribute('aria-current') === 'page') {
          return items[i];
        }
      }
      return items[0] || null;
    }

    function syncAriaCurrent(targetEl) {
      var items = getItems();
      items.forEach(function (el) {
        if (el === targetEl) {
          el.setAttribute('aria-current', 'page');
        } else {
          el.removeAttribute('aria-current');
        }
      });
    }

    function slide() {
      var act = getActiveItem();
      if (!act || act.offsetParent === null) {
        pl.classList.remove('is-visible');
        return;
      }
      syncAriaCurrent(act);
      var y = act.offsetTop;
      var h = act.offsetHeight || 40;
      pl.style.setProperty('--py', y + 'px');
      pl.style.setProperty('--ph', h + 'px');
      pl.classList.add('is-visible');
    }

    var items = getItems();
    items.forEach(function (item) {
      var lb = item.querySelector('.u417-lb');
      var labelText = lb ? lb.textContent.trim() : item.textContent.trim();
      if (labelText && !item.getAttribute('title')) {
        item.setAttribute('title', labelText);
      }
      if (!item.hasAttribute('tabindex')) {
        item.setAttribute('tabindex', '0');
      }
      if (!item.hasAttribute('role') && item.tagName !== 'A' && item.tagName !== 'BUTTON') {
        item.setAttribute('role', 'button');
      }

      item.addEventListener('click', function () {
        items.forEach(function (el) {
          el.classList.remove('active');
          el.removeAttribute('aria-current');
        });
        item.classList.add('active');
        item.setAttribute('aria-current', 'page');
        slide();
      });

      item.addEventListener('keydown', function (e) {
        var currentItems = getItems().filter(function (el) {
          return el.offsetParent !== null;
        });
        var pos = currentItems.indexOf(item);
        if (pos < 0) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (currentItems[pos + 1]) currentItems[pos + 1].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (currentItems[pos - 1]) currentItems[pos - 1].focus();
        } else if (e.key === 'Home') {
          e.preventDefault();
          if (currentItems[0]) currentItems[0].focus();
        } else if (e.key === 'End') {
          e.preventDefault();
          if (currentItems[currentItems.length - 1]) currentItems[currentItems.length - 1].focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.click();
        }
      });
    });

    var rail = readRailPref();
    function applyRail(nextRail, persist) {
      rail = !!nextRail;
      sb.classList.toggle('is-rail', rail);
      tg.setAttribute('aria-expanded', String(!rail));
      tg.setAttribute('aria-label', rail ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên');
      if (persist) writeRailPref(rail);
    }

    applyRail(rail, false);

    tg.addEventListener('click', function () {
      applyRail(!rail, true);
      window.setTimeout(function () {
        slide();
        try {
          window.dispatchEvent(new Event('resize'));
        } catch (_) {}
      }, 620);
    });

    var observer = new MutationObserver(function () {
      window.requestAnimationFrame(slide);
    });
    observer.observe(nav, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class', 'aria-current']
    });

    window.addEventListener('resize', slide);
    if (typeof ResizeObserver === 'function') {
      var ro = new ResizeObserver(function () {
        slide();
      });
      ro.observe(nav);
    }

    pl.style.transition = 'none';
    slide();
    void pl.offsetWidth;
    pl.style.transition = '';
    sb.classList.add('u417-ready');

    window.setTimeout(slide, 120);
    window.setTimeout(slide, 450);
  }

  function bootAll() {
    var list = document.querySelectorAll('.u417-sb');
    for (var i = 0; i < list.length; i++) {
      initSidebar(list[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAll);
  } else {
    bootAll();
  }
})();
