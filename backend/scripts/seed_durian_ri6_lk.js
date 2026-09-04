/**
 * Seed Script: Dữ liệu canh tác mẫu Cây Sầu Riêng Ri6 STT 1 Trọn Vẹn 22 Năm (2004 - 2026)
 * Trang trại Long Khánh (LK Farm) - Siêu Mật Độ 20,000+ Nhật Ký Canh Tác Thực Địa
 * Chuẩn VietGAP 100% & Quản trị Doanh nghiệp Agri-ERP
 * Chạy: node scripts/seed_durian_ri6_lk.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/db');

async function seedDurianRi6LK() {
  const client = await pool.connect();
  try {
    console.log('🌱 Bắt đầu tạo siêu dữ liệu mẫu Cây Sầu Riêng Ri6 STT 1 (Trang trại LK) với 20,000+ Nhật Ký Canh Tác...');
    await client.query('BEGIN');

    // Đảm bảo tất cả các cột cần thiết trên các bảng đã tồn tại trước khi seed
    await client.query(`
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS user_id INTEGER;
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS latitude NUMERIC;
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS longitude NUMERIC;
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS puc_code VARCHAR(100);
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS vietgap_cert_number VARCHAR(100);
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS vietgap_cert_org VARCHAR(255);
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS vietgap_cert_date DATE;
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS allow_view_plants BOOLEAN DEFAULT true;
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS allow_shared_history BOOLEAN DEFAULT true;
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS allow_shared_supplies BOOLEAN DEFAULT true;
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS total_plants INTEGER DEFAULT 0;
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

      ALTER TABLE plants ADD COLUMN IF NOT EXISTS farm_id INTEGER;
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS latitude NUMERIC;
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS longitude NUMERIC;
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS tree_code VARCHAR(100);
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS assigned_to_user_id INTEGER;
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS phi_until_date TIMESTAMPTZ;
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS phi_active_supply_name VARCHAR(255);

      ALTER TABLE supplies ADD COLUMN IF NOT EXISTS safety_interval_days INTEGER DEFAULT 0;
      ALTER TABLE supplies ADD COLUMN IF NOT EXISTS safety_interval_note TEXT;
      ALTER TABLE supplies ADD COLUMN IF NOT EXISTS default_dosage NUMERIC;
      ALTER TABLE supplies ADD COLUMN IF NOT EXISTS dosage_unit VARCHAR(50);
      ALTER TABLE supplies ADD COLUMN IF NOT EXISTS is_unlimited BOOLEAN DEFAULT false;

      ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS batch_code VARCHAR(150);
      ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS puc_code VARCHAR(100);
      ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS operator_name VARCHAR(255);
      ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS equipment_used VARCHAR(255);
    `);

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

      // Cập nhật thông số VietGAP và tọa độ GIS chuẩn WGS-84 cho trang trại LK hiện hữu
      const defaultPolygon = JSON.stringify([
        [107.240500, 10.940500],
        [107.243500, 10.940800],
        [107.243200, 10.942500],
        [107.240200, 10.942200],
        [107.240500, 10.940500]
      ]);

      await client.query(`
        UPDATE farms SET 
          puc_code = 'VN-LK-001',
          vietgap_cert_number = 'VG-2026-LK88',
          vietgap_cert_org = 'Quacert Việt Nam',
          latitude = COALESCE(latitude, 10.941200),
          longitude = COALESCE(longitude, 107.241500),
          polygon_coordinates = COALESCE(polygon_coordinates, $2),
          allow_shared_supplies = true,
          allow_shared_history = true,
          updated_at = NOW()
        WHERE id = $1
      `, [farmId, defaultPolygon]);
      console.log(`🏡 Đã tìm thấy và cập nhật chứng nhận VietGAP cho Trang Trại "${farmName}" (ID: ${farmId}, User ID: ${userId})`);
    } else {
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

    // ── 3. THIẾT LẬP DỮ LIỆU LỊCH SỬ NĂNG SUẤT & DOANH THU 20 MÙA VỤ (2009 - 2026) ──
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
      { year: 2006, age: 1, trunk_diameter_cm: 8, height_m: 1.2, canopy_m: 0.8, phase: 'Xuống giống cây con tại vườn Long Khánh' },
      { year: 2007, age: 2, trunk_diameter_cm: 14, height_m: 2.2, canopy_m: 1.8, phase: 'Bấm đọt phân cành cấp 1' },
      { year: 2008, age: 3, trunk_diameter_cm: 20, height_m: 3.4, canopy_m: 2.8, phase: 'Tạo tán hình tháp thông thoáng' },
      { year: 2009, age: 4, trunk_diameter_cm: 26, height_m: 4.6, canopy_m: 4.0, phase: 'Sinh khối phát triển vượt bậc' },
      { year: 2010, age: 5, trunk_diameter_cm: 32, height_m: 5.8, canopy_m: 5.5, phase: 'Chuẩn bị thể trạng đón trái bói' },
      { year: 2011, age: 6, trunk_diameter_cm: 36, height_m: 6.8, canopy_m: 6.5, phase: 'Vụ bói đầu tiên (18 trái)' },
      { year: 2015, age: 10, trunk_diameter_cm: 45, height_m: 8.5, canopy_m: 8.0, phase: 'Cây 10 năm tuổi thương phẩm' },
      { year: 2020, age: 15, trunk_diameter_cm: 56, height_m: 10.5, canopy_m: 9.8, phase: 'Đạt đỉnh cao sinh học' },
      { year: 2026, age: 20, trunk_diameter_cm: 65, height_m: 12.5, canopy_m: 11.0, phase: 'Cổ thụ 20 năm kinh doanh cực thịnh' }
    ];

    const treeData = {
      trunk_diameter_cm: 65,
      height_m: 12.5,
      canopy_diameter_m: 11.0,
      average_yield_kg: 450,
      planting_date: '2006-01-01',
      planted_date: '2006-01-01',
      planting_year: 2006,
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

    const coverImg = 'https://images.unsplash.com/photo-1596707323867-b50a24128f7d?w=1200&auto=format&fit=crop&q=80';

    if (existingPlantsInFarm.rows.length > 0) {
      const targetPlant = existingPlantsInFarm.rows[0];
      plantId = targetPlant.id;
      const originalTreeCode = targetPlant.tree_code || '1';

      await client.query(`
        UPDATE plants SET
          plant_type = 'Sầu riêng',
          plant_variety = 'Ri6 Cổ Thụ (20 Năm Tuổi)',
          plant_age = '20 năm tuổi',
          planting_date = '2006-01-01',
          health_status = 'Tốt',
          location = COALESCE(location, 'Lô A1 - Hàng 1 - Cây STT 1 (Cây đầu hồi cổng chính)'),
          tree_code = $1,
          nfc_uid = COALESCE(nfc_uid, '04:A2:3B:8C:9F:5D:80'),
          public_slug = COALESCE(public_slug, 'flk-sr01-ri6-longkhanh'),
          latitude = 10.941520,
          longitude = 107.241850,
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
          farm_id, created_by, plant_type, plant_variety, plant_age, planting_date, health_status,
          location, tree_code, nfc_uid, public_slug, latitude, longitude,
          cover_image, is_public, data, phi_status, phi_until_date,
          last_pesticide_date, last_pesticide_name
        ) VALUES (
          $1, $2, 'Sầu riêng', 'Ri6 Cổ Thụ (20 Năm Tuổi)', '20 năm tuổi', '2006-01-01', 'Tốt',
          'Lô A1 - Hàng 1 - Cây STT 1 (Cây đầu hồi cổng chính)', '1',
          '04:A2:3B:8C:9F:5D:80', 'flk-sr01-ri6-longkhanh', 10.941520, 107.241850,
          $3, true, $4, 'safe', '2026-06-04', '2026-05-20', 'Thuốc trừ nấm bệnh Anvil 5SC (Syngenta)'
        ) RETURNING id
      `, [farmId, userId, coverImg, JSON.stringify(treeData)]);
      plantId = newPlant.rows[0].id;
      console.log(`🌳 Đã tạo mới Cây Sầu Riêng STT 1 (ID: ${plantId}) trong Trang trại "${farmName}"`);
    }

    // ── 5. THUẬT TOÁN SINH SIÊU MẬT ĐỘ 20,000+ NHẬT KÝ CANH TÁC THỰC ĐỊA (2004 - 2026) ──
    console.log('⚡ Đang khởi tạo bộ dữ liệu 20,000+ nhật ký canh tác theo giờ giấc chi tiết...');
    await client.query(`DELETE FROM plant_logs WHERE plant_id = $1`, [plantId]);

    const generatedLogs = [];
    const operators = [
      'Nguyễn Văn Long (Kỹ sư trưởng)',
      'Trần Văn Ba (Tổ trưởng làm vườn)',
      'Lê Văn Tám (Kỹ thuật viên VietGAP)',
      'Nguyễn Thị Mai (Tổ thụ phấn & chăm sóc)',
      'Hệ thống tưới tự động bù áp IoT'
    ];

    const equipmentList = {
      'Tưới nước': ['Trạm bơm điều khiển van thông minh', 'Hệ thống béc bù áp 120L/h', 'Đồng hồ đo áp suất lưu lượng'],
      'Bón phân': ['Thùng rải phân gốc cải tiến', 'Máy bay phun thuốc DJI Agras T40', 'Bình xịt điện Stihl SR-420'],
      'Phun thuốc': ['Máy nén áp lực cao 50 bar', 'Bình xịt điện Stihl SR-420', 'Cần phun áp lực cao inox 304'],
      'Cắt tỉa': ['Kéo cắt cành Gardena cán nhôm', 'Cưa cắt cành mini Makita', 'Kéo tỉa cuống trái mũi cong'],
      'Thụ phấn': ['Chổi lông cọ mềm chuyên dụng', 'Đèn đội đầu siêu sáng LED', 'Ống đựng phấn hoa sấy khô'],
      'Thu hoạch': ['Dao cắt sầu riêng mũi cong', 'Giỏ đệm mút xốp chống trầy', 'Cân điện tử VietGAP 100kg'],
      'Khác': ['Đầu dò cảm biến IoT độ ẩm đất', 'Máy đo pH/EC đất Hanna', 'Dao nạo vỏ cây chuyên dụng']
    };

    // Chu trình canh tác chi tiết mỗi năm từ 2004 đến 2026
    for (let year = 2004; year <= 2026; year++) {
      const treeAge = year - 2004 + 1;
      const daysInYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0) ? 366 : 365;

      // Mỗi năm sinh ~950 hoạt động thực địa trải đều 365 ngày
      for (let d = 1; d <= daysInYear; d++) {
        const dateObj = new Date(year, 0, d);
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // 1. Hoạt động kiểm tra vườn buổi sáng (07:00 sáng)
        const hourMorning = '07:00';
        let checkNoteMorning = `07:00 ${dateStr}: Kiểm tra thực địa tán cây và đo độ ẩm đất (${55 + (d % 25)}%). `;
        if (month >= 11 || month <= 1) {
          checkNoteMorning += `Giai đoạn phân hóa mầm hoa & nhú mắt cua. Tình trạng mắt cua sáng khỏe, không nghẽn bông.`;
        } else if (month >= 2 && month <= 4) {
          checkNoteMorning += `Giai đoạn nuôi trái non & định hình trái. Trái tròn đều, gai xanh, cuống dai.`;
        } else if (month >= 5 && month <= 7) {
          checkNoteMorning += `Giai đoạn vỗ béo cơm vàng & chuẩn bị thu hoạch. Đo chỉ số cơm ráo, không nứt gai.`;
        } else {
          checkNoteMorning += `Giai đoạn phục hồi cây sau thu hoạch & kích cơi đọt mới. Tán lá xanh đậm dày bóng.`;
        }

        generatedLogs.push({
          plant_id: plantId,
          log_date: dateStr,
          log_type: 'Khác',
          operator_name: operators[d % 4],
          equipment_used: equipmentList['Khác'][d % 3],
          note: checkNoteMorning,
          media_urls: [],
          details: { time: hourMorning, soil_moisture: `${55 + (d % 25)}%`, soil_ph: 6.2, tree_age: `${treeAge} năm tuổi` },
          puc_code: 'VN-LK-001',
          created_by: userId
        });

        // 1b. Quan trắc vi khí hậu & Cảm biến lá chiều muộn (16:00 chiều)
        const hourAfternoon = '16:00';
        generatedLogs.push({
          plant_id: plantId,
          log_date: dateStr,
          log_type: 'Khác',
          operator_name: 'Nguyễn Văn Long (Kỹ sư trưởng)',
          equipment_used: 'Đầu dò cảm biến IoT độ ẩm đất',
          note: `16:00 ${dateStr}: Quan trắc bức xạ nhiệt và độ thoát hơi nước qua tán lá. Tình trạng lá quang hợp tốt, không cháy chóp.`,
          media_urls: [],
          details: { time: hourAfternoon, canopy_temp: `${28 + (d % 6)}°C`, humidity: `${68 + (d % 15)}%` },
          puc_code: 'VN-LK-001',
          created_by: userId
        });

        // 1c. Kiểm tra độ dẫn điện EC & độ chua đất tầng sâu (5 ngày/lần)
        if (d % 5 === 2) {
          generatedLogs.push({
            plant_id: plantId,
            log_date: dateStr,
            log_type: 'Khác',
            operator_name: 'Lê Văn Tám (Kỹ thuật viên VietGAP)',
            equipment_used: 'Máy đo pH/EC đất Hanna',
            note: `09:15 ${dateStr}: Đo chỉ số EC đất (${(0.8 + (d % 10) * 0.05).toFixed(2)} mS/cm) và pH (${(6.0 + (d % 5) * 0.1).toFixed(1)}). Độ phì nhiêu tầng đất đạt chuẩn VietGAP.`,
            media_urls: [],
            details: { time: '09:15', ec_value: `${(0.8 + (d % 10) * 0.05).toFixed(2)} mS/cm`, ph_value: (6.0 + (d % 5) * 0.1).toFixed(1) },
            puc_code: 'VN-LK-001',
            created_by: userId
          });
        }

        // 1d. Phun sương dưỡng ẩm vi lượng cơi đọt (8 ngày/lần)
        if (d % 8 === 4) {
          generatedLogs.push({
            plant_id: plantId,
            log_date: dateStr,
            log_type: 'Bón phân',
            operator_name: 'Trần Văn Ba (Tổ trưởng làm vườn)',
            equipment_used: 'Bình xịt điện Stihl SR-420',
            note: `07:15 ${dateStr}: Phun sương dưỡng cơi đọt bằng vi lượng chelate (Bo, Kẽm, Magie). Lá bóng khỏe, cơi đọt vươn đều.`,
            media_urls: [],
            details: { time: '07:15', foliar_nutrition: 'Chelate Micro TE', quantity: 50, unit: 'ml', total_cost: 15000 },
            puc_code: 'VN-LK-001',
            created_by: userId
          });
        }

        // 2. Tưới nước định kỳ (Cách 2-3 ngày/lần vào mùa khô; cách 5-7 ngày vào mùa mưa) (06:30 sáng hoặc 16:30 chiều)
        const isDrySeason = (month >= 11 || month <= 4);
        const shouldWater = isDrySeason ? (d % 2 === 0) : (d % 6 === 0);
        if (shouldWater) {
          const waterTime = (d % 2 === 0) ? '06:30' : '16:30';
          const waterLiters = isDrySeason ? 550 : 300;
          generatedLogs.push({
            plant_id: plantId,
            log_date: dateStr,
            log_type: 'Tưới nước',
            operator_name: 'Hệ thống tưới tự động bù áp IoT',
            equipment_used: 'Trạm bơm điều khiển van thông minh',
            note: `${waterTime} ${dateStr}: Bật hệ thống béc tưới bù áp tự động quanh tán cây (${waterLiters} lít nước). Cân bằng độ ẩm tầng rễ tơ.`,
            media_urls: [],
            details: {
              time: waterTime,
              supply_id: supplyMap['Tiền nước tưới giếng khoan công nghiệp'],
              supply_name: 'Tiền nước tưới giếng khoan công nghiệp',
              quantity: waterLiters / 1000,
              unit: 'm3',
              unit_price: 3500,
              total_cost: Math.round((waterLiters / 1000) * 3500)
            },
            puc_code: 'VN-LK-001',
            created_by: userId
          });
        }

        // 3. Làm cỏ gốc, xới đất & vệ sinh tán (1 tuần/lần) (08:00 sáng)
        if (d % 7 === 3) {
          generatedLogs.push({
            plant_id: plantId,
            log_date: dateStr,
            log_type: 'Khác',
            operator_name: 'Trần Văn Ba (Tổ trưởng làm vườn)',
            equipment_used: 'Máy cắt cỏ mini & Cuốc xới răng cào',
            note: `08:00 ${dateStr}: Cắt cỏ duy trì thảm cỏ tự nhiên quanh tán 1.5m, xới rãnh thông thoáng thoát nước gốc cây.`,
            media_urls: [],
            details: { time: '08:00', activity: 'Vệ sinh thảm cỏ gốc', labor_cost: 60000 },
            puc_code: 'VN-LK-001',
            created_by: userId
          });
        }

        // 4. Bón phân định kỳ (Bón hữu cơ Bỉ, NPK Đầu Trâu, MKP, Kali SoluPotasse) (10 ngày/lần)
        if (d % 10 === 5) {
          let supName = 'Phân NPK 20-20-15+TE Đầu Trâu Chuyên Cây Ăn Trái';
          let qty = 1.5;
          let unit = 'kg';
          let price = 17800;

          if (month >= 8 && month <= 10) {
            supName = 'Phân hữu cơ vi sinh nở Bỉ (Belgo Organic)';
            qty = 10;
            price = 15200;
          } else if (month === 11 || month === 12) {
            supName = 'Phân bón lá tạo mầm hoa MKP 0-52-34 Haifa Israel';
            qty = 0.5;
            price = 50000;
          } else if (month === 1) {
            supName = 'Phân bón lá Canxi Bo Sữa Bo-Trac Yara Anh Quốc';
            qty = 100;
            unit = 'ml';
            price = 180;
          } else if (month >= 5 && month <= 6) {
            supName = 'Phân Kali Trắng Sunfat K2SO4 SoluPotasse 0-0-50';
            qty = 1.2;
            price = 30000;
          }

          generatedLogs.push({
            plant_id: plantId,
            log_date: dateStr,
            log_type: 'Bón phân',
            operator_name: operators[d % 3],
            equipment_used: equipmentList['Bón phân'][d % 3],
            note: `07:30 ${dateStr}: Bón ${qty} ${unit} ${supName} quanh hình chiếu tán cây. Bổ sung dưỡng chất tối ưu cho cơi đọt và trái.`,
            media_urls: [],
            details: {
              time: '07:30',
              supply_id: supplyMap[supName],
              supply_name: supName,
              quantity: qty,
              unit: unit,
              unit_price: price,
              total_cost: Math.round(qty * price),
              phi_days: 0
            },
            puc_code: 'VN-LK-001',
            created_by: userId
          });
        }

        // 5. Phun phòng thuốc trừ sâu sinh học & Trừ nấm bệnh VietGAP (12 ngày/lần)
        if (d % 12 === 7) {
          let pestName = 'Thuốc trừ sâu rầy sinh học Radiant 60SC';
          let pQty = 50;
          let pUnit = 'ml';
          let pPrice = 780;
          let phiDays = 3;

          if (month >= 3 && month <= 6) {
            pestName = (d % 24 === 7) ? 'Thuốc trừ nấm bệnh Anvil 5SC (Syngenta)' : 'Thuốc đặc trị nứt thân xì mủ Ridomil Gold 68WG';
            pQty = (pestName.includes('Anvil')) ? 100 : 50;
            pUnit = (pestName.includes('Anvil')) ? 'ml' : 'g';
            pPrice = (pestName.includes('Anvil')) ? 260 : 320;
            phiDays = 14;
          }

          generatedLogs.push({
            plant_id: plantId,
            log_date: dateStr,
            log_type: 'Phun thuốc',
            operator_name: 'Nguyễn Văn Long (Kỹ sư trưởng)',
            equipment_used: 'Bình xịt điện Stihl SR-420',
            note: `06:15 ${dateStr}: Phun phòng trừ sâu bệnh bằng ${pestName}. Tuân thủ cách ly PHI ${phiDays} ngày an toàn VietGAP.`,
            media_urls: [],
            details: {
              time: '06:15',
              supply_id: supplyMap[pestName],
              supply_name: pestName,
              quantity: pQty,
              unit: pUnit,
              unit_price: pPrice,
              total_cost: Math.round(pQty * pPrice),
              phi_days: phiDays
            },
            puc_code: 'VN-LK-001',
            created_by: userId
          });
        }

        // 6. Cắt tỉa cành, tỉa hoa, tỉa trái non (15 ngày/lần)
        if (d % 15 === 9) {
          let pruneType = 'Tỉa cành thông thoáng tán';
          if (month === 12 || month === 1) pruneType = 'Tỉa bớt nụ hoa còi cọc ở đầu cành';
          if (month === 2 || month === 3) pruneType = 'Tỉa định trái non tròn đều, loại bỏ trái vẹo';
          if (month >= 8 && month <= 9) pruneType = 'Cắt tỉa cành tăm, cành sâu bệnh phục hồi sau thu hoạch';

          generatedLogs.push({
            plant_id: plantId,
            log_date: dateStr,
            log_type: 'Cắt tỉa',
            operator_name: 'Nguyễn Văn Long',
            equipment_used: 'Kéo cắt cành Gardena cán nhôm',
            note: `08:45 ${dateStr}: Tiến hành ${pruneType}. Bôi keo liền sẹo vết cắt lớn.`,
            media_urls: [],
            details: { time: '08:45', activity: pruneType, labor_cost: 80000 },
            puc_code: 'VN-LK-001',
            created_by: userId
          });
        }

        // 7. Thụ phấn nhân tạo ban đêm vào mùa hoa nở rộ (Tháng 12 & Tháng 1: 18:30 - 20:30)
        if ((month === 12 || month === 1) && d % 3 === 0 && treeAge >= 6) {
          generatedLogs.push({
            plant_id: plantId,
            log_date: dateStr,
            log_type: 'Thụ phấn',
            operator_name: 'Tổ kỹ thuật thụ phấn (Nguyễn Thị Mai)',
            equipment_used: 'Chổi lông cọ mềm chuyên dụng & Đèn LED',
            note: `18:30 ${dateStr}: Quét phấn hoa chéo bổ sung từ giống Monthong sang nhụy hoa Ri6 lúc 18h30 - 20h00 tối. Hạt phấn tiếp nhận tròn đầy 5 hộc.`,
            media_urls: [],
            details: { time: '18:30', activity: 'Thụ phấn chéo ban đêm', pollination_rate: '94%', labor_cost: 100000 },
            puc_code: 'VN-LK-001',
            created_by: userId
          });
        }

        // 8. Thu hoạch chính vụ theo đợt (Tháng 5 & Tháng 6 hàng năm từ năm 2009)
        if ((month === 5 || month === 6) && (day === 15 || day === 28) && treeAge >= 6) {
          const seasonYield = historicalYieldRecords.find(h => h.year === year) || { yield_kg: 250, fruit_count: 80, avg_price_vnd: 80000, revenue_vnd: 20000000 };
          const harvestBatch = `VN-LK-001-${year}${String(month).padStart(2,'0')}${String(day).padStart(2,'0')}-SR01`;
          const cutFruits = Math.round(seasonYield.fruit_count / 2);
          const cutKg = Math.round(seasonYield.yield_kg / 2);
          const revenue = Math.round(cutKg * seasonYield.avg_price_vnd);

          generatedLogs.push({
            plant_id: plantId,
            log_date: dateStr,
            log_type: 'Thu hoạch',
            operator_name: 'Nguyễn Văn Long & Đội thu hái',
            equipment_used: 'Dao cắt sầu riêng mũi cong & Cân điện tử VietGAP',
            note: `06:00 ${dateStr}: THU HOẠCH CHÍNH VỤ SẦU RIÊNG RI6 (Đợt ${day === 15 ? '1' : '2'}). Cắt ${cutFruits} trái (~${cutKg} kg) đạt độ chín 8.5 tuổi. Cơm vàng, hạt lép, dán tem truy xuất Mã Lô: ${harvestBatch}.`,
            media_urls: ['https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=600&auto=format&fit=crop&q=80'],
            batch_code: harvestBatch,
            puc_code: 'VN-LK-001',
            is_phi_violation: false,
            details: {
              time: '06:00',
              yield_kg: cutKg,
              fruit_count: cutFruits,
              unit_price_vnd: seasonYield.avg_price_vnd,
              total_revenue: revenue,
              batch_code: harvestBatch,
              brix_sweetness: '33° Brix',
              phi_status: 'safe'
            },
            created_by: userId
          });
        }
      }
    }

    console.log(`📊 Tổng số lượng nhật ký được khởi tạo: ${generatedLogs.length} bản ghi (Đạt chỉ tiêu 20,000+)!`);

    // ── 6. THỰC THI CHÈN HÀNG LOẠT HIỆU NĂNG CAO (BATCH CHUNKS OF 1,000 ROWS) ──
    const chunkSize = 1000;
    for (let i = 0; i < generatedLogs.length; i += chunkSize) {
      const chunk = generatedLogs.slice(i, i + chunkSize);
      const valuePlaceholders = [];
      const queryParams = [];
      let paramIndex = 1;

      for (const log of chunk) {
        valuePlaceholders.push(
          `($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, $${paramIndex+10}, $${paramIndex+11})`
        );
        queryParams.push(
          log.plant_id,
          log.log_date,
          log.log_type,
          log.note,
          JSON.stringify(log.media_urls || []),
          JSON.stringify(log.details || {}),
          log.created_by,
          log.batch_code || null,
          log.puc_code || 'VN-LK-001',
          log.operator_name || 'Kỹ thuật viên',
          log.equipment_used || 'Dụng cụ làm vườn',
          log.is_phi_violation || false
        );
        paramIndex += 12;
      }

      const insertSql = `
        INSERT INTO plant_logs (
          plant_id, log_date, log_type, note, media_urls, details, created_by,
          batch_code, puc_code, operator_name, equipment_used, is_phi_violation
        ) VALUES ${valuePlaceholders.join(', ')}
      `;

      await client.query(insertSql, queryParams);
      process.stdout.write(`⏳ Đã nạp thành công: ${Math.min(i + chunkSize, generatedLogs.length)} / ${generatedLogs.length} nhật ký...\r`);
    }

    console.log(`\n📝 Đã nạp thành công toàn bộ ${generatedLogs.length} Nhật ký Canh tác thực địa (2004 - 2026) vào CSDL!`);

    await client.query('COMMIT');
    console.log(`🎉 HOÀN THÀNH NẠP SIÊU DỮ LIỆU CÂY SẦU RIÊNG RI6 20,000+ NHẬT KÝ CHO TRANG TRẠI "${farmName}" (ID: ${farmId}) THÀNH CÔNG 100%!`);
    return {
      farm_id: farmId,
      farm_name: farmName,
      plant_id: plantId,
      supplies_count: suppliesData.length,
      logs_count: generatedLogs.length,
      historical_seasons: historicalYieldRecords.length,
      lifetime_yield_kg: treeData.lifetime_summary.total_yield_kg,
      lifetime_revenue_vnd: treeData.lifetime_summary.total_revenue_vnd
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Lỗi khi seed siêu dữ liệu:', err);
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
