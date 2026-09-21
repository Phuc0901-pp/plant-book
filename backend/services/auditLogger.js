/* ═══════════════════════════════════════════════════════════════
   Plant Book – Backend
   services/auditLogger.js — Audit Trail & Change Logging Engine
   ═══════════════════════════════════════════════════════════════ */

const pool = require('../config/db');

/**
 * Ghi nhận hành động vào bảng audit_logs
 * @param {object} params
 * @param {string} params.actionType Loại hành vi (CREATE_PLANT, UPDATE_PLANT, DELETE_PLANT, RESTORE_PLANT, ASSIGN_NFC, REORDER_GPS)
 * @param {string} params.tableName Tên bảng bị tác động (plants, care_logs, farms, supplies)
 * @param {number|string} params.recordId ID của bản ghi
 * @param {number|string} [params.userId] ID của người dùng thực hiện (tùy chọn)
 * @param {object} [params.oldData] Dữ liệu cũ trước khi sửa/xóa
 * @param {object} [params.newData] Dữ liệu mới sau khi tạo/sửa
 * @param {string} [params.ipAddress] Địa chỉ IP client
 * @param {string} [params.notes] Ghi chú mô tả
 */
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
    // Audit log failure shouldn't break the main business transaction, but log warning
    console.warn('⚠️ [AuditLogger] Warning logging audit trail:', err.message);
    return null;
  }
}

module.exports = {
  logAudit
};
