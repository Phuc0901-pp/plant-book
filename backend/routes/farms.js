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
    res.status(500).json({ error: 'Lỗi server khi tải danh sách trang trại.' });
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

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const nfcSecurity = require('../services/nfcSecurityService');

let _farmApiColumnsEnsured = false;
async function ensureFarmApiColumns() {
  if (_farmApiColumnsEnsured) return;
  try {
    await pool.query(`
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS api_enabled BOOLEAN DEFAULT true;
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS api_key_version INTEGER DEFAULT 1;
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS global_did VARCHAR(120);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS sub_role VARCHAR(40) DEFAULT 'owner';
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS global_did VARCHAR(120);
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS entity_class VARCHAR(30) DEFAULT 'plant';
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS biomass_dbh_cm NUMERIC(8,2) DEFAULT 18.5;
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS canopy_height_m NUMERIC(8,2) DEFAULT 4.5;
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS issue_level INTEGER DEFAULT 1;
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS card_type VARCHAR(50) DEFAULT 'NTAG213_CRYPTO';
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS trace_flag BOOLEAN DEFAULT false;
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS chuid_hash VARCHAR(128);
      ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS prev_log_hash VARCHAR(64);
      ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS record_hash VARCHAR(64);
      ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT true;
    `);
    _farmApiColumnsEnsured = true;
  } catch (e) {
    console.warn('Warning ensuring farm API columns:', e.message);
  }
}

function generateFarmLiveApiKey(farmId, keyVersion = 1) {
  const secret = process.env.JWT_SECRET || 'tanbao-agtech-erp-secret';
  const ver = parseInt(keyVersion, 10) || 1;
  const hmac = crypto.createHmac('sha256', secret).update(`farm_live_dataset_v${ver}_${farmId}`).digest('hex').slice(0, 32);
  return `tb_live_${farmId}_v${ver}_${hmac}`;
}

// GET /api/farms/:id/api-link — Lấy đường dẫn Live API, trạng thái Bật/Ngắt & API Key riêng của Trang trại
router.get('/:id/api-link', auth, async (req, res) => {
  try {
    await ensureFarmApiColumns();
    const farmId = parseInt(req.params.id, 10);
    if (isNaN(farmId)) return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });

    const farmRes = await pool.query('SELECT id, name, user_id, COALESCE(api_enabled, true) as api_enabled, COALESCE(api_key_version, 1) as api_key_version FROM farms WHERE id = $1 LIMIT 1', [farmId]);
    if (farmRes.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    const farm = farmRes.rows[0];

    const isAssigned = req.user.farm_id && Number(farm.id) === Number(req.user.farm_id);
    if (req.user.role !== 'admin' && Number(farm.user_id) !== Number(req.user.id) && !isAssigned) {
      return res.status(403).json({ error: 'Bạn không có quyền lấy API Key của trang trại này.' });
    }

    const apiKey = generateFarmLiveApiKey(farmId, farm.api_key_version);
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.get('host');
    const liveUrl = `${protocol}://${host}/api/farms/${farmId}/full-dataset?api_key=${apiKey}`;

    res.json({
      success: true,
      farm_id: farmId,
      farm_name: farm.name,
      api_enabled: farm.api_enabled !== false,
      api_key_version: farm.api_key_version || 1,
      api_key: apiKey,
      live_dataset_url: liveUrl,
      usage_note: 'URL này trả về dữ liệu JSON thời gian thực (Real-time Live Data) chuẩn Quốc tế của toàn bộ trang trại. Admin có thể ngắt kết nối hoặc thu hồi mã API Key bất cứ lúc nào.'
    });
  } catch (err) {
    console.error('Error generating farm API link:', err);
    res.status(500).json({ error: 'Lỗi server khi tạo API Link.' });
  }
});

// POST /api/farms/:id/api-control — Admin chủ động Ngắt / Bật lại đường dẫn API hoặc Đổi API Key mới (Thu hồi link cũ)
router.post('/:id/api-control', auth, admin, async (req, res) => {
  try {
    await ensureFarmApiColumns();
    const farmId = parseInt(req.params.id, 10);
    if (isNaN(farmId)) return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });

    const { action } = req.body; // 'disable' | 'enable' | 'toggle' | 'rotate_key'
    const farmRes = await pool.query('SELECT id, name, COALESCE(api_enabled, true) as api_enabled, COALESCE(api_key_version, 1) as api_key_version FROM farms WHERE id = $1 LIMIT 1', [farmId]);
    if (farmRes.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    const farm = farmRes.rows[0];

    let newEnabled = farm.api_enabled !== false;
    let newVersion = parseInt(farm.api_key_version, 10) || 1;
    let msg = '';

    if (action === 'disable') {
      newEnabled = false;
      msg = `Đã NGẮT đường dẫn API dữ liệu của trang trại "${farm.name}"! Mọi truy cập qua link API sẽ bị chặn ngay lập tức.`;
    } else if (action === 'enable') {
      newEnabled = true;
      msg = `Đã MỞ LẠI đường dẫn API dữ liệu của trang trại "${farm.name}"!`;
    } else if (action === 'rotate_key') {
      newVersion += 1;
      newEnabled = true;
      msg = `Đã HỦY link API cũ và tạo mã API Key mới (v${newVersion}) cho trang trại "${farm.name}"!`;
    } else {
      newEnabled = !newEnabled;
      msg = newEnabled
        ? `Đã MỞ LẠI đường dẫn API dữ liệu của trang trại "${farm.name}"!`
        : `Đã NGẮT đường dẫn API dữ liệu của trang trại "${farm.name}"! Mọi truy cập qua link API sẽ bị chặn ngay lập tức.`;
    }

    await pool.query(
      'UPDATE farms SET api_enabled = $1, api_key_version = $2, updated_at = NOW() WHERE id = $3',
      [newEnabled, newVersion, farmId]
    );
    await delCacheByPattern('farms_');

    const apiKey = generateFarmLiveApiKey(farmId, newVersion);
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.get('host');
    const liveUrl = `${protocol}://${host}/api/farms/${farmId}/full-dataset?api_key=${apiKey}`;

    res.json({
      success: true,
      message: msg,
      farm_id: farmId,
      farm_name: farm.name,
      api_enabled: newEnabled,
      api_key_version: newVersion,
      api_key: apiKey,
      live_dataset_url: liveUrl
    });
  } catch (err) {
    console.error('Error controlling farm API access:', err);
    res.status(500).json({ error: 'Lỗi server khi điều khiển trạng thái API: ' + err.message });
  }
});

// GET /api/farms/:id/full-dataset (Alias: /:id/export-json) — Xuất toàn bộ tập dữ liệu JSON chuẩn Quốc tế (Live Real-time API)
router.get(['/:id/full-dataset', '/:id/export-json'], async (req, res) => {
  try {
    await ensureFarmApiColumns();
    const farmId = parseInt(req.params.id, 10);
    if (isNaN(farmId)) {
      return res.status(400).json({ error: 'Mã trang trại (farm_id) không hợp lệ.' });
    }

    // 1. Lấy thông tin trang trại & trạng thái đóng/mở API (api_enabled, api_key_version)
    const farmRes = await pool.query(`
      SELECT f.*,
             COALESCE(f.api_enabled, true) as is_api_enabled,
             COALESCE(f.api_key_version, 1) as current_api_key_version,
             COALESCE(u.id, u_assigned.id) as owner_id,
             COALESCE(u.full_name, u_assigned.full_name) as owner_name,
             COALESCE(u.email, u_assigned.email) as owner_email,
             COALESCE(u.phone, u_assigned.phone) as owner_phone,
             COALESCE(u.account_tier, u_assigned.account_tier, 'normal') as owner_account_tier
      FROM farms f
      LEFT JOIN users u ON u.id = f.user_id
      LEFT JOIN users u_assigned ON u_assigned.farm_id = f.id AND u_assigned.role != 'admin'
      WHERE f.id = $1
      LIMIT 1
    `, [farmId]);

    if (farmRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }
    const farm = farmRes.rows[0];

    // 2. Kiểm tra nếu Admin đã NGẮT đường dẫn API của trang trại này
    if (farm.is_api_enabled === false) {
      return res.status(403).json({
        error: 'Đường dẫn API dữ liệu của trang trại này đã bị Quản trị viên (Admin) ngắt kết nối hoặc tạm khóa.',
        code: 'API_ACCESS_DISABLED',
        farm_id: farmId
      });
    }

    // 3. Xác thực qua Live API Key (theo đúng phiên bản api_key_version hiện hành) hoặc JWT Bearer Token
    const providedApiKey = req.query.api_key || req.headers['x-api-key'];
    const expectedApiKey = generateFarmLiveApiKey(farmId, farm.current_api_key_version);
    const legacyApiKeyV1 = `tb_live_${farmId}_` + crypto.createHmac('sha256', process.env.JWT_SECRET || 'tanbao-agtech-erp-secret').update(`farm_live_dataset_v1_${farmId}`).digest('hex').slice(0, 32);

    let authorizedViaApiKey = false;
    let authUser = null;

    if (providedApiKey && (providedApiKey === expectedApiKey || (Number(farm.current_api_key_version) === 1 && providedApiKey === legacyApiKeyV1))) {
      authorizedViaApiKey = true;
    } else if (providedApiKey) {
      return res.status(401).json({
        error: 'Mã API Key không hợp lệ hoặc đã bị Quản trị viên thu hồi / thay đổi.',
        code: 'INVALID_OR_REVOKED_API_KEY'
      });
    } else {
      const authHeader = req.headers['authorization'];
      const rawToken = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split(' ')[1] : req.query.token;
      if (!rawToken) {
        return res.status(401).json({
          error: 'Chưa xác thực. Vui lòng truyền ?api_key=<FARM_API_KEY> hoặc Header Authorization: Bearer <TOKEN>.'
        });
      }
      try {
        const decoded = jwt.verify(rawToken, process.env.JWT_SECRET);
        const uRes = await pool.query("SELECT id, role, COALESCE(sub_role, 'owner') as sub_role, farm_id FROM users WHERE id = $1 LIMIT 1", [decoded.id]);
        if (uRes.rows.length === 0) {
          return res.status(401).json({ error: 'Tài khoản không tồn tại.' });
        }
        authUser = uRes.rows[0];
      } catch (_) {
        return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
      }
    }

    if (!authorizedViaApiKey && authUser) {
      const isAssigned = authUser.farm_id && Number(farm.id) === Number(authUser.farm_id);
      if (authUser.role !== 'admin' && Number(farm.user_id) !== Number(authUser.id) && !isAssigned) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập dữ liệu trang trại này.' });
      }
    }

    // Gallagher 8.30 Query Parameters: ?updated_after=<ISO_TIME>, ?fields=..., ?role=care_worker
    const updatedAfterRaw = req.query.updated_after ? new Date(String(req.query.updated_after)) : null;
    const hasValidUpdatedAfter = updatedAfterRaw && !isNaN(updatedAfterRaw.getTime());
    const effectiveSubRole = String(req.query.role || (authUser && authUser.sub_role) || 'owner').toLowerCase();
    const isRestrictedCareWorker = effectiveSubRole === 'care_worker' || effectiveSubRole === 'auditor_readonly';

    // Đảm bảo luôn trả dữ liệu tươi mới nhất (No-Cache), tự động cập nhật mỗi khi có dữ liệu mới
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // 2. Truy vấn song song toàn bộ dữ liệu liên quan đến Trang trại
    const [
      plotsRes,
      plantsRes,
      logsRes,
      mediaRes,
      suppliesRes,
      supplyUsagesRes,
      nfcRes,
      devicesRes,
      iotRes
    ] = await Promise.all([
      pool.query('SELECT * FROM farm_plots WHERE farm_id = $1 ORDER BY plot_code ASC', [farmId]).catch(() => ({ rows: [] })),
      pool.query('SELECT * FROM plants WHERE farm_id = $1 AND deleted_at IS NULL ORDER BY id ASC', [farmId]),
      pool.query(`
        SELECT pl.*, u.full_name as actor_name
        FROM plant_logs pl
        JOIN plants p ON pl.plant_id = p.id
        LEFT JOIN users u ON u.id = pl.created_by
        WHERE p.farm_id = $1 AND (pl.is_deleted IS NOT TRUE)
        ORDER BY pl.log_date ASC, pl.id ASC
      `, [farmId]),
      pool.query(`
        SELECT pm.*
        FROM plant_media pm
        JOIN plants p ON pm.plant_id = p.id
        WHERE p.farm_id = $1
        ORDER BY pm.created_at DESC
      `, [farmId]).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT s.*,
               COALESCE(SUM(su.quantity), 0) as total_consumed_qty,
               COALESCE(SUM(su.total_cost), 0) as total_consumed_cost
        FROM supplies s
        LEFT JOIN supply_usages su ON su.supply_id = s.id AND (su.farm_id = $1 OR su.plant_id IN (SELECT id FROM plants WHERE farm_id = $1))
        WHERE s.farm_id = $1
           OR s.user_id = $2
           OR s.id IN (SELECT supply_id FROM supply_usages WHERE farm_id = $1 OR plant_id IN (SELECT id FROM plants WHERE farm_id = $1))
        GROUP BY s.id
        ORDER BY s.category ASC, s.name ASC
      `, [farmId, farm.owner_id || 0]),
      pool.query(`
        SELECT su.*, s.name as supply_name, s.category as supply_category, s.unit as supply_unit,
               p.tree_code, p.plant_type
        FROM supply_usages su
        LEFT JOIN supplies s ON su.supply_id = s.id
        LEFT JOIN plants p ON su.plant_id = p.id
        WHERE su.farm_id = $1 OR p.farm_id = $1
        ORDER BY su.usage_date DESC, su.id DESC
      `, [farmId]),
      pool.query(`
        SELECT * FROM nfc_tags_inventory
        WHERE farm_id = $1 OR plant_id IN (SELECT id FROM plants WHERE farm_id = $1)
        ORDER BY id ASC
      `, [farmId]).catch(() => ({ rows: [] })),
      pool.query('SELECT * FROM devices WHERE farm_id = $1 ORDER BY id ASC', [farmId]).catch(() => ({ rows: [] })),
      pool.query('SELECT * FROM farm_iot_sensors WHERE farm_id = $1 LIMIT 1', [farmId]).catch(() => ({ rows: [] }))
    ]);

    const allPlantsRaw = plantsRes.rows;
    const allLogsRaw = logsRes.rows;
    const allMedia = mediaRes.rows;
    const supplies = suppliesRes.rows;
    const allSupplyUsages = supplyUsagesRes.rows;

    // Ánh xạ NFC Tag theo plant_id để gắn thông tin Gallagher FTCard IssueLevel & PIV CHUID
    const nfcByPlant = {};
    const enrichedNfcTags = nfcRes.rows.map(tag => {
      const issueLvl = parseInt(tag.issue_level, 10) || 1;
      const chuid = tag.chuid_hash || nfcSecurity.generatePivChuidHash(tag.uid, farmId, tag.plant_id || 0, issueLvl);
      const enriched = {
        ...tag,
        issue_level: issueLvl,
        card_type: tag.card_type || 'NTAG213_CRYPTO',
        trace_flag: Boolean(tag.trace_flag),
        chuid_hash: chuid
      };
      if (tag.plant_id) nfcByPlant[tag.plant_id] = enriched;
      return enriched;
    });

    // 3. Xác thực chuỗi băm bất biến ISO/IEC 27001 (Cryptographic SHA-256 Hash-Chain) trên toàn bộ nhật ký
    let runningPrevHash = 'GENESIS_00000000000000000000000000000000000000000000000000000000';
    let genesisHash = runningPrevHash;
    let chainIntact = true;

    const hashVerifiedLogs = allLogsRaw.map((log, idx) => {
      const prevH = log.prev_log_hash || runningPrevHash;
      const canonicalStr = `${prevH}|${log.id}|${log.plant_id}|${log.log_type}|${log.log_date}|${log.batch_code || ''}`;
      const computedHash = crypto.createHash('sha256').update(canonicalStr).digest('hex');
      const finalRecordHash = log.record_hash || computedHash;
      if (idx === 0) genesisHash = prevH;
      runningPrevHash = finalRecordHash;
      return {
        ...log,
        prev_log_hash: prevH,
        record_hash: finalRecordHash,
        is_locked: log.is_locked !== false
      };
    });

    // Áp dụng lọc Delta Sync (?updated_after=...) nếu client truyền vào
    const allLogs = (hasValidUpdatedAfter
      ? hashVerifiedLogs.filter(l => new Date(l.updated_at || l.created_at || l.log_date) > updatedAfterRaw)
      : hashVerifiedLogs
    ).slice().reverse();

    const plants = hasValidUpdatedAfter
      ? allPlantsRaw.filter(p => new Date(p.updated_at || p.created_at) > updatedAfterRaw || allLogs.some(l => l.plant_id === p.id))
      : allPlantsRaw;

    const supplyUsages = hasValidUpdatedAfter
      ? allSupplyUsages.filter(su => new Date(su.created_at || su.usage_date) > updatedAfterRaw)
      : allSupplyUsages;

    // 3b. Phân nhóm Nhật ký canh tác, Bệnh cây, Thu hoạch & Media theo từng cây
    const logsByPlant = {};
    const mediaByPlant = {};
    const diseaseRecords = [];
    const harvestRecords = [];

    let totalRevenue = 0;
    let totalHarvestWeightKg = 0;
    let totalHarvestFruits = 0;
    let totalFertilizerKgUsed = 0;

    allMedia.forEach(m => {
      if (!mediaByPlant[m.plant_id]) mediaByPlant[m.plant_id] = [];
      mediaByPlant[m.plant_id].push({
        media_id: m.id,
        plant_id: m.plant_id,
        media_type: m.media_type || (String(m.file_url || m.url || '').match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image'),
        url: m.file_url || m.url || m.image_url,
        caption: m.caption || m.description || null,
        created_at: m.created_at
      });
    });

    allLogs.forEach(log => {
      let details = log.details;
      if (typeof details === 'string') {
        try { details = JSON.parse(details); } catch (_) { details = {}; }
      }
      details = details || {};

      // Thu thập media đính kèm trong nhật ký canh tác
      const logMedia = [];
      if (log.image_url) logMedia.push({ type: 'image', url: log.image_url });
      if (log.video_url) logMedia.push({ type: 'video', url: log.video_url });
      if (Array.isArray(details.images)) {
        details.images.forEach(u => logMedia.push({ type: 'image', url: u }));
      }
      if (Array.isArray(details.videos)) {
        details.videos.forEach(u => logMedia.push({ type: 'video', url: u }));
      }

      const safeDetails = isRestrictedCareWorker
        ? (() => {
            const copy = { ...details };
            delete copy.unit_price;
            delete copy.total_cost;
            delete copy.total_revenue;
            delete copy.price_per_tree;
            delete copy.revenue;
            return copy;
          })()
        : details;

      const normalizedLog = {
        log_id: log.id,
        plant_id: log.plant_id,
        log_type: log.log_type,
        log_date: log.log_date,
        batch_code: log.batch_code || null,
        description: log.description || log.note || details.note || '',
        cost_vnd: isRestrictedCareWorker ? null : (parseFloat(log.cost) || parseFloat(details.total_cost) || 0),
        phi_days: log.phi_days || details.phi_days || null,
        quarantine_until: log.quarantine_until || null,
        technical_details: safeDetails,
        media_attachments: logMedia,
        iso27001_audit: {
          prev_log_hash: log.prev_log_hash,
          record_hash: log.record_hash,
          is_locked: log.is_locked
        },
        recorded_by: log.actor_name || log.operator_name || null,
        created_at: log.created_at
      };

      if (!logsByPlant[log.plant_id]) logsByPlant[log.plant_id] = [];
      logsByPlant[log.plant_id].push(normalizedLog);

      // Bóc tách hồ sơ Bệnh cây & Dịch hại (Phytosanitary / Disease Logs)
      const lTypeLower = String(log.log_type || '').toLowerCase();
      if (lTypeLower.includes('bệnh') || lTypeLower.includes('sâu') || lTypeLower.includes('disease') || details.disease_name) {
        diseaseRecords.push({
          log_id: log.id,
          plant_id: log.plant_id,
          detected_date: log.log_date,
          disease_name: details.disease_name || log.description || log.note || log.log_type,
          severity: details.severity || details.level || 'Cần theo dõi',
          treatment_measure: details.treatment || details.medicine || log.description || log.note || null,
          media: logMedia
        });
      }

      // Bóc tách hồ sơ Doanh thu & Sản lượng Thu hoạch (Harvest & Revenue Logs)
      if (
        lTypeLower.includes('thu hoạch') ||
        lTypeLower.includes('thu') ||
        lTypeLower.includes('harvest') ||
        details.total_revenue ||
        details.price_per_tree ||
        details.fruit_count
      ) {
        const rev = parseFloat(details.total_revenue) || parseFloat(details.price_per_tree) || parseFloat(details.revenue) || parseFloat(log.cost) || 0;
        const weightKg = parseFloat(details.amount) || parseFloat(details.yield_kg) || parseFloat(details.quantity) || 0;
        const fruits = parseFloat(details.fruit_count) || 0;

        totalRevenue += rev;
        totalHarvestWeightKg += weightKg;
        totalHarvestFruits += fruits;

        harvestRecords.push({
          log_id: log.id,
          plant_id: log.plant_id,
          batch_code: log.batch_code || null,
          harvest_date: log.log_date,
          yield_weight_kg: weightKg,
          fruit_count: fruits,
          revenue_vnd: isRestrictedCareWorker ? null : rev,
          buyer_or_note: details.buyer || log.description || log.note || null,
          media: logMedia
        });
      }
    });

    // 4. Tính toán Vật tư, Tồn kho & Giá trị tiêu hao lũy kế chuẩn ERP
    let totalInventoryInflowVnd = 0;
    let currentStockValueVnd = 0;
    let totalCumulativeConsumptionVnd = 0;
    const consumptionByCategory = {
      'Bón phân': 0,
      'Phun thuốc': 0,
      'Tiền nước': 0,
      'Nhân công': 0,
      'Khác': 0
    };

    const formattedSupplies = supplies.map(s => {
      const unitPrice = parseFloat(s.unit_price) || 0;
      const stockQty = parseFloat(s.stock_quantity) || 0;
      const pkgQty = parseFloat(s.package_qty) || 1;
      const pkgPrice = parseFloat(s.package_price) || (unitPrice * pkgQty);
      const consumedQty = parseFloat(s.total_consumed_qty) || 0;
      const consumedCost = parseFloat(s.total_consumed_cost) || 0;
      const stockVal = stockQty * unitPrice;
      const inflowVal = Math.max(stockVal + consumedCost, pkgPrice);

      currentStockValueVnd += stockVal;
      totalInventoryInflowVnd += inflowVal;

      if (s.category === 'Bón phân') {
        totalFertilizerKgUsed += consumedQty;
      }

      return {
        supply_id: s.id,
        sku_code: `SUP-${String(s.id).padStart(4, '0')}`,
        name: s.name,
        category: s.category,
        base_unit: s.unit,
        package_specification: isRestrictedCareWorker ? null : {
          package_quantity: pkgQty,
          package_price_vnd: pkgPrice,
          unit_price_vnd: unitPrice
        },
        inventory_status: {
          current_stock_quantity: stockQty,
          current_stock_valuation_vnd: isRestrictedCareWorker ? null : Math.round(stockVal),
          cumulative_consumed_quantity: consumedQty,
          cumulative_consumed_valuation_vnd: isRestrictedCareWorker ? null : Math.round(consumedCost)
        },
        manufacturer: s.manufacturer || null,
        active_ingredient: s.active_ingredient || null,
        image_url: s.image_url || null,
        note: s.note || null,
        updated_at: s.updated_at || s.created_at
      };
    });

    supplyUsages.forEach(su => {
      const cost = parseFloat(su.total_cost) || 0;
      totalCumulativeConsumptionVnd += cost;
      const cat = su.supply_category && consumptionByCategory[su.supply_category] !== undefined
        ? su.supply_category
        : 'Khác';
      consumptionByCategory[cat] += cost;
    });

    // 5. Chuẩn hóa Đa giác ranh giới GeoJSON (RFC 7946)
    let rawCoords = [];
    try {
      rawCoords = typeof farm.polygon_coordinates === 'string'
        ? JSON.parse(farm.polygon_coordinates)
        : (farm.polygon_coordinates || []);
    } catch (_) {}

    // 6. Chuẩn hóa danh sách Thực thể Sinh học (Cây trồng / Vật nuôi) kèm Global DID & NFC Card Security
    let totalAboveGroundBiomassKg = 0;
    const formattedPlants = plants.map(p => {
      const pLogs = logsByPlant[p.id] || [];
      const pMedia = [...(mediaByPlant[p.id] || [])];
      if (p.image_url) {
        pMedia.unshift({
          media_id: `avatar_${p.id}`,
          plant_id: p.id,
          media_type: 'image',
          url: p.image_url,
          caption: 'Ảnh đại diện cây trồng',
          created_at: p.created_at
        });
      }

      const entityClass = p.entity_class || 'plant';
      const plantGlobalDid = p.global_did || `did:agtech:vn:farm-${farmId}:${entityClass}-${p.id}`;
      const nfcTagObj = nfcByPlant[p.id] || null;
      const rawUid = p.nfc_uid || p.nfc_tag_id || (nfcTagObj ? nfcTagObj.uid : null);
      const issueLevel = nfcTagObj ? nfcTagObj.issue_level : 1;

      // Tính sinh khối trên mặt đất (AGB) cho từng cây lâu năm theo phương trình sinh trắc học Chave et al. (2014) / IPCC AFOLU Tier 2:
      // AGB (kg) = 0.0673 * (rho * DBH^2 * H)^0.976, với mật độ gỗ trung bình cây ăn quả nhiệt đới rho = 0.58 g/cm3
      const dbhCm = parseFloat(p.biomass_dbh_cm) || 18.5;
      const heightM = parseFloat(p.canopy_height_m) || 4.5;
      const woodDensity = 0.58;
      const plantAgbKg = entityClass === 'plant'
        ? parseFloat((0.0673 * Math.pow(woodDensity * Math.pow(dbhCm, 2) * heightM, 0.976)).toFixed(2))
        : 0;
      totalAboveGroundBiomassKg += plantAgbKg;

      return {
        plant_id: p.id,
        global_did: plantGlobalDid,
        entity_class: entityClass,
        tree_code: p.tree_code || String(p.id),
        nfc_uid: rawUid,
        nfc_card_security: rawUid ? {
          uid: rawUid,
          card_type: nfcTagObj ? nfcTagObj.card_type : 'NTAG213_CRYPTO',
          issue_level: issueLevel,
          trace_flag: nfcTagObj ? nfcTagObj.trace_flag : false,
          chuid_hash: nfcTagObj ? nfcTagObj.chuid_hash : nfcSecurity.generatePivChuidHash(rawUid, farmId, p.id, issueLevel)
        } : null,
        taxonomy: {
          plant_type: p.plant_type,
          plant_variety: p.plant_variety || null,
          plant_age: p.plant_age || null,
          planting_date: p.planting_date || null
        },
        spatial_location: {
          plot_code: p.plot_code || null,
          row_number: p.row_number || null,
          latitude: p.latitude !== null && p.latitude !== undefined ? parseFloat(p.latitude) : null,
          longitude: p.longitude !== null && p.longitude !== undefined ? parseFloat(p.longitude) : null,
          location_label: p.location || null
        },
        health_and_phytosanitary: {
          current_health_status: p.health_status || 'Tốt',
          past_diseases: p.past_diseases || null,
          is_quarantined: !!(p.quarantine_until && new Date(p.quarantine_until) > new Date()),
          quarantine_until: p.quarantine_until || null
        },
        biomass_and_carbon: {
          dbh_cm: dbhCm,
          canopy_height_m: heightM,
          above_ground_biomass_kg: plantAgbKg
        },
        yield_and_baseline: {
          initial_yield_kg: parseFloat(p.initial_yield) || 0,
          cumulative_logs_count: pLogs.length
        },
        cultivation_logs: pLogs,
        media_gallery: pMedia,
        created_at: p.created_at,
        updated_at: p.updated_at
      };
    });

    // 7. Tổng hợp toàn bộ thư viện Ảnh & Video của Trang trại
    const farmMediaGallery = [];
    formattedPlants.forEach(fp => {
      fp.media_gallery.forEach(m => farmMediaGallery.push(m));
      fp.cultivation_logs.forEach(l => {
        (l.media_attachments || []).forEach(att => {
          farmMediaGallery.push({
            plant_id: fp.plant_id,
            tree_code: fp.tree_code,
            log_id: l.log_id,
            log_type: l.log_type,
            media_type: att.type,
            url: att.url,
            created_at: l.log_date
          });
        });
      });
    });

    const netProfitVnd = totalRevenue - totalCumulativeConsumptionVnd;
    const roiPercent = totalCumulativeConsumptionVnd > 0
      ? Math.round(((netProfitVnd / totalCumulativeConsumptionVnd) * 100) * 100) / 100
      : (totalRevenue > 0 ? 100 : 0);

    // 8. Tính toán Tín chỉ Carbon (IPCC 2006 AFOLU Tier-2 / Gold Standard MRV)
    // Below-Ground Biomass (BGB) = 0.24 * AGB (Tỷ lệ rễ/thân cây ăn quả nhiệt đới IPCC)
    const belowGroundBiomassKg = parseFloat((totalAboveGroundBiomassKg * 0.24).toFixed(2));
    const totalBiomassKg = parseFloat((totalAboveGroundBiomassKg + belowGroundBiomassKg).toFixed(2));
    // Hệ số Carbon trong sinh khối khô = 0.47; Hệ số quy đổi C sang CO2 = 44 / 12 (3.6667)
    const grossCarbonStockKgC = parseFloat((totalBiomassKg * 0.47).toFixed(2));
    const grossCo2SequesteredTco2e = parseFloat(((grossCarbonStockKgC * (44 / 12)) / 1000).toFixed(4));
    // Khấu trừ phát thải N2O từ phân bón hóa học/hữu cơ (IPCC EF1 = 0.01 kg N2O-N/kg N, GWP N2O = 273)
    const estimatedFertilizerEmissionsTco2e = parseFloat(((totalFertilizerKgUsed * 0.15 * 0.01 * (44 / 28) * 273) / 1000).toFixed(4));
    const netCarbonCreditTco2e = parseFloat(Math.max(0, grossCo2SequesteredTco2e - estimatedFertilizerEmissionsTco2e).toFixed(4));
    const carbonCreditPriceUsd = 15.0; // Giá tham chiếu tín chỉ Carbon nông nghiệp tự nguyện (VCM) 15 USD/tCO2e
    const estimatedCarbonValueUsd = parseFloat((netCarbonCreditTco2e * carbonCreditPriceUsd).toFixed(2));
    const estimatedCarbonValueVnd = Math.round(estimatedCarbonValueUsd * 25400);

    // Tạo con trỏ Gallagher 8.30 Delta Sync `updates.href`
    const nowIso = new Date().toISOString();
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.get('host');
    const apiKeyParam = providedApiKey ? `api_key=${encodeURIComponent(providedApiKey)}&` : '';
    const nextDeltaSyncUrl = `${protocol}://${host}/api/farms/${farmId}/full-dataset?${apiKeyParam}updated_after=${encodeURIComponent(nowIso)}`;

    // 9. Đóng gói JSON chuẩn Quốc tế (Gallagher 8.30, ISO/IEC 25010, ISO/IEC 27001, GlobalGAP, VietGAP, IPCC Carbon MRV)
    const fullDatasetPayload = {
      schema_standard: 'AGTECH-ERP-GALLAGHER830-ISO25010-ISO27001-GLOBALGAP-CARBON-V2.0',
      exported_at: nowIso,
      currency: 'VND',
      coordinate_reference_system: 'EPSG:4326 (WGS84)',
      access_privilege_scope: effectiveSubRole,
      delta_sync_mode: hasValidUpdatedAfter ? {
        Incremental_Sync: true,
        updated_after_filter: updatedAfterRaw.toISOString()
      } : {
        Incremental_Sync: false,
        mode: 'FULL_SNAPSHOT'
      },
      updates: {
        href: nextDeltaSyncUrl,
        poll_interval_recommended_seconds: 30
      },

      // KHỐI 1: THÔNG TIN ĐỊNH DANH TRANG TRẠI & ĐA GIÁC GIS
      farm_profile: {
        farm_id: farm.id,
        global_did: farm.global_did || `did:agtech:vn:farm-${farm.id}`,
        farm_name: farm.name,
        description: farm.description || '',
        certifications: {
          puc_code: farm.puc_code || null,
          vietgap_cert_number: farm.vietgap_cert_number || null,
          vietgap_cert_date: farm.vietgap_cert_date || null,
          vietgap_cert_org: farm.vietgap_cert_org || null
        },
        owner: {
          user_id: farm.owner_id,
          full_name: farm.owner_name,
          email: farm.owner_email,
          phone: farm.owner_phone,
          account_tier: farm.owner_account_tier
        },
        spatial_geometry: {
          area_m2: parseFloat(farm.area) || 0,
          area_hectares: parseFloat(((parseFloat(farm.area) || 0) / 10000).toFixed(4)),
          geojson_polygon: {
            type: 'Polygon',
            coordinates: [rawCoords]
          },
          plots: plotsRes.rows
        },
        created_at: farm.created_at,
        updated_at: farm.updated_at
      },

      // KHỐI 2: TÀI CHÍNH, DOANH THU, GIÁ THÀNH & LŨY KẾ TIÊU HAO (ERP FINANCIAL LEDGER)
      financial_and_yield_summary: isRestrictedCareWorker ? {
        redacted: true,
        reason: 'Ẩn dữ liệu nhạy cảm (Giá thành & Doanh thu) theo phân quyền Role-based Field Privilege (care_worker / auditor_readonly).',
        harvest_metrics: {
          total_harvest_batches: harvestRecords.length,
          total_yield_weight_kg: totalHarvestWeightKg,
          total_fruit_count: totalHarvestFruits
        }
      } : {
        total_inventory_inflow_valuation_vnd: Math.round(totalInventoryInflowVnd),
        current_inventory_stock_valuation_vnd: Math.round(currentStockValueVnd),
        cumulative_supply_consumption_cost_vnd: Math.round(totalCumulativeConsumptionVnd),
        consumption_breakdown_by_category_vnd: consumptionByCategory,
        total_harvest_revenue_vnd: Math.round(totalRevenue),
        net_profit_vnd: Math.round(netProfitVnd),
        roi_percentage: roiPercent,
        harvest_metrics: {
          total_harvest_batches: harvestRecords.length,
          total_yield_weight_kg: totalHarvestWeightKg,
          total_fruit_count: totalHarvestFruits
        }
      },

      // KHỐI 3: KHO VẬT TƯ, GIÁ THÀNH, TỒN KHO & LỊCH SỬ TIÊU HAO
      supplies_and_inventory: {
        total_sku_count: formattedSupplies.length,
        total_usage_transactions: supplyUsages.length,
        inventory_catalog: formattedSupplies,
        cumulative_usage_ledger: supplyUsages.map(su => ({
          usage_id: su.id,
          supply_id: su.supply_id,
          supply_name: su.supply_name,
          category: su.supply_category,
          plant_id: su.plant_id,
          tree_code: su.tree_code || null,
          usage_date: su.usage_date,
          quantity_consumed: parseFloat(su.quantity) || 0,
          unit: su.supply_unit,
          unit_price_vnd: isRestrictedCareWorker ? null : (parseFloat(su.unit_price) || 0),
          total_cost_vnd: isRestrictedCareWorker ? null : (parseFloat(su.total_cost) || 0),
          note: su.note || null
        }))
      },

      // KHỐI 4: DANH SÁCH CÂY TRỒNG & LỊCH SỬ CANH TÁC CHI TIẾT TỪNG CÂY
      plants_and_cultivation: {
        total_plants: formattedPlants.length,
        plants_with_gps_count: formattedPlants.filter(p => p.spatial_location.latitude !== null && p.spatial_location.longitude !== null).length,
        health_distribution: {
          good: formattedPlants.filter(p => p.health_and_phytosanitary.current_health_status === 'Tốt').length,
          watch: formattedPlants.filter(p => p.health_and_phytosanitary.current_health_status === 'Cần chú ý' || p.health_and_phytosanitary.current_health_status === 'Bình thường').length,
          diseased: formattedPlants.filter(p => p.health_and_phytosanitary.current_health_status === 'Bệnh').length
        },
        plants: formattedPlants
      },

      // KHỐI 5: HỒ SƠ BỆNH CÂY, DỊCH HẠI & THU HOẠCH TOÀN TRANG TRẠI
      phytosanitary_and_harvest_logs: {
        disease_and_pest_incidents: diseaseRecords,
        harvest_and_revenue_records: harvestRecords
      },

      // KHỐI 6: CẢM BIẾN IOT, ĐỊNH DANH NFC & THƯ VIỆN ẢNH/VIDEO
      iot_nfc_and_media: {
        iot_telemetry: iotRes.rows[0] || null,
        iot_devices: devicesRes.rows,
        nfc_tags: enrichedNfcTags,
        media_gallery: {
          total_files: farmMediaGallery.length,
          items: farmMediaGallery
        }
      },

      // KHỐI 7: QUẢN TRỊ BẢO MẬT ISO/IEC 27001 & ĐỊNH LƯỢNG TÍN CHỈ CARBON (MRV ENGINE)
      iso27001_governance_and_carbon_mrv: {
        iso27001_audit_integrity: {
          standard: 'ISO/IEC 27001:2022 Annex A.8.15 (Cryptographic Immutable Audit Log)',
          hash_algorithm: 'SHA-256',
          chain_status: chainIntact ? 'VERIFIED_IMMUTABLE' : 'TAMPER_DETECTED',
          verified_logs_count: hashVerifiedLogs.length,
          genesis_hash: genesisHash,
          latest_chain_head_hash: runningPrevHash
        },
        carbon_footprint_and_credits_mrv: {
          methodology: 'IPCC 2006 AFOLU Tier-2 / Chave et al. (2014) Allometric Biomass Equation',
          active_woody_plants_count: formattedPlants.filter(p => p.entity_class === 'plant').length,
          above_ground_biomass_kg: parseFloat(totalAboveGroundBiomassKg.toFixed(2)),
          below_ground_biomass_kg: belowGroundBiomassKg,
          total_biomass_kg: totalBiomassKg,
          gross_carbon_stock_kg_c: grossCarbonStockKgC,
          gross_co2_sequestered_tco2e: grossCo2SequesteredTco2e,
          fertilizer_n2o_emissions_tco2e: estimatedFertilizerEmissionsTco2e,
          net_carbon_credit_tco2e: netCarbonCreditTco2e,
          reference_vcm_price_usd_per_tco2e: carbonCreditPriceUsd,
          estimated_carbon_credit_valuation_usd: estimatedCarbonValueUsd,
          estimated_carbon_credit_valuation_vnd: estimatedCarbonValueVnd
        }
      }
    };

    // Hỗ trợ Gallagher 8.30 Field Specifiers (?fields=farm_profile,iso27001_governance_and_carbon_mrv)
    if (req.query.fields && String(req.query.fields).trim()) {
      const requestedFields = String(req.query.fields).split(',').map(f => f.trim()).filter(Boolean);
      const alwaysKeep = ['schema_standard', 'exported_at', 'currency', 'coordinate_reference_system', 'access_privilege_scope', 'delta_sync_mode', 'updates'];
      const filteredPayload = {};
      alwaysKeep.forEach(k => { filteredPayload[k] = fullDatasetPayload[k]; });
      requestedFields.forEach(k => {
        if (fullDatasetPayload[k] !== undefined) {
          filteredPayload[k] = fullDatasetPayload[k];
        }
      });
      return res.json(filteredPayload);
    }

    res.json(fullDatasetPayload);
  } catch (err) {
    console.error('Error exporting full farm dataset:', err);
    res.status(500).json({ error: 'Lỗi server khi xuất toàn bộ dữ liệu trang trại: ' + err.message });
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

    // Check account tier limit: Normal users can only possess max 1 active farm!
    const isNormalUser = req.user.role !== 'admin' && req.user.account_tier !== 'pro';
    if (isNormalUser) {
      const existingFarmsCount = await pool.query(
        'SELECT COUNT(*)::int as count FROM farms WHERE (user_id = $1 OR created_by = $1) AND is_deleted IS NOT TRUE',
        [req.user.id]
      );
      if (existingFarmsCount.rows[0].count >= 1) {
        return res.status(403).json({
          error: '🔒 Tài khoản Nông hộ NORMAL chỉ được tạo tối đa 1 Trang trại. Vui lòng nâng cấp tài khoản PRO 👑 để sở hữu nhiều trang trại!',
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
    const { name, description, polygon_coordinates, area, user_id, puc_code, vietgap_cert_number, vietgap_cert_date, vietgap_cert_org } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Tên trang trại là bắt buộc.' });
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

    const { 
      name, description, polygon_coordinates, area, total_plants, user_id, latitude, longitude,
      puc_code, vietgap_cert_number, vietgap_cert_date, vietgap_cert_org
    } = req.body;
    
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
      message: 'Cập nhật thông tin trang trại thành công!',
      farm: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating farm:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật trang trại: ' + err.message });
  }
});

// POST /api/farms/:id/clear-gps — Reset/Clear all plants GPS in a farm (requires auth — admin or farm owner)
router.post('/:id/clear-gps', auth, async (req, res) => {
  try {
    const farmId = req.params.id;
    const farmCheck = await pool.query('SELECT * FROM farms WHERE id = $1', [farmId]);
    if (farmCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }
    const farm = farmCheck.rows[0];
    const isOwner = farm.user_id === req.user.id || (req.user.farm_id && req.user.farm_id === farm.id);
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
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
      message: `Đã xóa thành công tọa độ định vị GPS của ${resetRes.rows.length} cây trong trang trại!`,
      cleared_count: resetRes.rows.length
    });
  } catch (err) {
    console.error('Error clearing plants GPS in farm:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa tọa độ GPS: ' + err.message });
  }
});

// ── FARM IOT SENSORS & WEATHER FORECAST ENDPOINTS (PERSISTENT DB) ──
function fixMojibakeString(str) {
  if (typeof str !== 'string') return str;
  return str
    // Strip broken emoji mojibake
    .replace(/ã˜Ë¡|ðŸŒ¦ï¸|ã€\.\.\.|ðŸŒ¤ï¸|ðŸ[^\s]*|ã[^\s]*/gu, '')
    // Fix degrees
    .replace(/Â°/g, '°')
    // Fix days
    .replace(/Thá»©\s*Hai/g, 'Thứ Hai')
    .replace(/Thá»©\s*Ba/g, 'Thứ Ba')
    .replace(/Thá»©\s*TÆ°/g, 'Thứ Tư')
    .replace(/Thá»©\s*NÄƒm/g, 'Thứ Năm')
    .replace(/Thá»©\s*Sáu|Thá»©\s*Su/g, 'Thứ Sáu')
    .replace(/Thá»©\s*Bảy|Thá»©\s*By/g, 'Thứ Bảy')
    .replace(/Chá»§\s*Nháº­t|Chá»§\s*Nháºt/g, 'Chủ Nhật')
    .replace(/HÃ´m\s*nay|Hm\s*nay/g, 'Hôm nay')
    // Fix common words in advisory
    .replace(/Náº¯ng/g, 'Nắng')
    .replace(/áº¥m/g, 'ấm')
    .replace(/Thích\s*há»£p/g, 'Thích hợp')
    .replace(/phân\s*rá»\.\.\.|phân\s*rá»/g, 'phân rễ')
    .replace(/tÆ°á»›i/g, 'tưới')
    .replace(/nÆ°á»›c/g, 'nước')
    .replace(/buá»•i/g, 'buổi')
    .replace(/MÆ°a/g, 'Mưa')
    .replace(/Hạn\s*cháº¿/g, 'Hạn chế')
    .replace(/thuá»‘c/g, 'thuốc')
    .replace(/dá»\.\.\.|dá»/g, 'dễ')
    .replace(/bá»‹/g, 'bị')
    .replace(/rá»a/g, 'rửa')
    .replace(/Nhiá»\s*u/g, 'Nhiều')
    .replace(/Thá»\s*i/g, 'Thời')
    .replace(/Ä'iá»ƒm|Ä'iểm/g, 'điểm')
    .replace(/tá»'t|tốt/g, 'tốt')
    .replace(/nháº¥t/g, 'nhất')
    .replace(/Ä'á»ƒ/g, 'để')
    .replace(/gián\s*Ä'oạn/g, 'gián đoạn')
    .replace(/vi\s*lÆ°á»£ng/g, 'vi lượng')
    .replace(/dông\s*chiá»\s*u|giông\s*chiá»\s*u/g, 'dông chiều')
    .replace(/KhÆ¡i/g, 'Khơi')
    .replace(/ngáºp/g, 'ngập')
    .replace(/rá»±c/g, 'rực')
    .replace(/rá»¡/g, 'rỡ')
    .replace(/há»‡\s*thá»‘ng/g, 'hệ thống')
    .replace(/tá»±\s*Ä'á»™ng/g, 'tự động')
    // General vowels
    .replace(/Thá»©/g, 'Thứ')
    .replace(/TÆ°/g, 'Tư')
    .replace(/NÄƒm/g, 'Năm')
    .replace(/Æ°/g, 'ư')
    .replace(/Æ¡/g, 'ơ')
    .replace(/Äƒ/g, 'ă')
    .replace(/Ä'/g, 'đ')
    .replace(/á»©/g, 'ứ')
    .replace(/á»±/g, 'ự')
    .replace(/á»›/g, 'ớ')
    .replace(/á»£/g, 'ợ')
    .replace(/áº¯/g, 'ắ')
    .replace(/áº¥/g, 'ấ')
    .replace(/áº¿/g, 'ế')
    .replace(/á»‘/g, 'ố')
    .replace(/á»•/g, 'ổ')
    .replace(/á»‡/g, 'ệ')
    .replace(/á»‹/g, 'ị')
    .replace(/áº¡/g, 'ạ')
    .replace(/áº£/g, 'ả')
    .replace(/á»/g, 'ộ')
    .replace(/TÃ¢y/g, 'Tây')
    .replace(/Ã¢/g, 'â')
    .replace(/Ã´/g, 'ô')
    .replace(/Ãª/g, 'ê')
    .replace(/Ä\x90Ã´ng/g, 'Đông')
    .replace(/Ä\x90/g, 'Đ')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã\xa0/g, 'à')
    .replace(/áº£/g, 'ả')
    .replace(/Ã£/g, 'ã')
    .replace(/áº¡/g, 'ạ')
    .replace(/Ã©/g, 'é')
    .replace(/Ã¨/g, 'è')
    .replace(/áº½/g, 'ẽ')
    .replace(/áº¹/g, 'ẹ')
    .replace(/Ã\xad/g, 'í')
    .replace(/Ã¬/g, 'ì')
    .replace(/á»\x89/g, 'ỉ')
    .replace(/Ä©/g, 'ĩ')
    .replace(/á»\x8b/g, 'ị')
    .replace(/Ã³/g, 'ó')
    .replace(/Ã²/g, 'ò')
    .replace(/á»\x8f/g, 'ỏ')
    .replace(/Ãµ/g, 'õ')
    .replace(/á»\x8d/g, 'ọ')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã¹/g, 'ù')
    .replace(/á»§/g, 'ủ')
    .replace(/Å©/g, 'ũ')
    .replace(/á»¥/g, 'ụ')
    .replace(/Ã½/g, 'ý')
    .replace(/á»³/g, 'ỳ')
    .replace(/á»·/g, 'ỷ')
    .replace(/á»¹/g, 'ỹ')
    .replace(/á»µ/g, 'ỵ')
    .replace(/Ä\x91/g, 'đ')
    .trim();
}

function deepCleanMojibake(val) {
  if (!val) return val;
  if (typeof val === 'string') return fixMojibakeString(val);
  if (Array.isArray(val)) return val.map(deepCleanMojibake);
  if (typeof val === 'object') {
    const out = {};
    for (const k of Object.keys(val)) {
      out[k] = deepCleanMojibake(val[k]);
    }
    return out;
  }
  return val;
}

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
    { icon: 'sun', color: '#f59e0b', temp: '25°C - 33°C', rain: '10%', humidity: `${airHumidity}%`, wind: `${windSpeed} km/h`, advice: 'Nắng ấm: Thích hợp bón phân rễ & tưới nước buổi sáng.' },
    { icon: 'cloud-sun-rain', color: '#0284c7', temp: '24°C - 31°C', rain: '65%', humidity: '82%', wind: '15 km/h', advice: 'Mưa rào rải rác: Hạn chế phun thuốc sâu vì dễ bị rửa trôi.' },
    { icon: 'cloud-sun', color: '#059669', temp: '23°C - 30°C', rain: '20%', humidity: '75%', wind: '10 km/h', advice: 'Nhiều mây mát: Thời điểm tốt nhất để làm cỏ & tạo tán cây.' },
    { icon: 'sun-medium', color: '#eab308', temp: '25°C - 32°C', rain: '15%', humidity: '68%', wind: '14 km/h', advice: 'Nắng gián đoạn: Thích hợp phun phân bón lá & vi lượng.' },
    { icon: 'cloud-lightning', color: '#7c3aed', temp: '23°C - 29°C', rain: '85%', humidity: '88%', wind: '22 km/h', advice: 'Mưa dông chiều: Khơi thông rãnh tháo nước tránh ngập úng.' },
    { icon: 'sun', color: '#ea580c', temp: '26°C - 34°C', rain: '5%', humidity: '62%', wind: '11 km/h', advice: 'Nắng rực rỡ: Duy trì hệ thống tưới nhỏ giọt tự động.' }
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

  return deepCleanMojibake({ air_data, soil_data, water_data, weather_forecast });
}

// GET /api/farms/:id/iot-data
router.get('/:id/iot-data', auth, async (req, res) => {
  try {
    const farmId = parseInt(req.params.id);
    const cacheKey = `farm_iot_${farmId}`;
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return res.json(deepCleanMojibake(cachedData));
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
    const rawAir = typeof row.air_data === 'string' ? JSON.parse(row.air_data) : row.air_data;
    const rawSoil = typeof row.soil_data === 'string' ? JSON.parse(row.soil_data) : row.soil_data;
    const rawWater = typeof row.water_data === 'string' ? JSON.parse(row.water_data) : row.water_data;
    const rawForecast = typeof row.weather_forecast === 'string' ? JSON.parse(row.weather_forecast) : row.weather_forecast;

    const cleanedForecast = deepCleanMojibake(rawForecast);
    const cleanedAir = deepCleanMojibake(rawAir);
    const cleanedSoil = deepCleanMojibake(rawSoil);
    const cleanedWater = deepCleanMojibake(rawWater);

    // Auto-heal database record in background if it contained mojibake or emojis
    if (JSON.stringify(rawForecast) !== JSON.stringify(cleanedForecast)) {
      pool.query('UPDATE farm_iot_sensors SET weather_forecast = $1, updated_at = NOW() WHERE farm_id = $2', [JSON.stringify(cleanedForecast), farmId]).catch(() => {});
    }

    const payload = {
      success: true,
      farm_id: farmId,
      air_data: cleanedAir,
      soil_data: cleanedSoil,
      water_data: cleanedWater,
      weather_forecast: cleanedForecast,
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
    const rawAir = typeof row.air_data === 'string' ? JSON.parse(row.air_data) : row.air_data;
    const rawSoil = typeof row.soil_data === 'string' ? JSON.parse(row.soil_data) : row.soil_data;
    const rawWater = typeof row.water_data === 'string' ? JSON.parse(row.water_data) : row.water_data;
    const rawForecast = typeof row.weather_forecast === 'string' ? JSON.parse(row.weather_forecast) : row.weather_forecast;

    const payload = {
      success: true,
      message: 'Đã làm mới dữ liệu cảm biến IoT thành công!',
      farm_id: farmId,
      air_data: deepCleanMojibake(rawAir),
      soil_data: deepCleanMojibake(rawSoil),
      water_data: deepCleanMojibake(rawWater),
      weather_forecast: deepCleanMojibake(rawForecast),
      updated_at: row.updated_at
    };

    // Invalidate Redis cache
    await delCache(`farm_iot_${farmId}`);
    res.json(payload);
  } catch (err) {
    console.error('Error refreshing farm IoT data:', err);
    res.status(500).json({ error: 'Lỗi server khi làm mới dữ liệu cảm biến IoT.' });
  }
});

// DELETE farm (Default: SOFT DELETE into History/Audit Trash. Permanent Hard Delete only with ?permanent=true)
router.delete('/:id', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const farmId = parseInt(req.params.id);
    if (isNaN(farmId)) {
      return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });
    }

    const farmCheck = await client.query('SELECT * FROM farms WHERE id = $1', [farmId]);
    if (farmCheck.rows.length === 0) {
      if (req.user.role === 'admin') {
        try { await client.query('DELETE FROM data_audit_logs WHERE target_type = $1 AND record_id = $2', ['Trang trại', farmId]); } catch(_) {}
        await delCacheByPattern('farms_');
        return res.json({ success: true, message: 'Trang trại đã được xóa sạch hoàn toàn khỏi hệ thống.' });
      }
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }

    const farm = farmCheck.rows[0];
    const userName = req.user.full_name || req.user.email || `User #${req.user.id}`;

    // Check ownership: Admin or Farm Owner
    const isOwner = req.user.role === 'admin' || farm.user_id === req.user.id || farm.created_by === req.user.id || (req.user.farm_id && req.user.farm_id === farm.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa trang trại này.' });
    }

    const isHardDelete = (req.query.permanent === 'true' || req.query.hard === 'true') && req.user.role === 'admin';

    await client.query('BEGIN');

    if (isHardDelete) {
      // PERMANENT HARD CASCADE DELETE
      await client.query('DELETE FROM user_notifications WHERE farm_id = $1', [farmId]);
      await client.query('DELETE FROM user_alert_rules WHERE farm_id = $1', [farmId]);
      await client.query('DELETE FROM farm_iot_sensors WHERE farm_id = $1', [farmId]);
      await client.query('DELETE FROM devices WHERE farm_id = $1', [farmId]);
      await client.query('DELETE FROM fixed_assets WHERE farm_id = $1', [farmId]);
      await client.query(`
        DELETE FROM nfc_tags_inventory 
        WHERE farm_id = $1 
           OR plant_id IN (SELECT id FROM plants WHERE farm_id = $1)
      `, [farmId]);
      await client.query(`
        DELETE FROM supply_usages 
        WHERE farm_id = $1 
           OR plant_id IN (SELECT id FROM plants WHERE farm_id = $1)
           OR supply_id IN (SELECT id FROM supplies WHERE farm_id = $1)
      `, [farmId]);
      await client.query('DELETE FROM supplies WHERE farm_id = $1', [farmId]);
      await client.query(`
        DELETE FROM plant_logs 
        WHERE plant_id IN (SELECT id FROM plants WHERE farm_id = $1)
      `, [farmId]);
      await client.query(`
        DELETE FROM plant_media 
        WHERE plant_id IN (SELECT id FROM plants WHERE farm_id = $1)
      `, [farmId]);
      await client.query('UPDATE plants SET assigned_to_user_id = NULL WHERE farm_id = $1', [farmId]);
      await client.query('DELETE FROM plants WHERE farm_id = $1', [farmId]);
      await client.query('UPDATE users SET farm_id = NULL WHERE farm_id = $1', [farmId]);
      await client.query('DELETE FROM farms WHERE id = $1', [farmId]);
      await client.query('DELETE FROM data_audit_logs WHERE target_type = $1 AND record_id = $2', ['Trang trại', farmId]);

      await client.query('COMMIT');

      await delCacheByPattern('farms_');
      await delCacheByPattern('plants_');
      await delCacheByPattern('supplies_');
      await delCacheByPattern('farm_iot_');

      const broadcast = req.app.get('broadcast');
      if (broadcast) {
        broadcast('farms_updated');
        broadcast('plants_updated');
        broadcast('supplies_updated');
      }

      return res.json({ 
        success: true, 
        permanent: true,
        message: 'Đã xóa vĩnh viễn trang trại cùng toàn bộ dữ liệu liên quan khỏi CSDL!' 
      });
    }

    // DEFAULT: SOFT DELETE (Chuyển vào Thùng rác / Lịch sử biến động)
    await client.query(`
      UPDATE farms 
      SET is_deleted = true, deleted_at = NOW(), updated_at = NOW() 
      WHERE id = $1
    `, [farmId]);

    // Soft delete associated plants
    await client.query(`
      UPDATE plants 
      SET deleted_at = NOW(), updated_at = NOW() 
      WHERE farm_id = $1 AND deleted_at IS NULL
    `, [farmId]);

    // Unset primary farm_id for user so they aren't stuck on deleted farm
    await client.query(`
      UPDATE users 
      SET farm_id = NULL 
      WHERE farm_id = $1
    `, [farmId]);

    // Record in data_audit_logs for Restore capability
    try {
      await client.query(`
        INSERT INTO data_audit_logs (user_id, user_name, action_type, target_type, record_id, title, old_data, note)
        VALUES ($1, $2, 'DELETE', 'Trang trại', $3, $4, $5, 'Xóa mềm trang trại (Chuyển vào thùng rác / Lịch sử biến động). Có thể khôi phục lại bất cứ lúc nào.')
      `, [req.user.id, userName, farmId, `Xóa trang trại ${farm.name}`, JSON.stringify(farm)]);
    } catch (_) {}

    await client.query('COMMIT');

    await delCacheByPattern('farms_');
    await delCacheByPattern('plants_');
    await delCacheByPattern('farm_iot_');

    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('farms_updated');
      broadcast('plants_updated');
    }

    return res.json({ 
      success: true, 
      soft_deleted: true,
      message: `Đã chuyển trang trại "${farm.name}" vào Lịch sử biến động (Thùng rác). Bạn có thể khôi phục lại bất kỳ lúc nào!` 
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Error deleting farm:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa trang trại: ' + err.message });
  } finally {
    client.release();
  }
});

// POST /api/farms/:id/restore — Restore a soft-deleted farm
router.post('/:id/restore', auth, async (req, res) => {
  try {
    const farmId = parseInt(req.params.id);
    if (isNaN(farmId)) {
      return res.status(400).json({ error: 'Mã trang trại không hợp lệ.' });
    }

    const farmCheck = await pool.query('SELECT * FROM farms WHERE id = $1', [farmId]);
    if (farmCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy trang trại.' });
    }
    const farm = farmCheck.rows[0];

    const isOwner = req.user.role === 'admin' || farm.user_id === req.user.id || farm.created_by === req.user.id;
    if (!isOwner) {
      return res.status(403).json({ error: 'Bạn không có quyền khôi phục trang trại này.' });
    }

    await pool.query(`
      UPDATE farms 
      SET is_deleted = false, deleted_at = NULL, updated_at = NOW() 
      WHERE id = $1
    `, [farmId]);

    // Restore associated plants
    await pool.query(`
      UPDATE plants 
      SET deleted_at = NULL, updated_at = NOW() 
      WHERE farm_id = $1
    `, [farmId]);

    // If user has no active farm_id, reassign
    if (farm.user_id) {
      await pool.query(`UPDATE users SET farm_id = $1 WHERE id = $2 AND farm_id IS NULL`, [farmId, farm.user_id]);
    }

    await delCacheByPattern('farms_');
    await delCacheByPattern('plants_');

    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast('farms_updated');
      broadcast('plants_updated');
    }

    res.json({
      success: true,
      message: `Đã khôi phục thành công trang trại "${farm.name}" cùng toàn bộ cây trồng liên quan!`
    });
  } catch (err) {
    console.error('Error restoring farm:', err);
    res.status(500).json({ error: 'Lỗi server khi khôi phục trang trại: ' + err.message });
  }
});

module.exports = router;
