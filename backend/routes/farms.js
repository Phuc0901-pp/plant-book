const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// GET all farms with plant count (requires auth)
router.get('/', auth, async (req, res) => {
  try {
    let query = `
      SELECT f.*, GREATEST(COUNT(p.id)::int, COALESCE(f.total_plants, 0)) as plant_count, u.full_name as user_name, u.email as user_email
      FROM farms f 
      LEFT JOIN plants p ON p.farm_id = f.id 
      LEFT JOIN users u ON u.id = f.user_id
    `;
    const params = [];
    if (req.user.role !== 'admin') {
      query += ` WHERE (f.user_id = $1 OR f.id = (SELECT farm_id FROM users WHERE id = $1)) `;
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
    
    // Check if user is farm owner, admin, or assigned farmer
    const isAssigned = req.user.farm_id && farm.id === req.user.farm_id;
    if (req.user.role !== 'admin' && farm.user_id !== req.user.id && !isAssigned) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập trang trại này.' });
    }

    const plantsResult = await pool.query('SELECT * FROM plants WHERE farm_id = $1 ORDER BY id ASC', [farm.id]);
    res.json({ ...farm, plants: plantsResult.rows });
  } catch (err) {
    console.error('Error getting farm details:', err);
    res.status(500).json({ error: 'Lỗi server khi tải chi tiết trang trại.' });
  }
});

// POST /api/farms/self-init — Self-initialize farm via GPS by a farmer (requires auth)
router.post('/self-init', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, latitude, longitude, area, total_plants, plant_count } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên trang trại là bắt buộc.' });
    }

    const lat = latitude ? parseFloat(latitude) : null;
    const lng = longitude ? parseFloat(longitude) : null;
    const farmArea = area && parseFloat(area) ? parseFloat(area) : null;
    const countVal = parseInt(total_plants || plant_count) || 0;

    // Single point GPS ping polygon or coordinates
    const polygonCoords = (lat && lng) ? [[lat, lng]] : [];

    await client.query('BEGIN');

    // Create farm
    const farmRes = await client.query(`
      INSERT INTO farms (name, description, polygon_coordinates, area, total_plants, created_by, user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $6)
      RETURNING *
    `, [name.trim(), description || '', JSON.stringify(polygonCoords), farmArea, countVal, req.user.id]);

    const newFarm = farmRes.rows[0];

    // Update user's farm_id
    await client.query('UPDATE users SET farm_id = $1 WHERE id = $2', [newFarm.id, req.user.id]);

    await client.query('COMMIT');

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('farms_updated');

    res.status(201).json({
      success: true,
      message: 'Khởi tạo trang trại bằng tọa độ GPS thành công!',
      farm: newFarm
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error self-initializing farm:', err);
    res.status(500).json({ error: 'Lỗi server khi khởi tạo trang trại: ' + err.message });
  } finally {
    client.release();
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

// PUT update farm (requires auth — admin or farm owner)
router.put('/:id', auth, async (req, res) => {
  try {
    const farmId = req.params.id;
    const farmCheck = await pool.query('SELECT * FROM farms WHERE id = $1', [farmId]);
    if (farmCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }
    const farm = farmCheck.rows[0];

    // Check ownership
    const isOwner = farm.user_id === req.user.id || (req.user.farm_id && req.user.farm_id === farm.id);
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa trang trại này.' });
    }

    const { name, description, polygon_coordinates, area, total_plants, user_id, latitude, longitude } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên trang trại là bắt buộc.' });
    }

    let finalCoords = polygon_coordinates;
    if ((latitude && longitude) || (!polygon_coordinates && latitude && longitude)) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        finalCoords = [[lng, lat]];
      }
    }

    const assignedUserId = user_id !== undefined ? user_id : farm.user_id;
    const parsedArea = area !== undefined && area !== null && area !== '' ? parseFloat(area) : farm.area;
    const parsedTotalPlants = total_plants !== undefined && total_plants !== null && total_plants !== '' ? parseInt(total_plants) : farm.total_plants;
    const coordsJson = finalCoords ? JSON.stringify(finalCoords) : JSON.stringify(farm.polygon_coordinates);

    const result = await pool.query(`
      UPDATE farms 
      SET name = $1, description = $2, polygon_coordinates = $3, area = $4, total_plants = $5, user_id = $6, updated_at = NOW() 
      WHERE id = $7 
      RETURNING *
    `, [name.trim(), description || '', coordsJson, parsedArea, parsedTotalPlants, assignedUserId, farmId]);

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('farms_updated');

    res.json({
      success: true,
      message: 'Cập nhật thông tin trang trại thành công!',
      farm: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating farm:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật trang trại: ' + err.message });
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
