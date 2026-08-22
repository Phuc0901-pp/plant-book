const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { getCache, setCache, delCache, delCacheByPattern } = require('../config/redis');

// GET all farms with plant count (requires auth)
router.get('/', auth, async (req, res) => {
  try {
    const cacheKey = `farms_user_${req.user.id}_${req.user.role}`;
    const cachedFarms = await getCache(cacheKey);
    if (cachedFarms) {
      return res.json(cachedFarms);
    }

    let query = `
      SELECT f.*, GREATEST(COUNT(p.id)::int, COALESCE(f.total_plants, 0)) as plant_count, u.full_name as user_name, u.email as user_email
      FROM farms f 
      LEFT JOIN plants p ON p.farm_id = f.id 
      LEFT JOIN users u ON u.id = f.user_id
    `;
    const params = [];
    if (req.user.role !== 'admin') {
      query += ` WHERE (f.is_deleted IS NOT TRUE) AND (f.user_id = $1 OR f.id = (SELECT farm_id FROM users WHERE id = $1)) `;
      params.push(req.user.id);
    } else {
      query += ` WHERE (f.is_deleted IS NOT TRUE) `;
    }
    query += `
      GROUP BY f.id, u.id
      ORDER BY f.created_at DESC
    `;
    const result = await pool.query(query, params);
    await setCache(cacheKey, result.rows, 120); // 2 mins TTL
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting farms:', err);
    res.status(500).json({ error: 'Lỗi server khi tải danh sách trang trại.' });
  }
});

// GET single farm details with list of plants (requires auth)
router.get('/:id', auth, async (req, res) => {
  try {
    const farmResult = await pool.query(`
      SELECT f.*, u.full_name as user_name, u.email as user_email
      FROM farms f
      LEFT JOIN users u ON u.id = f.user_id
      WHERE f.id = $1
    `, [req.params.id]);
    if (farmResult.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }
    const farm = farmResult.rows[0];
    
    // Check if user is farm owner, admin, or assigned farmer
    const isAssigned = req.user.farm_id && farm.id === req.user.farm_id;
    if (req.user.role !== 'admin' && farm.user_id !== req.user.id && !isAssigned) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập trang trại này.' });
    }

    const plantsResult = await pool.query('SELECT * FROM plants WHERE farm_id = $1 ORDER BY id ASC', [farm.id]);
    res.json({ ...farm, plants: plantsResult.rows });
  } catch (err) {
    console.error('Error getting farm details:', err);
    res.status(500).json({ error: 'Lỗi server khi tải chi tiết trang trại.' });
  }
});

// POST /api/farms/self-init — Self-initialize farm via GPS by a farmer (requires auth)
router.post('/self-init', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, latitude, longitude, area, total_plants, plant_count } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên trang trại là bắt buộc.' });
    }

    const lat = latitude ? parseFloat(latitude) : null;
    const lng = longitude ? parseFloat(longitude) : null;
    const farmArea = area && parseFloat(area) ? parseFloat(area) : null;
    const countVal = parseInt(total_plants || plant_count) || 0;

    // Single point GPS ping polygon or coordinates
    const polygonCoords = (lat && lng) ? [[lat, lng]] : [];

    await client.query('BEGIN');

    // Create farm
    const farmRes = await client.query(`
      INSERT INTO farms (name, description, polygon_coordinates, area, total_plants, created_by, user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $6)
      RETURNING *
    `, [name.trim(), description || '', JSON.stringify(polygonCoords), farmArea, countVal, req.user.id]);

    const newFarm = farmRes.rows[0];

    // Update user's farm_id
    await client.query('UPDATE users SET farm_id = $1 WHERE id = $2', [newFarm.id, req.user.id]);

    await client.query('COMMIT');

    // Invalidate Redis Cache so GET /api/farms returns the newly created farm immediately!
    await delCacheByPattern('farms_');

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('farms_updated');

    res.status(201).json({
      success: true,
      message: 'Khởi tạo trang trại bằng tọa độ GPS thành công!',
      farm: newFarm
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error self-initializing farm:', err);
    res.status(500).json({ error: 'Lỗi server khi khởi tạo trang trại: ' + err.message });
  } finally {
    client.release();
  }
});

// POST create farm (requires auth, admin)
router.post('/', auth, admin, async (req, res) => {

  try {
    const { name, description, polygon_coordinates, area, user_id } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Tên trang trại là bắt buộc.' });
    }

    const result = await pool.query(`
      INSERT INTO farms (name, description, polygon_coordinates, area, created_by, user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, description || '', JSON.stringify(polygon_coordinates || []), area || null, req.user.id, user_id || null]);

    await delCacheByPattern('farms_');

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('farms_updated');

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating farm:', err);
    res.status(500).json({ error: 'Lỗi server khi tạo trang trại.' });
  }
});

// PUT update farm (requires auth — admin or farm owner)
router.put('/:id', auth, async (req, res) => {
  try {
    const farmId = req.params.id;
    const farmCheck = await pool.query('SELECT * FROM farms WHERE id = $1', [farmId]);
    if (farmCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }
    const farm = farmCheck.rows[0];

    // Check ownership
    const isOwner = farm.user_id === req.user.id || (req.user.farm_id && req.user.farm_id === farm.id);
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa trang trại này.' });
    }

    const { name, description, polygon_coordinates, area, total_plants, user_id, latitude, longitude } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên trang trại là bắt buộc.' });
    }

    let finalCoords = polygon_coordinates;
    if ((latitude && longitude) || (!polygon_coordinates && latitude && longitude)) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        finalCoords = [[lng, lat]];
      }
    }

    const assignedUserId = user_id !== undefined ? user_id : farm.user_id;
    const parsedArea = area !== undefined && area !== null && area !== '' ? parseFloat(area) : farm.area;
    const parsedTotalPlants = total_plants !== undefined && total_plants !== null && total_plants !== '' ? parseInt(total_plants) : farm.total_plants;
    const coordsJson = finalCoords ? JSON.stringify(finalCoords) : JSON.stringify(farm.polygon_coordinates);

    const result = await pool.query(`
      UPDATE farms 
      SET name = $1, description = $2, polygon_coordinates = $3, area = $4, total_plants = $5, user_id = $6, updated_at = NOW() 
      WHERE id = $7 
      RETURNING *
    `, [name.trim(), description || '', coordsJson, parsedArea, parsedTotalPlants, assignedUserId, farmId]);

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('farms_updated');

    res.json({
      success: true,
      message: 'Cập nhật thông tin trang trại thành công!',
      farm: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating farm:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật trang trại: ' + err.message });
  }
});




// ── FARM IOT SENSORS & WEATHER FORECAST ENDPOINTS (PERSISTENT DB) ──
function generateDefaultFarmIoTData(farmId) {
  const seed = (parseInt(farmId) || 1);
  const airTemp = (27.5 + (seed % 3) * 0.7).toFixed(1);
  const airHumidity = 72 + (seed % 5);
  const pressure = 1010 + (seed % 4);
  const windSpeed = 12 + (seed % 6);
  const windDirections = ['Đông Nam', 'Đông', 'Nam', 'Tây Nam', 'Đông Bắc'];
  const windDirection = windDirections[seed % windDirections.length];
  const rainfall = (1.5 + (seed % 3) * 0.5).toFixed(1);
  const rainIntensity = (0.5 + (seed % 2) * 0.3).toFixed(1);
  const uvIndex = (4.2 + (seed % 4) * 0.3).toFixed(1);
  const solarRadiation = 650 + (seed % 50);

  const air_data = {
    temperature: parseFloat(airTemp),
    pressure: parseInt(pressure),
    humidity: parseInt(airHumidity),
    wind_speed: parseFloat(windSpeed),
    wind_direction: windDirection,
    rainfall: parseFloat(rainfall),
    rain_intensity: parseFloat(rainIntensity),
    uv_index: parseFloat(uvIndex),
    solar_radiation: parseInt(solarRadiation)
  };

  const soil_data = {
    active_depth: '20cm',
    depth_10cm: {
      moisture: 62 + (seed % 4),
      temperature: parseFloat((27.2 + (seed % 3) * 0.4).toFixed(1)),
      ec: parseFloat((1.4 + (seed % 3) * 0.1).toFixed(1)),
      ph: parseFloat((6.3 + (seed % 3) * 0.1).toFixed(1)),
      salinity: parseFloat((0.3 + (seed % 2) * 0.1).toFixed(1)),
      npk: { n: 48 + (seed % 5), p: 35 + (seed % 4), k: 62 + (seed % 6) }
    },
    depth_20cm: {
      moisture: 68 + (seed % 4),
      temperature: parseFloat((25.5 + (seed % 3) * 0.4).toFixed(1)),
      ec: parseFloat((1.2 + (seed % 3) * 0.1).toFixed(1)),
      ph: parseFloat((6.5 + (seed % 3) * 0.1).toFixed(1)),
      salinity: parseFloat((0.2 + (seed % 2) * 0.1).toFixed(1)),
      npk: { n: 45 + (seed % 5), p: 32 + (seed % 4), k: 58 + (seed % 6) }
    },
    depth_30cm: {
      moisture: 74 + (seed % 4),
      temperature: parseFloat((24.1 + (seed % 3) * 0.4).toFixed(1)),
      ec: parseFloat((1.0 + (seed % 3) * 0.1).toFixed(1)),
      ph: parseFloat((6.7 + (seed % 3) * 0.1).toFixed(1)),
      salinity: parseFloat((0.1 + (seed % 2) * 0.1).toFixed(1)),
      npk: { n: 40 + (seed % 5), p: 28 + (seed % 4), k: 52 + (seed % 6) }
    }
  };

  const water_data = {
    ph: parseFloat((6.8 + (seed % 3) * 0.1).toFixed(1)),
    do: parseFloat((6.5 + (seed % 3) * 0.2).toFixed(1)),
    turbidity: 12 + (seed % 5),
    temperature: parseFloat((24.0 + (seed % 2) * 0.5).toFixed(1)),
    level: 85 + (seed % 10)
  };

  const today = new Date();
  const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const weatherTemplates = [
    { icon: 'fa-sun', color: '#f59e0b', temp: '25°C - 33°C', rain: '10%', humidity: `${airHumidity}%`, wind: `${windSpeed} km/h`, advice: '☀️ Nắng ấm: Thích hợp bón phân rễ & tưới nước buổi sáng.' },
    { icon: 'fa-cloud-sun-rain', color: '#0284c7', temp: '24°C - 31°C', rain: '65%', humidity: '82%', wind: '15 km/h', advice: '🌦️ Mưa rào rải rác: Hạn chế phun thuốc sâu vì dễ bị rửa trôi.' },
    { icon: 'fa-cloud-sun', color: '#059669', temp: '23°C - 30°C', rain: '20%', humidity: '75%', wind: '10 km/h', advice: '⛅ Nhiều mây mát: Thời điểm tốt nhất để làm cỏ & tạo tán cây.' },
    { icon: 'fa-cloud-sun', color: '#eab308', temp: '25°C - 32°C', rain: '15%', humidity: '68%', wind: '14 km/h', advice: '🌤️ Nắng gián đoạn: Thích hợp phun phân bón lá & vi lượng.' },
    { icon: 'fa-cloud-showers-heavy', color: '#7c3aed', temp: '23°C - 29°C', rain: '85%', humidity: '88%', wind: '22 km/h', advice: '⛈️ Mưa giông chiều: Khơi thông rãnh tháo nước tránh ngập úng.' },
    { icon: 'fa-sun', color: '#ea580c', temp: '26°C - 34°C', rain: '5%', humidity: '62%', wind: '11 km/h', advice: '☀️ Nắng rực rỡ: Duy trì hệ thống tưới nhỏ giọt tự động.' }
  ];

  const weather_forecast = weatherTemplates.map((w, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      date: d.toISOString().split('T')[0],
      day_label: i === 0 ? 'Hôm nay' : dayNames[d.getDay()],
      date_str: `${d.getDate()}/${d.getMonth() + 1}`,
      ...w
    };
  });

  return { air_data, soil_data, water_data, weather_forecast };
}

// GET /api/farms/:id/iot-data
router.get('/:id/iot-data', auth, async (req, res) => {
  try {
    const farmId = parseInt(req.params.id);
    const cacheKey = `farm_iot_${farmId}`;
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    let result = await pool.query('SELECT * FROM farm_iot_sensors WHERE farm_id = $1', [farmId]);
    if (result.rows.length === 0) {
      // Auto-initialize demo IoT sensor & 6-day weather data in DB for this farm
      const defaultData = generateDefaultFarmIoTData(farmId);
      const insertRes = await pool.query(`
        INSERT INTO farm_iot_sensors (farm_id, air_data, soil_data, water_data, weather_forecast)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [farmId, JSON.stringify(defaultData.air_data), JSON.stringify(defaultData.soil_data), JSON.stringify(defaultData.water_data), JSON.stringify(defaultData.weather_forecast)]);
      result = insertRes;
    }

    const row = result.rows[0];
    const payload = {
      success: true,
      farm_id: farmId,
      air_data: typeof row.air_data === 'string' ? JSON.parse(row.air_data) : row.air_data,
      soil_data: typeof row.soil_data === 'string' ? JSON.parse(row.soil_data) : row.soil_data,
      water_data: typeof row.water_data === 'string' ? JSON.parse(row.water_data) : row.water_data,
      weather_forecast: typeof row.weather_forecast === 'string' ? JSON.parse(row.weather_forecast) : row.weather_forecast,
      updated_at: row.updated_at
    };

    await setCache(cacheKey, payload, 300); // 5 mins TTL
    res.json(payload);
  } catch (err) {
    console.error('Error fetching farm IoT data:', err);
    res.status(500).json({ error: 'Lỗi server khi lấy dữ liệu cảm biến IoT.' });
  }
});

// POST /api/farms/:id/iot-data/refresh
router.post('/:id/iot-data/refresh', auth, async (req, res) => {
  try {
    const farmId = parseInt(req.params.id);
    const randomOffset = Math.floor(Math.random() * 10) + 1;
    const defaultData = generateDefaultFarmIoTData(farmId + randomOffset);

    const updateRes = await pool.query(`
      INSERT INTO farm_iot_sensors (farm_id, air_data, soil_data, water_data, weather_forecast, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (farm_id) DO UPDATE
      SET air_data = EXCLUDED.air_data, soil_data = EXCLUDED.soil_data, water_data = EXCLUDED.water_data, weather_forecast = EXCLUDED.weather_forecast, updated_at = NOW()
      RETURNING *
    `, [farmId, JSON.stringify(defaultData.air_data), JSON.stringify(defaultData.soil_data), JSON.stringify(defaultData.water_data), JSON.stringify(defaultData.weather_forecast)]);

    const row = updateRes.rows[0];
    const payload = {
      success: true,
      message: 'Đã làm mới dữ liệu cảm biến IoT thành công!',
      farm_id: farmId,
      air_data: typeof row.air_data === 'string' ? JSON.parse(row.air_data) : row.air_data,
      soil_data: typeof row.soil_data === 'string' ? JSON.parse(row.soil_data) : row.soil_data,
      water_data: typeof row.water_data === 'string' ? JSON.parse(row.water_data) : row.water_data,
      weather_forecast: typeof row.weather_forecast === 'string' ? JSON.parse(row.weather_forecast) : row.weather_forecast,
      updated_at: row.updated_at
    };

    // Invalidate Redis cache
    await delCache(`farm_iot_${farmId}`);
    await setCache(`farm_iot_${farmId}`, payload, 300);

    res.json(payload);
  } catch (err) {
    console.error('Error refreshing farm IoT data:', err);
    res.status(500).json({ error: 'Lỗi server khi làm mới dữ liệu cảm biến IoT.' });
  }
});

// DELETE farm (User = Soft Delete / Ẩn đệm; Admin = Permanent Delete / Xóa vĩnh viễn)
router.delete('/:id', auth, async (req, res) => {
  try {
    const farmId = parseInt(req.params.id);
    const farmCheck = await pool.query('SELECT * FROM farms WHERE id = $1', [farmId]);
    if (farmCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }

    const farm = farmCheck.rows[0];
    const userName = req.user.full_name || req.user.email || `User #${req.user.id}`;

    if (req.user.role === 'admin') {
      // Admin: PERMANENT HARD DELETE
      await pool.query('DELETE FROM farms WHERE id = $1', [farmId]);

      // Record in data_audit_logs for Admin DB Audit History ("Lịch sử biến động CSDL")
      await pool.query(`
        INSERT INTO data_audit_logs (user_id, user_name, action_type, target_type, record_id, title, old_data, note)
        VALUES ($1, $2, 'DELETE', 'Trang trại', $3, $4, $5, 'Xóa vĩnh viễn trang trại khỏi CSDL bởi Quản trị viên (Admin)')
      `, [req.user.id, userName, farmId, `Xóa vĩnh viễn trang trại ${farm.name}`, JSON.stringify(farm)]);

      await delCacheByPattern('farms_');

      const broadcast = req.app.get('broadcast');
      if (broadcast) broadcast('farms_updated');

      return res.json({ success: true, message: 'Admin đã xóa vĩnh viễn trang trại khỏi CSDL PostgreSQL thành công!' });
    } else {
      // User: SOFT DELETE / HIDE ("Xóa đệm")
      const isOwner = farm.user_id === req.user.id || farm.created_by === req.user.id || (req.user.farm_id && req.user.farm_id === farm.id);
      if (!isOwner) {
        return res.status(403).json({ error: 'Bạn không có quyền xóa trang trại này.' });
      }

      await pool.query('UPDATE farms SET is_deleted = true, deleted_at = NOW() WHERE id = $1', [farmId]);

      // Record soft-delete in data_audit_logs
      await pool.query(`
        INSERT INTO data_audit_logs (user_id, user_name, action_type, target_type, record_id, title, old_data, note)
        VALUES ($1, $2, 'DELETE_SOFT', 'Trang trại', $3, $4, $5, 'Nông hộ xóa đệm (ẩn) trang trại')
      `, [req.user.id, userName, farmId, `Xóa đệm trang trại ${farm.name}`, JSON.stringify(farm)]);

      await delCacheByPattern('farms_');

      const broadcast = req.app.get('broadcast');
      if (broadcast) broadcast('farms_updated');

      return res.json({ success: true, message: 'Đã xóa đệm (ẩn) trang trại khỏi danh sách thành công!' });
    }
  } catch (err) {
    console.error('Error deleting farm:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa trang trại.' });
  }
});

module.exports = router;
