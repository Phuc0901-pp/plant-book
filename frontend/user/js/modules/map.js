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
  });
}
