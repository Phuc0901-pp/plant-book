/* Plant Book Agtech (c) 2026 TBSG Agtech. All Rights Reserved. Enterprise Protected Asset */
// Universal Helper to extract Exact GPS Center [lng, lat] of ANY Farm
function getFarmExactGpsCenter(farm, plants) {
  if (!farm) return null;

  // 1. Try to extract from polygon_coordinates
  let raw = farm.polygon_coordinates;
  let coords = [];
  try {
    coords = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
  } catch(e) { coords = []; }

  while (Array.isArray(coords) && coords.length > 0 && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
    coords = coords[0];
  }

  if (Array.isArray(coords) && coords.length > 0) {
    let sumLng = 0, sumLat = 0, count = 0;
    coords.forEach(pt => {
      if (Array.isArray(pt) && pt.length >= 2) {
        let v1 = parseFloat(pt[0]);
        let v2 = parseFloat(pt[1]);
        if (!isNaN(v1) && !isNaN(v2)) {
          let lng = v1 > 50 ? v1 : v2;
          let lat = v2 < 50 ? v2 : v1;
          sumLng += lng;
          sumLat += lat;
          count++;
        }
      }
    });
    if (count > 0) {
      return [sumLng / count, sumLat / count];
    }
  }

  // 2. Try farm's direct latitude / longitude fields if present
  if (farm.latitude && farm.longitude) {
    let v1 = parseFloat(farm.longitude);
    let v2 = parseFloat(farm.latitude);
    if (!isNaN(v1) && !isNaN(v2)) {
      let lng = v1 > 50 ? v1 : v2;
      let lat = v2 < 50 ? v2 : v1;
      return [lng, lat];
    }
  }

  // 3. Try to calculate average from farm's plants
  const farmPlants = (plants || []).filter(p => p.farm_id === farm.id && p.latitude && p.longitude);
  if (farmPlants.length > 0) {
    let sumLng = 0, sumLat = 0, count = 0;
    farmPlants.forEach(p => {
      let v1 = parseFloat(p.longitude);
      let v2 = parseFloat(p.latitude);
      if (!isNaN(v1) && !isNaN(v2)) {
        let lng = v1 > 50 ? v1 : v2;
        let lat = v2 < 50 ? v2 : v1;
        sumLng += lng;
        sumLat += lat;
        count++;
      }
    });
    if (count > 0) {
      return [sumLng / count, sumLat / count];
    }
  }

  return null;
}

// Universal Helper to extract closed Polygon GeoJSON Ring [[lng, lat], ...]
function getFarmPolygonGeoJson(farm) {
  let raw = farm.polygon_coordinates;
  let coords = [];
  try {
    coords = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
  } catch(e) { coords = []; }

  while (Array.isArray(coords) && coords.length > 0 && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
    coords = coords[0];
  }

  if (!Array.isArray(coords) || coords.length < 3) return null;

  const validRing = [];
  coords.forEach(pt => {
    if (Array.isArray(pt) && pt.length >= 2) {
      let v1 = parseFloat(pt[0]);
      let v2 = parseFloat(pt[1]);
      if (!isNaN(v1) && !isNaN(v2)) {
        let lng = v1 > 50 ? v1 : v2;
        let lat = v2 < 50 ? v2 : v1;
        validRing.push([lng, lat]);
      }
    }
  });

  if (validRing.length >= 3) {
    if (validRing[0][0] !== validRing[validRing.length - 1][0] || 
        validRing[0][1] !== validRing[validRing.length - 1][1]) {
      validRing.push(validRing[0]);
    }
    return validRing;
  }
  return null;
}

function sanitizeCoordinates(rawCoords) {
  let coords = [];
  try {
    coords = typeof rawCoords === 'string' ? JSON.parse(rawCoords) : (rawCoords || []);
  } catch(e) { return []; }

  while (Array.isArray(coords) && coords.length > 0 && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
    coords = coords[0];
  }

  if (!Array.isArray(coords)) return [];

  const validPts = [];
  coords.forEach(pt => {
    if (Array.isArray(pt) && pt.length >= 2) {
      let v1 = parseFloat(pt[0]);
      let v2 = parseFloat(pt[1]);
      if (!isNaN(v1) && !isNaN(v2)) {
        let lng = v1 > 50 ? v1 : v2;
        let lat = v2 < 50 ? v2 : v1;
        validPts.push([lng, lat]);
      }
    }
  });
  return validPts;
}

function removeContourLinesFromMap(map) {
  if (!map) return;
  try {
    const layers = ['dense-1m-contour-lines', 'dense-1m-contour-labels', 'dense-1m-contour-labels-major'];
    layers.forEach(l => {
      if (map.getLayer && map.getLayer(l)) map.removeLayer(l);
    });
    if (map.getSource && map.getSource('dense-1m-contours')) {
      map.removeSource('dense-1m-contours');
    }
    const container = map.getContainer ? map.getContainer() : null;
    const legendEl = container ? container.querySelector('.elevation-legend-widget-container') : null;
    if (legendEl) legendEl.remove();
  } catch (err) {
    console.warn('Lỗi gỡ bỏ đường đồng mức:', err);
  }
}
window.removeContourLinesFromMap = removeContourLinesFromMap;

// Helper tính khoảng cách giữa 2 điểm GPS (Haversine Formula)
function getDist(p1, p2) {
  if (!p1 || !p2) return 0;
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (p2[1] - p1[1]) * rad;
  const dLng = (p2[0] - p1[0]) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(p1[1] * rad) * Math.cos(p2[1] * rad) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

// Helper cắt gọn mã cây trồng hiển thị trên icon marker bản đồ (VD: KH001-001 -> 1, KH001-058 -> 58)
function getShortTreeCode(treeCode, plantId) {
  const code = String(treeCode || plantId || '').trim();
  if (!code) return '';
  const match = code.match(/(\d+)$/);
  if (match) {
    return String(parseInt(match[1], 10));
  }
  return code;
}

// Bảng màu phân biệt trang trại theo từng Nông hộ / Khách hàng
const CUSTOMER_PALETTE = [
  '#10b981', // Emerald green
  '#3b82f6', // Royal blue
  '#f59e0b', // Amber gold
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#ef4444', // Red
  '#84cc16'  // Lime
];

function getCustomerColor(userId) {
  if (!userId) return '#10b981';
  const idNum = parseInt(userId, 10);
  if (isNaN(idNum)) return '#10b981';
  return CUSTOMER_PALETTE[Math.abs(idNum) % CUSTOMER_PALETTE.length];
}

const DEFAULT_MAPBOX_TOKEN = typeof atob === 'function' ? atob('cGsuZXlKMUlqb2ljR2gxWTIxbGIyMWxieUlzSW1FaU9pSmpiWEYwT1RSNk9HTXdNbkk1TW5OelptZHVNekoxY210cUluMC5JWC1vWndJc1BVRXcxRzEwZVJfSnNR') : '';
let mapboxTokenFetched = false;
async function ensureMapboxToken() {
  if (mapboxTokenFetched && mapboxgl.accessToken) return;
  try {
    const res = await fetch(API + '/config/mapbox-token');
    if (res.ok) {
      const data = await res.json();
      if (data && data.token) {
        mapboxgl.accessToken = data.token;
        mapboxTokenFetched = true;
        return;
      }
    }
  } catch (err) {
    console.warn('[Mapbox Admin] Không thể lấy token từ backend (đang khởi động/offline), kích hoạt token dự phòng:', err.message);
  }
  mapboxgl.accessToken = DEFAULT_MAPBOX_TOKEN;
  mapboxTokenFetched = true;
}
let dbMap = null;
let gMap = null;
let drawControl = null;
let activeFarmId = null;
let currentFarms = [];
let currentPlants = [];

// Populate farms select in plant modal
async function loadFarmsDropdown() {
  try {
    const farms = await api('/farms');
    const select = document.getElementById('f-farm-id');
    if (select) {
      select.innerHTML = '<option value="">— Không thuộc trang trại nào —</option>' + 
        farms.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
    }
  } catch (err) {
    console.error('Error loading farms for dropdown:', err);
  }
}

// Initialize Overview map on Dashboard (Trang tổng quan: Hiển thị ghim màu theo từng khách hàng, KHÔNG vẽ đường đồng mức)
function initDashboardMap(farms, plants) {
  const mapContainer = document.getElementById('dashboard-map');
  if (!mapContainer) return;
  
  if (dashboardMap) {
    try {
      dashboardMap.remove();
    } catch (e) {}
    dashboardMap = null;
  }
  dashboardMarkers = [];

  mapContainer.innerHTML = '';
  const mapDiv = document.createElement('div');
  mapDiv.style.width = '100%';
  mapDiv.style.height = '100%';
  mapContainer.appendChild(mapDiv);

  const map = new mapboxgl.Map({
    container: mapDiv,
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center: [107.1, 11.6],
    zoom: 6.2,
    maxZoom: 22,
    preserveDrawingBuffer: true
  });
  dashboardMap = map;

  function updateDashboardFarmPins(currentZoom) {
    const isCloseZoom = currentZoom >= 12;
    document.querySelectorAll('.farm-dashboard-pin').forEach(el => {
      if (isCloseZoom) {
        el.classList.remove('is-dot');
        el.classList.add('is-full');
      } else {
        el.classList.remove('is-full');
        el.classList.add('is-dot');
      }
    });
  }

  map.on('zoom', () => {
    const zoom = map.getZoom();
    if (zoom < 16.5) {
      mapDiv.classList.add('low-zoom');
    } else {
      mapDiv.classList.remove('low-zoom');
    }
    updateDashboardFarmPins(zoom);
  });
  if (map.getZoom() < 16.5) {
    mapDiv.classList.add('low-zoom');
  }

  map.addControl(new mapboxgl.NavigationControl());
  map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

  const onMapLoad = () => {
    const bounds = new mapboxgl.LngLatBounds();
    let hasBounds = false;

    farms.forEach(farm => {
      const farmColor = getCustomerColor(farm.user_id);
      const center = getFarmExactGpsCenter(farm, plants);
      
      // 1. Draw polygon if available
      const polyRing = getFarmPolygonGeoJson(farm);
      if (polyRing) {
        const farmSourceId = `farm-source-${farm.id}`;
        const farmLayerId = `farm-layer-${farm.id}`;
        const farmOutlineId = `farm-outline-${farm.id}`;

        if (!map.getSource(farmSourceId)) {
          map.addSource(farmSourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [polyRing]
              }
            }
          });

          map.addLayer({
            id: farmLayerId,
            type: 'fill',
            source: farmSourceId,
            paint: {
              'fill-color': farmColor,
              'fill-opacity': 0.35
            }
          });

          map.addLayer({
            id: farmOutlineId,
            type: 'line',
            source: farmSourceId,
            paint: {
              'line-color': farmColor,
              'line-width': 2.5
            }
          });

          map.on('click', farmLayerId, (e) => {
            new mapboxgl.Popup()
              .setLngLat(e.lngLat)
              .setHTML(`
                <div class="map-tooltip">
                  <h4 style="color:${farmColor}"><i data-lucide="home" class="lucide-sm"></i> Trang trại: ${esc(farm.name)}</h4>
                  <p><i data-lucide="user" class="lucide-sm"></i> Khách hàng: <strong>${esc(farm.user_name || 'Chưa gán')}</strong></p>
                  <p>Diện tích: <strong>${farm.area ? Math.round(parseFloat(farm.area)).toLocaleString('vi-VN') : 0} m²</strong></p>
                  <div style="margin-top:8px">
                    <button class="btn btn-primary btn-sm" onclick="showPage('gis'); selectFarm(${farm.id});">Xem trang trại</button>
                  </div>
                </div>
              `)
              .addTo(map);
          });

          map.on('mouseenter', farmLayerId, () => map.getCanvas().style.cursor = 'pointer');
          map.on('mouseleave', farmLayerId, () => map.getCanvas().style.cursor = '');
        }
      }

      // 2. Add Pin Marker at exact GPS Center
      if (center) {
        const [centerLng, centerLat] = center;
        if (centerLng >= 102 && centerLng <= 112 && centerLat >= 9 && centerLat <= 23) {
          bounds.extend([centerLng, centerLat]);
          hasBounds = true;
        }

        const pinEl = document.createElement('div');
        const initialZoom = map.getZoom ? map.getZoom() : 6.2;
        pinEl.className = `farm-dashboard-pin ${initialZoom >= 12 ? 'is-full' : 'is-dot'}`;
        
        pinEl.innerHTML = `
          <div class="farm-pin-dot-wrap" title="Trang trại: ${esc(farm.name)} (Bấm để phóng to)">
            <div class="farm-pin-pulse" style="background:${farmColor};"></div>
            <div class="farm-pin-dot" style="background:${farmColor};">
              <i data-lucide="home" class="lucide-sm" style="font-size:7.5px; color:#ffffff;"></i>
            </div>
          </div>
          <div class="farm-pin-badge" style="background:${farmColor};">
            <i data-lucide="home" class="lucide-sm"></i> ${esc(farm.name)}
            ${farm.user_name ? `<small class="farm-pin-user">👤 ${esc(farm.user_name)}</small>` : ''}
          </div>
        `;

        // Click to smoothly fly in when in Dot mode
        pinEl.addEventListener('click', (ev) => {
          if (map.getZoom() < 12) {
            ev.stopPropagation();
            map.flyTo({
              center: [centerLng, centerLat],
              zoom: 15.5,
              essential: true,
              duration: 1000
            });
          }
        });

        const farmMarker = new mapboxgl.Marker({ element: pinEl, anchor: 'center' })
          .setLngLat([centerLng, centerLat])
          .setPopup(new mapboxgl.Popup({ offset: 20 })
            .setHTML(`
              <div class="map-tooltip">
                <h4 style="color:${farmColor}"><i data-lucide="home" class="lucide-sm"></i> Trang trại: ${esc(farm.name)}</h4>
                <p><i data-lucide="user" class="lucide-sm"></i> Khách hàng: <strong>${esc(farm.user_name || 'Chưa gán')}</strong></p>
                <p>Diện tích: <strong>${farm.area ? Math.round(parseFloat(farm.area)).toLocaleString('vi-VN') : 0} m²</strong></p>
                <div style="margin-top:8px">
                  <button class="btn btn-primary btn-sm" onclick="showPage('gis'); selectFarm(${farm.id});">Xem trang trại</button>
                </div>
              </div>
            `)
          )
          .addTo(map);

        dashboardMarkers.push({ marker: farmMarker, element: pinEl });
      }
    });

    if (hasBounds) {
      map.fitBounds(bounds, { padding: 50, minZoom: 6.0, maxZoom: 13, duration: 800 });
    } else {
      map.flyTo({ center: [107.1, 11.6], zoom: 6.2, duration: 800 });
    }

    updateDashboardFarmPins(map.getZoom());

    if (currentDashboardFilter !== 'all') {
      filterDashboard(currentDashboardFilter);
    }
  };

  if (map.isStyleLoaded() || map.loaded()) {
    onMapLoad();
  } else {
    map.once('load', onMapLoad);
  }

  setTimeout(() => {
    try { if (map) map.resize(); } catch(_) {}
  }, 250);
}

// Initialize GIS Page
async function initGisPage(targetFarmId = null) {
  if (targetFarmId) {
    window._pendingSelectFarmId = targetFarmId;
  }
  
  if (!window._pendingSelectFarmId) {
    activeFarmId = null;
    document.getElementById('gis-back-btn').style.display = 'none';
    document.getElementById('gis-sidebar-title').innerHTML = '<i data-lucide="map" class="lucide-sm" style="color:var(--green)"></i> Trang trại';
    document.getElementById('gis-header-actions').style.display = 'block';
    switchGisView('list');
  }
  
  try {
    await ensureMapboxToken();
    const [farms, plants, users] = await Promise.all([
      api('/farms'),
      api('/plants'),
      api('/users')
    ]);
    currentFarms = farms;
    currentPlants = plants;
    
    // Populate customer filter dropdown
    const filterSelect = document.getElementById('filter-farm-user');
    if (filterSelect) {
      filterSelect.innerHTML = '<option value="all">Tất cả khách hàng (nông hộ)</option>' +
        users.map(u => `<option value="${u.id}">${esc(u.full_name)} (${u.role === 'admin' ? 'Admin' : 'Nông hộ'})</option>`).join('');
    }
    
    renderFarmsList(farms);
    initGisMap(farms, plants);

    // Tự động nhảy bản đồ tới trang trại đang được chọn nếu có
    if (window._pendingSelectFarmId) {
      const farmToSelect = window._pendingSelectFarmId;
      selectFarm(farmToSelect);
    }
  } catch (err) {
    toast('Lỗi tải dữ liệu GIS: ' + err.message, 'error');
  }
}

function switchGisView(view) {
  document.getElementById('gis-view-list').style.display = view === 'list' ? 'block' : 'none';
  document.getElementById('gis-view-form').style.display = view === 'form' ? 'block' : 'none';
  document.getElementById('gis-view-details').style.display = view === 'details' ? 'block' : 'none';
  const footer = document.getElementById('gis-detail-footer');
  if (footer) footer.style.display = view === 'details' ? 'flex' : 'none';
}

function formatSmartArea(val) {
  const num = parseFloat(val);
  if (!num || isNaN(num) || num <= 0) return '0 m²';
  if (num >= 10000) {
    const ha = num / 10000;
    const haFormatted = ha.toLocaleString('vi-VN', {
      minimumFractionDigits: (ha % 1 === 0) ? 0 : (ha < 10 ? 2 : 1),
      maximumFractionDigits: 2
    });
    return `${haFormatted} ha`;
  }
  return `${Math.round(num).toLocaleString('vi-VN')} m²`;
}
window.formatSmartArea = formatSmartArea;

function renderFarmsList(farms) {
  const uniqueFarms = Array.from(new Map((farms || []).map(f => [f.id, f])).values());
  const container = document.getElementById('farms-list-container');
  if (!uniqueFarms.length) {
    container.innerHTML = '<div class="empty-state"><i data-lucide="map" class="lucide-sm"></i><p>Chưa có trang trại nào. Hãy thêm mới!</p></div>';
    return;
  }

  container.innerHTML = uniqueFarms.map(f => {
    const rawAreaFormatted = f.area ? Math.round(parseFloat(f.area)).toLocaleString('vi-VN') + ' m²' : '0 m²';
    const smartArea = formatSmartArea(f.area);
    const plantCountStr = (f.plant_count || 0).toLocaleString('vi-VN');
    const ownerName = esc(f.user_name || 'Chưa gán nông hộ');

    return `
      <div class="farm-item" id="farm-item-${f.id}" data-farm-id="${f.id}" onclick="selectFarm(${f.id})">
        <!-- 1. Header: Avatar + Title + Arrow Indicator -->
        <div class="farm-item-header">
          <div class="farm-item-title-wrap">
            <div class="farm-item-avatar">
              <i data-lucide="map-pin" class="lucide-xs"></i>
            </div>
            <div class="farm-item-name" title="${esc(f.name)}">${esc(f.name)}</div>
          </div>
          <div class="farm-item-arrow">
            <i data-lucide="chevron-right" class="lucide-xs"></i>
          </div>
        </div>

        <!-- 2. Owner / Enterprise Sub-row -->
        <div class="farm-item-owner" title="Chủ thể quản lý: ${ownerName}">
          <i data-lucide="building-2" class="lucide-xs" style="color:#64748b;"></i>
          <span>${ownerName}</span>
        </div>

        <!-- 3. Key Agronomic Metrics Chips (Area, Plants & Live API Quick Action) -->
        <div class="farm-item-chips" style="display:flex; align-items:center; justify-content:space-between; gap:6px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:6px;">
            <div class="farm-chip" title="Tổng diện tích: ${rawAreaFormatted}">
              <i data-lucide="ruler" class="lucide-xs" style="color:#059669;"></i>
              <span>${smartArea}</span>
            </div>
            <div class="farm-chip" title="Số lượng cây trồng thực tế">
              <i data-lucide="sprout" class="lucide-xs" style="color:#10b981;"></i>
              <span>${plantCountStr} cây</span>
            </div>
          </div>
          <button type="button"
            onclick="event.stopPropagation(); copyFarmLiveDatasetApiLink(${f.id})"
            style="display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:6px; font-size:10.5px; font-weight:700; cursor:pointer; border:1px solid ${f.api_enabled === false ? '#fecaca' : '#a7f3d0'}; background:${f.api_enabled === false ? '#fef2f2' : '#ecfdf5'}; color:${f.api_enabled === false ? '#dc2626' : '#047857'}; transition:all 0.15s;"
            title="${f.api_enabled === false ? 'API đang bị ngắt - Bấm để xem link' : 'Bấm để lấy Link Live API dữ liệu của trang trại này'}">
            <i data-lucide="${f.api_enabled === false ? 'unplug' : 'webhook'}" class="lucide-xs"></i>
            <span>${f.api_enabled === false ? 'API: Đã Ngắt' : 'Lấy API'}</span>
          </button>
        </div>

        <!-- 4. Compliance & Traceability Badges (VietGAP, PUC) -->
        ${(f.vietgap_cert_number || f.puc_code) ? `
          <div class="farm-item-badges">
            ${f.vietgap_cert_number ? `
              <span class="farm-badge farm-badge-vietgap" title="Chứng nhận VietGAP: ${esc(f.vietgap_cert_number)}">
                <i data-lucide="shield-check" class="lucide-xs"></i>
                <span>VietGAP: <strong>${esc(f.vietgap_cert_number)}</strong></span>
              </span>
            ` : ''}
            ${f.puc_code ? `
              <span class="farm-badge farm-badge-puc" title="Mã số Vùng trồng (PUC): ${esc(f.puc_code)}">
                <i data-lucide="globe" class="lucide-xs"></i>
                <span>PUC: <strong>${esc(f.puc_code)}</strong></span>
              </span>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  if (typeof window.refreshIcons === 'function') {
    window.refreshIcons();
  }
}

function initGisMap(farms, plants) {
  const container = document.getElementById('gis-map');
  if (!container) return;

  // Nếu bản đồ gMap đã được khởi tạo, tái sử dụng để không bị reload / chớp trắng bản đồ
  if (gMap) {
    drawFarmsAndPlantsLayers(farms, plants);
    try { gMap.resize(); } catch(_) {}
    return;
  }
  
  container.innerHTML = '';
  
  gMap = new mapboxgl.Map({
    container: 'gis-map',
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center: [106.3, 12.5],
    zoom: 5,
    maxZoom: 22,
    preserveDrawingBuffer: true
  });

  gMap.on('zoom', () => {
    const zoom = gMap.getZoom();
    if (zoom < 16.5) {
      container.classList.add('low-zoom');
    } else {
      container.classList.remove('low-zoom');
    }
  });
  if (gMap.getZoom() < 16.5) {
    container.classList.add('low-zoom');
  }

  gMap.addControl(new mapboxgl.NavigationControl());
  gMap.addControl(new mapboxgl.FullscreenControl(), 'top-right');

  drawControl = new MapboxDraw({
    displayControlsDefault: false,
    controls: {
      polygon: true,
      trash: true
    },
    defaultMode: 'simple_select'
  });
  gMap.addControl(drawControl);

  gMap.on('draw.create', updateAreaDisplay);
  gMap.on('draw.update', updateAreaDisplay);
  gMap.on('draw.delete', updateAreaDisplay);

  // Click map handler cho Chế độ Gắn Point Cây cụ thể hoặc Chế độ Import GIS Cây Trồng
  gMap.on('click', (e) => {
    if (!isGisImportMode && !pinningPlantTargetId) return;

    // Ngăn chặn trigger click nếu đang trong chế độ vẽ polygon
    if (drawControl && drawControl.getMode && drawControl.getMode() !== 'simple_select') return;

    const { lng, lat } = e.lngLat;

    // Trường hợp 1: Đang gắn điểm Point GPS cho 1 cây cụ thể từ danh sách Sidebar
    if (pinningPlantTargetId) {
      assignGpsToExistingPlant(pinningPlantTargetId, lat, lng);
      return;
    }

    // Trường hợp 2: Chế độ Import GIS tạo cây mới
    if (gisImportTempMarker) {
      gisImportTempMarker.remove();
      gisImportTempMarker = null;
    }

    const el = document.createElement('div');
    el.className = 'gis-temp-click-pin';
    el.style.cssText = 'font-size:32px; color:#ef4444; filter:drop-shadow(0 4px 10px rgba(0,0,0,0.6)); pointer-events:none;';
    el.innerHTML = '<i data-lucide="map-pin" class="lucide-sm"></i>';

    gisImportTempMarker = new mapboxgl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(gMap);

    openPlantModalForGisClick(lng, lat);
  });

  gMap.on('load', () => {
    // ── Cấu hình các nguồn ảnh vệ tinh độ nét cao (Phương án A) ──
    try {
      if (!gMap.getSource('esri-satellite-src')) {
        gMap.addSource('esri-satellite-src', {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          maxzoom: 18,
          attribution: '&copy; Esri World Imagery'
        });
      }

      if (!gMap.getSource('google-satellite-src')) {
        gMap.addSource('google-satellite-src', {
          type: 'raster',
          tiles: [
            'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
          ],
          tileSize: 256,
          maxzoom: 20,
          attribution: '&copy; Google Satellite'
        });
      }

      // Add raster layers (Google Satellite mặc định hiển thị vì độ nét cao và cập nhật thực tế)
      if (!gMap.getLayer('esri-satellite-layer')) {
        gMap.addLayer({
          id: 'esri-satellite-layer',
          type: 'raster',
          source: 'esri-satellite-src',
          layout: { visibility: 'none' },
          paint: { 'raster-opacity': 1 }
        });
      }

      if (!gMap.getLayer('google-satellite-layer')) {
        gMap.addLayer({
          id: 'google-satellite-layer',
          type: 'raster',
          source: 'google-satellite-src',
          layout: { visibility: 'visible' },
          paint: { 'raster-opacity': 1 }
        });
      }
    } catch(layerErr) {
      console.warn('Satellite source init warning:', layerErr);
    }

    drawFarmsAndPlantsLayers(farms, plants);
  });

  setTimeout(() => {
    try { if (gMap) gMap.resize(); } catch(_) {}
  }, 300);
}

// ── Chuyển đổi Nguồn Ảnh Vệ Tinh (Google mặc định / ESRI Clarity / Mapbox) ──
let currentSatelliteSource = 'google';

function switchSatelliteSource(source) {
  if (!gMap) return;
  currentSatelliteSource = source;

  // Cập nhật trạng thái active của nút bấm UI
  const btnEsri = document.getElementById('btn-sat-esri');
  const btnGoogle = document.getElementById('btn-sat-google');
  const btnMapbox = document.getElementById('btn-sat-mapbox');

  if (btnEsri) btnEsri.classList.toggle('active', source === 'esri');
  if (btnGoogle) btnGoogle.classList.toggle('active', source === 'google');
  if (btnMapbox) btnMapbox.classList.toggle('active', source === 'mapbox');

  try {
    const esriLayer = gMap.getLayer('esri-satellite-layer');
    const googleLayer = gMap.getLayer('google-satellite-layer');

    if (source === 'esri') {
      if (esriLayer) gMap.setLayoutProperty('esri-satellite-layer', 'visibility', 'visible');
      if (googleLayer) gMap.setLayoutProperty('google-satellite-layer', 'visibility', 'none');
      toast('Đã chuyển sang Ảnh Vệ Tinh ESRI Clarity (Siêu nét, tối ưu vùng trồng)', 'info');
    } else if (source === 'google') {
      if (esriLayer) gMap.setLayoutProperty('esri-satellite-layer', 'visibility', 'none');
      if (googleLayer) gMap.setLayoutProperty('google-satellite-layer', 'visibility', 'visible');
      toast('Đã chuyển sang Ảnh Vệ Tinh Google Satellite', 'info');
    } else if (source === 'mapbox') {
      if (esriLayer) gMap.setLayoutProperty('esri-satellite-layer', 'visibility', 'none');
      if (googleLayer) gMap.setLayoutProperty('google-satellite-layer', 'visibility', 'none');
      toast('Đã chuyển sang Ảnh Vệ Tinh Mapbox', 'info');
    }
  } catch (err) {
    console.warn('Error toggling satellite source:', err);
  }
}
window.switchSatelliteSource = switchSatelliteSource;

// Chuyển đổi Bật/Tắt chế độ Import GIS (Click chọn vị trí cây trên bản đồ) & Gắn Point cho cây cụ thể
let isGisImportMode = false;
let gisImportTempMarker = null;
let pinningPlantTargetId = null;
let pinningPlantTargetCode = null;

function cancelAllGisPinModes() {
  isGisImportMode = false;
  pinningPlantTargetId = null;
  pinningPlantTargetCode = null;

  const btn = document.getElementById('btn-gis-import-mode');
  const banner = document.getElementById('gis-import-active-banner');
  const bannerText = document.getElementById('gis-import-banner-text');

  if (btn) {
    btn.innerHTML = '<i data-lucide="map-pin" class="lucide-sm"></i> Import GIS (Click chọn vị trí cây trên bản đồ)';
    btn.style.background = '#10b981';
    btn.style.borderColor = '#059669';
  }
  if (banner) banner.style.display = 'none';
  if (bannerText) {
    bannerText.innerHTML = '<i data-lucide="crosshair" class="lucide-sm"></i> Đang bật Chế độ Import GIS: Click chọn vị trí cây trên bản đồ để nhập GPS &amp; Thông tin!';
  }
  if (gMap) gMap.getCanvas().style.cursor = '';
  if (gisImportTempMarker) {
    gisImportTempMarker.remove();
    gisImportTempMarker = null;
  }
  if (typeof refreshCurrentSidebarPlantListUI === 'function') {
    refreshCurrentSidebarPlantListUI();
  }
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}
window.cancelAllGisPinModes = cancelAllGisPinModes;

function toggleGisImportMode(forceState) {
  pinningPlantTargetId = null;
  pinningPlantTargetCode = null;

  if (typeof forceState === 'boolean') {
    isGisImportMode = forceState;
  } else {
    isGisImportMode = !isGisImportMode;
  }

  const btn = document.getElementById('btn-gis-import-mode');
  const banner = document.getElementById('gis-import-active-banner');
  const bannerText = document.getElementById('gis-import-banner-text');

  if (isGisImportMode) {
    if (btn) {
      btn.innerHTML = '<i data-lucide="check-circle-2" class="lucide-sm"></i> Đang Bật Import GIS (Click Bản Đồ)';
      btn.style.background = '#059669';
      btn.style.borderColor = '#047857';
    }
    if (bannerText) {
      bannerText.innerHTML = '<i data-lucide="crosshair" class="lucide-sm"></i> Đang bật Chế độ Import GIS: Click chọn vị trí cây trên bản đồ để nhập GPS &amp; Thông tin!';
    }
    if (banner) banner.style.display = 'flex';
    if (gMap) gMap.getCanvas().style.cursor = 'crosshair';
    toast('Đã bật chế độ Import GIS: Click vào vị trí cây trên bản đồ để lấy tọa độ GPS!', 'info');
  } else {
    cancelAllGisPinModes();
    return;
  }
  if (typeof refreshCurrentSidebarPlantListUI === 'function') {
    refreshCurrentSidebarPlantListUI();
  }
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Bật chế độ gắn điểm Point GPS trên bản đồ cho một cây cụ thể từ danh sách Sidebar
function startPinSinglePlantGps(plantId, treeCode) {
  if (String(pinningPlantTargetId) === String(plantId)) {
    cancelAllGisPinModes();
    toast(`Đã tắt chế độ gắn điểm cho Cây #${treeCode || plantId}`, 'info');
    return;
  }

  isGisImportMode = false;
  pinningPlantTargetId = plantId;
  pinningPlantTargetCode = treeCode || plantId;

  const btn = document.getElementById('btn-gis-import-mode');
  if (btn) {
    btn.innerHTML = '<i data-lucide="map-pin" class="lucide-sm"></i> Import GIS (Click chọn vị trí cây trên bản đồ)';
    btn.style.background = '#10b981';
    btn.style.borderColor = '#059669';
  }

  const banner = document.getElementById('gis-import-active-banner');
  const bannerText = document.getElementById('gis-import-banner-text');
  if (bannerText) {
    bannerText.innerHTML = `<i data-lucide="map-pin" class="lucide-sm"></i> Đang gắn Point cho <strong>Cây #${esc(pinningPlantTargetCode)}</strong>: Hãy click vào vị trí thực tế trên bản đồ!`;
  }
  if (banner) banner.style.display = 'flex';
  if (gMap) gMap.getCanvas().style.cursor = 'crosshair';

  if (typeof refreshCurrentSidebarPlantListUI === 'function') {
    refreshCurrentSidebarPlantListUI();
  }
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  toast(`Hãy click lên bản đồ để gắn tọa độ Point cho Cây #${pinningPlantTargetCode}!`, 'info');
}
window.startPinSinglePlantGps = startPinSinglePlantGps;

// Thực thi lưu tọa độ GPS khi click bản đồ cho cây đang chọn từ danh sách
async function assignGpsToExistingPlant(plantId, lat, lng) {
  const newLat = parseFloat(lat.toFixed(7));
  const newLng = parseFloat(lng.toFixed(7));
  const codeLabel = pinningPlantTargetCode || plantId;

  try {
    toast(`Đang gắn tọa độ GPS cho Cây #${codeLabel}...`, 'info');
    await api(`/plants/${plantId}/gps`, {
      method: 'PUT',
      body: JSON.stringify({
        latitude: newLat,
        longitude: newLng
      })
    });

    let targetPlantObj = null;
    if (typeof currentPlants !== 'undefined' && Array.isArray(currentPlants)) {
      const pIdx = currentPlants.findIndex(p => String(p.id) === String(plantId));
      if (pIdx !== -1) {
        currentPlants[pIdx].latitude = newLat;
        currentPlants[pIdx].longitude = newLng;
        currentPlants[pIdx].location = `GPS: ${newLat.toFixed(6)}, ${newLng.toFixed(6)}`;
        targetPlantObj = currentPlants[pIdx];
      }
    }
    if (typeof currentFarms !== 'undefined' && Array.isArray(currentFarms)) {
      currentFarms.forEach(f => {
        if (f.plants && Array.isArray(f.plants)) {
          const pIdx = f.plants.findIndex(p => String(p.id) === String(plantId));
          if (pIdx !== -1) {
            f.plants[pIdx].latitude = newLat;
            f.plants[pIdx].longitude = newLng;
            f.plants[pIdx].location = `GPS: ${newLat.toFixed(6)}, ${newLng.toFixed(6)}`;
            if (!targetPlantObj) targetPlantObj = f.plants[pIdx];
          }
        }
      });
    }

    cancelAllGisPinModes();

    // Cập nhật marker tại chỗ hoặc vẽ bổ sung mà không giật zoom bản đồ
    const existingMarker = (gisPlantMarkers || []).find(m => String(m._plantId) === String(plantId));
    if (existingMarker) {
      existingMarker.setLngLat([newLng, newLat]);
      if (existingMarker._updatePopupCoords) {
        existingMarker._updatePopupCoords(newLat, newLng);
      }
    } else {
      const activeFarm = activeFarmId ? (currentFarms || []).find(f => String(f.id) === String(activeFarmId)) : null;
      drawFarmsAndPlantsLayers(currentFarms || [], activeFarm ? (activeFarm.plants || []) : (currentPlants || []));
    }

    if (typeof refreshCurrentSidebarPlantListUI === 'function') {
      refreshCurrentSidebarPlantListUI();
    }

    toast(`Đã gắn Point GPS (${newLat.toFixed(6)}, ${newLng.toFixed(6)}) cho Cây #${codeLabel}!`, 'success');
  } catch (err) {
    toast('Lỗi gắn tọa độ GPS: ' + err.message, 'error');
  }
}
window.assignGpsToExistingPlant = assignGpsToExistingPlant;

// Bay tới vị trí cây trên bản đồ và mở thẻ thông tin ERP
function focusPlantOnGisMap(plantId) {
  const marker = (gisPlantMarkers || []).find(m => String(m._plantId) === String(plantId));
  if (marker && gMap) {
    const lngLat = marker.getLngLat();
    gMap.flyTo({
      center: lngLat,
      zoom: Math.max(gMap.getZoom(), 19),
      duration: 650
    });
    (gisPlantMarkers || []).forEach(m => {
      if (m !== marker && m._popup && m._popup.isOpen()) {
        m._popup.remove();
      }
    });
    if (marker._popup && !marker._popup.isOpen()) {
      marker._popup.setLngLat(lngLat).addTo(gMap);
    }
  } else {
    openPlantModal(plantId);
  }
}
window.focusPlantOnGisMap = focusPlantOnGisMap;

function openAddPlantsManual() {
  openPlantModal(null);
  if (activeFarmId) {
    const select = document.getElementById('f-farm-id');
    if (select) select.value = activeFarmId;
  }
}

async function openPlantModalForGisClick(lng, lat) {
  await openPlantModal(null);

  // Tự động gán Trang trại hiện tại
  if (activeFarmId) {
    const farmSelect = document.getElementById('f-farm-id');
    if (farmSelect) farmSelect.value = activeFarmId;
  }

  // Tự động điền GPS Kinh độ, Vĩ độ & Chuỗi vị trí
  const latInput = document.getElementById('f-latitude');
  const lngInput = document.getElementById('f-longitude');
  const locInput = document.getElementById('f-location');
  const codeInput = document.getElementById('f-tree-code');

  if (latInput) latInput.value = lat.toFixed(7);
  if (lngInput) lngInput.value = lng.toFixed(7);
  if (locInput) locInput.value = `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;

  if (codeInput && !codeInput.value) {
    const farmPlantsCount = (currentPlants || []).filter(p => p.farm_id === activeFarmId).length + 1;
    codeInput.value = `CT-${farmPlantsCount.toString().padStart(3, '0')}`;
  }

  const typeInput = document.getElementById('f-plant-type');
  if (typeInput) typeInput.focus();

  toast(`Đã ghim GPS (${lat.toFixed(5)}, ${lng.toFixed(5)}). Hãy nhập thông tin chi tiết cây trồng!`, 'success');
}

// Hook gọi sau khi lưu cây thành công từ Modal
window.onPlantSavedHook = function(plant) {
  if (gisImportTempMarker) {
    gisImportTempMarker.remove();
    gisImportTempMarker = null;
  }

  // 1. Cập nhật tức thời dữ liệu cây trồng vào các bộ nhớ đệm GIS
  if (plant && plant.id) {
    if (typeof currentPlants !== 'undefined' && Array.isArray(currentPlants)) {
      const idx = currentPlants.findIndex(p => p.id === plant.id || p.id == plant.id);
      if (idx !== -1) currentPlants[idx] = { ...currentPlants[idx], ...plant };
      else currentPlants.push(plant);
    }
    if (typeof currentFarms !== 'undefined' && Array.isArray(currentFarms)) {
      currentFarms.forEach(f => {
        if (f.plants && Array.isArray(f.plants)) {
          const pIdx = f.plants.findIndex(p => p.id === plant.id || p.id == plant.id);
          if (pIdx !== -1) f.plants[pIdx] = { ...f.plants[pIdx], ...plant };
          else if (f.id === plant.farm_id || f.id == plant.farm_id) f.plants.push(plant);
        }
      });
    }

    // 2. MƯỢT MÀ: Cập nhật marker tại chỗ (In-place update) KHÔNG làm giật / nhảy zoom bản đồ
    const existingMarker = (gisPlantMarkers || []).find(m => m._plantId === plant.id || m._plantId == plant.id);
    const newLat = parseFloat(plant.latitude);
    const newLng = parseFloat(plant.longitude);

    if (existingMarker && !isNaN(newLat) && !isNaN(newLng)) {
      // Di chuyển marker nhẹ nhàng tới tọa độ mới mà không reset map
      existingMarker.setLngLat([newLng, newLat]);
      if (existingMarker._updatePopupCoords) {
        existingMarker._updatePopupCoords(newLat, newLng);
      }

      if (typeof refreshCurrentSidebarPlantListUI === 'function') {
        refreshCurrentSidebarPlantListUI();
      }
      return;
    }
  }

  // Nếu cây mới hoàn toàn chưa có marker trên bản đồ thì vẽ lại danh sách lớp mà không ép zoom
  if (activeFarmId && typeof currentFarms !== 'undefined') {
    const farm = currentFarms.find(f => f.id === activeFarmId || f.id == activeFarmId);
    if (farm) {
      drawFarmsAndPlantsLayers(currentFarms, farm.plants || []);
      if (typeof refreshCurrentSidebarPlantListUI === 'function') refreshCurrentSidebarPlantListUI();
    }
  } else {
    drawFarmsAndPlantsLayers(currentFarms || [], currentPlants || []);
  }

  if (isGisImportMode) {
    toast('✅ Đã lưu cây mới vào hệ thống GIS! Tiếp tục click bản đồ để nhập cây tiếp theo.', 'info');
  }
};

let gisPlantMarkers = [];
let gisFarmMarkers = [];

// ── Xóa Point (Gỡ ghim GPS) của cây trên bản đồ mượt mà không reload ──
async function removePlantPointGps(plantId, treeCode) {
  if (!confirm(`Xóa vị trí điểm ghim (Point GPS) của cây #${treeCode || plantId} khỏi bản đồ?\n\nLưu ý: Hồ sơ và dữ liệu nhật ký của cây vẫn được giữ nguyên, chỉ gỡ ghim tọa độ khỏi bản đồ để bạn định vị lại.`)) {
    return;
  }

  try {
    await api(`/plants/${plantId}/gps`, {
      method: 'PUT',
      body: JSON.stringify({
        latitude: null,
        longitude: null
      })
    });

    // 1. Gỡ marker và đóng popup ngay tại chỗ (In-place removal, không giật màn hình)
    const mIdx = (gisPlantMarkers || []).findIndex(m => m._plantId === plantId || m._plantId == plantId);
    if (mIdx !== -1) {
      const markerObj = gisPlantMarkers[mIdx];
      try {
        if (markerObj._popup && markerObj._popup.isOpen()) {
          markerObj._popup.remove();
        } else if (markerObj.getPopup && markerObj.getPopup()) {
          markerObj.getPopup().remove();
        }
        markerObj.remove();
      } catch (_) {}
      gisPlantMarkers.splice(mIdx, 1);
    }

    // 2. Cập nhật bộ nhớ đệm
    if (typeof currentPlants !== 'undefined' && Array.isArray(currentPlants)) {
      const pIdx = currentPlants.findIndex(p => p.id === plantId || p.id == plantId);
      if (pIdx !== -1) {
        currentPlants[pIdx].latitude = null;
        currentPlants[pIdx].longitude = null;
      }
    }
    if (typeof currentFarms !== 'undefined' && Array.isArray(currentFarms)) {
      currentFarms.forEach(f => {
        if (f.plants && Array.isArray(f.plants)) {
          const pIdx = f.plants.findIndex(p => p.id === plantId || p.id == plantId);
          if (pIdx !== -1) {
            f.plants[pIdx].latitude = null;
            f.plants[pIdx].longitude = null;
          }
        }
      });
    }

    if (typeof refreshCurrentSidebarPlantListUI === 'function') {
      refreshCurrentSidebarPlantListUI();
    }

    toast(`Đã xóa point GPS của cây #${treeCode || plantId} khỏi bản đồ.`, 'success');
  } catch (err) {
    toast('Lỗi khi xóa point GPS: ' + err.message, 'error');
  }
}
window.removePlantPointGps = removePlantPointGps;

function drawFarmsAndPlantsLayers(farms, plants) {
  if (!gMap) return;

  // Clear existing plant markers on map
  gisPlantMarkers.forEach(m => {
    try { m.remove(); } catch(_) {}
  });
  gisPlantMarkers = [];

  // Clear existing farm markers on map
  gisFarmMarkers.forEach(m => {
    try { m.remove(); } catch(_) {}
  });
  gisFarmMarkers = [];

  const bounds = new mapboxgl.LngLatBounds();
  let hasBounds = false;
  const displayPlants = plants || currentPlants || [];

  farms.forEach(farm => {
    const farmColor = getCustomerColor(farm.user_id);
    let coords = [];
    try {
      coords = typeof farm.polygon_coordinates === 'string' ? JSON.parse(farm.polygon_coordinates) : farm.polygon_coordinates;
    } catch(e) {}

    let centerLng = null;
    if (coords && Array.isArray(coords) && coords.length > 0) {
      if (coords.length >= 3) {
        const srcId = `gis-farm-src-${farm.id}`;
        const layerId = `gis-farm-layer-${farm.id}`;
        const outlineId = `gis-farm-outline-${farm.id}`;

        const polyCoords = [...coords];
        if (polyCoords.length > 0 && 
            (polyCoords[0][0] !== polyCoords[polyCoords.length - 1][0] || 
             polyCoords[0][1] !== polyCoords[polyCoords.length - 1][1])) {
          polyCoords.push(polyCoords[0]);
        }

        if (!gMap.getSource(srcId)) {
          gMap.addSource(srcId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: [polyCoords] }
            }
          });

          gMap.addLayer({
            id: layerId,
            type: 'fill',
            source: srcId,
            paint: {
              'fill-color': farmColor,
              'fill-opacity': activeFarmId === farm.id ? 0.5 : 0.28
            }
          });
          gMap.addLayer({
            id: outlineId,
            type: 'line',
            source: srcId,
            paint: {
              'line-color': farmColor,
              'line-width': activeFarmId === farm.id ? 3.5 : 2
            }
          });

          gMap.on('click', layerId, () => {
            selectFarm(farm.id);
          });
          
          gMap.on('mouseenter', layerId, () => gMap.getCanvas().style.cursor = 'pointer');
          gMap.on('mouseleave', layerId, () => gMap.getCanvas().style.cursor = '');
        } else {
          if (gMap.getLayer(layerId)) {
            gMap.setPaintProperty(layerId, 'fill-color', farmColor);
            gMap.setPaintProperty(layerId, 'fill-opacity', activeFarmId === farm.id ? 0.5 : 0.28);
          }
          if (gMap.getLayer(outlineId)) {
            gMap.setPaintProperty(outlineId, 'line-color', farmColor);
            gMap.setPaintProperty(outlineId, 'line-width', activeFarmId === farm.id ? 3.5 : 2);
          }
        }
        }
      }

      if (Array.isArray(coords)) {
        coords.forEach(pt => {
          if (Array.isArray(pt) && pt.length >= 2) {
            let lng = parseFloat(pt[0]);
            let lat = parseFloat(pt[1]);
            if (!isNaN(lng) && !isNaN(lat)) {
              if ((lat < -90 || lat > 90) && (lng >= -90 && lng <= 90)) {
                const tmp = lat;
                lat = lng;
                lng = tmp;
              }
              if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                bounds.extend([lng, lat]);
                hasBounds = true;
              }
            }
          }
        });
      }
  });

  // ── HYBRID GPU CLUSTER LAYER FOR LARGE PLANTATIONS (>= 250 TREES, 60 FPS) ──
  try {
    const adminClusterSrcId = 'admin-plants-gpu-src';
    const adminClusterLayerId = 'admin-plants-gpu-clusters';
    const adminClusterCountId = 'admin-plants-gpu-cluster-count';

    if (displayPlants.length >= 250) {
      const validClusterFeatures = [];
      displayPlants.forEach(p => {
        if (!p || !p.latitude || !p.longitude) return;
        let lat = parseFloat(p.latitude);
        let lng = parseFloat(p.longitude);
        if (isNaN(lat) || isNaN(lng)) return;
        if ((lat < -90 || lat > 90) && (lng >= -90 && lng <= 90)) { const t = lat; lat = lng; lng = t; }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
        validClusterFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: {
            id: p.id,
            tree_code: p.tree_code || p.id,
            health_status: p.health_status || 'Tốt'
          }
        });
      });

      const clusterGeoJson = { type: 'FeatureCollection', features: validClusterFeatures };
      if (gMap.getSource(adminClusterSrcId)) {
        gMap.getSource(adminClusterSrcId).setData(clusterGeoJson);
      } else {
        gMap.addSource(adminClusterSrcId, {
          type: 'geojson',
          data: clusterGeoJson,
          cluster: true,
          clusterMaxZoom: 16,
          clusterRadius: 45
        });

        gMap.addLayer({
          id: adminClusterLayerId,
          type: 'circle',
          source: adminClusterSrcId,
          maxzoom: 16.2,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': ['step', ['get', 'point_count'], '#10b981', 25, '#0284c7', 100, '#f59e0b', 500, '#ef4444'],
            'circle-radius': ['step', ['get', 'point_count'], 18, 25, 22, 100, 27, 500, 33],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#ffffff'
          }
        });

        gMap.addLayer({
          id: adminClusterCountId,
          type: 'symbol',
          source: adminClusterSrcId,
          maxzoom: 16.2,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12
          },
          paint: { 'text-color': '#ffffff' }
        });

        gMap.on('click', adminClusterLayerId, (e) => {
          const features = gMap.queryRenderedFeatures(e.point, { layers: [adminClusterLayerId] });
          if (!features.length) return;
          const clusterId = features[0].properties.cluster_id;
          gMap.getSource(adminClusterSrcId).getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            gMap.easeTo({ center: features[0].geometry.coordinates, zoom: Math.min(zoom + 1, 18) });
          });
        });
      }
    } else if (gMap.getSource(adminClusterSrcId)) {
      gMap.getSource(adminClusterSrcId).setData({ type: 'FeatureCollection', features: [] });
    }
  } catch (gpuClusterErr) {
    console.warn('[AdminGIS] GPU cluster sync warning:', gpuClusterErr.message);
  }

  displayPlants.forEach(plant => {
    if (plant.latitude && plant.longitude) {
      let lat = parseFloat(plant.latitude);
      let lng = parseFloat(plant.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        // Auto-fix swapped latitude/longitude (lat > 90 or < -90)
        if ((lat < -90 || lat > 90) && (lng >= -90 && lng <= 90)) {
          const tmp = lat;
          lat = lng;
          lng = tmp;
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

        let color = '#3b82f6';
        if (plant.health_status === 'Tốt') color = '#22c55e';
        else if (plant.health_status === 'Cần chú ý') color = '#eab308';
        else if (plant.health_status === 'Bệnh') color = '#ef4444';

        const wrapper = document.createElement('div');
        wrapper.className = 'plant-marker-wrap';

        const el = document.createElement('div');
        let healthClass = 'health-default';
        if (plant.health_status === 'Tốt') healthClass = 'health-tot';
        else if (plant.health_status === 'Cần chú ý') healthClass = 'health-watch';
        else if (plant.health_status === 'Bệnh') healthClass = 'health-sick';

        el.className = `plant-id-marker ${healthClass}`;
        el.innerHTML = `<span>${esc(getShortTreeCode(plant.tree_code, plant.id))}</span>`;
        wrapper.appendChild(el);

        const marker = new mapboxgl.Marker({ element: wrapper, draggable: true })
          .setLngLat([lng, lat]);

        function getPopupContent(p, pLat, pLng) {
          const statusStr = p.health_status || 'Tốt';
          let statusBg = '#ecfdf5', statusColor = '#047857', statusBorder = '#a7f3d0', statusDot = '#10b981';
          if (statusStr === 'Cần chú ý' || statusStr === 'Bình thường') {
            statusBg = '#fffbeb'; statusColor = '#b45309'; statusBorder = '#fde68a'; statusDot = '#f59e0b';
          } else if (statusStr === 'Bệnh') {
            statusBg = '#fef2f2'; statusColor = '#dc2626'; statusBorder = '#fecaca'; statusDot = '#ef4444';
          }

          return `
            <div class="erp-plant-popup-card">
              <!-- ERP Header -->
              <div class="erp-popup-header">
                <div style="display:flex; align-items:center; gap:9px; min-width:0;">
                  <div style="width:30px; height:30px; border-radius:8px; background:#ecfdf5; border:1px solid #a7f3d0; display:flex; align-items:center; justify-content:center; color:#059669; flex-shrink:0;">
                    <i data-lucide="trees" class="lucide-sm"></i>
                  </div>
                  <div style="min-width:0;">
                    <div style="font-size:13.5px; font-weight:800; color:#0f172a; letter-spacing:-0.01em; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                      Cây #${esc(p.tree_code || p.id)}
                    </div>
                    <div style="font-size:10px; font-weight:600; color:#64748b; margin-top:1px;">
                      Mã định danh GIS · ID #${p.id}
                    </div>
                  </div>
                </div>
                <span style="display:inline-flex; align-items:center; gap:4px; font-size:10.5px; font-weight:700; padding:3px 8px; border-radius:20px; background:${statusBg}; color:${statusColor}; border:1px solid ${statusBorder}; flex-shrink:0;">
                  <span style="width:6px; height:6px; border-radius:50%; background:${statusDot};"></span>
                  ${esc(statusStr)}
                </span>
              </div>

              <!-- ERP Body -->
              <div class="erp-popup-body">
                <!-- 2-Column Metadata Grid -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                  <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:6px 9px; min-width:0;">
                    <div style="font-size:9.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.04em;">Chủng loại</div>
                    <div style="font-size:12px; font-weight:800; color:#0f172a; margin-top:2px; display:flex; align-items:center; gap:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                      <i data-lucide="sprout" class="lucide-xs" style="color:#10b981; flex-shrink:0;"></i>
                      <span style="overflow:hidden; text-overflow:ellipsis;">${esc(p.plant_type || '—')}</span>
                    </div>
                  </div>
                  <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:6px 9px; min-width:0;">
                    <div style="font-size:9.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.04em;">Giống cây</div>
                    <div style="font-size:12px; font-weight:800; color:#334155; margin-top:2px; display:flex; align-items:center; gap:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                      <i data-lucide="tag" class="lucide-xs" style="color:#0284c7; flex-shrink:0;"></i>
                      <span style="overflow:hidden; text-overflow:ellipsis;">${esc(p.plant_variety || 'Tiêu chuẩn')}</span>
                    </div>
                  </div>
                </div>

                <!-- WGS84 GPS Telemetry Box -->
                <div style="padding:8px 10px; background:linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border:1px solid #cbd5e1; border-radius:9px; font-size:11px; color:#475569;">
                  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:5px; padding-bottom:4px; border-bottom:1px dashed #cbd5e1;">
                    <span style="font-size:10px; font-weight:700; color:#334155; display:inline-flex; align-items:center; gap:4px;">
                      <i data-lucide="compass" class="lucide-xs" style="color:#059669;"></i> Tọa độ thực địa WGS84
                    </span>
                    <span style="font-size:9.5px; font-weight:700; color:#059669; background:#ecfdf5; border:1px solid #a7f3d0; padding:1px 6px; border-radius:4px;">Đã định vị</span>
                  </div>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <div>
                      <span style="font-size:9.5px; color:#64748b; display:block;">Vĩ độ (Lat)</span>
                      <strong style="font-family:'JetBrains Mono', monospace; font-size:11.5px; color:#0f172a;">${pLat.toFixed(6)}°</strong>
                    </div>
                    <div>
                      <span style="font-size:9.5px; color:#64748b; display:block;">Kinh độ (Lng)</span>
                      <strong style="font-family:'JetBrains Mono', monospace; font-size:11.5px; color:#0f172a;">${pLng.toFixed(6)}°</strong>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ERP Footer Actions -->
              <div class="erp-popup-footer">
                <button type="button" style="flex:1; background:#0f172a; color:#ffffff; border:1px solid #0f172a; border-radius:8px; padding:7px 10px; font-size:11.5px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; gap:5px; cursor:pointer; transition:all 0.15s;" onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background='#0f172a'" onclick="event.stopPropagation(); openPlantModal(${p.id});">
                  <i data-lucide="sliders-horizontal" class="lucide-xs"></i> Chỉnh sửa &amp; GPS
                </button>
                <button type="button" style="background:#fff1f2; color:#e11d48; border:1px solid #fecdd3; border-radius:8px; padding:7px 10px; font-size:11.5px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; gap:4px; cursor:pointer; transition:all 0.15s;" onmouseover="this.style.background='#ffe4e6'" onmouseout="this.style.background='#fff1f2'" title="Gỡ điểm ghim GPS của cây này khỏi bản đồ" onclick="event.stopPropagation(); removePlantPointGps(${p.id}, '${esc(p.tree_code || p.id)}');">
                  <i data-lucide="trash-2" class="lucide-xs"></i> Xóa point
                </button>
              </div>
            </div>
          `;
        }

        // Tạo popup ổn định nhưng KHÔNG tự động bật khi kéo thả marker (chỉ bật khi click)
        const popup = new mapboxgl.Popup({
          offset: 22,
          closeButton: true,
          closeOnClick: false,
          closeOnMove: false,
          maxWidth: '320px',
          className: 'gis-plant-popup'
        }).setHTML(getPopupContent(plant, lat, lng));

        let isDraggingMarker = false;
        let dragEndTimestamp = 0;

        marker.on('dragstart', () => {
          isDraggingMarker = true;
          // Khi bắt đầu kéo point: đóng ngay mọi thông tin popup/tooltip đang mở
          if (popup.isOpen()) {
            popup.remove();
          }
          if (typeof window.hidePlantTooltip === 'function') {
            window.hidePlantTooltip();
          }
        });

        marker.on('drag', () => {
          isDraggingMarker = true;
          if (popup.isOpen()) {
            popup.remove();
          }
        });

        marker.on('dragend', async () => {
          dragEndTimestamp = Date.now();
          setTimeout(() => {
            isDraggingMarker = false;
          }, 300);

          // Tuyệt đối không hiển thị popup khi vừa kéo xong
          if (popup.isOpen()) {
            popup.remove();
          }

          const newLngLat = marker.getLngLat();
          const newLng = parseFloat(newLngLat.lng.toFixed(7));
          const newLat = parseFloat(newLngLat.lat.toFixed(7));
          try {
            toast('Đang cập nhật tọa độ cây #' + (plant.tree_code || plant.id) + '...');
            const updated = await api('/plants/' + plant.id, {
              method: 'PUT',
              body: JSON.stringify({
                plant_type: plant.plant_type,
                plant_variety: plant.plant_variety,
                plant_age: plant.plant_age,
                health_status: plant.health_status,
                tree_code: plant.tree_code,
                farm_id: plant.farm_id,
                latitude: newLat,
                longitude: newLng,
                location: 'GPS: ' + newLat.toFixed(6) + ', ' + newLng.toFixed(6),
                is_public: plant.is_public !== false
              })
            });
            plant.latitude = newLat;
            plant.longitude = newLng;
            plant.location = updated.location || ('GPS: ' + newLat.toFixed(6) + ', ' + newLng.toFixed(6));
            
            // Cập nhật nội dung popup ngầm để lần sau người dùng click vào sẽ thấy tọa độ mới
            popup.setHTML(getPopupContent(plant, newLat, newLng));
            popup.setLngLat([newLng, newLat]);

            // Đồng bộ dữ liệu trong bộ nhớ đệm
            if (typeof currentPlants !== 'undefined' && Array.isArray(currentPlants)) {
              const pIdx = currentPlants.findIndex(p => p.id === plant.id || p.id == plant.id);
              if (pIdx !== -1) currentPlants[pIdx] = { ...currentPlants[pIdx], ...plant };
            }
            if (typeof currentFarms !== 'undefined' && Array.isArray(currentFarms)) {
              currentFarms.forEach(f => {
                if (f.plants && Array.isArray(f.plants)) {
                  const pIdx = f.plants.findIndex(p => p.id === plant.id || p.id == plant.id);
                  if (pIdx !== -1) f.plants[pIdx] = { ...f.plants[pIdx], ...plant };
                }
              });
            }

            toast('Đã cập nhật GPS mới: ' + newLat + ', ' + newLng, 'success');
          } catch(err) {
            toast('Lỗi cập nhật GPS: ' + err.message, 'error');
            marker.setLngLat([lng, lat]);
          }
        });

        popup.on('open', () => {
          if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
          }
        });

        // Chỉ khi người dùng CLICK thực sự (không phải kéo thả) vào điểm point thì mới mở thẻ thông tin
        wrapper.addEventListener('click', (e) => {
          e.stopPropagation();
          if (isDraggingMarker || (Date.now() - dragEndTimestamp < 300)) {
            return;
          }
          // Đóng popup của các cây khác để giao diện gọn gàng
          (gisPlantMarkers || []).forEach(m => {
            if (m !== marker && m._popup && m._popup.isOpen()) {
              m._popup.remove();
            }
          });
          if (popup.isOpen()) {
            popup.remove();
          } else {
            const curPos = marker.getLngLat();
            popup.setLngLat(curPos).addTo(gMap);
          }
        });

        marker.addTo(gMap);
        marker._plantId = plant.id;
        marker._popup = popup;
        marker.getPopup = () => popup;
        marker._updatePopupCoords = (nLat, nLng) => {
          plant.latitude = nLat;
          plant.longitude = nLng;
          popup.setHTML(getPopupContent(plant, nLat, nLng));
          popup.setLngLat([nLng, nLat]);
        };

        gisPlantMarkers.push(marker);

        bounds.extend([lng, lat]);
        hasBounds = true;
      }
    }
  });

  if (hasBounds && !activeFarmId) {
    gMap.fitBounds(bounds, { padding: 50, maxZoom: 19, duration: 1000 });
  }

  // Add contour lines (đường đồng mức) ONLY if a specific farm is selected
  const activeFarm = activeFarmId ? farms.find(f => f.id === activeFarmId) : null;
  const farmCoords = activeFarm ? activeFarm.polygon_coordinates : null;
  if (farmCoords) {
    addContourLinesToMap(gMap, { farmCoords });
  } else {
    removeContourLinesFromMap(gMap);
  }
}

function updateAreaDisplay() {
  const data = drawControl.getAll();
  if (data.features.length > 0) {
    const polygon = data.features[0];
    const areaVal = turf.area(polygon);
    document.getElementById('farm-area-display').textContent = Math.round(areaVal).toLocaleString('vi-VN') + ' m²';
    document.getElementById('farm-area-ha').textContent = (areaVal / 10000).toFixed(2);
    window._lastDrawnArea = areaVal;
  } else {
    document.getElementById('farm-area-display').textContent = '0 m²';
    document.getElementById('farm-area-ha').textContent = '0';
    window._lastDrawnArea = 0;
  }
}

async function loadUsersDropdown(selectedUserId = '', farmId = null) {
  try {
    const users = await api('/users');
    const select = document.getElementById('farm-user-id');
    if (select) {
      select.innerHTML = '<option value="">— Chưa gán cho ai —</option>' + 
        users.map(u => {
          const isSelected = (selectedUserId && u.id == selectedUserId) || (farmId && u.farm_id == farmId);
          const roleLabel = u.role === 'admin' ? ' (Admin)' : ' (Nông hộ)';
          return `<option value="${u.id}" ${isSelected ? 'selected' : ''}>${esc(u.full_name)}${roleLabel}</option>`;
        }).join('');
    }
  } catch (err) {
    console.error('Error loading users for dropdown:', err);
  }
}

// ── GIS Farm Boundary Drawing & Vertex Editing Helpers ─────────────────
function enableDirectSelectMode() {
  if (!drawControl) return;
  const all = drawControl.getAll();
  if (all && all.features && all.features.length > 0) {
    const featureId = all.features[0].id;
    if (featureId) {
      drawControl.changeMode('direct_select', { featureId });
      toast('Đã bật chế độ chỉnh đỉnh: Hãy kéo các điểm tròn trắng trên ranh giới để đổi hình dạng!', 'info');
    }
  } else {
    toast('Chưa có ranh giới nào được vẽ. Hãy bấm "Vẽ lại mới" để vẽ!', 'warning');
  }
}
window.enableDirectSelectMode = enableDirectSelectMode;

function enableRedrawPolygonMode() {
  if (!drawControl) return;
  drawControl.deleteAll();
  updateAreaDisplay();
  drawControl.changeMode('draw_polygon');
  toast('Chế độ vẽ mới: Nhấp chuột trên bản đồ để chấm các đỉnh ranh giới.', 'info');
}
window.enableRedrawPolygonMode = enableRedrawPolygonMode;

function clearDrawnPolygon() {
  if (!drawControl) return;
  drawControl.deleteAll();
  updateAreaDisplay();
  toast('Đã xóa ranh giới đang vẽ', 'info');
}
// [Modularized] GPS parser & multi-point import moved to gis-gps-tools.js
async function openFarmForm() {
  activeFarmId = null;
  gisEdgeMarkers.forEach(m => { try { m.remove(); } catch(_) {} });
  gisEdgeMarkers = [];
  if (gMap) removeContourLinesFromMap(gMap);
  clearGisGpsBeacon();

  document.getElementById('gis-back-btn').style.display = 'block';
  document.getElementById('gis-sidebar-title').textContent = 'Tạo Trang trại';
  document.getElementById('gis-header-actions').style.display = 'none';
  switchGisView('form');
  
  document.getElementById('farm-name').value = '';
  document.getElementById('farm-desc').value = '';
  if (document.getElementById('farm-puc-code')) document.getElementById('farm-puc-code').value = '';
  if (document.getElementById('farm-vietgap-cert')) document.getElementById('farm-vietgap-cert').value = '';
  if (document.getElementById('farm-vietgap-org')) document.getElementById('farm-vietgap-org').value = '';
  if (document.getElementById('farm-gps-smart-input')) document.getElementById('farm-gps-smart-input').value = '';
  if (document.getElementById('farm-gps-lat')) document.getElementById('farm-gps-lat').value = '';
  if (document.getElementById('farm-gps-lng')) document.getElementById('farm-gps-lng').value = '';
  document.getElementById('farm-area-display').textContent = '0 m²';
  document.getElementById('farm-area-ha').textContent = '0';
  if (document.getElementById('farm-perm-plants')) document.getElementById('farm-perm-plants').checked = true;
  if (document.getElementById('farm-perm-history')) document.getElementById('farm-perm-history').checked = true;
  if (document.getElementById('farm-perm-supplies')) document.getElementById('farm-perm-supplies').checked = true;
  window._lastDrawnArea = 0;

  await loadUsersDropdown();

  drawControl.deleteAll();
  drawControl.changeMode('draw_polygon');
  if (window.lucide && typeof window.lucide.createIcons === 'function') lucide.createIcons();
}

function cancelFarmForm() {
  drawControl.changeMode('simple_select');
  drawControl.deleteAll();
  clearGisGpsBeacon();
  const currentActive = activeFarmId;
  if (currentActive) {
    if (gMap) {
      const farmLayerId = `gis-farm-layer-${currentActive}`;
      const farmOutlineId = `gis-farm-outline-${currentActive}`;
      if (gMap.getLayer(farmLayerId)) gMap.setLayoutProperty(farmLayerId, 'visibility', 'visible');
      if (gMap.getLayer(farmOutlineId)) gMap.setLayoutProperty(farmOutlineId, 'visibility', 'visible');
    }
    selectFarm(currentActive);
  } else {
    initGisPage();
  }
}

async function saveFarm() {
  const name = document.getElementById('farm-name').value.trim();
  const description = document.getElementById('farm-desc').value.trim();
  const user_id = document.getElementById('farm-user-id').value;
  const puc_code = document.getElementById('farm-puc-code')?.value.trim() || null;
  const vietgap_cert_number = document.getElementById('farm-vietgap-cert')?.value.trim() || null;
  const vietgap_cert_org = document.getElementById('farm-vietgap-org')?.value.trim() || null;
  const allow_view_plants = document.getElementById('farm-perm-plants')?.checked;
  const allow_shared_history = document.getElementById('farm-perm-history')?.checked;
  const allow_shared_supplies = document.getElementById('farm-perm-supplies')?.checked;
  
  if (!name) {
    toast('Vui lòng nhập tên trang trại!', 'error');
    return;
  }

  const data = drawControl.getAll();
  if (data.features.length === 0) {
    toast('Vui lòng vẽ ranh giới trang trại trên bản đồ!', 'error');
    return;
  }

  const coordinates = data.features[0].geometry.coordinates[0];
  let area = 0;
  try {
    area = turf.area(data.features[0]);
  } catch(e) {
    area = window._lastDrawnArea || 0;
  }

  const body = {
    name,
    description,
    polygon_coordinates: coordinates,
    area,
    user_id: user_id ? parseInt(user_id) : null,
    puc_code,
    vietgap_cert_number,
    vietgap_cert_org
  };

  try {
    const editingFarmId = activeFarmId;
    const method = editingFarmId ? 'PUT' : 'POST';
    const url = editingFarmId ? `/farms/${editingFarmId}` : '/farms';
    
    const savedFarm = await api(url, {
      method,
      body: JSON.stringify(body)
    });

    toast(editingFarmId ? 'Đã cập nhật ranh giới trang trại thành công!' : 'Đã tạo trang trại thành công!');
    drawControl.changeMode('simple_select');
    drawControl.deleteAll();
    clearGisGpsBeacon();
    
    window._plantFiltersLoaded = false;
    const targetId = (savedFarm && savedFarm.id) || editingFarmId;
    await initGisPage(targetId);
  } catch (err) {
    toast('Lỗi lưu trang trại: ' + err.message, 'error');
  }
}

async function selectFarm(farmId, syncUrl = true) {
  if (!farmId) return;
  activeFarmId = farmId;
  window._pendingSelectFarmId = farmId;

  if (syncUrl && typeof window.syncAdminUrl === 'function') {
    window.syncAdminUrl({ page: 'gis', farm: farmId });
  }

  const backBtn = document.getElementById('gis-back-btn');
  if (backBtn) backBtn.style.display = 'block';
  const headerActions = document.getElementById('gis-header-actions');
  if (headerActions) headerActions.style.display = 'none';
  switchGisView('details');

  function renderFarmDetailsUI(farm) {
    const isOwnerPro = farm.user_account_tier === 'pro' || farm.user_role === 'admin';
    const tierBadgeHtml = isOwnerPro
      ? `<span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px;"><i data-lucide="crown" class="lucide-sm" style="color:#f59e0b;"></i> Gói PRO</span>`
      : `<span style="background:#fffbeb; color:#b45309; border:1px solid #fde68a; font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px;">⚪ Gói NORMAL</span>`;

    const ownerHtml = `
      <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:12px; padding:12px; margin-bottom:12px;">
        <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:4px;">Nông hộ phụ trách Trang trại</div>
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
          <span style="font-size:13.5px; font-weight:800; color:#0f172a;"><i data-lucide="user" class="lucide-sm" style="color:#059669"></i> ${esc(farm.user_name || farm.owner_name || 'Chưa gán')}</span>
          ${tierBadgeHtml}
        </div>
        ${!isOwnerPro ? `
          <div style="margin-top:10px; background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:10px; font-size:11.5px; color:#78350f;">
            <div style="font-weight:800; margin-bottom:4px;"><i data-lucide="alert-triangle" class="lucide-sm" style="color:#d97706;"></i> Nông hộ NORMAL (Giới hạn GIS)</div>
            <div>Bản vẽ CAD quy hoạch, Chấm GIS cây lẻ &amp; Đường đồng mức 3D tối ưu cho Gói PRO.</div>
            <button onclick="openUserTierModalFromGis(${farm.user_id})" style="margin-top:8px; width:100%; background:linear-gradient(135deg, #059669, #047857); color:#fff; border:none; border-radius:8px; padding:7px 10px; font-size:11.5px; font-weight:800; cursor:pointer;">
              <i data-lucide="crown" class="lucide-sm" style="color:#fde047;"></i> Kích hoạt Gói PRO cho Nông hộ này
            </button>
          </div>
        ` : `
          <div style="margin-top:8px; font-size:11px; color:#047857; font-weight:700; display:flex; align-items:center; gap:4px;">
            <i data-lucide="check-circle-2" class="lucide-sm"></i> Đã mở khóa 100% Công cụ GIS, Cảm biến IoT & CAD
          </div>
        `}
      </div>
    `;

    const descEl = document.getElementById('farm-details-desc');
    if (descEl) descEl.innerHTML = ownerHtml + (farm.description ? `<p class="gis-farm-info" style="margin-top:6px;">${esc(farm.description)}</p>` : '<p class="gis-farm-info" style="font-style:italic; color:#94a3b8; margin-top:6px;">Không có mô tả.</p>');
    
    const sbTitle = document.getElementById('gis-sidebar-title');
    if (sbTitle) sbTitle.textContent = farm.name;
    
    const areaVal = formatSmartArea(farm.area);
    const areaEl = document.getElementById('farm-details-area');
    if (areaEl) areaEl.innerHTML = `<i data-lucide="trending-up" class="lucide-sm"></i> ${areaVal}`;
    
    // Lưu danh sách cây của nông trại đang mở để phục vụ tìm kiếm thông minh & sắp xếp tự nhiên
    window._currentSidebarFarmPlants = Array.isArray(farm.plants) ? farm.plants : [];
    renderCurrentSidebarPlantList();
    if (typeof syncFarmApiStatusUI === 'function') syncFarmApiStatusUI(farm);
    if (window.lucide && typeof window.lucide.createIcons === 'function') lucide.createIcons();
  }

  function zoomMapToFarm(farm) {
    if (!gMap) return;
    try { gMap.resize(); } catch (_) {}
    gMap._contourOffsetLocked = false;
    delete gMap._contourEleOffset;

    drawFarmsAndPlantsLayers(currentFarms, farm.plants || []);
    renderFarmDimensions(farm);

    const bounds = new mapboxgl.LngLatBounds();
    let hasBounds = false;

    const validCoords = sanitizeCoordinates(farm.polygon_coordinates);
    if (validCoords.length > 0) {
      validCoords.forEach(pt => {
        bounds.extend(pt);
        hasBounds = true;
      });
    }

    if (!hasBounds && Array.isArray(farm.plants) && farm.plants.length > 0) {
      farm.plants.forEach(p => {
        if (p.latitude && p.longitude) {
          const lat = parseFloat(p.latitude);
          const lng = parseFloat(p.longitude);
          if (!isNaN(lat) && !isNaN(lng)) {
            bounds.extend([lng, lat]);
            hasBounds = true;
          }
        }
      });
    }

    if (hasBounds) {
      gMap.fitBounds(bounds, { padding: 60, maxZoom: 19.5, duration: 800 });
    }

    if (validCoords.length > 0) {
      addContourLinesToMap(gMap, { farmCoords: validCoords });
    } else {
      removeContourLinesFromMap(gMap);
    }
  }

  // 1. INSTANT LOCAL CACHE RENDERING & ZOOM (0ms perceived latency)
  const cachedFarm = (currentFarms || []).find(f => String(f.id) === String(farmId));
  if (cachedFarm) {
    renderFarmDetailsUI(cachedFarm);
    zoomMapToFarm(cachedFarm);
  }

  // 2. BACKGROUND DATA SYNC (Updates plant tree details & live certs)
  try {
    const farm = await api(`/farms/${farmId}`);
    if (window._pendingSelectFarmId === farmId) {
      window._pendingSelectFarmId = null;
    }
    if (String(activeFarmId) !== String(farmId)) return;

    renderFarmDetailsUI(farm);
    zoomMapToFarm(farm);
  } catch (err) {
    if (!cachedFarm) {
      console.warn("Cannot load farm details:", err.message); backToFarmsList(); }
  }
}

// ── Sắp xếp tự nhiên (A->Z, 1->99) & Tìm kiếm thông minh danh sách cây ở Sidebar ──
let currentSidebarPlantSearchQuery = '';

function sortPlantsNaturally(plants) {
  if (!Array.isArray(plants)) return [];
  return [...plants].sort((a, b) => {
    const codeA = String(a.tree_code || a.id || '').trim();
    const codeB = String(b.tree_code || b.id || '').trim();
    const cmp = codeA.localeCompare(codeB, 'vi', { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) return cmp;
    return (Number(a.id) || 0) - (Number(b.id) || 0);
  });
}

function renderCurrentSidebarPlantList() {
  const listEl = document.getElementById('farm-details-plants-list');
  const plantCountEl = document.getElementById('farm-details-plant-count');
  if (!listEl) return;

  // Đồng bộ nguồn dữ liệu cây mới nhất của nông trại hiện tại
  let rawPlants = window._currentSidebarFarmPlants || [];
  if (activeFarmId && typeof currentFarms !== 'undefined' && Array.isArray(currentFarms)) {
    const activeFarmObj = currentFarms.find(f => String(f.id) === String(activeFarmId));
    if (activeFarmObj && Array.isArray(activeFarmObj.plants)) {
      rawPlants = activeFarmObj.plants;
      window._currentSidebarFarmPlants = rawPlants;
    }
  }

  if (plantCountEl) {
    plantCountEl.textContent = rawPlants.length;
  }

  if (!rawPlants || rawPlants.length === 0) {
    listEl.innerHTML = '<p style="font-size:12px;color:#94a3b8;text-align:center;padding:12px">Chưa có cây nào trong trang trại này.</p>';
    return;
  }

  // 1. Sắp xếp tự nhiên A -> Z, 1 -> 99
  const sortedPlants = sortPlantsNaturally(rawPlants);

  // 2. Lọc thông minh theo từ khóa (VD: gõ "1" ra 1, 10, 11, 12, 21...)
  const q = String(currentSidebarPlantSearchQuery || '').trim().toLowerCase();
  const filteredPlants = q
    ? sortedPlants.filter(p => {
        const codeStr = String(p.tree_code || p.id || '').toLowerCase();
        const shortNum = String(getShortTreeCode(p.tree_code, p.id) || '').toLowerCase();
        const typeStr = String(p.plant_type || '').toLowerCase();
        const varStr = String(p.plant_variety || '').toLowerCase();
        const healthStr = String(p.health_status || '').toLowerCase();
        return (
          codeStr.includes(q) ||
          shortNum.includes(q) ||
          (`cây ${codeStr}`).includes(q) ||
          typeStr.includes(q) ||
          varStr.includes(q) ||
          healthStr.includes(q)
        );
      })
    : sortedPlants;

  if (filteredPlants.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center; padding:14px 8px; color:#64748b; font-size:11.5px; background:#f8fafc; border-radius:8px; border:1px dashed #cbd5e1;">
        <i data-lucide="search-x" class="lucide-sm" style="color:#94a3b8; display:block; margin:0 auto 4px auto;"></i>
        Không tìm thấy cây khớp với <strong>"${esc(currentSidebarPlantSearchQuery)}"</strong>
      </div>
    `;
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    return;
  }

  const healthColors = { 'Tốt': '#10b981', 'Bình thường': '#f59e0b', 'Cần chú ý': '#f97316', 'Bệnh': '#ef4444' };

  listEl.innerHTML = filteredPlants.map(p => {
    const hasGps = !!(p.latitude && p.longitude && !isNaN(parseFloat(p.latitude)) && !isNaN(parseFloat(p.longitude)));
    const isPinningThis = String(pinningPlantTargetId) === String(p.id);
    const shortCode = getShortTreeCode(p.tree_code, p.id);

    return `
      <div class="gis-plant-item ${isPinningThis ? 'pinning-active' : ''}" onclick="focusPlantOnGisMap(${p.id})">
        <div style="display:flex; align-items:center; gap:7px; flex:1; min-width:0;">
          <span style="min-width:22px; height:22px; padding:0 5px; border-radius:6px; background:${hasGps ? '#ecfdf5' : '#f1f5f9'}; color:${hasGps ? '#047857' : '#64748b'}; border:1px solid ${hasGps ? '#a7f3d0' : '#cbd5e1'}; font-size:10.5px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">
            ${esc(shortCode)}
          </span>
          <div style="flex:1; min-width:0;">
            <strong style="font-size:11.5px; color:#0f172a; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              Cây ${esc(p.tree_code || p.id)}: ${esc(p.plant_type || '—')}
            </strong>
            <div style="display:flex; align-items:center; gap:5px; font-size:10px; color:#64748b; margin-top:1px;">
              ${p.plant_variety ? `<span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:85px;">${esc(p.plant_variety)}</span><span>·</span>` : ''}
              <span style="color:${hasGps ? '#059669' : '#94a3b8'}; font-weight:600; display:inline-flex; align-items:center; gap:2px; white-space:nowrap;">
                <i data-lucide="${hasGps ? 'map-pin' : 'circle-dashed'}" class="lucide-xs" style="width:10px!important;height:10px!important;"></i>
                ${hasGps ? 'Đã định vị' : 'Chưa có GPS'}
              </span>
            </div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
          <span class="gis-plant-health-dot" title="Trạng thái: ${esc(p.health_status || 'Tốt')}" style="background:${healthColors[p.health_status] || '#10b981'}; margin-right:2px;"></span>
          <button type="button" class="gis-plant-action-btn ${isPinningThis ? 'pin-btn-active' : (hasGps ? 'pin-btn-has-gps' : 'pin-btn-needs-gps')}" title="${isPinningThis ? 'Đang chọn vị trí trên bản đồ (Click để hủy)' : (hasGps ? 'Gắn lại / Dời điểm Point GPS trên bản đồ' : 'Import gắn điểm Point GPS cho cây này trên bản đồ')}" onclick="event.stopPropagation(); startPinSinglePlantGps(${p.id}, '${esc(p.tree_code || p.id)}')">
            <i data-lucide="${isPinningThis ? 'crosshair' : 'map-pin'}" class="lucide-xs"></i>
            <span>${isPinningThis ? 'Hủy' : (hasGps ? 'Đổi point' : 'Gắn point')}</span>
          </button>
          <button type="button" class="gis-plant-action-btn" title="Chỉnh sửa hồ sơ & tọa độ cây" onclick="event.stopPropagation(); openPlantModal(${p.id})">
            <i data-lucide="edit-3" class="lucide-xs"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  bindPlantTooltips(filteredPlants);
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function refreshCurrentSidebarPlantListUI() {
  renderCurrentSidebarPlantList();
}
window.refreshCurrentSidebarPlantListUI = refreshCurrentSidebarPlantListUI;

function filterGisSidebarPlantsList(val) {
  currentSidebarPlantSearchQuery = val || '';
  const clearBtn = document.getElementById('gis-sidebar-plant-search-clear');
  if (clearBtn) {
    clearBtn.style.display = currentSidebarPlantSearchQuery.trim().length > 0 ? 'inline-flex' : 'none';
  }
  renderCurrentSidebarPlantList();
}
window.filterGisSidebarPlantsList = filterGisSidebarPlantsList;

function clearGisSidebarPlantSearch() {
  currentSidebarPlantSearchQuery = '';
  const inputEl = document.getElementById('gis-sidebar-plant-search');
  if (inputEl) {
    inputEl.value = '';
    inputEl.focus();
  }
  const clearBtn = document.getElementById('gis-sidebar-plant-search-clear');
  if (clearBtn) clearBtn.style.display = 'none';
  renderCurrentSidebarPlantList();
}
window.clearGisSidebarPlantSearch = clearGisSidebarPlantSearch;

function backToFarmsList() {
  activeFarmId = null;
  cancelAllGisPinModes();
  gisEdgeMarkers.forEach(m => { try { m.remove(); } catch(_) {} });
  gisEdgeMarkers = [];
  if (gMap) removeContourLinesFromMap(gMap);
  initGisPage();
}

// ── Bật/Tắt vị trí ghim các cây trên bản đồ trang trại ──────────────────
let arePlantMarkersVisible = true;
function togglePlantMarkers(forceState) {
  if (typeof forceState === 'boolean') {
    arePlantMarkersVisible = forceState;
  } else {
    arePlantMarkersVisible = !arePlantMarkersVisible;
  }

  gisPlantMarkers.forEach(m => {
    const el = m.getElement();
    if (el) el.style.display = arePlantMarkersVisible ? '' : 'none';
  });

  const btn = document.getElementById('btn-toggle-plant-markers');
  if (btn) {
    btn.innerHTML = arePlantMarkersVisible 
      ? '<i data-lucide="eye" class="lucide-sm"></i> Hiện / Ẩn Vị Trí Cây' 
      : '<i data-lucide="eye-off" class="lucide-sm"></i> Đã Ẩn Vị Trí Cây';
    btn.style.background = arePlantMarkersVisible ? '#fff' : '#fef3c7';
    btn.style.borderColor = arePlantMarkersVisible ? '#cbd5e1' : '#f59e0b';
    btn.style.color = arePlantMarkersVisible ? 'inherit' : '#d97706';
  }

  toast(arePlantMarkersVisible ? 'Đã BẬT vị trí cây trồng' : 'Đã ẨN vị trí cây trồng', 'info');
}

// ── Đo đạc hiển thị kích thước cạnh ranh giới, diện tích & chu vi ───────
let gisEdgeMarkers = [];

function renderFarmDimensions(farm) {
  gisEdgeMarkers.forEach(m => {
    try { m.remove(); } catch(_) {}
  });
  gisEdgeMarkers = [];

  if (!farm || !gMap) return;

  let coords = [];
  try {
    coords = typeof farm.polygon_coordinates === 'string' ? JSON.parse(farm.polygon_coordinates) : farm.polygon_coordinates;
  } catch(e) {}

  if (!coords || !Array.isArray(coords) || coords.length < 3) return;

  let uniquePts = [...coords];
  if (uniquePts.length > 3 &&
      uniquePts[0][0] === uniquePts[uniquePts.length - 1][0] &&
      uniquePts[0][1] === uniquePts[uniquePts.length - 1][1]) {
    uniquePts.pop();
  }

  const getVertexLabel = (idx) => {
    let label = '';
    let n = idx;
    while (n >= 0) {
      label = String.fromCharCode((n % 26) + 65) + label;
      n = Math.floor(n / 26) - 1;
    }
    return label;
  };

  let totalPerimeter = 0;
  const n = uniquePts.length;

  for (let i = 0; i < n; i++) {
    const pt1 = uniquePts[i];
    const pt2 = uniquePts[(i + 1) % n];

    if (!pt1 || !pt2 || pt1.length < 2 || pt2.length < 2) continue;

    const from = turf.point(pt1);
    const to = turf.point(pt2);
    const lengthMeters = turf.distance(from, to, { units: 'meters' });
    totalPerimeter += lengthMeters;

    // Bỏ qua các điểm trùng nhau có chiều dài < 0.2m (lỗi 0.0m)
    if (lengthMeters < 0.2) continue;

    const vStart = getVertexLabel(i);
    const vEnd = getVertexLabel((i + 1) % n);
    const segName = `${vStart}${vEnd}`;

    // 1. Render Vertex Marker Badge at Corner (A, B, C, D...)
    const cornerBadgeEl = document.createElement('div');
    cornerBadgeEl.className = 'farm-corner-badge';
    cornerBadgeEl.style.cssText = `
      background: #ef4444;
      color: #ffffff;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 900;
      border: 2px solid #ffffff;
      box-shadow: 0 4px 10px rgba(0,0,0,0.5);
      user-select: none;
      pointer-events: none;
      transform: translate(-50%, -50%);
    `;
    cornerBadgeEl.textContent = vStart;

    const cornerMarker = new mapboxgl.Marker({ element: cornerBadgeEl, anchor: 'center' })
      .setLngLat(pt1)
      .addTo(gMap);

    gisEdgeMarkers.push(cornerMarker);

    // 2. Render Edge Segment Badge at Midpoint (AB: 98m, BC: 50m...)
    // Đối với đoạn cuối nối về điểm đầu (i === n - 1), không show nhãn lên bản đồ theo yêu cầu
    if (i !== n - 1) {
      const midLng = (pt1[0] + pt2[0]) / 2;
      const midLat = (pt1[1] + pt2[1]) / 2;

      const formattedLength = lengthMeters >= 1000 
        ? (lengthMeters / 1000).toFixed(2) + ' km' 
        : lengthMeters.toFixed(1) + ' m';

      const edgeBadgeEl = document.createElement('div');
      edgeBadgeEl.className = 'farm-edge-badge';
      edgeBadgeEl.style.cssText = `
        background: rgba(15, 23, 42, 0.92);
        color: #38bdf8;
        font-size: 11px;
        font-weight: 800;
        padding: 3px 9px;
        border-radius: 12px;
        border: 1.5px solid #0284c7;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        white-space: nowrap;
        pointer-events: none;
        user-select: none;
        transform: translate(-50%, -50%);
        display: inline-flex;
        align-items: center;
        gap: 4px;
      `;
      edgeBadgeEl.innerHTML = `<i data-lucide="ruler" class="lucide-xs" style="color:#38bdf8;"></i> <strong>${segName}</strong>: ${formattedLength}`;

      const edgeMarker = new mapboxgl.Marker({ element: edgeBadgeEl, anchor: 'center' })
        .setLngLat([midLng, midLat])
        .addTo(gMap);

      gisEdgeMarkers.push(edgeMarker);
    }
  }

  let sumLng = 0, sumLat = 0;
  coords.forEach(pt => {
    sumLng += pt[0];
    sumLat += pt[1];
  });
  const centerLng = sumLng / n;
  const centerLat = sumLat / n;

  const farmAreaM2 = parseFloat(farm.area || 0) || Math.round(turf.area(turf.polygon([[...coords, coords[0]]])));
  const farmAreaHa = (farmAreaM2 / 10000).toFixed(2);
  const formattedPerimeter = totalPerimeter >= 1000 
    ? (totalPerimeter / 1000).toFixed(2) + ' km' 
    : totalPerimeter.toFixed(1) + ' m';

  const summaryBadgeEl = document.createElement('div');
  summaryBadgeEl.className = 'farm-summary-badge';
  summaryBadgeEl.style.cssText = `
    background: linear-gradient(135deg, #065f46, #059669);
    color: #ffffff;
    font-size: 12px;
    font-weight: 800;
    padding: 7px 16px;
    border-radius: 20px;
    border: 2px solid #ffffff;
    box-shadow: 0 6px 20px rgba(0,0,0,0.45);
    white-space: nowrap;
    text-align: center;
    user-select: none;
    pointer-events: auto;
  `;
  summaryBadgeEl.innerHTML = `
    <div style="font-size:13px; color:#fff; font-weight:900; display:flex; align-items:center; justify-content:center; gap:5px;"><i data-lucide="wheat" class="lucide-sm"></i> ${esc(farm.name)}</div>
    <div style="font-size:11px; opacity:0.95; margin-top:3px; display:flex; align-items:center; justify-content:center; gap:6px;">
      <span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="scaling" class="lucide-xs"></i> Diện tích: <strong>${Math.round(farmAreaM2).toLocaleString('vi-VN')} m² (${farmAreaHa} ha)</strong></span>
      <span style="opacity:0.5;">|</span>
      <span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="compass" class="lucide-xs"></i> Chu vi: <strong>${formattedPerimeter}</strong></span>
    </div>
  `;

  const summaryMarker = new mapboxgl.Marker({ element: summaryBadgeEl, anchor: 'bottom' })
    .setLngLat([centerLng, centerLat])
    .addTo(gMap);

  gisEdgeMarkers.push(summaryMarker);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// ── Import Bản Vẽ Thiết Kế (CAD / GeoJSON / Image Overlay) ───────────────
let selectedDrawingFile = null;

function openDesignDrawingModal() {
  selectedDrawingFile = null;
  const titleInput = document.getElementById('f-drawing-title');
  if (titleInput) {
    const targetFarm = activeFarmId ? currentFarms.find(f => f.id === activeFarmId) : null;
    titleInput.value = targetFarm ? `Bản vẽ Thiết kế ${targetFarm.name}` : `Bản vẽ Quy hoạch Vườn`;
  }
  const fileInput = document.getElementById('f-drawing-file');
  if (fileInput) fileInput.value = '';
  const opacityInput = document.getElementById('f-drawing-opacity');
  if (opacityInput) opacityInput.value = 80;
  const opacityVal = document.getElementById('drawing-opacity-val');
  if (opacityVal) opacityVal.textContent = '80%';
  const previewBox = document.getElementById('drawing-preview-box');
  if (previewBox) previewBox.style.display = 'none';

  const modal = document.getElementById('design-drawing-modal');
  if (modal) modal.style.display = 'flex';
}

function closeDesignDrawingModal() {
  const modal = document.getElementById('design-drawing-modal');
  if (modal) modal.style.display = 'none';
}

function previewDrawingFile(input) {
  if (input.files && input.files[0]) {
    selectedDrawingFile = input.files[0];
    const previewBox = document.getElementById('drawing-preview-box');
    const filenameEl = document.getElementById('drawing-filename');
    if (filenameEl) filenameEl.textContent = `${selectedDrawingFile.name} (${(selectedDrawingFile.size / 1024).toFixed(1)} KB)`;
    if (previewBox) previewBox.style.display = 'block';
  } else {
    selectedDrawingFile = null;
    const previewBox = document.getElementById('drawing-preview-box');
    if (previewBox) previewBox.style.display = 'none';
  }
}

async function submitDesignDrawingImport() {
  const title = (document.getElementById('f-drawing-title')?.value || '').trim();
  if (!title) {
    toast('Vui lòng nhập tên hồ sơ / bản vẽ thiết kế', 'warning');
    return;
  }
  if (!selectedDrawingFile) {
    toast('Vui lòng chọn tệp bản vẽ (GeoJSON, KML, DXF hoặc hình ảnh sơ đồ)', 'warning');
    return;
  }

  const opacity = parseFloat(document.getElementById('f-drawing-opacity')?.value || 80) / 100;
  const fileName = selectedDrawingFile.name.toLowerCase();

  toast('⏳ Đang xử lý và áp dụng bản vẽ thiết kế lên trang trại...', 'info');

  try {
    if (fileName.endsWith('.geojson') || fileName.endsWith('.json') || fileName.endsWith('.kml')) {
      const text = await selectedDrawingFile.text();
      let geojson = null;
      try {
        geojson = JSON.parse(text);
      } catch(e) {
        throw new Error('Tệp JSON/GeoJSON không đúng định dạng');
      }

      if (gMap) {
        if (gMap.getSource('farm-design-drawing-src')) {
          gMap.getSource('farm-design-drawing-src').setData(geojson);
        } else {
          gMap.addSource('farm-design-drawing-src', { type: 'geojson', data: geojson });
          gMap.addLayer({
            id: 'farm-design-drawing-fill',
            type: 'fill',
            source: 'farm-design-drawing-src',
            paint: { 'fill-color': '#0284c7', 'fill-opacity': opacity * 0.4 }
          });
          gMap.addLayer({
            id: 'farm-design-drawing-line',
            type: 'line',
            source: 'farm-design-drawing-src',
            paint: { 'line-color': '#0ea5e9', 'line-width': 2.5, 'line-opacity': opacity }
          });
        }
      }
    } else {
      // Image Overlay (PNG / JPG / PDF)
      const reader = new FileReader();
      reader.onload = function(e) {
        const imageUrl = e.target.result;
        const targetFarm = activeFarmId ? currentFarms.find(f => f.id === activeFarmId) : currentFarms[0];
        let coords = targetFarm ? targetFarm.polygon_coordinates : null;
        if (typeof coords === 'string') try { coords = JSON.parse(coords); } catch(_) {}

        if (gMap && coords && coords.length >= 3) {
          let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
          coords.forEach(pt => {
            if (pt[0] < minLng) minLng = pt[0];
            if (pt[0] > maxLng) maxLng = pt[0];
            if (pt[1] < minLat) minLat = pt[1];
            if (pt[1] > maxLat) maxLat = pt[1];
          });

          const imgCoords = [
            [minLng, maxLat], // Top-Left
            [maxLng, maxLat], // Top-Right
            [maxLng, minLat], // Bottom-Right
            [minLng, minLat]  // Bottom-Left
          ];

          if (gMap.getSource('farm-design-drawing-img-src')) {
            gMap.removeLayer('farm-design-drawing-raster');
            gMap.removeSource('farm-design-drawing-img-src');
          }

          gMap.addSource('farm-design-drawing-img-src', {
            type: 'image',
            url: imageUrl,
            coordinates: imgCoords
          });

          gMap.addLayer({
            id: 'farm-design-drawing-raster',
            type: 'raster',
            source: 'farm-design-drawing-img-src',
            paint: { 'raster-opacity': opacity }
          });
        }
      };
      reader.readAsDataURL(selectedDrawingFile);
    }

    closeDesignDrawingModal();
    toast('✅ Đã Import và phủ Bản Vẽ Thiết Kế thành công lên bản đồ trang trại!', 'success');
  } catch(err) {
    toast('Lỗi import bản vẽ: ' + err.message, 'error');
  }
}

async function editFarm() {
  if (!activeFarmId) return;
  try {
    const farm = currentFarms.find(f => f.id === activeFarmId);
    if (!farm) return;

    // 1. Remove edge dimension badges and corner markers that block pointer events on polygon vertices
    gisEdgeMarkers.forEach(m => {
      try { m.remove(); } catch(_) {}
    });
    gisEdgeMarkers = [];

    // 2. Remove 3D contour lines and temporarily hide static polygon layers to avoid overlap with Draw control
    if (gMap) {
      removeContourLinesFromMap(gMap);
      const farmLayerId = `gis-farm-layer-${farm.id}`;
      const farmOutlineId = `gis-farm-outline-${farm.id}`;
      if (gMap.getLayer(farmLayerId)) gMap.setLayoutProperty(farmLayerId, 'visibility', 'none');
      if (gMap.getLayer(farmOutlineId)) gMap.setLayoutProperty(farmOutlineId, 'visibility', 'none');
    }

    switchGisView('form');
    document.getElementById('gis-sidebar-title').textContent = 'Sửa Trang trại: ' + farm.name;
    document.getElementById('farm-name').value = farm.name;
    document.getElementById('farm-desc').value = farm.description || '';
    if (document.getElementById('farm-puc-code')) document.getElementById('farm-puc-code').value = farm.puc_code || '';
    if (document.getElementById('farm-vietgap-cert')) document.getElementById('farm-vietgap-cert').value = farm.vietgap_cert_number || '';
    if (document.getElementById('farm-vietgap-org')) document.getElementById('farm-vietgap-org').value = farm.vietgap_cert_org || '';

    // Populate GPS fields with farm center coordinates
    const center = getFarmExactGpsCenter(farm, currentPlants);
    if (center && center.length >= 2) {
      const [cLng, cLat] = center;
      if (document.getElementById('farm-gps-lat')) document.getElementById('farm-gps-lat').value = cLat.toFixed(6);
      if (document.getElementById('farm-gps-lng')) document.getElementById('farm-gps-lng').value = cLng.toFixed(6);
      if (document.getElementById('farm-gps-smart-input')) document.getElementById('farm-gps-smart-input').value = `${cLat.toFixed(6)}, ${cLng.toFixed(6)}`;
      pingGpsLocationOnMap(cLat, cLng, farm.name);
    } else {
      if (document.getElementById('farm-gps-smart-input')) document.getElementById('farm-gps-smart-input').value = '';
      if (document.getElementById('farm-gps-lat')) document.getElementById('farm-gps-lat').value = '';
      if (document.getElementById('farm-gps-lng')) document.getElementById('farm-gps-lng').value = '';
      clearGisGpsBeacon();
    }

    document.getElementById('farm-area-display').textContent = Math.round(parseFloat(farm.area || 0)).toLocaleString('vi-VN') + ' m²';
    document.getElementById('farm-area-ha').textContent = ((farm.area || 0) / 10000).toFixed(2);
    window._lastDrawnArea = farm.area || 0;

    await loadUsersDropdown(farm.user_id, farm.id);
    if (window.lucide && typeof window.lucide.createIcons === 'function') lucide.createIcons();

    let coords = [];
    try {
      coords = typeof farm.polygon_coordinates === 'string' ? JSON.parse(farm.polygon_coordinates) : farm.polygon_coordinates;
    } catch(e) {}

    while (Array.isArray(coords) && coords.length > 0 && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
      coords = coords[0];
    }

    if (coords && Array.isArray(coords) && coords.length >= 3) {
      const polyCoords = [...coords];
      if (polyCoords.length > 0 && 
          (polyCoords[0][0] !== polyCoords[polyCoords.length - 1][0] || 
           polyCoords[0][1] !== polyCoords[polyCoords.length - 1][1])) {
        polyCoords.push(polyCoords[0]);
      }

      drawControl.deleteAll();
      const added = drawControl.add({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [polyCoords]
        }
      });

      let featureId = null;
      if (Array.isArray(added) && added.length > 0) {
        featureId = added[0];
      } else if (added && added.id) {
        featureId = added.id;
      } else if (typeof added === 'string') {
        featureId = added;
      } else {
        const all = drawControl.getAll();
        if (all && all.features && all.features.length > 0) {
          featureId = all.features[0].id;
        }
      }

      if (featureId) {
        setTimeout(() => {
          try {
            drawControl.changeMode('direct_select', { featureId: featureId });
          } catch (e) {
            console.warn('Could not switch to direct_select mode immediately:', e);
          }
        }, 150);
      }

      updateAreaDisplay();

      if (gMap) {
        const bounds = new mapboxgl.LngLatBounds();
        polyCoords.forEach(pt => {
          if (Array.isArray(pt) && pt.length >= 2) {
            bounds.extend(pt);
          }
        });
        gMap.fitBounds(bounds, { padding: 80, maxZoom: 20, duration: 600 });
      }

      toast('🎯 Đang ở chế độ sửa ranh giới: Kéo các điểm tròn trắng để điều chỉnh hình dạng!', 'info');
    } else {
      drawControl.deleteAll();
      drawControl.changeMode('draw_polygon');
      toast('Chưa có ranh giới: Hãy chấm các điểm trên bản đồ để vẽ ranh giới!', 'info');
    }
  } catch (err) {
    toast('Lỗi khi sửa trang trại: ' + err.message, 'error');
  }
}

async function deleteFarm() {
  if (!activeFarmId) return;
  const targetId = activeFarmId;
  const farmObj = (currentFarms || []).find(f => f.id === targetId);
  const farmName = farmObj ? farmObj.name : 'trang trại này';

  if (!confirm(`⚠️ XÁC NHẬN XÓA TRANG TRẠI:\n\nBạn có chắc chắn muốn xóa vĩnh viễn trang trại "${farmName}"?\nThao tác này sẽ xóa triệt để trang trại cùng TOÀN BỘ cây trồng, nhật ký canh tác và vật tư liên quan khỏi hệ thống.`)) {
    return;
  }

  // 1. Smoothly animate sidebar item
  const farmItem = document.getElementById(`farm-item-${targetId}`) || document.querySelector(`.farm-item[data-farm-id="${targetId}"]`);
  if (farmItem) {
    farmItem.classList.add('row-deleting');
  }

  // Preserve state for rollback
  const prevFarms = [...(currentFarms || [])];
  const prevPlants = [...(currentPlants || [])];

  // 2. Switch view back to list smoothly
  activeFarmId = null;
  window._pendingSelectFarmId = null;
  const backBtn = document.getElementById('gis-back-btn');
  if (backBtn) backBtn.style.display = 'none';
  const sbTitle = document.getElementById('gis-sidebar-title');
  if (sbTitle) sbTitle.innerHTML = '<i data-lucide="map" class="lucide-sm" style="color:var(--green)"></i> Trang trại';
  const hdActions = document.getElementById('gis-header-actions');
  if (hdActions) hdActions.style.display = 'block';
  switchGisView('list');

  // 3. Optimistically remove from state and redraw
  currentFarms = currentFarms.filter(f => f.id !== targetId);
  currentPlants = currentPlants.filter(p => p.farm_id !== targetId);
  drawFarmsAndPlantsLayers(currentFarms, currentPlants);
  renderFarmsList(currentFarms);

  try {
    const res = await api(`/farms/${targetId}`, { method: 'DELETE' });
    toast(res.message || 'Đã xóa vĩnh viễn trang trại cùng toàn bộ cây trồng & vật tư liên quan thành công!');
    window._plantFiltersLoaded = false;
  } catch (err) {
    toast('Lỗi xóa trang trại: ' + err.message, 'error');
    // Rollback state if delete failed
    currentFarms = prevFarms;
    currentPlants = prevPlants;
    drawFarmsAndPlantsLayers(currentFarms, currentPlants);
    renderFarmsList(currentFarms);
  }
}

function filterFarmsByCustomer() {
  const userId = document.getElementById('filter-farm-user')?.value || 'all';
  let filteredFarms = currentFarms;
  if (userId !== 'all') {
    filteredFarms = currentFarms.filter(f => f.user_id == userId);
  }

  // Filter the plants to only show those inside the filtered farms
  const filteredPlants = (userId === 'all') 
    ? currentPlants 
    : currentPlants.filter(p => filteredFarms.some(f => f.id === p.farm_id));

  renderFarmsList(filteredFarms);
  
  // Re-initialize the Mapbox GIS map with filtered data
  if (gMap) {
    try {
      gMap.remove();
    } catch(e) {}
    gMap = null;
  }
  initGisMap(filteredFarms, filteredPlants);
}

/**
 * Thêm đường đồng mức siêu dày 1m (1-Meter High-Density Contour Lines)
 * DÀNH RIÊNG CHO RANH GIỚI NÔNG TRẠI (Zero Lag, Tối ưu tối đa hiệu năng).
 * @param {mapboxgl.Map} map - Mapbox map instance
 * @param {Object} options - { defaultVisible: true, showControl: true, farmCoords: Array }
 */
// [Modularized] Contour lines & A4 export moved to gis-export.js
function bindPlantTooltips(plants) {
  if (!plants || !plants.length) return;
  setTimeout(function() {
    const items = document.querySelectorAll('#farm-details-plants-list .gis-plant-item');
    items.forEach(function(item, idx) {
      const plant = plants[idx];
      if (!plant) return;
      item.addEventListener('mouseenter', function(e) {
        showPlantTooltip(item, plant, e);
      });
      item.addEventListener('mouseleave', function() {
        hidePlantTooltip();
      });
    });
  }, 100);
}

function openUserTierModalFromGis(userId) {
  if (typeof window.openUserTierModal === 'function') {
    window.openUserTierModal(userId);
  } else if (typeof window.showPage === 'function') {
    window.showPage('users');
  }
}
window.openUserTierModalFromGis = openUserTierModalFromGis;

async function confirmClearFarmPlantsGps(farmId) {
  const targetId = farmId || activeFarmId;
  if (!targetId) {
    toast('Vui lòng chọn một trang trại trước khi xóa tọa độ GPS!', 'warning');
    return;
  }
  
  const farmTitle = document.getElementById('gis-sidebar-title')?.textContent || `Trang trại #${targetId}`;
  
  if (!confirm(`⚠️ XÁC NHẬN XÓA TOÀN BỘ ĐỊNH VỊ GPS:\n\nBạn có chắc chắn muốn xóa hết tọa độ định vị GPS của TẤT CẢ các cây trong vườn "${farmTitle}" không?\n\nSau khi xóa, toàn bộ cây sẽ chuyển về trạng thái Chưa định vị trên bản đồ (dữ liệu nhật ký và mã cây vẫn được giữ nguyên 100%).`)) {
    return;
  }

  try {
    const res = await api(`/farms/${targetId}/clear-gps`, { method: 'POST' });
    toast(res.message || 'Đã xóa toàn bộ tọa độ định vị GPS của các cây trong trang trại thành công!', 'success');
    
    // Clear markers from GIS Map
    if (plantMarkers && plantMarkers.length > 0) {
      plantMarkers.forEach(m => {
        try { m.remove(); } catch (_) {}
      });
      plantMarkers = [];
    }

    // Refresh GIS View
    if (typeof loadFarms === 'function') await loadFarms();
    await selectFarm(targetId);
  } catch (err) {
    console.error('Error clearing plants GPS:', err);
    toast('Lỗi khi xóa tọa độ GPS: ' + (err.message || 'Lỗi server'), 'error');
  }
}
window.confirmClearFarmPlantsGps = confirmClearFarmPlantsGps;

// [Modularized] Live API dataset modals moved to gis-export.js