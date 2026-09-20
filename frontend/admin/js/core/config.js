/* ═══════════════════════════════════════════════════════════════
   Plant Book – Admin Portal
   core/config.js — Centralized App Configuration (SSOT)
   ═══════════════════════════════════════════════════════════════ */

export const APP_CONFIG = {
  "app": {
    "name": "Sổ Nông Tân Bảo Agtech",
    "shortName": "Sổ Nông Số",
    "version": "1.2.8",
    "versionTag": "v1.2.8",
    "buildNumber": 12,
    "releaseDate": "2026-09-20",
    "environment": "production"
  },
  "brand": {
    "company": "TBSG Agtech",
    "companyFullName": "CÔNG TY CỔ PHẦN TÂN BẢO SÀI GÒN",
    "tagline": "Hệ thống Sổ Nông Số & Trợ Lý AI Canh Tác",
    "owner": "TBSG Agtech © 2026",
    "copyright": "Sổ Nông Tân Bảo · Bản quyền © 2026 TBSG Agtech",
    "loginFooter": "Bảo mật SSL/TLS · Phát triển & Sở hữu bởi TBSG Agtech © 2026",
    "userPortalTitle": "Sổ Nông Tân Bảo Agtech v1.2.8 — Cổng nông hộ",
    "adminPortalTitle": "Sổ Nông Tân Bảo Agtech v1.2.8 — Quản trị",
    "plantProfileTitle": "Hồ sơ cây trồng — Sổ Nông Tân Bảo Agtech"
  },
  "api": {
    "productionBaseUrl": "https://plant-book.onrender.com/api",
    "productionWsUrl": "wss://plant-book.onrender.com",
    "healthEndpoint": "/api/health",
    "configEndpoint": "/api/config",
    "versionEndpoint": "/api/version"
  },
  "cache": {
    "swCacheName": "pb-farmer-cache-v1.2.8",
    "assetVersion": "1.2.8"
  },
  "defaults": {
    "farmLatitude": 10.94152,
    "farmLongitude": 107.24185,
    "pageSize": 10,
    "logPageSize": 5,
    "healthStatus": "Tốt",
    "currency": "VND"
  }
};

export function getAppVersion() {
  return APP_CONFIG.app.versionTag;
}

export function getAppName() {
  return APP_CONFIG.app.name;
}

export function getBrandInfo() {
  return APP_CONFIG.brand;
}

export function getAppConfig() {
  return APP_CONFIG;
}

/**
 * Dynamically synchronizes application version from database via /api/version
 */
export async function syncAppVersionFromDB() {
  try {
    const res = await fetch('/api/version');
    if (!res.ok) return APP_CONFIG.app;
    const data = await res.json();
    if (data.versionTag) {
      APP_CONFIG.app.version = data.version;
      APP_CONFIG.app.versionTag = data.versionTag;
      APP_CONFIG.app.buildNumber = data.buildNumber;
      updateAppVersionInDOM(data.versionTag);
    }
    return APP_CONFIG.app;
  } catch (err) {
    console.warn('[config] Could not sync version from DB:', err.message);
    return APP_CONFIG.app;
  }
}

/**
 * Updates version tags across the DOM dynamically
 */
export function updateAppVersionInDOM(versionTag) {
  if (!versionTag) return;
  document.querySelectorAll('.app-version-badge, .app-version-tag, [data-app-version]').forEach(el => {
    el.textContent = versionTag;
  });
}
