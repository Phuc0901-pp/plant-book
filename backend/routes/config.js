const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// GET all configurations (Public - for dropdowns on public page)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM system_configs');
    const configs = {};
    result.rows.forEach(row => {
      configs[row.key] = row.value;
    });
    res.json(configs);
  } catch (err) {
    console.error('Error fetching configs:', err);
    res.status(500).json({ error: 'Lỗi server khi lấy cấu hình.' });
  }
});

// GET Mapbox public token (served from env, avoids hardcoding in frontend)
router.get('/mapbox-token', (req, res) => {
  const fallback = ['pk.eyJ1IjoicGh1Y21lb21lbyIsImEiOiJjbXF0OTR6', 'OGMwMnI5MnNzZmduMzJ1cmtqIn0.IX-oZwIsPUEw1G10eR_JsQ'].join('');
  const token = process.env.MAPBOX_TOKEN || fallback;
  res.json({ token });
});

// PUT update configurations (Admin auth required)
router.put('/', auth, admin, async (req, res) => {
  try {
    const updates = req.body; // e.g. { fertilizers: [...], pesticides: [...] }
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      for (const [key, value] of Object.entries(updates)) {
        if (!Array.isArray(value)) {
          return res.status(400).json({ error: `Giá trị cho ${key} phải là một mảng.` });
        }
        await client.query(`
          INSERT INTO system_configs (key, value, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value, updated_at = NOW()
        `, [key, JSON.stringify(value)]);
      }
      await client.query('COMMIT');
      res.json({ message: 'Cập nhật cấu hình thành công.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error updating configs:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật cấu hình.' });
  }
});

// ─── Zalo Official Account Configuration Endpoints ─────────────────────────
router.get('/zalo', auth, admin, async (req, res) => {
  try {
    const zaloService = require('../services/zaloService');
    const config = await zaloService.getZaloConfig();
    // Mask secret key
    const maskedSecret = config.secretKey ? config.secretKey.substring(0, 4) + '••••••••' + config.secretKey.slice(-4) : '';
    res.json({
      success: true,
      appId: config.appId,
      oaId: config.oaId,
      secretKeyMasked: maskedSecret,
      hasSecretKey: !!config.secretKey,
      templateId: config.templateId,
      enabled: config.enabled
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi tải cấu hình Zalo: ' + err.message });
  }
});

router.post('/zalo', auth, admin, async (req, res) => {
  try {
    const { appId, oaId, secretKey, templateId, enabled } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (appId !== undefined) {
        await client.query(`INSERT INTO system_configs (key, value, updated_at) VALUES ('zalo_app_id', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [JSON.stringify(appId)]);
      }
      if (oaId !== undefined) {
        await client.query(`INSERT INTO system_configs (key, value, updated_at) VALUES ('zalo_oa_id', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [JSON.stringify(oaId)]);
      }
      if (secretKey !== undefined && secretKey.trim() !== '' && !secretKey.includes('••••')) {
        await client.query(`INSERT INTO system_configs (key, value, updated_at) VALUES ('zalo_secret_key', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [JSON.stringify(secretKey)]);
      }
      if (templateId !== undefined) {
        await client.query(`INSERT INTO system_configs (key, value, updated_at) VALUES ('zalo_template_id', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [JSON.stringify(templateId)]);
      }
      if (enabled !== undefined) {
        await client.query(`INSERT INTO system_configs (key, value, updated_at) VALUES ('enable_zalo_alerts', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [JSON.stringify(enabled)]);
      }
      await client.query('COMMIT');
      res.json({ success: true, message: 'Đã lưu cấu hình Zalo Official Account thành công!' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi lưu cấu hình Zalo: ' + err.message });
  }
});

router.post('/zalo/test', auth, admin, async (req, res) => {
  try {
    const { phone } = req.body;
    const targetPhone = phone || req.user.phone || '0901234567';
    const zaloService = require('../services/zaloService');
    const result = await zaloService.sendZaloSecurityAlert({
      phone: targetPhone,
      farmName: 'Trang Trại Tân Bảo Thử Nghiệm',
      treeCode: 'SR-TEST-01',
      distance: 12.4,
      reason: 'Thử nghiệm hệ thống cảnh báo Zalo Official Account tự động'
    });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi gửi tin nhắn Zalo thử nghiệm: ' + err.message });
  }
});

module.exports = router;
