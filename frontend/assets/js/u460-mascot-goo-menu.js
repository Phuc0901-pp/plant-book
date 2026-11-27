/* Lucian UX/UI Prompt #460 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#460 */
(function () {
  if (window.U460MascotMenu) return;

  var ICONS = {
    log: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>',
    farm: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8Z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2Z"/></svg>',
    supply: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
    dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
    database: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>',
    ai: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="4"/></svg>'
  };

  function computeAngles(containerEl) {
    var rect = containerEl.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var vw = window.innerWidth || 1024;
    var vh = window.innerHeight || 768;

    var nearRight = cx > vw * 0.65;
    var nearLeft = cx < vw * 0.35;
    var nearTop = cy < vh * 0.35;

    if (nearTop) {
      if (nearRight) return [78, 114, 150, 186];
      if (nearLeft) return [-6, 30, 66, 102];
      return [18, 66, 114, 162];
    }
    if (nearRight) return [-186, -150, -114, -78];
    if (nearLeft) return [-102, -66, -30, 6];
    return [-162, -114, -66, -18];
  }

  function mount(containerEl, config) {
    if (!containerEl) return null;
    if (containerEl.__u460Controller) {
      containerEl.__u460Controller.destroy();
    }

    var cfg = config || {};
    var actions = Array.isArray(cfg.actions) ? cfg.actions.slice(0, 4) : [];
    var triggerEl = cfg.triggerSelector ? containerEl.querySelector(cfg.triggerSelector) : null;
    var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var root = document.createElement('div');
    root.className = 'ux u460';

    var uid = 'u460' + Math.random().toString(36).slice(2, 7);
    var blobsHtml = actions.map(function (_, i) {
      return '<i class="u460-bb" style="--u460-i:' + i + '"></i>';
    }).join('') + '<i class="u460-bb is-fab"></i>';

    var actsHtml = actions.map(function (act, i) {
      var iconSvg = ICONS[act.icon] || ICONS.chat;
      var label = act.label || 'Action';
      return '<button type="button" class="u460-a" style="--u460-i:' + i + '" aria-label="' + label.replace(/"/g, '&quot;') + '" tabindex="-1">' +
        iconSvg +
        '<span class="u460-tip" aria-hidden="true">' + label + '</span>' +
      '</button>';
    }).join('');

    root.innerHTML =
      '<svg class="u460-defs" aria-hidden="true" focusable="false">' +
        '<filter class="u460-f" id="' + uid + 'g" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">' +
          '<feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b"/>' +
          '<feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="g"/>' +
          '<feComposite in="SourceGraphic" in2="g" operator="atop"/>' +
        '</filter>' +
      '</svg>' +
      '<div class="u460-st">' +
        '<div class="u460-sh" aria-hidden="true"><div class="u460-goo">' + blobsHtml + '</div></div>' +
        '<div class="u460-ic" id="' + uid + 'm" role="group" aria-label="Menu thao tác nhanh Bé Mầm">' + actsHtml + '</div>' +
      '</div>';

    containerEl.appendChild(root);

    var goo = root.querySelector('.u460-goo');
    var fabBlob = root.querySelector('.u460-bb.is-fab');
    var blobs = [].slice.call(root.querySelectorAll('.u460-bb:not(.is-fab)'));
    var acts = [].slice.call(root.querySelectorAll('.u460-a'));

    if (triggerEl) {
      triggerEl.setAttribute('aria-controls', uid + 'm');
      triggerEl.setAttribute('aria-expanded', 'false');
    }

    var open = false;
    var gooT = 0;

    function gooOn(v) {
      clearTimeout(gooT);
      if (v) {
        root.classList.add('is-animating');
        goo.style.filter = 'url(#' + uid + 'g)';
      } else {
        gooT = setTimeout(function () {
          if (root.isConnected && !open) {
            goo.style.filter = '';
            root.classList.remove('is-animating');
          }
        }, rm ? 0 : 900);
      }
    }

    function updateCoords() {
      var vw = window.innerWidth || 1024;
      var R = vw <= 480 ? 96 : 112;
      var angles = computeAngles(containerEl);
      acts.forEach(function (actEl, i) {
        var deg = angles[i] !== undefined ? angles[i] : (-157.5 + i * 45);
        var a = deg * Math.PI / 180;
        actEl.dataset.x = (Math.cos(a) * R).toFixed(1) + 'px';
        actEl.dataset.y = (Math.sin(a) * R).toFixed(1) + 'px';
      });
    }

    function squish(k) {
      if (rm) return;
      var frames = [
        { transform: 'scale(1)' },
        { transform: 'scale(' + k + ')', offset: 0.3 },
        { transform: 'scale(1.06)', offset: 0.65 },
        { transform: 'scale(1)' }
      ];
      if (fabBlob && fabBlob.animate) {
        fabBlob.animate(frames, { duration: 560, easing: 'ease-out' });
      }
      if (triggerEl && triggerEl.animate) {
        triggerEl.animate(frames, { duration: 560, easing: 'ease-out' });
      }
    }

    function setOpen(v, focusTrigger) {
      v = !!v;
      if (open === v) return;
      if (v) updateCoords();
      open = v;
      gooOn(v);
      root.classList.toggle('is-open', v);
      if (triggerEl) {
        triggerEl.setAttribute('aria-expanded', v ? 'true' : 'false');
      }
      [blobs, acts].forEach(function (list) {
        list.forEach(function (el, i) {
          el.style.setProperty('--u460-tx', v ? acts[i].dataset.x : '0px');
          el.style.setProperty('--u460-ty', v ? acts[i].dataset.y : '0px');
        });
      });
      acts.forEach(function (b) { b.tabIndex = v ? 0 : -1; });
      blobs.forEach(function (b) { b.classList.remove('is-hov'); });
      squish(v ? 0.86 : 0.9);
      if (!v && focusTrigger && triggerEl && typeof triggerEl.focus === 'function') {
        triggerEl.focus({ preventScroll: true });
      }
    }

    acts.forEach(function (b, i) {
      var on = function () { if (open) blobs[i].classList.add('is-hov'); };
      var off = function () { blobs[i].classList.remove('is-hov'); };
      b.addEventListener('pointerenter', on);
      b.addEventListener('pointerleave', off);
      b.addEventListener('focus', on);
      b.addEventListener('blur', off);
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!open) return;
        var had = document.activeElement === b;
        if (!rm && blobs[i] && blobs[i].animate) {
          blobs[i].animate([
            { transform: 'translate(' + b.dataset.x + ',' + b.dataset.y + ') scale(1.1)' },
            { transform: 'translate(' + b.dataset.x + ',' + b.dataset.y + ') scale(1.28)' },
            { transform: 'translate(' + b.dataset.x + ',' + b.dataset.y + ') scale(1)' }
          ], { duration: 260, easing: 'ease-out' });
        }
        var handler = actions[i] && actions[i].onClick;
        setTimeout(function () {
          if (root.isConnected) setOpen(false, had);
          if (typeof handler === 'function') handler(e);
        }, rm ? 0 : 200);
      });
    });

    function onKeyDown(e) {
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false, true);
        return;
      }
      var idx = acts.indexOf(document.activeElement);
      if (/^Arrow(Left|Up|Right|Down)$/.test(e.key)) {
        e.preventDefault();
        var d = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
        var count = acts.length || 1;
        var nextIdx = idx < 0 ? (d > 0 ? 0 : count - 1) : (idx + d + count) % count;
        if (acts[nextIdx]) acts[nextIdx].focus({ preventScroll: true });
      }
    }

    function onDocPointerDown(e) {
      if (open && !containerEl.contains(e.target)) {
        setOpen(false);
      }
    }

    function onFocusOut(e) {
      if (open && e.relatedTarget && !containerEl.contains(e.relatedTarget)) {
        setOpen(false);
      }
    }

    containerEl.addEventListener('keydown', onKeyDown);
    containerEl.addEventListener('focusout', onFocusOut);
    document.addEventListener('pointerdown', onDocPointerDown);

    var controller = {
      toggle: function () { setOpen(!open); },
      setOpen: setOpen,
      isOpen: function () { return open; },
      destroy: function () {
        clearTimeout(gooT);
        containerEl.removeEventListener('keydown', onKeyDown);
        containerEl.removeEventListener('focusout', onFocusOut);
        document.removeEventListener('pointerdown', onDocPointerDown);
        if (root.parentNode) root.parentNode.removeChild(root);
        if (containerEl.__u460Controller === controller) {
          delete containerEl.__u460Controller;
        }
      }
    };

    containerEl.__u460Controller = controller;
    return controller;
  }

  window.U460MascotMenu = { mount: mount };
})();
