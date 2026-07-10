const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Apply auth and admin check to all routes in this file
router.use(auth);
router.use(admin);

// GET /api/users - List all users
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, created_at FROM users ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách người dùng.' });
  }
});

// POST /api/users - Create a new user (farmer account)
router.post('/', async (req, res) => {
  const { email, password, full_name, role } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin: email, mật khẩu và họ tên.' });
  }
  
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedRole = role === 'admin' ? 'admin' : 'user';

  try {
    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [trimmedEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email đã được sử dụng bởi tài khoản khác.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role, created_at',
      [trimmedEmail, hash, full_name.trim(), trimmedRole]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi tạo người dùng.' });
  }
});

// PUT /api/users/:id - Update user details
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { email, password, full_name, role } = req.body;
  if (!email || !full_name) {
    return res.status(400).json({ error: 'Email và họ tên là bắt buộc.' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedRole = role === 'admin' ? 'admin' : 'user';

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

    let query = 'UPDATE users SET email=$1, full_name=$2, role=$3, updated_at=NOW()';
    let params = [trimmedEmail, full_name.trim(), trimmedRole, id];

    if (password && password.trim().length > 0) {
      const hash = await bcrypt.hash(password, 12);
      query += ', password_hash=$4 WHERE id=$5';
      params = [trimmedEmail, full_name.trim(), trimmedRole, hash, id];
    } else {
      query += ' WHERE id=$4';
    }

    await pool.query(query, params);
    
    const updated = await pool.query('SELECT id, email, full_name, role, created_at FROM users WHERE id=$1', [id]);
    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật người dùng.' });
  }
});

// DELETE /api/users/:id - Delete a user
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  // Prevent admin from deleting themselves
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Bạn không thể tự xóa tài khoản của chính mình.' });
  }

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }

    await pool.query('DELETE FROM users WHERE id=$1', [id]);
    res.json({ success: true, message: 'Đã xóa người dùng thành công.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi xóa người dùng.' });
  }
});

module.exports = router;
