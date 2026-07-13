/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/reminders.js — Care reminders, disease alerts, quick care
   ═══════════════════════════════════════════════════════════════ */

import { api }                from '../core/api.js';
import { esc, toast, todayString } from '../core/utils.js';
import { getPlantsCache }     from './plants.js';
import { getLogsCache }       from './logs.js';
import { buildMediaThumbnailsHtml } from './media.js';

// ── Render ────────────────────────────────────────────────────

/**
 * Xây dựng và hiển thị khung nhắc nhở:
 *   1. Cảnh báo đỏ cho cây bệnh (kèm tên bệnh, mức độ, ảnh/video)
 *   2. Thông báo cây chưa tưới hôm nay
 *   3. Thông báo cây chưa bón phân quá 7 ngày
 *
 * @param {Array} plants — danh sách cây trồng từ API
 */
export function renderUserReminders(plants) {
  const container = document.getElementById('reminder-container');
  const countEl   = document.getElementById('reminder-count');
  if (!container) return;

  const today       = todayString();
  const logsCache   = getLogsCache();

  const unwatered   = plants.filter(p => p.last_watered !== today);
  const unfertilized = plants.filter(p => {
    if (!p.last_fertilized) return true;
    const lastFert = new Date(p.last_fertilized + 'T00:00:00');
    const limit    = new Date();
    limit.setDate(limit.getDate() - 7);
    limit.setHours(0, 0, 0, 0);
    return lastFert < limit;
  });

  let reminderCount = 0;
  let html          = '';

  // ── 1. Cảnh báo Cây Bệnh ────────────────────────────────────
  const sickPlants = plants.filter(p => p.health_status === 'Bệnh');
  if (sickPlants.length > 0) {
    reminderCount += sickPlants.length;
    html += `<div style="font-size:11px;font-weight:700;color:#ef4444;text-transform:uppercase;margin-bottom:6px;letter-spacing:0.04em;">
      <i class="fa-solid fa-triangle-exclamation"></i> Phát hiện cây bệnh (${sickPlants.length})
    </div>`;

    sickPlants.forEach(p => {
      const diseaseLog  = logsCache.find(l => l.plant_id === p.id && l.log_type === 'Bệnh cây');
      const details     = diseaseLog?.details || {};
      const diseaseName = details.disease_name || 'Chưa xác định dịch bệnh';
      const severity    = details.severity     || 'Trung bình';
      const mediaHtml   = buildMediaThumbnailsHtml(diseaseLog?.media_urls || [], 50);

      html += `
        <div class="disease-alert-card" style="padding:12px;background:#fef2f2;border:1px solid #fee2e2;border-radius:10px;margin-bottom:8px;box-shadow:0 2px 4px rgba(239,68,68,0.03);">
          <div style="font-size:12px;color:#991b1b;font-weight:700;"><i class="fa-solid fa-triangle-exclamation" style="color:#ef4444; margin-right:4px;"></i> Cây ${esc(p.tree_code || p.id)}: Bị ${esc(diseaseName)}</div>
          <div style="font-size:11px;color:#b91c1c;margin-top:4px;">
            Mức độ: <span class="badge" style="background:#fee2e2;color:#b91c1c;font-size:9px;padding:2px 6px;">${esc(severity)}</span>
            ${diseaseLog?.note ? `<br><span style="color:#7f1d1d;font-style:italic;">"${esc(diseaseLog.note)}"</span>` : ''}
          </div>
          ${mediaHtml}
        </div>`;
    });
  }

  // ── 2. Tưới nước ────────────────────────────────────────────
  if (unwatered.length > 0) {
    reminderCount++;
    const isAll     = unwatered.length === plants.length;
    const alertHtml = isAll
      ? '<i class="fa-solid fa-droplet" style="color:#3b82f6; margin-right:4px;"></i> Chưa tưới cả vườn!'
      : `<i class="fa-solid fa-droplet" style="color:#3b82f6; margin-right:4px;"></i> Cây chưa được tưới: ${unwatered.map(p => p.tree_code || p.id).join(', ')}`;

    html += `
      <div style="padding:10px 12px;background:#eff6ff;border:1px solid #dbeafe;border-radius:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:12px;font-weight:600;color:#1e40af;line-height:1.4;flex:1;padding-right:8px;">${alertHtml}</div>
        ${isAll ? `<button class="btn btn-primary btn-xs" style="background:var(--blue);color:#fff;font-size:10px;padding:4px 8px;border-radius:6px;" onclick="quickCareAll('Tưới nước')">Tưới cả vườn</button>` : ''}
      </div>`;
  }

  // ── 3. Bón phân ─────────────────────────────────────────────
  if (unfertilized.length > 0) {
    reminderCount++;
    const isAll     = unfertilized.length === plants.length;
    const alertHtml = isAll
      ? '<i class="fa-solid fa-flask" style="color:#d97706; margin-right:4px;"></i> Chưa bón phân cả vườn!'
      : `<i class="fa-solid fa-flask" style="color:#d97706; margin-right:4px;"></i> Cây chưa bón phân (quá 7 ngày): ${unfertilized.map(p => p.tree_code || p.id).join(', ')}`;

    html += `
      <div style="padding:10px 12px;background:#fffbeb;border:1px solid #fef3c7;border-radius:10px;margin-bottom:8px;">
        <div style="font-size:12px;font-weight:600;color:#854d0e;line-height:1.4;">${alertHtml}</div>
      </div>`;
  }

  if (countEl) countEl.textContent = `${reminderCount} nhắc nhở`;

  container.innerHTML = reminderCount === 0
    ? '<div class="empty-state" style="padding:16px"><i class="fa-solid fa-circle-check" style="color:var(--green)"></i><p>Tất cả cây đã được chăm sóc đầy đủ hôm nay!</p></div>'
    : html;
}

// ── Quick Care ─────────────────────────────────────────────────

/**
 * Ghi nhanh nhật ký tưới nước cho toàn bộ cây chưa tưới hôm nay.
 * @param {string} logType — 'Tưới nước'
 */
export async function quickCareAll(logType) {
  if (!confirm('Bạn có chắc chắn muốn ghi nhận ĐÃ TƯỚI NƯỚC nhanh cho tất cả cây chưa tưới?')) return;

  const today     = todayString();
  const unwatered = getPlantsCache().filter(p => p.last_watered !== today);
  if (unwatered.length === 0) return;

  toast('Đang ghi nhận chăm sóc cả vườn...');
  try {
    for (const p of unwatered) {
      await api(`/plants/${p.id}/logs`, {
        method: 'POST',
        body: JSON.stringify({
          log_type: logType, log_date: today,
          note: 'Tưới nhanh cả vườn tự động', media_urls: [],
          details: { method: 'Tự động cả vườn', amount: 2, unit: 'lít' }
        })
      });
    }
    toast('Đã ghi nhận chăm sóc cả vườn thành công!');
    if (typeof window.loadUserDashboard === 'function') window.loadUserDashboard();
  } catch (err) {
    toast('Lỗi ghi nhận: ' + err.message, 'error');
  }
}

/**
 * Ghi nhanh nhật ký chăm sóc cho một cây đơn lẻ với thông tin mặc định.
 * @param {number} plantId
 * @param {string} logType — 'Tưới nước' | 'Bón phân'
 */
export async function quickCare(plantId, logType) {
  // Lấy config từ window để tránh circular import
  const configs = window._allConfigsCache || {};
  let details   = {};

  if (logType === 'Tưới nước') {
    const methods = configs.water_methods || [];
    details = { method: methods[0] || 'Tưới tay thủ công', amount: 2, unit: 'lít' };
  } else if (logType === 'Bón phân') {
    const fertilizers = configs.fertilizers || [];
    details = { fertilizer_name: fertilizers[0] || 'Phân NPK 16-16-8', amount: 100, unit: 'gam' };
  }

  try {
    await api(`/plants/${plantId}/logs`, {
      method: 'POST',
      body: JSON.stringify({
        log_type: logType, log_date: todayString(),
        note: 'Ghi nhận nhanh từ Cổng nông hộ',
        media_urls: [], details
      })
    });
    toast(`Đã ghi nhận ${logType} thành công!`);
    if (typeof window.loadUserDashboard === 'function') window.loadUserDashboard();
  } catch (err) {
    toast(`Lỗi ghi nhận: ${err.message}`, 'error');
  }
}
