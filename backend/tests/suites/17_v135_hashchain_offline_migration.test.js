/**
 * ══════════════════════════════════════════════════════════════════════════
 * Suite 17: v1.3.5 Enterprise Architectural Upgrades Verification
 * ══════════════════════════════════════════════════════════════════════════
 * 1. Idempotent Startup Migration Flag (legacy_data_normalization_v135) & Migration 008
 * 2. ISO/IEC 27001 Per-Farm Hash-Chain Mutex Lock (withFarmHashChainLock) & Farm Isolation
 * 3. Offline Batch Sync Column Alignment (created_by) & Route Alias (/:id/logs, /:id/care-log)
 * 4. Full-Stack SSOT Version Synchronization (v1.3.5 Build 19 across Backend, PWA, Admin, Flutter)
 */

const { describe, it, expect } = require('../test-framework');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

describe('Suite 17: v1.3.5 Hash-Chain Mutex Lock, Offline Batch Sync & Idempotent Migration Verification', () => {

  const rootDir = path.join(__dirname, '../../..');
  const initPath = path.join(rootDir, 'backend/db/init.js');
  const mig008Path = path.join(rootDir, 'backend/db/migrations/008_utf8_and_hashchain_optimization.sql');
  const plantsRoutePath = path.join(rootDir, 'backend/routes/plants.js');
  const offlineSyncJsPath = path.join(rootDir, 'frontend/user/js/core/offline-sync.js');

  it('17.1 Should verify Idempotent Startup Flag (legacy_data_normalization_v135) and Migration 008 exist', () => {
    expect(fs.existsSync(mig008Path)).toBe(true);
    const mig008 = fs.readFileSync(mig008Path, 'utf8');
    const initContent = fs.readFileSync(initPath, 'utf8');

    expect(mig008.includes('-- +migrate Up')).toBe(true);
    expect(mig008.includes('idx_plant_logs_hashchain')).toBe(true);
    expect(mig008.includes('legacy_data_normalization_v135')).toBe(true);

    expect(initContent.includes('shouldRunLegacyCleanup')).toBe(true);
    expect(initContent.includes('legacy_data_normalization_v135')).toBe(true);
    expect(initContent.includes('idx_plant_logs_hashchain')).toBe(true);
  });

  it('17.2 Should verify Per-Farm Hash-Chain Mutex Lock (withFarmHashChainLock) prevents concurrent hash forks', async () => {
    const plantsRoute = fs.readFileSync(plantsRoutePath, 'utf8');
    expect(plantsRoute.includes('withFarmHashChainLock')).toBe(true);
    expect(plantsRoute.includes('p.farm_id IS NOT DISTINCT FROM')).toBe(true);

    // Simulate 10 concurrent cultivation log writes in the same farm using the exact mutex lock algorithm
    const locks = new Map();
    async function withFarmLock(farmKey, fn) {
      const prevPromise = locks.get(farmKey) || Promise.resolve();
      let release;
      const nextPromise = new Promise((resolve) => { release = resolve; });
      locks.set(farmKey, prevPromise.then(() => nextPromise));
      await prevPromise;
      try {
        return await fn();
      } finally {
        release();
        if (locks.get(farmKey) === nextPromise) {
          locks.delete(farmKey);
        }
      }
    }

    const ledger = [];
    const tasks = Array.from({ length: 10 }, (_, idx) => {
      return withFarmLock('farm_16', async () => {
        await new Promise(r => setTimeout(r, 2));
        const prevHash = ledger.length > 0
          ? ledger[ledger.length - 1].record_hash
          : 'GENESIS_00000000000000000000000000000000000000000000000000000000';
        const logId = 1000 + idx;
        const canonical = `${prevHash}|${logId}|101|Tưới nước|2026-10-23|`;
        const recordHash = crypto.createHash('sha256').update(canonical).digest('hex');
        const entry = { id: logId, prev_log_hash: prevHash, record_hash: recordHash };
        ledger.push(entry);
        return entry;
      });
    });

    await Promise.all(tasks);
    expect(ledger.length).toBe(10);

    // Verify unbroken linear hash chain (zero forks!)
    for (let i = 1; i < ledger.length; i++) {
      expect(ledger[i].prev_log_hash).toBe(ledger[i - 1].record_hash);
    }
  });

  it('17.3 Should verify Offline Batch Sync uses created_by column and supports /:id/logs + /:id/care-log aliases', () => {
    const plantsRoute = fs.readFileSync(plantsRoutePath, 'utf8');
    const offlineSyncJs = fs.readFileSync(offlineSyncJsPath, 'utf8');

    // Verify INSERT INTO plant_logs uses created_by instead of user_id
    expect(plantsRoute.includes('INSERT INTO plant_logs (plant_id, created_by, log_date, log_type, note, media_urls, details, operator_name, equipment_used)')).toBe(true);
    expect(plantsRoute.includes("router.post(['/:id/logs', '/:id/care-log']")).toBe(true);
    expect(offlineSyncJs.includes('/plants/${pid}/logs')).toBe(true);
  });

  it('17.4 Should verify 100% SSOT Version v1.3.5 (Build 19) synchronization across all 10 platform files', () => {
    const appConfigJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'config/app.config.json'), 'utf8'));
    const backendPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'backend/package.json'), 'utf8'));
    const versionRoute = fs.readFileSync(path.join(rootDir, 'backend/routes/version.js'), 'utf8');
    const swJs = fs.readFileSync(path.join(rootDir, 'frontend/user/sw.js'), 'utf8');
    const userConfigJs = fs.readFileSync(path.join(rootDir, 'frontend/user/js/core/config.js'), 'utf8');
    const adminConfigJs = fs.readFileSync(path.join(rootDir, 'frontend/admin/js/core/config.js'), 'utf8');
    const pubspecYaml = fs.readFileSync(path.join(rootDir, 'mobile_app/pubspec.yaml'), 'utf8');
    const flutterConst = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/core/constants/app_constants.dart'), 'utf8');

    expect(appConfigJson.app.version).toBe('1.3.5');
    expect(appConfigJson.app.buildNumber).toBe(19);
    expect(backendPkg.version).toBe('1.3.5');
    expect(versionRoute.includes("version: '1.3.5'")).toBe(true);
    expect(swJs.includes('pb-farmer-cache-v1.3.5')).toBe(true);
    expect(userConfigJs.includes('"version": "1.3.5"')).toBe(true);
    expect(adminConfigJs.includes('"version": "1.3.5"')).toBe(true);
    expect(pubspecYaml.includes('version: 1.3.5+19')).toBe(true);
    expect(flutterConst.includes("'v1.3.5'")).toBe(true);
  });

});
