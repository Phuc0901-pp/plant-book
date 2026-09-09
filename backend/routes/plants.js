const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { logAuditAction } = require('./history');

const checkTier = require('../middleware/checkTier');

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

function generatePublicPlantUrl(farmId, plantId, nfcUid) {
  const fId = farmId || 0;
  const pId = plantId || 0;
  if (nfcUid && String(nfcUid).trim()) {
    return `https://plant-book.onrender.com/${fId}/${pId}/${encodeURIComponent(String(nfcUid).trim())}`;
  }
  return `https://plant-book.onrender.com/${fId}/${pId}`;
}

// ─── Admin routes (require auth) ─────────────────────────────────

router.get('/', auth, async (req, res) => {
  try {
    const { search, health_status, plant_type, user_id, farm_id } = req.query;
    let query = `
      SELECT p.*, ps.name as schema_name, u.full_name as creator_name,
             f.name as farm_name, f.puc_code as farm_puc_code, f.vietgap_cert_number, fu.full_name as farm_owner_name, fu.id as farm_owner_id,
             (SELECT COUNT(*) FROM plant_media pm WHERE pm.plant_id = p.id) as media_count,
             (SELECT COUNT(*) FROM plant_logs pl WHERE pl.plant_id = p.id) as log_count,
             TO_CHAR((SELECT MAX(log_date) FROM plant_logs WHERE plant_id = p.id AND log_type = 'Tưới nước'), 'YYYY-MM-DD') as last_watered,
             TO_CHAR((SELECT MAX(log_date) FROM plant_logs WHERE plant_id = p.id AND log_type = 'Bón phân'), 'YYYY-MM-DD') as last_fertilized,
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
      WHERE 1=1
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

    query += ' ORDER BY p.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server.' });
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
      WHERE 1=1
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
       WHERE pl.plant_id=$1 
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


    let logsQuery = 'SELECT pl.*, u.full_name as creator_name, u.phone as creator_phone, u.email as creator_email FROM plant_logs pl LEFT JOIN users u ON u.id = pl.created_by WHERE pl.plant_id = $1';
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

    logsQuery += ' ORDER BY pl.log_date DESC';
    const logs = await pool.query(logsQuery, logsParams);
    res.json(logs.rows);
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

router.post('/', auth, admin, async (req, res) => {
  try {
    const { schema_id, plant_type, plant_variety, plant_age, health_status, location, data, is_public, farm_id, latitude, longitude, tree_code } = req.body;
    
    let finalTreeCode = tree_code && tree_code.trim() ? tree_code.trim() : null;
    if (!finalTreeCode) {
      const year = new Date().getFullYear();
      const farmCode = farm_id ? `TT${String(farm_id).padStart(2, '0')}` : 'TT00';
      const countRes = await pool.query('SELECT COUNT(*)::int as count FROM plants WHERE farm_id IS NOT DISTINCT FROM $1', [farm_id || null]);
      const stt = String((countRes.rows[0].count || 0) + 1).padStart(3, '0');
      finalTreeCode = `${farmCode}-${year}-${stt}`;
    }

    const slug = finalTreeCode ? `${farm_id || 0}_${finalTreeCode}` : generateSlug(plant_type);

    const result = await pool.query(
      `INSERT INTO plants (public_slug, schema_id, plant_type, plant_variety, plant_age, health_status, location, data, is_public, farm_id, latitude, longitude, created_by, tree_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (public_slug) DO UPDATE 
       SET schema_id = EXCLUDED.schema_id,
           plant_type = EXCLUDED.plant_type,
           plant_variety = EXCLUDED.plant_variety,
           plant_age = EXCLUDED.plant_age,
           health_status = EXCLUDED.health_status,
           location = EXCLUDED.location,
           data = EXCLUDED.data,
           is_public = EXCLUDED.is_public,
           farm_id = EXCLUDED.farm_id,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           created_by = EXCLUDED.created_by,
           tree_code = EXCLUDED.tree_code,
           updated_at = NOW()
       RETURNING *`,
      [slug, schema_id || null, plant_type, plant_variety, plant_age, health_status || 'Tốt',
       location, JSON.stringify(data || {}), is_public !== false, farm_id || null, 
       latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null,
       longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null,
       req.user.id, finalTreeCode]
    );

    const insertedPlant = result.rows[0];
    const publicUrl = generatePublicPlantUrl(insertedPlant.farm_id, insertedPlant.id, insertedPlant.nfc_uid);
    await pool.query('UPDATE plants SET public_url = $1 WHERE id = $2', [publicUrl, insertedPlant.id]);
    insertedPlant.public_url = publicUrl;

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated');

    res.status(201).json(insertedPlant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.put('/:id', auth, admin, async (req, res) => {
  try {
    const { plant_type, plant_variety, plant_age, health_status, location, data, is_public, schema_id, farm_id, latitude, longitude, tree_code } = req.body;
    const slug = tree_code ? `${req.user.id}_${farm_id || 0}_${tree_code}` : generateSlug(plant_type);

    const result = await pool.query(
      `UPDATE plants 
       SET plant_type=$1, plant_variety=$2, plant_age=$3, health_status=$4, location=$5, 
           data=$6, is_public=$7, schema_id=$8, farm_id=$9, latitude=$10, longitude=$11, tree_code=$12, 
           public_slug=$13, updated_at=NOW()
       WHERE id=$14 RETURNING *`,
      [plant_type, plant_variety, plant_age, health_status, location,
       JSON.stringify(data || {}), is_public !== false, schema_id || null, farm_id || null,
       latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null,
       longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null,
       tree_code || null,
       slug,
       req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy.' });

    const updatedPlant = result.rows[0];
    const publicUrl = generatePublicPlantUrl(updatedPlant.farm_id, updatedPlant.id, updatedPlant.nfc_uid);
    await pool.query('UPDATE plants SET public_url = $1 WHERE id = $2', [publicUrl, updatedPlant.id]);
    updatedPlant.public_url = publicUrl;

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated');

    res.json(updatedPlant);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
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

      // 2d. Update target plant with new UID & 3-segment public URL
      const publicUrl = generatePublicPlantUrl(plant.farm_id, plantId, cleanUid);
      const updated = await client.query(
        `UPDATE plants 
         SET nfc_uid = $1, public_url = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id, tree_code, public_slug, nfc_uid, public_url, farm_id`,
        [cleanUid, publicUrl, plantId]
      );

      // 2e. Update inventory item to assigned
      await client.query(
        `UPDATE nfc_tags_inventory 
         SET farm_id = $1, status = 'assigned', plant_id = $2, tagged_at = NOW() 
         WHERE UPPER(nfc_uid) = UPPER($3)`,
        [plant.farm_id, plantId, cleanUid]
      );

      await client.query('COMMIT');

      const broadcast = req.app.get('broadcast');
      if (broadcast) broadcast('plants_updated');

      return res.json({
        success: true,
        plant: updated.rows[0],
        public_url: publicUrl,
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
         SET nfc_uid = NULL, public_url = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, tree_code, public_slug, nfc_uid, public_url, farm_id`,
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
      `SELECT n.*, p.tree_code, p.plant_type, p.plant_variety, p.health_status, p.latitude, p.longitude, p.public_url
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

router.delete('/farms/:farmId/nfc-inventory/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const farmId = parseInt(req.params.farmId);
    if (isNaN(id) || isNaN(farmId)) return res.status(400).json({ error: 'Tham số không hợp lệ.' });

    const result = await pool.query(
      'DELETE FROM nfc_tags_inventory WHERE id = $1 AND farm_id = $2 RETURNING *',
      [id, farmId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy thẻ trong kho.' });
    }

    res.json({ success: true, message: 'Đã xóa thẻ khỏi kho.' });
  } catch (err) {
    console.error('Error deleting NFC tag from inventory:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa thẻ.' });
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

router.delete('/:id', auth, admin, async (req, res) => {
  try {
    const mediaResult = await pool.query('SELECT object_name FROM plant_media WHERE plant_id=$1', [req.params.id]);
    for (const row of mediaResult.rows) {
      await deleteFile(row.object_name);
    }
    await pool.query('DELETE FROM plants WHERE id=$1', [req.params.id]);
    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated');

    res.json({ message: 'Đã xóa cây.' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.post('/:id/media', auth, upload.array('files', 20), async (req, res) => {
  try {
    const plantId = req.params.id;
    const plant = await pool.query('SELECT id FROM plants WHERE id=$1', [plantId]);
    if (plant.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy cây.' });

    const uploaded = [];
    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const objectName = `plants/${plantId}/${uuidv4()}${ext}`;
      const url = await uploadFile(objectName, file.buffer, file.mimetype);
      const mediaType = file.mimetype.startsWith('video') ? 'video' : 'image';
      const caption = req.body.caption || '';

      const result = await pool.query(
        'INSERT INTO plant_media (plant_id, object_name, url, media_type, caption) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [plantId, objectName, url, mediaType, caption]
      );
      uploaded.push(result.rows[0]);
    }

    if (uploaded.length > 0 && uploaded[0].media_type === 'image') {
      await pool.query(
        'UPDATE plants SET cover_image=$1 WHERE id=$2 AND cover_image IS NULL',
        [uploaded[0].url, plantId]
      );
    }

    // Record user activity
    if (uploaded.length > 0) {
      await pool.query(
        `INSERT INTO user_activities (user_id, activity_type, description)
         VALUES ($1, 'Tải lên hình ảnh', $2)`,
        [req.user.id, `Tải lên ${uploaded.length} tệp tin media cho cây #${plantId}`]
      );
    }

    res.json(uploaded);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi upload: ' + err.message });
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

    // Tự động ghi nhận tiêu hao vật tư nếu có supply_id hoặc thông tin vật tư trong details
    try {
      let resolvedSupplyId = parsedDetails.supply_id || null;
      const usageQty = parseFloat(parsedDetails.quantity || parsedDetails.volume || parsedDetails.amount || 0);

      // Nếu chưa có supply_id nhưng có tên vật tư, tự tìm supply_id
      const supplyName = parsedDetails.supply_name || parsedDetails.fertilizer_name || parsedDetails.pesticide_name || null;
      if (!resolvedSupplyId && supplyName) {
        const foundSup = await pool.query(
          `SELECT id, unit_price FROM supplies WHERE (user_id = $1 OR farm_id = $2) AND (name ILIKE $3 OR $3 ILIKE '%' || name || '%') LIMIT 1`,
          [req.user.id, farmId || null, supplyName]
        );
        if (foundSup.rows.length > 0) {
          resolvedSupplyId = foundSup.rows[0].id;
        }
      }

      if (resolvedSupplyId && usageQty > 0) {
        const supInfo = await pool.query('SELECT * FROM supplies WHERE id = $1', [resolvedSupplyId]);
        if (supInfo.rows.length > 0) {
          const sup = supInfo.rows[0];
          const uPrice = parseFloat(parsedDetails.unit_price) || parseFloat(sup.unit_price) || 0;
          const totCost = parseFloat(parsedDetails.total_cost) || (usageQty * uPrice);

          await pool.query(
            `INSERT INTO supply_usages (user_id, supply_id, farm_id, plant_id, usage_date, quantity, unit_price, total_cost, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [req.user.id, sup.id, farmId || null, targetPlantId || null, effectiveDate, usageQty, uPrice, totCost, `Tự động trích xuất từ nhật ký [${log_type}]`]
          );

          // Trừ kho nếu là phân bón / thuốc
          if (sup.category !== 'Tiền nước' && sup.category !== 'Nhân công' && sup.stock_quantity > 0) {
            await pool.query('UPDATE supplies SET stock_quantity = GREATEST(0, stock_quantity - $1) WHERE id = $2', [usageQty, sup.id]);
          }
        }
      }
    } catch (supErr) {
      console.warn('Cảnh báo ghi nhận tiêu hao vật tư từ nhật ký:', supErr.message);
    }

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

router.delete('/:plantId/logs/:logId', auth, admin, async (req, res) => {
  try {
    const currentLog = await pool.query('SELECT * FROM plant_logs WHERE id=$1 AND plant_id=$2', [req.params.logId, req.params.plantId]);
    await pool.query('DELETE FROM plant_logs WHERE id=$1 AND plant_id=$2', [req.params.logId, req.params.plantId]);
    
    if (currentLog.rows.length > 0) {
      logAuditAction(
        req.user.id,
        req.user.full_name || req.user.email,
        'DELETE',
        'Nhật ký canh tác',
        req.params.logId,
        `Xóa nhật ký "${currentLog.rows[0].log_type}" của cây #${req.params.plantId}`,
        currentLog.rows[0],
        {}
      );
    }

    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('plants_updated', { message: `Care log deleted on plant #${req.params.plantId}` });
      broadcast('supplies_updated', { message: `Care log deleted on plant #${req.params.plantId}` });
    }
    
    res.json({ message: 'Đã xóa.' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});


// ─── Public routes ────────────────────────────────────────────────
router.get('/public/:slug', async (req, res) => {
  try {
    const slugParam = req.params.slug.trim();
    const plant = await pool.query(
      `SELECT p.*, 
              COALESCE(p.latitude, 10.941520) as latitude,
              COALESCE(p.longitude, 107.241850) as longitude,
              ps.name as schema_name, ps.fields as schema_fields,
              f.name as farm_name, f.polygon_coordinates as farm_polygon, f.user_id as farm_owner_user_id
       FROM plants p 
       LEFT JOIN plant_schemas ps ON ps.id = p.schema_id
       LEFT JOIN farms f ON f.id = p.farm_id
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
    const logs = await pool.query('SELECT * FROM plant_logs WHERE plant_id=$1 ORDER BY log_date DESC', [plant.rows[0].id]);

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

    res.json({ ...row, media: media.rows, logs: logs.rows, farm_boundary });
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

// Update plant health status publicly
router.patch('/public/:slug/health', async (req, res) => {
  try {
    const { health_status } = req.body;
    if (!['Tốt', 'Bình thường', 'Cần chú ý', 'Bệnh'].includes(health_status)) {
      return res.status(400).json({ error: 'Trạng thái sức khỏe không hợp lệ.' });
    }
    const slugParam = req.params.slug.trim();
    const result = await pool.query(
      `UPDATE plants SET health_status = $1, updated_at = NOW() WHERE (public_slug = $2 OR id::text = $2 OR UPPER(nfc_uid) = UPPER($2)) RETURNING *`,
      [health_status, slugParam]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy cây.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server.' });
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


router.post('/public/:slug/logs', upload.array('files', 12), async (req, res) => {
  try {
    // Support both JSON body (no files) and multipart/form-data (with files)
    const log_type = req.body.log_type;
    const note = req.body.note || '';
    const log_date = req.body.log_date || new Date().toISOString().slice(0, 10);

    // details can be a JSON string (multipart) or object (json body)
    let details = {};
    if (req.body.details) {
      try {
        details = typeof req.body.details === 'string' ? JSON.parse(req.body.details) : req.body.details;
      } catch (e) { details = {}; }
    }

    const slugParam = req.params.slug.trim();
    // Find plant ID by slug, ID, or NFC UID
    const plantResult = await pool.query(
      'SELECT id FROM plants WHERE (public_slug=$1 OR id::text=$1 OR UPPER(nfc_uid)=UPPER($1)) AND is_public=true',
      [slugParam]
    );
    if (plantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trang cây không tồn tại hoặc chưa công khai.' });
    }
    const plantId = plantResult.rows[0].id;

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

    const result = await pool.query(
      `INSERT INTO plant_logs (plant_id, log_date, log_type, note, media_urls, details, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,NULL) RETURNING *`,
      [plantId, log_date, log_type, note,
       JSON.stringify(allMediaUrls), JSON.stringify(details)]
    );
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
        public_url: `https://plant-book.onrender.com/${plant.created_by || 0}/${plant.farm_id || 0}/${plant.id}/${plant.nfc_uid || ''}`
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

