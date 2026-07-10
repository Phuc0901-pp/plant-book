const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Update active status
    await pool.query(
      'UPDATE users SET is_online = true, last_active_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Record login activity log
    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Đăng nhập', 'Đăng nhập vào hệ thống thành công.')`,
      [user.id]
    );

    // Broadcast user online status
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('user_status_changed', { id: user.id, is_online: true, last_active_at: new Date() });
    }

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, name: user.full_name }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST /api/auth/logout
router.post('/logout', require('../middleware/auth'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET is_online = false, last_active_at = NOW() WHERE id = $1',
      [req.user.id]
    );
    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Đăng xuất', 'Người dùng chủ động đăng xuất khỏi hệ thống.')`,
      [req.user.id]
    );
    // Broadcast user offline status
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('user_status_changed', { id: req.user.id, is_online: false, last_active_at: new Date() });
    }

    res.json({ success: true, message: 'Đăng xuất thành công.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Lỗi server khi đăng xuất.' });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, full_name, role, created_at FROM users WHERE id=$1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', require('../middleware/auth'), async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ mật khẩu cũ và mật khẩu mới.' });
    }

    // Get user details
    const result = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Mật khẩu cũ không chính xác.' });
    }

    // Hash new password
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);

    // Record activity
    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Đổi mật khẩu', 'Thay đổi mật khẩu tài khoản thành công.')`,
      [req.user.id]
    );

    res.json({ success: true, message: 'Đổi mật khẩu thành công.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Lỗi server khi thay đổi mật khẩu.' });
  }
});

module.exports = router;
