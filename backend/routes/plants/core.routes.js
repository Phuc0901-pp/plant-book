const express = require('express');
const router = express.Router();
const {
  pool, auth, admin, logAuditAction, jwt, nfcSecurity, zaloService,
  singleflight, invalidateAndBroadcast, logAudit, calculateSmartReminders,
  checkTier, crypto, normalizeGpsPayload, storageService,
  uploadFile, deleteFile, uuidv4, path, upload, queueService,
  withFarmHashChainLock, sealPlantLogHashChain, isUserFinanceRedacted,
  sanitizeLogRowForUser, verifyPlantAccess, convertLogAmountToBaseSupplyQty,
  generateSlug, generatePublicPlantUrl, formatStandardNfcUid,
  syncPlantNfcToInventory, ensureNfcInventoryColumns, reconcileFarmNfcInventory,
  buildLogFilterQuery, isFullNfcUid
} = require('./helpers');

router.get('/', auth, async (req, res) => {
  try {
    const { search, health_status, plant_type, user_id, farm_id, range_min, range_max, chunk_group } = req.query;

    // Singleflight Cache Key định danh truy vấn
    const sfKey = `plants:user_${req.user.id}:${farm_id || 'all'}:${range_min || ''}_${range_max || ''}:${chunk_group || ''}:${health_status || ''}:${plant_type || ''}:${search || ''}`;

    const rows = await singleflight.do(sfKey, async () => {
      let query = `
        SELECT p.*, ps.name as schema_name, u.full_name as creator_name,
               f.name as farm_name, f.puc_code as farm_puc_code, f.vietgap_cert_number,
               COALESCE(fu.full_name, fu_assigned.full_name) as farm_owner_name,
               COALESCE(fu.id, fu_assigned.id) as farm_owner_id,
               (SELECT COUNT(*) FROM plant_media pm WHERE pm.plant_id = p.id) as media_count,
               (SELECT COUNT(*) FROM plant_logs pl WHERE pl.plant_id = p.id AND (pl.is_deleted IS NOT TRUE)) as log_count,
               TO_CHAR((SELECT MAX(log_date) FROM plant_logs WHERE plant_id = p.id AND log_type = 'Tưới nước' AND (is_deleted IS NOT TRUE)), 'YYYY-MM-DD') as last_watered,
               TO_CHAR((SELECT MAX(log_date) FROM plant_logs WHERE plant_id = p.id AND log_type = 'Bón phân' AND (is_deleted IS NOT TRUE)), 'YYYY-MM-DD') as last_fertilized,
               TO_CHAR((SELECT MAX(log_date) FROM plant_logs WHERE plant_id = p.id AND (is_deleted IS NOT TRUE)), 'YYYY-MM-DD') as last_care_date,
               (SELECT log_type FROM plant_logs WHERE plant_id = p.id AND (is_deleted IS NOT TRUE) ORDER BY log_date DESC, id DESC LIMIT 1) as last_care_type,
               CASE 
                 WHEN p.phi_until_date IS NOT NULL AND p.phi_until_date >= CURRENT_DATE 
                 THEN (p.phi_until_date - CURRENT_DATE) 
                 ELSE 0 
                END as phi_remaining_days,
               CASE 
                 WHEN p.phi_until_date IS NOT NULL AND p.phi_until_date >= CURRENT_DATE 
                 THEN 'quarantine' 
                 ELSE 'safe' 
               END as current_phi_status
        FROM plants p
        LEFT JOIN plant_schemas ps ON ps.id = p.schema_id
        LEFT JOIN users u ON u.id = p.created_by
        LEFT JOIN farms f ON f.id = p.farm_id
        LEFT JOIN users fu ON fu.id = f.user_id
        LEFT JOIN users fu_assigned ON fu_assigned.farm_id = f.id AND fu_assigned.role != 'admin'
        WHERE (p.deleted_at IS NULL)
      `;
      const params = [];
      let idx = 1;

      if (req.user.role !== 'admin') {
        if (req.user.view_plants_scope === 'assigned') {
          query += ` AND (p.assigned_to_user_id = $${idx} OR p.created_by = $${idx} OR f.user_id = $${idx})`;
          params.push(req.user.id);
          idx++;
        } else {
          query += ` AND (
            f.user_id = $${idx} 
            OR p.created_by = $${idx} 
            OR p.assigned_to_user_id = $${idx} 
            OR p.farm_id IN (SELECT id FROM farms WHERE user_id = $${idx} AND is_deleted IS NOT TRUE)
            OR p.farm_id = (SELECT farm_id FROM users WHERE id = $${idx})
          )`;
          params.push(req.user.id);
          idx++;
        }
      }

      if (search) {
        query += ` AND (p.plant_type ILIKE $${idx} OR p.plant_variety ILIKE $${idx} OR p.location ILIKE $${idx} OR p.tree_code ILIKE $${idx})`;
        params.push(`%${search}%`);
        idx++;
      }
      if (health_status) {
        query += ` AND p.health_status = $${idx}`;
        params.push(health_status);
        idx++;
      }
      if (plant_type) {
        query += ` AND p.plant_type ILIKE $${idx}`;
        params.push(`%${plant_type}%`);
        idx++;
      }
      if (user_id) {
        query += ` AND f.user_id = $${idx}`;
        params.push(parseInt(user_id));
        idx++;
      }
      if (farm_id) {
        query += ` AND p.farm_id = $${idx}`;
        params.push(parseInt(farm_id));
        idx++;
      }

      // ── Range & Chunk Group Querying (0..20, 21..40, 41..60, 61..80) ──
      let rMin = null;
      let rMax = null;
      if (chunk_group) {
        const cg = parseInt(chunk_group, 10);
        if (cg === 1) { rMin = 1; rMax = 20; }
        else if (cg === 2) { rMin = 21; rMax = 40; }
        else if (cg === 3) { rMin = 41; rMax = 60; }
        else if (cg === 4) { rMin = 61; rMax = 80; }
      } else if (range_min !== undefined || range_max !== undefined) {
        if (range_min !== undefined && !isNaN(parseInt(range_min, 10))) rMin = parseInt(range_min, 10);
        if (range_max !== undefined && !isNaN(parseInt(range_max, 10))) rMax = parseInt(range_max, 10);
      }

      if (rMin !== null && rMax !== null) {
        query += ` AND (
          (p.tree_code ~ '^[0-9]+$' AND p.tree_code::int >= $${idx} AND p.tree_code::int <= $${idx + 1})
          OR (p.id >= $${idx} AND p.id <= $${idx + 1})
        )`;
        params.push(rMin, rMax);
        idx += 2;
      } else if (rMin !== null) {
        query += ` AND (
          (p.tree_code ~ '^[0-9]+$' AND p.tree_code::int >= $${idx})
          OR (p.id >= $${idx})
        )`;
        params.push(rMin);
        idx++;
      } else if (rMax !== null) {
        query += ` AND (
          (p.tree_code ~ '^[0-9]+$' AND p.tree_code::int <= $${idx})
          OR (p.id <= $${idx})
        )`;
        params.push(rMax);
        idx++;
      }

      query += ' ORDER BY p.created_at DESC';
      const result = await pool.query(query, params);
      return result.rows;
    });

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// ─── GPS Proximity Query (Tìm cây gần vị trí GPS của người dùng) ──────────────
router.get('/nearby-gps', auth, async (req, res) => {
  try {
    const { lat, lng, radius = 500, farm_id } = req.query;
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const radiusMeters = parseFloat(radius) || 500;

    if (isNaN(userLat) || isNaN(userLng)) {
      return res.status(400).json({ error: 'Tọa độ GPS (lat, lng) không hợp lệ.' });
    }

    const sfKey = `plants:nearby:${userLat.toFixed(5)}_${userLng.toFixed(5)}:${radiusMeters}:${farm_id || 'all'}`;

    const rows = await singleflight.do(sfKey, async () => {
      let query = `
        SELECT p.*, f.name as farm_name,
               (
                 6371000 * 2 * ASIN(SQRT(
                   POWER(SIN(RADIANS(p.latitude - $1) / 2), 2) +
                   COS(RADIANS($1)) * COS(RADIANS(p.latitude)) *
                   POWER(SIN(RADIANS(p.longitude - $2) / 2), 2)
                 ))
               ) AS distance_meters
        FROM plants p
        LEFT JOIN farms f ON f.id = p.farm_id
        WHERE p.latitude IS NOT NULL 
          AND p.longitude IS NOT NULL
          AND p.deleted_at IS NULL
      `;
      const params = [userLat, userLng];
      let idx = 3;

      if (farm_id) {
        query += ` AND p.farm_id = $${idx}`;
        params.push(parseInt(farm_id, 10));
        idx++;
      }

      if (req.user.role !== 'admin') {
        query += ` AND (f.user_id = $${idx} OR p.farm_id = (SELECT farm_id FROM users WHERE id = $${idx}) OR p.created_by = $${idx})`;
        params.push(req.user.id);
        idx++;
      }

      query += ` AND (
        6371000 * 2 * ASIN(SQRT(
          POWER(SIN(RADIANS(p.latitude - $1) / 2), 2) +
          COS(RADIANS($1)) * COS(RADIANS(p.latitude)) *
          POWER(SIN(RADIANS(p.longitude - $2) / 2), 2)
        ))
      ) <= $${idx}`;
      params.push(radiusMeters);

      query += ` ORDER BY distance_meters ASC LIMIT 100`;

      const result = await pool.query(query, params);
      return result.rows.map(r => ({
        ...r,
        distance_meters: Math.round(parseFloat(r.distance_meters) * 10) / 10
      }));
    });

    res.json(rows);
  } catch (err) {
    console.error('Nearby GPS error:', err);
    res.status(500).json({ error: 'Lỗi server khi tìm kiếm cây theo GPS: ' + err.message });
  }
});

// ─── Smart Agronomic Reminders (Nhắc việc thông minh theo chu kỳ) ─────────────
router.get('/smart-reminders', auth, async (req, res) => {
  try {
    const { farm_id } = req.query;
    let plantsQuery = 'SELECT * FROM plants WHERE (deleted_at IS NULL)';
    const params = [];
    if (farm_id) {
      plantsQuery += ' AND farm_id = $1';
      params.push(parseInt(farm_id, 10));
    } else if (req.user.role !== 'admin') {
      plantsQuery += ' AND (created_by = $1 OR farm_id = (SELECT farm_id FROM users WHERE id = $1))';
      params.push(req.user.id);
    }

    const plantsRes = await pool.query(plantsQuery, params);
    const logsRes = await pool.query('SELECT * FROM plant_logs WHERE is_deleted IS NOT TRUE ORDER BY log_date DESC LIMIT 500');

    const reminders = calculateSmartReminders(plantsRes.rows, logsRes.rows);
    res.json(reminders);
  } catch (err) {
    console.error('Smart reminders error:', err);
    res.status(500).json({ error: 'Lỗi server khi tính toán nhắc việc: ' + err.message });
  }
});

router.get('/logs/recent', auth, async (req, res) => {
  try {
    const rawDays = req.query.days;
    let daysLimit = 30; // default 30 days
    let isAll = false;

    if (rawDays === '3') {
      daysLimit = 7; // Dashboard short summary
    } else if (rawDays === 'all') {
      isAll = true;
    } else if (rawDays && !isNaN(parseInt(rawDays, 10))) {
      daysLimit = parseInt(rawDays, 10);
    }



    let query = `
      SELECT pl.*, 
             COALESCE(p.plant_type, 'Toàn vườn') as plant_type, 
             COALESCE(p.plant_variety, '') as plant_variety, 
             COALESCE(p.tree_code, 'Toàn vườn') as tree_code, 
             p.assigned_to_user_id,
             COALESCE(p.farm_id, (SELECT id FROM farms WHERE user_id = pl.created_by LIMIT 1)) as farm_id, 
             COALESCE(f.name, (SELECT name FROM farms WHERE user_id = pl.created_by LIMIT 1), 'Trang trại Nông hộ') as farm_name, 
             COALESCE(p.location, 'Toàn vườn') as plant_location, 
             u.full_name as creator_name
      FROM plant_logs pl
      LEFT JOIN plants p ON pl.plant_id = p.id
      LEFT JOIN farms f ON f.id = p.farm_id
      LEFT JOIN users u ON pl.created_by = u.id
      WHERE (pl.is_deleted IS NOT TRUE)
    `;
    const params = [];
    let idx = 1;

    if (!isAll) {
      query += ` AND pl.log_date >= CURRENT_DATE - $${idx}::integer `;
      params.push(daysLimit);
      idx++;
    }

    if (req.user.role !== 'admin') {
      if (req.user.view_plants_scope === 'assigned') {
        // Chỉ hiển thị lịch sử chăm sóc của các cây mà tài khoản được phân quyền phụ trách (hoặc chủ vườn)
        query += ` AND (f.user_id = $${idx} OR p.assigned_to_user_id = $${idx}) `;
        params.push(req.user.id);
        idx++;
      } else {
        query += ` AND (pl.created_by = $${idx} OR f.user_id = $${idx} OR f.id = (SELECT farm_id FROM users WHERE id = $${idx}) OR p.assigned_to_user_id = $${idx}) `;
        params.push(req.user.id);
        idx++;
      }

      if (req.user.allow_shared_history === false) {
        query += ` AND (f.user_id = $${idx} OR pl.created_by = $${idx}) `;
        params.push(req.user.id);
        idx++;
      }

      if (req.user.view_history_from_date) {
        query += ` AND (f.user_id = $${idx} OR pl.log_date >= $${idx + 1}) `;
        params.push(req.user.id, req.user.view_history_from_date);
        idx += 2;
      }
    }
    query += ` ORDER BY pl.log_date DESC, pl.id DESC `;
    query += ` LIMIT 300 `;
    const result = await pool.query(query, params);
    const rows = isUserFinanceRedacted(req.user)
      ? result.rows.map(r => sanitizeLogRowForUser(r, req.user))
      : result.rows;
    res.json(rows);
  } catch (err) {
    console.error('Error fetching recent logs:', err);
    res.status(500).json({ error: 'Lỗi server khi tải nhật ký canh tác.' });
  }
});


router.get('/media/all', auth, async (req, res) => {
  try {
    let query = `
      SELECT pm.*, p.plant_type, p.tree_code, p.farm_id, p.assigned_to_user_id, f.name as farm_name, f.user_id as farm_owner_id, u.full_name as owner_name
      FROM plant_media pm
      JOIN plants p ON pm.plant_id = p.id
      LEFT JOIN farms f ON f.id = p.farm_id
      LEFT JOIN users u ON u.id = f.user_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Security: Non-admin users can only view their own farm media (or assigned plants if scope === 'assigned')!
    if (req.user.role !== 'admin') {
      if (req.user.view_plants_scope === 'assigned') {
        query += ` AND (f.user_id = $${paramIndex} OR p.assigned_to_user_id = $${paramIndex}) `;
      } else {
        query += ` AND (f.user_id = $${paramIndex} OR p.farm_id = (SELECT farm_id FROM users WHERE id = $${paramIndex}) OR p.farm_id IN (SELECT id FROM farms WHERE user_id = $${paramIndex}) OR p.assigned_to_user_id = $${paramIndex} OR p.created_by = $${paramIndex}) `;
      }
      params.push(req.user.id);
      paramIndex++;
      query += ` AND pm.delete_pending = false `;
    } else {
      // Admins can filter by User ID
      if (req.query.user_id) {
        query += ` AND f.user_id = $${paramIndex} `;
        params.push(parseInt(req.query.user_id));
        paramIndex++;
      }
      // Admins can filter by delete_pending
      if (req.query.pending_only === 'true') {
        query += ` AND pm.delete_pending = true `;
      }
    }

    if (req.query.farm_id) {
      query += ` AND p.farm_id = $${paramIndex} `;
      params.push(parseInt(req.query.farm_id));
      paramIndex++;
    }

    if (req.query.plant_id) {
      query += ` AND pm.plant_id = $${paramIndex} `;
      params.push(parseInt(req.query.plant_id));
      paramIndex++;
    }

    query += ` ORDER BY pm.uploaded_at DESC `;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching global media:', err);
    res.status(500).json({ error: 'Lỗi server khi tải thư viện media.' });
  }
});

router.get('/:id(\\d+)', auth, async (req, res) => {
  try {
    const plant = await pool.query(
      `SELECT p.*, ps.name as schema_name, ps.fields as schema_fields, 
              f.name as farm_name, f.user_id as farm_owner_id, 
              u.full_name as owner_name, u.phone as owner_phone
       FROM plants p 
       LEFT JOIN plant_schemas ps ON ps.id = p.schema_id
       LEFT JOIN farms f ON f.id = p.farm_id
       LEFT JOIN users u ON u.id = f.user_id
       WHERE p.id=$1`, [req.params.id]
    );
    if (plant.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy.' });

    const row = plant.rows[0];
    const isOwner = Number(row.farm_owner_id) === Number(req.user.id);
    const isDirectlyAssigned = Number(row.assigned_to_user_id) === Number(req.user.id);
    const isSameFarmOrCreator = (req.user.farm_id && row.farm_id && Number(req.user.farm_id) === Number(row.farm_id))
      || (row.created_by && Number(row.created_by) === Number(req.user.id));

    if (req.user.role !== 'admin' && !isOwner) {
      if (req.user.view_plants_scope === 'assigned') {
        if (!isDirectlyAssigned) {
          return res.status(403).json({ error: 'Cây này không nằm trong danh sách cây bạn được giao phụ trách.' });
        }
      } else if (!isDirectlyAssigned && !isSameFarmOrCreator) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập thông tin cây này.' });
      }
    }

    const media = await pool.query('SELECT * FROM plant_media WHERE plant_id=$1 ORDER BY uploaded_at DESC', [req.params.id]);
    const logs = await pool.query(
      `SELECT pl.*, u.full_name as creator_name, u.phone as creator_phone, u.email as creator_email 
       FROM plant_logs pl 
       LEFT JOIN users u ON u.id = pl.created_by 
       WHERE pl.plant_id=$1 AND (pl.is_deleted IS NOT TRUE)
       ORDER BY pl.log_date DESC, pl.created_at DESC`, [req.params.id]
    );

    const safeLogs = isUserFinanceRedacted(req.user)
      ? logs.rows.map(l => sanitizeLogRowForUser(l, req.user))
      : logs.rows;

    res.json({ ...row, media: media.rows, logs: safeLogs });
  } catch (err) {
    console.error('Get plant details error:', err);
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
});


router.get('/:id(\\d+)/logs', auth, async (req, res) => {
  try {
    const plant = await pool.query(
      `SELECT p.id, p.created_by, p.assigned_to_user_id, f.user_id as farm_owner_id, p.farm_id
       FROM plants p 
       LEFT JOIN farms f ON f.id = p.farm_id
       WHERE p.id=$1`, [req.params.id]
    );
    if (plant.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy.' });

    const row = plant.rows[0];
    const isOwner = Number(row.farm_owner_id) === Number(req.user.id);
    const isDirectlyAssigned = Number(row.assigned_to_user_id) === Number(req.user.id);
    const isSameFarmOrCreator = (req.user.farm_id && row.farm_id && Number(req.user.farm_id) === Number(row.farm_id))
      || (row.created_by && Number(row.created_by) === Number(req.user.id));

    if (req.user.role !== 'admin' && !isOwner) {
      if (req.user.view_plants_scope === 'assigned') {
        if (!isDirectlyAssigned) {
          return res.status(403).json({ error: 'Cây này không nằm trong danh sách cây bạn được giao phụ trách.' });
        }
      } else if (!isDirectlyAssigned && !isSameFarmOrCreator) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập thông tin cây này.' });
      }
    }

    let logsQuery = 'SELECT pl.*, u.full_name as creator_name, u.phone as creator_phone, u.email as creator_email FROM plant_logs pl LEFT JOIN users u ON u.id = pl.created_by WHERE pl.plant_id = $1 AND (pl.is_deleted IS NOT TRUE)';
    const logsParams = [req.params.id];
    let idx = 2;

    if (req.user.role !== 'admin' && !isOwner) {
      const farmRes = await pool.query('SELECT allow_shared_history FROM farms WHERE id=$1', [row.farm_id]);
      const farmAllowShared = farmRes.rows.length > 0 && farmRes.rows[0].allow_shared_history !== false;
      const userAllowShared = req.user.allow_shared_history !== false;

      if (!farmAllowShared || !userAllowShared) {
        logsQuery += ` AND pl.created_by = $${idx}`;
        logsParams.push(req.user.id);
        idx++;
      }

      if (req.user.view_history_from_date) {
        logsQuery += ` AND pl.log_date >= $${idx}`;
        logsParams.push(req.user.view_history_from_date);
        idx++;
      }
    }

    logsQuery += ' ORDER BY pl.log_date DESC, pl.id DESC';
    const logsRes = await pool.query(logsQuery, logsParams);

    // Truy vấn các khoản tiêu hao vật tư liên kết với cây này từ supply_usages
    let usagesRows = [];
    try {
      const usagesRes = await pool.query(
        `SELECT su.*, su.usage_date as used_date, su.usage_date as log_date,
                s.name as supply_name, s.category as supply_category, s.unit as supply_unit, s.image_url as supply_image_url,
                COALESCE(NULLIF(TRIM(pl.operator_name), ''), NULLIF(TRIM(usr.full_name), ''), 'Chủ trang trại') as operator_name,
                pl.equipment_used
         FROM supply_usages su
         LEFT JOIN supplies s ON su.supply_id = s.id
         LEFT JOIN users usr ON usr.id = su.user_id
         LEFT JOIN LATERAL (
           SELECT pl_inner.operator_name, pl_inner.equipment_used
           FROM plant_logs pl_inner
           WHERE pl_inner.plant_id = su.plant_id
             AND (pl_inner.log_date = su.usage_date OR pl_inner.created_at::date = su.usage_date)
           ORDER BY pl_inner.id DESC
           LIMIT 1
         ) pl ON true
         WHERE su.plant_id = $1
         ORDER BY su.usage_date DESC, su.id DESC`,
        [req.params.id]
      );
      usagesRows = usagesRes.rows;
    } catch (err) {
      console.warn('Lỗi query supply_usages LATERAL (sẽ thử fallback):', err.message);
      try {
        const fbRes = await pool.query(
          `SELECT su.*, su.usage_date as used_date, su.usage_date as log_date,
                  s.name as supply_name, s.category as supply_category, s.unit as supply_unit, s.image_url as supply_image_url
           FROM supply_usages su
           LEFT JOIN supplies s ON su.supply_id = s.id
           WHERE su.plant_id = $1
           ORDER BY su.usage_date DESC, su.id DESC`,
          [req.params.id]
        );
        usagesRows = fbRes.rows;
      } catch (_) {
        usagesRows = [];
      }
    }

    const redactFinance = isUserFinanceRedacted(req.user);

    // Đối soát chi phí và tên vật tư vào từng log nếu log chưa có cost
    const enrichedLogs = logsRes.rows.map(log => {
      let d = log.details || {};
      if (typeof d === 'string') {
        try { d = JSON.parse(d); } catch(_) { d = {}; }
      }

      if (!d.total_cost || parseFloat(d.total_cost) === 0) {
        const matched = usagesRows.find(u => 
          (d.supply_id && u.supply_id == d.supply_id) ||
          (u.usage_date === log.log_date && (u.note || '').includes(log.log_type))
        );
        if (matched) {
          d.total_cost = parseFloat(matched.total_cost) || 0;
          d.material_name = d.material_name || matched.supply_name;
          d.supply_name = d.supply_name || matched.supply_name;
          d.unit_price = d.unit_price || parseFloat(matched.unit_price) || 0;
        }
      }

      const costVal = parseFloat(d.total_cost || log.cost || 0) || 0;
      const matName = d.material_name || d.supply_name || d.fertilizer_name || d.pesticide_name || null;

      const enriched = {
        ...log,
        details: d,
        cost: costVal,
        material_name: matName
      };
      return redactFinance ? sanitizeLogRowForUser(enriched, req.user) : enriched;
    });

    res.json(enrichedLogs);
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
});



router.post('/batch', auth, admin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { farm_id, plant_type, plant_variety, plant_age, health_status, schema_id, is_public, items } = req.body;
    if (!plant_type) {
      return res.status(400).json({ error: 'Loại cây là bắt buộc.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Danh sách cây import trống.' });
    }

    await client.query('BEGIN');
    const inserted = [];

    for (const item of items) {
      const stt = item.stt || '';
      const slug = stt ? `${req.user.id}_${farm_id || 0}_${stt}` : generateSlug(plant_type);
      const lat = parseFloat(item.n || item.latitude);
      const lng = parseFloat(item.e || item.longitude);
      const location = farm_id ? `Lô nhập CSV - STT ${stt}` : `Nhập CSV - STT ${stt}`;

      const resDb = await client.query(
        `INSERT INTO plants (public_slug, schema_id, plant_type, plant_variety, plant_age, health_status, location, data, is_public, farm_id, latitude, longitude, created_by, tree_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (public_slug) DO UPDATE 
         SET schema_id = EXCLUDED.schema_id,
             plant_type = EXCLUDED.plant_type,
             plant_variety = EXCLUDED.plant_variety,
             plant_age = EXCLUDED.plant_age,
             health_status = EXCLUDED.health_status,
             location = EXCLUDED.location,
             is_public = EXCLUDED.is_public,
             farm_id = EXCLUDED.farm_id,
             latitude = EXCLUDED.latitude,
             longitude = EXCLUDED.longitude,
             created_by = EXCLUDED.created_by,
             tree_code = EXCLUDED.tree_code,
             updated_at = NOW()
         RETURNING id`,
        [slug, schema_id || null, plant_type, plant_variety || '', plant_age || '', health_status || 'Tốt',
         location, JSON.stringify({}), is_public !== false, farm_id || null, lat, lng, req.user.id, stt]
      );
      inserted.push(resDb.rows[0].id);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, count: inserted.length, ids: inserted });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Batch import error:', err);
    res.status(500).json({ error: 'Lỗi server khi import lô cây: ' + err.message });
  } finally {
    client.release();
  }
});

// POST /api/plants/batch-range — Import sequential range of trees XX -> XY with identical or matrix-customized attributes
router.post('/batch-range', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { 
      items, // Matrix of trees: [{ tree_code, location, latitude, longitude, planting_date, plant_age, health_status, plant_type, plant_variety }]
      tree_codes, 
      start_num, 
      end_num, 
      prefix, 
      pad_zeros,
      plant_type, 
      plant_variety, 
      planting_date,
      plant_age, 
      health_status, 
      location, 
      data, 
      is_public, 
      farm_id, 
      latitude, 
      longitude, 
      schema_id 
    } = req.body;

    if (req.user.role !== 'admin') {
      if (!farm_id) {
        return res.status(400).json({ error: 'Vui lòng chọn trang trại để tạo cây trồng.' });
      }
      const farmCheck = await client.query('SELECT id, user_id FROM farms WHERE id = $1', [farm_id]);
      if (farmCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Trang trại không tồn tại.' });
      }
      const f = farmCheck.rows[0];
      const isOwner = Number(f.user_id) === Number(req.user.id);
      const isMember = req.user.farm_id && Number(req.user.farm_id) === Number(farm_id);
      if (!isOwner && !isMember) {
        return res.status(403).json({ error: 'Bạn không có quyền thêm cây vào trang trại này.' });
      }
    }

    if (!plant_type || !plant_type.trim()) {
      return res.status(400).json({ error: 'Loại cây là bắt buộc.' });
    }

    // Build list of tree objects to insert
    let treesToInsert = [];

    if (Array.isArray(items) && items.length > 0) {
      // Direct Data Matrix mode
      treesToInsert = items.map((it, idx) => {
        const code = String(it.tree_code || it.code || `Tree-${idx + 1}`).trim();
        const pLat = it.latitude !== undefined && it.latitude !== '' && !isNaN(parseFloat(it.latitude)) ? parseFloat(it.latitude) : (latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null);
        const pLng = it.longitude !== undefined && it.longitude !== '' && !isNaN(parseFloat(it.longitude)) ? parseFloat(it.longitude) : (longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null);
        const pLoc = (it.location !== undefined ? it.location : location || '').trim();
        const pPlot = (it.plot_code !== undefined ? it.plot_code : '').trim();
        const pRow = it.row_number !== undefined && it.row_number !== null && !isNaN(parseInt(it.row_number, 10)) ? parseInt(it.row_number, 10) : null;
        const pDate = it.planting_date || planting_date || null;
        const pAge = (it.plant_age !== undefined ? it.plant_age : plant_age || '').trim();
        const pHealth = it.health_status || health_status || 'Tốt';
        const pType = (it.plant_type || plant_type).trim();
        const pVariety = (it.plant_variety !== undefined ? it.plant_variety : plant_variety || '').trim();
        const pYield = it.initial_yield !== undefined ? it.initial_yield : (req.body.initial_yield || (data && data.initial_yield) || '');
        const pDiseases = it.past_diseases !== undefined ? it.past_diseases : (req.body.past_diseases || (data && data.past_diseases) || []);
        return {
          code,
          location: pLoc,
          plot_code: pPlot,
          row_number: pRow,
          latitude: pLat,
          longitude: pLng,
          planting_date: pDate,
          plant_age: pAge,
          health_status: pHealth,
          plant_type: pType,
          plant_variety: pVariety,
          initial_yield: pYield,
          past_diseases: pDiseases
        };
      }).filter(t => t.code);
    } else if (Array.isArray(tree_codes) && tree_codes.length > 0) {
      const bYield = req.body.initial_yield || (data && data.initial_yield) || '';
      const bDiseases = req.body.past_diseases || (data && data.past_diseases) || [];
      treesToInsert = tree_codes.map(c => String(c).trim()).filter(Boolean).map(code => ({
        code,
        location: (location || '').trim(),
        latitude: latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null,
        longitude: longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null,
        planting_date: planting_date || null,
        plant_age: (plant_age || '').trim(),
        health_status: health_status || 'Tốt',
        plant_type: plant_type.trim(),
        plant_variety: (plant_variety || '').trim(),
        initial_yield: bYield,
        past_diseases: bDiseases
      }));
    } else if (start_num !== undefined && end_num !== undefined) {
      const s = parseInt(start_num, 10);
      const e = parseInt(end_num, 10);
      if (isNaN(s) || isNaN(e) || s > e) {
        return res.status(400).json({ error: 'Dải số thứ tự không hợp lệ (số bắt đầu phải nhỏ hơn hoặc bằng số kết thúc).' });
      }
      if (e - s + 1 > 500) {
        return res.status(400).json({ error: 'Mỗi lần tạo hàng loạt tối đa 500 cây.' });
      }
      const pre = prefix || '';
      const padLen = pad_zeros ? Math.max(String(start_num).length, String(end_num).length) : 0;
      const bYield = req.body.initial_yield || (data && data.initial_yield) || '';
      const bDiseases = req.body.past_diseases || (data && data.past_diseases) || [];
      for (let i = s; i <= e; i++) {
        const numStr = padLen > 1 ? String(i).padStart(padLen, '0') : String(i);
        treesToInsert.push({
          code: `${pre}${numStr}`,
          location: (location || '').trim(),
          latitude: latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null,
          longitude: longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null,
          planting_date: planting_date || null,
          plant_age: (plant_age || '').trim(),
          health_status: health_status || 'Tốt',
          plant_type: plant_type.trim(),
          plant_variety: (plant_variety || '').trim(),
          initial_yield: bYield,
          past_diseases: bDiseases
        });
      }
    }

    if (treesToInsert.length === 0) {
      return res.status(400).json({ error: 'Danh sách mã cây cần tạo trống.' });
    }

    if (treesToInsert.length > 500) {
      return res.status(400).json({ error: 'Mỗi lần tạo hàng loạt tối đa 500 cây.' });
    }

    await client.query('BEGIN');
    const insertedIds = [];

    for (const tree of treesToInsert) {
      const slug = `${farm_id || 0}_${tree.code}`;

      // Extract plot_code and row_number
      let plotCode = tree.plot_code || null;
      let rowNum = tree.row_number !== undefined && tree.row_number !== null ? parseInt(tree.row_number, 10) : null;
      if (!plotCode && tree.location) {
        const parts = tree.location.split(',');
        if (parts[0]) {
          plotCode = parts[0].trim();
          if (!/^lô\s+/i.test(plotCode) && /^[a-zA-Z0-9\-_]+$/.test(plotCode)) {
            plotCode = 'Lô ' + plotCode;
          }
        }
        if (parts[1] && /hàng\s*(\d+)/i.test(parts[1])) {
          const match = parts[1].match(/hàng\s*(\d+)/i);
          if (match) rowNum = parseInt(match[1], 10);
        }
      }

      if (farm_id && plotCode) {
        try {
          const existingPlot = await pool.query(
            'SELECT id FROM farm_plots WHERE farm_id = $1 AND UPPER(plot_code) = UPPER($2) LIMIT 1',
            [farm_id, plotCode]
          );
          if (existingPlot.rows.length === 0) {
            await pool.query(
              'INSERT INTO farm_plots (farm_id, plot_code, plot_name) VALUES ($1, $2, $3)',
              [farm_id, plotCode, `Lô ${plotCode}`]
            );
          }
        } catch (_) {}
      }

      const itemData = {
        ...(data || {}),
        ...(tree.initial_yield ? { initial_yield: tree.initial_yield } : {}),
        ...(tree.past_diseases && tree.past_diseases.length ? { past_diseases: tree.past_diseases } : {})
      };

      const resDb = await client.query(
        `INSERT INTO plants (public_slug, schema_id, plant_type, plant_variety, planting_date, plant_age, health_status, location, plot_code, row_number, data, is_public, farm_id, latitude, longitude, created_by, tree_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (public_slug) DO UPDATE 
         SET schema_id = EXCLUDED.schema_id,
             plant_type = EXCLUDED.plant_type,
             plant_variety = EXCLUDED.plant_variety,
             planting_date = EXCLUDED.planting_date,
             plant_age = EXCLUDED.plant_age,
             health_status = EXCLUDED.health_status,
             location = EXCLUDED.location,
             plot_code = EXCLUDED.plot_code,
             row_number = EXCLUDED.row_number,
             data = EXCLUDED.data,
             is_public = EXCLUDED.is_public,
             farm_id = EXCLUDED.farm_id,
             latitude = EXCLUDED.latitude,
             longitude = EXCLUDED.longitude,
             created_by = EXCLUDED.created_by,
             tree_code = EXCLUDED.tree_code,
             updated_at = NOW()
         RETURNING id`,
        [slug, schema_id || null, tree.plant_type, tree.plant_variety, tree.planting_date || null, tree.plant_age, tree.health_status,
         tree.location, plotCode, rowNum, JSON.stringify(itemData), is_public !== false, farm_id || null, tree.latitude, tree.longitude, req.user.id, tree.code]
      );

      const newId = resDb.rows[0].id;
      insertedIds.push(newId);

      const pubUrl = generatePublicPlantUrl(farm_id || null, newId, null);
      await client.query('UPDATE plants SET public_url = $1 WHERE id = $2', [pubUrl, newId]);
    }

    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated');

    res.status(201).json({
      success: true,
      count: insertedIds.length,
      inserted_ids: insertedIds,
      items: treesToInsert.map((t, idx) => ({ id: insertedIds[idx], code: t.code })),
      first_code: treesToInsert[0].code,
      last_code: treesToInsert[treesToInsert.length - 1].code,
      message: `Đã tạo thành công ${insertedIds.length} cây từ ${treesToInsert[0].code} đến ${treesToInsert[treesToInsert.length - 1].code}!`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Batch range creation error:', err);
    res.status(500).json({ error: 'Lỗi server khi tạo dải cây hàng loạt: ' + err.message });
  } finally {
    client.release();
  }
});

// GET /api/plants/farms/:farmId/plots - Get plots for a farm
router.get('/farms/:farmId/plots', auth, async (req, res) => {
  try {
    const farmId = parseInt(req.params.farmId, 10);
    if (isNaN(farmId)) return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });
    const result = await pool.query(
      'SELECT id, farm_id, plot_code, plot_name, description, created_at FROM farm_plots WHERE farm_id = $1 ORDER BY plot_code ASC',
      [farmId]
    );
    res.json({ success: true, plots: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server khi tải danh sách lô: ' + err.message });
  }
});

// ─── Helper: Normalize NFC UID & Two-Way Inventory Sync (SSOT) ──────────────

router.post('/', auth, async (req, res) => {
  try {
    const { schema_id, plant_type, plant_variety, planting_date, plant_age, health_status, location, plot_code, row_number, data, is_public, farm_id, latitude, longitude, tree_code, nfc_uid, initial_yield, past_diseases } = req.body;
    
    if (req.user.role !== 'admin') {
      if (!farm_id) {
        return res.status(400).json({ error: 'Vui lòng chọn trang trại để tạo cây trồng.' });
      }
      const farmCheck = await pool.query('SELECT id, user_id FROM farms WHERE id = $1', [farm_id]);
      if (farmCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Trang trại không tồn tại.' });
      }
      const f = farmCheck.rows[0];
      const isOwner = Number(f.user_id) === Number(req.user.id);
      const isMember = req.user.farm_id && Number(req.user.farm_id) === Number(farm_id);
      if (!isOwner && !isMember) {
        return res.status(403).json({ error: 'Bạn không có quyền thêm cây vào trang trại này.' });
      }
    }

    let finalTreeCode = tree_code && tree_code.trim() ? tree_code.trim() : null;
    if (!finalTreeCode) {
      const year = new Date().getFullYear();
      const farmCode = farm_id ? `TT${String(farm_id).padStart(2, '0')}` : 'TT00';
      const countRes = await pool.query('SELECT COUNT(*)::int as count FROM plants WHERE farm_id IS NOT DISTINCT FROM $1', [farm_id || null]);
      const stt = String((countRes.rows[0].count || 0) + 1).padStart(3, '0');
      finalTreeCode = `${farmCode}-${year}-${stt}`;
    }

    const slug = finalTreeCode ? `${farm_id || 0}_${finalTreeCode}` : generateSlug(plant_type);
    const cleanNfcUid = formatStandardNfcUid(nfc_uid);

    let finalPlotCode = plot_code || null;
    let finalRowNum = row_number !== undefined && row_number !== null ? parseInt(row_number, 10) : null;
    if (!finalPlotCode && location) {
      const parts = location.split(',');
      if (parts[0]) {
        finalPlotCode = parts[0].trim();
        if (!/^lô\s+/i.test(finalPlotCode) && /^[a-zA-Z0-9\-_]+$/.test(finalPlotCode)) {
          finalPlotCode = 'Lô ' + finalPlotCode;
        }
      }
      if (parts[1] && /hàng\s*(\d+)/i.test(parts[1])) {
        const match = parts[1].match(/hàng\s*(\d+)/i);
        if (match) finalRowNum = parseInt(match[1], 10);
      }
    }

    if (farm_id && finalPlotCode) {
      try {
        await pool.query(
          `INSERT INTO farm_plots (farm_id, plot_code, plot_name)
           VALUES ($1, $2, $2)
           ON CONFLICT (farm_id, plot_code) DO NOTHING`,
          [farm_id, finalPlotCode]
        );
      } catch (_) {}
    }

    const plantData = {
      ...(data || {}),
      ...(initial_yield ? { initial_yield } : {}),
      ...(past_diseases && (Array.isArray(past_diseases) ? past_diseases.length : past_diseases) ? { past_diseases } : {})
    };

    const result = await pool.query(
      `INSERT INTO plants (public_slug, schema_id, plant_type, plant_variety, planting_date, plant_age, health_status, location, plot_code, row_number, data, is_public, farm_id, latitude, longitude, created_by, tree_code, nfc_uid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (public_slug) DO UPDATE 
       SET schema_id = EXCLUDED.schema_id,
           plant_type = EXCLUDED.plant_type,
           plant_variety = EXCLUDED.plant_variety,
           planting_date = EXCLUDED.planting_date,
           plant_age = EXCLUDED.plant_age,
           health_status = EXCLUDED.health_status,
           location = EXCLUDED.location,
           plot_code = EXCLUDED.plot_code,
           row_number = EXCLUDED.row_number,
           data = EXCLUDED.data,
           is_public = EXCLUDED.is_public,
           farm_id = EXCLUDED.farm_id,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           created_by = EXCLUDED.created_by,
           tree_code = EXCLUDED.tree_code,
           nfc_uid = COALESCE(EXCLUDED.nfc_uid, plants.nfc_uid),
           updated_at = NOW()
       RETURNING *`,
      [slug, schema_id || null, plant_type, plant_variety || '', planting_date || null, plant_age || '', health_status || 'Tốt',
       location, finalPlotCode, finalRowNum, JSON.stringify(plantData), is_public !== false, farm_id || null, 
       latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null,
       longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null,
       req.user.id, finalTreeCode, cleanNfcUid]
    );

    const insertedPlant = result.rows[0];
    const publicUrl = generatePublicPlantUrl(insertedPlant.farm_id, insertedPlant.id, insertedPlant.nfc_uid);
    await pool.query('UPDATE plants SET public_url = $1 WHERE id = $2', [publicUrl, insertedPlant.id]);
    insertedPlant.public_url = publicUrl;

    if (insertedPlant.nfc_uid) {
      await syncPlantNfcToInventory(pool, {
        nfcUid: insertedPlant.nfc_uid,
        farmId: insertedPlant.farm_id,
        plantId: insertedPlant.id,
        userId: req.user.id,
        lat: insertedPlant.latitude,
        lng: insertedPlant.longitude
      });
    }

    // Ghi nhận Audit Log
    await logAudit({
      actionType: 'CREATE_PLANT',
      tableName: 'plants',
      recordId: insertedPlant.id,
      userId: req.user.id,
      newData: insertedPlant,
      ipAddress: req.ip,
      notes: `Tạo mới cây #${insertedPlant.tree_code || insertedPlant.id}`
    });

    // Invalidate Cache & Broadcast WebSocket event
    await invalidateAndBroadcast('plants_updated', {
      plant_id: insertedPlant.id,
      farm_id: insertedPlant.farm_id,
      action: 'create'
    }, ['farms_', 'plants_']);

    res.status(201).json(insertedPlant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.put('/:id', auth, admin, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id, 10);
    const existingRes = await pool.query('SELECT * FROM plants WHERE id=$1', [plantId]);
    if (existingRes.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy.' });
    const oldPlant = existingRes.rows[0];

    const { plant_type, plant_variety, planting_date, plant_age, health_status, location, data, is_public, schema_id, farm_id, latitude, longitude, tree_code, nfc_uid } = req.body;
    
    // Nếu cây đã có public_slug thì giữ nguyên để tránh xung đột UNIQUE constraint
    // Chỉ tạo mới slug nếu cây chưa có slug
    const finalSlug = oldPlant.public_slug || (tree_code ? `${req.user.id}_${farm_id || 0}_${tree_code}` : generateSlug(plant_type));
    const parsedFarmId = farm_id !== undefined && farm_id !== null && farm_id !== '' ? parseInt(farm_id, 10) : null;
    const parsedSchemaId = schema_id !== undefined && schema_id !== null && schema_id !== '' ? parseInt(schema_id, 10) : null;
    const parsedLat = (latitude !== undefined && latitude !== null && latitude !== '') ? parseFloat(latitude) : null;
    const parsedLng = (longitude !== undefined && longitude !== null && longitude !== '') ? parseFloat(longitude) : null;
    const finalNfcUid = nfc_uid !== undefined ? formatStandardNfcUid(nfc_uid) : oldPlant.nfc_uid;

    const result = await pool.query(
      `UPDATE plants 
       SET plant_type=$1, plant_variety=$2, planting_date=$3, plant_age=$4, health_status=$5, location=$6, 
           data=$7, is_public=$8, schema_id=$9, farm_id=$10, latitude=$11, longitude=$12, tree_code=$13, 
           public_slug=$14, nfc_uid=$15, updated_at=NOW()
       WHERE id=$16 RETURNING *`,
      [plant_type, plant_variety, planting_date || null, plant_age, health_status, location,
       JSON.stringify(data || {}), is_public !== false, parsedSchemaId, parsedFarmId,
       (parsedLat !== null && !isNaN(parsedLat)) ? parsedLat : null,
       (parsedLng !== null && !isNaN(parsedLng)) ? parsedLng : null,
       tree_code || null,
       finalSlug,
       finalNfcUid,
       plantId]
    );

    const updatedPlant = result.rows[0];
    const publicUrl = generatePublicPlantUrl(updatedPlant.farm_id, updatedPlant.id, updatedPlant.nfc_uid);
    await pool.query('UPDATE plants SET public_url = $1 WHERE id = $2', [publicUrl, updatedPlant.id]);
    updatedPlant.public_url = publicUrl;

    if (updatedPlant.nfc_uid) {
      await syncPlantNfcToInventory(pool, {
        nfcUid: updatedPlant.nfc_uid,
        farmId: updatedPlant.farm_id,
        plantId: updatedPlant.id,
        userId: req.user.id,
        lat: updatedPlant.latitude,
        lng: updatedPlant.longitude
      });
    }

    // Ghi nhận Audit Log
    try {
      await logAudit({
        actionType: 'UPDATE_PLANT',
        tableName: 'plants',
        recordId: plantId,
        userId: req.user.id,
        oldData: oldPlant,
        newData: updatedPlant,
        ipAddress: req.ip,
        notes: `Cập nhật thông tin cây #${updatedPlant.tree_code || plantId}`
      });
    } catch(auditErr) {
      console.warn('Audit log warning:', auditErr.message);
    }

    // Invalidate Cache & Broadcast WebSocket event
    try {
      await invalidateAndBroadcast('plants_updated', {
        plant_id: updatedPlant.id,
        farm_id: updatedPlant.farm_id,
        action: 'update'
      }, ['farms_', 'plants_']);
    } catch(wsErr) {
      console.warn('Broadcast warning:', wsErr.message);
    }

    res.json(updatedPlant);
  } catch (err) {
    console.error('Error updating plant:', err);
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
});

// ─── Direct Plant GPS Update (accessible by farm owner, assigned user or admin) ───
router.put('/:id/gps', auth, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);
    const { latitude, longitude, location } = req.body;

    const plantRes = await pool.query(
      `SELECT p.id, p.farm_id, p.tree_code, p.created_by, p.assigned_to_user_id, f.user_id as farm_owner_id
       FROM plants p
       LEFT JOIN farms f ON f.id = p.farm_id
       WHERE p.id = $1`, [plantId]
    );
    if (plantRes.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy cây trồng.' });

    const plant = plantRes.rows[0];
    const isAssigned = (req.user.farm_id && plant.farm_id && req.user.farm_id === plant.farm_id)
      || (plant.assigned_to_user_id && plant.assigned_to_user_id === req.user.id)
      || (plant.created_by && plant.created_by === req.user.id);
    if (req.user.role !== 'admin' && plant.farm_owner_id !== req.user.id && !isAssigned) {
      return res.status(403).json({ error: 'Bạn không có quyền cập nhật tọa độ cây này.' });
    }

    const gpsNorm = normalizeGpsPayload(req.body);
    if (!gpsNorm.valid) {
      return res.status(400).json({ error: gpsNorm.error });
    }
    const {
      latitude: latVal,
      longitude: lngVal,
      gps_accuracy: accVal,
      gps_altitude: altVal,
      gps_captured_at: capturedAtVal,
      gps_srid: sridVal
    } = gpsNorm.data;

    let updateQuery;
    let updateParams;
    if (location !== undefined) {
      const locVal = (location !== null && location !== '') ? String(location).trim() : null;
      updateQuery = `UPDATE plants 
                     SET latitude = $1, longitude = $2, gps_accuracy = COALESCE($3, gps_accuracy),
                         gps_altitude = COALESCE($4, gps_altitude), gps_captured_at = COALESCE($5::timestamptz, gps_captured_at),
                         gps_srid = $6, location = $7, updated_at = NOW()
                     WHERE id = $8
                     RETURNING id, tree_code, public_slug, nfc_uid, public_url, farm_id, latitude, longitude, gps_accuracy, gps_altitude, gps_captured_at, gps_srid, location`;
      updateParams = [latVal, lngVal, accVal, altVal, capturedAtVal, sridVal, locVal, plantId];
    } else {
      updateQuery = `UPDATE plants 
                     SET latitude = $1, longitude = $2, gps_accuracy = COALESCE($3, gps_accuracy),
                         gps_altitude = COALESCE($4, gps_altitude), gps_captured_at = COALESCE($5::timestamptz, gps_captured_at),
                         gps_srid = $6, updated_at = NOW()
                     WHERE id = $7
                     RETURNING id, tree_code, public_slug, nfc_uid, public_url, farm_id, latitude, longitude, gps_accuracy, gps_altitude, gps_captured_at, gps_srid, location`;
      updateParams = [latVal, lngVal, accVal, altVal, capturedAtVal, sridVal, plantId];
    }

    const updated = await pool.query(updateQuery, updateParams);

    // Invalidate Cache & Broadcast WebSocket event
    await invalidateAndBroadcast('plants_updated', {
      plant_id: plantId,
      farm_id: updated.rows[0].farm_id || plant.farm_id,
      action: 'gps_updated'
    }, ['farms_', 'plants_']);

    let msg = 'Đã cập nhật vị trí cho cây thành công.';
    if (latVal !== null && lngVal !== null) {
      msg = `Đã lưu tọa độ GPS (${latVal.toFixed(6)}, ${lngVal.toFixed(6)}) cho cây #${plant.tree_code || plantId}`;
    } else if (location !== undefined && location) {
      msg = `Đã lưu vị trí "${location}" cho cây #${plant.tree_code || plantId}`;
    } else if (latVal === null && lngVal === null) {
      msg = `Đã xóa tọa độ GPS của cây #${plant.tree_code || plantId}`;
    }

    res.json({
      success: true,
      plant: updated.rows[0],
      message: msg
    });
  } catch (err) {
    console.error('GPS update error:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật GPS: ' + err.message });
  }
});

// ─── Reorder Tree Codes Automatically by GPS Coordinates ────────────────────
router.post('/farms/:farmId/reorder-by-gps', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const farmId = parseInt(req.params.farmId);
    if (isNaN(farmId)) {
      return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });
    }

    // Verify ownership / access
    const farmRes = await client.query('SELECT id, name, user_id FROM farms WHERE id = $1', [farmId]);
    if (farmRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }
    const farm = farmRes.rows[0];
    const isOwner = farm.user_id === req.user.id;
    const isAssigned = req.user.farm_id && Number(req.user.farm_id) === farmId;
    if (req.user.role !== 'admin' && !isOwner && !isAssigned) {
      return res.status(403).json({ error: 'Bạn không có quyền sắp xếp lại mã cây của trang trại này.' });
    }

    const {
      order_mode = 'north_to_south', // 'north_to_south' | 'by_columns' | 'snake' | 'by_rows'
      prefix = '',
      start_number = 1,
      pad_digits = 0, // 0 = no pad (1..75), 2 = (01..75), 3 = (001..075)
      dry_run = false
    } = req.body;

    const plantsRes = await client.query(
      `SELECT id, farm_id, tree_code, nfc_uid, public_slug, latitude, longitude, location, plant_type, created_by 
       FROM plants 
       WHERE farm_id = $1
       ORDER BY id ASC`,
      [farmId]
    );

    const allPlants = plantsRes.rows;
    if (allPlants.length === 0) {
      return res.status(400).json({ error: 'Trang trại này chưa có cây trồng nào.' });
    }

    // Split plants with GPS vs without GPS
    const gpsPlants = allPlants.filter(p => p.latitude != null && p.longitude != null && !isNaN(parseFloat(p.latitude)) && !isNaN(parseFloat(p.longitude)));
    const noGpsPlants = allPlants.filter(p => p.latitude == null || p.longitude == null || isNaN(parseFloat(p.latitude)) || isNaN(parseFloat(p.longitude)));

    if (gpsPlants.length === 0) {
      return res.status(400).json({ error: 'Chưa có cây nào được định vị GPS để có thể sắp xếp theo không gian địa lý.' });
    }

    // Calculate center & principal orientation angle (PCA)
    const N = gpsPlants.length;
    let meanLat = 0, meanLng = 0;
    gpsPlants.forEach(p => {
      meanLat += parseFloat(p.latitude);
      meanLng += parseFloat(p.longitude);
    });
    meanLat /= N;
    meanLng /= N;

    let cxx = 0, cyy = 0, cxy = 0;
    gpsPlants.forEach(p => {
      const dy = parseFloat(p.latitude) - meanLat;
      const dx = (parseFloat(p.longitude) - meanLng) * Math.cos(meanLat * Math.PI / 180);
      cxx += dx * dx;
      cyy += dy * dy;
      cxy += dx * dy;
    });

    // Principal angle theta
    let theta = 0.5 * Math.atan2(2 * cxy, cyy - cxx);

    // Project coordinates onto Length axis (u) and Width axis (v)
    gpsPlants.forEach(p => {
      const dy = parseFloat(p.latitude) - meanLat;
      const dx = (parseFloat(p.longitude) - meanLng) * Math.cos(meanLat * Math.PI / 180);
      
      const u = dy * Math.cos(theta) + dx * Math.sin(theta);
      const v = -dy * Math.sin(theta) + dx * Math.cos(theta);

      p._rawLat = parseFloat(p.latitude);
      p._rawLng = parseFloat(p.longitude);
      p._u = u;
      p._v = v;
    });

    // Determine orientation so u is aligned with North to South (highest = North/Top)
    let latCorr = 0;
    gpsPlants.forEach(p => {
      latCorr += p._u * (p._rawLat - meanLat);
    });
    if (latCorr < 0) {
      gpsPlants.forEach(p => { p._u = -p._u; });
    }

    // Determine orientation so v is aligned with West to East (lowest = West/Left)
    let lngCorr = 0;
    gpsPlants.forEach(p => {
      lngCorr += p._v * (p._rawLng - meanLng);
    });
    if (lngCorr < 0) {
      gpsPlants.forEach(p => { p._v = -p._v; });
    }

    // Sort according to order_mode:
    if (order_mode === 'by_columns') {
      const vVals = gpsPlants.map(p => p._v).sort((a,b) => a - b);
      const minV = vVals[0];
      const maxV = vVals[vVals.length - 1];
      const vRange = maxV - minV;

      gpsPlants.sort((a, b) => {
        const colA = a._v;
        const colB = b._v;
        if (Math.abs(colA - colB) > (vRange > 0 ? vRange * 0.25 : 0.00005)) {
          return colA - colB; // Left column first, then Right column
        }
        return b._u - a._u; // North to South within same column
      });
    } else if (order_mode === 'snake') {
      const uVals = gpsPlants.map(p => p._u).sort((a,b) => b - a);
      const uRange = uVals[0] - uVals[uVals.length - 1];
      const rowStep = uRange > 0 ? (uRange / (N > 10 ? Math.min(Math.floor(N / 2), 40) : N)) : 0.0001;

      const rows = [];
      const sortedByU = [...gpsPlants].sort((a, b) => b._u - a._u);
      sortedByU.forEach(p => {
        let placed = false;
        for (const r of rows) {
          if (Math.abs(r.meanU - p._u) <= rowStep * 0.8) {
            r.plants.push(p);
            r.meanU = r.plants.reduce((sum, item) => sum + item._u, 0) / r.plants.length;
            placed = true;
            break;
          }
        }
        if (!placed) {
          rows.push({ meanU: p._u, plants: [p] });
        }
      });

      rows.sort((a, b) => b.meanU - a.meanU);

      const snakeSorted = [];
      rows.forEach((r, idx) => {
        if (idx % 2 === 0) {
          r.plants.sort((a, b) => a._v - b._v); // Left to Right
        } else {
          r.plants.sort((a, b) => b._v - a._v); // Right to Left
        }
        snakeSorted.push(...r.plants);
      });
      gpsPlants.length = 0;
      gpsPlants.push(...snakeSorted);
    } else {
      // Default: 'north_to_south' (Top to Bottom, Left to Right within row pairs)
      const uVals = gpsPlants.map(p => p._u).sort((a,b) => b - a);
      const uRange = (uVals[0] || 0) - (uVals[uVals.length - 1] || 0);
      const rowBand = uRange > 0 ? (uRange / (N > 4 ? Math.max(Math.floor(N / 2.2), 1) : N)) * 0.7 : 0.00003;

      gpsPlants.sort((a, b) => {
        if (Math.abs(a._u - b._u) < rowBand) {
          return a._v - b._v; // Left before Right
        }
        return b._u - a._u; // North (Top) before South (Bottom)
      });
    }

    // Numbering generator
    const formatNumber = (num) => {
      const s = String(num);
      if (pad_digits > 0) {
        return s.padStart(pad_digits, '0');
      }
      return s;
    };

    const reorderedList = [];
    let currentNum = parseInt(start_number) || 1;

    for (const plant of gpsPlants) {
      const newCode = `${prefix}${formatNumber(currentNum)}`;
      reorderedList.push({
        id: plant.id,
        old_tree_code: plant.tree_code || String(plant.id),
        new_tree_code: newCode,
        nfc_uid: plant.nfc_uid,
        latitude: plant.latitude,
        longitude: plant.longitude,
        location: plant.location
      });
      currentNum++;
    }

    // If dry_run, return preview without modifying DB
    if (dry_run) {
      return res.json({
        success: true,
        dry_run: true,
        farm_id: farmId,
        farm_name: farm.name,
        total_plants: allPlants.length,
        reordered_count: reorderedList.length,
        no_gps_count: noGpsPlants.length,
        reordered_list: reorderedList
      });
    }

    // Execute batch update in transaction
    await client.query('BEGIN');

    for (const item of reorderedList) {
      const publicUrl = generatePublicPlantUrl(farmId, item.id, item.nfc_uid);
      await client.query(
        `UPDATE plants 
         SET tree_code = $1, public_url = $2, updated_at = NOW() 
         WHERE id = $3`,
        [item.new_tree_code, publicUrl, item.id]
      );
    }

    await client.query('COMMIT');

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('plants_updated', { farm_id: farmId, action: 'reorder_gps', count: reorderedList.length });
    }

    res.json({
      success: true,
      farm_id: farmId,
      farm_name: farm.name,
      total_plants: allPlants.length,
      reordered_count: reorderedList.length,
      no_gps_count: noGpsPlants.length,
      message: `✨ Đã sắp xếp lại mã số cho ${reorderedList.length} cây theo tọa độ GPS (${prefix}${formatNumber(start_number)} ➔ ${prefix}${formatNumber(start_number + reorderedList.length - 1)}) thành công!`,
      reordered_list: reorderedList
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Reorder trees by GPS error:', err);
    res.status(500).json({ error: 'Lỗi server khi sắp xếp lại mã cây: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── NFC Tag Assignment (accessible by farm owner or admin) ──────────────────

module.exports = router;
