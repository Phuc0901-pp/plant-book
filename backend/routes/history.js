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

// DELETE /api/history/:id — Xóa một dòng nhật ký biến động
router.delete('/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (req.user.role !== 'admin') {
      await pool.query('DELETE FROM data_audit_logs WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    } else {
      await pool.query('DELETE FROM data_audit_logs WHERE id = $1', [id]);
    }
    res.json({ success: true, message: 'Đã xóa bản ghi nhật ký biến động thành công.' });
  } catch (err) {
    console.error('Error deleting audit log:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa nhật ký biến động.' });
  }
});

// DELETE /api/history — Dọn dẹp/Xóa toàn bộ nhật ký biến động
router.delete('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      await pool.query('DELETE FROM data_audit_logs WHERE user_id = $1', [req.user.id]);
    } else {
      await pool.query('DELETE FROM data_audit_logs');
    }
    res.json({ success: true, message: 'Đã dọn dẹp sạch toàn bộ nhật ký biến động.' });
  } catch (err) {
    console.error('Error clearing audit logs:', err);
    res.status(500).json({ error: 'Lỗi server khi dọn dẹp nhật ký.' });
  }
});

// POST /api/history/:id/restore — Khôi phục bản ghi bị xóa mềm
router.post('/:id/restore', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const auditRes = await pool.query('SELECT * FROM data_audit_logs WHERE id = $1', [id]);
    if (auditRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi kiểm toán.' });
    }
    const auditItem = auditRes.rows[0];

    if (auditItem.target_type === 'Nhật ký canh tác' || auditItem.target_type === 'Nhật ký canh tác hàng loạt') {
      let targetIds = [];
      if (auditItem.record_id && auditItem.record_id > 0) {
        targetIds.push(auditItem.record_id);
      }
      let oldData = {};
      try {
        oldData = typeof auditItem.old_data === 'string' ? JSON.parse(auditItem.old_data) : (auditItem.old_data || {});
      } catch (e) {}

      if (Array.isArray(oldData.deleted_ids)) {
        targetIds = targetIds.concat(oldData.deleted_ids);
      } else if (Array.isArray(oldData.sample_ids)) {
        targetIds = targetIds.concat(oldData.sample_ids);
      }
      targetIds = [...new Set(targetIds.filter(n => !isNaN(n) && n > 0))];

      if (targetIds.length > 0) {
        await pool.query('UPDATE plant_logs SET is_deleted = false, deleted_at = NULL WHERE id = ANY($1::int[])', [targetIds]);
      }

      await pool.query('UPDATE data_audit_logs SET note = $1 WHERE id = $2', [
        `Đã khôi phục thành công ${targetIds.length} bản ghi bởi ${req.user.full_name || req.user.email} lúc ${new Date().toISOString()}`,
        id
      ]);

      const broadcast = req.app.get('broadcast');
      if (broadcast) {
        broadcast('plants_updated', { message: `Restored ${targetIds.length} care logs` });
      }

      return res.json({ success: true, count: targetIds.length, message: `Đã khôi phục thành công ${targetIds.length} nhật ký canh tác.` });
    }

    if (auditItem.target_type === 'Trang trại' && auditItem.record_id) {
      await pool.query('UPDATE farms SET is_deleted = false, deleted_at = NULL WHERE id = $1', [auditItem.record_id]);
      return res.json({ success: true, message: 'Đã khôi phục trang trại thành công.' });
    }

    res.json({ success: true, message: 'Đã xử lý khôi phục bản ghi.' });
  } catch (err) {
    console.error('Error restoring from audit log:', err);
    res.status(500).json({ error: 'Lỗi server khi khôi phục dữ liệu: ' + err.message });
  }
});

// DELETE /api/history/:id/purge — Xóa vĩnh viễn dữ liệu bị xóa mềm khỏi CSDL (Admin only)
router.delete('/:id/purge', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ Admin mới có quyền xóa vĩnh viễn dữ liệu khỏi CSDL.' });
    }
    const id = parseInt(req.params.id);
    const auditRes = await pool.query('SELECT * FROM data_audit_logs WHERE id = $1', [id]);
    if (auditRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi kiểm toán.' });
    }
    const auditItem = auditRes.rows[0];

    if (auditItem.target_type === 'Nhật ký canh tác' || auditItem.target_type === 'Nhật ký canh tác hàng loạt') {
      let targetIds = [];
      if (auditItem.record_id && auditItem.record_id > 0) targetIds.push(auditItem.record_id);
      let oldData = {};
      try {
        oldData = typeof auditItem.old_data === 'string' ? JSON.parse(auditItem.old_data) : (auditItem.old_data || {});
      } catch (e) {}
      if (Array.isArray(oldData.deleted_ids)) targetIds = targetIds.concat(oldData.deleted_ids);
      else if (Array.isArray(oldData.sample_ids)) targetIds = targetIds.concat(oldData.sample_ids);
      targetIds = [...new Set(targetIds.filter(n => !isNaN(n) && n > 0))];

      if (targetIds.length > 0) {
        await pool.query('DELETE FROM plant_logs WHERE id = ANY($1::int[])', [targetIds]);
      }
      await pool.query('DELETE FROM data_audit_logs WHERE id = $1', [id]);
      return res.json({ success: true, message: `Đã xóa vĩnh viễn ${targetIds.length} bản ghi khỏi CSDL.` });
    }

    if (auditItem.target_type === 'Trang trại' && auditItem.record_id) {
      await pool.query('DELETE FROM farms WHERE id = $1', [auditItem.record_id]);
      await pool.query('DELETE FROM data_audit_logs WHERE id = $1', [id]);
      return res.json({ success: true, message: 'Đã xóa vĩnh viễn trang trại khỏi CSDL.' });
    }

    await pool.query('DELETE FROM data_audit_logs WHERE id = $1', [id]);
    res.json({ success: true, message: 'Đã dọn dẹp bản ghi kiểm toán.' });
  } catch (err) {
    console.error('Error purging data from audit log:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa vĩnh viễn: ' + err.message });
  }
});

module.exports = router;
module.exports.logAuditAction = logAuditAction;
