/**
 * Seed Script: Dữ liệu canh tác mẫu Cây Sầu Riêng Ri6 STT 1-5 Trọn Vẹn 22 Năm (2004 - 2026)
 * Trang trại Long Khánh (LK Farm) - Chuẩn Nông Học VietGAP Tinh Hoa
 * Đồng bộ 100% Chi Phí Đầu Tư Vật Tư Tiêu Hao (Phân bón, Thuốc BVTV, Tiền nước, Nhân công)
 * Tối ưu hóa Bộ nhớ (0% Nguy cơ OOM trên Render 512MB RAM)
 * Chạy: node scripts/seed_durian_ri6_lk.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/db');

async function seedDurianRi6LK(options = {}) {
  const client = await pool.connect();
  try {
    console.log('🌱 Bắt đầu nạp dữ liệu mẫu Nông học VietGAP & Chi phí đầu tư 5 Cây Sầu Riêng Ri6 LK...');
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
        ) VALUES ($1, 'LK', 0.57, 5, 'VN-LK-001', 'VG-2026-LK88', 'Quacert Việt Nam', 10.941200, 107.241500, $2, true, true)
        RETURNING id
      `, [userId, farmPolygon]);
      farmId = newFarm.rows[0].id;
      farmName = 'LK';
      console.log(`🏡 Đã tạo mới Trang Trại "LK" (ID: ${farmId})`);
    }

    // Lấy danh sách tất cả User IDs liên quan
    const allRelatedUsersRes = await client.query(`
      SELECT id FROM users 
      WHERE id = $1 
         OR farm_id = $2 
         OR full_name ILIKE '%Mathew%' 
         OR phone = '0123456789'
         OR role = 'admin'
    `, [userId, farmId]);
    const userIdsToSeed = allRelatedUsersRes.rows.map(r => r.id);

    // ── 2. ĐỒNG BỘ 10 VẬT TƯ TIÊU CHUẨN SẦU RIÊNG RI6 CHO CÁC TÀI KHOẢN LIÊN QUAN ──
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
        note: 'Định mức tiêu chuẩn 300 - 550 lít/cây/lần tưới'
      },
      {
        name: 'Nhân công chăm sóc kỹ thuật VietGAP',
        category: 'Nhân công',
        unit: 'công',
        package_size: 'Ngày công',
        package_qty: 1,
        package_unit: 'công',
        package_price: 350000,
        unit_price: 350000,
        unit_price_small: 350000,
        stock_quantity: 999999,
        image_url: 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=600&auto=format&fit=crop&q=80',
        phi_days: 0,
        active_ingredient: 'Nhân công kỹ thuật cao chuyên vườn sầu riêng',
        target_pests: 'Thực hiện cắt tỉa cành tán, thụ phấn ban đêm, tuyển trái và thu hoạch',
        note: 'Đơn giá 350.000 VNĐ / công nhật'
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
    console.log(`📦 Đã đồng bộ danh mục 10 vật tư & nhân công chuyên dụng cho sầu riêng Ri6`);

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
    let totalAllSupplyUsages = 0;

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
        { year: 2004, age: 1, trunk_diameter_cm: Math.round(8 * mult), height_m: Number((1.2 * mult).toFixed(1)), canopy_m: Number((0.8 * mult).toFixed(1)), phase: 'Xuống giống cây con tại vườn Long Khánh' },
        { year: 2005, age: 2, trunk_diameter_cm: Math.round(14 * mult), height_m: Number((2.2 * mult).toFixed(1)), canopy_m: Number((1.8 * mult).toFixed(1)), phase: 'Bấm đọt phân cành cấp 1' },
        { year: 2006, age: 3, trunk_diameter_cm: Math.round(20 * mult), height_m: Number((3.4 * mult).toFixed(1)), canopy_m: Number((2.8 * mult).toFixed(1)), phase: 'Tạo tán hình tháp thông thoáng' },
        { year: 2007, age: 4, trunk_diameter_cm: Math.round(26 * mult), height_m: Number((4.6 * mult).toFixed(1)), canopy_m: Number((4.0 * mult).toFixed(1)), phase: 'Sinh khối phát triển vượt bậc' },
        { year: 2008, age: 5, trunk_diameter_cm: Math.round(32 * mult), height_m: Number((5.8 * mult).toFixed(1)), canopy_m: Number((5.5 * mult).toFixed(1)), phase: 'Chuẩn bị thể trạng đón trái bói' },
        { year: 2009, age: 6, trunk_diameter_cm: Math.round(36 * mult), height_m: Number((6.8 * mult).toFixed(1)), canopy_m: Number((6.5 * mult).toFixed(1)), phase: 'Vụ bói đầu tiên' },
        { year: 2013, age: 10, trunk_diameter_cm: Math.round(45 * mult), height_m: Number((8.5 * mult).toFixed(1)), canopy_m: Number((8.0 * mult).toFixed(1)), phase: 'Cây 10 năm tuổi thương phẩm' },
        { year: 2018, age: 15, trunk_diameter_cm: Math.round(56 * mult), height_m: Number((10.5 * mult).toFixed(1)), canopy_m: Number((9.8 * mult).toFixed(1)), phase: 'Đạt đỉnh cao sinh học' },
        { year: 2024, age: 20, trunk_diameter_cm: treeCfg.trunk_diameter_cm, height_m: treeCfg.height_m, canopy_m: treeCfg.canopy_diameter_m, phase: 'Cổ thụ 20 năm kinh doanh cực thịnh' }
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
        planting_date: '2004-06-18',
        planted_date: '2004-06-18',
        planting_year: 2004,
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

      if (!existingPlant && existingPlantsInFarm.rows[treeIdx]) {
        existingPlant = existingPlantsInFarm.rows[treeIdx];
      }

      let currentPlantId = null;

      if (existingPlant) {
        currentPlantId = existingPlant.id;
        // BẢO TOÀN 100% TỌA ĐỘ GPS HIỆN HỮU NẾU ĐÃ CÓ (Tự động sửa nếu bị lưu ngược)
        let finalLat = existingPlant.latitude != null ? Number(existingPlant.latitude) : treeCfg.default_lat;
        let finalLng = existingPlant.longitude != null ? Number(existingPlant.longitude) : treeCfg.default_lng;
        if (Math.abs(finalLat) > 90 && Math.abs(finalLng) <= 90) {
          const tmp = finalLat;
          finalLat = finalLng;
          finalLng = tmp;
        }

        await client.query(`
          UPDATE plants SET
            plant_type = 'Sầu riêng',
            plant_variety = $1,
            plant_age = '20 năm tuổi',
            planting_date = '2004-06-18',
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
            $1, $2, 'Sầu riêng', $3, '20 năm tuổi', '2004-06-18', $4,
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

      // ── 5. XÓA DỮ LIỆU CŨ CỦA CÂY ĐỂ ĐỒNG BỘ MỚI HOÀN TOÀN ──
      await client.query(`DELETE FROM plant_logs WHERE plant_id = $1`, [currentPlantId]);
      await client.query(`DELETE FROM supply_usages WHERE plant_id = $1`, [currentPlantId]);

      const generatedLogs = [];
      const generatedUsages = [];

      // Helper ghi nhận tiêu hao vật tư đồng bộ
      function recordSupplyUsage(supName, dateStr, quantity, unit, unitPrice, customTotalCost, note) {
        const supplyId = supplyMap[supName];
        if (!supplyId) return null;
        const uPrice = unitPrice !== undefined ? unitPrice : (supplyMap[supName]?.unit_price || 0);
        const totalCost = customTotalCost !== undefined ? customTotalCost : Math.round(quantity * uPrice);

        generatedUsages.push({
          user_id: userId,
          supply_id: supplyId,
          farm_id: farmId,
          plant_id: currentPlantId,
          usage_date: dateStr,
          quantity: quantity,
          unit_price: uPrice,
          total_cost: totalCost,
          note: note || `${supName} cho Cây #${treeCfg.tree_code}`
        });

        return { supply_id: supplyId, supply_name: supName, quantity, unit, unit_price: uPrice, total_cost: totalCost };
      }

      // ── 5A. NĂM 2004 - 2008 (THỜI KỲ KIẾN THIẾT CƠ BẢN - NĂM 1 ĐẾN 5) ──
      for (let year = 2004; year <= 2008; year++) {
        const treeAge = year - 2004 + 1;

        if (year === 2004) {
          // Ngày xuống giống cây con 18/06/2004
          const plantDate = '2004-06-18';
          const supFert = recordSupplyUsage('Phân hữu cơ vi sinh nở Bỉ (Belgo Organic)', plantDate, 10, 'kg', 15200, 152000, `Bón lót xuống giống Cây #${treeCfg.tree_code}`);
          const supWater = recordSupplyUsage('Tiền nước tưới giếng khoan công nghiệp', plantDate, 0.2, 'm3', 3500, 700, `Tưới đẫm khi trồng Cây #${treeCfg.tree_code}`);
          const supLabor = recordSupplyUsage('Nhân công chăm sóc kỹ thuật VietGAP', plantDate, 1, 'công', 350000, 350000, `Đào hố bón lót & xuống giống Cây #${treeCfg.tree_code}`);

          generatedLogs.push({
            plant_id: currentPlantId,
            log_date: plantDate,
            log_type: 'Khác',
            operator_name: 'Nguyễn Văn Long (Kỹ sư trưởng)',
            equipment_used: 'Cuốc xới & Thước đo độ sâu hố 80x80x80cm',
            note: `08:00 ${plantDate}: Xuống giống cây sầu riêng ghép mắt Ri6 Cây #${treeCfg.tree_code} tại Lô A1 Trang trại Long Khánh. Đào hố 80x80x80cm, bón lót 10kg Phân hữu cơ Bỉ và tưới đẫm nước.`,
            media_urls: [],
            details: { time: '08:00', event: 'Xuống giống', variety: 'Ri6 Gốc Ghép', tree_age: '1 năm tuổi' },
            puc_code: 'VN-LK-001',
            created_by: userId
          });
        }

        // Các sự kiện chuẩn nông học trong thời kỳ kiến thiết cơ bản (Mỗi năm ~12 nhật ký đại diện)
        const seasonalEvents = [
          { m: 1, d: 15, type: 'Tưới nước', water: 0.2, text: 'Tưới giữ ẩm bồn gốc mùa khô hanh' },
          { m: 2, d: 20, type: 'Tưới nước', water: 0.25, text: 'Tưới đẫm tán lá chống khô hạn' },
          { m: 3, d: 25, type: 'Bón phân', fert: 'Phân NPK 20-20-15+TE Đầu Trâu Chuyên Cây Ăn Trái', fertQty: 0.5, fertUnit: 'kg', fertCost: 8900, text: 'Bón thúc cơi đọt 1 bằng NPK Đầu Trâu' },
          { m: 4, d: 20, type: 'Phun thuốc', pest: 'Thuốc trừ sâu rầy sinh học Radiant 60SC', pestQty: 15, pestUnit: 'ml', pestCost: 11700, phi: 3, text: 'Phun sinh học ngừa rầy phấn cơi đọt mới' },
          { m: 5, d: 25, type: 'Cắt tỉa', labor: 0.5, text: 'Bấm ngọn kích cành cấp 1 tạo khung tán tháp' },
          { m: 6, d: 20, type: 'Bón phân', fert: 'Phân hữu cơ vi sinh nở Bỉ (Belgo Organic)', fertQty: 8, fertUnit: 'kg', fertCost: 121600, text: 'Bón phân hữu cơ nở Bỉ đầu mùa mưa cải tạo đất' },
          { m: 7, d: 15, type: 'Khác', text: 'Kiểm tra sinh trắc học, đo pH đất đạt 6.2' },
          { m: 8, d: 20, type: 'Phun thuốc', pest: 'Thuốc đặc trị nứt thân xì mủ Ridomil Gold 68WG', pestQty: 30, pestUnit: 'g', pestCost: 9600, phi: 14, text: 'Quét gốc phòng ngừa nấm Phytophthora mùa mưa' },
          { m: 9, d: 25, type: 'Cắt tỉa', labor: 0.5, text: 'Tỉa cành vượt, cành mọc sát mặt đất dưới 0.8m' },
          { m: 10, d: 20, type: 'Bón phân', fert: 'Phân NPK 20-20-15+TE Đầu Trâu Chuyên Cây Ăn Trái', fertQty: 0.5, fertUnit: 'kg', fertCost: 8900, text: 'Bón phân dưỡng bộ rễ trước mùa khô' },
          { m: 11, d: 25, type: 'Khác', text: 'Vệ sinh bồn gốc, tủ cỏ khô giữ ẩm qua mùa đông' },
          { m: 12, d: 20, type: 'Tưới nước', water: 0.3, text: 'Tưới nước duy trì sinh trưởng cơi đọt' }
        ];

        for (const ev of seasonalEvents) {
          const dateStr = `${year}-${String(ev.m).padStart(2, '0')}-${String(ev.d).padStart(2, '0')}`;
          let logDetails = { time: '08:00', tree_age: `${treeAge} năm tuổi` };

          if (ev.type === 'Tưới nước') {
            const usage = recordSupplyUsage('Tiền nước tưới giếng khoan công nghiệp', dateStr, ev.water, 'm3', 3500, Math.round(ev.water * 3500), `Tưới nước Cây #${treeCfg.tree_code}`);
            logDetails = { ...logDetails, ...usage };
          } else if (ev.type === 'Bón phân') {
            const usage = recordSupplyUsage(ev.fert, dateStr, ev.fertQty, ev.fertUnit, 15200, ev.fertCost, `Bón ${ev.fert} Cây #${treeCfg.tree_code}`);
            logDetails = { ...logDetails, ...usage };
          } else if (ev.type === 'Phun thuốc') {
            const usage = recordSupplyUsage(ev.pest, dateStr, ev.pestQty, ev.pestUnit, 260, ev.pestCost, `Phun ${ev.pest} Cây #${treeCfg.tree_code}`);
            logDetails = { ...logDetails, ...usage, phi_days: ev.phi, phi_safe_date: new Date(new Date(dateStr).getTime() + ev.phi * 86400000).toISOString().split('T')[0] };
          } else if (ev.labor) {
            recordSupplyUsage('Nhân công chăm sóc kỹ thuật VietGAP', dateStr, ev.labor, 'công', 350000, Math.round(ev.labor * 350000), `Nhân công ${ev.text} Cây #${treeCfg.tree_code}`);
            logDetails.labor_cost = Math.round(ev.labor * 350000);
          }

          generatedLogs.push({
            plant_id: currentPlantId,
            log_date: dateStr,
            log_type: ev.type,
            operator_name: operators[(ev.m + treeIdx) % 4],
            equipment_used: equipmentList[ev.type] ? equipmentList[ev.type][0] : 'Dụng cụ thủ công',
            note: `08:00 ${dateStr}: ${ev.text} Cây #${treeCfg.tree_code}. Thể trạng cây phát triển khỏe mạnh.`,
            media_urls: [],
            details: logDetails,
            puc_code: 'VN-LK-001',
            created_by: userId
          });
        }
      }

      // ── 5B. NĂM 2009 - 2023 (THỜI KỲ KINH DOANH THƯƠNG PHẨM - NĂM 6 ĐẾN 20) ──
      for (let year = 2009; year <= 2023; year++) {
        const treeAge = year - 2004 + 1;
        const seasonYield = treeYieldRecords.find(y => y.year === year) || treeYieldRecords[0];

        // Chuỗi nông học kinh doanh chuẩn VietGAP hàng năm (~22 logs/năm + vật tư tương ứng)
        const commercialCycle = [
          // 1. Tháng 1: Thụ phấn nhân tạo ban đêm & phun Canxi Bo
          { m: 1, d: 5, type: 'Tưới nước', water: 0.35, text: 'Tưới nhấp nhẹ giữ ẩm chống rụng hoa' },
          { m: 1, d: 10, type: 'Thụ phấn', labor: 0.5, text: 'Quét phấn chéo bổ sung từ giống Monthong sang nhụy Ri6 bằng chổi mềm lúc 18h30 - 20h00' },
          { m: 1, d: 18, type: 'Bón phân', fert: 'Phân bón lá Canxi Bo Sữa Bo-Trac Yara Anh Quốc', fertQty: 100, fertUnit: 'ml', fertCost: 18000, text: 'Phun Canxi Bo tăng sức sống hạt phấn và chống nứt cuống hoa' },
          { m: 1, d: 25, type: 'Phun thuốc', pest: 'Thuốc trừ sâu rầy sinh học Radiant 60SC', pestQty: 25, pestUnit: 'ml', pestCost: 19500, phi: 3, text: 'Phun phòng trừ bọ trĩ chích hút hoa non' },

          // 2. Tháng 2 & 3: Nuôi trái non & Định hình quả
          { m: 2, d: 10, type: 'Tưới nước', water: 0.45, text: 'Tưới nước nuôi trái non giai đoạn trứng gà' },
          { m: 2, d: 20, type: 'Cắt tỉa', labor: 0.5, text: 'Tỉa bỏ trái non dị hình, vẹo múi, cuống nhỏ, giữ lại quả cân đối' },
          { m: 3, d: 5, type: 'Bón phân', fert: 'Phân NPK 20-20-15+TE Đầu Trâu Chuyên Cây Ăn Trái', fertQty: Math.round(2.5 * mult), fertUnit: 'kg', fertCost: Math.round(2.5 * mult * 17800), text: 'Bón phân NPK Đầu Trâu nuôi trái lớn nhanh' },
          { m: 3, d: 18, type: 'Tưới nước', water: 0.5, text: 'Tưới nước bù áp định kỳ giữ độ ẩm 65%' },
          { m: 3, d: 28, type: 'Phun thuốc', pest: 'Thuốc trừ nấm bệnh Anvil 5SC (Syngenta)', pestQty: 40, pestUnit: 'ml', pestCost: 10400, phi: 14, text: 'Phun ngừa nấm thán thư cuống trái và cháy lá' },

          // 3. Tháng 4 & 5: Vỗ béo cơm vàng & Cắt tỉa hoàn thiện
          { m: 4, d: 10, type: 'Bón phân', fert: 'Phân Kali Trắng Sunfat K2SO4 SoluPotasse 0-0-50', fertQty: Math.round(1.5 * mult), fertUnit: 'kg', fertCost: Math.round(1.5 * mult * 30000), text: 'Bón Kali Sunfat SoluPotasse giúp cơm vàng óng ráo nước' },
          { m: 4, d: 22, type: 'Tưới nước', water: 0.4, text: 'Tưới nhẹ duy trì thể trạng quả trước thu hoạch' },
          { m: 5, d: 5, type: 'Khác', text: 'Buộc dây níu cành chống giông lốc gió quật gãy cành trĩu quả' },

          // 4. Thu hoạch Đợt 1 (15/05)
          {
            m: 5, d: 15, type: 'Thu hoạch', isHarvest: true, harvestBatchNum: 1,
            labor: 0.5,
            fruits: Math.round(seasonYield.fruit_count * 0.55),
            kg: Math.round(seasonYield.yield_kg * 0.55),
            text: `THU HOẠCH CHÍNH VỤ SẦU RIÊNG RI6 ĐỢT 1 (Đạt chuẩn VietGAP xuất khẩu)`
          },

          // 5. Thu hoạch Đợt 2 (28/05)
          {
            m: 5, d: 28, type: 'Thu hoạch', isHarvest: true, harvestBatchNum: 2,
            labor: 0.5,
            fruits: Math.round(seasonYield.fruit_count * 0.45),
            kg: Math.round(seasonYield.yield_kg * 0.45),
            text: `THU HOẠCH VÉT SẦU RIÊNG RI6 ĐỢT 2 HOÀN TẤT VỤ MÙA`
          },

          // 6. Tháng 6 & 7: Phục hồi cây sau thu hoạch
          { m: 6, d: 15, type: 'Cắt tỉa', labor: 0.5, text: 'Cắt bỏ cuống quả cũ, tỉa cành khô tàn kiệt sức sau thu hoạch' },
          { m: 6, d: 25, type: 'Phun thuốc', pest: 'Thuốc đặc trị nứt thân xì mủ Ridomil Gold 68WG', pestQty: 50, pestUnit: 'g', pestCost: 16000, phi: 14, text: 'Quét vôi pha Ridomil phòng nấm gốc xì mủ' },
          { m: 7, d: 10, type: 'Bón phân', fert: 'Phân hữu cơ vi sinh nở Bỉ (Belgo Organic)', fertQty: Math.round(15 * mult), fertUnit: 'kg', fertCost: Math.round(15 * mult * 15200), text: 'Bón phân hữu cơ vi sinh Bỉ phục hồi rễ tơ và tán lá' },
          { m: 7, d: 20, type: 'Tưới nước', water: 0.5, text: 'Tưới xả phân kích phát cơi đọt mới' },

          // 7. Tháng 8 - 11: Xử lý ra hoa nghịch vụ & Làm cỏ tạo hạn
          { m: 8, d: 20, type: 'Khác', text: 'Quan trắc cơi đọt 2, tán lá chuyển màu xanh dày bóng' },
          { m: 9, d: 15, type: 'Khác', text: 'Dọn sạch cỏ bồn, cào xới nhẹ mặt đất chuẩn bị xiết nước' },
          { m: 10, d: 15, type: 'Bón phân', fert: 'Phân bón lá tạo mầm hoa MKP 0-52-34 Haifa Israel', fertQty: Math.round(0.5 * mult), fertUnit: 'kg', fertCost: Math.round(0.5 * mult * 50000), text: 'Phun MKP 0-52-34 già lá nhanh và tạo mầm hoa' },
          { m: 11, d: 20, type: 'Khác', text: 'Nhú mắt cua đồng loạt tại các cành cấp 1 mang quả' },
          { m: 12, d: 15, type: 'Tỉa hoa', labor: 0.5, text: 'Tỉa bỏ hoa méo đầu cành, giữ lại chùm hoa tròn khỏe giữa cành' }
        ];

        for (const ev of commercialCycle) {
          const dateStr = `${year}-${String(ev.m).padStart(2, '0')}-${String(ev.d).padStart(2, '0')}`;
          let logDetails = { time: '07:30', tree_age: `${treeAge} năm tuổi` };

          if (ev.type === 'Tưới nước') {
            const usage = recordSupplyUsage('Tiền nước tưới giếng khoan công nghiệp', dateStr, ev.water, 'm3', 3500, Math.round(ev.water * 3500), `Tưới nước Cây #${treeCfg.tree_code}`);
            logDetails = { ...logDetails, ...usage };
          } else if (ev.type === 'Bón phân') {
            const usage = recordSupplyUsage(ev.fert, dateStr, ev.fertQty, ev.fertUnit, 15200, ev.fertCost, `Bón ${ev.fert} Cây #${treeCfg.tree_code}`);
            logDetails = { ...logDetails, ...usage };
          } else if (ev.type === 'Phun thuốc') {
            const usage = recordSupplyUsage(ev.pest, dateStr, ev.pestQty, ev.pestUnit, 260, ev.pestCost, `Phun ${ev.pest} Cây #${treeCfg.tree_code}`);
            logDetails = { ...logDetails, ...usage, phi_days: ev.phi, phi_safe_date: new Date(new Date(dateStr).getTime() + ev.phi * 86400000).toISOString().split('T')[0] };
          } else if (ev.labor) {
            recordSupplyUsage('Nhân công chăm sóc kỹ thuật VietGAP', dateStr, ev.labor, 'công', 350000, Math.round(ev.labor * 350000), `Nhân công ${ev.type} Cây #${treeCfg.tree_code}`);
            logDetails.labor_cost = Math.round(ev.labor * 350000);
          }

          let batchCode = null;
          if (ev.isHarvest) {
            batchCode = `VN-LK-001-${year}${String(ev.m).padStart(2, '0')}${String(ev.d).padStart(2, '0')}-SR0${treeCfg.tree_code}`;
            const rev = ev.kg * seasonYield.avg_price_vnd;
            logDetails = {
              ...logDetails,
              time: '06:00',
              yield_kg: ev.kg,
              fruit_count: ev.fruits,
              unit_price_vnd: seasonYield.avg_price_vnd,
              total_revenue: rev,
              batch_code: batchCode,
              brix_sweetness: seasonYield.brix || '33° Brix',
              phi_status: 'safe'
            };
          }

          generatedLogs.push({
            plant_id: currentPlantId,
            log_date: dateStr,
            log_type: ev.type,
            operator_name: operators[(ev.m + treeIdx) % 4],
            equipment_used: equipmentList[ev.type] ? equipmentList[ev.type][0] : 'Dụng cụ làm vườn VietGAP',
            note: `${ev.type === 'Thu hoạch' ? '06:00' : '07:30'} ${dateStr}: ${ev.text} Cây #${treeCfg.tree_code}.`,
            media_urls: [],
            batch_code: batchCode,
            details: logDetails,
            puc_code: 'VN-LK-001',
            is_phi_violation: false,
            created_by: userId
          });
        }
      }

      // ── 5C. NĂM 2024 - 2026 (CANH TÁC CHUYÊN SÂU HIỆN TẠI - 40+ LOGS/NĂM CHI TIẾT) ──
      for (let year = 2024; year <= 2026; year++) {
        const treeAge = year - 2004 + 1;
        const seasonYield = treeYieldRecords.find(y => y.year === year) || treeYieldRecords[treeYieldRecords.length - 1];
        const maxMonth = (year === 2026) ? 6 : 12;

        for (let m = 1; m <= maxMonth; m++) {
          // 1. Kiểm tra vườn & đo cảm biến độ ẩm / EC đất (Hàng tháng)
          const checkDate = `${year}-${String(m).padStart(2, '0')}-05`;
          generatedLogs.push({
            plant_id: currentPlantId,
            log_date: checkDate,
            log_type: 'Khác',
            operator_name: 'Lê Văn Tám (Kỹ thuật viên VietGAP)',
            equipment_used: 'Đầu dò cảm biến IoT độ ẩm đất & Máy đo Hanna pH/EC',
            note: `08:00 ${checkDate}: Quan trắc độ ẩm đất (${62 + ((m + treeIdx) % 15)}%), chỉ số EC (${(0.85 + (m % 5)*0.04).toFixed(2)} mS/cm) và pH (${(6.2 + (m % 3)*0.1).toFixed(1)}) tại bồn Cây #${treeCfg.tree_code}. Thể trạng rất tốt.`,
            media_urls: [],
            details: { time: '08:00', soil_moisture: `${62 + ((m + treeIdx) % 15)}%`, soil_ph: (6.2 + (m % 3)*0.1).toFixed(1), tree_age: `${treeAge} năm tuổi` },
            puc_code: 'VN-LK-001',
            created_by: userId
          });

          // 2. Tưới nước bù áp định kỳ
          if (m <= 5 || m >= 11) {
            const waterDate = `${year}-${String(m).padStart(2, '0')}-12`;
            const waterLiters = Math.round(500 * mult);
            const waterUsage = recordSupplyUsage('Tiền nước tưới giếng khoan công nghiệp', waterDate, waterLiters / 1000, 'm3', 3500, Math.round((waterLiters / 1000) * 3500), `Tưới bù áp Cây #${treeCfg.tree_code}`);
            generatedLogs.push({
              plant_id: currentPlantId,
              log_date: waterDate,
              log_type: 'Tưới nước',
              operator_name: 'Hệ thống tưới tự động bù áp IoT',
              equipment_used: 'Trạm bơm điều khiển van thông minh',
              note: `06:30 ${waterDate}: Bật hệ thống béc tưới bù áp tự động Cây #${treeCfg.tree_code} (${waterLiters} lít nước). Cân bằng độ ẩm vùng rễ tơ.`,
              media_urls: [],
              details: { time: '06:30', ...waterUsage },
              puc_code: 'VN-LK-001',
              created_by: userId
            });
          }

          // 3. Bón phân theo từng giai đoạn sinh trưởng
          if (m === 2 || m === 4 || m === 7 || m === 10) {
            const fertDate = `${year}-${String(m).padStart(2, '0')}-18`;
            let fName = 'Phân NPK 20-20-15+TE Đầu Trâu Chuyên Cây Ăn Trái';
            let fQty = Math.round(3.0 * mult);
            let fCost = Math.round(fQty * 17800);

            if (m === 4) {
              fName = 'Phân Kali Trắng Sunfat K2SO4 SoluPotasse 0-0-50';
              fQty = Math.round(1.8 * mult);
              fCost = Math.round(fQty * 30000);
            } else if (m === 7) {
              fName = 'Phân hữu cơ vi sinh nở Bỉ (Belgo Organic)';
              fQty = Math.round(18 * mult);
              fCost = Math.round(fQty * 15200);
            } else if (m === 10) {
              fName = 'Phân bón lá tạo mầm hoa MKP 0-52-34 Haifa Israel';
              fQty = Math.round(0.5 * mult);
              fCost = Math.round(fQty * 50000);
            }

            const fertUsage = recordSupplyUsage(fName, fertDate, fQty, 'kg', 17800, fCost, `Bón ${fName} Cây #${treeCfg.tree_code}`);
            generatedLogs.push({
              plant_id: currentPlantId,
              log_date: fertDate,
              log_type: 'Bón phân',
              operator_name: 'Nguyễn Văn Long (Kỹ sư trưởng)',
              equipment_used: 'Thùng rải phân gốc cải tiến',
              note: `07:30 ${fertDate}: Bón ${fQty}kg ${fName} cho Cây #${treeCfg.tree_code} theo hình chiếu tán lá.`,
              media_urls: [],
              details: { time: '07:30', ...fertUsage },
              puc_code: 'VN-LK-001',
              created_by: userId
            });
          }

          // 4. Phun thuốc bảo vệ thực vật định kỳ
          if (m === 1 || m === 3 || m === 8) {
            const sprayDate = `${year}-${String(m).padStart(2, '0')}-24`;
            let pName = 'Thuốc trừ sâu rầy sinh học Radiant 60SC';
            let pQty = 30;
            let pCost = 23400;
            let phiDays = 3;

            if (m === 3) {
              pName = 'Thuốc trừ nấm bệnh Anvil 5SC (Syngenta)';
              pQty = 50;
              pCost = 13000;
              phiDays = 14;
            } else if (m === 8) {
              pName = 'Thuốc đặc trị nứt thân xì mủ Ridomil Gold 68WG';
              pQty = 80;
              pCost = 25600;
              phiDays = 14;
            }

            const sprayUsage = recordSupplyUsage(pName, sprayDate, pQty, 'ml', 260, pCost, `Phun ${pName} Cây #${treeCfg.tree_code}`);
            generatedLogs.push({
              plant_id: currentPlantId,
              log_date: sprayDate,
              log_type: 'Phun thuốc',
              operator_name: 'Lê Văn Tám (Kỹ thuật viên VietGAP)',
              equipment_used: 'Máy nén áp lực cao 50 bar',
              note: `06:30 ${sprayDate}: Phun ${pName} phòng trừ dịch hại tán lá Cây #${treeCfg.tree_code}. Thời gian cách ly PHI ${phiDays} ngày.`,
              media_urls: [],
              details: {
                time: '06:30',
                ...sprayUsage,
                phi_days: phiDays,
                phi_safe_date: new Date(new Date(sprayDate).getTime() + phiDays * 86400000).toISOString().split('T')[0]
              },
              puc_code: 'VN-LK-001',
              is_phi_violation: false,
              created_by: userId
            });
          }

          // 5. Cắt tỉa / Thụ phấn / Thu hoạch chuyên biệt
          if (m === 1) {
            // Thụ phấn ban đêm
            const polDate = `${year}-01-15`;
            recordSupplyUsage('Nhân công chăm sóc kỹ thuật VietGAP', polDate, 0.5, 'công', 350000, 175000, `Thụ phấn đêm Cây #${treeCfg.tree_code}`);
            generatedLogs.push({
              plant_id: currentPlantId,
              log_date: polDate,
              log_type: 'Thụ phấn',
              operator_name: 'Nguyễn Thị Mai (Tổ thụ phấn & chăm sóc)',
              equipment_used: 'Chổi lông cọ mềm & Đèn LED',
              note: `19:00 ${polDate}: Thụ phấn nhân tạo ban đêm chéo giống Monthong cho hoa Ri6 Cây #${treeCfg.tree_code}. Đạt 98% hoa tiếp nhận phấn đều.`,
              media_urls: [],
              details: { time: '19:00', labor_cost: 175000, task: 'Thụ phấn nhân tạo' },
              puc_code: 'VN-LK-001',
              created_by: userId
            });
          }

          if (m === 5) {
            // Thu hoạch Đợt 1 (15/05)
            const hDate1 = `${year}-05-15`;
            const cutKg1 = Math.round(seasonYield.yield_kg * 0.6);
            const cutFruits1 = Math.round(seasonYield.fruit_count * 0.6);
            const rev1 = cutKg1 * seasonYield.avg_price_vnd;
            const bCode1 = `VN-LK-001-${year}0515-SR0${treeCfg.tree_code}`;
            recordSupplyUsage('Nhân công chăm sóc kỹ thuật VietGAP', hDate1, 0.5, 'công', 350000, 175000, `Thu hoạch Đợt 1 Cây #${treeCfg.tree_code}`);

            generatedLogs.push({
              plant_id: currentPlantId,
              log_date: hDate1,
              log_type: 'Thu hoạch',
              operator_name: 'Nguyễn Văn Long (Kỹ sư trưởng)',
              equipment_used: 'Dao cắt chuyên dụng & Cân điện tử 100kg',
              note: `06:00 ${hDate1}: THU HOẠCH CHÍNH VỤ SẦU RIÊNG RI6 CÂY #${treeCfg.tree_code} (Đợt 1). Cắt ${cutFruits1} trái (~${cutKg1} kg) độ chín 8.5 tuổi. Dán tem truy xuất Mã Lô: ${bCode1}.`,
              media_urls: [],
              batch_code: bCode1,
              details: {
                time: '06:00',
                yield_kg: cutKg1,
                fruit_count: cutFruits1,
                unit_price_vnd: seasonYield.avg_price_vnd,
                total_revenue: rev1,
                batch_code: bCode1,
                brix_sweetness: '34° Brix',
                phi_status: 'safe'
              },
              puc_code: 'VN-LK-001',
              is_phi_violation: false,
              created_by: userId
            });

            // Thu hoạch Đợt 2 (28/05)
            const hDate2 = `${year}-05-28`;
            const cutKg2 = Math.round(seasonYield.yield_kg * 0.4);
            const cutFruits2 = Math.round(seasonYield.fruit_count * 0.4);
            const rev2 = cutKg2 * seasonYield.avg_price_vnd;
            const bCode2 = `VN-LK-001-${year}0528-SR0${treeCfg.tree_code}`;
            recordSupplyUsage('Nhân công chăm sóc kỹ thuật VietGAP', hDate2, 0.5, 'công', 350000, 175000, `Thu hoạch Đợt 2 Cây #${treeCfg.tree_code}`);

            generatedLogs.push({
              plant_id: currentPlantId,
              log_date: hDate2,
              log_type: 'Thu hoạch',
              operator_name: 'Nguyễn Văn Long (Kỹ sư trưởng)',
              equipment_used: 'Dao cắt chuyên dụng & Cân điện tử 100kg',
              note: `06:00 ${hDate2}: THU HOẠCH SẦU RIÊNG RI6 CÂY #${treeCfg.tree_code} (Đợt 2 hoàn tất mùa vụ). Cắt ${cutFruits2} trái (~${cutKg2} kg). Dán tem truy xuất Mã Lô: ${bCode2}.`,
              media_urls: [],
              batch_code: bCode2,
              details: {
                time: '06:00',
                yield_kg: cutKg2,
                fruit_count: cutFruits2,
                unit_price_vnd: seasonYield.avg_price_vnd,
                total_revenue: rev2,
                batch_code: bCode2,
                brix_sweetness: '34° Brix',
                phi_status: 'safe'
              },
              puc_code: 'VN-LK-001',
              is_phi_violation: false,
              created_by: userId
            });
          }
        }
      }

      totalAllGeneratedLogs += generatedLogs.length;
      totalAllSupplyUsages += generatedUsages.length;

      // Chèn nhật ký vào plant_logs theo batch
      const chunkSize = 500;
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

      // Chèn toàn bộ chi phí vật tư vào supply_usages theo batch
      for (let i = 0; i < generatedUsages.length; i += chunkSize) {
        const chunk = generatedUsages.slice(i, i + chunkSize);
        const valuePlaceholders = [];
        const queryParams = [];
        let paramIndex = 1;

        for (const usg of chunk) {
          valuePlaceholders.push(
            `($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8})`
          );
          queryParams.push(
            usg.user_id,
            usg.supply_id,
            usg.farm_id,
            usg.plant_id,
            usg.usage_date,
            usg.quantity,
            usg.unit_price,
            usg.total_cost,
            usg.note
          );
          paramIndex += 9;
        }

        const insertUsageSql = `
          INSERT INTO supply_usages (
            user_id, supply_id, farm_id, plant_id, usage_date, quantity, unit_price, total_cost, note
          ) VALUES ${valuePlaceholders.join(', ')}
        `;

        await client.query(insertUsageSql, queryParams);
      }

      console.log(`📝 [Tree #${treeCfg.tree_code}] Đã nạp thành công ${generatedLogs.length} nhật ký VietGAP & ${generatedUsages.length} đợt tiêu hao vật tư!`);
    }

    // ── 6. CẬP NHẬT TỔNG SỐ LƯỢNG CÂY TRỒNG TRANG TRẠI LK ──
    const totalPlantsInFarmRes = await client.query(`SELECT COUNT(*) as count FROM plants WHERE farm_id = $1`, [farmId]);
    const finalTotalPlants = parseInt(totalPlantsInFarmRes.rows[0].count, 10);
    await client.query(`UPDATE farms SET total_plants = $1 WHERE id = $2`, [finalTotalPlants, farmId]);
    console.log(`🏡 Đã cập nhật tổng số cây trang trại "${farmName}": ${finalTotalPlants} cây`);

    await client.query('COMMIT');
    console.log(`🎉 HOÀN THÀNH ĐỒNG BỘ DỮ LIỆU MẪU CẢ 5 CÂY SẦU RIÊNG RI6 (STT 1-5): ${totalAllGeneratedLogs} NHẬT KÝ & ${totalAllSupplyUsages} TIÊU HAO VẬT TƯ CHO TRANG TRẠI "${farmName}" THÀNH CÔNG 100%!`);
    return {
      farm_id: farmId,
      farm_name: farmName,
      total_plants: finalTotalPlants,
      seeded_trees: seededPlantsResult,
      total_logs_count: totalAllGeneratedLogs,
      total_supply_usages: totalAllSupplyUsages
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
