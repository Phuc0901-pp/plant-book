// ── Mapbox GIS & Farm Management ──────────────────────────────

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

// Initialize Overview map on Dashboard
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
    center: [106.3, 12.5],
    zoom: 5,
    preserveDrawingBuffer: true
  });
  dashboardMap = map;

  map.on('zoom', () => {
    const zoom = map.getZoom();
    if (zoom < 16.5) {
      mapDiv.classList.add('low-zoom');
    } else {
      mapDiv.classList.remove('low-zoom');
    }
  });
  if (map.getZoom() < 16.5) {
    mapDiv.classList.add('low-zoom');
  }

  map.addControl(new mapboxgl.NavigationControl());
  map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

  map.on('load', () => {
    const bounds = new mapboxgl.LngLatBounds();
    let hasBounds = false;

    // Render farms boundaries
    farms.forEach(farm => {
      let coords = [];
      try {
        coords = typeof farm.polygon_coordinates === 'string' ? JSON.parse(farm.polygon_coordinates) : farm.polygon_coordinates;
      } catch(e) {}
      
      if (coords && coords.length > 0) {
        const farmSourceId = `farm-source-${farm.id}`;
        const farmLayerId = `farm-layer-${farm.id}`;
        const farmOutlineId = `farm-outline-${farm.id}`;

        const polygonCoords = [...coords];
        if (polygonCoords.length > 0 && 
            (polygonCoords[0][0] !== polygonCoords[polygonCoords.length - 1][0] || 
             polygonCoords[0][1] !== polygonCoords[polygonCoords.length - 1][1])) {
          polygonCoords.push(polygonCoords[0]);
        }

        map.addSource(farmSourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [polygonCoords]
            }
          }
        });

        map.addLayer({
          id: farmLayerId,
          type: 'fill',
          source: farmSourceId,
          layout: {},
          paint: {
            'fill-color': '#10b981',
            'fill-opacity': 0.25
          }
        });

        map.addLayer({
          id: farmOutlineId,
          type: 'line',
          source: farmSourceId,
          layout: {},
          paint: {
            'line-color': '#10b981',
            'line-width': 2
          }
        });

        coords.forEach(pt => {
          bounds.extend(pt);
          hasBounds = true;
        });

        map.on('click', farmLayerId, (e) => {
          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
              <div class="map-tooltip">
                <h4><i class="fa-solid fa-wheat-awn" style="color:#10b981"></i> Trang trại: ${esc(farm.name)}</h4>
                <p>${esc(farm.description || 'Không có mô tả.')}</p>
                <p>Diện tích: <strong>${farm.area ? Math.round(parseFloat(farm.area)).toLocaleString('vi-VN') : 0} m²</strong></p>
              </div>
            `)
            .addTo(map);
        });

        map.on('mouseenter', farmLayerId, () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', farmLayerId, () => map.getCanvas().style.cursor = '');
      }
    });

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

// Render plant markers using custom HTML with ID and health color wrapped in a container
    plants.forEach(plant => {
      if (plant.latitude && plant.longitude) {
        const lat = parseFloat(plant.latitude);
        const lng = parseFloat(plant.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
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
            .addTo(map);

          dashboardMarkers.push({ marker, plant, element: el });
          bounds.extend([lng, lat]);
          hasBounds = true;
        }
      }
    });

    if (hasBounds) {
      map.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 1000 });
    }

    // Apply active filter state on load if it was set
    if (currentDashboardFilter !== 'all') {
      filterDashboard(currentDashboardFilter);
    }

    // Add contour lines (đường đồng mức) & 3D terrain elevation
    addContourLinesToMap(map);
  });
}

// Initialize GIS Page
async function initGisPage() {
  activeFarmId = null;
  document.getElementById('gis-back-btn').style.display = 'none';
  document.getElementById('gis-sidebar-title').innerHTML = '<i class="fa-solid fa-map" style="color:var(--green)"></i> Trang trại';
  document.getElementById('gis-header-actions').style.display = 'block';
  switchGisView('list');
  
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
  } catch (err) {
    toast('Lỗi tải dữ liệu GIS: ' + err.message, 'error');
  }
}

function switchGisView(view) {
  document.getElementById('gis-view-list').style.display = view === 'list' ? 'block' : 'none';
  document.getElementById('gis-view-form').style.display = view === 'form' ? 'block' : 'none';
  document.getElementById('gis-view-details').style.display = view === 'details' ? 'block' : 'none';
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

function drawFarmsAndPlantsLayers(farms, plants) {
  if (!gMap) return;

  // Clear existing plant markers on map
  gisPlantMarkers.forEach(m => {
    try { m.remove(); } catch(_) {}
  });
  gisPlantMarkers = [];

  const bounds = new mapboxgl.LngLatBounds();
  let hasBounds = false;

  farms.forEach(farm => {
    let coords = [];
    try {
      coords = typeof farm.polygon_coordinates === 'string' ? JSON.parse(farm.polygon_coordinates) : farm.polygon_coordinates;
    } catch(e) {}

    if (coords && coords.length > 0) {
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
            'fill-color': '#10b981',
            'fill-opacity': activeFarmId === farm.id ? 0.45 : 0.25
          }
        });

        gMap.addLayer({
          id: outlineId,
          type: 'line',
          source: srcId,
          paint: {
            'line-color': '#10b981',
            'line-width': activeFarmId === farm.id ? 3 : 1.5
          }
        });

        gMap.on('click', layerId, () => {
          selectFarm(farm.id);
        });
        
        gMap.on('mouseenter', layerId, () => gMap.getCanvas().style.cursor = 'pointer');
        gMap.on('mouseleave', layerId, () => gMap.getCanvas().style.cursor = '');
      } else {
        if (gMap.getLayer(layerId)) {
          gMap.setPaintProperty(layerId, 'fill-opacity', activeFarmId === farm.id ? 0.45 : 0.25);
        }
        if (gMap.getLayer(outlineId)) {
          gMap.setPaintProperty(outlineId, 'line-width', activeFarmId === farm.id ? 3.5 : 1.5);
          gMap.setPaintProperty(outlineId, 'line-color', activeFarmId === farm.id ? '#059669' : '#10b981');
        }
      }

      coords.forEach(pt => {
        bounds.extend(pt);
        hasBounds = true;
      });
    }
  });

  const displayPlants = plants || currentPlants || [];
  displayPlants.forEach(plant => {
    if (plant.latitude && plant.longitude) {
      const lat = parseFloat(plant.latitude);
      const lng = parseFloat(plant.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
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

  // Add contour lines (đường đồng mức) & 3D terrain elevation to GIS map
  const activeFarm = activeFarmId ? farms.find(f => f.id === activeFarmId) : null;
  const farmCoords = activeFarm ? activeFarm.polygon_coordinates : null;
  addContourLinesToMap(gMap, { farmCoords });
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

async function selectFarm(farmId) {
  activeFarmId = farmId;
  document.getElementById('gis-back-btn').style.display = 'block';
  document.getElementById('gis-header-actions').style.display = 'none';
  switchGisView('details');
  
  try {
    const farm = await api(`/farms/${farmId}`);
    document.getElementById('gis-sidebar-title').textContent = farm.name;
    
    const ownerHtml = `<div style="margin-bottom:8px; font-size:12px; color:var(--gray-800);"><i class="fa fa-user" style="color:#ea580c"></i> Nông hộ phụ trách: <strong>${esc(farm.user_name || 'Chưa gán')}</strong></div>`;
    document.getElementById('farm-details-desc').innerHTML = ownerHtml + (farm.description ? `<p>${esc(farm.description)}</p>` : '<p style="font-style:italic; color:var(--gray-400);">Không có mô tả.</p>');
    
    document.getElementById('farm-details-area').textContent = Math.round(parseFloat(farm.area || 0)).toLocaleString('vi-VN') + ' m²';
    document.getElementById('farm-details-plant-count').textContent = farm.plants.length;

    const listEl = document.getElementById('farm-details-plants-list');
    if (farm.plants.length === 0) {
      listEl.innerHTML = '<p style="font-size:12px;color:var(--gray-400);text-align:center;padding:12px">Chưa có cây nào trong trang trại này.</p>';
    } else {
      listEl.innerHTML = farm.plants.map(p => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:var(--gray-50); border-radius:6px; font-size:12px; border:1px solid var(--gray-200);">
          <div>
            <strong>Cây ${esc(p.tree_code || p.id)}: ${esc(p.plant_type)}</strong>
            ${p.plant_variety ? `<br><small style="color:var(--gray-400)">Giống: ${esc(p.plant_variety)}</small>` : ''}
          </div>
          <div style="display:flex; align-items:center;">
            ${healthBadge(p.health_status)}
            <button class="btn btn-secondary btn-sm" style="padding: 2px 6px; margin-left: 6px;" onclick="openPlantModal(${p.id})">
              <i class="fa fa-pen"></i>
            </button>
          </div>
        </div>
      `).join('');
    }

    let coords = [];
    try {
      coords = typeof farm.polygon_coordinates === 'string' ? JSON.parse(farm.polygon_coordinates) : farm.polygon_coordinates;
    } catch(e) {}

    if (gMap) {
      // Clear elevation offset lock so contour elevation calibrates cleanly for selected farm
      gMap._contourOffsetLocked = false;
      delete gMap._contourEleOffset;

      // Re-render farm polygon highlights & plant markers for selected farm
      drawFarmsAndPlantsLayers(currentFarms, farm.plants);

      if (coords && coords.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        coords.forEach(pt => bounds.extend(pt));
        gMap.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 1000 });
      }
    }
  } catch (err) {
    toast('Lỗi tải chi tiết trang trại: ' + err.message, 'error');
  }
}

function backToFarmsList() {
  initGisPage();
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
  const userId = document.getElementById('filter-farm-user').value;
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

          // Chuẩn hóa Elevation Offset: CACHE một lần duy nhất khi zoom >= 14 để đảm bảo
          // số liệu cao độ không thay đổi khi zoom in/out (root fix của lỗi nhảy số)
          if (typeof map._contourEleOffset === 'undefined' || (currentZoom >= 14 && !map._contourOffsetLocked)) {
            map._contourEleOffset = (minEle > 600) ? Math.round(minEle - 493) : 0;
            if (currentZoom >= 14) map._contourOffsetLocked = true;
          }
          const eleOffset = map._contourEleOffset;
          const displayMin = Math.round(minEle - eleOffset);
          const displayMax = Math.round(maxEle - eleOffset);

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
            const isMajor = ['==', ['%', ['to-number', ['get', 'ele']], 5], 0];

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
                // Bình độ cái (bội số 5m): đậm 7px | Bình độ con (2m): 2.5px
                'line-width': [
                  'interpolate', ['exponential', 1.5], ['zoom'],
                  12, ['case', isMajor, 3.5, 1.5],
                  15, ['case', isMajor, 5.0, 2.0],
                  18, ['case', isMajor, 7.0, 2.5]
                ],
                'line-opacity': ['case', isMajor, 0.95, 0.8]
              }
            });

            // ─── Nhãn số cao độ: Nhét trực tiếp vào tất cả các đường đồng mức (có nhãn cho cả 2 loại) ───
            map.addLayer({
              id: 'dense-1m-contour-labels',
              type: 'symbol',
              source: 'dense-1m-contours',
              layout: {
                'symbol-placement': 'line',
                'text-field': ['concat', ['to-string', ['get', 'ele']], ' m'],
                'text-size': [
                  'interpolate', ['linear'], ['zoom'],
                  12, ['case', isMajor, 10, 8.5],
                  16, ['case', isMajor, 13, 10.5]
                ],
                'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
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

function openAdminFarmA4ExportModal(map) {
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
    try {
      const parsed = typeof selectedFarm.polygon_coordinates === 'string'
        ? JSON.parse(selectedFarm.polygon_coordinates)
        : selectedFarm.polygon_coordinates;
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (Array.isArray(parsed[0]) && Array.isArray(parsed[0][0])) {
          farmCoords = parsed[0];
        } else {
          farmCoords = parsed;
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc tọa độ ranh giới:', e);
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

  // 3. Tính chiều dài các cạnh ranh giới & thông số
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
    edgeRowsHtml = `<tr><td colspan="2" style="padding:6px; text-align:center; color:#94a3b8; font-style:italic;">Chưa chọn ranh giới trang trại</td></tr>`;
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

  const docCodeDefault = `TB-CAD-ADMIN-${Date.now().toString().slice(-6)}`;

  modalContainer.innerHTML = `
    <style>
      .a4-edit-field {
        border: 1px dashed #94a3b8 !important;
        background: #f8fafc !important;
        padding: 2px 5px !important;
        border-radius: 4px !important;
        font-family: inherit !important;
        color: inherit !important;
        box-sizing: border-box !important;
        transition: all 0.2s ease !important;
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
    </style>

    <div style="
      width: 100%; max-width: 1100px;
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px; color: #fff; background: rgba(30, 41, 59, 0.9);
      padding: 12px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    ">
      <div style="display:flex; align-items:center; gap:10px;">
        <i class="fa-solid fa-drafting-compass" style="font-size:22px; color:#4ade80;"></i>
        <div>
          <h3 style="font-size:16px; font-weight:800; margin:0; color:#4ade80;">XUẤT BẢN VẼ KỸ THUẬT TRANG TRẠI A4 NẰM NGANG</h3>
          <p style="font-size:12px; color:#94a3b8; margin:0;">Nhập trực tiếp thông tin hồ sơ | Tỷ lệ 1:1 | Sai số ±3% | Chú giải dải màu đồng mức</p>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <button id="btn-do-print-a4" style="
          background: #3b82f6; color: #fff; border: none; padding: 8px 16px;
          border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;
          display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(59,130,246,0.4);
        ">
          <i class="fa-solid fa-print"></i> In bản vẽ (Print)
        </button>
        <button id="btn-download-pdf-a4" style="
          background: #16a34a; color: #fff; border: none; padding: 8px 18px;
          border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;
          display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(22,163,74,0.4);
        ">
          <i class="fa-solid fa-file-pdf"></i> Tải PDF (A4 Nằm Ngang)
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
        <div style="display:flex; align-items:center; gap:12px; flex:1;">
          <img src="/assets/logo.png" style="height:38px;" onerror="this.style.display='none'">
          <div style="flex:1;">
            <h2 style="font-size:15px; font-weight:800; color:#15803d; margin:0; text-transform:uppercase; letter-spacing:0.5px;">TANBAO CORP — HỆ THỐNG GIS BẢN VẼ TRANG TRẠI</h2>
            <input type="text" id="a4-input-doc-title" class="a4-edit-field" value="HỒ SƠ BẢN VẼ KỸ THUẬT ĐỊA HÌNH, RANH GIỚI & KÍCH THƯỚC CHI TIẾT" style="font-size:10.5px; font-weight:700; color:#475569; width:95%; margin-top:2px;">
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:13px; font-weight:800; color:#0f172a; text-transform:uppercase;">BẢN VẼ A4 CHUẨN TỶ LỆ</div>
          <div style="font-size:10px; color:#64748b; margin-top:2px; display:flex; align-items:center; justify-content:flex-end; gap:4px;">
            <span>Mã Hồ Sơ:</span>
            <input type="text" id="a4-input-doc-code" class="a4-edit-field" value="${docCodeDefault}" style="font-size:10px; font-weight:800; color:#0f172a; width:160px; text-align:right;">
          </div>
        </div>
      </div>

      <div style="display:flex; gap:12px; flex:1; overflow:hidden;">
        <div style="flex:1.75; border:1.5px solid #000; position:relative; overflow:hidden; border-radius:4px; display:flex; align-items:center; justify-content:center; background:#e2e8f0;">
          <img src="${mapImageDataUrl}" style="width:100%; height:100%; object-fit:cover;">
          <div style="position:absolute; top:10px; right:10px; background:rgba(255,255,255,0.92); padding:4px 10px; border-radius:4px; border:1px solid #000; font-weight:800; font-size:11px; box-shadow:0 2px 6px rgba(0,0,0,0.2); display:flex; align-items:center; gap:5px;">
            <i class="fa-solid fa-compass" style="color:#0f172a;"></i> HƯỚNG BẮC (N)
          </div>
          <div style="position:absolute; bottom:10px; left:10px; background:rgba(15,23,42,0.85); color:#fff; padding:4px 10px; border-radius:4px; font-size:10px; font-weight:700; display:flex; align-items:center; gap:5px;">
            <i class="fa-solid fa-mountain-sun" style="color:#4ade80;"></i> Đường đồng mức interval = ${contourInterval}m
          </div>
        </div>

        <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
          <div style="border:1.5px solid #000; border-radius:4px; padding:8px; background:#f0fdf4;">
            <div style="font-weight:800; font-size:11px; color:#15803d; border-bottom:1px solid #bbf7d0; padding-bottom:4px; margin-bottom:6px; text-transform:uppercase; display:flex; align-items:center; gap:6px;">
              <i class="fa-solid fa-chart-pie"></i> THỐNG KÊ KÍCH THƯỚC TRANG TRẠI
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
              <tr>
                <td style="padding:3px 0; color:#dc2626; font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> Kích thước sai số:</td>
                <td style="padding:3px 0; text-align:right; font-weight:800; color:#dc2626;">± 3%</td>
              </tr>
            </table>
          </div>

          <!-- Bảng Chú Giải Dải Màu Cao Độ Kỹ Thuật CAD -->
          <div style="border:1.5px solid #000; border-radius:4px; padding:6px 8px; background:#fff;">
            <div style="font-weight:800; font-size:10px; color:#0f172a; border-bottom:1px solid #cbd5e1; padding-bottom:3px; margin-bottom:5px; text-transform:uppercase; display:flex; align-items:center; justify-content:space-between;">
              <span style="display:flex; align-items:center; gap:5px;">
                <i class="fa-solid fa-palette" style="color:#2563eb;"></i> CHÚ GIẢI DẢI MÀU CAO ĐỘ (${contourInterval}M/BẬC)
              </span>
              <span style="font-size:9px; color:#15803d; font-weight:700;">⛰️ Nét vẽ CAD</span>
            </div>

            <!-- Thanh Dải Màu Gradient Thang Độ Liên Tục từ Thấp (Trái) -> Cao (Phải) -->
            <div style="height:12px; width:100%; border-radius:3px; background: linear-gradient(to right, #000080, #0066ff, #00ff99, #ffff00, #ff6600, #800000); border:1px solid #94a3b8; margin-bottom:4px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);"></div>

            <div style="display:flex; justify-content:space-between; align-items:center; font-size:9.5px; font-weight:700;">
              <div style="text-align:left; color:#000080;">
                <div>${minEle}m</div>
                <div style="font-size:8px; color:#64748b; font-weight:600;">(Thấp nhất)</div>
              </div>
              <div style="text-align:center; color:#0284c7;">
                <div>${Math.round(minEle + (maxEle - minEle)*0.25)}m</div>
              </div>
              <div style="text-align:center; color:#ca8a04;">
                <div>${Math.round(minEle + (maxEle - minEle)*0.5)}m</div>
              </div>
              <div style="text-align:center; color:#ea580c;">
                <div>${Math.round(minEle + (maxEle - minEle)*0.75)}m</div>
              </div>
              <div style="text-align:right; color:#b91c1c;">
                <div>${maxEle}m</div>
                <div style="font-size:8px; color:#64748b; font-weight:600;">(Cao nhất)</div>
              </div>
            </div>
          </div>

          <div style="flex:1; border:1.5px solid #000; border-radius:4px; padding:8px; background:#fff; overflow-y:auto;">
            <div style="font-weight:800; font-size:11px; color:#1e293b; border-bottom:1px solid #cbd5e1; padding-bottom:4px; margin-bottom:6px; text-transform:uppercase; display:flex; align-items:center; gap:6px;">
              <i class="fa-solid fa-ruler-horizontal"></i> CHIỀU DÀI CÁC CẠNH RANH GIỚI
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

      <!-- Title Block Khung Tên Bản Vẽ CAD -->
      <div style="margin-top:10px; border:2px solid #000; background:#fff;">
        <table style="width:100%; border-collapse:collapse; font-size:10.5px;">
          <tr>
            <td style="width:33%; border-right:1.5px solid #000; padding:6px 8px; vertical-align:top;">
              <div style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase; display:flex; align-items:center; gap:4px;">
                <i class="fa-solid fa-house-chimney" style="color:#15803d;"></i> TÊN TRANG TRẠI
              </div>
              <input type="text" id="a4-input-farm-name" class="a4-edit-field" value="${farmName}" style="font-size:12px; font-weight:800; color:#15803d; width:100%; margin-top:2px;">
            </td>
            <td style="width:27%; border-right:1.5px solid #000; padding:6px 8px; vertical-align:top;">
              <div style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase; display:flex; align-items:center; gap:4px;">
                <i class="fa-solid fa-user" style="color:#0f172a;"></i> KHÁCH HÀNG / NÔNG HỘ
              </div>
              <input type="text" id="a4-input-owner-name" class="a4-edit-field" value="${ownerName}" style="font-size:11px; font-weight:700; color:#0f172a; width:100%; margin-top:2px;">
            </td>
            <td style="width:22%; border-right:1.5px solid #000; padding:6px 8px; vertical-align:top;">
              <div style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase; display:flex; align-items:center; gap:4px;">
                <i class="fa-solid fa-user-gear" style="color:#0f172a;"></i> NGƯỜI THỰC HIỆN
              </div>
              <input type="text" id="a4-input-performer-name" class="a4-edit-field" value="${performerName}" style="font-size:11px; font-weight:700; color:#0f172a; width:100%; margin-top:2px;">
            </td>
            <td style="width:10%; border-right:1.5px solid #000; padding:6px 8px; vertical-align:top;">
              <div style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase; display:flex; align-items:center; gap:4px;">
                <i class="fa-solid fa-calendar-days" style="color:#64748b;"></i> NGÀY XUẤT
              </div>
              <div style="font-size:11px; font-weight:700; margin-top:4px;">${exportDate}</div>
            </td>
            <td style="width:8%; padding:6px 8px; vertical-align:top;">
              <div style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase; display:flex; align-items:center; gap:4px;">
                <i class="fa-solid fa-ruler-combined" style="color:#2563eb;"></i> TỶ LỆ
              </div>
              <input type="text" id="a4-input-scale-text" class="a4-edit-field" value="1 : 1" style="font-size:11.5px; font-weight:800; color:#2563eb; width:100%; margin-top:2px;">
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


