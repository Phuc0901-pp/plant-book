const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// Middleware to check if user is admin
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Quyền truy cập bị từ chối. Chỉ dành cho Quản trị viên.' });
  }
}

// GET all devices (requires auth)
router.get('/', auth, async (req, res) => {
  try {
    let query = `
      SELECT d.*, f.name as farm_name 
      FROM devices d
      LEFT JOIN farms f ON d.farm_id = f.id
    `;
    const params = [];
    
    // Non-admin can only see devices in their assigned farms
    if (req.user.role !== 'admin') {
      query += ` WHERE f.user_id = $1`;
      params.push(req.user.id);
    }
    
    query += ` ORDER BY d.created_at DESC`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting devices:', err);
    res.status(500).json({ error: 'Lỗi server khi tải danh sách thiết bị.' });
  }
});

// GET single device (requires auth)
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, f.name as farm_name
      FROM devices d
      LEFT JOIN farms f ON d.farm_id = f.id
      WHERE d.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy thiết bị.' });
    }
    
    const device = result.rows[0];
    
    // Check permission
    if (req.user.role !== 'admin') {
      const farmCheck = await pool.query('SELECT user_id FROM farms WHERE id = $1', [device.farm_id]);
      if (farmCheck.rows.length === 0 || farmCheck.rows[0].user_id !== req.user.id) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập thiết bị này.' });
      }
    }
    
    res.json(device);
  } catch (err) {
    console.error('Error getting device detail:', err);
    res.status(500).json({ error: 'Lỗi server khi tải chi tiết thiết bị.' });
  }
});

// POST create device (Admin only)
router.post('/', auth, requireAdmin, async (req, res) => {
  try {
    const { name, device_type, status, farm_id, ip_address, battery_level } = req.body;
    
    if (!name || !device_type) {
      return res.status(400).json({ error: 'Tên thiết bị và loại thiết bị là bắt buộc.' });
    }
    
    const result = await pool.query(`
      INSERT INTO devices (name, device_type, status, farm_id, ip_address, battery_level)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      name, 
      device_type, 
      status || 'Hoạt động', 
      farm_id ? parseInt(farm_id) : null, 
      ip_address || null, 
      battery_level !== undefined ? parseInt(battery_level) : 100
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating device:', err);
    res.status(500).json({ error: 'Lỗi server khi thêm thiết bị mới.' });
  }
});

// PUT update device (Admin only)
router.put('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const { name, device_type, status, farm_id, ip_address, battery_level } = req.body;
    
    if (!name || !device_type) {
      return res.status(400).json({ error: 'Tên thiết bị và loại thiết bị là bắt buộc.' });
    }
    
    const result = await pool.query(`
      UPDATE devices 
      SET name = $1, device_type = $2, status = $3, farm_id = $4, ip_address = $5, battery_level = $6, last_connection = NOW(), updated_at = NOW() 
      WHERE id = $7 
      RETURNING *
    `, [
      name, 
      device_type, 
      status || 'Hoạt động', 
      farm_id ? parseInt(farm_id) : null, 
      ip_address || null, 
      battery_level !== undefined ? parseInt(battery_level) : 100,
      req.params.id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy thiết bị.' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating device:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật thiết bị.' });
  }
});

// DELETE device (Admin only)
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM devices WHERE id = $1 RETURNING id', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy thiết bị.' });
    }
    
    res.json({ message: 'Đã xóa thiết bị thành công.' });
  } catch (err) {
    console.error('Error deleting device:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa thiết bị.' });
  }
});

module.exports = router;
