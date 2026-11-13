const fs = require('fs');
const path = require('path');
const { describe, it, expect } = require('../test-framework');

describe('Suite 23: Modular Architecture Governance & Schema Migration Parity', () => {
  const rootDir = path.join(__dirname, '../../..');

  function countLoc(relPath) {
    const full = path.join(rootDir, relPath);
    if (!fs.existsSync(full)) return -1;
    return fs.readFileSync(full, 'utf8').split(/\r?\n/).length;
  }

  it('23.1 [BE-MODULAR] Backend plants router is modularized into <= 2.500 LOC domain files', () => {
    const modules = [
      'backend/routes/plants.js',
      'backend/routes/plants/helpers.js',
      'backend/routes/plants/core.routes.js',
      'backend/routes/plants/nfc.routes.js',
      'backend/routes/plants/media-logs.routes.js',
      'backend/routes/plants/public.routes.js'
    ];
    for (const m of modules) {
      const loc = countLoc(m);
      expect(loc).toBeGreaterThan(0);
      expect(loc).toBeLessThan(2501);
    }
    const routerObj = require('../../routes/plants');
    expect(typeof routerObj).toBe('function');
  });

  it('23.2 [FE-MODULAR] All Frontend JS business modules are <= 3.500 LOC (Zero Monolith Risk)', () => {
    const jsDirs = [
      'frontend/admin/js',
      'frontend/public/js',
      'frontend/user/js',
      'frontend/user/js/modules',
      'frontend/assets/js'
    ];
    for (const d of jsDirs) {
      const fullDir = path.join(rootDir, d);
      if (!fs.existsSync(fullDir)) continue;
      for (const f of fs.readdirSync(fullDir)) {
        if (!f.endsWith('.js')) continue;
        const loc = fs.readFileSync(path.join(fullDir, f), 'utf8').split(/\r?\n/).length;
        expect(loc).toBeLessThan(3501);
      }
    }
  });

  it('23.3 [HTML-SW-PARITY] HTML templates & Service Worker include all modular JS assets', () => {
    const adminScripts = fs.readFileSync(path.join(rootDir, 'frontend/admin/src/layout/scripts.html'), 'utf8');
    expect(adminScripts).toContain('/admin/js/gis-gps-tools.js');
    expect(adminScripts).toContain('/admin/js/gis-export.js');

    const plantHtml = fs.readFileSync(path.join(rootDir, 'frontend/public/plant.html'), 'utf8');
    expect(plantHtml).toContain('/js/plant-timeline.js');
    expect(plantHtml).toContain('/js/plant-care-modals.js');
    expect(plantHtml).toContain('/js/plant-nfc-gateway.js');
    expect(plantHtml).toContain('/js/plant-export-certs.js');

    const userSw = fs.readFileSync(path.join(rootDir, 'frontend/user/sw.js'), 'utf8');
    expect(userSw).toContain('/user/js/modules/plants-iot-weather.js');
    expect(userSw).toContain('/user/js/modules/plants-profile-erp.js');
  });

  it('23.4 [DB-MIGRATIONS] All SQL migration files exist and contain valid DDL statements', () => {
    const migDir = path.join(rootDir, 'backend/db/migrations');
    const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThan(8);
    for (const f of files) {
      const sql = fs.readFileSync(path.join(migDir, f), 'utf8');
      expect(sql.trim().length).toBeGreaterThan(50);
      expect(/CREATE|ALTER|DO\s+\$\$/i.test(sql)).toBe(true);
    }
  });
});
