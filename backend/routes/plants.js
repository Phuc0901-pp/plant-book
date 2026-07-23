const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const multer = require('multer');
const { uploadFile, deleteFile } = require('../config/supabase');
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

// ─── Admin routes (require auth) ─────────────────────────────────

router.get('/', auth, async (req, res) => {
  try {
    const { search, health_status, plant_type, user_id, farm_id } = req.query;
    let query = `
      SELECT p.*, ps.name as schema_name, u.full_name as creator_name,
             f.name as farm_name, fu.full_name as farm_owner_name, fu.id as farm_owner_id,
             (SELECT COUNT(*) FROM plant_media pm WHERE pm.plant_id = p.id) as media_count,
             (SELECT COUNT(*) FROM plant_logs pl WHERE pl.plant_id = p.id) as log_count,
             TO_CHAR((SELECT MAX(log_date) FROM plant_logs WHERE plant_id = p.id AND log_type = 'Tưới nước'), 'YYYY-MM-DD') as last_watered,
             TO_CHAR((SELECT MAX(log_date) FROM plant_logs WHERE plant_id = p.id AND log_type = 'Bón phân'), 'YYYY-MM-DD') as last_fertilized
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
      query += ` AND f.user_id = $${idx}`;
      params.push(req.user.id);
      idx++;
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
    const daysLimit = parseInt(req.query.days) || 3;
    let query = `
      SELECT pl.*, p.plant_type, p.plant_variety, p.tree_code, p.farm_id, f.name as farm_name, p.location as plant_location, u.full_name as creator_name
      FROM plant_logs pl
      JOIN plants p ON pl.plant_id = p.id
      LEFT JOIN farms f ON f.id = p.farm_id
      LEFT JOIN users u ON pl.created_by = u.id
      WHERE pl.log_date >= CURRENT_DATE - $1::integer
    `;
    const params = [daysLimit];
    if (req.user.role !== 'admin') {
      query += ` AND f.user_id = $2 `;
      params.push(req.user.id);
    }
    query += ` ORDER BY pl.log_date DESC, pl.id DESC `;
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
      query += ` AND f.user_id = $${paramIndex} `;
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
      `SELECT p.*, ps.name as schema_name, ps.fields as schema_fields, f.user_id as farm_owner_id
       FROM plants p 
       LEFT JOIN plant_schemas ps ON ps.id = p.schema_id
       LEFT JOIN farms f ON f.id = p.farm_id
       WHERE p.id=$1`, [req.params.id]
    );
    if (plant.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy.' });

    const row = plant.rows[0];
    if (req.user.role !== 'admin' && row.farm_owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập thông tin cây này.' });
    }

    const media = await pool.query('SELECT * FROM plant_media WHERE plant_id=$1 ORDER BY uploaded_at DESC', [req.params.id]);
    const logs = await pool.query('SELECT * FROM plant_logs WHERE plant_id=$1 ORDER BY log_date DESC', [req.params.id]);

    res.json({ ...row, media: media.rows, logs: logs.rows });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.get('/:id(\\d+)/logs', auth, async (req, res) => {
  try {
    const plant = await pool.query(
      `SELECT p.id, f.user_id as farm_owner_id
       FROM plants p 
       LEFT JOIN farms f ON f.id = p.farm_id
       WHERE p.id=$1`, [req.params.id]
    );
    if (plant.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy.' });

    const row = plant.rows[0];
    if (req.user.role !== 'admin' && row.farm_owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập thông tin cây này.' });
    }

    const logs = await pool.query(
      'SELECT * FROM plant_logs WHERE plant_id=$1 ORDER BY log_date DESC',
      [req.params.id]
    );
    res.json(logs.rows);
  } catch (err) {
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
    const slug = tree_code ? `${req.user.id}_${farm_id || 0}_${tree_code}` : generateSlug(plant_type);

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
       req.user.id, tree_code || null]
    );
    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated');

    res.status(201).json(result.rows[0]);
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
    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated');

    res.json(result.rows[0]);
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

    // 1. Verify the requesting user owns this plant (or is admin)
    const plantRes = await client.query(
      `SELECT p.id, p.nfc_uid, p.public_slug, p.tree_code, f.user_id as farm_owner_id
       FROM plants p
       LEFT JOIN farms f ON f.id = p.farm_id
       WHERE p.id = $1`, [plantId]
    );
    if (plantRes.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy cây trồng.' });

    const plant = plantRes.rows[0];
    if (req.user.role !== 'admin' && plant.farm_owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền thay đổi định danh thẻ của cây này.' });
    }

    await client.query('BEGIN');

    // 2. If new UID provided, deactivate it from any other plant that currently holds it
    if (nfc_uid) {
      await client.query(
        `UPDATE plants SET nfc_uid = NULL, updated_at = NOW()
         WHERE nfc_uid = $1 AND id != $2`,
        [nfc_uid, plantId]
      );
    }

    // 3. Assign new nfc_uid (or NULL to deactivate) to this plant
    const updated = await client.query(
      `UPDATE plants SET nfc_uid = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, tree_code, public_slug, nfc_uid`,
      [nfc_uid || null, plantId]
    );

    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated');

    res.json({
      success: true,
      plant: updated.rows[0],
      message: nfc_uid
        ? `Đã gắn thẻ định danh ${nfc_uid} cho cây ${plant.tree_code || plantId}`
        : `Đã hủy kích hoạt thẻ của cây ${plant.tree_code || plantId}`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('NFC assign error:', err);
    if (err.code === '23505') { // unique_violation
      return res.status(409).json({ error: 'Mã thẻ này đã được sử dụng bởi một cây trồng khác.' });
    }
    res.status(500).json({ error: 'Lỗi server khi cập nhật định danh thẻ.' });
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
    const { log_date, log_type, note, media_urls, details } = req.body;
    const plantId = req.params.id;
    
    // Check permission
    const plant = await pool.query('SELECT p.id, p.plant_type, p.plant_variety, f.user_id FROM plants p LEFT JOIN farms f ON f.id = p.farm_id WHERE p.id=$1', [plantId]);
    if (plant.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy cây.' });
    if (req.user.role !== 'admin' && plant.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền ghi nhật ký cho cây này.' });
    }

    const result = await pool.query(
      `INSERT INTO plant_logs (plant_id, log_date, log_type, note, media_urls, details, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [plantId, log_date || new Date().toISOString().slice(0,10), log_type, note,
       JSON.stringify(media_urls || []), JSON.stringify(details || {}), req.user.id]
    );

    // Tự động chuyển trạng thái cây thành Bệnh nếu ghi nhật ký Bệnh cây
    if (log_type === 'Bệnh cây') {
      await pool.query(
        `UPDATE plants SET health_status = 'Bệnh', updated_at = NOW() WHERE id = $1`,
        [plantId]
      );
    }

    // Record user activity
    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Ghi nhật ký', $2)`,
      [req.user.id, `Ghi nhận nhật ký chăm sóc [${log_type}] cho cây #${plantId}`]
    );

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('new_care_log', {
        log: result.rows[0],
        plant_type: plant.rows[0].plant_type,
        plant_variety: plant.rows[0].plant_variety,
        creator_name: req.user.name
      });
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

    // Record user activity
    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Sửa nhật ký', $2)`,
      [req.user.id, `Chỉnh sửa nhật ký [${log_type || currentLog.log_type}] cho cây #${plantId} (ID nhật ký: ${logId})`]
    );

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('plants_updated', { message: `Care log edited on plant #${plantId}` });
    }

    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Error updating log:', err);
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
});

router.delete('/:plantId/logs/:logId', auth, admin, async (req, res) => {
  try {
    await pool.query('DELETE FROM plant_logs WHERE id=$1 AND plant_id=$2', [req.params.logId, req.params.plantId]);
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
      `SELECT p.*, ps.name as schema_name, ps.fields as schema_fields,
              f.name as farm_name, f.polygon_coordinates as farm_polygon, f.user_id as farm_owner_user_id
       FROM plants p 
       LEFT JOIN plant_schemas ps ON ps.id = p.schema_id
       LEFT JOIN farms f ON f.id = p.farm_id
       WHERE (p.public_slug=$1 OR p.id::text=$1 OR UPPER(p.nfc_uid)=UPPER($1)) AND p.is_public=true`, [slugParam]
    );
    if (plant.rows.length === 0) return res.status(404).json({ error: 'Trang cây không tồn tại hoặc chưa công khai.' });

    const media = await pool.query('SELECT * FROM plant_media WHERE plant_id=$1 ORDER BY uploaded_at DESC', [plant.rows[0].id]);
    const logs = await pool.query('SELECT * FROM plant_logs WHERE plant_id=$1 ORDER BY log_date DESC', [plant.rows[0].id]);

    // Build GeoJSON geometry for the farm boundary polygon
    const row = plant.rows[0];
    let farm_boundary = null;
    if (row.farm_polygon) {
      try {
        const coords = typeof row.farm_polygon === 'string' ? JSON.parse(row.farm_polygon) : row.farm_polygon;
        if (Array.isArray(coords) && coords.length > 0) {
          // If coords is 2D [[lng, lat], ...], wrap it in an outer array to make it a valid GeoJSON Polygon coordinates array
          if (Array.isArray(coords[0]) && !Array.isArray(coords[0][0])) {
            farm_boundary = { type: 'Polygon', coordinates: [coords] };
          } else {
            farm_boundary = { type: 'Polygon', coordinates: coords };
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


module.exports = router;
