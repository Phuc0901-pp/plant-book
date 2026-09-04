/**
 * ===============================================================
 * Plant Book - Central Application Configuration Module
 * Single Source of Truth (SSOT) loaded from config/app.config.json
 * ===============================================================
 */

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../../config/app.config.json');

function loadRawConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('[appConfig] Could not load app.config.json, using fallback', err.message);
  }
  return {
    app: {
      name: 'Sổ Nông Tân Bảo Agtech',
      shortName: 'Sổ Nông Số',
      version: '1.2.0',
      versionTag: 'v1.2.0',
      buildNumber: 4,
      releaseDate: '2026-09-04',
      environment: process.env.NODE_ENV || 'production'
    },
    brand: {
      company: 'TBSG Agtech',
      companyFullName: 'CÔNG TY CỔ PHẦN TÂN BẢO SÀI GÒN',
      tagline: 'Hệ thống Sổ Nông Số & Trợ Lý AI Canh Tác',
      owner: 'TBSG Agtech © 2026',
      copyright: 'Sổ Nông Tân Bảo · Bản quyền © 2026 TBSG Agtech',
      loginFooter: 'Bảo mật SSL/TLS · Phát triển & Sở hữu bởi TBSG Agtech © 2026'
    },
    api: {
      productionBaseUrl: 'https://plant-book.onrender.com/api',
      productionWsUrl: 'wss://plant-book.onrender.com'
    },
    cache: {
      swCacheName: 'pb-farmer-cache-v1.2.0',
      assetVersion: '1.2.0'
    },
    defaults: {
      farmLatitude: 10.941520,
      farmLongitude: 107.241850,
      pageSize: 10,
      logPageSize: 5,
      healthStatus: 'Tốt'
    }
  };
}

const APP_CONFIG = loadRawConfig();

function getAppConfig() {
  return APP_CONFIG;
}

function getAppVersion() {
  return APP_CONFIG.app.versionTag || 'v' + APP_CONFIG.app.version;
}

function getAppName() {
  return APP_CONFIG.app.name;
}

function getBrandInfo() {
  return APP_CONFIG.brand;
}

function getCacheConfig() {
  return APP_CONFIG.cache;
}

function getDefaults() {
  return APP_CONFIG.defaults;
}

module.exports = {
  APP_CONFIG,
  getAppConfig,
  getAppVersion,
  getAppName,
  getBrandInfo,
  getCacheConfig,
  getDefaults
};
