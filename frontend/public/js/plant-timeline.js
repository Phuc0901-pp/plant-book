// Modular Plant Public Timeline & Agronomic Calculators
function getFertilizerName(details) {
  return (details.supply_name || details.fertilizer_name || details.fertilizer || details.foliar_nutrition || details.type || details.product_name || details.name || '').trim();
}

function getPesticideName(details) {
  return (details.supply_name || details.pesticide_name || details.pesticide || details.type || details.product_name || details.name || '').trim();
}

function getQuantity(details) {
  const q = details.quantity ?? details.amount ?? details.qty ?? details.dosage ?? details.volume ?? details.water_volume ?? details.cut_count ?? details.yield_kg;
  return (q !== undefined && q !== null && q !== '') ? q : '';
}

function getUnit(details, defaultUnit = '') {
  return details.unit || details.package_unit || defaultUnit;
}

// Helper: Get structured text from care logs
function getCareLogSummary(log) {
  const details = log.details || {};
  const qty = getQuantity(details);
  const unit = getUnit(details, log.log_type === 'Tưới nước' ? 'm³' : 'kg');
  const method = details.method || (log.equipment_used ? log.equipment_used : 'Tự động');

  if (log.log_type === 'Tưới nước') {
    const qtyStr = qty ? `${qty} ${unit}` : (details.water_liters ? `${details.water_liters} Lít` : 'Định mức tiêu chuẩn');
    const costStr = details.total_cost ? ` (Chi phí: ${Number(details.total_cost).toLocaleString('vi-VN')} đ)` : '';
    return `Đã tưới nước bằng <strong>${esc(method)}</strong>. Lượng nước: <strong>${esc(qtyStr)}</strong>${costStr}.`;
  }
  if (log.log_type === 'Bón phân') {
    const fertName = getFertilizerName(details) || 'Phân bón chuyên dụng';
    const qtyStr = qty ? `${qty} ${unit}` : 'Định lượng tiêu chuẩn';
    const costStr = details.total_cost ? ` (Chi phí: ${Number(details.total_cost).toLocaleString('vi-VN')} đ)` : '';
    return `Đã bón phân <strong>${esc(fertName)}</strong>. Liều lượng: <strong>${esc(qtyStr)}</strong>${costStr}.`;
  }
  if (log.log_type === 'Phun thuốc') {
    const pestName = getPesticideName(details) || 'Thuốc bảo vệ thực vật';
    const qtyStr = qty ? `${qty} ${unit}` : 'Định lượng';
    const waterStr = details.water_volume ? ` pha với <strong>${esc(details.water_volume)}L</strong> nước` : '';
    return `Đã phun thuốc <strong>${esc(pestName)}</strong>. Liều lượng: <strong>${esc(qtyStr)}</strong>${waterStr}.`;
  }
  if (log.log_type === 'Nhân công') {
    const work = details.work_content || details.activity || 'Thuê nhân công chăm sóc';
    const workersStr = details.workers_count ? ` (${Number(details.workers_count)} người)` : '';
    const costStr = details.cost ? ` · Chi phí: <strong>${Number(details.cost).toLocaleString('vi-VN')} đ</strong>` : '';
    return `Thuê nhân công: <strong>${esc(work)}</strong>${workersStr}${costStr}.`;
  }
  if (log.log_type === 'Cắt lá' || log.log_type === 'Cắt tỉa') {
    const actStr = details.activity || details.reason || 'Cắt tỉa cành/lá định kỳ';
    const qtyStr = qty ? `Số lượng: <strong>${qty} ${unit || 'cành'}</strong>. ` : '';
    return `Đã thực hiện cắt tỉa. ${qtyStr}Nội dung: <strong>${esc(actStr)}</strong>.`;
  }
  if (log.log_type === 'Tỉa hoa') {
    const actStr = details.activity || details.reason || 'Tỉa bớt nụ còi / trái non';
    const qtyStr = qty ? `Số lượng: <strong>${qty} ${unit || 'bông/trái'}</strong>. ` : '';
    return `Đã tỉa hoa/quả. ${qtyStr}Nội dung: <strong>${esc(actStr)}</strong>.`;
  }
  if (log.log_type === 'Thụ phấn') {
    return `Đã thụ phấn chéo ban đêm. Tỷ lệ tiếp nhận phấn: <strong>${esc(details.pollination_rate || '95%')}</strong>.`;
  }
  if (log.log_type === 'Thu hoạch') {
    const yieldKg = details.yield_kg || qty || '—';
    const fruitCount = details.fruit_count ? ` (${details.fruit_count} trái)` : '';
    const revStr = details.total_revenue ? ` · Doanh thu: <strong>${Number(details.total_revenue).toLocaleString('vi-VN')} đ</strong>` : '';
    const batchStr = log.batch_code || details.batch_code ? ` · Mã Lô VietGAP: <strong>${esc(log.batch_code || details.batch_code)}</strong>` : '';
    return `Đã thu hoạch: <strong>${esc(yieldKg)} kg</strong>${fruitCount}${revStr}${batchStr}.`;
  }
  if (log.log_type === 'Bệnh cây') {
    const sevIcon = details.severity === 'Nghiêm trọng' 
      ? '<i data-lucide="alert-octagon" class="lucide-xs" style="color:#dc2626; vertical-align:-2px;"></i>' 
      : (details.severity === 'Trung bình' 
          ? '<i data-lucide="alert-triangle" class="lucide-xs" style="color:#ea580c; vertical-align:-2px;"></i>' 
          : '<i data-lucide="alert-circle" class="lucide-xs" style="color:#d97706; vertical-align:-2px;"></i>');
    return `<span style="color:var(--color-disease);font-weight:700">${sevIcon} ${esc(details.disease_name || 'Bệnh chưa xác định')}</span>${details.description ? '<br><span style="color:var(--text-secondary);font-size:12px">' + esc(details.description) + '</span>' : ''}`;
  }
  return esc(log.note || '');
}

// ── Timeline Pagination & Rendering Helpers ──────────────────

function getShortSummary(log) {
  const details = log.details || {};
  const qty = getQuantity(details);
  const unit = getUnit(details, log.log_type === 'Tưới nước' ? 'm³' : 'kg');

  if (log.log_type === 'Tưới nước') {
    const method = details.method || (log.equipment_used ? 'Béc bù áp IoT' : 'Thủ công');
    const qtyStr = qty ? `${qty} ${unit}` : (details.water_liters ? `${details.water_liters}L` : 'Định mức chuẩn');
    return `Tưới nước bằng ${esc(method)} (${esc(qtyStr)})`;
  }
  if (log.log_type === 'Bón phân') {
    const fertName = getFertilizerName(details) || 'Phân bón';
    const qtyStr = qty ? `${qty} ${unit}` : '';
    return `Bón ${esc(fertName)}${qtyStr ? ` — (${esc(qtyStr)})` : ''}`;
  }
  if (log.log_type === 'Phun thuốc') {
    const pestName = getPesticideName(details) || 'Thuốc BVTV';
    const qtyStr = qty ? ` (Liều: ${qty} ${unit})` : '';
    return `Phun ${esc(pestName)}${esc(qtyStr)}`;
  }
  if (log.log_type === 'Cắt lá' || log.log_type === 'Cắt tỉa') {
    const actStr = details.activity || details.reason || 'Cắt tỉa tán';
    return `${esc(actStr)}${qty ? ` (${qty} cành)` : ''}`;
  }
  if (log.log_type === 'Tỉa hoa') {
    const actStr = details.activity || details.reason || 'Tỉa hoa/quả';
    return `${esc(actStr)}${qty ? ` (${qty} trái)` : ''}`;
  }
  if (log.log_type === 'Thụ phấn') {
    return `Thụ phấn hoa chéo ban đêm (${esc(details.pollination_rate || 'Đạt 95%')})`;
  }
  if (log.log_type === 'Thu hoạch') {
    const yieldKg = details.yield_kg || qty || '';
    const fruitCount = details.fruit_count ? ` · ${details.fruit_count} trái` : '';
    return `Thu hoạch ${yieldKg ? yieldKg + ' kg' : ''}${fruitCount} — Mã Lô: ${esc(log.batch_code || details.batch_code || 'VietGAP')}`;
  }
  if (log.log_type === 'Bệnh cây') {
    const sevIcon = details.severity === 'Nghiêm trọng' 
      ? '<i data-lucide="alert-octagon" class="lucide-xs" style="color:#dc2626; vertical-align:-2px;"></i>' 
      : (details.severity === 'Trung bình' 
          ? '<i data-lucide="alert-triangle" class="lucide-xs" style="color:#ea580c; vertical-align:-2px;"></i>' 
          : '<i data-lucide="alert-circle" class="lucide-xs" style="color:#d97706; vertical-align:-2px;"></i>');
    return `${sevIcon} Phát hiện bệnh: ${esc(details.disease_name || 'Bệnh chưa xác định')}`;
  }
  return esc(log.note || '').slice(0, 50) + (log.note && log.note.length > 50 ? '...' : '');
}

function _renderTimelineItemHtml(log) {
  let markerClass = '';
  let tagClass = 'tag-general';
  let icon = 'edit-3';
  let chibiKey = '';
  
  if (log.log_type === 'Tưới nước') {
    markerClass = 'marker-water';
    tagClass = 'tag-water';
    icon = 'droplets';
    chibiKey = 'chibi-water';
  } else if (log.log_type === 'Bón phân') {
    markerClass = 'marker-fertilize';
    tagClass = 'tag-fertilize';
    icon = 'leaf';
    chibiKey = 'chibi-fertilize';
  } else if (log.log_type === 'Phun thuốc') {
    markerClass = 'marker-pesticide';
    tagClass = 'tag-pesticide';
    icon = 'flask-conical';
    chibiKey = 'chibi-pesticide';
  } else if (log.log_type === 'Nhân công') {
    markerClass = 'marker-water';
    tagClass = 'tag-water';
    icon = 'users';
    chibiKey = 'chibi-labor';
  } else if (log.log_type === 'Cắt lá' || log.log_type === 'Cắt tỉa') {
    markerClass = 'marker-leaf';
    tagClass = 'tag-leaf';
    icon = 'scissors';
    chibiKey = 'chibi-labor';
  } else if (log.log_type === 'Tỉa hoa') {
    markerClass = 'marker-flower';
    tagClass = 'tag-flower';
    icon = 'flower';
    chibiKey = 'chibi-labor';
  } else if (log.log_type === 'Thụ phấn') {
    markerClass = 'marker-flower';
    tagClass = 'tag-flower';
    icon = 'sparkles';
    chibiKey = 'chibi-fertilize';
  } else if (log.log_type === 'Thu hoạch') {
    markerClass = 'marker-fertilize';
    tagClass = 'tag-fertilize';
    icon = 'wheat';
    chibiKey = 'chibi-harvest';
  } else if (log.log_type === 'Bệnh cây') {
    markerClass = 'marker-disease';
    tagClass = 'tag-disease';
    icon = 'bug';
    chibiKey = 'chibi-disease';
  }
  
  const timeVal = (log.details && log.details.performed_at) ? log.details.performed_at : log.created_at;
  const fullDateTime = fmtDateTime(timeVal);

  let mediaUrls = [];
  if (log.media_urls) {
    if (Array.isArray(log.media_urls)) {
      mediaUrls = log.media_urls;
    } else if (typeof log.media_urls === 'string') {
      try { mediaUrls = JSON.parse(log.media_urls); } catch(_) { mediaUrls = []; }
    }
  }
  if ((!mediaUrls || mediaUrls.length === 0) && log.media_url) {
    mediaUrls = [{ url: log.media_url, type: (/\.(mp4|mov|avi|mkv|webm)/i.test(log.media_url) ? 'video' : 'image') }];
  }
  if ((!mediaUrls || mediaUrls.length === 0) && log.details && log.details.media_urls) {
    mediaUrls = Array.isArray(log.details.media_urls) ? log.details.media_urls : [];
  }
  // Smart correlation fallback: If mediaUrls is empty and currentPlantData has media gallery items
  if ((!mediaUrls || mediaUrls.length === 0) && currentPlantData && Array.isArray(currentPlantData.media) && currentPlantData.media.length > 0) {
    const logDateStr = log.log_date ? new Date(log.log_date).toISOString().slice(0, 10) : '';
    if (log.log_type === 'Bệnh cây') {
      const matched = currentPlantData.media.filter(m => {
        const cap = (m.caption || '').toLowerCase();
        const mDateStr = m.uploaded_at ? new Date(m.uploaded_at).toISOString().slice(0, 10) : '';
        return cap.includes('bệnh cây') || (logDateStr && mDateStr === logDateStr);
      });
      if (matched.length > 0) {
        mediaUrls = matched.map(m => ({ url: m.url, type: m.media_type || (/\.(mp4|mov|avi|mkv|webm)/i.test(m.url) ? 'video' : 'image') }));
      }
    }
  }

  const mediaBadge = mediaUrls.length > 0 ? `
    <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#0369a1;background:#f0f9ff;border:1px solid #bae6fd;padding:2px 7px;border-radius:6px;margin-left:6px;" title="${mediaUrls.length} tệp đính kèm">
      <i data-lucide="camera" class="lucide-xs"></i> ${mediaUrls.length} ảnh/video
    </span>` : '';

  const mediaThumbs = mediaUrls.length > 0 ? `
    <div class="log-media-gallery">
      <div style="width:100%;font-size:11.5px;font-weight:700;color:#475569;margin-bottom:2px;display:flex;align-items:center;gap:4px;">
        <i data-lucide="paperclip" class="lucide-xs" style="color:#059669;"></i> Minh chứng hình ảnh & video thực địa (${mediaUrls.length}):
      </div>
      ${mediaUrls.map(m => {
        const url = (typeof m === 'object' && m !== null) ? (m.url || '') : String(m || '');
        if (!url) return '';
        const isVideo = (typeof m === 'object' && (m.type === 'video' || m.media_type === 'video')) || /\.(mp4|mov|avi|mkv|webm)/i.test(url);
        return isVideo
          ? `<div class="log-media-item" onclick="openLightbox('${esc(url)}','video')" title="Bấm để phát video"><video src="${esc(url)}" muted preload="metadata"></video><div class="video-play-icon"><i data-lucide="play-circle" class="lucide-sm"></i></div></div>`
          : `<div class="log-media-item" onclick="openLightbox('${esc(url)}','image')" title="Bấm để phóng to ảnh"><img src="${esc(url)}" alt="ảnh nhật ký" loading="lazy"></div>`;
      }).join('')}
    </div>` : '';

  const noteHtml = log.note
    ? `<div class="log-body" style="margin-top: 6px; color: var(--text-secondary); font-size:12px;"><i data-lucide="message-circle" class="lucide-sm"></i> ${esc(log.note)}</div>`
    : '';

  return `
    <div class="timeline-item">
      <div class="timeline-marker ${markerClass}"></div>
      <div class="timeline-content" onclick="toggleTimelineItem(event, this)">
        <div class="log-header">
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">
            <span class="log-tag ${tagClass}">${(chibiKey && window.ChibiIcons) ? window.ChibiIcons.get(chibiKey, 18) : `<i data-lucide="${icon}" class="lucide-xs"></i>`} ${esc(log.log_type || 'Ghi chú')}</span>
            ${mediaBadge}
          </div>
          <div class="log-header-right">
            <span class="log-time-indicator"><i data-lucide="clock" class="lucide-sm"></i> ${fullDateTime}</span>
            <i data-lucide="chevron-down" class="toggle-arrow lucide-sm"></i>
          </div>
        </div>
        <div class="log-short-preview" style="font-size: 13px; color: var(--text-secondary); margin-top: 6px; font-weight: 500;">
          ${getShortSummary(log)}
        </div>
        <div class="timeline-details">
          <div class="log-body">
            ${getCareLogSummary(log)}
          </div>
          ${noteHtml}
          ${mediaThumbs}
        </div>
      </div>
    </div>
  `;
}

function renderPublicLogTimeline(page = 1, expanded = false) {
  const container = document.getElementById('public-timeline-container');
  const paginationBox = document.getElementById('public-timeline-pagination');
  if (!container) return;

  const dates = window._publicLogDates || [];
  if (dates.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 0; color: var(--text-muted);">
        <i data-lucide="clipboard" class="lucide-sm" style="font-size: 32px; margin-bottom: 12px;"></i>
        <p style="font-size: 13px;">Cây chưa có ghi chép nhật ký nào.</p>
      </div>
    `;
    if (paginationBox) paginationBox.style.display = 'none';
    return;
  }

  let visibleDates = [];
  if (!expanded) {
    // Mode 1: Default summary (3 days most recent)
    visibleDates = dates.slice(0, 3);
  } else {
    // Mode 2: Expanded with pagination (5 days per page)
    const totalPages = Math.ceil(dates.length / window._publicLogPageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    window._publicLogCurrentPage = page;

    const startIdx = (page - 1) * window._publicLogPageSize;
    const endIdx = startIdx + window._publicLogPageSize;
    visibleDates = dates.slice(startIdx, endIdx);
  }

  const groups = window._publicLogsGrouped;
  
  container.innerHTML = `
    <div class="timeline">
      ${visibleDates.map(date => `
        <div class="timeline-group">
          <div class="timeline-date">${date}</div>
          ${groups[date].map(log => _renderTimelineItemHtml(log)).join('')}
        </div>
      `).join('')}
    </div>
  `;

  // Render Pagination / Expand Controls Box
  if (paginationBox) {
    const totalDatesCount = dates.length;
    if (!expanded) {
      if (totalDatesCount > 3) {
        paginationBox.style.display = 'flex';
        paginationBox.innerHTML = `
          <div style="width:100%; text-align:center; margin-top:16px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="togglePublicLogExpand(true)" style="padding:10px 20px; font-weight:700; border-radius:10px; background:rgba(255,255,255,0.08); border:1.5px solid var(--green-bright); color:var(--green-bright); box-shadow:0 2px 6px rgba(0,0,0,0.2); cursor:pointer;">
              <i data-lucide="clipboard-check" class="lucide-sm"></i> Xem tất cả nhật ký (Tổng ${totalDatesCount} ngày canh tác)
            </button>
          </div>
        `;
      } else {
        paginationBox.style.display = 'none';
      }
    } else {
      const totalPages = Math.ceil(dates.length / window._publicLogPageSize) || 1;
      const curPage = window._publicLogCurrentPage;
      paginationBox.style.display = 'flex';
      paginationBox.innerHTML = `
        <div style="width:100%; display:flex; flex-direction:column; align-items:center; gap:12px; margin-top:16px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex; align-items:center; gap:10px;">
            <button type="button" class="btn btn-secondary btn-xs" ${curPage <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : `onclick="changePublicLogPage(${curPage - 1})"`} style="padding:6px 14px; font-size:12px; font-weight:700; cursor:pointer;">
              <i data-lucide="chevron-left" class="lucide-sm"></i> Trang trước
            </button>
            <span style="font-size:12px; font-weight:700; color:var(--text-secondary); background:rgba(255,255,255,0.05); padding:6px 14px; border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
              Trang ${curPage} / ${totalPages} (${totalDatesCount} ngày)
            </span>
            <button type="button" class="btn btn-secondary btn-xs" ${curPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : `onclick="changePublicLogPage(${curPage + 1})"`} style="padding:6px 14px; font-size:12px; font-weight:700; cursor:pointer;">
              Trang tiếp <i data-lucide="chevron-right" class="lucide-sm"></i>
            </button>
          </div>
          <button type="button" class="btn btn-link btn-xs" onclick="togglePublicLogExpand(false)" style="font-size:12px; color:var(--text-secondary); font-weight:600; text-decoration:none; cursor:pointer; background:none; border:none; margin-top:4px;">
            <i data-lucide="minimize-2" class="lucide-sm"></i> Thu gọn về 3 ngày gần nhất
          </button>
        </div>
      `;
    }
  }
  if (window.lucide) lucide.createIcons();
}

window.togglePublicLogExpand = function(expanded) {
  window._publicLogIsExpanded = expanded;
  renderPublicLogTimeline(1, expanded);
};

window.changePublicLogPage = function(page) {
  renderPublicLogTimeline(page, true);
};

// Helper: Calculate PHI Quarantine status from pesticide logs
function calculatePlantPhiStatus(plant) {
  const logs = plant.logs || [];
  const now = new Date();
  let maxExpiry = null;
  let lastPestName = '';

  logs.forEach(log => {
    if (log.log_type === 'Phun thuốc' && log.details) {
      const phiDays = parseInt(log.details.phi_days) || parseInt(log.details.phi) || 14;
      const logDate = new Date(log.log_date || log.created_at);
      if (!isNaN(logDate.getTime())) {
        const expiryDate = new Date(logDate.getTime() + phiDays * 24 * 60 * 60 * 1000);
        if (!maxExpiry || expiryDate > maxExpiry) {
          maxExpiry = expiryDate;
          lastPestName = log.details.supply_name || log.details.pesticide_name || log.details.pesticide || 'Thuốc BVTV';
        }
      }
    }
  });

  if (!maxExpiry) {
    return {
      isSafe: true,
      daysRemaining: 0,
      text: 'An Toàn Thu Hoạch',
      subtext: '0 ngày cách ly PHI · Đạt chuẩn sạch',
      badgeClass: 'badge-tot'
    };
  }

  const diffMs = maxExpiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return {
      isSafe: false,
      daysRemaining: diffDays,
      text: `Cách ly PHI: Còn ${diffDays} ngày`,
      subtext: `Đang cách ly (${esc(lastPestName)}) — Không thu hoạch`,
      badgeClass: 'badge-chuyi'
    };
  }

  return {
    isSafe: true,
    daysRemaining: 0,
    text: 'An Toàn Thu Hoạch',
    subtext: `Hết thời gian cách ly (${esc(lastPestName)})`,
    badgeClass: 'badge-tot'
  };
}

// Helper: Calculate tree age in years/months
function calculateTreeAge(plantingDate) {
  if (!plantingDate) return null;
  const d = new Date(plantingDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const years = (now - d) / (1000 * 60 * 60 * 24 * 365.25);
  if (years < 1) {
    const months = Math.max(1, Math.round((now - d) / (1000 * 60 * 60 * 24 * 30.4)));
    return `${months} tháng tuổi`;
  }
  return `${years.toFixed(1)} năm tuổi`;
}

