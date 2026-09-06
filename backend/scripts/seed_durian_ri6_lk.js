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

    // ── 3. CẤU HÌNH BỘ 5 CÂY SẦU RIÊNG RI6 (STT 1 ĐẾN 5) TẠI TRANG TRẠI LK ──
    const durianTreesConfig = [
      {
        tree_code: '1',
        code_match: ['1', 'SR-01', 'SR-1', '01'],
        location: 'Lô A1 - Hàng 1 - Cây STT 1 (Cây đầu hồi cổng chính)',
        default_lat: 10.941520,
        default_lng: 107.241850,
        nfc_uid: '04:A2:3B:8C:9F:5D:80',
        public_slug: 'flk-sr01-ri6-longkhanh',
        plant_variety: 'Ri6 Cổ Thụ (20 Năm Tuổi)',
        trunk_diameter_cm: 65,
        height_m: 12.5,
        canopy_diameter_m: 11.0,
        average_yield_kg: 450,
        yield_multiplier: 1.0,
        health_status: 'Tốt'
      },
      {
        tree_code: '2',
        code_match: ['2', 'SR-02', 'SR-2', '02'],
        location: 'Lô A1 - Hàng 1 - Cây STT 2 (Cây giữa hàng 1)',
        default_lat: 10.941650,
        default_lng: 107.242050,
        nfc_uid: '04:A2:3B:8C:9F:5D:81',
        public_slug: 'flk-sr02-ri6-longkhanh',
        plant_variety: 'Ri6 Cổ Thụ (20 Năm Tuổi)',
        trunk_diameter_cm: 63,
        height_m: 12.2,
        canopy_diameter_m: 10.8,
        average_yield_kg: 435,
        yield_multiplier: 0.97,
        health_status: 'Tốt'
      },
      {
        tree_code: '3',
        code_match: ['3', 'SR-03', 'SR-3', '03'],
        location: 'Lô A1 - Hàng 1 - Cây STT 3 (Cây cuối hàng 1)',
        default_lat: 10.941780,
        default_lng: 107.242250,
        nfc_uid: '04:A2:3B:8C:9F:5D:82',
        public_slug: 'flk-sr03-ri6-longkhanh',
        plant_variety: 'Ri6 Cổ Thụ (20 Năm Tuổi)',
        trunk_diameter_cm: 67,
        height_m: 12.8,
        canopy_diameter_m: 11.2,
        average_yield_kg: 465,
        yield_multiplier: 1.03,
        health_status: 'Tốt'
      },
      {
        tree_code: '4',
        code_match: ['4', 'SR-04', 'SR-4', '04'],
        location: 'Lô A1 - Hàng 2 - Cây STT 4 (Cây đầu hàng 2)',
        default_lat: 10.941400,
        default_lng: 107.241650,
        nfc_uid: '04:A2:3B:8C:9F:5D:83',
        public_slug: 'flk-sr04-ri6-longkhanh',
        plant_variety: 'Ri6 Cổ Thụ (20 Năm Tuổi)',
        trunk_diameter_cm: 62,
        height_m: 12.0,
        canopy_diameter_m: 10.5,
        average_yield_kg: 420,
        yield_multiplier: 0.94,
        health_status: 'Tốt'
      },
      {
        tree_code: '5',
        code_match: ['5', 'SR-05', 'SR-5', '05'],
        location: 'Lô A1 - Hàng 2 - Cây STT 5 (Cây giữa hàng 2)',
        default_lat: 10.941280,
        default_lng: 107.241450,
        nfc_uid: '04:A2:3B:8C:9F:5D:84',
        public_slug: 'flk-sr05-ri6-longkhanh',
        plant_variety: 'Ri6 Cổ Thụ (20 Năm Tuổi)',
        trunk_diameter_cm: 64,
        height_m: 12.3,
        canopy_diameter_m: 10.9,
        average_yield_kg: 440,
        yield_multiplier: 0.98,
        health_status: 'Tốt'
      }
    ];

    const baseYieldRecords = [
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

    const coverImg = 'https://images.unsplash.com/photo-1596707323867-b50a24128f7d?w=1200&auto=format&fit=crop&q=80';

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

    // Lấy danh sách cây hiện hữu của trang trại LK
    const existingPlantsInFarm = await client.query(`
      SELECT * FROM plants 
      WHERE farm_id = $1 
      ORDER BY id ASC
    `, [farmId]);

    const seededPlantsResult = [];
    let totalAllGeneratedLogs = 0;

    // ── 4. LẶP VÀ KHỞI TẠO TỪNG CÂY TRONG BỘ 5 CÂY SẦU RIÊNG (STT #1 ĐẾN #5) ──
    for (let treeIdx = 0; treeIdx < durianTreesConfig.length; treeIdx++) {
      const treeCfg = durianTreesConfig[treeIdx];
      const mult = treeCfg.yield_multiplier;

      // Tính toán lịch sử mùa vụ và sinh trắc học riêng cho từng cây
      const treeYieldRecords = baseYieldRecords.map(r => {
        const adjustedFruits = Math.round(r.fruit_count * mult);
        const adjustedYield = Math.round(r.yield_kg * mult);
        const adjustedRev = adjustedYield * r.avg_price_vnd;
        const adjustedExp = Math.round(r.expense_vnd * (0.95 + 0.05 * mult));
        return {
          ...r,
          fruit_count: adjustedFruits,
          yield_kg: adjustedYield,
          revenue_vnd: adjustedRev,
          expense_vnd: adjustedExp,
          profit_vnd: adjustedRev - adjustedExp
        };
      });

      const biometricTimeline = [
        { year: 2006, age: 1, trunk_diameter_cm: Math.round(8 * mult), height_m: Number((1.2 * mult).toFixed(1)), canopy_m: Number((0.8 * mult).toFixed(1)), phase: 'Xuống giống cây con tại vườn Long Khánh' },
        { year: 2007, age: 2, trunk_diameter_cm: Math.round(14 * mult), height_m: Number((2.2 * mult).toFixed(1)), canopy_m: Number((1.8 * mult).toFixed(1)), phase: 'Bấm đọt phân cành cấp 1' },
        { year: 2008, age: 3, trunk_diameter_cm: Math.round(20 * mult), height_m: Number((3.4 * mult).toFixed(1)), canopy_m: Number((2.8 * mult).toFixed(1)), phase: 'Tạo tán hình tháp thông thoáng' },
        { year: 2009, age: 4, trunk_diameter_cm: Math.round(26 * mult), height_m: Number((4.6 * mult).toFixed(1)), canopy_m: Number((4.0 * mult).toFixed(1)), phase: 'Sinh khối phát triển vượt bậc' },
        { year: 2010, age: 5, trunk_diameter_cm: Math.round(32 * mult), height_m: Number((5.8 * mult).toFixed(1)), canopy_m: Number((5.5 * mult).toFixed(1)), phase: 'Chuẩn bị thể trạng đón trái bói' },
        { year: 2011, age: 6, trunk_diameter_cm: Math.round(36 * mult), height_m: Number((6.8 * mult).toFixed(1)), canopy_m: Number((6.5 * mult).toFixed(1)), phase: 'Vụ bói đầu tiên' },
        { year: 2015, age: 10, trunk_diameter_cm: Math.round(45 * mult), height_m: Number((8.5 * mult).toFixed(1)), canopy_m: Number((8.0 * mult).toFixed(1)), phase: 'Cây 10 năm tuổi thương phẩm' },
        { year: 2020, age: 15, trunk_diameter_cm: Math.round(56 * mult), height_m: Number((10.5 * mult).toFixed(1)), canopy_m: Number((9.8 * mult).toFixed(1)), phase: 'Đạt đỉnh cao sinh học' },
        { year: 2026, age: 20, trunk_diameter_cm: treeCfg.trunk_diameter_cm, height_m: treeCfg.height_m, canopy_m: treeCfg.canopy_diameter_m, phase: 'Cổ thụ 20 năm kinh doanh cực thịnh' }
      ];

      const totYield = treeYieldRecords.reduce((a, b) => a + b.yield_kg, 0);
      const totFruits = treeYieldRecords.reduce((a, b) => a + b.fruit_count, 0);
      const totRev = treeYieldRecords.reduce((a, b) => a + b.revenue_vnd, 0);
      const totExp = treeYieldRecords.reduce((a, b) => a + b.expense_vnd, 0);

      const treeData = {
        trunk_diameter_cm: treeCfg.trunk_diameter_cm,
        height_m: treeCfg.height_m,
        canopy_diameter_m: treeCfg.canopy_diameter_m,
        average_yield_kg: treeCfg.average_yield_kg,
        planting_date: '2006-01-01',
        planted_date: '2006-01-01',
        planting_year: 2006,
        rootstock: 'Gốc ghép sầu riêng hạt bản địa Long Khánh',
        current_season_target_fruits: Math.round(140 * mult),
        irrigation_system: 'Béc tưới bù áp tự động 120L/h (3 béc quanh tán)',
        historical_yield_records: treeYieldRecords,
        biometric_timeline: biometricTimeline,
        lifetime_summary: {
          total_seasons: treeYieldRecords.length,
          total_fruits_harvested: totFruits,
          total_yield_kg: totYield,
          total_revenue_vnd: totRev,
          total_expense_vnd: totExp,
          total_net_profit_vnd: totRev - totExp
        }
      };

      // Tìm cây khớp theo tree_code hoặc mã liên quan
      let existingPlant = existingPlantsInFarm.rows.find(p =>
        p.tree_code === treeCfg.tree_code ||
        treeCfg.code_match.includes(p.tree_code) ||
        p.public_slug === treeCfg.public_slug ||
        p.nfc_uid === treeCfg.nfc_uid
      );

      // Nếu không tìm thấy theo code mà danh sách hiện hữu còn phần tử theo thứ tự thì gán
      if (!existingPlant && existingPlantsInFarm.rows[treeIdx]) {
        existingPlant = existingPlantsInFarm.rows[treeIdx];
      }

      let currentPlantId = null;

      if (existingPlant) {
        currentPlantId = existingPlant.id;
        // BẢO TOÀN 100% TỌA ĐỘ GPS HIỆN HỮU NẾU ĐÃ CÓ
        const finalLat = existingPlant.latitude != null ? Number(existingPlant.latitude) : treeCfg.default_lat;
        const finalLng = existingPlant.longitude != null ? Number(existingPlant.longitude) : treeCfg.default_lng;

        await client.query(`
          UPDATE plants SET
            plant_type = 'Sầu riêng',
            plant_variety = $1,
            plant_age = '20 năm tuổi',
            planting_date = '2006-01-01',
            health_status = $2,
            location = $3,
            tree_code = $4,
            nfc_uid = COALESCE(nfc_uid, $5),
            public_slug = COALESCE(public_slug, $6),
            latitude = $7,
            longitude = $8,
            cover_image = $9,
            is_public = true,
            data = $10,
            phi_status = 'safe',
            phi_until_date = '2026-06-04',
            last_pesticide_date = '2026-05-20',
            last_pesticide_name = 'Thuốc trừ nấm bệnh Anvil 5SC (Syngenta)',
            updated_at = NOW()
          WHERE id = $11
        `, [
          treeCfg.plant_variety,
          treeCfg.health_status,
          treeCfg.location,
          treeCfg.tree_code,
          treeCfg.nfc_uid,
          treeCfg.public_slug,
          finalLat,
          finalLng,
          coverImg,
          JSON.stringify(treeData),
          currentPlantId
        ]);
        console.log(`🌳 [Tree #${treeCfg.tree_code}] Đã cập nhật thành công (ID: ${currentPlantId}, GPS: ${finalLat}, ${finalLng})`);
      } else {
        const newPlant = await client.query(`
          INSERT INTO plants (
            farm_id, created_by, plant_type, plant_variety, plant_age, planting_date, health_status,
            location, tree_code, nfc_uid, public_slug, latitude, longitude,
            cover_image, is_public, data, phi_status, phi_until_date,
            last_pesticide_date, last_pesticide_name
          ) VALUES (
            $1, $2, 'Sầu riêng', $3, '20 năm tuổi', '2006-01-01', $4,
            $5, $6, $7, $8, $9, $10,
            $11, true, $12, 'safe', '2026-06-04', '2026-05-20', 'Thuốc trừ nấm bệnh Anvil 5SC (Syngenta)'
          ) RETURNING id
        `, [
          farmId,
          userId,
          treeCfg.plant_variety,
          treeCfg.health_status,
          treeCfg.location,
          treeCfg.tree_code,
          treeCfg.nfc_uid,
          treeCfg.public_slug,
          treeCfg.default_lat,
          treeCfg.default_lng,
          coverImg,
          JSON.stringify(treeData)
        ]);
        currentPlantId = newPlant.rows[0].id;
        console.log(`🌳 [Tree #${treeCfg.tree_code}] Đã tạo mới thành công (ID: ${currentPlantId}, GPS: ${treeCfg.default_lat}, ${treeCfg.default_lng})`);
      }

      seededPlantsResult.push({
        plant_id: currentPlantId,
        tree_code: treeCfg.tree_code,
        public_slug: treeCfg.public_slug,
        nfc_uid: treeCfg.nfc_uid
      });

      // ── 5. SINH NHẬT KÝ CANH TÁC THỰC ĐỊA CHO TỪNG CÂY (2004 - 2026) ──
      await client.query(`DELETE FROM plant_logs WHERE plant_id = $1`, [currentPlantId]);
      const generatedLogs = [];

      for (let year = 2004; year <= 2026; year++) {
        const treeAge = year - 2004 + 1;
        const daysInYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0) ? 366 : 365;

        for (let d = 1; d <= daysInYear; d++) {
          const dateObj = new Date(year, 0, d);
          const month = dateObj.getMonth() + 1;
          const day = dateObj.getDate();
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

          // 1. Kiểm tra vườn buổi sáng (07:00)
          const hourMorning = '07:00';
          let checkNoteMorning = `07:00 ${dateStr}: Kiểm tra thực địa Cây #${treeCfg.tree_code} và đo độ ẩm đất (${55 + ((d + treeIdx) % 25)}%). `;
          if (month >= 11 || month <= 1) {
            checkNoteMorning += `Giai đoạn phân hóa mầm hoa & nhú mắt cua. Tình trạng mắt cua sáng khỏe.`;
          } else if (month >= 2 && month <= 4) {
            checkNoteMorning += `Giai đoạn nuôi trái non & định hình trái. Trái tròn đều, gai xanh.`;
          } else if (month >= 5 && month <= 7) {
            checkNoteMorning += `Giai đoạn vỗ béo cơm vàng. Đo chỉ số cơm ráo, không nứt gai.`;
          } else {
            checkNoteMorning += `Giai đoạn phục hồi cây sau thu hoạch & kích cơi đọt mới. Tán lá xanh đậm.`;
          }

          generatedLogs.push({
            plant_id: currentPlantId,
            log_date: dateStr,
            log_type: 'Khác',
            operator_name: operators[(d + treeIdx) % 4],
            equipment_used: equipmentList['Khác'][(d + treeIdx) % 3],
            note: checkNoteMorning,
            media_urls: [],
            details: { time: hourMorning, soil_moisture: `${55 + ((d + treeIdx) % 25)}%`, soil_ph: 6.2, tree_age: `${treeAge} năm tuổi` },
            puc_code: 'VN-LK-001',
            created_by: userId
          });

          // 1b. Quan trắc vi khí hậu chiều (16:00)
          generatedLogs.push({
            plant_id: currentPlantId,
            log_date: dateStr,
            log_type: 'Khác',
            operator_name: 'Nguyễn Văn Long (Kỹ sư trưởng)',
            equipment_used: 'Đầu dò cảm biến IoT độ ẩm đất',
            note: `16:00 ${dateStr}: Quan trắc bức xạ nhiệt và độ thoát hơi nước qua tán Cây #${treeCfg.tree_code}. Tán lá quang hợp tốt.`,
            media_urls: [],
            details: { time: '16:00', canopy_temp: `${28 + (d % 6)}°C`, humidity: `${68 + (d % 15)}%` },
            puc_code: 'VN-LK-001',
            created_by: userId
          });

          // 1c. Kiểm tra EC & pH đất (5 ngày/lần)
          if ((d + treeIdx) % 5 === 2) {
            generatedLogs.push({
              plant_id: currentPlantId,
              log_date: dateStr,
              log_type: 'Khác',
              operator_name: 'Lê Văn Tám (Kỹ thuật viên VietGAP)',
              equipment_used: 'Máy đo pH/EC đất Hanna',
              note: `09:15 ${dateStr}: Đo chỉ số EC đất (${(0.8 + (d % 10) * 0.05).toFixed(2)} mS/cm) và pH (${(6.0 + (d % 5) * 0.1).toFixed(1)}) quanh gốc Cây #${treeCfg.tree_code}. Đạt chuẩn VietGAP.`,
              media_urls: [],
              details: { time: '09:15', ec_value: `${(0.8 + (d % 10) * 0.05).toFixed(2)} mS/cm`, ph_value: (6.0 + (d % 5) * 0.1).toFixed(1) },
              puc_code: 'VN-LK-001',
              created_by: userId
            });
          }

          // 1d. Phun sương dưỡng cơi đọt (8 ngày/lần)
          if ((d + treeIdx) % 8 === 4) {
            generatedLogs.push({
              plant_id: currentPlantId,
              log_date: dateStr,
              log_type: 'Bón phân',
              operator_name: 'Trần Văn Ba (Tổ trưởng làm vườn)',
              equipment_used: 'Bình xịt điện Stihl SR-420',
              note: `07:15 ${dateStr}: Phun sương dưỡng cơi đọt Cây #${treeCfg.tree_code} bằng vi lượng chelate (Bo, Kẽm, Magie).`,
              media_urls: [],
              details: { time: '07:15', foliar_nutrition: 'Chelate Micro TE', quantity: 50, unit: 'ml', total_cost: 15000 },
              puc_code: 'VN-LK-001',
              created_by: userId
            });
          }

          // 2. Tưới nước định kỳ
          const isDrySeason = (month >= 11 || month <= 4);
          const shouldWater = isDrySeason ? ((d + treeIdx) % 2 === 0) : ((d + treeIdx) % 6 === 0);
          if (shouldWater) {
            const waterTime = (d % 2 === 0) ? '06:30' : '16:30';
            const waterLiters = isDrySeason ? Math.round(550 * mult) : Math.round(300 * mult);
            generatedLogs.push({
              plant_id: currentPlantId,
              log_date: dateStr,
              log_type: 'Tưới nước',
              operator_name: 'Hệ thống tưới tự động bù áp IoT',
              equipment_used: 'Trạm bơm điều khiển van thông minh',
              note: `${waterTime} ${dateStr}: Bật béc tưới bù áp tự động Cây #${treeCfg.tree_code} (${waterLiters} lít nước). Cân bằng độ ẩm tầng rễ tơ.`,
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

          // 3. Làm cỏ gốc, xới đất (1 tuần/lần)
          if ((d + treeIdx) % 7 === 3) {
            generatedLogs.push({
              plant_id: currentPlantId,
              log_date: dateStr,
              log_type: 'Khác',
              operator_name: 'Trần Văn Ba (Tổ trưởng làm vườn)',
              equipment_used: 'Máy cắt cỏ mini & Cuốc xới răng cào',
              note: `08:00 ${dateStr}: Phát cỏ quanh bồn Cây #${treeCfg.tree_code} bán kính 4m, cào xới nhẹ tạo độ xốp thoáng khí bề mặt đất.`,
              media_urls: [],
              details: { time: '08:00', task: 'Vệ sinh bồn & làm cỏ tán', radius_m: 4.0 },
              puc_code: 'VN-LK-001',
              created_by: userId
            });
          }

          // 4. Bón phân định kỳ (Mỗi 10 ngày)
          if ((d + treeIdx) % 10 === 5) {
            let fertName = 'Phân hữu cơ vi sinh nở Bỉ (Belgo Organic)';
            let fertQty = Math.round(5 * mult);
            let fertCost = Math.round(fertQty * 15200);

            if (month >= 2 && month <= 4) {
              fertName = 'Phân NPK 20-20-15+TE Đầu Trâu Chuyên Cây Ăn Trái';
              fertQty = Number((1.5 * mult).toFixed(1));
              fertCost = Math.round(fertQty * 17800);
            } else if (month >= 5 && month <= 6) {
              fertName = 'Phân Kali Trắng Sunfat K2SO4 SoluPotasse 0-0-50';
              fertQty = Number((1.2 * mult).toFixed(1));
              fertCost = Math.round(fertQty * 30000);
            } else if (month === 10 || month === 11) {
              fertName = 'Phân bón lá tạo mầm hoa MKP 0-52-34 Haifa Israel';
              fertQty = Number((0.5 * mult).toFixed(1));
              fertCost = Math.round(fertQty * 50000);
            }

            generatedLogs.push({
              plant_id: currentPlantId,
              log_date: dateStr,
              log_type: 'Bón phân',
              operator_name: 'Nguyễn Văn Long (Kỹ sư trưởng)',
              equipment_used: 'Thùng rải phân gốc cải tiến',
              note: `07:30 ${dateStr}: Bón gốc Cây #${treeCfg.tree_code} với ${fertQty}kg/lít ${fertName}. Bón theo hình chiếu tán lá và tưới xả nhẹ.`,
              media_urls: [],
              details: {
                time: '07:30',
                supply_id: supplyMap[fertName] || null,
                supply_name: fertName,
                quantity: fertQty,
                unit: 'kg',
                total_cost: fertCost
              },
              puc_code: 'VN-LK-001',
              created_by: userId
            });
          }

          // 5. Phun thuốc phòng ngừa sâu bệnh (Mỗi 12 ngày)
          if ((d + treeIdx) % 12 === 7) {
            let pestName = 'Thuốc trừ sâu rầy sinh học Radiant 60SC';
            let pestQty = 25;
            let pestCost = 19500;
            let phiDays = 3;

            if (month >= 7 && month <= 10) {
              pestName = 'Thuốc đặc trị nứt thân xì mủ Ridomil Gold 68WG';
              pestQty = 50;
              pestCost = 16000;
              phiDays = 14;
            } else if (month >= 3 && month <= 5) {
              pestName = 'Thuốc trừ nấm bệnh Anvil 5SC (Syngenta)';
              pestQty = 40;
              pestCost = 10400;
              phiDays = 14;
            }

            generatedLogs.push({
              plant_id: currentPlantId,
              log_date: dateStr,
              log_type: 'Phun thuốc',
              operator_name: 'Lê Văn Tám (Kỹ thuật viên VietGAP)',
              equipment_used: 'Máy nén áp lực cao 50 bar',
              note: `06:30 ${dateStr}: Phun thuốc phòng trừ sâu bệnh tán lá Cây #${treeCfg.tree_code} (${pestName}). Cách ly an toàn PHI ${phiDays} ngày.`,
              media_urls: [],
              details: {
                time: '06:30',
                supply_id: supplyMap[pestName] || null,
                supply_name: pestName,
                quantity: pestQty,
                unit: 'ml',
                phi_days: phiDays,
                phi_safe_date: new Date(new Date(dateStr).getTime() + phiDays * 86400000).toISOString().split('T')[0],
                total_cost: pestCost
              },
              puc_code: 'VN-LK-001',
              is_phi_violation: false,
              created_by: userId
            });
          }

          // 6. Cắt tỉa cành la, tỉa hoa & định hình trái (Mỗi 15 ngày)
          if ((d + treeIdx) % 15 === 9) {
            let pruneNote = `08:30 ${dateStr}: Cắt tỉa cành vượt, cành tăm vô hiệu Cây #${treeCfg.tree_code} giúp thông thoáng tán lá.`;
            if (month >= 11 || month <= 1) {
              pruneNote = `08:30 ${dateStr}: Tỉa bớt các chùm bông méo, hoa đầu cành Cây #${treeCfg.tree_code}, giữ lại các chùm hoa giữa cành cấp 1 to khỏe.`;
            } else if (month >= 2 && month <= 4) {
              pruneNote = `08:30 ${dateStr}: Tỉa trái non đợt định hình Cây #${treeCfg.tree_code}, loại bỏ trái vẹo, trái dị hình, giữ lại quả cân đối.`;
            }

            generatedLogs.push({
              plant_id: currentPlantId,
              log_date: dateStr,
              log_type: (month >= 11 || month <= 1) ? 'Tỉa hoa' : ((month >= 2 && month <= 4) ? 'Cắt tỉa' : 'Cắt lá'),
              operator_name: 'Trần Văn Ba (Tổ trưởng làm vườn)',
              equipment_used: 'Kéo cắt cành Gardena cán nhôm',
              note: pruneNote,
              media_urls: [],
              details: { time: '08:30', task: 'Cắt tỉa tạo tán & tuyển quả VietGAP' },
              puc_code: 'VN-LK-001',
              created_by: userId
            });
          }

          // 7. Thụ phấn bổ sung ban đêm (Tháng 12 & Tháng 1, cây >= 6 năm tuổi)
          if ((month === 12 || month === 1) && (d + treeIdx) % 3 === 0 && treeAge >= 6) {
            generatedLogs.push({
              plant_id: currentPlantId,
              log_date: dateStr,
              log_type: 'Thụ phấn',
              operator_name: 'Nguyễn Thị Mai (Tổ thụ phấn & chăm sóc)',
              equipment_used: 'Chổi lông cọ mềm & Đèn LED',
              note: `18:30 ${dateStr}: Quét phấn hoa chéo bổ sung từ giống Monthong sang nhụy hoa Ri6 Cây #${treeCfg.tree_code} lúc 18h30 - 20h00 tối. Hạt phấn tiếp nhận tràn đầy 5 hộc.`,
              media_urls: [],
              details: { time: '18:30', task: 'Thụ phấn nhân tạo ban đêm', method: 'Chổi lông cọ' },
              puc_code: 'VN-LK-001',
              created_by: userId
            });
          }

          // 8. Thu hoạch chính vụ VietGAP (Tháng 5 & Tháng 6, cây >= 6 năm tuổi)
          if ((month === 5 || month === 6) && (day === 15 || day === 28) && treeAge >= 6) {
            const seasonYield = treeYieldRecords.find(y => y.year === year) || treeYieldRecords[treeYieldRecords.length - 1];
            const cutFruits = Math.round(seasonYield.fruit_count / 2);
            const cutKg = Math.round(seasonYield.yield_kg / 2);
            const revenue = cutKg * seasonYield.avg_price_vnd;
            const harvestBatch = `VN-LK-001-${year}${String(month).padStart(2,'0')}${String(day).padStart(2,'0')}-SR0${treeCfg.tree_code}`;

            generatedLogs.push({
              plant_id: currentPlantId,
              log_date: dateStr,
              log_type: 'Thu hoạch',
              operator_name: 'Nguyễn Văn Long (Kỹ sư trưởng)',
              equipment_used: 'Dao cắt sầu riêng mũi cong & Cân điện tử 100kg',
              note: `06:00 ${dateStr}: THU HOẠCH CHÍNH VỤ SẦU RIÊNG RI6 CÂY #${treeCfg.tree_code} (Đợt ${day === 15 ? '1' : '2'}). Cắt ${cutFruits} trái (~${cutKg} kg) đạt độ chín 8.5 tuổi. Cơm vàng, hạt lép, dán tem truy xuất Mã Lô: ${harvestBatch}.`,
              media_urls: [],
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

      totalAllGeneratedLogs += generatedLogs.length;

      // Chèn nhật ký của từng cây theo từng batch 1,000 dòng
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
      }
      console.log(`📝 [Tree #${treeCfg.tree_code}] Đã nạp thành công ${generatedLogs.length} nhật ký canh tác thực địa!`);
    }

    // ── 6. CẬP NHẬT TỔNG SỐ LƯỢNG CÂY TRỒNG TRANG TRẠI LK ──
    const totalPlantsInFarmRes = await client.query(`SELECT COUNT(*) as count FROM plants WHERE farm_id = $1`, [farmId]);
    const finalTotalPlants = parseInt(totalPlantsInFarmRes.rows[0].count, 10);
    await client.query(`UPDATE farms SET total_plants = $1 WHERE id = $2`, [finalTotalPlants, farmId]);
    console.log(`🏡 Đã cập nhật tổng số cây trang trại "${farmName}": ${finalTotalPlants} cây`);

    await client.query('COMMIT');
    console.log(`🎉 HOÀN THÀNH ĐỒNG BỘ DỮ LIỆU MẪU CẢ 5 CÂY SẦU RIÊNG RI6 (STT 1-5) VỚI ${totalAllGeneratedLogs} NHẬT KÝ CHO TRANG TRẠI "${farmName}" (ID: ${farmId}) THÀNH CÔNG 100%!`);
    return {
      farm_id: farmId,
      farm_name: farmName,
      total_plants: finalTotalPlants,
      seeded_trees: seededPlantsResult,
      total_logs_count: totalAllGeneratedLogs
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
