// Parse Slug info from /:userId/:farmId/:plantId/:nfcUid or /plant/:slug
function getPublicSlugInfoFromUrl() {
  const pathParts = location.pathname.split('/').filter(p => p.length > 0);
  if (pathParts.length === 0) return { slug: '', plantId: '', nfcUid: '' };
  if (pathParts[0] === 'plant') {
    return { slug: decodeURIComponent(pathParts[1] || ''), plantId: decodeURIComponent(pathParts[1] || ''), nfcUid: '' };
  }
  if (pathParts[0] === 'nfc') {
    return { slug: decodeURIComponent(pathParts[1] || ''), plantId: '', nfcUid: decodeURIComponent(pathParts[1] || '') };
  }
  
  // Hierarchical Format: /:userId/:farmId/:plantId/:nfcUid
  if (pathParts.length >= 4) {
    return {
      slug: decodeURIComponent(pathParts[3]), // nfcUid
      plantId: decodeURIComponent(pathParts[2]), // plantId
      nfcUid: decodeURIComponent(pathParts[3])
    };
  }
  if (pathParts.length === 3) {
    return {
      slug: decodeURIComponent(pathParts[2]),
      plantId: decodeURIComponent(pathParts[2]),
      nfcUid: ''
    };
  }
  if (pathParts.length === 2) {
    return {
      slug: decodeURIComponent(pathParts[1]),
      plantId: decodeURIComponent(pathParts[1]),
      nfcUid: ''
    };
  }
  return { slug: decodeURIComponent(pathParts[0]), plantId: decodeURIComponent(pathParts[0]), nfcUid: '' };
}

const slugInfo = getPublicSlugInfoFromUrl();
const slug = slugInfo.slug;
let currentPlantData = null;

// Global Configurations Cache (Default Fallbacks)
let configData = {
  water_methods: ["Tưới tay thủ công", "Tưới nhỏ giọt", "Tưới phun mưa", "Tưới phun sương"],
  fertilizers: ["Phân NPK 16-16-8", "Phân hữu cơ trùn quế", "Phân bón lá Đầu Trâu", "Phân chuồng hoai mục"],
  pesticides: ["Thuốc trừ sâu sinh học", "Thuốc trừ bệnh Anvil", "Thuốc trừ nấm Ridomil Gold", "Chất kích thích sinh trưởng Atonik"],
  leaf_cut_reasons: ["Lá già úa/vàng", "Lá bị sâu bệnh hại", "Tỉa cành tạo tán", "Tỉa bớt lá thông thoáng"],
  flower_prune_reasons: ["Tỉa hoa tàn", "Tỉa bớt nụ còi", "Tỉa cành tạo dáng", "Kích thích ra chồi mới"]
};

// Toggle Custom Input field when "Khác..." is chosen
function toggleCustomInput(prefix) {
  const select = document.getElementById(`${prefix}-select`);
  const custom = document.getElementById(`${prefix}-custom`);
  if (select.value === '__custom__') {
    custom.style.display = 'block';
    custom.required = true;
  } else {
    custom.style.display = 'none';
    custom.required = false;
    custom.value = '';
  }
}

// Open / Close Modal Helpers
function openModal(id) {
  document.getElementById(id).style.display = 'flex';
  document.body.style.overflow = 'hidden';
  
  // Set default datetime to local now in YYYY-MM-DDTHH:mm format
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(now - offset)).toISOString().slice(0, 16);
  
  const dtInput = document.getElementById(id).querySelector('input[type="datetime-local"]');
  if (dtInput) {
    dtInput.value = localISOTime;
  }
}
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
  document.getElementById(id).querySelector('form')?.reset();
  // Reset custom input visibility
  const customInputs = document.getElementById(id).querySelectorAll('input[id$="-custom"]');
  customInputs.forEach(i => i.style.display = 'none');
  
  // Restore body overflow only if there are no other open modals
  const openModals = Array.from(document.querySelectorAll('.modal-overlay')).filter(m => m.style.display === 'flex');
  if (openModals.length === 0) {
    document.body.style.overflow = '';
  }
}
function closeModalOnOuterClick(event, id) {
  if (event.target === document.getElementById(id)) {
    closeModal(id);
  }
}

// Populates a dropdown select with options and appends a "Khác..." option
function populateDropdown(selectId, list, prefix) {
  const select = document.getElementById(selectId);
  let html = list.map(item => `<option value="${esc(item)}">${esc(item)}</option>`).join('');
  html += `<option value="__custom__">➕ Khác...</option>`;
  select.innerHTML = html;
  toggleCustomInput(prefix);
}

// Load configurations from backend API
async function loadConfigurations() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.water_methods) configData.water_methods = data.water_methods;
      if (data.fertilizers) configData.fertilizers = data.fertilizers;
      if (data.pesticides) configData.pesticides = data.pesticides;
      if (data.leaf_cut_reasons) configData.leaf_cut_reasons = data.leaf_cut_reasons;
      if (data.flower_prune_reasons) configData.flower_prune_reasons = data.flower_prune_reasons;
    }
  } catch (err) {
    console.warn('Cannot fetch configurations, using local fallbacks', err);
  }

  // Populate all dropdowns
  populateDropdown('water-method-select', configData.water_methods, 'water-method');
  populateDropdown('fertilizer-select', configData.fertilizers, 'fertilizer');
  populateDropdown('pesticide-select', configData.pesticides, 'pesticide');
  populateDropdown('leaf-reason-select', configData.leaf_cut_reasons, 'leaf-reason');
  populateDropdown('flower-reason-select', configData.flower_prune_reasons, 'flower-reason');
}

// Format Date Utility
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit', year:'numeric'});
}

// Format full DateTime: HH:mm DD/MM/YYYY
function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  const hhmm = dt.toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit', hour12: false});
  const ddmmyyyy = dt.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'});
  return `${hhmm} — ${ddmmyyyy}`;
}

// Escape HTML utility
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Dynamic Crop image loading retry with multiple extensions
function handleCropImageError(img) {
  if (img.getAttribute('data-is-cover') === 'true') {
    fallbackToTreeIcon(img);
    return;
  }
  
  const extensions = ['.jpg', '.jpeg', '.webp', '.png'];
  let extIdx = parseInt(img.getAttribute('data-ext-idx') || '0');
  const base = img.getAttribute('data-base');
  const currentSrc = img.src || '';
  let nextExt = '';
  
  while (extIdx < extensions.length) {
    const ext = extensions[extIdx];
    extIdx++;
    img.setAttribute('data-ext-idx', extIdx);
    if (!currentSrc.endsWith(ext)) {
      nextExt = ext;
      break;
    }
  }
  
  if (nextExt) {
    img.src = base + nextExt;
  } else {
    fallbackToTreeIcon(img);
  }
}

function fallbackToTreeIcon(img) {
  img.style.display = 'none';
  const container = img.parentElement;
  if (container && !container.querySelector('.no-cover-icon')) {
    const iconDiv = document.createElement('div');
    iconDiv.className = 'no-cover-icon';
    iconDiv.innerHTML = '<i class="fa-solid fa-tree"></i>';
    container.insertBefore(iconDiv, img);
  }
}

// Lightbox controller
function openLightbox(url, type) {
  document.getElementById('lightbox-content').innerHTML = type === 'video'
    ? `<video src="${esc(url)}" controls autoplay></video>`
    : `<img src="${esc(url)}">`;
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.getElementById('lightbox-content').innerHTML = '';
}

// Share plant url
function sharePage() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href });
  } else {
    navigator.clipboard.writeText(location.href);
    alert('Đã copy đường dẫn hồ sơ cây trồng!');
  }
}

// Load Plant Profile on startup
async function loadPlant() {
  try {
    const primarySlug = slugInfo.slug || slug;
    let res = await fetch(`/api/plants/public/${encodeURIComponent(primarySlug)}`);
    let plant = await res.json();

    // Fallback: If primary slug (e.g. nfcUid) returned 404, fallback to plantId (e.g. /0/2/1/04:17:...)
    if (!res.ok && slugInfo.plantId && slugInfo.plantId !== primarySlug) {
      const fallbackRes = await fetch(`/api/plants/public/${encodeURIComponent(slugInfo.plantId)}`);
      if (fallbackRes.ok) {
        res = fallbackRes;
        plant = await fallbackRes.json();
      }
    }

    if (!res.ok) throw new Error(plant.error || 'Không tìm thấy hồ sơ cây trồng.');

    currentPlantData = plant;
    document.title = `${plant.plant_type || 'Cây trồng'} — Plant Book | Tanbao Corp`;
    await renderPlant(plant);
  } catch (err) {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('error-view').style.display = 'block';
    document.getElementById('error-msg').textContent = err.message;
  }
}

// Helper: Get fertilizer / supply / pesticide name from details
function getFertilizerName(details) {
  return (details.fertilizer_name || details.supply_name || details.fertilizer || details.type || details.product_name || details.name || '').trim();
}

function getPesticideName(details) {
  return (details.pesticide_name || details.supply_name || details.pesticide || details.type || details.product_name || details.name || '').trim();
}

// Helper: Get structured text from care logs
function getCareLogSummary(log) {
  const details = log.details || {};
  if (log.log_type === 'Tưới nước') {
    return `Đã tưới nước bằng phương pháp <strong>${esc(details.method || 'Thủ công')}</strong>. Lượng nước: <strong>${esc(details.amount || '—')} ${esc(details.unit || 'Lít')}</strong>.`;
  }
  if (log.log_type === 'Bón phân') {
    const fertName = getFertilizerName(details) || 'Phân bón';
    const methodStr = details.method ? ` bằng phương pháp <strong>${esc(details.method)}</strong>` : '';
    return `Đã bón phân <strong>${esc(fertName)}</strong>. Liều lượng: <strong>${esc(details.amount || '—')} ${esc(details.unit || 'kg')}</strong>${methodStr}.`;
  }
  if (log.log_type === 'Phun thuốc') {
    const pestName = getPesticideName(details) || 'Thuốc bảo vệ thực vật';
    const purposeStr = details.purpose ? ` (Mục đích: ${esc(details.purpose)})` : '';
    const waterStr = details.water_volume ? ` pha với <strong>${esc(details.water_volume)}L</strong> nước` : '';
    return `Đã phun thuốc <strong>${esc(pestName)}</strong>${purposeStr}. Liều lượng: <strong>${esc(details.amount || '—')} ${esc(details.unit || '')}</strong>${waterStr}.`;
  }
  if (log.log_type === 'Cắt lá') {
    return `Đã cắt tỉa lá/cành. Số lượng: <strong>${esc(details.amount || '—')}</strong>. Lý do: <strong>${esc(details.reason || 'Cắt tỉa định kỳ')}</strong>.`;
  }
  if (log.log_type === 'Tỉa hoa') {
    return `Đã tỉa hoa/quả. Số lượng: <strong>${esc(details.amount || '—')}</strong>. Lý do: <strong>${esc(details.reason || 'Tỉa thưa')}</strong>.`;
  }
  if (log.log_type === 'Bệnh cây') {
    const sevEmoji = details.severity === 'Nghiêm trọng' ? '🔴' : details.severity === 'Trung bình' ? '🟠' : '🟡';
    return `<span style="color:var(--color-disease);font-weight:700">${sevEmoji} ${esc(details.disease_name || 'Bệnh chưa xác định')}</span>${details.description ? '<br><span style="color:var(--text-secondary);font-size:12px">' + esc(details.description) + '</span>' : ''}`;
  }
  return esc(log.note || '');
}

// ── Timeline Pagination & Rendering Helpers ──────────────────

function getShortSummary(log) {
  const details = log.details || {};
  if (log.log_type === 'Tưới nước') {
    return `Tưới bằng ${esc(details.method || 'Thủ công')} (${esc(details.amount || '—')} ${esc(details.unit || 'Lít')})`;
  }
  if (log.log_type === 'Bón phân') {
    const fertName = getFertilizerName(details) || 'Phân bón';
    const unitStr = details.unit ? ` ${details.unit}` : '';
    return `Bón ${esc(fertName)} — (${esc(details.amount || '—')}${esc(unitStr)})`;
  }
  if (log.log_type === 'Phun thuốc') {
    const pestName = getPesticideName(details) || 'Thuốc BVTV';
    const amountStr = details.amount ? ` (Liều: ${details.amount}${details.unit ? ' ' + details.unit : ''})` : '';
    return `Phun ${esc(pestName)}${esc(amountStr)}`;
  }
  if (log.log_type === 'Cắt lá') {
    return `Cắt tỉa (${esc(details.amount || '—')} cành/lá) - ${esc(details.reason || 'Định kỳ')}`;
  }
  if (log.log_type === 'Tỉa hoa') {
    return `Tỉa bớt (${esc(details.amount || '—')} bông/trái) - ${esc(details.reason || 'Định kỳ')}`;
  }
  if (log.log_type === 'Bệnh cây') {
    const sevEmoji = details.severity === 'Nghiêm trọng' ? '🔴' : details.severity === 'Trung bình' ? '🟠' : '🟡';
    return `${sevEmoji} Phát hiện bệnh: ${esc(details.disease_name || 'Bệnh chưa xác định')}`;
  }
  return esc(log.note || '').slice(0, 40) + (log.note && log.note.length > 40 ? '...' : '');
}

function _renderTimelineItemHtml(log) {
  let markerClass = '';
  let tagClass = 'tag-general';
  let icon = 'fa-solid fa-pen';
  
  if (log.log_type === 'Tưới nước') {
    markerClass = 'marker-water';
    tagClass = 'tag-water';
    icon = 'fa-solid fa-droplet';
  } else if (log.log_type === 'Bón phân') {
    markerClass = 'marker-fertilize';
    tagClass = 'tag-fertilize';
    icon = 'fa-solid fa-leaf';
  } else if (log.log_type === 'Phun thuốc') {
    markerClass = 'marker-pesticide';
    tagClass = 'tag-pesticide';
    icon = 'fa-solid fa-flask';
  } else if (log.log_type === 'Cắt lá') {
    markerClass = 'marker-leaf';
    tagClass = 'tag-leaf';
    icon = 'fa-solid fa-scissors';
  } else if (log.log_type === 'Tỉa hoa') {
    markerClass = 'marker-flower';
    tagClass = 'tag-flower';
    icon = 'fa-solid fa-spa';
  } else if (log.log_type === 'Bệnh cây') {
    markerClass = 'marker-disease';
    tagClass = 'tag-disease';
    icon = 'fa-solid fa-virus';
  }
  
  const timeVal = (log.details && log.details.performed_at) ? log.details.performed_at : log.created_at;
  const fullDateTime = fmtDateTime(timeVal);

  const mediaUrls = (log.media_urls && Array.isArray(log.media_urls)) ? log.media_urls : [];
  const mediaThumbs = mediaUrls.length > 0 ? `
    <div class="log-media-gallery">
      ${mediaUrls.map(m => {
        const isVideo = (m.type === 'video') || /\.(mp4|mov|avi|mkv|webm)/i.test(m.url || m);
        const url = m.url || m;
        return isVideo
          ? `<div class="log-media-item" onclick="openLightbox('${esc(url)}','video')"><video src="${esc(url)}" muted preload="metadata"></video><div class="video-play-icon"><i class="fa-solid fa-circle-play"></i></div></div>`
          : `<div class="log-media-item" onclick="openLightbox('${esc(url)}','image')"><img src="${esc(url)}" alt="ảnh nhật ký" loading="lazy"></div>`;
      }).join('')}
    </div>` : '';

  const noteHtml = log.note
    ? `<div class="log-body" style="margin-top: 6px; color: var(--text-secondary); font-size:12px;"><i class="fa-solid fa-comment-dots"></i> ${esc(log.note)}</div>`
    : '';

  return `
    <div class="timeline-item">
      <div class="timeline-marker ${markerClass}"></div>
      <div class="timeline-content" onclick="toggleTimelineItem(event, this)">
        <div class="log-header">
          <span class="log-tag ${tagClass}"><i class="${icon}"></i> ${esc(log.log_type || 'Ghi chú')}</span>
          <div class="log-header-right">
            <span class="log-time-indicator"><i class="fa-regular fa-clock"></i> ${fullDateTime}</span>
            <i class="fa-solid fa-chevron-down toggle-arrow"></i>
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
        <i class="fa-regular fa-clipboard" style="font-size: 32px; margin-bottom: 12px;"></i>
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
              <i class="fa-solid fa-list-check"></i> Xem tất cả nhật ký (Tổng ${totalDatesCount} ngày canh tác)
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
              <i class="fa-solid fa-chevron-left"></i> Trang trước
            </button>
            <span style="font-size:12px; font-weight:700; color:var(--text-secondary); background:rgba(255,255,255,0.05); padding:6px 14px; border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
              Trang ${curPage} / ${totalPages} (${totalDatesCount} ngày)
            </span>
            <button type="button" class="btn btn-secondary btn-xs" ${curPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : `onclick="changePublicLogPage(${curPage + 1})"`} style="padding:6px 14px; font-size:12px; font-weight:700; cursor:pointer;">
              Trang tiếp <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
          <button type="button" class="btn btn-link btn-xs" onclick="togglePublicLogExpand(false)" style="font-size:12px; color:var(--text-secondary); font-weight:600; text-decoration:none; cursor:pointer; background:none; border:none; margin-top:4px;">
            <i class="fa-solid fa-compress"></i> Thu gọn về 3 ngày gần nhất
          </button>
        </div>
      `;
    }
  }
}

window.togglePublicLogExpand = function(expanded) {
  window._publicLogIsExpanded = expanded;
  renderPublicLogTimeline(1, expanded);
};

window.changePublicLogPage = function(page) {
  renderPublicLogTimeline(page, true);
};

// Render dynamic plant data
async function renderPlant(plant) {
  const extra = plant.data || {};
  const schemaFields = plant.schema_fields || [];
  const media = plant.media || [];
  const logs = plant.logs || [];
  const hasMap = (plant.latitude && plant.longitude) || (plant.farm_boundary && plant.farm_boundary.coordinates);
  
  // Helper to resolve crop cover image from plant type (schema)
  function getCropImageSrc(p) {
    if (p.cover_image) return esc(p.cover_image);
    const term = p.plant_type || '';
    if (!term) return '/assets/logo.png';
    
    // Extract text in parentheses, e.g. "Sầu riêng(durian)" -> "durian"
    const match = term.match(/\(([^)]+)\)/);
    let baseName = (match && match[1]) ? match[1].trim() : term;
    
    const normalized = baseName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    return `/assets/crop/${normalized}.png`;
  }

  window.tryNextCropExt = function(img, cropType) {
    if (!img) return;
    const currentSrc = img.src || '';
    if (currentSrc.endsWith('.png')) {
      img.src = currentSrc.replace('.png', '.jpg');
    } else if (currentSrc.endsWith('.jpg')) {
      img.src = currentSrc.replace('.jpg', '.jpeg');
    } else if (currentSrc.endsWith('.jpeg')) {
      img.src = currentSrc.replace('.jpeg', '.webp');
    } else {
      img.onerror = null;
      img.src = '/assets/logo.png';
      img.className = 'cover-image-fallback';
    }
  };

  // Render health status badge
  let healthClass = 'badge-gray';
  if (plant.health_status === 'Tốt') healthClass = 'badge-tot';
  else if (plant.health_status === 'Bình thường') healthClass = 'badge-binhthuong';
  else if (plant.health_status === 'Cần chú ý') healthClass = 'badge-chuyi';
  else if (plant.health_status === 'Bệnh') healthClass = 'badge-benh';
  // Group logs by date for timeline pagination
  window._publicLogsGrouped = {};
  window._publicLogDates = [];
  window._publicLogCurrentPage = 1;
  window._publicLogPageSize = 5;
  window._publicLogIsExpanded = false;

  logs.forEach(log => {
    const dateStr = fmtDate(log.log_date);
    if (!window._publicLogsGrouped[dateStr]) {
      window._publicLogsGrouped[dateStr] = [];
      window._publicLogDates.push(dateStr);
    }
    window._publicLogsGrouped[dateStr].push(log);
  });

  // Construct UI using exact plant.css rules
  let html = `
    <!-- Hero Header Card -->
    <div class="hero-container">
      <div class="glass-panel hero-card">
        <div class="cover-image-container">
          <img src="${getCropImageSrc(plant)}" alt="${esc(plant.plant_type)}" class="${plant.cover_image ? 'cover-image-photo' : 'cover-image-fallback'}" onerror="tryNextCropExt(this, '${esc(plant.plant_type || '')}')">
          <div class="cover-overlay"></div>
        </div>
        <div class="hero-details">
          <div class="plant-title-row">
            <div>
              <h1 class="plant-name">${esc(plant.plant_type)}</h1>
              ${plant.plant_variety 
                ? `<p class="plant-variety">Mã số cây: <strong>${esc(plant.tree_code || '#' + plant.id)}</strong> &nbsp;•&nbsp; Giống: <strong>${esc(plant.plant_variety)}</strong></p>` 
                : `<p class="plant-variety">Mã số cây: <strong>${esc(plant.tree_code || '#' + plant.id)}</strong></p>`}
            </div>
          </div>
          
          <div class="badges-row">
            <span class="badge badge-info"><i class="fa-solid fa-tag"></i> ${esc(plant.plant_type)}</span>
            <span class="badge ${healthClass} badge-health-interactive" onclick="toggleHealthStatus()" style="cursor:pointer;" title="Bấm để chuyển trạng thái sức khỏe"><i class="fa-solid fa-heart-pulse"></i> Sức khỏe: ${esc(plant.health_status || 'Bình thường')}</span>
            ${plant.nfc_uid ? `<span class="badge badge-info"><i class="fa-solid fa-rss"></i> NFC: ${esc(plant.nfc_uid)}</span>` : ''}
          </div>
          
          <div class="info-grid">
            <div class="info-tile">
              <span class="label"><i class="fa-solid fa-seedling" style="color: var(--green-bright); margin-right: 6px;"></i>Giống cây</span>
              <span class="value">${esc(plant.plant_variety || 'Tiêu chuẩn')}</span>
            </div>
            <div class="info-tile">
              <span class="label"><i class="fa-solid fa-calendar-days" style="color: var(--green-bright); margin-right: 6px;"></i>Ngày trồng</span>
              <span class="value">${plant.planting_date ? fmtDate(plant.planting_date) : 'Chưa ghi nhận'}</span>
            </div>
            <div class="info-tile">
              <span class="label"><i class="fa-solid fa-location-dot" style="color: var(--green-bright); margin-right: 6px;"></i>Trang trại</span>
              <span class="value">${esc(plant.farm_name || 'Vườn nhà')}</span>
            </div>
            <div class="info-tile">
              <span class="label"><i class="fa-solid fa-chart-line" style="color: var(--green-bright); margin-right: 6px;"></i>Hoạt động</span>
              <span class="value">${logs.length} nhật ký &nbsp;•&nbsp; ${media.length} hình ảnh</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Container Grid -->
    <div class="main-layout">
      <!-- Left Column (Location Map, Timeline Logs) -->
      <div class="left-col">
        ${hasMap ? `
        <!-- Location Map Card -->
        <div class="glass-panel glass-card">
          <h2 class="sec-title"><i class="fa-solid fa-map-location-dot" style="color: var(--green-bright)"></i> Vị trí trên bản đồ</h2>
          <div class="plant-map-container" style="position:relative; width:100%; height:280px; border-radius:12px; overflow:hidden;">
            <div id="plant-location-map" style="width:100%;height:100%;"></div>
            ${plant.farm_name ? `<div class="map-farm-badge" style="position:absolute; bottom:12px; left:12px; z-index:5; background:rgba(7,25,16,0.85); backdrop-filter:blur(8px); padding:6px 12px; border-radius:8px; font-size:12px; color:#fff; border:1px solid rgba(255,255,255,0.1);"><i class="fa fa-seedling" style="color:var(--green-bright)"></i> Trang trại: ${esc(plant.farm_name)}</div>` : ''}
          </div>
        </div>
        ` : ''}

        <!-- Timeline Diary Card -->
        <div class="glass-panel glass-card">
          <h2 class="sec-title" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <span><i class="fa-solid fa-clock-rotate-left" style="color: var(--green-bright)"></i> Nhật ký chăm sóc cây</span>
            <span style="font-size:11px; font-weight:600; color:var(--text-secondary); background:rgba(255,255,255,0.05); padding:4px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.08);">
              Tổng ${window._publicLogDates.length} ngày canh tác
            </span>
          </h2>

          <div id="public-timeline-container">
            <!-- Rendered dynamically -->
          </div>

          <div id="public-timeline-pagination">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </div>

      <!-- Right Column (Quick Care Buttons, Media Gallery) -->
      <div class="right-col">
        <!-- Care Actions (Quick Log Buttons) -->
        <div class="glass-panel glass-card">
          <h2 class="sec-title"><i class="fa-solid fa-heart-pulse" style="color: var(--green-bright)"></i> Ghi nhật ký nhanh</h2>
          <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.4;">
            Chọn quy trình chăm sóc bên dưới để điền thông tin nhanh.
          </p>
          <div class="care-actions-grid">
            <button class="care-btn care-btn-water" onclick="openModal('modal-water')">
              <i class="fa-solid fa-droplet" style="color: var(--color-water)"></i>
              <span>Tưới nước</span>
            </button>
            <button class="care-btn care-btn-fertilize" onclick="openModal('modal-fertilize')">
              <i class="fa-solid fa-leaf" style="color: var(--color-fertilize)"></i>
              <span>Bón phân</span>
            </button>
            <button class="care-btn care-btn-pesticide" onclick="openModal('modal-pesticide')">
              <i class="fa-solid fa-flask" style="color: var(--color-pesticide)"></i>
              <span>Phun thuốc</span>
            </button>
            <button class="care-btn care-btn-leaf" onclick="openModal('modal-leaf')">
              <i class="fa-solid fa-scissors" style="color: var(--color-leaf)"></i>
              <span>Cắt cành/lá</span>
            </button>
            <button class="care-btn care-btn-flower" onclick="openModal('modal-flower')">
              <i class="fa-solid fa-spa" style="color: var(--color-flower)"></i>
              <span>Tỉa hoa/quả</span>
            </button>
            <button class="care-btn care-btn-disease" onclick="openModal('modal-disease')">
              <i class="fa-solid fa-virus" style="color: var(--color-disease)"></i>
              <span>Bệnh cây</span>
            </button>
          </div>
        </div>

        ${media.length ? `
        <!-- Media Gallery Card -->
        <div class="glass-panel glass-card">
          <h2 class="sec-title"><i class="fa-solid fa-images" style="color: var(--green-bright)"></i> Thư viện hình ảnh</h2>
          <div class="gallery-grid">
            ${media.map(m => `
              <div class="gallery-thumb" onclick="openLightbox('${esc(m.url)}','${esc(m.media_type)}')">
                ${m.media_type === 'video'
                  ? `<video src="${esc(m.url)}" muted></video>`
                  : `<img src="${esc(m.url)}" alt="${esc(m.caption || '')}">`}
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
      </div>
    </div>
    
    <footer class="footer">
      <div class="footer-logo-wrap">
        <img src="/assets/logo.png" alt="TANBAO AgTech" class="footer-logo">
      </div><br>
      Dữ liệu được số hóa bởi hệ thống <a href="/">Plant Book</a> — TANBAO AgTech &nbsp;|&nbsp; Cập nhật lần cuối: ${fmtDate(plant.updated_at)}
    </footer>
  `;

  document.getElementById('loader').style.display = 'none';
  const view = document.getElementById('plant-view');
  view.innerHTML = html;
  view.style.display = 'block';

  // Render initial care timeline (3 days default)
  renderPublicLogTimeline(1, false);

  // Initialize Mapbox plant location map if coordinates or farm polygon exist
  if (hasMap) {
    const mapContainerEl = document.getElementById('plant-location-map');
    if (mapContainerEl) {
      (async () => {
        let MAPBOX_TOKEN = '';
        try {
          const tokenRes = await fetch('/api/config/mapbox-token');
          const tokenData = await tokenRes.json();
          MAPBOX_TOKEN = tokenData.token;
        } catch(e) {
          console.error('Lỗi tải Mapbox token:', e);
        }
        if (!MAPBOX_TOKEN) return;

        mapboxgl.accessToken = MAPBOX_TOKEN;

    // Determine the initial center of the map
    let centerLng = 105.0;
    let centerLat = 16.0;
    let initialZoom = 16;
    
    if (plant.longitude && plant.latitude) {
      centerLng = parseFloat(plant.longitude);
      centerLat = parseFloat(plant.latitude);
    } else if (plant.farm_boundary && plant.farm_boundary.coordinates && plant.farm_boundary.coordinates[0]) {
      const firstRing = plant.farm_boundary.coordinates[0];
      if (firstRing && firstRing[0]) {
        centerLng = parseFloat(firstRing[0][0]);
        centerLat = parseFloat(firstRing[0][1]);
        initialZoom = 14;
      }
    }

    const plantMap = new mapboxgl.Map({
      container: 'plant-location-map',
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [centerLng, centerLat],
      zoom: initialZoom,
      attributionControl: false,
      preserveDrawingBuffer: true
    });
    plantMap.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    plantMap.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    // Add contour lines (đường đồng mức) & 3D terrain elevation to public plant map
    addContourLinesToMap(plantMap);

    // Add plant marker
    if (plant.latitude && plant.longitude) {
      const el = document.createElement('div');
      el.className = 'plant-map-marker';
      el.innerHTML = '<i class="fa-solid fa-seedling"></i>';
      new mapboxgl.Marker({ element: el })
        .setLngLat([parseFloat(plant.longitude), parseFloat(plant.latitude)])
        .setPopup(new mapboxgl.Popup({ offset: 20, closeButton: false })
          .setHTML(`<strong>${esc(plant.plant_type)}</strong>${plant.plant_variety ? '<br><small>'+esc(plant.plant_variety)+'</small>' : ''}`))
        .addTo(plantMap);
    }

    // Draw farm polygon if available
    if (plant.farm_boundary && plant.farm_boundary.coordinates) {
      plantMap.on('load', () => {
        plantMap.addSource('farm-poly', {
          type: 'geojson',
          data: { type: 'Feature', geometry: plant.farm_boundary, properties: {} }
        });
        plantMap.addLayer({
          id: 'farm-poly-fill',
          type: 'fill',
          source: 'farm-poly',
          paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.15 }
        });
        plantMap.addLayer({
          id: 'farm-poly-line',
          type: 'line',
          source: 'farm-poly',
          paint: { 'line-color': '#22c55e', 'line-width': 2, 'line-opacity': 0.8 }
        });
      });
    }

    // Request and show device GPS location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const devLat = position.coords.latitude;
          const devLng = position.coords.longitude;

          // Create a marker for the device's position
          const devEl = document.createElement('div');
          devEl.className = 'device-location-marker';
          new mapboxgl.Marker({ element: devEl })
            .setLngLat([devLng, devLat])
            .setPopup(new mapboxgl.Popup({ offset: 20, closeButton: false })
              .setHTML(`<strong>Vị trí của bạn</strong><br><small>Thiết bị mở URL</small>`))
            .addTo(plantMap);

          // Adjust map bounds to show both the plant/farm and the device
          const bounds = new mapboxgl.LngLatBounds();
          let hasPoints = false;

          if (plant.longitude && plant.latitude) {
            bounds.extend([parseFloat(plant.longitude), parseFloat(plant.latitude)]);
            hasPoints = true;
          }

          if (plant.farm_boundary && plant.farm_boundary.coordinates && plant.farm_boundary.coordinates[0]) {
            plant.farm_boundary.coordinates[0].forEach(coord => {
              bounds.extend([parseFloat(coord[0]), parseFloat(coord[1])]);
              hasPoints = true;
            });
          }

          if (hasPoints) {
            bounds.extend([devLng, devLat]);
            plantMap.fitBounds(bounds, { padding: 50, maxZoom: 16 });
          }
        },
        (error) => {
          console.warn('Không thể lấy vị trí thiết bị:', error);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
      })();
    }
  }
}

// Submit log entries from care forms
async function submitCareLog(event, type, modalId, formId) {
  event.preventDefault();
  
  const form = document.getElementById(formId);
  const submitBtn = form.querySelector('.btn-submit');
  const oldText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
  submitBtn.disabled = true;

  // Gather details depending on log type
  const details = {};
  let note = '';

  if (type === 'Tưới nước') {
    const selectVal = document.getElementById('water-method-select').value;
    details.method = selectVal === '__custom__' ? document.getElementById('water-method-custom').value.trim() : selectVal;
    details.amount = parseFloat(document.getElementById('water-amount').value);
    details.unit = document.getElementById('water-unit').value;
    details.time = document.getElementById('water-time').value;
    note = document.getElementById('water-note').value.trim();
  } 
  else if (type === 'Bón phân') {
    const selectVal = document.getElementById('fertilizer-select').value;
    details.type = selectVal === '__custom__' ? document.getElementById('fertilizer-custom').value.trim() : selectVal;
    details.amount = parseFloat(document.getElementById('fertilizer-amount').value);
    details.unit = document.getElementById('fertilizer-unit').value;
    details.method = document.getElementById('fertilizer-method').value;
    note = document.getElementById('fertilizer-note').value.trim();
  } 
  else if (type === 'Phun thuốc') {
    const selectVal = document.getElementById('pesticide-select').value;
    details.type = selectVal === '__custom__' ? document.getElementById('pesticide-custom').value.trim() : selectVal;
    details.amount = parseFloat(document.getElementById('pesticide-amount').value);
    details.unit = document.getElementById('pesticide-unit').value;
    details.water_volume = parseFloat(document.getElementById('pesticide-water').value);
    details.purpose = document.getElementById('pesticide-purpose').value;
    note = document.getElementById('pesticide-note').value.trim();
  } 
  else if (type === 'Cắt lá') {
    details.amount = document.getElementById('leaf-amount').value.trim();
    const selectVal = document.getElementById('leaf-reason-select').value;
    details.reason = selectVal === '__custom__' ? document.getElementById('leaf-reason-custom').value.trim() : selectVal;
    note = document.getElementById('leaf-note').value.trim();
  } 
  else if (type === 'Tỉa hoa') {
    details.amount = document.getElementById('flower-amount').value.trim();
    const selectVal = document.getElementById('flower-reason-select').value;
    details.reason = selectVal === '__custom__' ? document.getElementById('flower-reason-custom').value.trim() : selectVal;
    note = document.getElementById('flower-note').value.trim();
  }

  const dtInput = form.querySelector('input[type="datetime-local"]');
  let performedAt = new Date().toISOString();
  let logDate = performedAt.slice(0, 10);
  if (dtInput && dtInput.value) {
    const localDate = new Date(dtInput.value);
    performedAt = localDate.toISOString();
    logDate = dtInput.value.slice(0, 10);
  }
  
  details.performed_at = performedAt;

  const payload = {
    log_type: type,
    note: note,
    details: details,
    log_date: logDate,
    media_urls: []
  };

  try {
    const res = await fetch(`/api/plants/public/${encodeURIComponent(slug)}/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Lỗi server');
    }
    
    closeModal(modalId);
    
    // Reload plant logs and information
    await loadPlant();
  } catch (err) {
    alert('Không thể lưu nhật ký: ' + err.message);
  } finally {
    submitBtn.innerHTML = oldText;
    submitBtn.disabled = false;
  }
}

// ── Bệnh cây Feature ─────────────────────────────────────────────
let diseaseImageFiles = [];
let diseaseVideoFiles = [];

// IndexedDB for File Caching
const DB_NAME = 'PlantAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'draftFiles';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveDraftFiles(key, files) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(files, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function getDraftFiles(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function clearDraftFiles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(`diseaseImages_${slug}`);
    tx.objectStore(STORE_NAME).delete(`diseaseVideos_${slug}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Save text inputs to localStorage
function saveDiseaseDraftText() {
  const draft = {
    name: document.getElementById('disease-name').value,
    desc: document.getElementById('disease-desc').value,
    severity: document.getElementById('disease-severity').value,
    datetime: document.getElementById('disease-datetime').value,
    note: document.getElementById('disease-note').value
  };
  localStorage.setItem(`diseaseText_${slug}`, JSON.stringify(draft));
}

// Restore draft text and files
async function restoreDiseaseDraft() {
  const draftTxt = localStorage.getItem(`diseaseText_${slug}`);
  if (draftTxt) {
    try {
      const draft = JSON.parse(draftTxt);
      if (draft.name) document.getElementById('disease-name').value = draft.name;
      if (draft.desc) document.getElementById('disease-desc').value = draft.desc;
      if (draft.severity) document.getElementById('disease-severity').value = draft.severity;
      if (draft.datetime) document.getElementById('disease-datetime').value = draft.datetime;
      if (draft.note) document.getElementById('disease-note').value = draft.note;
    } catch(e) {}
  }
  try {
    diseaseImageFiles = await getDraftFiles(`diseaseImages_${slug}`);
    diseaseVideoFiles = await getDraftFiles(`diseaseVideos_${slug}`);
    renderDiseasePreviews('images');
    renderDiseasePreviews('videos');
  } catch(e) {
    console.error("Lỗi khôi phục files:", e);
  }
}

// Bind auto-save to inputs
document.querySelectorAll('#form-disease input, #form-disease textarea, #form-disease select').forEach(el => {
  if (el.type !== 'file') {
    el.addEventListener('input', saveDiseaseDraftText);
    el.addEventListener('change', saveDiseaseDraftText);
  }
});

async function handleDiseaseFiles(input, type) {
  const files = Array.from(input.files);
  if (!files.length) return;
  if (type === 'images') {
    const toAdd = files.slice(0, 10 - diseaseImageFiles.length);
    diseaseImageFiles = [...diseaseImageFiles, ...toAdd];
    renderDiseasePreviews('images');
    await saveDraftFiles(`diseaseImages_${slug}`, diseaseImageFiles);
  } else {
    const toAdd = files.slice(0, 2 - diseaseVideoFiles.length);
    diseaseVideoFiles = [...diseaseVideoFiles, ...toAdd];
    renderDiseasePreviews('videos');
    await saveDraftFiles(`diseaseVideos_${slug}`, diseaseVideoFiles);
  }
  // Reset file input so the same file can be re-selected if needed
  input.value = '';
}

async function removeDiseaseFile(idx, type) {
  if (type === 'images') {
    diseaseImageFiles.splice(idx, 1);
    renderDiseasePreviews('images');
    await saveDraftFiles(`diseaseImages_${slug}`, diseaseImageFiles);
  } else {
    diseaseVideoFiles.splice(idx, 1);
    renderDiseasePreviews('videos');
    await saveDraftFiles(`diseaseVideos_${slug}`, diseaseVideoFiles);
  }
}

function renderDiseasePreviews(type) {
  const files = type === 'images' ? diseaseImageFiles : diseaseVideoFiles;
  const previewEl = document.getElementById(type === 'images' ? 'disease-img-preview' : 'disease-vid-preview');
  const zoneEl = document.getElementById(type === 'images' ? 'disease-img-zone' : 'disease-vid-zone');
  if (!previewEl || !zoneEl) return;

  previewEl.innerHTML = '';
  zoneEl.classList.toggle('has-file', files.length > 0);

  files.forEach((file, idx) => {
    const item = document.createElement('div');
    item.className = 'upload-preview-item';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-preview';
    removeBtn.innerHTML = '×';
    removeBtn.type = 'button';
    removeBtn.onclick = () => removeDiseaseFile(idx, type);

    if (file.type && file.type.startsWith('video')) {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      item.appendChild(video);
      const badge = document.createElement('div');
      badge.className = 'video-badge';
      badge.textContent = 'VIDEO';
      item.appendChild(badge);
    } else {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      item.appendChild(img);
    }
    item.appendChild(removeBtn);
    previewEl.appendChild(item);
  });
}

async function submitDiseaseLog(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('btn-disease-submit');
  const oldHtml = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải lên...';
  submitBtn.disabled = true;

  const diseaseName = document.getElementById('disease-name').value.trim();
  const desc = document.getElementById('disease-desc').value.trim();
  const severity = document.getElementById('disease-severity').value;
  const note = document.getElementById('disease-note').value.trim();
  const dtInput = document.getElementById('disease-datetime');

  let performedAt = new Date().toISOString();
  let logDate = performedAt.slice(0, 10);
  if (dtInput && dtInput.value) {
    const localDate = new Date(dtInput.value);
    performedAt = localDate.toISOString();
    logDate = dtInput.value.slice(0, 10);
  }

  const details = {
    disease_name: diseaseName,
    description: desc,
    severity: severity,
    performed_at: performedAt
  };

  try {
    const formData = new FormData();
    formData.append('log_type', 'Bệnh cây');
    formData.append('log_date', logDate);
    formData.append('note', note);
    formData.append('details', JSON.stringify(details));

    diseaseImageFiles.forEach(f => formData.append('files', f));
    diseaseVideoFiles.forEach(f => formData.append('files', f));

    const res = await fetch(`/api/plants/public/${encodeURIComponent(slug)}/logs`, {
      method: 'POST',
      // Do NOT set Content-Type — browser sets multipart/form-data with boundary automatically
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Lỗi server');
    }

    // Reset form and clear drafts
    document.getElementById('form-disease').reset();
    diseaseImageFiles = [];
    diseaseVideoFiles = [];
    renderDiseasePreviews('images');
    renderDiseasePreviews('videos');
    localStorage.removeItem(`diseaseText_${slug}`);
    await clearDraftFiles();

    closeModal('modal-disease');
    await loadPlant();
  } catch (err) {
    alert('Không thể lưu nhật ký bệnh cây: ' + err.message);
  } finally {
    submitBtn.innerHTML = oldHtml;
    submitBtn.disabled = false;
  }
}

// Restore drafts if user cancels out and re-opens
function onModalOpen(modalId) {
  if (modalId === 'modal-disease') {
    restoreDiseaseDraft();
  }
}

// Modifying the existing openModal function:
const originalOpenModal = openModal;
openModal = function(modalId) {
  originalOpenModal(modalId);
  onModalOpen(modalId);
};

// Toggle timeline item expanded state (accordion)
function toggleTimelineItem(event, el) {
  // Ignore clicks on lightbox media thumbnails, play icons or buttons
  if (event.target.closest('.log-media-item') || event.target.closest('.remove-preview') || event.target.tagName === 'BUTTON') {
    return;
  }
  const item = el.closest('.timeline-item');
  const details = item.querySelector('.timeline-details');
  item.classList.toggle('expanded');
  
  if (item.classList.contains('expanded')) {
    // Add buffer space for scrollHeight to handle image loads
    details.style.maxHeight = (details.scrollHeight + 150) + "px";
    details.style.opacity = "1";
  } else {
    details.style.maxHeight = "0";
    details.style.opacity = "0";
  }
}

// Toggle health status between Tốt / Bệnh
async function toggleHealthStatus() {
  if (!currentPlantData) return;
  const current = currentPlantData.health_status;
  // If it's anything else than Bệnh, toggle to Bệnh. Otherwise, toggle to Tốt.
  const nextStatus = current === 'Bệnh' ? 'Tốt' : 'Bệnh';
  
  const confirmed = confirm(`Bạn có chắc chắn muốn thay đổi trạng thái sức khỏe cây trồng này thành "${nextStatus}" không?`);
  if (!confirmed) return;
  
  try {
    const targetId = currentPlantData.public_slug || currentPlantData.id || slug;
    const res = await fetch(`/api/plants/public/${encodeURIComponent(targetId)}/health`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ health_status: nextStatus })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Lỗi hệ thống');
    }
    
    // Reload plant profile to reflect status changes
    await loadPlant();
  } catch (err) {
    alert('Không thể cập nhật trạng thái sức khỏe: ' + err.message);
  }
}

// Export report functionality
function openExportModal() {
  if (!currentPlantData) {
    alert("Dữ liệu cây trồng chưa được tải xong.");
    return;
  }
  
  const fromDateInput = document.getElementById('export-from-date');
  const toDateInput = document.getElementById('export-to-date');
  
  // Default to Date: Today
  const today = new Date().toISOString().split('T')[0];
  toDateInput.value = today;
  
  // Default From Date: 1 year ago or plant creation date
  if (currentPlantData.created_at) {
    const createdDate = new Date(currentPlantData.created_at).toISOString().split('T')[0];
    fromDateInput.value = createdDate;
  } else {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    fromDateInput.value = oneYearAgo.toISOString().split('T')[0];
  }
  
  // Populate categories
  const categories = ["Tưới nước", "Bón phân", "Phun thuốc", "Cắt lá", "Tỉa hoa", "Bệnh cây", "Ghi chú khác"];
  
  // Append any extra unique category present in logs
  const logs = currentPlantData.logs || [];
  logs.forEach(l => {
    if (l.log_type && !categories.includes(l.log_type)) {
      categories.push(l.log_type);
    }
  });
  
  const container = document.getElementById('export-categories-container');
  container.innerHTML = categories.map(cat => {
    return `
      <label class="export-category-item">
        <input type="checkbox" name="export-cat" value="${esc(cat)}" checked>
        <span>${esc(cat)}</span>
      </label>
    `;
  }).join('');
  
  document.getElementById('export-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeExportModal() {
  document.getElementById('export-modal').classList.remove('active');
  document.body.style.overflow = '';
}

function toggleAllExportCategories(select) {
  const checkboxes = document.querySelectorAll('#export-categories-container input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = select);
}

function generateExportReport() {
  const fromDate = document.getElementById('export-from-date').value;
  const toDate = document.getElementById('export-to-date').value;
  
  const checkedCats = [];
  document.querySelectorAll('#export-categories-container input[name="export-cat"]:checked').forEach(cb => {
    checkedCats.push(cb.value);
  });
  
  if (checkedCats.length === 0) {
    alert("Vui lòng chọn ít nhất một hạng mục nhật ký để xuất.");
    return;
  }
  
  const reportUrl = `/plant/${slug}/report?from=${fromDate}&to=${toDate}&categories=${encodeURIComponent(checkedCats.join(','))}`;
  window.open(reportUrl, '_blank');
  closeExportModal();
}

// Startup
async function init() {
  await loadConfigurations();
  await loadPlant();
  await restoreDiseaseDraft(); // Restore on initial load in case page reloaded while capturing
}

init();

/**
 * Thêm đường đồng mức siêu dày mật độ 1m (1-Meter High-Density Contour Lines),
 * dải màu cao độ quang phổ (Elevation Spectrum Gradient) và Bảng chú giải cao độ.
 * @param {mapboxgl.Map} map - Mapbox map instance
 * @param {Object} options - { defaultVisible: true, showControl: true }
 */
function addContourLinesToMap(map, options = {}) {
  if (!map) return;
  const defaultVisible = options.defaultVisible !== false;
  const showControl = options.showControl !== false;

  const initContours = () => {
    try {
      // 1. Thêm nguồn Terrain DEM cho 3D địa hình
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14
        });
        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      }

      // 2. Thêm nguồn Vector Đường Đồng Mức tiêu chuẩn Mapbox Terrain v2
      if (!map.getSource('mapbox-terrain-contours')) {
        map.addSource('mapbox-terrain-contours', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-terrain-v2'
        });
      }

      // Dải màu dốc cao độ quang phổ (Spectrum Elevation Color Ramp)
      const contourColorRamp = [
        'interpolate',
        ['linear'],
        ['get', 'ele'],
        0,    '#1d4ed8', // 0m: Xanh dương đậm
        100,  '#0284c7', // 100m: Xanh biển
        300,  '#06b6d4', // 300m: Xanh lam sáng
        450,  '#10b981', // 450m: Xanh lá cây
        490,  '#22c55e', // 490m: Xanh lá mạ
        500,  '#84cc16', // 500m: Xanh đọt chuối
        504,  '#eab308', // 504m: Vàng tươi
        508,  '#f97316', // 508m: Cam
        512,  '#ef4444', // 512m: Đỏ tươi
        800,  '#dc2626', // 800m: Đỏ sẫm
        1500, '#991b1b'  // 1500m: Đỏ đậm
      ];

      // 3. Lớp Đường Đồng Mức Tiêu Chuẩn
      if (!map.getLayer('contour-lines')) {
        map.addLayer({
          id: 'contour-lines',
          type: 'line',
          source: 'mapbox-terrain-contours',
          'source-layer': 'contour',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
            'visibility': defaultVisible ? 'visible' : 'none'
          },
          paint: {
            'line-color': contourColorRamp,
            'line-width': [
              'interpolate',
              ['exponential', 1.5],
              ['zoom'],
              11, 0.6,
              14, 1.4,
              17, 2.8
            ],
            'line-opacity': 0.9
          }
        });
      }

      if (!map.getLayer('contour-labels')) {
        map.addLayer({
          id: 'contour-labels',
          type: 'symbol',
          source: 'mapbox-terrain-contours',
          'source-layer': 'contour',
          layout: {
            'symbol-placement': 'line',
            'text-field': ['concat', ['get', 'ele'], ' m'],
            'text-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              12, 9,
              16, 12
            ],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'text-max-angle': 35,
            'visibility': defaultVisible ? 'visible' : 'none'
          },
          paint: {
            'text-color': contourColorRamp,
            'text-halo-color': 'rgba(0, 0, 0, 0.9)',
            'text-halo-width': 2
          }
        });
      }

      // 4. Hàm Sinh Đường Đồng Mức Mật Độ Biến Thiên Năng Động Theo Zoom
      const updateDense1mContours = () => {
        try {
          const bbox = getFarmBoundingBox();
          if (!bbox) return;

          // Công thức khoảng cách đường đồng mức theo yêu cầu:
          // Kích cỡ xem nông trại hiện tại (Zoom ~16.0): 2.5m
          // Mỗi lần Zoom in (+1 zoom): -0.5m
          // Mỗi lần Zoom out (-1 zoom): +0.5m
          const currentZoom = map.getZoom();
          let interval = 2.5 - (currentZoom - 16.0) * 0.5;
          interval = Math.max(0.5, Math.min(10.0, interval));
          interval = Math.round(interval * 2) / 2;

          const { west, south, east, north } = bbox;
          const nx = 45;
          const ny = 45;
          const dx = (east - west) / (nx - 1);
          const dy = (north - south) / (ny - 1);

          const grid = [];
          let minEle = Infinity;
          let maxEle = -Infinity;
          let hasTerrainData = false;

          for (let r = 0; r < ny; r++) {
            const lat = south + r * dy;
            const row = [];
            for (let c = 0; c < nx; c++) {
              const lng = west + c * dx;
              const ele = map.queryTerrainElevation([lng, lat]);
              if (ele !== null && ele !== undefined) {
                row.push(ele);
                if (ele < minEle) minEle = ele;
                if (ele > maxEle) maxEle = ele;
                hasTerrainData = true;
              } else {
                row.push(0);
              }
            }
            grid.push(row);
          }

          if (!hasTerrainData || minEle === Infinity || maxEle === -Infinity) return;

          const startLevel = Math.ceil(minEle / interval) * interval;
          const endLevel = Math.floor(maxEle / interval) * interval;
          const features = [];

          function interp(pA, pB, vA, vB, val) {
            if (Math.abs(vB - vA) < 1e-6) return pA;
            const t = (val - vA) / (vB - vA);
            return [pA[0] + t * (pB[0] - pA[0]), pA[1] + t * (pB[1] - pA[1])];
          }

          for (let threshold = startLevel; threshold <= endLevel + 1e-5; threshold += interval) {
            const roundedThreshold = Math.round(threshold * 10) / 10;
            const segments = [];

            for (let r = 0; r < ny - 1; r++) {
              const lat0 = south + r * dy;
              const lat1 = south + (r + 1) * dy;

              for (let c = 0; c < nx - 1; c++) {
                const lng0 = west + c * dx;
                const lng1 = west + (c + 1) * dx;

                const v0 = grid[r][c];
                const v1 = grid[r][c + 1];
                const v2 = grid[r + 1][c + 1];
                const v3 = grid[r + 1][c];

                const code = (v0 >= roundedThreshold ? 1 : 0) |
                             (v1 >= roundedThreshold ? 2 : 0) |
                             (v2 >= roundedThreshold ? 4 : 0) |
                             (v3 >= roundedThreshold ? 8 : 0);

                if (code === 0 || code === 15) continue;

                const p0 = [lng0, lat0];
                const p1 = [lng1, lat0];
                const p2 = [lng1, lat1];
                const p3 = [lng0, lat1];

                const e0 = interp(p0, p1, v0, v1, roundedThreshold);
                const e1 = interp(p1, p2, v1, v2, roundedThreshold);
                const e2 = interp(p3, p2, v3, v2, roundedThreshold);
                const e3 = interp(p0, p3, v0, v3, roundedThreshold);

                switch (code) {
                  case 1: case 14: segments.push([e3, e0]); break;
                  case 2: case 13: segments.push([e0, e1]); break;
                  case 3: case 12: segments.push([e3, e1]); break;
                  case 4: case 11: segments.push([e1, e2]); break;
                  case 5: segments.push([e3, e2]); segments.push([e0, e1]); break;
                  case 6: case 9:  segments.push([e0, e2]); break;
                  case 7: case 8:  segments.push([e3, e2]); break;
                  case 10: segments.push([e3, e0]); segments.push([e1, e2]); break;
                }
              }
            }

            if (segments.length > 0) {
              features.push({
                type: 'Feature',
                properties: { ele: roundedThreshold },
                geometry: {
                  type: 'MultiLineString',
                  coordinates: segments
                }
              });
            }
          }

          const geoData = { type: 'FeatureCollection', features };
          const dynamicRamp = buildDynamicColorRamp(minEle, maxEle);

          if (map.getSource('dense-1m-contours')) {
            map.getSource('dense-1m-contours').setData(geoData);
            if (map.getLayer('dense-1m-contour-lines')) {
              map.setPaintProperty('dense-1m-contour-lines', 'line-color', dynamicRamp);
            }
            if (map.getLayer('dense-1m-contour-labels')) {
              map.setPaintProperty('dense-1m-contour-labels', 'text-color', dynamicRamp);
            }
          } else {
            map.addSource('dense-1m-contours', {
              type: 'geojson',
              data: geoData
            });

            map.addLayer({
              id: 'dense-1m-contour-lines',
              type: 'line',
              source: 'dense-1m-contours',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
                'visibility': defaultVisible ? 'visible' : 'none'
              },
              paint: {
                'line-color': dynamicRamp,
                'line-width': [
                  'interpolate',
                  ['exponential', 1.5],
                  ['zoom'],
                  12, 1.5,
                  15, 2.5,
                  18, 4.0
                ],
                'line-opacity': 0.95
              }
            });

            map.addLayer({
              id: 'dense-1m-contour-labels',
              type: 'symbol',
              source: 'dense-1m-contours',
              layout: {
                'symbol-placement': 'line',
                'text-field': ['concat', ['get', 'ele'], ' m'],
                'text-size': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12, 10,
                  16, 13
                ],
                'text-allow-overlap': true,
                'text-ignore-placement': false,
                'text-max-angle': 45,
                'visibility': defaultVisible ? 'visible' : 'none'
              },
              paint: {
                'text-color': dynamicRamp,
                'text-halo-color': 'rgba(0, 0, 0, 0.95)',
                'text-halo-width': 2.5
              }
            });
          }

          updateLegendWidget(minEle, maxEle, interval);
        } catch (e) {
          console.warn('Lỗi sinh đường đồng mức nông trại:', e);
        }
      };

      // Cập nhật Bảng Chú Giải Cao Độ Dạng Thanh Dải Màu Sang Trọng (Hiển thị khoảng cách mét)
      const updateLegendWidget = (minEle, maxEle, interval) => {
        const legendContainer = map.getContainer().querySelector('.elevation-legend-widget-container');
        if (!legendContainer) return;

        const minE = Math.floor(minEle);
        const maxE = Math.ceil(maxEle);
        const midE = Math.round((maxE + minE) / 2);
        const stepTxt = interval ? ` (${interval}m)` : '';

        legendContainer.innerHTML = `
          <div style="
            background: rgba(10, 25, 18, 0.92);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 10px 12px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.6);
            color: #fff;
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 90px;
            pointer-events: auto;
          ">
            <div style="font-size:9.5px; font-weight:800; text-transform:uppercase; color:#9ca3af; margin-bottom:8px; letter-spacing:0.5px; text-align:center;">Cao độ${stepTxt}</div>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="
                width: 12px;
                height: 140px;
                border-radius: 6px;
                background: linear-gradient(to top, 
                  #000080, #0000cd, #0000ff, #0066ff, #0099ff,
                  #00c8ff, #00f0ff, #00ffc8, #00ff99, #00ff33,
                  #66ff00, #a6ff00, #ccff00, #ffff00, #ffcc00,
                  #ff9900, #ff6600, #ff3300, #ff0000, #cc0000, #800000
                );
                border: 1px solid rgba(255,255,255,0.3);
                box-shadow: inset 0 0 4px rgba(0,0,0,0.3);
              "></div>
              <div style="display:flex; flex-direction:column; justify-content:space-between; height:140px; font-size:11px; font-weight:800;">
                <span style="color:#ef4444; text-shadow:0 1px 2px #000;">${maxE} m</span>
                <span style="color:#eab308; text-shadow:0 1px 2px #000;">${midE} m</span>
                <span style="color:#38bdf8; text-shadow:0 1px 2px #000;">${minE} m</span>
              </div>
            </div>
          </div>
        `;
      };

      let contourTimer = null;
      const debouncedUpdate = () => {
        clearTimeout(contourTimer);
        contourTimer = setTimeout(updateDense1mContours, 500);
      };

      map.on('moveend', debouncedUpdate);
      map.on('idle', debouncedUpdate);
      setTimeout(updateDense1mContours, 1000);

      // 5. Nút Bật/Tắt đường đồng mức & Nút Xuất Bản Vẽ A4 Nằm Ngang
      if (showControl && !map._contourControlAdded) {
        map._contourControlAdded = true;

        class ContourToggleControl {
          onAdd(m) {
            this._map = m;
            this._container = document.createElement('div');
            this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
            
            const btnContour = document.createElement('button');
            btnContour.className = 'mapboxgl-ctrl-icon mapbox-ctrl-contour-btn';
            btnContour.type = 'button';
            btnContour.title = 'Bật/Tắt đường đồng mức 1m nông trại (Contour Lines)';
            btnContour.setAttribute('aria-label', 'Toggle Contour Lines');
            btnContour.style.cssText = `
              display: flex;
              align-items: center;
              justify-content: center;
              width: 29px;
              height: 29px;
              font-size: 13px;
              font-weight: bold;
              background: ${defaultVisible ? 'rgba(245, 158, 11, 0.25)' : 'transparent'};
              color: ${defaultVisible ? '#f59e0b' : '#555'};
              border: none;
              cursor: pointer;
            `;
            btnContour.innerHTML = '⛰️';

            let isVisible = defaultVisible;

            btnContour.onclick = () => {
              isVisible = !isVisible;
              const visVal = isVisible ? 'visible' : 'none';
              if (m.getLayer('dense-1m-contour-lines')) m.setLayoutProperty('dense-1m-contour-lines', 'visibility', visVal);
              if (m.getLayer('dense-1m-contour-labels')) m.setLayoutProperty('dense-1m-contour-labels', 'visibility', visVal);

              btnContour.style.background = isVisible ? 'rgba(245, 158, 11, 0.25)' : 'transparent';
              btnContour.style.color = isVisible ? '#f59e0b' : '#555';

              const legendEl = m.getContainer().querySelector('.elevation-legend-widget-container');
              if (legendEl) legendEl.style.display = isVisible ? 'block' : 'none';
            };

            const btnExportA4 = document.createElement('button');
            btnExportA4.className = 'mapboxgl-ctrl-icon mapbox-ctrl-export-a4-btn';
            btnExportA4.type = 'button';
            btnExportA4.title = 'Xuất Bản Vẽ Trang Trại A4 Nằm Ngang (PDF & In bản vẽ)';
            btnExportA4.setAttribute('aria-label', 'Export A4 Farm CAD Drawing');
            btnExportA4.style.cssText = `
              display: flex;
              align-items: center;
              justify-content: center;
              width: 29px;
              height: 29px;
              font-size: 13px;
              font-weight: bold;
              background: transparent;
              color: #16a34a;
              border: none;
              border-top: 1px solid #e2e8f0;
              cursor: pointer;
            `;
            btnExportA4.innerHTML = '📐';

            btnExportA4.onclick = () => {
              openPublicFarmA4ExportModal(m);
            };

            this._container.appendChild(btnContour);
            this._container.appendChild(btnExportA4);
            return this._container;
          }

          onRemove() {
            if (this._container && this._container.parentNode) {
              this._container.parentNode.removeChild(this._container);
            }
            this._map = undefined;
          }
        }

        map.addControl(new ContourToggleControl(), 'top-right');

        // 6. Thêm Bảng Chú Giải Cao Độ Widget Container
        const mapContainer = map.getContainer();
        if (mapContainer && !mapContainer.querySelector('.elevation-legend-widget-container')) {
          const legendContainer = document.createElement('div');
          legendContainer.className = 'elevation-legend-widget-container';
          legendContainer.style.cssText = `
            position: absolute;
            bottom: 24px;
            right: 10px;
            z-index: 8;
            display: ${defaultVisible ? 'block' : 'none'};
            pointer-events: auto;
          `;
          mapContainer.appendChild(legendContainer);
        }
      }
    } catch (err) {
      console.warn('Cảnh báo hiển thị đường đồng mức:', err);
    }
  };

  if (map.isStyleLoaded()) {
    initContours();
  } else {
    map.once('load', initContours);
  }
}

function openPublicFarmA4ExportModal(map) {
  if (!map) return;

  const loadHtml2Pdf = () => {
    return new Promise((resolve) => {
      if (window.html2pdf) return resolve(window.html2pdf);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload = () => resolve(window.html2pdf);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  };

  let farmName = 'Nông Trại Cây Trồng';
  let ownerName = 'Khách Hàng Tanbao';
  let performerName = 'Kỹ sư Tanbao Corp';
  let farmCoords = [];
  let areaSqM = 0;
  let plantCount = 1;

  if (window.currentPlantData) {
    if (window.currentPlantData.name) farmName = window.currentPlantData.name;
    if (window.currentPlantData.farm_name) farmName = window.currentPlantData.farm_name;
    if (window.currentPlantData.farm && window.currentPlantData.farm.name) farmName = window.currentPlantData.farm.name;
    if (window.currentPlantData.owner_name) ownerName = window.currentPlantData.owner_name;
    if (window.currentPlantData.farm && window.currentPlantData.farm.owner_name) ownerName = window.currentPlantData.farm.owner_name;
    if (window.currentPlantData.farm && window.currentPlantData.farm.area) areaSqM = Math.round(parseFloat(window.currentPlantData.farm.area));
    if (window.currentPlantData.farm_boundary && window.currentPlantData.farm_boundary.coordinates) {
      farmCoords = window.currentPlantData.farm_boundary.coordinates[0];
    }
  }

  if (farmCoords.length === 0 && map.getStyle()) {
    const styleLayers = map.getStyle().layers || [];
    const farmLayers = styleLayers.filter(l => 
      l.id.includes('farm') || l.id.includes('polygon') || (l.type === 'fill' && !l.id.includes('mapbox'))
    );
    farmLayers.forEach(layer => {
      try {
        const features = map.queryRenderedFeatures({ layers: [layer.id] });
        features.forEach(f => {
          const geom = f.geometry;
          if (geom && geom.type === 'Polygon' && farmCoords.length === 0) {
            farmCoords = geom.coordinates[0];
          }
        });
      } catch (_) {}
    });
  }

  // Lật trang trại lại THẲNG ĐỨNG
  const getMajorAxisBearing = (coords) => {
    if (!coords || coords.length < 2) return 0;
    let maxDistSq = 0;
    let pA = coords[0];
    let pB = coords[1];

    for (let i = 0; i < coords.length; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        const dx = coords[j][0] - coords[i][0];
        const dy = coords[j][1] - coords[i][1];
        const d2 = dx * dx + dy * dy;
        if (d2 > maxDistSq) {
          maxDistSq = d2;
          pA = coords[i];
          pB = coords[j];
        }
      }
    }

    const rad = Math.PI / 180;
    const lat1 = pA[1] * rad;
    const lat2 = pB[1] * rad;
    const dLng = (pB[0] - pA[0]) * rad;

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    let bearing = Math.atan2(y, x) * (180 / Math.PI);
    return (bearing + 360) % 360;
  };

  const oldCenter = map.getCenter();
  const oldZoom = map.getZoom();
  const oldBearing = map.getBearing();
  const oldPitch = map.getPitch();

  let uprightBearing = 0;
  if (farmCoords && farmCoords.length >= 3) {
    const bounds = new mapboxgl.LngLatBounds();
    farmCoords.forEach(c => bounds.extend(c));
    uprightBearing = getMajorAxisBearing(farmCoords);

    try {
      map.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        bearing: uprightBearing,
        pitch: 0,
        animate: false
      });
    } catch (_) {}
  }

  let mapImageDataUrl = '';
  try {
    mapImageDataUrl = map.getCanvas().toDataURL('image/png');
  } catch (err) {
    console.warn('Cảnh báo chụp ảnh bản đồ:', err);
  }

  try {
    map.jumpTo({
      center: oldCenter,
      zoom: oldZoom,
      bearing: oldBearing,
      pitch: oldPitch
    });
  } catch (_) {}

  const getDist = (p1, p2) => {
    const R = 6371000;
    const rad = Math.PI / 180;
    const dLat = (p2[1] - p1[1]) * rad;
    const dLng = (p2[0] - p1[0]) * rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(p1[1] * rad) * Math.cos(p2[1] * rad) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
  };

  let edgeRowsHtml = '';
  let perimeter = 0;

  if (farmCoords && farmCoords.length >= 3) {
    for (let i = 0; i < farmCoords.length - 1; i++) {
      const len = getDist(farmCoords[i], farmCoords[i + 1]);
      perimeter += len;
      edgeRowsHtml += `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:4px; font-weight:600;">Cạnh ${i + 1} - ${i + 2}</td>
          <td style="padding:4px; text-align:right; font-weight:700; color:#15803d;">${len.toLocaleString('vi-VN')} m</td>
        </tr>
      `;
    }

    if (!areaSqM) {
      const rad = Math.PI / 180;
      const R = 6371000;
      let accArea = 0;
      for (let i = 0; i < farmCoords.length - 1; i++) {
        const p1 = farmCoords[i];
        const p2 = farmCoords[i + 1];
        accArea += (p2[0] - p1[0]) * rad * (2 + Math.sin(p1[1] * rad) + Math.sin(p2[1] * rad));
      }
      areaSqM = Math.round(Math.abs(accArea * R * R / 2));
    }
  } else {
    edgeRowsHtml = `<tr><td colspan="2" style="padding:6px; text-align:center; color:#94a3b8; font-style:italic;">Chưa có dữ liệu ranh giới trang trại</td></tr>`;
  }

  const center = map.getCenter();
  const zoom = map.getZoom();
  const mPerPx = (156543.03392 * Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, zoom);
  const scaleRatio = Math.round(mPerPx / 0.000264583);
  const scaleText = `1 : ${scaleRatio.toLocaleString('vi-VN')}`;
  const exportDate = new Date().toLocaleDateString('vi-VN');

  let contourInterval = 2.5 - (zoom - 16.0) * 0.5;
  contourInterval = Math.max(0.5, Math.min(10.0, contourInterval));
  contourInterval = Math.round(contourInterval * 2) / 2;

  let minEle = 735, maxEle = 765;
  const legendEl = map.getContainer().querySelector('.elevation-legend-widget-container');
  if (legendEl) {
    const text = legendEl.innerText;
    const matches = text.match(/(\d+)\s*m/g);
    if (matches && matches.length >= 2) {
      maxEle = parseInt(matches[0]);
      minEle = parseInt(matches[matches.length - 1]);
    }
  }

  let modalContainer = document.getElementById('farm-a4-export-modal');
  if (modalContainer) modalContainer.remove();

  modalContainer = document.createElement('div');
  modalContainer.id = 'farm-a4-export-modal';
  modalContainer.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 20px;
    box-sizing: border-box;
    overflow-y: auto;
  `;

  modalContainer.innerHTML = `
    <div style="
      width: 100%; max-width: 1100px;
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px; color: #fff; background: rgba(30, 41, 59, 0.9);
      padding: 12px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    ">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:22px;">📐</span>
        <div>
          <h3 style="font-size:16px; font-weight:800; margin:0; color:#4ade80;">XUẤT BẢN VẼ KỸ THUẬT TRANG TRẠI A4 NẰM NGANG</h3>
          <p style="font-size:12px; color:#94a3b8; margin:0;">Bản vẽ lật thẳng đứng theo chuẩn CAD/GIS | Khoảng cách đường đồng mức ${contourInterval}m</p>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <button id="btn-do-print-a4" style="
          background: #3b82f6; color: #fff; border: none; padding: 8px 16px;
          border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;
          display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(59,130,246,0.4);
        ">
          🖨️ In bản vẽ (Print)
        </button>
        <button id="btn-download-pdf-a4" style="
          background: #16a34a; color: #fff; border: none; padding: 8px 18px;
          border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;
          display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(22,163,74,0.4);
        ">
          📥 Tải PDF (A4 Nằm Ngang)
        </button>
        <button id="btn-close-a4-modal" style="
          background: rgba(255,255,255,0.15); color: #fff; border: none; padding: 8px 14px;
          border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;
        ">
          ✕ Đóng
        </button>
      </div>
    </div>

    <div id="a4-drawing-paper" style="
      width: 297mm; min-height: 210mm;
      background: #ffffff; color: #0f172a;
      box-shadow: 0 10px 40px rgba(0,0,0,0.6);
      border-radius: 4px; padding: 8mm; box-sizing: border-box;
      display: flex; flex-direction: column; justify-content: space-between;
      border: 2px solid #000; font-family: 'Segoe UI', Roboto, sans-serif;
    ">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2.5px solid #16a34a; padding-bottom:6px; margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <img src="/assets/logo.png" style="height:38px;" onerror="this.style.display='none'">
          <div>
            <h2 style="font-size:15px; font-weight:800; color:#15803d; margin:0; text-transform:uppercase; letter-spacing:0.5px;">TANBAO CORP — HỆ THỐNG GIS BẢN VẼ TRANG TRẠI</h2>
            <div style="font-size:10.5px; color:#475569; font-weight:600;">HỒ SƠ BẢN VẼ KỸ THUẬT ĐỊA HÌNH, RANH GIỚI & KÍCH THƯỚC CHI TIẾT</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:13px; font-weight:800; color:#0f172a; text-transform:uppercase;">BẢN VẼ A4 CHUẨN TỶ LỆ</div>
          <div style="font-size:10px; color:#64748b;">Mã Hồ Sơ: <strong>TB-CAD-PUB-${Date.now().toString().slice(-6)}</strong></div>
        </div>
      </div>

      <div style="display:flex; gap:12px; flex:1; overflow:hidden;">
        <div style="flex:1.75; border:1.5px solid #000; position:relative; overflow:hidden; border-radius:4px; display:flex; align-items:center; justify-content:center; background:#e2e8f0;">
          <img src="${mapImageDataUrl}" style="width:100%; height:100%; object-fit:cover;">
          <div style="position:absolute; top:10px; right:10px; background:rgba(255,255,255,0.92); padding:4px 10px; border-radius:4px; border:1px solid #000; font-weight:800; font-size:11px; box-shadow:0 2px 6px rgba(0,0,0,0.2);">
            ⬆️ HƯỚNG BẮC (N)
          </div>
          <div style="position:absolute; bottom:10px; left:10px; background:rgba(15,23,42,0.85); color:#fff; padding:4px 10px; border-radius:4px; font-size:10px; font-weight:700;">
            ⛰️ Đường đồng mức interval = ${contourInterval}m
          </div>
        </div>

        <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
          <div style="border:1.5px solid #000; border-radius:4px; padding:8px; background:#f0fdf4;">
            <div style="font-weight:800; font-size:11px; color:#15803d; border-bottom:1px solid #bbf7d0; padding-bottom:4px; margin-bottom:6px; text-transform:uppercase;">
              📊 THỐNG KÊ KÍCH THƯỚC TRANG TRẠI
            </div>
            <table style="width:100%; font-size:10.5px; border-collapse:collapse;">
              <tr>
                <td style="padding:3px 0; color:#475569;">Diện tích trang trại:</td>
                <td style="padding:3px 0; text-align:right; font-weight:800; color:#15803d;">${areaSqM.toLocaleString('vi-VN')} m² (${(areaSqM/10000).toFixed(2)} ha)</td>
              </tr>
              <tr>
                <td style="padding:3px 0; color:#475569;">Chu vi ranh giới:</td>
                <td style="padding:3px 0; text-align:right; font-weight:800; color:#0f172a;">${perimeter.toLocaleString('vi-VN')} m</td>
              </tr>
              ${plantCount ? `
              <tr>
                <td style="padding:3px 0; color:#475569;">Số lượng cây trồng:</td>
                <td style="padding:3px 0; text-align:right; font-weight:800; color:#2563eb;">${plantCount} cây</td>
              </tr>` : ''}
              <tr>
                <td style="padding:3px 0; color:#475569;">Chênh lệch cao độ:</td>
                <td style="padding:3px 0; text-align:right; font-weight:800; color:#d97706;">${minEle}m — ${maxEle}m (Δ ${maxEle - minEle}m)</td>
              </tr>
            </table>
          </div>

          <div style="flex:1; border:1.5px solid #000; border-radius:4px; padding:8px; background:#fff; overflow-y:auto;">
            <div style="font-weight:800; font-size:11px; color:#1e293b; border-bottom:1px solid #cbd5e1; padding-bottom:4px; margin-bottom:6px; text-transform:uppercase;">
              📏 CHIỀU DÀI CÁC CẠNH RANH GIỚI
            </div>
            <table style="width:100%; font-size:10px; border-collapse:collapse;">
              <thead>
                <tr style="background:#f1f5f9; text-align:left; border-bottom:1px solid #cbd5e1;">
                  <th style="padding:4px;">Đoạn Cạnh</th>
                  <th style="padding:4px; text-align:right;">Chiều Dài (m)</th>
                </tr>
              </thead>
              <tbody>
                ${edgeRowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style="margin-top:10px; border:2px solid #000; background:#fff;">
        <table style="width:100%; border-collapse:collapse; font-size:10.5px;">
          <tr>
            <td style="width:35%; border-right:1.5px solid #000; padding:6px 10px; vertical-align:top;">
              <div style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase;">TÊN TRANG TRẠI</div>
              <div style="font-size:13px; font-weight:800; color:#15803d; margin-top:2px;">🏡 ${farmName}</div>
            </td>
            <td style="width:25%; border-right:1.5px solid #000; padding:6px 10px; vertical-align:top;">
              <div style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase;">KHÁCH HÀNG / NÔNG HỘ</div>
              <div style="font-size:11.5px; font-weight:700; color:#0f172a; margin-top:2px;">👤 ${ownerName}</div>
            </td>
            <td style="width:20%; border-right:1.5px solid #000; padding:6px 10px; vertical-align:top;">
              <div style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase;">NGƯỜI THỰC HIỆN</div>
              <div style="font-size:11.5px; font-weight:700; color:#0f172a; margin-top:2px;">✍️ ${performerName}</div>
            </td>
            <td style="width:10%; border-right:1.5px solid #000; padding:6px 10px; vertical-align:top;">
              <div style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase;">NGÀY XUẤT</div>
              <div style="font-size:11px; font-weight:700; margin-top:2px;">📅 ${exportDate}</div>
            </td>
            <td style="width:10%; padding:6px 10px; vertical-align:top;">
              <div style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase;">TỶ LỆ</div>
              <div style="font-size:12px; font-weight:800; color:#2563eb; margin-top:2px;">📐 ${scaleText}</div>
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;

  document.body.appendChild(modalContainer);

  document.getElementById('btn-close-a4-modal').onclick = () => modalContainer.remove();

  modalContainer.onclick = (e) => {
    if (e.target === modalContainer) modalContainer.remove();
  };

  document.getElementById('btn-do-print-a4').onclick = () => {
    const paperHtml = document.getElementById('a4-drawing-paper').outerHTML;
    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ban_ve_trang_trai_${farmName.replace(/\s+/g, '_')}</title>
        <style>
          @page { size: A4 landscape; margin: 0; }
          body { margin: 0; padding: 0; background: #fff; }
          #a4-drawing-paper { width: 297mm !important; height: 210mm !important; box-shadow: none !important; border-radius: 0 !important; }
        </style>
      </head>
      <body>
        ${paperHtml}
        <script>
          setTimeout(() => { window.print(); window.close(); }, 500);
        <\/script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  document.getElementById('btn-download-pdf-a4').onclick = async () => {
    const btn = document.getElementById('btn-download-pdf-a4');
    btn.innerHTML = '⏳ Đang tạo PDF...';
    btn.disabled = true;

    const html2pdfLib = await loadHtml2Pdf();
    const element = document.getElementById('a4-drawing-paper');

    if (html2pdfLib && element) {
      const opt = {
        margin: 0,
        filename: `Ban_ve_trang_trai_${farmName.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      html2pdfLib().set(opt).from(element).save().then(() => {
        btn.innerHTML = '📥 Tải PDF (A4 Nằm Ngang)';
        btn.disabled = false;
      }).catch(err => {
        console.error('Lỗi xuất PDF:', err);
        btn.innerHTML = '📥 Tải PDF (A4 Nằm Ngang)';
        btn.disabled = false;
        document.getElementById('btn-do-print-a4').click();
      });
    } else {
      btn.innerHTML = '📥 Tải PDF (A4 Nằm Ngang)';
      btn.disabled = false;
      document.getElementById('btn-do-print-a4').click();
    }
  };
}

