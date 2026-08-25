const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Apply auth and admin check to all routes in this file
router.use(auth);
router.use(admin);

/**
 * ISO/IEC 11558 & ISO 3309 Standard 8-Digit Obfuscation Hash Generator
 */
function generateIsoPublicId(role, numId) {
  const prefix = role === 'admin' ? 'adm' : 'usr';
  const id = parseInt(numId) || 0;
  const val = Math.abs(((id * 1664525 + 1013904223) ^ 0x5B9A4C21) % 90000000) + 10000000;
  return `${prefix}-${val}`;
}

// GET /api/users - List all users (with assigned farm info & permissions & assigned plants)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.is_online, u.last_active_at, u.created_at, u.phone,
              u.view_plants_scope, u.view_history_from_date, u.allow_shared_history, u.allow_view_supplies,
              u.account_tier, u.tier_expires_at, u.tier_admin_note,
              COALESCE(u.farm_id, f_legacy.id) as farm_id,
              COALESCE(f.name, f_legacy.name) as farm_name,
              COALESCE((
                SELECT json_agg(p.id) FROM plants p WHERE p.assigned_to_user_id = u.id
              ), '[]'::json) as assigned_plant_ids
       FROM users u
       LEFT JOIN farms f ON f.id = u.farm_id
       LEFT JOIN farms f_legacy ON f_legacy.user_id = u.id
       ORDER BY u.id ASC`
    );

    const rows = result.rows.map(u => ({
      ...u,
      public_id: generateIsoPublicId(u.role, u.id)
    }));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách người dùng.' });
  }
});

// PUT /api/users/:id/tier - Update user account tier & custom expiration date (Admin only)
router.put('/:id/tier', async (req, res) => {
  try {
    const { account_tier, tier_expires_at, tier_admin_note } = req.body;
    const userId = req.params.id;

    if (!['normal', 'pro'].includes(account_tier)) {
      return res.status(400).json({ error: 'Gói cước không hợp lệ (Chỉ chấp nhận normal hoặc pro).' });
    }

    const expiresValue = account_tier === 'pro'
      ? (tier_expires_at ? new Date(tier_expires_at).toISOString() : null)
      : null;

    const result = await pool.query(
      `UPDATE users 
       SET account_tier = $1, tier_expires_at = $2, tier_admin_note = $3 
       WHERE id = $4 RETURNING id, email, full_name, role, account_tier, tier_expires_at, tier_admin_note`,
      [account_tier, expiresValue, tier_admin_note || null, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }

    // Record admin activity log
    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Cập nhật gói cước', $2)`,
      [req.user.id, `Cập nhật gói cước cho Nông hộ #${userId} thành [${account_tier.toUpperCase()}] ${expiresValue ? '(Hạn: ' + expiresValue.slice(0, 10) + ')' : '(Vĩnh viễn)'}`]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user tier:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật gói cước.' });
  }
});


// GET /api/users/:id/activities - Get activity history of a specific user
router.get('/:id/activities', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM user_activities 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 100`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({ error: 'Lỗi server khi lấy lịch sử hoạt động.' });
  }
});

// POST /api/users - Create a new user (farmer account with assigned farm & permissions)
router.post('/', async (req, res) => {
  const { 
    email, password, full_name, role, farm_id,
    view_plants_scope, view_history_from_date, allow_shared_history, allow_view_supplies,
    assigned_plant_ids
  } = req.body;

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin: email, mật khẩu và họ tên.' });
  }
  
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedRole = role === 'admin' ? 'admin' : 'user';
  const assignedFarmId = farm_id && parseInt(farm_id) ? parseInt(farm_id) : null;

  try {
    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [trimmedEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email đã được sử dụng bởi tài khoản khác.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (
        email, password_hash, full_name, role, farm_id, approved,
        view_plants_scope, view_history_from_date, allow_shared_history, allow_view_supplies
       )
       VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9)
       RETURNING id, email, full_name, role, farm_id, view_plants_scope, view_history_from_date, allow_shared_history, allow_view_supplies, created_at`,
      [
        trimmedEmail, hash, full_name.trim(), trimmedRole, assignedFarmId,
        view_plants_scope || 'all',
        view_history_from_date || null,
        allow_shared_history !== false,
        allow_view_supplies !== false
      ]
    );

    const newUser = result.rows[0];

    // Assign specific plants to new user if provided
    if (Array.isArray(assigned_plant_ids) && assigned_plant_ids.length > 0) {
      const validIds = assigned_plant_ids.map(x => parseInt(x)).filter(x => !isNaN(x));
      if (validIds.length > 0) {
        await pool.query('UPDATE plants SET assigned_to_user_id = $1 WHERE id = ANY($2::int[])', [newUser.id, validIds]);
      }
    }

    res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi tạo người dùng.' });
  }
});

// PUT /api/users/:id - Update user details (including assigned farm_id & permissions & assigned plants)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    email, password, full_name, role, farm_id,
    view_plants_scope, view_history_from_date, allow_shared_history, allow_view_supplies,
    assigned_plant_ids
  } = req.body;

  if (!email || !full_name) {
    return res.status(400).json({ error: 'Email và họ tên là bắt buộc.' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedRole = role === 'admin' ? 'admin' : 'user';
  const assignedFarmId = farm_id && parseInt(farm_id) ? parseInt(farm_id) : null;
  const targetUserId = parseInt(id);

  try {
    // Check if user exists
    const userRes = await pool.query('SELECT * FROM users WHERE id=$1', [targetUserId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }

    // Check if email is taken by another user
    const existing = await pool.query('SELECT id FROM users WHERE email=$1 AND id<>$2', [trimmedEmail, targetUserId]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email đã được sử dụng bởi tài khoản khác.' });
    }

    let query = `
      UPDATE users 
      SET email=$1, full_name=$2, role=$3, farm_id=$4,
          view_plants_scope=$5, view_history_from_date=$6, allow_shared_history=$7, allow_view_supplies=$8,
          updated_at=NOW()
    `;
    let params = [
      trimmedEmail,
      full_name.trim(),
      trimmedRole,
      assignedFarmId,
      view_plants_scope || 'all',
      view_history_from_date || null,
      allow_shared_history !== false,
      allow_view_supplies !== false
    ];

    if (password && password.trim().length > 0) {
      const hash = await bcrypt.hash(password, 12);
      query += ', password_hash=$9 WHERE id=$10';
      params.push(hash, targetUserId);
    } else {
      query += ' WHERE id=$9';
      params.push(targetUserId);
    }

    await pool.query(query, params);
    
    // Sync farm ownership if assigned farm has no primary owner
    if (assignedFarmId) {
      await pool.query('UPDATE farms SET user_id = $1 WHERE id = $2 AND user_id IS NULL', [targetUserId, assignedFarmId]);
    }

    // Update specific assigned plants for this user
    if (Array.isArray(assigned_plant_ids)) {
      await pool.query('UPDATE plants SET assigned_to_user_id = NULL WHERE assigned_to_user_id = $1', [targetUserId]);
      const validIds = assigned_plant_ids.map(x => parseInt(x)).filter(x => !isNaN(x));
      if (validIds.length > 0) {
        await pool.query('UPDATE plants SET assigned_to_user_id = $1 WHERE id = ANY($2::int[])', [targetUserId, validIds]);
      }
    }


    const updated = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.farm_id, u.view_plants_scope, u.view_history_from_date, u.allow_shared_history, u.allow_view_supplies, u.account_tier, u.tier_expires_at, u.tier_admin_note, u.created_at, f.name as farm_name
       FROM users u
       LEFT JOIN farms f ON f.id = u.farm_id
       WHERE u.id=$1`,
      [targetUserId]
    );



    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật người dùng.' });
  }
});


// DELETE /api/users/:id - Delete a user with full cascade (Farms -> Plants -> Logs -> Supplies)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = parseInt(id);
  
  // Prevent admin from deleting themselves
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Bạn không thể tự xóa tài khoản của chính mình.' });
  }

  const client = await pool.connect();
  try {
    const userRes = await client.query('SELECT * FROM users WHERE id=$1', [userId]);
    if (userRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }

    await client.query('BEGIN');

    // 1. Tìm toàn bộ trang trại đi kèm thuộc sở hữu của User này
    const farmsRes = await client.query(`
      SELECT id FROM farms 
      WHERE user_id = $1 
         OR created_by = $1 
         OR id = (SELECT farm_id FROM users WHERE id = $1)
    `, [userId]);

    const associatedFarmIds = (farmsRes.rows || []).map(f => f.id).filter(Boolean);

    if (associatedFarmIds.length > 0) {
      // 2. Xóa toàn bộ Thư viện Media của các cây trong trang trại đi kèm
      try {
        await client.query(`
          DELETE FROM plant_media 
          WHERE plant_id IN (SELECT id FROM plants WHERE farm_id = ANY($1::int[]))
        `, [associatedFarmIds]);
      } catch (_) {}

      // 3. Xóa toàn bộ Lịch sử canh tác / Nhật ký (plant_logs) của các cây
      try {
        await client.query(`
          DELETE FROM plant_logs 
          WHERE plant_id IN (SELECT id FROM plants WHERE farm_id = ANY($1::int[]))
        `, [associatedFarmIds]);
      } catch (_) {}

      // 4. Xóa toàn bộ Tiêu hao vật tư (supply_usages) & Kho vật tư (supplies)
      try {
        await client.query(`
          DELETE FROM supply_usages 
          WHERE farm_id = ANY($1::int[]) 
             OR supply_id IN (SELECT id FROM supplies WHERE farm_id = ANY($1::int[]))
        `, [associatedFarmIds]);
      } catch (_) {}

      try {
        await client.query(`DELETE FROM supplies WHERE farm_id = ANY($1::int[])`, [associatedFarmIds]);
      } catch (_) {}

      // 5. Xóa cảm biến IoT, thiết bị, chi phí, tài sản của các trang trại
      try { await client.query(`DELETE FROM farm_iot_sensors WHERE farm_id = ANY($1::int[])`, [associatedFarmIds]); } catch (_) {}
      try { await client.query(`DELETE FROM devices WHERE farm_id = ANY($1::int[])`, [associatedFarmIds]); } catch (_) {}
      try { await client.query(`DELETE FROM costs WHERE farm_id = ANY($1::int[])`, [associatedFarmIds]); } catch (_) {}
      try { await client.query(`DELETE FROM fixed_assets WHERE farm_id = ANY($1::int[])`, [associatedFarmIds]); } catch (_) {}
      try { await client.query(`DELETE FROM user_alert_rules WHERE farm_id = ANY($1::int[])`, [associatedFarmIds]); } catch (_) {}

      // 6. Xóa danh sách Cây trồng trong các trang trại bị xóa
      await client.query(`DELETE FROM plants WHERE farm_id = ANY($1::int[])`, [associatedFarmIds]);

      // 7. Gỡ liên kết trang trại khỏi các người dùng khác (nếu có)
      await client.query(`UPDATE users SET farm_id = NULL WHERE farm_id = ANY($1::int[])`, [associatedFarmIds]);

      // 8. Xóa chính các Trang trại đi kèm
      await client.query(`DELETE FROM farms WHERE id = ANY($1::int[])`, [associatedFarmIds]);
    }

    // 9. Xóa sạch các dữ liệu độc lập của User (Media riêng, Logs riêng, Cây được gán, Vật tư riêng)
    try {
      await client.query(`
        DELETE FROM plant_media 
        WHERE plant_id IN (SELECT id FROM plants WHERE created_by = $1 OR assigned_to_user_id = $1)
      `, [userId]);
    } catch (_) {}

    try { await client.query('DELETE FROM plant_logs WHERE created_by = $1', [userId]); } catch (_) {}
    try { await client.query('DELETE FROM supply_usages WHERE user_id = $1', [userId]); } catch (_) {}
    try { await client.query('DELETE FROM supplies WHERE user_id = $1', [userId]); } catch (_) {}
    try { await client.query('DELETE FROM plants WHERE created_by = $1 OR assigned_to_user_id = $1', [userId]); } catch (_) {}
    try { await client.query('UPDATE plant_schemas SET created_by = NULL WHERE created_by = $1', [userId]); } catch (_) {}
    try { await client.query('DELETE FROM password_reset_requests WHERE user_id = $1', [userId]); } catch (_) {}
    try { await client.query('DELETE FROM user_activities WHERE user_id = $1', [userId]); } catch (_) {}
    try { await client.query('DELETE FROM user_notifications WHERE user_id = $1', [userId]); } catch (_) {}

    // 10. Cuối cùng: Xóa User khỏi CSDL
    await client.query('DELETE FROM users WHERE id=$1', [userId]);

    await client.query('COMMIT');
    res.json({ 
      success: true, 
      message: `Đã xóa người dùng cùng toàn bộ ${associatedFarmIds.length} trang trại đi kèm, danh sách cây và lịch sử canh tác liên quan thành công!` 
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa người dùng: ' + err.message });
  } finally {
    client.release();
  }
});


// GET /api/users/pending - List pending farmer registrations
router.get('/pending', async (req, res) => {

  try {
    const result = await pool.query(
      `SELECT id, email, full_name, phone, gender, dob, plant_type, plant_variety, plant_age, farm_area, approved, created_at
       FROM users
       WHERE approved = false
       ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Fetch pending users error:', err);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách đăng ký chờ duyệt.' });
  }
});

// PUT /api/users/:id/approve - Approve pending farmer account
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const userRes = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }

    await pool.query('UPDATE users SET approved = true, updated_at = NOW() WHERE id = $1', [id]);
    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Phê duyệt tài khoản', 'Quản trị viên đã phê duyệt mở khóa tài khoản thành công.')`,
      [id]
    );

    // Broadcast approval WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('user_approved', { id: parseInt(id), approved: true });
    }

    res.json({ success: true, message: 'Đã phê duyệt và kích hoạt tài khoản nông hộ thành công!' });
  } catch (err) {
    console.error('Approve user error:', err);
    res.status(500).json({ error: 'Lỗi server khi phê duyệt tài khoản.' });
  }
});

module.exports = router;

