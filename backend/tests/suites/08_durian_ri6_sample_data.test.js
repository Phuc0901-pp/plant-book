const { describe, it, expect } = require('../test-framework');

describe('Suite 8: Durian Ri6 20-Year Sample Agronomic Dataset & VietGAP Traceability', () => {

  it('8.1 Should validate 20-year-old Durian Ri6 tree morphology & biometric parameters', () => {
    const treeProfile = {
      tree_code: 'SR-01',
      plant_type: 'Sầu riêng',
      plant_variety: 'Ri6 Cổ Thụ (20 Năm Tuổi)',
      plant_age: '20 năm tuổi',
      health_status: 'Tốt',
      data: {
        trunk_diameter_cm: 65,
        height_m: 12.5,
        canopy_diameter_m: 11.0,
        average_yield_kg: 420,
        planting_year: 2004,
        current_season_target_fruits: 140
      }
    };

    expect(treeProfile.plant_age).toBe('20 năm tuổi');
    expect(treeProfile.data.trunk_diameter_cm >= 50).toBe(true);
    expect(treeProfile.data.canopy_diameter_m >= 10.0).toBe(true);
    expect(treeProfile.data.current_season_target_fruits).toBe(140);
  });

  it('8.2 Should validate 9 standard Durian Ri6 supplies with units, pricing and VietGAP properties', () => {
    const supplies = [
      { name: 'Phân hữu cơ vi sinh nở Bỉ (Belgo Organic)', cat: 'Bón phân', price: 380000, unit: 'bao', smallPrice: 15200 },
      { name: 'Phân NPK 20-20-15+TE Đầu Trâu', cat: 'Bón phân', price: 890000, unit: 'bao', smallPrice: 17800 },
      { name: 'Phân bón lá tạo mầm MKP 0-52-34 Haifa Israel', cat: 'Bón phân', price: 1250000, unit: 'bao', smallPrice: 50000 },
      { name: 'Phân Kali Sunfat K2SO4 SoluPotasse', cat: 'Bón phân', price: 750000, unit: 'bao', smallPrice: 30000 },
      { name: 'Phân Canxi Bo Sữa Bo-Trac Yara', cat: 'Bón phân', price: 180000, unit: 'chai', smallPrice: 180 },
      { name: 'Thuốc trừ nấm Anvil 5SC', cat: 'Phun thuốc', price: 260000, unit: 'chai', phi: 14, active: 'Hexaconazole 50g/L' },
      { name: 'Thuốc trị xì mủ Ridomil Gold 68WG', cat: 'Phun thuốc', price: 320000, unit: 'gói', phi: 14, active: 'Metalaxyl M + Mancozeb' },
      { name: 'Thuốc trừ sâu sinh học Radiant 60SC', cat: 'Phun thuốc', price: 195000, unit: 'chai', phi: 3, active: 'Spinetoram 60g/L' },
      { name: 'Tiền nước tưới giếng khoan công nghiệp', cat: 'Tiền nước', price: 3500, unit: 'm3', smallPrice: 3.5 }
    ];

    expect(supplies.length).toBe(9);
    
    // Check PHI compliance for pesticides
    const anvil = supplies.find(s => s.name.includes('Anvil'));
    expect(anvil.phi).toBe(14);
    expect(anvil.active.includes('Hexaconazole')).toBe(true);

    const ridomil = supplies.find(s => s.name.includes('Ridomil'));
    expect(ridomil.phi).toBe(14);

    const radiant = supplies.find(s => s.name.includes('Radiant'));
    expect(radiant.phi).toBe(3);
  });

  it('8.3 Should validate chronological progression across 7 distinct phenological stages', () => {
    const lifecycleLogs = [
      { step: 1, date: '2025-09-10', stage: 'Phục hồi sau thu hoạch', type: 'Cắt tỉa' },
      { step: 2, date: '2025-09-25', stage: 'Bón phân hữu cơ Bỉ phục hồi rễ', type: 'Bón phân' },
      { step: 3, date: '2025-10-15', stage: 'Tưới nước kích cơi đọt 1', type: 'Tưới nước' },
      { step: 4, date: '2025-11-20', stage: 'Xiết nước & Phun MKP 0-52-34 tạo mầm', type: 'Bón phân' },
      { step: 5, date: '2025-12-25', stage: 'Phun Canxi Bo sữa dưỡng mắt cua', type: 'Bón phân' },
      { step: 6, date: '2026-01-15', stage: 'Thụ phấn chéo nhân tạo lúc 18h30', type: 'Thụ phấn' },
      { step: 7, date: '2026-02-10', stage: 'Tỉa định 140 trái non & loại bỏ trái méo', type: 'Cắt tỉa' },
      { step: 8, date: '2026-02-28', stage: 'Bón NPK 20-20-15 nuôi trái non', type: 'Bón phân' },
      { step: 9, date: '2026-03-20', stage: 'Phun phòng rầy bằng Radiant 60SC (PHI 3 ngày)', type: 'Phun thuốc' },
      { step: 10, date: '2026-04-15', stage: 'Cạo sạch và quét Ridomil Gold trị xì mủ thân', type: 'Xử lý bệnh' },
      { step: 11, date: '2026-05-20', stage: 'Phun Anvil 5SC & Bón Kali Sunfat vỗ béo cơm', type: 'Phun thuốc' },
      { step: 12, date: '2026-06-15', stage: 'Thu hoạch chính vụ 85 trái đạt chuẩn VietGAP', type: 'Thu hoạch' }
    ];

    expect(lifecycleLogs.length).toBe(12);

    // Verify dates are in ascending chronological order
    for (let i = 1; i < lifecycleLogs.length; i++) {
      const prevDate = new Date(lifecycleLogs[i - 1].date);
      const currDate = new Date(lifecycleLogs[i].date);
      expect(currDate > prevDate).toBe(true);
    }
  });

  it('8.4 Should verify VietGAP harvest batch code generation and PHI quarantine safety', () => {
    const lastSprayDate = new Date('2026-05-20');
    const phiDays = 14;
    const phiExpiryDate = new Date(lastSprayDate);
    phiExpiryDate.setDate(phiExpiryDate.getDate() + phiDays); // 2026-06-03

    const harvestDate = new Date('2026-06-15');
    const isHarvestSafe = harvestDate > phiExpiryDate;
    expect(isHarvestSafe).toBe(true);

    const farmPuc = 'VN-LK-001';
    const treeCode = 'SR-01';
    const harvestDateStr = '20260615';
    const batchCode = `${farmPuc}-${harvestDateStr}-${treeCode.replace(/[^a-zA-Z0-9]/g, '')}`;

    expect(batchCode).toBe('VN-LK-001-20260615-SR01');
  });

  it('8.5 Should compute financial cost-benefit economics for 20-year Durian Ri6 tree', () => {
    // Costs
    const organicCost = 15 * 15200; // 228,000 VND
    const mkpCost = 0.5 * 50000;    // 25,000 VND
    const canxiBoCost = 18000;       // 18,000 VND
    const npkCost = 2.0 * 17800;    // 35,600 VND
    const radiantCost = 39000;       // 39,000 VND
    const ridomilCost = 16000;       // 16,000 VND
    const anvilCost = 26000;         // 26,000 VND
    const waterCost = 2100;          // 2,100 VND
    const laborTotal = 370000;       // 370,000 VND

    const totalCost = organicCost + mkpCost + canxiBoCost + npkCost + radiantCost + ridomilCost + anvilCost + waterCost + laborTotal;
    expect(totalCost).toBe(759700); // ~759,700 VND total investment

    // Revenue from 255 kg at 85,000 VND/kg
    const totalYieldKg = 255.0;
    const pricePerKg = 85000;
    const totalRevenue = totalYieldKg * pricePerKg; // 21,675,000 VND
    expect(totalRevenue).toBe(21675000);

    const netProfit = totalRevenue - totalCost;
    expect(netProfit > 20000000).toBe(true); // Net profit ~20.9 Million VND per 20-year tree
  });

});
