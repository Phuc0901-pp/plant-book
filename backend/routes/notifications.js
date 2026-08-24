/* ═══════════════════════════════════════════════════════════════
   Plant Book – Backend
   routes/notifications.js — Autonomous In-App & Sensor Rules Engine
   ═══════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// Standard agricultural metric definitions
const METRIC_LABELS = {
  soil_moisture_20cm: { name: 'Độ ẩm đất tầng 20cm', unit: '%' },
  soil_moisture_50cm: { name: 'Độ ẩm đất tầng 50cm', unit: '%' },
  air_temp: { name: 'Nhiệt độ không khí', unit: '°C' },
  air_humidity: { name: 'Độ ẩm không khí', unit: '%' },
  soil_ph: { name: 'Độ pH đất', unit: 'pH' },
  soil_ec: { name: 'Độ EC dẫn điện đất', unit: 'mS/cm' },
  rain_chance: { name: 'Khả năng mưa rào', unit: '%' },
  water_level: { name: 'Mực nước bể lưu', unit: '%' }
};

// GET /api/notifications — Fetch user active notifications (is_archived = false)
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Auto check & generate initial notifications if empty
    const checkRes = await pool.query('SELECT COUNT(*)::int as count FROM user_notifications WHERE user_id = $1', [userId]);
    if (checkRes.rows[0].count === 0) {
      await pool.query(`
        INSERT INTO user_notifications (user_id, title, message, type, is_read, is_archived)
        VALUES 
          ($1, '🚨 Cảnh báo Độ ẩm Đất Tầng 20cm', 'Độ ẩm đất tại vườn giảm xuống 42% (Dưới ngưỡng 50%). Khuyến nghị bật hệ thống tưới rễ buổi sáng!', 'danger', false, false),
          ($1, '🌦️ Cảnh báo Khí tượng Nông nghiệp', 'Chiều nay có khả năng mưa rào rải rác 65%. Hạn chế phun thuốc sâu tránh bị rửa trôi.', 'warning', false, false),
          ($1, '🌱 Lịch trình Chăm sóc Cây trồng', 'Đã đến chu kỳ bón bổ sung phân hữu cơ vi sinh cho cây trồng trong tuần này.', 'info', true, false)
      `, [userId]);
    }

    const result = await pool.query(`
      SELECT * FROM user_notifications 
      WHERE user_id = $1 AND (is_archived = false OR is_archived IS NULL)
      ORDER BY created_at DESC 
      LIMIT 30
    `, [userId]);

    const unreadRes = await pool.query(
      'SELECT COUNT(*)::int as count FROM user_notifications WHERE user_id = $1 AND is_read = false AND (is_archived = false OR is_archived IS NULL)',
      [userId]
    );

    res.json({
      success: true,
      unread_count: unreadRes.rows[0].count,
      notifications: result.rows
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Lỗi server khi tải thông báo.' });
  }
});

// PUT /api/notifications/read-all — Mark all active notifications as read
router.put('/read-all', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE user_notifications SET is_read = true WHERE user_id = $1 AND (is_archived = false OR is_archived IS NULL)',
      [req.user.id]
    );
    res.json({ success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc.' });
  } catch (err) {
    console.error('Error marking notifications as read:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật thông báo.' });
  }
});

// PUT /api/notifications/:id/read — Mark single notification as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    await pool.query('UPDATE user_notifications SET is_read = true WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Đã đọc thông báo.' });
  } catch (err) {
    console.error('Error reading single notification:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// DELETE /api/notifications/:id — Soft-delete / Dismiss notification (Nông hộ xóa đệm)
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE user_notifications SET is_archived = true, archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true, message: 'Đã xóa đệm thông báo thành công.' });
  } catch (err) {
    console.error('Error soft-deleting notification:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa đệm thông báo.' });
  }
});


// ─── SENSOR THRESHOLD & ALERT RULES ENDPOINTS ───────────────────

// GET /api/notifications/rules — Fetch threshold alert rules for user
router.get('/rules', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const checkRes = await pool.query('SELECT COUNT(*)::int as count FROM user_alert_rules WHERE user_id = $1', [userId]);

    if (checkRes.rows[0].count === 0) {
      // Auto seed default standard rules if user has none
      await pool.query(`
        INSERT INTO user_alert_rules (user_id, metric_key, metric_name, operator, threshold_value, unit, action_type, action_recommendation, alert_level, is_enabled)
        VALUES
          ($1, 'soil_moisture_20cm', 'Độ ẩm đất tầng 20cm', '<', 50, '%', 'Tưới nước', 'Độ ẩm đất giảm xuống dưới 50%. Khuyến nghị kích hoạt hệ thống tưới rễ buổi sáng!', 'danger', true),
          ($1, 'rain_chance', 'Khả năng mưa rào', '>=', 65, '%', 'Phun thuốc', 'Chiều nay khả năng mưa trên 65%. Tạm hoãn phun thuốc sâu để tránh bị rửa trôi.', 'warning', true),
          ($1, 'soil_ph', 'Độ pH đất', '<', 5.5, 'pH', 'Bón phân', 'Độ pH đất chua (dưới 5.5). Bón bổ sung vôi nông nghiệp hoặc phân bón hữu cơ vi sinh.', 'info', true)
      `, [userId]);
    }

    const rulesRes = await pool.query(
      'SELECT * FROM user_alert_rules WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({
      success: true,
      rules: rulesRes.rows
    });
  } catch (err) {
    console.error('Error fetching alert rules:', err);
    res.status(500).json({ error: 'Lỗi server khi tải quy tắc cảnh báo.' });
  }
});

// POST /api/notifications/rules — Create new threshold rule
router.post('/rules', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      farm_id,
      metric_key,
      operator,
      threshold_value,
      action_type,
      action_recommendation,
      alert_level
    } = req.body;

    if (!metric_key || !operator || threshold_value === undefined || !action_recommendation) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ các trường thông tin quy tắc.' });
    }

    const metricInfo = METRIC_LABELS[metric_key] || { name: metric_key, unit: '%' };

    const insertRes = await pool.query(`
      INSERT INTO user_alert_rules 
        (user_id, farm_id, metric_key, metric_name, operator, threshold_value, unit, action_type, action_recommendation, alert_level, is_enabled)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *
    `, [
      userId,
      farm_id || null,
      metric_key,
      metricInfo.name,
      operator,
      parseFloat(threshold_value),
      metricInfo.unit,
      action_type || 'Khác',
      action_recommendation.trim(),
      alert_level || 'warning'
    ]);

    res.json({
      success: true,
      message: 'Đã thêm quy tắc cài đặt ngưỡng giá trị thành công!',
      rule: insertRes.rows[0]
    });
  } catch (err) {
    console.error('Error creating alert rule:', err);
    res.status(500).json({ error: 'Lỗi server khi tạo quy tắc cài đặt ngưỡng.' });
  }
});

// PUT /api/notifications/rules/:id — Update rule or toggle is_enabled
router.put('/rules/:id', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const ruleId = req.params.id;
    const { is_enabled, operator, threshold_value, action_type, action_recommendation, alert_level } = req.body;

    const existing = await pool.query('SELECT * FROM user_alert_rules WHERE id = $1 AND user_id = $2', [ruleId, userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Quy tắc không tồn tại hoặc không có quyền.' });
    }

    const current = existing.rows[0];
    const newEnabled = is_enabled !== undefined ? Boolean(is_enabled) : current.is_enabled;
    const newOperator = operator || current.operator;
    const newThreshold = threshold_value !== undefined ? parseFloat(threshold_value) : current.threshold_value;
    const newActionType = action_type || current.action_type;
    const newRec = action_recommendation !== undefined ? action_recommendation.trim() : current.action_recommendation;
    const newLevel = alert_level || current.alert_level;

    const updateRes = await pool.query(`
      UPDATE user_alert_rules 
      SET is_enabled = $1, operator = $2, threshold_value = $3, action_type = $4, action_recommendation = $5, alert_level = $6, updated_at = NOW()
      WHERE id = $7 AND user_id = $8
      RETURNING *
    `, [newEnabled, newOperator, newThreshold, newActionType, newRec, newLevel, ruleId, userId]);

    res.json({
      success: true,
      message: 'Đã cập nhật quy tắc thành công!',
      rule: updateRes.rows[0]
    });
  } catch (err) {
    console.error('Error updating alert rule:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật quy tắc.' });
  }
});

// DELETE /api/notifications/rules/:id — Delete rule
router.delete('/rules/:id', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    await pool.query('DELETE FROM user_alert_rules WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
    res.json({ success: true, message: 'Đã xóa quy tắc cảnh báo thành công.' });
  } catch (err) {
    console.error('Error deleting alert rule:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa quy tắc.' });
  }
});

module.exports = router;
