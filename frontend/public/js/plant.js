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
    if (!term) return '';
    
    // Extract text in parentheses, e.g. "Sầu riêng(durian)" -> "durian"
    const match = term.match(/\(([^)]+)\)/);
    let baseName = '';
    if (match && match[1]) {
      baseName = match[1].trim();
    } else {
      baseName = term;
    }
    
    const normalized = baseName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    return `/assets/crop/${normalized}`;
  }

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

  // Construct UI
  let html = `
    <!-- Top Header Navigation -->
    <header class="app-header">
      <div class="header-left">
        <img src="/assets/logo.png" alt="Tanbao Corp" class="header-logo">
        <div class="header-titles">
          <h1 class="header-app-name">Plant Book</h1>
          <span class="header-tagline">Sổ Tay Cây Trồng Thông Minh</span>
        </div>
      </div>
      <div class="header-right">
        <button class="btn btn-secondary btn-sm" onclick="sharePage()">
          <i class="fa-solid fa-share-nodes"></i> Chia sẻ
        </button>
      </div>
    </header>

    <!-- Main Container -->
    <main class="main-container">
      <!-- Left Column (Plant Info, Timeline) -->
      <div class="left-col">
        </div>
      </div>
      
      <!-- Right Column (Care action panels, Media) -->
      <div class="right-col">
        <!-- Care Actions (NFC/QR scanner Quick Log) -->
        <div class="glass-panel glass-card">
          <h2 class="sec-title"><i class="fa-solid fa-heart-pulse" style="color: var(--green-bright)"></i> Ghi nhật ký nhanh</h2>
          <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.4;">
            Chọn quy trình chăm sóc bên dưới để điền thông tin nhanh (không cần đăng nhập).
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
  `;

  // 3. Media Gallery
  if (media.length) {
    html += `
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
    `;
  }

  html += `
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

  // Initialize Mapbox plant location map if coordinates or farm polygon exist
  if (hasMap) {
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
      attributionControl: false
    });
    plantMap.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    plantMap.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

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
