/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/map.js — Mapbox GIS map for farms & plants
   ═══════════════════════════════════════════════════════════════ */

import { API } from '../core/api.js';
import { esc } from '../core/utils.js';

/** Instance Mapbox map hiện tại */
export let userMap = null;

/** Danh sách marker cây trồng trên bản đồ */
export let userMarkers = [];

/** Cờ đánh dấu đã tải token Mapbox */
let mapboxTokenFetched = false;

/**
 * Tải Mapbox access token từ server (chỉ tải một lần).
 * Throws nếu không lấy được token.
 */
export async function ensureUserMapboxToken() {
  if (mapboxTokenFetched) return;
  const res  = await fetch(API + '/config/mapbox-token');
  if (!res.ok) throw new Error('Không thể lấy cấu hình Mapbox từ server');
  const data = await res.json();
  if (!data || !data.token) throw new Error('Cấu hình Mapbox không hợp lệ');
  mapboxgl.accessToken = data.token;
  mapboxTokenFetched = true;
}

/**
 * Khởi tạo bản đồ Mapbox cho cổng nông hộ.
 * Vẽ polygon trang trại và marker cây trồng.
 * @param {Array} farms   — danh sách trang trại
 * @param {Array} plants  — danh sách cây trồng (có latitude/longitude)
 */
export function initUserMap(farms, plants) {
  const container = document.getElementById('user-map');
  if (!container) return;

  // Huỷ map cũ nếu có
  if (userMap) {
    try { userMap.remove(); } catch (_) {}
    userMap = null;
  }
  userMarkers = [];

  container.innerHTML = '';
  const mapDiv = Object.assign(document.createElement('div'), {});
  Object.assign(mapDiv.style, { width: '100%', height: '100%' });
  container.appendChild(mapDiv);

  const map = new mapboxgl.Map({
    container: mapDiv,
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center: [106.3, 12.5],
    zoom: 5
  });
  userMap = map;
  
  // Force resize trigger on window resize / screen rotate to prevent canvas layout clipping
  window.addEventListener('resize', () => {
    if (userMap) {
      try { userMap.resize(); } catch (_) {}
    }
  });

  // Ẩn nhãn ở zoom thấp (chỉ hiện chấm tròn)
  map.on('zoom', () => {
    mapDiv.classList.toggle('low-zoom', map.getZoom() < 16.5);
  });
  if (map.getZoom() < 16.5) mapDiv.classList.add('low-zoom');

  map.addControl(new mapboxgl.NavigationControl());

  map.on('load', () => {
    const bounds    = new mapboxgl.LngLatBounds();
    let   hasBounds = false;

    // ── Vẽ Trang trại (Polygon) ──────────────────────────
    farms.forEach(farm => {
      let coords = [];
      try {
        coords = typeof farm.polygon_coordinates === 'string'
          ? JSON.parse(farm.polygon_coordinates)
          : farm.polygon_coordinates;
      } catch (_) {}

      if (!coords || coords.length === 0) return;

      const srcId     = `user-farm-src-${farm.id}`;
      const layerId   = `user-farm-layer-${farm.id}`;
      const outlineId = `user-farm-outline-${farm.id}`;

      // Đóng polygon nếu cần
      const poly = [...coords];
      if (poly.length > 0 && (poly[0][0] !== poly[poly.length - 1][0] || poly[0][1] !== poly[poly.length - 1][1])) {
        poly.push(poly[0]);
      }

      map.addSource(srcId, {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [poly] } }
      });

      map.addLayer({ id: layerId, type: 'fill', source: srcId, layout: {},
        paint: { 'fill-color': '#10b981', 'fill-opacity': 0.25 } });
      map.addLayer({ id: outlineId, type: 'line', source: srcId, layout: {},
        paint: { 'line-color': '#10b981', 'line-width': 2 } });

      coords.forEach(pt => { bounds.extend(pt); hasBounds = true; });

      // Popup khi click vào trang trại
      map.on('click', layerId, (e) => {
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="map-tooltip" style="font-family:inherit;font-size:12px;">
              <h4 style="font-size:13px;font-weight:700;color:var(--green-dark);margin-bottom:4px;">🏡 ${esc(farm.name)}</h4>
              <p style="margin-bottom:2px;">Diện tích: <strong>${farm.area ? Math.round(parseFloat(farm.area)).toLocaleString('vi-VN') : 0} m²</strong></p>
              <p style="color:var(--text-muted);font-style:italic;">${esc(farm.description || 'Không có mô tả')}</p>
            </div>`)
          .addTo(map);
      });
      map.on('mouseenter', layerId, () => map.getCanvas().style.cursor = 'pointer');
      map.on('mouseleave', layerId, () => map.getCanvas().style.cursor = '');
    });

    // ── Vẽ Cây trồng (Marker chấm tròn màu) ─────────────
    plants.forEach(plant => {
      if (!plant.latitude || !plant.longitude) return;
      const lat = parseFloat(plant.latitude);
      const lng = parseFloat(plant.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const wrapper = Object.assign(document.createElement('div'), { className: 'plant-marker-wrap' });
      wrapper.style.cursor = 'pointer';

      const el = Object.assign(document.createElement('div'), { className: 'plant-id-marker' });
      const colorMap = { 'Tốt': '#22c55e', 'Cần chú ý': '#eab308', 'Bệnh': '#ef4444' };
      const color    = colorMap[plant.health_status] || '#3b82f6';

      Object.assign(el.style, {
        width: '30px', height: '30px', borderRadius: '50%',
        border: '2px solid white', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: '9px', fontWeight: '700', color: '#fff',
        background: color, boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
      });
      el.innerHTML = `<span>${esc(plant.tree_code || plant.id)}</span>`;
      wrapper.appendChild(el);

      const marker = new mapboxgl.Marker(wrapper)
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div class="map-tooltip" style="font-family:inherit;font-size:12px;min-width:160px;">
            <h4 style="font-size:13px;font-weight:700;color:var(--green-dark);margin-bottom:6px;">
              <i class="fa-solid fa-tree"></i> Cây ${esc(plant.tree_code || plant.id)}
            </h4>
            <p style="margin-bottom:3px;">Loại: <strong>${esc(plant.plant_type)}</strong></p>
            <p style="margin-bottom:3px;">Sức khỏe: <strong>${esc(plant.health_status)}</strong></p>
            <p style="margin-bottom:6px;color:var(--text-muted);">Vị trí: ${esc(plant.location || 'Chưa rõ')}</p>
            <button class="btn btn-primary btn-xs" onclick="openCareModal(${plant.id},'${esc(plant.tree_code || plant.id)}','${esc(plant.plant_type)}')">
              <i class="fa-solid fa-file-signature"></i> Nhật ký
            </button>
          </div>`))
        .addTo(map);

      userMarkers.push({ marker, plant });
      bounds.extend([lng, lat]);
      hasBounds = true;
    });

    if (hasBounds) {
      map.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 1000 });
    }

    // ── Thêm Lớp Đường Đồng Mức (Contour Lines) & Địa hình 3D ──
    addContourLinesToMap(map);
  });
}

/**
 * Thêm đường đồng mức siêu dày mật độ 1m (1-Meter High-Density Contour Lines),
 * dải màu cao độ quang phổ (Elevation Spectrum Gradient) và Bảng chú giải cao độ.
 * @param {mapboxgl.Map} map - Mapbox map instance
 * @param {Object} options - { defaultVisible: true, showControl: true }
 */
export function addContourLinesToMap(map, options = {}) {
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

      // 4. Hàm Sinh Đường Đồng Mức Mật Độ Dày 1-Meter qua Marching Squares
      const updateDense1mContours = () => {
        try {
          const bounds = map.getBounds();
          if (!bounds) return;

          const west = bounds.getWest();
          const south = bounds.getSouth();
          const east = bounds.getEast();
          const north = bounds.getNorth();

          const nx = 50;
          const ny = 50;
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

          const startLevel = Math.floor(minEle);
          const endLevel = Math.ceil(maxEle);
          const features = [];

          function interp(pA, pB, vA, vB, val) {
            if (Math.abs(vB - vA) < 1e-6) return pA;
            const t = (val - vA) / (vB - vA);
            return [pA[0] + t * (pB[0] - pA[0]), pA[1] + t * (pB[1] - pA[1])];
          }

          for (let threshold = startLevel; threshold <= endLevel; threshold += 1.0) {
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

                const code = (v0 >= threshold ? 1 : 0) |
                             (v1 >= threshold ? 2 : 0) |
                             (v2 >= threshold ? 4 : 0) |
                             (v3 >= threshold ? 8 : 0);

                if (code === 0 || code === 15) continue;

                const p0 = [lng0, lat0];
                const p1 = [lng1, lat0];
                const p2 = [lng1, lat1];
                const p3 = [lng0, lat1];

                const e0 = interp(p0, p1, v0, v1, threshold);
                const e1 = interp(p1, p2, v1, v2, threshold);
                const e2 = interp(p3, p2, v3, v2, threshold);
                const e3 = interp(p0, p3, v0, v3, threshold);

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
                properties: { ele: Math.round(threshold) },
                geometry: {
                  type: 'MultiLineString',
                  coordinates: segments
                }
              });
            }
          }

          const geoData = { type: 'FeatureCollection', features };

          if (map.getSource('dense-1m-contours')) {
            map.getSource('dense-1m-contours').setData(geoData);
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
                'line-color': contourColorRamp,
                'line-width': [
                  'interpolate',
                  ['exponential', 1.5],
                  ['zoom'],
                  12, 1.2,
                  15, 2.2,
                  18, 3.5
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
        } catch (e) {
          console.warn('Lỗi sinh đường đồng mức 1m:', e);
        }
      };

      // Tự động sinh đường đồng mức 1m khi bản đồ dừng di chuyển / load dữ liệu địa hình xong
      let contourTimer = null;
      const debouncedUpdate = () => {
        clearTimeout(contourTimer);
        contourTimer = setTimeout(updateDense1mContours, 300);
      };

      map.on('moveend', debouncedUpdate);
      map.on('idle', debouncedUpdate);
      setTimeout(updateDense1mContours, 600);
      setTimeout(updateDense1mContours, 1500);

      // 5. Nút Bật/Tắt đường đồng mức
      if (showControl && !map._contourControlAdded) {
        map._contourControlAdded = true;

        class ContourToggleControl {
          onAdd(m) {
            this._map = m;
            this._container = document.createElement('div');
            this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
            
            const btn = document.createElement('button');
            btn.className = 'mapboxgl-ctrl-icon mapbox-ctrl-contour-btn';
            btn.type = 'button';
            btn.title = 'Bật/Tắt đường đồng mức 1m mật độ dày (Contour Lines)';
            btn.setAttribute('aria-label', 'Toggle Contour Lines');
            btn.style.cssText = `
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
            btn.innerHTML = '⛰️';

            let isVisible = defaultVisible;

            btn.onclick = () => {
              isVisible = !isVisible;
              const visVal = isVisible ? 'visible' : 'none';
              if (m.getLayer('contour-lines')) m.setLayoutProperty('contour-lines', 'visibility', visVal);
              if (m.getLayer('contour-labels')) m.setLayoutProperty('contour-labels', 'visibility', visVal);
              if (m.getLayer('dense-1m-contour-lines')) m.setLayoutProperty('dense-1m-contour-lines', 'visibility', visVal);
              if (m.getLayer('dense-1m-contour-labels')) m.setLayoutProperty('dense-1m-contour-labels', 'visibility', visVal);

              btn.style.background = isVisible ? 'rgba(245, 158, 11, 0.25)' : 'transparent';
              btn.style.color = isVisible ? '#f59e0b' : '#555';

              const legendEl = m.getContainer().querySelector('.elevation-legend-widget');
              if (legendEl) legendEl.style.display = isVisible ? 'flex' : 'none';
            };

            this._container.appendChild(btn);
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

        // 6. Thêm Bảng Chú Giải Dải Màu Cao Độ
        const mapContainer = map.getContainer();
        if (mapContainer && !mapContainer.querySelector('.elevation-legend-widget')) {
          const legend = document.createElement('div');
          legend.className = 'elevation-legend-widget';
          legend.style.cssText = `
            position: absolute;
            bottom: 24px;
            right: 10px;
            z-index: 8;
            background: rgba(7, 25, 16, 0.88);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 10px;
            padding: 8px 10px;
            color: #fff;
            font-size: 11px;
            display: ${defaultVisible ? 'flex' : 'none'};
            flex-direction: column;
            align-items: center;
            box-shadow: 0 4px 16px rgba(0,0,0,0.5);
            pointer-events: none;
          `;
          legend.innerHTML = `
            <div style="font-weight:700; margin-bottom:6px; font-size:10px; text-transform:uppercase; color:#9ca3af; letter-spacing:0.5px;">Cao độ (m)</div>
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="
                width: 10px;
                height: 110px;
                border-radius: 5px;
                background: linear-gradient(to top, #1d4ed8, #06b6d4, #10b981, #84cc16, #eab308, #f97316, #ef4444);
                border: 1px solid rgba(255,255,255,0.3);
              "></div>
              <div style="display:flex; flex-direction:column; justify-content:space-between; height:110px; font-size:9px; font-weight:700; color:#e5e7eb;">
                <span style="color:#ef4444;">Cao ▲</span>
                <span style="color:#eab308;">TB</span>
                <span style="color:#06b6d4;">Thấp ▼</span>
              </div>
            </div>
          `;
          mapContainer.appendChild(legend);
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

