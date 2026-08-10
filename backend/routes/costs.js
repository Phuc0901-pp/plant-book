const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// GET /api/costs/consumables — Lấy danh sách tiêu hao vật tư từ DB
router.get('/consumables', auth, async (req, res) => {
  try {
    const { farm_id, user_id } = req.query;
    let query = `
      SELECT su.id, su.usage_date as date, s.category, s.name, s.unit,
             su.quantity as qty, su.unit_price as price, su.total_cost as total,
             su.farm_id, f.name as farm_name, su.user_id, u.full_name as user_name, su.note
      FROM supply_usages su
      JOIN supplies s ON su.supply_id = s.id
      LEFT JOIN farms f ON su.farm_id = f.id
      LEFT JOIN users u ON su.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (req.user.role !== 'admin') {
      query += ` AND su.user_id = $${idx}`;
      params.push(req.user.id);
      idx++;
    } else if (user_id && user_id !== 'all') {
      query += ` AND su.user_id = $${idx}`;
      params.push(parseInt(user_id));
      idx++;
    }

    if (farm_id && farm_id !== 'all') {
      query += ` AND su.farm_id = $${idx}`;
      params.push(parseInt(farm_id));
      idx++;
    }

    query += ` ORDER BY su.usage_date DESC, su.created_at DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching consumable costs:', err);
    res.status(500).json({ error: 'Lỗi server khi tải dữ liệu chi phí vật tư.' });
  }
});

// GET /api/costs/fixed — Lấy danh sách tài sản cố định từ DB
router.get('/fixed', auth, async (req, res) => {
  try {
    const { farm_id, user_id } = req.query;
    let query = `
      SELECT fa.id, fa.name, fa.category, fa.year, fa.cost, fa.life,
             fa.farm_id, f.name as farm_name, fa.user_id, u.full_name as user_name, fa.note
      FROM fixed_assets fa
      LEFT JOIN farms f ON fa.farm_id = f.id
      LEFT JOIN users u ON fa.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (req.user.role !== 'admin') {
      query += ` AND fa.user_id = $${idx}`;
      params.push(req.user.id);
      idx++;
    } else if (user_id && user_id !== 'all') {
      query += ` AND fa.user_id = $${idx}`;
      params.push(parseInt(user_id));
      idx++;
    }

    if (farm_id && farm_id !== 'all') {
      query += ` AND fa.farm_id = $${idx}`;
      params.push(parseInt(farm_id));
      idx++;
    }

    query += ` ORDER BY fa.year DESC, fa.created_at DESC`;
    const result = await pool.query(query, params);
    const currentYear = new Date().getFullYear();
    const rows = result.rows.map(r => {
      const costVal = parseFloat(r.cost) || 0;
      const lifeVal = parseInt(r.life) || 5;
      const depPerYear = Math.round(costVal / lifeVal);
      const usedYears = Math.max(0, currentYear - r.year);
      const remaining = Math.max(0, costVal - depPerYear * usedYears);
      return {
        ...r,
        cost: costVal,
        life: lifeVal,
        dep_per_year: depPerYear,
        remaining
      };
    });
    res.json(rows);
  } catch (err) {
    console.error('Error fetching fixed assets:', err);
    res.status(500).json({ error: 'Lỗi server khi tải dữ liệu tài sản cố định.' });
  }
});

// POST /api/costs/consumables — Khai báo và ghi nhận vật tư tiêu hao vào DB
router.post('/consumables', auth, async (req, res) => {
  try {
    const { farm_id, date, category, name, unit, qty, price, note } = req.body;
    if (!farm_id || !name || !qty) {
      return res.status(400).json({ error: 'Vui lòng chọn trang trại, nhập tên vật tư và số lượng.' });
    }

    const farmRes = await pool.query('SELECT user_id FROM farms WHERE id = $1', [farm_id]);
    const farmUserId = farmRes.rows.length > 0 ? farmRes.rows[0].user_id : req.user.id;
    const targetUserId = (req.user.role === 'admin' && farmUserId) ? farmUserId : req.user.id;

    // 1. Check or insert into supplies table
    let supplyId = null;
    const supplyCheck = await pool.query(
      `SELECT id FROM supplies WHERE user_id = $1 AND category = $2 AND LOWER(name) = LOWER($3)`,
      [targetUserId, category || 'Khác', name.trim()]
    );

    if (supplyCheck.rows.length > 0) {
      supplyId = supplyCheck.rows[0].id;
    } else {
      const newSupply = await pool.query(
        `INSERT INTO supplies (user_id, category, name, unit, unit_price)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [targetUserId, category || 'Khác', name.trim(), unit || 'kg', parseFloat(price) || 0]
      );
      supplyId = newSupply.rows[0].id;
    }

    // 2. Insert into supply_usages
    const usageDate = date ? date : new Date().toISOString().split('T')[0];
    const quantity = parseFloat(qty) || 1;
    const unitPrice = parseFloat(price) || 0;
    const totalCost = quantity * unitPrice;

    const result = await pool.query(
      `INSERT INTO supply_usages (user_id, supply_id, farm_id, usage_date, quantity, unit_price, total_cost, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [targetUserId, supplyId, farm_id, usageDate, quantity, unitPrice, totalCost, note || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding consumable cost:', err);
    res.status(500).json({ error: 'Lỗi server khi thêm chi phí vật tư: ' + err.message });
  }
});

// POST /api/costs/fixed — Khai báo tài sản cố định vào DB
router.post('/fixed', auth, async (req, res) => {
  try {
    const { farm_id, name, category, year, cost, life, note } = req.body;
    if (!farm_id || !name || !cost) {
      return res.status(400).json({ error: 'Vui lòng chọn trang trại, tên tài sản và nguyên giá.' });
    }

    const farmRes = await pool.query('SELECT user_id FROM farms WHERE id = $1', [farm_id]);
    const farmUserId = farmRes.rows.length > 0 ? farmRes.rows[0].user_id : req.user.id;
    const targetUserId = (req.user.role === 'admin' && farmUserId) ? farmUserId : req.user.id;

    const result = await pool.query(
      `INSERT INTO fixed_assets (user_id, farm_id, name, category, year, cost, life, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        targetUserId,
        farm_id,
        name.trim(),
        category || 'Máy móc thiết bị',
        parseInt(year) || new Date().getFullYear(),
        parseFloat(cost) || 0,
        parseInt(life) || 5,
        note || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding fixed asset:', err);
    res.status(500).json({ error: 'Lỗi server khi thêm tài sản cố định: ' + err.message });
  }
});

module.exports = router;
