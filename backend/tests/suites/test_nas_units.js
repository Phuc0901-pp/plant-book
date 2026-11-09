const assert = require('assert');
const { resolveSslConfig, isPrivateHost, extractHost, extractSslMode, maskConnectionString } = require('../../config/dbSsl');
const { parseArgs, computeBatchSize, extractSequenceName, quoteIdent, quoteLiteral, normalizeIndexDef } = require('../../scripts/migrate_to_nas');

console.log('🧪 Starting NAS Unit Tests...');

// 1. dbSsl.js Unit Tests
assert.strictEqual(isPrivateHost('localhost'), true, 'localhost is private');
assert.strictEqual(isPrivateHost('127.0.0.1'), true, '127.0.0.1 is private');
assert.strictEqual(isPrivateHost('192.168.1.150'), true, '192.168.x is private');
assert.strictEqual(isPrivateHost('10.0.1.20'), true, '10.x is private');
assert.strictEqual(isPrivateHost('172.20.0.5'), true, '172.16-31 is private');
assert.strictEqual(isPrivateHost('postgres'), true, 'Docker service name is private');
assert.strictEqual(isPrivateHost('tanbao-postgres-nas'), true, 'Docker container is private');
assert.strictEqual(isPrivateHost('db.tanbao.local'), true, '.local is private');
assert.strictEqual(isPrivateHost('aws.neon.tech'), false, 'neon.tech is public cloud');
assert.strictEqual(isPrivateHost('db.abcdefg.supabase.co'), false, 'supabase.co is public cloud');

assert.strictEqual(extractHost('postgres://user:pass@192.168.1.50:5432/db'), '192.168.1.50');
assert.strictEqual(extractSslMode('postgres://user:pass@host:5432/db?sslmode=disable'), 'disable');

// Test resolveSslConfig
assert.strictEqual(resolveSslConfig('postgres://user:pass@192.168.1.50:5432/db'), false, 'LAN NAS disabled SSL');
assert.strictEqual(resolveSslConfig('postgres://user:pass@postgres:5432/db?sslmode=disable'), false, 'sslmode=disable overrides');
assert.deepStrictEqual(resolveSslConfig('postgres://user:pass@db.supabase.co:5432/db'), { rejectUnauthorized: false }, 'Cloud enables SSL');

// Test masking
assert.strictEqual(
  maskConnectionString('postgres://user:secretpass123@192.168.1.50:5432/db'),
  'postgres://user:****@192.168.1.50:5432/db'
);

// 2. migrate_to_nas.js Pure Logic Tests
const parsed = parseArgs(['--yes', '--mode=replace', '--batch=500', 'postgres://u:p@nas:5432/db']);
assert.strictEqual(parsed.yes, true);
assert.strictEqual(parsed.mode, 'replace');
assert.strictEqual(parsed.batch, 500);
assert.strictEqual(parsed.target, 'postgres://u:p@nas:5432/db');

assert.strictEqual(quoteIdent('my_table'), '"my_table"');
assert.strictEqual(quoteIdent('tab"le'), '"tab""le"');
assert.strictEqual(quoteLiteral("val'ue"), "'val''ue'");

assert.strictEqual(extractSequenceName("nextval('public.plants_id_seq'::regclass)"), 'plants_id_seq');
assert.strictEqual(extractSequenceName("nextval('\"users_id_seq\"')"), 'users_id_seq');

assert.strictEqual(computeBatchSize(10, 1000), 1000);
assert.strictEqual(computeBatchSize(100, 1000), 650); // 65000 / 100 = 650

assert.strictEqual(
  normalizeIndexDef('CREATE INDEX idx_plants ON ONLY plants (farm_id)'),
  'CREATE INDEX IF NOT EXISTS idx_plants ON plants (farm_id)'
);

console.log('✅ ALL NAS UNIT TESTS PASSED (100%)!');
