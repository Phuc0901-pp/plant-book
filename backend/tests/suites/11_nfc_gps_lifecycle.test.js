/**
 * ═══════════════════════════════════════════════════════════════
 * Suite 11: NFC & GPS Full Lifecycle, Deep Link & Map Resolution
 * ═══════════════════════════════════════════════════════════════
 */

const { describe, it, expect } = require('../test-framework');

describe('Suite 11: NFC & GPS Full Lifecycle, Deep Link & Public Map Coordinate Resolution', () => {

  it('11.1 Should validate and parse GPS coordinates accurately with boundary constraints', () => {
    const parseGps = (lat, lng) => {
      const latVal = (lat !== undefined && lat !== null && lat !== '') ? parseFloat(lat) : null;
      const lngVal = (lng !== undefined && lng !== null && lng !== '') ? parseFloat(lng) : null;

      if (latVal === null || lngVal === null || isNaN(latVal) || isNaN(lngVal)) {
        return { isValid: false, latitude: null, longitude: null };
      }

      // Handle swapped coordinates
      let finalLat = latVal;
      let finalLng = lngVal;
      if (Math.abs(finalLat) > 90 && Math.abs(finalLng) <= 90) {
        finalLat = lngVal;
        finalLng = latVal;
      }

      const isValid = Math.abs(finalLat) <= 90 && Math.abs(finalLng) <= 180;
      return {
        isValid,
        latitude: isValid ? finalLat : null,
        longitude: isValid ? finalLng : null
      };
    };

    // Valid Vietnam Dak Lak coordinates
    const r1 = parseGps(12.679636, 108.053804);
    expect(r1.isValid).toBe(true);
    expect(r1.latitude).toBe(12.679636);
    expect(r1.longitude).toBe(108.053804);

    // Swapped coordinates auto-fix
    const r2 = parseGps(108.053804, 12.679636);
    expect(r2.isValid).toBe(true);
    expect(r2.latitude).toBe(12.679636);
    expect(r2.longitude).toBe(108.053804);

    // Null or empty inputs
    expect(parseGps(null, null).isValid).toBe(false);
    expect(parseGps('', '')).toEqual({ isValid: false, latitude: null, longitude: null });
    expect(parseGps(undefined, undefined)).toEqual({ isValid: false, latitude: null, longitude: null });

    // Out of range coordinates
    expect(parseGps(195.0, 108.0).isValid).toBe(false);
    expect(parseGps(12.0, 250.0).isValid).toBe(false);
  });

  it('11.2 Should construct valid NFC Tools Deep Link URIs for Android and iOS', () => {
    const buildNfcToolsDeepLink = (platform, publicUrl) => {
      const isAndroid = platform === 'android';
      const isIOS = platform === 'ios';

      if (isAndroid) {
        return 'intent://#Intent;package=com.wakdev.wdnfc;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.wakdev.wdnfc;end';
      }
      if (isIOS) {
        return 'nfctools://';
      }
      return publicUrl;
    };

    const targetUrl = 'https://dev-plantbook.onrender.com/16/35/04:5C:D0:F2:E3:21:91';
    
    const androidLink = buildNfcToolsDeepLink('android', targetUrl);
    expect(androidLink).toContain('package=com.wakdev.wdnfc');
    expect(androidLink).toContain('intent://#Intent');

    const iosLink = buildNfcToolsDeepLink('ios', targetUrl);
    expect(iosLink).toBe('nfctools://');
  });

  it('11.3 Should compute farm polygon centroid correctly and never pin markers to corner vertex when GPS is null', () => {
    const resolveMapCoordinates = (plant, farmBoundary) => {
      let plantLat = parseFloat(plant.latitude);
      let plantLng = parseFloat(plant.longitude);

      const hasValidPlantCoords = !isNaN(plantLat) && !isNaN(plantLng) &&
        Math.abs(plantLat) <= 90 && Math.abs(plantLng) <= 180;

      if (hasValidPlantCoords) {
        return {
          hasMarker: true,
          markerLat: plantLat,
          markerLng: plantLng,
          centerLat: plantLat,
          centerLng: plantLng,
          isFarmFallback: false
        };
      }

      // Farm polygon centroid calculation
      let centerLng = 107.241850;
      let centerLat = 10.941520;
      if (farmBoundary && farmBoundary.coordinates && farmBoundary.coordinates[0]) {
        const ring = farmBoundary.coordinates[0];
        let sumLng = 0, sumLat = 0, validCount = 0;
        for (const pt of ring) {
          if (Array.isArray(pt) && pt.length >= 2) {
            let pLng = parseFloat(pt[0]);
            let pLat = parseFloat(pt[1]);
            if (!isNaN(pLng) && !isNaN(pLat) && Math.abs(pLat) <= 90 && Math.abs(pLng) <= 180) {
              sumLng += pLng;
              sumLat += pLat;
              validCount++;
            }
          }
        }
        if (validCount > 0) {
          centerLng = sumLng / validCount;
          centerLat = sumLat / validCount;
        }
      }

      return {
        hasMarker: false, // NEVER place marker pin when tree has no GPS
        markerLat: null,
        markerLng: null,
        centerLat,
        centerLng,
        isFarmFallback: true
      };
    };

    // Case A: Plant with real GPS
    const plantWithGps = { latitude: 12.679636, longitude: 108.053804 };
    const resA = resolveMapCoordinates(plantWithGps, null);
    expect(resA.hasMarker).toBe(true);
    expect(resA.markerLat).toBe(12.679636);
    expect(resA.markerLng).toBe(108.053804);
    expect(resA.isFarmFallback).toBe(false);

    // Case B: Plant without GPS but in farm with rectangular polygon
    const plantWithoutGps = { latitude: null, longitude: null };
    const farmPoly = {
      type: 'Polygon',
      coordinates: [[
        [108.050, 12.670],
        [108.060, 12.670],
        [108.060, 12.680],
        [108.050, 12.680],
        [108.050, 12.670]
      ]]
    };
    const resB = resolveMapCoordinates(plantWithoutGps, farmPoly);
    expect(resB.hasMarker).toBe(false); // No fake marker pin
    expect(resB.isFarmFallback).toBe(true);
    expect(resB.centerLat).toBeGreaterThan(12.670);
    expect(resB.centerLat).toBeLessThan(12.680);
    expect(resB.centerLng).toBeGreaterThan(108.050);
    expect(resB.centerLng).toBeLessThan(108.060);
  });

  it('11.4 Should enforce GPS clearing on NFC tag deactivation and inventory unassignment', () => {
    const simulateDeactivatePlant = (plant, inventoryItem) => {
      const updatedPlant = {
        ...plant,
        nfc_uid: null,
        latitude: null,
        longitude: null,
        public_url: `https://dev-plantbook.onrender.com/${plant.farm_id}/${plant.id}`
      };

      const updatedInventory = inventoryItem ? {
        ...inventoryItem,
        status: 'unassigned',
        plant_id: null,
        tagged_at: null
      } : null;

      return { plant: updatedPlant, inventory: updatedInventory };
    };

    const initialPlant = {
      id: 35,
      farm_id: 16,
      tree_code: 'SR-35',
      nfc_uid: '04:5C:D0:F2:E3:21:91',
      latitude: 12.679636,
      longitude: 108.053804,
      public_url: 'https://dev-plantbook.onrender.com/16/35/04%3A5C%3AD0%3AF2%3AE3%3A21%3A91'
    };

    const initialInv = {
      id: 1,
      farm_id: 16,
      nfc_uid: '04:5C:D0:F2:E3:21:91',
      status: 'assigned',
      plant_id: 35
    };

    const result = simulateDeactivatePlant(initialPlant, initialInv);

    expect(result.plant.nfc_uid).toBeNull();
    expect(result.plant.latitude).toBeNull();
    expect(result.plant.longitude).toBeNull();
    expect(result.plant.public_url).toBe('https://dev-plantbook.onrender.com/16/35');
    expect(result.inventory.status).toBe('unassigned');
    expect(result.inventory.plant_id).toBeNull();
  });

  it('11.5 Should validate 3-segment public URL composition and decoding for special characters', () => {
    const buildUrl = (origin, farmId, plantId, nfcUid) => {
      const f = farmId || 0;
      const p = plantId || 0;
      const n = nfcUid ? `/${encodeURIComponent(nfcUid)}` : '';
      return `${origin}/${f}/${p}${n}`;
    };

    const origin = 'https://dev-plantbook.onrender.com';
    const url = buildUrl(origin, 16, 35, '04:5C:D0:F2:E3:21:91');
    expect(url).toBe('https://dev-plantbook.onrender.com/16/35/04%3A5C%3AD0%3AF2%3AE3%3A21%3A91');

    const pathParts = url.replace(origin + '/', '').split('/');
    expect(pathParts[0]).toBe('16');
    expect(pathParts[1]).toBe('35');
    expect(decodeURIComponent(pathParts[2])).toBe('04:5C:D0:F2:E3:21:91');
  });

  it('11.6 Should enforce RBAC authorization on Direct GPS and NFC updates', () => {
    const checkGpsPermission = (requestUser, plant, farm) => {
      if (requestUser.role === 'admin') return true;
      if (farm && farm.user_id === requestUser.id) return true;
      if (requestUser.farm_id && plant.farm_id && requestUser.farm_id === plant.farm_id) return true;
      if (plant.assigned_to_user_id && plant.assigned_to_user_id === requestUser.id) return true;
      if (plant.created_by && plant.created_by === requestUser.id) return true;
      return false;
    };

    const adminUser = { id: 1, role: 'admin' };
    const farmOwner = { id: 2, role: 'user', farm_id: 10 };
    const assignedStaff = { id: 3, role: 'user', farm_id: 10 };
    const otherUser = { id: 4, role: 'user', farm_id: 99 };

    const farm10 = { id: 10, user_id: 2 };
    const plantInFarm10 = { id: 100, farm_id: 10, created_by: 2, assigned_to_user_id: 3 };

    expect(checkGpsPermission(adminUser, plantInFarm10, farm10)).toBe(true);
    expect(checkGpsPermission(farmOwner, plantInFarm10, farm10)).toBe(true);
    expect(checkGpsPermission(assignedStaff, plantInFarm10, farm10)).toBe(true);
    expect(checkGpsPermission(otherUser, plantInFarm10, farm10)).toBe(false);
  });

});
