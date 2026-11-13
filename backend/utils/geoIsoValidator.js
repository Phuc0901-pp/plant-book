/* ═══════════════════════════════════════════════════════════════
   Plant Book – ISO 19111 / ISO 19115 / ISO 19157 / RFC 7946 Validator
   Chuẩn hóa & kiểm định gói dữ liệu GPS / GIS trước khi ghi Database
   ═══════════════════════════════════════════════════════════════ */

const WGS84_SRID = 4326;
const WGS84_CRS_URN = 'urn:ogc:def:crs:EPSG::4326';

function toFiniteNumber(val) {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : NaN;
}

/**
 * Chuẩn hóa & kiểm định gói tọa độ GPS theo:
 * - ISO 19111 (Spatial Referencing by Coordinates — WGS 84 / EPSG:4326)
 * - ISO 19115 / ISO 19157 (Data Quality: accuracy, altitude, captured_at ISO 8601 UTC)
 * Hỗ trợ tương thích ngược cả payload phẳng và nested `body.gps`.
 */
function normalizeGpsPayload(body = {}) {
  const src = body && typeof body === 'object' ? body : {};
  const gps = src.gps && typeof src.gps === 'object' ? src.gps : {};

  const rawLat = gps.latitude ?? src.latitude ?? src.lat;
  const rawLng = gps.longitude ?? src.longitude ?? src.lng ?? src.lon;
  const rawAcc = gps.accuracy ?? gps.gps_accuracy ?? src.gps_accuracy ?? src.accuracy;
  const rawAlt = gps.altitude ?? gps.gps_altitude ?? src.gps_altitude ?? src.altitude;
  const rawCapturedAt = gps.captured_at ?? gps.gps_captured_at ?? src.gps_captured_at ?? src.captured_at;
  const rawSrid = gps.srid ?? gps.gps_srid ?? src.gps_srid ?? src.srid;

  const latitude = toFiniteNumber(rawLat);
  const longitude = toFiniteNumber(rawLng);
  const gps_accuracy = toFiniteNumber(rawAcc);
  const gps_altitude = toFiniteNumber(rawAlt);
  const gps_srid = rawSrid !== undefined && rawSrid !== null && rawSrid !== ''
    ? parseInt(rawSrid, 10)
    : WGS84_SRID;

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return { valid: false, error: 'Tọa độ GPS không hợp lệ (latitude/longitude phải là số thực).' };
  }

  if ((latitude !== null && longitude === null) || (latitude === null && longitude !== null)) {
    return { valid: false, error: 'Thiếu cặp tọa độ đầy đủ (cần cả latitude và longitude).' };
  }

  if (latitude !== null && (latitude < -90 || latitude > 90)) {
    return { valid: false, error: 'Vĩ độ (latitude) vượt ngưỡng WGS 84 [-90, 90].' };
  }

  if (longitude !== null && (longitude < -180 || longitude > 180)) {
    return { valid: false, error: 'Kinh độ (longitude) vượt ngưỡng WGS 84 [-180, 180].' };
  }

  if (Number.isNaN(gps_accuracy) || (gps_accuracy !== null && gps_accuracy < 0)) {
    return { valid: false, error: 'Sai số GPS (gps_accuracy) phải >= 0 mét theo chuẩn ISO 19157.' };
  }

  if (Number.isNaN(gps_altitude)) {
    return { valid: false, error: 'Cao độ GPS (gps_altitude) không hợp lệ.' };
  }

  if (!Number.isInteger(gps_srid) || gps_srid !== WGS84_SRID) {
    return { valid: false, error: `Hệ quy chiếu không được hỗ trợ (yêu cầu EPSG:${WGS84_SRID} / WGS 84).` };
  }

  let gps_captured_at = null;
  if (rawCapturedAt !== undefined && rawCapturedAt !== null && rawCapturedAt !== '') {
    const parsedDate = new Date(rawCapturedAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return { valid: false, error: 'Thời gian chốt vệ tinh (gps_captured_at) phải đúng chuẩn ISO 8601.' };
    }
    gps_captured_at = parsedDate.toISOString();
  } else if (latitude !== null && longitude !== null) {
    gps_captured_at = new Date().toISOString();
  }

  return {
    valid: true,
    hasCoordinates: latitude !== null && longitude !== null,
    data: {
      latitude,
      longitude,
      gps_accuracy,
      gps_altitude,
      gps_captured_at,
      gps_srid,
      crs: WGS84_CRS_URN,
    },
  };
}

/**
 * Kiểm định ranh giới nông trại theo GeoJSON RFC 7946 hoặc mảng tọa độ legacy.
 */
function validateGeoJsonPolygon(input) {
  if (input === undefined || input === null || input === '') {
    return { valid: true, value: null };
  }

  let parsed = input;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch {
      return { valid: false, error: 'polygon_coordinates không phải JSON hợp lệ.' };
    }
  }

  // Case 1: GeoJSON Polygon (RFC 7946)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    if (parsed.type !== 'Polygon' || !Array.isArray(parsed.coordinates) || parsed.coordinates.length === 0) {
      return { valid: false, error: 'GeoJSON phải có type="Polygon" và coordinates hợp lệ theo RFC 7946.' };
    }
    const ring = parsed.coordinates[0];
    if (!Array.isArray(ring) || ring.length < 4) {
      return { valid: false, error: 'GeoJSON Polygon LinearRing phải có tối thiểu 4 điểm (điểm đầu = điểm cuối).' };
    }
    for (const pt of ring) {
      if (!Array.isArray(pt) || pt.length < 2) {
        return { valid: false, error: 'Mỗi đỉnh GeoJSON Polygon phải có dạng [longitude, latitude].' };
      }
      const [lng, lat] = pt.map(Number);
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return { valid: false, error: 'Đỉnh GeoJSON Polygon vượt ngưỡng WGS 84 (lng [-180,180], lat [-90,90]).' };
      }
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (Number(first[0]) !== Number(last[0]) || Number(first[1]) !== Number(last[1])) {
      return { valid: false, error: 'GeoJSON Polygon LinearRing chưa khép kín (điểm đầu phải trùng điểm cuối theo RFC 7946).' };
    }
    return { valid: true, format: 'geojson', value: parsed };
  }

  // Case 2: Legacy coordinate array ([[lat, lng], ...] or [{lat, lng}, ...])
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return { valid: true, format: 'legacy_empty', value: [] };
    }
    for (const pt of parsed) {
      let lat;
      let lng;
      if (Array.isArray(pt) && pt.length >= 2) {
        lat = Number(pt[0]);
        lng = Number(pt[1]);
      } else if (pt && typeof pt === 'object') {
        lat = Number(pt.lat ?? pt.latitude);
        lng = Number(pt.lng ?? pt.lon ?? pt.longitude);
      } else {
        return { valid: false, error: 'Phần tử tọa độ trong polygon_coordinates không hợp lệ.' };
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return { valid: false, error: 'Tọa độ trong polygon_coordinates vượt ngưỡng WGS 84.' };
      }
    }
    return { valid: true, format: 'legacy_array', value: parsed };
  }

  return { valid: false, error: 'Định dạng polygon_coordinates không được hỗ trợ.' };
}

module.exports = {
  WGS84_SRID,
  WGS84_CRS_URN,
  normalizeGpsPayload,
  validateGeoJsonPolygon,
};
