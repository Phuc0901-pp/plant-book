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

router.delete('/:id', auth, admin, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id, 10);
    const existing = await pool.query('SELECT * FROM plants WHERE id=$1', [plantId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy cây trồng.' });
    }
    const oldPlant = existing.rows[0];

    // Soft Delete: Đánh dấu deleted_at = NOW()
    const result = await pool.query(
      `UPDATE plants SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [plantId]
    );

    // Release NFC tag in inventory back to unassigned whileplant is in trash
    await pool.query(
      `UPDATE nfc_tags_inventory SET status = 'unassigned', plant_id = NULL, tagged_at = NULL, updated_at = NOW() WHERE plant_id = $1`,
      [plantId]
    ).catch(() => {});

    // Ghi nhận Audit Log
    await logAudit({
      actionType: 'DELETE_PLANT',
      tableName: 'plants',
      recordId: plantId,
      userId: req.user.id,
      oldData: oldPlant,
      newData: { deleted_at: new Date().toISOString() },
      ipAddress: req.ip,
      notes: `Xóa mềm cây #${oldPlant.tree_code || plantId}`
    });

    // Xóa Cache & Broadcast Live Sync
    await invalidateAndBroadcast('plants_updated', {
      plant_id: plantId,
      farm_id: oldPlant.farm_id,
      action: 'soft_delete'
    }, ['farms_', 'plants_']);

    res.json({
      success: true,
      message: `Đã đưa cây #${oldPlant.tree_code || plantId} vào thùng rác an toàn (có thể khôi phục).`,
      plant: result.rows[0]
    });
  } catch (err) {
    console.error('Delete plant error:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa cây: ' + err.message });
  }
});

// ─── Restore Soft-Deleted Plant (Khôi phục cây từ thùng rác) ──────────────────
router.post('/:id/restore', auth, admin, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id, 10);
    const existing = await pool.query('SELECT * FROM plants WHERE id=$1', [plantId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy cây trồng.' });
    }
    const oldPlant = existing.rows[0];

    const result = await pool.query(
      `UPDATE plants SET deleted_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [plantId]
    );

    // Re-sync NFC tag back to inventory if plant had an NFC UID
    if (oldPlant.nfc_uid) {
      await syncPlantNfcToInventory(pool, {
        nfcUid: oldPlant.nfc_uid,
        farmId: oldPlant.farm_id,
        plantId,
        userId: req.user.id,
        lat: oldPlant.latitude,
        lng: oldPlant.longitude
      }).catch(() => {});
    }

    await logAudit({
      actionType: 'RESTORE_PLANT',
      tableName: 'plants',
      recordId: plantId,
      userId: req.user.id,
      oldData: oldPlant,
      newData: { deleted_at: null },
      ipAddress: req.ip,
      notes: `Khôi phục cây #${oldPlant.tree_code || plantId}`
    });

    await invalidateAndBroadcast('plants_updated', {
      plant_id: plantId,
      farm_id: oldPlant.farm_id,
      action: 'restore'
    }, ['farms_', 'plants_']);

    res.json({
      success: true,
      message: `Đã khôi phục thành công cây #${oldPlant.tree_code || plantId}!`,
      plant: result.rows[0]
    });
  } catch (err) {
    console.error('Restore plant error:', err);
    res.status(500).json({ error: 'Lỗi server khi khôi phục cây: ' + err.message });
  }
});

// GET /api/plants/:id/growth-photos (Only actual growth timeline photos)
router.get('/:id(\\d+)/growth-photos', auth, async (req, res) => {
  try {
    const plantId = req.params.id;
    const media = await pool.query(
      `SELECT * FROM plant_media 
       WHERE plant_id=$1 
         AND (object_name NOT LIKE '%/disease/%' AND (caption IS NULL OR caption NOT ILIKE 'Bệnh cây%'))
         AND media_type != 'video'
       ORDER BY uploaded_at DESC`, 
      [plantId]
    );
    res.json({ success: true, count: media.rows.length, media: media.rows });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy xuất lịch sử ảnh sinh trưởng: ' + err.message });
  }
});

// GET /api/plants/:id/disease-media (Photos/videos recorded during pest/disease events)
router.get('/:id(\\d+)/disease-media', auth, async (req, res) => {
  try {
    const plantId = req.params.id;
    const media = await pool.query(
      `SELECT * FROM plant_media 
       WHERE plant_id=$1 
         AND (object_name LIKE '%/disease/%' OR caption ILIKE 'Bệnh cây%' OR caption ILIKE '%sâu bệnh%')
       ORDER BY uploaded_at DESC`, 
      [plantId]
    );
    res.json({ success: true, count: media.rows.length, media: media.rows });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy xuất media bệnh cây: ' + err.message });
  }
});

// GET /api/plants/:id/media (All media)
router.get('/:id(\\d+)/media', auth, async (req, res) => {
  try {
    const plantId = req.params.id;
    const media = await pool.query('SELECT * FROM plant_media WHERE plant_id=$1 ORDER BY uploaded_at DESC', [plantId]);
    res.json({ success: true, count: media.rows.length, media: media.rows });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy xuất thư viện media: ' + err.message });
  }
});

router.post(['/:id/media', '/:id/growth-photo'], auth, upload.array('files', 20), async (req, res) => {
  try {
    const plantId = req.params.id;
    const plant = await pool.query('SELECT id FROM plants WHERE id=$1', [plantId]);
    if (plant.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy cây.' });

    const uploaded = [];
    const growthStage = (req.body.growth_stage || req.body.caption || 'Cập nhật sinh trưởng').trim();

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const objectName = `plants/${plantId}/${uuidv4()}${ext}`;
      const url = await uploadFile(objectName, file.buffer, file.mimetype);
      const mediaType = file.mimetype.startsWith('video') ? 'video' : 'image';

      const result = await pool.query(
        'INSERT INTO plant_media (plant_id, object_name, url, media_type, caption) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [plantId, objectName, url, mediaType, growthStage]
      );
      uploaded.push(result.rows[0]);
    }

    if (uploaded.length > 0 && uploaded[0].media_type === 'image') {
      await pool.query(
        'UPDATE plants SET cover_image=$1, updated_at=NOW() WHERE id=$2',
        [uploaded[0].url, plantId]
      );
    }

    // Record user activity
    if (uploaded.length > 0) {
      await pool.query(
        `INSERT INTO user_activities (user_id, activity_type, description)
         VALUES ($1, 'Tải lên hình ảnh sinh trưởng', $2)`,
        [req.user.id, `Tải lên ${uploaded.length} ảnh sinh trưởng (${growthStage}) cho cây #${plantId}`]
      );
    }

    const allMedia = await pool.query('SELECT * FROM plant_media WHERE plant_id=$1 ORDER BY uploaded_at DESC', [plantId]);

    res.json({
      success: true,
      uploaded,
      cover_image: uploaded.length > 0 ? uploaded[0].url : null,
      all_media: allMedia.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi upload ảnh sinh trưởng: ' + err.message });
  }
});

router.delete('/:plantId/media/:mediaId', auth, async (req, res) => {
  try {
    const { plantId, mediaId } = req.params;

    // Check if the plant exists and user has access
    const plant = await pool.query(
      `SELECT p.id, f.user_id as farm_owner_id
       FROM plants p 
       LEFT JOIN farms f ON f.id = p.farm_id
       WHERE p.id=$1`, [plantId]
    );
    if (plant.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy cây.' });

    const row = plant.rows[0];
    if (req.user.role !== 'admin' && row.farm_owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền quản lý ảnh của cây này.' });
    }

    const media = await pool.query('SELECT * FROM plant_media WHERE id=$1 AND plant_id=$2', [mediaId, plantId]);
    if (media.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy.' });

    if (req.user.role === 'admin') {
      // Admin: Delete permanently
      await deleteFile(media.rows[0].object_name);
      await pool.query('DELETE FROM plant_media WHERE id=$1', [mediaId]);
      res.json({ message: 'Đã xóa vĩnh viễn khỏi hệ thống.' });
    } else {
      // User (farmer): Mark delete_pending = true
      await pool.query('UPDATE plant_media SET delete_pending = true WHERE id=$1', [mediaId]);
      res.json({ message: 'Đã gửi yêu cầu xóa lên quản trị viên phê duyệt.' });
    }
  } catch (err) {
    console.error('Delete media error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.post('/:plantId/media/:mediaId/reject-delete', auth, admin, async (req, res) => {
  try {
    const { plantId, mediaId } = req.params;
    const media = await pool.query('SELECT * FROM plant_media WHERE id=$1 AND plant_id=$2', [mediaId, plantId]);
    if (media.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy phương tiện.' });

    await pool.query('UPDATE plant_media SET delete_pending = false WHERE id=$1', [mediaId]);
    res.json({ message: 'Đã khôi phục ảnh/video thành công.' });
  } catch (err) {
    console.error('Reject delete media error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.post(['/:id/logs', '/:id/care-log'], auth, async (req, res) => {
  try {
    const { 
      log_date, log_type, note, media_urls, details, 
      operator_name, equipment_used, phi_days: customPhiDays 
    } = req.body;
    const plantIdRaw = req.params.id;
    
    let targetPlantId = null;
    let plantType = 'Toàn vườn';
    let plantVariety = '';
    let farmId = null;
    let farmPuc = 'VN-TB';
    let treeCode = '';
    let existingPlant = null;

    if (plantIdRaw && plantIdRaw !== '0') {
      const plant = await pool.query(
        `SELECT p.*, f.user_id as farm_owner_id, f.puc_code as farm_puc_code
         FROM plants p 
         LEFT JOIN farms f ON f.id = p.farm_id 
         WHERE p.id=$1`, [plantIdRaw]
      );
      if (plant.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy cây.' });
      
      const isAssignedFarmer = req.user.farm_id && plant.rows[0].farm_id && req.user.farm_id === plant.rows[0].farm_id;
      if (req.user.role !== 'admin' && plant.rows[0].farm_owner_id !== req.user.id && !isAssignedFarmer) {
        return res.status(403).json({ error: 'Bạn không có quyền ghi nhật ký cho cây này.' });
      }
      existingPlant = plant.rows[0];
      targetPlantId = existingPlant.id;
      plantType = existingPlant.plant_type;
      plantVariety = existingPlant.plant_variety;
      farmId = existingPlant.farm_id;
      farmPuc = existingPlant.farm_puc_code || 'VN-TB';
      treeCode = existingPlant.tree_code || `#${existingPlant.id}`;
    }

    const effectiveDate = log_date || new Date().toISOString().slice(0, 10);
    const parsedDetails = typeof details === 'string' ? JSON.parse(details || '{}') : (details || {});
    
    // Tự động nhận diện và bảo vệ loại nhật ký Thu hoạch (Dual Defense)
    let effectiveLogType = log_type || 'Nhật ký chăm sóc';
    if (
      String(effectiveLogType).toLowerCase().includes('thu hoạch') ||
      String(effectiveLogType).toLowerCase().includes('harvest') ||
      parseFloat(parsedDetails.fruit_count) > 0 ||
      parseFloat(parsedDetails.price_per_tree) > 0 ||
      parseFloat(parsedDetails.total_revenue) > 0
    ) {
      effectiveLogType = 'Thu hoạch';
    }

    let generatedBatchCode = null;
    let isPhiViolation = false;

    // ── 1. VIETGAP PHUN THUỐC BVTV & TÍNH TOÁN CÁCH LY PHI ──
    if (effectiveLogType === 'Phun thuốc' && targetPlantId) {
      let phiDays = parseInt(customPhiDays || parsedDetails.phi_days) || 0;
      const pesticideName = parsedDetails.name || parsedDetails.pesticide_name || note || 'Thuốc BVTV';

      // Nếu chưa có phi_days trực tiếp, tự động tra cứu từ kho vật tư
      if (phiDays <= 0 && pesticideName) {
        const supplyLookup = await pool.query(
          `SELECT phi_days FROM supplies WHERE category = 'Phun thuốc' AND (name ILIKE $1 OR $2 ILIKE '%' || name || '%') AND phi_days > 0 LIMIT 1`,
          [pesticideName.trim(), pesticideName.trim()]
        );
        if (supplyLookup.rows.length > 0) {
          phiDays = supplyLookup.rows[0].phi_days;
        }
      }

      // Nếu có số ngày cách ly, tính ngày hết hạn PHI và cập nhật cây trồng
      if (phiDays > 0) {
        parsedDetails.phi_days = phiDays;
        const sprayDateObj = new Date(effectiveDate);
        sprayDateObj.setDate(sprayDateObj.getDate() + phiDays);
        const phiUntilDateStr = sprayDateObj.toISOString().slice(0, 10);
        parsedDetails.phi_until_date = phiUntilDateStr;

        await pool.query(
          `UPDATE plants 
           SET phi_until_date = $1, phi_status = 'quarantine', last_pesticide_date = $2, last_pesticide_name = $3, updated_at = NOW() 
           WHERE id = $4`,
          [phiUntilDateStr, effectiveDate, pesticideName, targetPlantId]
        );
      }
    }

    // ── 2. VIETGAP THU HOẠCH & SINH MÃ LÔ TRUY XUẤT NGUỒN GỐC ──
    if (effectiveLogType === 'Thu hoạch') {
      const dateClean = effectiveDate.replace(/-/g, '');
      const codeClean = (treeCode || 'TB').replace(/[^a-zA-Z0-9]/g, '');
      generatedBatchCode = `${farmPuc}-${dateClean}-${codeClean}`;
      parsedDetails.batch_code = generatedBatchCode;
      parsedDetails.puc_code = farmPuc;

      // Kiểm tra xem cây có đang trong thời gian cách ly PHI hay không
      if (existingPlant && existingPlant.phi_until_date) {
        const harvestTime = new Date(effectiveDate).getTime();
        const phiUntilTime = new Date(existingPlant.phi_until_date).getTime();
        if (harvestTime <= phiUntilTime) {
          isPhiViolation = true;
          parsedDetails.is_phi_violation = true;
          parsedDetails.phi_violation_warning = `CẢNH BÁO VI PHẠM VIETGAP: Thu hoạch sớm trong thời gian cách ly thuốc BVTV (Hết hạn cách ly: ${existingPlant.phi_until_date})`;
        }
      }
    }

    // ── 3. TỰ ĐỘNG TÍNH TOÁN & GHI NHẬN TIÊU HAO VẬT TƯ TRƯỚC KHI LƯU ──
    let resolvedSupply = null;
    let resolvedUsageQty = 0;
    let resolvedUnitPrice = 0;
    let resolvedTotCost = parseFloat(parsedDetails.total_cost) || 0;

    // Chỉ tính toán trừ kho và vật tư tiêu hao nếu KHÔNG PHẢI là Thu hoạch
    if (effectiveLogType !== 'Thu hoạch') {
      try {
        let resolvedSupplyId = parsedDetails.supply_id || null;
        const rawAmount = parseFloat(parsedDetails.quantity || parsedDetails.volume || parsedDetails.amount || 0);
        const rawUnit = (parsedDetails.unit || '').toLowerCase().trim();
        const supplyName = parsedDetails.supply_name || parsedDetails.material_name || parsedDetails.fertilizer_name || parsedDetails.pesticide_name || null;

        if (!resolvedSupplyId && supplyName) {
          const foundSup = await pool.query(
            `SELECT id, name, unit, unit_price, category, stock_quantity FROM supplies WHERE (user_id = $1 OR farm_id = $2) AND (name ILIKE $3 OR $3 ILIKE '%' || name || '%') LIMIT 1`,
            [req.user.id, farmId || null, supplyName]
          );
          if (foundSup.rows.length > 0) {
            resolvedSupplyId = foundSup.rows[0].id;
            resolvedSupply = foundSup.rows[0];
          }
        } else if (resolvedSupplyId) {
          const foundSup = await pool.query(
            `SELECT id, name, unit, unit_price, category, stock_quantity FROM supplies WHERE id = $1`,
            [resolvedSupplyId]
          );
          if (foundSup.rows.length > 0) {
            resolvedSupply = foundSup.rows[0];
          }
        }

        // Tự động gán hoặc khởi tạo hạng mục Nhân công trong bảng supplies nếu ghi nhật ký Nhân công
        if (effectiveLogType === 'Nhân công' && !resolvedSupply) {
          const laborSup = await pool.query(
            `SELECT id, name, unit, unit_price, category, stock_quantity FROM supplies WHERE (user_id = $1 OR ($2::int IS NOT NULL AND farm_id = $2)) AND category = 'Nhân công' ORDER BY id ASC LIMIT 1`,
            [req.user.id, farmId || null]
          );
          if (laborSup.rows.length > 0) {
            resolvedSupply = laborSup.rows[0];
            resolvedSupplyId = resolvedSupply.id;
          } else if (resolvedTotCost > 0) {
            const defaultWorkerPrice = parseFloat(parsedDetails.cost_per_worker || parsedDetails.unit_price || resolvedTotCost) || 300000;
            const createdLaborSup = await pool.query(
              `INSERT INTO supplies (user_id, farm_id, category, name, unit, package_size, package_qty, package_unit, package_price, unit_price, unit_price_small, stock_quantity, note)
               VALUES ($1, $2, 'Nhân công', 'Nhân công canh tác', 'ngày công', '1 ngày công', 1, 'ngày công', $3, $3, $3, 999999, 'Tự động tạo từ Nhật ký thuê nhân công')
               RETURNING id, name, unit, unit_price, category, stock_quantity`,
              [req.user.id, farmId || null, defaultWorkerPrice]
            );
            if (createdLaborSup.rows.length > 0) {
              resolvedSupply = createdLaborSup.rows[0];
              resolvedSupplyId = resolvedSupply.id;
            }
          }
        }

        if (resolvedSupply && (rawAmount > 0 || (effectiveLogType === 'Nhân công' && resolvedTotCost > 0))) {
          if (effectiveLogType === 'Nhân công') {
            resolvedUsageQty = parseFloat(parsedDetails.quantity || parsedDetails.worker_count || rawAmount || 1) || 1;
            resolvedUnitPrice = parseFloat(parsedDetails.cost_per_worker || parsedDetails.unit_price || resolvedSupply.unit_price) || 0;
            resolvedTotCost = resolvedTotCost > 0 ? resolvedTotCost : (resolvedUsageQty * resolvedUnitPrice);

            parsedDetails.supply_id = resolvedSupply.id;
            parsedDetails.supply_name = parsedDetails.work_content ? `Nhân công: ${parsedDetails.work_content}` : resolvedSupply.name;
            parsedDetails.material_name = parsedDetails.supply_name;
            parsedDetails.unit_price = resolvedUnitPrice;
            parsedDetails.total_cost = resolvedTotCost;
            parsedDetails.usage_quantity = resolvedUsageQty;
          } else {
            const supUnit = (resolvedSupply.unit || 'kg').toLowerCase().trim();
            resolvedUsageQty = convertLogAmountToBaseSupplyQty(rawAmount, rawUnit, supUnit, effectiveLogType);
            resolvedUnitPrice = parseFloat(resolvedSupply.unit_price) || 0;
            resolvedTotCost = resolvedTotCost > 0 ? resolvedTotCost : (resolvedUsageQty * resolvedUnitPrice);

            parsedDetails.supply_id = resolvedSupply.id;
            parsedDetails.supply_name = resolvedSupply.name;
            parsedDetails.material_name = resolvedSupply.name;
            parsedDetails.unit_price = resolvedUnitPrice;
            parsedDetails.total_cost = resolvedTotCost;
            parsedDetails.usage_quantity = resolvedUsageQty;
          }
        }
      } catch (supErr) {
        console.warn('Cảnh báo tính toán chi phí vật tư trước khi lưu:', supErr.message);
      }
    }

    const result = await pool.query(
      `INSERT INTO plant_logs (
        plant_id, log_date, log_type, note, media_urls, details, created_by,
        batch_code, puc_code, operator_name, equipment_used, is_phi_violation
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        targetPlantId, effectiveDate, effectiveLogType, note,
        JSON.stringify(media_urls || []), JSON.stringify(parsedDetails), req.user.id,
        generatedBatchCode, farmPuc, operator_name || req.user.full_name || req.user.name,
        equipment_used || null, isPhiViolation
      ]
    );
    await sealPlantLogHashChain(pool, result.rows[0]);

    // Ghi nhận vào supply_usages nếu có vật tư
    if (resolvedSupply && resolvedUsageQty > 0) {
      try {
        const rawAmount = parseFloat(parsedDetails.quantity || parsedDetails.volume || parsedDetails.amount || 0);
        const rawUnit = (parsedDetails.unit || '').toLowerCase().trim();
        await pool.query(
          `INSERT INTO supply_usages (user_id, supply_id, farm_id, plant_id, usage_date, quantity, unit_price, total_cost, note)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [req.user.id, resolvedSupply.id, farmId || null, targetPlantId || null, effectiveDate, resolvedUsageQty, resolvedUnitPrice, resolvedTotCost, `Tự động từ nhật ký [${effectiveLogType}] (${rawAmount} ${rawUnit || resolvedSupply.unit}${targetPlantId ? ' cho cây ' + treeCode : ' toàn vườn'})`]
        );

        if (resolvedSupply.category !== 'Tiền nước' && resolvedSupply.category !== 'Nhân công' && resolvedSupply.stock_quantity > 0) {
          await pool.query('UPDATE supplies SET stock_quantity = GREATEST(0, stock_quantity - $1), updated_at = NOW() WHERE id = $2', [resolvedUsageQty, resolvedSupply.id]);
        }
      } catch (usageInsertErr) {
        console.warn('Lỗi ghi nhận supply_usages:', usageInsertErr.message);
      }
    }

    // Tự động chuyển trạng thái cây thành Bệnh nếu ghi nhật ký Bệnh cây
    if (effectiveLogType === 'Bệnh cây' && targetPlantId) {
      await pool.query(
        `UPDATE plants SET health_status = 'Bệnh', updated_at = NOW() WHERE id = $1`,
        [targetPlantId]
      );
    }

    // Record user activity
    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Ghi nhật ký', $2)`,
      [req.user.id, `Ghi nhận nhật ký [${log_type}] cho ${targetPlantId ? 'cây ' + treeCode : 'Toàn vườn'}${generatedBatchCode ? ' (Lô: ' + generatedBatchCode + ')' : ''}`]
    );

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('new_care_log', {
        log: result.rows[0],
        plant_type: plantType,
        plant_variety: plantVariety,
        creator_name: req.user.name
      });
      broadcast('supplies_updated', { userId: req.user.id, log: result.rows[0] });
      broadcast('plants_updated');
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting log:', err);
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
});


router.put('/:plantId/logs/:logId', auth, async (req, res) => {
  try {
    const { plantId, logId } = req.params;
    const { log_date, log_type, note, details, media_urls } = req.body;

    // Check if plant exists and check farm ownership for user role
    const plant = await pool.query(
      `SELECT p.id, f.user_id 
       FROM plants p 
       LEFT JOIN farms f ON f.id = p.farm_id 
       WHERE p.id = $1`, [plantId]
    );
    if (plant.rows.length === 0) {
      return res.status(404).json({ error: 'Cây trồng không tồn tại.' });
    }

    if (req.user.role !== 'admin' && plant.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa nhật ký của cây trồng này.' });
    }

    // Get current log to save in history
    const logRes = await pool.query('SELECT * FROM plant_logs WHERE id=$1 AND plant_id=$2', [logId, plantId]);
    if (logRes.rows.length === 0) {
      return res.status(404).json({ error: 'Nhật ký không tồn tại.' });
    }

    const currentLog = logRes.rows[0];

    // Create history snapshot
    const historyItem = {
      edited_at: new Date().toISOString(),
      edited_by: req.user.id,
      edited_by_name: req.user.full_name || req.user.email,
      previous_version: {
        log_date: currentLog.log_date,
        log_type: currentLog.log_type,
        note: currentLog.note,
        details: currentLog.details,
        media_urls: currentLog.media_urls
      }
    };

    const editHistory = [...(currentLog.edit_history || []), historyItem];

    // Tự động nhận diện và bảo vệ loại nhật ký Thu hoạch
    const parsedPutDetails = details || currentLog.details || {};
    let targetLogType = log_type || currentLog.log_type;
    if (
      String(targetLogType).toLowerCase().includes('thu hoạch') ||
      String(targetLogType).toLowerCase().includes('harvest') ||
      parseFloat(parsedPutDetails.fruit_count) > 0 ||
      parseFloat(parsedPutDetails.price_per_tree) > 0 ||
      parseFloat(parsedPutDetails.total_revenue) > 0
    ) {
      targetLogType = 'Thu hoạch';
    }

    // Update log
    const updated = await pool.query(
      `UPDATE plant_logs 
       SET log_date = $1, log_type = $2, note = $3, details = $4, media_urls = $5, edit_history = $6, updated_at = NOW() 
       WHERE id = $7 AND plant_id = $8 RETURNING *`,
      [
        log_date || currentLog.log_date,
        targetLogType,
        note !== undefined ? note : currentLog.note,
        JSON.stringify(parsedPutDetails),
        JSON.stringify(media_urls || currentLog.media_urls || []),
        JSON.stringify(editHistory),
        logId,
        plantId
      ]
    );

    // Record user activity & audit history
    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, description)
       VALUES ($1, 'Sửa nhật ký', $2)`,
      [req.user.id, `Chỉnh sửa nhật ký [${targetLogType}] cho cây #${plantId} (ID nhật ký: ${logId})`]
    );

    logAuditAction(
      req.user.id,
      req.user.full_name || req.user.email,
      'UPDATE',
      'Nhật ký canh tác',
      logId,
      `Chỉnh sửa nhật ký "${log_type || currentLog.log_type}" cho cây #${plantId}`,
      currentLog,
      updated.rows[0]
    );

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('plants_updated', { message: `Care log edited on plant #${plantId}` });
      broadcast('supplies_updated', { message: `Care log edited on plant #${plantId}` });
    }

    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Error updating log:', err);
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
});

// ─── Helper function for building dynamic filter queries for batch logs ───

router.post('/logs/batch-delete/preview', auth, async (req, res) => {
  try {
    const { baseQuery, params } = buildLogFilterQuery(req, req.body || {});
    const countRes = await pool.query(`SELECT COUNT(pl.id)::int as count ${baseQuery}`, params);
    const sampleRes = await pool.query(
      `SELECT pl.id, pl.log_date, pl.log_type, pl.note, COALESCE(p.tree_code, 'Toàn vườn') as tree_code, COALESCE(f.name, 'Trang trại') as farm_name ${baseQuery} ORDER BY pl.log_date DESC, pl.id DESC LIMIT 5`,
      params
    );
    res.json({
      count: countRes.rows[0]?.count || 0,
      samples: sampleRes.rows
    });
  } catch (err) {
    console.error('Batch delete preview error:', err);
    res.status(500).json({ error: 'Lỗi server khi tính toán số lượng bản ghi: ' + err.message });
  }
});

// POST /api/plants/logs/batch-delete — Thực thi xóa mềm hoặc xóa cứng hàng loạt theo bộ lọc
router.post('/logs/batch-delete', auth, async (req, res) => {
  try {
    const { baseQuery, params } = buildLogFilterQuery(req, req.body || {});
    const isPermanent = req.body.permanent === true && req.user.role === 'admin';

    // Lấy danh sách ID bản ghi khớp điều kiện
    const findRes = await pool.query(`SELECT pl.id, pl.plant_id, pl.log_type, pl.log_date, pl.note, pl.details ${baseQuery}`, params);
    const matchedLogs = findRes.rows;

    if (matchedLogs.length === 0) {
      return res.json({ success: true, count: 0, message: 'Không có nhật ký nào khớp với điều kiện lọc.' });
    }

    const logIds = matchedLogs.map(l => l.id);

    if (isPermanent) {
      await pool.query('DELETE FROM plant_logs WHERE id = ANY($1::int[])', [logIds]);
    } else {
      await pool.query('UPDATE plant_logs SET is_deleted = true, deleted_at = NOW() WHERE id = ANY($1::int[])', [logIds]);
    }

    // Ghi audit log
    const filterDesc = [];
    if (req.body.date) filterDesc.push(`Ngày: ${req.body.date}`);
    if (req.body.from_date || req.body.to_date) filterDesc.push(`Từ ${req.body.from_date || '...'} đến ${req.body.to_date || '...'}`);
    if (req.body.log_type && req.body.log_type !== 'all') filterDesc.push(`Loại: ${req.body.log_type}`);
    if (req.body.plant_id && req.body.plant_id !== 'all') filterDesc.push(`Cây: #${req.body.plant_id}`);
    const filterStr = filterDesc.length > 0 ? ` (${filterDesc.join(', ')})` : '';

    logAuditAction(
      req.user.id,
      req.user.full_name || req.user.email,
      isPermanent ? 'DELETE' : 'DELETE_SOFT',
      'Nhật ký canh tác',
      logIds.length === 1 ? logIds[0] : 0,
      `Xóa ${isPermanent ? 'vĩnh viễn' : 'mềm'} ${logIds.length} nhật ký canh tác${filterStr}`,
      { deleted_count: logIds.length, sample_ids: logIds.slice(0, 50), deleted_ids: logIds },
      {},
      `Xóa ${isPermanent ? 'vĩnh viễn' : 'mềm'} qua bộ lọc chọn lọc`
    );

    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('plants_updated', { message: `Batch ${logIds.length} care logs deleted` });
      broadcast('supplies_updated', { message: `Batch ${logIds.length} care logs deleted` });
    }

    res.json({
      success: true,
      count: logIds.length,
      message: `Đã ${isPermanent ? 'xóa vĩnh viễn' : 'xóa mềm'} thành công ${logIds.length} bản ghi nhật ký canh tác.`
    });
  } catch (err) {
    console.error('Batch delete logs error:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa nhật ký: ' + err.message });
  }
});

// POST /api/plants/logs/:logId/restore — Khôi phục 1 nhật ký đã bị xóa mềm
router.post('/logs/:logId/restore', auth, async (req, res) => {
  try {
    const logId = parseInt(req.params.logId);
    const logRes = await pool.query(
      `SELECT pl.*, p.farm_id, f.user_id as farm_owner_id
       FROM plant_logs pl
       LEFT JOIN plants p ON p.id = pl.plant_id
       LEFT JOIN farms f ON f.id = p.farm_id
       WHERE pl.id = $1`,
      [logId]
    );
    if (logRes.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy nhật ký.' });
    const row = logRes.rows[0];

    const isAuthorized = req.user.role === 'admin' 
      || row.farm_owner_id === req.user.id 
      || row.created_by === req.user.id 
      || (req.user.farm_id && req.user.farm_id === row.farm_id);
    if (!isAuthorized) return res.status(403).json({ error: 'Bạn không có quyền khôi phục nhật ký này.' });

    await pool.query('UPDATE plant_logs SET is_deleted = false, deleted_at = NULL WHERE id = $1', [logId]);

    logAuditAction(
      req.user.id,
      req.user.full_name || req.user.email,
      'UPDATE',
      'Nhật ký canh tác',
      logId,
      `Khôi phục nhật ký "${row.log_type}" của cây #${row.plant_id || row.tree_code || ''}`,
      { is_deleted: true },
      { is_deleted: false }
    );

    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('plants_updated', { message: `Care log #${logId} restored` });
    }

    res.json({ success: true, message: 'Đã khôi phục nhật ký thành công.' });
  } catch (err) {
    console.error('Restore log error:', err);
    res.status(500).json({ error: 'Lỗi server khi khôi phục nhật ký: ' + err.message });
  }
});

// DELETE /api/plants/:plantId/logs/:logId & DELETE /api/plants/logs/:logId — Xóa 1 nhật ký (Hỗ trợ Xóa Mềm mặc định)
router.delete(['/:plantId/logs/:logId', '/logs/:logId'], auth, async (req, res) => {
  try {
    const logId = parseInt(req.params.logId);
    const plantId = req.params.plantId ? parseInt(req.params.plantId) : null;

    let queryStr = `
      SELECT pl.*, p.farm_id, f.user_id as farm_owner_id, p.tree_code
      FROM plant_logs pl
      LEFT JOIN plants p ON p.id = pl.plant_id
      LEFT JOIN farms f ON f.id = p.farm_id
      WHERE pl.id = $1
    `;
    const qParams = [logId];
    if (plantId) {
      queryStr += ` AND pl.plant_id = $2`;
      qParams.push(plantId);
    }

    const currentLog = await pool.query(queryStr, qParams);
    if (currentLog.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi nhật ký cần xóa.' });
    }
    const logRow = currentLog.rows[0];

    const isAuthorized = req.user.role === 'admin' 
      || logRow.farm_owner_id === req.user.id 
      || logRow.created_by === req.user.id 
      || (req.user.farm_id && req.user.farm_id === logRow.farm_id);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa nhật ký này.' });
    }

    const isPermanent = req.query.permanent === 'true' && req.user.role === 'admin';

    if (isPermanent) {
      await pool.query('DELETE FROM plant_logs WHERE id = $1', [logId]);
    } else {
      await pool.query('UPDATE plant_logs SET is_deleted = true, deleted_at = NOW() WHERE id = $1', [logId]);
    }

    logAuditAction(
      req.user.id,
      req.user.full_name || req.user.email,
      isPermanent ? 'DELETE' : 'DELETE_SOFT',
      'Nhật ký canh tác',
      logId,
      `Xóa ${isPermanent ? 'vĩnh viễn' : 'mềm'} nhật ký "${logRow.log_type}" của cây #${logRow.tree_code || logRow.plant_id || ''}`,
      logRow,
      {}
    );

    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('plants_updated', { message: `Care log deleted on plant #${logRow.plant_id}` });
      broadcast('supplies_updated', { message: `Care log deleted on plant #${logRow.plant_id}` });
    }
    
    res.json({ success: true, message: `Đã ${isPermanent ? 'xóa vĩnh viễn' : 'xóa mềm'} nhật ký.` });
  } catch (err) {
    console.error('Delete care log error:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa nhật ký: ' + err.message });
  }
});

// ─── Get Unassigned Trees in Farm (Auth required) ───────────────────

router.post('/offline-batch-sync', auth, async (req, res) => {
  try {
    const careLogs = Array.isArray(req.body?.care_logs) ? req.body.care_logs : [];
    const fieldMutations = Array.isArray(req.body?.field_mutations) ? req.body.field_mutations : [];

    let syncedLogs = 0;
    let syncedMutations = 0;

    // 1. Process Offline Care Logs
    for (const item of careLogs) {
      const targetIds = Array.isArray(item.plant_ids) && item.plant_ids.length > 0
        ? item.plant_ids
        : (item.plant_id ? [item.plant_id] : []);

      for (const rawPid of targetIds) {
        const pid = parseInt(rawPid, 10);
        if (isNaN(pid)) continue;
        const access = await verifyPlantAccess(req, pid);
        if (!access.ok) continue;

        const logDate = item.log_date || new Date().toISOString().slice(0, 10);
        const logType = item.log_type || item.action || 'Chăm sóc';
        const rawNote = item.note || item.description || '';
        const noteText = rawNote.trim() ? `${rawNote} (Đồng bộ ngoại tuyến)` : '(Đồng bộ ngoại tuyến)';
        const mediaJson = JSON.stringify(Array.isArray(item.media_urls) ? item.media_urls : []);
        const detailsJson = JSON.stringify(item.details || {});

        const insRes = await pool.query(
          `INSERT INTO plant_logs (plant_id, created_by, log_date, log_type, note, media_urls, details, operator_name, equipment_used)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            pid,
            req.user.id,
            logDate,
            logType,
            noteText,
            mediaJson,
            detailsJson,
            item.operator_name || req.user.full_name || 'Nông hộ',
            item.equipment_used || null
          ]
        );
        if (insRes.rows[0]) {
          await sealPlantLogHashChain(pool, insRes.rows[0]);
          await pool.query(
            `UPDATE plants SET updated_at = NOW() WHERE id = $1`,
            [pid]
          );
          syncedLogs++;
        }
      }
    }

    // 2. Process Offline Field Mutations (GPS, NFC, Location)
    for (const mut of fieldMutations) {
      const pid = parseInt(mut.plant_id, 10);
      if (isNaN(pid)) continue;
      const access = await verifyPlantAccess(req, pid);
      if (!access.ok) continue;

      const lat = mut.latitude !== undefined && mut.latitude !== null ? parseFloat(mut.latitude) : null;
      const lng = mut.longitude !== undefined && mut.longitude !== null ? parseFloat(mut.longitude) : null;

      if (mut.mutation_type === 'gps_update' && lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
        await pool.query(
          `UPDATE plants SET latitude = $1, longitude = $2, updated_at = NOW() WHERE id = $3`,
          [lat, lng, pid]
        );
        syncedMutations++;
      } else if (mut.mutation_type === 'location_update') {
        await pool.query(
          `UPDATE plants SET location = COALESCE($1, location), latitude = COALESCE($2, latitude), longitude = COALESCE($3, longitude), updated_at = NOW() WHERE id = $4`,
          [mut.location || null, !isNaN(lat) ? lat : null, !isNaN(lng) ? lng : null, pid]
        );
        syncedMutations++;
      } else if (mut.mutation_type === 'nfc_assign') {
        const cleanUid = mut.nfc_uid ? formatStandardNfcUid(mut.nfc_uid) : null;
        const upPlantRes = await pool.query(
          `UPDATE plants SET nfc_uid = $1, latitude = COALESCE($2, latitude), longitude = COALESCE($3, longitude), updated_at = NOW() WHERE id = $4 RETURNING id, farm_id, latitude, longitude`,
          [cleanUid, !isNaN(lat) ? lat : null, !isNaN(lng) ? lng : null, pid]
        );
        if (cleanUid && upPlantRes.rows[0]) {
          await syncPlantNfcToInventory(pool, {
            nfcUid: cleanUid,
            farmId: upPlantRes.rows[0].farm_id,
            plantId: pid,
            userId: req.user.id,
            lat: upPlantRes.rows[0].latitude,
            lng: upPlantRes.rows[0].longitude
          }).catch(() => {});
        }
        syncedMutations++;
      }
    }

    // 3. Enqueue Background Post-Processing & Spatial Cache Refresh Jobs
    await queueService.publish('care_log.batch_synced', {
      user_id: req.user.id,
      synced_logs: syncedLogs,
      synced_mutations: syncedMutations
    });

    if (syncedMutations > 0) {
      await queueService.publish('gis.spatial_index_refresh', {
        user_id: req.user.id
      });
    }

    res.json({
      success: true,
      synced_logs: syncedLogs,
      synced_mutations: syncedMutations,
      message: `Đã đồng bộ hàng loạt ${syncedLogs} nhật ký và ${syncedMutations} thao tác thực địa thành công!`
    });
  } catch (err) {
    console.error('Error in offline-batch-sync:', err);
    res.status(500).json({ error: 'Lỗi đồng bộ hàng loạt: ' + err.message });
  }
});

module.exports = router;


module.exports = router;
