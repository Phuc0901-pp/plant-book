/**
 * Seed Script: Dữ liệu canh tác mẫu Cây Sầu Riêng Ri6 STT 1 (20 năm tuổi) - Trang trại Long Khánh (LK)
 * Tiêu chuẩn VietGAP 100% & Quản trị AgTech ERP
 * Chạy: node scripts/seed_durian_ri6_lk.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/db');

async function seedDurianRi6LK() {
  const client = await pool.connect();
  try {
    console.log('🌱 Bắt đầu tạo dữ liệu mẫu Cây Sầu Riêng Ri6 STT 1 (20 Năm Tuổi) - Trang Trại Long Khánh...');
    await client.query('BEGIN');

    // ── 1. KIỂM TRA HOẶC TẠO USER NÔNG HỘ TRANG TRẠI LK ──
    let userId = null;
    const userRes = await client.query(`SELECT id FROM users WHERE email = 'nongho.longkhanh@tanbaocorp.vn' OR email = 'user@tanbaocorp.vn' ORDER BY id ASC LIMIT 1`);
    if (userRes.rows.length > 0) {
      userId = userRes.rows[0].id;
    } else {
      const adminRes = await client.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
      if (adminRes.rows.length > 0) {
        userId = adminRes.rows[0].id;
      } else {
        const newUser = await client.query(`
          INSERT INTO users (email, password_hash, full_name, role, phone)
          VALUES ('nongho.longkhanh@tanbaocorp.vn', '$2a$12$eA8O...mock', 'Nguyễn Văn Long (Nông Hộ Long Khánh)', 'user', '0918123456')
          RETURNING id
        `);
        userId = newUser.rows[0].id;
      }
    }

    // ── 2. TẠO HOẶC CẬP NHẬT TRANG TRẠI LONG KHÁNH (LK FARM) ──
    const farmPolygon = JSON.stringify([
      [107.240500, 10.940500],
      [107.243500, 10.940800],
      [107.243200, 10.942500],
      [107.240200, 10.942200],
      [107.240500, 10.940500]
    ]);

    let farmId = null;
    const existingFarm = await client.query(`SELECT id FROM farms WHERE puc_code = 'VN-LK-001' OR name ILIKE '%Long Khánh%' LIMIT 1`);
    if (existingFarm.rows.length > 0) {
      farmId = existingFarm.rows[0].id;
      await client.query(`
        UPDATE farms SET 
          name = 'Trang Trại Sầu Riêng Long Khánh (LK Farm)',
          puc_code = 'VN-LK-001',
          vietgap_cert_number = 'VG-2026-LK88',
          vietgap_cert_org = 'Quacert Việt Nam',
          area = 4.5,
          total_plants = 450,
          latitude = 10.941200,
          longitude = 107.241500,
          polygon_coordinates = $1,
          allow_shared_supplies = true,
          allow_shared_history = true,
          updated_at = NOW()
        WHERE id = $2
      `, [farmPolygon, farmId]);
      console.log(`🏡 Đã cập nhật Trang Trại Long Khánh (ID: ${farmId})`);
    } else {
      const newFarm = await client.query(`
        INSERT INTO farms (
          user_id, name, area, total_plants, puc_code, vietgap_cert_number, vietgap_cert_org,
          latitude, longitude, polygon_coordinates, allow_shared_supplies, allow_shared_history
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, true)
        RETURNING id
      `, [
        userId, 'Trang Trại Sầu Riêng Long Khánh (LK Farm)', 4.5, 450, 'VN-LK-001',
        'VG-2026-LK88', 'Quacert Việt Nam', 10.941200, 107.241500, farmPolygon
      ]);
      farmId = newFarm.rows[0].id;
      console.log(`🏡 Đã tạo mới Trang Trại Long Khánh (ID: ${farmId})`);
    }

    // ── 3. TẠO 9 VẬT TƯ CHUYÊN DỤNG CANH TÁC SẦU RIÊNG RI6 ──
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
    for (const sup of suppliesData) {
      const existing = await client.query(
        `SELECT id FROM supplies WHERE user_id = $1 AND category = $2 AND LOWER(name) = LOWER($3)`,
        [userId, sup.category, sup.name.trim()]
      );

      if (existing.rows.length > 0) {
        supplyMap[sup.name] = existing.rows[0].id;
        await client.query(`
          UPDATE supplies SET
            package_size = $1, package_qty = $2, package_unit = $3,
            package_price = $4, unit_price = $5, unit_price_small = $6,
            stock_quantity = $7, image_url = $8, phi_days = $9,
            active_ingredient = $10, target_pests = $11, note = $12, fertilizer_type = $13,
            updated_at = NOW()
          WHERE id = $14
        `, [
          sup.package_size, sup.package_qty, sup.package_unit,
          sup.package_price, sup.unit_price, sup.unit_price_small,
          sup.stock_quantity, sup.image_url, sup.phi_days,
          sup.active_ingredient, sup.target_pests, sup.note, sup.fertilizer_type || null,
          existing.rows[0].id
        ]);
      } else {
        const ins = await client.query(`
          INSERT INTO supplies (
            user_id, category, name, unit, package_size, package_qty, package_unit,
            package_price, unit_price, unit_price_small, stock_quantity, note,
            image_url, fertilizer_type, phi_days, active_ingredient, target_pests
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          RETURNING id
        `, [
          userId, sup.category, sup.name, sup.unit, sup.package_size, sup.package_qty, sup.package_unit,
          sup.package_price, sup.unit_price, sup.unit_price_small, sup.stock_quantity, sup.note,
          sup.image_url, sup.fertilizer_type || null, sup.phi_days, sup.active_ingredient, sup.target_pests
        ]);
        supplyMap[sup.name] = ins.rows[0].id;
      }
    }
    console.log(`📦 Đã khởi tạo danh mục 9 vật tư sầu riêng Ri6 VietGAP`);

    // ── 4. TẠO HOẶC CẬP NHẬT CÂY SẦU RIÊNG STT 1 (20 NĂM TUỔI) ──
    const treeData = {
      trunk_diameter_cm: 65,
      height_m: 12.5,
      canopy_diameter_m: 11.0,
      average_yield_kg: 420,
      planting_year: 2004,
      rootstock: 'Gốc ghép sầu riêng hạt bản địa Long Khánh',
      current_season_target_fruits: 140,
      irrigation_system: 'Béc tưới bù áp tự động 120L/h (3 béc quanh tán)'
    };

    let plantId = null;
    const existingPlant = await client.query(
      `SELECT id FROM plants WHERE farm_id = $1 AND (tree_code = 'SR-01' OR tree_code = '1' OR tree_code = 'STT 1') LIMIT 1`,
      [farmId]
    );

    const coverImg = 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=800&auto=format&fit=crop&q=80';

    if (existingPlant.rows.length > 0) {
      plantId = existingPlant.rows[0].id;
      await client.query(`
        UPDATE plants SET
          plant_type = 'Sầu riêng',
          plant_variety = 'Ri6 Cổ Thụ (20 Năm Tuổi)',
          plant_age = '20 năm tuổi',
          health_status = 'Tốt',
          location = 'Lô A1 - Hàng 1 - Cây STT 1 (Cây đầu hồi cổng chính)',
          tree_code = 'SR-01',
          nfc_uid = '04:A2:3B:8C:9F:5D:80',
          public_slug = 'flk-sr01-ri6-longkhanh',
          latitude = 10.941520,
          longitude = 107.241850,
          cover_image = $1,
          is_public = true,
          data = $2,
          phi_status = 'safe',
          phi_until_date = '2026-06-04',
          last_pesticide_date = '2026-05-20',
          last_pesticide_name = 'Thuốc trừ nấm bệnh Anvil 5SC (Syngenta)',
          updated_at = NOW()
        WHERE id = $3
      `, [coverImg, JSON.stringify(treeData), plantId]);
      console.log(`🌳 Đã cập nhật Cây Sầu Riêng STT 1 (ID: ${plantId})`);
    } else {
      const newPlant = await client.query(`
        INSERT INTO plants (
          farm_id, created_by, plant_type, plant_variety, plant_age, health_status,
          location, tree_code, nfc_uid, public_slug, latitude, longitude,
          cover_image, is_public, data, phi_status, phi_until_date,
          last_pesticide_date, last_pesticide_name
        ) VALUES (
          $1, $2, 'Sầu riêng', 'Ri6 Cổ Thụ (20 Năm Tuổi)', '20 năm tuổi', 'Tốt',
          'Lô A1 - Hàng 1 - Cây STT 1 (Cây đầu hồi cổng chính)', 'SR-01',
          '04:A2:3B:8C:9F:5D:80', 'flk-sr01-ri6-longkhanh', 10.941520, 107.241850,
          $3, true, $4, 'safe', '2026-06-04', '2026-05-20', 'Thuốc trừ nấm bệnh Anvil 5SC (Syngenta)'
        ) RETURNING id
      `, [farmId, userId, coverImg, JSON.stringify(treeData)]);
      plantId = newPlant.rows[0].id;
      console.log(`🌳 Đã tạo mới Cây Sầu Riêng STT 1 (ID: ${plantId})`);
    }

    // ── 5. TẠO 12 NHẬT KÝ CANH TÁC TRỌN VẸN VÒNG ĐỜI MÙA VỤ RI6 20 NĂM TUỔI ──
    // Xóa các logs cũ của cây này để làm mới dữ liệu chuẩn
    await client.query(`DELETE FROM plant_logs WHERE plant_id = $1`, [plantId]);

    const logsList = [
      {
        log_date: '2025-09-10',
        log_type: 'Cắt tỉa',
        operator_name: 'Kỹ sư Nguyễn Văn Long',
        equipment_used: 'Kéo cắt cành Gardena & Thang nhôm rút',
        note: 'Cắt tỉa cành tăm, cành sâu bệnh, chồi vượt trong thân và hạ ngọn thông thoáng tán sau khi kết thúc thu hoạch vụ trước.',
        media_urls: ['https://images.unsplash.com/photo-1592417817098-8f3d6910985c?w=600&auto=format&fit=crop&q=80'],
        details: {
          activity: 'Tỉa cành phục hồi',
          labor_cost: 150000,
          note: 'Cắt bỏ 12 cành khô và bôi keo liền sẹo Tiến Nông vào các vết cắt lớn'
        }
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

    console.log(`📝 Đã tạo thành công 12 Nhật ký Canh tác cho Cây Sầu Riêng Ri6 STT 1!`);

    console.log('🎉 HOÀN THÀNH SEED DỮ LIỆU CÂY SẦU RIÊNG RI6 20 NĂM TUỔI TRANG TRẠI LONG KHÁNH THÀNH CÔNG 100%!');
    return {
      farm_id: farmId,
      plant_id: plantId,
      supplies_count: suppliesData.length,
      logs_count: logsList.length
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

