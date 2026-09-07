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

  it('3.5 Should validate Non-Admin Plant Query Filter logic (Farm Owner, Assigned Farm, PRO Multi-farm)', () => {
    const evaluatePlantAccess = (user, plant, farm) => {
      if (user.role === 'admin') return true;
      if (user.view_plants_scope === 'assigned') {
        return (
          plant.created_by === user.id ||
          plant.assigned_to_user_id === user.id ||
          farm.user_id === user.id ||
          user.farm_id === plant.farm_id
        );
      }
      // 'all' scope (PRO or Normal farmer)
      return (
        farm.user_id === user.id ||
        plant.created_by === user.id ||
        plant.assigned_to_user_id === user.id ||
        user.farm_id === plant.farm_id ||
        (Array.isArray(user.owned_farm_ids) && user.owned_farm_ids.includes(plant.farm_id))
      );
    };

    const proUser = { id: 10, role: 'user', account_tier: 'pro', view_plants_scope: 'all', farm_id: 5, owned_farm_ids: [5, 6] };
    const adminCreatedPlantInFarm5 = { id: 101, farm_id: 5, created_by: 1, assigned_to_user_id: null };
    const adminCreatedPlantInFarm6 = { id: 102, farm_id: 6, created_by: 1, assigned_to_user_id: null };
    const otherPlantInFarm99 = { id: 103, farm_id: 99, created_by: 1, assigned_to_user_id: null };
    const farm5 = { id: 5, user_id: 10 };
    const farm6 = { id: 6, user_id: 10 };
    const farm99 = { id: 99, user_id: 999 };

    expect(evaluatePlantAccess(proUser, adminCreatedPlantInFarm5, farm5)).toBe(true);
    expect(evaluatePlantAccess(proUser, adminCreatedPlantInFarm6, farm6)).toBe(true);
    expect(evaluatePlantAccess(proUser, otherPlantInFarm99, farm99)).toBe(false);
  });

  it('3.6 Should extract short numeric tree code for map marker pins', () => {
    const getShortTreeCode = (treeCode, plantId) => {
      const code = String(treeCode || plantId || '').trim();
      if (!code) return '';
      const match = code.match(/(\d+)$/);
      if (match) {
        return String(parseInt(match[1], 10));
      }
      return code;
    };

    expect(getShortTreeCode('KH001-001', 1)).toBe('1');
    expect(getShortTreeCode('KH001-058', 58)).toBe('58');
    expect(getShortTreeCode('SR_2004_120', 120)).toBe('120');
    expect(getShortTreeCode('', 45)).toBe('45');
    expect(getShortTreeCode('ALPHA', 99)).toBe('ALPHA');
  });

  it('3.7 Should assign proper marker color codes and CSS classes based on health status', () => {
    const getMarkerStyle = (healthStatus) => {
      const colorMap = { 'Tốt': '#22c55e', 'Cần chú ý': '#eab308', 'Bệnh': '#ef4444' };
      const classMap = { 'Tốt': 'health-tot', 'Cần chú ý': 'health-watch', 'Bệnh': 'health-sick' };
      return {
        color: colorMap[healthStatus] || '#3b82f6',
        className: classMap[healthStatus] || 'health-default'
      };
    };

    expect(getMarkerStyle('Tốt')).toEqual({ color: '#22c55e', className: 'health-tot' });
    expect(getMarkerStyle('Cần chú ý')).toEqual({ color: '#eab308', className: 'health-watch' });
    expect(getMarkerStyle('Bệnh')).toEqual({ color: '#ef4444', className: 'health-sick' });
    expect(getMarkerStyle('Chưa rõ')).toEqual({ color: '#3b82f6', className: 'health-default' });
  });

  it('3.8 Should validate Full NFC UID vs Incomplete/Non-NFC parameters for automatic GPS sync', () => {
    const isFullNfcUid = (uid) => {
      if (!uid || typeof uid !== 'string') return false;
      const clean = decodeURIComponent(uid).trim();
      if (/^([0-9A-Fa-f]{2}[:-]){3,9}[0-9A-Fa-f]{2}$/.test(clean)) return true;
      if (/^[0-9A-Fa-f]{8,20}$/.test(clean) && !isNaN(Number('0x' + clean))) return true;
      return false;
    };

    // Valid Full NFC UIDs (should trigger GPS sync)
    expect(isFullNfcUid('04:20:CF:5A:25:20:91')).toBe(true);
    expect(isFullNfcUid('04%3A20%3ACF%3A5A%3A25%3A20%3A91')).toBe(true);
    expect(isFullNfcUid('04-20-CF-5A-25-20-91')).toBe(true);
    expect(isFullNfcUid('0420CF5A252091')).toBe(true);
    expect(isFullNfcUid('04:12:34:56')).toBe(true); // 4-byte UID

    // Incomplete or non-NFC parameters (must NOT trigger GPS sync)
    expect(isFullNfcUid('04')).toBe(false);
    expect(isFullNfcUid('26')).toBe(false);
    expect(isFullNfcUid('sau-rieng-01')).toBe(false);
    expect(isFullNfcUid('')).toBe(false);
    expect(isFullNfcUid(null)).toBe(false);
    expect(isFullNfcUid(undefined)).toBe(false);
  });

  it('3.9 Should parse public URL routes correctly and determine GPS sync eligibility', () => {
    const parseAndCheckGpsSync = (urlPath) => {
      const isFullNfcUid = (uid) => {
        if (!uid || typeof uid !== 'string') return false;
        const clean = decodeURIComponent(uid).trim();
        if (/^([0-9A-Fa-f]{2}[:-]){3,9}[0-9A-Fa-f]{2}$/.test(clean)) return true;
        if (/^[0-9A-Fa-f]{8,20}$/.test(clean) && !isNaN(Number('0x' + clean))) return true;
        return false;
      };

      const pathParts = urlPath.split('/').filter(p => p.length > 0);
      let nfcUid = '';
      if (pathParts.length >= 4) {
        nfcUid = decodeURIComponent(pathParts[3]);
      } else if (pathParts.length === 3) {
        nfcUid = decodeURIComponent(pathParts[2]);
      }
      return {
        nfcUid,
        shouldSyncGps: isFullNfcUid(nfcUid)
      };
    };

    // URL with Full NFC UID: https://plant-book.onrender.com/0/6/26/04%3A20%3ACF%3A5A%3A25%3A20%3A91
    const nfcUrl = parseAndCheckGpsSync('/0/6/26/04%3A20%3ACF%3A5A%3A25%3A20%3A91');
    expect(nfcUrl.nfcUid).toBe('04:20:CF:5A:25:20:91');
    expect(nfcUrl.shouldSyncGps).toBe(true);

    // URL with incomplete prefix '04': https://plant-book.onrender.com/0/6/26/04
    const nonNfcUrl = parseAndCheckGpsSync('/0/6/26/04');
    expect(nonNfcUrl.nfcUid).toBe('04');
    expect(nonNfcUrl.shouldSyncGps).toBe(false);

    // URL with farm and plant ID only: /6/26
    const standardUrl = parseAndCheckGpsSync('/6/26');
    expect(standardUrl.shouldSyncGps).toBe(false);
  });

});
