const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

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

module.exports = router;
