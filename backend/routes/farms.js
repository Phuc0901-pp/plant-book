const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// GET all farms with plant count (requires auth)
router.get('/', auth, async (req, res) => {
  try {
    let query = `
      SELECT f.*, COUNT(p.id)::int as plant_count, u.full_name as user_name, u.email as user_email
      FROM farms f 
      LEFT JOIN plants p ON p.farm_id = f.id 
      LEFT JOIN users u ON u.id = f.user_id
    `;
    const params = [];
    if (req.user.role !== 'admin') {
      query += ` WHERE f.user_id = $1 `;
      params.push(req.user.id);
    }
    query += `
      GROUP BY f.id, u.id
      ORDER BY f.created_at DESC
    `;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting farms:', err);
    res.status(500).json({ error: 'Lỗi server khi tải danh sách trang trại.' });
  }
});

// GET single farm details with list of plants (requires auth)
router.get('/:id', auth, async (req, res) => {
  try {
    const farmResult = await pool.query(`
      SELECT f.*, u.full_name as user_name, u.email as user_email
      FROM farms f
      LEFT JOIN users u ON u.id = f.user_id
      WHERE f.id = $1
    `, [req.params.id]);
    if (farmResult.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }
    const farm = farmResult.rows[0];
    if (req.user.role !== 'admin' && farm.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập trang trại này.' });
    }

    const plantsResult = await pool.query(`
      SELECT id, plant_type, plant_variety, health_status, latitude, longitude, cover_image, is_public, public_slug, tree_code
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

// POST create farm (requires auth, admin)
router.post('/', auth, admin, async (req, res) => {
  try {
    const { name, description, polygon_coordinates, area, user_id } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Tên trang trại là bắt buộc.' });
    }

    const result = await pool.query(`
      INSERT INTO farms (name, description, polygon_coordinates, area, created_by, user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, description || '', JSON.stringify(polygon_coordinates || []), area || null, req.user.id, user_id || null]);

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('farms_updated');

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating farm:', err);
    res.status(500).json({ error: 'Lỗi server khi tạo trang trại.' });
  }
});

// PUT update farm (requires auth, admin)
router.put('/:id', auth, admin, async (req, res) => {
  try {
    const { name, description, polygon_coordinates, area, user_id } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Tên trang trại là bắt buộc.' });
    }

    const result = await pool.query(`
      UPDATE farms 
      SET name = $1, description = $2, polygon_coordinates = $3, area = $4, user_id = $5, updated_at = NOW() 
      WHERE id = $6 
      RETURNING *
    `, [name, description || '', JSON.stringify(polygon_coordinates || []), area || null, user_id || null, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }
    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('farms_updated');

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating farm:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật trang trại.' });
  }
});

// DELETE farm (requires auth, admin)
router.delete('/:id', auth, admin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM farms WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }
    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('farms_updated');

    res.json({ message: 'Đã xóa trang trại thành công.' });
  } catch (err) {
    console.error('Error deleting farm:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa trang trại.' });
  }
});

module.exports = router;
