const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// Helper function to log audit events into data_audit_logs
async function logAuditAction(userId, userName, actionType, targetType, recordId, title, oldData = {}, newData = {}, note = '') {
  try {
    await pool.query(
      `INSERT INTO data_audit_logs (user_id, user_name, action_type, target_type, record_id, title, old_data, new_data, note, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [userId, userName || 'Hệ thống', actionType, targetType, recordId, title, JSON.stringify(oldData), JSON.stringify(newData), note]
    );
  } catch (err) {
    console.error('Error recording audit log:', err);
  }
}

// GET /api/history — Lấy nhật ký biến động (Chỉnh sửa & Xóa dữ liệu)
router.get('/', auth, async (req, res) => {
  try {
    const { action_type, target_type, search } = req.query;

    let query = `
      SELECT dal.*, u.full_name as current_user_name, u.email as user_email
      FROM data_audit_logs dal
      LEFT JOIN users u ON u.id = dal.user_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (req.user.role !== 'admin') {
      query += ` AND dal.user_id = $${idx}`;
      params.push(req.user.id);
      idx++;
    }

    if (action_type) {
      query += ` AND dal.action_type = $${idx}`;
      params.push(action_type);
      idx++;
    }

    if (target_type) {
      query += ` AND dal.target_type = $${idx}`;
      params.push(target_type);
      idx++;
    }

    if (search) {
      query += ` AND (dal.title ILIKE $${idx} OR dal.user_name ILIKE $${idx} OR dal.note ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ` ORDER BY dal.created_at DESC LIMIT 200`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching audit history:', err);
    res.status(500).json({ error: 'Lỗi server khi tải nhật ký biến động.' });
  }
});

module.exports = router;
module.exports.logAuditAction = logAuditAction;
