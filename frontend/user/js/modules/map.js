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

        // 1. Kiểm tra options.farmCoords
        if (options.farmCoords && Array.isArray(options.farmCoords) && options.farmCoords.length > 0) {
          options.farmCoords.forEach(pt => {
            if (Array.isArray(pt) && pt.length >= 2) {
              lngs.push(pt[0]);
              lats.push(pt[1]);
            }
          });
        }

        // 2. Trích xuất từ các lớp ranh giới nông trại có sẵn trên bản đồ
        if (lngs.length === 0) {
          const farmLayers = ['farm-bounds-layer', 'admin-farms-fill', 'farm-layer', 'farm-polygon'];
          farmLayers.forEach(lId => {
            if (map.getLayer(lId)) {
              const features = map.queryRenderedFeatures({ layers: [lId] });
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
            }
          });
        }

        if (lngs.length > 0 && lats.length > 0) {
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          
          const marginLng = (maxLng - minLng) * 0.05 || 0.0005;
          const marginLat = (maxLat - minLat) * 0.05 || 0.0005;

          return {
            west: minLng - marginLng,
            east: maxLng + marginLng,
            south: minLat - marginLat,
            north: maxLat + marginLat
          };
        }

        return null;
      };

      // 4. Hàm Sinh Đường Đồng Mức Mật Độ 1m CHO NÔNG TRẠI
      const updateDense1mContours = () => {
        try {
          const bbox = getFarmBoundingBox();
          if (!bbox) {
            if (map.getSource('dense-1m-contours')) {
              map.getSource('dense-1m-contours').setData({ type: 'FeatureCollection', features: [] });
            }
            return;
          }

          const { west, south, east, north } = bbox;
          const nx = 35;
          const ny = 35;
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
                'text-allow-overlap': false,
                'text-ignore-placement': false,
                'text-max-angle': 35,
                'visibility': defaultVisible ? 'visible' : 'none'
              },
              paint: {
                'text-color': dynamicRamp,
                'text-halo-color': 'rgba(0, 0, 0, 0.9)',
                'text-halo-width': 2
              }
            });
          }

          updateLegendWidget(minEle, maxEle);
        } catch (e) {
          console.warn('Lỗi sinh đường đồng mức nông trại:', e);
        }
      };

      const updateLegendWidget = (minEle, maxEle) => {
        const legendContainer = map.getContainer().querySelector('.elevation-legend-widget-container');
        if (!legendContainer) return;

        const minE = Math.floor(minEle);
        const maxE = Math.ceil(maxEle);
        const span = maxE - minE;
        const step = span > 25 ? Math.ceil(span / 20) : 1;

        let badgesHtml = '';
        for (let ele = maxE; ele >= minE; ele -= step) {
          const color = getDynamicColorForEle(ele, minEle, maxEle);
          badgesHtml += `
            <div style="
              background: ${color};
              color: #ffffff;
              font-weight: 800;
              font-size: 11px;
              padding: 2px 10px;
              text-align: center;
              text-shadow: 0 1px 2px rgba(0,0,0,0.8);
              line-height: 1.3;
              letter-spacing: 0.5px;
              font-family: system-ui, -apple-system, sans-serif;
            ">${ele} m</div>
          `;
        }

        legendContainer.innerHTML = `
          <div style="
            display: flex;
            flex-direction: column;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 16px rgba(0,0,0,0.6);
            border: 1px solid rgba(255,255,255,0.25);
            max-height: 360px;
            overflow-y: auto;
          ">
            ${badgesHtml}
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
            btn.title = 'Bật/Tắt đường đồng mức 1m nông trại (Contour Lines)';
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
              if (m.getLayer('dense-1m-contour-lines')) m.setLayoutProperty('dense-1m-contour-lines', 'visibility', visVal);
              if (m.getLayer('dense-1m-contour-labels')) m.setLayoutProperty('dense-1m-contour-labels', 'visibility', visVal);

              btn.style.background = isVisible ? 'rgba(245, 158, 11, 0.25)' : 'transparent';
              btn.style.color = isVisible ? '#f59e0b' : '#555';

              const legendEl = m.getContainer().querySelector('.elevation-legend-widget-container');
              if (legendEl) legendEl.style.display = isVisible ? 'block' : 'none';
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

