const crypto = require('crypto');

const NFC_HMAC_SECRET = process.env.NFC_HMAC_SECRET || 'PlantBook_NTAG213_Sec_2026_TBP';
const DEFAULT_GEOFENCE_RADIUS_METERS = 8.0;

/**
 * Normalizes an NFC UID (e.g. "04:5c:d0:f2:e3:21:91" -> "04:5C:D0:F2:E3:21:91")
 */
function normalizeNfcUid(uid) {
  if (!uid || typeof uid !== 'string') return '';
  const clean = uid.trim().toUpperCase();
  if (clean.includes(':')) {
    return clean.split(':').map(part => part.padStart(2, '0')).join(':');
  }
  // Hex string without colons
  if (/^[0-9A-F]{14}$/i.test(clean)) {
    return clean.match(/.{1,2}/g).join(':').toUpperCase();
  }
  return clean;
}

/**
 * Generates an HMAC-SHA256 signature for NTAG213 provisioning
 * @param {string} uid - Normalized NFC UID
 * @param {string|number} plantId - ID of the assigned plant
 * @param {string} [secret] - Optional secret key override
 * @returns {string} 32-character hex signature
 */
function generateHmacSignature(uid, plantId, secret = NFC_HMAC_SECRET) {
  const normUid = normalizeNfcUid(uid);
  const payload = `${normUid}:${plantId}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex').substring(0, 32);
}

/**
 * Validates whether a provided HMAC signature is authentic
 */
function verifyHmacSignature(uid, plantId, token, secret = NFC_HMAC_SECRET) {
  if (!token || typeof token !== 'string') return false;
  const expected = generateHmacSignature(uid, plantId, secret);
  return crypto.timingSafeEqual(
    Buffer.from(token.toLowerCase()),
    Buffer.from(expected.toLowerCase())
  );
}

/**
 * Calculates Haversine distance in meters between two GPS coordinates
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  let pLat1 = parseFloat(lat1);
  let pLon1 = parseFloat(lon1);
  let pLat2 = parseFloat(lat2);
  let pLon2 = parseFloat(lon2);

  if (isNaN(pLat1) || isNaN(pLon1) || isNaN(pLat2) || isNaN(pLon2)) {
    return null;
  }

  // Handle swapped coordinates (lat > 90)
  if (Math.abs(pLat1) > 90 && Math.abs(pLon1) <= 90) {
    const tmp = pLat1; pLat1 = pLon1; pLon1 = tmp;
  }
  if (Math.abs(pLat2) > 90 && Math.abs(pLon2) <= 90) {
    const tmp = pLat2; pLat2 = pLon2; pLon2 = tmp;
  }

  const R = 6371000; // Earth radius in meters
  const dLat = (pLat2 - pLat1) * (Math.PI / 180);
  const dLon = (pLon2 - pLon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(pLat1 * (Math.PI / 180)) *
    Math.cos(pLat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 100) / 100; // 2 decimal precision
}

/**
 * Full 4-Tier Security Verification Engine for NTAG213 scans
 * @param {Object} params
 * @param {string} params.uid - Scanned NFC UID
 * @param {number|string} params.plantId - Target Plant ID
 * @param {number} [params.counter] - Current scanned counter from NTAG213 Mirror
 * @param {number} [params.lastCounter=0] - Last recorded counter in DB
 * @param {string} [params.token] - Scanned HMAC token
 * @param {number} [params.currentLat] - Latitude where scan occurred
 * @param {number} [params.currentLng] - Longitude where scan occurred
 * @param {number} [params.plantLat] - Ground-truth plant latitude in DB
 * @param {number} [params.plantLng] - Ground-truth plant longitude in DB
 * @param {number} [params.geofenceRadius=8.0] - Allowed tolerance radius in meters
 * @returns {Object} Diagnostic result
 */
function verifyNtag213Scan({
  uid,
  plantId,
  counter,
  lastCounter = 0,
  token,
  currentLat,
  currentLng,
  plantLat,
  plantLng,
  geofenceRadius = DEFAULT_GEOFENCE_RADIUS_METERS
}) {
  const normUid = normalizeNfcUid(uid);
  const maxRadius = parseFloat(geofenceRadius) || DEFAULT_GEOFENCE_RADIUS_METERS;

  // 1. Signature Verification (if token is provided)
  if (token) {
    const isSigValid = verifyHmacSignature(normUid, plantId, token);
    if (!isSigValid) {
      return {
        isValid: false,
        status: 'INVALID_SIGNATURE',
        severity: 'CRITICAL',
        distanceMeters: null,
        message: 'Chữ ký số thẻ NFC không hợp lệ hoặc đã bị thay đổi trái phép!'
      };
    }
  }

  // 2. Monotonic Counter Verification (Replay / Clone Attack prevention)
  const scannedCounter = counter !== undefined && counter !== null ? parseInt(counter, 10) : null;
  const recordedLastCounter = parseInt(lastCounter, 10) || 0;

  if (scannedCounter !== null && !isNaN(scannedCounter) && recordedLastCounter > 0) {
    if (scannedCounter <= recordedLastCounter) {
      return {
        isValid: false,
        status: 'COUNTER_REPLAY',
        severity: 'CRITICAL',
        distanceMeters: null,
        scannedCounter,
        lastCounter: recordedLastCounter,
        message: `Phát hiện bộ đếm quét lặp (${scannedCounter} <= ${recordedLastCounter}). Thẻ có thể bị nhân bản (Cloned) hoặc gửi lại link cũ (Replay Attack)!`
      };
    }
  }

  // 3. Geofence Distance Cross-Verification (Spatial constraint <= 8.0m)
  const distance = calculateHaversineDistance(currentLat, currentLng, plantLat, plantLng);

  if (distance !== null) {
    if (distance > maxRadius) {
      return {
        isValid: false,
        status: 'GEOFENCE_EXCEEDED',
        severity: 'WARNING',
        distanceMeters: distance,
        maxRadius,
        message: `Vị trí quét cách gốc cây ${distance}m, vượt quá bán kính quy định (≤ ${maxRadius}m). Vui lòng tiến lại gần gốc cây!`
      };
    }
  }

  // All checks passed
  return {
    isValid: true,
    status: 'VERIFIED_OK',
    severity: 'INFO',
    distanceMeters: distance,
    scannedCounter: scannedCounter !== null ? scannedCounter : recordedLastCounter + 1,
    maxRadius,
    message: distance !== null 
      ? `Xác thực an toàn thành công! (Vị trí cách gốc cây ${distance}m ≤ ${maxRadius}m)`
      : 'Xác thực an toàn thành công!'
  };
}

/**
 * Builds recommended NTAG213 NDEF Mirror Configuration
 */
function buildNtag213MirrorConfig({ farmId, plantId, uid, baseUrl = 'https://plant-book.onrender.com' }) {
  const normUid = normalizeNfcUid(uid);
  const token = generateHmacSignature(normUid, plantId);
  const hexUid = normUid.replaceAll(':', '').toUpperCase();
  
  // NTAG213 NDEF Mirror URL template
  // xxxxxxxx = 14 hex UID placeholder, 000000 = 6 hex counter placeholder
  const mirrorUrlTemplate = `${baseUrl}/${farmId || 0}/${plantId}/${hexUid}?ctr=000000&sig=${token}`;
  
  return {
    plantId,
    farmId,
    nfcUid: normUid,
    hmacSignature: token,
    mirrorUrlTemplate,
    suggestedPasswordHex: 'A1B2C3D4', // Default 32-bit hardware password
    suggestedPackHex: '9E01',
    instructions: {
      step1: 'Nạp URL vào bản ghi NDEF Type URI của thẻ NTAG213',
      step2: 'Bật tính năng ASCII Mirroring (UID mirror offset và Counter mirror offset)',
      step3: 'Kích hoạt Password Write Protection với mã PWD'
    }
  };
}

/**
 * Sanitizes and normalizes an NFC UID
 */
function sanitizeUid(uid) {
  if (!uid || typeof uid !== 'string') return '';
  return normalizeNfcUid(uid);
}

module.exports = {
  normalizeNfcUid,
  sanitizeUid,
  generateHmacSignature,
  verifyHmacSignature,
  calculateHaversineDistance,
  verifyNtag213Scan,
  buildNtag213MirrorConfig,
  DEFAULT_GEOFENCE_RADIUS_METERS
};
