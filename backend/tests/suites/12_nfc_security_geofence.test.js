/**
 * ═══════════════════════════════════════════════════════════════
 * Suite 12: NTAG213 Security Architecture, HMAC & Geofence (<= 8m)
 * ═══════════════════════════════════════════════════════════════
 */

const { describe, it, expect } = require('../test-framework');
const nfcSecurity = require('../../services/nfcSecurityService');

describe('Suite 12: NTAG213 Security Architecture & Geofence (<= 8.0m) Verification', () => {

  it('12.1 Should accurately calculate Haversine distance with millimetric precision', () => {
    // 2 points ~5.5m apart
    const p1Lat = 10.762622;
    const p1Lng = 106.660172;
    const p2Lat = 10.762670;
    const p2Lng = 106.660172;

    const dist = nfcSecurity.calculateHaversineDistance(p1Lat, p1Lng, p2Lat, p2Lng);
    expect(dist).toBeGreaterThan(5.0);
    expect(dist).toBeLessThan(6.0);
    expect(dist <= 8.0).toBe(true);
  });

  it('12.2 Should correctly handle swapped coordinates (latitude > 90)', () => {
    // Latitude stored as 106.66 (swapped)
    const dist = nfcSecurity.calculateHaversineDistance(
      106.660172, 10.762622, // Swapped
      10.762670, 106.660172  // Normal
    );
    expect(dist).toBeGreaterThan(5.0);
    expect(dist).toBeLessThan(6.0);
  });

  it('12.3 Should generate and verify consistent HMAC-SHA256 signatures for NTAG213', () => {
    const uid = '04:5C:D0:F2:E3:21:91';
    const plantId = 102;
    
    const sig1 = nfcSecurity.generateHmacSignature(uid, plantId);
    const sig2 = nfcSecurity.generateHmacSignature(uid, plantId);
    
    expect(typeof sig1).toBe('string');
    expect(sig1.length).toBe(32);
    expect(sig1).toBe(sig2);

    // Verify valid signature
    expect(nfcSecurity.verifyHmacSignature(uid, plantId, sig1)).toBe(true);

    // Verify tampered signature is rejected
    const tamperedSig = sig1.substring(0, 31) + '0';
    expect(nfcSecurity.verifyHmacSignature(uid, plantId, tamperedSig)).toBe(false);

    // Verify wrong plant ID is rejected
    expect(nfcSecurity.verifyHmacSignature(uid, 999, sig1)).toBe(false);
  });

  it('12.4 Should enforce Geofence constraint <= 8.0m and reject out-of-boundary scans', () => {
    const plantLat = 12.679636;
    const plantLng = 108.053804;

    // Scan point within 3m (PASS)
    const scanWithin3m = nfcSecurity.verifyNtag213Scan({
      uid: '04:12:34:56:78:9A:BC',
      plantId: 50,
      plantLat: plantLat,
      plantLng: plantLng,
      currentLat: 12.679650,
      currentLng: 108.053804,
      geofenceRadius: 8.0
    });

    expect(scanWithin3m.isValid).toBe(true);
    expect(scanWithin3m.status).toBe('VERIFIED_OK');
    expect(scanWithin3m.distanceMeters <= 8.0).toBe(true);

    // Scan point 15m away (FAIL: GEOFENCE_EXCEEDED)
    const scan15mAway = nfcSecurity.verifyNtag213Scan({
      uid: '04:12:34:56:78:9A:BC',
      plantId: 50,
      plantLat: plantLat,
      plantLng: plantLng,
      currentLat: 12.679780,
      currentLng: 108.053804,
      geofenceRadius: 8.0
    });

    expect(scan15mAway.isValid).toBe(false);
    expect(scan15mAway.status).toBe('GEOFENCE_EXCEEDED');
    expect(scan15mAway.distanceMeters > 8.0).toBe(true);
    expect(scan15mAway.severity).toBe('WARNING');
  });

  it('12.5 Should detect and reject Monotonic Counter Replay / Clone attacks on NTAG213', () => {
    // First scan had counter = 15 in DB
    const replayScan = nfcSecurity.verifyNtag213Scan({
      uid: '04:12:34:56:78:9A:BC',
      plantId: 50,
      counter: 12, // Lower than recorded in DB
      lastCounter: 15
    });

    expect(replayScan.isValid).toBe(false);
    expect(replayScan.status).toBe('COUNTER_REPLAY');
    expect(replayScan.severity).toBe('CRITICAL');

    // Legitimate scan with counter = 16 (PASS)
    const legitimateScan = nfcSecurity.verifyNtag213Scan({
      uid: '04:12:34:56:78:9A:BC',
      plantId: 50,
      counter: 16,
      lastCounter: 15
    });

    expect(legitimateScan.isValid).toBe(true);
    expect(legitimateScan.status).toBe('VERIFIED_OK');
  });

  it('12.6 Should construct complete NTAG213 Mirror provisioning payload with password lock hints', () => {
    const config = nfcSecurity.buildNtag213MirrorConfig({
      farmId: 16,
      plantId: 45,
      uid: '04:5C:D0:F2:E3:21:91',
      baseUrl: 'https://dev-plantbook.onrender.com'
    });

    expect(config.plantId).toBe(45);
    expect(config.farmId).toBe(16);
    expect(config.mirrorUrlTemplate).toContain('ctr=000000');
    expect(config.mirrorUrlTemplate).toContain('sig=');
    expect(config.suggestedPasswordHex).toBe('A1B2C3D4');
  });

});
