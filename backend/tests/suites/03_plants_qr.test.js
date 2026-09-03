const { describe, it, expect } = require('../test-framework');

describe('Suite 3: Plants Registry, Health Status & Public QR Code Generation', () => {

  it('3.1 Should validate and format plant tree code safely for QR and URLs', () => {
    const formatTreeCode = (input) => {
      if (!input) return 'TREE-01';
      return String(input).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    };

    expect(formatTreeCode('sr-01')).toBe('SR-01');
    expect(formatTreeCode(' tree #52 ')).toBe('TREE52');
    expect(formatTreeCode('TB_DURIAN_99')).toBe('TB_DURIAN_99');
  });

  it('3.2 Should generate unique public QR slugs and verify URL composition', () => {
    const generatePublicSlug = (farmId, treeCode) => {
      const cleanTree = String(treeCode).toLowerCase().replace(/[^a-z0-9]/g, '');
      return `f${farmId}-${cleanTree}-${Date.now().toString(36)}`;
    };

    const slug = generatePublicSlug(5, 'SR-01');
    expect(typeof slug).toBe('string');
    expect(slug.startsWith('f5-sr01-')).toBe(true);

    const baseUrl = 'https://plantbook.tanbaocorp.vn';
    const publicUrl = `${baseUrl}/plant/${slug}`;
    expect(publicUrl).toContain(`/plant/${slug}`);
  });

  it('3.3 Should correctly categorize plant health status and assign badge colors', () => {
    const getHealthConfig = (status) => {
      const s = (status || '').toLowerCase();
      if (s.includes('tốt') || s === 'tot') {
        return { label: 'Tốt', badge: 'green', icon: 'fa-circle-check', isIncident: false };
      }
      if (s.includes('chú ý') || s.includes('chu y')) {
        return { label: 'Cần chú ý', badge: 'orange', icon: 'fa-triangle-exclamation', isIncident: true };
      }
      if (s.includes('bệnh') || s.includes('benh')) {
        return { label: 'Bệnh', badge: 'red', icon: 'fa-bug', isIncident: true };
      }
      return { label: 'Bình thường', badge: 'gray', icon: 'fa-circle-info', isIncident: false };
    };

    const good = getHealthConfig('Tốt');
    expect(good.badge).toBe('green');
    expect(good.isIncident).toBe(false);

    const watch = getHealthConfig('Cần chú ý');
    expect(watch.badge).toBe('orange');
    expect(watch.isIncident).toBe(true);

    const sick = getHealthConfig('Bệnh nặng (Thán thư)');
    expect(sick.badge).toBe('red');
    expect(sick.isIncident).toBe(true);
  });

  it('3.4 Should validate GPS latitude and longitude ranges', () => {
    const isValidGPS = (lat, lng) => {
      const nLat = parseFloat(lat);
      const nLng = parseFloat(lng);
      return !isNaN(nLat) && !isNaN(nLng) &&
             nLat >= -90 && nLat <= 90 &&
             nLng >= -180 && nLng <= 180;
    };

    // Vietnam coordinates
    expect(isValidGPS(11.54321, 107.12345)).toBe(true);
    expect(isValidGPS(12.6865, 108.0378)).toBe(true); // Dak Lak
    // Invalid coordinates
    expect(isValidGPS(191.0, 107.0)).toBe(false);
    expect(isValidGPS(11.0, 200.0)).toBe(false);
    expect(isValidGPS('abc', 'def')).toBe(false);
  });

});
