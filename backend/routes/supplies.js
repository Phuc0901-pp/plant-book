const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { logAuditAction } = require('./history');


// ─── 1. SUPPLIES CRUD ─────────────────────────────────────────────

// Helper function chuẩn hóa đơn vị tiêu hao vật tư về đơn vị cơ sở
function convertSupplyQtyToBaseUnit(rawAmount, rawUnit, supplyUnit) {
  const amt = parseFloat(rawAmount) || 0;
  if (amt <= 0) return 0;
  const rUnit = (rawUnit || '').toLowerCase().trim();
  const sUnit = (supplyUnit || 'kg').toLowerCase().trim();

  if (sUnit === 'kg' || sUnit === 'kilogram' || sUnit === 'ký' || sUnit === 'ky') {
    if (rUnit === 'gam' || rUnit === 'g' || rUnit === 'gram' || rUnit === 'gr') return amt / 1000;
    if (rUnit === 'mg' || rUnit === 'miligam') return amt / 1000000;
    if (rUnit === 'tạ' || rUnit === 'ta') return amt * 100;
    if (rUnit === 'tấn' || rUnit === 'tan') return amt * 1000;
    return amt;
  }
  if (sUnit === 'lít' || sUnit === 'lit' || sUnit === 'l') {
    if (rUnit === 'ml' || rUnit === 'cc' || rUnit === 'mililit') return amt / 1000;
    if (rUnit === 'm3' || rUnit === 'm³' || rUnit === 'khối') return amt * 1000;
    return amt;
  }
  if (sUnit === 'm3' || sUnit === 'm³' || sUnit === 'khối') {
    if (rUnit === 'lít' || rUnit === 'lit' || rUnit === 'l') return amt / 1000;
    if (rUnit === 'ml' || rUnit === 'cc') return amt / 1000000;
    return amt;
  }
  if (sUnit === 'gam' || sUnit === 'g' || sUnit === 'gram') {
    if (rUnit === 'kg' || rUnit === 'kilogram' || rUnit === 'ký') return amt * 1000;
    return amt;
  }
  if (sUnit === 'ml') {
    if (rUnit === 'lít' || rUnit === 'lit' || rUnit === 'l') return amt * 1000;
    return amt;
  }
  return amt;
}

const lastReconcileByUserMap = new Map();

function isSupplyFinanceRedacted(user, queryRole) {
  if (!user || user.role === 'admin') return false;
  if (user.allow_view_finance === false) return true;
  if (queryRole === 'care_worker' || queryRole === 'auditor_readonly') return true;
  if (['care_worker', 'auditor_readonly'].includes(user.sub_role) && user.allow_view_finance !== true) return true;
  return false;
}

// Function tự động kiểm tra và hiệu chỉnh dữ liệu tồn kho & tiêu hao bị lỗi đơn vị trước đây (Có bộ đệm chống nghẽn hiệu năng)
async function autoReconcileSuppliesData(userId, force = false) {
  try {
    const uidKey = userId || 0;
    const now = Date.now();
    if (!force && lastReconcileByUserMap.has(uidKey)) {
      const lastRun = lastReconcileByUserMap.get(uidKey);
      if (now - lastRun < 5 * 60 * 1000) {
        return;
      }
    }
    lastReconcileByUserMap.set(uidKey, now);

    // 1. Tìm các bản ghi supply_usages có liều lượng bất thường do chưa quy đổi gram -> kg
    const corruptedUsages = await pool.query(`
      SELECT su.id, su.supply_id, su.quantity, su.unit_price, su.note, s.unit, s.package_qty, s.package_price
      FROM supply_usages su
      JOIN supplies s ON su.supply_id = s.id
      WHERE (su.user_id = $1 OR s.user_id = $1)
        AND s.unit IN ('kg', 'lít', 'm3', 'm³')
        AND su.quantity >= 10
        AND (
          su.note ILIKE '%gam%' OR su.note ILIKE '% g %' OR su.note ILIKE '% g)' OR su.note ILIKE '%ml%' OR su.note ILIKE '%gram%'
          OR su.total_cost > (s.package_price * 1.5)
        )
    `, [uidKey]);

    for (const row of corruptedUsages.rows) {
      const realQty = row.quantity / 1000;
      const realCost = realQty * (parseFloat(row.unit_price) || 0);
      await pool.query(
        `UPDATE supply_usages 
         SET quantity = $1, total_cost = $2, note = $3
         WHERE id = $4`,
        [realQty, realCost, (row.note || '') + ' [Đã chuẩn hóa đơn vị kg]', row.id]
      );
    }

    // 2. Tự động phục hồi tồn kho cho các vật tư có stock_quantity = 0 hoặc bị âm bất thường
    const suppliesToFix = await pool.query(`
      SELECT s.id, s.package_qty, s.stock_quantity, s.category,
             COALESCE(SUM(su.quantity), 0) as total_used
      FROM supplies s
      LEFT JOIN supply_usages su ON su.supply_id = s.id
      WHERE s.category NOT IN ('Tiền nước', 'Nhân công')
        AND (s.user_id = $1 OR $1 = 0)
      GROUP BY s.id
    `, [uidKey]);

    for (const sup of suppliesToFix.rows) {
      const pkgQty = parseFloat(sup.package_qty) || 50;
      const totalUsed = parseFloat(sup.total_used) || 0;
      const currentStock = parseFloat(sup.stock_quantity) || 0;
      
      if (currentStock === 0 && totalUsed < pkgQty) {
        const expectedStock = Math.max(0, pkgQty - totalUsed);
        await pool.query(
          `UPDATE supplies SET stock_quantity = $1, updated_at = NOW() WHERE id = $2`,
          [expectedStock, sup.id]
        );
      }
    }
  } catch (reconcileErr) {
    console.warn('Cảnh báo tự động cân đối dữ liệu kho vật tư:', reconcileErr.message);
  }
}

// GET /api/supplies — Lấy danh sách vật tư khai báo (kèm hỗ trợ phân quyền dùng chung vật tư trang trại)
router.get('/', auth, async (req, res) => {
  try {
    const { category, search, user_id, farm_id } = req.query;

    if (req.user.role !== 'admin' && req.user.allow_view_supplies === false) {
      return res.status(403).json({ error: 'Tài khoản của bạn không được cấp quyền truy cập Kho Vật tư.' });
    }

    // Tự động kiểm tra và cân đối số liệu kho nếu có sai sót đơn vị
    await autoReconcileSuppliesData(req.user.parent_user_id || req.user.id);
    
    let query = `
      SELECT s.*, 
             u.full_name as creator_name,
             COALESCE(SUM(su.total_cost), 0) as total_spent,
             COALESCE(SUM(su.quantity), 0) as total_used_qty
      FROM supplies s
      LEFT JOIN supply_usages su ON su.supply_id = s.id
      LEFT JOIN users u ON u.id = s.user_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (req.user.role === 'admin') {

      if (farm_id) {
        query += ` AND (s.farm_id = $${idx} OR s.user_id = (SELECT user_id FROM farms WHERE id = $${idx}) OR s.id IN (SELECT supply_id FROM supply_usages WHERE farm_id = $${idx}))`;
        params.push(parseInt(farm_id));
        idx++;
      } else if (user_id) {
        query += ` AND s.user_id = $${idx}`;
        params.push(parseInt(user_id));
        idx++;
      }
    } else {

      // Non-admin farmer or sub-account (care_worker / manager / auditor_readonly)
      query += ` AND (
        s.user_id = $${idx}
        OR s.user_id = COALESCE($${idx + 1}::int, 0)
        OR s.user_id IN (SELECT user_id FROM farms WHERE id = (SELECT farm_id FROM users WHERE id = $${idx}))
        OR s.user_id IN (SELECT id FROM users WHERE farm_id IN (SELECT id FROM farms WHERE user_id = $${idx}))
        OR s.farm_id IN (SELECT id FROM farms WHERE user_id = $${idx} OR user_id = COALESCE($${idx + 1}::int, 0) OR id = (SELECT farm_id FROM users WHERE id = $${idx}))
      )`;
      params.push(req.user.id, req.user.parent_user_id || null);
      idx += 2;
    }

    if (category) {
      query += ` AND s.category = $${idx}`;
      params.push(category);
      idx++;
    }

    if (search) {
      query += ` AND (s.name ILIKE $${idx} OR s.note ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ` GROUP BY s.id, u.id ORDER BY s.category ASC, s.name ASC`;
    const result = await pool.query(query, params);

    const hideFinance = isSupplyFinanceRedacted(req.user, req.query.role);

    const rows = hideFinance
      ? result.rows.map(r => ({
          ...r,
          package_price: 0,
          unit_price: 0,
          unit_price_small: 0,
          total_spent: 0,
          finance_redacted: true
        }))
      : result.rows;

    res.json(rows);
  } catch (err) {
    console.error('Error fetching supplies:', err);
    res.status(500).json({ error: 'Lỗi server khi tải danh sách vật tư.' });
  }
});


const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const storageService = require('../services/storageService');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

// POST /api/supplies/upload-image — Tải ảnh bao bì vật tư (phân bón / thuốc BVTV)
router.post('/upload-image', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn một tệp hình ảnh.' });
    const ext = path.extname(req.file.originalname) || '.jpg';
    const objectName = `supplies/${uuidv4()}${ext}`;
    const publicUrl = await storageService.uploadFile(objectName, req.file.buffer, req.file.mimetype);
    res.json({ url: publicUrl });
  } catch (err) {
    console.error('Error uploading supply image:', err);
    res.status(500).json({ error: 'Lỗi server khi tải ảnh vật tư lên: ' + err.message });
  }
});

// POST /api/supplies/scan-image — AI Vision Quét & Bóc tách Tự động Thông tin Bao Phân Bón / Thuốc BVTV

const crypto = require('crypto');
const scanResultCache = new Map(); // Cache max 150 scanned image results in memory to save API tokens

function normalizeSupplyCategory(cat, name = '') {
  const text = `${cat || ''} ${name || ''}`.toLowerCase();
  if (/thuốc|bvtv|trừ\s*sâu|trừ\s*bệnh|trị\s*nấm|diệt|anvil|score|amistar|ridomil|tilt|antracol|mancozeb|nativo|pes|fungi|hoạt chất|phun|kháng\s*sinh|rầy|sâu/i.test(text)) {
    return 'Phun thuốc';
  }
  if (/nước|tưới|thủy lợi/i.test(text) && !/phân|thuốc/i.test(text)) {
    return 'Tiền nước';
  }
  if (/nhân\s*công|tiền\s*công|lao\s*động|công\s*nhân/i.test(text)) {
    return 'Nhân công';
  }
  return 'Bón phân';
}

function normalizeSupplyUnit(rawUnit) {
  if (!rawUnit) return 'kg';
  const u = rawUnit.toString().toLowerCase().trim();
  if (['chai', 'lọ', 'bình', 'ống'].includes(u)) return 'chai';
  if (['gói', 'bịch', 'túi'].includes(u)) return 'gói';
  if (['can', 'thùng'].includes(u)) return 'can';
  if (['lít', 'lit', 'l'].includes(u)) return 'lít';
  if (['ml', 'mililit', 'cc'].includes(u)) return 'ml';
  if (['g', 'gam', 'gram'].includes(u)) return 'g';
  if (['kg', 'kí', 'ký', 'bao'].includes(u)) return 'kg';
  if (['m3', 'm³', 'khối'].includes(u)) return 'm3';
  if (['ngày công', 'công'].includes(u)) return 'ngày công';
  return 'khác';
}

router.post('/scan-image', auth, upload.single('file'), async (req, res) => {
  try {
    let base64Image = '';
    let mimeType = 'image/jpeg';

    if (req.file) {
      base64Image = req.file.buffer.toString('base64');
      mimeType = req.file.mimetype || 'image/jpeg';
    } else if (req.body && req.body.image_base64) {
      base64Image = req.body.image_base64.replace(/^data:image\/\w+;base64,/, '');
      if (req.body.mime_type) mimeType = req.body.mime_type;
    } else {
      return res.status(400).json({ error: 'Vui lòng tải lên hoặc chụp ảnh bao bì phân bón / thuốc BVTV.' });
    }

    // 1. Check in-memory hash cache to save API tokens
    const imgHash = crypto.createHash('md5').update(base64Image).digest('hex');
    if (scanResultCache.has(imgHash)) {
      console.log('⚡ Serving scanned supply image from cache (0 API tokens consumed)');
      return res.json({
        success: true,
        used_ai: 'gemini_cache',
        data: scanResultCache.get(imgHash)
      });
    }

    const rawKeys = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    const apiKeys = rawKeys.split(/[,;]/).map(k => k.trim()).filter(Boolean);
    let scannedData = null;

    if (apiKeys.length > 0) {
      const modelCandidates = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-8b'];
      const promptText = `Bạn là chuyên gia bóc tách thông tin bao bì phân bón và thuốc bảo vệ thực vật tại Việt Nam. Hãy đọc kỹ ảnh chụp bao bì/chai thuốc và trả về duy nhất 1 chuỗi JSON thuần tuý (không thêm văn bản ngoài JSON):
{
  "name": "Tên đầy đủ và chuẩn xác của sản phẩm (ví dụ: Phân bón NPK Đầu Trâu 20-20-15 hoặc Thuốc trừ bệnh Anvil 5SC)",
  "category": "Bón phân" hoặc "Phun thuốc",
  "fertilizer_type": "Phân vô cơ (NPK / Hóa học)" hoặc "Phân hữu cơ" hoặc "Phân bón lá" hoặc "Phân vi lượng / Trung lượng" hoặc "Phân chuồng / Hoai mục" hoặc "Khác" hoặc null,
  "package_qty": 50,
  "package_unit": "kg" hoặc "lít" hoặc "chai" hoặc "gói" hoặc "can" hoặc "g" hoặc "ml",
  "package_size": "50 kg",
  "active_ingredient": "Tên hoạt chất chính nếu là thuốc BVTV (ví dụ: Hexaconazole 50g/l hoặc Mancozeb)",
  "target_pests": "Đối tượng phòng trừ (ví dụ: Bệnh thán thư, đốm lá, rỉ sắt)",
  "phi_days": 7,
  "manufacturer": "Tên nhà sản xuất nếu có"
}`;

      // Iterate through keys (Key Rotation if Rate Limited / 429 / 403)
      keyLoop:
      for (const apiKey of apiKeys) {
        for (const modelName of modelCandidates) {
          try {
            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: promptText },
                    { inline_data: { mime_type: mimeType, data: base64Image } }
                  ]
                }]
              })
            });

            if (geminiRes.ok) {
              const result = await geminiRes.json();
              const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
              let cleanJson = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();
              const firstBrace = cleanJson.indexOf('{');
              const lastBrace = cleanJson.lastIndexOf('}');
              if (firstBrace !== -1 && lastBrace !== -1) {
                cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
              }
              scannedData = JSON.parse(cleanJson);
              if (scannedData && scannedData.name) {
                console.log(`Gemini Vision AI succeeded using model ${modelName}`);

                // Normalize category & unit for safe database & UI mapping
                scannedData.category = normalizeSupplyCategory(scannedData.category, scannedData.name);
                scannedData.package_unit = normalizeSupplyUnit(scannedData.package_unit);
                if (scannedData.category === 'Phun thuốc' && (!scannedData.package_qty || scannedData.package_qty > 100)) {
                  if (scannedData.package_unit === 'chai' || scannedData.package_unit === 'can' || scannedData.package_unit === 'gói') {
                    scannedData.package_qty = 1;
                  }
                }

                // Save to cache (limit cache size to 150 items)
                if (scanResultCache.size > 150) {
                  const firstKey = scanResultCache.keys().next().value;
                  scanResultCache.delete(firstKey);
                }
                scanResultCache.set(imgHash, scannedData);
                break keyLoop; // Successfully scanned! Exit loop.
              }
            } else {
              const errText = await geminiRes.text();
              console.warn(`Gemini API HTTP ${geminiRes.status} on key ending ...${apiKey.slice(-6)}:`, errText);
              // If rate limited 429 or 403 quota, break to try next API key in keyLoop
              if (geminiRes.status === 429 || geminiRes.status === 403) {
                break; // try next key
              }
            }
          } catch (mErr) {
            console.warn(`Gemini Model ${modelName} attempt failed:`, mErr.message);
          }
        }
      }
    }

    if (!scannedData) {
      return res.json({
        success: false,
        fallback_ocr: true,
        message: 'Không tìm thấy API Key Gemini hoặc xử lý AI gặp lỗi, chuyển sang OCR client-side'
      });
    }

    res.json({
      success: true,
      used_ai: 'gemini',
      data: scannedData
    });


  } catch (err) {
    console.error('Error scanning supply image:', err);
    res.status(500).json({ error: 'Lỗi xử lý hình ảnh bao bì: ' + err.message });
  }
});


// POST /api/supplies — Khai báo vật tư mới (kèm chuẩn VietGAP: PHI, hoạt chất, đối tượng phòng trừ)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && ['care_worker', 'auditor_readonly'].includes(req.user.sub_role)) {
      return res.status(403).json({ error: 'Vai trò của bạn không được cấp quyền khai báo hoặc nhập kho vật tư mới.' });
    }
    const { 
      category, name, unit, package_size, package_qty, package_unit, 
      package_price, unit_price, unit_price_small, stock_quantity, note, 
      image_url, fertilizer_type, user_id,
      phi_days, active_ingredient, target_pests, safety_interval_note
    } = req.body;
    
    // Auto-normalize category and units to protect against UI mismatches
    const validCategories = ['Bón phân', 'Tiền nước', 'Phun thuốc', 'Nhân công'];
    const safeCategory = validCategories.includes(category) ? category : normalizeSupplyCategory(category, name);
    const safeUnit = unit || package_unit || (safeCategory === 'Phun thuốc' ? 'chai' : 'kg');
    const safePkgUnit = normalizeSupplyUnit(package_unit || safeUnit);

    if (!safeCategory || !name || !safeUnit) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ Hạng mục, Tên vật tư và Đơn vị tính.' });
    }

    const price = parseFloat(unit_price) || 0;
    const pkgQty = parseFloat(package_qty) || 1;
    const pkgPrice = parseFloat(package_price) || price;
    const unitPriceSmall = parseFloat(unit_price_small) || (pkgQty > 0 ? price / pkgQty : 0);
    let stock = parseFloat(stock_quantity);
    if (isNaN(stock) || stock <= 0) {
      stock = (category === 'Tiền nước' || category === 'Nhân công') ? 999999 : pkgQty;
    }
    const targetUserId = (user_id && req.user.role === 'admin') ? parseInt(user_id) : req.user.id;
    const phiDaysInt = parseInt(phi_days) || 0;

    let targetFarmId = req.body.farm_id ? parseInt(req.body.farm_id) : null;
    if (!targetFarmId) {
      const uRes = await pool.query('SELECT farm_id FROM users WHERE id = $1', [targetUserId]);
      if (uRes.rows.length > 0 && uRes.rows[0].farm_id) {
        targetFarmId = uRes.rows[0].farm_id;
      } else {
        const fRes = await pool.query('SELECT id FROM farms WHERE user_id = $1 ORDER BY id ASC LIMIT 1', [targetUserId]);
        if (fRes.rows.length > 0) {
          targetFarmId = fRes.rows[0].id;
        }
      }
    }

    // Kiểm tra nếu sản phẩm cùng loại & cùng tên đã tồn tại trong cùng trang trại / user -> Cộng dồn số lượng tồn kho
    const existingCheck = await pool.query(
      `SELECT * FROM supplies 
       WHERE (
         ($1::int IS NOT NULL AND (farm_id = $1 OR user_id = $2))
         OR ($1::int IS NULL AND user_id = $2)
       ) 
        AND category = $3 AND LOWER(name) = LOWER($4)`,
      [targetFarmId, targetUserId, safeCategory, name.trim()]
    );

    if (existingCheck.rows.length > 0) {
      const existing = existingCheck.rows[0];
      const updatedStock = parseFloat(existing.stock_quantity || 0) + stock;
      const updatedRes = await pool.query(
        `UPDATE supplies 
         SET stock_quantity = $1, package_price = $2, unit_price = $3, unit_price_small = $4,
             package_qty = $5, package_unit = $6, package_size = $7,
             image_url = COALESCE($8, image_url), note = COALESCE($9, note), fertilizer_type = COALESCE($10, fertilizer_type),
             phi_days = COALESCE($11, phi_days), active_ingredient = COALESCE($12, active_ingredient),
             target_pests = COALESCE($13, target_pests), safety_interval_note = COALESCE($14, safety_interval_note),
             farm_id = COALESCE(farm_id, $15),
             updated_at = NOW()
         WHERE id = $16
         RETURNING *`,
        [
          updatedStock,
          pkgPrice || existing.package_price,
          price || existing.unit_price,
          unitPriceSmall || existing.unit_price_small,
          pkgQty || existing.package_qty,
          safePkgUnit || existing.package_unit,
          package_size ? package_size.trim() : existing.package_size,
          image_url || null,
          note || null,
          fertilizer_type || null,
          phiDaysInt || existing.phi_days,
          active_ingredient || null,
          target_pests || null,
          safety_interval_note || null,
          targetFarmId,
          existing.id
        ]
      );
      return res.status(200).json(updatedRes.rows[0]);
    }

    const result = await pool.query(
      `INSERT INTO supplies (
        user_id, farm_id, category, name, unit, package_size, package_qty, package_unit, 
        package_price, unit_price, unit_price_small, stock_quantity, note, 
        image_url, fertilizer_type, phi_days, active_ingredient, target_pests, safety_interval_note
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [
        targetUserId,
        targetFarmId,
        safeCategory,
        name.trim(),
        safeUnit,
        package_size ? package_size.trim() : `${pkgQty} ${safePkgUnit}`,
        pkgQty,
        safePkgUnit,
        pkgPrice,
        price,
        unitPriceSmall,
        stock,
        note || null,
        image_url || null,
        fertilizer_type ? fertilizer_type.trim() : null,
        phiDaysInt,
        active_ingredient ? active_ingredient.trim() : null,
        target_pests ? target_pests.trim() : null,
        safety_interval_note ? safety_interval_note.trim() : null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating supply:', err);
    res.status(500).json({ error: 'Lỗi server khi thêm vật tư.' });
  }
});

// PUT /api/supplies/:id — Cập nhật thông tin vật tư
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      category, name, unit, package_size, package_qty, package_unit, 
      package_price, unit_price, unit_price_small, stock_quantity, note, 
      image_url, fertilizer_type, phi_days, active_ingredient, target_pests, safety_interval_note
    } = req.body;

    const check = await pool.query('SELECT * FROM supplies WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy vật tư.' });
    }
    if (req.user.role !== 'admin' && check.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền sửa vật tư này.' });
    }

    const price = parseFloat(unit_price) || 0;
    const pkgQty = parseFloat(package_qty) || check.rows[0].package_qty || 1;
    const pkgPrice = parseFloat(package_price) || check.rows[0].package_price || price;
    const unitPriceSmall = parseFloat(unit_price_small) || (pkgQty > 0 ? price / pkgQty : 0);
    
    let stock = parseFloat(stock_quantity);
    if (isNaN(stock) || stock <= 0) {
      stock = (check.rows[0].stock_quantity > 0) ? check.rows[0].stock_quantity : pkgQty;
    }

    const phiDaysInt = phi_days !== undefined ? (parseInt(phi_days) || 0) : check.rows[0].phi_days;

    const farmIdVal = req.body.farm_id !== undefined ? (req.body.farm_id ? parseInt(req.body.farm_id) : null) : check.rows[0].farm_id;

    const result = await pool.query(
      `UPDATE supplies 
       SET category = $1, name = $2, unit = $3, package_size = $4, package_qty = $5, package_unit = $6, 
           package_price = $7, unit_price = $8, unit_price_small = $9, stock_quantity = $10, note = $11, 
           image_url = $12, fertilizer_type = $13, phi_days = $14, active_ingredient = $15, target_pests = $16,
           safety_interval_note = $17, farm_id = $18, updated_at = NOW()
       WHERE id = $19
       RETURNING *`,
      [
        category || check.rows[0].category,
        name || check.rows[0].name,
        unit || check.rows[0].unit,
        package_size !== undefined ? package_size : check.rows[0].package_size,
        pkgQty,
        package_unit || check.rows[0].package_unit,
        pkgPrice,
        price,
        unitPriceSmall,
        stock,
        note !== undefined ? note : check.rows[0].note,
        image_url !== undefined ? image_url : check.rows[0].image_url,
        fertilizer_type !== undefined ? fertilizer_type : check.rows[0].fertilizer_type,
        phiDaysInt,
        active_ingredient !== undefined ? active_ingredient : check.rows[0].active_ingredient,
        target_pests !== undefined ? target_pests : check.rows[0].target_pests,
        safety_interval_note !== undefined ? safety_interval_note : check.rows[0].safety_interval_note,
        farmIdVal,
        id
      ]
    );

    logAuditAction(req.user.id, req.user.full_name || req.user.email, 'UPDATE', 'Vật tư', id, `Chỉnh sửa thông tin vật tư "${result.rows[0].name}"`, check.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating supply:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật vật tư.' });
  }
});

// DELETE /api/supplies/:id — Xóa vật tư
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const check = await pool.query('SELECT * FROM supplies WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy vật tư.' });
    }
    if (req.user.role !== 'admin' && check.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa vật tư này.' });
    }

    await pool.query('DELETE FROM supplies WHERE id = $1', [id]);
    logAuditAction(req.user.id, req.user.full_name || req.user.email, 'DELETE', 'Vật tư', id, `Xóa vật tư "${check.rows[0].name}"`, check.rows[0], {});
    res.json({ success: true, message: 'Đã xóa vật tư thành công.' });
  } catch (err) {
    console.error('Error deleting supply:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa vật tư.' });
  }
});

// POST /api/supplies/:id/restock — Nhập thêm hàng vào kho (Stock Replenishment)
router.post('/:id/restock', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { added_qty, new_package_price, note, batch_no } = req.body;

    const qty = parseFloat(added_qty);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Số lượng nhập thêm phải lớn hơn 0.' });
    }

    const check = await pool.query('SELECT * FROM supplies WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy vật tư.' });
    }
    const supply = check.rows[0];

    if (req.user.role !== 'admin' && supply.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền nhập kho cho vật tư này.' });
    }

    let updatedPkgPrice = supply.package_price;
    let updatedUnitPrice = supply.unit_price;
    let updatedUnitPriceSmall = supply.unit_price_small;

    const pkgQty = parseFloat(supply.package_qty) || 1;
    let addedBaseQty = qty * pkgQty;
    if (req.body.is_base_unit) {
      addedBaseQty = qty;
    }

    if (new_package_price && parseFloat(new_package_price) > 0) {
      updatedPkgPrice = parseFloat(new_package_price);
      updatedUnitPrice = updatedPkgPrice / pkgQty;
      updatedUnitPriceSmall = (pkgQty > 0) ? updatedUnitPrice / pkgQty : 0;
    }

    const newStock = (parseFloat(supply.stock_quantity) || 0) + addedBaseQty;
    const restockNote = note ? `${supply.note ? supply.note + ' | ' : ''}Nhập kho +${qty} ${supply.package_unit || 'gói'} (+${addedBaseQty} ${supply.unit}) (${new Date().toLocaleDateString('vi-VN')}): ${note}${batch_no ? ' [Lô: ' + batch_no + ']' : ''}` : supply.note;

    const restockFarmId = req.body.farm_id ? parseInt(req.body.farm_id) : supply.farm_id;

    const updatedRes = await pool.query(
      `UPDATE supplies 
       SET stock_quantity = $1, package_price = $2, unit_price = $3, unit_price_small = $4, note = $5, farm_id = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [newStock, updatedPkgPrice, updatedUnitPrice, updatedUnitPriceSmall, restockNote, restockFarmId, id]
    );

    const updatedSupply = updatedRes.rows[0];

    // Log audit
    logAuditAction(
      req.user.id,
      req.user.full_name || req.user.email,
      'RESTOCK',
      'Vật tư',
      id,
      `Nhập thêm +${qty} ${supply.package_unit || supply.unit} (+${addedBaseQty} ${supply.unit}) cho vật tư "${supply.name}" (Tồn mới: ${newStock})`,
      supply,
      updatedSupply
    );

    // Broadcast WebSocket event
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('supplies_updated', { userId: req.user.id, supplyId: id, restock: { added_qty: qty, new_stock: newStock } });
    }

    res.json({
      success: true,
      message: `Đã nhập thêm +${qty} ${supply.package_unit || supply.unit} (+${addedBaseQty} ${supply.unit}) vào kho thành công!`,
      supply: updatedSupply
    });
  } catch (err) {
    console.error('Error restocking supply:', err);
    res.status(500).json({ error: 'Lỗi server khi nhập thêm hàng vào kho: ' + err.message });
  }
});


// GET /api/supplies/usages — Lấy nhật ký tiêu hao vật tư
router.get('/usages', auth, async (req, res) => {
  try {
    const { farm_id, category, limit, user_id } = req.query;
    const targetUserId = (user_id && req.user.role === 'admin') ? parseInt(user_id) : req.user.id;
    let query = `
      SELECT su.*, s.name as supply_name, s.category, s.unit,
             f.name as farm_name, p.plant_type, p.tree_code, p.assigned_to_user_id
      FROM supply_usages su
      JOIN supplies s ON su.supply_id = s.id
      LEFT JOIN farms f ON su.farm_id = f.id
      LEFT JOIN plants p ON su.plant_id = p.id
      WHERE (
        su.user_id = $1
        OR su.user_id = COALESCE($2::int, 0)
        OR su.farm_id IN (SELECT id FROM farms WHERE user_id = $1 OR user_id = COALESCE($2::int, 0) OR id = (SELECT farm_id FROM users WHERE id = $1))
      )
    `;
    const params = [targetUserId, req.user.parent_user_id || null];
    let idx = 3;

    if (req.user.role !== 'admin' && req.user.view_plants_scope === 'assigned') {
      query += ` AND (f.user_id = $1 OR p.assigned_to_user_id = $1 OR (su.plant_id IS NULL AND su.user_id = $1))`;
    }

    if (farm_id) {
      query += ` AND su.farm_id = $${idx}`;
      params.push(parseInt(farm_id));
      idx++;
    }
    if (category) {
      query += ` AND s.category = $${idx}`;
      params.push(category);
      idx++;
    }

    query += ` ORDER BY su.usage_date DESC, su.created_at DESC`;

    if (limit) {
      query += ` LIMIT $${idx}`;
      params.push(parseInt(limit));
    }

    const result = await pool.query(query, params);
    const hideFinance = isSupplyFinanceRedacted(req.user, req.query.role);
    const rows = hideFinance
      ? result.rows.map(r => ({
          ...r,
          unit_price: 0,
          total_cost: 0,
          finance_redacted: true
        }))
      : result.rows;
    res.json(rows);
  } catch (err) {
    console.error('Error fetching supply usages:', err);
    res.status(500).json({ error: 'Lỗi server khi tải nhật ký tiêu hao.' });
  }
});

// POST /api/supplies/usages — Ghi nhận tiêu hao vật tư
router.post('/usages', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.sub_role === 'auditor_readonly') {
      return res.status(403).json({ error: 'Tài khoản Kiểm định viên (Chỉ đọc) không được phép ghi nhận tiêu hao vật tư.' });
    }
    const { supply_id, farm_id, plant_id, usage_date, quantity, unit, note } = req.body;
    if (!supply_id || !quantity) {
      return res.status(400).json({ error: 'Vui lòng chọn vật tư và nhập số lượng tiêu hao.' });
    }

    const supplyRes = await pool.query('SELECT * FROM supplies WHERE id = $1', [supply_id]);
    if (supplyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Vật tư không tồn tại.' });
    }
    const supply = supplyRes.rows[0];

    const rawQty = parseFloat(quantity);
    if (isNaN(rawQty) || rawQty <= 0) {
      return res.status(400).json({ error: 'Số lượng tiêu hao phải lớn hơn 0.' });
    }

    const qty = convertSupplyQtyToBaseUnit(rawQty, unit, supply.unit);
    const unit_price = parseFloat(supply.unit_price) || 0;
    const total_cost = qty * unit_price;

    const uDate = usage_date ? new Date(usage_date) : new Date();

    // Auto-resolve farm_id from plants table if missing but plant_id is present
    let resolvedFarmId = farm_id;
    if (!resolvedFarmId && plant_id) {
      const plantRes = await pool.query('SELECT farm_id FROM plants WHERE id = $1', [plant_id]);
      if (plantRes.rows.length > 0) {
        resolvedFarmId = plantRes.rows[0].farm_id;
      }
    }

    const result = await pool.query(
      `INSERT INTO supply_usages (user_id, supply_id, farm_id, plant_id, usage_date, quantity, unit_price, total_cost, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, supply.id, resolvedFarmId || null, plant_id || null, uDate, qty, unit_price, total_cost, note || null]
    );

    // Trừ kho vật tư (chỉ trừ cho phân bón & thuốc BVTV, không trừ cho Tiền nước & Nhân công vì là vật tư vĩnh cửu)
    if (supply.category !== 'Tiền nước' && supply.category !== 'Nhân công' && supply.stock_quantity > 0) {
      await pool.query('UPDATE supplies SET stock_quantity = GREATEST(0, stock_quantity - $1), updated_at = NOW() WHERE id = $2', [qty, supply.id]);
    }

    // Broadcast WebSocket event for real-time cost and supply update
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('supplies_updated', { userId: req.user.id, usage: result.rows[0] });
    }

    const rowOut = isSupplyFinanceRedacted(req.user)
      ? { ...result.rows[0], unit_price: 0, total_cost: 0, finance_redacted: true }
      : result.rows[0];
    res.status(201).json(rowOut);
  } catch (err) {
    console.error('Error recording supply usage:', err);
    res.status(500).json({ error: 'Lỗi server khi ghi nhận tiêu hao vật tư.' });
  }
});

// DELETE /api/supplies/usages/:id — Xóa nhật ký tiêu hao
router.delete('/usages/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && ['care_worker', 'auditor_readonly'].includes(req.user.sub_role)) {
      return res.status(403).json({ error: 'Vai trò của bạn không có quyền xóa bản ghi tiêu hao vật tư.' });
    }
    const { id } = req.params;
    const check = await pool.query('SELECT * FROM supply_usages WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy nhật ký tiêu hao.' });
    }
    const usage = check.rows[0];
    if (req.user.role !== 'admin' && usage.user_id !== req.user.id && usage.user_id !== req.user.parent_user_id) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa bản ghi này.' });
    }

    await pool.query('DELETE FROM supply_usages WHERE id = $1', [id]);

    // Restore stock if not permanent category
    if (usage.supply_id && usage.quantity > 0) {
      const supRes = await pool.query('SELECT category FROM supplies WHERE id = $1', [usage.supply_id]);
      if (supRes.rows.length > 0 && supRes.rows[0].category !== 'Tiền nước' && supRes.rows[0].category !== 'Nhân công') {
        await pool.query('UPDATE supplies SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2', [usage.quantity, usage.supply_id]);
      }
    }

    // Broadcast WebSocket event for real-time cost and supply update
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('supplies_updated', { userId: req.user.id, deletedId: id });
    }

    res.json({ success: true, message: 'Đã xóa bản ghi tiêu hao vật tư và phục hồi tồn kho thành công.' });
  } catch (err) {
    console.error('Error deleting supply usage:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa nhật ký tiêu hao.' });
  }
});

// ─── 3. ANALYTICS & COST MONITORING ──────────────────────────────

// GET /api/supplies/analytics — Thống kê chi phí vật tư theo khoảng thời gian linh hoạt
router.get('/analytics', auth, async (req, res) => {
  try {
    const { 
      period = 'month', 
      year = new Date().getFullYear(), 
      month, 
      farm_id, 
      user_id,
      from_date,
      to_date,
      from_month,
      from_year,
      to_month,
      to_year,
      from_quarter,
      to_quarter
    } = req.query;

    const targetUserId = (user_id && req.user.role === 'admin') ? parseInt(user_id) : req.user.id;
    const hideFinance = isSupplyFinanceRedacted(req.user, req.query.role);
    
    let baseWhere = `WHERE (su.user_id = $1 OR su.user_id = COALESCE($2::int, 0) OR su.farm_id IN (SELECT id FROM farms WHERE user_id = $1 OR user_id = COALESCE($2::int, 0) OR id = (SELECT farm_id FROM users WHERE id = $1)))`;
    const params = [targetUserId, req.user.parent_user_id || null];
    let idx = 3;

    if (req.user.role !== 'admin' && req.user.view_plants_scope === 'assigned') {
      baseWhere += ` AND (su.plant_id IN (SELECT id FROM plants WHERE assigned_to_user_id = $1) OR (su.plant_id IS NULL AND su.user_id = $1))`;
    }

    if (farm_id && farm_id !== 'all') {
      baseWhere += ` AND su.farm_id = $${idx}`;
      params.push(parseInt(farm_id));
      idx++;
    }

    let filterTimeClause = '';
    let timeGroupSelect = '';
    let timeGroupOrderBy = '';

    if (period === 'day') {
      if (from_date && to_date) {
        filterTimeClause += ` AND su.usage_date::date >= $${idx}::date AND su.usage_date::date <= $${idx+1}::date`;
        params.push(from_date, to_date);
        idx += 2;
      } else {
        filterTimeClause += ` AND EXTRACT(YEAR FROM su.usage_date) = $${idx}`;
        params.push(parseInt(year));
        idx++;

        if (month && month !== 'all') {
          filterTimeClause += ` AND EXTRACT(MONTH FROM su.usage_date) = $${idx}`;
          params.push(parseInt(month));
          idx++;
        }
      }

      timeGroupSelect = `TO_CHAR(su.usage_date, 'YYYY-MM-DD') as period_key, TO_CHAR(su.usage_date, 'DD/MM/YYYY') as period_label, TO_CHAR(su.usage_date, 'YYYY-MM-DD') as sort_order`;
      timeGroupOrderBy = `ORDER BY period_key ASC`;

    } else if (period === 'month') {
      if (from_month && from_year && to_month && to_year) {
        const startMonthStr = `${from_year}-${String(from_month).padStart(2, '0')}-01`;
        const endMonthStartStr = `${to_year}-${String(to_month).padStart(2, '0')}-01`;
        filterTimeClause += ` AND su.usage_date::date >= $${idx}::date AND su.usage_date::date <= ($${idx+1}::date + INTERVAL '1 month' - INTERVAL '1 day')`;
        params.push(startMonthStr, endMonthStartStr);
        idx += 2;
      } else {
        filterTimeClause += ` AND EXTRACT(YEAR FROM su.usage_date) = $${idx}`;
        params.push(parseInt(year));
        idx++;
      }

      timeGroupSelect = `TO_CHAR(su.usage_date, 'YYYY-MM') as period_key, 'Tháng ' || TO_CHAR(su.usage_date, 'MM/YYYY') as period_label, TO_CHAR(su.usage_date, 'YYYY-MM') as sort_order`;
      timeGroupOrderBy = `ORDER BY period_key ASC`;

    } else if (period === 'quarter') {
      if (from_quarter && from_year && to_quarter && to_year) {
        const qMonths = { '1': '01', '2': '04', '3': '07', '4': '10' };
        const startQMonth = qMonths[String(from_quarter)] || '01';
        const endQMonth = qMonths[String(to_quarter)] || '10';

        const startQDate = `${from_year}-${startQMonth}-01`;
        const endQDate = `${to_year}-${endQMonth}-01`;

        filterTimeClause += ` AND su.usage_date::date >= $${idx}::date AND su.usage_date::date <= ($${idx+1}::date + INTERVAL '3 months' - INTERVAL '1 day')`;
        params.push(startQDate, endQDate);
        idx += 2;
      } else {
        filterTimeClause += ` AND EXTRACT(YEAR FROM su.usage_date) = $${idx}`;
        params.push(parseInt(year));
        idx++;
      }

      timeGroupSelect = `TO_CHAR(su.usage_date, 'YYYY') || '-Q' || EXTRACT(QUARTER FROM su.usage_date) as period_key, 'Quý ' || EXTRACT(QUARTER FROM su.usage_date) || '/' || TO_CHAR(su.usage_date, 'YYYY') as period_label, TO_CHAR(su.usage_date, 'YYYY') || EXTRACT(QUARTER FROM su.usage_date) as sort_order`;
      timeGroupOrderBy = `ORDER BY period_key ASC`;

    } else if (period === 'year') {
      if (from_year && to_year) {
        filterTimeClause += ` AND EXTRACT(YEAR FROM su.usage_date) >= $${idx} AND EXTRACT(YEAR FROM su.usage_date) <= $${idx+1}`;
        params.push(parseInt(from_year), parseInt(to_year));
        idx += 2;
      } else {
        filterTimeClause += ` AND EXTRACT(YEAR FROM su.usage_date) = $${idx}`;
        params.push(parseInt(year));
        idx++;
      }

      timeGroupSelect = `TO_CHAR(su.usage_date, 'YYYY') as period_key, 'Năm ' || TO_CHAR(su.usage_date, 'YYYY') as period_label, EXTRACT(YEAR FROM su.usage_date) as sort_order`;
      timeGroupOrderBy = `ORDER BY period_key ASC`;

    } else {
      timeGroupSelect = `'Tháng ' || EXTRACT(MONTH FROM su.usage_date) as period_key, 'Tháng ' || EXTRACT(MONTH FROM su.usage_date) as period_label, EXTRACT(MONTH FROM su.usage_date) as sort_order`;
      timeGroupOrderBy = `ORDER BY sort_order ASC`;
    }

    // 1. Overall Category Totals for Selected Time Period & Farm
    const catTotalsQuery = `
      SELECT s.category, COALESCE(SUM(su.total_cost), 0) as total_cost, COUNT(su.id) as transaction_count
      FROM supply_usages su
      JOIN supplies s ON su.supply_id = s.id
      ${baseWhere} ${filterTimeClause}
      GROUP BY s.category
    `;
    const catTotalsRes = await pool.query(catTotalsQuery, params);

    const categorySummary = {
      'Bón phân': 0,
      'Tiền nước': 0,
      'Phun thuốc': 0,
      'Nhân công': 0,
    };
    const categoryCounts = {
      'Bón phân': 0,
      'Tiền nước': 0,
      'Phun thuốc': 0,
      'Nhân công': 0,
    };
    let totalExpenditure = 0;

    catTotalsRes.rows.forEach(r => {
      if (categoryCounts.hasOwnProperty(r.category)) {
        categoryCounts[r.category] = parseInt(r.transaction_count) || 0;
      }
      if (!hideFinance) {
        if (categorySummary.hasOwnProperty(r.category)) {
          categorySummary[r.category] = parseFloat(r.total_cost) || 0;
        }
        totalExpenditure += parseFloat(r.total_cost) || 0;
      }
    });

    // 2. Time Grouping Breakdown
    const breakdownQuery = `
      SELECT ${timeGroupSelect},
             s.category,
             COALESCE(SUM(su.total_cost), 0) as total_cost,
             COALESCE(SUM(su.quantity), 0) as total_quantity
      FROM supply_usages su
      JOIN supplies s ON su.supply_id = s.id
      ${baseWhere} ${filterTimeClause}
      GROUP BY period_key, period_label, sort_order, s.category
      ${timeGroupOrderBy}
    `;

    const breakdownRes = await pool.query(breakdownQuery, params);
    const timeBreakdown = hideFinance
      ? breakdownRes.rows.map(r => ({ ...r, total_cost: 0, finance_redacted: true }))
      : breakdownRes.rows;

    res.json({
      period,
      finance_redacted: hideFinance,
      summary: {
        total_expenditure: hideFinance ? 0 : totalExpenditure,
        categories: categorySummary,
        category_counts: categoryCounts
      },
      time_breakdown: timeBreakdown,
    });
  } catch (err) {
    console.error('Error fetching supplies analytics:', err);
    res.status(500).json({ error: 'Lỗi server khi thống kê chi phí vật tư.' });
  }
});

// POST /api/supplies/recalculate-stock — Thủ công kích hoạt cân đối & tính lại tồn kho
router.post('/recalculate-stock', auth, async (req, res) => {
  try {
    await autoReconcileSuppliesData(req.user.parent_user_id || req.user.id, true);
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('supplies_updated', { userId: req.user.id });
    }
    res.json({ success: true, message: 'Đã hiệu chỉnh & cân đối lại tồn kho, vốn lưu kho và chi phí tiêu hao thành công!' });
  } catch (err) {
    console.error('Error recalculating stock:', err);
    res.status(500).json({ error: 'Lỗi server khi tính lại tồn kho: ' + err.message });
  }
});

// GET /api/supplies/profit-overview — Thống kê chuẩn ERP: Giá trị nhập kho, Tiêu hao lũy kế, Doanh thu thu hoạch theo từng cây trồng (Lọc theo Trang trại & Năm + Role-Adaptive Redaction)
router.get('/profit-overview', auth, async (req, res) => {
  try {
    const { farm_id, year, user_id } = req.query;
    const filterYear = (year && year !== 'all') ? parseInt(year) : null;
    const filterFarmId = (farm_id && farm_id !== 'all') ? parseInt(farm_id) : null;
    const hideFinance = isSupplyFinanceRedacted(req.user, req.query.role);
    const isAssignedScope = req.user.role !== 'admin' && req.user.view_plants_scope === 'assigned';

    // ── 1. KHỐI 1: GIÁ TRỊ NHẬP KHO & TỒN KHO VẬT TƯ (Vốn nhập hàng vào) ──
    let stockQuery = `
      SELECT s.id, s.name, s.category, s.unit, s.package_qty, s.package_price, s.unit_price, s.stock_quantity, s.created_at, s.farm_id, s.phi_days,
             COALESCE(SUM(su.total_cost), 0) as total_used_cost,
             COALESCE(SUM(su.quantity), 0) as total_used_qty
      FROM supplies s
      LEFT JOIN supply_usages su ON su.supply_id = s.id
      WHERE 1=1
    `;
    const stockParams = [];
    let sIdx = 1;

    if (req.user.role === 'admin' && user_id && user_id !== 'all') {
      stockQuery += ` AND (s.user_id = $${sIdx} OR s.farm_id IN (SELECT id FROM farms WHERE user_id = $${sIdx}))`;
      stockParams.push(parseInt(user_id));
      sIdx++;
    } else if (req.user.role !== 'admin') {
      stockQuery += ` AND (
        s.user_id = $${sIdx}
        OR s.user_id = COALESCE($${sIdx + 1}::int, 0)
        OR s.user_id IN (SELECT user_id FROM farms WHERE id = (SELECT farm_id FROM users WHERE id = $${sIdx}))
        OR s.user_id IN (SELECT id FROM users WHERE farm_id IN (SELECT id FROM farms WHERE user_id = $${sIdx}))
        OR s.farm_id IN (SELECT id FROM farms WHERE user_id = $${sIdx} OR user_id = COALESCE($${sIdx + 1}::int, 0) OR id = (SELECT farm_id FROM users WHERE id = $${sIdx}))
        OR s.id IN (SELECT supply_id FROM supply_usages WHERE farm_id IN (SELECT id FROM farms WHERE user_id = $${sIdx} OR id = (SELECT farm_id FROM users WHERE id = $${sIdx})))
      )`;
      stockParams.push(req.user.id, req.user.parent_user_id || null);
      sIdx += 2;
    }

    if (filterFarmId) {
      stockQuery += ` AND (s.farm_id = $${sIdx} OR s.user_id = (SELECT user_id FROM farms WHERE id = $${sIdx}) OR s.id IN (SELECT supply_id FROM supply_usages WHERE farm_id = $${sIdx}) OR s.farm_id IS NULL)`;
      stockParams.push(filterFarmId);
      sIdx++;
    }

    if (filterYear) {
      stockQuery += ` AND (EXTRACT(YEAR FROM s.created_at::timestamp) = $${sIdx} OR s.created_at::text LIKE $${sIdx+1} || '%' OR s.created_at IS NULL OR EXISTS (SELECT 1 FROM supply_usages su2 WHERE su2.supply_id = s.id AND (EXTRACT(YEAR FROM su2.usage_date::timestamp) = $${sIdx} OR su2.usage_date::text LIKE $${sIdx+1} || '%')))`;
      stockParams.push(filterYear, String(filterYear));
      sIdx += 2;
    }

    stockQuery += ` GROUP BY s.id`;
    const stockRes = await pool.query(stockQuery, stockParams);

    let totalStockInflowValuation = 0; // Giá trị vốn nhập hàng vào
    let currentStockValuation = 0;      // Giá trị tồn kho thực tế hiện tại
    const skuCount = stockRes.rows.length;
    let fertilizerSkuCount = 0;
    let pesticideSkuCount = 0;

    stockRes.rows.forEach(s => {
      if (s.category === 'Bón phân') fertilizerSkuCount++;
      else if (s.category === 'Phun thuốc') pesticideSkuCount++;

      const uPrice = parseFloat(s.unit_price) || 0;
      const curStock = parseFloat(s.stock_quantity) || 0;
      const usedCost = parseFloat(s.total_used_cost) || 0;
      const pkgQty = parseFloat(s.package_qty) || 1;
      const pkgPrice = parseFloat(s.package_price) || (uPrice * pkgQty);
      const curVal = curStock * uPrice;
      currentStockValuation += curVal;
      const calculatedInflow = Math.max(curVal + usedCost, pkgPrice);
      totalStockInflowValuation += calculatedInflow;
    });

    // ── 2. KHỐI 2: TIÊU HAO VẬT TƯ LŨY KẾ (Dung tích & giá trị đã chiết sử dụng) ──
    let usageQuery = `
      SELECT su.id, su.supply_id, su.farm_id, su.plant_id, su.usage_date, su.quantity, su.unit_price, su.total_cost, su.note,
             COALESCE(s.name, 'Vật tư') as supply_name,
             COALESCE(s.category, 'Khác') as supply_category,
             COALESCE(s.unit, 'đơn vị') as supply_unit,
             p.assigned_to_user_id
      FROM supply_usages su
      LEFT JOIN supplies s ON su.supply_id = s.id
      LEFT JOIN plants p ON su.plant_id = p.id
      WHERE 1=1
    `;
    const usageParams = [];
    let uIdx = 1;

    if (req.user.role === 'admin' && user_id && user_id !== 'all') {
      usageQuery += ` AND (su.user_id = $${uIdx} OR su.farm_id IN (SELECT id FROM farms WHERE user_id = $${uIdx}))`;
      usageParams.push(parseInt(user_id));
      uIdx++;
    } else if (req.user.role !== 'admin') {
      if (isAssignedScope) {
        usageQuery += ` AND (p.assigned_to_user_id = $${uIdx} OR (su.plant_id IS NULL AND su.user_id = $${uIdx}) OR p.farm_id IN (SELECT id FROM farms WHERE user_id = $${uIdx}))`;
        usageParams.push(req.user.id);
        uIdx++;
      } else {
        usageQuery += ` AND (
          su.user_id = $${uIdx}
          OR su.user_id = COALESCE($${uIdx + 1}::int, 0)
          OR su.user_id IN (SELECT user_id FROM farms WHERE id = (SELECT farm_id FROM users WHERE id = $${uIdx}))
          OR su.user_id IN (SELECT id FROM users WHERE farm_id IN (SELECT id FROM farms WHERE user_id = $${uIdx}))
          OR su.farm_id IN (SELECT id FROM farms WHERE user_id = $${uIdx} OR user_id = COALESCE($${uIdx + 1}::int, 0) OR id = (SELECT farm_id FROM users WHERE id = $${uIdx}))
          OR p.farm_id IN (SELECT id FROM farms WHERE user_id = $${uIdx} OR id = (SELECT farm_id FROM users WHERE id = $${uIdx}))
          OR p.created_by = $${uIdx}
          OR su.plant_id IN (SELECT id FROM plants WHERE created_by = $${uIdx} OR farm_id IN (SELECT id FROM farms WHERE user_id = $${uIdx} OR id = (SELECT farm_id FROM users WHERE id = $${uIdx})))
        )`;
        usageParams.push(req.user.id, req.user.parent_user_id || null);
        uIdx += 2;
      }
    }

    if (filterFarmId) {
      usageQuery += ` AND (su.farm_id = $${uIdx} OR p.farm_id = $${uIdx} OR su.plant_id IN (SELECT id FROM plants WHERE farm_id = $${uIdx}) OR su.farm_id IS NULL)`;
      usageParams.push(filterFarmId);
      uIdx++;
    }

    if (filterYear) {
      usageQuery += ` AND (EXTRACT(YEAR FROM su.usage_date::timestamp) = $${uIdx} OR su.usage_date::text LIKE $${uIdx+1} || '%')`;
      usageParams.push(filterYear, String(filterYear));
      uIdx += 2;
    }

    const usageRes = await pool.query(usageQuery, usageParams);
    let totalSpent = 0;
    const usageCount = usageRes.rows.length;
    const categorySpent = {
      'Bón phân': 0,
      'Phun thuốc': 0,
      'Tiền nước': 0,
      'Nhân công': 0
    };
    const categoryUsageCount = {
      'Bón phân': 0,
      'Phun thuốc': 0,
      'Tiền nước': 0,
      'Nhân công': 0
    };

    usageRes.rows.forEach(u => {
      const cost = parseFloat(u.total_cost) || 0;
      totalSpent += cost;
      let cat = u.supply_category;
      if (!cat || cat === 'Khác' || cat === 'Vật tư khác') {
        const n = (u.note || '').toLowerCase();
        if (n.includes('tưới') || n.includes('nuoc') || n.includes('nước')) cat = 'Tiền nước';
        else if (n.includes('phân') || n.includes('phan')) cat = 'Bón phân';
        else if (n.includes('thuốc') || n.includes('thuoc') || n.includes('sâu') || n.includes('bệnh')) cat = 'Phun thuốc';
        else if (n.includes('công') || n.includes('cong') || n.includes('nhân công')) cat = 'Nhân công';
        else cat = 'Khác';
      }
      if (categorySpent[cat] !== undefined) {
        categorySpent[cat] += cost;
      } else {
        categorySpent[cat] = (categorySpent[cat] || 0) + cost;
      }
      if (categoryUsageCount[cat] !== undefined) {
        categoryUsageCount[cat] += 1;
      } else {
        categoryUsageCount[cat] = (categoryUsageCount[cat] || 0) + 1;
      }
    });

    // ── 3. KHỐI 3: DOANH THU & SẢN LƯỢNG THU HOẠCH THEO TỪNG CÂY TRỒNG ──
    let harvestQuery = `
      SELECT pl.id, pl.cost, pl.details, pl.log_date, pl.log_type, pl.plant_id, pl.batch_code,
             p.tree_code, p.plant_type, p.assigned_to_user_id, COALESCE(p.farm_id, (SELECT farm_id FROM users WHERE id = pl.created_by)) as farm_id
      FROM plant_logs pl
      LEFT JOIN plants p ON pl.plant_id = p.id
      WHERE (
        pl.log_type ILIKE '%thu%' 
        OR pl.log_type ILIKE '%harvest%'
        OR pl.details::text ILIKE '%fruit_count%' 
        OR pl.details::text ILIKE '%price_per_tree%'
        OR pl.details::text ILIKE '%total_revenue%'
      )
        AND (pl.is_deleted IS NOT TRUE)
    `;
    const harvestParams = [];
    let hIdx = 1;

    if (req.user.role === 'admin' && user_id && user_id !== 'all') {
      harvestQuery += ` AND (pl.created_by = $${hIdx} OR p.created_by = $${hIdx} OR p.farm_id IN (SELECT id FROM farms WHERE user_id = $${hIdx}))`;
      harvestParams.push(parseInt(user_id));
      hIdx++;
    } else if (req.user.role !== 'admin') {
      if (isAssignedScope) {
        harvestQuery += ` AND (p.assigned_to_user_id = $${hIdx} OR p.farm_id IN (SELECT id FROM farms WHERE user_id = $${hIdx}))`;
        harvestParams.push(req.user.id);
        hIdx++;
      } else {
        harvestQuery += ` AND (
          pl.created_by = $${hIdx} 
          OR p.created_by = $${hIdx}
          OR p.farm_id IN (SELECT id FROM farms WHERE user_id = $${hIdx} OR id = (SELECT farm_id FROM users WHERE id = $${hIdx}))
          OR pl.created_by IN (SELECT id FROM users WHERE farm_id IN (SELECT id FROM farms WHERE user_id = $${hIdx}))
          OR pl.created_by IN (SELECT user_id FROM farms WHERE id = (SELECT farm_id FROM users WHERE id = $${hIdx}))
        )`;
        harvestParams.push(req.user.id);
        hIdx++;
      }
    }

    if (filterFarmId) {
      harvestQuery += ` AND (p.farm_id = $${hIdx} OR pl.plant_id IN (SELECT id FROM plants WHERE farm_id = $${hIdx}) OR pl.created_by IN (SELECT user_id FROM farms WHERE id = $${hIdx}) OR pl.created_by IN (SELECT id FROM users WHERE farm_id = $${hIdx}))`;
      harvestParams.push(filterFarmId);
      hIdx++;
    }

    if (filterYear) {
      harvestQuery += ` AND (EXTRACT(YEAR FROM pl.log_date::timestamp) = $${hIdx} OR pl.log_date::text LIKE $${hIdx+1} || '%')`;
      harvestParams.push(filterYear, String(filterYear));
      hIdx += 2;
    }

    const harvestRes = await pool.query(harvestQuery, harvestParams);

    let totalHarvestRevenue = 0;
    let totalFruitCount = 0;
    let totalHarvestWeight = 0;
    const harvestLogsCount = harvestRes.rows.length;

    const treeBreakdownMap = {};

    harvestRes.rows.forEach(row => {
      let d = row.details;
      if (typeof d === 'string') {
        try { d = JSON.parse(d); } catch (_) { d = {}; }
      }
      d = d || {};
      const rev = parseFloat(d.total_revenue) || parseFloat(d.price_per_tree) || parseFloat(d.revenue) || parseFloat(row.cost) || 0;
      const fruits = parseFloat(d.fruit_count) || 0;
      const amt = parseFloat(d.amount) || parseFloat(d.yield_kg) || parseFloat(d.quantity) || 0;

      totalHarvestRevenue += rev;
      totalFruitCount += fruits;
      totalHarvestWeight += amt;

      const pId = row.plant_id || 0;
      const tCode = row.tree_code || (pId ? `#${pId}` : 'Toàn vườn');
      const pType = row.plant_type || 'Cây trồng';

      if (!treeBreakdownMap[pId]) {
        treeBreakdownMap[pId] = {
          plant_id: pId,
          tree_code: tCode,
          plant_type: pType,
          revenue: 0,
          fruits: 0,
          weight: 0,
          harvest_times: 0,
          finance_redacted: hideFinance
        };
      }
      treeBreakdownMap[pId].revenue += hideFinance ? 0 : rev;
      treeBreakdownMap[pId].fruits += fruits;
      treeBreakdownMap[pId].weight += amt;
      treeBreakdownMap[pId].harvest_times += 1;
    });

    const treeBreakdown = Object.values(treeBreakdownMap).sort((a, b) =>
      hideFinance ? (b.weight - a.weight || b.fruits - a.fruits) : (b.revenue - a.revenue)
    );

    // ── 4. LỢI NHUẬN & HIỆU QUẢ ĐẦU TƯ (ROI) ──
    const netProfit = hideFinance ? 0 : (totalHarvestRevenue - totalSpent);
    const roiPercentage = hideFinance
      ? 0
      : (totalSpent > 0 ? Math.round(((netProfit / totalSpent) * 100) * 10) / 10 : (totalHarvestRevenue > 0 ? 100 : 0));

    res.json({
      finance_redacted: hideFinance,
      view_plants_scope: isAssignedScope ? 'assigned' : 'all',

      // Khối 1: Nhập kho & Tồn kho
      total_stock_inflow: hideFinance ? 0 : (totalStockInflowValuation > 0 ? totalStockInflowValuation : currentStockValuation),
      current_stock_valuation: hideFinance ? 0 : currentStockValuation,
      sku_count: skuCount,
      fertilizer_sku_count: fertilizerSkuCount,
      pesticide_sku_count: pesticideSkuCount,

      // Khối 2: Tiêu hao lũy kế
      total_spent: hideFinance ? 0 : totalSpent,
      usage_count: usageCount,
      category_spent: hideFinance
        ? { 'Bón phân': 0, 'Phun thuốc': 0, 'Tiền nước': 0, 'Nhân công': 0 }
        : categorySpent,
      category_usage_count: categoryUsageCount,

      // Khối 3: Doanh thu & Sản lượng thu hoạch theo từng cây
      total_revenue: hideFinance ? 0 : totalHarvestRevenue,
      fruit_count: totalFruitCount,
      harvest_weight: totalHarvestWeight,
      harvest_count: harvestLogsCount,
      tree_breakdown: treeBreakdown,

      // Lợi nhuận & ROI
      net_profit: netProfit,
      roi_percentage: roiPercentage,

      // Metadata bộ lọc
      filtered_farm_id: filterFarmId,
      filtered_year: filterYear
    });
  } catch (err) {
    console.error('Error fetching profit overview:', err);
    res.status(500).json({ error: 'Lỗi server khi thống kê lợi nhuận: ' + err.message });
  }
});

module.exports = router;

