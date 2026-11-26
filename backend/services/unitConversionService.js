function convertAmountToBaseUnit(amount, inputUnit, baseUnit, logType = '') {
  const qty = parseFloat(amount);
  if (!Number.isFinite(qty) || qty <= 0) return 0;

  const from = String(inputUnit || '').toLowerCase().trim();
  const to = String(baseUnit || 'kg').toLowerCase().trim();
  const lt = String(logType || '').toLowerCase().trim();

  if (lt === 'tưới nước' || from === 'lít' || from === 'l' || from === 'lit') {
    if (to === 'm3' || to === 'm³' || to === 'khối') {
      if (from === 'm3' || from === 'm³' || from === 'khối') return qty;
      return qty / 1000;
    }
    if (to === 'ml') return qty * 1000;
    return qty;
  }

  if (from === to || !from) return qty;

  if ((from === 'g' || from === 'gam' || from === 'gr' || from === 'gram') && to === 'kg') {
    return qty / 1000;
  }
  if (from === 'kg' && (to === 'g' || to === 'gam' || to === 'gr' || to === 'gram')) {
    return qty * 1000;
  }
  if ((from === 'tấn' || from === 'tan' || from === 'ton') && to === 'kg') {
    return qty * 1000;
  }
  if (from === 'kg' && (to === 'tấn' || to === 'tan' || to === 'ton')) {
    return qty / 1000;
  }
  if (from === 'ml' && (to === 'l' || to === 'lít' || to === 'lit')) {
    return qty / 1000;
  }
  if ((from === 'l' || from === 'lít' || from === 'lit') && to === 'ml') {
    return qty * 1000;
  }
  if (from === 'ml' && (to === 'm3' || to === 'm³' || to === 'khối')) {
    return qty / 1000000;
  }

  return qty;
}

function normalizeAreaToSquareMeters(areaValue, unit = 'm2') {
  const num = parseFloat(areaValue);
  if (!Number.isFinite(num) || num <= 0) return 0;
  const u = String(unit || 'm2').toLowerCase().trim();
  if (u === 'ha' || u === 'hecta' || u === 'hectare') return num * 10000;
  if (u === 'sào' || u === 'sao') return num * 1000;
  if (u === 'công' || u === 'cong') return num * 1000;
  return num;
}

function computePolygonAreaM2(rawCoords) {
  let coords = [];
  try {
    coords = typeof rawCoords === 'string' ? JSON.parse(rawCoords) : (rawCoords || []);
  } catch (_) {
    return 0;
  }

  while (Array.isArray(coords) && coords.length > 0 && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
    coords = coords[0];
  }
  if (!Array.isArray(coords) || coords.length < 3) return 0;

  const ring = [];
  coords.forEach(pt => {
    if (Array.isArray(pt) && pt.length >= 2) {
      const v1 = parseFloat(pt[0]);
      const v2 = parseFloat(pt[1]);
      if (Number.isFinite(v1) && Number.isFinite(v2)) {
        const lng = v1 > 50 ? v1 : v2;
        const lat = v2 < 50 ? v2 : v1;
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          ring.push([lng, lat]);
        }
      }
    }
  });

  if (ring.length < 3) return 0;
  const meanLatRad = (ring.reduce((acc, p) => acc + p[1], 0) / ring.length) * (Math.PI / 180);
  const metersPerDegLat = 111132.92;
  const metersPerDegLng = 111412.84 * Math.cos(meanLatRad);

  let area2 = 0;
  for (let i = 0; i < ring.length; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % ring.length];
    const x1 = p1[0] * metersPerDegLng;
    const y1 = p1[1] * metersPerDegLat;
    const x2 = p2[0] * metersPerDegLng;
    const y2 = p2[1] * metersPerDegLat;
    area2 += (x1 * y2) - (x2 * y1);
  }
  return Math.round(Math.abs(area2) / 2);
}

function auditAndNormalizeFarmArea(farm, plantCount = 0) {
  const rawArea = parseFloat(farm && farm.area) || 0;
  const polyAreaM2 = computePolygonAreaM2(farm && farm.polygon_coordinates);
  const trees = Math.max(0, parseInt(plantCount, 10) || 0);

  let normalizedM2 = rawArea;
  let status = 'OK';

  if (rawArea > 0 && rawArea <= 50 && (polyAreaM2 <= 0 || polyAreaM2 >= 500)) {
    normalizedM2 = Math.round(rawArea * 10000);
    status = 'ENTERED_IN_HA';
  } else if (rawArea > 5000000 && ((polyAreaM2 > 0 && polyAreaM2 < rawArea / 5) || (trees > 0 && trees < 500))) {
    normalizedM2 = polyAreaM2 > 10 ? Math.round(polyAreaM2) : Math.round(trees * 64);
    status = 'OUTLIER_HUGE_AREA';
  } else if (rawArea <= 0 && polyAreaM2 >= 10) {
    normalizedM2 = Math.round(polyAreaM2);
    status = 'MISSING_AREA_FROM_POLYGON';
  }

  return {
    rawArea,
    normalizedM2,
    normalizedHa: Number((normalizedM2 / 10000).toFixed(4)),
    polyAreaM2: Math.round(polyAreaM2),
    status,
    anomaly: status !== 'OK'
  };
}

module.exports = {
  convertAmountToBaseUnit,
  normalizeAreaToSquareMeters,
  computePolygonAreaM2,
  auditAndNormalizeFarmArea
};
