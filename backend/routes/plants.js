const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { logAuditAction } = require('./history');
const jwt = require('jsonwebtoken');
const nfcSecurity = require('../services/nfcSecurityService');
const zaloService = require('../services/zaloService');
const { singleflight } = require('../services/singleflight');
const { invalidateAndBroadcast } = require('../services/eventBus');
const { logAudit } = require('../services/auditLogger');
const { calculateSmartReminders } = require('../services/agriReminder');

const checkTier = require('../middleware/checkTier');

// Helper to strictly verify that the user is logged in AND belongs to the same farm or is Admin/Owner
async function verifyPlantAccess(req, plantId) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { 
      ok: false, 
      status: 401, 
      error: 'Vui lòng đăng nhập tài khoản thuộc trang trại này để thực hiện thao tác.' 
    };
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userRes = await pool.query('SELECT id, email, role, full_name, farm_id FROM users WHERE id = $1', [decoded.id]);
    if (userRes.rows.length === 0) {
      return { ok: false, status: 401, error: 'Tài khoản không tồn tại hoặc đã bị khóa.' };
    }
    const user = userRes.rows[0];

    const plantRes = await pool.query(`
      SELECT p.id, p.farm_id, p.created_by, p.assigned_to_user_id, f.user_id as farm_owner_id, f.name as farm_name
      FROM plants p
      LEFT JOIN farms f ON f.id = p.farm_id
      WHERE p.id = $1
    `, [plantId]);

    if (plantRes.rows.length === 0) {
      return { ok: false, status: 404, error: 'Không tìm thấy cây trồng.' };
    }
    const plant = plantRes.rows[0];

    // 1. Admin has universal access
    if (user.role === 'admin') {
      return { ok: true, user, plant };
    }

    // 2. Check if user is in the SAME farm or assigned/owner/creator
    const isSameFarm = user.farm_id && plant.farm_id && (Number(user.farm_id) === Number(plant.farm_id));
    const isAssigned = plant.assigned_to_user_id && (Number(user.id) === Number(plant.assigned_to_user_id));
    const isCreator = plant.created_by && (Number(user.id) === Number(plant.created_by));
    const isOwner = plant.farm_owner_id && (Number(user.id) === Number(plant.farm_owner_id));

    if (isSameFarm || isAssigned || isCreator || isOwner) {
      return { ok: true, user, plant };
    }

    return {
      ok: false,
      status: 403,
      error: `Tài khoản "${user.full_name || user.email}" không thuộc trang trại "${plant.farm_name || 'này'}". Bạn chỉ có quyền xem thông tin mở (chỉ đọc), không có quyền điều chỉnh hoặc ghi nhật ký.`
    };
  } catch (err) {
    return { ok: false, status: 401, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.' };
  }
// Helper function chuẩn hóa liều lượng nhật ký về đơn vị cơ sở của vật tư (VD: gram -> kg, ml -> lít, lít -> m3)
function convertLogAmountToBaseSupplyQty(rawAmount, rawUnit, supplyUnit, logType) {
  const amt = parseFloat(rawAmount) || 0;
  if (amt <= 0) return 0;

  const rUnit = (rawUnit || '').toLowerCase().trim();
  const sUnit = (supplyUnit || 'kg').toLowerCase().trim();

  // 1. Base supply unit là kg / kilogram
  if (sUnit === 'kg' || sUnit === 'kilogram' || sUnit === 'ký' || sUnit === 'ky') {
    if (rUnit === 'gam' || rUnit === 'g' || rUnit === 'gram' || rUnit === 'gr') {
      return amt / 1000;
    }
    if (rUnit === 'mg' || rUnit === 'miligam') {
      return amt / 1000000;
    }
    if (rUnit === 'tạ' || rUnit === 'ta') {
      return amt * 100;
    }
    if (rUnit === 'tấn' || rUnit === 'tan') {
      return amt * 1000;
    }
    return amt;
  }

  // 2. Base supply unit là lít / lit / l
  if (sUnit === 'lít' || sUnit === 'lit' || sUnit === 'l') {
    if (rUnit === 'ml' || rUnit === 'cc' || rUnit === 'mililit') {
      return amt / 1000;
    }
    if (rUnit === 'm3' || rUnit === 'm³' || rUnit === 'khối') {
      return amt * 1000;
    }
    return amt;
  }

  // 3. Base supply unit là m³ / m3 / khối
  if (sUnit === 'm3' || sUnit === 'm³' || sUnit === 'khối') {
    if (rUnit === 'lít' || rUnit === 'lit' || rUnit === 'l' || logType === 'Tưới nước') {
      return amt / 1000;
    }
    if (rUnit === 'ml' || rUnit === 'cc') {
      return amt / 1000000;
    }
    return amt;
  }

  // 4. Base supply unit là gam / g
  if (sUnit === 'gam' || sUnit === 'g' || sUnit === 'gram') {
    if (rUnit === 'kg' || rUnit === 'kilogram' || rUnit === 'ký') {
      return amt * 1000;
    }
    return amt;
  }

  // 5. Base supply unit là ml
  if (sUnit === 'ml') {
    if (rUnit === 'lít' || rUnit === 'lit' || rUnit === 'l') {
      return amt * 1000;
    }
    return amt;
  }

  return amt;
}

const multer = require('multer');
const storageService = require('../services/storageService');
const { uploadFile, deleteFile } = {
  uploadFile: (name, buf, mime) => storageService.uploadFile(name, buf, mime),
  deleteFile: (name) => storageService.deleteFile(name)
};
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận ảnh và video.'));
  }
});

function generateSlug(plantType) {
  const base = (plantType || 'plant').toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 30);
  return `${base}-${uuidv4().slice(0, 8)}`;
}

function generatePublicPlantUrl(farmId, plantId, nfcUid, host, proto) {
  const fId = farmId || 0;
  const pId = plantId || 0;
  const baseUrl = host ? `${proto || 'https'}://${host}` : (process.env.BASE_URL || 'https://plant-book.onrender.com');
  if (nfcUid && String(nfcUid).trim()) {
    return `${baseUrl}/${fId}/${pId}/${encodeURIComponent(String(nfcUid).trim())}`;
  }
  return `${baseUrl}/${fId}/${pId}`;
}

// ─── Admin routes (require auth) ─────────────────────────────────

router.get('/', auth, async (req, res) => {
  try {
    const { search, health_status, plant_type, user_id, farm_id, range_min, range_max, chunk_group } = req.query;

    // Singleflight Cache Key định danh truy vấn
    const sfKey = `plants:user_${req.user.id}:${farm_id || 'all'}:${range_min || ''}_${range_max || ''}:${chunk_group || ''}:${health_status || ''}:${plant_type || ''}:${search || ''}`;

    const rows = await singleflight.do(sfKey, async () => {
      let query = `
        SELECT p.*, ps.name as schema_name, u.full_name as creator_name,
               f.name as farm_name, f.puc_code as farm_puc_code, f.vietgap_cert_number,
               COALESCE(fu.full_name, fu_assigned.full_name) as farm_owner_name,
               COALESCE(fu.id, fu_assigned.id) as farm_owner_id,
               (SELECT COUNT(*) FROM plant_media pm WHERE pm.plant_id = p.id) as media_count,
               (SELECT COUNT(*) FROM plant_logs pl WHERE pl.plant_id = p.id AND (pl.is_deleted IS NOT TRUE)) as log_count,
               TO_CHAR((SELECT MAX(log_date) FROM plant_logs WHERE plant_id = p.id AND log_type = 'Tưới nước' AND (is_deleted IS NOT TRUE)), 'YYYY-MM-DD') as last_watered,
               TO_CHAR((SELECT MAX(log_date) FROM plant_logs WHERE plant_id = p.id AND log_type = 'Bón phân' AND (is_deleted IS NOT TRUE)), 'YYYY-MM-DD') as last_fertilized,
               TO_CHAR((SELECT MAX(log_date) FROM plant_logs WHERE plant_id = p.id AND (is_deleted IS NOT TRUE)), 'YYYY-MM-DD') as last_care_date,
               (SELECT log_type FROM plant_logs WHERE plant_id = p.id AND (is_deleted IS NOT TRUE) ORDER BY log_date DESC, id DESC LIMIT 1) as last_care_type,
               CASE 
                 WHEN p.phi_until_date IS NOT NULL AND p.phi_until_date >= CURRENT_DATE 
                 THEN (p.phi_until_date - CURRENT_DATE) 
                 ELSE 0 
                END as phi_remaining_days,
               CASE 
                 WHEN p.phi_until_date IS NOT NULL AND p.phi_until_date >= CURRENT_DATE 
                 THEN 'quarantine' 
                 ELSE 'safe' 
               END as current_phi_status
        FROM plants p
        LEFT JOIN plant_schemas ps ON ps.id = p.schema_id
        LEFT JOIN users u ON u.id = p.created_by
        LEFT JOIN farms f ON f.id = p.farm_id
        LEFT JOIN users fu ON fu.id = f.user_id
        LEFT JOIN users fu_assigned ON fu_assigned.farm_id = f.id AND fu_assigned.role != 'admin'
        WHERE (p.deleted_at IS NULL)
      `;
      const params = [];
      let idx = 1;

      if (req.user.role !== 'admin') {
        if (req.user.view_plants_scope === 'assigned') {
          query += ` AND (p.created_by = $${idx} OR p.assigned_to_user_id = $${idx} OR f.user_id = $${idx} OR p.farm_id = (SELECT farm_id FROM users WHERE id = $${idx}))`;
          params.push(req.user.id);
          idx++;
        } else {
          query += ` AND (
            f.user_id = $${idx} 
            OR p.created_by = $${idx} 
            OR p.assigned_to_user_id = $${idx} 
            OR p.farm_id IN (SELECT id FROM farms WHERE user_id = $${idx} AND is_deleted IS NOT TRUE)
            OR p.farm_id = (SELECT farm_id FROM users WHERE id = $${idx})
          )`;
          params.push(req.user.id);
          idx++;
        }
      }

      if (search) {
        query += ` AND (p.plant_type ILIKE $${idx} OR p.plant_variety ILIKE $${idx} OR p.location ILIKE $${idx} OR p.tree_code ILIKE $${idx})`;
        params.push(`%${search}%`);
        idx++;
      }
      if (health_status) {
        query += ` AND p.health_status = $${idx}`;
        params.push(health_status);
        idx++;
      }
      if (plant_type) {
        query += ` AND p.plant_type ILIKE $${idx}`;
        params.push(`%${plant_type}%`);
        idx++;
      }
      if (user_id) {
        query += ` AND f.user_id = $${idx}`;
        params.push(parseInt(user_id));
        idx++;
      }
      if (farm_id) {
        query += ` AND p.farm_id = $${idx}`;
        params.push(parseInt(farm_id));
        idx++;
      }

      // ── Range & Chunk Group Querying (0..20, 21..40, 41..60, 61..80) ──
      let rMin = null;
      let rMax = null;
      if (chunk_group) {
        const cg = parseInt(chunk_group, 10);
        if (cg === 1) { rMin = 1; rMax = 20; }
        else if (cg === 2) { rMin = 21; rMax = 40; }
        else if (cg === 3) { rMin = 41; rMax = 60; }
        else if (cg === 4) { rMin = 61; rMax = 80; }
      } else if (range_min !== undefined || range_max !== undefined) {
        if (range_min !== undefined && !isNaN(parseInt(range_min, 10))) rMin = parseInt(range_min, 10);
        if (range_max !== undefined && !isNaN(parseInt(range_max, 10))) rMax = parseInt(range_max, 10);
      }

      if (rMin !== null && rMax !== null) {
        query += ` AND (
          (p.tree_code ~ '^[0-9]+$' AND p.tree_code::int >= $${idx} AND p.tree_code::int <= $${idx + 1})
          OR (p.id >= $${idx} AND p.id <= $${idx + 1})
        )`;
        params.push(rMin, rMax);
        idx += 2;
      } else if (rMin !== null) {
        query += ` AND (
          (p.tree_code ~ '^[0-9]+$' AND p.tree_code::int >= $${idx})
          OR (p.id >= $${idx})
        )`;
        params.push(rMin);
        idx++;
      } else if (rMax !== null) {
        query += ` AND (
          (p.tree_code ~ '^[0-9]+$' AND p.tree_code::int <= $${idx})
          OR (p.id <= $${idx})
        )`;
        params.push(rMax);
        idx++;
      }

      query += ' ORDER BY p.created_at DESC';
      const result = await pool.query(query, params);
      return result.rows;
    });

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// ─── GPS Proximity Query (Tìm cây gần vị trí GPS của người dùng) ──────────────
router.get('/nearby-gps', auth, async (req, res) => {
  try {
    const { lat, lng, radius = 500, farm_id } = req.query;
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const radiusMeters = parseFloat(radius) || 500;

    if (isNaN(userLat) || isNaN(userLng)) {
      return res.status(400).json({ error: 'Tọa độ GPS (lat, lng) không hợp lệ.' });
    }

    const sfKey = `plants:nearby:${userLat.toFixed(5)}_${userLng.toFixed(5)}:${radiusMeters}:${farm_id || 'all'}`;

    const rows = await singleflight.do(sfKey, async () => {
      let query = `
        SELECT p.*, f.name as farm_name,
               (
                 6371000 * 2 * ASIN(SQRT(
                   POWER(SIN(RADIANS(p.latitude - $1) / 2), 2) +
                   COS(RADIANS($1)) * COS(RADIANS(p.latitude)) *
                   POWER(SIN(RADIANS(p.longitude - $2) / 2), 2)
                 ))
               ) AS distance_meters
        FROM plants p
        LEFT JOIN farms f ON f.id = p.farm_id
        WHERE p.latitude IS NOT NULL 
          AND p.longitude IS NOT NULL
          AND p.deleted_at IS NULL
      `;
      const params = [userLat, userLng];
      let idx = 3;

      if (farm_id) {
        query += ` AND p.farm_id = $${idx}`;
        params.push(parseInt(farm_id, 10));
        idx++;
      }

      if (req.user.role !== 'admin') {
        query += ` AND (f.user_id = $${idx} OR p.farm_id = (SELECT farm_id FROM users WHERE id = $${idx}) OR p.created_by = $${idx})`;
        params.push(req.user.id);
        idx++;
      }

      query += ` AND (
        6371000 * 2 * ASIN(SQRT(
          POWER(SIN(RADIANS(p.latitude - $1) / 2), 2) +
          COS(RADIANS($1)) * COS(RADIANS(p.latitude)) *
          POWER(SIN(RADIANS(p.longitude - $2) / 2), 2)
        ))
      ) <= $${idx}`;
      params.push(radiusMeters);

      query += ` ORDER BY distance_meters ASC LIMIT 100`;

      const result = await pool.query(query, params);
      return result.rows.map(r => ({
        ...r,
        distance_meters: Math.round(parseFloat(r.distance_meters) * 10) / 10
      }));
    });

    res.json(rows);
  } catch (err) {
    console.error('Nearby GPS error:', err);
    res.status(500).json({ error: 'Lỗi server khi tìm kiếm cây theo GPS: ' + err.message });
  }
});

// ─── Smart Agronomic Reminders (Nhắc việc thông minh theo chu kỳ) ─────────────
router.get('/smart-reminders', auth, async (req, res) => {
  try {
    const { farm_id } = req.query;
    let plantsQuery = 'SELECT * FROM plants WHERE (deleted_at IS NULL)';
    const params = [];
    if (farm_id) {
      plantsQuery += ' AND farm_id = $1';
      params.push(parseInt(farm_id, 10));
    } else if (req.user.role !== 'admin') {
      plantsQuery += ' AND (created_by = $1 OR farm_id = (SELECT farm_id FROM users WHERE id = $1))';
      params.push(req.user.id);
    }

    const plantsRes = await pool.query(plantsQuery, params);
    const logsRes = await pool.query('SELECT * FROM plant_logs WHERE is_deleted IS NOT TRUE ORDER BY log_date DESC LIMIT 500');

    const reminders = calculateSmartReminders(plantsRes.rows, logsRes.rows);
    res.json(reminders);
  } catch (err) {
    console.error('Smart reminders error:', err);
    res.status(500).json({ error: 'Lỗi server khi tính toán nhắc việc: ' + err.message });
  }
});

router.get('/logs/recent', auth, async (req, res) => {
  try {
    const rawDays = req.query.days;
    let daysLimit = 30; // default 30 days
    let isAll = false;

    if (rawDays === '3') {
      daysLimit = 7; // Dashboard short summary
    } else if (rawDays === 'all') {
      isAll = true;
    } else if (rawDays && !isNaN(parseInt(rawDays, 10))) {
      daysLimit = parseInt(rawDays, 10);
    }

    let query = `
      SELECT pl.*, 
             COALESCE(p.plant_type, 'Toàn vườn') as plant_type, 
             COALESCE(p.plant_variety, '') as plant_variety, 
             COALESCE(p.tree_code, 'Toàn vườn') as tree_code, 
             COALESCE(p.farm_id, (SELECT id FROM farms WHERE user_id = pl.created_by LIMIT 1)) as farm_id, 
             COALESCE(f.name, (SELECT name FROM farms WHERE user_id = pl.created_by LIMIT 1), 'Trang trại Nông hộ') as farm_name, 
             COALESCE(p.location, 'Toàn vườn') as plant_location, 
             u.full_name as creator_name
      FROM plant_logs pl
      LEFT JOIN plants p ON pl.plant_id = p.id
      LEFT JOIN farms f ON f.id = p.farm_id
      LEFT JOIN users u ON pl.created_by = u.id
      WHERE (pl.is_deleted IS NOT TRUE)
    `;
    const params = [];
    let idx = 1;

    if (!isAll) {
      query += ` AND pl.log_date >= CURRENT_DATE - $${idx}::integer `;
      params.push(daysLimit);
      idx++;
    }

    if (req.user.role !== 'admin') {
      query += ` AND (pl.created_by = $${idx} OR f.user_id = $${idx} OR f.id = (SELECT farm_id FROM users WHERE id = $${idx})) `;
      params.push(req.user.id);
      idx++;
    }
    query += ` ORDER BY pl.log_date DESC, pl.id DESC `;
    query += ` LIMIT 300 `;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent logs:', err);
    res.status(500).json({ error: 'Lỗi server khi tải nhật ký canh tác.' });
  }
});


router.get('/media/all', auth, async (req, res) => {
  try {
    let query = `
      SELECT pm.*, p.plant_type, p.tree_code, p.farm_id, f.name as farm_name, f.user_id as farm_owner_id, u.full_name as owner_name
      FROM plant_media pm
      JOIN plants p ON pm.plant_id = p.id
      LEFT JOIN farms f ON f.id = p.farm_id
      LEFT JOIN users u ON u.id = f.user_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Security: Non-admin users can only view their own farm media!
    if (req.user.role !== 'admin') {
      query += ` AND (f.user_id = $${paramIndex} OR p.farm_id = (SELECT farm_id FROM users WHERE id = $${paramIndex}) OR p.farm_id IN (SELECT id FROM farms WHERE user_id = $${paramIndex}) OR p.assigned_to_user_id = $${paramIndex} OR p.created_by = $${paramIndex}) `;
      params.push(req.user.id);
      paramIndex++;
      query += ` AND pm.delete_pending = false `;
    } else {
      // Admins can filter by User ID
      if (req.query.user_id) {
        query += ` AND f.user_id = $${paramIndex} `;
        params.push(parseInt(req.query.user_id));
        paramIndex++;
      }
      // Admins can filter by delete_pending
      if (req.query.pending_only === 'true') {
        query += ` AND pm.delete_pending = true `;
      }
    }

    if (req.query.farm_id) {
      query += ` AND p.farm_id = $${paramIndex} `;
      params.push(parseInt(req.query.farm_id));
      paramIndex++;
    }

    if (req.query.plant_id) {
      query += ` AND pm.plant_id = $${paramIndex} `;
      params.push(parseInt(req.query.plant_id));
      paramIndex++;
    }

    query += ` ORDER BY pm.uploaded_at DESC `;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching global media:', err);
    res.status(500).json({ error: 'Lỗi server khi tải thư viện media.' });
  }
});

router.get('/:id(\\d+)', auth, async (req, res) => {
  try {
    const plant = await pool.query(
      `SELECT p.*, ps.name as schema_name, ps.fields as schema_fields, 
              f.name as farm_name, f.user_id as farm_owner_id, 
              u.full_name as owner_name, u.phone as owner_phone
       FROM plants p 
       LEFT JOIN plant_schemas ps ON ps.id = p.schema_id
       LEFT JOIN farms f ON f.id = p.farm_id
       LEFT JOIN users u ON u.id = f.user_id
       WHERE p.id=$1`, [req.params.id]
    );
    if (plant.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy.' });

    const row = plant.rows[0];
    const isAssigned = (req.user.farm_id && row.farm_id && req.user.farm_id === row.farm_id)
      || (row.assigned_to_user_id && row.assigned_to_user_id === req.user.id)
      || (row.created_by && row.created_by === req.user.id);
    if (req.user.role !== 'admin' && row.farm_owner_id !== req.user.id && !isAssigned) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập thông tin cây này.' });
    }

    const media = await pool.query('SELECT * FROM plant_media WHERE plant_id=$1 ORDER BY uploaded_at DESC', [req.params.id]);
    const logs = await pool.query(
      `SELECT pl.*, u.full_name as creator_name, u.phone as creator_phone, u.email as creator_email 
       FROM plant_logs pl 
       LEFT JOIN users u ON u.id = pl.created_by 
       WHERE pl.plant_id=$1 AND (pl.is_deleted IS NOT TRUE)
       ORDER BY pl.log_date DESC, pl.created_at DESC`, [req.params.id]
    );

    res.json({ ...row, media: media.rows, logs: logs.rows });
  } catch (err) {
    console.error('Get plant details error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});


router.get('/:id(\\d+)/logs', auth, async (req, res) => {
  try {
    const plant = await pool.query(
      `SELECT p.id, p.created_by, p.assigned_to_user_id, f.user_id as farm_owner_id, p.farm_id
       FROM plants p 
       LEFT JOIN farms f ON f.id = p.farm_id
       WHERE p.id=$1`, [req.params.id]
    );
    if (plant.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy.' });

    const row = plant.rows[0];
    const isAssignedFarmer = (req.user.farm_id && row.farm_id && req.user.farm_id === row.farm_id)
      || (row.assigned_to_user_id && row.assigned_to_user_id === req.user.id)
      || (row.created_by && row.created_by === req.user.id);
    if (req.user.role !== 'admin' && row.farm_owner_id !== req.user.id && !isAssignedFarmer) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập thông tin cây này.' });
    }


    let logsQuery = 'SELECT pl.*, u.full_name as creator_name, u.phone as creator_phone, u.email as creator_email FROM plant_logs pl LEFT JOIN users u ON u.id = pl.created_by WHERE pl.plant_id = $1 AND (pl.is_deleted IS NOT TRUE)';
    const logsParams = [req.params.id];
    let idx = 2;

    if (req.user.role !== 'admin' && row.farm_owner_id !== req.user.id) {
      const farmRes = await pool.query('SELECT allow_shared_history FROM farms WHERE id=$1', [row.farm_id]);
      const farmAllowShared = farmRes.rows.length > 0 && farmRes.rows[0].allow_shared_history !== false;
      const userAllowShared = req.user.allow_shared_history !== false;

      if (!farmAllowShared || !userAllowShared) {
        logsQuery += ` AND pl.created_by = $${idx}`;
        logsParams.push(req.user.id);
        idx++;
      }

      if (req.user.view_history_from_date) {
        logsQuery += ` AND pl.log_date >= $${idx}`;
        logsParams.push(req.user.view_history_from_date);
        idx++;
      }
    }

    logsQuery += ' ORDER BY pl.log_date DESC, pl.id DESC';
    const logsRes = await pool.query(logsQuery, logsParams);

    // Truy vấn các khoản tiêu hao vật tư liên kết với cây này từ supply_usages
    let usagesRows = [];
    try {
      const usagesRes = await pool.query(
        `SELECT su.*, s.name as supply_name, s.category as supply_category, s.unit as supply_unit
         FROM supply_usages su
         JOIN supplies s ON su.supply_id = s.id
         WHERE su.plant_id = $1
         ORDER BY su.usage_date DESC, su.id DESC`,
        [req.params.id]
      );
      usagesRows = usagesRes.rows;
    } catch (_) {
      usagesRows = [];
    }

    // Đối soát chi phí và tên vật tư vào từng log nếu log chưa có cost
    const enrichedLogs = logsRes.rows.map(log => {
      let d = log.details || {};
      if (typeof d === 'string') {
        try { d = JSON.parse(d); } catch(_) { d = {}; }
      }

      if (!d.total_cost || parseFloat(d.total_cost) === 0) {
        const matched = usagesRows.find(u => 
          (d.supply_id && u.supply_id == d.supply_id) ||
          (u.usage_date === log.log_date && (u.note || '').includes(log.log_type))
        );
        if (matched) {
          d.total_cost = parseFloat(matched.total_cost) || 0;
          d.material_name = d.material_name || matched.supply_name;
          d.supply_name = d.supply_name || matched.supply_name;
          d.unit_price = d.unit_price || parseFloat(matched.unit_price) || 0;
        }
      }

      const costVal = parseFloat(d.total_cost || log.cost || 0) || 0;
      const matName = d.material_name || d.supply_name || d.fertilizer_name || d.pesticide_name || null;

      return {
        ...log,
        details: d,
        cost: costVal,
        material_name: matName
      };
    });

    res.json(enrichedLogs);
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});



router.post('/batch', auth, admin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { farm_id, plant_type, plant_variety, plant_age, health_status, schema_id, is_public, items } = req.body;
    if (!plant_type) {
      return res.status(400).json({ error: 'Loại cây là bắt buộc.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Danh sách cây import trống.' });
    }

    await client.query('BEGIN');
    const inserted = [];

    for (const item of items) {
      const stt = item.stt || '';
      const slug = stt ? `${req.user.id}_${farm_id || 0}_${stt}` : generateSlug(plant_type);
      const lat = parseFloat(item.n || item.latitude);
      const lng = parseFloat(item.e || item.longitude);
      const location = farm_id ? `Lô nhập CSV - STT ${stt}` : `Nhập CSV - STT ${stt}`;

      const resDb = await client.query(
        `INSERT INTO plants (public_slug, schema_id, plant_type, plant_variety, plant_age, health_status, location, data, is_public, farm_id, latitude, longitude, created_by, tree_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (public_slug) DO UPDATE 
         SET schema_id = EXCLUDED.schema_id,
             plant_type = EXCLUDED.plant_type,
             plant_variety = EXCLUDED.plant_variety,
             plant_age = EXCLUDED.plant_age,
             health_status = EXCLUDED.health_status,
             location = EXCLUDED.location,
             is_public = EXCLUDED.is_public,
             farm_id = EXCLUDED.farm_id,
             latitude = EXCLUDED.latitude,
             longitude = EXCLUDED.longitude,
             created_by = EXCLUDED.created_by,
             tree_code = EXCLUDED.tree_code,
             updated_at = NOW()
         RETURNING id`,
        [slug, schema_id || null, plant_type, plant_variety || '', plant_age || '', health_status || 'Tốt',
         location, JSON.stringify({}), is_public !== false, farm_id || null, lat, lng, req.user.id, stt]
      );
      inserted.push(resDb.rows[0].id);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, count: inserted.length, ids: inserted });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Batch import error:', err);
    res.status(500).json({ error: 'Lỗi server khi import lô cây: ' + err.message });
  } finally {
    client.release();
  }
});

// POST /api/plants/batch-range — Import sequential range of trees XX -> XY with identical or matrix-customized attributes
router.post('/batch-range', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { 
      items, // Matrix of trees: [{ tree_code, location, latitude, longitude, planting_date, plant_age, health_status, plant_type, plant_variety }]
      tree_codes, 
      start_num, 
      end_num, 
      prefix, 
      pad_zeros,
      plant_type, 
      plant_variety, 
      planting_date,
      plant_age, 
      health_status, 
      location, 
      data, 
      is_public, 
      farm_id, 
      latitude, 
      longitude, 
      schema_id 
    } = req.body;

    if (req.user.role !== 'admin') {
      if (!farm_id) {
        return res.status(400).json({ error: 'Vui lòng chọn trang trại để tạo cây trồng.' });
      }
      const farmCheck = await client.query('SELECT id, user_id FROM farms WHERE id = $1', [farm_id]);
      if (farmCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Trang trại không tồn tại.' });
      }
      const f = farmCheck.rows[0];
      const isOwner = Number(f.user_id) === Number(req.user.id);
      const isMember = req.user.farm_id && Number(req.user.farm_id) === Number(farm_id);
      if (!isOwner && !isMember) {
        return res.status(403).json({ error: 'Bạn không có quyền thêm cây vào trang trại này.' });
      }
    }

    if (!plant_type || !plant_type.trim()) {
      return res.status(400).json({ error: 'Loại cây là bắt buộc.' });
    }

    // Build list of tree objects to insert
    let treesToInsert = [];

    if (Array.isArray(items) && items.length > 0) {
      // Direct Data Matrix mode
      treesToInsert = items.map((it, idx) => {
        const code = String(it.tree_code || it.code || `Tree-${idx + 1}`).trim();
        const pLat = it.latitude !== undefined && it.latitude !== '' && !isNaN(parseFloat(it.latitude)) ? parseFloat(it.latitude) : (latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null);
        const pLng = it.longitude !== undefined && it.longitude !== '' && !isNaN(parseFloat(it.longitude)) ? parseFloat(it.longitude) : (longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null);
        const pLoc = (it.location !== undefined ? it.location : location || '').trim();
        const pPlot = (it.plot_code !== undefined ? it.plot_code : '').trim();
        const pRow = it.row_number !== undefined && it.row_number !== null && !isNaN(parseInt(it.row_number, 10)) ? parseInt(it.row_number, 10) : null;
        const pDate = it.planting_date || planting_date || null;
        const pAge = (it.plant_age !== undefined ? it.plant_age : plant_age || '').trim();
        const pHealth = it.health_status || health_status || 'Tốt';
        const pType = (it.plant_type || plant_type).trim();
        const pVariety = (it.plant_variety !== undefined ? it.plant_variety : plant_variety || '').trim();
        const pYield = it.initial_yield !== undefined ? it.initial_yield : (req.body.initial_yield || (data && data.initial_yield) || '');
        const pDiseases = it.past_diseases !== undefined ? it.past_diseases : (req.body.past_diseases || (data && data.past_diseases) || []);
        return {
          code,
          location: pLoc,
          plot_code: pPlot,
          row_number: pRow,
          latitude: pLat,
          longitude: pLng,
          planting_date: pDate,
          plant_age: pAge,
          health_status: pHealth,
          plant_type: pType,
          plant_variety: pVariety,
          initial_yield: pYield,
          past_diseases: pDiseases
        };
      }).filter(t => t.code);
    } else if (Array.isArray(tree_codes) && tree_codes.length > 0) {
      const bYield = req.body.initial_yield || (data && data.initial_yield) || '';
      const bDiseases = req.body.past_diseases || (data && data.past_diseases) || [];
      treesToInsert = tree_codes.map(c => String(c).trim()).filter(Boolean).map(code => ({
        code,
        location: (location || '').trim(),
        latitude: latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null,
        longitude: longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null,
        planting_date: planting_date || null,
        plant_age: (plant_age || '').trim(),
        health_status: health_status || 'Tốt',
        plant_type: plant_type.trim(),
        plant_variety: (plant_variety || '').trim(),
        initial_yield: bYield,
        past_diseases: bDiseases
      }));
    } else if (start_num !== undefined && end_num !== undefined) {
      const s = parseInt(start_num, 10);
      const e = parseInt(end_num, 10);
      if (isNaN(s) || isNaN(e) || s > e) {
        return res.status(400).json({ error: 'Dải số thứ tự không hợp lệ (số bắt đầu phải nhỏ hơn hoặc bằng số kết thúc).' });
      }
      if (e - s + 1 > 500) {
        return res.status(400).json({ error: 'Mỗi lần tạo hàng loạt tối đa 500 cây.' });
      }
      const pre = prefix || '';
      const padLen = pad_zeros ? Math.max(String(start_num).length, String(end_num).length) : 0;
      const bYield = req.body.initial_yield || (data && data.initial_yield) || '';
      const bDiseases = req.body.past_diseases || (data && data.past_diseases) || [];
      for (let i = s; i <= e; i++) {
        const numStr = padLen > 1 ? String(i).padStart(padLen, '0') : String(i);
        treesToInsert.push({
          code: `${pre}${numStr}`,
          location: (location || '').trim(),
          latitude: latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null,
          longitude: longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null,
          planting_date: planting_date || null,
          plant_age: (plant_age || '').trim(),
          health_status: health_status || 'Tốt',
          plant_type: plant_type.trim(),
          plant_variety: (plant_variety || '').trim(),
          initial_yield: bYield,
          past_diseases: bDiseases
        });
      }
    }

    if (treesToInsert.length === 0) {
      return res.status(400).json({ error: 'Danh sách mã cây cần tạo trống.' });
    }

    if (treesToInsert.length > 500) {
      return res.status(400).json({ error: 'Mỗi lần tạo hàng loạt tối đa 500 cây.' });
    }

    await client.query('BEGIN');
    const insertedIds = [];

    for (const tree of treesToInsert) {
      const slug = `${farm_id || 0}_${tree.code}`;

      // Extract plot_code and row_number
      let plotCode = tree.plot_code || null;
      let rowNum = tree.row_number !== undefined && tree.row_number !== null ? parseInt(tree.row_number, 10) : null;
      if (!plotCode && tree.location) {
        const parts = tree.location.split(',');
        if (parts[0]) {
          plotCode = parts[0].trim();
          if (!/^lô\s+/i.test(plotCode) && /^[a-zA-Z0-9\-_]+$/.test(plotCode)) {
            plotCode = 'Lô ' + plotCode;
          }
        }
        if (parts[1] && /hàng\s*(\d+)/i.test(parts[1])) {
          const match = parts[1].match(/hàng\s*(\d+)/i);
          if (match) rowNum = parseInt(match[1], 10);
        }
      }

      if (farm_id && plotCode) {
        try {
          const existingPlot = await pool.query(
            'SELECT id FROM farm_plots WHERE farm_id = $1 AND UPPER(plot_code) = UPPER($2) LIMIT 1',
            [farm_id, plotCode]
          );
          if (existingPlot.rows.length === 0) {
            await pool.query(
              'INSERT INTO farm_plots (farm_id, plot_code, plot_name) VALUES ($1, $2, $3)',
              [farm_id, plotCode, `Lô ${plotCode}`]
            );
          }
        } catch (_) {}
      }

      const itemData = {
        ...(data || {}),
        ...(tree.initial_yield ? { initial_yield: tree.initial_yield } : {}),
        ...(tree.past_diseases && tree.past_diseases.length ? { past_diseases: tree.past_diseases } : {})
      };

      const resDb = await client.query(
        `INSERT INTO plants (public_slug, schema_id, plant_type, plant_variety, planting_date, plant_age, health_status, location, plot_code, row_number, data, is_public, farm_id, latitude, longitude, created_by, tree_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (public_slug) DO UPDATE 
         SET schema_id = EXCLUDED.schema_id,
             plant_type = EXCLUDED.plant_type,
             plant_variety = EXCLUDED.plant_variety,
             planting_date = EXCLUDED.planting_date,
             plant_age = EXCLUDED.plant_age,
             health_status = EXCLUDED.health_status,
             location = EXCLUDED.location,
             plot_code = EXCLUDED.plot_code,
             row_number = EXCLUDED.row_number,
             data = EXCLUDED.data,
             is_public = EXCLUDED.is_public,
             farm_id = EXCLUDED.farm_id,
             latitude = EXCLUDED.latitude,
             longitude = EXCLUDED.longitude,
             created_by = EXCLUDED.created_by,
             tree_code = EXCLUDED.tree_code,
             updated_at = NOW()
         RETURNING id`,
        [slug, schema_id || null, tree.plant_type, tree.plant_variety, tree.planting_date || null, tree.plant_age, tree.health_status,
         tree.location, plotCode, rowNum, JSON.stringify(itemData), is_public !== false, farm_id || null, tree.latitude, tree.longitude, req.user.id, tree.code]
      );

      const newId = resDb.rows[0].id;
      insertedIds.push(newId);

      const pubUrl = generatePublicPlantUrl(farm_id || null, newId, null);
      await client.query('UPDATE plants SET public_url = $1 WHERE id = $2', [pubUrl, newId]);
    }

    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated');

    res.status(201).json({
      success: true,
      count: insertedIds.length,
      inserted_ids: insertedIds,
      items: treesToInsert.map((t, idx) => ({ id: insertedIds[idx], code: t.code })),
      first_code: treesToInsert[0].code,
      last_code: treesToInsert[treesToInsert.length - 1].code,
      message: `Đã tạo thành công ${insertedIds.length} cây từ ${treesToInsert[0].code} đến ${treesToInsert[treesToInsert.length - 1].code}!`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Batch range creation error:', err);
    res.status(500).json({ error: 'Lỗi server khi tạo dải cây hàng loạt: ' + err.message });
  } finally {
    client.release();
  }
});

// GET /api/plants/farms/:farmId/plots - Get plots for a farm
router.get('/farms/:farmId/plots', auth, async (req, res) => {
  try {
    const farmId = parseInt(req.params.farmId, 10);
    if (isNaN(farmId)) return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });
    const result = await pool.query(
      'SELECT id, farm_id, plot_code, plot_name, description, created_at FROM farm_plots WHERE farm_id = $1 ORDER BY plot_code ASC',
      [farmId]
    );
    res.json({ success: true, plots: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server khi tải danh sách lô: ' + err.message });
  }
});

// GET /api/plants/farms/:farmId/tags & alias /api/nfc/farm/:farmId/tags
router.get(['/farms/:farmId/tags', '/farm/:farmId/tags', '/nfc/farm/:farmId/tags'], auth, async (req, res) => {
  try {
    const farmId = parseInt(req.params.farmId, 10);
    if (isNaN(farmId)) return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });
    const items = await pool.query(
      `SELECT n.*, p.tree_code, p.plant_type, p.plant_variety, p.health_status, p.location, p.latitude, p.longitude, p.public_url, p.data as plant_data
       FROM nfc_tags_inventory n
       LEFT JOIN plants p ON n.plant_id = p.id
       WHERE n.farm_id = $1
       ORDER BY n.id DESC`,
      [farmId]
    );
    res.json({ success: true, tags: items.rows, items: items.rows });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server khi tải danh sách thẻ NFC: ' + err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { schema_id, plant_type, plant_variety, planting_date, plant_age, health_status, location, plot_code, row_number, data, is_public, farm_id, latitude, longitude, tree_code, nfc_uid, initial_yield, past_diseases } = req.body;
    
    if (req.user.role !== 'admin') {
      if (!farm_id) {
        return res.status(400).json({ error: 'Vui lòng chọn trang trại để tạo cây trồng.' });
      }
      const farmCheck = await pool.query('SELECT id, user_id FROM farms WHERE id = $1', [farm_id]);
      if (farmCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Trang trại không tồn tại.' });
      }
      const f = farmCheck.rows[0];
      const isOwner = Number(f.user_id) === Number(req.user.id);
      const isMember = req.user.farm_id && Number(req.user.farm_id) === Number(farm_id);
      if (!isOwner && !isMember) {
        return res.status(403).json({ error: 'Bạn không có quyền thêm cây vào trang trại này.' });
      }
    }

    let finalTreeCode = tree_code && tree_code.trim() ? tree_code.trim() : null;
    if (!finalTreeCode) {
      const year = new Date().getFullYear();
      const farmCode = farm_id ? `TT${String(farm_id).padStart(2, '0')}` : 'TT00';
      const countRes = await pool.query('SELECT COUNT(*)::int as count FROM plants WHERE farm_id IS NOT DISTINCT FROM $1', [farm_id || null]);
      const stt = String((countRes.rows[0].count || 0) + 1).padStart(3, '0');
      finalTreeCode = `${farmCode}-${year}-${stt}`;
    }

    const slug = finalTreeCode ? `${farm_id || 0}_${finalTreeCode}` : generateSlug(plant_type);
    const cleanNfcUid = (nfc_uid && typeof nfc_uid === 'string') ? nfc_uid.trim().toUpperCase() : null;

    let finalPlotCode = plot_code || null;
    let finalRowNum = row_number !== undefined && row_number !== null ? parseInt(row_number, 10) : null;
    if (!finalPlotCode && location) {
      const parts = location.split(',');
      if (parts[0]) {
        finalPlotCode = parts[0].trim();
        if (!/^lô\s+/i.test(finalPlotCode) && /^[a-zA-Z0-9\-_]+$/.test(finalPlotCode)) {
          finalPlotCode = 'Lô ' + finalPlotCode;
        }
      }
      if (parts[1] && /hàng\s*(\d+)/i.test(parts[1])) {
        const match = parts[1].match(/hàng\s*(\d+)/i);
        if (match) finalRowNum = parseInt(match[1], 10);
      }
    }

    if (farm_id && finalPlotCode) {
      try {
        await pool.query(
          `INSERT INTO farm_plots (farm_id, plot_code, plot_name)
           VALUES ($1, $2, $2)
           ON CONFLICT (farm_id, plot_code) DO NOTHING`,
          [farm_id, finalPlotCode]
        );
      } catch (_) {}
    }

    const plantData = {
      ...(data || {}),
      ...(initial_yield ? { initial_yield } : {}),
      ...(past_diseases && (Array.isArray(past_diseases) ? past_diseases.length : past_diseases) ? { past_diseases } : {})
    };

    const result = await pool.query(
      `INSERT INTO plants (public_slug, schema_id, plant_type, plant_variety, planting_date, plant_age, health_status, location, plot_code, row_number, data, is_public, farm_id, latitude, longitude, created_by, tree_code, nfc_uid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (public_slug) DO UPDATE 
       SET schema_id = EXCLUDED.schema_id,
           plant_type = EXCLUDED.plant_type,
           plant_variety = EXCLUDED.plant_variety,
           planting_date = EXCLUDED.planting_date,
           plant_age = EXCLUDED.plant_age,
           health_status = EXCLUDED.health_status,
           location = EXCLUDED.location,
           plot_code = EXCLUDED.plot_code,
           row_number = EXCLUDED.row_number,
           data = EXCLUDED.data,
           is_public = EXCLUDED.is_public,
           farm_id = EXCLUDED.farm_id,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           created_by = EXCLUDED.created_by,
           tree_code = EXCLUDED.tree_code,
           nfc_uid = COALESCE(EXCLUDED.nfc_uid, plants.nfc_uid),
           updated_at = NOW()
       RETURNING *`,
      [slug, schema_id || null, plant_type, plant_variety || '', planting_date || null, plant_age || '', health_status || 'Tốt',
       location, finalPlotCode, finalRowNum, JSON.stringify(plantData), is_public !== false, farm_id || null, 
       latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null,
       longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null,
       req.user.id, finalTreeCode, cleanNfcUid]
    );

    const insertedPlant = result.rows[0];
    const publicUrl = generatePublicPlantUrl(insertedPlant.farm_id, insertedPlant.id, insertedPlant.nfc_uid);
    await pool.query('UPDATE plants SET public_url = $1 WHERE id = $2', [publicUrl, insertedPlant.id]);
    insertedPlant.public_url = publicUrl;

    if (cleanNfcUid) {
      try {
        await pool.query(
          `INSERT INTO nfc_tags_inventory (nfc_uid, farm_id, plant_id, status, assigned_at)
           VALUES ($1, $2, $3, 'assigned', NOW())
           ON CONFLICT (nfc_uid) DO UPDATE
           SET farm_id = EXCLUDED.farm_id, plant_id = EXCLUDED.plant_id, status = 'assigned', assigned_at = NOW()`,
          [cleanNfcUid, insertedPlant.farm_id, insertedPlant.id]
        );
      } catch (nfcErr) {
        console.warn('Auto-assigning NFC tag inventory warning:', nfcErr.message);
      }
    }

    // Ghi nhận Audit Log
    await logAudit({
      actionType: 'CREATE_PLANT',
      tableName: 'plants',
      recordId: insertedPlant.id,
      userId: req.user.id,
      newData: insertedPlant,
      ipAddress: req.ip,
      notes: `Tạo mới cây #${insertedPlant.tree_code || insertedPlant.id}`
    });

    // Invalidate Cache & Broadcast WebSocket event
    await invalidateAndBroadcast('plants_updated', {
      plant_id: insertedPlant.id,
      farm_id: insertedPlant.farm_id,
      action: 'create'
    }, ['farms_', 'plants_']);

    res.status(201).json(insertedPlant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.put('/:id', auth, admin, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id, 10);
    const existingRes = await pool.query('SELECT * FROM plants WHERE id=$1', [plantId]);
    if (existingRes.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy.' });
    const oldPlant = existingRes.rows[0];

    const { plant_type, plant_variety, planting_date, plant_age, health_status, location, data, is_public, schema_id, farm_id, latitude, longitude, tree_code } = req.body;
    const slug = tree_code ? `${req.user.id}_${farm_id || 0}_${tree_code}` : generateSlug(plant_type);

    const result = await pool.query(
      `UPDATE plants 
       SET plant_type=$1, plant_variety=$2, planting_date=$3, plant_age=$4, health_status=$5, location=$6, 
           data=$7, is_public=$8, schema_id=$9, farm_id=$10, latitude=$11, longitude=$12, tree_code=$13, 
           public_slug=$14, updated_at=NOW()
       WHERE id=$15 RETURNING *`,
      [plant_type, plant_variety, planting_date || null, plant_age, health_status, location,
       JSON.stringify(data || {}), is_public !== false, schema_id || null, farm_id || null,
       latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null,
       longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null,
       tree_code || null,
       slug,
       plantId]
    );

    const updatedPlant = result.rows[0];
    const publicUrl = generatePublicPlantUrl(updatedPlant.farm_id, updatedPlant.id, updatedPlant.nfc_uid);
    await pool.query('UPDATE plants SET public_url = $1 WHERE id = $2', [publicUrl, updatedPlant.id]);
    updatedPlant.public_url = publicUrl;

    // Ghi nhận Audit Log
    await logAudit({
      actionType: 'UPDATE_PLANT',
      tableName: 'plants',
      recordId: plantId,
      userId: req.user.id,
      oldData: oldPlant,
      newData: updatedPlant,
      ipAddress: req.ip,
      notes: `Cập nhật thông tin cây #${updatedPlant.tree_code || plantId}`
    });

    // Invalidate Cache & Broadcast WebSocket event
    await invalidateAndBroadcast('plants_updated', {
      plant_id: updatedPlant.id,
      farm_id: updatedPlant.farm_id,
      action: 'update'
    }, ['farms_', 'plants_']);

    res.json(updatedPlant);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// ─── Direct Plant GPS Update (accessible by farm owner, assigned user or admin) ───
router.put('/:id/gps', auth, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);
    const { latitude, longitude, location } = req.body;

    const plantRes = await pool.query(
      `SELECT p.id, p.farm_id, p.tree_code, p.created_by, p.assigned_to_user_id, f.user_id as farm_owner_id
       FROM plants p
       LEFT JOIN farms f ON f.id = p.farm_id
       WHERE p.id = $1`, [plantId]
    );
    if (plantRes.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy cây trồng.' });

    const plant = plantRes.rows[0];
    const isAssigned = (req.user.farm_id && plant.farm_id && req.user.farm_id === plant.farm_id)
      || (plant.assigned_to_user_id && plant.assigned_to_user_id === req.user.id)
      || (plant.created_by && plant.created_by === req.user.id);
    if (req.user.role !== 'admin' && plant.farm_owner_id !== req.user.id && !isAssigned) {
      return res.status(403).json({ error: 'Bạn không có quyền cập nhật tọa độ cây này.' });
    }

    const latVal = (latitude !== undefined && latitude !== null && latitude !== '') ? parseFloat(latitude) : null;
    const lngVal = (longitude !== undefined && longitude !== null && longitude !== '') ? parseFloat(longitude) : null;

    let updateQuery;
    let updateParams;
    if (location !== undefined) {
      const locVal = (location !== null && location !== '') ? String(location).trim() : null;
      updateQuery = `UPDATE plants 
                     SET latitude = $1, longitude = $2, location = $3, updated_at = NOW()
                     WHERE id = $4
                     RETURNING id, tree_code, public_slug, nfc_uid, public_url, farm_id, latitude, longitude, location`;
      updateParams = [latVal, lngVal, locVal, plantId];
    } else {
      updateQuery = `UPDATE plants 
                     SET latitude = $1, longitude = $2, updated_at = NOW()
                     WHERE id = $3
                     RETURNING id, tree_code, public_slug, nfc_uid, public_url, farm_id, latitude, longitude, location`;
      updateParams = [latVal, lngVal, plantId];
    }

    const updated = await pool.query(updateQuery, updateParams);

    // Invalidate Cache & Broadcast WebSocket event
    await invalidateAndBroadcast('plants_updated', {
      plant_id: plantId,
      farm_id: updated.rows[0].farm_id || plant.farm_id,
      action: 'gps_updated'
    }, ['farms_', 'plants_']);

    let msg = 'Đã cập nhật vị trí cho cây thành công.';
    if (latVal !== null && lngVal !== null) {
      msg = `Đã lưu tọa độ GPS (${latVal.toFixed(6)}, ${lngVal.toFixed(6)}) cho cây #${plant.tree_code || plantId}`;
    } else if (location !== undefined && location) {
      msg = `Đã lưu vị trí "${location}" cho cây #${plant.tree_code || plantId}`;
    } else if (latVal === null && lngVal === null) {
      msg = `Đã xóa tọa độ GPS của cây #${plant.tree_code || plantId}`;
    }

    res.json({
      success: true,
      plant: updated.rows[0],
      message: msg
    });
  } catch (err) {
    console.error('GPS update error:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật GPS: ' + err.message });
  }
});

// ─── Reorder Tree Codes Automatically by GPS Coordinates ────────────────────
router.post('/farms/:farmId/reorder-by-gps', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const farmId = parseInt(req.params.farmId);
    if (isNaN(farmId)) {
      return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });
    }

    // Verify ownership / access
    const farmRes = await client.query('SELECT id, name, user_id FROM farms WHERE id = $1', [farmId]);
    if (farmRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }
    const farm = farmRes.rows[0];
    const isOwner = farm.user_id === req.user.id;
    const isAssigned = req.user.farm_id && Number(req.user.farm_id) === farmId;
    if (req.user.role !== 'admin' && !isOwner && !isAssigned) {
      return res.status(403).json({ error: 'Bạn không có quyền sắp xếp lại mã cây của trang trại này.' });
    }

    const {
      order_mode = 'north_to_south', // 'north_to_south' | 'by_columns' | 'snake' | 'by_rows'
      prefix = '',
      start_number = 1,
      pad_digits = 0, // 0 = no pad (1..75), 2 = (01..75), 3 = (001..075)
      dry_run = false
    } = req.body;

    const plantsRes = await client.query(
      `SELECT id, farm_id, tree_code, nfc_uid, public_slug, latitude, longitude, location, plant_type, created_by 
       FROM plants 
       WHERE farm_id = $1
       ORDER BY id ASC`,
      [farmId]
    );

    const allPlants = plantsRes.rows;
    if (allPlants.length === 0) {
      return res.status(400).json({ error: 'Trang trại này chưa có cây trồng nào.' });
    }

    // Split plants with GPS vs without GPS
    const gpsPlants = allPlants.filter(p => p.latitude != null && p.longitude != null && !isNaN(parseFloat(p.latitude)) && !isNaN(parseFloat(p.longitude)));
    const noGpsPlants = allPlants.filter(p => p.latitude == null || p.longitude == null || isNaN(parseFloat(p.latitude)) || isNaN(parseFloat(p.longitude)));

    if (gpsPlants.length === 0) {
      return res.status(400).json({ error: 'Chưa có cây nào được định vị GPS để có thể sắp xếp theo không gian địa lý.' });
    }

    // Calculate center & principal orientation angle (PCA)
    const N = gpsPlants.length;
    let meanLat = 0, meanLng = 0;
    gpsPlants.forEach(p => {
      meanLat += parseFloat(p.latitude);
      meanLng += parseFloat(p.longitude);
    });
    meanLat /= N;
    meanLng /= N;

    let cxx = 0, cyy = 0, cxy = 0;
    gpsPlants.forEach(p => {
      const dy = parseFloat(p.latitude) - meanLat;
      const dx = (parseFloat(p.longitude) - meanLng) * Math.cos(meanLat * Math.PI / 180);
      cxx += dx * dx;
      cyy += dy * dy;
      cxy += dx * dy;
    });

    // Principal angle theta
    let theta = 0.5 * Math.atan2(2 * cxy, cyy - cxx);

    // Project coordinates onto Length axis (u) and Width axis (v)
    gpsPlants.forEach(p => {
      const dy = parseFloat(p.latitude) - meanLat;
      const dx = (parseFloat(p.longitude) - meanLng) * Math.cos(meanLat * Math.PI / 180);
      
      const u = dy * Math.cos(theta) + dx * Math.sin(theta);
      const v = -dy * Math.sin(theta) + dx * Math.cos(theta);

      p._rawLat = parseFloat(p.latitude);
      p._rawLng = parseFloat(p.longitude);
      p._u = u;
      p._v = v;
    });

    // Determine orientation so u is aligned with North to South (highest = North/Top)
    let latCorr = 0;
    gpsPlants.forEach(p => {
      latCorr += p._u * (p._rawLat - meanLat);
    });
    if (latCorr < 0) {
      gpsPlants.forEach(p => { p._u = -p._u; });
    }

    // Determine orientation so v is aligned with West to East (lowest = West/Left)
    let lngCorr = 0;
    gpsPlants.forEach(p => {
      lngCorr += p._v * (p._rawLng - meanLng);
    });
    if (lngCorr < 0) {
      gpsPlants.forEach(p => { p._v = -p._v; });
    }

    // Sort according to order_mode:
    if (order_mode === 'by_columns') {
      const vVals = gpsPlants.map(p => p._v).sort((a,b) => a - b);
      const minV = vVals[0];
      const maxV = vVals[vVals.length - 1];
      const vRange = maxV - minV;

      gpsPlants.sort((a, b) => {
        const colA = a._v;
        const colB = b._v;
        if (Math.abs(colA - colB) > (vRange > 0 ? vRange * 0.25 : 0.00005)) {
          return colA - colB; // Left column first, then Right column
        }
        return b._u - a._u; // North to South within same column
      });
    } else if (order_mode === 'snake') {
      const uVals = gpsPlants.map(p => p._u).sort((a,b) => b - a);
      const uRange = uVals[0] - uVals[uVals.length - 1];
      const rowStep = uRange > 0 ? (uRange / (N > 10 ? Math.min(Math.floor(N / 2), 40) : N)) : 0.0001;

      const rows = [];
      const sortedByU = [...gpsPlants].sort((a, b) => b._u - a._u);
      sortedByU.forEach(p => {
        let placed = false;
        for (const r of rows) {
          if (Math.abs(r.meanU - p._u) <= rowStep * 0.8) {
            r.plants.push(p);
            r.meanU = r.plants.reduce((sum, item) => sum + item._u, 0) / r.plants.length;
            placed = true;
            break;
          }
        }
        if (!placed) {
          rows.push({ meanU: p._u, plants: [p] });
        }
      });

      rows.sort((a, b) => b.meanU - a.meanU);

      const snakeSorted = [];
      rows.forEach((r, idx) => {
        if (idx % 2 === 0) {
          r.plants.sort((a, b) => a._v - b._v); // Left to Right
        } else {
          r.plants.sort((a, b) => b._v - a._v); // Right to Left
        }
        snakeSorted.push(...r.plants);
      });
      gpsPlants.length = 0;
      gpsPlants.push(...snakeSorted);
    } else {
      // Default: 'north_to_south' (Top to Bottom, Left to Right within row pairs)
      const uVals = gpsPlants.map(p => p._u).sort((a,b) => b - a);
      const uRange = (uVals[0] || 0) - (uVals[uVals.length - 1] || 0);
      const rowBand = uRange > 0 ? (uRange / (N > 4 ? Math.max(Math.floor(N / 2.2), 1) : N)) * 0.7 : 0.00003;

      gpsPlants.sort((a, b) => {
        if (Math.abs(a._u - b._u) < rowBand) {
          return a._v - b._v; // Left before Right
        }
        return b._u - a._u; // North (Top) before South (Bottom)
      });
    }

    // Numbering generator
    const formatNumber = (num) => {
      const s = String(num);
      if (pad_digits > 0) {
        return s.padStart(pad_digits, '0');
      }
      return s;
    };

    const reorderedList = [];
    let currentNum = parseInt(start_number) || 1;

    for (const plant of gpsPlants) {
      const newCode = `${prefix}${formatNumber(currentNum)}`;
      reorderedList.push({
        id: plant.id,
        old_tree_code: plant.tree_code || String(plant.id),
        new_tree_code: newCode,
        nfc_uid: plant.nfc_uid,
        latitude: plant.latitude,
        longitude: plant.longitude,
        location: plant.location
      });
      currentNum++;
    }

    // If dry_run, return preview without modifying DB
    if (dry_run) {
      return res.json({
        success: true,
        dry_run: true,
        farm_id: farmId,
        farm_name: farm.name,
        total_plants: allPlants.length,
        reordered_count: reorderedList.length,
        no_gps_count: noGpsPlants.length,
        reordered_list: reorderedList
      });
    }

    // Execute batch update in transaction
    await client.query('BEGIN');

    for (const item of reorderedList) {
      const publicUrl = generatePublicPlantUrl(farmId, item.id, item.nfc_uid);
      await client.query(
        `UPDATE plants 
         SET tree_code = $1, public_url = $2, updated_at = NOW() 
         WHERE id = $3`,
        [item.new_tree_code, publicUrl, item.id]
      );
    }

    await client.query('COMMIT');

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('plants_updated', { farm_id: farmId, action: 'reorder_gps', count: reorderedList.length });
    }

    res.json({
      success: true,
      farm_id: farmId,
      farm_name: farm.name,
      total_plants: allPlants.length,
      reordered_count: reorderedList.length,
      no_gps_count: noGpsPlants.length,
      message: `✨ Đã sắp xếp lại mã số cho ${reorderedList.length} cây theo tọa độ GPS (${prefix}${formatNumber(start_number)} ➔ ${prefix}${formatNumber(start_number + reorderedList.length - 1)}) thành công!`,
      reordered_list: reorderedList
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Reorder trees by GPS error:', err);
    res.status(500).json({ error: 'Lỗi server khi sắp xếp lại mã cây: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── NFC Tag Assignment (accessible by farm owner or admin) ──────────────────
router.put('/:id/nfc', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const plantId = parseInt(req.params.id);
    const { nfc_uid } = req.body; // string UID or null to deactivate

    // 1. Verify the requesting user owns this plant (or is admin or assigned farmer)
    const plantRes = await client.query(
      `SELECT p.id, p.nfc_uid, p.public_slug, p.tree_code, p.created_by, p.assigned_to_user_id, p.farm_id, f.user_id as farm_owner_id
       FROM plants p
       LEFT JOIN farms f ON f.id = p.farm_id
       WHERE p.id = $1`, [plantId]
    );
    if (plantRes.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy cây trồng.' });

    const plant = plantRes.rows[0];
    const isAssigned = (req.user.farm_id && plant.farm_id && req.user.farm_id === plant.farm_id)
      || (plant.assigned_to_user_id && plant.assigned_to_user_id === req.user.id)
      || (plant.created_by && plant.created_by === req.user.id);
    if (req.user.role !== 'admin' && plant.farm_owner_id !== req.user.id && !isAssigned) {
      return res.status(403).json({ error: 'Bạn không có quyền thay đổi định danh thẻ của cây này.' });
    }

    const cleanUid = nfc_uid ? decodeURIComponent(nfc_uid).trim().toUpperCase() : null;
    const { latitude, longitude } = req.body;

    await client.query('BEGIN');

    // 2. If assigning a new UID:
    if (cleanUid) {
      // 2a. Verify tag exists in pre-declared inventory for this farm
      const invCheck = await client.query(
        `SELECT id, farm_id, status, plant_id FROM nfc_tags_inventory WHERE UPPER(nfc_uid) = UPPER($1) AND (farm_id = $2 OR farm_id IS NULL)`,
        [cleanUid, plant.farm_id]
      );
      if (invCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Mã thẻ ${cleanUid} chưa được khai báo nhập kho cho trang trại này. Vui lòng liên hệ Quản trị viên để nhập kho thẻ trước.`
        });
      }

      // 2b. Check if this UID is already assigned to ANOTHER plant
      const plantConflict = await client.query(
        `SELECT id, tree_code FROM plants WHERE UPPER(nfc_uid) = UPPER($1) AND id != $2`,
        [cleanUid, plantId]
      );
      if (plantConflict.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Mã thẻ ${cleanUid} đã được gắn cho cây #${plantConflict.rows[0].tree_code || plantConflict.rows[0].id}. Mỗi thẻ chỉ gắn cho 1 cây duy nhất.`
        });
      }

      // 2c. If replacing an existing tag on this plant, revoke / unassign old tag in inventory
      if (plant.nfc_uid && plant.nfc_uid.toUpperCase() !== cleanUid) {
        await client.query(
          `UPDATE nfc_tags_inventory SET status = 'unassigned', plant_id = NULL, tagged_at = NULL WHERE farm_id = $1 AND UPPER(nfc_uid) = UPPER($2)`,
          [plant.farm_id, plant.nfc_uid]
        );
      }

      // 2d. Update target plant with new UID, GPS (if provided) & 3-segment public URL
      const publicUrl = generatePublicPlantUrl(plant.farm_id, plantId, cleanUid);
      const latVal = (latitude !== undefined && latitude !== null && latitude !== '') ? parseFloat(latitude) : null;
      const lngVal = (longitude !== undefined && longitude !== null && longitude !== '') ? parseFloat(longitude) : null;

      let updated;
      if (latVal !== null && !isNaN(latVal) && lngVal !== null && !isNaN(lngVal)) {
        updated = await client.query(
          `UPDATE plants 
           SET nfc_uid = $1, public_url = $2, latitude = $3, longitude = $4, updated_at = NOW()
           WHERE id = $5
           RETURNING id, tree_code, public_slug, nfc_uid, public_url, farm_id, latitude, longitude`,
          [cleanUid, publicUrl, latVal, lngVal, plantId]
        );
      } else {
        updated = await client.query(
          `UPDATE plants 
           SET nfc_uid = $1, public_url = $2, updated_at = NOW()
           WHERE id = $3
           RETURNING id, tree_code, public_slug, nfc_uid, public_url, farm_id, latitude, longitude`,
          [cleanUid, publicUrl, plantId]
        );
      }

      // 2e. Update inventory item to assigned with HMAC signature
      const hmacSig = nfcSecurity.generateHmacSignature(cleanUid, plantId);
      await client.query(
        `UPDATE nfc_tags_inventory 
         SET farm_id = $1, status = 'assigned', plant_id = $2, hmac_signature = $3, last_counter = 0, last_scanned_lat = $4, last_scanned_lng = $5, last_scanned_at = NOW(), tagged_at = NOW() 
         WHERE UPPER(nfc_uid) = UPPER($6)`,
        [plant.farm_id, plantId, hmacSig, latVal, lngVal, cleanUid]
      );

      await client.query('COMMIT');

      const broadcast = req.app.get('broadcast');
      if (broadcast) broadcast('plants_updated');

      return res.json({
        success: true,
        plant: updated.rows[0],
        public_url: publicUrl,
        hmac_signature: hmacSig,
        message: `Đã gắn thẻ định danh ${cleanUid} cho cây ${plant.tree_code || plantId}`
      });
    } else {
      // Deactivating / Unassigning tag from this plant
      if (plant.nfc_uid) {
        await client.query(
          `UPDATE nfc_tags_inventory SET status = 'unassigned', plant_id = NULL, tagged_at = NULL WHERE farm_id = $1 AND UPPER(nfc_uid) = UPPER($2)`,
          [plant.farm_id, plant.nfc_uid]
        );
      }

      const publicUrl = generatePublicPlantUrl(plant.farm_id, plantId, null);
      const updated = await client.query(
        `UPDATE plants 
         SET nfc_uid = NULL, latitude = NULL, longitude = NULL, public_url = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, tree_code, public_slug, nfc_uid, public_url, farm_id, latitude, longitude`,
        [publicUrl, plantId]
      );

      await client.query('COMMIT');

      const broadcast = req.app.get('broadcast');
      if (broadcast) broadcast('plants_updated');

      return res.json({
        success: true,
        plant: updated.rows[0],
        public_url: publicUrl,
        message: `Đã hủy kích hoạt thẻ của cây ${plant.tree_code || plantId}`
      });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('NFC assign error:', err);
    if (err.code === '23505') { // unique_violation
      return res.status(409).json({ error: 'Mã thẻ này đã được sử dụng bởi một cây trồng khác.' });
    }
    res.status(500).json({ error: 'Lỗi server khi cập nhật định danh thẻ: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── NTAG213 Security Provisioning & Configuration Endpoint ─────────────────
router.post('/plants/:id/nfc/provision-ntag213', auth, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);
    if (isNaN(plantId)) return res.status(400).json({ error: 'ID cây không hợp lệ.' });

    const plantRes = await pool.query('SELECT id, farm_id, tree_code, nfc_uid, latitude, longitude FROM plants WHERE id = $1', [plantId]);
    if (plantRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy cây trồng.' });
    }
    const plant = plantRes.rows[0];

    const targetUid = req.body.nfc_uid ? req.body.nfc_uid.trim() : plant.nfc_uid;
    if (!targetUid) {
      return res.status(400).json({ error: 'Vui lòng cung cấp mã thẻ NFC (nfc_uid) để tạo cấu hình NTAG213.' });
    }

    const mirrorConfig = nfcSecurity.buildNtag213MirrorConfig({
      farmId: plant.farm_id,
      plantId: plant.id,
      uid: targetUid
    });

    res.json({
      success: true,
      plant: {
        id: plant.id,
        tree_code: plant.tree_code,
        farm_id: plant.farm_id,
        latitude: plant.latitude,
        longitude: plant.longitude
      },
      provisioning: mirrorConfig
    });
  } catch (err) {
    console.error('Provision NTAG213 error:', err);
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
});

// ─── NFC 4-Tier Security & Geofence Scan Verification Endpoint ───────────────
router.post('/plants/nfc/verify-scan', async (req, res) => {
  const client = await pool.connect();
  try {
    const { nfc_uid, plant_id, counter, token, latitude, longitude, user_id } = req.body;
    const cleanUid = nfcSecurity.normalizeNfcUid(nfc_uid);

    if (!cleanUid && !plant_id) {
      return res.status(400).json({
        isValid: false,
        error: 'Vui lòng cung cấp mã thẻ NFC hoặc ID cây trồng để xác thực.'
      });
    }

    // 1. Find the plant
    let plantQuery;
    let plantParams;
    if (cleanUid) {
      plantQuery = `
        SELECT p.*, f.name as farm_name, COALESCE(p.geofence_radius_meters, f.geofence_radius_meters, 8.0) as allowed_radius
        FROM plants p
        LEFT JOIN farms f ON f.id = p.farm_id
        WHERE UPPER(p.nfc_uid) = UPPER($1)
      `;
      plantParams = [cleanUid];
    } else {
      plantQuery = `
        SELECT p.*, f.name as farm_name, COALESCE(p.geofence_radius_meters, f.geofence_radius_meters, 8.0) as allowed_radius
        FROM plants p
        LEFT JOIN farms f ON f.id = p.farm_id
        WHERE p.id = $1
      `;
      plantParams = [parseInt(plant_id)];
    }

    const plantRes = await client.query(plantQuery, plantParams);
    if (plantRes.rows.length === 0) {
      // Check if tag is in inventory but unassigned
      const invTag = cleanUid ? await client.query('SELECT * FROM nfc_tags_inventory WHERE UPPER(nfc_uid) = UPPER($1)', [cleanUid]) : { rows: [] };
      if (invTag.rows.length > 0) {
        return res.status(404).json({
          isValid: false,
          status: 'UNASSIGNED_TAG',
          severity: 'WARNING',
          message: `Thẻ NFC [${cleanUid}] đã nhập kho nhưng chưa được gán cho cây nào.`,
          tag: invTag.rows[0]
        });
      }
      return res.status(404).json({
        isValid: false,
        status: 'TAG_NOT_FOUND',
        severity: 'CRITICAL',
        message: 'Không tìm thấy thông tin cây trồng hoặc thẻ NFC chưa được khai báo.'
      });
    }

    const plant = plantRes.rows[0];

    // 2. Fetch inventory tag info for counter & signature
    const tagRes = await client.query(
      'SELECT * FROM nfc_tags_inventory WHERE UPPER(nfc_uid) = UPPER($1)',
      [cleanUid || plant.nfc_uid]
    );
    const tagInfo = tagRes.rows[0] || {};

    // 3. Run 4-Tier Security Verification
    const verification = nfcSecurity.verifyNtag213Scan({
      uid: cleanUid || plant.nfc_uid,
      plantId: plant.id,
      counter: counter,
      lastCounter: tagInfo.last_counter || 0,
      token: token,
      currentLat: latitude,
      currentLng: longitude,
      plantLat: plant.latitude,
      plantLng: plant.longitude,
      geofenceRadius: plant.allowed_radius || 8.0
    });

    // 4. Record Audit Log in DB
    const scannedLat = latitude !== undefined && latitude !== null ? parseFloat(latitude) : null;
    const scannedLng = longitude !== undefined && longitude !== null ? parseFloat(longitude) : null;
    const plantLat = plant.latitude !== null ? parseFloat(plant.latitude) : null;
    const plantLng = plant.longitude !== null ? parseFloat(plant.longitude) : null;

    await client.query(`
      INSERT INTO nfc_security_audit_logs (
        farm_id, plant_id, nfc_uid, scanned_counter, last_counter,
        scanned_lat, scanned_lng, plant_lat, plant_lng, distance_meters,
        status, severity, notes, scanned_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      plant.farm_id,
      plant.id,
      cleanUid || plant.nfc_uid || '',
      counter ? parseInt(counter, 10) : null,
      tagInfo.last_counter || 0,
      scannedLat,
      scannedLng,
      plantLat,
      plantLng,
      verification.distanceMeters,
      verification.status,
      verification.severity,
      verification.message,
      user_id ? parseInt(user_id, 10) : null
    ]);

    // 5. Update last counter & scan position if verified successfully
    if (verification.isValid && cleanUid) {
      const nextCounter = counter !== undefined && counter !== null 
        ? parseInt(counter, 10) 
        : (tagInfo.last_counter || 0) + 1;

      await client.query(`
        UPDATE nfc_tags_inventory
        SET last_counter = $1, last_scanned_lat = $2, last_scanned_lng = $3, last_scanned_at = NOW()
        WHERE UPPER(nfc_uid) = UPPER($4)
      `, [nextCounter, scannedLat, scannedLng, cleanUid]);
    } else if (!verification.isValid) {
      // 6. Asynchronously trigger Zalo Security Alert to Farm Owner
      try {
        const ownerRes = await client.query(`
          SELECT u.phone, u.full_name, u.email 
          FROM farms f
          JOIN users u ON u.id = f.user_id
          WHERE f.id = $1
        `, [plant.farm_id]);
        
        const ownerPhone = ownerRes.rows[0]?.phone;
        zaloService.sendZaloSecurityAlert({
          phone: ownerPhone,
          farmName: plant.farm_name,
          treeCode: plant.tree_code || plant.id,
          distance: verification.distanceMeters,
          reason: verification.message,
          severity: verification.severity
        }).catch(e => console.warn('Zalo alert non-blocking error:', e.message));
      } catch (zaloErr) {
        console.warn('Failed to query farm owner for Zalo alert:', zaloErr.message);
      }
    }

    return res.json({
      ...verification,
      plant: {
        id: plant.id,
        farm_id: plant.farm_id,
        farm_name: plant.farm_name,
        tree_code: plant.tree_code,
        public_slug: plant.public_slug,
        latitude: plant.latitude,
        longitude: plant.longitude,
        geofence_radius_meters: plant.allowed_radius || 8.0
      }
    });

  } catch (err) {
    console.error('NFC verify scan error:', err);
    res.status(500).json({ isValid: false, error: 'Lỗi server khi xác thực thẻ: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── Get Farm NFC Security Logs ─────────────────────────────────────────────
router.get('/farms/:farmId/nfc-security-logs', auth, async (req, res) => {
  try {
    const farmId = parseInt(req.params.farmId);
    if (isNaN(farmId)) return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const logs = await pool.query(`
      SELECT l.*, p.tree_code, u.full_name as scanned_by_name, u.email as scanned_by_email
      FROM nfc_security_audit_logs l
      LEFT JOIN plants p ON p.id = l.plant_id
      LEFT JOIN users u ON u.id = l.scanned_by
      WHERE l.farm_id = $1
      ORDER BY l.created_at DESC
      LIMIT $2
    `, [farmId, limit]);

    res.json({
      success: true,
      count: logs.rows.length,
      logs: logs.rows
    });
  } catch (err) {
    console.error('Fetch security logs error:', err);
    res.status(500).json({ error: 'Lỗi server khi tải nhật ký an ninh: ' + err.message });
  }
});

// ─── NFC Inventory API Endpoints (Batch registration, table listing, delete) ──
router.get('/farms/:farmId/nfc-inventory', auth, async (req, res) => {
  try {
    const farmId = parseInt(req.params.farmId);
    if (isNaN(farmId)) return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });

    // Verify access
    if (req.user.role !== 'admin') {
      const farmCheck = await pool.query('SELECT user_id FROM farms WHERE id = $1', [farmId]);
      if (farmCheck.rows.length === 0 || (farmCheck.rows[0].user_id !== req.user.id && req.user.farm_id !== farmId)) {
        return res.status(403).json({ error: 'Không có quyền truy cập kho thẻ của trang trại này.' });
      }
    }

    const items = await pool.query(
      `SELECT n.*, p.tree_code, p.plant_type, p.plant_variety, p.health_status, p.location, p.latitude, p.longitude, p.public_url, p.data as plant_data
       FROM nfc_tags_inventory n
       LEFT JOIN plants p ON n.plant_id = p.id
       WHERE n.farm_id = $1
       ORDER BY n.id DESC`,
      [farmId]
    );

    const stats = {
      total: items.rows.length,
      assigned: items.rows.filter(r => r.status === 'assigned').length,
      unassigned: items.rows.filter(r => r.status !== 'assigned').length
    };

    res.json({ success: true, stats, items: items.rows, tags: items.rows });
  } catch (err) {
    console.error('Error fetching NFC inventory:', err);
    res.status(500).json({ error: 'Lỗi server khi tải danh sách kho thẻ.' });
  }
});

router.post('/farms/:farmId/nfc-inventory/batch', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const farmId = parseInt(req.params.farmId);
    if (isNaN(farmId)) return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });

    const { uids, uid } = req.body;
    const rawList = Array.isArray(uids) ? uids : (uid ? [uid] : []);

    if (rawList.length === 0) {
      return res.status(400).json({ error: 'Vui lòng cung cấp ít nhất 1 mã thẻ NFC.' });
    }

    await client.query('BEGIN');

    const added = [];
    const duplicates = [];

    for (const rawUid of rawList) {
      if (!rawUid || typeof rawUid !== 'string') continue;
      const cleanUid = decodeURIComponent(rawUid).trim().toUpperCase();
      if (!cleanUid) continue;

      // Check if already in inventory
      const existing = await client.query(
        'SELECT id, farm_id, status, plant_id FROM nfc_tags_inventory WHERE UPPER(nfc_uid) = UPPER($1)',
        [cleanUid]
      );

      if (existing.rows.length > 0) {
        duplicates.push({ uid: cleanUid, reason: 'Mã thẻ đã tồn tại trong kho thẻ.' });
        continue;
      }

      // Check if already assigned to a plant
      const existingPlant = await client.query(
        'SELECT id, tree_code, farm_id FROM plants WHERE UPPER(nfc_uid) = UPPER($1)',
        [cleanUid]
      );

      if (existingPlant.rows.length > 0) {
        duplicates.push({ uid: cleanUid, reason: `Thẻ đã được gán cho cây #${existingPlant.rows[0].tree_code || existingPlant.rows[0].id}` });
        continue;
      }

      // Insert new inventory tag
      const insertRes = await client.query(
        `INSERT INTO nfc_tags_inventory (farm_id, nfc_uid, status, created_by)
         VALUES ($1, $2, 'unassigned', $3)
         RETURNING *`,
        [farmId, cleanUid, req.user.id]
      );
      added.push(insertRes.rows[0]);
    }

    await client.query('COMMIT');

    // If single tap registration and it's a duplicate, return 409
    if (rawList.length === 1 && duplicates.length > 0 && added.length === 0) {
      return res.status(409).json({ 
        error: `Thẻ ${duplicates[0].uid} bị trùng: ${duplicates[0].reason}`,
        duplicate: duplicates[0]
      });
    }

    res.status(201).json({
      success: true,
      added_count: added.length,
      duplicate_count: duplicates.length,
      added,
      duplicates,
      message: `Đã thêm thành công ${added.length} thẻ NFC vào kho của trang trại.${duplicates.length > 0 ? ` (${duplicates.length} thẻ bị trùng đã bỏ qua)` : ''}`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error batch adding NFC inventory:', err);
    res.status(500).json({ error: 'Lỗi server khi nhập kho thẻ NFC: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── Symmetrical Import NFC Inventory (CSV / Excel items with auto-assign & GPS) ──
router.post('/farms/:farmId/nfc-inventory/import', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const farmId = parseInt(req.params.farmId);
    if (isNaN(farmId)) return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });

    // Verify access
    if (req.user.role !== 'admin') {
      const farmCheck = await client.query('SELECT user_id FROM farms WHERE id = $1', [farmId]);
      if (farmCheck.rows.length === 0 || (farmCheck.rows[0].user_id !== req.user.id && req.user.farm_id !== farmId)) {
        return res.status(403).json({ error: 'Không có quyền import kho thẻ của trang trại này.' });
      }
    }

    const { items, auto_assign = true, update_gps = true, skip_duplicates = true } = req.body;
    const rawList = Array.isArray(items) ? items : [];

    if (rawList.length === 0) {
      return res.status(400).json({ error: 'Dữ liệu import rỗng hoặc không đúng định dạng.' });
    }

    await client.query('BEGIN');

    let addedCount = 0;
    let assignedCount = 0;
    let gpsUpdatedCount = 0;
    const duplicates = [];

    for (const item of rawList) {
      if (!item) continue;
      const rawUid = typeof item === 'string' ? item : item.uid;
      if (!rawUid || typeof rawUid !== 'string') continue;
      const cleanUid = decodeURIComponent(rawUid).trim().toUpperCase();
      if (!cleanUid) continue;

      // Check if tag already exists in inventory
      const existingTag = await client.query(
        'SELECT id, farm_id, status, plant_id FROM nfc_tags_inventory WHERE UPPER(nfc_uid) = UPPER($1)',
        [cleanUid]
      );

      let tagId = null;
      let isNew = false;

      if (existingTag.rows.length > 0) {
        const existing = existingTag.rows[0];
        if (existing.farm_id !== farmId) {
          duplicates.push({ uid: cleanUid, reason: `Thẻ đã thuộc trang trại khác (#${existing.farm_id})` });
          continue;
        }
        tagId = existing.id;
        duplicates.push({ uid: cleanUid, reason: 'Thẻ đã có sẵn trong kho trang trại này.' });
      } else {
        // Insert new inventory tag
        const insertRes = await client.query(
          `INSERT INTO nfc_tags_inventory (farm_id, nfc_uid, status, created_by)
           VALUES ($1, $2, 'unassigned', $3)
           RETURNING id`,
          [farmId, cleanUid, req.user.id]
        );
        tagId = insertRes.rows[0].id;
        addedCount++;
        isNew = true;
      }

      // Auto-assign to plant if tree_code or plant_id is provided
      if (auto_assign && (item.tree_code || item.plant_id)) {
        let plant = null;

        if (item.plant_id && !isNaN(parseInt(item.plant_id))) {
          const pRes = await client.query(
            'SELECT id, tree_code, nfc_uid, latitude, longitude FROM plants WHERE id = $1 AND farm_id = $2',
            [parseInt(item.plant_id), farmId]
          );
          if (pRes.rows.length > 0) plant = pRes.rows[0];
        }

        if (!plant && item.tree_code) {
          const rawCode = String(item.tree_code).trim();
          const cleanCode = rawCode.replace(/^cây\s*#/i, '').replace(/^#/i, '').trim();
          const pRes = await client.query(
            `SELECT id, tree_code, nfc_uid, latitude, longitude FROM plants 
             WHERE farm_id = $1 AND (UPPER(tree_code) = UPPER($2) OR UPPER(tree_code) = UPPER($3) OR id::text = $3)
             LIMIT 1`,
            [farmId, rawCode, cleanCode]
          );
          if (pRes.rows.length > 0) plant = pRes.rows[0];
        }

        if (plant) {
          const targetPlantId = plant.id;
          const publicUrl = generatePublicPlantUrl(farmId, targetPlantId, cleanUid);

          // Parse GPS coordinates if available
          let validLat = null;
          let validLng = null;
          if (update_gps && item.latitude != null && item.longitude != null) {
            const parsedLat = parseFloat(item.latitude);
            const parsedLng = parseFloat(item.longitude);
            if (!isNaN(parsedLat) && !isNaN(parsedLng) && Math.abs(parsedLat) <= 90 && Math.abs(parsedLng) <= 180 && (parsedLat !== 0 || parsedLng !== 0)) {
              validLat = parsedLat;
              validLng = parsedLng;
            }
          }

          if (validLat !== null && validLng !== null) {
            await client.query(
              `UPDATE plants 
               SET nfc_uid = $1, latitude = $2, longitude = $3, public_url = $4, updated_at = NOW() 
               WHERE id = $5`,
              [cleanUid, validLat, validLng, publicUrl, targetPlantId]
            );
            gpsUpdatedCount++;
          } else {
            await client.query(
              `UPDATE plants 
               SET nfc_uid = $1, public_url = $2, updated_at = NOW() 
               WHERE id = $3`,
              [cleanUid, publicUrl, targetPlantId]
            );
          }

          // Update inventory status to assigned
          await client.query(
            `UPDATE nfc_tags_inventory 
             SET status = 'assigned', plant_id = $1, tagged_at = NOW() 
             WHERE id = $2`,
            [targetPlantId, tagId]
          );

          assignedCount++;
        }
      }
    }

    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated', { farm_id: farmId, action: 'nfc_imported' });

    res.json({
      success: true,
      total_processed: rawList.length,
      added_count: addedCount,
      assigned_count: assignedCount,
      gps_updated_count: gpsUpdatedCount,
      duplicate_count: duplicates.length,
      duplicates,
      message: `Đã nhập thành công ${addedCount} thẻ mới vào kho.${assignedCount > 0 ? ` Đã tự động gán cho ${assignedCount} cây trồng.` : ''}${gpsUpdatedCount > 0 ? ` Cập nhật ${gpsUpdatedCount} tọa độ GPS.` : ''}${duplicates.length > 0 ? ` (${duplicates.length} thẻ trùng đã bỏ qua)` : ''}`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error importing NFC inventory:', err);
    res.status(500).json({ error: 'Lỗi server khi import kho thẻ: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── Unassign ALL tags from plants in a farm ─────────────────────────────────
router.post('/farms/:farmId/nfc-inventory/unassign-all', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const farmId = parseInt(req.params.farmId);
    if (isNaN(farmId)) return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });

    // Verify access
    if (req.user.role !== 'admin') {
      const farmCheck = await client.query('SELECT user_id FROM farms WHERE id = $1', [farmId]);
      if (farmCheck.rows.length === 0 || (farmCheck.rows[0].user_id !== req.user.id && req.user.farm_id !== farmId)) {
        return res.status(403).json({ error: 'Không có quyền thay đổi kho thẻ của trang trại này.' });
      }
    }

    await client.query('BEGIN');

    // 1. Get all plants currently assigned with an NFC tag in this farm
    const assignedPlants = await client.query(
      'SELECT id, tree_code, nfc_uid FROM plants WHERE farm_id = $1 AND nfc_uid IS NOT NULL',
      [farmId]
    );

    // 2. Set nfc_uid = NULL & GPS coordinates = NULL for all plants in this farm & update standard public_url
    for (const p of assignedPlants.rows) {
      const standardUrl = generatePublicPlantUrl(farmId, p.id, null);
      await client.query(
        'UPDATE plants SET nfc_uid = NULL, latitude = NULL, longitude = NULL, public_url = $1, updated_at = NOW() WHERE id = $2',
        [standardUrl, p.id]
      );
    }

    // 3. Reset all inventory items in this farm to unassigned
    const resetRes = await client.query(
      `UPDATE nfc_tags_inventory 
       SET status = 'unassigned', plant_id = NULL, tagged_at = NULL 
       WHERE farm_id = $1 AND (status = 'assigned' OR plant_id IS NOT NULL)
       RETURNING *`,
      [farmId]
    );

    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated', { farm_id: farmId, action: 'nfc_unassigned_all' });

    res.json({
      success: true,
      unassigned_plants_count: assignedPlants.rows.length,
      unassigned_tags_count: resetRes.rows.length,
      message: `Đã gỡ thành công thẻ NFC khỏi ${assignedPlants.rows.length} cây trong trang trại. Toàn bộ thẻ trong kho đã chuyển về trạng thái sẵn sàng gán.`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error unassigning all NFC tags:', err);
    res.status(500).json({ error: 'Lỗi server khi gỡ toàn bộ thẻ: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── Unassign a single tag from a plant ──────────────────────────────────────
router.post('/farms/:farmId/nfc-inventory/:id/unassign', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id);
    const farmId = parseInt(req.params.farmId);
    if (isNaN(id) || isNaN(farmId)) return res.status(400).json({ error: 'Tham số không hợp lệ.' });

    // Verify access
    if (req.user.role !== 'admin') {
      const farmCheck = await client.query('SELECT user_id FROM farms WHERE id = $1', [farmId]);
      if (farmCheck.rows.length === 0 || (farmCheck.rows[0].user_id !== req.user.id && req.user.farm_id !== farmId)) {
        return res.status(403).json({ error: 'Không có quyền thay đổi kho thẻ của trang trại này.' });
      }
    }

    await client.query('BEGIN');

    const tagRes = await client.query('SELECT * FROM nfc_tags_inventory WHERE id = $1 AND farm_id = $2', [id, farmId]);
    if (tagRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Không tìm thấy thẻ trong kho.' });
    }

    const tag = tagRes.rows[0];

    // Unassign from plant
    if (tag.plant_id || tag.nfc_uid) {
      const plantRes = await client.query(
        'SELECT id, farm_id FROM plants WHERE (id = $1 OR UPPER(nfc_uid) = UPPER($2)) AND farm_id = $3',
        [tag.plant_id || 0, tag.nfc_uid, farmId]
      );
      for (const p of plantRes.rows) {
        const standardUrl = generatePublicPlantUrl(farmId, p.id, null);
        await client.query(
          'UPDATE plants SET nfc_uid = NULL, latitude = NULL, longitude = NULL, public_url = $1, updated_at = NOW() WHERE id = $2',
          [standardUrl, p.id]
        );
      }
    }

    // Reset inventory row
    await client.query(
      `UPDATE nfc_tags_inventory 
       SET status = 'unassigned', plant_id = NULL, tagged_at = NULL 
       WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated', { farm_id: farmId, tag_id: id, action: 'nfc_unassigned' });

    res.json({
      success: true,
      message: `Đã gỡ thẻ ${tag.nfc_uid} khỏi cây trồng thành công.`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error unassigning single NFC tag:', err);
    res.status(500).json({ error: 'Lỗi server khi gỡ thẻ: ' + err.message });
  } finally {
    client.release();
  }
});

router.delete('/farms/:farmId/nfc-inventory/:id', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id);
    const farmId = parseInt(req.params.farmId);
    if (isNaN(id) || isNaN(farmId)) return res.status(400).json({ error: 'Tham số không hợp lệ.' });

    await client.query('BEGIN');

    const result = await client.query(
      'DELETE FROM nfc_tags_inventory WHERE id = $1 AND farm_id = $2 RETURNING *',
      [id, farmId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Không tìm thấy thẻ trong kho.' });
    }

    const deletedTag = result.rows[0];

    // If assigned to a plant, also set plant's nfc_uid to NULL and clear GPS
    if (deletedTag.plant_id || deletedTag.nfc_uid) {
      const pRes = await client.query(
        'SELECT id FROM plants WHERE (id = $1 OR UPPER(nfc_uid) = UPPER($2)) AND farm_id = $3',
        [deletedTag.plant_id || 0, deletedTag.nfc_uid, farmId]
      );
      for (const p of pRes.rows) {
        const standardUrl = generatePublicPlantUrl(farmId, p.id, null);
        await client.query(
          'UPDATE plants SET nfc_uid = NULL, latitude = NULL, longitude = NULL, public_url = $1, updated_at = NOW() WHERE id = $2',
          [standardUrl, p.id]
        );
      }
    }

    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated', { farm_id: farmId, action: 'nfc_deleted' });

    res.json({ success: true, message: 'Đã xóa thẻ khỏi kho.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting NFC tag from inventory:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa thẻ.' });
  } finally {
    client.release();
  }
});

// ─── Field Tagging: Quick Assign NFC Tag + GPS location to a Tree ────────────
router.post('/farms/:farmId/tag-nfc-gps', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const farmId = parseInt(req.params.farmId);
    const { plant_id, tree_code, nfc_uid, latitude, longitude } = req.body;

    if (!nfc_uid || typeof nfc_uid !== 'string') {
      return res.status(400).json({ error: 'Mã thẻ NFC (UID) là bắt buộc.' });
    }

    const cleanUid = decodeURIComponent(nfc_uid).trim().toUpperCase();

    let lat = latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null;
    let lng = longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null;

    if (lat !== null && lng !== null) {
      if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
        const tmp = lat; lat = lng; lng = tmp;
      }
    }

    await client.query('BEGIN');

    // Find the plant by plant_id or farm_id + tree_code
    let targetPlant = null;
    if (plant_id) {
      const pRes = await client.query('SELECT * FROM plants WHERE id = $1 AND farm_id = $2', [plant_id, farmId]);
      if (pRes.rows.length > 0) targetPlant = pRes.rows[0];
    }
    if (!targetPlant && tree_code) {
      const pRes = await client.query('SELECT * FROM plants WHERE farm_id = $1 AND (tree_code = $2 OR tree_code ILIKE $3)', [farmId, tree_code, `%${tree_code}%`]);
      if (pRes.rows.length > 0) targetPlant = pRes.rows[0];
    }

    if (!targetPlant) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Không tìm thấy cây số ${tree_code || plant_id} trong trang trại này.` });
    }

    // 1. Verify tag exists in pre-declared inventory for this farm
    const invCheck = await client.query(
      'SELECT id, farm_id, status, plant_id FROM nfc_tags_inventory WHERE UPPER(nfc_uid) = UPPER($1) AND (farm_id = $2 OR farm_id IS NULL)',
      [cleanUid, farmId]
    );
    if (invCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Mã thẻ ${cleanUid} chưa được khai báo nhập kho cho trang trại này. Vui lòng liên hệ Quản trị viên để nhập kho thẻ trước.`
      });
    }

    // 2. Check if this UID is used by another plant
    const uidConflict = await client.query(
      'SELECT id, tree_code FROM plants WHERE UPPER(nfc_uid) = UPPER($1) AND id != $2',
      [cleanUid, targetPlant.id]
    );
    if (uidConflict.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Mã thẻ ${cleanUid} đã được gắn cho cây #${uidConflict.rows[0].tree_code || uidConflict.rows[0].id}. Mỗi cây chỉ được gắn 1 thẻ duy nhất.` });
    }

    // 3. If replacing an existing tag on this plant, revoke / unassign old tag in inventory
    if (targetPlant.nfc_uid && targetPlant.nfc_uid.toUpperCase() !== cleanUid) {
      await client.query(
        `UPDATE nfc_tags_inventory SET status = 'unassigned', plant_id = NULL, tagged_at = NULL WHERE farm_id = $1 AND UPPER(nfc_uid) = UPPER($2)`,
        [farmId, targetPlant.nfc_uid]
      );
    }

    // 4. Generate public URL: https://plant-book.onrender.com/{farm_id}/{plant_id}/{nfc_uid}
    const publicUrl = generatePublicPlantUrl(farmId, targetPlant.id, cleanUid);

    // 5. Update plant
    const updateRes = await client.query(
      `UPDATE plants 
       SET nfc_uid = $1, 
           latitude = COALESCE($2, latitude), 
           longitude = COALESCE($3, longitude), 
           public_url = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [cleanUid, lat, lng, publicUrl, targetPlant.id]
    );

    const updatedPlant = updateRes.rows[0];

    // 6. Update NFC Inventory item
    await client.query(
      `UPDATE nfc_tags_inventory 
       SET farm_id = $1, status = 'assigned', plant_id = $2, tagged_at = NOW() 
       WHERE UPPER(nfc_uid) = UPPER($3)`,
      [farmId, targetPlant.id, cleanUid]
    );

    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated', { plant_id: updatedPlant.id, farm_id: farmId, action: 'nfc_tagged' });

    res.json({
      success: true,
      message: `Đã gán thẻ ${cleanUid} và định vị GPS cho cây #${updatedPlant.tree_code || updatedPlant.id}!`,
      plant: updatedPlant,
      public_url: publicUrl
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error tagging plant with NFC & GPS:', err);
    res.status(500).json({ error: 'Lỗi server khi gán thẻ và GPS: ' + err.message });
  } finally {
    client.release();
  }
});

// GET /api/plants/nfc/:uid — Public lookup plant by NFC UID, Slug, or ID
router.get('/nfc/:uid', async (req, res) => {
  try {
    const uid = req.params.uid.trim();
    const result = await pool.query(
      `SELECT p.id as plant_id, p.tree_code, p.plant_type, p.plant_variety, p.public_slug, p.health_status, p.nfc_uid, p.location,
              f.id as farm_id, f.name as farm_name, f.user_id,
              u.full_name as farm_owner_name, u.email as farm_owner_email
       FROM plants p
       LEFT JOIN farms f ON f.id = p.farm_id
       LEFT JOIN users u ON u.id = f.user_id
       WHERE UPPER(p.nfc_uid) = UPPER($1) OR p.public_slug = $1 OR p.id::text = $1`,
      [uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin cây trồng liên kết với mã thẻ NFC này.' });
    }

    const plant = result.rows[0];
    const slug = plant.public_slug || plant.plant_id;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.get('host') || 'plant-book.onrender.com';
    const baseUrl = `${protocol}://${host}`;

    res.json({
      success: true,
      plant_id: plant.plant_id,
      tree_code: plant.tree_code,
      plant_type: plant.plant_type,
      plant_variety: plant.plant_variety,
      health_status: plant.health_status,
      nfc_uid: plant.nfc_uid,
      farm_id: plant.farm_id,
      farm_name: plant.farm_name,
      user_id: plant.user_id,
      farm_owner_name: plant.farm_owner_name,
      public_slug: slug,
      public_url: `${baseUrl}/plant/${slug}`,
      nfc_url: plant.nfc_uid ? `${baseUrl}/nfc/${plant.nfc_uid}` : `${baseUrl}/plant/${slug}`
    });
  } catch (err) {
    console.error('NFC lookup error:', err);
    res.status(500).json({ error: 'Lỗi server khi tra cứu thẻ NFC.' });
  }
});

// ─── Soft Delete Plant (Chống xóa nhầm & Audit Trail) ────────────────────────
router.delete('/:id', auth, admin, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id, 10);
    const existing = await pool.query('SELECT * FROM plants WHERE id=$1', [plantId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy cây trồng.' });
    }
    const oldPlant = existing.rows[0];

    // Soft Delete: Đánh dấu deleted_at = NOW()
    const result = await pool.query(
      `UPDATE plants SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [plantId]
    );

    // Ghi nhận Audit Log
    await logAudit({
      actionType: 'DELETE_PLANT',
      tableName: 'plants',
      recordId: plantId,
      userId: req.user.id,
      oldData: oldPlant,
      newData: { deleted_at: new Date().toISOString() },
      ipAddress: req.ip,
      notes: `Xóa mềm cây #${oldPlant.tree_code || plantId}`
    });

    // Xóa Cache & Broadcast Live Sync
    await invalidateAndBroadcast('plants_updated', {
      plant_id: plantId,
      farm_id: oldPlant.farm_id,
      action: 'soft_delete'
    }, ['farms_', 'plants_']);

    res.json({
      success: true,
      message: `Đã đưa cây #${oldPlant.tree_code || plantId} vào thùng rác an toàn (có thể khôi phục).`,
      plant: result.rows[0]
    });
  } catch (err) {
    console.error('Delete plant error:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa cây: ' + err.message });
  }
});

// ─── Restore Soft-Deleted Plant (Khôi phục cây từ thùng rác) ──────────────────
router.post('/:id/restore', auth, admin, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id, 10);
    const existing = await pool.query('SELECT * FROM plants WHERE id=$1', [plantId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy cây trồng.' });
    }
    const oldPlant = existing.rows[0];

    const result = await pool.query(
      `UPDATE plants SET deleted_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [plantId]
    );

    await logAudit({
      actionType: 'RESTORE_PLANT',
      tableName: 'plants',
      recordId: plantId,
      userId: req.user.id,
      oldData: oldPlant,
      newData: { deleted_at: null },
      ipAddress: req.ip,
      notes: `Khôi phục cây #${oldPlant.tree_code || plantId}`
    });

    await invalidateAndBroadcast('plants_updated', {
      plant_id: plantId,
      farm_id: oldPlant.farm_id,
      action: 'restore'
    }, ['farms_', 'plants_']);

    res.json({
      success: true,
      message: `Đã khôi phục thành công cây #${oldPlant.tree_code || plantId}!`,
      plant: result.rows[0]
    });
  } catch (err) {
    console.error('Restore plant error:', err);
    res.status(500).json({ error: 'Lỗi server khi khôi phục cây: ' + err.message });
  }
});

// GET /api/plants/:id/growth-photos (Only actual growth timeline photos)
router.get('/:id(\\d+)/growth-photos', auth, async (req, res) => {
  try {
    const plantId = req.params.id;
    const media = await pool.query(
      `SELECT * FROM plant_media 
       WHERE plant_id=$1 
         AND (object_name NOT LIKE '%/disease/%' AND (caption IS NULL OR caption NOT ILIKE 'Bệnh cây%'))
         AND media_type != 'video'
       ORDER BY uploaded_at DESC`, 
      [plantId]
    );
    res.json({ success: true, count: media.rows.length, media: media.rows });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy xuất lịch sử ảnh sinh trưởng: ' + err.message });
  }
});

// GET /api/plants/:id/disease-media (Photos/videos recorded during pest/disease events)
router.get('/:id(\\d+)/disease-media', auth, async (req, res) => {
  try {
    const plantId = req.params.id;
    const media = await pool.query(
      `SELECT * FROM plant_media 
       WHERE plant_id=$1 
         AND (object_name LIKE '%/disease/%' OR caption ILIKE 'Bệnh cây%' OR caption ILIKE '%sâu bệnh%')
       ORDER BY uploaded_at DESC`, 
      [plantId]
    );
    res.json({ success: true, count: media.rows.length, media: media.rows });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy xuất media bệnh cây: ' + err.message });
  }
});

// GET /api/plants/:id/media (All media)
router.get('/:id(\\d+)/media', auth, async (req, res) => {
  try {
    const plantId = req.params.id;
    const media = await pool.query('SELECT * FROM plant_media WHERE plant_id=$1 ORDER BY uploaded_at DESC', [plantId]);
    res.json({ success: true, count: media.rows.length, media: media.rows });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy xuất thư viện media: ' + err.message });
  }
});

router.post(['/:id/media', '/:id/growth-photo'], auth, upload.array('files', 20), async (req, res) => {
  try {
    const plantId = req.params.id;
    const plant = await pool.query('SELECT id FROM plants WHERE id=$1', [plantId]);
    if (plant.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy cây.' });

    const uploaded = [];
    const growthStage = (req.body.growth_stage || req.body.caption || 'Cập nhật sinh trưởng').trim();

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const objectName = `plants/${plantId}/${uuidv4()}${ext}`;
      const url = await uploadFile(objectName, file.buffer, file.mimetype);
      const mediaType = file.mimetype.startsWith('video') ? 'video' : 'image';

      const result = await pool.query(
        'INSERT INTO plant_media (plant_id, object_name, url, media_type, caption) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [plantId, objectName, url, mediaType, growthStage]
      );
      uploaded.push(result.rows[0]);
    }

    if (uploaded.length > 0 && uploaded[0].media_type === 'image') {
      await pool.query(
        'UPDATE plants SET cover_image=$1, updated_at=NOW() WHERE id=$2',
        [uploaded[0].url, plantId]
      );
    }

    // Record user activity
    if (uploaded.length > 0) {
      await pool.query(
        `INSERT INTO user_activities (user_id, activity_type, description)
         VALUES ($1, 'Tải lên hình ảnh sinh trưởng', $2)`,
        [req.user.id, `Tải lên ${uploaded.length} ảnh sinh trưởng (${growthStage}) cho cây #${plantId}`]
      );
    }

    const allMedia = await pool.query('SELECT * FROM plant_media WHERE plant_id=$1 ORDER BY uploaded_at DESC', [plantId]);

    res.json({
      success: true,
      uploaded,
      cover_image: uploaded.length > 0 ? uploaded[0].url : null,
      all_media: allMedia.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi upload ảnh sinh trưởng: ' + err.message });
  }
});

router.delete('/:plantId/media/:mediaId', auth, async (req, res) => {
  try {
    const { plantId, mediaId } = req.params;

    // Check if the plant exists and user has access
    const plant = await pool.query(
      `SELECT p.id, f.user_id as farm_owner_id
       FROM plants p 
       LEFT JOIN farms f ON f.id = p.farm_id
       WHERE p.id=$1`, [plantId]
    );
    if (plant.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy cây.' });

    const row = plant.rows[0];
    if (req.user.role !== 'admin' && row.farm_owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền quản lý ảnh của cây này.' });
    }

    const media = await pool.query('SELECT * FROM plant_media WHERE id=$1 AND plant_id=$2', [mediaId, plantId]);
    if (media.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy.' });

    if (req.user.role === 'admin') {
      // Admin: Delete permanently
      await deleteFile(media.rows[0].object_name);
      await pool.query('DELETE FROM plant_media WHERE id=$1', [mediaId]);
      res.json({ message: 'Đã xóa vĩnh viễn khỏi hệ thống.' });
    } else {
      // User (farmer): Mark delete_pending = true
      await pool.query('UPDATE plant_media SET delete_pending = true WHERE id=$1', [mediaId]);
      res.json({ message: 'Đã gửi yêu cầu xóa lên quản trị viên phê duyệt.' });
    }
  } catch (err) {
    console.error('Delete media error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.post('/:plantId/media/:mediaId/reject-delete', auth, admin, async (req, res) => {
  try {
    const { plantId, mediaId } = req.params;
    const media = await pool.query('SELECT * FROM plant_media WHERE id=$1 AND plant_id=$2', [mediaId, plantId]);
    if (media.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy phương tiện.' });

    await pool.query('UPDATE plant_media SET delete_pending = false WHERE id=$1', [mediaId]);
    res.json({ message: 'Đã khôi phục ảnh/video thành công.' });
  } catch (err) {
    console.error('Reject delete media error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.post('/:id/logs', auth, async (req, res) => {
  try {
    const { 
      log_date, log_type, note, media_urls, details, 
      operator_name, equipment_used, phi_days: customPhiDays 
    } = req.body;
    const plantIdRaw = req.params.id;
    
    let targetPlantId = null;
    let plantType = 'Toàn vườn';
    let plantVariety = '';
    let farmId = null;
    let farmPuc = 'VN-TB';
    let treeCode = '';
    let existingPlant = null;

    if (plantIdRaw && plantIdRaw !== '0') {
      const plant = await pool.query(
        `SELECT p.*, f.user_id as farm_owner_id, f.puc_code as farm_puc_code
         FROM plants p 
         LEFT JOIN farms f ON f.id = p.farm_id 
         WHERE p.id=$1`, [plantIdRaw]
      );
      if (plant.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy cây.' });
      
      const isAssignedFarmer = req.user.farm_id && plant.rows[0].farm_id && req.user.farm_id === plant.rows[0].farm_id;
      if (req.user.role !== 'admin' && plant.rows[0].farm_owner_id !== req.user.id && !isAssignedFarmer) {
        return res.status(403).json({ error: 'Bạn không có quyền ghi nhật ký cho cây này.' });
      }
      existingPlant = plant.rows[0];
      targetPlantId = existingPlant.id;
      plantType = existingPlant.plant_type;
      plantVariety = existingPlant.plant_variety;
      farmId = existingPlant.farm_id;
      farmPuc = existingPlant.farm_puc_code || 'VN-TB';
      treeCode = existingPlant.tree_code || `#${existingPlant.id}`;
    }

    const effectiveDate = log_date || new Date().toISOString().slice(0, 10);
    const parsedDetails = typeof details === 'string' ? JSON.parse(details || '{}') : (details || {});
    let generatedBatchCode = null;
    let isPhiViolation = false;

    // ── 1. VIETGAP PHUN THUỐC BVTV & TÍNH TOÁN CÁCH LY PHI ──
    if (log_type === 'Phun thuốc' && targetPlantId) {
      let phiDays = parseInt(customPhiDays || parsedDetails.phi_days) || 0;
      const pesticideName = parsedDetails.name || parsedDetails.pesticide_name || note || 'Thuốc BVTV';

      // Nếu chưa có phi_days trực tiếp, tự động tra cứu từ kho vật tư
      if (phiDays <= 0 && pesticideName) {
        const supplyLookup = await pool.query(
          `SELECT phi_days FROM supplies WHERE category = 'Phun thuốc' AND (name ILIKE $1 OR $2 ILIKE '%' || name || '%') AND phi_days > 0 LIMIT 1`,
          [pesticideName.trim(), pesticideName.trim()]
        );
        if (supplyLookup.rows.length > 0) {
          phiDays = supplyLookup.rows[0].phi_days;
        }
      }

      // Nếu có số ngày cách ly, tính ngày hết hạn PHI và cập nhật cây trồng
      if (phiDays > 0) {
        parsedDetails.phi_days = phiDays;
        const sprayDateObj = new Date(effectiveDate);
        sprayDateObj.setDate(sprayDateObj.getDate() + phiDays);
        const phiUntilDateStr = sprayDateObj.toISOString().slice(0, 10);
        parsedDetails.phi_until_date = phiUntilDateStr;

        await pool.query(
          `UPDATE plants 
           SET phi_until_date = $1, phi_status = 'quarantine', last_pesticide_date = $2, last_pesticide_name = $3, updated_at = NOW() 
           WHERE id = $4`,
          [phiUntilDateStr, effectiveDate, pesticideName, targetPlantId]
        );
      }
    }

    // ── 2. VIETGAP THU HOẠCH & SINH MÃ LÔ TRUY XUẤT NGUỒN GỐC ──
    if (log_type === 'Thu hoạch') {
      const dateClean = effectiveDate.replace(/-/g, '');
      const codeClean = (treeCode || 'TB').replace(/[^a-zA-Z0-9]/g, '');
      generatedBatchCode = `${farmPuc}-${dateClean}-${codeClean}`;
      parsedDetails.batch_code = generatedBatchCode;
      parsedDetails.puc_code = farmPuc;

      // Kiểm tra xem cây có đang trong thời gian cách ly PHI hay không
      if (existingPlant && existingPlant.phi_until_date) {
        const harvestTime = new Date(effectiveDate).getTime();
        const phiUntilTime = new Date(existingPlant.phi_until_date).getTime();
        if (harvestTime <= phiUntilTime) {
          isPhiViolation = true;
          parsedDetails.is_phi_violation = true;
          parsedDetails.phi_violation_warning = `CẢNH BÁO VI PHẠM VIETGAP: Thu hoạch sớm trong thời gian cách ly thuốc BVTV (Hết hạn cách ly: ${existingPlant.phi_until_date})`;
        }
      }
    }

    // ── 3. TỰ ĐỘNG TÍNH TOÁN & GHI NHẬN TIÊU HAO VẬT TƯ TRƯỚC KHI LƯU ──
    let resolvedSupply = null;
    let resolvedUsageQty = 0;
    let resolvedUnitPrice = 0;
    let resolvedTotCost = parseFloat(parsedDetails.total_cost) || 0;

    try {
      let resolvedSupplyId = parsedDetails.supply_id || null;
      const rawAmount = parseFloat(parsedDetails.quantity || parsedDetails.volume || parsedDetails.amount || 0);
      const rawUnit = (parsedDetails.unit || '').toLowerCase().trim();
      const supplyName = parsedDetails.supply_name || parsedDetails.material_name || parsedDetails.fertilizer_name || parsedDetails.pesticide_name || null;

      if (!resolvedSupplyId && supplyName) {
        const foundSup = await pool.query(
          `SELECT id, name, unit, unit_price, category, stock_quantity FROM supplies WHERE (user_id = $1 OR farm_id = $2) AND (name ILIKE $3 OR $3 ILIKE '%' || name || '%') LIMIT 1`,
          [req.user.id, farmId || null, supplyName]
        );
        if (foundSup.rows.length > 0) {
          resolvedSupplyId = foundSup.rows[0].id;
          resolvedSupply = foundSup.rows[0];
        }
      } else if (resolvedSupplyId) {
        const foundSup = await pool.query(
          `SELECT id, name, unit, unit_price, category, stock_quantity FROM supplies WHERE id = $1`,
          [resolvedSupplyId]
        );
        if (foundSup.rows.length > 0) {
          resolvedSupply = foundSup.rows[0];
        }
      }

      if (resolvedSupply && rawAmount > 0) {
        const supUnit = (resolvedSupply.unit || 'kg').toLowerCase().trim();
        resolvedUsageQty = convertLogAmountToBaseSupplyQty(rawAmount, rawUnit, supUnit, log_type);
        resolvedUnitPrice = parseFloat(resolvedSupply.unit_price) || 0;
        resolvedTotCost = resolvedTotCost > 0 ? resolvedTotCost : (resolvedUsageQty * resolvedUnitPrice);

        parsedDetails.supply_id = resolvedSupply.id;
        parsedDetails.supply_name = resolvedSupply.name;
        parsedDetails.material_name = resolvedSupply.name;
        parsedDetails.unit_price = resolvedUnitPrice;
        parsedDetails.total_cost = resolvedTotCost;
        parsedDetails.usage_quantity = resolvedUsageQty;
      }
    } catch (supErr) {
      console.warn('Cảnh báo tính toán chi phí vật tư trước khi lưu:', supErr.message);
    }

    const result = await pool.query(
      `INSERT INTO plant_logs (
        plant_id, log_date, log_type, note, media_urls, details, created_by,
        batch_code, puc_code, operator_name, equipment_used, is_phi_violation
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        targetPlantId, effectiveDate, log_type, note,
        JSON.stringify(media_urls || []), JSON.stringify(parsedDetails), req.user.id,
        generatedBatchCode, farmPuc, operator_name || req.user.full_name || req.user.name,
        equipment_used || null, isPhiViolation
      ]
    );

    // Ghi nhận vào supply_usages nếu có vật tư
    if (resolvedSupply && resolvedUsageQty > 0) {
      try {
        const rawAmount = parseFloat(parsedDetails.quantity || parsedDetails.volume || parsedDetails.amount || 0);
        const rawUnit = (parsedDetails.unit || '').toLowerCase().trim();
        await pool.query(
          `INSERT INTO supply_usages (user_id, supply_id, farm_id, plant_id, usage_date, quantity, unit_price, total_cost, note)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [req.user.id, resolvedSupply.id, farmId || null, targetPlantId || null, effectiveDate, resolvedUsageQty, resolvedUnitPrice, resolvedTotCost, `Tự động từ nhật ký [${log_type}] (${rawAmount} ${rawUnit || resolvedSupply.unit}${targetPlantId ? ' cho cây ' + treeCode : ' toàn vườn'})`]
        );

        if (resolvedSupply.category !== 'Tiền nước' && resolvedSupply.category !== 'Nhân công' && resolvedSupply.stock_quantity > 0) {
          await pool.query('UPDATE supplies SET stock_quantity = GREATEST(0, stock_quantity - $1), updated_at = NOW() WHERE id = $2', [resolvedUsageQty, resolvedSupply.id]);
        }
      } catch (usageInsertErr) {
        console.warn('Lỗi ghi nhận supply_usages:', usageInsertErr.message);
      }
    }

    // Tự động chuyển trạng thái cây thành Bệnh nếu ghi nhật ký Bệnh cây
    if (log_type === 'Bệnh cây' && targetPlantId) {
      await pool.query(
        `UPDATE plants SET health_status = 'Bệnh', updated_at = NOW() WHERE id = $1`,
        [targetPlantId]
      );
    }

    // Record user activity
    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Ghi nhật ký', $2)`,
      [req.user.id, `Ghi nhận nhật ký [${log_type}] cho ${targetPlantId ? 'cây ' + treeCode : 'Toàn vườn'}${generatedBatchCode ? ' (Lô: ' + generatedBatchCode + ')' : ''}`]
    );

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('new_care_log', {
        log: result.rows[0],
        plant_type: plantType,
        plant_variety: plantVariety,
        creator_name: req.user.name
      });
      broadcast('supplies_updated', { userId: req.user.id, log: result.rows[0] });
      broadcast('plants_updated');
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting log:', err);
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
});


router.put('/:plantId/logs/:logId', auth, async (req, res) => {
  try {
    const { plantId, logId } = req.params;
    const { log_date, log_type, note, details, media_urls } = req.body;

    // Check if plant exists and check farm ownership for user role
    const plant = await pool.query(
      `SELECT p.id, f.user_id 
       FROM plants p 
       LEFT JOIN farms f ON f.id = p.farm_id 
       WHERE p.id = $1`, [plantId]
    );
    if (plant.rows.length === 0) {
      return res.status(404).json({ error: 'Cây trồng không tồn tại.' });
    }

    if (req.user.role !== 'admin' && plant.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa nhật ký của cây trồng này.' });
    }

    // Get current log to save in history
    const logRes = await pool.query('SELECT * FROM plant_logs WHERE id=$1 AND plant_id=$2', [logId, plantId]);
    if (logRes.rows.length === 0) {
      return res.status(404).json({ error: 'Nhật ký không tồn tại.' });
    }

    const currentLog = logRes.rows[0];

    // Create history snapshot
    const historyItem = {
      edited_at: new Date().toISOString(),
      edited_by: req.user.id,
      edited_by_name: req.user.full_name || req.user.email,
      previous_version: {
        log_date: currentLog.log_date,
        log_type: currentLog.log_type,
        note: currentLog.note,
        details: currentLog.details,
        media_urls: currentLog.media_urls
      }
    };

    const editHistory = [...(currentLog.edit_history || []), historyItem];

    // Update log
    const updated = await pool.query(
      `UPDATE plant_logs 
       SET log_date = $1, log_type = $2, note = $3, details = $4, media_urls = $5, edit_history = $6, updated_at = NOW() 
       WHERE id = $7 AND plant_id = $8 RETURNING *`,
      [
        log_date || currentLog.log_date,
        log_type || currentLog.log_type,
        note !== undefined ? note : currentLog.note,
        JSON.stringify(details || currentLog.details || {}),
        JSON.stringify(media_urls || currentLog.media_urls || []),
        JSON.stringify(editHistory),
        logId,
        plantId
      ]
    );

    // Record user activity & audit history
    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Sửa nhật ký', $2)`,
      [req.user.id, `Chỉnh sửa nhật ký [${log_type || currentLog.log_type}] cho cây #${plantId} (ID nhật ký: ${logId})`]
    );

    logAuditAction(
      req.user.id,
      req.user.full_name || req.user.email,
      'UPDATE',
      'Nhật ký canh tác',
      logId,
      `Chỉnh sửa nhật ký "${log_type || currentLog.log_type}" cho cây #${plantId}`,
      currentLog,
      updated.rows[0]
    );

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('plants_updated', { message: `Care log edited on plant #${plantId}` });
      broadcast('supplies_updated', { message: `Care log edited on plant #${plantId}` });
    }

    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Error updating log:', err);
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
});

// ─── Helper function for building dynamic filter queries for batch logs ───
function buildLogFilterQuery(req, bodyOrQuery) {
  let baseQuery = `
    FROM plant_logs pl
    LEFT JOIN plants p ON pl.plant_id = p.id
    LEFT JOIN farms f ON f.id = p.farm_id
    LEFT JOIN users u ON pl.created_by = u.id
    WHERE (pl.is_deleted IS NOT TRUE)
  `;
  const params = [];
  let idx = 1;

  // Authorization check for non-admin
  if (req.user && req.user.role !== 'admin') {
    baseQuery += ` AND (pl.created_by = $${idx} OR f.user_id = $${idx} OR f.id = (SELECT farm_id FROM users WHERE id = $${idx}) OR p.assigned_to_user_id = $${idx}) `;
    params.push(req.user.id);
    idx++;
  }

  // 1. Array of specific IDs (log_ids)
  if (Array.isArray(bodyOrQuery.log_ids) && bodyOrQuery.log_ids.length > 0) {
    const ids = bodyOrQuery.log_ids.map(Number).filter(n => !isNaN(n) && n > 0);
    if (ids.length > 0) {
      baseQuery += ` AND pl.id = ANY($${idx}::int[]) `;
      params.push(ids);
      idx++;
    }
  }

  // 2. Farm filter
  if (bodyOrQuery.farm_id && bodyOrQuery.farm_id !== 'all') {
    baseQuery += ` AND (p.farm_id = $${idx} OR (pl.plant_id IS NULL AND f.id = $${idx})) `;
    params.push(Number(bodyOrQuery.farm_id));
    idx++;
  }

  // 3. Plant filter
  if (bodyOrQuery.plant_id && bodyOrQuery.plant_id !== 'all') {
    if (!isNaN(Number(bodyOrQuery.plant_id))) {
      baseQuery += ` AND (pl.plant_id = $${idx} OR p.tree_code = $${idx}::text) `;
      params.push(Number(bodyOrQuery.plant_id));
      idx++;
    } else {
      baseQuery += ` AND p.tree_code = $${idx} `;
      params.push(String(bodyOrQuery.plant_id).trim());
      idx++;
    }
  }

  // 4. Log Type filter
  if (bodyOrQuery.log_type && bodyOrQuery.log_type !== 'all') {
    baseQuery += ` AND pl.log_type = $${idx} `;
    params.push(String(bodyOrQuery.log_type).trim());
    idx++;
  }

  // 5. Date filter
  if (bodyOrQuery.date_mode === 'single' && bodyOrQuery.date) {
    baseQuery += ` AND pl.log_date = $${idx}::date `;
    params.push(bodyOrQuery.date);
    idx++;
  } else if (bodyOrQuery.date_mode === 'range') {
    if (bodyOrQuery.from_date) {
      baseQuery += ` AND pl.log_date >= $${idx}::date `;
      params.push(bodyOrQuery.from_date);
      idx++;
    }
    if (bodyOrQuery.to_date) {
      baseQuery += ` AND pl.log_date <= $${idx}::date `;
      params.push(bodyOrQuery.to_date);
      idx++;
    }
  } else if (bodyOrQuery.date) {
    baseQuery += ` AND pl.log_date = $${idx}::date `;
    params.push(bodyOrQuery.date);
    idx++;
  }

  // 6. Keyword search
  if (bodyOrQuery.keyword && String(bodyOrQuery.keyword).trim()) {
    baseQuery += ` AND (
      p.tree_code ILIKE $${idx} 
      OR pl.note ILIKE $${idx} 
      OR pl.log_type ILIKE $${idx}
      OR f.name ILIKE $${idx}
      OR CAST(pl.details AS TEXT) ILIKE $${idx}
    ) `;
    params.push(`%${String(bodyOrQuery.keyword).trim()}%`);
    idx++;
  }

  return { baseQuery, params };
}

// POST /api/plants/logs/batch-delete/preview — Đếm trước số lượng bản ghi thỏa mãn điều kiện lọc
router.post('/logs/batch-delete/preview', auth, async (req, res) => {
  try {
    const { baseQuery, params } = buildLogFilterQuery(req, req.body || {});
    const countRes = await pool.query(`SELECT COUNT(pl.id)::int as count ${baseQuery}`, params);
    const sampleRes = await pool.query(
      `SELECT pl.id, pl.log_date, pl.log_type, pl.note, COALESCE(p.tree_code, 'Toàn vườn') as tree_code, COALESCE(f.name, 'Trang trại') as farm_name ${baseQuery} ORDER BY pl.log_date DESC, pl.id DESC LIMIT 5`,
      params
    );
    res.json({
      count: countRes.rows[0]?.count || 0,
      samples: sampleRes.rows
    });
  } catch (err) {
    console.error('Batch delete preview error:', err);
    res.status(500).json({ error: 'Lỗi server khi tính toán số lượng bản ghi: ' + err.message });
  }
});

// POST /api/plants/logs/batch-delete — Thực thi xóa mềm hoặc xóa cứng hàng loạt theo bộ lọc
router.post('/logs/batch-delete', auth, async (req, res) => {
  try {
    const { baseQuery, params } = buildLogFilterQuery(req, req.body || {});
    const isPermanent = req.body.permanent === true && req.user.role === 'admin';

    // Lấy danh sách ID bản ghi khớp điều kiện
    const findRes = await pool.query(`SELECT pl.id, pl.plant_id, pl.log_type, pl.log_date, pl.note, pl.details ${baseQuery}`, params);
    const matchedLogs = findRes.rows;

    if (matchedLogs.length === 0) {
      return res.json({ success: true, count: 0, message: 'Không có nhật ký nào khớp với điều kiện lọc.' });
    }

    const logIds = matchedLogs.map(l => l.id);

    if (isPermanent) {
      await pool.query('DELETE FROM plant_logs WHERE id = ANY($1::int[])', [logIds]);
    } else {
      await pool.query('UPDATE plant_logs SET is_deleted = true, deleted_at = NOW() WHERE id = ANY($1::int[])', [logIds]);
    }

    // Ghi audit log
    const filterDesc = [];
    if (req.body.date) filterDesc.push(`Ngày: ${req.body.date}`);
    if (req.body.from_date || req.body.to_date) filterDesc.push(`Từ ${req.body.from_date || '...'} đến ${req.body.to_date || '...'}`);
    if (req.body.log_type && req.body.log_type !== 'all') filterDesc.push(`Loại: ${req.body.log_type}`);
    if (req.body.plant_id && req.body.plant_id !== 'all') filterDesc.push(`Cây: #${req.body.plant_id}`);
    const filterStr = filterDesc.length > 0 ? ` (${filterDesc.join(', ')})` : '';

    logAuditAction(
      req.user.id,
      req.user.full_name || req.user.email,
      isPermanent ? 'DELETE' : 'DELETE_SOFT',
      'Nhật ký canh tác',
      logIds.length === 1 ? logIds[0] : 0,
      `Xóa ${isPermanent ? 'vĩnh viễn' : 'mềm'} ${logIds.length} nhật ký canh tác${filterStr}`,
      { deleted_count: logIds.length, sample_ids: logIds.slice(0, 50), deleted_ids: logIds },
      {},
      `Xóa ${isPermanent ? 'vĩnh viễn' : 'mềm'} qua bộ lọc chọn lọc`
    );

    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('plants_updated', { message: `Batch ${logIds.length} care logs deleted` });
      broadcast('supplies_updated', { message: `Batch ${logIds.length} care logs deleted` });
    }

    res.json({
      success: true,
      count: logIds.length,
      message: `Đã ${isPermanent ? 'xóa vĩnh viễn' : 'xóa mềm'} thành công ${logIds.length} bản ghi nhật ký canh tác.`
    });
  } catch (err) {
    console.error('Batch delete logs error:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa nhật ký: ' + err.message });
  }
});

// POST /api/plants/logs/:logId/restore — Khôi phục 1 nhật ký đã bị xóa mềm
router.post('/logs/:logId/restore', auth, async (req, res) => {
  try {
    const logId = parseInt(req.params.logId);
    const logRes = await pool.query(
      `SELECT pl.*, p.farm_id, f.user_id as farm_owner_id
       FROM plant_logs pl
       LEFT JOIN plants p ON p.id = pl.plant_id
       LEFT JOIN farms f ON f.id = p.farm_id
       WHERE pl.id = $1`,
      [logId]
    );
    if (logRes.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy nhật ký.' });
    const row = logRes.rows[0];

    const isAuthorized = req.user.role === 'admin' 
      || row.farm_owner_id === req.user.id 
      || row.created_by === req.user.id 
      || (req.user.farm_id && req.user.farm_id === row.farm_id);
    if (!isAuthorized) return res.status(403).json({ error: 'Bạn không có quyền khôi phục nhật ký này.' });

    await pool.query('UPDATE plant_logs SET is_deleted = false, deleted_at = NULL WHERE id = $1', [logId]);

    logAuditAction(
      req.user.id,
      req.user.full_name || req.user.email,
      'UPDATE',
      'Nhật ký canh tác',
      logId,
      `Khôi phục nhật ký "${row.log_type}" của cây #${row.plant_id || row.tree_code || ''}`,
      { is_deleted: true },
      { is_deleted: false }
    );

    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('plants_updated', { message: `Care log #${logId} restored` });
    }

    res.json({ success: true, message: 'Đã khôi phục nhật ký thành công.' });
  } catch (err) {
    console.error('Restore log error:', err);
    res.status(500).json({ error: 'Lỗi server khi khôi phục nhật ký: ' + err.message });
  }
});

// DELETE /api/plants/:plantId/logs/:logId & DELETE /api/plants/logs/:logId — Xóa 1 nhật ký (Hỗ trợ Xóa Mềm mặc định)
router.delete(['/:plantId/logs/:logId', '/logs/:logId'], auth, async (req, res) => {
  try {
    const logId = parseInt(req.params.logId);
    const plantId = req.params.plantId ? parseInt(req.params.plantId) : null;

    let queryStr = `
      SELECT pl.*, p.farm_id, f.user_id as farm_owner_id, p.tree_code
      FROM plant_logs pl
      LEFT JOIN plants p ON p.id = pl.plant_id
      LEFT JOIN farms f ON f.id = p.farm_id
      WHERE pl.id = $1
    `;
    const qParams = [logId];
    if (plantId) {
      queryStr += ` AND pl.plant_id = $2`;
      qParams.push(plantId);
    }

    const currentLog = await pool.query(queryStr, qParams);
    if (currentLog.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi nhật ký cần xóa.' });
    }
    const logRow = currentLog.rows[0];

    const isAuthorized = req.user.role === 'admin' 
      || logRow.farm_owner_id === req.user.id 
      || logRow.created_by === req.user.id 
      || (req.user.farm_id && req.user.farm_id === logRow.farm_id);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa nhật ký này.' });
    }

    const isPermanent = req.query.permanent === 'true' && req.user.role === 'admin';

    if (isPermanent) {
      await pool.query('DELETE FROM plant_logs WHERE id = $1', [logId]);
    } else {
      await pool.query('UPDATE plant_logs SET is_deleted = true, deleted_at = NOW() WHERE id = $1', [logId]);
    }

    logAuditAction(
      req.user.id,
      req.user.full_name || req.user.email,
      isPermanent ? 'DELETE' : 'DELETE_SOFT',
      'Nhật ký canh tác',
      logId,
      `Xóa ${isPermanent ? 'vĩnh viễn' : 'mềm'} nhật ký "${logRow.log_type}" của cây #${logRow.tree_code || logRow.plant_id || ''}`,
      logRow,
      {}
    );

    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('plants_updated', { message: `Care log deleted on plant #${logRow.plant_id}` });
      broadcast('supplies_updated', { message: `Care log deleted on plant #${logRow.plant_id}` });
    }
    
    res.json({ success: true, message: `Đã ${isPermanent ? 'xóa vĩnh viễn' : 'xóa mềm'} nhật ký.` });
  } catch (err) {
    console.error('Delete care log error:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa nhật ký: ' + err.message });
  }
});

// ─── Get Unassigned Trees in Farm (Auth required) ───────────────────
router.get('/farms/:farmId/unassigned-trees', auth, async (req, res) => {
  try {
    const farmId = parseInt(req.params.farmId);
    if (isNaN(farmId)) {
      return res.status(400).json({ error: 'ID nông trại không hợp lệ.' });
    }

    // Permission check
    if (req.user.role !== 'admin' && Number(req.user.farm_id) !== farmId) {
      const farmOwn = await pool.query('SELECT user_id FROM farms WHERE id = $1', [farmId]);
      if (farmOwn.rows.length === 0 || Number(farmOwn.rows[0].user_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập nông trại này.' });
      }
    }

    const { search } = req.query;
    let query = `
      SELECT p.id, p.tree_code, p.plant_type, p.plant_variety, p.health_status, p.location, p.latitude, p.longitude,
             ps.name as schema_name
      FROM plants p
      LEFT JOIN plant_schemas ps ON ps.id = p.schema_id
      WHERE p.farm_id = $1 
        AND (p.nfc_uid IS NULL OR TRIM(p.nfc_uid) = '') 
        AND (p.deleted_at IS NULL)
    `;
    const params = [farmId];

    if (search && search.trim()) {
      query += ` AND (p.tree_code ILIKE $2 OR p.plant_type ILIKE $2 OR p.location ILIKE $2)`;
      params.push(`%${search.trim()}%`);
    }

    query += ` ORDER BY CAST(NULLIF(regexp_replace(p.tree_code, '\\D', '', 'g'), '') AS INTEGER) ASC NULLS LAST, p.tree_code ASC, p.id ASC`;

    const treesRes = await pool.query(query, params);
    res.json({
      success: true,
      farm_id: farmId,
      total_unassigned: treesRes.rows.length,
      trees: treesRes.rows
    });
  } catch (err) {
    console.error('Error fetching unassigned trees:', err);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách cây chưa gắn thẻ: ' + err.message });
  }
});

// ─── Quick On-Site Tag Binding with Strict 1-Tree-1-Tag Governance & Auto GPS ───
router.post('/farms/:farmId/bind-tag-quick', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const farmId = parseInt(req.params.farmId);
    const { nfc_uid, plant_id, tree_code, latitude, longitude, accuracy, allow_replace } = req.body;

    if (isNaN(farmId)) {
      return res.status(400).json({ error: 'ID nông trại không hợp lệ.' });
    }

    // Permission check
    if (req.user.role !== 'admin' && Number(req.user.farm_id) !== farmId) {
      const farmOwn = await pool.query('SELECT user_id FROM farms WHERE id = $1', [farmId]);
      if (farmOwn.rows.length === 0 || Number(farmOwn.rows[0].user_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Bạn không có quyền thực hiện gắn thẻ cho nông trại này.' });
      }
    }

    if (!nfc_uid || !String(nfc_uid).trim()) {
      return res.status(400).json({ error: 'Mã thẻ NFC (UID) là bắt buộc.' });
    }
    const rawUid = String(nfc_uid).trim();
    const cleanUid = (nfcSecurity.sanitizeUid ? nfcSecurity.sanitizeUid(rawUid) : (nfcSecurity.normalizeNfcUid ? nfcSecurity.normalizeNfcUid(rawUid) : rawUid)) || rawUid.toUpperCase();
    const cleanRawUid = cleanUid.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    if (!plant_id && !tree_code) {
      return res.status(400).json({ error: 'Vui lòng chọn hoặc nhập số thứ tự cây cần gắn thẻ.' });
    }

    let lat = latitude !== undefined && latitude !== '' && latitude !== null ? parseFloat(latitude) : null;
    let lng = longitude !== undefined && longitude !== '' && longitude !== null ? parseFloat(longitude) : null;
    let acc = accuracy !== undefined && accuracy !== '' && accuracy !== null ? parseFloat(accuracy) : null;

    if (lat !== null && lng !== null) {
      if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
        const tmp = lat; lat = lng; lng = tmp;
      }
    }

    await client.query('BEGIN');

    // 0. WAREHOUSE INVENTORY CHECK: Verify tag or auto-register for authorized staff
    const invCheck = await client.query(
      `SELECT id, farm_id, status, plant_id, nfc_uid 
       FROM nfc_tags_inventory 
       WHERE (UPPER(nfc_uid) = UPPER($1) OR UPPER(regexp_replace(COALESCE(nfc_uid, ''), '[^A-Za-z0-9]', '', 'g')) = $2)`,
      [cleanUid, cleanRawUid]
    );

    let invItem = null;
    if (invCheck.rows.length === 0) {
      // Auto-register tag into farm warehouse inventory if user is Admin or Farm Manager
      const autoInv = await client.query(
        `INSERT INTO nfc_tags_inventory (farm_id, nfc_uid, status, created_by)
         VALUES ($1, $2, 'available', $3)
         RETURNING id, farm_id, status, plant_id, nfc_uid`,
        [farmId, cleanUid, req.user.id]
      );
      invItem = autoInv.rows[0];
    } else {
      invItem = invCheck.rows[0];
    }

    // Check if tag is allocated to a different farm
    if (invItem.farm_id && Number(invItem.farm_id) !== Number(farmId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        wrong_farm: true,
        error: `Thẻ NFC [${cleanUid}] thuộc kho của Trang trại #${invItem.farm_id}, không thể gắn cho cây thuộc Trang trại #${farmId}!`
      });
    }

    // Check if tag is revoked/frozen
    if (invItem.status === 'revoked') {
      await client.query('ROLLBACK');
      return res.status(410).json({
        is_revoked: true,
        error: `Thẻ NFC [${cleanUid}] đã bị thu hồi / khóa bảo mật và không thể tái sử dụng.`
      });
    }

    // 1. Find target plant by plant_id, tree_code, or numeric ID
    let targetPlant = null;
    if (plant_id) {
      const pRes = await client.query('SELECT * FROM plants WHERE id = $1 AND farm_id = $2 AND deleted_at IS NULL LIMIT 1 FOR UPDATE', [parseInt(plant_id), farmId]);
      if (pRes.rows.length > 0) targetPlant = pRes.rows[0];
    }
    if (!targetPlant && tree_code) {
      const cleanCode = String(tree_code).trim();
      const codeWithoutHash = cleanCode.replace(/^#/, '');
      const rawCode = cleanCode.replace(/[^A-Za-z0-9]/g, '');
      const isPureDigits = /^\d+$/.test(codeWithoutHash);
      const intDigits = isPureDigits ? parseInt(codeWithoutHash, 10) : null;

      const pRes = await client.query(
        `SELECT * FROM plants 
         WHERE farm_id = $1
           AND (
             id::text = $2
             OR UPPER(tree_code) = UPPER($2)
             OR UPPER(tree_code) = UPPER($3)
             OR UPPER(regexp_replace(COALESCE(tree_code, ''), '[^A-Za-z0-9]', '', 'g')) = UPPER($4)
             OR (
               $5::int IS NOT NULL 
               AND (
                 id = $5::int
                 OR CAST(NULLIF(regexp_replace(tree_code, '\\D', '', 'g'), '') AS INTEGER) = $5::int
               )
             )
           ) 
           AND deleted_at IS NULL 
         ORDER BY (CASE WHEN UPPER(tree_code) = UPPER($2) THEN 1 WHEN UPPER(tree_code) = UPPER($3) THEN 2 ELSE 3 END) ASC, id ASC
         LIMIT 1 
         FOR UPDATE`,
        [farmId, cleanCode, codeWithoutHash, rawCode, intDigits]
      );
      if (pRes.rows.length > 0) targetPlant = pRes.rows[0];
    }

    // If target plant still does not exist, AUTO-CREATE it on-the-fly for this farm
    if (!targetPlant && tree_code) {
      const cleanCode = String(tree_code).trim();
      const newSlug = `${farmId}_${cleanCode.replace(/[^A-Za-z0-9_-]/g, '') || Date.now()}`;
      const pubUrl = generatePublicPlantUrl(farmId, null, cleanUid);
      const insertPlant = await client.query(
        `INSERT INTO plants (farm_id, tree_code, plant_type, plant_variety, health_status, is_public, latitude, longitude, nfc_uid, public_url, created_by, public_slug)
         VALUES ($1, $2, 'Sầu riêng (durian)', 'Dona', 'Tốt', true, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [farmId, cleanCode, lat, lng, cleanUid, pubUrl, req.user.id, newSlug]
      );
      targetPlant = insertPlant.rows[0];
    }

    if (!targetPlant) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Không thể tìm thấy hoặc tạo cây số "${tree_code || plant_id}" trong nông trại này.` });
    }

    let replacedOldUid = null;

    // 2. TREE GOVERNANCE & REPLACEMENT CHECK
    if (targetPlant.nfc_uid && String(targetPlant.nfc_uid).trim().length > 0) {
      const existingTag = targetPlant.nfc_uid.trim().toUpperCase();
      const existingRawTag = existingTag.replace(/[^A-Za-z0-9]/g, '');
      
      // If tapping the exact same tag on the same tree -> allow updating GPS without replacing
      if (existingTag !== cleanUid && existingRawTag !== cleanRawUid) {
        if (!allow_replace) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            can_replace: true,
            conflict: true,
            tree_code: targetPlant.tree_code || targetPlant.id,
            plant_id: targetPlant.id,
            plant_type: targetPlant.plant_type,
            current_uid: targetPlant.nfc_uid,
            new_uid: cleanUid,
            error: `Cây #${targetPlant.tree_code || targetPlant.id} hiện đang gắn thẻ [${targetPlant.nfc_uid}]. Bạn có muốn THAY THẾ bằng thẻ mới này không?`
          });
        }

        // USER CONFIRMED REPLACEMENT: Revoke & Freeze Old Tag permanently
        replacedOldUid = existingTag;
        await client.query(
          `INSERT INTO nfc_tags_inventory (farm_id, nfc_uid, status, plant_id, tagged_at, created_by)
           VALUES ($1, $2, 'revoked', NULL, NULL, $3)
           ON CONFLICT (nfc_uid)
           DO UPDATE SET status = 'revoked', plant_id = NULL, tagged_at = NULL`,
          [farmId, existingTag, req.user.id]
        );
      }
    }

    // 3. Check if cleanUid is already assigned to ANOTHER plant anywhere in the system
    const uidConflict = await client.query(
      `SELECT id, tree_code, farm_id FROM plants 
       WHERE (UPPER(nfc_uid) = UPPER($1) OR UPPER(regexp_replace(COALESCE(nfc_uid, ''), '[^A-Za-z0-9]', '', 'g')) = $2) AND id != $3 AND deleted_at IS NULL`,
      [cleanUid, cleanRawUid, targetPlant.id]
    );
    if (uidConflict.rows.length > 0) {
      await client.query('ROLLBACK');
      const confTree = uidConflict.rows[0];
      return res.status(409).json({
        error: `Mã thẻ NFC [${cleanUid}] đã được gắn cho cây #${confTree.tree_code || confTree.id}. Mỗi thẻ chỉ được gắn cho 1 cây duy nhất.`
      });
    }

    // 4. Generate public URL
    const host = req.get('host') || 'plant-book.onrender.com';
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const publicUrl = `${proto}://${host}/${farmId}/public/${cleanUid}`;

    // 5. Atomic Update Plant
    const updateRes = await client.query(
      `UPDATE plants 
       SET nfc_uid = $1, 
           latitude = COALESCE($2, latitude), 
           longitude = COALESCE($3, longitude), 
           gps_accuracy = COALESCE($4, gps_accuracy),
           nfc_tagged_at = NOW(),
           nfc_tagged_by = $5,
           public_url = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [cleanUid, lat, lng, acc, req.user.id, publicUrl, targetPlant.id]
    );

    const updatedPlant = updateRes.rows[0];

    // 6. Update NFC Inventory for the newly assigned tag
    await client.query(
      `UPDATE nfc_tags_inventory 
       SET farm_id = $1, 
           status = 'assigned', 
           plant_id = $2, 
           last_scanned_lat = COALESCE($3, last_scanned_lat), 
           last_scanned_lng = COALESCE($4, last_scanned_lng), 
           tagged_at = NOW()
       WHERE id = $5`,
      [farmId, targetPlant.id, lat, lng, invItem.id]
    );

    await client.query('COMMIT');

    // Safe async audit logging after commit
    try {
      await logAuditAction(
        req.user.id,
        req.user.full_name || req.user.email,
        replacedOldUid ? 'NFC_REPLACE' : 'NFC_BIND',
        'Cây trồng',
        updatedPlant.id,
        `Gắn thẻ NFC [${cleanUid}] cho Cây #${updatedPlant.tree_code || updatedPlant.id}`,
        { old_uid: replacedOldUid },
        { nfc_uid: cleanUid, tree_code: updatedPlant.tree_code, lat, lng },
        `Gắn thẻ NFC thực địa tại trang trại #${farmId}`
      );
    } catch(auditErr) { /* ignore non-critical audit log error */ }

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated', { plant_id: updatedPlant.id, farm_id: farmId, action: 'nfc_tagged_quick' });

    res.json({
      success: true,
      message: replacedOldUid 
        ? `Đã thay thế thẻ mới ${cleanUid} cho cây #${updatedPlant.tree_code || updatedPlant.id} và thu hồi thẻ cũ ${replacedOldUid}!`
        : `Đã gắn thẻ NFC ${cleanUid} và định vị GPS cho cây #${updatedPlant.tree_code || updatedPlant.id} thành công!`,
      plant: updatedPlant,
      public_url: publicUrl,
      replaced_old_uid: replacedOldUid
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error quick binding NFC tag and GPS:', err);
    res.status(500).json({ error: 'Lỗi server khi gắn thẻ và GPS: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── Single Plant High-Precision Provisioning via Smart NFC Gateway /sub ───
router.post(['/single-provision', '/plants/single-provision'], auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      farm_id,
      tree_code,
      plant_variety,
      plant_type,
      planting_date,
      plant_age,
      plot_code,
      row_number,
      latitude,
      longitude,
      gps_accuracy,
      location,
      cover_image,
      photo_url,
      nfc_uid,
      initial_yield,
      health_status,
      notes,
      past_diseases,
      initial_growth_stage,
      puc_code,
      passport_standard,
      vietgap_cert_number,
      vietgap_cert_org,
      seed_origin,
      batch_code
    } = req.body;

    const farmId = parseInt(farm_id || req.user.farm_id);
    if (!farmId || isNaN(farmId)) {
      return res.status(400).json({ error: 'Mã trang trại là bắt buộc.' });
    }

    // Permission check
    if (req.user.role !== 'admin' && Number(req.user.farm_id) !== farmId) {
      const farmOwn = await pool.query('SELECT user_id FROM farms WHERE id = $1', [farmId]);
      if (farmOwn.rows.length === 0 || Number(farmOwn.rows[0].user_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Bạn không có quyền thêm cây vào trang trại này.' });
      }
    }

    let lat = latitude !== undefined && latitude !== '' && latitude !== null ? parseFloat(latitude) : null;
    let lng = longitude !== undefined && longitude !== '' && longitude !== null ? parseFloat(longitude) : null;
    let acc = gps_accuracy !== undefined && gps_accuracy !== '' && gps_accuracy !== null ? parseFloat(gps_accuracy) : null;

    if (lat !== null && lng !== null) {
      if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
        const tmp = lat; lat = lng; lng = tmp;
      }
    }

    let cleanUid = null;
    if (nfc_uid && String(nfc_uid).trim()) {
      const rawUid = String(nfc_uid).trim();
      cleanUid = (nfcSecurity.sanitizeUid ? nfcSecurity.sanitizeUid(rawUid) : (nfcSecurity.normalizeNfcUid ? nfcSecurity.normalizeNfcUid(rawUid) : rawUid)) || rawUid.toUpperCase();
    }

    // Check plot & ensure plot exists in farm_plots (safely outside transaction)
    const finalPlot = plot_code && String(plot_code).trim() ? String(plot_code).trim().toUpperCase() : 'A1';
    const finalRow = row_number && parseInt(row_number) ? parseInt(row_number) : 1;

    try {
      const existingPlot = await pool.query(
        'SELECT id FROM farm_plots WHERE farm_id = $1 AND UPPER(plot_code) = UPPER($2) LIMIT 1',
        [farmId, finalPlot]
      );
      if (existingPlot.rows.length === 0) {
        await pool.query(
          'INSERT INTO farm_plots (farm_id, plot_code, plot_name) VALUES ($1, $2, $3)',
          [farmId, finalPlot, `Lô ${finalPlot}`]
        );
      }
    } catch (_) {}

    // Check tree_code or generate auto tree_code
    let finalCode = tree_code && String(tree_code).trim() ? String(tree_code).trim() : null;
    if (!finalCode) {
      const countRes = await pool.query('SELECT COUNT(*)::int as count FROM plants WHERE farm_id = $1', [farmId]);
      const nextNum = (countRes.rows[0].count || 0) + 1;
      finalCode = `C${String(nextNum).padStart(3, '0')}`;
    }

    // Generate public slug
    const cleanVarietySlug = (plant_variety || plant_type || 'tree')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');
    const cleanCodeSlug = finalCode.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const randomSuffix = Math.floor(Math.random() * 89999 + 10000);
    const publicSlug = `${cleanVarietySlug}-${finalPlot.toLowerCase()}-${cleanCodeSlug}-${randomSuffix}`;

    const effectiveCover = photo_url || cover_image || null;
    const pastDiseasesList = Array.isArray(past_diseases) ? past_diseases : (past_diseases ? [past_diseases] : []);

    const plantMetadata = {
      gps_accuracy: acc,
      provision_source: 'sub_gateway',
      past_diseases: pastDiseasesList,
      initial_growth_stage: initial_growth_stage || null,
      initial_yield: initial_yield ? parseFloat(initial_yield) : 0,
      puc_code: puc_code || null,
      passport_standard: passport_standard || null,
      vietgap_cert_number: vietgap_cert_number || null,
      vietgap_cert_org: vietgap_cert_org || null,
      seed_origin: seed_origin || null,
      batch_code: batch_code || null
    };

    // BEGIN Transaction for core plant creation
    await client.query('BEGIN');

    // Insert plant
    const plantInsert = await client.query(`
      INSERT INTO plants (
        farm_id, tree_code, plant_variety, plant_type, planting_date,
        plant_age, plot_code, row_number, latitude, longitude,
        location, cover_image, nfc_uid, public_slug, health_status,
        data, is_public, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, true, $17
      ) RETURNING *
    `, [
      farmId, finalCode, plant_variety || 'Sầu riêng Ri6', plant_type || 'Sầu riêng', planting_date || null,
      plant_age || null, finalPlot, finalRow, lat, lng,
      location || `Lô ${finalPlot} - Hàng ${finalRow}`, effectiveCover, cleanUid, publicSlug, health_status || 'Tốt',
      JSON.stringify(plantMetadata), req.user.id
    ]);
    const newPlant = plantInsert.rows[0];

    // Auto-increment total_plants on farm
    await client.query('UPDATE farms SET total_plants = COALESCE(total_plants, 0) + 1 WHERE id = $1', [farmId]);

    // Sync farm passport certificates if supplied
    if (puc_code || vietgap_cert_number || vietgap_cert_org) {
      try {
        await client.query(`
          UPDATE farms 
          SET puc_code = COALESCE(puc_code, $1),
              vietgap_cert_number = COALESCE(vietgap_cert_number, $2),
              vietgap_cert_org = COALESCE(vietgap_cert_org, $3)
          WHERE id = $4
        `, [puc_code || null, vietgap_cert_number || null, vietgap_cert_org || null, farmId]);
      } catch (_) {}
    }

    await client.query('COMMIT');

    // URLs
    const origin = (process.env.APP_URL || 'https://dev-plantbook.onrender.com').replace(/\/$/, '');
    const uidSuffix = cleanUid ? `/${encodeURIComponent(cleanUid)}` : '';
    const hierarchicalUrl = `${origin}/${farmId}/${newPlant.id}${uidSuffix}`;
    const publicUrl = `${origin}/plant/${newPlant.public_slug}`;

    // Update public_url in DB
    try {
      await pool.query('UPDATE plants SET public_url = $1 WHERE id = $2', [hierarchicalUrl, newPlant.id]);
      newPlant.public_url = hierarchicalUrl;
    } catch (_) {}

    // Record initial photo in plant_media if provided
    if (effectiveCover) {
      try {
        await pool.query(`
          INSERT INTO plant_media (plant_id, object_name, url, caption, media_type, uploaded_at)
          VALUES ($1, $2, $3, $4, 'image', NOW())
        `, [newPlant.id, `growth_${newPlant.id}_${Date.now()}.jpg`, effectiveCover, initial_growth_stage || 'Ảnh chụp hiện trường khởi tạo']);
      } catch (mediaErr) {
        console.warn('Plant media insert notice:', mediaErr.message);
      }
    }

    // Record NFC UID in nfc_tags_inventory if provided
    if (cleanUid) {
      try {
        const invCheck = await pool.query('SELECT id FROM nfc_tags_inventory WHERE UPPER(nfc_uid) = UPPER($1) LIMIT 1', [cleanUid]);
        if (invCheck.rows.length > 0) {
          await pool.query(
            `UPDATE nfc_tags_inventory 
             SET farm_id = $1, plant_id = $2, status = 'assigned', tagged_at = NOW() 
             WHERE UPPER(nfc_uid) = UPPER($3)`,
            [farmId, newPlant.id, cleanUid]
          );
        } else {
          await pool.query(
            `INSERT INTO nfc_tags_inventory (nfc_uid, farm_id, plant_id, status, assigned_at, tagged_at)
             VALUES ($1, $2, $3, 'assigned', NOW(), NOW())`,
            [cleanUid, farmId, newPlant.id]
          );
        }
      } catch (nfcErr) {
        console.warn('NFC inventory update notice:', nfcErr.message);
      }
    }

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated', { plant_id: newPlant.id, farm_id: farmId, action: 'single_provision' });

    res.status(201).json({
      success: true,
      message: `Đã khai báo thành công cây #${newPlant.tree_code}!`,
      plant: newPlant,
      nfc_uid: cleanUid,
      public_url: publicUrl,
      hierarchical_url: hierarchicalUrl,
      gps_accuracy: acc
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error in single-provision:', err);
    res.status(500).json({ error: 'Lỗi server khi khai báo cây: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── Verify NFC Physical Tag Write Success ───
router.post(['/nfc/verify-write', '/plants/nfc/verify-write'], auth, async (req, res) => {
  try {
    const { plant_id, nfc_uid, written_url } = req.body;
    if (!plant_id) {
      return res.status(400).json({ error: 'Mã cây trồng là bắt buộc.' });
    }

    await pool.query(`
      INSERT INTO user_activities (user_id, activity_type, description)
      VALUES ($1, 'Ghi Thẻ NFC Thành Công', $2)
    `, [req.user.id, `Đã ghi thành công URL [${written_url || 'N/A'}] vào thẻ NFC [${nfc_uid || 'N/A'}] cho Cây #${plant_id}`]);

    res.json({
      success: true,
      message: 'Đã xác nhận ghi thẻ NFC thành công!',
      verified_at: new Date()
    });
  } catch (err) {
    console.error('Error verifying NFC write:', err);
    res.status(500).json({ error: 'Lỗi server khi xác thực ghi thẻ: ' + err.message });
  }
});

// ─── Public Farm Gateway & Smart NFC Portal: /farms/:farmId/public-portal ───
router.get('/farms/:farmId/public-portal', async (req, res) => {
  try {
    const farmId = parseInt(req.params.farmId);
    if (isNaN(farmId)) {
      return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });
    }

    const farmRes = await pool.query(`
      SELECT f.id, f.name, f.description, f.address, f.puc_code, f.vietgap_cert_number, f.vietgap_cert_org,
             f.polygon_coordinates, f.latitude, f.longitude, f.user_id,
             u.full_name as owner_name, u.phone as owner_phone, u.email as owner_email
      FROM farms f
      LEFT JOIN users u ON u.id = f.user_id
      WHERE f.id = $1 AND (f.is_deleted IS NOT TRUE)
      LIMIT 1
    `, [farmId]);

    if (farmRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }

    const farm = farmRes.rows[0];

    const plantsRes = await pool.query(`
      SELECT p.id, p.tree_code, p.plant_type, p.plant_variety, p.health_status, p.location,
             p.latitude, p.longitude, p.nfc_uid, p.public_url, p.public_slug
      FROM plants p
      WHERE p.farm_id = $1 AND (p.deleted_at IS NULL)
      ORDER BY CAST(NULLIF(regexp_replace(p.tree_code, '\\D', '', 'g'), '') AS INTEGER) ASC NULLS LAST, p.tree_code ASC, p.id ASC
    `, [farmId]);

    const totalPlants = plantsRes.rows.length;
    const assignedCount = plantsRes.rows.filter(p => p.nfc_uid && p.nfc_uid.trim().length > 0).length;
    const unassignedCount = totalPlants - assignedCount;

    // Fetch farm supplies inventory and investment costs
    let supplies = [];
    let totalInvestment = 0;
    try {
      const suppliesRes = await pool.query(`
        SELECT s.id, s.name, s.category, s.package_size, s.package_qty, s.package_price, 
               s.unit_price, s.unit, s.stock_quantity, s.image_url, s.active_ingredient, 
               s.target_pests, s.phi_days, s.note,
               COALESCE(SUM(su.total_cost), 0) as total_spent,
               COALESCE(SUM(su.quantity), 0) as total_used_qty
        FROM supplies s
        LEFT JOIN supply_usages su ON su.supply_id = s.id AND su.farm_id = $1
        WHERE (
          s.farm_id = $1 
          OR s.user_id = $2 
          OR s.user_id IN (SELECT id FROM users WHERE farm_id = $1)
          OR s.id IN (SELECT supply_id FROM supply_usages WHERE farm_id = $1)
        )
        GROUP BY s.id
        ORDER BY s.category ASC, s.name ASC
      `, [farmId, farm.user_id]);
      supplies = suppliesRes.rows;
      totalInvestment = supplies.reduce((sum, s) => sum + parseFloat(s.total_spent || 0), 0);
    } catch(supErr) {
      console.warn('Error fetching farm supplies for portal:', supErr.message);
    }

    res.json({
      success: true,
      farm: {
        ...farm,
        total_plants: totalPlants,
        assigned_count: assignedCount,
        unassigned_count: unassignedCount,
        total_investment: totalInvestment,
        total_supplies_count: supplies.length
      },
      plants: plantsRes.rows,
      supplies: supplies
    });
  } catch (err) {
    console.error('Error loading public farm portal:', err);
    res.status(500).json({ error: 'Lỗi server khi tải thông tin trang trại: ' + err.message });
  }
});

// ─── Public Tag State Lookup by Farm & NFC UID: /public-by-farm-uid/:farmId/:nfcUid ───
router.get('/public-by-farm-uid/:farmId/:nfcUid', async (req, res) => {
  try {
    const farmId = parseInt(req.params.farmId);
    const nfcUidRaw = req.params.nfcUid ? req.params.nfcUid.trim() : '';
    const cleanUid = (nfcSecurity.sanitizeUid ? nfcSecurity.sanitizeUid(nfcUidRaw) : (nfcSecurity.normalizeNfcUid ? nfcSecurity.normalizeNfcUid(nfcUidRaw) : nfcUidRaw)) || nfcUidRaw.toUpperCase();
    const cleanRawUid = cleanUid.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    if (isNaN(farmId) || !cleanUid) {
      return res.status(400).json({ error: 'Nông trại hoặc mã thẻ NFC không hợp lệ.' });
    }

    // 1. Verify Farm exists
    const farmCheck = await pool.query(
      'SELECT id, name, address, puc_code, vietgap_cert_number, vietgap_cert_org, polygon_coordinates, user_id FROM farms WHERE id = $1 AND (is_deleted IS NOT TRUE)',
      [farmId]
    );
    if (farmCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Nông trại không tồn tại trên hệ thống.' });
    }
    const farm = farmCheck.rows[0];

    // 2. Check if a plant is assigned this NFC UID (any format, prioritizing current farm)
    const plantQuery = await pool.query(
      `SELECT p.*, 
              p.latitude,
              p.longitude,
              p.gps_accuracy,
              ps.name as schema_name, ps.fields as schema_fields,
              f.name as farm_name, f.address as farm_address, f.puc_code, f.vietgap_cert_number, f.vietgap_cert_org,
              f.polygon_coordinates as farm_polygon, f.user_id as farm_owner_user_id,
              u.full_name as owner_name, u.phone as owner_phone, u.email as owner_email
       FROM plants p 
       LEFT JOIN plant_schemas ps ON ps.id = p.schema_id
       LEFT JOIN farms f ON f.id = p.farm_id
       LEFT JOIN users u ON u.id = f.user_id
       WHERE (
         p.nfc_uid IS NOT NULL AND p.nfc_uid != '' AND (
           UPPER(p.nfc_uid) = UPPER($1) 
           OR UPPER(replace(replace(p.nfc_uid, ':', ''), '-', '')) = $2
           OR UPPER(regexp_replace(p.nfc_uid, '[^A-Za-z0-9]', '', 'g')) = $2
           OR UPPER(p.nfc_uid) = UPPER($3)
         )
       ) 
       AND (p.deleted_at IS NULL)
       ORDER BY (CASE WHEN p.farm_id = $4 THEN 1 ELSE 2 END) ASC, p.id DESC
       LIMIT 1`,
      [cleanUid, cleanRawUid, nfcUidRaw, farmId]
    );

    if (plantQuery.rows.length > 0) {
      const row = plantQuery.rows[0];
      const media = await pool.query('SELECT * FROM plant_media WHERE plant_id=$1 ORDER BY uploaded_at DESC', [row.id]);
      const logs = await pool.query('SELECT * FROM plant_logs WHERE plant_id=$1 AND (is_deleted IS NOT TRUE) ORDER BY log_date DESC', [row.id]);

      // Data Scrubbing
      const scrubbedLogs = logs.rows.map(log => {
        let safeDetails = {};
        if (log.details) {
          let rawDetails = typeof log.details === 'string' ? JSON.parse(log.details) : { ...log.details };
          delete rawDetails.unit_price;
          delete rawDetails.total_cost;
          delete rawDetails.cost;
          delete rawDetails.package_price;
          delete rawDetails.package_unit;
          delete rawDetails.formula_secret;
          delete rawDetails.supplier_price;
          delete rawDetails.vendor_name;
          delete rawDetails.vendor_phone;
          delete rawDetails.accounting_code;
          delete rawDetails.stock_deducted;
          safeDetails = rawDetails;
        }

        let parsedMediaUrls = [];
        if (log.media_urls) {
          if (Array.isArray(log.media_urls)) {
            parsedMediaUrls = log.media_urls;
          } else if (typeof log.media_urls === 'string') {
            try { parsedMediaUrls = JSON.parse(log.media_urls); } catch (_) { parsedMediaUrls = []; }
          }
        }
        if (parsedMediaUrls.length === 0 && log.media_url) {
          parsedMediaUrls = [{ url: log.media_url, type: /\.(mp4|mov|avi|mkv|webm)/i.test(log.media_url) ? 'video' : 'image' }];
        }

        return {
          id: log.id,
          plant_id: log.plant_id,
          log_date: log.log_date,
          log_type: log.log_type,
          note: log.note,
          details: safeDetails,
          media_url: log.media_url,
          media_urls: parsedMediaUrls,
          created_at: log.created_at
        };
      });

      let farm_boundary = null;
      if (row.farm_polygon) {
        try {
          let coords = typeof row.farm_polygon === 'string' ? JSON.parse(row.farm_polygon) : row.farm_polygon;
          if (Array.isArray(coords) && coords.length > 0) {
            const sanitizeRing = (ring) => ring.map(pt => {
              if (Array.isArray(pt) && pt.length >= 2) {
                let pLng = parseFloat(pt[0]);
                let pLat = parseFloat(pt[1]);
                if (Math.abs(pLat) > 90 && Math.abs(pLng) <= 90) {
                  const tmp = pLat; pLat = pLng; pLng = tmp;
                }
                return [pLng, pLat];
              }
              return pt;
            });
            if (Array.isArray(coords[0]) && !Array.isArray(coords[0][0])) {
              farm_boundary = { type: 'Polygon', coordinates: [sanitizeRing(coords)] };
            } else {
              farm_boundary = { type: 'Polygon', coordinates: coords.map(r => Array.isArray(r) ? sanitizeRing(r) : r) };
            }
          }
        } catch(e) {}
      }

      // Fetch supply usages, total care costs, and available farm supplies
      let supplyUsages = [];
      let totalCareCost = 0;
      let farmSupplies = [];

      try {
        const usagesRes = await pool.query(`
          SELECT su.id, su.supply_id, su.usage_date, su.quantity, su.unit_price, su.total_cost, su.note,
                 s.name as supply_name, s.category as supply_category, s.unit as supply_unit, s.image_url as supply_image_url
          FROM supply_usages su
          LEFT JOIN supplies s ON s.id = su.supply_id
          WHERE su.plant_id = $1
          ORDER BY su.usage_date DESC, su.id DESC
        `, [row.id]);
        supplyUsages = usagesRes.rows;
        totalCareCost = supplyUsages.reduce((sum, u) => sum + parseFloat(u.total_cost || 0), 0);

        const farmSuppliesRes = await pool.query(`
          SELECT s.id, s.name, s.category, s.package_size, s.package_qty, s.package_price, 
                 s.unit_price, s.unit, s.stock_quantity, s.image_url, s.active_ingredient, 
                 s.target_pests, s.phi_days, s.note
          FROM supplies s
          WHERE (
            ($2::int IS NOT NULL AND (
              s.farm_id = $2 
              OR (s.user_id = $1 AND s.farm_id IS NULL AND $1 != 1)
              OR s.id IN (SELECT supply_id FROM supply_usages WHERE plant_id = $3)
            ))
            OR ($2::int IS NULL AND (
              (s.user_id = $1 AND ($1 != 1 OR $3 IS NOT NULL))
              OR s.id IN (SELECT supply_id FROM supply_usages WHERE plant_id = $3)
            ))
          )
          ORDER BY s.category ASC, s.name ASC
        `, [row.farm_owner_user_id || farm.user_id, farmId || row.farm_id, row.id]);
        farmSupplies = farmSuppliesRes.rows;
      } catch (supErr) {
        console.warn('Error fetching supply usages for plant:', supErr.message);
      }

      return res.json({
        assigned: true,
        in_inventory: true,
        farm_id: farmId,
        nfc_uid: cleanUid,
        plant: { 
          ...row, 
          media: media.rows, 
          logs: scrubbedLogs, 
          farm_boundary,
          supply_usages: supplyUsages,
          total_cost: totalCareCost,
          farm_supplies: farmSupplies
        }
      });
    }

    // 3. Not assigned to any plant in this farm -> check inventory status
    const invCheck = await pool.query(
      `SELECT id, farm_id, status, plant_id 
       FROM nfc_tags_inventory 
       WHERE (UPPER(nfc_uid) = UPPER($1) OR UPPER(regexp_replace(COALESCE(nfc_uid, ''), '[^A-Za-z0-9]', '', 'g')) = $2)`,
      [cleanUid, cleanRawUid]
    );

    if (invCheck.rows.length === 0) {
      // Uninventoried tag: allow seamless field binding for farm staff/admin
      return res.json({
        assigned: false,
        in_inventory: true,
        is_new_tag: true,
        farm_id: farmId,
        farm_name: farm.name,
        puc_code: farm.puc_code,
        nfc_uid: cleanUid
      });
    }

    const invItem = invCheck.rows[0];

    if (invItem.farm_id && Number(invItem.farm_id) !== Number(farmId)) {
      return res.json({
        assigned: false,
        in_inventory: false,
        wrong_farm: true,
        tag_farm_id: invItem.farm_id,
        farm_id: farmId,
        farm_name: farm.name,
        puc_code: farm.puc_code,
        nfc_uid: cleanUid,
        inventory_warning: `Thẻ NFC [${cleanUid}] thuộc kho của Trang trại #${invItem.farm_id}, không thể sử dụng tại Trang trại #${farmId}.`
      });
    }

    if (invItem.status === 'revoked') {
      return res.status(410).json({
        assigned: false,
        is_revoked: true,
        farm_id: farmId,
        nfc_uid: cleanUid,
        error: `Thẻ NFC [${cleanUid}] này đã bị thu hồi / khóa bảo mật. Không thể gán thẻ này vào cây.`
      });
    }

    // Return unassigned valid inventory response for on-site binding
    return res.json({
      assigned: false,
      in_inventory: true,
      farm_id: farmId,
      farm_name: farm.name,
      puc_code: farm.puc_code,
      nfc_uid: cleanUid
    });
  } catch (err) {
    console.error('Error lookup plant by farm and NFC UID:', err);
    res.status(500).json({ error: 'Lỗi server khi tra cứu thẻ NFC: ' + err.message });
  }
});

// ─── Public routes ────────────────────────────────────────────────
router.get('/public/:slug', async (req, res) => {
  try {
    const slugParam = req.params.slug.trim();
    const plant = await pool.query(
      `SELECT p.*, 
              p.latitude,
              p.longitude,
              ps.name as schema_name, ps.fields as schema_fields,
              f.name as farm_name, f.address as farm_address, f.puc_code, f.vietgap_cert_number, f.vietgap_cert_org,
              f.polygon_coordinates as farm_polygon, f.user_id as farm_owner_user_id,
              u.full_name as owner_name, u.phone as owner_phone, u.email as owner_email
       FROM plants p 
       LEFT JOIN plant_schemas ps ON ps.id = p.schema_id
       LEFT JOIN farms f ON f.id = p.farm_id
       LEFT JOIN users u ON u.id = f.user_id
       WHERE (p.public_slug=$1 OR p.id::text=$1 OR UPPER(p.nfc_uid)=UPPER($1)) AND p.is_public=true`, [slugParam]
    );
    if (plant.rows.length === 0) {
      // Check if this slugParam was an unassigned or revoked NFC tag in inventory
      const invRevoked = await pool.query(
        'SELECT nfc_uid, status, plant_id FROM nfc_tags_inventory WHERE UPPER(nfc_uid) = UPPER($1)',
        [slugParam]
      );
      if (invRevoked.rows.length > 0) {
        return res.status(410).json({
          error: `Thẻ NFC [${slugParam}] này đã bị thu hồi hoặc thay thế. Đường dẫn công khai cũ đã bị đóng băng truy cập.`,
          is_revoked: true,
          nfc_uid: slugParam
        });
      }
      return res.status(404).json({ error: 'Trang cây không tồn tại hoặc chưa công khai.' });
    }

    const media = await pool.query('SELECT * FROM plant_media WHERE plant_id=$1 ORDER BY uploaded_at DESC', [plant.rows[0].id]);
    const logs = await pool.query('SELECT * FROM plant_logs WHERE plant_id=$1 AND (is_deleted IS NOT TRUE) ORDER BY log_date DESC', [plant.rows[0].id]);

    // Data Scrubbing: Remove confidential financial and proprietary formula data
    const scrubbedLogs = logs.rows.map(log => {
      let safeDetails = {};
      if (log.details) {
        let rawDetails = typeof log.details === 'string' ? JSON.parse(log.details) : { ...log.details };
        delete rawDetails.unit_price;
        delete rawDetails.total_cost;
        delete rawDetails.cost;
        delete rawDetails.package_price;
        delete rawDetails.package_unit;
        delete rawDetails.formula_secret;
        delete rawDetails.supplier_price;
        delete rawDetails.vendor_name;
        delete rawDetails.vendor_phone;
        delete rawDetails.accounting_code;
        delete rawDetails.stock_deducted;
        safeDetails = rawDetails;
      }

      let parsedMediaUrls = [];
      if (log.media_urls) {
        if (Array.isArray(log.media_urls)) {
          parsedMediaUrls = log.media_urls;
        } else if (typeof log.media_urls === 'string') {
          try { parsedMediaUrls = JSON.parse(log.media_urls); } catch (_) { parsedMediaUrls = []; }
        }
      }
      if (parsedMediaUrls.length === 0 && log.media_url) {
        parsedMediaUrls = [{ url: log.media_url, type: /\.(mp4|mov|avi|mkv|webm)/i.test(log.media_url) ? 'video' : 'image' }];
      }

      return {
        id: log.id,
        plant_id: log.plant_id,
        log_date: log.log_date,
        log_type: log.log_type,
        note: log.note,
        details: safeDetails,
        media_url: log.media_url,
        media_urls: parsedMediaUrls,
        created_at: log.created_at
      };
    });

    // Build GeoJSON geometry for the farm boundary polygon
    const row = plant.rows[0];

    // Tự động kiểm tra và hoán đổi tọa độ nếu latitude > 90 (bị lưu ngược)
    let plantLat = parseFloat(row.latitude);
    let plantLng = parseFloat(row.longitude);
    if (!isNaN(plantLat) && !isNaN(plantLng)) {
      if (Math.abs(plantLat) > 90 && Math.abs(plantLng) <= 90) {
        const tmp = plantLat;
        plantLat = plantLng;
        plantLng = tmp;
      }
      row.latitude = plantLat;
      row.longitude = plantLng;
    }

    let farm_boundary = null;
    if (row.farm_polygon) {
      try {
        let coords = typeof row.farm_polygon === 'string' ? JSON.parse(row.farm_polygon) : row.farm_polygon;
        if (Array.isArray(coords) && coords.length > 0) {
          // Chuẩn hóa tọa độ [lng, lat] cho từng điểm polygon
          const sanitizeRing = (ring) => {
            return ring.map(pt => {
              if (Array.isArray(pt) && pt.length >= 2) {
                let pLng = parseFloat(pt[0]);
                let pLat = parseFloat(pt[1]);
                if (Math.abs(pLat) > 90 && Math.abs(pLng) <= 90) {
                  const tmp = pLat; pLat = pLng; pLng = tmp;
                }
                return [pLng, pLat];
              }
              return pt;
            });
          };

          // If coords is 2D [[lng, lat], ...], wrap it in an outer array to make it a valid GeoJSON Polygon coordinates array
          if (Array.isArray(coords[0]) && !Array.isArray(coords[0][0])) {
            farm_boundary = { type: 'Polygon', coordinates: [sanitizeRing(coords)] };
          } else {
            farm_boundary = { type: 'Polygon', coordinates: coords.map(r => Array.isArray(r) ? sanitizeRing(r) : r) };
          }
        }
      } catch(e) { /* ignore parse errors */ }
    }

    // Fetch supply usages, total care costs, and available farm supplies
    let supplyUsages = [];
    let totalCareCost = 0;
    let farmSupplies = [];

    try {
      const usagesRes = await pool.query(`
        SELECT su.id, su.supply_id, su.usage_date, su.quantity, su.unit_price, su.total_cost, su.note,
               s.name as supply_name, s.category as supply_category, s.unit as supply_unit, s.image_url as supply_image_url
        FROM supply_usages su
        LEFT JOIN supplies s ON s.id = su.supply_id
        WHERE su.plant_id = $1
        ORDER BY su.usage_date DESC, su.id DESC
      `, [row.id]);
      supplyUsages = usagesRes.rows;
      totalCareCost = supplyUsages.reduce((sum, u) => sum + parseFloat(u.total_cost || 0), 0);

      const farmSuppliesRes = await pool.query(`
        SELECT s.id, s.name, s.category, s.package_size, s.package_qty, s.package_price, 
               s.unit_price, s.unit, s.stock_quantity, s.image_url, s.active_ingredient, 
               s.target_pests, s.phi_days, s.note
        FROM supplies s
        WHERE (
          ($2::int IS NOT NULL AND (
            s.farm_id = $2 
            OR (s.user_id = $1 AND s.farm_id IS NULL AND $1 != 1)
            OR s.id IN (SELECT supply_id FROM supply_usages WHERE plant_id = $3)
          ))
          OR ($2::int IS NULL AND (
            (s.user_id = $1 AND ($1 != 1 OR $3 IS NOT NULL))
            OR s.id IN (SELECT supply_id FROM supply_usages WHERE plant_id = $3)
          ))
        )
        ORDER BY s.category ASC, s.name ASC
      `, [row.farm_owner_user_id || row.created_by, row.farm_id, row.id]);
      farmSupplies = farmSuppliesRes.rows;
    } catch (supErr) {
      console.warn('Error fetching supply usages for plant:', supErr.message);
    }

    res.json({ 
      ...row, 
      media: media.rows, 
      logs: scrubbedLogs, 
      farm_boundary,
      supply_usages: supplyUsages,
      total_cost: totalCareCost,
      farm_supplies: farmSupplies
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// Helper: Validate Full NFC UID (at least 4 hex pairs separated by : or - OR continuous hex string of 8-20 chars)
function isFullNfcUid(uid) {
  if (!uid || typeof uid !== 'string') return false;
  const clean = decodeURIComponent(uid).trim();
  if (/^([0-9A-Fa-f]{2}[:-]){3,9}[0-9A-Fa-f]{2}$/.test(clean)) return true;
  if (/^[0-9A-Fa-f]{8,20}$/.test(clean) && !isNaN(Number('0x' + clean))) return true;
  return false;
}

// Update plant health status (Requires login from the same farm or Admin)
router.patch('/public/:slug/health', async (req, res) => {
  try {
    const { health_status } = req.body;
    if (!['Tốt', 'Bình thường', 'Cần chú ý', 'Bệnh'].includes(health_status)) {
      return res.status(400).json({ error: 'Trạng thái sức khỏe không hợp lệ.' });
    }
    const slugParam = req.params.slug.trim();

    // 1. Find plant
    const plantFind = await pool.query(
      `SELECT id FROM plants WHERE (public_slug = $1 OR id::text = $1 OR UPPER(nfc_uid) = UPPER($1)) LIMIT 1`,
      [slugParam]
    );
    if (plantFind.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ cây trồng.' });
    }
    const plantId = plantFind.rows[0].id;

    // 2. Strict farm permission check
    const access = await verifyPlantAccess(req, plantId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const result = await pool.query(
      `UPDATE plants SET health_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [health_status, plantId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update health error:', err);
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
});

// ─── Update plant GPS location publicly via Full NFC Tag Scan ─────────────
router.all('/public/:slug/gps', async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Phương thức không được hỗ trợ.' });
  }

  try {
    const { latitude, longitude, nfc_uid } = req.body;
    const targetParam = req.params.slug ? req.params.slug.trim() : '';
    const activeNfcUid = nfc_uid || targetParam;

    // Strict validation: Only allow automatic GPS update if opened via valid Full NFC UID
    if (!isFullNfcUid(activeNfcUid)) {
      return res.status(400).json({ 
        error: 'Chỉ cho phép tự động cập nhật vị trí GPS khi quét bằng thẻ NFC hợp lệ (Full NFC UID).' 
      });
    }

    let lat = parseFloat(latitude);
    let lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Tọa độ GPS không hợp lệ.' });
    }

    // Auto-swap if latitude and longitude were reversed
    if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
      const tmp = lat;
      lat = lng;
      lng = tmp;
    }

    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ error: 'Tọa độ GPS nằm ngoài phạm vi cho phép.' });
    }

    // Find target plant by slug, ID, or NFC UID
    const plantRes = await pool.query(
      `SELECT id, tree_code, plant_type, plant_variety, farm_id, nfc_uid, latitude, longitude 
       FROM plants 
       WHERE (id::text = $1 OR public_slug = $1 OR UPPER(nfc_uid) = UPPER($1) OR UPPER(nfc_uid) = UPPER($2))
       LIMIT 1`,
      [targetParam, activeNfcUid]
    );

    if (plantRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ cây trồng.' });
    }

    const currentPlant = plantRes.rows[0];
    const cleanNfcUid = activeNfcUid || currentPlant.nfc_uid || '';
    const publicUrl = generatePublicPlantUrl(currentPlant.farm_id, currentPlant.id, cleanNfcUid);

    // Update GPS coordinates and public_url in database
    const updateRes = await pool.query(
      `UPDATE plants 
       SET latitude = $1, longitude = $2, public_url = $3, updated_at = NOW() 
       WHERE id = $4 
       RETURNING id, tree_code, plant_type, plant_variety, farm_id, nfc_uid, latitude, longitude, public_url, updated_at`,
      [lat, lng, publicUrl, currentPlant.id]
    );

    const updated = updateRes.rows[0];

    // Broadcast update via WebSocket to Admin & User portals
    if (global.broadcastWS) {
      global.broadcastWS('plants_updated', {
        plant_id: updated.id,
        farm_id: updated.farm_id,
        latitude: updated.latitude,
        longitude: updated.longitude,
        action: 'nfc_gps_sync'
      });
    }

    res.json({
      success: true,
      message: `Đã cập nhật vị trí GPS (${lat.toFixed(6)}, ${lng.toFixed(6)}) cho cây #${updated.tree_code || updated.id}`,
      plant: updated,
      public_url: publicUrl
    });
  } catch (err) {
    console.error('Error updating plant GPS via NFC:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật GPS: ' + err.message });
  }
});


// Submit care log (Requires login from the same farm or Admin)
router.post('/public/:slug/logs', upload.array('files', 12), async (req, res) => {
  try {
    const slugParam = req.params.slug.trim();
    const cleanRawUid = slugParam.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    // Find plant ID by slug, ID, or NFC UID
    const plantResult = await pool.query(
      `SELECT id, farm_id FROM plants 
       WHERE (
         public_slug = $1 
         OR id::text = $1 
         OR UPPER(nfc_uid) = UPPER($1)
         OR UPPER(regexp_replace(COALESCE(nfc_uid, ''), '[^A-Za-z0-9]', '', 'g')) = $2
       ) 
       AND (deleted_at IS NULL)
       LIMIT 1`,
      [slugParam, cleanRawUid]
    );
    if (plantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trang cây không tồn tại hoặc đã bị xóa.' });
    }
    const plantId = plantResult.rows[0].id;

    // Strict farm authentication check
    const access = await verifyPlantAccess(req, plantId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    // Support both JSON body (no files) and multipart/form-data (with files)
    const log_type = req.body.log_type;
    const note = req.body.note || '';
    const log_date = req.body.log_date || new Date().toISOString().slice(0, 10);
    const operator_name = req.body.operator_name || (req.body.details && typeof req.body.details === 'object' ? req.body.details.operator_name : null) || access.user.full_name || access.user.email;
    const equipment_used = req.body.equipment_used || (req.body.details && typeof req.body.details === 'object' ? req.body.details.equipment_used : null) || null;

    // details can be a JSON string (multipart) or object (json body)
    let details = {};
    if (req.body.details) {
      try {
        details = typeof req.body.details === 'string' ? JSON.parse(req.body.details) : req.body.details;
      } catch (e) { details = {}; }
    }

    if (operator_name && !details.operator_name) details.operator_name = operator_name;
    if (equipment_used && !details.equipment_used) details.equipment_used = equipment_used;

    // Upload files to Supabase if any
    const uploadedMediaUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const ext = path.extname(file.originalname).toLowerCase();
        const objectName = `plants/${plantId}/disease/${uuidv4()}${ext}`;
        const publicUrl = await uploadFile(objectName, file.buffer, file.mimetype);
        const mediaType = file.mimetype.startsWith('video') ? 'video' : 'image';

        // Save to plant_media table (appears in plant gallery)
        await pool.query(
          'INSERT INTO plant_media (plant_id, object_name, url, media_type, caption) VALUES ($1,$2,$3,$4,$5)',
          [plantId, objectName, publicUrl, mediaType, `Bệnh cây - ${log_date}`]
        );

        uploadedMediaUrls.push({ url: publicUrl, type: mediaType });
      }
    }

    // Handle media_urls from JSON body (non-multipart requests)
    let existingMediaUrls = [];
    if (req.body.media_urls) {
      try {
        existingMediaUrls = typeof req.body.media_urls === 'string'
          ? JSON.parse(req.body.media_urls)
          : (req.body.media_urls || []);
      } catch (e) { existingMediaUrls = []; }
    }

    const allMediaUrls = [...existingMediaUrls, ...uploadedMediaUrls];

    // PHI Quarantine & Pesticide Notice
    if (log_type === 'Phun thuốc') {
      let phiDays = parseInt(details.phi_days) || 0;
      const pesticideName = details.name || details.pesticide_name || note || 'Thuốc BVTV';

      if (phiDays <= 0 && pesticideName) {
        const supLookup = await pool.query(
          `SELECT phi_days FROM supplies WHERE category = 'Phun thuốc' AND (name ILIKE $1 OR $2 ILIKE '%' || name || '%') AND phi_days > 0 LIMIT 1`,
          [pesticideName.trim(), pesticideName.trim()]
        );
        if (supLookup.rows.length > 0) phiDays = supLookup.rows[0].phi_days;
      }

      if (phiDays > 0) {
        details.phi_days = phiDays;
        const sprayDateObj = new Date(log_date);
        sprayDateObj.setDate(sprayDateObj.getDate() + phiDays);
        const phiUntilDateStr = sprayDateObj.toISOString().slice(0, 10);
        details.phi_until_date = phiUntilDateStr;

        await pool.query(
          `UPDATE plants 
           SET phi_until_date = $1, phi_status = 'quarantine', last_pesticide_date = $2, last_pesticide_name = $3, updated_at = NOW() 
           WHERE id = $4`,
          [phiUntilDateStr, log_date, pesticideName, plantId]
        );
      }
    }

    // Harvest batch code
    let generatedBatchCode = null;
    let farmPuc = access.plant?.puc_code || 'VN-TB';
    if (log_type === 'Thu hoạch') {
      const dateClean = log_date.replace(/-/g, '');
      const codeClean = (access.plant?.tree_code || plantId).replace(/[^a-zA-Z0-9]/g, '');
      generatedBatchCode = `${farmPuc}-${dateClean}-${codeClean}`;
      details.batch_code = generatedBatchCode;
      details.puc_code = farmPuc;
    }

    const result = await pool.query(
      `INSERT INTO plant_logs (plant_id, log_date, log_type, note, media_urls, details, created_by, operator_name, equipment_used, batch_code, puc_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [plantId, log_date, log_type, note,
       JSON.stringify(allMediaUrls), JSON.stringify(details), access.user.id, operator_name, equipment_used, generatedBatchCode, farmPuc]
    );

    // Update health status if disease
    if (log_type === 'Bệnh cây') {
      await pool.query(`UPDATE plants SET health_status = 'Bệnh', updated_at = NOW() WHERE id = $1`, [plantId]);
    }

    // Auto-record supply usage and stock deduction
    try {
      let resolvedSupplyId = details.supply_id || null;
      const rawAmount = parseFloat(details.quantity || details.volume || details.amount || 0);
      const rawUnit = (details.unit || '').toLowerCase().trim();
      const supplyName = details.supply_name || details.fertilizer_name || details.pesticide_name || null;

      if (!resolvedSupplyId && supplyName) {
        const foundSup = await pool.query(
          `SELECT id, unit, unit_price FROM supplies WHERE (farm_id = $1 OR 1=1) AND (name ILIKE $2 OR $2 ILIKE '%' || name || '%') LIMIT 1`,
          [access.plant?.farm_id || null, supplyName]
        );
        if (foundSup.rows.length > 0) {
          resolvedSupplyId = foundSup.rows[0].id;
        }
      }

      if (resolvedSupplyId && rawAmount > 0) {
        const supInfo = await pool.query('SELECT * FROM supplies WHERE id = $1', [resolvedSupplyId]);
        if (supInfo.rows.length > 0) {
          const sup = supInfo.rows[0];
          const supUnit = (sup.unit || 'kg').toLowerCase().trim();
          const usageQty = convertLogAmountToBaseSupplyQty(rawAmount, rawUnit, supUnit, log_type);
          const uPrice = parseFloat(sup.unit_price) || 0;
          const totCost = parseFloat(details.total_cost) || (usageQty * uPrice);

          await pool.query(
            `INSERT INTO supply_usages (user_id, supply_id, farm_id, plant_id, usage_date, quantity, unit_price, total_cost, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [access.user.id, sup.id, access.plant?.farm_id || null, plantId, log_date, usageQty, uPrice, totCost, `Tự động từ nhật ký [${log_type}] tại vườn (${rawAmount} ${rawUnit || sup.unit})`]
          );

          if (sup.category !== 'Tiền nước' && sup.category !== 'Nhân công' && sup.stock_quantity > 0) {
            await pool.query('UPDATE supplies SET stock_quantity = GREATEST(0, stock_quantity - $1), updated_at = NOW() WHERE id = $2', [usageQty, sup.id]);
          }
        }
      }
    } catch (supErr) {
      console.warn('Cảnh báo ghi nhận tiêu hao vật tư từ nhật ký công khai:', supErr.message);
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting public log:', err);
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
});

// ─── VietGAP / GlobalGAP Cultivation Log Report Export ────────────
router.get('/:id(\\d+)/export-vietgap', async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);
    const plantRes = await pool.query(
      `SELECT p.*, f.name as farm_name, f.location as farm_address, u.full_name as owner_name, u.phone as owner_phone
       FROM plants p
       LEFT JOIN farms f ON f.id = p.farm_id
       LEFT JOIN users u ON u.id = f.user_id
       WHERE p.id = $1`, [plantId]
    );

    if (plantRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy cây trồng.' });
    }

    const plant = plantRes.rows[0];
    const logsRes = await pool.query(
      `SELECT * FROM plant_logs WHERE plant_id = $1 ORDER BY log_date ASC`, [plantId]
    );

    res.json({
      title: 'BÁO CÁO NHẬT KÝ CANH TÁC CHUẨN VIETGAP / GLOBALGAP',
      generated_at: new Date().toISOString(),
      plant_info: {
        tree_code: plant.tree_code || plant.id,
        plant_type: plant.plant_type,
        plant_variety: plant.plant_variety,
        farm_name: plant.farm_name,
        farm_address: plant.farm_address,
        owner_name: plant.owner_name,
        owner_phone: plant.owner_phone,
        nfc_uid: plant.nfc_uid,
        public_url: generatePublicPlantUrl(plant.farm_id, plant.id, plant.nfc_uid)
      },
      total_logs: logsRes.rows.length,
      logs: logsRes.rows
    });
  } catch (err) {
    console.error('VietGAP export error:', err);
    res.status(500).json({ error: 'Lỗi xuất báo cáo VietGAP: ' + err.message });
  }
});

// ─── QR Traceability Metadata API ───────────────────────────────
router.get('/:id(\\d+)/qr-traceability', async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);
    const plantRes = await pool.query(
      `SELECT p.id, p.tree_code, p.plant_type, p.plant_variety, p.health_status, p.nfc_uid, p.farm_id, f.user_id as owner_id, f.name as farm_name
       FROM plants p
       LEFT JOIN farms f ON f.id = p.farm_id
       WHERE p.id = $1`, [plantId]
    );

    if (plantRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin.' });
    }

    const plant = plantRes.rows[0];
    const traceUrl = `https://plant-book.onrender.com/${plant.owner_id || 0}/${plant.farm_id || 0}/${plant.id}/${encodeURIComponent(plant.nfc_uid || '')}`;

    res.json({
      success: true,
      tree_code: plant.tree_code,
      plant_type: plant.plant_type,
      plant_variety: plant.plant_variety,
      farm_name: plant.farm_name,
      traceability_url: traceUrl,
      qr_image_api: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(traceUrl)}`
    });
  } catch (err) {
    console.error('QR Traceability error:', err);
    res.status(500).json({ error: 'Lỗi tạo QR: ' + err.message });
  }
});

module.exports = router;

