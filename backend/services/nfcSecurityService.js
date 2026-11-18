const crypto = require('crypto');

const NFC_HMAC_SECRET = process.env.NFC_HMAC_SECRET || 'PlantBook_NTAG213_Sec_2026_TBP';
const DEFAULT_GEOFENCE_RADIUS_METERS = 8.0;

function normalizeNfcUid(uid) {
  if (!uid || typeof uid !== 'string') return '';
  const clean = uid.trim().toUpperCase();
  if (clean.includes(':')) {
    return clean.split(':').map(part => part.padStart(2, '0')).join(':');
  }
  if (/^[0-9A-F]{14}$/i.test(clean)) {
    return clean.match(/.{1,2}/g).join(':').toUpperCase();
  }
  return clean;
}

function generateHmacSignature(uid, plantId, secret = NFC_HMAC_SECRET) {
  const normUid = normalizeNfcUid(uid);
  const payload = `${normUid}:${plantId}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex').substring(0, 32);
}

function verifyHmacSignature(uid, plantId, token, secret = NFC_HMAC_SECRET) {
  if (!token || typeof token !== 'string') return false;
  const expected = generateHmacSignature(uid, plantId, secret);
  return crypto.timingSafeEqual(
    Buffer.from(token.toLowerCase()),
    Buffer.from(expected.toLowerCase())
  );
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  let pLat1 = parseFloat(lat1);
  let pLon1 = parseFloat(lon1);
  let pLat2 = parseFloat(lat2);
  let pLon2 = parseFloat(lon2);

  if (isNaN(pLat1) || isNaN(pLon1) || isNaN(pLat2) || isNaN(pLon2)) {
    return null;
  }

  if (Math.abs(pLat1) > 90 && Math.abs(pLon1) <= 90) {
    const tmp = pLat1; pLat1 = pLon1; pLon1 = tmp;
  }
  if (Math.abs(pLat2) > 90 && Math.abs(pLon2) <= 90) {
    const tmp = pLat2; pLat2 = pLon2; pLon2 = tmp;
  }

  const R = 6371000;
  const dLat = (pLat2 - pLat1) * (Math.PI / 180);
  const dLon = (pLon2 - pLon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(pLat1 * (Math.PI / 180)) *
    Math.cos(pLat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 100) / 100;
}

function verifyNtag213Scan({
  uid,
  plantId,
  counter,
  lastCounter = 0,
  issueLevel,
  expectedIssueLevel = 1,
  token,
  currentLat,
  currentLng,
  plantLat,
  plantLng,
  geofenceRadius = DEFAULT_GEOFENCE_RADIUS_METERS
}) {
  const normUid = normalizeNfcUid(uid);
  const maxRadius = parseFloat(geofenceRadius) || DEFAULT_GEOFENCE_RADIUS_METERS;

  if (issueLevel !== undefined && issueLevel !== null && expectedIssueLevel !== undefined && expectedIssueLevel !== null) {
    const scannedIssue = parseInt(issueLevel, 10);
    const activeIssue = parseInt(expectedIssueLevel, 10) || 1;
    if (!isNaN(scannedIssue) && scannedIssue < activeIssue) {
      return {
        isValid: false,
        status: 'REVOKED_ISSUE_LEVEL',
        severity: 'CRITICAL',
        distanceMeters: null,
        issueLevel: scannedIssue,
        expectedIssueLevel: activeIssue,
        message: `Thẻ RFID/NFC này thuộc cấp phát hành cũ (IssueLevel ${scannedIssue} < ${activeIssue}) và đã bị thu hồi!`
      };
    }
  }

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

  return {
    isValid: true,
    status: 'VERIFIED_OK',
    severity: 'INFO',
    distanceMeters: distance,
    scannedCounter: scannedCounter !== null ? scannedCounter : recordedLastCounter + 1,
    issueLevel: parseInt(expectedIssueLevel, 10) || 1,
    maxRadius,
    message: distance !== null
      ? `Xác thực an toàn thành công! (Vị trí cách gốc cây ${distance}m ≤ ${maxRadius}m)`
      : 'Xác thực an toàn thành công!'
  };
}

function generatePivChuidHash(uid, plantId, issueLevel = 1) {
  const normUid = normalizeNfcUid(uid);
  const payload = `PIV_CHUID:${normUid}:PLANT:${plantId}:ISSUE:${issueLevel}`;
  return crypto.createHmac('sha256', NFC_HMAC_SECRET).update(payload).digest('hex');
}

function buildNtag213MirrorConfig({ farmId, plantId, uid, issueLevel = 1, baseUrl = 'https://plant-book.onrender.com' }) {
  const normUid = normalizeNfcUid(uid);
  const token = generateHmacSignature(normUid, plantId);
  const chuidHash = generatePivChuidHash(normUid, plantId, issueLevel);
  const hexUid = normUid.replaceAll(':', '').toUpperCase();

  const mirrorUrlTemplate = `${baseUrl}/${farmId || 0}/${plantId}/${hexUid}?ctr=000000&il=${issueLevel}&sig=${token}`;

  return {
    plantId,
    farmId,
    nfcUid: normUid,
    issueLevel,
    chuidHash,
    hmacSignature: token,
    mirrorUrlTemplate,
    suggestedPasswordHex: 'A1B2C3D4',
    suggestedPackHex: '9E01',
    instructions: {
      step1: 'Nạp URL vào bản ghi NDEF Type URI của thẻ NTAG213',
      step2: 'Bật tính năng ASCII Mirroring (UID mirror offset và Counter mirror offset)',
      step3: 'Kích hoạt Password Write Protection với mã PWD'
    }
  };
}

function sanitizeUid(uid) {
  if (!uid || typeof uid !== 'string') return '';
  return normalizeNfcUid(uid);
}

module.exports = {
  normalizeNfcUid,
  sanitizeUid,
  generateHmacSignature,
  verifyHmacSignature,
  generatePivChuidHash,
  calculateHaversineDistance,
  verifyNtag213Scan,
  buildNtag213MirrorConfig,
  DEFAULT_GEOFENCE_RADIUS_METERS
};
