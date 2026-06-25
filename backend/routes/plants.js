const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
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
    const { search, health_status, plant_type } = req.query;
    let query = `
      SELECT p.*, ps.name as schema_name, u.full_name as creator_name,
             (SELECT COUNT(*) FROM plant_media pm WHERE pm.plant_id = p.id) as media_count,
             (SELECT COUNT(*) FROM plant_logs pl WHERE pl.plant_id = p.id) as log_count
      FROM plants p
      LEFT JOIN plant_schemas ps ON ps.id = p.schema_id
      LEFT JOIN users u ON u.id = p.created_by
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (search) {
      query += ` AND (p.plant_type ILIKE $${idx} OR p.plant_variety ILIKE $${idx} OR p.location ILIKE $${idx})`;
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

    query += ' ORDER BY p.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.get('/:id(\\d+)', auth, async (req, res) => {
  try {
    const plant = await pool.query(
      `SELECT p.*, ps.name as schema_name, ps.fields as schema_fields
       FROM plants p LEFT JOIN plant_schemas ps ON ps.id = p.schema_id
       WHERE p.id=$1`, [req.params.id]
    );
    if (plant.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy.' });

    const media = await pool.query('SELECT * FROM plant_media WHERE plant_id=$1 ORDER BY uploaded_at DESC', [req.params.id]);
    const logs = await pool.query('SELECT * FROM plant_logs WHERE plant_id=$1 ORDER BY log_date DESC', [req.params.id]);

    res.json({ ...plant.rows[0], media: media.rows, logs: logs.rows });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { schema_id, plant_type, plant_variety, plant_age, health_status, location, data, is_public } = req.body;
    const slug = generateSlug(plant_type);

    const result = await pool.query(
      `INSERT INTO plants (public_slug, schema_id, plant_type, plant_variety, plant_age, health_status, location, data, is_public, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [slug, schema_id || null, plant_type, plant_variety, plant_age, health_status || 'Tốt',
       location, JSON.stringify(data || {}), is_public !== false, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { plant_type, plant_variety, plant_age, health_status, location, data, is_public, schema_id } = req.body;
    const result = await pool.query(
      `UPDATE plants SET plant_type=$1, plant_variety=$2, plant_age=$3, health_status=$4,
       location=$5, data=$6, is_public=$7, schema_id=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [plant_type, plant_variety, plant_age, health_status, location,
       JSON.stringify(data || {}), is_public !== false, schema_id || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const mediaResult = await pool.query('SELECT object_name FROM plant_media WHERE plant_id=$1', [req.params.id]);
    for (const row of mediaResult.rows) {
      await deleteFile(row.object_name);
    }
    await pool.query('DELETE FROM plants WHERE id=$1', [req.params.id]);
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

    res.json(uploaded);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi upload: ' + err.message });
  }
});

router.delete('/:plantId/media/:mediaId', auth, async (req, res) => {
  try {
    const media = await pool.query('SELECT * FROM plant_media WHERE id=$1 AND plant_id=$2', [req.params.mediaId, req.params.plantId]);
    if (media.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy.' });
    await deleteFile(media.rows[0].object_name);
    await pool.query('DELETE FROM plant_media WHERE id=$1', [req.params.mediaId]);
    res.json({ message: 'Đã xóa.' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.post('/:id/logs', auth, async (req, res) => {
  try {
    const { log_date, log_type, note, media_urls, details } = req.body;
    const result = await pool.query(
      `INSERT INTO plant_logs (plant_id, log_date, log_type, note, media_urls, details, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, log_date || new Date().toISOString().slice(0,10), log_type, note,
       JSON.stringify(media_urls || []), JSON.stringify(details || {}), req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting log:', err);
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
});

router.delete('/:plantId/logs/:logId', auth, async (req, res) => {
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
    const plant = await pool.query(
      `SELECT p.*, ps.name as schema_name, ps.fields as schema_fields
       FROM plants p LEFT JOIN plant_schemas ps ON ps.id = p.schema_id
       WHERE p.public_slug=$1 AND p.is_public=true`, [req.params.slug]
    );
    if (plant.rows.length === 0) return res.status(404).json({ error: 'Trang cây không tồn tại hoặc chưa công khai.' });

    const media = await pool.query('SELECT * FROM plant_media WHERE plant_id=$1 ORDER BY uploaded_at DESC', [plant.rows[0].id]);
    const logs = await pool.query('SELECT * FROM plant_logs WHERE plant_id=$1 ORDER BY log_date DESC', [plant.rows[0].id]);

    res.json({ ...plant.rows[0], media: media.rows, logs: logs.rows });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.post('/public/:slug/logs', async (req, res) => {
  try {
    const { log_date, log_type, note, media_urls, details } = req.body;
    
    // Find plant ID by slug
    const plantResult = await pool.query('SELECT id FROM plants WHERE public_slug=$1 AND is_public=true', [req.params.slug]);
    if (plantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trang cây không tồn tại hoặc chưa công khai.' });
    }
    const plantId = plantResult.rows[0].id;

    const result = await pool.query(
      `INSERT INTO plant_logs (plant_id, log_date, log_type, note, media_urls, details, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,NULL) RETURNING *`,
      [plantId, log_date || new Date().toISOString().slice(0,10), log_type, note,
       JSON.stringify(media_urls || []), JSON.stringify(details || {}), null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting public log:', err);
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
});


module.exports = router;
