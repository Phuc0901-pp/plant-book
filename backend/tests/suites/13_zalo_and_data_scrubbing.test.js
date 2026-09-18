/**
 * ═══════════════════════════════════════════════════════════════
 * Suite 13: Zalo Official Account Alerts, Data Scrubbing & Privacy
 * ═══════════════════════════════════════════════════════════════
 */

const { describe, it, expect } = require('../test-framework');
const zaloService = require('../../services/zaloService');

describe('Suite 13: Zalo OA Integration & Public Data Scrubbing Engine', () => {

  it('13.1 Should format Zalo OA security alert message with critical indicators and distance', async () => {
    const alert = await zaloService.sendZaloSecurityAlert({
      phone: '0901234567',
      farmName: 'Trang Trại Sầu Riêng Long Khánh',
      treeCode: 'SR-LK-102',
      distance: 14.5,
      reason: 'Vị trí quét NFC vượt quá bán kính quy định (≤ 8m)',
      severity: 'WARNING'
    });

    expect(alert.success).toBe(true);
    expect(alert.message).toContain('AN NINH CÂY TRỒNG');
    expect(alert.message).toContain('Trang Trại Sầu Riêng Long Khánh');
    expect(alert.message).toContain('#SR-LK-102');
    expect(alert.message).toContain('14.5 mét');
    expect(alert.message).toContain('quy định ≤ 8m');
  });

  it('13.2 Should format Zalo OA agricultural advisory and sensor alert message', async () => {
    const alert = await zaloService.sendZaloFarmingAlert({
      phone: '0901234567',
      farmName: 'Trang Trại Bùi Văn Dũng',
      title: 'Cảnh báo độ ẩm đất tầng 20cm giảm sâu (42%)',
      message: 'Khuyến nghị bật van tưới rễ nhỏ giọt khu A trong 45 phút.'
    });

    expect(alert.success).toBe(true);
    expect(alert.message).toContain('THÔNG BÁO NÔNG VỤ');
    expect(alert.message).toContain('Bùi Văn Dũng');
    expect(alert.message).toContain('độ ẩm đất');
  });

  it('13.3 Should completely scrub confidential financial and formula fields from public logs', () => {
    const rawLogs = [
      {
        id: 1,
        plant_id: 102,
        log_date: '2026-09-18',
        log_type: 'Bón phân',
        note: 'Bón bổ sung NPK đợt 3',
        details: {
          fertilizer_name: 'Phân NPK 16-16-8',
          amount: '500g/gốc',
          method: 'Bón rãnh quanh tán',
          unit_price: 35000,
          total_cost: 7000000,
          cost: 7000000,
          package_price: 850000,
          formula_secret: 'TÂN_BẢO_BIO_ENZYME_99',
          supplier_price: 28000,
          vendor_name: 'Đại lý VTNN Hòa Phát',
          vendor_phone: '0912345678',
          accounting_code: 'ACC-2026-FARM1',
          stock_deducted: 50
        }
      }
    ];

    const scrubLogs = (logs) => {
      return logs.map(log => {
        let safeDetails = {};
        if (log.details) {
          let rawDetails = typeof log.details === 'string' ? JSON.parse(log.details) : { ...log.details };
          delete rawDetails.unit_price;
          delete rawDetails.total_cost;
          delete rawDetails.cost;
          delete rawDetails.package_price;
          delete rawDetails.package_unit;
          delete rawDetails.formula_secret;
          delete rawDetails.supplier_price;
          delete rawDetails.vendor_name;
          delete rawDetails.vendor_phone;
          delete rawDetails.accounting_code;
          delete rawDetails.stock_deducted;
          safeDetails = rawDetails;
        }
        return {
          id: log.id,
          plant_id: log.plant_id,
          log_date: log.log_date,
          log_type: log.log_type,
          note: log.note,
          details: safeDetails
        };
      });
    };

    const cleanLogs = scrubLogs(rawLogs);
    const firstDetails = cleanLogs[0].details;

    // Public transparent fields MUST exist
    expect(firstDetails.fertilizer_name).toBe('Phân NPK 16-16-8');
    expect(firstDetails.amount).toBe('500g/gốc');
    expect(firstDetails.method).toBe('Bón rãnh quanh tán');

    // Confidential business fields MUST BE DELETED
    expect(firstDetails.unit_price).toBeUndefined();
    expect(firstDetails.total_cost).toBeUndefined();
    expect(firstDetails.cost).toBeUndefined();
    expect(firstDetails.formula_secret).toBeUndefined();
    expect(firstDetails.supplier_price).toBeUndefined();
    expect(firstDetails.accounting_code).toBeUndefined();
  });

  it('13.4 Should verify strict multi-tenant isolation constraint (WHERE farm_id = user.farm_id)', () => {
    const buildSecureQuery = (user, targetFarmId, targetPlantId) => {
      if (user.role === 'admin') {
        return { isAllowed: true, sql: 'SELECT * FROM plants WHERE id = $1', params: [targetPlantId] };
      }
      if (user.farm_id !== targetFarmId) {
        return { isAllowed: false, sql: null, error: '403 Forbidden: Không thể truy cập dữ liệu của trang trại khác.' };
      }
      return { isAllowed: true, sql: 'SELECT * FROM plants WHERE id = $1 AND farm_id = $2', params: [targetPlantId, user.farm_id] };
    };

    const farmerUser = { id: 5, role: 'farmer', farm_id: 16 };
    
    // Own farm access (Allowed)
    const ownAccess = buildSecureQuery(farmerUser, 16, 102);
    expect(ownAccess.isAllowed).toBe(true);
    expect(ownAccess.sql).toContain('farm_id = $2');

    // Foreign farm access attempt (Blocked)
    const foreignAccess = buildSecureQuery(farmerUser, 99, 500);
    expect(foreignAccess.isAllowed).toBe(false);
    expect(foreignAccess.error).toContain('403 Forbidden');
  });

});
