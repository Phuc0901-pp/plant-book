const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const { uploadFile, deleteFile } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const { delCacheByPattern } = require('../config/redis');
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

// POST /api/auth/login (Supports Email or Phone number + Approval check)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập Email/Số điện thoại và mật khẩu.' });
    }

    const trimmed = email.trim();
    // Allow login by email OR phone number
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR phone = $1',
      [trimmed]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Thông tin tài khoản hoặc mật khẩu không đúng.' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Thông tin tài khoản hoặc mật khẩu không đúng.' });
    }

    // Check account approval status
    if (user.approved === false) {
      return res.status(403).json({
        error: 'Tài khoản của bạn đang chờ Quản trị viên phê duyệt. Chúng tôi sẽ mở khóa ngay khi duyệt xong!',
        pending: true
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        farm_id: user.farm_id,
        account_tier: user.account_tier || 'normal',
        tier_expires_at: user.tier_expires_at
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Update last_active_at and is_online
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
      user: {
        id: user.id,
        public_id: user.role === 'admin' ? `adm-${user.id}` : `usr-${user.id}`,
        email: user.email,
        role: user.role,
        name: user.full_name,
        phone: user.phone,
        account_tier: user.account_tier || 'normal',
        tier_expires_at: user.tier_expires_at
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST /api/auth/register — 3-Step Farmer Registration (Pending Admin Approval)
router.post('/register', async (req, res) => {
  try {
    const {
      phone,
      password,
      full_name,
      gender,
      dob,
      plant_type,
      plant_variety,
      plant_age,
      farm_area
    } = req.body;

    if (!phone || !phone.trim() || !password || !password.trim()) {
      return res.status(400).json({ error: 'Bước 1: Số điện thoại và mật khẩu là bắt buộc.' });
    }

    const cleanPhone = phone.trim();
    const parsedArea = farm_area && parseFloat(farm_area) ? parseFloat(farm_area) : null;

    // Check if phone already registered
    const existing = await pool.query(
      'SELECT id, approved FROM users WHERE phone = $1 OR LOWER(email) = LOWER($2)',
      [cleanPhone, `${cleanPhone}@farmer.tanbaocorp.vn`]
    );

    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0];
      if (existingUser.approved === false) {
        return res.status(400).json({
          error: 'Số điện thoại này đã đăng ký và đang chờ Admin duyệt. Vui lòng không đăng ký lại!'
        });
      }
      return res.status(400).json({ error: 'Số điện thoại này đã được đăng ký tài khoản trên hệ thống.' });
    }

    const hash = await bcrypt.hash(password.trim(), 12);
    const email = `${cleanPhone}@farmer.tanbaocorp.vn`;
    const name = full_name && full_name.trim() ? full_name.trim() : `Nông hộ ${cleanPhone}`;

    // Insert user with approved = true (Auto-approved, default to 'normal' tier)
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, phone, gender, dob, plant_type, plant_variety, plant_age, farm_area, approved, account_tier)
       VALUES ($1, $2, $3, 'user', $4, $5, $6, $7, $8, $9, $10, true, 'normal')
       RETURNING id, email, full_name, phone, approved, account_tier, created_at`,
      [email, hash, name, cleanPhone, gender || null, dob || null, plant_type || null, plant_variety || null, plant_age || null, parsedArea]
    );


    const newUser = userRes.rows[0];

    // Automatically create a default farm for the newly registered farmer user!
    try {
      const defaultFarmName = `Trang trại ${plant_type || 'Nông hộ'} (${cleanPhone})`;
      const farmRes = await pool.query(
        `INSERT INTO farms (name, description, area, total_plants, created_by, user_id)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING id`,
        [defaultFarmName, `Trang trại tự động khởi tạo khi đăng ký tài khoản cho ${name}`, parsedArea || 5000, 45, newUser.id]
      );
      if (farmRes.rows.length > 0) {
        const farmId = farmRes.rows[0].id;
        await pool.query('UPDATE users SET farm_id = $1 WHERE id = $2', [farmId, newUser.id]);
      }
      await delCacheByPattern('farms_');
    } catch (farmErr) {
      console.warn('⚠️ Auto-creating farm on registration warning:', farmErr.message);
    }

    // Log registration activity
    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Đăng ký tài khoản', 'Khách hàng hoàn tất đăng ký tài khoản nông hộ mới thành công.')`,
      [newUser.id]
    );

    // Broadcast new registration notification to all online Admins
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('user_registered', {
        id: newUser.id,
        name: newUser.full_name,
        phone: newUser.phone,
        plant_type: plant_type || 'Chưa khai báo',
        created_at: newUser.created_at
      });
    }

    res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ bằng Số điện thoại và Mật khẩu vừa tạo.',
      user: newUser
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Lỗi server khi đăng ký tài khoản: ' + err.message });
  }
});



// GET /api/auth/check-phone — Pre-check if phone number exists before registering
router.get('/check-phone', async (req, res) => {

  try {
    const { phone } = req.query;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Số điện thoại là bắt buộc.' });
    }
    const cleanPhone = phone.trim();
    const result = await pool.query(
      'SELECT id, approved FROM users WHERE phone = $1 OR LOWER(email) = LOWER($2)',
      [cleanPhone, `${cleanPhone}@farmer.tanbaocorp.vn`]
    );

    if (result.rows.length > 0) {
      const u = result.rows[0];
      if (u.approved === false) {
        return res.json({
          exists: true,
          approved: false,
          message: '⚠️ Số điện thoại này đã đăng ký và đang CHỜ ADMIN DUYỆT. Vui lòng không đăng ký lại!'
        });
      }
      return res.json({
        exists: true,
        approved: true,
        message: '⚠️ Số điện thoại này ĐÃ TỒN TẠI trên hệ thống. Vui lòng chuyển sang màn hình Đăng nhập!'
      });
    }

    res.json({ exists: false, message: 'Số điện thoại hợp lệ.' });
  } catch (err) {
    console.error('Check phone error:', err);
    res.status(500).json({ error: 'Lỗi server khi kiểm tra số điện thoại.' });
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
      'SELECT id, email, full_name, role, avatar_url, phone, city, country, gender, created_at, account_tier, tier_expires_at, tier_admin_note FROM users WHERE id=$1',
      [req.user.id]
    );
    const u = result.rows[0];
    if (u) {
      u.public_id = u.role === 'admin' ? `adm-${u.id}` : `usr-${u.id}`;
    }
    res.json(u);
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

const crypto = require('crypto');
const { sendAdminResetNotification, sendCustomerNewPassword } = require('../services/emailService');

// POST /api/auth/forgot-password — Gửi yêu cầu cấp lại mật khẩu
router.post('/forgot-password', async (req, res) => {
  try {
    const { identity, note } = req.body;
    if (!identity || !identity.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập Email hoặc Số điện thoại đăng ký.' });
    }

    const trimmed = identity.trim();
    // Find user by email or phone
    const userRes = await pool.query(
      'SELECT id, email, full_name, phone, role FROM users WHERE LOWER(email) = LOWER($1) OR phone = $1',
      [trimmed]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản tương ứng với thông tin đã nhập.' });
    }

    const user = userRes.rows[0];
    const resetToken = crypto.randomBytes(24).toString('hex');

    await pool.query(
      `INSERT INTO password_reset_requests (user_id, identity, token, note, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [user.id, trimmed, resetToken, note || null]
    );

    // Protocol & Base URL
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const baseUrl = `${protocol}://${host}`;

    // Send email notification to Admin (phphuc0539@gmail.com) in background (non-blocking)
    sendAdminResetNotification({
      user,
      requestToken: resetToken,
      baseUrl,
      note: note || ''
    }).catch(err => console.error('Background sendAdminResetNotification error:', err.message));

    res.json({
      success: true,
      message: 'Yêu cầu cấp lại mật khẩu đã được gửi thành công đến Ban Quản trị. Admin sẽ xét duyệt và cấp mật khẩu mới cho bạn.'
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Lỗi server khi gửi yêu cầu cấp lại mật khẩu.' });
  }
});

// GET /api/auth/approve-reset-password — Admin 1-click approve link from email
router.get('/approve-reset-password', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('Token không hợp lệ.');

    const reqRes = await pool.query(
      `SELECT r.*, u.email, u.full_name, u.phone 
       FROM password_reset_requests r 
       JOIN users u ON r.user_id = u.id 
       WHERE r.token = $1 AND r.status = 'pending'`,
      [token]
    );

    if (reqRes.rows.length === 0) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Yêu cầu không hợp lệ - Tanbao AgTech</title></head>
        <body style="font-family:sans-serif; text-align:center; padding:50px; background:#f8fafc;">
          <div style="max-width:500px; margin:0 auto; background:white; padding:30px; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
            <h2 style="color:#ef4444;">⚠️ Yêu cầu không tồn tại hoặc đã được xử lý</h2>
            <p style="color:#64748b;">Yêu cầu cấp lại mật khẩu này đã được phê duyệt hoặc hủy trước đó.</p>
          </div>
        </body>
        </html>
      `);
    }

    const reqData = reqRes.rows[0];
    const user = { id: reqData.user_id, email: reqData.email, full_name: reqData.full_name, phone: reqData.phone };

    // Generate new random temp password
    const tempPassword = `Tanbao@${Math.floor(100000 + Math.random() * 900000)}`;
    const hash = await bcrypt.hash(tempPassword, 12);

    // Update user's password
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);

    // Mark request as approved
    await pool.query(
      "UPDATE password_reset_requests SET status = 'approved', approved_at = NOW() WHERE id = $1",
      [reqData.id]
    );

    // Send new password to customer email
    await sendCustomerNewPassword({ user, newPassword: tempPassword });

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Phê duyệt thành công - Tanbao AgTech</title></head>
      <body style="font-family:sans-serif; text-align:center; padding:50px; background:#f8fafc;">
        <div style="max-width:520px; margin:0 auto; background:white; padding:36px; border-radius:14px; box-shadow:0 4px 16px rgba(0,0,0,0.08); border-top:5px solid #22c55e;">
          <div style="font-size:48px; margin-bottom:12px; color:#22c55e;">✓</div>
          <h2 style="color:#1b4d3e; margin-bottom:16px;">ĐÃ PHÊ DUYỆT CẤP MẬT KHẨU MỚI!</h2>
          <p style="color:#475569; font-size:15px;">Tài khoản khách hàng: <strong>${user.email}</strong></p>
          <div style="background:#f0fdf4; border:1px dashed #22c55e; padding:16px; border-radius:8px; margin:20px 0;">
            <span style="font-size:13px; color:#166534; display:block; margin-bottom:4px;">Mật khẩu mới đã được khởi tạo:</span>
            <strong style="font-size:22px; color:#15803d; letter-spacing:1px; font-family:monospace;">${tempPassword}</strong>
          </div>
          <p style="color:#64748b; font-size:13px;">Hệ thống đã tự động gửi email chứa mật khẩu mới về hộp thư <strong>${user.email}</strong> của khách hàng.</p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Approve reset error:', err);
    res.status(500).send('Lỗi server khi phê duyệt yêu cầu.');
  }
});

// GET /api/auth/reject-reset-password — Admin 1-click reject link
router.get('/reject-reset-password', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('Token không hợp lệ.');

    await pool.query(
      "UPDATE password_reset_requests SET status = 'rejected' WHERE token = $1 AND status = 'pending'",
      [token]
    );

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Từ chối yêu cầu - Tanbao AgTech</title></head>
      <body style="font-family:sans-serif; text-align:center; padding:50px; background:#f8fafc;">
        <div style="max-width:500px; margin:0 auto; background:white; padding:30px; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.1); border-top:5px solid #ef4444;">
          <h2 style="color:#dc2626;">Đã từ chối yêu cầu cấp lại mật khẩu</h2>
          <p style="color:#64748b;">Yêu cầu cấp lại mật khẩu này đã bị từ chối.</p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Lỗi server.');
  }
});

// GET /api/auth/reset-requests — Admin list reset requests
router.get('/reset-requests', require('../middleware/auth'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Chỉ Admin mới có quyền truy cập.' });

    const result = await pool.query(`
      SELECT r.*, u.email, u.full_name, u.phone 
      FROM password_reset_requests r 
      JOIN users u ON r.user_id = u.id 
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
