/**
 * ═══════════════════════════════════════════════════════════════
 * Plant Book – Master Configuration Synchronizer & Version Bumper
 * Single Source of Truth: config/app.config.json
 * ═══════════════════════════════════════════════════════════════
 * Usage:
 *   node scripts/sync-config.js          (Sync all files from app.config.json)
 *   node scripts/sync-config.js 1.3.0    (Bump version to 1.3.0 and sync all files)
 */

const fs = require('fs');
const path = require('path');
const { buildAll } = require('../backend/scripts/build-html');

const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(ROOT_DIR, 'config/app.config.json');

if (!fs.existsSync(CONFIG_FILE)) {
  console.error('[sync-config] Error: config/app.config.json not found!');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

// Handle optional version bump argument: node scripts/sync-config.js 1.3.0
const newVersionArg = process.argv[2];
if (newVersionArg && /^\d+\.\d+\.\d+$/.test(newVersionArg.replace(/^v/, ''))) {
  const cleanVer = newVersionArg.replace(/^v/, '');
  config.app.version = cleanVer;
  config.app.versionTag = 'v' + cleanVer;
  config.app.buildNumber = (config.app.buildNumber || 1) + 1;
  config.app.releaseDate = new Date().toISOString().split('T')[0];
  config.cache.swCacheName = 'pb-farmer-cache-v' + cleanVer;
  config.cache.assetVersion = cleanVer;
  config.brand.userPortalTitle = config.app.name + ' v' + cleanVer + ' — Cổng nông hộ';
  config.brand.adminPortalTitle = config.app.name + ' v' + cleanVer + ' — Quản trị';
  
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  console.log(`[sync-config] 🚀 Bumped version to v${cleanVer} (Build ${config.app.buildNumber})`);
}

const version = config.app.version;
const versionTag = config.app.versionTag || ('v' + version);
const buildNumber = config.app.buildNumber || 1;
const swCache = config.cache.swCacheName || ('pb-farmer-cache-' + versionTag);

console.log(`[sync-config] Synchronizing configuration for ${config.app.name} (${versionTag})...`);

// 1. Sync backend/package.json
const pkgPath = path.join(ROOT_DIR, 'backend/package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`  ✔ backend/package.json -> ${version}`);
}

// 2. Sync mobile_app/pubspec.yaml
const pubspecPath = path.join(ROOT_DIR, 'mobile_app/pubspec.yaml');
if (fs.existsSync(pubspecPath)) {
  let pubspec = fs.readFileSync(pubspecPath, 'utf8');
  pubspec = pubspec.replace(/^version:\s*.*$/m, `version: ${version}+${buildNumber}`);
  fs.writeFileSync(pubspecPath, pubspec, 'utf8');
  console.log(`  ✔ mobile_app/pubspec.yaml -> ${version}+${buildNumber}`);
}

// 3. Sync mobile_app/lib/core/constants/app_constants.dart
const appConstantsPath = path.join(ROOT_DIR, 'mobile_app/lib/core/constants/app_constants.dart');
if (fs.existsSync(appConstantsPath)) {
  let appConstants = fs.readFileSync(appConstantsPath, 'utf8');
  appConstants = appConstants.replace(/static const String appVersion = '[^']+';/, `static const String appVersion = '${versionTag}';`);
  fs.writeFileSync(appConstantsPath, appConstants, 'utf8');
  console.log(`  ✔ mobile_app/.../app_constants.dart -> ${versionTag}`);
}

// 4. Sync frontend/user/sw.js
const swPath = path.join(ROOT_DIR, 'frontend/user/sw.js');
if (fs.existsSync(swPath)) {
  let sw = fs.readFileSync(swPath, 'utf8');
  sw = sw.replace(/const CACHE_NAME = '[^']+';/, `const CACHE_NAME = '${swCache}';`);
  sw = sw.replace(/\?v=[0-9.]+/g, `?v=${version}`);
  fs.writeFileSync(swPath, sw, 'utf8');
  console.log(`  ✔ frontend/user/sw.js -> ${swCache}`);
}

// 5. Sync frontend/user/js/core/config.js and admin config.js
const userConfigJs = path.join(ROOT_DIR, 'frontend/user/js/core/config.js');
const adminConfigJs = path.join(ROOT_DIR, 'frontend/admin/js/core/config.js');

const userConfigCode = `/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   core/config.js — Centralized App Configuration (SSOT)
   ═══════════════════════════════════════════════════════════════ */

export const APP_CONFIG = ${JSON.stringify(config, null, 2)};

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
`;

fs.writeFileSync(userConfigJs, userConfigCode, 'utf8');
fs.writeFileSync(adminConfigJs, userConfigCode, 'utf8');
console.log(`  ✔ frontend core config.js files synced`);

// 6. Rebuild HTML templates
console.log('[sync-config] Compiling HTML templates...');
buildAll();
console.log(`[sync-config] 🎉 All project configurations synchronized successfully with SSOT!`);
