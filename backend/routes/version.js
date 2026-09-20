const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const fs = require('fs');
const path = require('path');

// In-memory cache for latest version info
let cachedVersion = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30000; // 30 seconds

const CONFIG_PATH = path.join(__dirname, '../../config/app.config.json');

/**
 * Helper to get fallback configuration from app.config.json
 */
function getFallbackConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('[version] Could not read app.config.json:', err.message);
  }
  return {
    app: {
      version: '1.2.8',
      versionTag: 'v1.2.8',
      buildNumber: 12,
      releaseDate: '2026-09-20'
    }
  };
}

/**
 * Helper to fetch active version from DB with caching
 */
async function getActiveVersionFromDB() {
  const now = Date.now();
  if (cachedVersion && (now - lastCacheTime < CACHE_TTL_MS)) {
    return cachedVersion;
  }

  try {
    const res = await pool.query(
      `SELECT * FROM app_versions WHERE is_active = true ORDER BY id DESC LIMIT 1`
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      cachedVersion = {
        id: row.id,
        version: row.version_number,
        versionTag: row.version_tag,
        buildNumber: row.build_number,
        platform: row.platform || 'all',
        minSupportedVersion: row.min_supported_version || '1.0.0',
        apkUrl: row.apk_url || '/PlantBook-Mobile-ERP-v1.2.4-universal.apk',
        releaseNotes: row.release_notes || '',
        forceUpdate: !!row.force_update,
        isActive: row.is_active,
        updatedAt: row.updated_at || row.created_at
      };
      lastCacheTime = now;
      return cachedVersion;
    }
  } catch (err) {
    console.warn('[version] Error querying app_versions table, falling back:', err.message);
  }

  // Fallback to app.config.json
  const fallback = getFallbackConfig();
  cachedVersion = {
    id: 0,
    version: fallback.app.version || '1.2.8',
    versionTag: fallback.app.versionTag || 'v1.2.8',
    buildNumber: fallback.app.buildNumber || 12,
    platform: 'all',
    minSupportedVersion: '1.0.0',
    apkUrl: '/PlantBook-Mobile-ERP-v1.2.4-universal.apk',
    releaseNotes: 'Cập nhật hệ thống tối ưu hóa và quản lý phiên bản tập trung.',
    forceUpdate: false,
    isActive: true,
    updatedAt: new Date()
  };
  lastCacheTime = now;
  return cachedVersion;
}

// ─── GET /api/version (Public - Current active app version) ───────────────────
router.get('/', async (req, res) => {
  try {
    const versionInfo = await getActiveVersionFromDB();
    res.json({
      success: true,
      data: versionInfo,
      ...versionInfo
    });
  } catch (err) {
    console.error('Error fetching version:', err);
    res.status(500).json({ error: 'Lỗi server khi lấy thông tin phiên bản.' });
  }
});

// ─── GET /api/version/check (Public - Check for update from Mobile/Web client) ─
router.get('/check', async (req, res) => {
  try {
    const clientVer = (req.query.version || '').replace(/^v/i, '').trim();
    const platform = req.query.platform || 'all';

    const latest = await getActiveVersionFromDB();
    const latestVer = (latest.version || '').replace(/^v/i, '').trim();

    const isUpdateAvailable = clientVer ? (clientVer !== latestVer) : false;
    
    // Compare versions (semver naive split)
    let needsForceUpdate = false;
    if (latest.forceUpdate && isUpdateAvailable) {
      needsForceUpdate = true;
    } else if (latest.minSupportedVersion && clientVer) {
      const clientParts = clientVer.split('.').map(n => parseInt(n, 10) || 0);
      const minParts = (latest.minSupportedVersion || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
      for (let i = 0; i < 3; i++) {
        const c = clientParts[i] || 0;
        const m = minParts[i] || 0;
        if (c < m) {
          needsForceUpdate = true;
          break;
        } else if (c > m) {
          break;
        }
      }
    }

    res.json({
      success: true,
      currentClientVersion: req.query.version || 'unknown',
      latestVersion: latest.versionTag,
      latestVersionNumber: latest.version,
      buildNumber: latest.buildNumber,
      updateAvailable: isUpdateAvailable,
      forceUpdate: needsForceUpdate,
      apkUrl: latest.apkUrl,
      releaseNotes: latest.releaseNotes,
      updatedAt: latest.updatedAt
    });
  } catch (err) {
    console.error('Error checking version update:', err);
    res.status(500).json({ error: 'Lỗi khi kiểm tra cập nhật.' });
  }
});

// ─── GET /api/version/history (Public/Admin - List all version releases) ──────
router.get('/history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM app_versions ORDER BY id DESC LIMIT 50`
    );
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching version history:', err);
    res.status(500).json({ error: 'Lỗi server khi lấy lịch sử phiên bản.' });
  }
});

// ─── POST /api/version (Admin Auth Required - Push new version to Database) ───
router.post('/', auth, admin, async (req, res) => {
  try {
    let {
      versionTag,
      versionNumber,
      buildNumber,
      platform,
      minSupportedVersion,
      apkUrl,
      releaseNotes,
      forceUpdate,
      activateNow
    } = req.body;

    if (!versionTag && !versionNumber) {
      return res.status(400).json({ error: 'Vui lòng cung cấp versionTag hoặc versionNumber (ví dụ: v1.2.8).' });
    }

    if (!versionTag) {
      versionTag = versionNumber.startsWith('v') ? versionNumber : `v${versionNumber}`;
    }
    if (!versionNumber) {
      versionNumber = versionTag.replace(/^v/i, '');
    }

    buildNumber = parseInt(buildNumber, 10) || 1;
    platform = platform || 'all';
    minSupportedVersion = minSupportedVersion || '1.0.0';
    apkUrl = apkUrl || '/PlantBook-Mobile-ERP-v1.2.4-universal.apk';
    releaseNotes = releaseNotes || '';
    forceUpdate = forceUpdate === true || forceUpdate === 'true';
    activateNow = activateNow !== false && activateNow !== 'false';

    const client = await pool.connect();
    let savedVersion = null;

    try {
      await client.query('BEGIN');

      if (activateNow) {
        // Deactivate all previous versions
        await client.query(`UPDATE app_versions SET is_active = false WHERE is_active = true`);
      }

      // Insert or update version record
      const insertQuery = `
        INSERT INTO app_versions (
          version_tag, version_number, build_number, platform,
          min_supported_version, apk_url, release_notes, force_update,
          is_active, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (version_tag) DO UPDATE SET
          version_number = EXCLUDED.version_number,
          build_number = EXCLUDED.build_number,
          platform = EXCLUDED.platform,
          min_supported_version = EXCLUDED.min_supported_version,
          apk_url = EXCLUDED.apk_url,
          release_notes = EXCLUDED.release_notes,
          force_update = EXCLUDED.force_update,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
        RETURNING *;
      `;

      const dbRes = await client.query(insertQuery, [
        versionTag,
        versionNumber,
        buildNumber,
        platform,
        minSupportedVersion,
        apkUrl,
        releaseNotes,
        forceUpdate,
        activateNow
      ]);

      savedVersion = dbRes.rows[0];

      // Update system_configs SSOT key
      await client.query(`
        INSERT INTO system_configs (key, value, updated_at)
        VALUES ('app_version', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = NOW()
      `, [JSON.stringify(savedVersion)]);

      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

    // Invalidate local cache immediately
    cachedVersion = {
      id: savedVersion.id,
      version: savedVersion.version_number,
      versionTag: savedVersion.version_tag,
      buildNumber: savedVersion.build_number,
      platform: savedVersion.platform,
      minSupportedVersion: savedVersion.min_supported_version,
      apkUrl: savedVersion.apk_url,
      releaseNotes: savedVersion.release_notes,
      forceUpdate: savedVersion.force_update,
      isActive: savedVersion.is_active,
      updatedAt: savedVersion.updated_at
    };
    lastCacheTime = Date.now();

    // Synchronize app.config.json on disk if possible
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        const cfg = JSON.parse(raw);
        cfg.app = cfg.app || {};
        cfg.app.version = versionNumber;
        cfg.app.versionTag = versionTag;
        cfg.app.buildNumber = buildNumber;
        cfg.app.releaseDate = new Date().toISOString().split('T')[0];
        if (cfg.brand) {
          cfg.brand.userPortalTitle = `${cfg.app.name || 'Sổ Nông Tân Bảo Agtech'} ${versionTag} — Cổng nông hộ`;
          cfg.brand.adminPortalTitle = `${cfg.app.name || 'Sổ Nông Tân Bảo Agtech'} ${versionTag} — Quản trị`;
        }
        if (cfg.cache) {
          cfg.cache.swCacheName = `pb-farmer-cache-${versionTag}`;
          cfg.cache.assetVersion = versionNumber;
        }
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');

        // Rebuild modular HTML in background
        const { buildAll } = require('../scripts/build-html');
        buildAll();
      }
    } catch (fsErr) {
      console.warn('[version] Warning syncing app.config.json or building HTML:', fsErr.message);
    }

    // Broadcast version update event to all connected Web & Mobile clients via WebSocket
    if (global.broadcastWS) {
      global.broadcastWS('version_updated', {
        version_tag: savedVersion.version_tag,
        version_number: savedVersion.version_number,
        build_number: savedVersion.build_number,
        release_notes: savedVersion.release_notes,
        force_update: savedVersion.force_update,
        apk_url: savedVersion.apk_url,
        updated_at: savedVersion.updated_at
      });
      console.log(`📡 Broadcasted 'version_updated' event to all active clients: ${savedVersion.version_tag}`);
    }

    res.json({
      success: true,
      message: `Đã cập nhật phiên bản hệ thống lên ${savedVersion.version_tag} trực tiếp vào Cơ sở Dữ liệu thành công!`,
      data: savedVersion
    });

  } catch (err) {
    console.error('Error updating version in DB:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật phiên bản vào CSDL: ' + err.message });
  }
});

// ─── PUT /api/version/:id/activate (Admin - Switch active version) ─────────────
router.put('/:id/activate', auth, admin, async (req, res) => {
  try {
    const versionId = parseInt(req.params.id, 10);
    const client = await pool.connect();
    let activated = null;

    try {
      await client.query('BEGIN');
      await client.query(`UPDATE app_versions SET is_active = false WHERE is_active = true`);
      const r = await client.query(
        `UPDATE app_versions SET is_active = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [versionId]
      );
      if (r.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Không tìm thấy phiên bản với ID này.' });
      }
      activated = r.rows[0];
      await client.query(`
        INSERT INTO system_configs (key, value, updated_at)
        VALUES ('app_version', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [JSON.stringify(activated)]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    cachedVersion = null; // force reload

    if (global.broadcastWS) {
      global.broadcastWS('version_updated', activated);
    }

    res.json({
      success: true,
      message: `Đã kích hoạt phiên bản ${activated.version_tag}`,
      data: activated
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi kích hoạt phiên bản: ' + err.message });
  }
});

module.exports = router;
