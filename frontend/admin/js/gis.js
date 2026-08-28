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

let mapboxTokenFetched = false;
async function ensureMapboxToken() {
  if (mapboxTokenFetched) return;
  const res = await fetch(API + '/config/mapbox-token');
  if (!res.ok) throw new Error('Không thể lấy cấu hình Mapbox từ server');
  const data = await res.json();
  if (!data || !data.token) throw new Error('Cấu hình Mapbox không hợp lệ hoặc thiếu token');
  mapboxgl.accessToken = data.token;
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
                  <h4 style="color:${farmColor}"><i class="fa-solid fa-house-flag"></i> Trang trại: ${esc(farm.name)}</h4>
                  <p><i class="fa fa-user"></i> Khách hàng: <strong>${esc(farm.user_name || 'Chưa gán')}</strong></p>
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
              <i class="fa-solid fa-house" style="font-size:7.5px; color:#ffffff;"></i>
            </div>
          </div>
          <div class="farm-pin-badge" style="background:${farmColor};">
            <i class="fa-solid fa-house-flag"></i> ${esc(farm.name)}
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
                <h4 style="color:${farmColor}"><i class="fa-solid fa-house-flag"></i> Trang trại: ${esc(farm.name)}</h4>
                <p><i class="fa fa-user"></i> Khách hàng: <strong>${esc(farm.user_name || 'Chưa gán')}</strong></p>
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
    document.getElementById('gis-sidebar-title').innerHTML = '<i class="fa-solid fa-map" style="color:var(--green)"></i> Trang trại';
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

function renderFarmsList(farms) {
  const container = document.getElementById('farms-list-container');
  if (!farms.length) {
    container.innerHTML = '<div class="empty-state"><i class="fa fa-map-location-dot"></i><p>Chưa có trang trại nào. Hãy thêm mới!</p></div>';
    return;
  }
  container.innerHTML = farms.map(f => `
    <div class="farm-item" onclick="selectFarm(${f.id})">
      <div class="farm-item-name">${esc(f.name)}</div>
      <div class="farm-item-meta" style="flex-wrap: wrap; gap: 8px;">
        <span><i class="fa-solid fa-ruler-combined" style="color:var(--green-dark)"></i> ${f.area ? Math.round(parseFloat(f.area)).toLocaleString('vi-VN') : 0} m²</span>
        <span><i class="fa-solid fa-seedling" style="color:var(--green)"></i> ${f.plant_count} cây</span>
        <span><i class="fa fa-user" style="color:#ea580c"></i> ${esc(f.user_name || 'Chưa gán')}</span>
      </div>
    </div>
  `).join('');
}

function initGisMap(farms, plants) {
  const container = document.getElementById('gis-map');
  if (!container) return;
  container.innerHTML = '';
  
  gMap = new mapboxgl.Map({
    container: 'gis-map',
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center: [106.3, 12.5],
    zoom: 5,
    maxZoom: 17.5,
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

  // Click map handler cho Chế độ Import GIS Cây Trồng
  gMap.on('click', (e) => {
    if (!isGisImportMode) return;

    // Ngăn chặn trigger click nếu đang trong chế độ vẽ polygon
    if (drawControl && drawControl.getMode && drawControl.getMode() !== 'simple_select') return;

    const { lng, lat } = e.lngLat;

    // Gắn ghim tạm thời khi click chọn vị trí cây
    if (gisImportTempMarker) {
      gisImportTempMarker.remove();
      gisImportTempMarker = null;
    }

    const el = document.createElement('div');
    el.className = 'gis-temp-click-pin';
    el.style.cssText = 'font-size:32px; color:#ef4444; filter:drop-shadow(0 4px 10px rgba(0,0,0,0.6)); pointer-events:none;';
    el.innerHTML = '<i class="fa-solid fa-location-dot fa-bounce"></i>';

    gisImportTempMarker = new mapboxgl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(gMap);

    openPlantModalForGisClick(lng, lat);
  });

  gMap.on('load', () => {
    drawFarmsAndPlantsLayers(farms, plants);
  });

  setTimeout(() => {
    try { if (gMap) gMap.resize(); } catch(_) {}
  }, 300);
}

// Chuyển đổi Bật/Tắt chế độ Import GIS (Click chọn vị trí cây trên bản đồ)
let isGisImportMode = false;
let gisImportTempMarker = null;

function toggleGisImportMode(forceState) {
  if (typeof forceState === 'boolean') {
    isGisImportMode = forceState;
  } else {
    isGisImportMode = !isGisImportMode;
  }

  const btn = document.getElementById('btn-gis-import-mode');
  const banner = document.getElementById('gis-import-active-banner');

  if (isGisImportMode) {
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Đang Bật Import GIS (Click Bản Đồ)';
      btn.style.background = '#059669';
      btn.style.borderColor = '#047857';
    }
    if (banner) banner.style.display = 'flex';
    if (gMap) gMap.getCanvas().style.cursor = 'crosshair';
    toast('📍 Đã bật chế độ Import GIS: Click vào vị trí cây trên bản đồ để lấy tọa độ GPS!', 'info');
  } else {
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-map-pin"></i> 📍 Import GIS (Click chọn vị trí cây trên bản đồ)';
      btn.style.background = '#10b981';
      btn.style.borderColor = '#059669';
    }
    if (banner) banner.style.display = 'none';
    if (gMap) gMap.getCanvas().style.cursor = '';
    if (gisImportTempMarker) {
      gisImportTempMarker.remove();
      gisImportTempMarker = null;
    }
  }
}

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

  toast(`📍 Đã ghim GPS (${lat.toFixed(5)}, ${lng.toFixed(5)}). Hãy nhập thông tin chi tiết cây trồng!`, 'success');
}

// Hook gọi sau khi lưu cây thành công từ Modal
window.onPlantSavedHook = function(plant) {
  if (gisImportTempMarker) {
    gisImportTempMarker.remove();
    gisImportTempMarker = null;
  }
  if (activeFarmId) {
    selectFarm(activeFarmId);
  }
  if (isGisImportMode) {
    toast('✅ Đã lưu cây mới vào hệ thống GIS! Tiếp tục click bản đồ để nhập cây tiếp theo.', 'info');
  }
};

let gisPlantMarkers = [];
let gisFarmMarkers = [];

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

        const marker = new mapboxgl.Marker(wrapper)
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div class="map-tooltip">
                <h4><i class="fa-solid fa-tree" style="color:#10b981"></i> Cây #${esc(plant.tree_code || plant.id)}: ${esc(plant.plant_type)}</h4>
                ${plant.plant_variety ? `<p>Giống: <strong>${esc(plant.plant_variety)}</strong></p>` : ''}
                <p>Sức khỏe: <strong>${esc(plant.health_status)}</strong></p>
                <p>Vị trí: ${esc(plant.location || 'Chưa ghi nhận')}</p>
                <div style="margin-top:8px">
                  <button class="btn btn-primary btn-sm" onclick="openPlantModal(${plant.id})">Chi tiết</button>
                </div>
              </div>
            `)
          )
          .addTo(gMap);

        gisPlantMarkers.push(marker);

        bounds.extend([lng, lat]);
        hasBounds = true;
      }
    }
  });

  if (hasBounds && !activeFarmId) {
    gMap.fitBounds(bounds, { padding: 50, maxZoom: 16, duration: 1000 });
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

async function loadUsersDropdown(selectedUserId = '') {
  try {
    const users = await api('/users');
    const select = document.getElementById('farm-user-id');
    if (select) {
      select.innerHTML = '<option value="">— Chưa gán cho ai —</option>' + 
        users.map(u => {
          const roleLabel = u.role === 'admin' ? ' (Admin)' : ' (Nông hộ)';
          return `<option value="${u.id}" ${u.id == selectedUserId ? 'selected' : ''}>${esc(u.full_name)}${roleLabel}</option>`;
        }).join('');
    }
  } catch (err) {
    console.error('Error loading users for dropdown:', err);
  }
}

async function openFarmForm() {
  activeFarmId = null;
  document.getElementById('gis-back-btn').style.display = 'block';
  document.getElementById('gis-sidebar-title').textContent = 'Tạo Trang trại';
  document.getElementById('gis-header-actions').style.display = 'none';
  switchGisView('form');
  
  document.getElementById('farm-name').value = '';
  document.getElementById('farm-desc').value = '';
  document.getElementById('farm-area-display').textContent = '0 m²';
  document.getElementById('farm-area-ha').textContent = '0';
  if (document.getElementById('farm-perm-plants')) document.getElementById('farm-perm-plants').checked = true;
  if (document.getElementById('farm-perm-history')) document.getElementById('farm-perm-history').checked = true;
  if (document.getElementById('farm-perm-supplies')) document.getElementById('farm-perm-supplies').checked = true;
  window._lastDrawnArea = 0;

  await loadUsersDropdown();

  drawControl.deleteAll();
  drawControl.changeMode('draw_polygon');
}

function cancelFarmForm() {
  drawControl.changeMode('simple_select');
  drawControl.deleteAll();
  initGisPage();
}

async function saveFarm() {
  const name = document.getElementById('farm-name').value.trim();
  const description = document.getElementById('farm-desc').value.trim();
  const user_id = document.getElementById('farm-user-id').value;
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
  const area = window._lastDrawnArea || 0;

  const body = {
    name,
    description,
    polygon_coordinates: coordinates,
    area,
    user_id: user_id ? parseInt(user_id) : null
  };

  try {
    const method = activeFarmId ? 'PUT' : 'POST';
    const url = activeFarmId ? `/farms/${activeFarmId}` : '/farms';
    
    const savedFarm = await api(url, {
      method,
      body: JSON.stringify(body)
    });

    toast(activeFarmId ? 'Đã cập nhật ranh giới trang trại!' : 'Đã tạo trang trại thành công!');
    drawControl.changeMode('simple_select');
    drawControl.deleteAll();
    
    window._plantFiltersLoaded = false;
    await initGisPage();
    if (savedFarm && savedFarm.id) {
      selectFarm(savedFarm.id);
    }
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

  document.getElementById('gis-back-btn').style.display = 'block';
  document.getElementById('gis-header-actions').style.display = 'none';
  switchGisView('details');
  
  try {
    const farm = await api(`/farms/${farmId}`);
    if (window._pendingSelectFarmId === farmId) {
      window._pendingSelectFarmId = null;
    }

    const isOwnerPro = farm.user_account_tier === 'pro' || farm.user_role === 'admin';
    const tierBadgeHtml = isOwnerPro
      ? `<span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px;"><i class="fa-solid fa-crown" style="color:#f59e0b;"></i> Gói PRO</span>`
      : `<span style="background:#fffbeb; color:#b45309; border:1px solid #fde68a; font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px;">⚪ Gói NORMAL</span>`;

    const ownerHtml = `
      <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:12px; padding:12px; margin-bottom:12px;">
        <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:4px;">Nông hộ phụ trách Trang trại</div>
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
          <span style="font-size:13.5px; font-weight:800; color:#0f172a;"><i class="fa fa-user" style="color:#059669"></i> ${esc(farm.user_name || 'Chưa gán')}</span>
          ${tierBadgeHtml}
        </div>
        ${!isOwnerPro ? `
          <div style="margin-top:10px; background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:10px; font-size:11.5px; color:#78350f;">
            <div style="font-weight:800; margin-bottom:4px;"><i class="fa-solid fa-triangle-exclamation" style="color:#d97706;"></i> Nông hộ NORMAL (Giới hạn GIS)</div>
            <div>Bản vẽ CAD quy hoạch, Chấm GIS cây lẻ & Đường đồng mức 3D tối ưu cho Gói PRO 👑.</div>
            <button onclick="openUserTierModalFromGis(${farm.user_id})" style="margin-top:8px; width:100%; background:linear-gradient(135deg, #059669, #047857); color:#fff; border:none; border-radius:8px; padding:7px 10px; font-size:11.5px; font-weight:800; cursor:pointer;">
              👑 Kích hoạt Gói PRO cho Nông hộ này
            </button>
          </div>
        ` : `
          <div style="margin-top:8px; font-size:11px; color:#047857; font-weight:700; display:flex; align-items:center; gap:4px;">
            <i class="fa-solid fa-circle-check"></i> Đã mở khóa 100% Công cụ GIS, Cảm biến IoT & CAD
          </div>
        `}
      </div>
    `;

    document.getElementById('farm-details-desc').innerHTML = ownerHtml + (farm.description ? `<p class="gis-farm-info" style="margin-top:6px;">${esc(farm.description)}</p>` : '<p class="gis-farm-info" style="font-style:italic; color:#94a3b8; margin-top:6px;">Không có mô tả.</p>');
    document.getElementById('gis-sidebar-title').textContent = farm.name;
    
    const areaVal = Math.round(parseFloat(farm.area || 0)).toLocaleString('vi-VN') + ' m²';
    document.getElementById('farm-details-area').innerHTML = `<i class="fa-solid fa-chart-area"></i> ${areaVal}`;
    document.getElementById('farm-details-plant-count').textContent = farm.plants ? farm.plants.length : 0;

    const listEl = document.getElementById('farm-details-plants-list');
    if (!farm.plants || farm.plants.length === 0) {
      listEl.innerHTML = '<p style="font-size:12px;color:#94a3b8;text-align:center;padding:12px">Chưa có cây nào trong trang trại này.</p>';
    } else {
      const healthColors = { 'Tốt': '#10b981', 'Bình thường': '#f59e0b', 'Cần chú ý': '#f97316', 'Bệnh': '#ef4444' };
      listEl.innerHTML = farm.plants.map(p => `
        <div class="gis-plant-item" onclick="openPlantModal(${p.id})">
          <div style="flex:1; min-width:0;">
            <strong style="font-size:11.5px; color:#0f172a; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Cây ${esc(p.tree_code || p.id)}: ${esc(p.plant_type)}</strong>
            ${p.plant_variety ? `<small style="color:#64748b">${esc(p.plant_variety)}</small>` : ''}
          </div>
          <div style="display:flex; align-items:center; gap:5px; flex-shrink:0;">
            <span class="gis-plant-health-dot" style="background:${healthColors[p.health_status] || '#3b82f6'};"></span>
            <button class="btn btn-secondary btn-sm" style="padding:2px 6px; font-size:10px;" onclick="event.stopPropagation(); openPlantModal(${p.id})">
              <i class="fa fa-pen"></i>
            </button>
          </div>
        </div>
      `).join('');
      bindPlantTooltips(farm.plants);
    }

    let coords = [];
    try {
      coords = typeof farm.polygon_coordinates === 'string' ? JSON.parse(farm.polygon_coordinates) : farm.polygon_coordinates;
      while (Array.isArray(coords) && coords.length > 0 && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
        coords = coords[0];
      }
    } catch(e) {}

    if (gMap) {
      // Bắt buộc gọi resize bản đồ khi chuyển từ trang khác sang
      gMap.resize();

      // Clear elevation offset lock so contour elevation calibrates cleanly for selected farm
      gMap._contourOffsetLocked = false;
      delete gMap._contourEleOffset;

      // Re-render farm polygon highlights & plant markers for selected farm
      drawFarmsAndPlantsLayers(currentFarms, farm.plants);

      // Render edge dimensions (kích thước từng cạnh), chu vi & tổng diện tích
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
        setTimeout(() => {
          if (gMap) {
            gMap.resize();
            gMap.fitBounds(bounds, { padding: 60, maxZoom: 16.5, duration: 1000 });
          }
        }, 100);
      }
      
      if (gMap && coords && coords.length > 0) {
        addContourLinesToMap(gMap, { farmCoords: coords });
      } else if (gMap) {
        removeContourLinesFromMap(gMap);
      }
    }
  } catch (err) {
    toast('Lỗi tải chi tiết trang trại: ' + err.message, 'error');
  }
}

function backToFarmsList() {
  activeFarmId = null;
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
      ? '<i class="fa-solid fa-eye"></i> 🌳 Hiện / Ẩn Vị Trí Cây' 
      : '<i class="fa-solid fa-eye-slash"></i> 🙈 Đã Ẩn Vị Trí Cây';
    btn.style.background = arePlantMarkersVisible ? '#fff' : '#fef3c7';
    btn.style.borderColor = arePlantMarkersVisible ? '#cbd5e1' : '#f59e0b';
    btn.style.color = arePlantMarkersVisible ? 'inherit' : '#d97706';
  }

  toast(arePlantMarkersVisible ? '🌳 Đã BẬT vị trí cây trồng' : '🙈 Đã ẨN vị trí cây trồng', 'info');
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
        padding: 3px 8px;
        border-radius: 12px;
        border: 1.5px solid #0284c7;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        white-space: nowrap;
        pointer-events: none;
        user-select: none;
        transform: translate(-50%, -50%);
      `;
      edgeBadgeEl.innerHTML = `📏 <strong>${segName}</strong>: ${formattedLength}`;

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
    <div style="font-size:13px; color:#fff; font-weight:900;"><i class="fa-solid fa-wheat-awn"></i> ${esc(farm.name)}</div>
    <div style="font-size:11px; opacity:0.95; margin-top:2px;">
      📐 Diện tích: <strong>${Math.round(farmAreaM2).toLocaleString('vi-VN')} m² (${farmAreaHa} ha)</strong> | ⭕ Chu vi: <strong>${formattedPerimeter}</strong>
    </div>
  `;

  const summaryMarker = new mapboxgl.Marker({ element: summaryBadgeEl, anchor: 'bottom' })
    .setLngLat([centerLng, centerLat])
    .addTo(gMap);

  gisEdgeMarkers.push(summaryMarker);
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

    switchGisView('form');
    document.getElementById('gis-sidebar-title').textContent = 'Sửa Trang trại';
    document.getElementById('farm-name').value = farm.name;
    document.getElementById('farm-desc').value = farm.description || '';
    document.getElementById('farm-area-display').textContent = Math.round(parseFloat(farm.area || 0)).toLocaleString('vi-VN') + ' m²';
    document.getElementById('farm-area-ha').textContent = ((farm.area || 0) / 10000).toFixed(2);
    window._lastDrawnArea = farm.area || 0;

    await loadUsersDropdown(farm.user_id);

    let coords = [];
    try {
      coords = typeof farm.polygon_coordinates === 'string' ? JSON.parse(farm.polygon_coordinates) : farm.polygon_coordinates;
    } catch(e) {}

    if (coords && coords.length > 0) {
      const polyCoords = [...coords];
      if (polyCoords.length > 0 && 
          (polyCoords[0][0] !== polyCoords[polyCoords.length - 1][0] || 
           polyCoords[0][1] !== polyCoords[polyCoords.length - 1][1])) {
        polyCoords.push(polyCoords[0]);
      }

      drawControl.deleteAll();
      drawControl.add({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [polyCoords]
        }
      });
    }
  } catch (err) {
    toast('Lỗi khi sửa trang trại: ' + err.message, 'error');
  }
}

async function deleteFarm() {
  if (!activeFarmId) return;
  if (!confirm('Bạn có chắc chắn muốn xóa trang trại này? Các cây liên kết sẽ được giữ lại nhưng không thuộc trang trại nào nữa.')) return;
  
  try {
    await api(`/farms/${activeFarmId}`, { method: 'DELETE' });
    toast('Đã xóa trang trại thành công.');
    window._plantFiltersLoaded = false;
    initGisPage();
  } catch (err) {
    toast('Lỗi xóa trang trại: ' + err.message, 'error');
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

      const SPECTRUM_COLORS = [
        '#000080', '#0000cd', '#0000ff', '#0066ff', '#0099ff',
        '#00c8ff', '#00f0ff', '#00ffc8', '#00ff99', '#00ff33',
        '#66ff00', '#a6ff00', '#ccff00', '#ffff00', '#ffcc00',
        '#ff9900', '#ff6600', '#ff3300', '#ff0000', '#cc0000', '#800000'
      ];

      const getDynamicColorForEle = (ele, minEle, maxEle) => {
        if (maxEle <= minEle) return SPECTRUM_COLORS[0];
        const t = Math.max(0, Math.min(1, (ele - minEle) / (maxEle - minEle)));
        const idx = Math.min(SPECTRUM_COLORS.length - 1, Math.floor(t * SPECTRUM_COLORS.length));
        return SPECTRUM_COLORS[idx];
      };

      const buildDynamicColorRamp = (minEle, maxEle) => {
        const rampStops = [];
        const count = SPECTRUM_COLORS.length;
        for (let i = 0; i < count; i++) {
          const val = minEle + (i / (count - 1)) * (maxEle - minEle);
          rampStops.push(Math.round(val * 10) / 10, SPECTRUM_COLORS[i]);
        }
        return ['interpolate', ['linear'], ['get', 'ele'], ...rampStops];
      };

      // Helper tìm Bounding Box ranh giới nông trại
      const getFarmBoundingBox = () => {
        let lats = [];
        let lngs = [];

        if (options.farmCoords && Array.isArray(options.farmCoords) && options.farmCoords.length > 0) {
          options.farmCoords.forEach(pt => {
            if (Array.isArray(pt) && pt.length >= 2) {
              lngs.push(pt[0]);
              lats.push(pt[1]);
            }
          });
        }

        if (lngs.length === 0 && map.getStyle()) {
          const styleLayers = map.getStyle().layers || [];
          const farmLayers = styleLayers.filter(l => 
            l.id.includes('farm') || l.id.includes('polygon') || (l.type === 'fill' && !l.id.includes('mapbox'))
          );

          farmLayers.forEach(layer => {
            try {
              const features = map.queryRenderedFeatures({ layers: [layer.id] });
              features.forEach(f => {
                const geom = f.geometry;
                if (geom && (geom.type === 'Polygon' || geom.type === 'MultiPolygon')) {
                  const coords = geom.type === 'Polygon' ? geom.coordinates.flat() : geom.coordinates.flat(2);
                  coords.forEach(pt => {
                    if (pt && pt.length >= 2) {
                      lngs.push(pt[0]);
                      lats.push(pt[1]);
                    }
                  });
                }
              });
            } catch (_) {}
          });
        }

        if (lngs.length > 0 && lats.length > 0) {
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          
          const marginLng = (maxLng - minLng) * 0.08 || 0.0008;
          const marginLat = (maxLat - minLat) * 0.08 || 0.0008;

          return {
            west: minLng - marginLng,
            east: maxLng + marginLng,
            south: minLat - marginLat,
            north: maxLat + marginLat
          };
        }

        // Chỉ dùng mapBounds làm fallback khi người dùng đang zoom sâu vào xem địa hình (zoom >= 14)
        if (map.getZoom() >= 14) {
          const mapBounds = map.getBounds();
          if (mapBounds) {
            return {
              west: mapBounds.getWest(),
              east: mapBounds.getEast(),
              south: mapBounds.getSouth(),
              north: mapBounds.getNorth()
            };
          }
        }

        return null;
      };

      // 2-Pass 3x3 Gaussian Spatial Grid Smoothing Filter
      const smoothGrid = (rawGrid, passes = 2) => {
        const ny = rawGrid.length;
        const nx = rawGrid[0].length;
        let current = rawGrid;

        for (let p = 0; p < passes; p++) {
          const next = Array.from({ length: ny }, () => new Float64Array(nx));
          for (let r = 0; r < ny; r++) {
            for (let c = 0; c < nx; c++) {
              let sum = 0;
              let weightSum = 0;

              for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                  const nr = r + dr;
                  const nc = c + dc;
                  if (nr >= 0 && nr < ny && nc >= 0 && nc < nx) {
                    const w = (dr === 0 && dc === 0) ? 4 : ((dr === 0 || dc === 0) ? 2 : 1);
                    sum += current[nr][nc] * w;
                    weightSum += w;
                  }
                }
              }
              next[r][c] = sum / weightSum;
            }
          }
          current = next;
        }
        return current;
      };

      // 4. Hàm Sinh Đường Đồng Mức Mật Độ Biến Thiên Năng Động Theo Zoom
      const updateDense1mContours = () => {
        try {
          const bbox = getFarmBoundingBox();
          if (!bbox) {
            if (map.getSource('dense-1m-contours')) {
              map.getSource('dense-1m-contours').setData({ type: 'FeatureCollection', features: [] });
            }
            return;
          }

          // Khoảng cách đường đồng mức cố định 1m (Bình độ cái % 5 === 0, Bình độ con 1m còn lại)
          const interval = 1.0;

          // Chỉ lấy mẫu DEM khi zoom đủ cao để có dữ liệu tile độ phân giải cao và ổn định
          // Nếu zoom quá thấp (< 13), giữ nguyên dữ liệu cũ để tránh sai số datum
          const currentZoom = map.getZoom();
          if (currentZoom < 13 && map.getSource('dense-1m-contours')) return;

          const { west, south, east, north } = bbox;
          const nx = 45;
          const ny = 45;
          const dx = (east - west) / (nx - 1);
          const dy = (north - south) / (ny - 1);

          const rawGrid = [];
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
            rawGrid.push(row);
          }

          if (!hasTerrainData || minEle === Infinity || maxEle === -Infinity) return;

          // Lọc mịn lưới DEM bằng Gaussian Blur 3 pass để loại bỏ hoàn toàn nhiễu và lặp đường
          const grid = smoothGrid(rawGrid, 3);

          // Dữ liệu cao độ THỰC tế 100% từ Mapbox DEM (so với mực nước biển ASL)
          const eleOffset = 0;
          const displayMin = Math.round(minEle);
          const displayMax = Math.round(maxEle);

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
            const displayEle = Math.round((roundedThreshold - eleOffset) * 10) / 10;
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
                properties: { ele: displayEle, rawEle: roundedThreshold },
                geometry: {
                  type: 'MultiLineString',
                  coordinates: segments
                }
              });
            }
          }

          const geoData = { type: 'FeatureCollection', features };
          const dynamicRamp = buildDynamicColorRamp(displayMin, displayMax);

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

            // ─── Bình độ cái (% 5 === 0): Nét đậm 7px | Bình độ con: Nét 2.5px ───
            const isMajor = ['==', ['%', ['round', ['to-number', ['get', 'ele']]], 5], 0];

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
                // Bình độ cái (bội số 5m): đậm 7px | Bình độ con: 2.5px
                'line-width': [
                  'interpolate', ['exponential', 1.5], ['zoom'],
                  12, ['case', isMajor, 3.5, 1.5],
                  15, ['case', isMajor, 5.0, 2.0],
                  18, ['case', isMajor, 7.0, 2.5]
                ],
                'line-opacity': ['case', isMajor, 0.95, 0.8]
              }
            });

            // ─── Nhãn số cao độ hiển thị 100% trên BÌNH ĐỘ MẸ (% 5 === 0) ───
            map.addLayer({
              id: 'dense-1m-contour-labels-major',
              type: 'symbol',
              source: 'dense-1m-contours',
              filter: isMajor,
              layout: {
                'symbol-placement': 'line',
                'symbol-spacing': 160,
                'text-field': ['concat', ['to-string', ['get', 'ele']], ' m'],
                'text-size': [
                  'interpolate', ['linear'], ['zoom'],
                  12, 11,
                  16, 14
                ],
                'text-allow-overlap': true,
                'text-ignore-placement': true,
                'text-max-angle': 45,
                'visibility': defaultVisible ? 'visible' : 'none'
              },
              paint: {
                'text-color': '#ffffff',
                'text-halo-color': '#000000',
                'text-halo-width': 3.5
              }
            });

            // ─── Nhãn số cao độ phụ cho các đường đồng mức con ───
            map.addLayer({
              id: 'dense-1m-contour-labels',
              type: 'symbol',
              source: 'dense-1m-contours',
              layout: {
                'symbol-placement': 'line',
                'symbol-spacing': 200,
                'text-field': ['concat', ['to-string', ['get', 'ele']], ' m'],
                'text-size': [
                  'interpolate', ['linear'], ['zoom'],
                  12, 9,
                  16, 11
                ],
                'text-allow-overlap': false,
                'text-ignore-placement': false,
                'text-max-angle': 35,
                'visibility': defaultVisible ? 'visible' : 'none'
              },
              paint: {
                'text-color': dynamicRamp,
                'text-halo-color': 'rgba(0, 0, 0, 0.92)',
                'text-halo-width': 2.5
              }
            });
          }

          updateLegendWidget(displayMin, displayMax, interval);
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
        contourTimer = setTimeout(updateDense1mContours, 300);
      };

      map.on('moveend', debouncedUpdate);
      map.on('idle', debouncedUpdate);
      setTimeout(updateDense1mContours, 600);
      setTimeout(updateDense1mContours, 1500);

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
              openAdminFarmA4ExportModal(m);
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

async function openAdminFarmA4ExportModal(map) {

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

  // 1. Lấy nông trại chính xác từ DB
  let selectedFarm = null;
  if (typeof activeFarmId !== 'undefined' && activeFarmId && Array.isArray(currentFarms)) {
    selectedFarm = currentFarms.find(f => f.id === activeFarmId || f.id == activeFarmId);
  }
  if (!selectedFarm && Array.isArray(currentFarms) && currentFarms.length > 0) {
    selectedFarm = currentFarms.find(f => f.polygon_coordinates) || currentFarms[0];
  }

  let farmName = selectedFarm ? (selectedFarm.name || 'Nông Trại Quản Lý') : 'Nông Trại Quản Lý';
  let ownerName = selectedFarm ? (selectedFarm.user_name || selectedFarm.owner_name || 'Khách Hàng Nông Hộ') : 'Khách Hàng Nông Hộ';
  let performerName = 'Kỹ sư Admin Tanbao';
  let farmCoords = [];
  let areaSqM = selectedFarm && selectedFarm.area ? Math.round(parseFloat(selectedFarm.area)) : 0;
  let plantCount = selectedFarm && selectedFarm.plant_count ? parseInt(selectedFarm.plant_count) : 0;

  if (selectedFarm && selectedFarm.polygon_coordinates) {
    farmCoords = sanitizeCoordinates(selectedFarm.polygon_coordinates);
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

  // 2. Thuật toán lật trang trại lại THẲNG ĐỨNG (Upright Major Axis Orientation)
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

  let uprightBearing = oldBearing;
  if (farmCoords && farmCoords.length >= 3) {
    const bounds = new mapboxgl.LngLatBounds();
    farmCoords.forEach(c => bounds.extend(c));

    try {
      map.fitBounds(bounds, {
        padding: { top: 40, bottom: 40, left: 40, right: 40 },
        bearing: oldBearing,
        pitch: 0,
        animate: false
      });
    } catch (_) {}
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

  let lastVertexLabel = 'H';
  let uniquePts = [];
  if (farmCoords && farmCoords.length >= 3) {
    uniquePts = [...farmCoords];
    if (uniquePts.length > 3 &&
        uniquePts[0][0] === uniquePts[uniquePts.length - 1][0] &&
        uniquePts[0][1] === uniquePts[uniquePts.length - 1][1]) {
      uniquePts.pop();
    }
  }

  // 1. Chuẩn bị GeoJSON Vertex Points (Mốc A, B, C, D...) & Edge Labels (AB: 42.5m, BC: 10.1m...)
  const vertexFeatures = uniquePts.map((pt, idx) => {
    const vLabel = getVertexLabel(idx);
    lastVertexLabel = vLabel;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: pt },
      properties: { label: vLabel }
    };
  });

  const edgeFeatures = [];
  const nPts = uniquePts.length;
  for (let i = 0; i < nPts; i++) {
    const p1 = uniquePts[i];
    const p2 = uniquePts[(i + 1) % nPts];
    const len = getDist(p1, p2);
    const midLng = (p1[0] + p2[0]) / 2;
    const midLat = (p1[1] + p2[1]) / 2;
    const v1 = getVertexLabel(i);
    const v2 = getVertexLabel((i + 1) % nPts);
    edgeFeatures.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [midLng, midLat] },
      properties: { label: `${v1}${v2}: ${len} m` }
    });
  }

  const tempVertSrcId = 'a4-export-vertices-src';
  const tempCircleLayerId = 'a4-export-vertices-circle';
  const tempTextLayerId = 'a4-export-vertices-text';
  const tempEdgeSrcId = 'a4-export-edges-src';
  const tempEdgeLayerId = 'a4-export-edges-text';

  try {
    if (map.getSource(tempVertSrcId)) {
      map.getSource(tempVertSrcId).setData({ type: 'FeatureCollection', features: vertexFeatures });
    } else {
      map.addSource(tempVertSrcId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: vertexFeatures }
      });
      map.addLayer({
        id: tempCircleLayerId,
        type: 'circle',
        source: tempVertSrcId,
        paint: {
          'circle-color': '#ef4444',
          'circle-radius': 6.5,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff'
        }
      });
      map.addLayer({
        id: tempTextLayerId,
        type: 'symbol',
        source: tempVertSrcId,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 8.5,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': '#ffffff'
        }
      });
    }

    if (map.getSource(tempEdgeSrcId)) {
      map.getSource(tempEdgeSrcId).setData({ type: 'FeatureCollection', features: edgeFeatures });
    } else {
      map.addSource(tempEdgeSrcId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: edgeFeatures }
      });
      map.addLayer({
        id: tempEdgeLayerId,
        type: 'symbol',
        source: tempEdgeSrcId,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 8.5,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-offset': [0, -1.2],
          'text-padding': 3
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#0f172a',
          'text-halo-width': 2.5
        }
      });
    }
  } catch(e) {
    console.warn('Lỗi vẽ layer tạm thời A4:', e);
  }

  // 1. Chụp ảnh Bản đồ tổng thể (Full Farm Map - Chuẩn Hình 2)
  map.triggerRepaint();
  await new Promise(resolve => setTimeout(resolve, 350));

  let mapImageDataUrl = '';
  try {
    mapImageDataUrl = map.getCanvas().toDataURL('image/png');
  } catch (err) {
    console.warn('Cảnh báo chụp ảnh bản đồ:', err);
  }

  // 2. Chụp ảnh Chi tiết phóng đại cận cảnh (Close-Up Detail View - Chuẩn Hình 3 cho Vòng mặt cắt A-A)
  let cutoutImageDataUrl = mapImageDataUrl;
  if (uniquePts && uniquePts.length > 0) {
    try {
      const sectionCenter = uniquePts[0];
      map.jumpTo({
        center: sectionCenter,
        zoom: Math.max(oldZoom + 2.5, 17.5),
        bearing: uprightBearing,
        pitch: 0
      });
      map.triggerRepaint();
      await new Promise(resolve => setTimeout(resolve, 300));
      cutoutImageDataUrl = map.getCanvas().toDataURL('image/png');
    } catch (_) {}
  }

  // Dọn dẹp các layer WebGL tạm thời sau khi đã chụp ảnh xong
  try {
    if (map.getLayer(tempTextLayerId)) map.removeLayer(tempTextLayerId);
    if (map.getLayer(tempCircleLayerId)) map.removeLayer(tempCircleLayerId);
    if (map.getSource(tempVertSrcId)) map.removeSource(tempVertSrcId);
    if (map.getLayer(tempEdgeLayerId)) map.removeLayer(tempEdgeLayerId);
    if (map.getSource(tempEdgeSrcId)) map.removeSource(tempEdgeSrcId);
  } catch(_) {}

  try {
    map.jumpTo({
      center: oldCenter,
      zoom: oldZoom,
      bearing: oldBearing,
      pitch: oldPitch
    });
  } catch (_) {}

  // 3. Tính chiều dài các cạnh ranh giới & thông số
  let edgeRowsHtml = '';
  let perimeter = 0;

  if (farmCoords && farmCoords.length >= 3) {
    let uniquePts = [...farmCoords];
    if (uniquePts.length > 3 &&
        uniquePts[0][0] === uniquePts[uniquePts.length - 1][0] &&
        uniquePts[0][1] === uniquePts[uniquePts.length - 1][1]) {
      uniquePts.pop();
    }

    const n = uniquePts.length;
    for (let i = 0; i < n; i++) {
      const p1 = uniquePts[i];
      const p2 = uniquePts[(i + 1) % n];
      const len = getDist(p1, p2);
      perimeter += len;

      const vStart = getVertexLabel(i);
      const vEnd = getVertexLabel((i + 1) % n);
      const segName = `${vStart}${vEnd}`;

      edgeRowsHtml += `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:2px 3px;">
            <input type="text" class="a4-edit-field" value="Đoạn ${segName}" style="font-size:9px; font-weight:700; color:#0f172a; width:98%;">
          </td>
          <td style="padding:2px 3px; text-align:right;">
            <input type="text" class="a4-edit-field" value="${len.toLocaleString('vi-VN')} m" style="font-size:9px; font-weight:800; color:#15803d; width:98%; text-align:right;">
          </td>
        </tr>
      `;
    }

    if (!areaSqM) {
      const rad = Math.PI / 180;
      const R = 6371000;
      let accArea = 0;
      for (let i = 0; i < uniquePts.length; i++) {
        const p1 = uniquePts[i];
        const p2 = uniquePts[(i + 1) % uniquePts.length];
        accArea += (p2[0] - p1[0]) * rad * (2 + Math.sin(p1[1] * rad) + Math.sin(p2[1] * rad));
      }
      areaSqM = Math.round(Math.abs(accArea * R * R / 2));
    }
  } else {
    edgeRowsHtml = `<tr><td colspan="2" style="padding:6px; text-align:center; color:#94a3b8; font-style:italic;">Chưa chọn ranh giới trang trại</td></tr>`;
  }

  const exportDate = new Date().toLocaleDateString('vi-VN');
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

  const esc = (s) => s ? String(s).replace(/"/g, '&quot;') : '';

  modalContainer.innerHTML = `
    <style>
      .a4-edit-field {
        border: 1px dashed #cbd5e1 !important;
        background: #f8fafc !important;
        padding: 1px 4px !important;
        border-radius: 4px !important;
        font-family: inherit !important;
        color: inherit !important;
        box-sizing: border-box !important;
        transition: all 0.2s ease !important;
      }
      .a4-edit-field:hover {
        border-color: #3b82f6 !important;
        background: #ffffff !important;
      }
      .a4-edit-field:focus {
        border-color: #2563eb !important;
        background: #ffffff !important;
        outline: none !important;
        box-shadow: 0 0 0 2px rgba(37,99,235,0.25) !important;
      }
      .a4-print-mode .a4-edit-field {
        border: none !important;
        background: transparent !important;
        padding: 0 !important;
        box-shadow: none !important;
        appearance: none !important;
        -webkit-appearance: none !important;
      }
      @media print {
        @page { size: A4 landscape; margin: 0; }
        body { margin: 0; }
        #farm-a4-export-modal { position: static; background: none; padding: 0; overflow: visible; }
        #a4-drawing-paper { box-shadow: none !important; }
      }
    </style>

    <!-- Modal Toolbar Bar -->
    <div style="
      width: 100%; max-width: 1120px;
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 14px; color: #fff; background: rgba(30, 41, 59, 0.95);
      padding: 10px 18px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    ">
      <div style="display:flex; align-items:center; gap:10px;">
        <i class="fa-solid fa-drafting-compass" style="font-size:22px; color:#4ade80;"></i>
        <div>
          <h3 style="font-size:15px; font-weight:800; margin:0; color:#4ade80;">HỒ SƠ BẢN VẼ KỸ THUẬT A4 CHUẨN TỶ LỆ</h3>
          <p style="font-size:11.5px; color:#94a3b8; margin:0;">Nhấp chuột trực tiếp vào bất kỳ ô chữ/số nào trên bản vẽ để tùy chỉnh linh hoạt trước khi in</p>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <button id="btn-add-a4-point" style="
          background: #ea580c; color: #fff; border: none; padding: 7px 14px;
          border-radius: 6px; font-weight: 700; font-size: 12.5px; cursor: pointer;
          display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(234,88,12,0.4);
        " title="Chấm điểm & Gõ chữ trực tiếp lên bản vẽ (Thêm nhiều điểm tùy ý)">
          <i class="fa-solid fa-location-dot"></i> + Chấm điểm / Gõ Text
        </button>
        <button id="btn-do-print-a4" style="
          background: #3b82f6; color: #fff; border: none; padding: 7px 15px;
          border-radius: 6px; font-weight: 700; font-size: 12.5px; cursor: pointer;
          display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(59,130,246,0.4);
        ">
          <i class="fa-solid fa-print"></i> In bản vẽ (Print)
        </button>
        <button id="btn-download-pdf-a4" style="
          background: #16a34a; color: #fff; border: none; padding: 7px 16px;
          border-radius: 6px; font-weight: 700; font-size: 12.5px; cursor: pointer;
          display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(22,163,74,0.4);
        ">
          <i class="fa-solid fa-file-pdf"></i> Tải PDF (A4 Nằm Ngang)
        </button>
        <button id="btn-close-a4-modal" style="
          background: rgba(255,255,255,0.15); color: #fff; border: none; padding: 7px 12px;
          border-radius: 6px; font-weight: 700; font-size: 12.5px; cursor: pointer;
        ">
          ✕ Đóng
        </button>
      </div>
    </div>

    <!-- A4 Paper Container -->
    <div id="a4-drawing-paper" style="
      width: 297mm; min-height: 210mm;
      background: #ffffff; color: #0f172a;
      box-shadow: 0 10px 40px rgba(0,0,0,0.6);
      border-radius: 4px; padding: 7mm; box-sizing: border-box;
      display: flex; flex-direction: column; justify-content: space-between;
      border: 2px solid #000; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    ">
      <!-- 1. Header Bar -->
      <div style="border-bottom:2px solid #000; padding-bottom:5px; margin-bottom:5px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="display:flex; align-items:center; gap:12px; flex:1;">
            <img src="https://tanbaoagtech.com/wp-content/uploads/2021/04/logo-tanbao.png" style="height:38px;" onerror="this.onerror=null; this.src='/assets/logo.png';">
            <div style="flex:1;">
              <input type="text" id="a4-input-company-name" class="a4-edit-field" value="CÔNG TY TNHH CÔNG NGHỆ NÔNG NGHIỆP TÂN BẢO SÀI GÒN" style="font-size:15px; font-weight:900; color:#064e3b; width:100%; text-transform:uppercase; letter-spacing:0.3px;">
              <input type="text" id="a4-input-doc-subtitle" class="a4-edit-field" value="HỒ SƠ BẢN VẼ KỸ THUẬT ĐỊA HÌNH, RANH GIỚI & KÍCH THƯỚC CHI TIẾT" style="font-size:10.5px; font-weight:800; color:#334155; width:100%; margin-top:2px;">
            </div>
          </div>
          <div style="text-align:right;">
            <input type="text" id="a4-input-doc-type" class="a4-edit-field" value="BẢN VẼ A4 CHUẨN TỶ LỆ" style="font-size:12.5px; font-weight:900; color:#0f172a; text-transform:uppercase; text-align:right; width:190px;">
            <div style="font-size:10.5px; color:#475569; margin-top:2px; display:flex; align-items:center; justify-content:flex-end; gap:4px;">
              <span>Mã Hồ Sơ:</span>
              <input type="text" id="a4-input-doc-code" class="a4-edit-field" value="TBSGAgTech - KH2601002" style="font-size:10.5px; font-weight:800; color:#0f172a; width:180px; text-align:right;">
            </div>
          </div>
        </div>

        <!-- Sub-Header Row: Farm name & Owner name -->
        <div style="display:flex; justify-content:flex-start; gap:50px; font-size:11.5px; font-weight:700; margin-top:5px; padding:3px 8px; background:#f8fafc; border-radius:4px; border:1px solid #e2e8f0;">
          <div style="display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-house-chimney" style="color:#15803d;"></i> Tên trang trại: 
            <input type="text" id="a4-input-farm-name" class="a4-edit-field" value="${esc(farmName)}" style="font-size:11.5px; font-weight:800; color:#15803d; width:220px;">
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-user-tie" style="color:#2563eb;"></i> Khách hàng: 
            <input type="text" id="a4-input-owner-name" class="a4-edit-field" value="${esc(ownerName)}" style="font-size:11.5px; font-weight:800; color:#15803d; width:220px;">
          </div>
        </div>
      </div>

      <!-- 2. Main Center Body (Map + Right Panel) -->
      <div style="display:flex; gap:8px; flex:1; overflow:hidden; margin-bottom:5px;">
        <!-- Main Map Area (Left) -->
        <div style="flex:1; display:flex; flex-direction:column; gap:5px; overflow:hidden;">
          <div id="a4-map-frame" style="flex:1; border:1.5px solid #000; position:relative; overflow:hidden; border-radius:4px; background:#e2e8f0;">
            <!-- Viewport Bản Đồ Chính (Hỗ trợ Kéo Dịch & Zoom In / Zoom Out) -->
            <div id="a4-main-map-viewport" style="width:100%; height:100%; position:relative; overflow:hidden; cursor:grab;" title="Nhấp giữ rê chuột để di chuyển bản đồ chính, Lăn chuột hoặc dùng nút + / - để Thu Phóng (Zoom In / Zoom Out)">
              <img id="a4-main-map-img" src="${mapImageDataUrl}" style="position:absolute; left:50%; top:50%; width:100%; height:100%; object-fit:cover; transform:translate(-50%, -50%) scale(1.0); transition:transform 0.05s ease-out; pointer-events:none;">
            </div>
            
            <!-- Layer chứa các Điểm Chấm Ghi Chú Tương Tác -->
            <div id="a4-custom-points-layer" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:20;"></div>

            <!-- Nút Điều Khiển Zoom Bản Đồ Chính Top-Right (+ / - / ↺) -->
            <div style="position:absolute; top:8px; right:8px; display:flex; flex-direction:column; gap:4px; z-index:25;">
              <button id="btn-a4-main-zoom-in" style="background:#ffffff; color:#0f172a; border:1.5px solid #000000; border-radius:4px; width:26px; height:26px; font-size:14px; font-weight:900; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.3); cursor:pointer;" title="Phóng to Bản đồ chính (Zoom In)">+</button>
              <button id="btn-a4-main-zoom-out" style="background:#ffffff; color:#0f172a; border:1.5px solid #000000; border-radius:4px; width:26px; height:26px; font-size:14px; font-weight:900; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.3); cursor:pointer;" title="Thu nhỏ Bản đồ chính (Zoom Out)">-</button>
              <button id="btn-a4-main-zoom-reset" style="background:#ffffff; color:#0f172a; border:1.5px solid #000000; border-radius:4px; width:26px; height:26px; font-size:11px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.3); cursor:pointer;" title="Đặt lại vị trí ban đầu"><i class="fa-solid fa-rotate-left"></i></button>
            </div>

            <!-- Elevation Vertical Color Bar Widget (Bottom-Right inside map) -->
            <div style="position:absolute; bottom:8px; right:8px; background:#ffffff; color:#0f172a; padding:5px 8px; border-radius:5px; border:1.5px solid #000000; font-size:9.5px; display:flex; flex-direction:column; align-items:center; gap:3px; z-index:22; box-shadow:0 2px 8px rgba(0,0,0,0.35);">
              <div style="font-size:8.5px; font-weight:800; color:#0f172a;">CAO ĐỘ (1M)</div>
              <div style="display:flex; align-items:center; gap:6px;">
                <div style="width:8px; height:65px; border-radius:2px; background:linear-gradient(to top, #000080, #0066ff, #00ff99, #ffff00, #ff6600, #800000); border:1px solid #000;"></div>
                <div style="display:flex; flex-direction:column; justify-content:space-between; height:65px; font-weight:800; font-size:9px;">
                  <input type="text" class="a4-edit-field" value="${maxEle} m" style="font-size:8.5px; font-weight:900; color:#000000; width:52px; text-align:right;">
                  <input type="text" class="a4-edit-field" value="${Math.round((maxEle+minEle)/2)} m" style="font-size:8.5px; font-weight:900; color:#000000; width:52px; text-align:right;">
                  <input type="text" class="a4-edit-field" value="${minEle} m" style="font-size:8.5px; font-weight:900; color:#000000; width:52px; text-align:right;">
                </div>
              </div>
            </div>

            <!-- Inset Zoom Magnifier Circle "A-A" (Cho phép Kéo di chuyển hình ảnh BÊN TRONG & Kéo Nắp đỏ để dời Vị trí khung) -->
            <div id="a4-cutout-circle" style="position:absolute; bottom:10px; left:10px; width:120px; height:120px; border-radius:50%; border:3px solid #ef4444; box-shadow:0 6px 20px rgba(0,0,0,0.5); background:#e2e8f0; user-select:none; z-index:15;" title="Kéo chuột bên trong vòng để dịch chuyển ảnh mặt cắt; Kéo nút đỏ trên đỉnh để dời vị trí khung">
              <!-- Nút Nắp Kéo Khung (Handle màu đỏ trên đỉnh) -->
              <div id="a4-cutout-frame-handle" style="position:absolute; top:-12px; left:50%; transform:translateX(-50%); background:#ef4444; color:#ffffff; font-size:8.5px; font-weight:800; padding:1px 7px; border-radius:10px; cursor:grab; z-index:25; box-shadow:0 2px 6px rgba(0,0,0,0.4); white-space:nowrap;" title="Nhấp giữ để kéo di chuyển Vị Trí Khung Vòng Tròn trên tờ giấy A4">
                <i class="fa-solid fa-up-down-left-right"></i> Vị trí khung
              </div>

              <!-- Thấu kính chứa ảnh mặt cắt (Cho phép Kéo xoay dịch chuyển ảnh bên trong) -->
              <div id="a4-cutout-viewport" style="width:100%; height:100%; border-radius:50%; overflow:hidden; position:relative; cursor:move;" title="Nhấp giữ rê chuột để dịch chuyển hình ảnh mặt cắt bên trong vòng tròn">
                <img id="a4-cutout-img" src="${cutoutImageDataUrl}" style="position:absolute; left:50%; top:50%; width:180%; height:180%; object-fit:cover; transform:translate(-50%, -50%) scale(1.0); pointer-events:none;">
                <input type="text" id="a4-cutout-title-input" class="a4-edit-field" value="A-A" style="position:absolute; top:6px; left:50%; transform:translateX(-50%); background:rgba(255,255,255,0.92); color:#000; font-size:10px; font-weight:900; padding:1px 6px; border-radius:10px; border:1.5px solid #ef4444; width:44px; text-align:center; cursor:pointer; z-index:20;" title="Nhấp để đổi tên mặt cắt (VD: A-A, B-B, C-C)">
              </div>
            </div>
          </div>

          <!-- Bottom Symbology Legend Bar (Directly below map) -->
          <div style="display:flex; justify-content:space-around; align-items:center; padding:4px 8px; background:#fff; border:1.5px solid #000; border-radius:4px; font-size:9.5px; font-weight:700; color:#1e293b;">
            <span style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:11px; height:11px; border-radius:50%; background:#ef4444; border:1px solid #fff;"></span> <strong style="color:#ef4444;">A-${lastVertexLabel}</strong> Mốc ranh giới</span>
            <span style="display:flex; align-items:center; gap:4px;"><i class="fa-solid fa-arrows-left-right" style="color:#0284c7;"></i> Chiều dài cạnh</span>
            <span style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:11px; height:11px; border-radius:50%; background:#ef4444; color:#fff; text-align:center; font-size:7.5px; font-weight:900; line-height:11px;">1</span> Vị trí khu vực</span>
            <span style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:11px; height:9px; background:rgba(16,185,129,0.35); border:1px solid #10b981;"></span> Diện tích trang trại</span>
          </div>
        </div>

        <!-- Right Sidebar Panel (Width 250px) -->
        <div style="width:250px; flex:none; display:flex; flex-direction:column; gap:5px;">
          <!-- Section 1: Thống Kê Trang Trại -->
          <div style="border:1.5px solid #000; border-radius:4px; padding:5px 7px; background:#fff;">
            <div style="font-weight:800; font-size:10px; color:#15803d; border-bottom:1px solid #cbd5e1; padding-bottom:2px; margin-bottom:4px; text-transform:uppercase; display:flex; align-items:center; gap:4px;">
              <i class="fa-solid fa-leaf"></i> THỐNG KÊ TRANG TRẠI
            </div>
            <table style="width:100%; font-size:9.5px; border-collapse:collapse;">
              <tr>
                <td style="padding:2px 0; color:#475569; width:45%;">Diện tích trang trại:</td>
                <td style="padding:2px 0; text-align:right;">
                  <input type="text" class="a4-edit-field" value="${areaSqM.toLocaleString('vi-VN')} m² (${(areaSqM/10000).toFixed(2)} ha)" style="font-size:9.5px; font-weight:900; color:#15803d; width:100%; text-align:right;">
                </td>
              </tr>
              <tr>
                <td style="padding:2px 0; color:#475569; width:45%;">Chu vi ranh giới:</td>
                <td style="padding:2px 0; text-align:right;">
                  <input type="text" class="a4-edit-field" value="${perimeter.toLocaleString('vi-VN')} m" style="font-size:9.5px; font-weight:900; color:#0f172a; width:100%; text-align:right;">
                </td>
              </tr>
            </table>
          </div>

          <!-- Section 2: Chênh Lệch Cao Độ & Sai Số -->
          <div style="border:1.5px solid #000; border-radius:4px; padding:5px 7px; background:#fff;">
            <table style="width:100%; font-size:9.5px; border-collapse:collapse;">
              <tr>
                <td style="padding:2px 0; color:#475569; width:45%;">Chênh lệch cao độ:</td>
                <td style="padding:2px 0; text-align:right;">
                  <input type="text" class="a4-edit-field" value="${minEle} m — ${maxEle} m (Δ ${maxEle - minEle} m)" style="font-size:9px; font-weight:800; color:#ea580c; width:100%; text-align:right;">
                </td>
              </tr>
              <tr>
                <td style="padding:2px 0; color:#dc2626; font-weight:700; width:45%;"><i class="fa-solid fa-triangle-exclamation"></i> Kích thước sai số:</td>
                <td style="padding:2px 0; text-align:right;">
                  <input type="text" class="a4-edit-field" value="± 3 %" style="font-size:9.5px; font-weight:900; color:#dc2626; width:100%; text-align:right;">
                </td>
              </tr>
            </table>
          </div>

          <!-- Section 3: Chú Giải Cao Độ (Tìm/Bậc) -->
          <div style="border:1.5px solid #000; border-radius:4px; padding:4px 6px; background:#fff;">
            <div style="font-weight:800; font-size:9px; color:#0f172a; border-bottom:1px solid #cbd5e1; padding-bottom:2px; margin-bottom:3px; text-transform:uppercase; display:flex; align-items:center; gap:4px;">
              <i class="fa-solid fa-layer-group" style="color:#2563eb;"></i> CHÚ GIẢI CAO ĐỘ (TÌM/BẬC)
            </div>
            <div style="height:9px; width:100%; border-radius:2px; background: linear-gradient(to right, #000080, #0066ff, #00ff99, #ffff00, #ff6600, #800000); border:1px solid #94a3b8; margin-bottom:2px;"></div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:8.5px; font-weight:700; gap:1px;">
              <input type="text" class="a4-edit-field" value="${minEle}m" style="font-size:8.5px; font-weight:900; color:#000000; width:40px; text-align:center;">
              <input type="text" class="a4-edit-field" value="${Math.round(minEle + (maxEle - minEle)*0.25)}m" style="font-size:8.5px; font-weight:900; color:#000000; width:40px; text-align:center;">
              <input type="text" class="a4-edit-field" value="${Math.round(minEle + (maxEle - minEle)*0.5)}m" style="font-size:8.5px; font-weight:900; color:#000000; width:40px; text-align:center;">
              <input type="text" class="a4-edit-field" value="${Math.round(minEle + (maxEle - minEle)*0.75)}m" style="font-size:8.5px; font-weight:900; color:#000000; width:40px; text-align:center;">
              <input type="text" class="a4-edit-field" value="${maxEle}m" style="font-size:8.5px; font-weight:900; color:#000000; width:40px; text-align:center;">
            </div>
          </div>

          <!-- Section 4: Chiều Dài Các Cạnh Ranh Giới Table -->
          <div style="flex:1; border:1.5px solid #000; border-radius:4px; padding:5px 7px; background:#fff; overflow-y:auto;">
            <div style="font-weight:800; font-size:9.5px; color:#1e293b; border-bottom:1px solid #cbd5e1; padding-bottom:2px; margin-bottom:3px; text-transform:uppercase; display:flex; align-items:center; gap:4px;">
              <i class="fa-solid fa-ruler-combined"></i> CHIỀU DÀI CÁC CẠNH RANH GIỚI
            </div>
            <table style="width:100%; font-size:9px; border-collapse:collapse;">
              <thead>
                <tr style="background:#f1f5f9; text-align:left; border-bottom:1px solid #cbd5e1;">
                  <th style="padding:2.5px 3px; width:45%;">ĐOẠN CẠNH</th>
                  <th style="padding:2.5px 3px; text-align:right; width:55%;">CHIỀU DÀI (m)</th>
                </tr>
              </thead>
              <tbody>
                ${edgeRowsHtml}
              </tbody>
            </table>
          </div>

          <!-- Section 5: Legend for sensors & custom points -->
          <div style="border:1.5px solid #000; border-radius:4px; padding:4px 6px; background:#fff; font-size:9px;">
            <div style="font-weight:800; font-size:8.5px; color:#475569; border-bottom:1px solid #cbd5e1; padding-bottom:2px; margin-bottom:3px; text-transform:uppercase; display:flex; align-items:center; justify-content:space-between;">
              <span><i class="fa-solid fa-list-check" style="color:#ea580c;"></i> CHÚ GIẢI VỊ TRÍ & CHẤM ĐIỂM</span>
              <small style="color:#94a3b8; font-weight:600; text-transform:none;">(Đồng bộ)</small>
            </div>
            <table style="width:100%; border-collapse:collapse;" id="a4-legend-custom-table-body">
            </table>
          </div>
        </div>
      </div>

      <!-- 3. Bottom Title Block (Khung Tên Hồ Sơ) -->
      <div style="border:1.5px solid #000; background:#fff;">
        <table style="width:100%; border-collapse:collapse; font-size:10px;">
          <tr>
            <td style="width:40%; border-right:1.5px solid #000; padding:6px 10px; vertical-align:middle;">
              <div style="font-size:8.5px; color:#64748b; font-weight:700; text-transform:uppercase; display:flex; align-items:center; gap:5px;">
                <i class="fa-solid fa-user-check" style="color:#15803d;"></i> NGƯỜI THỰC HIỆN
              </div>
              <input type="text" id="a4-input-performer-name" class="a4-edit-field" value="Phạm Hoàng Phúc" style="font-size:11.5px; font-weight:900; color:#0f172a; width:95%; margin-top:2px;">
            </td>
            <td style="width:35%; border-right:1.5px solid #000; padding:6px 10px; vertical-align:middle;">
              <div style="font-size:8.5px; color:#64748b; font-weight:700; text-transform:uppercase; display:flex; align-items:center; gap:5px;">
                <i class="fa-solid fa-calendar-days" style="color:#2563eb;"></i> NGÀY XUẤT
              </div>
              <input type="text" id="a4-input-export-date" class="a4-edit-field" value="${exportDate}" style="font-size:11.5px; font-weight:900; color:#0f172a; width:95%; margin-top:2px;">
            </td>
            <td style="width:25%; padding:6px 10px; vertical-align:middle;">
              <div style="font-size:8.5px; color:#64748b; font-weight:700; text-transform:uppercase; display:flex; align-items:center; gap:5px;">
                <i class="fa-solid fa-ruler-horizontal" style="color:#d97706;"></i> TỶ LỆ
              </div>
              <input type="text" id="a4-input-scale-val" class="a4-edit-field" value="1 : 1" style="font-size:11.5px; font-weight:900; color:#0f172a; width:95%; margin-top:2px;">
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;

  document.body.appendChild(modalContainer);

  // ─── THIẾT LẬP CÁC TÍNH NĂNG TƯƠNG TÁC BẢN VẼ: DI CHUYỂN MẶT CẮT & CHẤM ĐIỂM + GÕ TEXT ───
  const initA4InteractiveTools = () => {
    const mapFrameEl = document.getElementById('a4-map-frame');
    const cutoutEl = document.getElementById('a4-cutout-circle');
    const btnAddPoint = document.getElementById('btn-add-a4-point');
    const pointsLayerEl = document.getElementById('a4-custom-points-layer');
    const legendTable = document.getElementById('a4-legend-custom-table-body');

    if (!mapFrameEl) return;

    // ── GIAO DIỆN BẢN ĐỒ CHÍNH (MAIN A4 MAP): TỰ DO THU PHÓNG (ZOOM IN/OUT) & KÉO RÊ DI CHUYỂN ──
    const mainMapViewport = document.getElementById('a4-main-map-viewport');
    const mainMapImg = document.getElementById('a4-main-map-img');
    const btnMainZoomIn = document.getElementById('btn-a4-main-zoom-in');
    const btnMainZoomOut = document.getElementById('btn-a4-main-zoom-out');
    const btnMainZoomReset = document.getElementById('btn-a4-main-zoom-reset');

    let mainPanX = 0;
    let mainPanY = 0;
    let mainScale = 1.0;

    const renderMainMapTransform = () => {
      if (mainMapImg) {
        mainMapImg.style.transform = `translate(calc(-50% + ${mainPanX}px), calc(-50% + ${mainPanY}px)) scale(${mainScale.toFixed(2)})`;
      }
    };

    if (btnMainZoomIn) {
      btnMainZoomIn.onclick = (e) => {
        e.stopPropagation();
        mainScale = Math.min(mainScale + 0.2, 5.0);
        renderMainMapTransform();
      };
    }

    if (btnMainZoomOut) {
      btnMainZoomOut.onclick = (e) => {
        e.stopPropagation();
        mainScale = Math.max(mainScale - 0.2, 0.5);
        renderMainMapTransform();
      };
    }

    if (btnMainZoomReset) {
      btnMainZoomReset.onclick = (e) => {
        e.stopPropagation();
        mainScale = 1.0;
        mainPanX = 0;
        mainPanY = 0;
        renderMainMapTransform();
      };
    }

    if (mainMapViewport) {
      let isPanningMain = false;
      let startMouseX = 0, startMouseY = 0;
      let initialPanX = 0, initialPanY = 0;

      const onMainStart = (evt) => {
        if (evt.target.closest('#a4-cutout-circle') || evt.target.tagName === 'INPUT' || evt.target.tagName === 'BUTTON') return;

        isPanningMain = true;
        mainMapViewport.style.cursor = 'grabbing';

        startMouseX = evt.touches ? evt.touches[0].clientX : evt.clientX;
        startMouseY = evt.touches ? evt.touches[0].clientY : evt.clientY;

        initialPanX = mainPanX;
        initialPanY = mainPanY;

        if (evt.type === 'touchstart') evt.preventDefault();
      };

      const onMainMove = (evt) => {
        if (!isPanningMain) return;

        const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
        const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;

        const deltaX = clientX - startMouseX;
        const deltaY = clientY - startMouseY;

        mainPanX = initialPanX + deltaX;
        mainPanY = initialPanY + deltaY;

        renderMainMapTransform();
      };

      const onMainEnd = () => {
        if (isPanningMain) {
          isPanningMain = false;
          mainMapViewport.style.cursor = 'grab';
        }
      };

      mainMapViewport.addEventListener('mousedown', onMainStart);
      document.addEventListener('mousemove', onMainMove);
      document.addEventListener('mouseup', onMainEnd);

      mainMapViewport.addEventListener('touchstart', onMainStart, { passive: false });
      document.addEventListener('touchmove', onMainMove, { passive: false });
      document.addEventListener('touchend', onMainEnd);

      // Phóng to / Thu nhỏ bản đồ chính bằng Con trỏ chuột (Mouse Wheel)
      mainMapViewport.addEventListener('wheel', (evt) => {
        if (evt.target.closest('#a4-cutout-circle')) return;
        evt.preventDefault();
        evt.stopPropagation();
        if (evt.deltaY < 0) {
          mainScale = Math.min(mainScale + 0.15, 5.0);
        } else {
          mainScale = Math.max(mainScale - 0.15, 0.5);
        }
        renderMainMapTransform();
      }, { passive: false });
    }

    // Kính phóng đại quang học hiển thị chính xác vị trí bên dưới vòng tròn mặt cắt A-A
    const updateCutoutMagnifier = (left, top) => {
      if (!cutoutEl) return;
      const cutoutImg = cutoutEl.querySelector('img');
      if (!cutoutImg) return;
      
      const containerW = mapFrameEl.clientWidth || 1;
      const containerH = mapFrameEl.clientHeight || 1;
      const cutoutW = cutoutEl.clientWidth || 110;
      const cutoutH = cutoutEl.clientHeight || 110;

      const centerX = left + cutoutW / 2;
      const centerY = top + cutoutH / 2;

      const pctX = (centerX / containerW) * 100;
      const pctY = (centerY / containerH) * 100;

      cutoutImg.style.objectPosition = `${pctX}% ${pctY}%`;
    };

    // 1. Hàm bổ trợ kéo thả di chuyển vị trí phần tử (Universal Draggable Handler)
    const makeDraggable = (el, handleEl) => {
      let isDragging = false;
      let startX = 0, startY = 0;
      let elemStartX = 0, elemStartY = 0;

      const triggerEl = handleEl || el;

      const onStart = (evt) => {
        const target = evt.target;
        if (target.tagName === 'INPUT' || target.classList.contains('pt-del-btn')) {
          return;
        }

        isDragging = true;
        triggerEl.style.cursor = 'grabbing';
        if (el) el.style.zIndex = '30';

        const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
        const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;

        startX = clientX;
        startY = clientY;

        const rect = el.getBoundingClientRect();
        const containerRect = mapFrameEl.getBoundingClientRect();

        elemStartX = rect.left - containerRect.left;
        elemStartY = rect.top - containerRect.top;

        if (evt.type === 'touchstart') evt.preventDefault();
      };

      const onMove = (evt) => {
        if (!isDragging) return;

        const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
        const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;

        const deltaX = clientX - startX;
        const deltaY = clientY - startY;

        let newLeft = elemStartX + deltaX;
        let newTop = elemStartY + deltaY;

        const containerRect = mapFrameEl.getBoundingClientRect();
        const elemRect = el.getBoundingClientRect();

        const maxLeft = containerRect.width - elemRect.width;
        const maxTop = containerRect.height - elemRect.height;

        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;
        if (newLeft > maxLeft) newLeft = maxLeft;
        if (newTop > maxTop) newTop = maxTop;

        el.style.left = newLeft + 'px';
        el.style.top = newTop + 'px';
        el.style.bottom = 'auto';
        el.style.right = 'auto';
      };

      const onEnd = () => {
        if (isDragging) {
          isDragging = false;
          triggerEl.style.cursor = 'grab';
          if (el) el.style.zIndex = el.id === 'a4-cutout-circle' ? '15' : '25';
        }
      };

      triggerEl.addEventListener('mousedown', onStart);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);

      triggerEl.addEventListener('touchstart', onStart, { passive: false });
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    };

    // ── XỬ LÝ DỊCH CHUYỂN ẢNH MẶT CẮT BÊN TRONG VÒNG TRÒN & DI CHUYỂN KHUNG ──
    const cutoutViewport = document.getElementById('a4-cutout-viewport');
    const cutoutFrameHandle = document.getElementById('a4-cutout-frame-handle');
    const cutoutImg = document.getElementById('a4-cutout-img');

    let innerPanX = 0;
    let innerPanY = 0;
    let innerScale = 1.4;

    const renderInnerTransform = () => {
      if (cutoutImg) {
        cutoutImg.style.transform = `translate(calc(-50% + ${innerPanX}px), calc(-50% + ${innerPanY}px)) scale(${innerScale.toFixed(2)})`;
      }
    };

    if (cutoutViewport) {
      let isPanningInner = false;
      let startMouseX = 0, startMouseY = 0;
      let initialPanX = 0, initialPanY = 0;

      const onViewportStart = (evt) => {
        if (evt.target.tagName === 'INPUT') return;
        isPanningInner = true;
        cutoutViewport.style.cursor = 'grabbing';

        startMouseX = evt.touches ? evt.touches[0].clientX : evt.clientX;
        startMouseY = evt.touches ? evt.touches[0].clientY : evt.clientY;

        initialPanX = innerPanX;
        initialPanY = innerPanY;

        if (evt.type === 'touchstart') evt.preventDefault();
      };

      const onViewportMove = (evt) => {
        if (!isPanningInner) return;

        const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
        const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;

        const deltaX = clientX - startMouseX;
        const deltaY = clientY - startMouseY;

        innerPanX = initialPanX + deltaX;
        innerPanY = initialPanY + deltaY;

        renderInnerTransform();
      };

      const onViewportEnd = () => {
        if (isPanningInner) {
          isPanningInner = false;
          cutoutViewport.style.cursor = 'move';
        }
      };

      cutoutViewport.addEventListener('mousedown', onViewportStart);
      document.addEventListener('mousemove', onViewportMove);
      document.addEventListener('mouseup', onViewportEnd);

      cutoutViewport.addEventListener('touchstart', onViewportStart, { passive: false });
      document.addEventListener('touchmove', onViewportMove, { passive: false });
      document.addEventListener('touchend', onViewportEnd);

      // Phóng to / Thu nhỏ hình ảnh siêu nét bên trong bằng con trỏ chuột (Mouse Wheel Zoom hỗ trợ tới 10.0x)
      cutoutViewport.addEventListener('wheel', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        if (evt.deltaY < 0) {
          innerScale = Math.min(innerScale + 0.3, 10.0);
        } else {
          innerScale = Math.max(innerScale - 0.3, 0.8);
        }
        renderInnerTransform();
      }, { passive: false });
    }

    // Kéo Nút Handle Đỏ để di chuyển vị trí Khung Vòng Tròn Mặt Cắt trên bản vẽ A4
    if (cutoutEl && cutoutFrameHandle) {
      makeDraggable(cutoutEl, cutoutFrameHandle);
    }

    // 2. Tính năng Chấm Điểm & Gõ Text (Sử dụng nhiều lần)
    let pointCount = 0;

    const addNewPoint = (initialText) => {
      pointCount++;
      const textVal = initialText || (`Vị trí ${pointCount}`);

      const ptId = 'a4-pt-node-' + pointCount;
      const ptEl = document.createElement('div');
      ptEl.id = ptId;
      ptEl.className = 'a4-custom-point-node';
      ptEl.style.cssText = `
        position: absolute;
        left: ${35 + ((pointCount * 7) % 45)}%;
        top: ${30 + ((pointCount * 7) % 45)}%;
        z-index: 25;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        background: rgba(15, 23, 42, 0.92);
        color: #ffffff;
        border: 1.5px solid #ea580c;
        border-radius: 20px;
        box-shadow: 0 4px 12px rgba(234, 88, 12, 0.4);
        cursor: grab;
        user-select: none;
        font-size: 10px;
        font-weight: 800;
        white-space: nowrap;
        pointer-events: auto;
      `;

      ptEl.innerHTML = `
        <span style="display:inline-flex; align-items:center; justify-content:center; width:15px; height:15px; border-radius:50%; background:#ea580c; color:#fff; font-size:8.5px; font-weight:900;">${pointCount}</span>
        <input type="text" class="a4-edit-field pt-label-input" value="${esc(textVal)}" style="font-size:9.5px; font-weight:800; color:#fff; background:transparent; border:none; outline:none; width:95px; text-shadow:0 1px 2px #000;">
        <span class="pt-del-btn" title="Xóa điểm này" style="cursor:pointer; color:#ef4444; font-weight:900; font-size:11px; margin-left:2px; padding:0 2px;">✕</span>
      `;

      if (pointsLayerEl) pointsLayerEl.appendChild(ptEl);

      makeDraggable(ptEl);

      // Thêm dòng tương ứng vào Bảng Chú Giải ở góc dưới bên phải
      let legRow = null;
      if (legendTable) {
        legRow = document.createElement('tr');
        legRow.innerHTML = `
          <td style="padding:1.5px 0; font-weight:700; color:#0f172a; width:40%;">
            <input type="text" class="a4-edit-field leg-tag-input" value="📍 Điểm ${pointCount}" style="font-size:9px; font-weight:700; color:#ea580c; width:95%;">
          </td>
          <td style="padding:1.5px 0; text-align:right;">
            <input type="text" class="a4-edit-field leg-val-input" value="${esc(textVal)}" style="font-size:9px; font-weight:800; color:#ea580c; width:100%; text-align:right;">
          </td>
        `;
        legendTable.appendChild(legRow);

        // Đồng bộ chữ nhập giữa bản đồ và bảng chú giải
        const ptInput = ptEl.querySelector('.pt-label-input');
        const legValInput = legRow.querySelector('.leg-val-input');
        if (ptInput && legValInput) {
          ptInput.oninput = () => { legValInput.value = ptInput.value; };
          legValInput.oninput = () => { ptInput.value = legValInput.value; };
        }
      }

      // Xử lý sự kiện xóa điểm
      const delBtn = ptEl.querySelector('.pt-del-btn');
      if (delBtn) {
        delBtn.onclick = (e) => {
          e.stopPropagation();
          ptEl.remove();
          if (legRow) legRow.remove();
        };
      }
    };

    if (btnAddPoint) {
      btnAddPoint.onclick = () => {
        const userInput = prompt('Nhập nội dung/tên điểm cần chấm trên bản vẽ (VD: Vị trí Cảm biến #1, Trạm bơm, Cổng chính, Mặt cắt B-B...):', `Vị trí ${pointCount + 1}`);
        if (userInput !== null) {
          addNewPoint(userInput.trim());
        }
      };
    }
  };

  initA4InteractiveTools();

  document.getElementById('btn-close-a4-modal').onclick = () => modalContainer.remove();

  modalContainer.onclick = (e) => {
    if (e.target === modalContainer) modalContainer.remove();
  };

  const preparePrintMode = () => {
    const paper = document.getElementById('a4-drawing-paper');
    if (!paper) return;
    paper.classList.add('a4-print-mode');
    paper.querySelectorAll('.a4-edit-field').forEach(input => {
      input.setAttribute('value', input.value);
    });
  };

  const cleanupPrintMode = () => {
    const paper = document.getElementById('a4-drawing-paper');
    if (paper) paper.classList.remove('a4-print-mode');
  };

  document.getElementById('btn-do-print-a4').onclick = () => {
    preparePrintMode();
    const paperHtml = document.getElementById('a4-drawing-paper').outerHTML;
    cleanupPrintMode();

    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ban_ve_trang_trai</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
          @page { size: A4 landscape; margin: 0; }
          body { margin: 0; padding: 0; background: #fff; }
          #a4-drawing-paper { width: 297mm !important; height: 210mm !important; box-shadow: none !important; border-radius: 0 !important; }
          .a4-edit-field { border: none !important; background: transparent !important; padding: 0 !important; box-shadow: none !important; }
        </style>
      </head>
      <body>
        ${paperHtml}
        <script>
          setTimeout(() => { window.print(); window.close(); }, 600);
        <\/script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  document.getElementById('btn-download-pdf-a4').onclick = async () => {
    const btn = document.getElementById('btn-download-pdf-a4');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo PDF...';
    btn.disabled = true;

    preparePrintMode();
    const html2pdfLib = await loadHtml2Pdf();
    const element = document.getElementById('a4-drawing-paper');

    if (html2pdfLib && element) {
      const farmNameVal = (document.getElementById('a4-input-farm-name') || {}).value || farmName;
      const opt = {
        margin: 0,
        filename: `Ban_ve_trang_trai_${farmNameVal.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      html2pdfLib().set(opt).from(element).save().then(() => {
        cleanupPrintMode();
        btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Tải PDF (A4 Nằm Ngang)';
        btn.disabled = false;
      }).catch(err => {
        console.error('Lỗi xuất PDF:', err);
        cleanupPrintMode();
        btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Tải PDF (A4 Nằm Ngang)';
        btn.disabled = false;
        document.getElementById('btn-do-print-a4').click();
      });
    } else {
      cleanupPrintMode();
      btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Tải PDF (A4 Nằm Ngang)';
      btn.disabled = false;
      document.getElementById('btn-do-print-a4').click();
    }
  };
}



/* ═══════════════════════════════════════════════════════════
   PLANT HOVER TOOLTIP — Sidebar GIS
   ═══════════════════════════════════════════════════════════ */

(function() {
  let tooltipEl = null;
  let tooltipTimeout = null;

  function getTooltipEl() {
    if (!tooltipEl) tooltipEl = document.getElementById('plant-hover-tooltip');
    return tooltipEl;
  }

  function healthClass(status) {
    if (!status) return 'binh';
    const s = status.toLowerCase();
    if (s.includes('tốt') || s === 'tot') return 'tot';
    if (s.includes('bệnh') || s === 'benh') return 'benh';
    if (s.includes('chú ý') || s.includes('chu y') || s.includes('cần')) return 'chu-y';
    return 'binh';
  }

  function healthIcon(status) {
    const c = healthClass(status);
    return { 'tot': '🟢', 'binh': '🟡', 'chu-y': '🟠', 'benh': '🔴' }[c] || '⚪';
  }

  window.showPlantTooltip = function(el, plant, event) {
    const tip = getTooltipEl();
    if (!tip) return;

    clearTimeout(tooltipTimeout);

    const hc = healthClass(plant.health_status);
    const icon = healthIcon(plant.health_status);

    let gpsText = '—';
    if (plant.gps_lat && plant.gps_lng) {
      gpsText = parseFloat(plant.gps_lat).toFixed(5) + ', ' + parseFloat(plant.gps_lng).toFixed(5);
    }

    const age = plant.plant_age || plant.age || '—';

    tip.innerHTML =
      '<div class="pht-title">' +
        '<i class="fa-solid fa-seedling" style="color:#10b981;font-size:14px;"></i>' +
        'Cây ' + esc(plant.tree_code || plant.id || '—') +
      '</div>' +
      '<div class="pht-row"><span class="pht-label">Loại cây</span><span class="pht-value">' + esc(plant.plant_type || '—') + '</span></div>' +
      '<div class="pht-row"><span class="pht-label">Giống cây</span><span class="pht-value">' + esc(plant.plant_variety || '—') + '</span></div>' +
      '<div class="pht-row"><span class="pht-label">Tuổi cây</span><span class="pht-value">' + esc(age) + '</span></div>' +
      '<div class="pht-row"><span class="pht-label">Trạng thái</span>' +
        '<span class="pht-health ' + hc + '">' + icon + ' ' + esc(plant.health_status || 'Bình thường') + '</span>' +
      '</div>' +
      (gpsText !== '—' ? '<div class="pht-row"><span class="pht-label">GPS</span><span class="pht-value" style="font-size:10px;color:#64748b;">' + gpsText + '</span></div>' : '') +
      '<div style="margin-top:8px; padding-top:7px; border-top:1px solid rgba(255,255,255,0.06); font-size:10px; color:#475569; text-align:center;">Click để xem chi tiết</div>';

    positionTooltip(tip, event);

    tooltipTimeout = setTimeout(function() {
      tip.classList.add('visible');
    }, 30);
  };

  window.hidePlantTooltip = function() {
    const tip = getTooltipEl();
    if (!tip) return;
    clearTimeout(tooltipTimeout);
    tip.classList.remove('visible');
  };

  function positionTooltip(tip, event) {
    const margin = 14;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tipW = 260;
    const tipH = 200;

    let x = event.clientX + margin;
    let y = event.clientY - tipH / 2;

    if (x + tipW > vw - margin) x = event.clientX - tipW - margin;
    if (y < margin) y = margin;
    if (y + tipH > vh - margin) y = vh - tipH - margin;

    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  document.addEventListener('mousemove', function(e) {
    const tip = getTooltipEl();
    if (tip && tip.classList.contains('visible')) {
      positionTooltip(tip, e);
    }
  });
})();

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
