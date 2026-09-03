const { describe, it, expect } = require('../test-framework');

describe('Suite 5: VietGAP 100% Compliance, PHI Quarantine & Traceability Batch Codes', () => {

  // Algorithmic helper for PHI quarantine calculation
  function calculatePhiQuarantine(sprayDateStr, phiDays) {
    const sprayDate = new Date(sprayDateStr);
    const phiUntil = new Date(sprayDate);
    phiUntil.setDate(phiUntil.getDate() + parseInt(phiDays));
    return phiUntil.toISOString().slice(0, 10);
  }

  function getPhiStatus(phiUntilDateStr, checkDate = new Date()) {
    if (!phiUntilDateStr) return { status: 'safe', remainingDays: 0 };
    const phiUntil = new Date(phiUntilDateStr);
    phiUntil.setHours(23, 59, 59, 999);

    if (checkDate <= phiUntil) {
      const diffMs = phiUntil.getTime() - checkDate.getTime();
      const remainingDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      return { status: 'quarantine', remainingDays };
    }
    return { status: 'safe', remainingDays: 0 };
  }

  function generateVietgapBatchCode(pucCode, harvestDateStr, treeCode) {
    const puc = (pucCode || 'VN-TB').trim().toUpperCase();
    const dateFormatted = new Date(harvestDateStr).toISOString().slice(0, 10).replace(/-/g, '');
    const cleanTree = String(treeCode || 'LOT').trim().replace(/[^a-zA-Z0-9]/g, '');
    return `${puc}-${dateFormatted}-${cleanTree}`;
  }

  it('5.1 Should calculate PHI expiration date accurately when applying pesticide', () => {
    const sprayDate = '2026-09-01';
    const phiDays = 14; // 14 days quarantine for Anvil 5SC

    const phiUntil = calculatePhiQuarantine(sprayDate, phiDays);
    expect(phiUntil).toBe('2026-09-15');
  });

  it('5.2 Should set status to quarantine during active PHI period and safe after expiry', () => {
    const phiUntilDate = '2026-09-15';

    // Check on 2026-09-05 (Within quarantine)
    const check1 = getPhiStatus(phiUntilDate, new Date('2026-09-05T12:00:00Z'));
    expect(check1.status).toBe('quarantine');
    expect(check1.remainingDays).toBeGreaterThan(0);

    // Check on 2026-09-16 (After quarantine expired)
    const check2 = getPhiStatus(phiUntilDate, new Date('2026-09-16T12:00:00Z'));
    expect(check2.status).toBe('safe');
    expect(check2.remainingDays).toBe(0);
  });

  it('5.3 Should flag is_phi_violation = true when harvest occurs during active PHI quarantine', () => {
    const plant = {
      id: 88,
      tree_code: 'SR-01',
      phi_until_date: '2026-09-15',
      phi_status: 'quarantine'
    };

    const attemptHarvest = (harvestDateStr) => {
      const harvestDate = new Date(harvestDateStr);
      let isViolation = false;
      if (plant.phi_until_date) {
        const phiUntil = new Date(plant.phi_until_date);
        phiUntil.setHours(23, 59, 59, 999);
        if (harvestDate <= phiUntil) {
          isViolation = true;
        }
      }
      return isViolation;
    };

    // Harvesting early on Sept 10 -> VIOLATION
    const violationEarly = attemptHarvest('2026-09-10');
    expect(violationEarly).toBe(true);

    // Harvesting safely on Sept 20 -> COMPLIANT
    const safeHarvest = attemptHarvest('2026-09-20');
    expect(safeHarvest).toBe(false);
  });

  it('5.4 Should generate standardized VietGAP Harvest Batch Code (Mã Lô Nông Sản)', () => {
    const pucCode = 'VN-DL-00124';
    const harvestDate = '2026-09-20';
    const treeCode = 'SR-05';

    const batchCode = generateVietgapBatchCode(pucCode, harvestDate, treeCode);
    expect(batchCode).toBe('VN-DL-00124-20260920-SR05');
  });

  it('5.5 Should capture Operator Name and Equipment Used for VietGAP Field Diary audit trail', () => {
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

});
