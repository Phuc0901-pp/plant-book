const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

function resolveCostContext(req) {
  const u = req.user || {};
  const role = u.role || 'farmer';
  const subRole = u.sub_role || 'farm_owner';
  const isRedacted = role !== 'admin' && (
    subRole === 'care_worker' ||
    subRole === 'auditor_readonly' ||
    u.allow_view_finance === false
  );
  const targetOwnerId = role === 'admin' ? null : (u.parent_user_id || u.id);
  return { role, subRole, isRedacted, targetOwnerId };
}

async function verifyCostFarmAccess(req, ctx, farmId) {
  const parsedFarmId = parseInt(farmId, 10);
  if (!Number.isInteger(parsedFarmId) || parsedFarmId <= 0) {
    return { ok: false, status: 400, error: 'Mã trang trại không hợp lệ.', code: 'INVALID_FARM_ID' };
  }
  const farmRes = await pool.query('SELECT id, user_id FROM farms WHERE id = $1 LIMIT 1', [parsedFarmId]);
  if (farmRes.rows.length === 0) {
    return { ok: false, status: 404, error: 'Không tìm thấy trang trại.', code: 'FARM_NOT_FOUND' };
  }
  const farm = farmRes.rows[0];
  if (ctx.role !== 'admin') {
    const isOwnerMatch = Number(farm.user_id) === Number(ctx.targetOwnerId);
    const isAssignedFarm = req.user.farm_id && Number(req.user.farm_id) === Number(farm.id);
    if (!isOwnerMatch && !isAssignedFarm) {
      return {
        ok: false,
        status: 403,
        error: 'Bạn không có quyền ghi nhận chi phí cho trang trại này.',
        code: 'FARM_ACCESS_DENIED'
      };
    }
  }
  return { ok: true, farmId: parsedFarmId, farmOwnerId: farm.user_id };
}

router.get('/consumables', auth, async (req, res) => {
  try {
    const ctx = resolveCostContext(req);
    if (ctx.isRedacted) {
      return res.status(403).json({
        error: 'Chế độ bảo mật RBAC: Tài khoản không có quyền truy cập dữ liệu tài chính/chi phí.',
        code: 'FINANCE_REDACTED_ROLE',
        isFinanceRedacted: true
      });
    }

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

    if (ctx.role !== 'admin') {
      query += ` AND (su.user_id = $${idx} OR f.user_id = $${idx})`;
      params.push(ctx.targetOwnerId);
      idx++;
    } else if (user_id && user_id !== 'all') {
      query += ` AND su.user_id = $${idx}`;
      params.push(parseInt(user_id, 10));
      idx++;
    }

    if (farm_id && farm_id !== 'all') {
      query += ` AND su.farm_id = $${idx}`;
      params.push(parseInt(farm_id, 10));
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

router.get('/fixed', auth, async (req, res) => {
  try {
    const ctx = resolveCostContext(req);
    if (ctx.isRedacted) {
      return res.status(403).json({
        error: 'Chế độ bảo mật RBAC: Tài khoản không có quyền truy cập dữ liệu tài chính/chi phí.',
        code: 'FINANCE_REDACTED_ROLE',
        isFinanceRedacted: true
      });
    }

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

    if (ctx.role !== 'admin') {
      query += ` AND (fa.user_id = $${idx} OR f.user_id = $${idx})`;
      params.push(ctx.targetOwnerId);
      idx++;
    } else if (user_id && user_id !== 'all') {
      query += ` AND fa.user_id = $${idx}`;
      params.push(parseInt(user_id, 10));
      idx++;
    }

    if (farm_id && farm_id !== 'all') {
      query += ` AND fa.farm_id = $${idx}`;
      params.push(parseInt(farm_id, 10));
      idx++;
    }

    query += ` ORDER BY fa.year DESC, fa.created_at DESC`;
    const result = await pool.query(query, params);
    const currentYear = new Date().getFullYear();
    const rows = result.rows.map(r => {
      const costVal = parseFloat(r.cost) || 0;
      const lifeVal = parseInt(r.life, 10) || 5;
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

router.post('/consumables', auth, async (req, res) => {
  try {
    const ctx = resolveCostContext(req);
    if (ctx.isRedacted) {
      return res.status(403).json({
        error: 'Chế độ bảo mật RBAC: Tài khoản không có quyền truy cập dữ liệu tài chính/chi phí.',
        code: 'FINANCE_REDACTED_ROLE',
        isFinanceRedacted: true
      });
    }

    const { farm_id, date, category, name, unit, qty, price, note } = req.body || {};
    if (!farm_id || !name || qty === undefined || qty === null) {
      return res.status(400).json({ error: 'Vui lòng chọn trang trại, nhập tên vật tư và số lượng.' });
    }

    const quantity = parseFloat(qty);
    const unitPrice = price !== undefined && price !== null && price !== '' ? parseFloat(price) : 0;
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return res.status(400).json({ error: 'Số lượng phải > 0 và đơn giá không được âm.', code: 'INVALID_AMOUNT' });
    }

    const farmAccess = await verifyCostFarmAccess(req, ctx, farm_id);
    if (!farmAccess.ok) {
      return res.status(farmAccess.status).json({ error: farmAccess.error, code: farmAccess.code });
    }

    const targetUserId = (ctx.role === 'admin' && farmAccess.farmOwnerId) ? farmAccess.farmOwnerId : ctx.targetOwnerId;

    let supplyId = null;
    const supplyCheck = await pool.query(
      `SELECT id FROM supplies WHERE user_id = $1 AND category = $2 AND LOWER(name) = LOWER($3)`,
      [targetUserId, category || 'Khác', String(name).trim()]
    );

    if (supplyCheck.rows.length > 0) {
      supplyId = supplyCheck.rows[0].id;
    } else {
      const newSupply = await pool.query(
        `INSERT INTO supplies (user_id, category, name, unit, unit_price)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [targetUserId, category || 'Khác', String(name).trim(), unit || 'kg', unitPrice]
      );
      supplyId = newSupply.rows[0].id;
    }

    const usageDate = date ? date : new Date().toISOString().split('T')[0];
    const totalCost = quantity * unitPrice;

    const result = await pool.query(
      `INSERT INTO supply_usages (user_id, supply_id, farm_id, usage_date, quantity, unit_price, total_cost, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [targetUserId, supplyId, farmAccess.farmId, usageDate, quantity, unitPrice, totalCost, note || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding consumable cost:', err);
    res.status(500).json({ error: 'Lỗi server khi thêm chi phí vật tư: ' + err.message });
  }
});

router.post('/fixed', auth, async (req, res) => {
  try {
    const ctx = resolveCostContext(req);
    if (ctx.isRedacted) {
      return res.status(403).json({
        error: 'Chế độ bảo mật RBAC: Tài khoản không có quyền truy cập dữ liệu tài chính/chi phí.',
        code: 'FINANCE_REDACTED_ROLE',
        isFinanceRedacted: true
      });
    }

    const { farm_id, name, category, year, cost, life, note } = req.body || {};
    if (!farm_id || !name || cost === undefined || cost === null) {
      return res.status(400).json({ error: 'Vui lòng chọn trang trại, tên tài sản và nguyên giá.' });
    }

    const costVal = parseFloat(cost);
    const lifeVal = life !== undefined && life !== null && life !== '' ? parseInt(life, 10) : 5;
    if (!Number.isFinite(costVal) || costVal <= 0 || !Number.isInteger(lifeVal) || lifeVal <= 0) {
      return res.status(400).json({ error: 'Nguyên giá và số năm khấu hao phải lớn hơn 0.', code: 'INVALID_AMOUNT' });
    }

    const farmAccess = await verifyCostFarmAccess(req, ctx, farm_id);
    if (!farmAccess.ok) {
      return res.status(farmAccess.status).json({ error: farmAccess.error, code: farmAccess.code });
    }

    const targetUserId = (ctx.role === 'admin' && farmAccess.farmOwnerId) ? farmAccess.farmOwnerId : ctx.targetOwnerId;

    const result = await pool.query(
      `INSERT INTO fixed_assets (user_id, farm_id, name, category, year, cost, life, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        targetUserId,
        farmAccess.farmId,
        String(name).trim(),
        category || 'Máy móc thiết bị',
        parseInt(year, 10) || new Date().getFullYear(),
        costVal,
        lifeVal,
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
