const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer storage to write directly to frontend/assets/crop/
const cropStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(__dirname, '../../frontend/assets/crop');
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // We expect req.body.englishName to contain the english crop name (e.g. 'durian')
    const englishName = (req.body.englishName || 'unknown').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, englishName + ext);
  }
});

const uploadCrop = multer({
  storage: cropStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận ảnh (jpeg, jpg, png, gif, webp).'));
  }
});


// GET all schemas
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ps.*, u.full_name as creator_name 
       FROM plant_schemas ps
       LEFT JOIN users u ON u.id = ps.created_by
       ORDER BY ps.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// GET single schema
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM plant_schemas WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST create schema
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, fields } = req.body;
    if (!name) return res.status(400).json({ error: 'Tên schema là bắt buộc.' });

    const result = await pool.query(
      `INSERT INTO plant_schemas (name, description, fields, created_by) 
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, description || '', JSON.stringify(fields || []), req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT update schema
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, fields } = req.body;
    const result = await pool.query(
      `UPDATE plant_schemas SET name=$1, description=$2, fields=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [name, description, JSON.stringify(fields || []), req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// DELETE schema
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM plant_schemas WHERE id=$1', [req.params.id]);
    res.json({ message: 'Đã xóa.' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST upload crop image
router.post('/upload-image', auth, uploadCrop.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Không nhận được file ảnh.' });
    }
    
    // To prevent extension conflicts (e.g., if durian.png exists, and we upload durian.jpg, delete durian.png)
    const englishName = (req.body.englishName || 'unknown').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const uploadedExt = path.extname(req.file.originalname).toLowerCase();
    const destDir = path.join(__dirname, '../../frontend/assets/crop');
    
    const possibleExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    possibleExts.forEach(ext => {
      if (ext !== uploadedExt) {
        const oldFile = path.join(destDir, englishName + ext);
        if (fs.existsSync(oldFile)) {
          try {
            fs.unlinkSync(oldFile);
          } catch (e) {
            console.error('Error deleting old crop image:', e);
          }
        }
      }
    });

    res.json({ message: 'Tải ảnh loại cây lên thành công.', filename: req.file.filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi upload ảnh loại cây.' });
  }
});

module.exports = router;
