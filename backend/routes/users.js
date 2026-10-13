const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { delCacheByPattern } = require('../config/redis');

// Apply auth to all routes in this file
router.use(auth);

/**
 * ISO/IEC 11558 & ISO 3309 Standard 8-Digit Obfuscation Hash Generator
 */
function generateIsoPublicId(role, numId) {
  const prefix = role === 'admin' ? 'adm' : 'usr';
  const id = parseInt(numId) || 0;
  const val = Math.abs(((id * 1664525 + 1013904223) ^ 0x5B9A4C21) % 90000000) + 10000000;
  return `${prefix}-${val}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// FARMER SUB-ACCOUNT RBAC API (QUẢN LÝ & PHÂN QUYỀN TÀI KHOẢN DƯỚI QUYỀN CHỦ VƯỜN)
// Cho phép Chủ trang trại (farm_owner) tạo & phân quyền:
// - manager (Quản đốc / Kỹ sư trưởng)
// - care_worker (Nhân công chăm sóc - Tự động ẩn giá vật tư, chi phí & doanh thu)
// - auditor_readonly (Kiểm định viên VietGAP/GlobalGAP - Chỉ xem kỹ thuật, ẩn tài chính)
// ═══════════════════════════════════════════════════════════════════════════

function ensureFarmOwnerPrivilege(req, res, next) {
  const subRole = req.user.sub_role || 'farm_owner';
  if (req.user.role !== 'admin' && (req.user.parent_user_id || ['care_worker', 'auditor_readonly'].includes(subRole))) {
    return res.status(403).json({
      error: 'Chỉ Chủ trang trại (Owner) mới có quyền quản lý và phân quyền tài khoản nhân sự dưới quyền.'
    });
  }
  next();
}

// GET /api/users/my-team - Lấy danh sách tài khoản nhân sự dưới quyền của Chủ vườn
router.get('/my-team', async (req, res) => {
  try {
    const ownerId = req.user.parent_user_id || req.user.id;

    // Lấy danh sách trang trại của chủ vườn
    const farmsRes = await pool.query(
      `SELECT id, name, puc_code, global_did
       FROM farms
       WHERE (user_id = $1 OR id = COALESCE($2, 0)) AND (is_deleted IS NOT TRUE)
       ORDER BY id ASC`,
      [ownerId, req.user.farm_id || null]
    );
    const farmIds = farmsRes.rows.map(f => f.id);

    // Lấy danh sách tài khoản cấp dưới
    const teamRes = await pool.query(
      `SELECT u.id, u.email, u.phone, u.full_name, u.role,
              COALESCE(u.sub_role, 'care_worker') as sub_role,
              u.parent_user_id, u.farm_id, f.name as farm_name,
              u.view_plants_scope, u.allow_view_supplies, u.allow_shared_history,
              u.allow_view_finance, u.approved, u.is_online, u.last_active_at, u.created_at,
              COALESCE((
                SELECT json_agg(p.id) FROM plants p WHERE p.assigned_to_user_id = u.id
              ), '[]'::json) as assigned_plant_ids
       FROM users u
       LEFT JOIN farms f ON f.id = u.farm_id
       WHERE u.id <> $1
         AND u.role <> 'admin'
         AND (
           u.parent_user_id = $1
           OR (u.farm_id IS NOT NULL AND u.farm_id = ANY($2::int[]))
         )
       ORDER BY u.created_at DESC, u.id DESC`,
      [ownerId, farmIds.length > 0 ? farmIds : [0]]
    );

    const members = teamRes.rows.map(u => {
      const sRole = u.sub_role || 'care_worker';
      const isRestricted = ['care_worker', 'auditor_readonly'].includes(sRole);
      return {
        ...u,
        public_id: generateIsoPublicId(u.role, u.id),
        allow_view_finance: isRestricted ? (u.allow_view_finance === true) : (u.allow_view_finance !== false)
      };
    });

    res.json({
      success: true,
      owner_id: ownerId,
      my_sub_role: req.user.sub_role || 'farm_owner',
      can_manage_team: !req.user.parent_user_id && !['care_worker', 'auditor_readonly'].includes(req.user.sub_role || 'farm_owner'),
      farms: farmsRes.rows,
      members
    });
  } catch (err) {
    console.error('Error fetching farmer team:', err);
    res.status(500).json({ error: 'Lỗi server khi tải danh sách nhân sự dưới quyền.' });
  }
});

// POST /api/users/my-team - Chủ vườn tạo tài khoản nhân sự dưới quyền
router.post('/my-team', ensureFarmOwnerPrivilege, async (req, res) => {
  try {
    const {
      full_name, phone, email, password,
      sub_role = 'care_worker',
      farm_id,
      view_plants_scope = 'all',
      allow_view_supplies = true,
      allow_view_finance,
      assigned_plant_ids = []
    } = req.body;

    if (!full_name || !full_name.trim() || !password || !password.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ Họ tên nhân sự và Mật khẩu đăng nhập.' });
    }

    const validSubRoles = ['manager', 'care_worker', 'auditor_readonly'];
    const cleanSubRole = validSubRoles.includes(sub_role) ? sub_role : 'care_worker';

    const trimmedPhone = phone && phone.trim() ? phone.trim() : null;
    let trimmedEmail = email && email.trim() ? email.trim().toLowerCase() : null;
    if (!trimmedPhone && !trimmedEmail) {
      return res.status(400).json({ error: 'Vui lòng nhập Số điện thoại hoặc Email để nhân sự dùng đăng nhập.' });
    }
    if (!trimmedEmail && trimmedPhone) {
      trimmedEmail = `${trimmedPhone.replace(/[^0-9a-zA-Z]/g, '')}@staff.tanbaocorp.vn`;
    }

    // Kiểm tra trùng Email / SĐT
    if (trimmedEmail) {
      const exEmail = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [trimmedEmail]);
      if (exEmail.rows.length > 0) {
        return res.status(400).json({ error: 'Email đăng nhập này đã tồn tại trên hệ thống.' });
      }
    }
    if (trimmedPhone) {
      const exPhone = await pool.query('SELECT id FROM users WHERE phone = $1', [trimmedPhone]);
      if (exPhone.rows.length > 0) {
        return res.status(400).json({ error: 'Số điện thoại này đã được đăng ký bởi tài khoản khác.' });
      }
    }

    // Xác định farm_id hợp lệ của chủ vườn
    const farmsRes = await pool.query(
      `SELECT id FROM farms WHERE (user_id = $1 OR id = COALESCE($2, 0)) AND (is_deleted IS NOT TRUE) ORDER BY id ASC`,
      [req.user.id, req.user.farm_id || null]
    );
    const ownedFarmIds = farmsRes.rows.map(f => f.id);
    let targetFarmId = farm_id ? parseInt(farm_id) : (req.user.farm_id || ownedFarmIds[0] || null);
    if (targetFarmId && req.user.role !== 'admin' && !ownedFarmIds.includes(targetFarmId)) {
      targetFarmId = req.user.farm_id || ownedFarmIds[0] || null;
    }

    // Tự động ẩn tài chính đối với care_worker và auditor_readonly nếu không bật rõ ràng
    const financeAllowed = allow_view_finance !== undefined
      ? Boolean(allow_view_finance)
      : (cleanSubRole === 'manager');

    const hash = await bcrypt.hash(password.trim(), 12);
    const insertRes = await pool.query(
      `INSERT INTO users (
        email, phone, password_hash, full_name, role, sub_role, parent_user_id,
        farm_id, approved, view_plants_scope, allow_shared_history, allow_view_supplies, allow_view_finance
      )
      VALUES ($1, $2, $3, $4, 'user', $5, $6, $7, true, $8, true, $9, $10)
      RETURNING id, email, phone, full_name, role, sub_role, parent_user_id, farm_id,
                view_plants_scope, allow_view_supplies, allow_view_finance, approved, created_at`,
      [
        trimmedEmail,
        trimmedPhone,
        hash,
        full_name.trim(),
        cleanSubRole,
        req.user.id,
        targetFarmId,
        view_plants_scope === 'assigned' ? 'assigned' : 'all',
        allow_view_supplies !== false,
        financeAllowed
      ]
    );

    const newMember = insertRes.rows[0];

    // Giao cây cụ thể nếu có
    if (Array.isArray(assigned_plant_ids) && assigned_plant_ids.length > 0) {
      const validIds = assigned_plant_ids.map(x => parseInt(x)).filter(x => !isNaN(x));
      if (validIds.length > 0) {
        await pool.query(
          `UPDATE plants SET assigned_to_user_id = $1 WHERE id = ANY($2::int[]) AND farm_id = ANY($3::int[])`,
          [newMember.id, validIds, ownedFarmIds.length > 0 ? ownedFarmIds : [targetFarmId || 0]]
        );
      }
    }

    try { await delCacheByPattern('users_'); } catch (_) {}

    res.status(201).json({
      success: true,
      message: `Đã tạo tài khoản nhân sự "${newMember.full_name}" (${cleanSubRole}) thành công!`,
      member: {
        ...newMember,
        public_id: generateIsoPublicId('user', newMember.id),
        assigned_plant_ids: Array.isArray(assigned_plant_ids) ? assigned_plant_ids.map(Number).filter(Boolean) : []
      }
    });
  } catch (err) {
    console.error('Error creating sub-account:', err);
    res.status(500).json({ error: 'Lỗi server khi tạo tài khoản nhân sự: ' + err.message });
  }
});

// PUT /api/users/my-team/:id - Chủ vườn cập nhật phân quyền / mật khẩu tài khoản cấp dưới
router.put('/my-team/:id', ensureFarmOwnerPrivilege, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const {
      full_name, phone, email, password,
      sub_role, farm_id,
      view_plants_scope, allow_view_supplies, allow_view_finance,
      approved, assigned_plant_ids
    } = req.body;

    // Kiểm tra tài khoản cấp dưới có thuộc quyền quản lý của Chủ vườn này không
    const checkRes = await pool.query(
      `SELECT * FROM users WHERE id = $1 AND role <> 'admin' AND (
         parent_user_id = $2
         OR farm_id IN (SELECT id FROM farms WHERE user_id = $2 OR id = COALESCE($3, 0))
       )`,
      [memberId, req.user.id, req.user.farm_id || null]
    );
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản nhân sự hoặc bạn không có quyền chỉnh sửa.' });
    }
    const existing = checkRes.rows[0];

    const validSubRoles = ['manager', 'care_worker', 'auditor_readonly'];
    const nextSubRole = (sub_role && validSubRoles.includes(sub_role)) ? sub_role : (existing.sub_role || 'care_worker');
    const nextFinance = allow_view_finance !== undefined
      ? Boolean(allow_view_finance)
      : (['care_worker', 'auditor_readonly'].includes(nextSubRole) ? false : Boolean(existing.allow_view_finance));

    const nextName = full_name && full_name.trim() ? full_name.trim() : existing.full_name;
    const nextPhone = phone !== undefined ? (phone && phone.trim() ? phone.trim() : null) : existing.phone;
    const nextEmail = email !== undefined ? (email && email.trim() ? email.trim().toLowerCase() : existing.email) : existing.email;
    const nextScope = view_plants_scope ? (view_plants_scope === 'assigned' ? 'assigned' : 'all') : (existing.view_plants_scope || 'all');
    const nextSupplies = allow_view_supplies !== undefined ? Boolean(allow_view_supplies) : (existing.allow_view_supplies !== false);
    const nextApproved = approved !== undefined ? Boolean(approved) : (existing.approved !== false);
    const nextFarmId = farm_id ? parseInt(farm_id) : existing.farm_id;

    if (nextPhone) {
      const dupPhone = await pool.query('SELECT id FROM users WHERE phone = $1 AND id <> $2', [nextPhone, memberId]);
      if (dupPhone.rows.length > 0) {
        return res.status(400).json({ error: 'Số điện thoại đã được sử dụng bởi tài khoản khác.' });
      }
    }

    let updateQuery = `
      UPDATE users
      SET full_name = $1, phone = $2, email = $3, sub_role = $4, farm_id = $5,
          view_plants_scope = $6, allow_view_supplies = $7, allow_view_finance = $8,
          approved = $9, parent_user_id = COALESCE(parent_user_id, $10), updated_at = NOW()
    `;
    const params = [
      nextName, nextPhone, nextEmail, nextSubRole, nextFarmId,
      nextScope, nextSupplies, nextFinance, nextApproved, req.user.id
    ];

    if (password && password.trim().length > 0) {
      const hash = await bcrypt.hash(password.trim(), 12);
      updateQuery += `, password_hash = $11 WHERE id = $12 RETURNING *`;
      params.push(hash, memberId);
    } else {
      updateQuery += ` WHERE id = $11 RETURNING *`;
      params.push(memberId);
    }

    const updatedRes = await pool.query(updateQuery, params);
    const updatedUser = updatedRes.rows[0];

    if (Array.isArray(assigned_plant_ids)) {
      await pool.query('UPDATE plants SET assigned_to_user_id = NULL WHERE assigned_to_user_id = $1', [memberId]);
      const validIds = assigned_plant_ids.map(x => parseInt(x)).filter(x => !isNaN(x));
      if (validIds.length > 0) {
        await pool.query('UPDATE plants SET assigned_to_user_id = $1 WHERE id = ANY($2::int[])', [memberId, validIds]);
      }
    }

    try { await delCacheByPattern('users_'); } catch (_) {}

    res.json({
      success: true,
      message: `Đã cập nhật phân quyền cho "${updatedUser.full_name}" thành công!`,
      member: {
        id: updatedUser.id,
        public_id: generateIsoPublicId('user', updatedUser.id),
        full_name: updatedUser.full_name,
        phone: updatedUser.phone,
        email: updatedUser.email,
        sub_role: updatedUser.sub_role,
        farm_id: updatedUser.farm_id,
        view_plants_scope: updatedUser.view_plants_scope,
        allow_view_supplies: updatedUser.allow_view_supplies,
        allow_view_finance: updatedUser.allow_view_finance,
        approved: updatedUser.approved
      }
    });
  } catch (err) {
    console.error('Error updating sub-account:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật nhân sự: ' + err.message });
  }
});

// DELETE /api/users/my-team/:id - Chủ vườn xóa tài khoản nhân sự cấp dưới
router.delete('/my-team/:id', ensureFarmOwnerPrivilege, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    if (memberId === req.user.id) {
      return res.status(400).json({ error: 'Không thể tự xóa tài khoản Chủ vườn.' });
    }

    const checkRes = await pool.query(
      `SELECT * FROM users WHERE id = $1 AND role <> 'admin' AND (
         parent_user_id = $2
         OR farm_id IN (SELECT id FROM farms WHERE user_id = $2 OR id = COALESCE($3, 0))
       )`,
      [memberId, req.user.id, req.user.farm_id || null]
    );
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản nhân sự thuộc quyền quản lý của bạn.' });
    }
    const target = checkRes.rows[0];

    await pool.query('UPDATE plants SET assigned_to_user_id = NULL WHERE assigned_to_user_id = $1', [memberId]);
    await pool.query('UPDATE plant_logs SET created_by = NULL WHERE created_by = $1', [memberId]);
    await pool.query('DELETE FROM users WHERE id = $1', [memberId]);

    try { await delCacheByPattern('users_'); } catch (_) {}

    res.json({
      success: true,
      message: `Đã xóa tài khoản nhân sự "${target.full_name}" khỏi trang trại.`
    });
  } catch (err) {
    console.error('Error deleting sub-account:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa tài khoản nhân sự: ' + err.message });
  }
});

// Apply admin check to all remaining routes in this file
router.use(admin);

// GET /api/users - List all users (with assigned farm info & permissions & assigned plants)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.phone, u.address, u.city, u.country, u.full_name, u.role,
              COALESCE(u.sub_role, 'farm_owner') as sub_role, u.parent_user_id, u.allow_view_finance,
              u.is_online, u.last_active_at, u.created_at,
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
       WHERE id = $4 RETURNING id, email, phone, address, full_name, role, account_tier, tier_expires_at, tier_admin_note`,
      [account_tier, expiresValue, tier_admin_note || null, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }

    // Record admin activity log
    try {
      await pool.query(
        `INSERT INTO user_activities (user_id, activity_type, description)
         VALUES ($1, 'Cập nhật gói cước', $2)`,
        [req.user.id, `Cập nhật gói cước cho Nông hộ #${userId} thành [${account_tier.toUpperCase()}] ${expiresValue ? '(Hạn: ' + expiresValue.slice(0, 10) + ')' : '(Vĩnh viễn)'}`]
      );
    } catch (_) {}

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
    email, phone, address, password, full_name, role, farm_id,
    view_plants_scope, view_history_from_date, allow_shared_history, allow_view_supplies,
    assigned_plant_ids
  } = req.body;

  if (!full_name || !full_name.trim() || !password || !password.trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin: họ và tên và mật khẩu.' });
  }
  
  const trimmedEmail = email && email.trim() ? email.trim().toLowerCase() : null;
  const trimmedPhone = phone && phone.trim() ? phone.trim() : null;
  const trimmedAddress = address && address.trim() ? address.trim() : null;

  if (!trimmedEmail && !trimmedPhone) {
    return res.status(400).json({ error: 'Vui lòng nhập ít nhất Số điện thoại hoặc Email để làm tài khoản đăng nhập.' });
  }

  const trimmedRole = role === 'admin' ? 'admin' : 'user';
  const assignedFarmId = farm_id && parseInt(farm_id) ? parseInt(farm_id) : null;

  try {
    // Check if email already exists
    if (trimmedEmail) {
      const existingEmail = await pool.query('SELECT id FROM users WHERE LOWER(email)=$1', [trimmedEmail]);
      if (existingEmail.rows.length > 0) {
        return res.status(400).json({ error: 'Email đã được sử dụng bởi tài khoản khác.' });
      }
    }

    // Check if phone already exists
    if (trimmedPhone) {
      const existingPhone = await pool.query('SELECT id FROM users WHERE phone=$1', [trimmedPhone]);
      if (existingPhone.rows.length > 0) {
        return res.status(400).json({ error: 'Số điện thoại đã được sử dụng bởi tài khoản khác.' });
      }
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (
        email, phone, address, password_hash, full_name, role, farm_id, approved,
        view_plants_scope, view_history_from_date, allow_shared_history, allow_view_supplies
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, $11)
       RETURNING id, email, phone, address, full_name, role, farm_id, view_plants_scope, view_history_from_date, allow_shared_history, allow_view_supplies, created_at`,
      [
        trimmedEmail, trimmedPhone, trimmedAddress, hash, full_name.trim(), trimmedRole, assignedFarmId,
        view_plants_scope || 'all',
        view_history_from_date || null,
        allow_shared_history !== false,
        allow_view_supplies !== false
      ]
    );

    const newUser = result.rows[0];

    // Synchronize farm's primary user_id if not set or set to admin
    if (assignedFarmId && newUser.role !== 'admin') {
      try {
        await pool.query(
          `UPDATE farms SET user_id = $1 WHERE id = $2 AND (user_id IS NULL OR user_id IN (SELECT id FROM users WHERE role = 'admin'))`,
          [newUser.id, assignedFarmId]
        );
      } catch (_) {}
    }

    // Assign specific plants to new user if provided
    if (Array.isArray(assigned_plant_ids) && assigned_plant_ids.length > 0) {
      const validIds = assigned_plant_ids.map(x => parseInt(x)).filter(x => !isNaN(x));
      if (validIds.length > 0) {
        await pool.query('UPDATE plants SET assigned_to_user_id = $1 WHERE id = ANY($2::int[])', [newUser.id, validIds]);
      }
    }

    try {
      await delCacheByPattern('users_');
      await delCacheByPattern('farms_');
    } catch (_) {}

    res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi tạo người dùng: ' + err.message });
  }
});

// PUT /api/users/:id - Update user details (including assigned farm_id & permissions & assigned plants)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    email, phone, address, password, full_name, role, farm_id,
    view_plants_scope, view_history_from_date, allow_shared_history, allow_view_supplies,
    assigned_plant_ids
  } = req.body;

  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ error: 'Họ và tên là bắt buộc.' });
  }

  const trimmedEmail = email && email.trim() ? email.trim().toLowerCase() : null;
  const trimmedPhone = phone && phone.trim() ? phone.trim() : null;
  const trimmedAddress = address && address.trim() ? address.trim() : null;

  if (!trimmedEmail && !trimmedPhone) {
    return res.status(400).json({ error: 'Vui lòng cung cấp ít nhất Số điện thoại hoặc Email.' });
  }

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
    if (trimmedEmail) {
      const existingEmail = await pool.query('SELECT id FROM users WHERE LOWER(email)=$1 AND id<>$2', [trimmedEmail, targetUserId]);
      if (existingEmail.rows.length > 0) {
        return res.status(400).json({ error: 'Email đã được sử dụng bởi tài khoản khác.' });
      }
    }

    // Check if phone is taken by another user
    if (trimmedPhone) {
      const existingPhone = await pool.query('SELECT id FROM users WHERE phone=$1 AND id<>$2', [trimmedPhone, targetUserId]);
      if (existingPhone.rows.length > 0) {
        return res.status(400).json({ error: 'Số điện thoại đã được sử dụng bởi tài khoản khác.' });
      }
    }

    let query = `
      UPDATE users 
      SET email=$1, phone=$2, address=$3, full_name=$4, role=$5, farm_id=$6,
          view_plants_scope=$7, view_history_from_date=$8, allow_shared_history=$9, allow_view_supplies=$10,
          updated_at=NOW()
    `;
    let params = [
      trimmedEmail,
      trimmedPhone,
      trimmedAddress,
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
      query += ', password_hash=$11 WHERE id=$12';
      params.push(hash, targetUserId);
    } else {
      query += ' WHERE id=$11';
      params.push(targetUserId);
    }

    await pool.query(query, params);
    
    // Sync farm ownership if assigned farm has no primary owner or is assigned to admin
    if (assignedFarmId && trimmedRole !== 'admin') {
      try {
        await pool.query(`
          UPDATE farms 
          SET user_id = $1 
          WHERE id = $2 AND (user_id IS NULL OR user_id IN (SELECT id FROM users WHERE role = 'admin'))
        `, [targetUserId, assignedFarmId]);
      } catch (_) {}
    }

    // Update specific assigned plants for this user
    if (Array.isArray(assigned_plant_ids)) {
      await pool.query('UPDATE plants SET assigned_to_user_id = NULL WHERE assigned_to_user_id = $1', [targetUserId]);
      const validIds = assigned_plant_ids.map(x => parseInt(x)).filter(x => !isNaN(x));
      if (validIds.length > 0) {
        await pool.query('UPDATE plants SET assigned_to_user_id = $1 WHERE id = ANY($2::int[])', [targetUserId, validIds]);
      }
    }

    try {
      await delCacheByPattern('users_');
      await delCacheByPattern('farms_');
    } catch (_) {}

    const updated = await pool.query(
      `SELECT u.id, u.email, u.phone, u.address, u.full_name, u.role, u.farm_id, u.view_plants_scope, u.view_history_from_date, u.allow_shared_history, u.allow_view_supplies, u.account_tier, u.tier_expires_at, u.tier_admin_note, u.created_at, f.name as farm_name
       FROM users u
       LEFT JOIN farms f ON f.id = u.farm_id
       WHERE u.id=$1`,
      [targetUserId]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật người dùng: ' + err.message });
  }
});

// DELETE /api/users/:id - Delete a user with full cascade & foreign-key safety
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
    const targetUser = userRes.rows[0];

    await client.query('BEGIN');

    // 1. Unlink & Set NULL on all nullable foreign key references
    await client.query('UPDATE plant_schemas SET created_by = NULL WHERE created_by = $1', [userId]);
    await client.query('UPDATE plants SET created_by = NULL WHERE created_by = $1', [userId]);
    await client.query('UPDATE plants SET assigned_to_user_id = NULL WHERE assigned_to_user_id = $1', [userId]);
    await client.query('UPDATE plant_logs SET created_by = NULL WHERE created_by = $1', [userId]);
    await client.query('UPDATE farms SET created_by = NULL WHERE created_by = $1', [userId]);
    await client.query('UPDATE farms SET user_id = NULL WHERE user_id = $1', [userId]);
    await client.query('UPDATE users SET farm_id = NULL WHERE id = $1', [userId]);

    // Optional tables (if present in database schema)
    try { await client.query('UPDATE nfc_tags_inventory SET created_by = NULL WHERE created_by = $1', [userId]); } catch (_) {}
    try { await client.query('UPDATE data_audit_logs SET user_id = NULL WHERE user_id = $1', [userId]); } catch (_) {}
    try { await client.query('UPDATE ai_knowledge_articles SET created_by = NULL WHERE created_by = $1', [userId]); } catch (_) {}
    try { await client.query('UPDATE ai_training_qa SET created_by = NULL WHERE created_by = $1', [userId]); } catch (_) {}
    try { await client.query('UPDATE ai_training_logs SET admin_id = NULL WHERE admin_id = $1', [userId]); } catch (_) {}
    try { await client.query('UPDATE ai_unanswered_queries SET user_id = NULL WHERE user_id = $1', [userId]); } catch (_) {}

    // 2. Delete user-owned notifications, alert rules, activities, password reset requests, usages & private supplies
    try { await client.query('DELETE FROM user_notifications WHERE user_id = $1', [userId]); } catch (_) {}
    try { await client.query('DELETE FROM user_alert_rules WHERE user_id = $1', [userId]); } catch (_) {}
    try { await client.query('DELETE FROM user_activities WHERE user_id = $1', [userId]); } catch (_) {}
    try { await client.query('DELETE FROM password_reset_requests WHERE user_id = $1', [userId]); } catch (_) {}
    try { await client.query('DELETE FROM supply_usages WHERE user_id = $1', [userId]); } catch (_) {}
    try { await client.query('DELETE FROM fixed_assets WHERE user_id = $1', [userId]); } catch (_) {}
    try { await client.query('DELETE FROM supplies WHERE user_id = $1', [userId]); } catch (_) {}

    // 3. Record in data_audit_logs before deletion
    try {
      await client.query(`
        INSERT INTO data_audit_logs (user_id, user_name, action_type, target_type, record_id, title, old_data, note)
        VALUES ($1, $2, 'DELETE', 'Người dùng', $3, $4, $5, 'Xóa tài khoản người dùng bởi Admin')
      `, [req.user.id, req.user.full_name || 'Quản trị viên', userId, `Xóa tài khoản ${targetUser.full_name} (${targetUser.email || targetUser.phone})`, JSON.stringify(targetUser)]);
    } catch (_) {}

    // 4. Delete the User record
    await client.query('DELETE FROM users WHERE id=$1', [userId]);

    await client.query('COMMIT');

    // Invalidate Redis caches
    try {
      await delCacheByPattern('users_');
      await delCacheByPattern('farms_');
      await delCacheByPattern('plants_');
    } catch (_) {}

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('user_deleted', { id: userId });
      broadcast('farms_updated');
    }

    res.json({ 
      success: true, 
      message: `Đã xóa tài khoản "${targetUser.full_name}" thành công!` 
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
    try {
      await pool.query(
        `INSERT INTO user_activities (user_id, activity_type, description)
         VALUES ($1, 'Phê duyệt tài khoản', 'Quản trị viên đã phê duyệt mở khóa tài khoản thành công.')`,
        [id]
      );
    } catch (_) {}

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