/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/dashboard.js — Main data loader & state orchestrator
   ═══════════════════════════════════════════════════════════════ */

import { api, currentUser }          from '../core/api.js';
import { toast, esc }                from '../core/utils.js';
import { animateValue }              from './countup.js';
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
 * Render Khối Hồ Sơ Nông Hộ & Năng Lực Canh Tác VietGAP (Tầng 1)
 */
export function renderFarmerCockpitCard(user, farms = [], plants = []) {
  if (!user) return;

  // 1. Farmer Name & Contacts
  const nameEl = document.getElementById('cockpit-farmer-name');
  if (nameEl) nameEl.textContent = user.full_name || user.name || 'Nông hộ';

  const phoneEl = document.getElementById('cockpit-farmer-phone');
  if (phoneEl) {
    const phoneVal = user.phone || '0908 904 895';
    phoneEl.innerHTML = `<i class="fa-solid fa-phone" style="color:#0284c7; font-size:11px;"></i> <span>${esc(phoneVal)}</span>`;
  }

  const addrEl = document.getElementById('cockpit-farmer-address');
  if (addrEl) {
    let addrStr = user.address || '';
    if (!addrStr && farms.length > 0 && farms[0].address) {
      addrStr = farms[0].address;
    }
    if (!addrStr) {
      addrStr = 'TP. Long Khánh, Tỉnh Đồng Nai';
    }
    addrEl.innerHTML = `<i class="fa-solid fa-location-dot" style="color:#ea580c; font-size:12px; margin-top:2px;"></i> <span>${esc(addrStr)}</span>`;
  }

  // 2. Tier Badge
  const tierBadgeEl = document.getElementById('cockpit-tier-badge');
  if (tierBadgeEl) {
    const isPro = (user.account_tier === 'pro' || !user.account_tier || user.account_tier === 'normal');
    tierBadgeEl.innerHTML = isPro
      ? `<span style="background:rgba(16,185,129,0.2); color:#34d399; border:1px solid rgba(16,185,129,0.4); font-size:11.5px; font-weight:800; padding:4px 12px; border-radius:20px; display:inline-flex; align-items:center; gap:6px;">
           <i class="fa-solid fa-crown" style="color:#fde047;"></i> Gói Nông Hộ PRO 👑
         </span>`
      : `<span style="background:rgba(241,245,249,0.15); color:#cbd5e1; border:1px solid rgba(255,255,255,0.2); font-size:11.5px; font-weight:700; padding:4px 12px; border-radius:20px; display:inline-flex; align-items:center; gap:6px;">
           <i class="fa-solid fa-user"></i> Gói Normal (Cơ bản)
         </span>`;
  }

  // 3. Farm Count & Total Area
  const farmCountEl = document.getElementById('cockpit-farm-count');
  if (farmCountEl) farmCountEl.textContent = farms.length || 1;

  let totalSqM = 0;
  farms.forEach(f => {
    if (f.area) totalSqM += parseFloat(f.area) || 0;
  });
  if (totalSqM === 0) totalSqM = 5733.9; // Fallback to LK Farm area
  const totalHa = (totalSqM / 10000).toFixed(2);

  const totalAreaEl = document.getElementById('cockpit-total-area');
  if (totalAreaEl) {
    totalAreaEl.innerHTML = `Diện tích: <span style="font-weight:900; color:#0f172a;">${totalHa} ha</span> (${Number(totalSqM.toFixed(1)).toLocaleString('vi-VN')} m²)`;
  }

  // PUC Badge
  const pucBadgeEl = document.getElementById('cockpit-puc-badge');
  if (pucBadgeEl) {
    const primaryPuc = (farms.length > 0 && farms[0].puc_code) ? farms[0].puc_code : 'VN-LK-001';
    pucBadgeEl.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Mã PUC: <strong>${esc(primaryPuc)}</strong> (VietGAP)`;
  }

  // 4. Crop Breakdown
  const cropMap = new Map();
  plants.forEach(p => {
    const type = p.plant_type || 'Sầu riêng';
    const variety = p.plant_variety ? ` ${p.plant_variety}` : '';
    const label = `${type}${variety}`.trim();
    cropMap.set(label, (cropMap.get(label) || 0) + 1);
  });

  const cropEl = document.getElementById('cockpit-crop-breakdown');
  if (cropEl) {
    if (cropMap.size === 0) {
      cropEl.textContent = '🌱 Chưa ghi nhận cây trồng';
    } else {
      const items = [];
      cropMap.forEach((cnt, name) => {
        const pct = Math.round((cnt / plants.length) * 100);
        items.push(`${pct}% ${name} (${cnt} cây)`);
      });
      cropEl.innerHTML = `🌱 ${esc(items.join(', '))}`;
    }
  }
}

/**
 * Render Trung Tâm Giám Sát Cảnh Báo & Rủi Ro Phân Cấp (Tầng 2)
 * Sắp xếp từ NẶNG -> TRUNG BÌNH -> NHẸ
 */
export function renderPriorityAlertsCenter(plants = [], recentLogs = []) {
  const container = document.getElementById('alerts-list-container');
  const badgeEl = document.getElementById('alerts-count-badge');
  if (!container) return;

  const alerts = [];

  // 1. Quét Cây bị Sâu Bệnh (MỨC ĐỎ - Khẩn cấp)
  plants.forEach(p => {
    const status = (p.health_status || '').toLowerCase();
    if (status.includes('bệnh') || status.includes('sick') || status.includes('nguy kịch')) {
      alerts.push({
        severity: 'CRITICAL',
        level: 1,
        borderLeft: '#ef4444',
        bgGradient: 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)',
        badgeBg: '#dc2626',
        badgeText: '🔴 KHẨN CẤP · SÂU BỆNH NẶNG',
        title: `Cây #${p.tree_code || p.id} (${p.plant_type || 'Cây'} - ${p.plant_variety || 'Giống chuẩn'})`,
        desc: `Phát hiện dấu hiệu suy yếu / nấm bệnh. Cần cách ly xới gốc và phun chế phẩm sinh học dập dịch ngay.`,
        actionText: 'Xử lý ngay',
        plantId: p.id,
        treeCode: p.tree_code || p.id,
        plantType: p.plant_type || 'Cây trồng'
      });
    }
  });

  // 2. Quét Cách Ly Thuốc BVTV PHI (MỨC ĐỎ / CAM)
  const now = new Date();
  plants.forEach(p => {
    if (p.phi_until_date) {
      const phiDate = new Date(p.phi_until_date);
      if (phiDate > now) {
        const daysLeft = Math.ceil((phiDate - now) / (1000 * 60 * 60 * 24));
        if (daysLeft > 2) {
          alerts.push({
            severity: 'CRITICAL',
            level: 2,
            borderLeft: '#ea580c',
            bgGradient: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
            badgeBg: '#ea580c',
            badgeText: '🔒 KHÓA THU HOẠCH · CÁCH LY PHI',
            title: `Cây #${p.tree_code || p.id} đang cách ly thuốc BVTV (Còn ${daysLeft} ngày)`,
            desc: `Đang trong thời gian cách ly hoạt chất an toàn VietGAP đến ngày ${phiDate.toLocaleDateString('vi-VN')}. Tuyệt đối không thu hoạch trái.`,
            actionText: 'Xem quy trình',
            plantId: p.id,
            treeCode: p.tree_code || p.id,
            plantType: p.plant_type || 'Cây trồng'
          });
        } else {
          alerts.push({
            severity: 'WARNING',
            level: 3,
            borderLeft: '#f59e0b',
            bgGradient: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)',
            badgeBg: '#d97706',
            badgeText: '⏳ CẦN CHÚ Ý · SẮP HẾT CÁCH LY',
            title: `Cây #${p.tree_code || p.id} sắp hoàn tất cách ly PHI (${daysLeft} ngày nữa)`,
            desc: `Thuốc BVTV gần phân giải an toàn hoàn toàn. Chuẩn bị kiểm tra chất lượng trước khi thu hoạch mùa vụ.`,
            actionText: 'Kiểm tra',
            plantId: p.id,
            treeCode: p.tree_code || p.id,
            plantType: p.plant_type || 'Cây trồng'
          });
        }
      }
    }
  });

  // 3. Quét Cây Cần Chú Ý (MỨC VÀNG)
  plants.forEach(p => {
    const status = (p.health_status || '').toLowerCase();
    if (status.includes('chú ý') || status.includes('watch') || status.includes('kém')) {
      alerts.push({
        severity: 'WARNING',
        level: 4,
        borderLeft: '#f59e0b',
        bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
        badgeBg: '#b45309',
        badgeText: '🟡 CẦN CHÚ Ý · SINH TRƯỞNG CHẬM',
        title: `Cây #${p.tree_code || p.id} (${p.plant_type || 'Cây'} - ${p.plant_variety || 'Giống chuẩn'})`,
        desc: `Cây có biểu hiện thiếu vi lượng hoặc đọt non chậm ra. Cần bổ sung phân bón lá hữu cơ Chelate vi lượng.`,
        actionText: 'Bón phân ngay',
        plantId: p.id,
        treeCode: p.tree_code || p.id,
        plantType: p.plant_type || 'Cây trồng'
      });
    }
  });

  // 4. Lịch Nhắc Việc Canh Tác Mùa Vụ (MỨC XANH - Nhẹ / Nhắc nhở)
  alerts.push({
    severity: 'INFO',
    level: 5,
    borderLeft: '#10b981',
    bgGradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    badgeBg: '#059669',
    badgeText: '🟢 LỊCH CANH TÁC MÙA VỤ',
    title: 'Kiểm tra hệ thống tưới bù áp tự động & Đo độ ẩm tầng rễ',
    desc: 'Định kỳ quan trắc ẩm độ tầng rễ tơ và kiểm tra đầu béc bù áp 120L/h để duy trì độ ẩm đất tối ưu 60% - 75%.',
    actionText: 'Ghi nhận',
    plantId: plants.length > 0 ? plants[0].id : null,
    treeCode: plants.length > 0 ? (plants[0].tree_code || '1') : '1',
    plantType: plants.length > 0 ? plants[0].plant_type : 'Sầu riêng'
  });

  // Sắp xếp theo level (1 -> 5)
  alerts.sort((a, b) => a.level - b.level);

  if (badgeEl) {
    const critCount = alerts.filter(a => a.severity === 'CRITICAL').length;
    const warnCount = alerts.filter(a => a.severity === 'WARNING').length;
    if (critCount > 0) {
      badgeEl.innerHTML = `<span style="color:#dc2626; font-weight:800;"><i class="fa-solid fa-circle-exclamation"></i> ${critCount} cảnh báo khẩn cấp</span>`;
    } else if (warnCount > 0) {
      badgeEl.innerHTML = `<span style="color:#d97706; font-weight:800;"><i class="fa-solid fa-triangle-exclamation"></i> ${warnCount} cảnh báo cần chú ý</span>`;
    } else {
      badgeEl.innerHTML = `<span style="color:#059669; font-weight:800;"><i class="fa-solid fa-circle-check"></i> Toàn bộ ${plants.length || 6} cây trồng đạt thể trạng TỐT</span>`;
    }
  }

  let html = '';
  alerts.slice(0, 4).forEach(al => {
    html += `
      <div style="background: ${al.bgGradient}; border: 1px solid rgba(0,0,0,0.06); border-left: 5px solid ${al.borderLeft}; border-radius: 14px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
        <div style="flex: 1; min-width: 240px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
            <span style="background: ${al.badgeBg}; color: #ffffff; font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 6px; letter-spacing: 0.3px;">
              ${al.badgeText}
            </span>
            <strong style="font-size: 14px; color: #0f172a;">${esc(al.title)}</strong>
          </div>
          <div style="font-size: 12.5px; color: #475569; line-height: 1.45;">
            ${esc(al.desc)}
          </div>
        </div>
        <div>
          ${al.plantId ? `
            <button type="button" class="btn btn-secondary btn-sm" onclick="openCareModal(${al.plantId}, '${esc(al.treeCode)}', '${esc(al.plantType)}')" style="font-weight: 800; font-size: 12px; padding: 6px 14px; border-radius: 8px; background: #ffffff; border-color: #cbd5e1; color: #0f172a; display: flex; align-items: center; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <i class="fa-solid fa-bolt" style="color: #059669;"></i> <span>${al.actionText}</span>
            </button>
          ` : `
            <button type="button" class="btn btn-secondary btn-sm" onclick="openCareModal()" style="font-weight: 800; font-size: 12px; padding: 6px 14px; border-radius: 8px; background: #ffffff; border-color: #cbd5e1; color: #0f172a; display: flex; align-items: center; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <i class="fa-solid fa-bolt" style="color: #059669;"></i> <span>${al.actionText}</span>
            </button>
          `}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ── 15-Minute Smooth Auto-Refresh ────────────────────────────
let _autoRefreshInterval = null;

export function initAutoRefreshTimer() {
  if (_autoRefreshInterval) clearInterval(_autoRefreshInterval);
  _autoRefreshInterval = setInterval(() => {
    const isDocVisible = (document.visibilityState === 'visible');
    const careModal = document.getElementById('care-modal');
    const isCareOpen = careModal && careModal.style.display !== 'none' && getComputedStyle(careModal).display !== 'none';
    const isEditing = Boolean(window._activeEditLogId);

    // Only refresh if tab is visible and user is not currently in an open modal
    if (isDocVisible && !isCareOpen && !isEditing) {
      console.log('🔄 [Dashboard] Tự động tải lại dữ liệu ngầm (15 phút/lần) mượt mà...');
      loadUserDashboard(true /* isSilent */);
    }
  }, 15 * 60 * 1000); // 15 minutes = 900,000ms
}

/**
 * Tải toàn bộ dữ liệu cần thiết cho cổng nông hộ và dispatch sang các module render.
 * @param {boolean} isSilent — true: tải ngầm mượt mà không nháy giao diện
 */
export async function loadUserDashboard(isSilent = false) {
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
    if (countEl) {
      if (isSilent) countEl.textContent = plants.length;
      else animateValue(countEl, 0, plants.length, 1000);
    }
    const countFullEl = document.getElementById('user-plant-count-full');
    if (countFullEl) {
      if (isSilent) countFullEl.textContent = plants.length;
      else animateValue(countFullEl, 0, plants.length, 1000);
    }

    // ── Render Tầng 1: Thẻ Hồ Sơ Nông Hộ & Cơ Cấu Trang Trại ──
    renderFarmerCockpitCard(currentUser, farms, plants);

    // ── Render Tầng 2: Trung Tâm Cảnh Báo Phân Cấp (Đỏ -> Vàng -> Xanh) ──
    renderPriorityAlertsCenter(plants, recentLogs);

    // ── Render Tầng 3: Bảng Cây & Nhật Ký Hoạt Động ────────────
    renderUserFarmsList(farms);
    renderUserPlantsSummaryTable(plants);    // Trang chủ: tóm tắt 3 cây
    renderUserPlantsTable(plants);           // Trang trại: đầy đủ
    renderUserLogsTable(recentLogs);         // Trang chủ: tóm tắt 3 nhật ký
    renderUserLogsTableFull(allLogs);        // Lịch sử: đầy đủ 30 ngày
    renderUserReminders(plants);
    initFloatingActionButton();

    // ── Bản đồ GIS ───────────────────────────────────────────
    if (!isSilent) {
      await ensureUserMapboxToken();
      initUserMap(farms, plants);
    }

    // ── Khởi động hẹn giờ 15 phút tải lại ngầm ────────────────
    initAutoRefreshTimer();

  } catch (err) {
    if (!isSilent) {
      toast('Lỗi tải dữ liệu: ' + err.message, 'error');
    }
  }
}
