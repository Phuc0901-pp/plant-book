const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Apply auth and admin check to all routes in this file
router.use(auth);
router.use(admin);

// GET /api/users - List all users (with assigned farm info)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.is_online, u.last_active_at, u.created_at, u.farm_id, u.phone, f.name as farm_name
       FROM users u
       LEFT JOIN farms f ON f.id = u.farm_id
       ORDER BY u.id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách người dùng.' });
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

// POST /api/users - Create a new user (farmer account with assigned farm)
router.post('/', async (req, res) => {
  const { email, password, full_name, role, farm_id } = req.body;
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
      `INSERT INTO users (email, password_hash, full_name, role, farm_id, approved)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, email, full_name, role, farm_id, created_at`,
      [trimmedEmail, hash, full_name.trim(), trimmedRole, assignedFarmId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi tạo người dùng.' });
  }
});

// PUT /api/users/:id - Update user details (including assigned farm_id)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { email, password, full_name, role, farm_id } = req.body;
  if (!email || !full_name) {
    return res.status(400).json({ error: 'Email và họ tên là bắt buộc.' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedRole = role === 'admin' ? 'admin' : 'user';
  const assignedFarmId = farm_id && parseInt(farm_id) ? parseInt(farm_id) : null;

  try {
    // Check if user exists
    const userRes = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }

    // Check if email is taken by another user
    const existing = await pool.query('SELECT id FROM users WHERE email=$1 AND id<>$2', [trimmedEmail, id]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email đã được sử dụng bởi tài khoản khác.' });
    }

    let query = 'UPDATE users SET email=$1, full_name=$2, role=$3, farm_id=$4, updated_at=NOW()';
    let params = [trimmedEmail, full_name.trim(), trimmedRole, assignedFarmId, id];

    if (password && password.trim().length > 0) {
      const hash = await bcrypt.hash(password, 12);
      query += ', password_hash=$5 WHERE id=$6';
      params = [trimmedEmail, full_name.trim(), trimmedRole, assignedFarmId, hash, id];
    } else {
      query += ' WHERE id=$5';
    }

    await pool.query(query, params);
    
    const updated = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.farm_id, u.created_at, f.name as farm_name
       FROM users u
       LEFT JOIN farms f ON f.id = u.farm_id
       WHERE u.id=$1`,
      [id]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật người dùng.' });
  }
});


// DELETE /api/users/:id - Delete a user cleanly
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

    // Unlink foreign keys pointing to this user before deleting
    await client.query('UPDATE farms SET user_id = NULL WHERE user_id = $1', [userId]);
    await client.query('UPDATE farms SET created_by = NULL WHERE created_by = $1', [userId]);
    await client.query('UPDATE plants SET created_by = NULL WHERE created_by = $1', [userId]);
    await client.query('UPDATE plant_schemas SET created_by = NULL WHERE created_by = $1', [userId]);
    await client.query('UPDATE plant_logs SET created_by = NULL WHERE created_by = $1', [userId]);
    await client.query('DELETE FROM password_reset_requests WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM user_activities WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM supply_usages WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM supplies WHERE user_id = $1', [userId]);

    // Finally delete the user
    await client.query('DELETE FROM users WHERE id=$1', [userId]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Đã xóa người dùng thành công.' });
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
      `SELECT id, email, full_name, phone, gender, dob, plant_type, plant_variety, plant_age, approved, created_at
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

