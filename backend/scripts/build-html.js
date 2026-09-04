const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '../../frontend');
const CONFIG_PATH = path.join(__dirname, '../../config/app.config.json');

/**
 * Loads master SSOT application configuration from config/app.config.json
 */
function loadAppConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (err) {
    console.warn('[build-html] Could not read app.config.json, using defaults', err.message);
  }
  return {
    app: { name: 'Sổ Nông Tân Bảo Agtech', version: '1.2.0', versionTag: 'v1.2.0' },
    brand: {
      copyright: 'Sổ Nông Tân Bảo · Bản quyền © 2026 TBSG Agtech',
      company: 'TBSG Agtech',
      userPortalTitle: 'Sổ Nông Tân Bảo Agtech v1.2.0 — Cổng nông hộ',
      adminPortalTitle: 'Sổ Nông Tân Bảo Agtech v1.2.0 — Quản trị'
    },
    cache: { swCacheName: 'pb-farmer-cache-v1.2.0' }
  };
}

/**
 * Replaces {{PLACEHOLDERS}} in HTML with values from master app.config.json
 */
function applyPlaceholders(content, config) {
  const cfg = config || loadAppConfig();
  const versionTag = cfg.app?.versionTag || ('v' + (cfg.app?.version || '1.2.0'));
  const appName = cfg.app?.name || 'Sổ Nông Tân Bảo Agtech';
  const copyright = cfg.brand?.copyright || 'Sổ Nông Tân Bảo · Bản quyền © 2026 TBSG Agtech';
  const owner = cfg.brand?.owner || 'TBSG Agtech © 2026';
  const company = cfg.brand?.company || 'TBSG Agtech';
  const userTitle = cfg.brand?.userPortalTitle || `${appName} ${versionTag} — Cổng nông hộ`;
  const adminTitle = cfg.brand?.adminPortalTitle || `${appName} ${versionTag} — Quản trị`;
  const swCache = cfg.cache?.swCacheName || `pb-farmer-cache-${versionTag}`;

  return content
    .replace(/\{\{APP_VERSION\}\}/g, versionTag)
    .replace(/\{\{APP_NAME\}\}/g, appName)
    .replace(/\{\{APP_COPYRIGHT\}\}/g, copyright)
    .replace(/\{\{APP_OWNER\}\}/g, owner)
    .replace(/\{\{COMPANY_NAME\}\}/g, company)
    .replace(/\{\{USER_PORTAL_TITLE\}\}/g, userTitle)
    .replace(/\{\{ADMIN_PORTAL_TITLE\}\}/g, adminTitle)
    .replace(/\{\{SW_CACHE_NAME\}\}/g, swCache);
}

/**
 * Recursively resolves <!-- @include 'relativePath' --> directives in a template file.
 * @param {string} filePath - Absolute path to the template file
 * @param {Set<string>} seen - Set of visited file paths to prevent circular includes
 * @returns {string} - Assembled HTML content
 */
function resolveIncludes(filePath, seen = new Set()) {
  if (seen.has(filePath)) {
    console.warn(`[build-html] Circular include detected: ${filePath}`);
    return `<!-- Circular include: ${filePath} -->`;
  }
  seen.add(filePath);

  if (!fs.existsSync(filePath)) {
    console.error(`[build-html] File not found: ${filePath}`);
    return `<!-- Missing include: ${filePath} -->`;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const baseDir = path.dirname(filePath);

  // Regex to match <!-- @include 'path' --> or <!-- @include "path" -->
  const includeRegex = /<!--\s*@include\s+['"]([^'"]+)['"]\s*-->/g;

  return content.replace(includeRegex, (match, includePath) => {
    const targetPath = path.resolve(baseDir, includePath);
    return resolveIncludes(targetPath, new Set(seen));
  });
}

/**
 * Builds the Admin Portal index.html from src/index.template.html
 */
function buildAdminHtml(config) {
  const templatePath = path.join(FRONTEND_DIR, 'admin/src/index.template.html');
  const outputPath = path.join(FRONTEND_DIR, 'admin/index.html');

  if (!fs.existsSync(templatePath)) {
    console.warn(`[build-html] Admin template not found at ${templatePath}, skipping.`);
    return;
  }

  const startTime = Date.now();
  let assembled = resolveIncludes(templatePath);
  assembled = applyPlaceholders(assembled, config);
  fs.writeFileSync(outputPath, assembled, 'utf8');
  const elapsed = Date.now() - startTime;
  console.log(`[build-html] Built admin/index.html (${assembled.length} bytes, ${assembled.split('\n').length} lines) in ${elapsed}ms`);
}

/**
 * Builds the User Portal index.html from src/index.template.html
 */
function buildUserHtml(config) {
  const templatePath = path.join(FRONTEND_DIR, 'user/src/index.template.html');
  const outputPath = path.join(FRONTEND_DIR, 'user/index.html');

  if (!fs.existsSync(templatePath)) {
    console.warn(`[build-html] User template not found at ${templatePath}, skipping.`);
    return;
  }

  const startTime = Date.now();
  let assembled = resolveIncludes(templatePath);
  assembled = applyPlaceholders(assembled, config);
  fs.writeFileSync(outputPath, assembled, 'utf8');
  const elapsed = Date.now() - startTime;
  console.log(`[build-html] Built user/index.html (${assembled.length} bytes, ${assembled.split('\n').length} lines) in ${elapsed}ms`);
}

function buildAll() {
  console.log('[build-html] Compiling modular HTML components with SSOT config...');
  const config = loadAppConfig();
  buildAdminHtml(config);
  buildUserHtml(config);
  console.log('[build-html] All HTML portals assembled successfully.');
  return { admin: true, user: true };
}

// If executed directly from CLI: node backend/scripts/build-html.js
if (require.main === module) {
  buildAll();
}

module.exports = {
  buildAll,
  buildAdminHtml,
  buildUserHtml,
  resolveIncludes,
  loadAppConfig,
  applyPlaceholders
};
