// Modular Admin GIS GPS Parser, Beacon & Multi-Point Import Tools
// ═════════════════════════════════════════════════════════════════════════════
// 📍 SMART GPS PARSER & PIN / PING NAVIGATION HELPERS
// ═════════════════════════════════════════════════════════════════════════════

let gisGpsBeaconMarker = null;

function clearGisGpsBeacon() {
  if (gisGpsBeaconMarker) {
    try { gisGpsBeaconMarker.remove(); } catch(_) {}
    gisGpsBeaconMarker = null;
  }
}
window.clearGisGpsBeacon = clearGisGpsBeacon;

/**
 * Smart Parser for any GPS format (Decimal degrees, Google Maps links, DMS)
 * @param {string} input - GPS raw string or URL
 * @returns {{lat: number, lng: number}|null}
 */
function parseGpsCoordinate(input) {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();
  if (!str) return null;

  // 1. Google Maps URL patterns:
  // e.g. https://www.google.com/maps?q=14.05832,108.27721
  // e.g. https://www.google.com/maps/@14.05832,108.27721,17z
  // e.g. https://www.google.com/maps/place/14.05832,108.27721
  const mapUrlMatch = str.match(/(@|[?&]q=|[?&]ll=|\/place\/)(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
  if (mapUrlMatch) {
    const v1 = parseFloat(mapUrlMatch[2]);
    const v2 = parseFloat(mapUrlMatch[3]);
    if (!isNaN(v1) && !isNaN(v2)) {
      return orientVietnamGps(v1, v2);
    }
  }

  // 2. Degrees Minutes Seconds (DMS) format:
  // e.g. 14°03'29.9"N 108°16'38.0"E or 14 03 30 N, 108 16 38 E
  const dmsRegex = /(\d+)[\s°]+(\d+)[\s']+([\d.]+)[\s"]*([NSEWnsew])?/g;
  const dmsMatches = [...str.matchAll(dmsRegex)];
  if (dmsMatches.length >= 2) {
    const parseDmsPart = (m) => {
      const deg = parseFloat(m[1]) || 0;
      const min = parseFloat(m[2]) || 0;
      const sec = parseFloat(m[3]) || 0;
      let dec = deg + min / 60 + sec / 3600;
      const dir = (m[4] || '').toUpperCase();
      if (dir === 'S' || dir === 'W') dec = -dec;
      return { dec, dir };
    };
    const p1 = parseDmsPart(dmsMatches[0]);
    const p2 = parseDmsPart(dmsMatches[1]);
    let lat = p1.dec;
    let lng = p2.dec;
    if (p1.dir === 'E' || p1.dir === 'W' || p2.dir === 'N' || p2.dir === 'S') {
      lng = p1.dec;
      lat = p2.dec;
    }
    return orientVietnamGps(lat, lng);
  }

  // 3. Decimal Degrees with comma, semicolon, or whitespace:
  // e.g. "14.05832, 108.27721" or "14.05832 108.27721" or "14.05832;108.27721"
  const cleanStr = str.replace(/[\[\]\(\)]/g, ' ').replace(/[,;]/g, ' ');
  const parts = cleanStr.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const v1 = parseFloat(parts[0]);
    const v2 = parseFloat(parts[1]);
    if (!isNaN(v1) && !isNaN(v2)) {
      return orientVietnamGps(v1, v2);
    }
  }

  return null;
}
window.parseGpsCoordinate = parseGpsCoordinate;

/**
 * Intelligent orientation for Vietnam / Global GPS coordinates
 * Standard order in VN: Lat is ~8..24, Lng is ~102..110
 */
function orientVietnamGps(v1, v2) {
  // If one is clearly longitude (>50) and one is clearly latitude (<50)
  if (v1 > 50 && v2 < 50) {
    return { lat: v2, lng: v1 };
  }
  if (v2 > 50 && v1 < 50) {
    return { lat: v1, lng: v2 };
  }
  // Default: v1 is Lat, v2 is Lng
  return { lat: v1, lng: v2 };
}

/**
 * Ping / Fly To GPS Location on Map with a pulsing Radar Beacon Marker
 */
function pingGpsLocationOnMap(lat, lng, label = 'Tọa độ GPS') {
  if (!gMap) {
    toast('Bản đồ GIS chưa được khởi tạo!', 'error');
    return;
  }
  if (isNaN(lat) || isNaN(lng)) {
    toast('Tọa độ GPS không hợp lệ!', 'error');
    return;
  }

  // Ensure map is properly sized
  gMap.resize();

  // Clear previous beacon
  clearGisGpsBeacon();

  // Create pulsing radar beacon element
  const beaconEl = document.createElement('div');
  beaconEl.className = 'gis-gps-beacon-container';
  beaconEl.innerHTML = `
    <div class="gis-gps-beacon-ring"></div>
    <div class="gis-gps-beacon-ring-2"></div>
    <div class="gis-gps-beacon-core"></div>
  `;

  const popupHtml = `
    <div style="font-family:sans-serif; padding:4px 6px; font-size:12px;">
      <div style="font-weight:800; color:#047857; display:flex; align-items:center; gap:5px; margin-bottom:3px;">
        <i data-lucide="map-pin" class="lucide-sm" style="color:#059669;"></i> ${esc(label)}
      </div>
      <div style="font-family:monospace; font-size:12px; font-weight:700; color:#0f172a; background:#f8fafc; padding:4px 6px; border-radius:4px; border:1px solid #e2e8f0;">
        ${lat.toFixed(6)}, ${lng.toFixed(6)}
      </div>
      <div style="font-size:11px; color:#64748b; margin-top:4px;">🎯 Tâm định vị máy GPS</div>
    </div>
  `;

  gisGpsBeaconMarker = new mapboxgl.Marker({ element: beaconEl, anchor: 'center' })
    .setLngLat([lng, lat])
    .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML(popupHtml))
    .addTo(gMap);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 50);
  }

  // Fly to location with smooth animation at high zoom
  gMap.flyTo({
    center: [lng, lat],
    zoom: 18,
    speed: 1.6,
    curve: 1.4,
    essential: true
  });

  toast(`🎯 Đã bay đến tọa độ GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'success');
}
window.pingGpsLocationOnMap = pingGpsLocationOnMap;

/**
 * Handle Ping button click in the Farm Form
 */
function pingGpsFromForm() {
  const smartVal = document.getElementById('farm-gps-smart-input')?.value.trim();
  const latVal = document.getElementById('farm-gps-lat')?.value.trim();
  const lngVal = document.getElementById('farm-gps-lng')?.value.trim();

  let coords = null;
  if (smartVal) {
    coords = parseGpsCoordinate(smartVal);
  } else if (latVal && lngVal) {
    const v1 = parseFloat(latVal);
    const v2 = parseFloat(lngVal);
    if (!isNaN(v1) && !isNaN(v2)) {
      coords = orientVietnamGps(v1, v2);
    }
  }

  if (!coords) {
    toast('Vui lòng nhập hoặc dán tọa độ GPS hợp lệ (VD: 14.05832, 108.27721)!', 'error');
    return;
  }

  // Sync inputs
  if (document.getElementById('farm-gps-lat')) document.getElementById('farm-gps-lat').value = coords.lat.toFixed(6);
  if (document.getElementById('farm-gps-lng')) document.getElementById('farm-gps-lng').value = coords.lng.toFixed(6);
  if (document.getElementById('farm-gps-smart-input')) document.getElementById('farm-gps-smart-input').value = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;

  pingGpsLocationOnMap(coords.lat, coords.lng, 'Vị trí trang trại');
}
window.pingGpsFromForm = pingGpsFromForm;

/**
 * Sync Lat/Lng inputs to Smart Input
 */
function syncGpsInputsFromSplit() {
  const lat = document.getElementById('farm-gps-lat')?.value.trim();
  const lng = document.getElementById('farm-gps-lng')?.value.trim();
  const smart = document.getElementById('farm-gps-smart-input');
  if (smart && lat && lng) {
    smart.value = `${lat}, ${lng}`;
  }
}
window.syncGpsInputsFromSplit = syncGpsInputsFromSplit;

/**
 * Get current device GPS location using HTML5 Geolocation API
 */
function getCurrentDeviceGpsLocation() {
  if (!navigator.geolocation) {
    toast('Trình duyệt hoặc thiết bị không hỗ trợ định vị GPS!', 'error');
    return;
  }

  toast('📡 Đang dò tìm vị trí GPS của thiết bị...', 'info');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracy = Math.round(pos.coords.accuracy || 0);

      if (document.getElementById('farm-gps-lat')) document.getElementById('farm-gps-lat').value = lat.toFixed(6);
      if (document.getElementById('farm-gps-lng')) document.getElementById('farm-gps-lng').value = lng.toFixed(6);
      if (document.getElementById('farm-gps-smart-input')) document.getElementById('farm-gps-smart-input').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

      pingGpsLocationOnMap(lat, lng, `GPS Thiết bị (±${accuracy}m)`);
      toast(`📡 Đã lấy GPS thiết bị: ${lat.toFixed(6)}, ${lng.toFixed(6)} (Độ chính xác: ±${accuracy}m)`, 'success');
    },
    (err) => {
      console.warn('Geolocation error:', err);
      let msg = 'Không thể lấy vị trí GPS hiện tại!';
      if (err.code === 1) msg = 'Bạn đã từ chối quyền truy cập GPS trên trình duyệt.';
      else if (err.code === 2) msg = 'Không tìm thấy tín hiệu vệ tinh GPS.';
      else if (err.code === 3) msg = 'Hết thời gian chờ tín hiệu GPS.';
      toast(msg, 'error');
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}
window.getCurrentDeviceGpsLocation = getCurrentDeviceGpsLocation;

/**
 * Generate a Starter Polygon (~1 hectare / 100m x 100m square) around the GPS point
 */
function generateStarterPolygonAroundGps() {
  let smartVal = document.getElementById('farm-gps-smart-input')?.value.trim();
  let latVal = document.getElementById('farm-gps-lat')?.value.trim();
  let lngVal = document.getElementById('farm-gps-lng')?.value.trim();

  let coords = null;
  if (smartVal) coords = parseGpsCoordinate(smartVal);
  else if (latVal && lngVal) {
    const v1 = parseFloat(latVal);
    const v2 = parseFloat(lngVal);
    if (!isNaN(v1) && !isNaN(v2)) coords = orientVietnamGps(v1, v2);
  }

  if (!coords) {
    toast('Vui lòng nhập hoặc ping tọa độ GPS trước khi tạo khung ranh giới mẫu!', 'error');
    return;
  }

  if (!drawControl) {
    toast('Công cụ vẽ ranh giới chưa sẵn sàng!', 'error');
    return;
  }

  const lat = coords.lat;
  const lng = coords.lng;
  const dLat = 0.00045; // ~50m offset north/south
  const dLng = 0.00045 / Math.cos(lat * Math.PI / 180); // ~50m offset east/west

  const polygonCoordinates = [[
    [lng - dLng, lat + dLat],
    [lng + dLng, lat + dLat],
    [lng + dLng, lat - dLat],
    [lng - dLng, lat - dLat],
    [lng - dLng, lat + dLat]
  ]];

  drawControl.deleteAll();
  const feature = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: polygonCoordinates
    }
  };

  const featureIds = drawControl.add(feature);
  updateAreaDisplay();

  // Fly and fit bounds
  const bounds = new mapboxgl.LngLatBounds();
  polygonCoordinates[0].forEach(pt => bounds.extend(pt));
  gMap.fitBounds(bounds, { padding: 80, maxZoom: 19, duration: 800 });

  // Enable direct select mode so vertices can be immediately dragged
  setTimeout(() => {
    if (featureIds && featureIds.length > 0) {
      try {
        drawControl.changeMode('direct_select', { featureId: featureIds[0] });
      } catch(_) {
        drawControl.changeMode('simple_select');
      }
    }
  }, 200);

  toast('🟩 Đã tạo khung ranh giới mẫu 1 ha quanh tọa độ GPS! Bạn có thể kéo các điểm tròn trắng để khớp với thực tế.', 'success');
}
window.generateStarterPolygonAroundGps = generateStarterPolygonAroundGps;

// ═════════════════════════════════════════════════════════════════════════════
// 📐 MULTI-POINT GPS BOUNDARY IMPORT MODAL CONTROLLERS
// ═════════════════════════════════════════════════════════════════════════════

function openMultiPointGpsModal() {
  const modal = document.getElementById('multi-point-gps-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  if (window.lucide && typeof window.lucide.createIcons === 'function') lucide.createIcons();
}
window.openMultiPointGpsModal = openMultiPointGpsModal;

function closeMultiPointGpsModal() {
  const modal = document.getElementById('multi-point-gps-modal');
  if (modal) modal.style.display = 'none';
}
window.closeMultiPointGpsModal = closeMultiPointGpsModal;

function insertSampleGpsVertices() {
  const textarea = document.getElementById('multi-gps-textarea');
  if (!textarea) return;
  textarea.value = `14.058120, 108.277100\n14.058950, 108.277150\n14.058890, 108.278300\n14.058020, 108.278220`;
}
window.insertSampleGpsVertices = insertSampleGpsVertices;

function submitMultiPointGpsImport() {
  const textarea = document.getElementById('multi-gps-textarea');
  if (!textarea) return;
  const text = textarea.value.trim();
  if (!text) {
    toast('Vui lòng nhập hoặc dán danh sách tọa độ các đỉnh ranh giới!', 'error');
    return;
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const points = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const coords = parseGpsCoordinate(line);
    if (coords) {
      points.push([coords.lng, coords.lat]);
    }
  }

  if (points.length < 3) {
    toast(`Hệ thống chỉ nhận diện được ${points.length} điểm hợp lệ. Cần tối thiểu 3 điểm tọa độ để tạo đa giác ranh giới!`, 'error');
    return;
  }

  // Ensure polygon is closed (first point === last point)
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    points.push([first[0], first[1]]);
  }

  if (!drawControl) {
    toast('Công cụ vẽ ranh giới chưa sẵn sàng!', 'error');
    return;
  }

  drawControl.deleteAll();
  const feature = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [points]
    }
  };

  const featureIds = drawControl.add(feature);
  updateAreaDisplay();

  // Close modal
  closeMultiPointGpsModal();

  // Fit bounds to polygon
  const bounds = new mapboxgl.LngLatBounds();
  points.forEach(pt => bounds.extend(pt));
  gMap.fitBounds(bounds, { padding: 80, maxZoom: 19, duration: 900 });

  // Enable direct select mode
  setTimeout(() => {
    if (featureIds && featureIds.length > 0) {
      try {
        drawControl.changeMode('direct_select', { featureId: featureIds[0] });
      } catch(_) {
        drawControl.changeMode('simple_select');
      }
    }
  }, 200);

  // Sync center to GPS inputs
  const centerLng = (bounds.getWest() + bounds.getEast()) / 2;
  const centerLat = (bounds.getSouth() + bounds.getNorth()) / 2;
  if (document.getElementById('farm-gps-lat')) document.getElementById('farm-gps-lat').value = centerLat.toFixed(6);
  if (document.getElementById('farm-gps-lng')) document.getElementById('farm-gps-lng').value = centerLng.toFixed(6);
  if (document.getElementById('farm-gps-smart-input')) document.getElementById('farm-gps-smart-input').value = `${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}`;

  pingGpsLocationOnMap(centerLat, centerLng, 'Tâm ranh giới vừa nhập');
  toast(`✅ Đã nhập ${points.length - 1} đỉnh GPS và nối thành đa giác ranh giới thành công!`, 'success');
}
window.submitMultiPointGpsImport = submitMultiPointGpsImport;

