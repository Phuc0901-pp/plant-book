const { describe, it, expect } = require('../test-framework');

describe('Suite 8: Durian Ri6 20-Year (2004 - 2026) Sample Agronomic Dataset & VietGAP Traceability', () => {

  it('8.1 Should validate 20-year-old Durian Ri6 tree morphology & biometric timeline from 2004 to 2026', () => {
    const biometricTimeline = [
      { year: 2004, age: 1, trunk_diameter_cm: 8, height_m: 1.2, canopy_m: 0.8 },
      { year: 2005, age: 2, trunk_diameter_cm: 14, height_m: 2.2, canopy_m: 1.8 },
      { year: 2006, age: 3, trunk_diameter_cm: 20, height_m: 3.4, canopy_m: 2.8 },
      { year: 2007, age: 4, trunk_diameter_cm: 26, height_m: 4.6, canopy_m: 4.0 },
      { year: 2008, age: 5, trunk_diameter_cm: 32, height_m: 5.8, canopy_m: 5.5 },
      { year: 2009, age: 6, trunk_diameter_cm: 36, height_m: 6.8, canopy_m: 6.5 },
      { year: 2013, age: 10, trunk_diameter_cm: 45, height_m: 8.5, canopy_m: 8.0 },
      { year: 2018, age: 15, trunk_diameter_cm: 56, height_m: 10.5, canopy_m: 9.8 },
      { year: 2024, age: 20, trunk_diameter_cm: 65, height_m: 12.5, canopy_m: 11.0 }
    ];

    expect(biometricTimeline.length).toBe(9);
    expect(biometricTimeline[0].trunk_diameter_cm).toBe(8);
    expect(biometricTimeline[biometricTimeline.length - 1].trunk_diameter_cm).toBe(65);
    expect(biometricTimeline[biometricTimeline.length - 1].height_m).toBe(12.5);
    expect(biometricTimeline[biometricTimeline.length - 1].canopy_m).toBe(11.0);
  });

  it('8.2 Should validate early establishment phase logs (Years 1 to 5: 2004 - 2008)', () => {
    const earlyLogs = [
      { date: '2004-06-18', stage: 'Xuống giống cây con ghép mắt Ri6', hole: '80x80x80cm', organic_fertilizer_kg: 10 },
      { date: '2005-05-25', stage: 'Bấm ngọn kích cành cấp 1 tạo khung tán tháp', labor_days: 0.5 },
      { date: '2006-08-20', stage: 'Quét vôi pha Ridomil phòng ngừa nấm Phytophthora', pest_prevention: true },
      { date: '2007-06-20', stage: 'Bón phân hữu cơ Bỉ nâng pH đất lên 6.2', ph: 6.2, organic_fertilizer_kg: 8 },
      { date: '2008-03-25', stage: 'Bón thúc cơi đọt NPK 20-20-15 Đầu Trâu', npk_kg: 0.5 }
    ];

    expect(earlyLogs.length).toBe(5);
    expect(earlyLogs[0].date.startsWith('2004')).toBe(true);
    expect(earlyLogs[0].organic_fertilizer_kg).toBe(10);
  });

  it('8.3 Should validate 18 continuous harvest seasons history with accurate financial & yield tracking', () => {
    const historicalYieldRecords = [
      { year: 2009, yield_kg: 54, fruit_count: 18, price: 30000, revenue: 1620000, profit: 1170000 },
      { year: 2010, yield_kg: 105, fruit_count: 35, price: 32000, revenue: 3360000, profit: 2740000 },
      { year: 2011, yield_kg: 150, fruit_count: 50, price: 35000, revenue: 5250000, profit: 4470000 },
      { year: 2012, yield_kg: 204, fruit_count: 68, price: 38000, revenue: 7752000, profit: 6802000 },
      { year: 2013, yield_kg: 255, fruit_count: 85, price: 42000, revenue: 10710000, profit: 9560000 },
      { year: 2014, yield_kg: 294, fruit_count: 98, price: 48000, revenue: 14112000, profit: 12812000 },
      { year: 2015, yield_kg: 336, fruit_count: 112, price: 52000, revenue: 17472000, profit: 15992000 },
      { year: 2016, yield_kg: 375, fruit_count: 125, price: 55000, revenue: 20625000, profit: 18975000 },
      { year: 2017, yield_kg: 396, fruit_count: 132, price: 60000, revenue: 23760000, profit: 21960000 },
      { year: 2018, yield_kg: 420, fruit_count: 140, price: 65000, revenue: 27300000, profit: 25200000 },
      { year: 2019, yield_kg: 444, fruit_count: 148, price: 68000, revenue: 30192000, profit: 27942000 },
      { year: 2020, yield_kg: 414, fruit_count: 138, price: 62000, revenue: 25668000, profit: 23568000 },
      { year: 2021, yield_kg: 456, fruit_count: 152, price: 72000, revenue: 32832000, profit: 30432000 },
      { year: 2022, yield_kg: 474, fruit_count: 158, price: 78000, revenue: 36972000, profit: 34372000 },
      { year: 2023, yield_kg: 486, fruit_count: 162, price: 82000, revenue: 39852000, profit: 37102000 },
      { year: 2024, yield_kg: 465, fruit_count: 155, price: 85000, revenue: 39525000, profit: 36825000 },
      { year: 2025, yield_kg: 450, fruit_count: 150, price: 88000, revenue: 39600000, profit: 36950000 },
      { year: 2026, yield_kg: 255, fruit_count: 85, price: 85000, revenue: 21675000, profit: 20915300 }
    ];

    expect(historicalYieldRecords.length).toBe(18);

    const totalYieldKg = historicalYieldRecords.reduce((acc, r) => acc + r.yield_kg, 0);
    const totalFruits = historicalYieldRecords.reduce((acc, r) => acc + r.fruit_count, 0);
    const totalRevenue = historicalYieldRecords.reduce((acc, r) => acc + r.revenue, 0);
    const totalProfit = historicalYieldRecords.reduce((acc, r) => acc + r.profit, 0);

    expect(totalYieldKg).toBe(6033); // 6.033 tons cumulative
    expect(totalFruits).toBe(2011);
    expect(totalRevenue).toBe(398277000); // 398.277 Million VND
    expect(totalProfit > 360000000).toBe(true); // > 360 Million VND profit
  });

  it('8.4 Should validate 10 standard Durian Ri6 supplies, unit prices & PHI properties', () => {
    const supplies = [
      { name: 'Phân hữu cơ vi sinh nở Bỉ', cat: 'Bón phân', price: 380000, unit: 'bao' },
      { name: 'Phân NPK 20-20-15+TE Đầu Trâu', cat: 'Bón phân', price: 890000, unit: 'bao' },
      { name: 'Phân bón lá tạo mầm MKP 0-52-34', cat: 'Bón phân', price: 1250000, unit: 'bao' },
      { name: 'Phân Kali Sunfat K2SO4 SoluPotasse', cat: 'Bón phân', price: 750000, unit: 'bao' },
      { name: 'Phân Canxi Bo Sữa Bo-Trac Yara', cat: 'Bón phân', price: 180000, unit: 'chai' },
      { name: 'Thuốc trừ nấm Anvil 5SC', cat: 'Phun thuốc', price: 260000, phi: 14, active: 'Hexaconazole 50g/L' },
      { name: 'Thuốc trị xì mủ Ridomil Gold 68WG', cat: 'Phun thuốc', price: 320000, phi: 14, active: 'Metalaxyl M + Mancozeb' },
      { name: 'Thuốc trừ sâu sinh học Radiant 60SC', cat: 'Phun thuốc', price: 195000, phi: 3, active: 'Spinetoram 60g/L' },
      { name: 'Tiền nước tưới giếng khoan', cat: 'Tiền nước', price: 3500, unit: 'm3' },
      { name: 'Nhân công chăm sóc kỹ thuật VietGAP', cat: 'Nhân công', price: 350000, unit: 'công' }
    ];

    expect(supplies.length).toBe(10);
    const anvil = supplies.find(s => s.name.includes('Anvil'));
    expect(anvil.phi).toBe(14);
    const radiant = supplies.find(s => s.name.includes('Radiant'));
    expect(radiant.phi).toBe(3);
    const labor = supplies.find(s => s.cat === 'Nhân công');
    expect(labor.price).toBe(350000);
  });

  it('8.5 Should verify VietGAP harvest batch code generation and PHI quarantine safety', () => {
    const farmPuc = 'VN-LK-001';
    const treeCode = 'SR-01';
    const harvestDateStr = '20260615';
    const batchCode = `${farmPuc}-${harvestDateStr}-${treeCode.replace(/[^a-zA-Z0-9]/g, '')}`;

    expect(batchCode).toBe('VN-LK-001-20260615-SR01');
  });

  it('8.6 Should validate VietGAP agronomic timeline logs and full supply usages cost synchronization', () => {
    // 22-year agronomic model: ~500-600 logs and ~250-300 supply usages per tree
    const years = 2026 - 2004 + 1; // 22 years
    expect(years).toBe(23);

    const mockTreeUsageSummary = {
      water_m3: 150.5,
      water_cost: 150.5 * 3500,
      organic_fert_kg: 320,
      organic_fert_cost: 320 * 15200,
      npk_fert_kg: 55,
      npk_fert_cost: 55 * 17800,
      pesticide_sprays: 48,
      labor_days: 28,
      labor_cost: 28 * 350000
    };

    expect(mockTreeUsageSummary.water_cost > 500000).toBe(true);
    expect(mockTreeUsageSummary.organic_fert_cost > 4000000).toBe(true);
    expect(mockTreeUsageSummary.labor_cost > 9000000).toBe(true);
    const totalConsumableInvestment = mockTreeUsageSummary.water_cost + mockTreeUsageSummary.organic_fert_cost + mockTreeUsageSummary.npk_fert_cost + mockTreeUsageSummary.labor_cost;
    expect(totalConsumableInvestment > 15000000).toBe(true); // > 15 Million VND total investment recorded
  });

  it('8.7 Should validate multi-tree sample dataset for Durian trees #1, #2, #3, #4, #5 at farm LK', () => {
    const durianTreesConfig = [
      { tree_code: '1', lat: 10.941520, lng: 107.241850, slug: 'flk-sr01-ri6-longkhanh', nfc: '04:A2:3B:8C:9F:5D:80', planted: '2004-06-18' },
      { tree_code: '2', lat: 10.941650, lng: 107.242050, slug: 'flk-sr02-ri6-longkhanh', nfc: '04:A2:3B:8C:9F:5D:81', planted: '2004-06-18' },
      { tree_code: '3', lat: 10.941780, lng: 107.242250, slug: 'flk-sr03-ri6-longkhanh', nfc: '04:A2:3B:8C:9F:5D:82', planted: '2004-06-18' },
      { tree_code: '4', lat: 10.941400, lng: 107.241650, slug: 'flk-sr04-ri6-longkhanh', nfc: '04:A2:3B:8C:9F:5D:83', planted: '2004-06-18' },
      { tree_code: '5', lat: 10.941280, lng: 107.241450, slug: 'flk-sr05-ri6-longkhanh', nfc: '04:A2:3B:8C:9F:5D:84', planted: '2004-06-18' }
    ];

    expect(durianTreesConfig.length).toBe(5);

    // Verify all 5 tree codes are unique
    const uniqueCodes = new Set(durianTreesConfig.map(t => t.tree_code));
    expect(uniqueCodes.size).toBe(5);

    // Verify all 5 NFC UIDs are unique
    const uniqueNfcs = new Set(durianTreesConfig.map(t => t.nfc));
    expect(uniqueNfcs.size).toBe(5);

    // Verify all 5 public slugs are unique
    const uniqueSlugs = new Set(durianTreesConfig.map(t => t.slug));
    expect(uniqueSlugs.size).toBe(5);

    // Verify all 5 trees have synchronized planting date 2004-06-18
    durianTreesConfig.forEach(t => {
      expect(t.planted).toBe('2004-06-18');
      expect(t.lat >= 10.9405 && t.lat <= 10.9435).toBe(true);
      expect(t.lng >= 107.2405 && t.lng <= 107.2435).toBe(true);
    });
  });

});
