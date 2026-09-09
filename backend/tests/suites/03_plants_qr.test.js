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

  it('3.10 Should validate 3-segment URL format: https://plant-book.onrender.com/{farm_id}/{plant_id}/{nfc_uid}', () => {
    const generatePublicPlantUrl = (farmId, plantId, nfcUid) => {
      const fId = farmId || 0;
      const pId = plantId || 0;
      if (nfcUid && String(nfcUid).trim()) {
        return `https://plant-book.onrender.com/${fId}/${pId}/${encodeURIComponent(String(nfcUid).trim())}`;
      }
      return `https://plant-book.onrender.com/${fId}/${pId}`;
    };

    const url1 = generatePublicPlantUrl(6, 26, '04:20:CF:5A:25:20:91');
    expect(url1).toBe('https://plant-book.onrender.com/6/26/04%3A20%3ACF%3A5A%3A25%3A20%3A91');

    const url2 = generatePublicPlantUrl(12, 105, null);
    expect(url2).toBe('https://plant-book.onrender.com/12/105');

    const url3 = generatePublicPlantUrl(0, 5, '04-12-34-56');
    expect(url3).toBe('https://plant-book.onrender.com/0/5/04-12-34-56');
  });

  it('3.11 Should validate NFC Inventory batch insertion, duplicate detection & state management', () => {
    class MockNfcInventory {
      constructor() {
        this.store = new Map(); // uid -> { id, farm_id, status, plant_id }
      }
      addBatch(farmId, uids) {
        const added = [];
        const duplicates = [];
        for (const raw of uids) {
          const uid = String(raw).trim().toUpperCase();
          if (!uid) continue;
          if (this.store.has(uid)) {
            duplicates.push(uid);
          } else {
            const entry = { id: this.store.size + 1, farm_id: farmId, nfc_uid: uid, status: 'unassigned', plant_id: null };
            this.store.set(uid, entry);
            added.push(entry);
          }
        }
        return { added, duplicates };
      }
      assignTag(uid, plantId) {
        const entry = this.store.get(uid);
        if (entry) {
          entry.status = 'assigned';
          entry.plant_id = plantId;
          return true;
        }
        return false;
      }
      getStats(farmId) {
        const tags = Array.from(this.store.values()).filter(t => t.farm_id === farmId);
        return {
          total: tags.length,
          assigned: tags.filter(t => t.status === 'assigned').length,
          unassigned: tags.filter(t => t.status === 'unassigned').length
        };
      }
    }

    const inv = new MockNfcInventory();
    const batch1 = inv.addBatch(5, ['04:20:CF:5A:25:20:91', '04:20:CF:5A:25:20:92', '04:20:CF:5A:25:20:93']);
    expect(batch1.added.length).toBe(3);
    expect(batch1.duplicates.length).toBe(0);

    // Duplicate tap rejection
    const batch2 = inv.addBatch(5, ['04:20:CF:5A:25:20:91', '04:20:CF:5A:25:20:99']);
    expect(batch2.added.length).toBe(1);
    expect(batch2.duplicates.length).toBe(1);
    expect(batch2.duplicates[0]).toBe('04:20:CF:5A:25:20:91');

    // Assign tag
    inv.assignTag('04:20:CF:5A:25:20:91', 101);
    const stats = inv.getStats(5);
    expect(stats.total).toBe(4);
    expect(stats.assigned).toBe(1);
    expect(stats.unassigned).toBe(3);
  });

  it('3.12 Should verify public_url field generation and synchronization upon GPS and NFC tagging', () => {
    const processFieldTagging = (farmId, plant, nfcUid, lat, lng) => {
      const cleanUid = String(nfcUid).trim().toUpperCase();
      const publicUrl = `https://plant-book.onrender.com/${farmId}/${plant.id}/${encodeURIComponent(cleanUid)}`;
      return {
        ...plant,
        nfc_uid: cleanUid,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        public_url: publicUrl
      };
    };

    const initialPlant = { id: 26, farm_id: 6, tree_code: 'SR-26', nfc_uid: null, latitude: null, longitude: null, public_url: null };
    const taggedPlant = processFieldTagging(6, initialPlant, '04:20:CF:5A:25:20:91', 11.543210, 107.123450);

    expect(taggedPlant.nfc_uid).toBe('04:20:CF:5A:25:20:91');
    expect(taggedPlant.latitude).toBe(11.54321);
    expect(taggedPlant.longitude).toBe(107.12345);
    expect(taggedPlant.public_url).toBe('https://plant-book.onrender.com/6/26/04%3A20%3ACF%3A5A%3A25%3A20%3A91');
  });

  it('3.13 Should enforce 1-Tree-1-Tag lifecycle: inventory check, duplicate prevention & old tag unassignment', () => {
    // Mock Inventory & Plants Store
    const inventory = [
      { id: 1, farm_id: 6, nfc_uid: '04:A1:B2:C3:D4:E5:01', status: 'unassigned', plant_id: null },
      { id: 2, farm_id: 6, nfc_uid: '04:A1:B2:C3:D4:E5:02', status: 'unassigned', plant_id: null },
      { id: 3, farm_id: 6, nfc_uid: '04:A1:B2:C3:D4:E5:03', status: 'unassigned', plant_id: null }
    ];

    const plants = [
      { id: 101, farm_id: 6, tree_code: 'SR-01', nfc_uid: null, public_url: null },
      { id: 102, farm_id: 6, tree_code: 'SR-02', nfc_uid: null, public_url: null }
    ];

    const logs = [
      { id: 1, plant_id: 101, log_type: 'Tưới nước', log_date: '2026-08-01' },
      { id: 2, plant_id: 101, log_type: 'Bón phân', log_date: '2026-08-15' }
    ];

    const assignNfcToPlant = (farmId, plantId, rawUid) => {
      const cleanUid = rawUid ? String(rawUid).trim().toUpperCase() : null;
      const targetPlant = plants.find(p => p.id === plantId);
      if (!targetPlant) throw new Error('Cây không tồn tại.');

      if (cleanUid) {
        // 1. Inventory check
        const inInv = inventory.find(i => i.farm_id === farmId && i.nfc_uid === cleanUid);
        if (!inInv) throw new Error('Mã thẻ chưa được khai báo nhập kho cho trang trại này.');

        // 2. Duplicate across trees check
        const conflict = plants.find(p => p.nfc_uid === cleanUid && p.id !== plantId);
        if (conflict) throw new Error(`Mã thẻ ${cleanUid} đã được gắn cho cây #${conflict.tree_code || conflict.id}.`);

        // 3. Unassign old tag if replacing
        if (targetPlant.nfc_uid && targetPlant.nfc_uid !== cleanUid) {
          const oldInv = inventory.find(i => i.nfc_uid === targetPlant.nfc_uid);
          if (oldInv) {
            oldInv.status = 'unassigned';
            oldInv.plant_id = null;
          }
        }

        // 4. Update plant & inventory
        targetPlant.nfc_uid = cleanUid;
        targetPlant.public_url = `https://plant-book.onrender.com/${farmId}/${plantId}/${encodeURIComponent(cleanUid)}`;
        inInv.status = 'assigned';
        inInv.plant_id = plantId;
      } else {
        // Deactivate
        if (targetPlant.nfc_uid) {
          const oldInv = inventory.find(i => i.nfc_uid === targetPlant.nfc_uid);
          if (oldInv) {
            oldInv.status = 'unassigned';
            oldInv.plant_id = null;
          }
        }
        targetPlant.nfc_uid = null;
        targetPlant.latitude = null;
        targetPlant.longitude = null;
        targetPlant.public_url = `https://plant-book.onrender.com/${farmId}/${plantId}`;
      }
      return targetPlant;
    };

    // 1. Reject undeclared tag
    expect(() => assignNfcToPlant(6, 101, '04:99:99:99:99:99:99')).toThrow('Mã thẻ chưa được khai báo nhập kho cho trang trại này.');

    // 2. Assign valid tag #1 to tree 101
    assignNfcToPlant(6, 101, '04:A1:B2:C3:D4:E5:01');
    expect(plants[0].nfc_uid).toBe('04:A1:B2:C3:D4:E5:01');
    expect(inventory[0].status).toBe('assigned');
    expect(inventory[0].plant_id).toBe(101);

    // 3. Duplicate assignment to tree 102 rejected
    expect(() => assignNfcToPlant(6, 102, '04:A1:B2:C3:D4:E5:01')).toThrow('Mã thẻ 04:A1:B2:C3:D4:E5:01 đã được gắn cho cây #SR-01.');

    // 4. Replace tree 101 tag with tag #2
    assignNfcToPlant(6, 101, '04:A1:B2:C3:D4:E5:02');
    expect(plants[0].nfc_uid).toBe('04:A1:B2:C3:D4:E5:02');
    expect(inventory[0].status).toBe('unassigned'); // Old tag unassigned
    expect(inventory[0].plant_id).toBe(null);
    expect(inventory[1].status).toBe('assigned');   // New tag assigned
    expect(inventory[1].plant_id).toBe(101);

    // 5. Cultivation logs remain 100% intact
    expect(logs.filter(l => l.plant_id === 101).length).toBe(2);

    // 6. Deactivating tag clears GPS coordinates
    plants[0].latitude = 11.54321;
    plants[0].longitude = 107.12345;
    assignNfcToPlant(6, 101, null);
    expect(plants[0].nfc_uid).toBe(null);
    expect(plants[0].latitude).toBe(null);
    expect(plants[0].longitude).toBe(null);
    expect(inventory[1].status).toBe('unassigned');
  });

  it('3.14 Should verify public access response: active tag allowed, old replaced tag frozen (revoked)', () => {
    const activePlant = {
      id: 101,
      farm_id: 6,
      tree_code: 'SR-01',
      nfc_uid: '04:A1:B2:C3:D4:E5:02', // Current active tag
      is_public: true
    };

    const verifyPublicTagAccess = (requestedNfcUid, plant) => {
      if (!requestedNfcUid) return { status: 200, access: 'allowed' };
      const cleanReq = String(requestedNfcUid).trim().toUpperCase();
      if (!plant.nfc_uid || plant.nfc_uid.toUpperCase() !== cleanReq) {
        return {
          status: 410,
          access: 'revoked',
          error: `Thẻ NFC [${cleanReq}] này đã bị thu hồi hoặc thay thế. Đường dẫn công khai cũ đã bị đóng băng truy cập.`
        };
      }
      return { status: 200, access: 'allowed', plant };
    };

    // Current tag access -> 200 Allowed
    const currentAccess = verifyPublicTagAccess('04:A1:B2:C3:D4:E5:02', activePlant);
    expect(currentAccess.status).toBe(200);
    expect(currentAccess.access).toBe('allowed');

    // Old revoked tag access -> 410 Revoked & Frozen
    const oldAccess = verifyPublicTagAccess('04:A1:B2:C3:D4:E5:01', activePlant);
    expect(oldAccess.status).toBe(410);
    expect(oldAccess.access).toBe('revoked');
    expect(oldAccess.error).toContain('đã bị đóng băng truy cập');
  });

  it('3.15 Should validate batch sequential tree range generation (XX -> XY) with shared metadata', () => {
    const generateTreeRange = ({ prefix = '', startNum, endNum, padZeros = true, plantType, farmId }) => {
      const s = parseInt(startNum, 10);
      const e = parseInt(endNum, 10);
      if (isNaN(s) || isNaN(e) || s > e) throw new Error('Dải số thứ tự không hợp lệ.');
      const count = e - s + 1;
      if (count > 500) throw new Error('Mỗi lần tạo hàng loạt tối đa 500 cây.');

      const padLen = padZeros ? Math.max(String(startNum).length, String(endNum).length) : 0;
      const formatNum = (num) => padLen > 1 ? String(num).padStart(padLen, '0') : String(num);

      const trees = [];
      for (let i = s; i <= e; i++) {
        const code = `${prefix}${formatNum(i)}`;
        const slug = `${farmId || 0}_${code}`;
        trees.push({
          tree_code: code,
          public_slug: slug,
          plant_type: plantType,
          farm_id: farmId,
          health_status: 'Tốt'
        });
      }
      return trees;
    };

    // Case 1: Numeric range with padding 01 -> 50
    const batch1 = generateTreeRange({ prefix: 'SR-', startNum: '01', endNum: '50', padZeros: true, plantType: 'Sầu riêng', farmId: 16 });
    expect(batch1.length).toBe(50);
    expect(batch1[0].tree_code).toBe('SR-01');
    expect(batch1[49].tree_code).toBe('SR-50');
    expect(batch1[0].public_slug).toBe('16_SR-01');
    expect(batch1[49].public_slug).toBe('16_SR-50');

    // Case 2: Plain numbers 1 -> 10 without prefix
    const batch2 = generateTreeRange({ prefix: '', startNum: 1, endNum: 10, padZeros: false, plantType: 'Bưởi da xanh', farmId: 5 });
    expect(batch2.length).toBe(10);
    expect(batch2[0].tree_code).toBe('1');
    expect(batch2[9].tree_code).toBe('10');

    // Case 3: Invalid range rejection
    expect(() => generateTreeRange({ startNum: 50, endNum: 10, plantType: 'Xoài' })).toThrow('Dải số thứ tự không hợp lệ.');
  });

});

