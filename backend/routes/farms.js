const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// GET all farms with plant count (requires auth)
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.*, COUNT(p.id)::int as plant_count 
      FROM farms f 
      LEFT JOIN plants p ON p.farm_id = f.id 
      GROUP BY f.id 
      ORDER BY f.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting farms:', err);
    res.status(500).json({ error: 'Lỗi server khi tải danh sách trang trại.' });
  }
});

// GET single farm details with list of plants (requires auth)
router.get('/:id', auth, async (req, res) => {
  try {
    const farmResult = await pool.query('SELECT * FROM farms WHERE id = $1', [req.params.id]);
    if (farmResult.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }
    const farm = farmResult.rows[0];

    const plantsResult = await pool.query(`
      SELECT id, plant_type, plant_variety, health_status, latitude, longitude, cover_image, is_public, public_slug
      FROM plants 
      WHERE farm_id = $1 
      ORDER BY created_at DESC
    `, [req.params.id]);

    res.json({
      ...farm,
      plants: plantsResult.rows
    });
  } catch (err) {
    console.error('Error getting farm details:', err);
    res.status(500).json({ error: 'Lỗi server khi tải chi tiết trang trại.' });
  }
});

// POST create farm (requires auth)
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, polygon_coordinates, area } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Tên trang trại là bắt buộc.' });
    }

    const result = await pool.query(`
      INSERT INTO farms (name, description, polygon_coordinates, area, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, description || '', JSON.stringify(polygon_coordinates || []), area || null, req.user.id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating farm:', err);
    res.status(500).json({ error: 'Lỗi server khi tạo trang trại.' });
  }
});

// PUT update farm (requires auth)
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, polygon_coordinates, area } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Tên trang trại là bắt buộc.' });
    }

    const result = await pool.query(`
      UPDATE farms 
      SET name = $1, description = $2, polygon_coordinates = $3, area = $4, updated_at = NOW() 
      WHERE id = $5 
      RETURNING *
    `, [name, description || '', JSON.stringify(polygon_coordinates || []), area || null, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating farm:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật trang trại.' });
  }
});

// DELETE farm (requires auth)
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM farms WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }
    res.json({ message: 'Đã xóa trang trại thành công.' });
  } catch (err) {
    console.error('Error deleting farm:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa trang trại.' });
  }
});

module.exports = router;
