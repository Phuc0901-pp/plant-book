// Shared helpers, locks, sanitization, and NFC reconciliation for Plant routes
const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');
const { logAuditAction } = require('../history');
const jwt = require('jsonwebtoken');
const nfcSecurity = require('../../services/nfcSecurityService');
const zaloService = require('../../services/zaloService');
const { singleflight } = require('../../services/singleflight');
const { invalidateAndBroadcast } = require('../../services/eventBus');
const { logAudit } = require('../../services/auditLogger');
const { calculateSmartReminders } = require('../../services/agriReminder');

const checkTier = require('../../middleware/checkTier');
const crypto = require('crypto');
const { normalizeGpsPayload } = require('../../utils/geoIsoValidator');

// ISO/IEC 27001 Cryptographic SHA-256 Hash-Chain Sealer for Cultivation Logs (Per-Farm Serialized Lock)
const _farmHashChainLocks = new Map();
async function withFarmHashChainLock(farmKey, fn) {
  const prevPromise = _farmHashChainLocks.get(farmKey) || Promise.resolve();
  let release;
  const nextPromise = new Promise((resolve) => { release = resolve; });
  _farmHashChainLocks.set(farmKey, prevPromise.then(() => nextPromise));
  await prevPromise;
  try {
    return await fn();
  } finally {
    release();
    if (_farmHashChainLocks.get(farmKey) === nextPromise) {
      _farmHashChainLocks.delete(farmKey);
    }
  }
}

async function sealPlantLogHashChain(pool, logRow) {
  if (!logRow || !logRow.id) return logRow;
  try {
    const farmRes = await pool.query(`SELECT farm_id FROM plants WHERE id = $1 LIMIT 1`, [logRow.plant_id]);
    const farmId = (farmRes.rows[0] && farmRes.rows[0].farm_id) ? farmRes.rows[0].farm_id : 'GLOBAL';
    const lockKey = `farm_${farmId}`;

    await withFarmHashChainLock(lockKey, async () => {
      const prevRes = await pool.query(
        `SELECT pl.record_hash
         FROM plant_logs pl
         LEFT JOIN plants p ON p.id = pl.plant_id
         WHERE pl.id < $1
           AND (pl.is_deleted IS NOT TRUE)
           AND pl.record_hash IS NOT NULL
           AND (p.farm_id IS NOT DISTINCT FROM (SELECT farm_id FROM plants WHERE id = $2 LIMIT 1))
         ORDER BY pl.id DESC
         LIMIT 1`,
        [logRow.id, logRow.plant_id]
      );
      const prevHash = (prevRes.rows[0] && prevRes.rows[0].record_hash)
        ? prevRes.rows[0].record_hash
        : 'GENESIS_00000000000000000000000000000000000000000000000000000000';
      const canonicalStr = `${prevHash}|${logRow.id}|${logRow.plant_id}|${logRow.log_type}|${logRow.log_date}|${logRow.batch_code || ''}`;
      const recordHash = crypto.createHash('sha256').update(canonicalStr).digest('hex');
      await pool.query(
        `UPDATE plant_logs SET prev_log_hash = $1, record_hash = $2, is_locked = true WHERE id = $3`,
        [prevHash, recordHash, logRow.id]
      );
      logRow.prev_log_hash = prevHash;
      logRow.record_hash = recordHash;
      logRow.is_locked = true;
    });
  } catch (e) {
    console.warn('ISO27001 Hash-Chain warning:', e.message);
  }
  return logRow;
}

function isUserFinanceRedacted(user) {
  if (!user || user.role === 'admin') return false;
  if (user.allow_view_finance === false) return true;
  if (['care_worker', 'auditor_readonly'].includes(user.sub_role) && user.allow_view_finance !== true) return true;
  return false;
}

function sanitizeLogRowForUser(log, user) {
  if (!log || !isUserFinanceRedacted(user)) return log;
  let d = log.details || {};
  if (typeof d === 'string') {
    try { d = JSON.parse(d); } catch (_) { d = {}; }
  } else {
    d = { ...d };
  }
  delete d.total_revenue;
  delete d.revenue;
  delete d.price_per_tree;
  delete d.avg_price_per_fruit;
  delete d.total_cost;
  delete d.unit_price;
  delete d.package_price;
  d.finance_redacted = true;
  return {
    ...log,
    cost: 0,
    finance_redacted: true,
    details: d
  };
}

// Helper to strictly verify that the user is logged in AND belongs to the same farm or is Admin/Owner
async function verifyPlantAccess(req, plantId) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { 
      ok: false, 
      status: 401, 
      error: 'Vui lòng đăng nhập tài khoản thuộc trang trại này để thực hiện thao tác.' 
    };
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userRes = await pool.query('SELECT id, email, role, full_name, farm_id FROM users WHERE id = $1', [decoded.id]);
    if (userRes.rows.length === 0) {
      return { ok: false, status: 401, error: 'Tài khoản không tồn tại hoặc đã bị khóa.' };
    }
    const user = userRes.rows[0];

    const plantRes = await pool.query(`
      SELECT p.id, p.farm_id, p.created_by, p.assigned_to_user_id, f.user_id as farm_owner_id, f.name as farm_name
      FROM plants p
      LEFT JOIN farms f ON f.id = p.farm_id
      WHERE p.id = $1
    `, [plantId]);

    if (plantRes.rows.length === 0) {
      return { ok: false, status: 404, error: 'Không tìm thấy cây trồng.' };
    }
    const plant = plantRes.rows[0];

    // 1. Admin has universal access
    if (user.role === 'admin') {
      return { ok: true, user, plant };
    }

    // 2. Check if user is in the SAME farm or assigned/owner/creator
    const isSameFarm = user.farm_id && plant.farm_id && (Number(user.farm_id) === Number(plant.farm_id));
    const isAssigned = plant.assigned_to_user_id && (Number(user.id) === Number(plant.assigned_to_user_id));
    const isCreator = plant.created_by && (Number(user.id) === Number(plant.created_by));
    const isOwner = plant.farm_owner_id && (Number(user.id) === Number(plant.farm_owner_id));

    if (isSameFarm || isAssigned || isCreator || isOwner) {
      return { ok: true, user, plant };
    }

    return {
      ok: false,
      status: 403,
      error: `Tài khoản "${user.full_name || user.email}" không thuộc trang trại "${plant.farm_name || 'này'}". Bạn chỉ có quyền xem thông tin mở (chỉ đọc), không có quyền điều chỉnh hoặc ghi nhật ký.`
    };
  } catch (err) {
    return { ok: false, status: 401, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.' };
  }
}

// Helper function chuẩn hóa liều lượng nhật ký về đơn vị cơ sở của vật tư (VD: gram -> kg, ml -> lít, lít -> m3)
function convertLogAmountToBaseSupplyQty(rawAmount, rawUnit, supplyUnit, logType) {
  const amt = parseFloat(rawAmount) || 0;
  if (amt <= 0) return 0;

  const rUnit = (rawUnit || '').toLowerCase().trim();
  const sUnit = (supplyUnit || 'kg').toLowerCase().trim();

  // 1. Base supply unit là kg / kilogram
  if (sUnit === 'kg' || sUnit === 'kilogram' || sUnit === 'ký' || sUnit === 'ky') {
    if (rUnit === 'gam' || rUnit === 'g' || rUnit === 'gram' || rUnit === 'gr') {
      return amt / 1000;
    }
    if (rUnit === 'mg' || rUnit === 'miligam') {
      return amt / 1000000;
    }
    if (rUnit === 'tạ' || rUnit === 'ta') {
      return amt * 100;
    }
    if (rUnit === 'tấn' || rUnit === 'tan') {
      return amt * 1000;
    }
    return amt;
  }

  // 2. Base supply unit là lít / lit / l
  if (sUnit === 'lít' || sUnit === 'lit' || sUnit === 'l') {
    if (rUnit === 'ml' || rUnit === 'cc' || rUnit === 'mililit') {
      return amt / 1000;
    }
    if (rUnit === 'm3' || rUnit === 'm³' || rUnit === 'khối') {
      return amt * 1000;
    }
    return amt;
  }

  // 3. Base supply unit là m³ / m3 / khối
  if (sUnit === 'm3' || sUnit === 'm³' || sUnit === 'khối') {
    if (rUnit === 'lít' || rUnit === 'lit' || rUnit === 'l' || logType === 'Tưới nước') {
      return amt / 1000;
    }
    if (rUnit === 'ml' || rUnit === 'cc') {
      return amt / 1000000;
    }
    return amt;
  }

  // 4. Base supply unit là gam / g
  if (sUnit === 'gam' || sUnit === 'g' || sUnit === 'gram') {
    if (rUnit === 'kg' || rUnit === 'kilogram' || rUnit === 'ký') {
      return amt * 1000;
    }
    return amt;
  }

  // 5. Base supply unit là ml
  if (sUnit === 'ml') {
    if (rUnit === 'lít' || rUnit === 'lit' || rUnit === 'l') {
      return amt * 1000;
    }
    return amt;
  }

  return amt;
}

const multer = require('multer');
const storageService = require('../../services/storageService');
const { uploadFile, deleteFile } = {
  uploadFile: (name, buf, mime) => storageService.uploadFile(name, buf, mime),
  deleteFile: (name) => storageService.deleteFile(name)
};
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận ảnh và video.'));
  }
});

function generateSlug(plantType) {
  const base = (plantType || 'plant').toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 30);
  return `${base}-${uuidv4().slice(0, 8)}`;
}

function generatePublicPlantUrl(farmId, plantId, nfcUid, host, proto) {
  const fId = farmId || 0;
  const pId = plantId || 0;
  const baseUrl = host ? `${proto || 'https'}://${host}` : (process.env.BASE_URL || 'https://plant-book.onrender.com');
  if (nfcUid && String(nfcUid).trim()) {
    return `${baseUrl}/${fId}/${pId}/${encodeURIComponent(String(nfcUid).trim())}`;
  }
  return `${baseUrl}/${fId}/${pId}`;
}

// ─── Admin routes (require auth) ─────────────────────────────────

function formatStandardNfcUid(rawUid) {
  if (!rawUid || typeof rawUid !== 'string') return null;
  let clean = decodeURIComponent(rawUid).trim().toUpperCase();
  if (!clean) return null;
  const pureHex = clean.replace(/[^0-9A-F]/g, '');
  if (/^[0-9A-F]+$/.test(clean) && (clean.length === 8 || clean.length === 14 || clean.length === 20)) {
    return clean.match(/.{1,2}/g).join(':');
  }
  if (/^[0-9A-F]{2}([-\s][0-9A-F]{2}){3,9}$/.test(clean)) {
    return clean.replace(/[-\s]+/g, ':');
  }
  if (pureHex.length === 14 && !clean.includes(':')) {
    return pureHex.match(/.{1,2}/g).join(':');
  }
  return clean;
}

async function syncPlantNfcToInventory(dbClient, { nfcUid, farmId, plantId, userId = null, lat = null, lng = null, hmacSig = null }) {
  const cleanUid = formatStandardNfcUid(nfcUid);
  if (!cleanUid) return null;
  const cleanRaw = cleanUid.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const parsedLat = (lat !== undefined && lat !== null && lat !== '' && !isNaN(parseFloat(lat))) ? parseFloat(lat) : null;
  const parsedLng = (lng !== undefined && lng !== null && lng !== '' && !isNaN(parseFloat(lng))) ? parseFloat(lng) : null;

  try {
    const existing = await dbClient.query(
      `SELECT id, nfc_uid FROM nfc_tags_inventory
       WHERE UPPER(TRIM(nfc_uid)) = UPPER($1)
          OR UPPER(regexp_replace(COALESCE(nfc_uid, ''), '[^A-Za-z0-9]', '', 'g')) = $2
       LIMIT 1`,
      [cleanUid, cleanRaw]
    );

    if (existing.rows.length > 0) {
      await dbClient.query(
        `UPDATE nfc_tags_inventory
         SET farm_id = COALESCE($1, farm_id),
             plant_id = $2,
             status = 'assigned',
             hmac_signature = COALESCE($3, hmac_signature),
             last_scanned_lat = COALESCE($4, last_scanned_lat),
             last_scanned_lng = COALESCE($5, last_scanned_lng),
             last_scanned_at = NOW(),
             tagged_at = COALESCE(tagged_at, NOW())
         WHERE id = $6`,
        [farmId || null, plantId || null, hmacSig, parsedLat, parsedLng, existing.rows[0].id]
      );
      return existing.rows[0].id;
    } else {
      const ins = await dbClient.query(
        `INSERT INTO nfc_tags_inventory (nfc_uid, farm_id, plant_id, status, hmac_signature, last_scanned_lat, last_scanned_lng, last_scanned_at, tagged_at, created_by)
         VALUES ($1, $2, $3, 'assigned', $4, $5, $6, NOW(), NOW(), $7)
         ON CONFLICT (nfc_uid) DO UPDATE
         SET farm_id = COALESCE(EXCLUDED.farm_id, nfc_tags_inventory.farm_id),
             plant_id = EXCLUDED.plant_id,
             status = 'assigned',
             hmac_signature = COALESCE(EXCLUDED.hmac_signature, nfc_tags_inventory.hmac_signature),
             last_scanned_lat = COALESCE(EXCLUDED.last_scanned_lat, nfc_tags_inventory.last_scanned_lat),
             last_scanned_lng = COALESCE(EXCLUDED.last_scanned_lng, nfc_tags_inventory.last_scanned_lng),
             last_scanned_at = NOW(),
             tagged_at = COALESCE(nfc_tags_inventory.tagged_at, NOW())
         RETURNING id`,
        [cleanUid, farmId || null, plantId || null, hmacSig, parsedLat, parsedLng, userId || null]
      );
      return ins.rows[0]?.id || null;
    }
  } catch (err) {
    console.warn('syncPlantNfcToInventory warning:', err.message);
    return null;
  }
}

let _nfcColumnsEnsured = false;
async function ensureNfcInventoryColumns(dbClient) {
  if (_nfcColumnsEnsured) return;
  try {
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS nfc_tags_inventory (
        id SERIAL PRIMARY KEY,
        farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
        nfc_uid VARCHAR(100) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'unassigned',
        plant_id INTEGER REFERENCES plants(id) ON DELETE SET NULL,
        last_counter INT DEFAULT 0,
        hmac_signature VARCHAR(128) NULL,
        signature VARCHAR(128) NULL,
        lock_password_hash VARCHAR(128) NULL,
        last_scanned_lat NUMERIC NULL,
        last_scanned_lng NUMERIC NULL,
        last_scanned_at TIMESTAMPTZ NULL,
        scanned_at TIMESTAMPTZ DEFAULT NOW(),
        assigned_at TIMESTAMPTZ DEFAULT NOW(),
        tagged_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by INTEGER REFERENCES users(id)
      );
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE;
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'unassigned';
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS plant_id INTEGER REFERENCES plants(id) ON DELETE SET NULL;
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS tagged_at TIMESTAMPTZ NULL;
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS signature VARCHAR(128) NULL;
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS last_scanned_lat NUMERIC NULL;
      ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS last_scanned_lng NUMERIC NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_nfc_tags_inventory_uid_uniq ON nfc_tags_inventory(nfc_uid);
    `);
    _nfcColumnsEnsured = true;
  } catch (err) {
    console.warn('ensureNfcInventoryColumns notice:', err.message);
  }
}

async function reconcileFarmNfcInventory(dbClient, farmId) {
  if (!farmId || isNaN(parseInt(farmId, 10))) return;
  const fId = parseInt(farmId, 10);
  try {
    await ensureNfcInventoryColumns(dbClient);
    // 1. Đồng bộ các thẻ đã có trong kho nhưng lệch plant_id / farm_id / status so với bảng plants
    await dbClient.query(
      `UPDATE nfc_tags_inventory n
       SET farm_id = p.farm_id,
           plant_id = p.id,
           status = 'assigned',
           tagged_at = COALESCE(n.tagged_at, p.updated_at, NOW()),
           last_scanned_lat = COALESCE(p.latitude, n.last_scanned_lat),
           last_scanned_lng = COALESCE(p.longitude, n.last_scanned_lng)
       FROM plants p
       WHERE p.farm_id = $1
         AND p.deleted_at IS NULL
         AND p.nfc_uid IS NOT NULL
         AND TRIM(p.nfc_uid) != ''
         AND (
           UPPER(TRIM(n.nfc_uid)) = UPPER(TRIM(p.nfc_uid))
           OR UPPER(regexp_replace(COALESCE(n.nfc_uid, ''), '[^A-Za-z0-9]', '', 'g')) = UPPER(regexp_replace(p.nfc_uid, '[^A-Za-z0-9]', '', 'g'))
         )
         AND (n.plant_id IS DISTINCT FROM p.id OR n.farm_id IS DISTINCT FROM p.farm_id OR n.status != 'assigned')`,
      [fId]
    );

    // 2. Tự động nạp bổ sung các thẻ đã gắn vào cây trong bảng plants nhưng chưa có trong nfc_tags_inventory
    await dbClient.query(
      `INSERT INTO nfc_tags_inventory (nfc_uid, farm_id, plant_id, status, tagged_at, last_scanned_lat, last_scanned_lng, created_by)
       SELECT DISTINCT ON (UPPER(TRIM(p.nfc_uid)))
         UPPER(TRIM(p.nfc_uid)),
         p.farm_id,
         p.id,
         'assigned',
         COALESCE(p.updated_at, NOW()),
         p.latitude,
         p.longitude,
         p.created_by
       FROM plants p
       WHERE p.farm_id = $1
         AND p.deleted_at IS NULL
         AND p.nfc_uid IS NOT NULL
         AND TRIM(p.nfc_uid) != ''
         AND NOT EXISTS (
           SELECT 1 FROM nfc_tags_inventory n
           WHERE UPPER(TRIM(n.nfc_uid)) = UPPER(TRIM(p.nfc_uid))
              OR UPPER(regexp_replace(COALESCE(n.nfc_uid, ''), '[^A-Za-z0-9]', '', 'g')) = UPPER(regexp_replace(p.nfc_uid, '[^A-Za-z0-9]', '', 'g'))
         )
       ORDER BY UPPER(TRIM(p.nfc_uid)), p.id DESC
       ON CONFLICT (nfc_uid) DO UPDATE
       SET farm_id = EXCLUDED.farm_id,
           plant_id = EXCLUDED.plant_id,
           status = 'assigned',
           tagged_at = COALESCE(nfc_tags_inventory.tagged_at, EXCLUDED.tagged_at),
           last_scanned_lat = COALESCE(EXCLUDED.last_scanned_lat, nfc_tags_inventory.last_scanned_lat),
           last_scanned_lng = COALESCE(EXCLUDED.last_scanned_lng, nfc_tags_inventory.last_scanned_lng)`,
      [fId]
    );

    // 3. Giải phóng các thẻ đang mang trạng thái 'assigned' nhưng cây đã bị xóa hoặc đã gỡ thẻ
    await dbClient.query(
      `UPDATE nfc_tags_inventory n
       SET status = 'unassigned',
           plant_id = NULL,
           tagged_at = NULL
       WHERE n.farm_id = $1
         AND n.status = 'assigned'
         AND NOT EXISTS (
           SELECT 1 FROM plants p
           WHERE p.deleted_at IS NULL
             AND p.nfc_uid IS NOT NULL
             AND TRIM(p.nfc_uid) != ''
             AND (
               p.id = n.plant_id
               OR UPPER(regexp_replace(p.nfc_uid, '[^A-Za-z0-9]', '', 'g')) = UPPER(regexp_replace(COALESCE(n.nfc_uid, ''), '[^A-Za-z0-9]', '', 'g'))
             )
         )`,
      [fId]
    );
  } catch (err) {
    console.warn('reconcileFarmNfcInventory warning:', err.message);
  }
}


function buildLogFilterQuery(req, bodyOrQuery) {
  let baseQuery = `
    FROM plant_logs pl
    LEFT JOIN plants p ON pl.plant_id = p.id
    LEFT JOIN farms f ON f.id = p.farm_id
    LEFT JOIN users u ON pl.created_by = u.id
    WHERE (pl.is_deleted IS NOT TRUE)
  `;
  const params = [];
  let idx = 1;

  // Authorization check for non-admin
  if (req.user && req.user.role !== 'admin') {
    baseQuery += ` AND (pl.created_by = $${idx} OR f.user_id = $${idx} OR f.id = (SELECT farm_id FROM users WHERE id = $${idx}) OR p.assigned_to_user_id = $${idx}) `;
    params.push(req.user.id);
    idx++;
  }

  // 1. Array of specific IDs (log_ids)
  if (Array.isArray(bodyOrQuery.log_ids) && bodyOrQuery.log_ids.length > 0) {
    const ids = bodyOrQuery.log_ids.map(Number).filter(n => !isNaN(n) && n > 0);
    if (ids.length > 0) {
      baseQuery += ` AND pl.id = ANY($${idx}::int[]) `;
      params.push(ids);
      idx++;
    }
  }

  // 2. Farm filter
  if (bodyOrQuery.farm_id && bodyOrQuery.farm_id !== 'all') {
    baseQuery += ` AND (p.farm_id = $${idx} OR (pl.plant_id IS NULL AND f.id = $${idx})) `;
    params.push(Number(bodyOrQuery.farm_id));
    idx++;
  }

  // 3. Plant filter
  if (bodyOrQuery.plant_id && bodyOrQuery.plant_id !== 'all') {
    if (!isNaN(Number(bodyOrQuery.plant_id))) {
      baseQuery += ` AND (pl.plant_id = $${idx} OR p.tree_code = $${idx}::text) `;
      params.push(Number(bodyOrQuery.plant_id));
      idx++;
    } else {
      baseQuery += ` AND p.tree_code = $${idx} `;
      params.push(String(bodyOrQuery.plant_id).trim());
      idx++;
    }
  }

  // 4. Log Type filter
  if (bodyOrQuery.log_type && bodyOrQuery.log_type !== 'all') {
    baseQuery += ` AND pl.log_type = $${idx} `;
    params.push(String(bodyOrQuery.log_type).trim());
    idx++;
  }

  // 5. Date filter
  if (bodyOrQuery.date_mode === 'single' && bodyOrQuery.date) {
    baseQuery += ` AND pl.log_date = $${idx}::date `;
    params.push(bodyOrQuery.date);
    idx++;
  } else if (bodyOrQuery.date_mode === 'range') {
    if (bodyOrQuery.from_date) {
      baseQuery += ` AND pl.log_date >= $${idx}::date `;
      params.push(bodyOrQuery.from_date);
      idx++;
    }
    if (bodyOrQuery.to_date) {
      baseQuery += ` AND pl.log_date <= $${idx}::date `;
      params.push(bodyOrQuery.to_date);
      idx++;
    }
  } else if (bodyOrQuery.date) {
    baseQuery += ` AND pl.log_date = $${idx}::date `;
    params.push(bodyOrQuery.date);
    idx++;
  }

  // 6. Keyword search
  if (bodyOrQuery.keyword && String(bodyOrQuery.keyword).trim()) {
    baseQuery += ` AND (
      p.tree_code ILIKE $${idx} 
      OR pl.note ILIKE $${idx} 
      OR pl.log_type ILIKE $${idx}
      OR f.name ILIKE $${idx}
      OR CAST(pl.details AS TEXT) ILIKE $${idx}
    ) `;
    params.push(`%${String(bodyOrQuery.keyword).trim()}%`);
    idx++;
  }

  return { baseQuery, params };
}

// POST /api/plants/logs/batch-delete/preview — Đếm trước số lượng bản ghi thỏa mãn điều kiện lọc

function isFullNfcUid(uid) {
  if (!uid || typeof uid !== 'string') return false;
  const clean = decodeURIComponent(uid).trim();
  if (/^([0-9A-Fa-f]{2}[:-]){3,9}[0-9A-Fa-f]{2}$/.test(clean)) return true;
  if (/^[0-9A-Fa-f]{8,20}$/.test(clean) && !isNaN(Number('0x' + clean))) return true;
  return false;
}

// Update plant health status (Requires login from the same farm or Admin)

const queueService = require('../../services/queueService');

module.exports = {
  pool, auth, admin, logAuditAction, jwt, nfcSecurity, zaloService,
  singleflight, invalidateAndBroadcast, logAudit, calculateSmartReminders,
  checkTier, crypto, normalizeGpsPayload, multer, storageService,
  uploadFile, deleteFile, uuidv4, path, upload, queueService,
  withFarmHashChainLock, sealPlantLogHashChain, isUserFinanceRedacted,
  sanitizeLogRowForUser, verifyPlantAccess, convertLogAmountToBaseSupplyQty,
  generateSlug, generatePublicPlantUrl, formatStandardNfcUid,
  syncPlantNfcToInventory, ensureNfcInventoryColumns, reconcileFarmNfcInventory,
  buildLogFilterQuery, isFullNfcUid
};
