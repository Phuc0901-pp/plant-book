const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '../../frontend');

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
function buildAdminHtml() {
  const templatePath = path.join(FRONTEND_DIR, 'admin/src/index.template.html');
  const outputPath = path.join(FRONTEND_DIR, 'admin/index.html');

  if (!fs.existsSync(templatePath)) {
    console.warn(`[build-html] Admin template not found at ${templatePath}, skipping.`);
    return;
  }

  const startTime = Date.now();
  const assembled = resolveIncludes(templatePath);
  fs.writeFileSync(outputPath, assembled, 'utf8');
  const elapsed = Date.now() - startTime;
  console.log(`[build-html] Built admin/index.html (${assembled.length} bytes, ${assembled.split('\n').length} lines) in ${elapsed}ms`);
}

/**
 * Builds the User Portal index.html from src/index.template.html
 */
function buildUserHtml() {
  const templatePath = path.join(FRONTEND_DIR, 'user/src/index.template.html');
  const outputPath = path.join(FRONTEND_DIR, 'user/index.html');

  if (!fs.existsSync(templatePath)) {
    console.warn(`[build-html] User template not found at ${templatePath}, skipping.`);
    return;
  }

  const startTime = Date.now();
  const assembled = resolveIncludes(templatePath);
  fs.writeFileSync(outputPath, assembled, 'utf8');
  const elapsed = Date.now() - startTime;
  console.log(`[build-html] Built user/index.html (${assembled.length} bytes, ${assembled.split('\n').length} lines) in ${elapsed}ms`);
}

function buildAll() {
  console.log('[build-html] Compiling modular HTML components...');
  buildAdminHtml();
  buildUserHtml();
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
  resolveIncludes
};
