const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

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

router.delete('/:id', auth, async (req, res) => {
  return res.status(403).json({
    error: 'Nhật ký kiểm toán được bảo vệ bất biến (Append-Only) theo tiêu chuẩn ISO, không thể xóa dấu vết lịch sử.'
  });
});

router.delete('/', auth, async (req, res) => {
  return res.status(403).json({
    error: 'Nhật ký kiểm toán được bảo vệ bất biến (Append-Only) theo tiêu chuẩn ISO, không thể dọn dẹp hoặc xóa dấu vết lịch sử.'
  });
});

router.post('/:id/restore', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && ['care_worker', 'auditor_readonly'].includes(req.user.sub_role)) {
      return res.status(403).json({ error: 'Vai trò của bạn không có quyền khôi phục dữ liệu từ nhật ký kiểm toán.' });
    }
    const id = parseInt(req.params.id);
    const auditRes = await pool.query('SELECT * FROM data_audit_logs WHERE id = $1', [id]);
    if (auditRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi kiểm toán.' });
    }
    const auditItem = auditRes.rows[0];
    if (req.user.role !== 'admin' && Number(auditItem.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Bạn không có quyền khôi phục bản ghi kiểm toán thuộc tài khoản khác.' });
    }

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

      if (targetIds.length > 0 && req.user.role !== 'admin') {
        const unauthRes = await pool.query(
          `SELECT pl.id FROM plant_logs pl
           LEFT JOIN plants p ON p.id = pl.plant_id
           LEFT JOIN farms f ON f.id = p.farm_id
           WHERE pl.id = ANY($1::int[])
             AND NOT (f.user_id = $2 OR pl.created_by = $2 OR (p.farm_id IS NOT NULL AND p.farm_id = $3))
           LIMIT 1`,
          [targetIds, req.user.id, req.user.farm_id || 0]
        );
        if (unauthRes.rows.length > 0) {
          return res.status(403).json({ error: 'Tồn tại bản ghi nhật ký không thuộc trang trại của bạn.' });
        }
      }

      if (targetIds.length > 0) {
        await pool.query('UPDATE plant_logs SET is_deleted = false, deleted_at = NULL WHERE id = ANY($1::int[])', [targetIds]);
      }

      await logAuditAction(
        req.user.id,
        req.user.full_name || req.user.email,
        'RESTORE',
        auditItem.target_type,
        id,
        `Khôi phục ${targetIds.length} bản ghi từ kiểm toán #${id}`,
        { restored_from_audit_id: id },
        { restored_ids: targetIds },
        `Đã khôi phục thành công ${targetIds.length} bản ghi bởi ${req.user.full_name || req.user.email} lúc ${new Date().toISOString()}`
      );

      const broadcast = req.app.get('broadcast');
      if (broadcast) {
        broadcast('plants_updated', { message: `Restored ${targetIds.length} care logs` });
      }

      return res.json({ success: true, count: targetIds.length, message: `Đã khôi phục thành công ${targetIds.length} nhật ký canh tác.` });
    }

    if (auditItem.target_type === 'Trang trại' && auditItem.record_id) {
      if (req.user.role !== 'admin') {
        const fCheck = await pool.query('SELECT user_id FROM farms WHERE id = $1', [auditItem.record_id]);
        if (fCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Không tìm thấy trang trại cần khôi phục.' });
        }
        if (Number(fCheck.rows[0].user_id) !== Number(req.user.id)) {
          return res.status(403).json({ error: 'Bạn không có quyền khôi phục trang trại của tài khoản khác.' });
        }
      }
      await pool.query('UPDATE farms SET is_deleted = false, deleted_at = NULL WHERE id = $1', [auditItem.record_id]);
      await logAuditAction(
        req.user.id,
        req.user.full_name || req.user.email,
        'RESTORE',
        'Trang trại',
        auditItem.record_id,
        `Khôi phục trang trại #${auditItem.record_id} từ kiểm toán #${id}`,
        { restored_from_audit_id: id },
        { farm_id: auditItem.record_id },
        `Khôi phục trang trại bởi ${req.user.full_name || req.user.email}`
      );
      return res.json({ success: true, message: 'Đã khôi phục trang trại thành công.' });
    }

    res.json({ success: true, message: 'Đã xử lý khôi phục bản ghi.' });
  } catch (err) {
    console.error('Error restoring from audit log:', err);
    res.status(500).json({ error: 'Lỗi server khi khôi phục dữ liệu: ' + err.message });
  }
});

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
      return res.json({ success: true, message: `Đã xóa vĩnh viễn ${targetIds.length} bản ghi khỏi CSDL (lịch sử kiểm toán được giữ nguyên theo chuẩn ISO).` });
    }

    if (auditItem.target_type === 'Trang trại' && auditItem.record_id) {
      await pool.query('DELETE FROM farms WHERE id = $1', [auditItem.record_id]);
      return res.json({ success: true, message: 'Đã xóa vĩnh viễn trang trại khỏi CSDL (lịch sử kiểm toán được giữ nguyên theo chuẩn ISO).' });
    }

    return res.status(403).json({
      error: 'Nhật ký kiểm toán được bảo vệ bất biến (Append-Only) theo tiêu chuẩn ISO, không thể xóa bản ghi kiểm toán.'
    });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        error: 'Không thể xóa vĩnh viễn vì còn dữ liệu lịch sử liên kết (bảo vệ toàn vẹn dữ liệu chuẩn ISO).'
      });
    }
    console.error('Error purging data from audit log:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa vĩnh viễn: ' + err.message });
  }
});

module.exports = router;
module.exports.logAuditAction = logAuditAction;
