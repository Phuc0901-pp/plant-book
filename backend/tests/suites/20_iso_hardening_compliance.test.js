/**
 * ══════════════════════════════════════════════════════════════════════════
 * Suite 20: Enterprise Security, Cryptographic Authenticity & ISO Hardening
 * ══════════════════════════════════════════════════════════════════════════
 * Verifies Migration 009_enterprise_iso_hardening.sql across 4 Modules:
 * 1. Module SEC: RLS policies (29 tables), rls_auto_enable revoke, RESTRICT FKs, pgcrypto helpers
 * 2. Module AUTH: SHA-256 Hash-Chain trigger & backfill, NFC anti-replay, Append-Only audit triggers
 * 3. Module ISO: ISO 6709 (WGS84), ISO 4217 (currency_code), ISO/IEC 15459 (W3C DID), ISO 8601 age
 * 4. Module PERF: 35 FK covering indexes & duplicate index cleanup
 */

const { describe, it, expect } = require('../test-framework');
const fs = require('fs');
const path = require('path');

describe('Suite 20: Migration 009 Enterprise ISO Hardening & Security Compliance', () => {
  const rootDir = path.join(__dirname, '../../..');
  const mig009Path = path.join(rootDir, 'backend/db/migrations/009_enterprise_iso_hardening.sql');

  it('20.1 Should verify Migration 009 exists and is compatible with migrate.js transaction wrapper', () => {
    expect(fs.existsSync(mig009Path)).toBe(true);
    const sql = fs.readFileSync(mig009Path, 'utf8');
    expect(sql.includes('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions')).toBe(true);
    expect(/^\s*BEGIN\s*;/m.test(sql)).toBe(false);
    expect(/^\s*COMMIT\s*;/m.test(sql)).toBe(false);
  });

  it('20.2 Module SEC: Should harden rls_auto_enable, RLS policies, RESTRICT FKs, and pgcrypto helpers', () => {
    const sql = fs.readFileSync(mig009Path, 'utf8');
    expect(sql.includes('REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated')).toBe(true);
    expect(sql.includes('CREATE OR REPLACE FUNCTION public.current_app_user_id()')).toBe(true);
    expect(sql.includes('service_role_full_access')).toBe(true);
    expect(sql.includes('public_qr_read_plants')).toBe(true);

    // 5 critical FKs converted to ON DELETE RESTRICT
    const restrictFks = [
      'plant_logs_plant_id_fkey',
      'supply_usages_user_id_fkey',
      'supply_usages_supply_id_fkey',
      'fixed_assets_user_id_fkey',
      'nfc_security_audit_logs_farm_id_fkey',
    ];
    for (const fk of restrictFks) {
      expect(sql.includes(fk)).toBe(true);
    }
    expect(sql.includes('ON DELETE RESTRICT')).toBe(true);
    expect(sql.includes('hash_nfc_lock_password')).toBe(true);
    expect(sql.includes('verify_nfc_lock_password')).toBe(true);
  });

  it('20.3 Module AUTH: Should enforce SHA-256 hash-chain, NFC anti-replay, and Append-Only audits', () => {
    const sql = fs.readFileSync(mig009Path, 'utf8');
    expect(sql.includes('trg_fn_plant_logs_hash_chain')).toBe(true);
    expect(sql.includes('trg_plant_logs_hash_chain')).toBe(true);
    expect(sql.includes('GENESIS_00000000000000000000000000000000000000000000000000000000')).toBe(true);
    expect(sql.includes('trg_nfc_anti_replay')).toBe(true);
    expect(sql.includes('prevent_audit_mutation')).toBe(true);
    expect(sql.includes('trg_audit_logs_immutable')).toBe(true);
    expect(sql.includes('trg_data_audit_logs_immutable')).toBe(true);
    expect(sql.includes('trg_nfc_security_audit_logs_immutable')).toBe(true);
  });

  it('20.4 Module ISO: Should enforce ISO 6709 WGS84, ISO 4217 currency, W3C DID, and ISO 8601 age', () => {
    const sql = fs.readFileSync(mig009Path, 'utf8');
    expect(sql.includes('SANITIZE_INVALID_COORDS')).toBe(true);
    expect(sql.includes('chk_plants_wgs84_lat')).toBe(true);
    expect(sql.includes('chk_plants_wgs84_lng')).toBe(true);
    expect(sql.includes('chk_farms_wgs84_lat')).toBe(true);
    expect(sql.includes('chk_farms_wgs84_lng')).toBe(true);
    expect(sql.includes('currency_code char(3) NOT NULL DEFAULT \'VND\'')).toBe(true);
    expect(sql.includes('chk_supplies_currency_iso4217')).toBe(true);
    expect(sql.includes('chk_supply_usages_currency_iso4217')).toBe(true);
    expect(sql.includes('chk_fixed_assets_currency_iso4217')).toBe(true);
    expect(sql.includes('chk_farms_w3c_did')).toBe(true);
    expect(sql.includes('chk_plants_w3c_did')).toBe(true);
    expect(sql.includes('calc_plant_age_iso8601')).toBe(true);
  });

  it('20.5 Module PERF: Should create 35 FK covering indexes and drop 3 duplicate indexes', () => {
    const sql = fs.readFileSync(mig009Path, 'utf8');
    const createIndexMatches = sql.match(/CREATE INDEX IF NOT EXISTS /g) || [];
    expect(createIndexMatches.length).toBe(35);
    expect(sql.includes('DROP INDEX IF EXISTS public.idx_farm_plots_unique')).toBe(true);
    expect(sql.includes('DROP INDEX IF EXISTS public.idx_nfc_tags_inventory_uid_uniq')).toBe(true);
    expect(sql.includes('DROP INDEX IF EXISTS public.idx_plants_gps')).toBe(true);
  });

  it('20.6 Backend Routes: Should handle Append-Only (403) and RESTRICT FK (409 / 23503) cleanly', () => {
    const historyJs = fs.readFileSync(path.join(rootDir, 'backend/routes/history.js'), 'utf8');
    const suppliesJs = fs.readFileSync(path.join(rootDir, 'backend/routes/supplies.js'), 'utf8');
    const usersJs = fs.readFileSync(path.join(rootDir, 'backend/routes/users.js'), 'utf8');
    const farmsJs = fs.readFileSync(path.join(rootDir, 'backend/routes/farms.js'), 'utf8');

    expect(historyJs.includes('status(403)')).toBe(true);
    expect(historyJs.includes('Append-Only')).toBe(true);
    expect(suppliesJs.includes("err.code === '23503'")).toBe(true);
    expect(suppliesJs.includes('status(409)')).toBe(true);
    expect(usersJs.includes("err.code === '23503'")).toBe(true);
    expect(usersJs.includes('status(409)')).toBe(true);
    expect(farmsJs.includes("HARD_DELETE")).toBe(true);
  });
});
