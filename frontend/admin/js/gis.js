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
    zoom: 5
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
          el.innerHTML = `<span>${esc(plant.tree_code || plant.id)}</span>`;
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
    zoom: 5
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

  gMap.on('load', () => {
    drawFarmsAndPlantsLayers(farms, plants);
  });
}

function drawFarmsAndPlantsLayers(farms, plants) {
  if (!gMap) return;
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

      coords.forEach(pt => {
        bounds.extend(pt);
        hasBounds = true;
      });
    }
  });

  plants.forEach(plant => {
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
        el.innerHTML = `<span>${esc(plant.tree_code || plant.id)}</span>`;
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

        bounds.extend([lng, lat]);
        hasBounds = true;
      }
    }
  });

  if (hasBounds && !activeFarmId) {
    gMap.fitBounds(bounds, { padding: 50, maxZoom: 16, duration: 1000 });
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

    if (coords && coords.length > 0 && gMap) {
      const bounds = new mapboxgl.LngLatBounds();
      coords.forEach(pt => bounds.extend(pt));
      gMap.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 1000 });
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

