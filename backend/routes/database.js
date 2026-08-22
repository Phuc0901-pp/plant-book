const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { delCacheByPattern } = require('../config/redis');

// Allowed public tables to inspect and manage
const ALLOWED_TABLES = [
  'users', 'farms', 'plants', 'farm_iot_sensors', 'supplies', 
  'plant_logs', 'costs', 'user_notifications', 'data_audit_logs', 
  'devices', 'crop_schemas', 'user_activities'
];

function sanitizeTableName(name) {
  if (!ALLOWED_TABLES.includes(name)) {
    throw new Error(`Bảng ${name} không nằm trong danh sách CSDL hợp lệ.`);
  }
  return name;
}

/**
 * GET /api/database/check — Admin Database Schema & Field Telemetry Inspector
 */
router.get('/check', auth, admin, async (req, res) => {
  try {
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `);

    const tables = [];

    for (const tRow of tablesRes.rows) {
      const tableName = tRow.table_name;
      if (!ALLOWED_TABLES.includes(tableName)) continue;

      const colsRes = await pool.query(`
        SELECT 
          column_name, 
          data_type, 
          is_nullable, 
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position ASC
      `, [tableName]);

      let rowCount = 0;
      try {
        const countRes = await pool.query(`SELECT COUNT(*)::int as count FROM "${tableName}"`);
        rowCount = countRes.rows[0].count;
      } catch (_) {}

      tables.push({
        table_name: tableName,
        row_count: rowCount,
        column_count: colsRes.rows.length,
        columns: colsRes.rows.map(c => ({
          column_name: c.column_name,
          data_type: c.data_type,
          is_nullable: c.is_nullable === 'YES',
          column_default: c.column_default
        }))
      });
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      inspected_by: {
        id: req.user.id,
        public_id: req.user.public_id || `adm-${req.user.id}`,
        name: req.user.full_name || req.user.email,
        role: req.user.role
      },
      database_type: 'PostgreSQL',
      total_tables: tables.length,
      tables
    });
  } catch (err) {
    console.error('Error inspecting database schema:', err);
    res.status(500).json({ error: 'Lỗi server khi kiểm tra CSDL: ' + err.message });
  }
});

/**
 * GET /api/database/tables/:tableName/records — Fetch records from specific table
 */
router.get('/tables/:tableName/records', auth, admin, async (req, res) => {
  try {
    const tableName = sanitizeTableName(req.params.tableName);
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    const countRes = await pool.query(`SELECT COUNT(*)::int as count FROM "${tableName}"`);
    const totalRecords = countRes.rows[0].count;

    const recordsRes = await pool.query(
      `SELECT * FROM "${tableName}" ORDER BY id DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      success: true,
      table_name: tableName,
      total_records: totalRecords,
      page,
      limit,
      records: recordsRes.rows
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/database/tables/:tableName/records — Insert a record into specific table
 */
router.post('/tables/:tableName/records', auth, admin, async (req, res) => {
  try {
    const tableName = sanitizeTableName(req.params.tableName);
    const data = req.body;

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Dữ liệu thêm mới không được rỗng.' });
    }

    const keys = Object.keys(data);
    const values = Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : v);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const queryStr = `
      INSERT INTO "${tableName}" (${keys.map(k => `"${k}"`).join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await pool.query(queryStr, values);
    await delCacheByPattern(`${tableName}_`);
    await delCacheByPattern('farms_');

    res.status(201).json({
      success: true,
      message: `Đã thêm 1 bản ghi mới vào bảng "${tableName}" thành công!`,
      record: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi thêm bản ghi: ' + err.message });
  }
});

/**
 * PUT /api/database/tables/:tableName/records/:id — Update a record in specific table
 */
router.put('/tables/:tableName/records/:id', auth, admin, async (req, res) => {
  try {
    const tableName = sanitizeTableName(req.params.tableName);
    const recordId = parseInt(req.params.id);
    const data = req.body;

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Dữ liệu cập nhật không được rỗng.' });
    }

    const keys = Object.keys(data).filter(k => k !== 'id');
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const values = keys.map(k => typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
    values.push(recordId);

    const queryStr = `
      UPDATE "${tableName}"
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *
    `;

    const result = await pool.query(queryStr, values);
    await delCacheByPattern(`${tableName}_`);
    await delCacheByPattern('farms_');

    res.json({
      success: true,
      message: `Đã cập nhật bản ghi #${recordId} trong bảng "${tableName}" thành công!`,
      record: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi cập nhật bản ghi: ' + err.message });
  }
});

/**
 * DELETE /api/database/tables/:tableName/records/:id — Delete a record from specific table
 */
router.delete('/tables/:tableName/records/:id', auth, admin, async (req, res) => {
  try {
    const tableName = sanitizeTableName(req.params.tableName);
    const recordId = parseInt(req.params.id);

    const result = await pool.query(`DELETE FROM "${tableName}" WHERE id = $1 RETURNING *`, [recordId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Không tìm thấy bản ghi #${recordId} trong bảng ${tableName}.` });
    }

    await delCacheByPattern(`${tableName}_`);
    await delCacheByPattern('farms_');

    res.json({
      success: true,
      message: `Đã xóa bản ghi #${recordId} khỏi bảng "${tableName}" thành công!`,
      deleted_record: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi xóa bản ghi: ' + err.message });
  }
});

module.exports = router;
