const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

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

router.get('/telemetry-status', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const farmIdParam = req.query.farm_id ? parseInt(req.query.farm_id, 10) : null;

    if (req.query.farm_id && (!Number.isInteger(farmIdParam) || farmIdParam <= 0)) {
      return res.status(400).json({ error: 'farm_id không hợp lệ.' });
    }

    let farmIds = [];
    if (farmIdParam) {
      if (!isAdmin) {
        const accessRes = await pool.query(
          'SELECT f.id FROM farms f LEFT JOIN users u ON u.id = $2 WHERE f.id = $1 AND (f.user_id = $2 OR u.farm_id = f.id)',
          [farmIdParam, userId]
        );
        if (accessRes.rows.length === 0) {
          return res.status(403).json({ error: 'Bạn không có quyền truy cập dữ liệu cảm biến của trang trại này.' });
        }
      }
      farmIds = [farmIdParam];
    } else if (!isAdmin) {
      const farmsRes = await pool.query(
        'SELECT DISTINCT f.id FROM farms f LEFT JOIN users u ON u.id = $1 WHERE f.user_id = $1 OR f.id = u.farm_id',
        [userId]
      );
      farmIds = farmsRes.rows.map(r => r.id);
    }

    let devicesRows = [];
    let sensorsRows = [];
    if (isAdmin && !farmIdParam) {
      const devRes = await pool.query(
        'SELECT id, name, device_type, status, farm_id, last_connection, last_seen, battery_level FROM devices ORDER BY last_seen DESC NULLS LAST, id DESC LIMIT 50'
      );
      const senRes = await pool.query(
        'SELECT farm_id, air_data, soil_data, water_data, weather_forecast, updated_at FROM farm_iot_sensors ORDER BY updated_at DESC NULLS LAST LIMIT 50'
      );
      devicesRows = devRes.rows;
      sensorsRows = senRes.rows;
    } else if (farmIds.length > 0) {
      const devRes = await pool.query(
        'SELECT id, name, device_type, status, farm_id, last_connection, last_seen, battery_level FROM devices WHERE farm_id = ANY($1::int[]) ORDER BY last_seen DESC NULLS LAST, id DESC',
        [farmIds]
      );
      const senRes = await pool.query(
        'SELECT farm_id, air_data, soil_data, water_data, weather_forecast, updated_at FROM farm_iot_sensors WHERE farm_id = ANY($1::int[]) ORDER BY updated_at DESC NULLS LAST',
        [farmIds]
      );
      devicesRows = devRes.rows;
      sensorsRows = senRes.rows;
    }

    const connected = devicesRows.length > 0 || sensorsRows.length > 0;
    return res.json({
      success: true,
      status: connected ? 'CONNECTED' : 'NO_DEVICE_CONNECTED',
      device_connected: connected,
      device_count: devicesRows.length,
      sensor_records: sensorsRows.length,
      devices: devicesRows,
      latest_telemetry: sensorsRows[0] || null
    });
  } catch (err) {
    console.error('Lỗi kiểm tra trạng thái cảm biến IoT:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi kiểm tra trạng thái IoT.' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;

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

router.put('/:id/read', auth, async (req, res) => {
  try {
    await pool.query('UPDATE user_notifications SET is_read = true WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Đã đọc thông báo.' });
  } catch (err) {
    console.error('Error reading single notification:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

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

router.get('/rules', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const userRes = await pool.query('SELECT rules_initialized FROM users WHERE id = $1', [userId]);
    const rulesInitialized = userRes.rows[0]?.rules_initialized || false;

    if (!rulesInitialized) {
      const countRes = await pool.query('SELECT COUNT(*)::int as count FROM user_alert_rules WHERE user_id = $1', [userId]);
      if (countRes.rows[0].count === 0) {
        await pool.query(`
          INSERT INTO user_alert_rules
            (user_id, title, category_type, metric_key, metric_name, operator, threshold_value, unit, action_type, action_recommendation, alert_level, check_offline_iot, check_disease_history, reconfirm_event_type, conditions_json, is_enabled)
          VALUES
            ($1, 'Cảnh Báo Độ Ẩm Đất Tầng 10cm & Trạng Thái IoT', 'danger', 'soil_moisture_10cm', 'Độ ẩm đất tầng 10cm', '<', 50, '%', 'Tưới nước', 'Độ ẩm đất tầng 10cm xuống dưới 50%. Tự động quét kiểm tra các thiết bị cảm biến IoT không có dữ liệu (null/0). Khuyến nghị tưới bổ sung đến khi độ ẩm >= 50%!', 'danger', true, false, NULL, '[{"metric":"soil_moisture_10cm","operator":"<","value":50}]', true),
            ($1, 'Khuyến Cáo Chăm Sóc Cây Từng Ghi Nhận Sâu Bệnh', 'warning', 'air_humidity', 'Độ ẩm không khí', '>=', 80, '%', 'Phun thuốc', 'Độ ẩm không khí cao (>= 80%) kết hợp kiểm tra lịch sử canh tác các cây từng bị bệnh. Khuyến nghị phun phòng ngừa và chăm sóc đặc biệt!', 'warning', false, true, NULL, '[{"metric":"air_humidity","operator":">=","value":80}]', true),
            ($1, 'Xác Nhận Cập Nhật Dữ Liệu Canh Tác Thực Địa', 'info', 'system_event', 'Sự kiện Hệ thống', '=', 1, '', 'Hệ thống', 'Xác nhận toàn bộ hoạt động cập nhật nhật ký canh tác (Tưới nước, Bón phân, Thu hoạch) được đồng bộ an toàn!', 'info', false, false, 'log_update', '[]', true)
        `, [userId]);
      }
      await pool.query('UPDATE users SET rules_initialized = true WHERE id = $1', [userId]);
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
      conditions_json,
      match_type,
      notify_time_type,
      custom_time,
      frequency
    } = req.body;

    if (req.user.role !== 'admin' && req.user.sub_role === 'auditor_readonly') {
      return res.status(403).json({ error: 'Tài khoản Chỉ đọc (Auditor) không được phép tạo quy tắc cảnh báo.' });
    }

    if (!title || !action_recommendation) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ Tên thông báo và Nội dung khuyến nghị.' });
    }

    if (farm_id && req.user.role !== 'admin') {
      const parsedFarmId = parseInt(farm_id, 10);
      if (isNaN(parsedFarmId) || parsedFarmId <= 0) {
        return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });
      }
      const farmCheck = await pool.query('SELECT id, user_id FROM farms WHERE id = $1 AND (is_deleted IS NOT TRUE)', [parsedFarmId]);
      if (farmCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Trang trại không tồn tại.' });
      }
      const fRow = farmCheck.rows[0];
      const allowedFarm = Number(fRow.user_id) === Number(req.user.id)
        || (req.user.parent_user_id && Number(fRow.user_id) === Number(req.user.parent_user_id))
        || (req.user.farm_id && Number(req.user.farm_id) === Number(fRow.id));
      if (!allowedFarm) {
        return res.status(403).json({ error: 'Bạn không có quyền tạo quy tắc cảnh báo cho trang trại này.' });
      }
    }

    const catType = category_type || alert_level || 'warning';
    const metricKey = metric_key || 'soil_moisture_10cm';
    const metricInfo = METRIC_LABELS[metricKey] || { name: metricKey, unit: '%' };
    const matchOp = (match_type === 'OR') ? 'OR' : 'AND';

    const insertRes = await pool.query(`
      INSERT INTO user_alert_rules
        (user_id, farm_id, title, category_type, metric_key, metric_name, operator, threshold_value, unit, action_type, action_recommendation, alert_level, check_offline_iot, check_disease_history, reconfirm_event_type, conditions_json, match_type, notify_time_type, custom_time, frequency, is_enabled)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, true)
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
      JSON.stringify(conditions_json || []),
      matchOp,
      notify_time_type || 'instant',
      custom_time || '07:00',
      frequency || 'always'
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
      conditions_json,
      match_type,
      notify_time_type,
      custom_time,
      frequency
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
    const newMatchType = match_type ? (match_type === 'OR' ? 'OR' : 'AND') : (current.match_type || 'AND');
    const newNotifyTimeType = notify_time_type || current.notify_time_type || 'instant';
    const newCustomTime = custom_time || current.custom_time || '07:00';
    const newFrequency = frequency || current.frequency || 'always';

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
        match_type = $16,
        notify_time_type = $17,
        custom_time = $18,
        frequency = $19,
        updated_at = NOW()
      WHERE id = $20 AND user_id = $21
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
      newMatchType,
      newNotifyTimeType,
      newCustomTime,
      newFrequency,
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

const { notifyUser } = require('../services/notificationDispatcher');

router.get('/preferences', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM user_notification_preferences WHERE user_id = $1 LIMIT 1', [req.user.id]);
    const pref = (r.rows && r.rows[0]) || {
      user_id: req.user.id,
      sound_enabled: true,
      sound_profile: 'chime',
      quiet_hours_enabled: false,
      quiet_start: '22:00',
      quiet_end: '06:00',
      muted_categories: []
    };
    res.json({ success: true, preferences: pref });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải cài đặt thông báo: ' + err.message });
  }
});

router.put('/preferences', auth, async (req, res) => {
  try {
    const soundEnabled = req.body.sound_enabled !== undefined ? Boolean(req.body.sound_enabled) : true;
    const rawProfile = String(req.body.sound_profile || 'chime');
    const soundProfile = ['siren', 'alert_double', 'chime', 'silent'].includes(rawProfile) ? rawProfile : 'chime';
    const quietEnabled = Boolean(req.body.quiet_hours_enabled);
    const quietStart = /^\d{1,2}:\d{2}$/.test(String(req.body.quiet_start || '')) ? String(req.body.quiet_start) : '22:00';
    const quietEnd = /^\d{1,2}:\d{2}$/.test(String(req.body.quiet_end || '')) ? String(req.body.quiet_end) : '06:00';
    const mutedCategories = Array.isArray(req.body.muted_categories) ? req.body.muted_categories.map(String) : [];

    const r = await pool.query(
      `INSERT INTO user_notification_preferences (user_id, sound_enabled, sound_profile, quiet_hours_enabled, quiet_start, quiet_end, muted_categories, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         sound_enabled = EXCLUDED.sound_enabled,
         sound_profile = EXCLUDED.sound_profile,
         quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
         quiet_start = EXCLUDED.quiet_start,
         quiet_end = EXCLUDED.quiet_end,
         muted_categories = EXCLUDED.muted_categories,
         updated_at = NOW()
       RETURNING *`,
      [req.user.id, soundEnabled, soundProfile, quietEnabled, quietStart, quietEnd, JSON.stringify(mutedCategories)]
    );
    res.json({ success: true, preferences: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật cài đặt thông báo: ' + err.message });
  }
});

router.post('/push-token', auth, async (req, res) => {
  try {
    const platform = String(req.body.platform || 'web_push').slice(0, 30);
    const tokenVal = typeof req.body.token === 'string' ? req.body.token.trim() : JSON.stringify(req.body.subscription || '');
    const deviceLabel = req.body.device_label ? String(req.body.device_label).slice(0, 120) : null;
    if (!tokenVal || tokenVal === '""') {
      return res.status(400).json({ error: 'Thiếu push token hoặc subscription.' });
    }
    const r = await pool.query(
      `INSERT INTO user_push_tokens (user_id, platform, token, device_label, is_active, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW())
       ON CONFLICT (user_id, platform, token) DO UPDATE SET
         device_label = COALESCE(EXCLUDED.device_label, user_push_tokens.device_label),
         is_active = true,
         updated_at = NOW()
       RETURNING id, platform, device_label, is_active`,
      [req.user.id, platform, tokenVal, deviceLabel]
    );
    res.json({ success: true, registration: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi đăng ký thiết bị nhận push: ' + err.message });
  }
});

router.delete('/push-token', auth, async (req, res) => {
  try {
    const tokenVal = req.body && req.body.token ? String(req.body.token) : null;
    if (tokenVal) {
      await pool.query('UPDATE user_push_tokens SET is_active = false, updated_at = NOW() WHERE user_id = $1 AND token = $2', [req.user.id, tokenVal]);
    } else {
      await pool.query('UPDATE user_push_tokens SET is_active = false, updated_at = NOW() WHERE user_id = $1', [req.user.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi hủy đăng ký push: ' + err.message });
  }
});

router.post('/test', auth, async (req, res) => {
  try {
    const severity = ['danger', 'warning', 'info', 'success'].includes(req.body && req.body.severity) ? req.body.severity : 'info';
    const soundProfile = req.body && req.body.sound_profile ? String(req.body.sound_profile) : undefined;
    const rows = await notifyUser(req.user.id, {
      eventCode: 'TEST_NOTIFICATION',
      severity,
      soundProfile,
      title: req.body?.title || 'Kiểm tra Chuông Thông báo Hệ thống',
      message: req.body?.message || 'Thông báo thử nghiệm đa kênh (WebSocket + Nhạc chuông + Mobile Tray).',
      actorUserId: req.user.id,
      sendZalo: false
    });
    res.json({ success: true, dispatched: rows });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi gửi thông báo thử nghiệm: ' + err.message });
  }
});

module.exports = router;
