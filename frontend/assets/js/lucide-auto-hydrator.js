/* ═══════════════════════════════════════════════════════════════
   Plant Book Enterprise AgTech — Universal Lucide Icon Auto-Hydrator
   Automatically watches DOM mutations & guarantees instant icon hydration
   across initial load, deep routing, page switching, tab transitions & modals.
   ═══════════════════════════════════════════════════════════════ */
(function(window, document) {
  'use strict';

  if (window.__LucideHydratorInitialized) return;
  window.__LucideHydratorInitialized = true;

  // Universal +4px Icon System Styles Injector
  function injectIconStyles() {
    if (typeof document === 'undefined' || document.getElementById('lucide-plus4px-styles')) return;
    var style = document.createElement('style');
    style.id = 'lucide-plus4px-styles';
    style.textContent = [
      '.lucide { width: calc(1.15em + 4px) !important; height: calc(1.15em + 4px) !important; display: inline-block; vertical-align: -0.18em; stroke-width: 2; }',
      '.lucide-lg, svg.lucide-lg { width: calc(1.45em + 4px) !important; height: calc(1.45em + 4px) !important; }',
      '.lucide-sm, svg.lucide-sm { width: calc(0.9em + 4px) !important; height: calc(0.9em + 4px) !important; }',
      '.lucide-xs, svg.lucide-xs { width: calc(0.75em + 4px) !important; height: calc(0.75em + 4px) !important; }',
      '.lucide-xl, svg.lucide-xl { width: calc(1.85em + 4px) !important; height: calc(1.85em + 4px) !important; }',
      'i.fa, i.fas, i.far, i.fab, i.bi { font-size: calc(1em + 4px); vertical-align: -0.12em; }'
    ].join('\n');
    var head = document.head || document.getElementsByTagName('head')[0];
    if (head) head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectIconStyles);
  } else {
    injectIconStyles();
  }

  var scheduledTimer = null;
  var isHydrating = false;

  /**
   * Safely invoke Lucide icon creation
   */
  function doCreateIcons(targetEl) {
    if (!window.lucide || typeof window.lucide.createIcons !== 'function') return;
    try {
      if (targetEl && targetEl.nodeType === 1) {
        window.lucide.createIcons({ targets: [targetEl] });
      } else {
        window.lucide.createIcons();
      }
    } catch (err) {
      // Ignore temporary DOM unmount race conditions
    }
  }

  /**
   * Debounced icon refresh scheduler to prevent layout thrashing
   */
  function scheduleRefreshIcons(delay) {
    if (delay === undefined) delay = 16;
    if (scheduledTimer) clearTimeout(scheduledTimer);
    scheduledTimer = setTimeout(function() {
      scheduledTimer = null;
      isHydrating = true;
      doCreateIcons();
      isHydrating = false;
    }, delay);
  }

  /**
   * Global refresh helper exposed to window
   */
  window.refreshIcons = function(targetEl) {
    if (targetEl && targetEl.nodeType === 1) {
      doCreateIcons(targetEl);
    } else {
      scheduleRefreshIcons(0);
    }
  };

  window.scheduleRefreshIcons = scheduleRefreshIcons;

  /**
   * MutationObserver to automatically detect unrendered icons
   */
  var observer = null;
  function initObserver() {
    if (observer) return;
    var root = document.body || document.documentElement;
    if (!root) return;

    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(function(mutations) {
        if (isHydrating) return;
        var shouldRefresh = false;

        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.type === 'childList') {
            for (var j = 0; j < m.addedNodes.length; j++) {
              var node = m.addedNodes[j];
              if (node.nodeType === 1) {
                // Ignore SVG created by Lucide itself
                if (node.tagName === 'svg' || (node.classList && node.classList.contains('lucide'))) {
                  continue;
                }
                if (node.hasAttribute('data-lucide') || (node.querySelector && node.querySelector('[data-lucide]'))) {
                  shouldRefresh = true;
                  break;
                }
              }
            }
          } else if (m.type === 'attributes') {
            var target = m.target;
            if (target && target.nodeType === 1) {
              if (m.attributeName === 'style' || m.attributeName === 'class') {
                if (target.querySelector && target.querySelector('[data-lucide]:not(svg)')) {
                  shouldRefresh = true;
                  break;
                }
              } else if (m.attributeName === 'data-lucide') {
                shouldRefresh = true;
                break;
              }
            }
          }
          if (shouldRefresh) break;
        }

        if (shouldRefresh) {
          scheduleRefreshIcons(20);
        }
      });

      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'data-lucide', 'id']
      });
    }
  }

  // Bind early DOM and window lifecycle events
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initObserver();
      scheduleRefreshIcons(0);
    });
  } else {
    initObserver();
    scheduleRefreshIcons(0);
  }

  window.addEventListener('load', function() {
    initObserver();
    scheduleRefreshIcons(0);
  });

  // Multi-pass safety hydration for CDN scripts
  [0, 30, 80, 200, 500, 1000, 2000].forEach(function(d) {
    setTimeout(function() {
      scheduleRefreshIcons(0);
    }, d);
  });

})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : {});
