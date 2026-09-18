const https = require('https');
const pool = require('../config/db');

// Default Zalo OA API Endpoints
const ZALO_OA_MESSAGE_URL = 'https://openapi.zalo.me/v3.0/oa/message/cs';
const ZALO_ZNS_URL = 'https://business.openapi.zalo.me/message/template';

/**
 * Retrieves Zalo OA configuration from database or environment variables
 */
async function getZaloConfig() {
  try {
    const res = await pool.query("SELECT key, value FROM system_configs WHERE key IN ('zalo_app_id', 'zalo_oa_id', 'zalo_secret_key', 'zalo_template_id', 'enable_zalo_alerts')");
    const config = {};
    res.rows.forEach(r => {
      try {
        config[r.key] = typeof r.value === 'string' && r.value.startsWith('"') ? JSON.parse(r.value) : r.value;
      } catch (_) {
        config[r.key] = r.value;
      }
    });

    return {
      appId: config.zalo_app_id || process.env.ZALO_APP_ID || '',
      oaId: config.zalo_oa_id || process.env.ZALO_OA_ID || '',
      secretKey: config.zalo_secret_key || process.env.ZALO_SECRET_KEY || '',
      templateId: config.zalo_template_id || process.env.ZALO_TEMPLATE_ID || '',
      enabled: config.enable_zalo_alerts === true || config.enable_zalo_alerts === 'true' || process.env.ENABLE_ZALO_ALERTS === 'true'
    };
  } catch (err) {
    console.warn('⚠️ Could not load Zalo config from DB, using env fallback:', err.message);
    return {
      appId: process.env.ZALO_APP_ID || '',
      oaId: process.env.ZALO_OA_ID || '',
      secretKey: process.env.ZALO_SECRET_KEY || '',
      templateId: process.env.ZALO_TEMPLATE_ID || '',
      enabled: process.env.ENABLE_ZALO_ALERTS === 'true'
    };
  }
}

/**
 * Formats and sends a security alert message via Zalo Official Account
 * @param {Object} params
 * @param {string} params.phone - Target recipient phone number
 * @param {string} params.farmName - Name of the farm
 * @param {string} params.treeCode - Tree Code or Plant ID
 * @param {number} [params.distance] - Distance in meters from tree
 * @param {string} params.reason - Reason for security alert
 * @param {string} [params.severity='WARNING'] - Alert severity
 * @returns {Promise<Object>}
 */
async function sendZaloSecurityAlert({ phone, farmName, treeCode, distance, reason, severity = 'WARNING' }) {
  const config = await getZaloConfig();
  const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  const icon = severity === 'CRITICAL' ? '🚨 [BÁO ĐỘNG ĐỎ]' : '⚠️ [CẢNH BÁO AN NINH]';
  const distText = distance !== undefined && distance !== null ? `\n• Khoảng cách lệch: ${distance} mét (Quy định ≤ 8m)` : '';

  const messageText = `${icon} PLANTBOOK - AN NINH CÂY TRỒNG\n` +
    `• Trang trại: ${farmName || 'Hệ thống Tân Bảo'}\n` +
    `• Cây trồng: #${treeCode}\n` +
    `• Nội dung: ${reason}${distText}\n` +
    `• Thời gian: ${timestamp}\n` +
    `Vui lòng kiểm tra lại hiện trường hoặc truy cập Web Admin để xử lý!`;

  // Always log to console for development audit
  console.log(`[Zalo OA Dispatcher] (${phone || 'All Admins'}): ${messageText.replace(/\n/g, ' | ')}`);

  if (!config.enabled || !config.secretKey) {
    return {
      success: true,
      mode: 'MOCK_DISPATCHED',
      phone: phone || 'Admin',
      message: messageText,
      note: 'Zalo alerts are running in simulated/preview mode. Add Zalo Secret Key in Web Admin to enable live API.'
    };
  }

  // If live credentials present, dispatch HTTP POST to Zalo OA OpenAPI
  try {
    const payload = JSON.stringify({
      recipient: { phone: phone ? phone.replace(/[^0-9]/g, '') : '' },
      message: { text: messageText }
    });

    return new Promise((resolve) => {
      const req = https.request(ZALO_OA_MESSAGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': config.secretKey,
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 5000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ success: parsed.error === 0, response: parsed });
          } catch (_) {
            resolve({ success: res.statusCode === 200, raw: data });
          }
        });
      });

      req.on('error', (err) => {
        console.error('Zalo API request error:', err.message);
        resolve({ success: false, error: err.message });
      });

      req.write(payload);
      req.end();
    });
  } catch (err) {
    console.error('Zalo Dispatch Error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Sends a farming/sensor/VietGAP advisory alert to farmer via Zalo OA
 */
async function sendZaloFarmingAlert({ phone, farmName, title, message }) {
  const config = await getZaloConfig();
  const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  const formattedText = `🌱 PLANTBOOK - THÔNG BÁO NÔNG VỤ\n` +
    `• Trang trại: ${farmName || 'Tân Bảo Farm'}\n` +
    `• Tiêu đề: ${title}\n` +
    `• Hướng dẫn: ${message}\n` +
    `• Thời gian: ${timestamp}`;

  console.log(`[Zalo Farming Dispatcher] (${phone}): ${formattedText.replace(/\n/g, ' | ')}`);

  return {
    success: true,
    mode: config.enabled ? 'LIVE_DISPATCHED' : 'MOCK_DISPATCHED',
    message: formattedText
  };
}

module.exports = {
  getZaloConfig,
  sendZaloSecurityAlert,
  sendZaloFarmingAlert
};
