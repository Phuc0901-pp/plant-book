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

router.get('/farms/:farmId/public-portal', async (req, res) => {
  try {
    const farmId = parseInt(req.params.farmId);
    if (isNaN(farmId)) {
      return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });
    }

    const farmRes = await pool.query(`
      SELECT f.id, f.name, f.description, f.address, f.puc_code, f.vietgap_cert_number, f.vietgap_cert_org,
             f.polygon_coordinates, f.latitude, f.longitude, f.user_id,
             u.full_name as owner_name, u.phone as owner_phone, u.email as owner_email
      FROM farms f
      LEFT JOIN users u ON u.id = f.user_id
      WHERE f.id = $1 AND (f.is_deleted IS NOT TRUE)
      LIMIT 1
    `, [farmId]);

    if (farmRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }

    const farm = farmRes.rows[0];

    const plantsRes = await pool.query(`
      SELECT p.id, p.tree_code, p.plant_type, p.plant_variety, p.health_status, p.location,
             p.latitude, p.longitude, p.nfc_uid, p.public_url, p.public_slug
      FROM plants p
      WHERE p.farm_id = $1 AND (p.deleted_at IS NULL)
      ORDER BY CAST(NULLIF(regexp_replace(p.tree_code, '\\D', '', 'g'), '') AS INTEGER) ASC NULLS LAST, p.tree_code ASC, p.id ASC
    `, [farmId]);

    const totalPlants = plantsRes.rows.length;
    const assignedCount = plantsRes.rows.filter(p => p.nfc_uid && p.nfc_uid.trim().length > 0).length;
    const unassignedCount = totalPlants - assignedCount;

    // Fetch farm supplies inventory and investment costs
    let supplies = [];
    let totalInvestment = 0;
    try {
      const suppliesRes = await pool.query(`
        SELECT s.id, s.name, s.category, s.package_size, s.package_qty, s.package_price, 
               s.unit_price, s.unit, s.stock_quantity, s.image_url, s.active_ingredient, 
               s.target_pests, s.phi_days, s.note,
               COALESCE(SUM(su.total_cost), 0) as total_spent,
               COALESCE(SUM(su.quantity), 0) as total_used_qty
        FROM supplies s
        LEFT JOIN supply_usages su ON su.supply_id = s.id AND su.farm_id = $1
        WHERE (
          s.farm_id = $1 
          OR s.user_id = $2 
          OR s.user_id IN (SELECT id FROM users WHERE farm_id = $1)
          OR s.id IN (SELECT supply_id FROM supply_usages WHERE farm_id = $1)
        )
        GROUP BY s.id
        ORDER BY s.category ASC, s.name ASC
      `, [farmId, farm.user_id]);
      supplies = suppliesRes.rows;
      totalInvestment = supplies.reduce((sum, s) => sum + parseFloat(s.total_spent || 0), 0);
    } catch(supErr) {
      console.warn('Error fetching farm supplies for portal:', supErr.message);
    }

    res.json({
      success: true,
      farm: {
        ...farm,
        total_plants: totalPlants,
        assigned_count: assignedCount,
        unassigned_count: unassignedCount,
        total_investment: totalInvestment,
        total_supplies_count: supplies.length
      },
      plants: plantsRes.rows,
      supplies: supplies
    });
  } catch (err) {
    console.error('Error loading public farm portal:', err);
    res.status(500).json({ error: 'Lỗi server khi tải thông tin trang trại: ' + err.message });
  }
});

// ─── Public Tag State Lookup by Farm & NFC UID: /public-by-farm-uid/:farmId/:nfcUid ───
router.get('/public-by-farm-uid/:farmId/:nfcUid', async (req, res) => {
  try {
    const farmId = parseInt(req.params.farmId);
    const nfcUidRaw = req.params.nfcUid ? req.params.nfcUid.trim() : '';
    const cleanUid = (nfcSecurity.sanitizeUid ? nfcSecurity.sanitizeUid(nfcUidRaw) : (nfcSecurity.normalizeNfcUid ? nfcSecurity.normalizeNfcUid(nfcUidRaw) : nfcUidRaw)) || nfcUidRaw.toUpperCase();
    const cleanRawUid = cleanUid.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    if (isNaN(farmId) || !cleanUid) {
      return res.status(400).json({ error: 'Nông trại hoặc mã thẻ NFC không hợp lệ.' });
    }

    // 1. Verify Farm exists
    const farmCheck = await pool.query(
      'SELECT id, name, address, puc_code, vietgap_cert_number, vietgap_cert_org, polygon_coordinates, user_id FROM farms WHERE id = $1 AND (is_deleted IS NOT TRUE)',
      [farmId]
    );
    if (farmCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Nông trại không tồn tại trên hệ thống.' });
    }
    const farm = farmCheck.rows[0];

    // 2. Check if a plant is assigned this NFC UID (any format, prioritizing current farm)
    const plantQuery = await pool.query(
      `SELECT p.*, 
              p.latitude,
              p.longitude,
              p.gps_accuracy,
              ps.name as schema_name, ps.fields as schema_fields,
              f.name as farm_name, f.address as farm_address, f.puc_code, f.vietgap_cert_number, f.vietgap_cert_org,
              f.polygon_coordinates as farm_polygon, f.user_id as farm_owner_user_id,
              u.full_name as owner_name, u.phone as owner_phone, u.email as owner_email
       FROM plants p 
       LEFT JOIN plant_schemas ps ON ps.id = p.schema_id
       LEFT JOIN farms f ON f.id = p.farm_id
       LEFT JOIN users u ON u.id = f.user_id
       WHERE (
         p.nfc_uid IS NOT NULL AND p.nfc_uid != '' AND (
           UPPER(p.nfc_uid) = UPPER($1) 
           OR UPPER(replace(replace(p.nfc_uid, ':', ''), '-', '')) = $2
           OR UPPER(regexp_replace(p.nfc_uid, '[^A-Za-z0-9]', '', 'g')) = $2
           OR UPPER(p.nfc_uid) = UPPER($3)
         )
       ) 
       AND (p.deleted_at IS NULL)
       ORDER BY (CASE WHEN p.farm_id = $4 THEN 1 ELSE 2 END) ASC, p.id DESC
       LIMIT 1`,
      [cleanUid, cleanRawUid, nfcUidRaw, farmId]
    );

    if (plantQuery.rows.length > 0) {
      const row = plantQuery.rows[0];
      const media = await pool.query('SELECT * FROM plant_media WHERE plant_id=$1 ORDER BY uploaded_at DESC', [row.id]);
      const logs = await pool.query('SELECT * FROM plant_logs WHERE plant_id=$1 AND (is_deleted IS NOT TRUE) ORDER BY log_date DESC', [row.id]);

      // Data Scrubbing
      const scrubbedLogs = logs.rows.map(log => {
        let safeDetails = {};
        if (log.details) {
          let rawDetails = typeof log.details === 'string' ? JSON.parse(log.details) : { ...log.details };
          delete rawDetails.unit_price;
          delete rawDetails.total_cost;
          delete rawDetails.cost;
          delete rawDetails.package_price;
          delete rawDetails.package_unit;
          delete rawDetails.formula_secret;
          delete rawDetails.supplier_price;
          delete rawDetails.vendor_name;
          delete rawDetails.vendor_phone;
          delete rawDetails.accounting_code;
          delete rawDetails.stock_deducted;
          safeDetails = rawDetails;
        }

        let parsedMediaUrls = [];
        if (log.media_urls) {
          if (Array.isArray(log.media_urls)) {
            parsedMediaUrls = log.media_urls;
          } else if (typeof log.media_urls === 'string') {
            try { parsedMediaUrls = JSON.parse(log.media_urls); } catch (_) { parsedMediaUrls = []; }
          }
        }
        if (parsedMediaUrls.length === 0 && log.media_url) {
          parsedMediaUrls = [{ url: log.media_url, type: /\.(mp4|mov|avi|mkv|webm)/i.test(log.media_url) ? 'video' : 'image' }];
        }

        return {
          id: log.id,
          plant_id: log.plant_id,
          log_date: log.log_date,
          log_type: log.log_type,
          note: log.note,
          details: safeDetails,
          media_url: log.media_url,
          media_urls: parsedMediaUrls,
          created_at: log.created_at
        };
      });

      let farm_boundary = null;
      if (row.farm_polygon) {
        try {
          let coords = typeof row.farm_polygon === 'string' ? JSON.parse(row.farm_polygon) : row.farm_polygon;
          if (Array.isArray(coords) && coords.length > 0) {
            const sanitizeRing = (ring) => ring.map(pt => {
              if (Array.isArray(pt) && pt.length >= 2) {
                let pLng = parseFloat(pt[0]);
                let pLat = parseFloat(pt[1]);
                if (Math.abs(pLat) > 90 && Math.abs(pLng) <= 90) {
                  const tmp = pLat; pLat = pLng; pLng = tmp;
                }
                return [pLng, pLat];
              }
              return pt;
            });
            if (Array.isArray(coords[0]) && !Array.isArray(coords[0][0])) {
              farm_boundary = { type: 'Polygon', coordinates: [sanitizeRing(coords)] };
            } else {
              farm_boundary = { type: 'Polygon', coordinates: coords.map(r => Array.isArray(r) ? sanitizeRing(r) : r) };
            }
          }
        } catch(e) {}
      }

      // Fetch supply usages, total care costs, and available farm supplies
      let supplyUsages = [];
      let totalCareCost = 0;
      let farmSupplies = [];

      try {
        const usagesRes = await pool.query(`
          SELECT su.id, su.supply_id, su.usage_date, su.usage_date as used_date, su.usage_date as log_date,
                 su.quantity, su.unit_price, su.total_cost, su.note, su.created_at,
                 s.name as supply_name, s.category as supply_category, s.unit as supply_unit, s.image_url as supply_image_url,
                 COALESCE(NULLIF(TRIM(pl.operator_name), ''), NULLIF(TRIM(usr.full_name), ''), 'Chủ trang trại') as operator_name,
                 pl.equipment_used
          FROM supply_usages su
          LEFT JOIN supplies s ON s.id = su.supply_id
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
          ORDER BY su.usage_date DESC, su.id DESC
        `, [row.id]);
        supplyUsages = usagesRes.rows;
        totalCareCost = supplyUsages.reduce((sum, u) => sum + parseFloat(u.total_cost || 0), 0);
      } catch (usageErr) {
        console.warn('Lỗi query supply_usages LATERAL (NFC), dùng fallback:', usageErr.message);
        try {
          const fbRes = await pool.query(`
            SELECT su.*, su.usage_date as used_date, su.usage_date as log_date,
                   s.name as supply_name, s.category as supply_category, s.unit as supply_unit, s.image_url as supply_image_url
            FROM supply_usages su
            LEFT JOIN supplies s ON s.id = su.supply_id
            WHERE su.plant_id = $1
            ORDER BY su.usage_date DESC, su.id DESC
          `, [row.id]);
          supplyUsages = fbRes.rows;
          totalCareCost = supplyUsages.reduce((sum, u) => sum + parseFloat(u.total_cost || 0), 0);
        } catch (_) {}
      }

      // Enrich operator_name & equipment_used from logs if needed
      if (logs && logs.rows) {
        supplyUsages.forEach(u => {
          if (!u.operator_name || u.operator_name === 'Chủ trang trại') {
            const uDateStr = u.usage_date ? new Date(u.usage_date).toISOString().slice(0, 10) : '';
            const matched = logs.rows.find(l => {
              const lDateStr = l.log_date ? new Date(l.log_date).toISOString().slice(0, 10) : '';
              return lDateStr === uDateStr;
            });
            if (matched) {
              if (matched.operator_name) u.operator_name = matched.operator_name;
              if (matched.equipment_used && !u.equipment_used) u.equipment_used = matched.equipment_used;
            }
          }
        });
      }

      try {
        const farmSuppliesRes = await pool.query(`
          SELECT s.id, s.name, s.category, s.package_size, s.package_qty, s.package_price, 
                 s.unit_price, s.unit, s.stock_quantity, s.image_url, s.active_ingredient, 
                 s.target_pests, s.phi_days, s.note
          FROM supplies s
          WHERE (
            ($2::int IS NOT NULL AND (
              s.farm_id = $2 
              OR (s.user_id = $1 AND s.farm_id IS NULL AND $1 != 1)
              OR s.id IN (SELECT supply_id FROM supply_usages WHERE plant_id = $3)
            ))
            OR ($2::int IS NULL AND (
              (s.user_id = $1 AND ($1 != 1 OR $3 IS NOT NULL))
              OR s.id IN (SELECT supply_id FROM supply_usages WHERE plant_id = $3)
            ))
          )
          ORDER BY s.category ASC, s.name ASC
        `, [row.farm_owner_user_id || farm.user_id, farmId || row.farm_id, row.id]);
        farmSupplies = farmSuppliesRes.rows;
      } catch (farmErr) {
        console.warn('Lỗi tải danh mục vật tư kho (NFC):', farmErr.message);
      }

      return res.json({
        assigned: true,
        in_inventory: true,
        farm_id: farmId,
        nfc_uid: cleanUid,
        plant: { 
          ...row, 
          media: media.rows, 
          logs: scrubbedLogs, 
          farm_boundary,
          supply_usages: supplyUsages,
          total_cost: totalCareCost,
          farm_supplies: farmSupplies
        }
      });
    }

    // 3. Not assigned to any plant in this farm -> check inventory status
    const invCheck = await pool.query(
      `SELECT id, farm_id, status, plant_id 
       FROM nfc_tags_inventory 
       WHERE (UPPER(nfc_uid) = UPPER($1) OR UPPER(regexp_replace(COALESCE(nfc_uid, ''), '[^A-Za-z0-9]', '', 'g')) = $2)`,
      [cleanUid, cleanRawUid]
    );

    if (invCheck.rows.length === 0) {
      // Uninventoried tag: allow seamless field binding for farm staff/admin
      return res.json({
        assigned: false,
        in_inventory: true,
        is_new_tag: true,
        farm_id: farmId,
        farm_name: farm.name,
        puc_code: farm.puc_code,
        nfc_uid: cleanUid
      });
    }

    const invItem = invCheck.rows[0];

    if (invItem.farm_id && Number(invItem.farm_id) !== Number(farmId)) {
      return res.json({
        assigned: false,
        in_inventory: false,
        wrong_farm: true,
        tag_farm_id: invItem.farm_id,
        farm_id: farmId,
        farm_name: farm.name,
        puc_code: farm.puc_code,
        nfc_uid: cleanUid,
        inventory_warning: `Thẻ NFC [${cleanUid}] thuộc kho của Trang trại #${invItem.farm_id}, không thể sử dụng tại Trang trại #${farmId}.`
      });
    }

    if (invItem.status === 'revoked') {
      return res.status(410).json({
        assigned: false,
        is_revoked: true,
        farm_id: farmId,
        nfc_uid: cleanUid,
        error: `Thẻ NFC [${cleanUid}] này đã bị thu hồi / khóa bảo mật. Không thể gán thẻ này vào cây.`
      });
    }

    // Return unassigned valid inventory response for on-site binding
    return res.json({
      assigned: false,
      in_inventory: true,
      farm_id: farmId,
      farm_name: farm.name,
      puc_code: farm.puc_code,
      nfc_uid: cleanUid
    });
  } catch (err) {
    console.error('Error lookup plant by farm and NFC UID:', err);
    res.status(500).json({ error: 'Lỗi server khi tra cứu thẻ NFC: ' + err.message });
  }
});

// ─── Public routes ────────────────────────────────────────────────
router.get('/public/:slug', async (req, res) => {
  try {
    const slugParam = req.params.slug.trim();
    const plant = await pool.query(
      `SELECT p.*, 
              p.latitude,
              p.longitude,
              ps.name as schema_name, ps.fields as schema_fields,
              f.name as farm_name, f.address as farm_address, f.puc_code, f.vietgap_cert_number, f.vietgap_cert_org,
              f.polygon_coordinates as farm_polygon, f.user_id as farm_owner_user_id,
              u.full_name as owner_name, u.phone as owner_phone, u.email as owner_email
       FROM plants p 
       LEFT JOIN plant_schemas ps ON ps.id = p.schema_id
       LEFT JOIN farms f ON f.id = p.farm_id
       LEFT JOIN users u ON u.id = f.user_id
       WHERE (p.public_slug=$1 OR p.id::text=$1 OR UPPER(p.nfc_uid)=UPPER($1)) AND p.is_public=true`, [slugParam]
    );
    if (plant.rows.length === 0) {
      // Check if this slugParam was an unassigned or revoked NFC tag in inventory
      const invRevoked = await pool.query(
        'SELECT nfc_uid, status, plant_id FROM nfc_tags_inventory WHERE UPPER(nfc_uid) = UPPER($1)',
        [slugParam]
      );
      if (invRevoked.rows.length > 0) {
        return res.status(410).json({
          error: `Thẻ NFC [${slugParam}] này đã bị thu hồi hoặc thay thế. Đường dẫn công khai cũ đã bị đóng băng truy cập.`,
          is_revoked: true,
          nfc_uid: slugParam
        });
      }
      return res.status(404).json({ error: 'Trang cây không tồn tại hoặc chưa công khai.' });
    }

    const media = await pool.query('SELECT * FROM plant_media WHERE plant_id=$1 ORDER BY uploaded_at DESC', [plant.rows[0].id]);
    const logs = await pool.query('SELECT * FROM plant_logs WHERE plant_id=$1 AND (is_deleted IS NOT TRUE) ORDER BY log_date DESC', [plant.rows[0].id]);

    // Data Scrubbing: Remove confidential financial and proprietary formula data
    const scrubbedLogs = logs.rows.map(log => {
      let safeDetails = {};
      if (log.details) {
        let rawDetails = typeof log.details === 'string' ? JSON.parse(log.details) : { ...log.details };
        delete rawDetails.unit_price;
        delete rawDetails.total_cost;
        delete rawDetails.cost;
        delete rawDetails.package_price;
        delete rawDetails.package_unit;
        delete rawDetails.formula_secret;
        delete rawDetails.supplier_price;
        delete rawDetails.vendor_name;
        delete rawDetails.vendor_phone;
        delete rawDetails.accounting_code;
        delete rawDetails.stock_deducted;
        safeDetails = rawDetails;
      }

      let parsedMediaUrls = [];
      if (log.media_urls) {
        if (Array.isArray(log.media_urls)) {
          parsedMediaUrls = log.media_urls;
        } else if (typeof log.media_urls === 'string') {
          try { parsedMediaUrls = JSON.parse(log.media_urls); } catch (_) { parsedMediaUrls = []; }
        }
      }
      if (parsedMediaUrls.length === 0 && log.media_url) {
        parsedMediaUrls = [{ url: log.media_url, type: /\.(mp4|mov|avi|mkv|webm)/i.test(log.media_url) ? 'video' : 'image' }];
      }

      return {
        id: log.id,
        plant_id: log.plant_id,
        log_date: log.log_date,
        log_type: log.log_type,
        note: log.note,
        details: safeDetails,
        media_url: log.media_url,
        media_urls: parsedMediaUrls,
        created_at: log.created_at
      };
    });

    // Build GeoJSON geometry for the farm boundary polygon
    const row = plant.rows[0];

    // Tự động kiểm tra và hoán đổi tọa độ nếu latitude > 90 (bị lưu ngược)
    let plantLat = parseFloat(row.latitude);
    let plantLng = parseFloat(row.longitude);
    if (!isNaN(plantLat) && !isNaN(plantLng)) {
      if (Math.abs(plantLat) > 90 && Math.abs(plantLng) <= 90) {
        const tmp = plantLat;
        plantLat = plantLng;
        plantLng = tmp;
      }
      row.latitude = plantLat;
      row.longitude = plantLng;
    }

    let farm_boundary = null;
    if (row.farm_polygon) {
      try {
        let coords = typeof row.farm_polygon === 'string' ? JSON.parse(row.farm_polygon) : row.farm_polygon;
        if (Array.isArray(coords) && coords.length > 0) {
          // Chuẩn hóa tọa độ [lng, lat] cho từng điểm polygon
          const sanitizeRing = (ring) => {
            return ring.map(pt => {
              if (Array.isArray(pt) && pt.length >= 2) {
                let pLng = parseFloat(pt[0]);
                let pLat = parseFloat(pt[1]);
                if (Math.abs(pLat) > 90 && Math.abs(pLng) <= 90) {
                  const tmp = pLat; pLat = pLng; pLng = tmp;
                }
                return [pLng, pLat];
              }
              return pt;
            });
          };

          // If coords is 2D [[lng, lat], ...], wrap it in an outer array to make it a valid GeoJSON Polygon coordinates array
          if (Array.isArray(coords[0]) && !Array.isArray(coords[0][0])) {
            farm_boundary = { type: 'Polygon', coordinates: [sanitizeRing(coords)] };
          } else {
            farm_boundary = { type: 'Polygon', coordinates: coords.map(r => Array.isArray(r) ? sanitizeRing(r) : r) };
          }
        }
      } catch(e) { /* ignore parse errors */ }
    }

    // Fetch supply usages, total care costs, and available farm supplies
    let supplyUsages = [];
    let totalCareCost = 0;
    let farmSupplies = [];

    try {
      const usagesRes = await pool.query(`
        SELECT su.id, su.supply_id, su.usage_date, su.usage_date as used_date, su.usage_date as log_date,
               su.quantity, su.unit_price, su.total_cost, su.note, su.created_at,
               s.name as supply_name, s.category as supply_category, s.unit as supply_unit, s.image_url as supply_image_url,
               COALESCE(NULLIF(TRIM(pl.operator_name), ''), NULLIF(TRIM(usr.full_name), ''), 'Chủ trang trại') as operator_name,
               pl.equipment_used
        FROM supply_usages su
        LEFT JOIN supplies s ON s.id = su.supply_id
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
        ORDER BY su.usage_date DESC, su.id DESC
      `, [row.id]);
      supplyUsages = usagesRes.rows;
      totalCareCost = supplyUsages.reduce((sum, u) => sum + parseFloat(u.total_cost || 0), 0);
    } catch (usageErr) {
      console.warn('Lỗi query supply_usages LATERAL (Public), dùng fallback:', usageErr.message);
      try {
        const fbRes = await pool.query(`
          SELECT su.*, su.usage_date as used_date, su.usage_date as log_date,
                 s.name as supply_name, s.category as supply_category, s.unit as supply_unit, s.image_url as supply_image_url
          FROM supply_usages su
          LEFT JOIN supplies s ON s.id = su.supply_id
          WHERE su.plant_id = $1
          ORDER BY su.usage_date DESC, su.id DESC
        `, [row.id]);
        supplyUsages = fbRes.rows;
        totalCareCost = supplyUsages.reduce((sum, u) => sum + parseFloat(u.total_cost || 0), 0);
      } catch (_) {}
    }

    // Enrich operator_name & equipment_used from logs if needed
    if (logs && logs.rows) {
      supplyUsages.forEach(u => {
        if (!u.operator_name || u.operator_name === 'Chủ trang trại') {
          const uDateStr = u.usage_date ? new Date(u.usage_date).toISOString().slice(0, 10) : '';
          const matched = logs.rows.find(l => {
            const lDateStr = l.log_date ? new Date(l.log_date).toISOString().slice(0, 10) : '';
            return lDateStr === uDateStr;
          });
          if (matched) {
            if (matched.operator_name) u.operator_name = matched.operator_name;
            if (matched.equipment_used && !u.equipment_used) u.equipment_used = matched.equipment_used;
          }
        }
      });
    }

    try {
      const farmSuppliesRes = await pool.query(`
        SELECT s.id, s.name, s.category, s.package_size, s.package_qty, s.package_price, 
               s.unit_price, s.unit, s.stock_quantity, s.image_url, s.active_ingredient, 
               s.target_pests, s.phi_days, s.note
        FROM supplies s
        WHERE (
          ($2::int IS NOT NULL AND (
            s.farm_id = $2 
            OR (s.user_id = $1 AND s.farm_id IS NULL AND $1 != 1)
            OR s.id IN (SELECT supply_id FROM supply_usages WHERE plant_id = $3)
          ))
          OR ($2::int IS NULL AND (
            (s.user_id = $1 AND ($1 != 1 OR $3 IS NOT NULL))
            OR s.id IN (SELECT supply_id FROM supply_usages WHERE plant_id = $3)
          ))
        )
        ORDER BY s.category ASC, s.name ASC
      `, [row.farm_owner_user_id || row.created_by, row.farm_id, row.id]);
      farmSupplies = farmSuppliesRes.rows;
    } catch (farmErr) {
      console.warn('Lỗi tải danh mục vật tư kho (Public):', farmErr.message);
    }

    res.json({ 
      ...row, 
      media: media.rows, 
      logs: scrubbedLogs, 
      farm_boundary,
      supply_usages: supplyUsages,
      total_cost: totalCareCost,
      farm_supplies: farmSupplies
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// Helper: Validate Full NFC UID (at least 4 hex pairs separated by : or - OR continuous hex string of 8-20 chars)

router.patch('/public/:slug/health', async (req, res) => {
  try {
    const { health_status } = req.body;
    if (!['Tốt', 'Bình thường', 'Cần chú ý', 'Bệnh'].includes(health_status)) {
      return res.status(400).json({ error: 'Trạng thái sức khỏe không hợp lệ.' });
    }
    const slugParam = req.params.slug.trim();

    // 1. Find plant
    const plantFind = await pool.query(
      `SELECT id FROM plants WHERE (public_slug = $1 OR id::text = $1 OR UPPER(nfc_uid) = UPPER($1)) LIMIT 1`,
      [slugParam]
    );
    if (plantFind.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ cây trồng.' });
    }
    const plantId = plantFind.rows[0].id;

    // 2. Strict farm permission check
    const access = await verifyPlantAccess(req, plantId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const result = await pool.query(
      `UPDATE plants SET health_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [health_status, plantId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update health error:', err);
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
});

// ─── Update plant GPS location publicly via Full NFC Tag Scan ─────────────
router.all('/public/:slug/gps', async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Phương thức không được hỗ trợ.' });
  }

  try {
    const { latitude, longitude, nfc_uid } = req.body;
    const targetParam = req.params.slug ? req.params.slug.trim() : '';
    const activeNfcUid = nfc_uid || targetParam;

    // Strict validation: Only allow automatic GPS update if opened via valid Full NFC UID
    if (!isFullNfcUid(activeNfcUid)) {
      return res.status(400).json({ 
        error: 'Chỉ cho phép tự động cập nhật vị trí GPS khi quét bằng thẻ NFC hợp lệ (Full NFC UID).' 
      });
    }

    let lat = parseFloat(latitude);
    let lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Tọa độ GPS không hợp lệ.' });
    }

    // Auto-swap if latitude and longitude were reversed
    if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
      const tmp = lat;
      lat = lng;
      lng = tmp;
    }

    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ error: 'Tọa độ GPS nằm ngoài phạm vi cho phép.' });
    }

    // Find target plant by slug, ID, or NFC UID
    const plantRes = await pool.query(
      `SELECT id, tree_code, plant_type, plant_variety, farm_id, nfc_uid, latitude, longitude 
       FROM plants 
       WHERE (id::text = $1 OR public_slug = $1 OR UPPER(nfc_uid) = UPPER($1) OR UPPER(nfc_uid) = UPPER($2))
       LIMIT 1`,
      [targetParam, activeNfcUid]
    );

    if (plantRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ cây trồng.' });
    }

    const currentPlant = plantRes.rows[0];
    const cleanNfcUid = activeNfcUid || currentPlant.nfc_uid || '';
    const publicUrl = generatePublicPlantUrl(currentPlant.farm_id, currentPlant.id, cleanNfcUid);

    // Update GPS coordinates and public_url in database
    const updateRes = await pool.query(
      `UPDATE plants 
       SET latitude = $1, longitude = $2, public_url = $3, updated_at = NOW() 
       WHERE id = $4 
       RETURNING id, tree_code, plant_type, plant_variety, farm_id, nfc_uid, latitude, longitude, public_url, updated_at`,
      [lat, lng, publicUrl, currentPlant.id]
    );

    const updated = updateRes.rows[0];

    // Broadcast update via WebSocket to Admin & User portals
    if (global.broadcastWS) {
      global.broadcastWS('plants_updated', {
        plant_id: updated.id,
        farm_id: updated.farm_id,
        latitude: updated.latitude,
        longitude: updated.longitude,
        action: 'nfc_gps_sync'
      });
    }

    res.json({
      success: true,
      message: `Đã cập nhật vị trí GPS (${lat.toFixed(6)}, ${lng.toFixed(6)}) cho cây #${updated.tree_code || updated.id}`,
      plant: updated,
      public_url: publicUrl
    });
  } catch (err) {
    console.error('Error updating plant GPS via NFC:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật GPS: ' + err.message });
  }
});


// Submit care log (Requires login from the same farm or Admin)
router.post('/public/:slug/logs', upload.array('files', 12), async (req, res) => {
  try {
    const slugParam = req.params.slug.trim();
    const cleanRawUid = slugParam.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    // Find plant ID by slug, ID, or NFC UID
    const plantResult = await pool.query(
      `SELECT id, farm_id FROM plants 
       WHERE (
         public_slug = $1 
         OR id::text = $1 
         OR UPPER(nfc_uid) = UPPER($1)
         OR UPPER(regexp_replace(COALESCE(nfc_uid, ''), '[^A-Za-z0-9]', '', 'g')) = $2
       ) 
       AND (deleted_at IS NULL)
       LIMIT 1`,
      [slugParam, cleanRawUid]
    );
    if (plantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trang cây không tồn tại hoặc đã bị xóa.' });
    }
    const plantId = plantResult.rows[0].id;

    // Strict farm authentication check
    const access = await verifyPlantAccess(req, plantId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    // Support both JSON body (no files) and multipart/form-data (with files)
    const log_type = req.body.log_type;
    const note = req.body.note || '';
    const log_date = req.body.log_date || new Date().toISOString().slice(0, 10);
    const operator_name = req.body.operator_name || (req.body.details && typeof req.body.details === 'object' ? req.body.details.operator_name : null) || access.user.full_name || access.user.email;
    const equipment_used = req.body.equipment_used || (req.body.details && typeof req.body.details === 'object' ? req.body.details.equipment_used : null) || null;

    // details can be a JSON string (multipart) or object (json body)
    let details = {};
    if (req.body.details) {
      try {
        details = typeof req.body.details === 'string' ? JSON.parse(req.body.details) : req.body.details;
      } catch (e) { details = {}; }
    }

    if (operator_name && !details.operator_name) details.operator_name = operator_name;
    if (equipment_used && !details.equipment_used) details.equipment_used = equipment_used;

    // Upload files to Supabase if any
    const uploadedMediaUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const ext = path.extname(file.originalname).toLowerCase();
        const objectName = `plants/${plantId}/disease/${uuidv4()}${ext}`;
        const publicUrl = await uploadFile(objectName, file.buffer, file.mimetype);
        const mediaType = file.mimetype.startsWith('video') ? 'video' : 'image';

        // Save to plant_media table (appears in plant gallery)
        await pool.query(
          'INSERT INTO plant_media (plant_id, object_name, url, media_type, caption) VALUES ($1,$2,$3,$4,$5)',
          [plantId, objectName, publicUrl, mediaType, `Bệnh cây - ${log_date}`]
        );

        uploadedMediaUrls.push({ url: publicUrl, type: mediaType });
      }
    }

    // Handle media_urls from JSON body (non-multipart requests)
    let existingMediaUrls = [];
    if (req.body.media_urls) {
      try {
        existingMediaUrls = typeof req.body.media_urls === 'string'
          ? JSON.parse(req.body.media_urls)
          : (req.body.media_urls || []);
      } catch (e) { existingMediaUrls = []; }
    }

    const allMediaUrls = [...existingMediaUrls, ...uploadedMediaUrls];

    // PHI Quarantine & Pesticide Notice
    if (log_type === 'Phun thuốc') {
      let phiDays = parseInt(details.phi_days) || 0;
      const pesticideName = details.name || details.pesticide_name || note || 'Thuốc BVTV';

      if (phiDays <= 0 && pesticideName) {
        const supLookup = await pool.query(
          `SELECT phi_days FROM supplies WHERE category = 'Phun thuốc' AND (name ILIKE $1 OR $2 ILIKE '%' || name || '%') AND phi_days > 0 LIMIT 1`,
          [pesticideName.trim(), pesticideName.trim()]
        );
        if (supLookup.rows.length > 0) phiDays = supLookup.rows[0].phi_days;
      }

      if (phiDays > 0) {
        details.phi_days = phiDays;
        const sprayDateObj = new Date(log_date);
        sprayDateObj.setDate(sprayDateObj.getDate() + phiDays);
        const phiUntilDateStr = sprayDateObj.toISOString().slice(0, 10);
        details.phi_until_date = phiUntilDateStr;

        await pool.query(
          `UPDATE plants 
           SET phi_until_date = $1, phi_status = 'quarantine', last_pesticide_date = $2, last_pesticide_name = $3, updated_at = NOW() 
           WHERE id = $4`,
          [phiUntilDateStr, log_date, pesticideName, plantId]
        );
      }
    }

    // Harvest batch code
    let generatedBatchCode = null;
    let farmPuc = access.plant?.puc_code || 'VN-TB';
    if (log_type === 'Thu hoạch') {
      const dateClean = log_date.replace(/-/g, '');
      const codeClean = (access.plant?.tree_code || plantId).replace(/[^a-zA-Z0-9]/g, '');
      generatedBatchCode = `${farmPuc}-${dateClean}-${codeClean}`;
      details.batch_code = generatedBatchCode;
      details.puc_code = farmPuc;
    }

    const result = await pool.query(
      `INSERT INTO plant_logs (plant_id, log_date, log_type, note, media_urls, details, created_by, operator_name, equipment_used, batch_code, puc_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [plantId, log_date, log_type, note,
       JSON.stringify(allMediaUrls), JSON.stringify(details), access.user.id, operator_name, equipment_used, generatedBatchCode, farmPuc]
    );
    await sealPlantLogHashChain(pool, result.rows[0]);

    // Update health status if disease
    if (log_type === 'Bệnh cây') {
      await pool.query(`UPDATE plants SET health_status = 'Bệnh', updated_at = NOW() WHERE id = $1`, [plantId]);
    }

    // Auto-record supply usage and stock deduction
    try {
      let resolvedSupplyId = details.supply_id || null;
      const rawAmount = parseFloat(details.quantity || details.volume || details.amount || 0);
      const rawUnit = (details.unit || '').toLowerCase().trim();
      const supplyName = details.supply_name || details.fertilizer_name || details.pesticide_name || null;

      if (!resolvedSupplyId && supplyName) {
        const foundSup = await pool.query(
          `SELECT id, unit, unit_price FROM supplies WHERE (farm_id = $1 OR 1=1) AND (name ILIKE $2 OR $2 ILIKE '%' || name || '%') LIMIT 1`,
          [access.plant?.farm_id || null, supplyName]
        );
        if (foundSup.rows.length > 0) {
          resolvedSupplyId = foundSup.rows[0].id;
        }
      }

      if (resolvedSupplyId && rawAmount > 0) {
        const supInfo = await pool.query('SELECT * FROM supplies WHERE id = $1', [resolvedSupplyId]);
        if (supInfo.rows.length > 0) {
          const sup = supInfo.rows[0];
          const supUnit = (sup.unit || 'kg').toLowerCase().trim();
          const usageQty = convertLogAmountToBaseSupplyQty(rawAmount, rawUnit, supUnit, log_type);
          const uPrice = parseFloat(sup.unit_price) || 0;
          const totCost = parseFloat(details.total_cost) || (usageQty * uPrice);

          await pool.query(
            `INSERT INTO supply_usages (user_id, supply_id, farm_id, plant_id, usage_date, quantity, unit_price, total_cost, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [access.user.id, sup.id, access.plant?.farm_id || null, plantId, log_date, usageQty, uPrice, totCost, `Tự động từ nhật ký [${log_type}] tại vườn (${rawAmount} ${rawUnit || sup.unit})`]
          );

          if (sup.category !== 'Tiền nước' && sup.category !== 'Nhân công' && sup.stock_quantity > 0) {
            await pool.query('UPDATE supplies SET stock_quantity = GREATEST(0, stock_quantity - $1), updated_at = NOW() WHERE id = $2', [usageQty, sup.id]);
          }
        }
      }
    } catch (supErr) {
      console.warn('Cảnh báo ghi nhận tiêu hao vật tư từ nhật ký công khai:', supErr.message);
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting public log:', err);
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
});

// ─── VietGAP / GlobalGAP Cultivation Log Report Export ────────────
router.get('/:id(\\d+)/export-vietgap', async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);
    const plantRes = await pool.query(
      `SELECT p.*, f.name as farm_name, f.location as farm_address, u.full_name as owner_name, u.phone as owner_phone
       FROM plants p
       LEFT JOIN farms f ON f.id = p.farm_id
       LEFT JOIN users u ON u.id = f.user_id
       WHERE p.id = $1`, [plantId]
    );

    if (plantRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy cây trồng.' });
    }

    const plant = plantRes.rows[0];
    const logsRes = await pool.query(
      `SELECT * FROM plant_logs WHERE plant_id = $1 ORDER BY log_date ASC`, [plantId]
    );

    res.json({
      title: 'BÁO CÁO NHẬT KÝ CANH TÁC CHUẨN VIETGAP / GLOBALGAP',
      generated_at: new Date().toISOString(),
      plant_info: {
        tree_code: plant.tree_code || plant.id,
        plant_type: plant.plant_type,
        plant_variety: plant.plant_variety,
        farm_name: plant.farm_name,
        farm_address: plant.farm_address,
        owner_name: plant.owner_name,
        owner_phone: plant.owner_phone,
        nfc_uid: plant.nfc_uid,
        public_url: generatePublicPlantUrl(plant.farm_id, plant.id, plant.nfc_uid)
      },
      total_logs: logsRes.rows.length,
      logs: logsRes.rows
    });
  } catch (err) {
    console.error('VietGAP export error:', err);
    res.status(500).json({ error: 'Lỗi xuất báo cáo VietGAP: ' + err.message });
  }
});

// ─── QR Traceability Metadata API ───────────────────────────────
router.get('/:id(\\d+)/qr-traceability', async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);
    const plantRes = await pool.query(
      `SELECT p.id, p.tree_code, p.plant_type, p.plant_variety, p.health_status, p.nfc_uid, p.farm_id, f.user_id as owner_id, f.name as farm_name
       FROM plants p
       LEFT JOIN farms f ON f.id = p.farm_id
       WHERE p.id = $1`, [plantId]
    );

    if (plantRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin.' });
    }

    const plant = plantRes.rows[0];
    const traceUrl = `https://plant-book.onrender.com/${plant.owner_id || 0}/${plant.farm_id || 0}/${plant.id}/${encodeURIComponent(plant.nfc_uid || '')}`;

    res.json({
      success: true,
      tree_code: plant.tree_code,
      plant_type: plant.plant_type,
      plant_variety: plant.plant_variety,
      farm_name: plant.farm_name,
      traceability_url: traceUrl,
      qr_image_api: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(traceUrl)}`
    });
  } catch (err) {
    console.error('QR Traceability error:', err);
    res.status(500).json({ error: 'Lỗi tạo QR: ' + err.message });
  }
});

// ─── Gallagher 8.30 FTCard.IssueLevel Anti-Cloning Re-issue Endpoint ──

module.exports = router;
