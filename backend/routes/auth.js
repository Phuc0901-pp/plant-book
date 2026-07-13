const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const { uploadFile, deleteFile } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Multer for avatar upload (memory storage)
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (/jpeg|jpg|png|webp|gif/.test(ext)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận ảnh (jpeg, jpg, png, webp, gif).'));
  }
});

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

// GET /api/auth/me — Return full profile
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, avatar_url, phone, city, country, gender, created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/auth/me — Update personal profile
router.put('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const { full_name, phone, city, country, gender } = req.body;
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'Họ và tên là bắt buộc.' });
    }
    await pool.query(
      `UPDATE users SET full_name=$1, phone=$2, city=$3, country=$4, gender=$5, updated_at=NOW() WHERE id=$6`,
      [full_name.trim(), phone || null, city || null, country || null, gender || null, req.user.id]
    );
    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Cập nhật hồ sơ', 'Cập nhật thông tin cá nhân thành công.')`,
      [req.user.id]
    );
    const updated = await pool.query(
      'SELECT id, email, full_name, role, avatar_url, phone, city, country, gender, created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    res.json({ success: true, user: updated.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật hồ sơ.' });
  }
});

// POST /api/auth/avatar — Upload/replace user avatar to Supabase
router.post('/avatar', require('../middleware/auth'), avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn ảnh đại diện.' });

    // Delete old avatar from Supabase if exists
    const existing = await pool.query('SELECT avatar_url FROM users WHERE id=$1', [req.user.id]);
    const oldUrl = existing.rows[0]?.avatar_url;
    if (oldUrl) {
      const parts = oldUrl.split('/object/public/plant-media/');
      if (parts[1]) await deleteFile(parts[1]);
    }

    // Upload new avatar
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const objectName = `avatars/${req.user.id}_${uuidv4()}${ext}`;
    const publicUrl = await uploadFile(objectName, req.file.buffer, req.file.mimetype);

    await pool.query('UPDATE users SET avatar_url=$1, updated_at=NOW() WHERE id=$2', [publicUrl, req.user.id]);
    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Đổi ảnh đại diện', 'Cập nhật ảnh đại diện tài khoản.')`,
      [req.user.id]
    );

    res.json({ success: true, avatar_url: publicUrl });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: 'Lỗi server khi tải ảnh đại diện.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', require('../middleware/auth'), async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ mật khẩu cũ và mật khẩu mới.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Mật khẩu cũ không chính xác.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);

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
