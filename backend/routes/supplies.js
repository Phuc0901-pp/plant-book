const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { logAuditAction } = require('./history');


// ─── 1. SUPPLIES CRUD ─────────────────────────────────────────────

// GET /api/supplies — Lấy danh sách vật tư khai báo (kèm hỗ trợ phân quyền dùng chung vật tư trang trại)
router.get('/', auth, async (req, res) => {
  try {
    const { category, search, user_id, farm_id } = req.query;
    
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
        query += ` AND (s.user_id = (SELECT user_id FROM farms WHERE id = $${idx}) OR s.id IN (SELECT supply_id FROM supply_usages WHERE farm_id = $${idx}))`;
        params.push(parseInt(farm_id));
        idx++;
      } else if (user_id) {
        query += ` AND s.user_id = $${idx}`;
        params.push(parseInt(user_id));
        idx++;
      }
    } else {

      // Non-admin farmer
      if (req.user.farm_id && req.user.allow_view_supplies !== false) {
        // Check if shared supplies is enabled for this farm
        const farmRes = await pool.query('SELECT allow_shared_supplies FROM farms WHERE id=$1', [req.user.farm_id]);
        const allowShared = farmRes.rows.length > 0 && farmRes.rows[0].allow_shared_supplies !== false;

        if (allowShared) {
          query += ` AND (s.user_id = $${idx} OR s.user_id IN (SELECT id FROM users WHERE farm_id = $${idx + 1}) OR s.user_id = (SELECT user_id FROM farms WHERE id = $${idx + 1}))`;
          params.push(req.user.id, req.user.farm_id);
          idx += 2;
        } else {
          query += ` AND s.user_id = $${idx}`;
          params.push(req.user.id);
          idx++;
        }
      } else {
        query += ` AND s.user_id = $${idx}`;
        params.push(req.user.id);
        idx++;
      }

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
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching supplies:', err);
    res.status(500).json({ error: 'Lỗi server khi tải danh sách vật tư.' });
  }
});


const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { uploadFile } = require('../config/supabase');
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
    const publicUrl = await uploadFile(objectName, req.file.buffer, req.file.mimetype);
    res.json({ url: publicUrl });
  } catch (err) {
    console.error('Error uploading supply image:', err);
    res.status(500).json({ error: 'Lỗi server khi tải ảnh vật tư lên: ' + err.message });
  }
});

// POST /api/supplies/scan-image — AI Vision Quét & Bóc tách Tự động Thông tin Bao Phân Bón / Thuốc BVTV

const crypto = require('crypto');
const scanResultCache = new Map(); // Cache max 150 scanned image results in memory to save API tokens

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
      const modelCandidates = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'];
      const promptText = `Bạn là chuyên gia bóc tách thông tin bao bì phân bón và thuốc bảo vệ thực vật tại Việt Nam. Hãy đọc kỹ ảnh chụp bao bì/chai thuốc và trả về duy nhất 1 chuỗi JSON thuần tuý (không thêm văn bản ngoài JSON):
{
  "name": "Tên đầy đủ và chuẩn xác của sản phẩm (ví dụ: Phân hữu cơ Bio Power MK 7 Trichoderma +TE Đầu Trâu)",
  "category": "Bón phân" hoặc "Phun thuốc",
  "fertilizer_type": "Phân vô cơ (NPK / Hóa học)" hoặc "Phân hữu cơ" hoặc "Phân bón lá" hoặc "Phân vi lượng / Trung lượng" hoặc "Phân chuồng / Hoai mục" hoặc "Khác",
  "package_qty": 50,
  "package_unit": "kg" hoặc "lít" hoặc "g" hoặc "ml" hoặc "m3",
  "package_size": "50 kg",
  "manufacturer": "Tên nhà sản xuất"
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


// POST /api/supplies — Khai báo vật tư mới
router.post('/', auth, async (req, res) => {
  try {
    console.log('POST /api/supplies body:', req.body);
    const { category, name, unit, package_size, package_qty, package_unit, package_price, unit_price, unit_price_small, stock_quantity, note, image_url, fertilizer_type, user_id } = req.body;
    if (!category || !name || !unit) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ Hạng mục, Tên vật tư và Đơn vị tính.' });
    }

    const validCategories = ['Bón phân', 'Tiền nước', 'Phun thuốc', 'Nhân công'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Hạng mục gốc không hợp lệ. Chọn một trong: Bón phân, Tiền nước, Phun thuốc, Nhân công.' });
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

    // Kiểm tra nếu sản phẩm cùng loại & cùng tên đã tồn tại -> Cộng dồn số lượng tồn kho
    const existingCheck = await pool.query(
      `SELECT * FROM supplies WHERE user_id = $1 AND category = $2 AND LOWER(name) = LOWER($3)`,
      [targetUserId, category.trim(), name.trim()]
    );

    if (existingCheck.rows.length > 0) {
      const existing = existingCheck.rows[0];
      const updatedStock = parseFloat(existing.stock_quantity || 0) + stock;
      const updatedRes = await pool.query(
        `UPDATE supplies 
         SET stock_quantity = $1, package_price = $2, unit_price = $3, unit_price_small = $4,
             package_qty = $5, package_unit = $6, package_size = $7,
             image_url = COALESCE($8, image_url), note = COALESCE($9, note), fertilizer_type = COALESCE($10, fertilizer_type), updated_at = NOW()
         WHERE id = $11
         RETURNING *`,
        [
          updatedStock,
          pkgPrice || existing.package_price,
          price || existing.unit_price,
          unitPriceSmall || existing.unit_price_small,
          pkgQty || existing.package_qty,
          package_unit ? package_unit.trim() : existing.package_unit,
          package_size ? package_size.trim() : existing.package_size,
          image_url || null,
          note || null,
          fertilizer_type || null,
          existing.id
        ]
      );
      return res.status(200).json(updatedRes.rows[0]);
    }

    const result = await pool.query(
      `INSERT INTO supplies (user_id, category, name, unit, package_size, package_qty, package_unit, package_price, unit_price, unit_price_small, stock_quantity, note, image_url, fertilizer_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        targetUserId,
        category.trim(),
        name.trim(),
        unit.trim(),
        package_size ? package_size.trim() : null,
        pkgQty,
        package_unit ? package_unit.trim() : unit.trim(),
        pkgPrice,
        price,
        unitPriceSmall,
        stock,
        note || null,
        image_url || null,
        fertilizer_type ? fertilizer_type.trim() : null
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
    const { category, name, unit, package_size, package_qty, package_unit, package_price, unit_price, unit_price_small, stock_quantity, note, image_url, fertilizer_type } = req.body;

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

    const result = await pool.query(
      `UPDATE supplies 
       SET category = $1, name = $2, unit = $3, package_size = $4, package_qty = $5, package_unit = $6, package_price = $7, unit_price = $8, unit_price_small = $9, stock_quantity = $10, note = $11, image_url = $12, fertilizer_type = $13, updated_at = NOW()
       WHERE id = $14
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


// GET /api/supplies/usages — Lấy nhật ký tiêu hao vật tư
router.get('/usages', auth, async (req, res) => {
  try {
    const { farm_id, category, limit, user_id } = req.query;
    const targetUserId = (user_id && req.user.role === 'admin') ? parseInt(user_id) : req.user.id;
    let query = `
      SELECT su.*, s.name as supply_name, s.category, s.unit,
             f.name as farm_name, p.plant_type, p.tree_code
      FROM supply_usages su
      JOIN supplies s ON su.supply_id = s.id
      LEFT JOIN farms f ON su.farm_id = f.id
      LEFT JOIN plants p ON su.plant_id = p.id
      WHERE su.user_id = $1
    `;
    const params = [targetUserId];
    let idx = 2;

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
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching supply usages:', err);
    res.status(500).json({ error: 'Lỗi server khi tải nhật ký tiêu hao.' });
  }
});

// POST /api/supplies/usages — Ghi nhận tiêu hao vật tư
router.post('/usages', auth, async (req, res) => {
  try {
    const { supply_id, farm_id, plant_id, usage_date, quantity, note } = req.body;
    if (!supply_id || !quantity) {
      return res.status(400).json({ error: 'Vui lòng chọn vật tư và nhập số lượng tiêu hao.' });
    }

    const supplyRes = await pool.query('SELECT * FROM supplies WHERE id = $1', [supply_id]);
    if (supplyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Vật tư không tồn tại.' });
    }
    const supply = supplyRes.rows[0];

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Số lượng tiêu hao phải lớn hơn 0.' });
    }

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
      await pool.query('UPDATE supplies SET stock_quantity = GREATEST(0, stock_quantity - $1) WHERE id = $2', [qty, supply.id]);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error recording supply usage:', err);
    res.status(500).json({ error: 'Lỗi server khi ghi nhận tiêu hao vật tư.' });
  }
});

// DELETE /api/supplies/usages/:id — Xóa nhật ký tiêu hao
router.delete('/usages/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const check = await pool.query('SELECT * FROM supply_usages WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy nhật ký tiêu hao.' });
    }
    if (req.user.role !== 'admin' && check.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa bản ghi này.' });
    }

    await pool.query('DELETE FROM supply_usages WHERE id = $1', [id]);
    res.json({ success: true, message: 'Đã xóa bản ghi tiêu hao vật tư.' });
  } catch (err) {
    console.error('Error deleting supply usage:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa nhật ký tiêu hao.' });
  }
});

// ─── 3. ANALYTICS & COST MONITORING ──────────────────────────────

// GET /api/supplies/analytics — Thống kê chi phí vật tư
router.get('/analytics', auth, async (req, res) => {
  try {
    const { period = 'month', year = new Date().getFullYear(), month, farm_id, user_id } = req.query;
    const targetUserId = (user_id && req.user.role === 'admin') ? parseInt(user_id) : req.user.id;
    
    let baseWhere = `WHERE su.user_id = $1`;
    const params = [targetUserId];
    let idx = 2;

    if (farm_id && farm_id !== 'all') {
      baseWhere += ` AND su.farm_id = $${idx}`;
      params.push(parseInt(farm_id));
      idx++;
    }

    let filterTimeClause = '';

    if (period === 'day') {
      filterTimeClause += ` AND EXTRACT(YEAR FROM su.usage_date) = $${idx}`;
      params.push(parseInt(year));
      idx++;

      if (month && month !== 'all') {
        filterTimeClause += ` AND EXTRACT(MONTH FROM su.usage_date) = $${idx}`;
        params.push(parseInt(month));
        idx++;
      }
    } else if (period === 'month' || period === 'quarter') {
      filterTimeClause += ` AND EXTRACT(YEAR FROM su.usage_date) = $${idx}`;
      params.push(parseInt(year));
      idx++;
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
    let totalExpenditure = 0;

    catTotalsRes.rows.forEach(r => {
      if (categorySummary.hasOwnProperty(r.category)) {
        categorySummary[r.category] = parseFloat(r.total_cost) || 0;
      }
      totalExpenditure += parseFloat(r.total_cost) || 0;
    });

    // 2. Time Grouping Breakdown (Theo Ngày, Theo Tháng, Theo Quý, Theo Năm)
    let timeGroupSelect = '';
    let timeGroupOrderBy = '';

    if (period === 'day') {
      timeGroupSelect = `TO_CHAR(su.usage_date, 'YYYY-MM-DD') as period_label, EXTRACT(DAY FROM su.usage_date) as period_num`;
      timeGroupOrderBy = `ORDER BY period_label ASC`;
    } else if (period === 'quarter') {
      timeGroupSelect = `'Quý ' || EXTRACT(QUARTER FROM su.usage_date) as period_label, EXTRACT(QUARTER FROM su.usage_date) as period_num`;
      timeGroupOrderBy = `ORDER BY period_num ASC`;
    } else if (period === 'year') {
      timeGroupSelect = `TO_CHAR(su.usage_date, 'YYYY') as period_label, EXTRACT(YEAR FROM su.usage_date) as period_num`;
      timeGroupOrderBy = `ORDER BY period_num ASC`;
    } else {
      timeGroupSelect = `'Tháng ' || EXTRACT(MONTH FROM su.usage_date) as period_label, EXTRACT(MONTH FROM su.usage_date) as period_num`;
      timeGroupOrderBy = `ORDER BY period_num ASC`;
    }

    const breakdownQuery = `
      SELECT ${timeGroupSelect},
             s.category,
             COALESCE(SUM(su.total_cost), 0) as total_cost,
             COALESCE(SUM(su.quantity), 0) as total_quantity
      FROM supply_usages su
      JOIN supplies s ON su.supply_id = s.id
      ${baseWhere} ${filterTimeClause}
      GROUP BY period_label, period_num, s.category
      ${timeGroupOrderBy}
    `;

    const breakdownRes = await pool.query(breakdownQuery, params);

    res.json({
      period,
      selected_year: parseInt(year),
      selected_month: month ? parseInt(month) : null,
      summary: {
        total_expenditure: totalExpenditure,
        categories: categorySummary,
      },
      time_breakdown: breakdownRes.rows,
    });
  } catch (err) {
    console.error('Error fetching supplies analytics:', err);
    res.status(500).json({ error: 'Lỗi server khi thống kê chi phí vật tư.' });
  }
});

module.exports = router;
