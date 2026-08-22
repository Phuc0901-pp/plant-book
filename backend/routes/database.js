const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

/**
 * GET /api/database/check — Admin Database Schema & Field Telemetry Inspector
 * Requires Admin login authentication (auth + admin middleware).
 */
router.get('/check', auth, admin, async (req, res) => {
  try {
    // 1. Query all public database tables
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `);

    const tables = [];

    for (const tRow of tablesRes.rows) {
      const tableName = tRow.table_name;

      // Query columns, data types, nullability, and defaults
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

      // Query row count per table
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

module.exports = router;
