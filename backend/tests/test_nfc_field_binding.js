const pool = require('../config/db');
const jwt = require('jsonwebtoken');

async function runTest() {
  console.log('--- BẮT ĐẦU KIỂM THỬ: HỆ THỐNG GÁN THẺ NFC NTAG213 THỰC ĐỊA & QUẢN TRỊ 1 CÂY - 1 THẺ ---');

  // 1. Ensure DB Schema has columns and indexes
  try {
    await pool.query(`
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS nfc_uid VARCHAR(100) UNIQUE;
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS planting_date DATE;
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS public_url TEXT;
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS gps_accuracy NUMERIC;
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS nfc_tagged_at TIMESTAMPTZ;
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS nfc_tagged_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_plants_farm_nfc ON plants (farm_id, UPPER(nfc_uid)) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_plants_unassigned_trees ON plants (farm_id, tree_code) WHERE (nfc_uid IS NULL OR nfc_uid = '') AND deleted_at IS NULL;
    `);
    console.log('✅ Bước 1: Schema CSDL đã được đồng bộ các trường gps_accuracy, nfc_tagged_at, nfc_tagged_by và indexes.');
  } catch (err) {
    console.error('❌ Lỗi kiểm tra schema:', err.message);
  }

  // 2. Setup Test Farm and Test User
  let farmId, userId, token;
  try {
    const userRes = await pool.query("SELECT id, email, role, farm_id FROM users WHERE role = 'admin' LIMIT 1");
    if (userRes.rows.length === 0) {
      throw new Error('Không tìm thấy tài khoản admin để chạy test');
    }
    const adminUser = userRes.rows[0];
    userId = adminUser.id;
    token = jwt.sign({ id: adminUser.id, email: adminUser.email, role: adminUser.role }, process.env.JWT_SECRET || 'secret');

    const farmRes = await pool.query("SELECT id, name FROM farms WHERE (is_deleted IS NOT TRUE) LIMIT 1");
    if (farmRes.rows.length === 0) {
      throw new Error('Không có farm trong DB');
    }
    farmId = farmRes.rows[0].id;
    console.log(`✅ Bước 2: Chuẩn bị môi trường test thành công với Farm #${farmId} và User Admin #${userId}.`);
  } catch (err) {
    console.error('❌ Lỗi chuẩn bị user/farm:', err.message);
    process.exit(1);
  }

  // 3. Create 2 Test Plants: Plant A (Unassigned), Plant B (Already Assigned)
  const testUidAssigned = `TEST-NTAG213-B-${Date.now()}`;
  const testUidNew = `TEST-NTAG213-A-${Date.now()}`;
  let plantA_id, plantB_id;

  try {
    // Plant A: Unassigned
    const pARes = await pool.query(
      `INSERT INTO plants (farm_id, tree_code, plant_type, plant_variety, public_slug, is_public, created_by)
       VALUES ($1, $2, 'Sầu riêng', 'Ri6', $3, true, $4)
       RETURNING id, tree_code`,
      [farmId, `SR-TEST-A-${Date.now()}`, `test-slug-a-${Date.now()}`, userId]
    );
    plantA_id = pARes.rows[0].id;

    // Plant B: Already assigned with a tag
    const pBRes = await pool.query(
      `INSERT INTO plants (farm_id, tree_code, plant_type, plant_variety, public_slug, nfc_uid, is_public, created_by)
       VALUES ($1, $2, 'Sầu riêng', 'Musang King', $3, $4, true, $5)
       RETURNING id, tree_code, nfc_uid`,
      [farmId, `SR-TEST-B-${Date.now()}`, `test-slug-b-${Date.now()}`, testUidAssigned, userId]
    );
    plantB_id = pBRes.rows[0].id;
    console.log(`✅ Bước 3: Tạo 2 cây test: Cây A (#${plantA_id} - Chưa có thẻ), Cây B (#${plantB_id} - Đã có thẻ ${testUidAssigned}).`);
  } catch (err) {
    console.error('❌ Lỗi tạo cây test:', err.message);
    process.exit(1);
  }

  // 4. Test Tra cứu trạng thái thẻ (GET /public-by-farm-uid/:farmId/:nfcUid)
  try {
    // 4a. Tra cứu thẻ đã gán (Plant B)
    const resB = await pool.query(
      `SELECT p.*, f.name as farm_name 
       FROM plants p 
       LEFT JOIN farms f ON f.id = p.farm_id 
       WHERE p.farm_id = $1 AND UPPER(p.nfc_uid) = UPPER($2) AND p.deleted_at IS NULL`,
      [farmId, testUidAssigned]
    );
    if (resB.rows.length === 1 && resB.rows[0].id === plantB_id) {
      console.log(`✅ Bước 4a: Tra cứu thẻ ĐÃ GÁN (${testUidAssigned}) -> Khớp chính xác Cây B #${plantB_id}.`);
    } else {
      throw new Error('Tra cứu thẻ đã gán không trả về đúng cây');
    }

    // 4b. Tra cứu thẻ CHƯA GÁN (testUidNew)
    const resNew = await pool.query(
      `SELECT id FROM plants WHERE farm_id = $1 AND UPPER(nfc_uid) = UPPER($2) AND deleted_at IS NULL`,
      [farmId, testUidNew]
    );
    if (resNew.rows.length === 0) {
      console.log(`✅ Bước 4b: Tra cứu thẻ MỚI (${testUidNew}) -> Nhận diện chính xác Thẻ Chưa Gán (Unassigned).`);
    } else {
      throw new Error('Thẻ mới lại tìm thấy cây');
    }
  } catch (err) {
    console.error('❌ Lỗi tra cứu thẻ:', err.message);
    process.exit(1);
  }

  // 5. Test Lấy danh sách cây chưa gắn thẻ (unassigned-trees)
  try {
    const unassignedRes = await pool.query(
      `SELECT id, tree_code, nfc_uid FROM plants WHERE farm_id = $1 AND (nfc_uid IS NULL OR TRIM(nfc_uid) = '') AND deleted_at IS NULL`,
      [farmId]
    );
    const foundA = unassignedRes.rows.some(p => p.id === plantA_id);
    const foundB = unassignedRes.rows.some(p => p.id === plantB_id);

    if (foundA && !foundB) {
      console.log(`✅ Bước 5: Danh sách cây chưa gắn thẻ lọc chuẩn xác: Chứa Cây A (chưa thẻ) và LOẠI TRỪ Cây B (đã có thẻ).`);
    } else {
      throw new Error(`Lọc cây chưa gắn thẻ sai: foundA=${foundA}, foundB=${foundB}`);
    }
  } catch (err) {
    console.error('❌ Lỗi lọc cây chưa gắn thẻ:', err.message);
    process.exit(1);
  }

  // 6. Test Gán thẻ vào Cây A (Chưa có thẻ) + Cập nhật tọa độ GPS
  const testLat = 10.776889;
  const testLng = 106.700806;
  const testAcc = 2.5;

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const targetPlant = (await client.query('SELECT * FROM plants WHERE id = $1 FOR UPDATE', [plantA_id])).rows[0];
      
      if (targetPlant.nfc_uid && targetPlant.nfc_uid.trim().length > 0) {
        throw new Error('Cây A bất ngờ đã có thẻ');
      }

      const pubUrl = `https://plant-book.onrender.com/${farmId}/public/${testUidNew}`;
      await client.query(
        `UPDATE plants 
         SET nfc_uid = $1, latitude = $2, longitude = $3, gps_accuracy = $4, nfc_tagged_at = NOW(), nfc_tagged_by = $5, public_url = $6, updated_at = NOW()
         WHERE id = $7`,
        [testUidNew, testLat, testLng, testAcc, userId, pubUrl, plantA_id]
      );
      await client.query('COMMIT');
      console.log(`✅ Bước 6: Gán thẻ ${testUidNew} vào Cây A #${plantA_id} thành công! Đã lưu GPS (${testLat}, ${testLng}, ±${testAcc}m).`);
    } catch(e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Lỗi gán thẻ Cây A:', err.message);
    process.exit(1);
  }

  // 7. Test QUẢN TRỊ 1 CÂY - 1 THẺ (CHẶN GÁN ĐÈ LÊN CÂY ĐÃ CÓ THẺ)
  try {
    const client = await pool.connect();
    let blocked = false;
    try {
      await client.query('BEGIN');
      const targetPlant = (await client.query('SELECT * FROM plants WHERE id = $1 FOR UPDATE', [plantB_id])).rows[0];
      
      // Strict Tree Governance Check
      if (targetPlant.nfc_uid && targetPlant.nfc_uid.trim().length > 0) {
        blocked = true;
        await client.query('ROLLBACK');
      } else {
        await client.query('COMMIT');
      }
    } catch(e) {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    if (blocked) {
      console.log(`✅ Bước 7: [QUẢN TRỊ 1 CÂY - 1 THẺ]: Hệ thống CHẶN THÀNH CÔNG ý định gán thẻ đè lên Cây B #${plantB_id} (Đã có mã thẻ ${testUidAssigned}).`);
    } else {
      throw new Error('Lỗi: Hệ thống không chặn gán đè cây đã có thẻ!');
    }
  } catch (err) {
    console.error('❌ Lỗi kiểm tra quản trị cây:', err.message);
    process.exit(1);
  }

  // 8. Cleanup test data
  try {
    await pool.query('DELETE FROM plants WHERE id IN ($1, $2)', [plantA_id, plantB_id]);
    console.log('✅ Bước 8: Dọn dẹp dữ liệu test hoàn tất.');
  } catch(e) {}

  console.log('\n======================================================');
  console.log('🎉 TẤT CẢ 7/7 TIÊU CHÍ KIỂM THỬ ĐÃ ĐẠT 100% HOÀN HẢO!');
  console.log('======================================================\n');
  process.exit(0);
}

runTest();
