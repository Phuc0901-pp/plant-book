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

router.get(['/farms/:farmId/tags', '/farm/:farmId/tags', '/nfc/farm/:farmId/tags'], auth, async (req, res) => {
  try {
    const farmId = parseInt(req.params.farmId, 10);
    if (isNaN(farmId)) return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });
    await reconcileFarmNfcInventory(pool, farmId);
    const items = await pool.query(
      `SELECT n.*, p.tree_code, p.plant_type, p.plant_variety, p.health_status, p.location, p.latitude, p.longitude, p.public_url, p.data as plant_data
       FROM nfc_tags_inventory n
       LEFT JOIN plants p ON (n.plant_id = p.id AND p.deleted_at IS NULL)
       WHERE n.farm_id = $1 OR p.farm_id = $1
       ORDER BY n.id DESC`,
      [farmId]
    );
    res.json({ success: true, tags: items.rows, items: items.rows });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server khi tải danh sách thẻ NFC: ' + err.message });
  }
});


router.put('/:id/nfc', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const plantId = parseInt(req.params.id);
    const { nfc_uid } = req.body; // string UID or null to deactivate

    // 1. Verify the requesting user owns this plant (or is admin or assigned farmer)
    const plantRes = await client.query(
      `SELECT p.id, p.nfc_uid, p.public_slug, p.tree_code, p.created_by, p.assigned_to_user_id, p.farm_id, f.user_id as farm_owner_id
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
      return res.status(403).json({ error: 'Bạn không có quyền thay đổi định danh thẻ của cây này.' });
    }

    const cleanUid = formatStandardNfcUid(nfc_uid);
    const cleanRawUid = cleanUid ? cleanUid.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : null;
    const { latitude, longitude } = req.body;

    await client.query('BEGIN');

    // 2. If assigning a new UID:
    if (cleanUid) {
      // 2a. Check if this UID is already assigned to ANOTHER plant
      const plantConflict = await client.query(
        `SELECT id, tree_code FROM plants
         WHERE (UPPER(TRIM(nfc_uid)) = UPPER($1) OR UPPER(regexp_replace(COALESCE(nfc_uid, ''), '[^A-Za-z0-9]', '', 'g')) = $2)
           AND id != $3
           AND deleted_at IS NULL`,
        [cleanUid, cleanRawUid, plantId]
      );
      if (plantConflict.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Mã thẻ ${cleanUid} đã được gắn cho cây #${plantConflict.rows[0].tree_code || plantConflict.rows[0].id}. Mỗi thẻ chỉ gắn cho 1 cây duy nhất.`
        });
      }

      // 2b. If replacing an existing tag on this plant, unassign old tag in inventory
      if (plant.nfc_uid && formatStandardNfcUid(plant.nfc_uid) !== cleanUid) {
        await client.query(
          `UPDATE nfc_tags_inventory
           SET status = 'unassigned', plant_id = NULL, tagged_at = NULL
           WHERE (UPPER(TRIM(nfc_uid)) = UPPER($1) OR plant_id = $2)`,
          [plant.nfc_uid.trim(), plantId]
        );
      }

      // 2c. Update target plant with new UID, GPS (if provided) & 3-segment public URL
      const publicUrl = generatePublicPlantUrl(plant.farm_id, plantId, cleanUid);
      const latVal = (latitude !== undefined && latitude !== null && latitude !== '') ? parseFloat(latitude) : null;
      const lngVal = (longitude !== undefined && longitude !== null && longitude !== '') ? parseFloat(longitude) : null;

      let updated;
      if (latVal !== null && !isNaN(latVal) && lngVal !== null && !isNaN(lngVal)) {
        updated = await client.query(
          `UPDATE plants 
           SET nfc_uid = $1, public_url = $2, latitude = $3, longitude = $4, updated_at = NOW()
           WHERE id = $5
           RETURNING id, tree_code, public_slug, nfc_uid, public_url, farm_id, latitude, longitude`,
          [cleanUid, publicUrl, latVal, lngVal, plantId]
        );
      } else {
        updated = await client.query(
          `UPDATE plants 
           SET nfc_uid = $1, public_url = $2, updated_at = NOW()
           WHERE id = $3
           RETURNING id, tree_code, public_slug, nfc_uid, public_url, farm_id, latitude, longitude`,
          [cleanUid, publicUrl, plantId]
        );
      }

      // 2d. Upsert inventory item to assigned with HMAC signature
      const hmacSig = nfcSecurity.generateHmacSignature(cleanUid, plantId);
      await syncPlantNfcToInventory(client, {
        nfcUid: cleanUid,
        farmId: plant.farm_id,
        plantId: plantId,
        userId: req.user.id,
        lat: latVal !== null && !isNaN(latVal) ? latVal : updated.rows[0]?.latitude,
        lng: lngVal !== null && !isNaN(lngVal) ? lngVal : updated.rows[0]?.longitude,
        hmacSig
      });

      await client.query('COMMIT');

      const broadcast = req.app.get('broadcast');
      if (broadcast) broadcast('plants_updated', { plant_id: plantId, farm_id: plant.farm_id, nfc_uid: cleanUid, action: 'nfc_assigned' });

      return res.json({
        success: true,
        plant: updated.rows[0],
        public_url: publicUrl,
        hmac_signature: hmacSig,
        message: `Đã gắn thẻ định danh ${cleanUid} cho cây ${plant.tree_code || plantId}`
      });
    } else {
      // Deactivating / Unassigning tag from this plant
      if (plant.nfc_uid) {
        await client.query(
          `UPDATE nfc_tags_inventory
           SET status = 'unassigned', plant_id = NULL, tagged_at = NULL
           WHERE (UPPER(TRIM(nfc_uid)) = UPPER($1) OR plant_id = $2)`,
          [plant.nfc_uid.trim(), plantId]
        );
      }

      const publicUrl = generatePublicPlantUrl(plant.farm_id, plantId, null);
      const updated = await client.query(
        `UPDATE plants 
         SET nfc_uid = NULL, latitude = NULL, longitude = NULL, public_url = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, tree_code, public_slug, nfc_uid, public_url, farm_id, latitude, longitude`,
        [publicUrl, plantId]
      );

      await client.query('COMMIT');

      const broadcast = req.app.get('broadcast');
      if (broadcast) broadcast('plants_updated', { plant_id: plantId, farm_id: plant.farm_id, action: 'nfc_unassigned' });

      return res.json({
        success: true,
        plant: updated.rows[0],
        public_url: publicUrl,
        message: `Đã hủy kích hoạt thẻ của cây ${plant.tree_code || plantId}`
      });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('NFC assign error:', err);
    if (err.code === '23505') { // unique_violation
      return res.status(409).json({ error: 'Mã thẻ này đã được sử dụng bởi một cây trồng khác.' });
    }
    res.status(500).json({ error: 'Lỗi server khi cập nhật định danh thẻ: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── NTAG213 Security Provisioning & Configuration Endpoint ─────────────────
router.post('/plants/:id/nfc/provision-ntag213', auth, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);
    if (isNaN(plantId)) return res.status(400).json({ error: 'ID cây không hợp lệ.' });

    const plantRes = await pool.query('SELECT id, farm_id, tree_code, nfc_uid, latitude, longitude FROM plants WHERE id = $1', [plantId]);
    if (plantRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy cây trồng.' });
    }
    const plant = plantRes.rows[0];

    const targetUid = req.body.nfc_uid ? req.body.nfc_uid.trim() : plant.nfc_uid;
    if (!targetUid) {
      return res.status(400).json({ error: 'Vui lòng cung cấp mã thẻ NFC (nfc_uid) để tạo cấu hình NTAG213.' });
    }

    const mirrorConfig = nfcSecurity.buildNtag213MirrorConfig({
      farmId: plant.farm_id,
      plantId: plant.id,
      uid: targetUid
    });

    res.json({
      success: true,
      plant: {
        id: plant.id,
        tree_code: plant.tree_code,
        farm_id: plant.farm_id,
        latitude: plant.latitude,
        longitude: plant.longitude
      },
      provisioning: mirrorConfig
    });
  } catch (err) {
    console.error('Provision NTAG213 error:', err);
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
});

// ─── NFC 4-Tier Security & Geofence Scan Verification Endpoint ───────────────
router.post('/plants/nfc/verify-scan', async (req, res) => {
  const client = await pool.connect();
  try {
    const { nfc_uid, plant_id, counter, token, latitude, longitude, user_id } = req.body;
    const cleanUid = nfcSecurity.normalizeNfcUid(nfc_uid);

    if (!cleanUid && !plant_id) {
      return res.status(400).json({
        isValid: false,
        error: 'Vui lòng cung cấp mã thẻ NFC hoặc ID cây trồng để xác thực.'
      });
    }

    // 1. Find the plant
    let plantQuery;
    let plantParams;
    if (cleanUid) {
      plantQuery = `
        SELECT p.*, f.name as farm_name, COALESCE(p.geofence_radius_meters, f.geofence_radius_meters, 8.0) as allowed_radius
        FROM plants p
        LEFT JOIN farms f ON f.id = p.farm_id
        WHERE UPPER(p.nfc_uid) = UPPER($1)
      `;
      plantParams = [cleanUid];
    } else {
      plantQuery = `
        SELECT p.*, f.name as farm_name, COALESCE(p.geofence_radius_meters, f.geofence_radius_meters, 8.0) as allowed_radius
        FROM plants p
        LEFT JOIN farms f ON f.id = p.farm_id
        WHERE p.id = $1
      `;
      plantParams = [parseInt(plant_id)];
    }

    const plantRes = await client.query(plantQuery, plantParams);
    if (plantRes.rows.length === 0) {
      // Check if tag is in inventory but unassigned
      const invTag = cleanUid ? await client.query('SELECT * FROM nfc_tags_inventory WHERE UPPER(nfc_uid) = UPPER($1)', [cleanUid]) : { rows: [] };
      if (invTag.rows.length > 0) {
        return res.status(404).json({
          isValid: false,
          status: 'UNASSIGNED_TAG',
          severity: 'WARNING',
          message: `Thẻ NFC [${cleanUid}] đã nhập kho nhưng chưa được gán cho cây nào.`,
          tag: invTag.rows[0]
        });
      }
      return res.status(404).json({
        isValid: false,
        status: 'TAG_NOT_FOUND',
        severity: 'CRITICAL',
        message: 'Không tìm thấy thông tin cây trồng hoặc thẻ NFC chưa được khai báo.'
      });
    }

    const plant = plantRes.rows[0];

    // 2. Fetch inventory tag info for counter & signature
    const tagRes = await client.query(
      'SELECT * FROM nfc_tags_inventory WHERE UPPER(nfc_uid) = UPPER($1)',
      [cleanUid || plant.nfc_uid]
    );
    const tagInfo = tagRes.rows[0] || {};

    // 3. Run 4-Tier Security Verification
    const verification = nfcSecurity.verifyNtag213Scan({
      uid: cleanUid || plant.nfc_uid,
      plantId: plant.id,
      counter: counter,
      lastCounter: tagInfo.last_counter || 0,
      token: token,
      currentLat: latitude,
      currentLng: longitude,
      plantLat: plant.latitude,
      plantLng: plant.longitude,
      geofenceRadius: plant.allowed_radius || 8.0
    });

    // 4. Record Audit Log in DB
    const scannedLat = latitude !== undefined && latitude !== null ? parseFloat(latitude) : null;
    const scannedLng = longitude !== undefined && longitude !== null ? parseFloat(longitude) : null;
    const plantLat = plant.latitude !== null ? parseFloat(plant.latitude) : null;
    const plantLng = plant.longitude !== null ? parseFloat(plant.longitude) : null;

    await client.query(`
      INSERT INTO nfc_security_audit_logs (
        farm_id, plant_id, nfc_uid, scanned_counter, last_counter,
        scanned_lat, scanned_lng, plant_lat, plant_lng, distance_meters,
        status, severity, notes, scanned_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      plant.farm_id,
      plant.id,
      cleanUid || plant.nfc_uid || '',
      counter ? parseInt(counter, 10) : null,
      tagInfo.last_counter || 0,
      scannedLat,
      scannedLng,
      plantLat,
      plantLng,
      verification.distanceMeters,
      verification.status,
      verification.severity,
      verification.message,
      user_id ? parseInt(user_id, 10) : null
    ]);

    // 5. Update last counter & scan position if verified successfully
    if (verification.isValid && cleanUid) {
      const nextCounter = counter !== undefined && counter !== null 
        ? parseInt(counter, 10) 
        : (tagInfo.last_counter || 0) + 1;

      await client.query(`
        UPDATE nfc_tags_inventory
        SET last_counter = $1, last_scanned_lat = $2, last_scanned_lng = $3, last_scanned_at = NOW()
        WHERE UPPER(nfc_uid) = UPPER($4)
      `, [nextCounter, scannedLat, scannedLng, cleanUid]);
    } else if (!verification.isValid) {
      // 6. Asynchronously trigger Zalo Security Alert to Farm Owner
      try {
        const ownerRes = await client.query(`
          SELECT u.phone, u.full_name, u.email 
          FROM farms f
          JOIN users u ON u.id = f.user_id
          WHERE f.id = $1
        `, [plant.farm_id]);
        
        const ownerPhone = ownerRes.rows[0]?.phone;
        zaloService.sendZaloSecurityAlert({
          phone: ownerPhone,
          farmName: plant.farm_name,
          treeCode: plant.tree_code || plant.id,
          distance: verification.distanceMeters,
          reason: verification.message,
          severity: verification.severity
        }).catch(e => console.warn('Zalo alert non-blocking error:', e.message));
      } catch (zaloErr) {
        console.warn('Failed to query farm owner for Zalo alert:', zaloErr.message);
      }
    }

    return res.json({
      ...verification,
      plant: {
        id: plant.id,
        farm_id: plant.farm_id,
        farm_name: plant.farm_name,
        tree_code: plant.tree_code,
        public_slug: plant.public_slug,
        latitude: plant.latitude,
        longitude: plant.longitude,
        geofence_radius_meters: plant.allowed_radius || 8.0
      }
    });

  } catch (err) {
    console.error('NFC verify scan error:', err);
    res.status(500).json({ isValid: false, error: 'Lỗi server khi xác thực thẻ: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── Get Farm NFC Security Logs ─────────────────────────────────────────────
router.get('/farms/:farmId/nfc-security-logs', auth, async (req, res) => {
  try {
    const farmId = parseInt(req.params.farmId);
    if (isNaN(farmId)) return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const logs = await pool.query(`
      SELECT l.*, p.tree_code, u.full_name as scanned_by_name, u.email as scanned_by_email
      FROM nfc_security_audit_logs l
      LEFT JOIN plants p ON p.id = l.plant_id
      LEFT JOIN users u ON u.id = l.scanned_by
      WHERE l.farm_id = $1
      ORDER BY l.created_at DESC
      LIMIT $2
    `, [farmId, limit]);

    res.json({
      success: true,
      count: logs.rows.length,
      logs: logs.rows
    });
  } catch (err) {
    console.error('Fetch security logs error:', err);
    res.status(500).json({ error: 'Lỗi server khi tải nhật ký an ninh: ' + err.message });
  }
});

// ─── NFC Inventory API Endpoints (Batch registration, table listing, delete) ──
router.get('/farms/:farmId/nfc-inventory', auth, async (req, res) => {
  try {
    const farmId = parseInt(req.params.farmId);
    if (isNaN(farmId)) return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });

    // Verify access
    if (req.user.role !== 'admin') {
      const farmCheck = await pool.query('SELECT user_id FROM farms WHERE id = $1', [farmId]);
      if (farmCheck.rows.length === 0 || (farmCheck.rows[0].user_id !== req.user.id && req.user.farm_id !== farmId)) {
        return res.status(403).json({ error: 'Không có quyền truy cập kho thẻ của trang trại này.' });
      }
    }

    await ensureNfcInventoryColumns(pool);

    // Two-way reconciliation: ensure any NFC tag attached to a plant in this farm is synced to nfc_tags_inventory
    try {
      await reconcileFarmNfcInventory(pool, farmId);
    } catch (reconcileErr) {
      console.warn('reconcileFarmNfcInventory non-fatal warning:', reconcileErr.message);
    }

    const items = await pool.query(
      `SELECT n.*, p.tree_code, p.plant_type, p.plant_variety, p.health_status, p.location, p.latitude, p.longitude, p.public_url, p.data as plant_data
       FROM nfc_tags_inventory n
       LEFT JOIN plants p ON (n.plant_id = p.id AND p.deleted_at IS NULL)
       WHERE n.farm_id = $1 OR p.farm_id = $1
       ORDER BY CASE WHEN n.status = 'assigned' THEN 0 ELSE 1 END, n.id DESC`,
      [farmId]
    );

    const stats = {
      total: items.rows.length,
      assigned: items.rows.filter(r => r.status === 'assigned' || r.plant_id != null).length,
      unassigned: items.rows.filter(r => r.status !== 'assigned' && r.plant_id == null).length
    };

    res.json({ success: true, stats, items: items.rows, tags: items.rows });
  } catch (err) {
    console.error('Error fetching NFC inventory:', err);
    res.status(500).json({ error: 'Lỗi server khi tải danh sách kho thẻ: ' + (err.message || 'Lỗi không xác định') });
  }
});

// ─── Manual & Realtime Two-Way Sync Endpoint for Farm NFC Inventory ──────────
router.post('/farms/:farmId/nfc-inventory/sync', auth, async (req, res) => {
  try {
    const farmId = parseInt(req.params.farmId);
    if (isNaN(farmId)) return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });

    if (req.user.role !== 'admin') {
      const farmCheck = await pool.query('SELECT user_id FROM farms WHERE id = $1', [farmId]);
      if (farmCheck.rows.length === 0 || (farmCheck.rows[0].user_id !== req.user.id && req.user.farm_id !== farmId)) {
        return res.status(403).json({ error: 'Không có quyền đồng bộ kho thẻ của trang trại này.' });
      }
    }

    await ensureNfcInventoryColumns(pool);
    await reconcileFarmNfcInventory(pool, farmId);

    const items = await pool.query(
      `SELECT n.*, p.tree_code, p.plant_type, p.plant_variety, p.health_status, p.location, p.latitude, p.longitude, p.public_url, p.data as plant_data
       FROM nfc_tags_inventory n
       LEFT JOIN plants p ON (n.plant_id = p.id AND p.deleted_at IS NULL)
       WHERE n.farm_id = $1 OR p.farm_id = $1
       ORDER BY CASE WHEN n.status = 'assigned' THEN 0 ELSE 1 END, n.id DESC`,
      [farmId]
    );

    const stats = {
      total: items.rows.length,
      assigned: items.rows.filter(r => r.status === 'assigned' || r.plant_id != null).length,
      unassigned: items.rows.filter(r => r.status !== 'assigned' && r.plant_id == null).length
    };

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated', { farm_id: farmId, action: 'nfc_inventory_synced' });

    res.json({
      success: true,
      stats,
      items: items.rows,
      tags: items.rows,
      message: `Đã đồng bộ kho thẻ NFC với dữ liệu cây trồng của trang trại (${stats.total} thẻ, ${stats.assigned} đã gắn cây).`
    });
  } catch (err) {
    console.error('Error syncing NFC inventory:', err);
    res.status(500).json({ error: 'Lỗi server khi đồng bộ kho thẻ NFC: ' + (err.message || 'Lỗi không xác định') });
  }
});

router.post('/farms/:farmId/nfc-inventory/batch', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const farmId = parseInt(req.params.farmId);
    if (isNaN(farmId)) return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });

    const { uids, uid } = req.body;
    const rawList = Array.isArray(uids) ? uids : (uid ? [uid] : []);

    if (rawList.length === 0) {
      return res.status(400).json({ error: 'Vui lòng cung cấp ít nhất 1 mã thẻ NFC.' });
    }

    await client.query('BEGIN');

    const added = [];
    const duplicates = [];

    for (const rawUid of rawList) {
      if (!rawUid || typeof rawUid !== 'string') continue;
      const cleanUid = formatStandardNfcUid(rawUid);
      if (!cleanUid) continue;

      // Check if already in inventory (ignoring colons)
      const existing = await client.query(
        `SELECT id, farm_id, status, plant_id FROM nfc_tags_inventory WHERE UPPER(REPLACE(nfc_uid, ':', '')) = UPPER(REPLACE($1, ':', ''))`,
        [cleanUid]
      );

      if (existing.rows.length > 0) {
        duplicates.push({ uid: cleanUid, reason: 'Mã thẻ đã tồn tại trong kho thẻ.' });
        continue;
      }

      // Check if already assigned to a plant
      const existingPlant = await client.query(
        `SELECT id, tree_code, farm_id, latitude, longitude FROM plants WHERE UPPER(REPLACE(nfc_uid, ':', '')) = UPPER(REPLACE($1, ':', '')) AND deleted_at IS NULL`,
        [cleanUid]
      );

      if (existingPlant.rows.length > 0) {
        const ep = existingPlant.rows[0];
        // Auto-backfill into nfc_tags_inventory so warehouse reflects this assigned plant tag!
        const syncedRow = await syncPlantNfcToInventory(client, {
          nfcUid: cleanUid,
          farmId: ep.farm_id || farmId,
          plantId: ep.id,
          userId: req.user.id,
          lat: ep.latitude,
          lng: ep.longitude
        });
        if (syncedRow) added.push(syncedRow);
        duplicates.push({ uid: cleanUid, reason: `Thẻ đã được gán cho cây #${ep.tree_code || ep.id} (Đã tự động đồng bộ vào kho thẻ)` });
        continue;
      }

      // Insert new inventory tag
      const insertRes = await client.query(
        `INSERT INTO nfc_tags_inventory (farm_id, nfc_uid, status, created_by, updated_at)
         VALUES ($1, $2, 'unassigned', $3, NOW())
         RETURNING *`,
        [farmId, cleanUid, req.user.id]
      );
      added.push(insertRes.rows[0]);
    }

    await client.query('COMMIT');

    // If single tap registration and it's a duplicate that wasn't newly synced, return 409
    if (rawList.length === 1 && duplicates.length > 0 && added.length === 0) {
      return res.status(409).json({ 
        error: `Thẻ ${duplicates[0].uid} bị trùng: ${duplicates[0].reason}`,
        duplicate: duplicates[0]
      });
    }

    res.status(201).json({
      success: true,
      added_count: added.length,
      duplicate_count: duplicates.length,
      added,
      duplicates,
      message: `Đã thêm thành công ${added.length} thẻ NFC vào kho của trang trại.${duplicates.length > 0 ? ` (${duplicates.length} thẻ bị trùng)` : ''}`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error batch adding NFC inventory:', err);
    res.status(500).json({ error: 'Lỗi server khi nhập kho thẻ NFC: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── Symmetrical Import NFC Inventory (CSV / Excel items with auto-assign & GPS) ──
router.post('/farms/:farmId/nfc-inventory/import', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const farmId = parseInt(req.params.farmId);
    if (isNaN(farmId)) return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });

    // Verify access
    if (req.user.role !== 'admin') {
      const farmCheck = await client.query('SELECT user_id FROM farms WHERE id = $1', [farmId]);
      if (farmCheck.rows.length === 0 || (farmCheck.rows[0].user_id !== req.user.id && req.user.farm_id !== farmId)) {
        return res.status(403).json({ error: 'Không có quyền import kho thẻ của trang trại này.' });
      }
    }

    const { items, auto_assign = true, update_gps = true, skip_duplicates = true } = req.body;
    const rawList = Array.isArray(items) ? items : [];

    if (rawList.length === 0) {
      return res.status(400).json({ error: 'Dữ liệu import rỗng hoặc không đúng định dạng.' });
    }

    await client.query('BEGIN');

    let addedCount = 0;
    let assignedCount = 0;
    let gpsUpdatedCount = 0;
    const duplicates = [];

    for (const item of rawList) {
      if (!item) continue;
      const rawUid = typeof item === 'string' ? item : item.uid;
      if (!rawUid || typeof rawUid !== 'string') continue;
      const cleanUid = formatStandardNfcUid(rawUid);
      if (!cleanUid) continue;

      // Check if tag already exists in inventory
      const existingTag = await client.query(
        `SELECT id, farm_id, status, plant_id FROM nfc_tags_inventory WHERE UPPER(REPLACE(nfc_uid, ':', '')) = UPPER(REPLACE($1, ':', ''))`,
        [cleanUid]
      );

      let tagId = null;
      let isNew = false;

      if (existingTag.rows.length > 0) {
        const existing = existingTag.rows[0];
        if (existing.farm_id !== farmId && existing.farm_id !== null) {
          duplicates.push({ uid: cleanUid, reason: `Thẻ đã thuộc trang trại khác (#${existing.farm_id})` });
          continue;
        }
        tagId = existing.id;
        duplicates.push({ uid: cleanUid, reason: 'Thẻ đã có sẵn trong kho trang trại này.' });
      } else {
        // Insert new inventory tag
        const insertRes = await client.query(
          `INSERT INTO nfc_tags_inventory (farm_id, nfc_uid, status, created_by, updated_at)
           VALUES ($1, $2, 'unassigned', $3, NOW())
           RETURNING id`,
          [farmId, cleanUid, req.user.id]
        );
        tagId = insertRes.rows[0].id;
        addedCount++;
        isNew = true;
      }

      // Auto-assign to plant if tree_code or plant_id is provided
      if (auto_assign && (item.tree_code || item.plant_id)) {
        let plant = null;

        if (item.plant_id && !isNaN(parseInt(item.plant_id))) {
          const pRes = await client.query(
            'SELECT id, tree_code, nfc_uid, latitude, longitude FROM plants WHERE id = $1 AND farm_id = $2',
            [parseInt(item.plant_id), farmId]
          );
          if (pRes.rows.length > 0) plant = pRes.rows[0];
        }

        if (!plant && item.tree_code) {
          const rawCode = String(item.tree_code).trim();
          const cleanCode = rawCode.replace(/^cây\s*#/i, '').replace(/^#/i, '').trim();
          const pRes = await client.query(
            `SELECT id, tree_code, nfc_uid, latitude, longitude FROM plants 
             WHERE farm_id = $1 AND (UPPER(tree_code) = UPPER($2) OR UPPER(tree_code) = UPPER($3) OR id::text = $3)
             LIMIT 1`,
            [farmId, rawCode, cleanCode]
          );
          if (pRes.rows.length > 0) plant = pRes.rows[0];
        }

        if (plant) {
          const targetPlantId = plant.id;
          const publicUrl = generatePublicPlantUrl(farmId, targetPlantId, cleanUid);

          // Parse GPS coordinates if available
          let validLat = null;
          let validLng = null;
          if (update_gps && item.latitude != null && item.longitude != null) {
            const parsedLat = parseFloat(item.latitude);
            const parsedLng = parseFloat(item.longitude);
            if (!isNaN(parsedLat) && !isNaN(parsedLng) && Math.abs(parsedLat) <= 90 && Math.abs(parsedLng) <= 180 && (parsedLat !== 0 || parsedLng !== 0)) {
              validLat = parsedLat;
              validLng = parsedLng;
            }
          }

          if (validLat !== null && validLng !== null) {
            await client.query(
              `UPDATE plants 
               SET nfc_uid = $1, latitude = $2, longitude = $3, public_url = $4, updated_at = NOW() 
               WHERE id = $5`,
              [cleanUid, validLat, validLng, publicUrl, targetPlantId]
            );
            gpsUpdatedCount++;
          } else {
            await client.query(
              `UPDATE plants 
               SET nfc_uid = $1, public_url = $2, updated_at = NOW() 
               WHERE id = $3`,
              [cleanUid, publicUrl, targetPlantId]
            );
          }

          // Update inventory status to assigned
          await client.query(
            `UPDATE nfc_tags_inventory 
             SET farm_id = $1, status = 'assigned', plant_id = $2, assigned_at = COALESCE(assigned_at, NOW()), tagged_at = NOW(), updated_at = NOW() 
             WHERE id = $3`,
            [farmId, targetPlantId, tagId]
          );

          assignedCount++;
        }
      }
    }

    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated', { farm_id: farmId, action: 'nfc_imported' });

    res.json({
      success: true,
      total_processed: rawList.length,
      added_count: addedCount,
      assigned_count: assignedCount,
      gps_updated_count: gpsUpdatedCount,
      duplicate_count: duplicates.length,
      duplicates,
      message: `Đã nhập thành công ${addedCount} thẻ mới vào kho.${assignedCount > 0 ? ` Đã tự động gán cho ${assignedCount} cây trồng.` : ''}${gpsUpdatedCount > 0 ? ` Cập nhật ${gpsUpdatedCount} tọa độ GPS.` : ''}${duplicates.length > 0 ? ` (${duplicates.length} thẻ trùng đã bỏ qua)` : ''}`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error importing NFC inventory:', err);
    res.status(500).json({ error: 'Lỗi server khi import kho thẻ: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── Unassign ALL tags from plants in a farm ─────────────────────────────────
router.post('/farms/:farmId/nfc-inventory/unassign-all', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const farmId = parseInt(req.params.farmId);
    if (isNaN(farmId)) return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });

    // Verify access
    if (req.user.role !== 'admin') {
      const farmCheck = await client.query('SELECT user_id FROM farms WHERE id = $1', [farmId]);
      if (farmCheck.rows.length === 0 || (farmCheck.rows[0].user_id !== req.user.id && req.user.farm_id !== farmId)) {
        return res.status(403).json({ error: 'Không có quyền thay đổi kho thẻ của trang trại này.' });
      }
    }

    await client.query('BEGIN');

    // 1. Get all plants currently assigned with an NFC tag in this farm
    const assignedPlants = await client.query(
      'SELECT id, tree_code, nfc_uid FROM plants WHERE farm_id = $1 AND nfc_uid IS NOT NULL',
      [farmId]
    );

    // 2. Set nfc_uid = NULL & GPS coordinates = NULL for all plants in this farm & update standard public_url
    for (const p of assignedPlants.rows) {
      const standardUrl = generatePublicPlantUrl(farmId, p.id, null);
      await client.query(
        'UPDATE plants SET nfc_uid = NULL, latitude = NULL, longitude = NULL, public_url = $1, updated_at = NOW() WHERE id = $2',
        [standardUrl, p.id]
      );
    }

    // 3. Reset all inventory items in this farm to unassigned
    const resetRes = await client.query(
      `UPDATE nfc_tags_inventory 
       SET status = 'unassigned', plant_id = NULL, tagged_at = NULL 
       WHERE farm_id = $1 AND (status = 'assigned' OR plant_id IS NOT NULL)
       RETURNING *`,
      [farmId]
    );

    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated', { farm_id: farmId, action: 'nfc_unassigned_all' });

    res.json({
      success: true,
      unassigned_plants_count: assignedPlants.rows.length,
      unassigned_tags_count: resetRes.rows.length,
      message: `Đã gỡ thành công thẻ NFC khỏi ${assignedPlants.rows.length} cây trong trang trại. Toàn bộ thẻ trong kho đã chuyển về trạng thái sẵn sàng gán.`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error unassigning all NFC tags:', err);
    res.status(500).json({ error: 'Lỗi server khi gỡ toàn bộ thẻ: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── Unassign a single tag from a plant ──────────────────────────────────────
router.post('/farms/:farmId/nfc-inventory/:id/unassign', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id);
    const farmId = parseInt(req.params.farmId);
    if (isNaN(id) || isNaN(farmId)) return res.status(400).json({ error: 'Tham số không hợp lệ.' });

    // Verify access
    if (req.user.role !== 'admin') {
      const farmCheck = await client.query('SELECT user_id FROM farms WHERE id = $1', [farmId]);
      if (farmCheck.rows.length === 0 || (farmCheck.rows[0].user_id !== req.user.id && req.user.farm_id !== farmId)) {
        return res.status(403).json({ error: 'Không có quyền thay đổi kho thẻ của trang trại này.' });
      }
    }

    await client.query('BEGIN');

    const tagRes = await client.query('SELECT * FROM nfc_tags_inventory WHERE id = $1 AND farm_id = $2', [id, farmId]);
    if (tagRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Không tìm thấy thẻ trong kho.' });
    }

    const tag = tagRes.rows[0];

    // Unassign from plant
    if (tag.plant_id || tag.nfc_uid) {
      const plantRes = await client.query(
        'SELECT id, farm_id FROM plants WHERE (id = $1 OR UPPER(nfc_uid) = UPPER($2)) AND farm_id = $3',
        [tag.plant_id || 0, tag.nfc_uid, farmId]
      );
      for (const p of plantRes.rows) {
        const standardUrl = generatePublicPlantUrl(farmId, p.id, null);
        await client.query(
          'UPDATE plants SET nfc_uid = NULL, latitude = NULL, longitude = NULL, public_url = $1, updated_at = NOW() WHERE id = $2',
          [standardUrl, p.id]
        );
      }
    }

    // Reset inventory row
    await client.query(
      `UPDATE nfc_tags_inventory 
       SET status = 'unassigned', plant_id = NULL, tagged_at = NULL 
       WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated', { farm_id: farmId, tag_id: id, action: 'nfc_unassigned' });

    res.json({
      success: true,
      message: `Đã gỡ thẻ ${tag.nfc_uid} khỏi cây trồng thành công.`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error unassigning single NFC tag:', err);
    res.status(500).json({ error: 'Lỗi server khi gỡ thẻ: ' + err.message });
  } finally {
    client.release();
  }
});

router.delete('/farms/:farmId/nfc-inventory/:id', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id);
    const farmId = parseInt(req.params.farmId);
    if (isNaN(id) || isNaN(farmId)) return res.status(400).json({ error: 'Tham số không hợp lệ.' });

    await client.query('BEGIN');

    const result = await client.query(
      'DELETE FROM nfc_tags_inventory WHERE id = $1 AND farm_id = $2 RETURNING *',
      [id, farmId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Không tìm thấy thẻ trong kho.' });
    }

    const deletedTag = result.rows[0];

    // If assigned to a plant, also set plant's nfc_uid to NULL and clear GPS
    if (deletedTag.plant_id || deletedTag.nfc_uid) {
      const pRes = await client.query(
        'SELECT id FROM plants WHERE (id = $1 OR UPPER(nfc_uid) = UPPER($2)) AND farm_id = $3',
        [deletedTag.plant_id || 0, deletedTag.nfc_uid, farmId]
      );
      for (const p of pRes.rows) {
        const standardUrl = generatePublicPlantUrl(farmId, p.id, null);
        await client.query(
          'UPDATE plants SET nfc_uid = NULL, latitude = NULL, longitude = NULL, public_url = $1, updated_at = NOW() WHERE id = $2',
          [standardUrl, p.id]
        );
      }
    }

    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated', { farm_id: farmId, action: 'nfc_deleted' });

    res.json({ success: true, message: 'Đã xóa thẻ khỏi kho.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting NFC tag from inventory:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa thẻ.' });
  } finally {
    client.release();
  }
});

// ─── Field Tagging: Quick Assign NFC Tag + GPS location to a Tree ────────────
router.post('/farms/:farmId/tag-nfc-gps', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const farmId = parseInt(req.params.farmId);
    const { plant_id, tree_code, nfc_uid, latitude, longitude } = req.body;

    if (!nfc_uid || typeof nfc_uid !== 'string') {
      return res.status(400).json({ error: 'Mã thẻ NFC (UID) là bắt buộc.' });
    }

    const cleanUid = formatStandardNfcUid(nfc_uid);
    if (!cleanUid) {
      return res.status(400).json({ error: 'Mã thẻ NFC (UID) không hợp lệ.' });
    }

    let lat = latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null;
    let lng = longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null;

    if (lat !== null && lng !== null) {
      if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
        const tmp = lat; lat = lng; lng = tmp;
      }
    }

    await client.query('BEGIN');

    // Find the plant by plant_id or farm_id + tree_code
    let targetPlant = null;
    if (plant_id) {
      const pRes = await client.query('SELECT * FROM plants WHERE id = $1 AND farm_id = $2', [plant_id, farmId]);
      if (pRes.rows.length > 0) targetPlant = pRes.rows[0];
    }
    if (!targetPlant && tree_code) {
      const pRes = await client.query('SELECT * FROM plants WHERE farm_id = $1 AND (tree_code = $2 OR tree_code ILIKE $3)', [farmId, tree_code, `%${tree_code}%`]);
      if (pRes.rows.length > 0) targetPlant = pRes.rows[0];
    }

    if (!targetPlant) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Không tìm thấy cây số ${tree_code || plant_id} trong trang trại này.` });
    }

    // 1. Check if this UID is used by another plant
    const uidConflict = await client.query(
      `SELECT id, tree_code FROM plants WHERE UPPER(REPLACE(nfc_uid, ':', '')) = UPPER(REPLACE($1, ':', '')) AND id != $2 AND deleted_at IS NULL`,
      [cleanUid, targetPlant.id]
    );
    if (uidConflict.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Mã thẻ ${cleanUid} đã được gắn cho cây #${uidConflict.rows[0].tree_code || uidConflict.rows[0].id}. Mỗi cây chỉ được gắn 1 thẻ duy nhất.` });
    }

    // 2. Generate public URL: https://plant-book.onrender.com/{farm_id}/{plant_id}/{nfc_uid}
    const publicUrl = generatePublicPlantUrl(farmId, targetPlant.id, cleanUid);

    // 3. Update plant
    const updateRes = await client.query(
      `UPDATE plants 
       SET nfc_uid = $1, 
           latitude = COALESCE($2, latitude), 
           longitude = COALESCE($3, longitude), 
           public_url = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [cleanUid, lat, lng, publicUrl, targetPlant.id]
    );

    const updatedPlant = updateRes.rows[0];

    // 4. Sync / Auto-register NFC Inventory item so Admin NFC Warehouse always receives the tag
    await syncPlantNfcToInventory(client, {
      nfcUid: cleanUid,
      farmId,
      plantId: targetPlant.id,
      oldUid: targetPlant.nfc_uid,
      userId: req.user.id,
      lat: updatedPlant.latitude,
      lng: updatedPlant.longitude
    });

    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated', { plant_id: updatedPlant.id, farm_id: farmId, action: 'nfc_tagged' });

    res.json({
      success: true,
      message: `Đã gán thẻ ${cleanUid} và định vị GPS cho cây #${updatedPlant.tree_code || updatedPlant.id}!`,
      plant: updatedPlant,
      public_url: publicUrl
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error tagging plant with NFC & GPS:', err);
    res.status(500).json({ error: 'Lỗi server khi gán thẻ và GPS: ' + err.message });
  } finally {
    client.release();
  }
});

// GET /api/plants/nfc/:uid — Public lookup plant by NFC UID, Slug, or ID
router.get('/nfc/:uid', async (req, res) => {
  try {
    const uid = req.params.uid.trim();
    const result = await pool.query(
      `SELECT p.id as plant_id, p.tree_code, p.plant_type, p.plant_variety, p.public_slug, p.health_status, p.nfc_uid, p.location,
              f.id as farm_id, f.name as farm_name, f.user_id,
              u.full_name as farm_owner_name, u.email as farm_owner_email
       FROM plants p
       LEFT JOIN farms f ON f.id = p.farm_id
       LEFT JOIN users u ON u.id = f.user_id
       WHERE UPPER(REPLACE(p.nfc_uid, ':', '')) = UPPER(REPLACE($1, ':', '')) OR p.public_slug = $1 OR p.id::text = $1`,
      [uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin cây trồng liên kết với mã thẻ NFC này.' });
    }

    const plant = result.rows[0];
    const slug = plant.public_slug || plant.plant_id;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.get('host') || 'plant-book.onrender.com';
    const baseUrl = `${protocol}://${host}`;

    res.json({
      success: true,
      plant_id: plant.plant_id,
      tree_code: plant.tree_code,
      plant_type: plant.plant_type,
      plant_variety: plant.plant_variety,
      health_status: plant.health_status,
      nfc_uid: plant.nfc_uid,
      farm_id: plant.farm_id,
      farm_name: plant.farm_name,
      user_id: plant.user_id,
      farm_owner_name: plant.farm_owner_name,
      public_slug: slug,
      public_url: `${baseUrl}/plant/${slug}`,
      nfc_url: plant.nfc_uid ? `${baseUrl}/nfc/${plant.nfc_uid}` : `${baseUrl}/plant/${slug}`
    });
  } catch (err) {
    console.error('NFC lookup error:', err);
    res.status(500).json({ error: 'Lỗi server khi tra cứu thẻ NFC.' });
  }
});

// ─── Soft Delete Plant (Chống xóa nhầm & Audit Trail) ────────────────────────

router.get('/farms/:farmId/unassigned-trees', auth, async (req, res) => {
  try {
    const farmId = parseInt(req.params.farmId);
    if (isNaN(farmId)) {
      return res.status(400).json({ error: 'ID nông trại không hợp lệ.' });
    }

    // Permission check
    if (req.user.role !== 'admin' && Number(req.user.farm_id) !== farmId) {
      const farmOwn = await pool.query('SELECT user_id FROM farms WHERE id = $1', [farmId]);
      if (farmOwn.rows.length === 0 || Number(farmOwn.rows[0].user_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập nông trại này.' });
      }
    }

    const { search } = req.query;
    let query = `
      SELECT p.id, p.tree_code, p.plant_type, p.plant_variety, p.health_status, p.location, p.latitude, p.longitude,
             ps.name as schema_name
      FROM plants p
      LEFT JOIN plant_schemas ps ON ps.id = p.schema_id
      WHERE p.farm_id = $1 
        AND (p.nfc_uid IS NULL OR TRIM(p.nfc_uid) = '') 
        AND (p.deleted_at IS NULL)
    `;
    const params = [farmId];

    if (search && search.trim()) {
      query += ` AND (p.tree_code ILIKE $2 OR p.plant_type ILIKE $2 OR p.location ILIKE $2)`;
      params.push(`%${search.trim()}%`);
    }

    query += ` ORDER BY CAST(NULLIF(regexp_replace(p.tree_code, '\\D', '', 'g'), '') AS INTEGER) ASC NULLS LAST, p.tree_code ASC, p.id ASC`;

    const treesRes = await pool.query(query, params);
    res.json({
      success: true,
      farm_id: farmId,
      total_unassigned: treesRes.rows.length,
      trees: treesRes.rows
    });
  } catch (err) {
    console.error('Error fetching unassigned trees:', err);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách cây chưa gắn thẻ: ' + err.message });
  }
});

// ─── Quick On-Site Tag Binding with Strict 1-Tree-1-Tag Governance & Auto GPS ───
router.post('/farms/:farmId/bind-tag-quick', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const farmId = parseInt(req.params.farmId);
    const { nfc_uid, plant_id, tree_code, latitude, longitude, accuracy, allow_replace } = req.body;

    if (isNaN(farmId)) {
      return res.status(400).json({ error: 'ID nông trại không hợp lệ.' });
    }

    // Permission check
    if (req.user.role !== 'admin' && Number(req.user.farm_id) !== farmId) {
      const farmOwn = await pool.query('SELECT user_id FROM farms WHERE id = $1', [farmId]);
      if (farmOwn.rows.length === 0 || Number(farmOwn.rows[0].user_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Bạn không có quyền thực hiện gắn thẻ cho nông trại này.' });
      }
    }

    if (!nfc_uid || !String(nfc_uid).trim()) {
      return res.status(400).json({ error: 'Mã thẻ NFC (UID) là bắt buộc.' });
    }
    const rawUid = String(nfc_uid).trim();
    const cleanUid = (nfcSecurity.sanitizeUid ? nfcSecurity.sanitizeUid(rawUid) : (nfcSecurity.normalizeNfcUid ? nfcSecurity.normalizeNfcUid(rawUid) : rawUid)) || rawUid.toUpperCase();
    const cleanRawUid = cleanUid.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    if (!plant_id && !tree_code) {
      return res.status(400).json({ error: 'Vui lòng chọn hoặc nhập số thứ tự cây cần gắn thẻ.' });
    }

    let lat = latitude !== undefined && latitude !== '' && latitude !== null ? parseFloat(latitude) : null;
    let lng = longitude !== undefined && longitude !== '' && longitude !== null ? parseFloat(longitude) : null;
    let acc = accuracy !== undefined && accuracy !== '' && accuracy !== null ? parseFloat(accuracy) : null;

    if (lat !== null && lng !== null) {
      if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
        const tmp = lat; lat = lng; lng = tmp;
      }
    }

    await client.query('BEGIN');

    // 0. WAREHOUSE INVENTORY CHECK: Verify tag or auto-register for authorized staff
    const invCheck = await client.query(
      `SELECT id, farm_id, status, plant_id, nfc_uid 
       FROM nfc_tags_inventory 
       WHERE (UPPER(nfc_uid) = UPPER($1) OR UPPER(regexp_replace(COALESCE(nfc_uid, ''), '[^A-Za-z0-9]', '', 'g')) = $2)`,
      [cleanUid, cleanRawUid]
    );

    let invItem = null;
    if (invCheck.rows.length === 0) {
      // Auto-register tag into farm warehouse inventory if user is Admin or Farm Manager
      const autoInv = await client.query(
        `INSERT INTO nfc_tags_inventory (farm_id, nfc_uid, status, created_by)
         VALUES ($1, $2, 'available', $3)
         RETURNING id, farm_id, status, plant_id, nfc_uid`,
        [farmId, cleanUid, req.user.id]
      );
      invItem = autoInv.rows[0];
    } else {
      invItem = invCheck.rows[0];
    }

    // Check if tag is allocated to a different farm
    if (invItem.farm_id && Number(invItem.farm_id) !== Number(farmId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        wrong_farm: true,
        error: `Thẻ NFC [${cleanUid}] thuộc kho của Trang trại #${invItem.farm_id}, không thể gắn cho cây thuộc Trang trại #${farmId}!`
      });
    }

    // Check if tag is revoked/frozen
    if (invItem.status === 'revoked') {
      await client.query('ROLLBACK');
      return res.status(410).json({
        is_revoked: true,
        error: `Thẻ NFC [${cleanUid}] đã bị thu hồi / khóa bảo mật và không thể tái sử dụng.`
      });
    }

    // 1. Find target plant by plant_id, tree_code, or numeric ID
    let targetPlant = null;
    if (plant_id) {
      const pRes = await client.query('SELECT * FROM plants WHERE id = $1 AND farm_id = $2 AND deleted_at IS NULL LIMIT 1 FOR UPDATE', [parseInt(plant_id), farmId]);
      if (pRes.rows.length > 0) targetPlant = pRes.rows[0];
    }
    if (!targetPlant && tree_code) {
      const cleanCode = String(tree_code).trim();
      const codeWithoutHash = cleanCode.replace(/^#/, '');
      const rawCode = cleanCode.replace(/[^A-Za-z0-9]/g, '');
      const isPureDigits = /^\d+$/.test(codeWithoutHash);
      const intDigits = isPureDigits ? parseInt(codeWithoutHash, 10) : null;

      const pRes = await client.query(
        `SELECT * FROM plants 
         WHERE farm_id = $1
           AND (
             id::text = $2
             OR UPPER(tree_code) = UPPER($2)
             OR UPPER(tree_code) = UPPER($3)
             OR UPPER(regexp_replace(COALESCE(tree_code, ''), '[^A-Za-z0-9]', '', 'g')) = UPPER($4)
             OR (
               $5::int IS NOT NULL 
               AND (
                 id = $5::int
                 OR CAST(NULLIF(regexp_replace(tree_code, '\\D', '', 'g'), '') AS INTEGER) = $5::int
               )
             )
           ) 
           AND deleted_at IS NULL 
         ORDER BY (CASE WHEN UPPER(tree_code) = UPPER($2) THEN 1 WHEN UPPER(tree_code) = UPPER($3) THEN 2 ELSE 3 END) ASC, id ASC
         LIMIT 1 
         FOR UPDATE`,
        [farmId, cleanCode, codeWithoutHash, rawCode, intDigits]
      );
      if (pRes.rows.length > 0) targetPlant = pRes.rows[0];
    }

    // If target plant still does not exist, AUTO-CREATE it on-the-fly for this farm
    if (!targetPlant && tree_code) {
      const cleanCode = String(tree_code).trim();
      const newSlug = `${farmId}_${cleanCode.replace(/[^A-Za-z0-9_-]/g, '') || Date.now()}`;
      const pubUrl = generatePublicPlantUrl(farmId, null, cleanUid);
      const insertPlant = await client.query(
        `INSERT INTO plants (farm_id, tree_code, plant_type, plant_variety, health_status, is_public, latitude, longitude, nfc_uid, public_url, created_by, public_slug)
         VALUES ($1, $2, 'Sầu riêng (durian)', 'Dona', 'Tốt', true, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [farmId, cleanCode, lat, lng, cleanUid, pubUrl, req.user.id, newSlug]
      );
      targetPlant = insertPlant.rows[0];
    }

    if (!targetPlant) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Không thể tìm thấy hoặc tạo cây số "${tree_code || plant_id}" trong nông trại này.` });
    }

    let replacedOldUid = null;

    // 2. TREE GOVERNANCE & REPLACEMENT CHECK
    if (targetPlant.nfc_uid && String(targetPlant.nfc_uid).trim().length > 0) {
      const existingTag = targetPlant.nfc_uid.trim().toUpperCase();
      const existingRawTag = existingTag.replace(/[^A-Za-z0-9]/g, '');
      
      // If tapping the exact same tag on the same tree -> allow updating GPS without replacing
      if (existingTag !== cleanUid && existingRawTag !== cleanRawUid) {
        if (!allow_replace) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            can_replace: true,
            conflict: true,
            tree_code: targetPlant.tree_code || targetPlant.id,
            plant_id: targetPlant.id,
            plant_type: targetPlant.plant_type,
            current_uid: targetPlant.nfc_uid,
            new_uid: cleanUid,
            error: `Cây #${targetPlant.tree_code || targetPlant.id} hiện đang gắn thẻ [${targetPlant.nfc_uid}]. Bạn có muốn THAY THẾ bằng thẻ mới này không?`
          });
        }

        // USER CONFIRMED REPLACEMENT: Revoke & Freeze Old Tag permanently
        replacedOldUid = existingTag;
        await client.query(
          `INSERT INTO nfc_tags_inventory (farm_id, nfc_uid, status, plant_id, tagged_at, created_by)
           VALUES ($1, $2, 'revoked', NULL, NULL, $3)
           ON CONFLICT (nfc_uid)
           DO UPDATE SET status = 'revoked', plant_id = NULL, tagged_at = NULL`,
          [farmId, existingTag, req.user.id]
        );
      }
    }

    // 3. Check if cleanUid is already assigned to ANOTHER plant anywhere in the system
    const uidConflict = await client.query(
      `SELECT id, tree_code, farm_id FROM plants 
       WHERE (UPPER(nfc_uid) = UPPER($1) OR UPPER(regexp_replace(COALESCE(nfc_uid, ''), '[^A-Za-z0-9]', '', 'g')) = $2) AND id != $3 AND deleted_at IS NULL`,
      [cleanUid, cleanRawUid, targetPlant.id]
    );
    if (uidConflict.rows.length > 0) {
      await client.query('ROLLBACK');
      const confTree = uidConflict.rows[0];
      return res.status(409).json({
        error: `Mã thẻ NFC [${cleanUid}] đã được gắn cho cây #${confTree.tree_code || confTree.id}. Mỗi thẻ chỉ được gắn cho 1 cây duy nhất.`
      });
    }

    // 4. Generate public URL
    const host = req.get('host') || 'plant-book.onrender.com';
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const publicUrl = `${proto}://${host}/${farmId}/public/${cleanUid}`;

    // 5. Atomic Update Plant
    const updateRes = await client.query(
      `UPDATE plants 
       SET nfc_uid = $1, 
           latitude = COALESCE($2, latitude), 
           longitude = COALESCE($3, longitude), 
           gps_accuracy = COALESCE($4, gps_accuracy),
           nfc_tagged_at = NOW(),
           nfc_tagged_by = $5,
           public_url = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [cleanUid, lat, lng, acc, req.user.id, publicUrl, targetPlant.id]
    );

    const updatedPlant = updateRes.rows[0];

    // 6. Update NFC Inventory for the newly assigned tag
    await client.query(
      `UPDATE nfc_tags_inventory 
       SET farm_id = $1, 
           status = 'assigned', 
           plant_id = $2, 
           last_scanned_lat = COALESCE($3, last_scanned_lat), 
           last_scanned_lng = COALESCE($4, last_scanned_lng), 
           tagged_at = NOW()
       WHERE id = $5`,
      [farmId, targetPlant.id, lat, lng, invItem.id]
    );

    await client.query('COMMIT');

    // Safe async audit logging after commit
    try {
      await logAuditAction(
        req.user.id,
        req.user.full_name || req.user.email,
        replacedOldUid ? 'NFC_REPLACE' : 'NFC_BIND',
        'Cây trồng',
        updatedPlant.id,
        `Gắn thẻ NFC [${cleanUid}] cho Cây #${updatedPlant.tree_code || updatedPlant.id}`,
        { old_uid: replacedOldUid },
        { nfc_uid: cleanUid, tree_code: updatedPlant.tree_code, lat, lng },
        `Gắn thẻ NFC thực địa tại trang trại #${farmId}`
      );
    } catch(auditErr) { /* ignore non-critical audit log error */ }

    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated', { plant_id: updatedPlant.id, farm_id: farmId, action: 'nfc_tagged_quick' });

    res.json({
      success: true,
      message: replacedOldUid 
        ? `Đã thay thế thẻ mới ${cleanUid} cho cây #${updatedPlant.tree_code || updatedPlant.id} và thu hồi thẻ cũ ${replacedOldUid}!`
        : `Đã gắn thẻ NFC ${cleanUid} và định vị GPS cho cây #${updatedPlant.tree_code || updatedPlant.id} thành công!`,
      plant: updatedPlant,
      public_url: publicUrl,
      replaced_old_uid: replacedOldUid
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error quick binding NFC tag and GPS:', err);
    res.status(500).json({ error: 'Lỗi server khi gắn thẻ và GPS: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── Single Plant High-Precision Provisioning via Smart NFC Gateway /sub ───
router.post(['/single-provision', '/plants/single-provision'], auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      farm_id,
      tree_code,
      plant_variety,
      plant_type,
      planting_date,
      plant_age,
      plot_code,
      row_number,
      latitude,
      longitude,
      gps_accuracy,
      location,
      cover_image,
      photo_url,
      nfc_uid,
      initial_yield,
      health_status,
      notes,
      past_diseases,
      initial_growth_stage,
      puc_code,
      passport_standard,
      vietgap_cert_number,
      vietgap_cert_org,
      seed_origin,
      batch_code
    } = req.body;

    const farmId = parseInt(farm_id || req.user.farm_id);
    if (!farmId || isNaN(farmId)) {
      return res.status(400).json({ error: 'Mã trang trại là bắt buộc.' });
    }

    // Permission check
    if (req.user.role !== 'admin' && Number(req.user.farm_id) !== farmId) {
      const farmOwn = await pool.query('SELECT user_id FROM farms WHERE id = $1', [farmId]);
      if (farmOwn.rows.length === 0 || Number(farmOwn.rows[0].user_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Bạn không có quyền thêm cây vào trang trại này.' });
      }
    }

    let lat = latitude !== undefined && latitude !== '' && latitude !== null ? parseFloat(latitude) : null;
    let lng = longitude !== undefined && longitude !== '' && longitude !== null ? parseFloat(longitude) : null;
    let acc = gps_accuracy !== undefined && gps_accuracy !== '' && gps_accuracy !== null ? parseFloat(gps_accuracy) : null;

    if (lat !== null && lng !== null) {
      if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
        const tmp = lat; lat = lng; lng = tmp;
      }
    }

    let cleanUid = null;
    if (nfc_uid && String(nfc_uid).trim()) {
      cleanUid = formatStandardNfcUid(nfc_uid);
    }

    // Check plot & ensure plot exists in farm_plots (safely outside transaction)
    const finalPlot = plot_code && String(plot_code).trim() ? String(plot_code).trim().toUpperCase() : 'A1';
    const finalRow = row_number && parseInt(row_number) ? parseInt(row_number) : 1;

    try {
      const existingPlot = await pool.query(
        'SELECT id FROM farm_plots WHERE farm_id = $1 AND UPPER(plot_code) = UPPER($2) LIMIT 1',
        [farmId, finalPlot]
      );
      if (existingPlot.rows.length === 0) {
        await pool.query(
          'INSERT INTO farm_plots (farm_id, plot_code, plot_name) VALUES ($1, $2, $3)',
          [farmId, finalPlot, `Lô ${finalPlot}`]
        );
      }
    } catch (_) {}

    // Check tree_code or generate auto tree_code
    let finalCode = tree_code && String(tree_code).trim() ? String(tree_code).trim() : null;
    if (!finalCode) {
      const countRes = await pool.query('SELECT COUNT(*)::int as count FROM plants WHERE farm_id = $1', [farmId]);
      const nextNum = (countRes.rows[0].count || 0) + 1;
      finalCode = `C${String(nextNum).padStart(3, '0')}`;
    }

    // Generate public slug
    const cleanVarietySlug = (plant_variety || plant_type || 'tree')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');
    const cleanCodeSlug = finalCode.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const randomSuffix = Math.floor(Math.random() * 89999 + 10000);
    const publicSlug = `${cleanVarietySlug}-${finalPlot.toLowerCase()}-${cleanCodeSlug}-${randomSuffix}`;

    const effectiveCover = photo_url || cover_image || null;
    const pastDiseasesList = Array.isArray(past_diseases) ? past_diseases : (past_diseases ? [past_diseases] : []);

    const plantMetadata = {
      gps_accuracy: acc,
      provision_source: 'sub_gateway',
      past_diseases: pastDiseasesList,
      initial_growth_stage: initial_growth_stage || null,
      initial_yield: initial_yield ? parseFloat(initial_yield) : 0,
      puc_code: puc_code || null,
      passport_standard: passport_standard || null,
      vietgap_cert_number: vietgap_cert_number || null,
      vietgap_cert_org: vietgap_cert_org || null,
      seed_origin: seed_origin || null,
      batch_code: batch_code || null
    };

    // BEGIN Transaction for core plant creation
    await client.query('BEGIN');

    // Insert plant
    const plantInsert = await client.query(`
      INSERT INTO plants (
        farm_id, tree_code, plant_variety, plant_type, planting_date,
        plant_age, plot_code, row_number, latitude, longitude,
        location, cover_image, nfc_uid, public_slug, health_status,
        data, is_public, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, true, $17
      ) RETURNING *
    `, [
      farmId, finalCode, plant_variety || 'Sầu riêng Ri6', plant_type || 'Sầu riêng', planting_date || null,
      plant_age || null, finalPlot, finalRow, lat, lng,
      location || `Lô ${finalPlot} - Hàng ${finalRow}`, effectiveCover, cleanUid, publicSlug, health_status || 'Tốt',
      JSON.stringify(plantMetadata), req.user.id
    ]);
    const newPlant = plantInsert.rows[0];

    // Auto-increment total_plants on farm
    await client.query('UPDATE farms SET total_plants = COALESCE(total_plants, 0) + 1 WHERE id = $1', [farmId]);

    // Sync farm passport certificates if supplied
    if (puc_code || vietgap_cert_number || vietgap_cert_org) {
      try {
        await client.query(`
          UPDATE farms 
          SET puc_code = COALESCE(puc_code, $1),
              vietgap_cert_number = COALESCE(vietgap_cert_number, $2),
              vietgap_cert_org = COALESCE(vietgap_cert_org, $3)
          WHERE id = $4
        `, [puc_code || null, vietgap_cert_number || null, vietgap_cert_org || null, farmId]);
      } catch (_) {}
    }

    await client.query('COMMIT');

    // URLs
    const origin = (process.env.APP_URL || 'https://dev-plantbook.onrender.com').replace(/\/$/, '');
    const uidSuffix = cleanUid ? `/${encodeURIComponent(cleanUid)}` : '';
    const hierarchicalUrl = `${origin}/${farmId}/${newPlant.id}${uidSuffix}`;
    const publicUrl = `${origin}/plant/${newPlant.public_slug}`;

    // Update public_url in DB
    try {
      await pool.query('UPDATE plants SET public_url = $1 WHERE id = $2', [hierarchicalUrl, newPlant.id]);
      newPlant.public_url = hierarchicalUrl;
    } catch (_) {}

    // Record initial photo in plant_media if provided
    if (effectiveCover) {
      try {
        await pool.query(`
          INSERT INTO plant_media (plant_id, object_name, url, caption, media_type, uploaded_at)
          VALUES ($1, $2, $3, $4, 'image', NOW())
        `, [newPlant.id, `growth_${newPlant.id}_${Date.now()}.jpg`, effectiveCover, initial_growth_stage || 'Ảnh chụp hiện trường khởi tạo']);
      } catch (mediaErr) {
        console.warn('Plant media insert notice:', mediaErr.message);
      }
    }

    // Record NFC UID in nfc_tags_inventory if provided
    if (cleanUid) {
      await syncPlantNfcToInventory(pool, {
        nfcUid: cleanUid,
        farmId,
        plantId: newPlant.id,
        userId: req.user.id,
        lat,
        lng
      }).catch((nfcErr) => {
        console.warn('NFC inventory update notice:', nfcErr.message);
      });
    }

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) broadcast('plants_updated', { plant_id: newPlant.id, farm_id: farmId, action: 'single_provision' });

    res.status(201).json({
      success: true,
      message: `Đã khai báo thành công cây #${newPlant.tree_code}!`,
      plant: newPlant,
      nfc_uid: cleanUid,
      public_url: publicUrl,
      hierarchical_url: hierarchicalUrl,
      gps_accuracy: acc
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error in single-provision:', err);
    res.status(500).json({ error: 'Lỗi server khi khai báo cây: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── Verify NFC Physical Tag Write Success & Auto-Sync UID to Plant ───
router.post(['/nfc/verify-write', '/plants/nfc/verify-write'], auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { plant_id, nfc_uid, written_url } = req.body;
    if (!plant_id) {
      return res.status(400).json({ error: 'Mã cây trồng là bắt buộc.' });
    }

    const cleanPlantId = parseInt(plant_id);
    const cleanUid = nfc_uid && String(nfc_uid).trim() ? formatStandardNfcUid(nfc_uid) : null;

    await client.query('BEGIN');

    let updatedPlant = null;
    if (cleanUid) {
      // 1. Kiểm tra cây trồng
      const plantRes = await client.query(
        `SELECT id, farm_id, tree_code, nfc_uid, latitude, longitude FROM plants WHERE id = $1`,
        [cleanPlantId]
      );

      if (plantRes.rows.length > 0) {
        const p = plantRes.rows[0];
        const newPublicUrl = written_url || generatePublicPlantUrl(p.farm_id, p.id, cleanUid);

        // 2. Cập nhật cây với UID mới và public URL
        const upRes = await client.query(
          `UPDATE plants 
           SET nfc_uid = $1, public_url = $2, updated_at = NOW() 
           WHERE id = $3 
           RETURNING id, farm_id, tree_code, nfc_uid, public_url, latitude, longitude`,
          [cleanUid, newPublicUrl, cleanPlantId]
        );
        updatedPlant = upRes.rows[0];

        // 3. Cập nhật / gán thẻ vào nfc_tags_inventory
        await syncPlantNfcToInventory(client, {
          nfcUid: cleanUid,
          farmId: p.farm_id,
          plantId: cleanPlantId,
          oldUid: p.nfc_uid,
          userId: req.user.id,
          lat: p.latitude,
          lng: p.longitude
        });
      }
    }

    // 4. Ghi log hoạt động
    await client.query(`
      INSERT INTO user_activities (user_id, activity_type, description)
      VALUES ($1, 'Ghi Thẻ NFC Thành Công', $2)
    `, [req.user.id, `Đã ghi thành công URL [${written_url || 'N/A'}] vào thẻ NFC [${cleanUid || 'N/A'}] cho Cây #${cleanPlantId}`]);

    await client.query('COMMIT');

    // 5. Broadcast cập nhật cây qua WebSocket
    try {
      const broadcast = req.app.get('broadcast');
      if (broadcast) broadcast('plants_updated', { plant_id: cleanPlantId, farm_id: updatedPlant?.farm_id, nfc_uid: cleanUid, action: 'nfc_verified' });
    } catch (_) {}

    res.json({
      success: true,
      message: cleanUid 
        ? `Đã cập nhật mã thẻ NFC ${cleanUid} vào Cây #${cleanPlantId} thành công!`
        : 'Đã xác nhận ghi thẻ NFC thành công!',
      plant: updatedPlant,
      nfc_uid: cleanUid,
      verified_at: new Date()
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error verifying NFC write:', err);
    res.status(500).json({ error: 'Lỗi server khi xác thực ghi thẻ: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── Public Farm Gateway & Smart NFC Portal: /farms/:farmId/public-portal ───

router.post('/:id(\\d+)/nfc-reissue', auth, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id, 10);
    const access = await verifyPlantAccess(req, plantId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }
    const plantRes = await pool.query('SELECT id, farm_id, nfc_uid, nfc_tag_id FROM plants WHERE id = $1 LIMIT 1', [plantId]);
    if (plantRes.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy cây trồng.' });
    const plant = plantRes.rows[0];
    const uid = formatStandardNfcUid(req.body.uid || plant.nfc_uid || plant.nfc_tag_id || `NFC-TB-${plantId}`);

    // Ensure column exists
    await pool.query(`
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS issue_level INTEGER DEFAULT 1;
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS card_type VARCHAR(50) DEFAULT 'NTAG213_CRYPTO';
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS trace_flag BOOLEAN DEFAULT false;
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS chuid_hash VARCHAR(128);
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS signature VARCHAR(128);
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `).catch(() => {});

    const existingTag = await pool.query(
      `SELECT * FROM nfc_tags_inventory WHERE UPPER(REPLACE(nfc_uid, ':', '')) = UPPER(REPLACE($1, ':', '')) OR plant_id = $2 LIMIT 1`,
      [uid, plantId]
    );
    let newIssueLevel = 2;
    if (existingTag.rows.length > 0) {
      const currLevel = parseInt(existingTag.rows[0].issue_level, 10) || 1;
      newIssueLevel = currLevel + 1;
      const newSig = nfcSecurity.generateSignature(uid, plantId, newIssueLevel);
      const newChuid = nfcSecurity.generatePivChuidHash(uid, plant.farm_id || 0, plantId, newIssueLevel);
      await pool.query(
        'UPDATE nfc_tags_inventory SET nfc_uid = COALESCE(nfc_uid, $1), farm_id = COALESCE(farm_id, $2), plant_id = $3, status = $4, issue_level = $5, signature = $6, hmac_signature = $6, chuid_hash = $7, updated_at = NOW() WHERE id = $8',
        [uid, plant.farm_id || null, plantId, 'assigned', newIssueLevel, newSig, newChuid, existingTag.rows[0].id]
      );
    } else {
      const newSig = nfcSecurity.generateSignature(uid, plantId, newIssueLevel);
      const newChuid = nfcSecurity.generatePivChuidHash(uid, plant.farm_id || 0, plantId, newIssueLevel);
      await pool.query(
        `INSERT INTO nfc_tags_inventory (nfc_uid, farm_id, plant_id, status, signature, hmac_signature, issue_level, card_type, chuid_hash, assigned_at, tagged_at, updated_at)
         VALUES ($1, $2, $3, 'assigned', $4, $4, $5, 'NTAG213_CRYPTO', $6, NOW(), NOW(), NOW())`,
        [uid, plant.farm_id || null, plantId, newSig, newIssueLevel, newChuid]
      ).catch(() => {});
    }

    const oldSig = nfcSecurity.generateSignature(uid, plantId, newIssueLevel - 1);
    const newSig = nfcSecurity.generateSignature(uid, plantId, newIssueLevel);
    const oldCardCheck = nfcSecurity.verifySignature(uid, plantId, oldSig, newIssueLevel - 1, newIssueLevel);
    const newCardCheck = nfcSecurity.verifySignature(uid, plantId, newSig, newIssueLevel, newIssueLevel);

    res.json({
      success: true,
      message: `Đã nâng cấp IssueLevel của thẻ NFC "${uid}" lên cấp ${newIssueLevel}. Thẻ cũ (IssueLevel ${newIssueLevel - 1}) đã bị vô hiệu hóa hoàn toàn!`,
      plant_id: plantId,
      uid,
      previous_issue_level: newIssueLevel - 1,
      active_issue_level: newIssueLevel,
      chuid_hash: nfcSecurity.generatePivChuidHash(uid, plant.farm_id || 0, plantId, newIssueLevel),
      old_card_verification: oldCardCheck,
      new_card_verification: newCardCheck
    });
  } catch (err) {
    console.error('Error re-issuing NFC card level:', err);
    res.status(500).json({ error: 'Lỗi cấp lại IssueLevel thẻ NFC: ' + err.message });
  }
});

// ─── Enterprise Local-First Offline Batch Synchronization Endpoint (Phase 3 & 4) ──

module.exports = router;
