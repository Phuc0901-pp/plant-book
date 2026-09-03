/**
 * Seed Script: Dữ liệu canh tác mẫu Cây Sầu Riêng Ri6 STT 1 Trọn Vẹn 20 Năm (2004 - 2026)
 * Trang trại Long Khánh (LK Farm) - Chuẩn VietGAP 100% & Quản trị Doanh nghiệp Agri-ERP
 * Chạy: node scripts/seed_durian_ri6_lk.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/db');

async function seedDurianRi6LK() {
  const client = await pool.connect();
  try {
    console.log('🌱 Bắt đầu tạo/cập nhật dữ liệu mẫu Cây Sầu Riêng Ri6 STT 1 (Trang trại LK) Trọn Vẹn 20 Năm (2004 - 2026)...');
    await client.query('BEGIN');

    // ── 1. TÌM TRANG TRẠI "LK" HIỆN HỮU VÀ TÀI KHOẢN NÔNG HỘ SỞ HỮU ──
    const farmRes = await client.query(`
      SELECT * FROM farms 
      WHERE name = 'LK' 
         OR name ILIKE '%LK%' 
         OR name ILIKE '%Long Khánh%' 
         OR puc_code = 'VN-LK-001'
      ORDER BY CASE WHEN name = 'LK' THEN 1 WHEN name ILIKE '%LK%' THEN 2 ELSE 3 END, id ASC
    `);

    let farmId = null;
    let userId = null;
    let farmName = 'LK';

    if (farmRes.rows.length > 0) {
      const targetFarm = farmRes.rows[0];
      farmId = targetFarm.id;
      farmName = targetFarm.name || 'LK';
      userId = targetFarm.user_id;

      // Cập nhật thông số VietGAP cho trang trại LK hiện hữu
      await client.query(`
        UPDATE farms SET 
          puc_code = 'VN-LK-001',
          vietgap_cert_number = 'VG-2026-LK88',
          vietgap_cert_org = 'Quacert Việt Nam',
          allow_shared_supplies = true,
          allow_shared_history = true,
          updated_at = NOW()
        WHERE id = $1
      `, [farmId]);
      console.log(`🏡 Đã tìm thấy và cập nhật chứng nhận VietGAP cho Trang Trại "${farmName}" (ID: ${farmId}, User ID: ${userId})`);
    } else {
      // Tìm user Mathew hoặc admin
      const uRes = await client.query(`
        SELECT id FROM users 
        WHERE full_name ILIKE '%Mathew%' 
           OR phone = '0123456789' 
           OR email = 'nongho.longkhanh@tanbaocorp.vn' 
           OR role = 'admin' 
        ORDER BY id ASC LIMIT 1
      `);
      userId = uRes.rows.length > 0 ? uRes.rows[0].id : 1;

      const farmPolygon = JSON.stringify([
        [107.240500, 10.940500],
        [107.243500, 10.940800],
        [107.243200, 10.942500],
        [107.240200, 10.942200],
        [107.240500, 10.940500]
      ]);

      const newFarm = await client.query(`
        INSERT INTO farms (
          user_id, name, area, total_plants, puc_code, vietgap_cert_number, vietgap_cert_org,
          latitude, longitude, polygon_coordinates, allow_shared_supplies, allow_shared_history
        ) VALUES ($1, 'LK', 0.57, 6, 'VN-LK-001', 'VG-2026-LK88', 'Quacert Việt Nam', 10.941200, 107.241500, $2, true, true)
        RETURNING id
      `, [userId, farmPolygon]);
      farmId = newFarm.rows[0].id;
      farmName = 'LK';
      console.log(`🏡 Đã tạo mới Trang Trại "LK" (ID: ${farmId})`);
    }

    // Lấy danh sách tất cả User IDs liên quan (Chủ vườn Mathew, Admin, Nông hộ liên kết)
    const allRelatedUsersRes = await client.query(`
      SELECT id FROM users 
      WHERE id = $1 
         OR farm_id = $2 
         OR full_name ILIKE '%Mathew%' 
         OR phone = '0123456789'
         OR role = 'admin'
    `, [userId, farmId]);
    const userIdsToSeed = allRelatedUsersRes.rows.map(r => r.id);

    // ── 2. TẠO 9 VẬT TƯ CHUYÊN DỤNG CANH TÁC SẦU RIÊNG RI6 CHO CÁC TÀI KHOẢN LIÊN QUAN ──
    const suppliesData = [
      {
        name: 'Phân hữu cơ vi sinh nở Bỉ (Belgo Organic)',
        category: 'Bón phân',
        fertilizer_type: 'Phân hữu cơ',
        unit: 'bao',
        package_size: 'Bao 25kg',
        package_qty: 25,
        package_unit: 'kg',
        package_price: 380000,
        unit_price: 380000,
        unit_price_small: 15200,
        stock_quantity: 120,
        image_url: 'https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?w=600&auto=format&fit=crop&q=80',
        phi_days: 0,
        active_ingredient: 'Chất hữu cơ 65%, Axit Humic 8%, Nấm đối kháng Trichoderma',
        target_pests: 'Cải tạo độ tơi xốp của đất, phục hồi bộ rễ tơ sau thu hoạch',
        note: 'Dùng bón phục hồi cành tán và bón lót đầu mùa mưa'
      },
      {
        name: 'Phân NPK 20-20-15+TE Đầu Trâu Chuyên Cây Ăn Trái',
        category: 'Bón phân',
        fertilizer_type: 'Phân vô cơ (NPK / Hóa học)',
        unit: 'bao',
        package_size: 'Bao 50kg',
        package_qty: 50,
        package_unit: 'kg',
        package_price: 890000,
        unit_price: 890000,
        unit_price_small: 17800,
        stock_quantity: 80,
        image_url: 'https://images.unsplash.com/photo-1628352081506-83c43123ed6d?w=600&auto=format&fit=crop&q=80',
        phi_days: 0,
        active_ingredient: 'N: 20%, P2O5: 20%, K2O: 15% + Vi lượng TE (Bo, Zn, Cu)',
        target_pests: 'Cung cấp dinh dưỡng đa lượng cân đối nuôi đọt và nuôi trái non lớn nhanh',
        note: 'Bón giai đoạn sau khi đậu trái từ 30 đến 70 ngày'
      },
      {
        name: 'Phân bón lá tạo mầm hoa MKP 0-52-34 Haifa Israel',
        category: 'Bón phân',
        fertilizer_type: 'Phân bón lá',
        unit: 'bao',
        package_size: 'Bao 25kg',
        package_qty: 25,
        package_unit: 'kg',
        package_price: 1250000,
        unit_price: 1250000,
        unit_price_small: 50000,
        stock_quantity: 40,
        image_url: 'https://images.unsplash.com/photo-1592417817098-8f3d6910985c?w=600&auto=format&fit=crop&q=80',
        phi_days: 0,
        active_ingredient: 'P2O5 hữu hiệu: 52%, K2O hữu hiệu: 34%',
        target_pests: 'Chặn đọt non, kích thích phân hóa mầm hoa đồng loạt trong mùa xử lý nghịch vụ',
        note: 'Pha 500g cho phuy 200 lít nước xịt đều tán lá khi xiết nước'
      },
      {
        name: 'Phân Kali Trắng Sunfat K2SO4 SoluPotasse 0-0-50',
        category: 'Bón phân',
        fertilizer_type: 'Phân vô cơ (NPK / Hóa học)',
        unit: 'bao',
        package_size: 'Bao 25kg',
        package_qty: 25,
        package_unit: 'kg',
        package_price: 750000,
        unit_price: 750000,
        unit_price_small: 30000,
        stock_quantity: 50,
        image_url: 'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=600&auto=format&fit=crop&q=80',
        phi_days: 0,
        active_ingredient: 'K2O: 50%, S: 18% (Không chứa Clo chống sượng múi)',
        target_pests: 'Vỗ béo trái, tạo độ ngọt đậm đà, giúp múi sầu riêng vàng ươm ráo cơm',
        note: 'Bón trước khi thu hoạch 30 - 45 ngày'
      },
      {
        name: 'Phân bón lá Canxi Bo Sữa Bo-Trac Yara Anh Quốc',
        category: 'Bón phân',
        fertilizer_type: 'Phân vi lượng / Trung lượng',
        unit: 'chai',
        package_size: 'Chai 1 Lít',
        package_qty: 1000,
        package_unit: 'ml',
        package_price: 180000,
        unit_price: 180000,
        unit_price_small: 180,
        stock_quantity: 60,
        image_url: 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=600&auto=format&fit=crop&q=80',
        phi_days: 0,
        active_ingredient: 'Canxi (CaO): 15%, Bo hữu hiệu: 150g/L',
        target_pests: 'Tăng sức sống hạt phấn, chống rụng hoa và nứt cuống trái non',
        note: 'Phun định kỳ 10 ngày/lần từ lúc nhú mắt cua đến khi đậu trái ổn định'
      },
      {
        name: 'Thuốc trừ nấm bệnh Anvil 5SC (Syngenta)',
        category: 'Phun thuốc',
        unit: 'chai',
        package_size: 'Chai 1 Lít',
        package_qty: 1000,
        package_unit: 'ml',
        package_price: 260000,
        unit_price: 260000,
        unit_price_small: 260,
        stock_quantity: 45,
        image_url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&auto=format&fit=crop&q=80',
        phi_days: 14,
        active_ingredient: 'Hexaconazole 50g/L',
        target_pests: 'Nấm thán thư (Colletotrichum), nấm hồng, đốm lá, rỉ sắt',
        note: 'Thời gian cách ly an toàn PHI 14 ngày trước thu hoạch'
      },
      {
        name: 'Thuốc đặc trị nứt thân xì mủ Ridomil Gold 68WG',
        category: 'Phun thuốc',
        unit: 'gói',
        package_size: 'Gói 1kg',
        package_qty: 1000,
        package_unit: 'g',
        package_price: 320000,
        unit_price: 320000,
        unit_price_small: 320,
        stock_quantity: 50,
        image_url: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?w=600&auto=format&fit=crop&q=80',
        phi_days: 14,
        active_ingredient: 'Metalaxyl M 40g/kg + Mancozeb 640g/kg',
        target_pests: 'Nấm Phytophthora palmivora gây xì mủ thân, thối rễ, cháy lá',
        note: 'Quét trực tiếp lên vết cạo xì mủ hoặc tưới đẫm gốc'
      },
      {
        name: 'Thuốc trừ sâu rầy sinh học Radiant 60SC',
        category: 'Phun thuốc',
        unit: 'chai',
        package_size: 'Chai 250ml',
        package_qty: 250,
        package_unit: 'ml',
        package_price: 195000,
        unit_price: 195000,
        unit_price_small: 780,
        stock_quantity: 40,
        image_url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
        phi_days: 3,
        active_ingredient: 'Spinetoram 60g/L (Gốc sinh học lên men Saccharopolyspora)',
        target_pests: 'Rầy phấn trắng, bọ trĩ chích hút hoa, sâu đục cuống trái',
        note: 'Gốc sinh học thân thiện thiên địch, thời gian cách ly chỉ 3 ngày'
      },
      {
        name: 'Tiền nước tưới giếng khoan công nghiệp',
        category: 'Tiền nước',
        unit: 'm3',
        package_size: 'Khối nước (m³)',
        package_qty: 1000,
        package_unit: 'lít',
        package_price: 3500,
        unit_price: 3500,
        unit_price_small: 3.5,
        stock_quantity: 999999,
        image_url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop&q=80',
        phi_days: 0,
        active_ingredient: 'Nước ngầm tầng sâu qua lọc thô khử phèn',
        target_pests: 'Cung cấp độ ẩm chuẩn cho hệ thống béc tưới gốc',
        note: 'Định mức tiêu chuẩn 500 - 800 lít/cây/lần tưới'
      }
    ];

    const supplyMap = {};
    for (const uId of userIdsToSeed) {
      for (const sup of suppliesData) {
        const existing = await client.query(
          `SELECT id FROM supplies WHERE user_id = $1 AND category = $2 AND LOWER(name) = LOWER($3)`,
          [uId, sup.category, sup.name.trim()]
        );

        if (existing.rows.length > 0) {
          supplyMap[sup.name] = existing.rows[0].id;
          await client.query(`
            UPDATE supplies SET
              package_size = $1, package_qty = $2, package_unit = $3,
              package_price = $4, unit_price = $5, unit_price_small = $6,
              stock_quantity = $7, image_url = $8, phi_days = $9,
              active_ingredient = $10, target_pests = $11, note = $12, fertilizer_type = $13,
              farm_id = $14, updated_at = NOW()
            WHERE id = $15
          `, [
            sup.package_size, sup.package_qty, sup.package_unit,
            sup.package_price, sup.unit_price, sup.unit_price_small,
            sup.stock_quantity, sup.image_url, sup.phi_days,
            sup.active_ingredient, sup.target_pests, sup.note, sup.fertilizer_type || null,
            farmId, existing.rows[0].id
          ]);
        } else {
          const ins = await client.query(`
            INSERT INTO supplies (
              user_id, category, name, unit, package_size, package_qty, package_unit,
              package_price, unit_price, unit_price_small, stock_quantity, note,
              image_url, fertilizer_type, phi_days, active_ingredient, target_pests, farm_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING id
          `, [
            uId, sup.category, sup.name, sup.unit, sup.package_size, sup.package_qty, sup.package_unit,
            sup.package_price, sup.unit_price, sup.unit_price_small, sup.stock_quantity, sup.note,
            sup.image_url, sup.fertilizer_type || null, sup.phi_days, sup.active_ingredient, sup.target_pests, farmId
          ]);
          supplyMap[sup.name] = ins.rows[0].id;
        }
      }
    }
    console.log(`📦 Đã đồng bộ danh mục 9 vật tư sầu riêng Ri6 cho các tài khoản liên quan`);

    // ── 3. THIẾT LẬP DỮ LIỆU LỊCH SỬ NĂNG SUẤT & DOANH THU 20 MÙA VỤ (2007 - 2026) ──
    const historicalYieldRecords = [
      { year: 2009, tree_age: 6, fruit_count: 18, yield_kg: 54, avg_price_vnd: 30000, revenue_vnd: 1620000, expense_vnd: 450000, profit_vnd: 1170000, grade_1_pct: 75, brix: '30°', note: 'Vụ bói đầu tiên (dưỡng cây)' },
      { year: 2010, tree_age: 7, fruit_count: 35, yield_kg: 105, avg_price_vnd: 32000, revenue_vnd: 3360000, expense_vnd: 620000, profit_vnd: 2740000, grade_1_pct: 80, brix: '31°', note: 'Bắt đầu cho trái thương phẩm' },
      { year: 2011, tree_age: 8, fruit_count: 50, yield_kg: 150, avg_price_vnd: 35000, revenue_vnd: 5250000, expense_vnd: 780000, profit_vnd: 4470000, grade_1_pct: 82, brix: '31°', note: 'Lắp béc tưới gốc tự động' },
      { year: 2012, tree_age: 9, fruit_count: 68, yield_kg: 204, avg_price_vnd: 38000, revenue_vnd: 7752000, expense_vnd: 950000, profit_vnd: 6802000, grade_1_pct: 85, brix: '32°', note: 'Xử lý nứt thân xì mủ thành công' },
      { year: 2013, tree_age: 10, fruit_count: 85, yield_kg: 255, avg_price_vnd: 42000, revenue_vnd: 10710000, expense_vnd: 1150000, profit_vnd: 9560000, grade_1_pct: 85, brix: '32°', note: 'Cây đạt 10 năm, gốc tròn 40cm' },
      { year: 2014, tree_age: 11, fruit_count: 98, yield_kg: 294, avg_price_vnd: 48000, revenue_vnd: 14112000, expense_vnd: 1300000, profit_vnd: 12812000, grade_1_pct: 86, brix: '32°', note: 'Bắt đầu đạt tiêu chuẩn VietGAP' },
      { year: 2015, tree_age: 12, fruit_count: 112, yield_kg: 336, avg_price_vnd: 52000, revenue_vnd: 17472000, expense_vnd: 1480000, profit_vnd: 15992000, grade_1_pct: 88, brix: '32°', note: 'Buộc dây chống gió giông lốc' },
      { year: 2016, tree_age: 13, fruit_count: 125, yield_kg: 375, avg_price_vnd: 55000, revenue_vnd: 20625000, expense_vnd: 1650000, profit_vnd: 18975000, grade_1_pct: 88, brix: '33°', note: 'Năng suất vào giai đoạn ổn định' },
      { year: 2017, tree_age: 14, fruit_count: 132, yield_kg: 396, avg_price_vnd: 60000, revenue_vnd: 23760000, expense_vnd: 1800000, profit_vnd: 21960000, grade_1_pct: 90, brix: '33°', note: 'Đăng ký Mã vùng trồng xuất khẩu' },
      { year: 2018, tree_age: 15, fruit_count: 140, yield_kg: 420, avg_price_vnd: 65000, revenue_vnd: 27300000, expense_vnd: 2100000, profit_vnd: 25200000, grade_1_pct: 90, brix: '33°', note: 'Vụ mùa bội thu giá cao' },
      { year: 2019, tree_age: 16, fruit_count: 148, yield_kg: 444, avg_price_vnd: 68000, revenue_vnd: 30192000, expense_vnd: 2250000, profit_vnd: 27942000, grade_1_pct: 92, brix: '33°', note: 'Chuyển đổi phân hữu cơ Bỉ 100%' },
      { year: 2020, tree_age: 17, fruit_count: 138, yield_kg: 414, avg_price_vnd: 62000, revenue_vnd: 25668000, expense_vnd: 2100000, profit_vnd: 23568000, grade_1_pct: 88, brix: '32°', note: 'Thời tiết khô hạn kéo dài' },
      { year: 2021, tree_age: 18, fruit_count: 152, yield_kg: 456, avg_price_vnd: 72000, revenue_vnd: 32832000, expense_vnd: 2400000, profit_vnd: 30432000, grade_1_pct: 92, brix: '33°', note: 'Lắp trạm cảm biến IoT đất' },
      { year: 2022, tree_age: 19, fruit_count: 158, yield_kg: 474, avg_price_vnd: 78000, revenue_vnd: 36972000, expense_vnd: 2600000, profit_vnd: 34372000, grade_1_pct: 94, brix: '34°', note: 'Gắn thẻ định danh chip NFC' },
      { year: 2023, tree_age: 20, fruit_count: 162, yield_kg: 486, avg_price_vnd: 82000, revenue_vnd: 39852000, expense_vnd: 2750000, profit_vnd: 37102000, grade_1_pct: 95, brix: '34°', note: 'Đạt năng suất kỷ lục vụ chính' },
      { year: 2024, tree_age: 21, fruit_count: 155, yield_kg: 465, avg_price_vnd: 85000, revenue_vnd: 39525000, expense_vnd: 2700000, profit_vnd: 36825000, grade_1_pct: 95, brix: '34°', note: 'Xuất khẩu chính ngạch sang TQ' },
      { year: 2025, tree_age: 22, fruit_count: 150, yield_kg: 450, avg_price_vnd: 88000, revenue_vnd: 39600000, expense_vnd: 2650000, profit_vnd: 36950000, grade_1_pct: 95, brix: '34°', note: 'Canh tác VietGAP toàn diện' },
      { year: 2026, tree_age: 23, fruit_count: 85, yield_kg: 255, avg_price_vnd: 85000, revenue_vnd: 21675000, expense_vnd: 759700, profit_vnd: 20915300, grade_1_pct: 95, brix: '32°', note: 'Vụ mùa hiện tại (Đợt 1 VietGAP)' }
    ];

    const biometricTimeline = [
      { year: 2004, age: 1, trunk_diameter_cm: 8, height_m: 1.2, canopy_m: 0.8, phase: 'Xuống giống cây con' },
      { year: 2005, age: 2, trunk_diameter_cm: 12, height_m: 2.2, canopy_m: 1.8, phase: 'Bấm đọt phân cành cấp 1' },
      { year: 2006, age: 3, trunk_diameter_cm: 16, height_m: 3.2, canopy_m: 2.8, phase: 'Tạo tán hình tháp thông thoáng' },
      { year: 2007, age: 4, trunk_diameter_cm: 22, height_m: 4.5, canopy_m: 4.0, phase: 'Sinh khối phát triển vượt bậc' },
      { year: 2008, age: 5, trunk_diameter_cm: 28, height_m: 5.8, canopy_m: 5.5, phase: 'Chuẩn bị thể trạng đón trái bói' },
      { year: 2009, age: 6, trunk_diameter_cm: 32, height_m: 6.8, canopy_m: 6.5, phase: 'Vụ bói đầu tiên (18 trái)' },
      { year: 2013, age: 10, trunk_diameter_cm: 42, height_m: 8.5, canopy_m: 8.0, phase: 'Cây 10 năm tuổi thương phẩm' },
      { year: 2018, age: 15, trunk_diameter_cm: 54, height_m: 10.5, canopy_m: 9.8, phase: 'Đạt đỉnh cao sinh học' },
      { year: 2024, age: 20, trunk_diameter_cm: 65, height_m: 12.5, canopy_m: 11.0, phase: 'Cổ thụ 20 năm kinh doanh cực thịnh' }
    ];

    const treeData = {
      trunk_diameter_cm: 65,
      height_m: 12.5,
      canopy_diameter_m: 11.0,
      average_yield_kg: 450,
      planting_year: 2004,
      rootstock: 'Gốc ghép sầu riêng hạt bản địa Long Khánh',
      current_season_target_fruits: 140,
      irrigation_system: 'Béc tưới bù áp tự động 120L/h (3 béc quanh tán)',
      historical_yield_records: historicalYieldRecords,
      biometric_timeline: biometricTimeline,
      lifetime_summary: {
        total_seasons: historicalYieldRecords.length,
        total_fruits_harvested: 2011,
        total_yield_kg: 6033,
        total_revenue_vnd: 398277000,
        total_expense_vnd: 30269700,
        total_net_profit_vnd: 368007300
      }
    };

    // ── 4. TÌM HOẶC CẬP NHẬT CÂY SẦU RIÊNG STT 1 TRONG TRANG TRẠI LK ──
    let plantId = null;
    const existingPlantsInFarm = await client.query(`
      SELECT * FROM plants 
      WHERE farm_id = $1 
      ORDER BY CASE WHEN tree_code = '1' OR tree_code = 'SR-01' OR tree_code ILIKE '%1%' THEN 1 ELSE 2 END, id ASC
    `, [farmId]);

    const coverImg = 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=800&auto=format&fit=crop&q=80';

    if (existingPlantsInFarm.rows.length > 0) {
      const targetPlant = existingPlantsInFarm.rows[0];
      plantId = targetPlant.id;
      const originalTreeCode = targetPlant.tree_code || '1';

      await client.query(`
        UPDATE plants SET
          plant_type = 'Sầu riêng',
          plant_variety = 'Ri6 Cổ Thụ (20 Năm Tuổi)',
          plant_age = '20 năm tuổi',
          health_status = 'Tốt',
          location = COALESCE(location, 'Lô A1 - Hàng 1 - Cây STT 1 (Cây đầu hồi cổng chính)'),
          tree_code = $1,
          nfc_uid = COALESCE(nfc_uid, '04:A2:3B:8C:9F:5D:80'),
          public_slug = COALESCE(public_slug, 'flk-sr01-ri6-longkhanh'),
          cover_image = $2,
          is_public = true,
          data = $3,
          phi_status = 'safe',
          phi_until_date = '2026-06-04',
          last_pesticide_date = '2026-05-20',
          last_pesticide_name = 'Thuốc trừ nấm bệnh Anvil 5SC (Syngenta)',
          updated_at = NOW()
        WHERE id = $4
      `, [originalTreeCode, coverImg, JSON.stringify(treeData), plantId]);
      console.log(`🌳 Đã cập nhật Cây Sầu Riêng STT ${originalTreeCode} (ID: ${plantId}) trong Trang trại "${farmName}"`);
    } else {
      const newPlant = await client.query(`
        INSERT INTO plants (
          farm_id, created_by, plant_type, plant_variety, plant_age, health_status,
          location, tree_code, nfc_uid, public_slug, latitude, longitude,
          cover_image, is_public, data, phi_status, phi_until_date,
          last_pesticide_date, last_pesticide_name
        ) VALUES (
          $1, $2, 'Sầu riêng', 'Ri6 Cổ Thụ (20 Năm Tuổi)', '20 năm tuổi', 'Tốt',
          'Lô A1 - Hàng 1 - Cây STT 1 (Cây đầu hồi cổng chính)', '1',
          '04:A2:3B:8C:9F:5D:80', 'flk-sr01-ri6-longkhanh', 10.941520, 107.241850,
          $3, true, $4, 'safe', '2026-06-04', '2026-05-20', 'Thuốc trừ nấm bệnh Anvil 5SC (Syngenta)'
        ) RETURNING id
      `, [farmId, userId, coverImg, JSON.stringify(treeData)]);
      plantId = newPlant.rows[0].id;
      console.log(`🌳 Đã tạo mới Cây Sầu Riêng STT 1 (ID: ${plantId}) trong Trang trại "${farmName}"`);
    }

    // ── 5. TẠO TOÀN BỘ NHẬT KÝ CANH TÁC TRỌNG YẾU TỪ 2004 ĐẾN 2026 (22 BẢN GHI) ──
    await client.query(`DELETE FROM plant_logs WHERE plant_id = $1`, [plantId]);

    const logsList = [
      // ── GIAI ĐOẠN 1: KIẾN THIẾT CƠ BẢN (2004 - 2009) ──
      {
        log_date: '2004-06-18',
        log_type: 'Khác',
        operator_name: 'Ông Nguyễn Văn An (Chủ vườn đời đầu)',
        equipment_used: 'Cuốc đào hố & Cọc tre định vị',
        note: 'Xuống giống cây con ghép mắt Sầu riêng Ri6 thuần chủng. Đào hố 80x80x80cm, bón lót 10kg phân chuồng hoai mục + 0.5kg lân nung chảy Văn Điển. Cắm 3 cọc tre chéo giữ gốc và che lưới lan 50% chống nắng hướng tây.',
        media_urls: ['https://images.unsplash.com/photo-1592417817098-8f3d6910985c?w=600&auto=format&fit=crop&q=80'],
        details: { phase: 'Xuống giống khởi tạo', planting_cost: 120000, rootstock: 'Gốc sầu riêng hạt' }
      },
      {
        log_date: '2005-05-20',
        log_type: 'Cắt tỉa',
        operator_name: 'Nguyễn Văn An',
        equipment_used: 'Kéo cắt cành mũi nhọn',
        note: 'Cây được 1 năm tuổi, đạt chiều cao 1.0m. Tiến hành bấm ngọn thân chính để kích thích phát triển 4 cành cấp 1 tỏa đều 4 hướng. Bón thúc NPK 30-10-10 kích cơi đọt 2 bung mạnh.',
        media_urls: ['https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?w=600&auto=format&fit=crop&q=80'],
        details: { phase: 'Bấm đọt tạo cành cấp 1', trunk_diameter_cm: 12, height_m: 2.2 }
      },
      {
        log_date: '2006-08-15',
        log_type: 'Cắt tỉa',
        operator_name: 'Nguyễn Văn Long',
        equipment_used: 'Kéo cắt tỉa & Chổi quét vôi',
        note: 'Tỉa cành tạo tán hình tháp thông thoáng. Cắt bỏ cành tăm, cành mọc hướng tâm trong thân. Quét vôi gốc cây phòng trừ nấm hồng và rệp sáp đầu mùa mưa.',
        media_urls: ['https://images.unsplash.com/photo-1628352081506-83c43123ed6d?w=600&auto=format&fit=crop&q=80'],
        details: { phase: 'Định hình tán tháp 3 năm tuổi', trunk_diameter_cm: 16, height_m: 3.2 }
      },
      {
        log_date: '2007-07-10',
        log_type: 'Bón phân',
        operator_name: 'Nguyễn Văn Long',
        equipment_used: 'Thùng rải phân',
        note: 'Cây 4 năm tuổi phát triển sinh khối mạnh mẽ. Bón 10kg phân hữu cơ vi sinh Bỉ kết hợp rải 2kg vôi bột khử chua, nâng pH đất từ 4.8 lên 6.2.',
        media_urls: ['https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=600&auto=format&fit=crop&q=80'],
        details: { phase: 'Nuôi khung tán 4 năm tuổi', trunk_diameter_cm: 22, height_m: 4.5 }
      },
      {
        log_date: '2008-11-25',
        log_type: 'Khác',
        operator_name: 'Nguyễn Văn Long',
        equipment_used: 'Kéo cắt cành & Bạt phủ đất',
        note: 'Chuẩn bị thể trạng đón vụ trái bói. Tỉa sạch toàn bộ cành la sát đất (cách mặt đất 0.8m). Thử nghiệm xiết nước tạo hạn 15 ngày kích mắt cua.',
        media_urls: ['https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=600&auto=format&fit=crop&q=80'],
        details: { phase: 'Chuẩn bị đón trái bói 5 năm tuổi', trunk_diameter_cm: 28, height_m: 5.8 }
      },
      {
        log_date: '2009-06-20',
        log_type: 'Thu hoạch',
        operator_name: 'Nguyễn Văn Long',
        equipment_used: 'Dao cắt sầu riêng & Thùng lót rơm',
        note: 'VỤ THU HOẠCH BÓI ĐẦU TIÊN (Năm thứ 6): Thu hoạch 18 trái bói (~54kg). Chủ động tỉa bỏ 70% trái non từ trước để dưỡng cây không bị suy kiệt. Doanh thu đầu đời: 1,620,000 VNĐ.',
        media_urls: ['https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=600&auto=format&fit=crop&q=80'],
        batch_code: 'VN-LK-001-20090620-SR01',
        details: { phase: 'Vụ bói đầu đời', yield_kg: 54, fruit_count: 18, price_vnd: 30000, revenue_vnd: 1620000, net_profit_vnd: 1170000 }
      },

      // ── GIAI ĐOẠN 2: TĂNG TRƯỞNG KINH DOANH & CỘT MỐC LỊCH SỬ (2011 - 2023) ──
      {
        log_date: '2011-04-10',
        log_type: 'Khác',
        operator_name: 'Đội thi công AgriTech',
        equipment_used: 'Máy hàn ống HDPE & Béc tưới bù áp',
        note: 'Lắp đặt hệ thống tưới tự động bù áp 3 béc quanh gốc cây. Cây 8 năm tuổi đạt sản lượng 50 trái (~150kg), doanh thu 5,250,000 VNĐ.',
        media_urls: ['https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop&q=80'],
        details: { phase: 'Hiện đại hóa tưới tự động', yield_kg: 150, fruit_count: 50, revenue_vnd: 5250000 }
      },
      {
        log_date: '2013-06-25',
        log_type: 'Thu hoạch',
        operator_name: 'Kỹ sư Nguyễn Văn Long',
        equipment_used: 'Dao cắt chuyên dụng',
        note: 'CỘT MỐC 10 NĂM TUỔI: Đường kính gốc đạt 42cm, tán lá 8m. Vụ mùa đạt 85 trái (~255kg), doanh thu vượt mốc 10.7 triệu VNĐ. Bắt đầu áp dụng quy trình canh tác an toàn VietGAP.',
        media_urls: ['https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=600&auto=format&fit=crop&q=80'],
        batch_code: 'VN-LK-001-20130625-SR01',
        details: { phase: 'Cột mốc 10 năm tuổi', yield_kg: 255, fruit_count: 85, price_vnd: 42000, revenue_vnd: 10710000, net_profit_vnd: 9560000 }
      },
      {
        log_date: '2017-06-18',
        log_type: 'Thu hoạch',
        operator_name: 'Nguyễn Văn Long & Đội thu hoạch',
        equipment_used: 'Dao cắt sầu riêng & Xe tải thùng lạnh',
        note: 'CỘT MỐC CẤP MÃ PUC XUẤT KHẨU: Trang trại chính thức được cấp Mã số Vùng trồng VN-LK-001. Thu hoạch 132 trái (~396kg), doanh thu đạt 23,760,000 VNĐ.',
        media_urls: ['https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=600&auto=format&fit=crop&q=80'],
        batch_code: 'VN-LK-001-20170618-SR01',
        puc_code: 'VN-LK-001',
        details: { phase: 'Cột mốc cấp mã PUC xuất khẩu', yield_kg: 396, fruit_count: 132, price_vnd: 60000, revenue_vnd: 23760000, net_profit_vnd: 21960000 }
      },
      {
        log_date: '2021-03-12',
        log_type: 'Khác',
        operator_name: 'Tân Bảo AgTech IoT Team',
        equipment_used: 'Trạm cảm biến NPK & Độ ẩm đất đa tầng',
        note: 'Lắp đặt đầu dò cảm biến IoT đo độ ẩm tầng 10-20-50cm và độ pH/EC đất dưới tán cây. Cây 18 năm tuổi cho 152 trái (~456kg), doanh thu đạt 32.8 triệu VNĐ.',
        media_urls: ['https://images.unsplash.com/photo-1589923188900-85dae523342b?w=600&auto=format&fit=crop&q=80'],
        details: { phase: 'Tích hợp cảm biến IoT Smart Farm', yield_kg: 456, fruit_count: 152, price_vnd: 72000, revenue_vnd: 32832000 }
      },
      {
        log_date: '2023-06-22',
        log_type: 'Thu hoạch',
        operator_name: 'Nguyễn Văn Long & Đội xuất khẩu',
        equipment_used: 'Dao cắt mũi cong & Giỏ đệm mút xốp',
        note: 'CỘT MỐC 20 NĂM TUỔI KỶ LỤC: Cây đạt năng suất cao nhất lịch sử với 162 trái (~486kg), cơm vàng hạt lép 95%, doanh thu đạt kỷ lục 39,852,000 VNĐ.',
        media_urls: ['https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=600&auto=format&fit=crop&q=80'],
        batch_code: 'VN-LK-001-20230622-SR01',
        puc_code: 'VN-LK-001',
        details: { phase: 'Kỷ lục năng suất 20 năm tuổi', yield_kg: 486, fruit_count: 162, price_vnd: 82000, revenue_vnd: 39852000, net_profit_vnd: 37102000 }
      },

      // ── GIAI ĐOẠN 3: VỤ MÙA CANH TÁC HIỆN TẠI (2025 - 2026 CHUẨN VIETGAP 100%) ──
      {
        log_date: '2025-09-10',
        log_type: 'Cắt tỉa',
        operator_name: 'Kỹ sư Nguyễn Văn Long',
        equipment_used: 'Kéo cắt cành Gardena & Thang nhôm rút',
        note: 'Cắt tỉa cành tăm, cành sâu bệnh, chồi vượt trong thân và hạ ngọn thông thoáng tán sau khi kết thúc thu hoạch vụ trước.',
        media_urls: ['https://images.unsplash.com/photo-1592417817098-8f3d6910985c?w=600&auto=format&fit=crop&q=80'],
        details: { activity: 'Tỉa cành phục hồi', labor_cost: 150000, note: 'Cắt bỏ 12 cành khô và bôi keo liền sẹo Tiến Nông vào các vết cắt lớn' }
      },
      {
        log_date: '2025-09-25',
        log_type: 'Bón phân',
        operator_name: 'Trần Văn Ba (Thợ vườn)',
        equipment_used: 'Cuốc xới nhẹ & Thùng rải phân',
        note: 'Bón lót phục hồi bộ rễ tơ bằng Phân hữu cơ vi sinh nở Bỉ quanh hình chiếu tán cây, tưới đẫm nước.',
        media_urls: ['https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?w=600&auto=format&fit=crop&q=80'],
        details: {
          supply_id: supplyMap['Phân hữu cơ vi sinh nở Bỉ (Belgo Organic)'],
          supply_name: 'Phân hữu cơ vi sinh nở Bỉ (Belgo Organic)',
          quantity: 15,
          unit: 'kg',
          unit_price: 15200,
          total_cost: 228000,
          note: 'Rải đều cách gốc 1.5m đến mép tán lá'
        }
      },
      {
        log_date: '2025-10-15',
        log_type: 'Tưới nước',
        operator_name: 'Hệ thống tự động',
        equipment_used: 'Trạm bơm điều khiển van thông minh',
        note: 'Tưới định kỳ duy trì ẩm độ đất tầng rễ 65% - 75% giúp cây bung cơi đọt 1 đồng loạt khỏe mạnh.',
        media_urls: ['https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop&q=80'],
        details: {
          supply_id: supplyMap['Tiền nước tưới giếng khoan công nghiệp'],
          supply_name: 'Tiền nước tưới giếng khoan công nghiệp',
          quantity: 0.6,
          unit: 'm3',
          unit_price: 3500,
          total_cost: 2100,
          soil_moisture_before: '52%',
          soil_moisture_after: '72%'
        }
      },
      {
        log_date: '2025-11-20',
        log_type: 'Bón phân',
        operator_name: 'Kỹ sư Nguyễn Văn Long',
        equipment_used: 'Máy bay phun thuốc nông nghiệp DJI Agras T40',
        note: 'Xiết nước tạo khô hạn 25 ngày và phun phân bón lá MKP 0-52-34 ức chế đọt non, kích thích phân hóa mầm hoa (mắt cua).',
        media_urls: ['https://images.unsplash.com/photo-1628352081506-83c43123ed6d?w=600&auto=format&fit=crop&q=80'],
        details: {
          supply_id: supplyMap['Phân bón lá tạo mầm hoa MKP 0-52-34 Haifa Israel'],
          supply_name: 'Phân bón lá tạo mầm hoa MKP 0-52-34 Haifa Israel',
          quantity: 0.5,
          unit: 'kg',
          unit_price: 50000,
          total_cost: 25000,
          phi_days: 0,
          note: 'Phun mặt dưới lá già và toàn bộ cành mang trái'
        }
      },
      {
        log_date: '2025-12-25',
        log_type: 'Bón phân',
        operator_name: 'Nguyễn Văn Long',
        equipment_used: 'Bình xịt điện Stihl SR-420',
        note: 'Mắt cua sáng đều dài 3cm. Phun Canxi Bo Sữa Yara nuôi dưỡng chùm hoa mập mạp, tăng độ dai cuống và chống rụng nụ.',
        media_urls: ['https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=600&auto=format&fit=crop&q=80'],
        details: {
          supply_id: supplyMap['Phân bón lá Canxi Bo Sữa Bo-Trac Yara Anh Quốc'],
          supply_name: 'Phân bón lá Canxi Bo Sữa Bo-Trac Yara Anh Quốc',
          quantity: 100,
          unit: 'ml',
          unit_price: 180,
          total_cost: 18000,
          phi_days: 0
        }
      },
      {
        log_date: '2026-01-15',
        log_type: 'Thụ phấn',
        operator_name: 'Tổ kỹ thuật vườn (3 nhân công)',
        equipment_used: 'Chổi lông cọ mềm & Đèn đội đầu siêu sáng',
        note: 'Thực hiện quét phấn bổ sung nhân tạo chéo từ 18h30 đến 20h00 tối. Tỷ lệ hoa thụ phấn đạt trên 90%, hạt phấn bung đều 5 hộc.',
        media_urls: ['https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=600&auto=format&fit=crop&q=80'],
        details: {
          activity: 'Thụ phấn chéo nhân tạo',
          labor_cost: 120000,
          note: 'Lấy hạt phấn từ giống sầu riêng Monthong quét sang nhụy hoa Ri6 để tăng tỷ lệ đậu trái hộc đầy đặn'
        }
      },
      {
        log_date: '2026-02-10',
        log_type: 'Cắt tỉa',
        operator_name: 'Kỹ sư Nguyễn Văn Long',
        equipment_used: 'Kéo tỉa cuống chuyên dụng & Thang chữ A',
        note: 'Tỉa định trái đợt 1 (trái cỡ quả trứng ngỗng). Cắt bỏ toàn bộ trái vẹo, méo hộc, sâu cuống. Tuyển chọn giữ lại 140 trái tròn đẹp trên cành cấp 1.',
        media_urls: ['https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&auto=format&fit=crop&q=80'],
        details: {
          activity: 'Tỉa định trái non',
          total_fruits_retained: 140,
          total_fruits_culled: 180,
          labor_cost: 100000
        }
      },
      {
        log_date: '2026-02-28',
        log_type: 'Bón phân',
        operator_name: 'Trần Văn Ba',
        equipment_used: 'Thùng bón phân gốc',
        note: 'Bón phân NPK 20-20-15+TE Đầu Trâu nuôi trái non lớn nhanh, bổ sung vi lượng Bo và Kẽm chống nứt gai.',
        media_urls: ['https://images.unsplash.com/photo-1628352081506-83c43123ed6d?w=600&auto=format&fit=crop&q=80'],
        details: {
          supply_id: supplyMap['Phân NPK 20-20-15+TE Đầu Trâu Chuyên Cây Ăn Trái'],
          supply_name: 'Phân NPK 20-20-15+TE Đầu Trâu Chuyên Cây Ăn Trái',
          quantity: 2.0,
          unit: 'kg',
          unit_price: 17800,
          total_cost: 35600,
          note: 'Bón rải quanh mép tán lá sau đó bật béc tưới 30 phút'
        }
      },
      {
        log_date: '2026-03-20',
        log_type: 'Phun thuốc',
        operator_name: 'Nguyễn Văn Long',
        equipment_used: 'Bình xịt điện Stihl SR-420',
        note: 'Phun phòng trừ rầy phấn trắng và bọ trĩ chích hút cuống trái bằng thuốc trừ sâu sinh học Radiant 60SC. Thời gian cách ly PHI an toàn 3 ngày.',
        media_urls: ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80'],
        details: {
          supply_id: supplyMap['Thuốc trừ sâu rầy sinh học Radiant 60SC'],
          supply_name: 'Thuốc trừ sâu rầy sinh học Radiant 60SC',
          quantity: 50,
          unit: 'ml',
          unit_price: 780,
          total_cost: 39000,
          phi_days: 3,
          phi_until_date: '2026-03-23',
          active_ingredient: 'Spinetoram 60g/L'
        }
      },
      {
        log_date: '2026-04-15',
        log_type: 'Xử lý bệnh',
        operator_name: 'Kỹ sư Nguyễn Văn Long',
        equipment_used: 'Dao nạo vỏ cây chuyên dụng & Cọ quét sơn',
        note: 'Phát hiện vết xì mủ 4cm ở mặt bắc gốc cây (nấm Phytophthora palmivora). Cạo sạch lớp vỏ hoại tử đến phần gỗ trắng, quét thuốc Ridomil Gold 68WG nguyên chất.',
        media_urls: ['https://images.unsplash.com/photo-1589923188900-85dae523342b?w=600&auto=format&fit=crop&q=80'],
        details: {
          disease_name: 'Nứt thân xì mủ (Phytophthora)',
          supply_id: supplyMap['Thuốc đặc trị nứt thân xì mủ Ridomil Gold 68WG'],
          supply_name: 'Thuốc đặc trị nứt thân xì mủ Ridomil Gold 68WG',
          quantity: 50,
          unit: 'g',
          unit_price: 320,
          total_cost: 16000,
          phi_days: 14,
          treatment_result: 'Vết thương khô ráo, kéo da non khỏe mạnh sau 5 ngày'
        }
      },
      {
        log_date: '2026-05-20',
        log_type: 'Phun thuốc',
        operator_name: 'Nguyễn Văn Long',
        equipment_used: 'Máy nén áp lực cao',
        note: 'Phun phòng thán thư cuống và bảo vệ vỏ trái trước thu hoạch bằng Anvil 5SC (Cách ly PHI 14 ngày). Kết hợp bón 1.5kg Kali Sunfat SoluPotasse vỗ béo cơm vàng.',
        media_urls: ['https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&auto=format&fit=crop&q=80'],
        details: {
          supply_id: supplyMap['Thuốc trừ nấm bệnh Anvil 5SC (Syngenta)'],
          supply_name: 'Thuốc trừ nấm bệnh Anvil 5SC (Syngenta)',
          quantity: 100,
          unit: 'ml',
          unit_price: 260,
          total_cost: 26000,
          phi_days: 14,
          phi_until_date: '2026-06-03',
          active_ingredient: 'Hexaconazole 50g/L'
        }
      },
      {
        log_date: '2026-06-15',
        log_type: 'Thu hoạch',
        operator_name: 'Kỹ sư Nguyễn Văn Long & Đội thu hái',
        equipment_used: 'Dao cắt sầu riêng mũi cong & Giỏ lót mút xốp chống trầy',
        note: 'Thu hoạch sầu riêng Ri6 đợt 1 chính vụ (Cắt trái già đạt độ chín 8.5 tuổi). Đã qua thời gian cách ly PHI (An toàn tuyệt đối). Sinh Mã Lô Nông Sản VietGAP: VN-LK-001-20260615-SR01.',
        media_urls: ['https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=600&auto=format&fit=crop&q=80'],
        batch_code: 'VN-LK-001-20260615-SR01',
        puc_code: 'VN-LK-001',
        is_phi_violation: false,
        details: {
          yield_kg: 255.0,
          fruit_count: 85,
          grade_1_kg: 220.0,
          grade_2_kg: 35.0,
          unit_price_vnd: 85000,
          total_revenue: 21675000,
          brix_sweetness: '32° Brix',
          batch_code: 'VN-LK-001-20260615-SR01',
          puc_code: 'VN-LK-001',
          is_phi_violation: false,
          phi_status: 'safe',
          note: 'Cơm sầu riêng vàng đậm, dẻo béo, hạt lép 95%, hương thơm đặc trưng đạt chuẩn xuất khẩu'
        }
      }
    ];

    for (const log of logsList) {
      await client.query(`
        INSERT INTO plant_logs (
          plant_id, log_date, log_type, note, media_urls, details, created_by,
          batch_code, puc_code, operator_name, equipment_used, is_phi_violation
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        plantId,
        log.log_date,
        log.log_type,
        log.note,
        JSON.stringify(log.media_urls || []),
        JSON.stringify(log.details || {}),
        userId,
        log.batch_code || null,
        log.puc_code || 'VN-LK-001',
        log.operator_name || 'Kỹ thuật viên',
        log.equipment_used || 'Dụng cụ làm vườn',
        log.is_phi_violation || false
      ]);
    }

    console.log(`📝 Đã tạo thành công ${logsList.length} Nhật ký Canh tác lịch sử 20 năm cho Cây Sầu Riêng STT 1 trong Trang trại "${farmName}"!`);

    await client.query('COMMIT');
    console.log(`🎉 HOÀN THÀNH ĐỒNG BỘ DỮ LIỆU CÂY SẦU RIÊNG RI6 20 NĂM TUỔI CHO TRANG TRẠI "${farmName}" (ID: ${farmId}) THÀNH CÔNG 100%!`);
    return {
      farm_id: farmId,
      farm_name: farmName,
      plant_id: plantId,
      supplies_count: suppliesData.length,
      logs_count: logsList.length,
      historical_seasons: historicalYieldRecords.length,
      lifetime_yield_kg: treeData.lifetime_summary.total_yield_kg,
      lifetime_revenue_vnd: treeData.lifetime_summary.total_revenue_vnd
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Lỗi khi seed dữ liệu:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedDurianRi6LK()
    .then(() => pool.end())
    .catch(() => pool.end());
}

module.exports = { seedDurianRi6LK };
