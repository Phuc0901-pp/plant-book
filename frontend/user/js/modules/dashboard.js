/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/dashboard.js — Main data loader & state orchestrator
   ═══════════════════════════════════════════════════════════════ */

import { api, currentUser }          from '../core/api.js';
import { toast }                     from '../core/utils.js';
import { renderUserFarmsList, renderUserPlantsSummaryTable, renderUserPlantsTable, setPlantsCache, setFarmsCache } from './plants.js';
import { renderUserLogsTable, renderUserLogsTableFull, setLogsCache, populateLogFarmFilter } from './logs.js';
import { renderUserReminders }       from './reminders.js';
import { initFloatingActionButton }  from './fab.js';
import { ensureUserMapboxToken, initUserMap } from './map.js';

/**
 * Cache configs dùng chung toàn portal.
 * Được expose lên window._allConfigsCache cho các module con tránh circular import.
 */
let _configsCache = {};

/**
 * Tải toàn bộ dữ liệu cần thiết cho cổng nông hộ và dispatch sang các module render.
 *
 * Parallel fetch: farms + plants + logs(3 ngày) + configs
 * Sequential fetch: logs(30 ngày) — xử lý lỗi gracefully
 */
export async function loadUserDashboard() {
  try {
    const [farms, plants, recentLogs, configs] = await Promise.all([
      api('/farms'),
      api('/plants'),
      api('/plants/logs/recent?days=3'),
      api('/config')
    ]);

    // Tải lịch sử 30 ngày (không chặn nếu lỗi)
    const allLogs = await api('/plants/logs/recent?days=30').catch(err => {
      console.warn('Lỗi tải lịch sử 30 ngày:', err);
      return [];
    });

    // ── Cập nhật cache toàn cục ──────────────────────────────
    _configsCache = configs;
    window._allConfigsCache = configs;   // dùng cho care-modal & reminders
    window._allPlantsCache  = plants;    // dùng cho care-modal

    setPlantsCache(plants);
    setFarmsCache(farms);
    setLogsCache(allLogs);
    populateLogFarmFilter(farms);

    // ── Cập nhật UI Trang chủ ────────────────────────────────
    const nameEl = document.getElementById('welcome-name');
    if (nameEl && currentUser) {
      nameEl.textContent = currentUser.full_name || currentUser.name || 'nông hộ';
    }

    const countEl = document.getElementById('user-plant-count');
    if (countEl) countEl.textContent = plants.length;
    const countFullEl = document.getElementById('user-plant-count-full');
    if (countFullEl) countFullEl.textContent = plants.length;

    // ── Render tất cả component ──────────────────────────────
    renderUserFarmsList(farms);
    renderUserPlantsSummaryTable(plants);    // Trang chủ: tóm tắt 3 cây
    renderUserPlantsTable(plants);           // Trang trại: đầy đủ
    renderUserLogsTable(recentLogs);         // Trang chủ: tóm tắt 3 nhật ký
    renderUserLogsTableFull(allLogs);        // Lịch sử: đầy đủ 30 ngày
    renderUserReminders(plants);
    initFloatingActionButton();

    // ── Bản đồ GIS ───────────────────────────────────────────
    await ensureUserMapboxToken();
    initUserMap(farms, plants);

  } catch (err) {
    toast('Lỗi tải dữ liệu: ' + err.message, 'error');
  }
}
