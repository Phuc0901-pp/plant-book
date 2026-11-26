(function () {
  'use strict';

  const DEFAULT_INTERVAL_MS = 60000;
  const MAX_BACKOFF_MS = 120000;
  const IDLE_GRACE_MS = 4000;
  const HIDDEN_RELOAD_THRESHOLD_MS = 45000;

  const state = {
    started: false,
    isRefreshing: false,
    intervalMs: DEFAULT_INTERVAL_MS,
    idleGraceMs: IDLE_GRACE_MS,
    timerId: null,
    lastInteractionAt: 0,
    hiddenAt: null,
    consecutiveErrors: 0,
    lastRefreshedAt: 0
  };

  function markInteraction() {
    state.lastInteractionAt = Date.now();
  }

  function hasVisibleModal() {
    if (typeof document === 'undefined' || !document.querySelectorAll) return false;
    const modals = document.querySelectorAll('.modal-overlay');
    for (let i = 0; i < modals.length; i++) {
      const m = modals[i];
      if (!m) continue;
      if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
        if (window.getComputedStyle(m).display !== 'none') return true;
      } else if (m.style && m.style.display && m.style.display !== 'none') {
        return true;
      }
    }
    return false;
  }

  function isInputFocused() {
    if (typeof document === 'undefined') return false;
    const el = document.activeElement;
    if (!el) return false;
    const tag = String(el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return Boolean(el.isContentEditable);
  }

  function isMapDrawingActive() {
    if (typeof window === 'undefined' || !window.drawControl || typeof window.drawControl.getMode !== 'function') {
      return false;
    }
    try {
      const mode = window.drawControl.getMode();
      return mode === 'draw_polygon' || mode === 'direct_select' || mode === 'draw_line_string';
    } catch (_) {
      return false;
    }
  }

  function shouldSkipRefresh(nowMs = Date.now()) {
    if (typeof document !== 'undefined' && document.visibilityState && document.visibilityState !== 'visible') {
      return { skip: true, reason: 'TAB_HIDDEN' };
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { skip: true, reason: 'OFFLINE' };
    }
    if (state.isRefreshing) {
      return { skip: true, reason: 'IN_FLIGHT' };
    }
    if (state.lastInteractionAt > 0 && (nowMs - state.lastInteractionAt) < state.idleGraceMs) {
      return { skip: true, reason: 'RECENT_INTERACTION' };
    }
    if (isInputFocused()) {
      return { skip: true, reason: 'INPUT_FOCUSED' };
    }
    if (hasVisibleModal()) {
      return { skip: true, reason: 'MODAL_OPEN' };
    }
    if (isMapDrawingActive()) {
      return { skip: true, reason: 'MAP_DRAWING_ACTIVE' };
    }
    return { skip: false, reason: null };
  }

  function scheduleIdleWork(fn) {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => fn(), { timeout: 2000 });
    } else {
      setTimeout(fn, 50);
    }
  }

  function hasActiveSession() {
    if (typeof localStorage === 'undefined') return false;
    return Boolean(localStorage.getItem('pb_token') || localStorage.getItem('token'));
  }

  function captureScrollPositions() {
    const winY = typeof window !== 'undefined' ? (window.scrollY || 0) : 0;
    const contentEl = typeof document !== 'undefined' && document.querySelector ? document.querySelector('.content') : null;
    const contentTop = contentEl ? contentEl.scrollTop : 0;
    return { winY, contentEl, contentTop };
  }

  function restoreScrollPositions(snap) {
    if (typeof window === 'undefined') return;
    const apply = () => {
      if ((window.scrollY || 0) !== snap.winY) {
        window.scrollTo(window.scrollX || 0, snap.winY);
      }
      if (snap.contentEl && snap.contentEl.scrollTop !== snap.contentTop) {
        snap.contentEl.scrollTop = snap.contentTop;
      }
    };
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(apply);
    }
  }

  async function runScopedSilentRefresh() {
    if (!hasActiveSession()) return false;
    const check = shouldSkipRefresh();
    if (check.skip) return false;

    state.isRefreshing = true;
    const scrollSnap = captureScrollPositions();

    try {
      const tasks = [];
      const activeSection = typeof document !== 'undefined' && document.querySelector
        ? document.querySelector('.page-section.active')
        : null;
      const activeId = activeSection ? activeSection.id : '';

      if (activeId === 'page-gis') {
        if (typeof window.loadAdminNotifications === 'function') {
          tasks.push(Promise.resolve(window.loadAdminNotifications()).catch(() => {}));
        }
      } else {
        if (activeId === 'page-plants' && typeof window.loadPlants === 'function') {
          tasks.push(Promise.resolve(window.loadPlants()).catch(() => {}));
        } else if (activeId === 'page-devices' && typeof window.loadDevices === 'function') {
          tasks.push(Promise.resolve(window.loadDevices()).catch(() => {}));
        } else if (activeId === 'page-users' && typeof window.loadUsers === 'function') {
          tasks.push(Promise.resolve(window.loadUsers()).catch(() => {}));
        } else {
          if (typeof window.updateDashboardMetricsOnly === 'function') {
            tasks.push(Promise.resolve(window.updateDashboardMetricsOnly()).catch(() => {}));
          } else if (typeof window.loadDashboard === 'function') {
            tasks.push(Promise.resolve(window.loadDashboard()).catch(() => {}));
          }
          if (typeof window.loadExecutiveBiAnalytics === 'function') {
            tasks.push(Promise.resolve(window.loadExecutiveBiAnalytics()).catch(() => {}));
          }
        }

        if (typeof window.loadAdminNotifications === 'function') {
          tasks.push(Promise.resolve(window.loadAdminNotifications()).catch(() => {}));
        }
        if (typeof window.loadUserNotifications === 'function') {
          tasks.push(Promise.resolve(window.loadUserNotifications()).catch(() => {}));
        }
      }

      if (tasks.length > 0) {
        await Promise.all(tasks);
      }

      state.consecutiveErrors = 0;
      state.intervalMs = DEFAULT_INTERVAL_MS;
      state.lastRefreshedAt = Date.now();
      restoreScrollPositions(scrollSnap);
      return true;
    } catch (_) {
      state.consecutiveErrors += 1;
      state.intervalMs = Math.min(MAX_BACKOFF_MS, DEFAULT_INTERVAL_MS * Math.pow(2, Math.min(2, state.consecutiveErrors)));
      return false;
    } finally {
      state.isRefreshing = false;
    }
  }

  function scheduleNextTick() {
    if (!state.started) return;
    if (state.timerId) clearTimeout(state.timerId);
    state.timerId = setTimeout(() => {
      scheduleIdleWork(async () => {
        await runScopedSilentRefresh();
        scheduleNextTick();
      });
    }, state.intervalMs);
  }

  function start(customIntervalMs) {
    if (Number.isFinite(customIntervalMs) && customIntervalMs >= 10000) {
      state.intervalMs = customIntervalMs;
    }
    if (state.started) return;
    state.started = true;

    if (typeof document !== 'undefined' && document.addEventListener) {
      ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(evt => {
        document.addEventListener(evt, markInteraction, { passive: true });
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          state.hiddenAt = Date.now();
        } else if (document.visibilityState === 'visible' && state.hiddenAt) {
          const hiddenDuration = Date.now() - state.hiddenAt;
          state.hiddenAt = null;
          if (hiddenDuration >= HIDDEN_RELOAD_THRESHOLD_MS) {
            scheduleIdleWork(() => runScopedSilentRefresh());
          }
        }
      });
    }

    scheduleNextTick();
  }

  function stop() {
    state.started = false;
    if (state.timerId) {
      clearTimeout(state.timerId);
      state.timerId = null;
    }
  }

  if (typeof window !== 'undefined') {
    window.SmartAutoRefresh = {
      start,
      stop,
      triggerNow: runScopedSilentRefresh,
      shouldSkipRefresh,
      markInteraction,
      getState: () => ({ ...state })
    };

    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          if (hasActiveSession()) start();
        });
      } else if (hasActiveSession()) {
        start();
      }
    }
  }
})();
