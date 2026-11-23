const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

function timingSafeEqualToken(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function normalizeMetricKey(rawKey) {
  return String(rawKey || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildMetricLookupMap(readings) {
  const map = new Map();
  for (const r of readings) {
    const key = normalizeMetricKey(r.metric_key);
    if (!key) continue;
    map.set(key, Number(r.metric_value));
    if (key === 'temperature' || key === 'temp') map.set('air_temp', Number(r.metric_value));
    if (key === 'air_temp') map.set('temperature', Number(r.metric_value));
    if (key === 'moisture' || key === 'humidity_soil') map.set('soil_moisture', Number(r.metric_value));
    if (key === 'soil_moisture') map.set('moisture', Number(r.metric_value));
  }
  return map;
}

function evaluateRuleCondition(cond, metricMap) {
  if (!cond || typeof cond !== 'object') return null;
  const rawKey = cond.metric || cond.metric_key || cond.field || cond.key;
  const normKey = normalizeMetricKey(rawKey);
  if (!normKey || !metricMap.has(normKey)) return null;
  const target = Number(cond.value ?? cond.threshold);
  if (!Number.isFinite(target)) return null;
  const actual = metricMap.get(normKey);
  const op = String(cond.operator || cond.op || '<').trim().toLowerCase();
  switch (op) {
    case '<':
    case 'lt':
      return actual < target;
    case '<=':
    case 'lte':
      return actual <= target;
    case '>':
    case 'gt':
      return actual > target;
    case '>=':
    case 'gte':
      return actual >= target;
    case '=':
    case '==':
    case '===':
    case 'eq':
      return actual === target;
    case '!=':
    case '!==':
    case 'neq':
      return actual !== target;
    default:
      return null;
  }
}

router.get('/', auth, async (req, res) => {
  try {
    let query = `
      SELECT d.*, f.name as farm_name
      FROM devices d
      LEFT JOIN farms f ON d.farm_id = f.id
    `;
    const params = [];

    if (req.user.role !== 'admin') {
      query += ` WHERE f.user_id = $1`;
      params.push(req.user.id);
    }

    query += ` ORDER BY d.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting devices:', err);
    res.status(500).json({ error: 'Lỗi server khi tải danh sách thiết bị.' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, f.name as farm_name
      FROM devices d
      LEFT JOIN farms f ON d.farm_id = f.id
      WHERE d.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy thiết bị.' });
    }

    const device = result.rows[0];

    if (req.user.role !== 'admin') {
      const farmCheck = await pool.query('SELECT user_id FROM farms WHERE id = $1', [device.farm_id]);
      if (farmCheck.rows.length === 0 || farmCheck.rows[0].user_id !== req.user.id) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập thiết bị này.' });
      }
    }

    res.json(device);
  } catch (err) {
    console.error('Error getting device detail:', err);
    res.status(500).json({ error: 'Lỗi server khi tải chi tiết thiết bị.' });
  }
});

router.post('/', auth, admin, async (req, res) => {
  try {
    const { name, device_type, status, farm_id, ip_address, battery_level, secret_token } = req.body;

    if (!name || !device_type) {
      return res.status(400).json({ error: 'Tên thiết bị và loại thiết bị là bắt buộc.' });
    }

    const deviceSecretToken = (typeof secret_token === 'string' && secret_token.trim().length > 0)
      ? secret_token.trim()
      : crypto.randomBytes(24).toString('hex');

    const result = await pool.query(`
      INSERT INTO devices (name, device_type, status, farm_id, ip_address, battery_level, secret_token)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      name,
      device_type,
      status || 'Hoạt động',
      farm_id ? parseInt(farm_id) : null,
      ip_address || null,
      battery_level !== undefined ? parseInt(battery_level) : 100,
      deviceSecretToken
    ]);

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('device_status_changed');

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating device:', err);
    res.status(500).json({ error: 'Lỗi server khi thêm thiết bị mới.' });
  }
});

router.put('/:id', auth, admin, async (req, res) => {
  try {
    const { name, device_type, status, farm_id, ip_address, battery_level } = req.body;

    if (!name || !device_type) {
      return res.status(400).json({ error: 'Tên thiết bị và loại thiết bị là bắt buộc.' });
    }

    const result = await pool.query(`
      UPDATE devices
      SET name = $1, device_type = $2, status = $3, farm_id = $4, ip_address = $5, battery_level = $6, last_connection = NOW(), updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `, [
      name,
      device_type,
      status || 'Hoạt động',
      farm_id ? parseInt(farm_id) : null,
      ip_address || null,
      battery_level !== undefined ? parseInt(battery_level) : 100,
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy thiết bị.' });
    }

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('device_status_changed');

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating device:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật thiết bị.' });
  }
});

router.delete('/:id', auth, admin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM devices WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy thiết bị.' });
    }

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('device_status_changed');

    res.json({ message: 'Đã xóa thiết bị thành công.' });
  } catch (err) {
    console.error('Error deleting device:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa thiết bị.' });
  }
});

function extractTelemetryReadings(body) {
  const readings = [];
  const pushReading = (rawKey, rawVal, unit) => {
    const key = String(rawKey || '').trim();
    const num = Number(rawVal);
    if (!key || !Number.isFinite(num)) return;
    readings.push({ metric_key: key, metric_value: num, unit: unit ? String(unit).slice(0, 32) : null });
  };

  if (Array.isArray(body.metrics)) {
    for (const item of body.metrics) {
      if (item && typeof item === 'object') {
        pushReading(item.metric_key || item.key || item.name, item.metric_value ?? item.value, item.unit);
      }
    }
  } else if (body.metrics && typeof body.metrics === 'object') {
    for (const [k, v] of Object.entries(body.metrics)) {
      pushReading(k, v, null);
    }
  }

  if (body.metric_key !== undefined && body.metric_value !== undefined) {
    pushReading(body.metric_key, body.metric_value, body.unit);
  }

  for (const section of [body.air_data, body.soil_data, body.water_data]) {
    if (section && typeof section === 'object' && !Array.isArray(section)) {
      for (const [k, v] of Object.entries(section)) {
        if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)))) {
          pushReading(k, v, null);
        }
      }
    }
  }

  return readings;
}

async function authenticateIngestRequest(req) {
  const deviceToken = req.headers['x-device-token'];
  const authHeader = req.headers.authorization;
  const reqDeviceId = req.body && req.body.device_id !== undefined ? parseInt(req.body.device_id, 10) : null;
  const reqFarmId = req.body && req.body.farm_id !== undefined && req.body.farm_id !== null ? parseInt(req.body.farm_id, 10) : null;

  if (typeof deviceToken === 'string' && deviceToken.trim().length > 0) {
    const token = deviceToken.trim();
    const devRes = Number.isInteger(reqDeviceId) && reqDeviceId > 0
      ? await pool.query('SELECT id, farm_id, secret_token, status FROM devices WHERE id = $1 LIMIT 1', [reqDeviceId])
      : await pool.query('SELECT id, farm_id, secret_token, status FROM devices WHERE secret_token = $1 LIMIT 1', [token]);

    if (devRes.rows.length === 0) {
      return { status: 401, error: 'X-Device-Token không hợp lệ hoặc thiết bị không tồn tại.' };
    }
    const device = devRes.rows[0];
    if (!timingSafeEqualToken(token, device.secret_token)) {
      return { status: 401, error: 'X-Device-Token không hợp lệ.' };
    }
    if (reqFarmId && device.farm_id && Number(reqFarmId) !== Number(device.farm_id)) {
      return { status: 403, error: 'Thiết bị không thuộc trang trại được chỉ định.' };
    }
    const farmId = reqFarmId || device.farm_id;
    if (!farmId || !Number.isInteger(Number(farmId)) || Number(farmId) <= 0) {
      return { status: 400, error: 'Thiết bị chưa được gán vào trang trại hợp lệ.' };
    }
    return { ok: true, device, farmId: Number(farmId) };
  }

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (!process.env.JWT_SECRET) {
      return { status: 500, error: 'Thiếu cấu hình JWT_SECRET.' };
    }
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (_) {
      return { status: 401, error: 'Bearer token không hợp lệ hoặc đã hết hạn.' };
    }

    if (decoded.role === 'auditor_readonly' || decoded.sub_role === 'auditor_readonly') {
      return { status: 403, error: 'Tài khoản kiểm toán viên chỉ có quyền xem (Read-Only).' };
    }

    let device = null;
    if (Number.isInteger(reqDeviceId) && reqDeviceId > 0) {
      const devRes = await pool.query('SELECT id, farm_id, status FROM devices WHERE id = $1 LIMIT 1', [reqDeviceId]);
      if (devRes.rows.length === 0) {
        return { status: 404, error: 'Không tìm thấy thiết bị.' };
      }
      device = devRes.rows[0];
    }

    const farmId = reqFarmId || (device ? device.farm_id : null);
    if (!farmId || !Number.isInteger(Number(farmId)) || Number(farmId) <= 0) {
      return { status: 400, error: 'Thiếu farm_id hợp lệ để ghi dữ liệu IoT.' };
    }

    if (decoded.role !== 'admin') {
      const accessRes = await pool.query(
        'SELECT f.id FROM farms f LEFT JOIN users u ON u.id = $2 WHERE f.id = $1 AND (f.user_id = $2 OR f.created_by = $2 OR u.farm_id = f.id)',
        [Number(farmId), decoded.id]
      );
      if (accessRes.rows.length === 0) {
        return { status: 403, error: 'Bạn không có quyền gửi dữ liệu cảm biến cho trang trại này.' };
      }
    }

    return { ok: true, device, farmId: Number(farmId) };
  }

  return { status: 401, error: 'Thiếu mã xác thực thiết bị IoT (X-Device-Token hoặc Bearer JWT).' };
}

router.post('/telemetry-ingest', async (req, res) => {
  try {
    const authResult = await authenticateIngestRequest(req);
    if (!authResult.ok) {
      return res.status(authResult.status).json({ error: authResult.error });
    }

    const { device, farmId } = authResult;
    const body = req.body || {};
    const readings = extractTelemetryReadings(body);
    const hasStructuredSection = Boolean(body.air_data || body.soil_data || body.water_data);

    if (readings.length === 0 && !hasStructuredSection) {
      return res.status(400).json({ error: 'Payload cảm biến không chứa chỉ số đo lường hợp lệ.' });
    }

    const batteryLevel = body.battery_level !== undefined && body.battery_level !== null
      ? parseInt(body.battery_level, 10)
      : null;

    for (const r of readings) {
      await pool.query(
        `INSERT INTO iot_readings (device_id, farm_id, metric_key, metric_value, unit, battery_level, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [device ? device.id : null, farmId, r.metric_key, r.metric_value, r.unit, Number.isInteger(batteryLevel) ? batteryLevel : null]
      );
    }

    const metricMap = buildMetricLookupMap(readings);
    const airPayload = body.air_data || {
      temp: metricMap.get('air_temp') ?? metricMap.get('temperature') ?? null,
      humidity: metricMap.get('air_humidity') ?? metricMap.get('humidity') ?? null,
      recorded_at: new Date().toISOString()
    };
    const soilPayload = body.soil_data || {
      moisture: metricMap.get('soil_moisture') ?? metricMap.get('moisture') ?? null,
      ph: metricMap.get('soil_ph') ?? metricMap.get('ph') ?? null,
      ec: metricMap.get('soil_ec') ?? metricMap.get('ec') ?? null,
      recorded_at: new Date().toISOString()
    };
    const waterPayload = body.water_data || {
      ph: metricMap.get('water_ph') ?? null,
      ec: metricMap.get('water_ec') ?? null,
      recorded_at: new Date().toISOString()
    };
    const forecastPayload = Array.isArray(body.weather_forecast) ? body.weather_forecast : [];

    await pool.query(
      `INSERT INTO farm_iot_sensors (farm_id, air_data, soil_data, water_data, weather_forecast, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (farm_id) DO UPDATE
       SET air_data = EXCLUDED.air_data,
           soil_data = EXCLUDED.soil_data,
           water_data = EXCLUDED.water_data,
           weather_forecast = EXCLUDED.weather_forecast,
           updated_at = NOW()`,
      [farmId, JSON.stringify(airPayload), JSON.stringify(soilPayload), JSON.stringify(waterPayload), JSON.stringify(forecastPayload)]
    );

    if (device && device.id) {
      await pool.query(
        `UPDATE devices
         SET last_connection = NOW(),
             last_seen = NOW(),
             status = 'Hoạt động',
             battery_level = COALESCE($2, battery_level),
             updated_at = NOW()
         WHERE id = $1`,
        [device.id, Number.isInteger(batteryLevel) ? batteryLevel : null]
      );
    }

    let triggeredAlertsCount = 0;
    const rulesRes = await pool.query(
      `SELECT r.*
       FROM user_alert_rules r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN farms f ON f.id = $1
       WHERE COALESCE(r.is_enabled, true) = true
         AND (r.farm_id = $1 OR f.user_id = r.user_id OR u.farm_id = $1)`,
      [farmId]
    );

    for (const rule of rulesRes.rows) {
      let conditions = [];
      if (Array.isArray(rule.conditions_json)) {
        conditions = rule.conditions_json;
      } else if (typeof rule.conditions_json === 'string' && rule.conditions_json.trim()) {
        try {
          const parsed = JSON.parse(rule.conditions_json);
          if (Array.isArray(parsed)) conditions = parsed;
        } catch (_) {}
      }

      if (conditions.length === 0) continue;

      const evalResults = conditions.map(c => evaluateRuleCondition(c, metricMap));
      const matchType = String(rule.match_type || 'AND').toUpperCase();
      const matched = matchType === 'OR'
        ? evalResults.some(v => v === true)
        : evalResults.every(v => v === true);

      if (!matched) continue;

      const summaryParts = readings.map(r => `${r.metric_key}=${r.metric_value}${r.unit ? r.unit : ''}`);
      const title = rule.title || 'Cảnh Báo Ngưỡng Cảm Biến IoT';
      const message = `Thiết bị IoT ghi nhận vượt ngưỡng cấu hình (${summaryParts.join(', ')}).`;
      const alertType = rule.category_type || 'warning';

      await pool.query(
        `INSERT INTO user_notifications (user_id, title, message, type, is_read, is_archived)
         VALUES ($1, $2, $3, $4, false, false)`,
        [rule.user_id, title, message, alertType]
      );
      triggeredAlertsCount += 1;
    }

    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('iot_telemetry_updated', { farm_id: farmId, device_id: device ? device.id : null, triggered_alerts_count: triggeredAlertsCount });
    }

    return res.status(201).json({
      success: true,
      status: 'CONNECTED',
      device_id: device ? device.id : null,
      farm_id: farmId,
      ingested_count: readings.length,
      triggered_alerts_count: triggeredAlertsCount
    });
  } catch (err) {
    console.error('Error ingesting telemetry:', err);
    return res.status(500).json({ error: 'Lỗi server khi tiếp nhận dữ liệu cảm biến IoT.' });
  }
});

module.exports = router;
