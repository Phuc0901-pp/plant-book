const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// GET all configurations (Public - for dropdowns on public page)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM system_configs');
    const configs = {};
    result.rows.forEach(row => {
      configs[row.key] = row.value;
    });
    res.json(configs);
  } catch (err) {
    console.error('Error fetching configs:', err);
    res.status(500).json({ error: 'Lỗi server khi lấy cấu hình.' });
  }
});

// PUT update configurations (Admin auth required)
router.put('/', auth, async (req, res) => {
  try {
    const updates = req.body; // e.g. { fertilizers: [...], pesticides: [...] }
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      for (const [key, value] of Object.entries(updates)) {
        if (!Array.isArray(value)) {
          return res.status(400).json({ error: `Giá trị cho ${key} phải là một mảng.` });
        }
        await client.query(`
          INSERT INTO system_configs (key, value, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value, updated_at = NOW()
        `, [key, JSON.stringify(value)]);
      }
      await client.query('COMMIT');
      res.json({ message: 'Cập nhật cấu hình thành công.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error updating configs:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật cấu hình.' });
  }
});

module.exports = router;
