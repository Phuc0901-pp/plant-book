const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// ─── 1. SUPPLIES CRUD ─────────────────────────────────────────────

// GET /api/supplies — Lấy danh sách vật tư khai báo
router.get('/', auth, async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = `
      SELECT s.*, 
             COALESCE(SUM(su.total_cost), 0) as total_spent,
             COALESCE(SUM(su.quantity), 0) as total_used_qty
      FROM supplies s
      LEFT JOIN supply_usages su ON su.supply_id = s.id
      WHERE (s.user_id = $1 OR $2 = 'admin')
    `;
    const params = [req.user.id, req.user.role];
    let idx = 3;

    if (category) {
      query += ` AND s.category = $${idx}`;
      params.push(category);
      idx++;
    }

    if (search) {
      query += ` AND (s.name ILIKE $${idx} OR s.note ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ` GROUP BY s.id ORDER BY s.category ASC, s.name ASC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching supplies:', err);
    res.status(500).json({ error: 'Lỗi server khi tải danh sách vật tư.' });
  }
});

const multer = require('multer');
const { uploadFile } = require('../config/supabase');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

// POST /api/supplies/upload-image — Tải ảnh bao bì vật tư (phân bón / thuốc BVTV)
router.post('/upload-image', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn một tệp hình ảnh.' });
    const publicUrl = await uploadFile(req.file.buffer, req.file.originalname, 'supplies', req.file.mimetype);
    res.json({ url: publicUrl });
  } catch (err) {
    console.error('Error uploading supply image:', err);
    res.status(500).json({ error: 'Lỗi server khi tải ảnh vật tư lên.' });
  }
});

// POST /api/supplies — Khai báo vật tư mới
router.post('/', auth, async (req, res) => {
  try {
    const { category, name, unit, package_size, package_qty, package_unit, package_price, unit_price, unit_price_small, stock_quantity, note, image_url } = req.body;
    if (!category || !name || !unit) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ Hạng mục, Tên vật tư và Đơn vị tính.' });
    }

    const validCategories = ['Bón phân', 'Tiền nước', 'Phun thuốc', 'Nhân công'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Hạng mục gốc không hợp lệ. Chọn một trong: Bón phân, Tiền nước, Phun thuốc, Nhân công.' });
    }

    const price = parseFloat(unit_price) || 0;
    const pkgQty = parseFloat(package_qty) || 1;
    const pkgPrice = parseFloat(package_price) || price;
    const unitPriceSmall = parseFloat(unit_price_small) || (pkgQty > 0 ? price / pkgQty : 0);
    const stock = parseFloat(stock_quantity) || 0;

    const result = await pool.query(
      `INSERT INTO supplies (user_id, category, name, unit, package_size, package_qty, package_unit, package_price, unit_price, unit_price_small, stock_quantity, note, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        req.user.id,
        category.trim(),
        name.trim(),
        unit.trim(),
        package_size ? package_size.trim() : null,
        pkgQty,
        package_unit ? package_unit.trim() : unit.trim(),
        pkgPrice,
        price,
        unitPriceSmall,
        stock,
        note || null,
        image_url || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating supply:', err);
    res.status(500).json({ error: 'Lỗi server khi thêm vật tư.' });
  }
});

// PUT /api/supplies/:id — Cập nhật thông tin vật tư
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { category, name, unit, package_size, package_qty, package_unit, package_price, unit_price, unit_price_small, stock_quantity, note, image_url } = req.body;

    const check = await pool.query('SELECT * FROM supplies WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy vật tư.' });
    }
    if (req.user.role !== 'admin' && check.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền sửa vật tư này.' });
    }

    const price = parseFloat(unit_price) || 0;
    const pkgQty = parseFloat(package_qty) || check.rows[0].package_qty || 1;
    const pkgPrice = parseFloat(package_price) || check.rows[0].package_price || price;
    const unitPriceSmall = parseFloat(unit_price_small) || (pkgQty > 0 ? price / pkgQty : 0);
    const stock = parseFloat(stock_quantity) || 0;

    const result = await pool.query(
      `UPDATE supplies 
       SET category = $1, name = $2, unit = $3, package_size = $4, package_qty = $5, package_unit = $6, package_price = $7, unit_price = $8, unit_price_small = $9, stock_quantity = $10, note = $11, image_url = $12, updated_at = NOW()
       WHERE id = $13
       RETURNING *`,
      [
        category || check.rows[0].category,
        name || check.rows[0].name,
        unit || check.rows[0].unit,
        package_size !== undefined ? package_size : check.rows[0].package_size,
        pkgQty,
        package_unit || check.rows[0].package_unit,
        pkgPrice,
        price,
        unitPriceSmall,
        stock,
        note !== undefined ? note : check.rows[0].note,
        image_url !== undefined ? image_url : check.rows[0].image_url,
        id
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating supply:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật vật tư.' });
  }
});

// DELETE /api/supplies/:id — Xóa vật tư
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const check = await pool.query('SELECT * FROM supplies WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy vật tư.' });
    }
    if (req.user.role !== 'admin' && check.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa vật tư này.' });
    }

    await pool.query('DELETE FROM supplies WHERE id = $1', [id]);
    res.json({ success: true, message: 'Đã xóa vật tư thành công.' });
  } catch (err) {
    console.error('Error deleting supply:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa vật tư.' });
  }
});

// ─── 2. USAGE LOGS & RECORDING ───────────────────────────────────

// GET /api/supplies/usages — Lấy nhật ký tiêu hao vật tư
router.get('/usages', auth, async (req, res) => {
  try {
    const { farm_id, category, limit } = req.query;
    let query = `
      SELECT su.*, s.name as supply_name, s.category, s.unit,
             f.name as farm_name, p.plant_type, p.tree_code
      FROM supply_usages su
      JOIN supplies s ON su.supply_id = s.id
      LEFT JOIN farms f ON su.farm_id = f.id
      LEFT JOIN plants p ON su.plant_id = p.id
      WHERE (su.user_id = $1 OR $2 = 'admin')
    `;
    const params = [req.user.id, req.user.role];
    let idx = 3;

    if (farm_id) {
      query += ` AND su.farm_id = $${idx}`;
      params.push(parseInt(farm_id));
      idx++;
    }
    if (category) {
      query += ` AND s.category = $${idx}`;
      params.push(category);
      idx++;
    }

    query += ` ORDER BY su.usage_date DESC, su.created_at DESC`;

    if (limit) {
      query += ` LIMIT $${idx}`;
      params.push(parseInt(limit));
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching supply usages:', err);
    res.status(500).json({ error: 'Lỗi server khi tải nhật ký tiêu hao.' });
  }
});

// POST /api/supplies/usages — Ghi nhận tiêu hao vật tư
router.post('/usages', auth, async (req, res) => {
  try {
    const { supply_id, farm_id, plant_id, usage_date, quantity, note } = req.body;
    if (!supply_id || !quantity) {
      return res.status(400).json({ error: 'Vui lòng chọn vật tư và nhập số lượng tiêu hao.' });
    }

    const supplyRes = await pool.query('SELECT * FROM supplies WHERE id = $1', [supply_id]);
    if (supplyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Vật tư không tồn tại.' });
    }
    const supply = supplyRes.rows[0];

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Số lượng tiêu hao phải lớn hơn 0.' });
    }

    const unit_price = parseFloat(supply.unit_price) || 0;
    const total_cost = qty * unit_price;

    const uDate = usage_date ? new Date(usage_date) : new Date();

    const result = await pool.query(
      `INSERT INTO supply_usages (user_id, supply_id, farm_id, plant_id, usage_date, quantity, unit_price, total_cost, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, supply.id, farm_id || null, plant_id || null, uDate, qty, unit_price, total_cost, note || null]
    );

    // Trừ kho vật tư (nếu có kho)
    if (supply.stock_quantity > 0) {
      await pool.query('UPDATE supplies SET stock_quantity = GREATEST(0, stock_quantity - $1) WHERE id = $2', [qty, supply.id]);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error recording supply usage:', err);
    res.status(500).json({ error: 'Lỗi server khi ghi nhận tiêu hao vật tư.' });
  }
});

// DELETE /api/supplies/usages/:id — Xóa nhật ký tiêu hao
router.delete('/usages/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const check = await pool.query('SELECT * FROM supply_usages WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy nhật ký tiêu hao.' });
    }
    if (req.user.role !== 'admin' && check.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa bản ghi này.' });
    }

    await pool.query('DELETE FROM supply_usages WHERE id = $1', [id]);
    res.json({ success: true, message: 'Đã xóa bản ghi tiêu hao vật tư.' });
  } catch (err) {
    console.error('Error deleting supply usage:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa nhật ký tiêu hao.' });
  }
});

// ─── 3. ANALYTICS & COST MONITORING ──────────────────────────────

// GET /api/supplies/analytics — Thống kê chi phí theo Ngày, Tháng, Quý, Năm
router.get('/analytics', auth, async (req, res) => {
  try {
    const { period = 'month', year = new Date().getFullYear(), farm_id } = req.query;
    
    let baseWhere = `WHERE (su.user_id = $1 OR $2 = 'admin')`;
    const params = [req.user.id, req.user.role];
    let idx = 3;

    if (farm_id && farm_id !== 'all') {
      baseWhere += ` AND su.farm_id = $${idx}`;
      params.push(parseInt(farm_id));
      idx++;
    }

    // 1. Overall Category Totals
    const catTotalsQuery = `
      SELECT s.category, COALESCE(SUM(su.total_cost), 0) as total_cost, COUNT(su.id) as transaction_count
      FROM supply_usages su
      JOIN supplies s ON su.supply_id = s.id
      ${baseWhere}
      GROUP BY s.category
    `;
    const catTotalsRes = await pool.query(catTotalsQuery, params);

    const categorySummary = {
      'Bón phân': 0,
      'Tiền nước': 0,
      'Phun thuốc': 0,
      'Nhân công': 0,
    };
    let totalExpenditure = 0;

    catTotalsRes.rows.forEach(r => {
      if (categorySummary.hasOwnProperty(r.category)) {
        categorySummary[r.category] = parseFloat(r.total_cost) || 0;
      }
      totalExpenditure += parseFloat(r.total_cost) || 0;
    });

    // 2. Time Grouping Breakdown (Theo Ngày, Theo Tháng, Theo Quý, Theo Năm)
    let timeGroupSelect = '';
    let timeGroupOrderBy = '';

    if (period === 'day') {
      // Group by Date for the current month
      timeGroupSelect = `TO_CHAR(su.usage_date, 'YYYY-MM-DD') as period_label, EXTRACT(DAY FROM su.usage_date) as period_num`;
      timeGroupOrderBy = `ORDER BY period_label ASC`;
    } else if (period === 'quarter') {
      // Group by Quarter (Q1, Q2, Q3, Q4) for the selected year
      timeGroupSelect = `'Quý ' || EXTRACT(QUARTER FROM su.usage_date) as period_label, EXTRACT(QUARTER FROM su.usage_date) as period_num`;
      timeGroupOrderBy = `ORDER BY period_num ASC`;
    } else if (period === 'year') {
      // Group by Year
      timeGroupSelect = `TO_CHAR(su.usage_date, 'YYYY') as period_label, EXTRACT(YEAR FROM su.usage_date) as period_num`;
      timeGroupOrderBy = `ORDER BY period_num ASC`;
    } else {
      // Default: Month (Tháng 1 -> Tháng 12) for the selected year
      timeGroupSelect = `'Tháng ' || EXTRACT(MONTH FROM su.usage_date) as period_label, EXTRACT(MONTH FROM su.usage_date) as period_num`;
      timeGroupOrderBy = `ORDER BY period_num ASC`;
    }

    let filterYearClause = '';
    if (period === 'month' || period === 'quarter' || period === 'day') {
      filterYearClause = ` AND EXTRACT(YEAR FROM su.usage_date) = $${idx}`;
      params.push(parseInt(year));
      idx++;
    }

    const breakdownQuery = `
      SELECT ${timeGroupSelect},
             s.category,
             COALESCE(SUM(su.total_cost), 0) as total_cost,
             COALESCE(SUM(su.quantity), 0) as total_quantity
      FROM supply_usages su
      JOIN supplies s ON su.supply_id = s.id
      ${baseWhere} ${filterYearClause}
      GROUP BY period_label, period_num, s.category
      ${timeGroupOrderBy}
    `;

    const breakdownRes = await pool.query(breakdownQuery, params);

    res.json({
      period,
      selected_year: parseInt(year),
      summary: {
        total_expenditure: totalExpenditure,
        categories: categorySummary,
      },
      time_breakdown: breakdownRes.rows,
    });
  } catch (err) {
    console.error('Error fetching supplies analytics:', err);
    res.status(500).json({ error: 'Lỗi server khi thống kê chi phí vật tư.' });
  }
});

module.exports = router;
