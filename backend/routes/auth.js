const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const { uploadFile, deleteFile } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const { delCacheByPattern } = require('../config/redis');
const { encodeUserId, decodeUserId } = require('../utils/cryptoId');
const {
  generateBase32Secret,
  verifyTotpCode,
  buildOtpAuthUri,
  encryptTotpSecret
} = require('../services/totpMfaService');
require('dotenv').config();

function generateIsoPublicId(role, numId) {
  const prefix = role === 'admin' ? 'adm' : 'usr';
  const id = parseInt(numId) || 0;
  const val = Math.abs(((id * 1664525 + 1013904223) ^ 0x5B9A4C21) % 90000000) + 10000000;
  return `${prefix}-${val}`;
}

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (/jpeg|jpg|png|webp|gif/.test(ext)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận ảnh (jpeg, jpg, png, webp, gif).'));
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập Email/Số điện thoại và mật khẩu.' });
    }

    const trimmed = email.trim();
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR phone = $1',
      [trimmed]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Thông tin tài khoản hoặc mật khẩu không đúng.' });
    }

    const user = result.rows[0];
    const MAX_FAILED_LOGIN_ATTEMPTS = 5;
    const LOCKOUT_MINUTES = 15;
    const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
    const ADMIN_JWT_EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || '30m';

    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      const retryAfterSec = Math.max(1, Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 1000));
      return res.status(429).json({
        error: `Tài khoản tạm khóa ${LOCKOUT_MINUTES} phút do nhập sai mật khẩu quá số lần quy định.`,
        code: 'ACCOUNT_LOCKED',
        retry_after_sec: retryAfterSec
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const nextAttempts = Number(user.failed_login_attempts || 0) + 1;
      if (nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        await pool.query(
          `UPDATE users SET failed_login_attempts = $1, locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $2`,
          [nextAttempts, user.id]
        );
        try {
          const { notifyUser, notifyAdmins } = require('../services/notificationDispatcher');
          notifyUser(user.id, {
            eventCode: 'ACCOUNT_LOCKED',
            severity: 'danger',
            title: 'Cảnh báo: Tài khoản bị tạm khóa 15 phút',
            message: `Tài khoản ${user.email || user.phone} vừa nhập sai mật khẩu ${MAX_FAILED_LOGIN_ATTEMPTS} lần liên tiếp.`,
            actorUserId: user.id,
            sendZalo: false
          }).catch(() => {});
          notifyAdmins({
            eventCode: 'ACCOUNT_LOCKED',
            severity: 'danger',
            title: 'Khóa tài khoản do brute-force đăng nhập',
            message: `Tài khoản ${user.email || user.phone} (IP: ${req.ip || 'N/A'}) vừa bị khóa 15 phút.`,
            actorUserId: user.id,
            sendZalo: false
          }).catch(() => {});
        } catch (_) {}
        return res.status(429).json({
          error: `Tài khoản tạm khóa ${LOCKOUT_MINUTES} phút do nhập sai mật khẩu ${MAX_FAILED_LOGIN_ATTEMPTS} lần liên tiếp.`,
          code: 'ACCOUNT_LOCKED',
          retry_after_sec: LOCKOUT_MINUTES * 60
        });
      }
      await pool.query('UPDATE users SET failed_login_attempts = $1 WHERE id = $2', [nextAttempts, user.id]);
      return res.status(401).json({ error: 'Thông tin tài khoản hoặc mật khẩu không đúng.' });
    }

    if (user.approved === false) {
      return res.status(403).json({
        error: 'Tài khoản của bạn đang chờ Quản trị viên phê duyệt. Chúng tôi sẽ mở khóa ngay khi duyệt xong!',
        pending: true
      });
    }

    const effectiveSubRole = user.sub_role || 'farm_owner';
    const isRestrictedFinance = ['care_worker', 'auditor_readonly'].includes(effectiveSubRole);
    const allowViewFinance = isRestrictedFinance ? (user.allow_view_finance === true) : (user.allow_view_finance !== false);
    const tokenVersion = Number(user.token_version || 1);

    if (user.mfa_enabled === true && user.totp_secret_enc) {
      const providedOtp = req.body.totp_code ? String(req.body.totp_code).trim() : '';
      if (!providedOtp) {
        const mfaChallengeToken = jwt.sign(
          { id: user.id, purpose: 'mfa_challenge', tv: tokenVersion },
          process.env.JWT_SECRET,
          { expiresIn: '5m' }
        );
        return res.status(200).json({
          success: false,
          mfa_required: true,
          code: 'MFA_TOTP_REQUIRED',
          mfa_challenge_token: mfaChallengeToken,
          message: 'Vui lòng nhập mã xác thực 2 lớp (TOTP 6 số) từ ứng dụng Authenticator.'
        });
      }
      if (!verifyTotpCode(user.totp_secret_enc, providedOtp)) {
        try {
          await pool.query(
            `INSERT INTO security_incidents (event_type, severity, user_id, ip_address, route_path, details)
             VALUES ('INVALID_MFA_LOGIN', 'high', $1, $2, '/api/auth/login', $3)`,
            [user.id, req.ip || null, JSON.stringify({ email: user.email })]
          );
          const { notifyAdmins } = require('../services/notificationDispatcher');
          notifyAdmins({
            eventCode: 'INVALID_MFA_LOGIN',
            severity: 'danger',
            title: 'Cảnh báo: Sai mã 2FA OTP khi đăng nhập',
            message: `Tài khoản ${user.email} vừa nhập sai mã TOTP 2FA từ IP ${req.ip || 'N/A'}.`,
            actorUserId: user.id,
            sendZalo: false
          }).catch(() => {});
        } catch (_) {}
        return res.status(401).json({
          error: 'Mã xác thực 2 lớp (OTP) không chính xác hoặc đã hết hạn.',
          code: 'INVALID_MFA_CODE'
        });
      }
    }

    const effectiveExpiresIn = user.role === 'admin' ? ADMIN_JWT_EXPIRES_IN : JWT_EXPIRES_IN;
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        sub_role: effectiveSubRole,
        parent_user_id: user.parent_user_id || null,
        farm_id: user.farm_id,
        account_tier: user.account_tier || 'normal',
        tier_expires_at: user.tier_expires_at,
        tv: tokenVersion
      },
      process.env.JWT_SECRET,
      { expiresIn: effectiveExpiresIn }
    );

    await pool.query(
      'UPDATE users SET is_online = true, last_active_at = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
      [user.id]
    );

    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Đăng nhập', 'Đăng nhập vào hệ thống thành công.')`,
      [user.id]
    );

    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('user_status_changed', { id: user.id, is_online: true, last_active_at: new Date() });
    }

    let ownedFarmIds = [];
    let assignedPlantIds = [];
    try {
      const [farmsRes, assignedRes] = await Promise.all([
        pool.query(
          `SELECT id FROM farms WHERE (user_id = $1 OR user_id = COALESCE($3, 0) OR id = COALESCE($2, 0)) AND (is_deleted IS NOT TRUE)`,
          [user.id, user.farm_id || null, user.parent_user_id || null]
        ),
        pool.query(
          `SELECT id FROM plants WHERE assigned_to_user_id = $1 AND (is_deleted IS NOT TRUE)`,
          [user.id]
        )
      ]);
      ownedFarmIds = farmsRes.rows.map(r => r.id);
      assignedPlantIds = assignedRes.rows.map(r => r.id);
    } catch (_) {}

    const primaryFarmId = user.farm_id || (ownedFarmIds.length > 0 ? ownedFarmIds[0] : null);
    const encUserId = encodeUserId(user.id);

    if (user.role === 'admin' && typeof res.cookie === 'function') {
      const isSecure = !!(req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production');
      res.cookie('pb_admin_session', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: isSecure,
        path: '/',
        maxAge: 30 * 60 * 1000
      });
    }

    try {
      const { notifyUser } = require('../services/notificationDispatcher');
      if (user.parent_user_id) {
        notifyUser(user.parent_user_id, {
          eventCode: 'SUB_ACCOUNT_LOGIN',
          severity: 'audit_silent',
          title: `Tài khoản phụ ${user.full_name || user.email} vừa đăng nhập`,
          message: `${user.full_name || user.email} (${effectiveSubRole}) đăng nhập lúc ${new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} từ IP ${req.ip || 'N/A'}.`,
          actorUserId: user.id,
          farmId: primaryFarmId,
          sendZalo: false
        }).catch(() => {});
      }
    } catch (_) {}

    res.json({
      token,
      expires_in: effectiveExpiresIn,
      encrypted_user_id: encUserId,
      user: {
        id: user.id,
        public_id: generateIsoPublicId(user.role, user.id),
        encrypted_user_id: encUserId,
        email: user.email,
        role: user.role,
        sub_role: effectiveSubRole,
        parent_user_id: user.parent_user_id || null,
        allow_view_finance: allowViewFinance,
        view_plants_scope: user.view_plants_scope || 'all',
        allow_view_supplies: user.allow_view_supplies !== false,
        allow_shared_history: user.allow_shared_history !== false,
        assigned_plant_ids: assignedPlantIds,
        farm_id: primaryFarmId,
        owned_farm_ids: ownedFarmIds,
        name: user.full_name,
        full_name: user.full_name,
        phone: user.phone,
        address: user.address,
        account_tier: user.account_tier || 'normal',
        tier_expires_at: user.tier_expires_at
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

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

    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, phone, gender, dob, plant_type, plant_variety, plant_age, farm_area, approved, account_tier)
       VALUES ($1, $2, $3, 'user', $4, $5, $6, $7, $8, $9, $10, true, 'normal')
       RETURNING id, email, full_name, phone, approved, account_tier, created_at`,
      [email, hash, name, cleanPhone, gender || null, dob || null, plant_type || null, plant_variety || null, plant_age || null, parsedArea]
    );

    const newUser = userRes.rows[0];

    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Đăng ký tài khoản', 'Khách hàng hoàn tất đăng ký tài khoản nông hộ mới thành công.')`,
      [newUser.id]
    );

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

    try {
      const { notifyAdmins } = require('../services/notificationDispatcher');
      notifyAdmins({
        eventCode: 'USER_REGISTERED',
        severity: 'warning',
        title: 'Đăng ký tài khoản nông hộ mới',
        message: `${newUser.full_name || newUser.phone || newUser.email} vừa đăng ký tài khoản (${plant_type || 'Chưa khai báo'}).`,
        entityType: 'user',
        entityId: newUser.id,
        actorUserId: newUser.id,
        sendZalo: false
      }).catch(() => {});
    } catch (_) {}

    const encUserId = encodeUserId(newUser.id);
    newUser.encrypted_user_id = encUserId;

    res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ bằng Số điện thoại và Mật khẩu vừa tạo.',
      encrypted_user_id: encUserId,
      user: newUser
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Lỗi server khi đăng ký tài khoản: ' + err.message });
  }
});

router.post('/onboard-lead', require('../middleware/auth'), require('../middleware/admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      full_name,
      phone,
      email: customEmail,
      password,
      farm_name,
      farm_latitude,
      farm_longitude,
      source_tag_uid
    } = req.body;

    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Số điện thoại là bắt buộc để kích hoạt tài khoản.' });
    }
    if (password && password.trim().length > 0 && password.trim().length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }
    const rawPassword = (password && password.trim().length >= 6)
      ? password.trim()
      : crypto.randomBytes(12).toString('base64url');

    const cleanPhone = phone.trim();
    const cleanName = full_name && full_name.trim() ? full_name.trim() : `Nông hộ ${cleanPhone}`;
    const cleanFarmName = farm_name && farm_name.trim() ? farm_name.trim() : `Vườn ${cleanName}`;
    const email = customEmail && customEmail.trim() ? customEmail.trim() : `${cleanPhone}@farmer.tanbaocorp.vn`;

    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT * FROM users WHERE phone = $1 OR LOWER(email) = LOWER($2)',
      [cleanPhone, email.toLowerCase()]
    );

    let user = null;
    let isNewUser = false;

    if (existing.rows.length > 0) {
      user = existing.rows[0];
      if (password && password.trim().length > 0) {
        const valid = await bcrypt.compare(password.trim(), user.password_hash);
        if (!valid) {
          await client.query('ROLLBACK');
          return res.status(401).json({
            error: 'Số điện thoại này đã được đăng ký trên hệ thống. Mật khẩu cung cấp không khớp.',
            user_exists: true
          });
        }
      }
    } else {
      isNewUser = true;
      const hash = await bcrypt.hash(rawPassword, 12);
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role, phone, approved, account_tier)
         VALUES ($1, $2, $3, 'user', $4, true, 'pro')
         RETURNING id, email, full_name, phone, role, approved, account_tier, created_at`,
        [email, hash, cleanName, cleanPhone]
      );
      user = userRes.rows[0];
    }

    let farm = null;
    const farmCheck = await client.query(
      `SELECT * FROM farms WHERE (user_id = $1 OR id = COALESCE($2, 0)) AND is_deleted IS NOT TRUE ORDER BY id ASC LIMIT 1`,
      [user.id, user.farm_id || null]
    );

    const lat = farm_latitude ? parseFloat(farm_latitude) : null;
    const lng = farm_longitude ? parseFloat(farm_longitude) : null;
    const polygonCoords = (lat && lng) ? [[lat, lng]] : [];

    if (farmCheck.rows.length === 0) {
      const generatedPuc = `PUC-${cleanPhone.slice(-4)}-${Math.floor(Math.random() * 899 + 100)}`;
      const farmRes = await client.query(
        `INSERT INTO farms (name, description, polygon_coordinates, latitude, longitude, created_by, user_id, puc_code)
         VALUES ($1, $2, $3, $4, $5, $6, $6, $7)
         RETURNING *`,
        [cleanFarmName, 'Trang trại khởi tạo tự động từ cổng Smart NFC Gateway /sub', JSON.stringify(polygonCoords), lat, lng, user.id, generatedPuc]
      );
      farm = farmRes.rows[0];

      try {
        await client.query(
          `INSERT INTO farm_plots (farm_id, plot_code, plot_name)
           VALUES ($1, 'A1', 'Lô A1')
           ON CONFLICT (farm_id, plot_code) DO NOTHING`,
          [farm.id]
        );
      } catch (_) {}

      await client.query('UPDATE users SET farm_id = $1 WHERE id = $2', [farm.id, user.id]);
      user.farm_id = farm.id;
    } else {
      farm = farmCheck.rows[0];
    }

    await client.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Smart NFC Lead Onboarding', $2)`,
      [user.id, `Khách hàng kích hoạt qua cổng số Smart NFC Gateway (/sub). Thẻ nguồn: ${source_tag_uid || 'N/A'}`]
    );

    await client.query('COMMIT');

    try {
      await delCacheByPattern('farms_');
    } catch (_) {}

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        farm_id: farm ? farm.id : user.farm_id,
        account_tier: user.account_tier || 'pro'
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('user_registered', {
        id: user.id,
        name: user.full_name,
        phone: user.phone,
        source: 'smart_nfc_sub_gateway'
      });
      broadcast('farms_updated');
    }

    const encUserId = encodeUserId(user.id);

    res.status(201).json({
      success: true,
      message: isNewUser ? 'Đăng ký tài khoản và thiết lập trang trại thành công!' : 'Đăng nhập thành công!',
      is_new_user: isNewUser,
      token,
      encrypted_user_id: encUserId,
      user: {
        id: user.id,
        public_id: generateIsoPublicId(user.role, user.id),
        encrypted_user_id: encUserId,
        email: user.email,
        role: user.role,
        farm_id: farm ? farm.id : null,
        full_name: user.full_name,
        phone: user.phone,
        account_tier: user.account_tier || 'pro'
      },
      farm: {
        id: farm ? farm.id : null,
        name: farm ? farm.name : cleanFarmName,
        puc_code: farm ? farm.puc_code : null
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Onboard lead error:', err);
    res.status(500).json({ error: 'Lỗi server khi kích hoạt tài khoản cổng Smart NFC: ' + err.message });
  } finally {
    client.release();
  }
});

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

router.post('/logout', require('../middleware/auth'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET is_online = false, last_active_at = NOW(), token_version = COALESCE(token_version, 1) + 1 WHERE id = $1',
      [req.user.id]
    );
    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Đăng xuất', 'Người dùng chủ động đăng xuất khỏi hệ thống.')`,
      [req.user.id]
    );
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

router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, full_name, role, sub_role, parent_user_id, allow_view_finance,
              view_plants_scope, allow_view_supplies, allow_shared_history,
              avatar_url, phone, address, city, country, gender, created_at,
              account_tier, tier_expires_at, tier_admin_note, farm_id
       FROM users WHERE id=$1`,
      [req.user.id]
    );
    const u = result.rows[0];
    if (u) {
      u.public_id = generateIsoPublicId(u.role, u.id);
      u.encrypted_user_id = encodeUserId(u.id);
      u.sub_role = u.sub_role || 'farm_owner';
      const isRestrictedFinance = ['care_worker', 'auditor_readonly'].includes(u.sub_role);
      u.allow_view_finance = isRestrictedFinance ? (u.allow_view_finance === true) : (u.allow_view_finance !== false);
      u.view_plants_scope = u.view_plants_scope || 'all';
      u.allow_view_supplies = u.allow_view_supplies !== false;
      u.allow_shared_history = u.allow_shared_history !== false;
      try {
        const [farmsRes, assignedRes] = await Promise.all([
          pool.query(
            `SELECT id FROM farms WHERE (user_id = $1 OR user_id = COALESCE($3, 0) OR id = COALESCE($2, 0)) AND (is_deleted IS NOT TRUE)`,
            [u.id, u.farm_id || null, u.parent_user_id || null]
          ),
          pool.query(
            `SELECT id FROM plants WHERE assigned_to_user_id = $1 AND (is_deleted IS NOT TRUE)`,
            [u.id]
          )
        ]);
        u.owned_farm_ids = farmsRes.rows.map(r => r.id);
        u.assigned_plant_ids = assignedRes.rows.map(r => r.id);
        if (!u.farm_id && u.owned_farm_ids.length > 0) {
          u.farm_id = u.owned_farm_ids[0];
        }
      } catch (_) {
        u.owned_farm_ids = u.farm_id ? [u.farm_id] : [];
        u.assigned_plant_ids = [];
      }
    }
    res.json(u);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.get('/verify-sub-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const userId = decodeUserId(token);
    if (!userId) {
      return res.status(400).json({ success: false, valid: false, error: 'Mã định danh bảo mật không hợp lệ hoặc đã bị thay đổi.' });
    }

    const result = await pool.query('SELECT id, full_name, email, role, farm_id FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, valid: false, error: 'Không tìm thấy người dùng tương ứng.' });
    }

    const u = result.rows[0];
    res.json({
      success: true,
      valid: true,
      user_id: u.id,
      public_id: generateIsoPublicId(u.role, u.id),
      encrypted_user_id: token,
      name: u.full_name
    });
  } catch (err) {
    console.error('Verify sub token error:', err);
    res.status(500).json({ success: false, error: 'Lỗi server khi xác thực mã.' });
  }
});

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

router.post('/avatar', require('../middleware/auth'), avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn ảnh đại diện.' });

    const existing = await pool.query('SELECT avatar_url FROM users WHERE id=$1', [req.user.id]);
    const oldUrl = existing.rows[0]?.avatar_url;
    if (oldUrl) {
      const parts = oldUrl.split('/object/public/plant-media/');
      if (parts[1]) await deleteFile(parts[1]);
    }

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
    await pool.query(
      'UPDATE users SET password_hash=$1, token_version = COALESCE(token_version, 1) + 1, failed_login_attempts = 0, locked_until = NULL WHERE id=$2',
      [hash, req.user.id]
    );

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

const { sendAdminResetNotification, sendCustomerNewPassword } = require('../services/emailService');

router.post('/forgot-password', async (req, res) => {
  try {
    const { identity, note } = req.body;
    if (!identity || !identity.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập Email hoặc Số điện thoại đăng ký.' });
    }

    const trimmed = identity.trim();
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

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const baseUrl = `${protocol}://${host}`;

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

    const tempPassword = `Tanbao@${Math.floor(100000 + Math.random() * 900000)}`;
    const hash = await bcrypt.hash(tempPassword, 12);

    await pool.query(
      'UPDATE users SET password_hash = $1, token_version = COALESCE(token_version, 1) + 1, failed_login_attempts = 0, locked_until = NULL WHERE id = $2',
      [hash, user.id]
    );

    await pool.query(
      "UPDATE password_reset_requests SET status = 'approved', approved_at = NOW() WHERE id = $1",
      [reqData.id]
    );

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

router.delete('/reset-requests/:id', require('../middleware/auth'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Chỉ Admin mới có quyền truy cập.' });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Mã yêu cầu không hợp lệ.' });

    const result = await pool.query('DELETE FROM password_reset_requests WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy yêu cầu cấp lại mật khẩu.' });
    }
    res.json({ success: true, message: 'Đã xóa vĩnh viễn yêu cầu cấp lại mật khẩu.', deleted: result.rows[0] });
  } catch (err) {
    console.error('Error deleting reset request:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa yêu cầu: ' + err.message });
  }
});

router.delete('/reset-requests', require('../middleware/auth'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Chỉ Admin mới có quyền truy cập.' });
    const { scope } = req.query;

    let result;
    if (scope === 'handled') {
      result = await pool.query("DELETE FROM password_reset_requests WHERE status IN ('approved', 'rejected') RETURNING id");
    } else {
      result = await pool.query("DELETE FROM password_reset_requests RETURNING id");
    }

    res.json({
      success: true,
      deleted_count: result.rows.length,
      message: `Đã xóa vĩnh viễn ${result.rows.length} yêu cầu cấp lại mật khẩu.`
    });
  } catch (err) {
    console.error('Error clearing reset requests:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa danh sách yêu cầu: ' + err.message });
  }
});

router.post('/refresh', require('../middleware/auth'), async (req, res) => {
  try {
    const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
    const ADMIN_JWT_EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || '30m';
    const userRes = await pool.query(
      'SELECT id, email, role, sub_role, parent_user_id, farm_id, account_tier, tier_expires_at, COALESCE(token_version, 1) as token_version FROM users WHERE id = $1 LIMIT 1',
      [req.user.id]
    );
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Tài khoản không tồn tại.' });
    }
    const u = userRes.rows[0];
    const effectiveExpiresIn = u.role === 'admin' ? ADMIN_JWT_EXPIRES_IN : JWT_EXPIRES_IN;
    const token = jwt.sign(
      {
        id: u.id,
        email: u.email,
        role: u.role,
        sub_role: u.sub_role || 'farm_owner',
        parent_user_id: u.parent_user_id || null,
        farm_id: u.farm_id,
        account_tier: u.account_tier || 'normal',
        tier_expires_at: u.tier_expires_at,
        tv: Number(u.token_version || 1)
      },
      process.env.JWT_SECRET,
      { expiresIn: effectiveExpiresIn }
    );
    if (u.role === 'admin' && typeof res.cookie === 'function') {
      const isSecure = !!(req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production');
      res.cookie('pb_admin_session', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: isSecure,
        path: '/',
        maxAge: 30 * 60 * 1000
      });
    }
    res.json({ success: true, token, expires_in: effectiveExpiresIn, token_version: Number(u.token_version || 1) });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server khi làm mới phiên đăng nhập.' });
  }
});

router.post('/mfa/setup', require('../middleware/auth'), async (req, res) => {
  try {
    const secretBase32 = generateBase32Secret(20);
    const encrypted = encryptTotpSecret(secretBase32);
    await pool.query(
      'UPDATE users SET totp_secret_enc = $1 WHERE id = $2',
      [encrypted, req.user.id]
    );
    const otpauthUri = buildOtpAuthUri({
      accountName: req.user.email || `user-${req.user.id}`,
      issuer: 'TanBaoAgTech',
      secretBase32
    });
    res.json({
      success: true,
      secret_base32: secretBase32,
      otpauth_uri: otpauthUri
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi thiết lập 2FA TOTP: ' + err.message });
  }
});

router.post('/mfa/verify-enable', require('../middleware/auth'), async (req, res) => {
  try {
    const totpCode = req.body && req.body.totp_code ? String(req.body.totp_code).trim() : '';
    const uRes = await pool.query('SELECT id, totp_secret_enc FROM users WHERE id = $1 LIMIT 1', [req.user.id]);
    const u = uRes.rows[0];
    if (!u || !u.totp_secret_enc) {
      return res.status(400).json({ error: 'Chưa khởi tạo khóa 2FA. Hãy gọi /mfa/setup trước.' });
    }
    if (!verifyTotpCode(u.totp_secret_enc, totpCode)) {
      return res.status(401).json({ error: 'Mã OTP xác nhận không đúng.', code: 'INVALID_MFA_CODE' });
    }
    await pool.query('UPDATE users SET mfa_enabled = true WHERE id = $1', [req.user.id]);
    res.json({ success: true, mfa_enabled: true, message: 'Đã kích hoạt xác thực 2 lớp (2FA TOTP) chuẩn ISO 27001.' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi kích hoạt 2FA TOTP: ' + err.message });
  }
});

router.post('/mfa/disable', require('../middleware/auth'), async (req, res) => {
  try {
    const { password, totp_code } = req.body || {};
    const uRes = await pool.query('SELECT id, password_hash, totp_secret_enc, mfa_enabled FROM users WHERE id = $1 LIMIT 1', [req.user.id]);
    const u = uRes.rows[0];
    if (!u) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    const passOk = password ? await bcrypt.compare(String(password), u.password_hash) : false;
    if (!passOk) return res.status(401).json({ error: 'Mật khẩu xác nhận không đúng.' });
    if (u.mfa_enabled && u.totp_secret_enc && !verifyTotpCode(u.totp_secret_enc, totp_code)) {
      return res.status(401).json({ error: 'Mã OTP không chính xác.', code: 'INVALID_MFA_CODE' });
    }
    await pool.query('UPDATE users SET mfa_enabled = false, totp_secret_enc = NULL WHERE id = $1', [req.user.id]);
    res.json({ success: true, mfa_enabled: false });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tắt 2FA TOTP: ' + err.message });
  }
});

router.post('/revoke-all-sessions', require('../middleware/auth'), async (req, res) => {
  try {
    const scope = String(req.body && req.body.scope ? req.body.scope : 'self');
    const targetUserId = req.body && req.body.target_user_id ? parseInt(req.body.target_user_id, 10) : null;
    let revokedCount = 0;

    if (req.user.role === 'admin' && scope === 'all_admins') {
      const r = await pool.query(
        `UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE role = 'admin' RETURNING id`
      );
      revokedCount = r.rows.length;
    } else if (req.user.role === 'admin' && targetUserId) {
      const r = await pool.query(
        `UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE id = $1 RETURNING id`,
        [targetUserId]
      );
      revokedCount = r.rows.length;
    } else {
      const r = await pool.query(
        `UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE id = $1 RETURNING id`,
        [req.user.id]
      );
      revokedCount = r.rows.length;
    }

    try {
      await pool.query(
        `INSERT INTO security_incidents (event_type, severity, user_id, ip_address, route_path, details)
         VALUES ('SESSION_KILL_SWITCH', 'critical', $1, $2, '/api/auth/revoke-all-sessions', $3)`,
        [req.user.id, req.ip || null, JSON.stringify({ scope, targetUserId, revokedCount })]
      );
      const { notifyAdmins } = require('../services/notificationDispatcher');
      notifyAdmins({
        eventCode: 'SESSION_KILL_SWITCH',
        severity: 'danger',
        title: 'Khẩn cấp: Đã kích hoạt Session Kill-Switch',
        message: `${req.user.email} vừa thu hồi ${revokedCount} phiên JWT (scope: ${scope}) từ IP ${req.ip || 'N/A'}.`,
        actorUserId: req.user.id,
        sendZalo: false
      }).catch(() => {});
    } catch (_) {}

    res.json({
      success: true,
      revoked_accounts: revokedCount,
      message: 'Đã thu hồi toàn bộ phiên JWT đang hoạt động.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi thu hồi phiên đăng nhập: ' + err.message });
  }
});

module.exports = router;
