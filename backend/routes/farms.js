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
      SELECT f.*, GREATEST(COUNT(p.id)::int, COALESCE(f.total_plants, 0)) as plant_count,
             COALESCE(u.full_name, u_assigned.full_name) as user_name,
             COALESCE(u.email, u_assigned.email) as user_email,
             COALESCE(u.phone, u_assigned.phone) as user_phone,
             COALESCE(u.account_tier, u_assigned.account_tier, 'normal') as user_account_tier,
             COALESCE(u.role, u_assigned.role, 'user') as user_role,
             COALESCE(f.user_id, u_assigned.id) as user_id
      FROM farms f 
      LEFT JOIN plants p ON p.farm_id = f.id 
      LEFT JOIN users u ON u.id = f.user_id
      LEFT JOIN users u_assigned ON u_assigned.farm_id = f.id AND u_assigned.role != 'admin'
    `;
    const params = [];
    if (req.user.role !== 'admin') {
      query += ` WHERE (f.is_deleted IS NOT TRUE) AND (f.user_id = $1 OR f.id = (SELECT farm_id FROM users WHERE id = $1)) `;
      params.push(req.user.id);
    } else {
      query += ` WHERE (f.is_deleted IS NOT TRUE) `;
    }
    query += `
      GROUP BY f.id, u.id, u.account_tier, u.role, u_assigned.id, u_assigned.full_name, u_assigned.email, u_assigned.phone, u_assigned.account_tier, u_assigned.role
      ORDER BY f.created_at DESC
    `;
    const result = await pool.query(query, params);
    await setCache(cacheKey, result.rows, 120); // 2 mins TTL
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting farms:', err);
    res.status(500).json({ error: 'Lá»—i server khi táº£i danh sÃ¡ch trang tráº¡i.' });
  }
});

// GET single farm details with list of plants (requires auth)
router.get('/:id', auth, async (req, res) => {
  try {
    const farmResult = await pool.query(`
      SELECT f.*, 
             COALESCE(u.full_name, u_assigned.full_name) as user_name,
             COALESCE(u.email, u_assigned.email) as user_email,
             COALESCE(u.phone, u_assigned.phone) as user_phone,
             COALESCE(u.account_tier, u_assigned.account_tier, 'normal') as user_account_tier,
             COALESCE(u.role, u_assigned.role, 'user') as user_role,
             COALESCE(f.user_id, u_assigned.id) as user_id
      FROM farms f
      LEFT JOIN users u ON u.id = f.user_id
      LEFT JOIN users u_assigned ON u_assigned.farm_id = f.id AND u_assigned.role != 'admin'
      WHERE f.id = $1
      LIMIT 1
    `, [req.params.id]);
    if (farmResult.rows.length === 0) {
      return res.status(404).json({ error: 'KhÃ´ng tÃ¬m tháº¥y trang tráº¡i.' });
    }
    const farm = farmResult.rows[0];
    
    // Check if user is farm owner, admin, or assigned farmer
    const isAssigned = req.user.farm_id && farm.id === req.user.farm_id;
    if (req.user.role !== 'admin' && farm.user_id !== req.user.id && !isAssigned) {
      return res.status(403).json({ error: 'Báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p trang tráº¡i nÃ y.' });
    }

    const plantsResult = await pool.query('SELECT * FROM plants WHERE farm_id = $1 ORDER BY id ASC', [farm.id]);
    res.json({ ...farm, plants: plantsResult.rows });
  } catch (err) {
    console.error('Error getting farm details:', err);
    res.status(500).json({ error: 'Lá»—i server khi táº£i chi tiáº¿t trang tráº¡i.' });
  }
});

// POST /api/farms/self-init â€” Self-initialize farm via GPS by a farmer (requires auth)
router.post('/self-init', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, latitude, longitude, area, total_plants, plant_count } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'TÃªn trang tráº¡i lÃ  báº¯t buá»™c.' });
    }

    // Check account tier limit: Normal users can only possess max 1 active farm!
    const isNormalUser = req.user.role !== 'admin' && req.user.account_tier !== 'pro';
    if (isNormalUser) {
      const existingFarmsCount = await pool.query(
        'SELECT COUNT(*)::int as count FROM farms WHERE (user_id = $1 OR created_by = $1) AND is_deleted IS NOT TRUE',
        [req.user.id]
      );
      if (existingFarmsCount.rows[0].count >= 1) {
        return res.status(403).json({
          error: 'ðŸ”’ TÃ i khoáº£n NÃ´ng há»™ NORMAL chá»‰ Ä‘Æ°á»£c táº¡o tá»‘i Ä‘a 1 Trang tráº¡i. Vui lÃ²ng nÃ¢ng cáº¥p tÃ i khoáº£n PRO ðŸ‘‘ Ä‘á»ƒ sá»Ÿ há»¯u nhiá»u trang tráº¡i!',
          require_pro: true
        });
      }
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
      message: 'Khá»Ÿi táº¡o trang tráº¡i báº±ng tá»a Ä‘á»™ GPS thÃ nh cÃ´ng!',
      farm: newFarm
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error self-initializing farm:', err);
    res.status(500).json({ error: 'Lá»—i server khi khá»Ÿi táº¡o trang tráº¡i: ' + err.message });
  } finally {
    client.release();
  }
});

// POST create farm (requires auth, admin)
router.post('/', auth, admin, async (req, res) => {
  try {
    const { name, description, polygon_coordinates, area, user_id, puc_code, vietgap_cert_number, vietgap_cert_date, vietgap_cert_org } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'TÃªn trang tráº¡i lÃ  báº¯t buá»™c.' });
    }

    const result = await pool.query(`
      INSERT INTO farms (name, description, polygon_coordinates, area, created_by, user_id, puc_code, vietgap_cert_number, vietgap_cert_date, vietgap_cert_org)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      name, 
      description || '', 
      JSON.stringify(polygon_coordinates || []), 
      area || null, 
      req.user.id, 
      user_id || null,
      puc_code ? puc_code.trim() : null,
      vietgap_cert_number ? vietgap_cert_number.trim() : null,
      vietgap_cert_date || null,
      vietgap_cert_org ? vietgap_cert_org.trim() : null
    ]);

    await delCacheByPattern('farms_');

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('farms_updated');

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating farm:', err);
    res.status(500).json({ error: 'Lá»—i server khi táº¡o trang tráº¡i.' });
  }
});

// PUT update farm (requires auth â€” admin or farm owner)
router.put('/:id', auth, async (req, res) => {
  try {
    const farmId = req.params.id;
    const farmCheck = await pool.query('SELECT * FROM farms WHERE id = $1', [farmId]);
    if (farmCheck.rows.length === 0) {
      return res.status(404).json({ error: 'KhÃ´ng tÃ¬m tháº¥y trang tráº¡i.' });
    }
    const farm = farmCheck.rows[0];

    // Check ownership
    const isOwner = farm.user_id === req.user.id || (req.user.farm_id && req.user.farm_id === farm.id);
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({ error: 'Báº¡n khÃ´ng cÃ³ quyá»n chá»‰nh sá»­a trang tráº¡i nÃ y.' });
    }

    const { 
      name, description, polygon_coordinates, area, total_plants, user_id, latitude, longitude,
      puc_code, vietgap_cert_number, vietgap_cert_date, vietgap_cert_org
    } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'TÃªn trang tráº¡i lÃ  báº¯t buá»™c.' });
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
      SET name = $1, description = $2, polygon_coordinates = $3, area = $4, total_plants = $5, user_id = $6, 
          puc_code = $7, vietgap_cert_number = $8, vietgap_cert_date = $9, vietgap_cert_org = $10, updated_at = NOW() 
      WHERE id = $11 
      RETURNING *
    `, [
      name.trim(), 
      description || '', 
      coordsJson, 
      parsedArea, 
      parsedTotalPlants, 
      assignedUserId, 
      puc_code !== undefined ? (puc_code ? puc_code.trim() : null) : farm.puc_code,
      vietgap_cert_number !== undefined ? (vietgap_cert_number ? vietgap_cert_number.trim() : null) : farm.vietgap_cert_number,
      vietgap_cert_date !== undefined ? (vietgap_cert_date || null) : farm.vietgap_cert_date,
      vietgap_cert_org !== undefined ? (vietgap_cert_org ? vietgap_cert_org.trim() : null) : farm.vietgap_cert_org,
      farmId
    ]);

    // Sync farmer's farm_id if assignedUserId is set
    if (assignedUserId) {
      try {
        await pool.query('UPDATE users SET farm_id = $1 WHERE id = $2', [farmId, assignedUserId]);
      } catch (_) {}
    }

    await delCacheByPattern('farms_');
    await delCacheByPattern('plants_');

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('farms_updated');

    res.json({
      success: true,
      message: 'Cáº­p nháº­t thÃ´ng tin trang tráº¡i thÃ nh cÃ´ng!',
      farm: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating farm:', err);
    res.status(500).json({ error: 'Lá»—i server khi cáº­p nháº­t trang tráº¡i: ' + err.message });
  }
});

// POST /api/farms/:id/clear-gps â€” Reset/Clear all plants GPS in a farm (requires auth â€” admin or farm owner)
router.post('/:id/clear-gps', auth, async (req, res) => {
  try {
    const farmId = req.params.id;
    const farmCheck = await pool.query('SELECT * FROM farms WHERE id = $1', [farmId]);
    if (farmCheck.rows.length === 0) {
      return res.status(404).json({ error: 'KhÃ´ng tÃ¬m tháº¥y trang tráº¡i.' });
    }
    const farm = farmCheck.rows[0];
    const isOwner = farm.user_id === req.user.id || (req.user.farm_id && req.user.farm_id === farm.id);
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({ error: 'Báº¡n khÃ´ng cÃ³ quyá»n thá»±c hiá»‡n thao tÃ¡c nÃ y.' });
    }

    const resetRes = await pool.query(`
      UPDATE plants
      SET latitude = NULL, longitude = NULL, updated_at = NOW()
      WHERE farm_id = $1 AND (latitude IS NOT NULL OR longitude IS NOT NULL)
      RETURNING id, tree_code
    `, [farmId]);

    await delCacheByPattern('farms_');

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated', { farm_id: farmId, action: 'gps_cleared_all' });

    res.json({
      success: true,
      message: `ÄÃ£ xÃ³a thÃ nh cÃ´ng tá»a Ä‘á»™ Ä‘á»‹nh vá»‹ GPS cá»§a ${resetRes.rows.length} cÃ¢y trong trang tráº¡i!`,
      cleared_count: resetRes.rows.length
    });
  } catch (err) {
    console.error('Error clearing plants GPS in farm:', err);
    res.status(500).json({ error: 'Lá»—i server khi xÃ³a tá»a Ä‘á»™ GPS: ' + err.message });
  }
});

// â”€â”€ FARM IOT SENSORS & WEATHER FORECAST ENDPOINTS (PERSISTENT DB) â”€â”€
function generateDefaultFarmIoTData(farmId) {
  const seed = (parseInt(farmId) || 1);
  const airTemp = (27.5 + (seed % 3) * 0.7).toFixed(1);
  const airHumidity = 72 + (seed % 5);
  const pressure = 1010 + (seed % 4);
  const windSpeed = 12 + (seed % 6);
  const windDirections = ['ÄÃ´ng Nam', 'ÄÃ´ng', 'Nam', 'TÃ¢y Nam', 'ÄÃ´ng Báº¯c'];
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
  const dayNames = ['Chá»§ Nháº­t', 'Thá»© Hai', 'Thá»© Ba', 'Thá»© TÆ°', 'Thá»© NÄƒm', 'Thá»© SÃ¡u', 'Thá»© Báº£y'];
  const weatherTemplates = [
    { icon: 'fa-sun', color: '#f59e0b', temp: '25Â°C - 33Â°C', rain: '10%', humidity: `${airHumidity}%`, wind: `${windSpeed} km/h`, advice: 'â˜€ï¸ Náº¯ng áº¥m: ThÃ­ch há»£p bÃ³n phÃ¢n rá»… & tÆ°á»›i nÆ°á»›c buá»•i sÃ¡ng.' },
    { icon: 'fa-cloud-sun-rain', color: '#0284c7', temp: '24Â°C - 31Â°C', rain: '65%', humidity: '82%', wind: '15 km/h', advice: 'ðŸŒ¦ï¸ MÆ°a rÃ o ráº£i rÃ¡c: Háº¡n cháº¿ phun thuá»‘c sÃ¢u vÃ¬ dá»… bá»‹ rá»­a trÃ´i.' },
    { icon: 'fa-cloud-sun', color: '#059669', temp: '23Â°C - 30Â°C', rain: '20%', humidity: '75%', wind: '10 km/h', advice: 'â›… Nhiá»u mÃ¢y mÃ¡t: Thá»i Ä‘iá»ƒm tá»‘t nháº¥t Ä‘á»ƒ lÃ m cá» & táº¡o tÃ¡n cÃ¢y.' },
    { icon: 'fa-cloud-sun', color: '#eab308', temp: '25Â°C - 32Â°C', rain: '15%', humidity: '68%', wind: '14 km/h', advice: 'ðŸŒ¤ï¸ Náº¯ng giÃ¡n Ä‘oáº¡n: ThÃ­ch há»£p phun phÃ¢n bÃ³n lÃ¡ & vi lÆ°á»£ng.' },
    { icon: 'fa-cloud-showers-heavy', color: '#7c3aed', temp: '23Â°C - 29Â°C', rain: '85%', humidity: '88%', wind: '22 km/h', advice: 'â›ˆï¸ MÆ°a giÃ´ng chiá»u: KhÆ¡i thÃ´ng rÃ£nh thÃ¡o nÆ°á»›c trÃ¡nh ngáº­p Ãºng.' },
    { icon: 'fa-sun', color: '#ea580c', temp: '26Â°C - 34Â°C', rain: '5%', humidity: '62%', wind: '11 km/h', advice: 'â˜€ï¸ Náº¯ng rá»±c rá»¡: Duy trÃ¬ há»‡ thá»‘ng tÆ°á»›i nhá» giá»t tá»± Ä‘á»™ng.' }
  ];

  const weather_forecast = weatherTemplates.map((w, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      date: d.toISOString().split('T')[0],
      day_label: i === 0 ? 'HÃ´m nay' : dayNames[d.getDay()],
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
    res.status(500).json({ error: 'Lá»—i server khi láº¥y dá»¯ liá»‡u cáº£m biáº¿n IoT.' });
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
      message: 'ÄÃ£ lÃ m má»›i dá»¯ liá»‡u cáº£m biáº¿n IoT thÃ nh cÃ´ng!',
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
    res.status(500).json({ error: 'Lá»—i server khi lÃ m má»›i dá»¯ liá»‡u cáº£m biáº¿n IoT.' });
  }
});

// DELETE farm (User = Soft Delete / áº¨n Ä‘á»‡m; Admin = Permanent Delete / XÃ³a vÄ©nh viá»…n)
router.delete('/:id', auth, async (req, res) => {
  try {
    const farmId = parseInt(req.params.id);
    const farmCheck = await pool.query('SELECT * FROM farms WHERE id = $1', [farmId]);
    if (farmCheck.rows.length === 0) {
      if (req.user.role === 'admin') {
        // Farm already gone from farms table, clean up any lingering audit entries or cache
        try { await pool.query('DELETE FROM data_audit_logs WHERE target_type = $1 AND record_id = $2', ['Trang tráº¡i', farmId]); } catch(_) {}
        await delCacheByPattern('farms_');
        return res.json({ success: true, message: 'Trang tráº¡i Ä‘Ã£ Ä‘Æ°á»£c xÃ³a sáº¡ch hoÃ n toÃ n khá»i há»‡ thá»‘ng.' });
      }
      return res.status(404).json({ error: 'KhÃ´ng tÃ¬m tháº¥y trang tráº¡i.' });
    }

    const farm = farmCheck.rows[0];
    const userName = req.user.full_name || req.user.email || `User #${req.user.id}`;

    if (req.user.role === 'admin') {
      // Admin: PERMANENT HARD DELETE + FULL CASCADE DELETE ALL MEDIA, LOGS, PLANTS, SUPPLIES, IOT & COSTS
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Delete associated plant media
        try {
          await client.query(`
            DELETE FROM plant_media 
            WHERE plant_id IN (SELECT id FROM plants WHERE farm_id = $1)
          `, [farmId]);
        } catch (_) {}

        // 2. Delete associated plant logs
        try {
          await client.query(`
            DELETE FROM plant_logs 
            WHERE plant_id IN (SELECT id FROM plants WHERE farm_id = $1)
          `, [farmId]);
        } catch (_) {}

        // 3. Delete associated supply usages for this farm or its supplies
        try {
          await client.query(`
            DELETE FROM supply_usages 
            WHERE farm_id = $1 
               OR supply_id IN (SELECT id FROM supplies WHERE farm_id = $1)
          `, [farmId]);
        } catch (_) {}

        // 4. Delete associated supplies for this farm
        try {
          await client.query('DELETE FROM supplies WHERE farm_id = $1', [farmId]);
        } catch (_) {}

        // 5. Delete associated IoT sensors, devices, costs, assets, alerts
        try { await client.query('DELETE FROM farm_iot_sensors WHERE farm_id = $1', [farmId]); } catch (_) {}
        try { await client.query('DELETE FROM devices WHERE farm_id = $1', [farmId]); } catch (_) {}
        try { await client.query('DELETE FROM costs WHERE farm_id = $1', [farmId]); } catch (_) {}
        try { await client.query('DELETE FROM fixed_assets WHERE farm_id = $1', [farmId]); } catch (_) {}
        try { await client.query('DELETE FROM user_alert_rules WHERE farm_id = $1', [farmId]); } catch (_) {}

        // 6. Delete associated plants in this farm
        await client.query('DELETE FROM plants WHERE farm_id = $1', [farmId]);

        // 7. Unbind users assigned to this farm
        await client.query('UPDATE users SET farm_id = NULL WHERE farm_id = $1', [farmId]);

        // 8. Delete the farm itself
        await client.query('DELETE FROM farms WHERE id = $1', [farmId]);

        // 9. Record in data_audit_logs for Admin DB Audit History
        try {
          await client.query(`
            INSERT INTO data_audit_logs (user_id, user_name, action_type, target_type, record_id, title, old_data, note)
            VALUES ($1, $2, 'DELETE', 'Trang tráº¡i', $3, $4, $5, 'XÃ³a vÄ©nh viá»…n trang tráº¡i + CÃ¢y trá»“ng + Váº­t tÆ° Ä‘Ã­nh kÃ¨m khá»i CSDL bá»Ÿi Admin')
          `, [req.user.id, userName, farmId, `XÃ³a vÄ©nh viá»…n trang tráº¡i ${farm.name}`, JSON.stringify(farm)]);
        } catch (_) {}

        await client.query('COMMIT');
      } catch (cascadeErr) {
        await client.query('ROLLBACK');
        console.error('Cascade error deleting farm:', cascadeErr);
        throw cascadeErr;
      } finally {
        client.release();
      }

      await delCacheByPattern('farms_');
      await delCacheByPattern('plants_');
      await delCacheByPattern('supplies_');
      await delCacheByPattern('farm_iot_');

      const broadcast = req.app.get('broadcast');
      if (broadcast) broadcast('farms_updated');

      return res.json({ success: true, message: 'Admin Ä‘Ã£ xÃ³a vÄ©nh viá»…n trang tráº¡i cÃ¹ng toÃ n bá»™ cÃ¢y trá»“ng & váº­t tÆ° Ä‘Ã­nh kÃ¨m khá»i CSDL PostgreSQL thÃ nh cÃ´ng!' });
    } else {
      // User: SOFT DELETE / HIDE ("XÃ³a Ä‘á»‡m")
      const isOwner = farm.user_id === req.user.id || farm.created_by === req.user.id || (req.user.farm_id && req.user.farm_id === farm.id);
      if (!isOwner) {
        return res.status(403).json({ error: 'Báº¡n khÃ´ng cÃ³ quyá»n xÃ³a trang tráº¡i nÃ y.' });
      }

      await pool.query('UPDATE farms SET is_deleted = true, deleted_at = NOW() WHERE id = $1', [farmId]);

      // Record soft-delete in data_audit_logs
      try {
        await pool.query(`
          INSERT INTO data_audit_logs (user_id, user_name, action_type, target_type, record_id, title, old_data, note)
          VALUES ($1, $2, 'DELETE_SOFT', 'Trang tráº¡i', $3, $4, $5, 'NÃ´ng há»™ xÃ³a Ä‘á»‡m (áº©n) trang tráº¡i')
        `, [req.user.id, userName, farmId, `XÃ³a Ä‘á»‡m trang tráº¡i ${farm.name}`, JSON.stringify(farm)]);
      } catch (_) {}

      await delCacheByPattern('farms_');

      const broadcast = req.app.get('broadcast');
      if (broadcast) broadcast('farms_updated');

      return res.json({ success: true, message: 'ÄÃ£ xÃ³a Ä‘á»‡m (áº©n) trang tráº¡i khá»i danh sÃ¡ch thÃ nh cÃ´ng!' });
    }
  } catch (err) {
    console.error('Error deleting farm:', err);
    res.status(500).json({ error: 'Lá»—i server khi xÃ³a trang tráº¡i: ' + err.message });
  }
});

module.exports = router;

