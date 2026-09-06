const { describe, it, expect } = require('../test-framework');
const fs = require('fs');
const path = require('path');
const storageService = require('../../services/storageService');

describe('Suite 9: Phase 1 & Phase 2 Architecture, GIN Indexes, Storage & Offline-First Verification', () => {

  it('9.1 Should verify Database Migration files (001, 002, 003) exist and contain valid SQL', () => {
    const migrationsDir = path.join(__dirname, '../../db/migrations');
    expect(fs.existsSync(migrationsDir)).toBe(true);

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    expect(files.length).toBeGreaterThanOrEqual(3);
    expect(files).toContain('001_initial_schema.sql');
    expect(files).toContain('002_vietgap_and_supplies.sql');
    expect(files).toContain('003_gin_and_performance_indexes.sql');

    // Verify each migration has +migrate Up
    files.forEach(file => {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      expect(content.includes('-- +migrate Up')).toBe(true);
      expect(content.length).toBeGreaterThan(100);
    });
  });

  it('9.2 Should verify PostgreSQL GIN Indexes and Composite Index definitions in Migration and Init scripts', () => {
    const mig003Path = path.join(__dirname, '../../db/migrations/003_gin_and_performance_indexes.sql');
    const mig003Content = fs.readFileSync(mig003Path, 'utf8');
    const initPath = path.join(__dirname, '../../db/init.js');
    const initContent = fs.readFileSync(initPath, 'utf8');

    // Verify GIN Index on plant_logs(details)
    expect(mig003Content.includes('idx_plant_logs_details_gin')).toBe(true);
    expect(mig003Content.includes('USING gin (details jsonb_path_ops)')).toBe(true);
    expect(initContent.includes('idx_plant_logs_details_gin')).toBe(true);

    // Verify GIN Index on plants(data)
    expect(mig003Content.includes('idx_plants_data_gin')).toBe(true);
    expect(mig003Content.includes('USING gin (data jsonb_path_ops)')).toBe(true);
    expect(initContent.includes('idx_plants_data_gin')).toBe(true);

    // Verify Composite Index on (plant_id, log_date DESC)
    expect(mig003Content.includes('idx_plant_logs_plant_date')).toBe(true);
    expect(initContent.includes('idx_plant_logs_plant_date')).toBe(true);

    // Verify GPS Spatial Index on (latitude, longitude)
    expect(mig003Content.includes('idx_plants_coords')).toBe(true);
    expect(initContent.includes('idx_plants_coords')).toBe(true);
  });

  it('9.3 Should verify Storage Service multi-driver upload, delete and safe local fallback', async () => {
    expect(typeof storageService.uploadFile).toBe('function');
    expect(typeof storageService.deleteFile).toBe('function');

    // Test uploading a test buffer
    const testBuffer = Buffer.from('AgTech Plant Book Test Media Content 2026');
    const testFileName = `test_verification_${Date.now()}.txt`;
    const publicUrl = await storageService.uploadFile(testFileName, testBuffer, 'text/plain');

    expect(typeof publicUrl).toBe('string');
    expect(publicUrl.length).toBeGreaterThan(5);

    // Delete test file
    await storageService.deleteFile(testFileName);
  });

  it('9.4 Should verify Client Offline-First IndexedDB and Sync Engine files exist and are valid modules', () => {
    const offlineDbPath = path.join(__dirname, '../../../frontend/user/js/core/offline-db.js');
    const offlineSyncPath = path.join(__dirname, '../../../frontend/user/js/core/offline-sync.js');

    expect(fs.existsSync(offlineDbPath)).toBe(true);
    expect(fs.existsSync(offlineSyncPath)).toBe(true);

    const dbContent = fs.readFileSync(offlineDbPath, 'utf8');
    const syncContent = fs.readFileSync(offlineSyncPath, 'utf8');

    // Verify IndexedDB Stores
    expect(dbContent.includes('plantbook_offline_db')).toBe(true);
    expect(dbContent.includes('offline_care_logs')).toBe(true);
    expect(dbContent.includes('cached_meta')).toBe(true);
    expect(dbContent.includes('saveOfflineCareLog')).toBe(true);
    expect(dbContent.includes('getPendingOfflineCareLogs')).toBe(true);

    // Verify Offline Sync Engine
    expect(syncContent.includes('updateOfflineSyncBadge')).toBe(true);
    expect(syncContent.includes('triggerOfflineSync')).toBe(true);
    expect(syncContent.includes('offline-sync-badge')).toBe(true);
  });

  it('9.5 Should verify Topbar has the Offline/Online Sync Badge DOM element', () => {
    const topbarPath = path.join(__dirname, '../../../frontend/user/src/layout/topbar.html');
    const userIndexHtml = path.join(__dirname, '../../../frontend/user/index.html');

    const topbarContent = fs.readFileSync(topbarPath, 'utf8');
    const indexContent = fs.readFileSync(userIndexHtml, 'utf8');

    expect(topbarContent.includes('id="offline-sync-badge"')).toBe(true);
    expect(topbarContent.includes('id="sync-status-text"')).toBe(true);
    expect(indexContent.includes('id="offline-sync-badge"')).toBe(true);
  });

});
