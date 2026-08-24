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
      // Auto seed default standard rules matching all 3 categories (Cảnh báo, Khuyến cáo, Thông báo)
      await pool.query(`
        INSERT INTO user_alert_rules 
          (user_id, title, category_type, metric_key, metric_name, operator, threshold_value, unit, action_type, action_recommendation, alert_level, check_offline_iot, check_disease_history, reconfirm_event_type, is_enabled)
        VALUES
          ($1, '🚨 Cảnh báo Độ ẩm Đất Tầng 10cm & Kiểm tra IoT', 'danger', 'soil_moisture_10cm', 'Độ ẩm đất tầng 10cm', '<', 50, '%', 'Tưới nước', 'Độ ẩm đất tầng 10cm xuống dưới 50%. Tự động quét kiểm tra các thiết bị cảm biến IoT không có dữ liệu (null/0). Khuyến nghị tưới bổ sung đến khi độ ẩm >= 50%!', 'danger', true, false, NULL, true),
          ($1, '📢 Khuyến cáo Chăm sóc Cây từng ghi nhận Sâu bệnh', 'warning', 'air_humidity', 'Độ ẩm không khí', '>=', 80, '%', 'Phun thuốc', 'Độ ẩm không khí cao (>= 80%) kết hợp kiểm tra lịch sử canh tác các cây từng bị bệnh. Khuyến nghị phun phòng ngừa và chăm sóc đặc biệt!', 'warning', false, true, NULL, true),
          ($1, 'ℹ️ Thông báo Xác nhận Cập nhật Canh tác', 'info', 'system_event', 'Sự kiện Hệ thống', '=', 1, '', 'Hệ thống', 'Xác nhận toàn bộ hoạt động cập nhật thông tin nhật ký canh tác (Tưới nước, Bón phân, Thu hoạch) được lưu thành công!', 'info', false, false, 'log_update', true)
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
    res.status(500).json({ error: 'Lỗi server khi tải quy tắc cài đặt ngưỡng.' });
  }
});

// POST /api/notifications/rules — Create new threshold rule
router.post('/rules', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      farm_id,
      title,
      category_type,
      metric_key,
      operator,
      threshold_value,
      action_type,
      action_recommendation,
      alert_level,
      check_offline_iot,
      check_disease_history,
      reconfirm_event_type,
      conditions_json
    } = req.body;

    if (!title || !action_recommendation) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ Tên thông báo và Nội dung khuyến nghị.' });
    }

    const catType = category_type || alert_level || 'warning';
    const metricKey = metric_key || 'soil_moisture_10cm';
    const metricInfo = METRIC_LABELS[metricKey] || { name: metricKey, unit: '%' };

    const insertRes = await pool.query(`
      INSERT INTO user_alert_rules 
        (user_id, farm_id, title, category_type, metric_key, metric_name, operator, threshold_value, unit, action_type, action_recommendation, alert_level, check_offline_iot, check_disease_history, reconfirm_event_type, conditions_json, is_enabled)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true)
      RETURNING *
    `, [
      userId,
      farm_id || null,
      title.trim(),
      catType,
      metricKey,
      metricInfo.name,
      operator || '<',
      threshold_value !== undefined ? parseFloat(threshold_value) : 50,
      metricInfo.unit || '%',
      action_type || 'Canh tác',
      action_recommendation.trim(),
      catType,
      Boolean(check_offline_iot),
      Boolean(check_disease_history),
      reconfirm_event_type || null,
      JSON.stringify(conditions_json || [])
    ]);

    res.json({
      success: true,
      message: 'Đã tạo quy tắc cài đặt thông báo tự động thành công!',
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
    const {
      is_enabled,
      title,
      category_type,
      metric_key,
      operator,
      threshold_value,
      action_type,
      action_recommendation,
      alert_level,
      check_offline_iot,
      check_disease_history,
      reconfirm_event_type,
      conditions_json
    } = req.body;

    const existing = await pool.query('SELECT * FROM user_alert_rules WHERE id = $1 AND user_id = $2', [ruleId, userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Quy tắc không tồn tại hoặc không có quyền.' });
    }

    const current = existing.rows[0];
    const newEnabled = is_enabled !== undefined ? Boolean(is_enabled) : current.is_enabled;
    const newTitle = title ? title.trim() : current.title;
    const newCatType = category_type || alert_level || current.category_type || 'warning';
    const newMetricKey = metric_key || current.metric_key;
    const metricInfo = METRIC_LABELS[newMetricKey] || { name: newMetricKey, unit: current.unit };
    const newOperator = operator || current.operator;
    const newThreshold = threshold_value !== undefined ? parseFloat(threshold_value) : current.threshold_value;
    const newActionType = action_type || current.action_type;
    const newRec = action_recommendation !== undefined ? action_recommendation.trim() : current.action_recommendation;
    const newOfflineIot = check_offline_iot !== undefined ? Boolean(check_offline_iot) : current.check_offline_iot;
    const newDiseaseHist = check_disease_history !== undefined ? Boolean(check_disease_history) : current.check_disease_history;
    const newReconfirm = reconfirm_event_type !== undefined ? reconfirm_event_type : current.reconfirm_event_type;
    const newConds = conditions_json ? JSON.stringify(conditions_json) : current.conditions_json;

    const updateRes = await pool.query(`
      UPDATE user_alert_rules 
      SET 
        is_enabled = $1, 
        title = $2,
        category_type = $3,
        metric_key = $4, 
        metric_name = $5,
        operator = $6, 
        threshold_value = $7, 
        unit = $8,
        action_type = $9, 
        action_recommendation = $10, 
        alert_level = $11,
        check_offline_iot = $12,
        check_disease_history = $13,
        reconfirm_event_type = $14,
        conditions_json = $15,
        updated_at = NOW()
      WHERE id = $16 AND user_id = $17
      RETURNING *
    `, [
      newEnabled,
      newTitle,
      newCatType,
      newMetricKey,
      metricInfo.name,
      newOperator,
      newThreshold,
      metricInfo.unit,
      newActionType,
      newRec,
      newCatType,
      newOfflineIot,
      newDiseaseHist,
      newReconfirm,
      newConds,
      ruleId,
      userId
    ]);

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
