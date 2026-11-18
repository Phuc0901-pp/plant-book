const pool = require('../config/db');

async function logAudit({
  actionType,
  tableName,
  recordId,
  userId = null,
  oldData = null,
  newData = null,
  ipAddress = null,
  notes = null
}) {
  try {
    const query = `
      INSERT INTO audit_logs (
        action_type, table_name, record_id, user_id, old_data, new_data, ip_address, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id
    `;
    const values = [
      actionType,
      tableName,
      recordId ? String(recordId) : null,
      userId || null,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
      ipAddress || null,
      notes || null
    ];

    const res = await pool.query(query, values);
    return res.rows[0]?.id || null;
  } catch (err) {
    console.warn('⚠️ [AuditLogger] Warning logging audit trail:', err.message);
    return null;
  }
}

module.exports = {
  logAudit
};
