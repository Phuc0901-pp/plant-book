const { describe, it, expect } = require('../test-framework');

describe('Suite 2: Farms Management, GIS Spatial Algorithms & VietGAP PUC Code', () => {

  // Algorithmic helper for Polygon Area (Shoelace Formula on Geodesic planar projection)
  function calculatePolygonArea(coords) {
    if (!Array.isArray(coords) || coords.length < 3) return 0;
    
    // Convert Lng/Lat to meters using Spherical Earth approximation
    const R = 6378137; // Earth radius in meters
    let area = 0;
    const len = coords.length;

    for (let i = 0; i < len; i++) {
      const p1 = coords[i];
      const p2 = coords[(i + 1) % len];
      const x1 = (p1[0] * Math.PI / 180) * R * Math.cos((p1[1] * Math.PI / 180));
      const y1 = (p1[1] * Math.PI / 180) * R;
      const x2 = (p2[0] * Math.PI / 180) * R * Math.cos((p2[1] * Math.PI / 180));
      const y2 = (p2[1] * Math.PI / 180) * R;
      area += (x1 * y2 - x2 * y1);
    }

    return Math.abs(area / 2);
  }

  function calculateSegmentLength(p1, p2) {
    const R = 6371e3; // metres
    const phi1 = p1[1] * Math.PI / 180;
    const phi2 = p2[1] * Math.PI / 180;
    const deltaPhi = (p2[1] - p1[1]) * Math.PI / 180;
    const deltaLambda = (p2[0] - p1[0]) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  it('2.1 Should validate farm polygon coordinates array structure', () => {
    const validPolygon = [
      [107.12345, 11.54321],
      [107.12500, 11.54321],
      [107.12500, 11.54500],
      [107.12345, 11.54500]
    ];

    expect(Array.isArray(validPolygon)).toBe(true);
    expect(validPolygon.length).toBeGreaterThanOrEqual(3);
    validPolygon.forEach(pt => {
      expect(pt.length).toBe(2);
      expect(typeof pt[0]).toBe('number'); // Lng
      expect(typeof pt[1]).toBe('number'); // Lat
      expect(pt[0]).toBeGreaterThan(-180);
      expect(pt[0]).toBeLessThan(180);
      expect(pt[1]).toBeGreaterThan(-90);
      expect(pt[1]).toBeLessThan(90);
    });
  });

  it('2.2 Should compute farm area in square meters and convert accurately to hectares', () => {
    // 100m x 100m approximate square bounding box
    const testFarmCoords = [
      [107.0000, 11.0000],
      [107.0010, 11.0000],
      [107.0010, 11.0010],
      [107.0000, 11.0010]
    ];

    const areaM2 = calculatePolygonArea(testFarmCoords);
    expect(areaM2).toBeGreaterThan(10000); // approx > 1 hectare
    
    const areaHa = areaM2 / 10000;
    expect(areaHa).toBeGreaterThan(1.0);
  });

  it('2.3 Should compute perimeter and boundary edge distances accurately', () => {
    const p1 = [107.0000, 11.0000];
    const p2 = [107.0010, 11.0000];

    const distanceMeters = calculateSegmentLength(p1, p2);
    expect(distanceMeters).toBeGreaterThan(100);
    expect(distanceMeters).toBeLessThan(120); // ~109m at latitude 11 deg
  });

  it('2.4 Should validate and format VietGAP Production Unit Code (PUC Code)', () => {
    const validatePucCode = (code) => {
      if (!code) return false;
      // VietGAP PUC format e.g. VN-DL-00124, VN-BP-0089, VN-TB-01
      const pucRegex = /^[A-Z]{2}-[A-Z]{2,4}-[0-9A-Za-z]+$/;
      return pucRegex.test(code.trim().toUpperCase());
    };

    expect(validatePucCode('VN-DL-00124')).toBe(true);
    expect(validatePucCode('VN-BP-0056')).toBe(true);
    expect(validatePucCode('VN-TB-01')).toBe(true);
    expect(validatePucCode('invalid_code_without_hyphen')).toBe(false);
    expect(validatePucCode('123-456')).toBe(false);
  });

  it('2.5 Should sanitize farm properties before storage', () => {
    const rawFarmData = {
      name: '  Nông Trại Sầu Riêng Đắk Lắk  ',
      description: 'Vườn canh tác theo tiêu chuẩn VietGAP',
      puc_code: ' vn-dl-00124 ',
      vietgap_cert_number: ' VG-2026-88 ',
      vietgap_cert_org: ' Quacert '
    };

    const sanitized = {
      name: rawFarmData.name.trim(),
      description: rawFarmData.description ? rawFarmData.description.trim() : null,
      puc_code: rawFarmData.puc_code ? rawFarmData.puc_code.trim().toUpperCase() : 'VN-TB',
      vietgap_cert_number: rawFarmData.vietgap_cert_number ? rawFarmData.vietgap_cert_number.trim() : null,
      vietgap_cert_org: rawFarmData.vietgap_cert_org ? rawFarmData.vietgap_cert_org.trim() : null
    };

    expect(sanitized.name).toBe('Nông Trại Sầu Riêng Đắk Lắk');
    expect(sanitized.puc_code).toBe('VN-DL-00124');
    expect(sanitized.vietgap_cert_number).toBe('VG-2026-88');
    expect(sanitized.vietgap_cert_org).toBe('Quacert');
  });

  it('2.6 Should handle polygon vertex mutation (direct_select mode) and recalculate area accurately', () => {
    // Original 4-vertex bounding polygon
    const originalPolygon = [
      [107.0000, 11.0000],
      [107.0010, 11.0000],
      [107.0010, 11.0010],
      [107.0000, 11.0010]
    ];
    const initialArea = calculatePolygonArea(originalPolygon);

    // Simulate user dragging top-right vertex (index 2) outwards to expand farm boundary
    const mutatedPolygon = originalPolygon.map((pt, idx) => {
      if (idx === 2) {
        return [107.0020, 11.0020]; // Dragged further north-east
      }
      return [...pt];
    });

    const updatedArea = calculatePolygonArea(mutatedPolygon);
    expect(updatedArea).toBeGreaterThan(initialArea);
    expect(mutatedPolygon.length).toBe(4);
    expect(mutatedPolygon[2][0]).toBe(107.0020);
    expect(mutatedPolygon[2][1]).toBe(11.0020);
  });

  it('2.7 Should validate GeoJSON polygon closure and direct_select feature structure', () => {
    const rawCoords = [
      [107.1000, 11.5000],
      [107.1050, 11.5000],
      [107.1050, 11.5050],
      [107.1000, 11.5050]
    ];

    // Helper to produce closed ring
    const ensureClosedRing = (coords) => {
      const ring = coords.map(p => [...p]);
      if (ring.length >= 3) {
        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
          ring.push([...ring[0]]);
        }
      }
      return ring;
    };

    const closedRing = ensureClosedRing(rawCoords);
    expect(closedRing.length).toBe(5);
    expect(closedRing[0][0]).toBe(closedRing[4][0]);
    expect(closedRing[0][1]).toBe(closedRing[4][1]);

    const feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [closedRing]
      }
    };

    expect(feature.type).toBe('Feature');
    expect(feature.geometry.type).toBe('Polygon');
    expect(Array.isArray(feature.geometry.coordinates[0])).toBe(true);
    expect(feature.geometry.coordinates[0].length).toBe(5);
  });

});

