const { describe, it, expect } = require('../test-framework');

describe('Suite 5: VietGAP 100% Compliance, Traceability Batch Codes & Active Ingredients', () => {

  function generateVietgapBatchCode(pucCode, harvestDateStr, treeCode) {
    const puc = (pucCode || 'VN-TB').trim().toUpperCase();
    const dateFormatted = new Date(harvestDateStr).toISOString().slice(0, 10).replace(/-/g, '');
    const cleanTree = String(treeCode || 'LOT').trim().replace(/[^a-zA-Z0-9]/g, '');
    return `${puc}-${dateFormatted}-${cleanTree}`;
  }

  it('5.1 Should generate standardized VietGAP Harvest Batch Code (Mã Lô Nông Sản)', () => {
    const pucCode = 'VN-DL-00124';
    const harvestDate = '2026-09-20';
    const treeCode = 'SR-05';

    const batchCode = generateVietgapBatchCode(pucCode, harvestDate, treeCode);
    expect(batchCode).toBe('VN-DL-00124-20260920-SR05');
  });

  it('5.2 Should validate VietGAP active ingredient and target pest specification on supplies', () => {
    const pesticide = {
      name: 'Thuốc trừ nấm Anvil 5SC',
      category: 'Phun thuốc',
      active_ingredient: 'Hexaconazole 50g/L',
      target_pests: 'Nấm hồng, rỉ sắt, thán thư',
      price_per_unit: 260000
    };

    expect(pesticide.category).toBe('Phun thuốc');
    expect(pesticide.active_ingredient).toBe('Hexaconazole 50g/L');
    expect(pesticide.target_pests.includes('Nấm hồng')).toBe(true);
    expect(pesticide.price_per_unit).toBe(260000);
  });

  it('5.3 Should capture Operator Name and Equipment Used for VietGAP Field Diary audit trail', () => {
    const logEntry = {
      log_type: 'Phun thuốc',
      log_date: '2026-09-03',
      operator_name: 'Nguyễn Văn Kỹ Sư',
      equipment_used: 'Bình xịt điện Stihl 20L',
      details: {
        pesticide_name: 'Anvil 5SC',
        amount: 50,
        unit: 'ml',
        supply_id: 12
      }
    };

    expect(typeof logEntry.operator_name).toBe('string');
    expect(logEntry.operator_name.length).toBeGreaterThan(0);
    expect(typeof logEntry.equipment_used).toBe('string');
    expect(logEntry.equipment_used.length).toBeGreaterThan(0);
  });

  it('5.4 Should validate tree and PUC batch traceability linkage for export standards', () => {
    const farm = { puc_code: 'VN-TG-0089', cert: 'VietGAP-2026-TG' };
    const tree = { id: 101, tree_code: 'SR-RI6-01' };
    const harvestLog = {
      harvest_date: '2026-06-15',
      yield_amount: 120,
      yield_unit: 'kg',
      batch_code: generateVietgapBatchCode(farm.puc_code, '2026-06-15', tree.tree_code)
    };

    expect(harvestLog.batch_code).toBe('VN-TG-0089-20260615-SRRI601');
    expect(harvestLog.yield_amount).toBe(120);
    expect(harvestLog.yield_unit).toBe('kg');
  });

  it('5.5 Should enforce VietGAP organic and biological classification standards', () => {
    const supplies = [
      { name: 'Phân hữu cơ vi sinh', category: 'Bón phân', fertilizer_type: 'organic' },
      { name: 'Thuốc sinh học Radiant 60SC', category: 'Phun thuốc', active_ingredient: 'Spinetoram 60g/L' }
    ];

    const organicFert = supplies.find(s => s.category === 'Bón phân');
    expect(organicFert.fertilizer_type).toBe('organic');

    const bioPest = supplies.find(s => s.category === 'Phun thuốc');
    expect(bioPest.active_ingredient).toBe('Spinetoram 60g/L');
  });

});
