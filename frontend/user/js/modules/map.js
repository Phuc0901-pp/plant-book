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
    zoom: 5,
    preserveDrawingBuffer: true
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
  map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

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
 * Thêm đường đồng mức siêu dày 1m (1-Meter High-Density Contour Lines)
 * DÀNH RIÊNG CHO RANH GIỚI NÔNG TRẠI (Zero Lag, Tối ưu tối đa hiệu năng).
 * @param {mapboxgl.Map} map - Mapbox map instance
 * @param {Object} options - { defaultVisible: true, showControl: true, farmCoords: Array }
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

        if (lngs.length === 0 && window.plantData && window.plantData.farm && window.plantData.farm.coordinates) {
          try {
            const coords = typeof window.plantData.farm.coordinates === 'string'
              ? JSON.parse(window.plantData.farm.coordinates)
              : window.plantData.farm.coordinates;
            coords.flat(2).forEach(pt => {
              if (pt && pt.length >= 2) { lngs.push(pt[0]); lats.push(pt[1]); }
            });
          } catch (_) {}
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

        const mapBounds = map.getBounds();
        if (mapBounds) {
          return {
            west: mapBounds.getWest(),
            east: mapBounds.getEast(),
            south: mapBounds.getSouth(),
            north: mapBounds.getNorth()
          };
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

          // Khoảng cách đường đồng mức cố định 2m theo tiêu chuẩn bản vẽ CAD/GIS
          const interval = 2.0;

          // Chỉ lấy mẫu DEM khi zoom đủ cao để có tile độ phân giải cao và ổn định
          // Nếu zoom < 13, giữ nguyên dữ liệu cũ tránh sai số datum khi zoom out
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

          // Chuẩn hóa Elevation Offset: CACHE một lần duy nhất khi zoom >= 14 để số liệu
          // cao độ không thay đổi khi zoom in/out (root fix của lỗi nhảy số)
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
                  12, 1.8,
                  15, 2.8,
                  18, 4.2
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
                  16, 12.5
                ],
                'text-allow-overlap': false,
                'text-ignore-placement': false,
                'text-max-angle': 35,
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
              openFarmA4ExportModal(m);
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

/**
 * Mở modal xuất bản vẽ trang trại A4 Nằm Ngang (A4 Landscape PDF Drawing)
 * bao gồm:
 * 1. Khung thông tin: Tên trang trại, Khách hàng, Ngày xuất, Tỉ lệ, Người thực hiện
 * 2. Bản đồ trang trại + đường đồng mức (interval 1m)
 * 3. Kích thước trang trại: chiều dài các cạnh, chu vi, diện tích
 */
export function openFarmA4ExportModal(map) {
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

  let farmName = 'Nông Trại Sản Xuất';
  let ownerName = 'Khách Hàng Tanbao';
  let performerName = 'Kỹ sư Tanbao Corp';
  let farmCoords = [];
  let areaSqM = 0;
  let plantCount = 0;

  if (window.userFarms && Array.isArray(window.userFarms) && window.userFarms.length > 0) {
    const f = window.userFarms[0];
    if (f.name) farmName = f.name;
    if (f.owner_name || f.user_name) ownerName = f.owner_name || f.user_name;
    if (f.area) areaSqM = Math.round(parseFloat(f.area));
    if (f.polygon_coordinates) {
      try {
        const parsed = typeof f.polygon_coordinates === 'string' ? JSON.parse(f.polygon_coordinates) : f.polygon_coordinates;
        if (Array.isArray(parsed) && parsed.length > 0) {
          farmCoords = Array.isArray(parsed[0]) && Array.isArray(parsed[0][0]) ? parsed[0] : parsed;
        }
      } catch (_) {}
    }
  } else if (window.plantData) {
    if (window.plantData.name) farmName = window.plantData.name;
    if (window.plantData.farm && window.plantData.farm.name) farmName = window.plantData.farm.name;
    if (window.plantData.owner_name) ownerName = window.plantData.owner_name;
    if (window.plantData.farm && window.plantData.farm.owner_name) ownerName = window.plantData.farm.owner_name;
    if (window.plantData.farm_boundary && window.plantData.farm_boundary.coordinates) {
      farmCoords = window.plantData.farm_boundary.coordinates[0];
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

  // Thuật toán lật trang trại thẳng đứng
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
    edgeRowsHtml = `<tr><td colspan="2" style="padding:6px; text-align:center; color:#94a3b8; font-style:italic;">Chưa chọn ranh giới trang trại</td></tr>`;
  }

  if (window.userMarkers && Array.isArray(window.userMarkers)) plantCount = window.userMarkers.length;

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

  const docCodeDefault = `TB-CAD-USER-${Date.now().toString().slice(-6)}`;

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

