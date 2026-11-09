/**
 * ==============================================================================
 * CÔNG CỤ DI CHUYỂN CƠ SỞ DỮ LIỆU SANG NAS CÔNG TY (POSTGRESQL → POSTGRESQL)
 * ==============================================================================
 * Cách dùng:
 *   node backend/scripts/migrate_to_nas.js <TARGET_URL>                 (chạy thử - dry-run)
 *   node backend/scripts/migrate_to_nas.js <TARGET_URL> --yes           (di chuyển thật)
 *
 * Tùy chọn:
 *   --source=<URL>        CSDL nguồn (mặc định: DATABASE_URL trong backend/.env)
 *   --mode=replace|upsert replace (mặc định): xóa sạch bảng đích rồi nạp lại
 *                         upsert: giữ dữ liệu đích, ghi đè theo khóa chính
 *   --batch=<n>           Số dòng mỗi lô INSERT (mặc định 1000)
 *   --only=a,b            Chỉ di chuyển các bảng này
 *   --exclude=a,b         Bỏ qua các bảng này
 *   --no-checksum         Bỏ qua đối soát checksum MD5 (chỉ so số dòng)
 *   --checksum-limit=<n>  Chỉ tính checksum cho bảng ≤ n dòng (mặc định 200000)
 *
 * Quy trình:
 *   1. Đọc TOÀN BỘ cấu trúc schema public của nguồn (bảng, cột, kiểu, default,
 *      enum, sequence, PK/UNIQUE/CHECK/FK, index, bảng phân vùng)
 *   2. Tạo cấu trúc còn thiếu trên NAS (idempotent - chạy lại nhiều lần an toàn)
 *   3. Nạp dữ liệu theo lô trong 1 transaction (lỗi → rollback, NAS giữ nguyên)
 *      - Nguồn đọc trong snapshot REPEATABLE READ (dữ liệu nhất quán)
 *      - Giữ dạng text gốc của mọi kiểu dữ liệu (JSONB, ngày giờ, số thực, bytea)
 *   4. Đồng bộ sequence, thêm khóa ngoại + index sau khi nạp
 *   5. Đối soát số dòng + checksum MD5 từng bảng
 *
 * Exit code: 0 = thành công · 1 = lỗi · 2 = dữ liệu lệch sau đối soát
 * ==============================================================================
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { resolveSslConfig, maskConnectionString } = require('../config/dbSsl');

const MAX_PARAMS = 65000; // Giới hạn tham số của giao thức PostgreSQL là 65535

// ─────────────────────────────────────────────────────────────────────────────
// HÀM THUẦN (pure functions) — có unit test trong backend/tests/suites
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv, env = process.env) {
  const opts = {
    source: env.DATABASE_URL || env.DATABASE_WRITE_URL || '',
    target: env.NAS_DATABASE_URL || '',
    yes: false,
    mode: 'replace',
    batch: 1000,
    only: [],
    exclude: [],
    checksum: true,
    checksumLimit: 200000
  };
  const list = (v) => String(v || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const arg of argv) {
    if (arg === '--yes' || arg === '-y') opts.yes = true;
    else if (arg === '--no-checksum') opts.checksum = false;
    else if (arg.startsWith('--source=')) opts.source = arg.slice(9);
    else if (arg.startsWith('--target=')) opts.target = arg.slice(9);
    else if (arg.startsWith('--mode=')) opts.mode = arg.slice(7).toLowerCase();
    else if (arg.startsWith('--batch=')) opts.batch = parseInt(arg.slice(8), 10) || opts.batch;
    else if (arg.startsWith('--only=')) opts.only = list(arg.slice(7));
    else if (arg.startsWith('--exclude=')) opts.exclude = list(arg.slice(10));
    else if (arg.startsWith('--checksum-limit=')) opts.checksumLimit = parseInt(arg.slice(17), 10) || opts.checksumLimit;
    else if (!arg.startsWith('-')) opts.target = arg;
  }
  if (!['replace', 'upsert'].includes(opts.mode)) {
    throw new Error(`--mode không hợp lệ: "${opts.mode}" (chỉ nhận replace | upsert)`);
  }
  return opts;
}

function quoteIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function quoteLiteral(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

/** Lấy tên sequence từ biểu thức default: nextval('public."plants_id_seq"'::regclass) → plants_id_seq */
function extractSequenceName(defaultExpr) {
  if (!defaultExpr) return null;
  const m = String(defaultExpr).match(/nextval\('([^']+)'(?:::regclass)?\)/i);
  if (!m) return null;
  const parts = m[1].split('.');
  return parts[parts.length - 1].replace(/^"|"$/g, '').replace(/""/g, '"');
}

/** Số dòng mỗi lô sao cho không vượt giới hạn tham số */
function computeBatchSize(columnCount, requested = 1000) {
  const cols = Math.max(1, columnCount);
  return Math.max(1, Math.min(requested, Math.floor(MAX_PARAMS / cols)));
}

/** Thêm IF NOT EXISTS và bỏ ON ONLY (để index lan xuống bảng con phân vùng) */
function normalizeIndexDef(def) {
  return String(def)
    .replace(/^CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/i, (_, u) => `CREATE ${u || ''}INDEX IF NOT EXISTS `)
    .replace(/ ON ONLY /i, ' ON ');
}

/** Sắp xếp bảng: bảng cha phân vùng luôn đứng trước bảng con */
function sortTablesByDependency(tables) {
  const byName = new Map(tables.map(t => [t.name, t]));
  const depth = (t, seen = new Set()) => {
    if (!t.parent || !byName.has(t.parent) || seen.has(t.name)) return 0;
    seen.add(t.name);
    return 1 + depth(byName.get(t.parent), seen);
  };
  return [...tables].sort((a, b) => depth(a) - depth(b) || a.name.localeCompare(b.name));
}

/** Câu lệnh CREATE TABLE IF NOT EXISTS từ metadata */
function buildCreateTableSql(table, columns) {
  if (table.parent && table.partbound) {
    return `CREATE TABLE IF NOT EXISTS ${quoteIdent(table.name)} PARTITION OF ${quoteIdent(table.parent)} ${table.partbound}`;
  }
  const defs = columns.map(c => {
    let d = `${quoteIdent(c.name)} ${c.type}`;
    if (c.generated === 's' && c.defaultExpr) d += ` GENERATED ALWAYS AS (${c.defaultExpr}) STORED`;
    else if (c.identity === 'a') d += ' GENERATED ALWAYS AS IDENTITY';
    else if (c.identity === 'd') d += ' GENERATED BY DEFAULT AS IDENTITY';
    else if (c.defaultExpr) d += ` DEFAULT ${c.defaultExpr}`;
    if (c.notNull) d += ' NOT NULL';
    return d;
  });
  const partition = table.partkey ? ` PARTITION BY ${table.partkey}` : '';
  return `CREATE TABLE IF NOT EXISTS ${quoteIdent(table.name)} (\n  ${defs.join(',\n  ')}\n)${partition}`;
}

/** Câu lệnh INSERT nhiều dòng có tham số */
function buildInsertSql(tableName, columns, rowCount, { overriding = false, mode = 'replace', pkColumns = [] } = {}) {
  const n = columns.length;
  const groups = [];
  for (let r = 0; r < rowCount; r++) {
    const ph = [];
    for (let c = 0; c < n; c++) ph.push('$' + (r * n + c + 1));
    groups.push('(' + ph.join(', ') + ')');
  }
  let sql = `INSERT INTO ${quoteIdent(tableName)} (${columns.map(quoteIdent).join(', ')}) `
    + (overriding ? 'OVERRIDING SYSTEM VALUE ' : '')
    + 'VALUES ' + groups.join(', ');

  if (mode === 'upsert') {
    const pk = pkColumns.filter(c => columns.includes(c));
    if (pk.length) {
      const rest = columns.filter(c => !pk.includes(c));
      sql += ` ON CONFLICT (${pk.map(quoteIdent).join(', ')}) `
        + (rest.length ? 'DO UPDATE SET ' + rest.map(c => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`).join(', ') : 'DO NOTHING');
    } else {
      sql += ' ON CONFLICT DO NOTHING';
    }
  }
  return sql;
}

/** Biểu thức checksum MD5 ổn định (thứ tự cột theo tên, thứ tự dòng theo hash) */
function buildChecksumSql(tableName, columns) {
  const cols = [...columns].sort().map(quoteIdent).join(', ');
  const rowExpr = columns.length === 1 ? `ROW(${cols}, NULL)` : `ROW(${cols})`;
  return `SELECT md5(COALESCE(string_agg(h, '' ORDER BY h), '')) AS checksum FROM (SELECT md5(${rowExpr}::text) AS h FROM ${quoteIdent(tableName)}) s`;
}

function filterTables(tables, { only = [], exclude = [] } = {}) {
  return tables.filter(t => {
    const key = t.parent || t.name; // bảng con phân vùng đi theo bảng cha
    if (only.length && !only.includes(t.name) && !only.includes(key)) return false;
    if (exclude.includes(t.name) || exclude.includes(key)) return false;
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUY VẤN METADATA
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_SQL = [
  "SET TimeZone TO 'UTC'",
  "SET DateStyle TO 'ISO, MDY'",
  "SET IntervalStyle TO 'postgres'",
  'SET extra_float_digits TO 3',
  "SET bytea_output TO 'hex'",
  "SET client_encoding TO 'UTF8'",
  'SET search_path TO public, extensions'
];

async function applySession(client) {
  for (const sql of SESSION_SQL) await client.query(sql);
}

async function introspect(client) {
  const tablesRes = await client.query(`
    SELECT c.oid::int AS oid, c.relname AS name, c.relkind AS kind,
           CASE WHEN c.relkind = 'p' THEN pg_get_partkeydef(c.oid) END AS partkey,
           CASE WHEN c.relispartition THEN pg_get_expr(c.relpartbound, c.oid) END AS partbound,
           (SELECT p.relname FROM pg_inherits i JOIN pg_class p ON p.oid = i.inhparent
             WHERE i.inhrelid = c.oid LIMIT 1) AS parent
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
    ORDER BY c.relname`);
  const tables = tablesRes.rows.map(t => ({ ...t, oid: Number(t.oid) }));
  const oids = tables.map(t => t.oid);
  if (!oids.length) return { tables: [], columns: new Map(), constraints: [], indexes: [], pk: new Map(), enums: [], sequences: [], extensions: [] };

  const colsRes = await client.query(`
    SELECT a.attrelid::int AS oid, a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type,
           a.attnotnull AS not_null, pg_get_expr(d.adbin, d.adrelid) AS default_expr,
           a.attidentity AS identity, a.attgenerated AS generated
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = ANY($1::oid[]) AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY a.attrelid, a.attnum`, [oids]);
  const columns = new Map();
  for (const r of colsRes.rows) {
    const oid = Number(r.oid);
    if (!columns.has(oid)) columns.set(oid, []);
    columns.get(oid).push({
      name: r.name, type: r.type, notNull: r.not_null === true || r.not_null === 't',
      defaultExpr: r.default_expr, identity: r.identity || '', generated: r.generated || ''
    });
  }

  const consRes = await client.query(`
    SELECT c.conrelid::int AS oid, c.conname AS name, c.contype AS type, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    WHERE c.conrelid = ANY($1::oid[]) AND c.contype IN ('p', 'u', 'c', 'x', 'f')
      AND c.conislocal AND c.conparentid = 0
    ORDER BY CASE c.contype WHEN 'p' THEN 0 WHEN 'u' THEN 1 WHEN 'x' THEN 2 WHEN 'c' THEN 3 ELSE 4 END, c.conname`, [oids]);
  const constraints = consRes.rows.map(r => ({ ...r, oid: Number(r.oid) }));

  const pkRes = await client.query(`
    SELECT c.conrelid::int AS oid, array_agg(a.attname::text ORDER BY k.ord) AS cols
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.contype = 'p' AND c.conrelid = ANY($1::oid[])
    GROUP BY c.conrelid`, [oids]);
  const pk = new Map(pkRes.rows.map(r => [Number(r.oid), parsePgArray(r.cols)]));

  const idxRes = await client.query(`
    SELECT t.relname AS table_name, i.relname AS name, pg_get_indexdef(i.oid) AS def
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_class t ON t.oid = x.indrelid
    WHERE x.indrelid = ANY($1::oid[])
      AND NOT EXISTS (SELECT 1 FROM pg_inherits h WHERE h.inhrelid = i.oid)
      AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.oid AND c.conrelid = x.indrelid AND c.contype IN ('p', 'u', 'x'))
    ORDER BY t.relname, i.relname`, [oids]);

  const enumRes = await client.query(`
    SELECT t.typname AS name, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' GROUP BY t.typname`);

  let sequences = [];
  try {
    const seqRes = await client.query(`SELECT sequencename AS name, last_value FROM pg_sequences WHERE schemaname = 'public'`);
    sequences = seqRes.rows;
  } catch (_) { /* thiếu quyền đọc pg_sequences → bỏ qua, vẫn đồng bộ theo MAX(id) */ }

  const extRes = await client.query(`SELECT extname AS name FROM pg_extension WHERE extname <> 'plpgsql' ORDER BY extname`);

  return {
    tables, columns, constraints, pk,
    indexes: idxRes.rows,
    enums: enumRes.rows.map(r => ({ name: r.name, labels: parsePgArray(r.labels) })),
    sequences,
    extensions: extRes.rows.map(r => r.name)
  };
}

/** Đọc mảng text PostgreSQL '{a,b,"c d"}' (do dùng parser raw) */
function parsePgArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  const s = String(value);
  if (s === '{}') return [];
  const out = [];
  let cur = '', inQuotes = false, escaped = false;
  for (const ch of s.slice(1, -1)) {
    if (escaped) { cur += ch; escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

async function targetColumns(client, tableName) {
  const res = await client.query(`
    SELECT a.attname AS name, a.attgenerated AS generated, a.attidentity AS identity
    FROM pg_attribute a
    WHERE a.attrelid = to_regclass($1) AND a.attnum > 0 AND NOT a.attisdropped`, [`public.${quoteIdent(tableName)}`]);
  return res.rows;
}

async function targetConstraintNames(client, tableName) {
  const res = await client.query(
    `SELECT conname FROM pg_constraint WHERE conrelid = to_regclass($1)`, [`public.${quoteIdent(tableName)}`]);
  return new Set(res.rows.map(r => r.conname));
}

async function countRows(client, tableName) {
  const res = await client.query(`SELECT COUNT(*) AS n FROM ONLY ${quoteIdent(tableName)}`);
  return parseInt(res.rows[0].n, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHƯƠNG TRÌNH CHÍNH
// ─────────────────────────────────────────────────────────────────────────────

const log = (...a) => console.log(...a);
const warnings = [];
const warn = (msg) => { warnings.push(msg); console.log(`   ⚠️  ${msg}`); };

async function tryQuery(client, sql, label) {
  try { await client.query(sql); return true; }
  catch (err) { warn(`${label}: ${err.message}`); return false; }
}

function makeClient(url) {
  const { Client } = require('pg');
  return new Client({
    connectionString: url,
    ssl: resolveSslConfig(url),
    connectionTimeoutMillis: 15000,
    application_name: 'plantbook-nas-migrate',
    // Giữ nguyên dạng text gốc của mọi kiểu → nạp lại không mất độ chính xác
    types: { getTypeParser: () => (v) => v }
  });
}

async function main(argv) {
  const opts = parseArgs(argv);
  log('========================================================================');
  log('🚀 DI CHUYỂN CƠ SỞ DỮ LIỆU PLANT BOOK SANG NAS CÔNG TY');
  log('========================================================================');

  if (!opts.source) throw new Error('Chưa có CSDL nguồn: khai báo DATABASE_URL trong backend/.env hoặc --source=<URL>');
  if (opts.target && opts.target.trim() === opts.source.trim()) throw new Error('CSDL nguồn và đích trùng nhau — dừng để tránh mất dữ liệu.');

  log(`   Nguồn : ${maskConnectionString(opts.source)}  (SSL: ${resolveSslConfig(opts.source) ? 'bật' : 'tắt'})`);
  log(`   Đích  : ${opts.target ? maskConnectionString(opts.target) + `  (SSL: ${resolveSslConfig(opts.target) ? 'bật' : 'tắt'})` : '(chưa khai báo)'}`);
  log(`   Chế độ: ${opts.yes ? 'GHI THẬT' : 'CHẠY THỬ (dry-run)'} · mode=${opts.mode} · batch=${opts.batch}\n`);

  const src = makeClient(opts.source);
  await src.connect();
  await applySession(src);
  await src.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const srcVer = (await src.query('SHOW server_version')).rows[0].server_version;
  log(`📡 1. Đã kết nối nguồn (PostgreSQL ${srcVer}), đọc trong snapshot nhất quán.`);

  const meta = await introspect(src);
  const tables = sortTablesByDependency(filterTables(meta.tables, opts));
  const leafTables = tables.filter(t => t.kind === 'r');
  const srcCounts = new Map();
  for (const t of leafTables) srcCounts.set(t.name, await countRows(src, t.name));

  log(`\n📊 2. Cấu trúc nguồn: ${tables.length} bảng (${tables.filter(t => t.kind === 'p').length} bảng phân vùng), `
    + `${meta.enums.length} enum, ${meta.sequences.length} sequence, ${meta.indexes.length} index, `
    + `${meta.constraints.filter(c => c.type === 'f').length} khóa ngoại`);
  log(`   Extension: ${meta.extensions.join(', ') || '(không có)'}`);
  let totalRows = 0;
  for (const t of leafTables) {
    const n = srcCounts.get(t.name);
    totalRows += n;
    log(`   - ${t.name.padEnd(32)} ${String(n).padStart(10)} dòng${t.parent ? `  (phân vùng của ${t.parent})` : ''}`);
  }
  log(`   TỔNG: ${totalRows.toLocaleString('vi-VN')} dòng`);

  if (!opts.target) {
    log('\n💡 Bước tiếp theo: chạy lại kèm địa chỉ CSDL NAS, ví dụ:');
    log('   node backend/scripts/migrate_to_nas.js postgres://plantbook:<MAT_KHAU>@<IP_NAS>:5432/plant_book?sslmode=disable');
    await src.query('ROLLBACK'); await src.end();
    return 0;
  }

  const tgt = makeClient(opts.target);
  await tgt.connect();
  await applySession(tgt);
  const tgtVer = (await tgt.query('SHOW server_version')).rows[0].server_version;
  log(`\n🎯 3. Đã kết nối NAS (PostgreSQL ${tgtVer}).`);

  const existing = new Set((await tgt.query(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r','p')`)).rows.map(r => r.relname));
  const overlap = leafTables.filter(t => existing.has(t.name));
  if (overlap.length) {
    log(`   NAS đã có ${overlap.length} bảng trùng tên:`);
    for (const t of overlap) log(`   - ${t.name.padEnd(32)} ${String(await countRows(tgt, t.name)).padStart(10)} dòng hiện có`);
    if (opts.mode === 'replace') log('   → mode=replace: các bảng này sẽ được XÓA SẠCH và nạp lại từ nguồn.');
  }

  if (!opts.yes) {
    log('\n✅ CHẠY THỬ HOÀN TẤT — chưa ghi gì lên NAS. Thêm --yes để di chuyển thật.');
    await src.query('ROLLBACK'); await src.end(); await tgt.end();
    return 0;
  }

  // ── 4. Tạo cấu trúc ───────────────────────────────────────────────────────
  log('\n🏗️  4. Tạo cấu trúc trên NAS...');
  for (const ext of meta.extensions) {
    await tryQuery(tgt, `CREATE EXTENSION IF NOT EXISTS ${quoteIdent(ext)}`, `Extension ${ext} không có trên NAS (bỏ qua nếu không dùng)`);
  }
  for (const e of meta.enums) {
    await tryQuery(tgt, `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = ${quoteLiteral(e.name)} AND n.nspname = 'public') THEN
        CREATE TYPE public.${quoteIdent(e.name)} AS ENUM (${e.labels.map(quoteLiteral).join(', ')});
      END IF; END $$;`, `Enum ${e.name}`);
  }
  const seqNames = new Set(meta.sequences.map(s => s.name));
  for (const t of tables) for (const c of meta.columns.get(t.oid) || []) {
    const s = extractSequenceName(c.defaultExpr);
    if (s) seqNames.add(s);
  }
  for (const s of seqNames) await tryQuery(tgt, `CREATE SEQUENCE IF NOT EXISTS ${quoteIdent(s)}`, `Sequence ${s}`);

  let created = 0, columnsAdded = 0;
  for (const t of tables) {
    const cols = meta.columns.get(t.oid) || [];
    if (!existing.has(t.name)) {
      if (await tryQuery(tgt, buildCreateTableSql(t, cols), `Tạo bảng ${t.name}`)) { created++; existing.add(t.name); }
      continue;
    }
    if (t.parent) continue; // bảng con phân vùng dùng cột của bảng cha
    const have = new Set((await targetColumns(tgt, t.name)).map(c => c.name));
    for (const c of cols) {
      if (have.has(c.name) || c.generated === 's') continue;
      const def = c.defaultExpr && !c.identity ? ` DEFAULT ${c.defaultExpr}` : '';
      if (await tryQuery(tgt, `ALTER TABLE ${quoteIdent(t.name)} ADD COLUMN IF NOT EXISTS ${quoteIdent(c.name)} ${c.type}${def}`, `Thêm cột ${t.name}.${c.name}`)) columnsAdded++;
    }
  }
  const tableByOid = new Map(tables.map(t => [t.oid, t]));
  for (const c of meta.constraints.filter(c => c.type !== 'f')) {
    const t = tableByOid.get(c.oid);
    if (!t) continue;
    if ((await targetConstraintNames(tgt, t.name)).has(c.name)) continue;
    await tryQuery(tgt, `ALTER TABLE ${quoteIdent(t.name)} ADD CONSTRAINT ${quoteIdent(c.name)} ${c.def}`, `Ràng buộc ${c.name}`);
  }
  log(`   ✅ Tạo mới ${created} bảng, bổ sung ${columnsAdded} cột còn thiếu.`);

  // ── 5. Nạp dữ liệu ────────────────────────────────────────────────────────
  log('\n📦 5. Nạp dữ liệu (1 transaction — lỗi sẽ rollback toàn bộ)...');
  try { await tgt.query('SET session_replication_role = replica'); }
  catch (err) { warn(`Không tắt được trigger khi nạp (cần quyền superuser): ${err.message}`); }

  const insertColsByTable = new Map();
  await tgt.query('BEGIN');
  try {
    if (opts.mode === 'replace') {
      const roots = tables.filter(t => !t.parent || !tables.some(p => p.name === t.parent)).filter(t => existing.has(t.name));
      if (roots.length) await tgt.query(`TRUNCATE ${roots.map(t => quoteIdent(t.name)).join(', ')} RESTART IDENTITY CASCADE`);
    }
    for (const t of leafTables) {
      const total = srcCounts.get(t.name);
      const srcCols = (meta.columns.get(t.oid) || []).filter(c => c.generated !== 's');
      const tgtCols = await targetColumns(tgt, t.name);
      const tgtWritable = new Set(tgtCols.filter(c => c.generated !== 's').map(c => c.name));
      const cols = srcCols.map(c => c.name).filter(n => tgtWritable.has(n));
      insertColsByTable.set(t.name, cols);
      const missing = srcCols.map(c => c.name).filter(n => !tgtWritable.has(n));
      if (missing.length) warn(`Bảng ${t.name}: NAS thiếu cột ${missing.join(', ')} (bỏ qua các cột này)`);
      if (!total || !cols.length) { log(`   · ${t.name}: 0 dòng`); continue; }

      const overriding = tgtCols.some(c => c.identity === 'a' && cols.includes(c.name));
      const pkCols = (meta.pk.get(t.oid) || (t.parent ? meta.pk.get((tables.find(p => p.name === t.parent) || {}).oid) : null)) || [];
      const size = computeBatchSize(cols.length, opts.batch);
      const selectCols = cols.map(quoteIdent).join(', ');
      const started = Date.now();
      let copied = 0, lastCtid = '(0,0)';
      while (copied < total) {
        const res = await src.query(
          `SELECT ctid::text AS __ctid, ${selectCols} FROM ONLY ${quoteIdent(t.name)} WHERE ctid > $1::tid ORDER BY ctid LIMIT ${size}`,
          [lastCtid]);
        if (!res.rows.length) break;
        const values = [];
        for (const row of res.rows) for (const c of cols) values.push(row[c]);
        await tgt.query(buildInsertSql(t.name, cols, res.rows.length, { overriding, mode: opts.mode, pkColumns: pkCols }), values);
        copied += res.rows.length;
        lastCtid = res.rows[res.rows.length - 1].__ctid;
      }
      log(`   ✅ ${t.name.padEnd(32)} ${String(copied).padStart(10)} dòng  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    }
    await tgt.query('COMMIT');
  } catch (err) {
    await tgt.query('ROLLBACK').catch(() => {});
    throw new Error(`Nạp dữ liệu thất bại, đã rollback — NAS giữ nguyên như trước: ${err.message}`);
  } finally {
    await tgt.query('SET session_replication_role = DEFAULT').catch(() => {});
  }

  // ── 6. Sequence, khóa ngoại, index ────────────────────────────────────────
  log('\n🔗 6. Đồng bộ sequence, khóa ngoại, index...');
  const srcSeqLast = new Map(meta.sequences.map(s => [s.name, s.last_value === null ? 0 : parseInt(s.last_value, 10) || 0]));
  const seqTarget = new Map(); // tên sequence → giá trị lớn nhất cần đặt
  for (const [name, last] of srcSeqLast) if (last > 0) seqTarget.set(name, last);
  for (const t of leafTables) {
    for (const c of meta.columns.get(t.oid) || []) {
      let seq = extractSequenceName(c.defaultExpr);
      if (!seq && c.identity) {
        const r = await tgt.query(`SELECT pg_get_serial_sequence($1, $2) AS s`, [`public.${quoteIdent(t.parent || t.name)}`, c.name]);
        seq = r.rows[0].s ? extractSequenceName(`nextval('${r.rows[0].s}')`) : null;
      }
      if (!seq) continue;
      const r = await tgt.query(`SELECT MAX(${quoteIdent(c.name)})::text AS m FROM ${quoteIdent(t.name)}`).catch(() => null);
      const max = r && r.rows[0].m ? parseInt(r.rows[0].m, 10) || 0 : 0;
      seqTarget.set(seq, Math.max(seqTarget.get(seq) || 0, max));
    }
  }
  for (const [seq, value] of seqTarget) {
    if (value > 0) await tryQuery(tgt, `SELECT setval(${quoteLiteral(quoteIdent(seq))}, ${value}, true)`, `Sequence ${seq}`);
  }
  let fkOk = 0;
  for (const c of meta.constraints.filter(c => c.type === 'f')) {
    const t = tableByOid.get(c.oid);
    if (!t || (await targetConstraintNames(tgt, t.name)).has(c.name)) continue;
    const sql = `ALTER TABLE ${quoteIdent(t.name)} ADD CONSTRAINT ${quoteIdent(c.name)} ${c.def}`;
    try { await tgt.query(sql); fkOk++; }
    catch (err) {
      if (await tryQuery(tgt, `${sql} NOT VALID`, `Khóa ngoại ${c.name} có dữ liệu không khớp (${err.message}) → thêm dạng NOT VALID`)) fkOk++;
    }
  }
  let idxOk = 0;
  for (const i of meta.indexes) {
    if (!tables.some(t => t.name === i.table_name)) continue;
    if (await tryQuery(tgt, normalizeIndexDef(i.def), `Index ${i.name}`)) idxOk++;
  }
  log(`   ✅ ${[...seqTarget.values()].filter(v => v > 0).length} sequence · ${fkOk} khóa ngoại · ${idxOk} index`);

  // ── 7. Đối soát ───────────────────────────────────────────────────────────
  log('\n🔍 7. Đối soát toàn vẹn dữ liệu (nguồn ↔ NAS):');
  let mismatches = 0;
  for (const t of leafTables) {
    const s = srcCounts.get(t.name);
    const d = await countRows(tgt, t.name).catch(() => -1); // -1 = bảng không tồn tại trên NAS
    let line = `   - ${t.name.padEnd(32)} ${String(s).padStart(10)} ↔ ${String(d < 0 ? 'thiếu bảng' : d).padEnd(10)}`;
    if (s !== d) { mismatches++; log(`${line} ❌ LỆCH SỐ DÒNG`); continue; }
    const cols = insertColsByTable.get(t.name) || [];
    if (opts.checksum && opts.mode === 'replace' && s > 0 && s <= opts.checksumLimit && cols.length) {
      const sql = buildChecksumSql(t.name, cols);
      const [a, b] = await Promise.all([src.query(sql), tgt.query(sql)]);
      if (a.rows[0].checksum === b.rows[0].checksum) line += ' ✅ khớp số dòng + checksum';
      else { line += ' ⚠️ khớp số dòng, checksum khác'; warn(`Checksum ${t.name} khác (có thể do khác phiên bản PostgreSQL định dạng số/ngày) — nên kiểm tra mẫu`); }
    } else line += ' ✅ khớp số dòng';
    log(line);
  }
  await src.query('ROLLBACK');
  await tgt.query('ANALYZE').catch(() => {});
  await src.end(); await tgt.end();

  log('\n========================================================================');
  if (mismatches) {
    log(`❌ CÓ ${mismatches} BẢNG LỆCH SỐ DÒNG — KHÔNG chuyển ứng dụng sang NAS, kiểm tra cảnh báo phía trên.`);
    return 2;
  }
  log(`🎉 DI CHUYỂN THÀNH CÔNG: ${leafTables.length} bảng, ${totalRows.toLocaleString('vi-VN')} dòng khớp 100%.`);
  if (warnings.length) log(`   (${warnings.length} cảnh báo — xem chi tiết phía trên)`);
  log('   Bước tiếp: đổi DATABASE_URL của ứng dụng sang NAS (xem NAS_DEPLOYMENT.md).');
  log('========================================================================');
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then(code => process.exit(code))
    .catch(err => { console.error(`\n❌ Lỗi: ${err.message}`); process.exit(1); });
}

module.exports = {
  parseArgs, quoteIdent, quoteLiteral, extractSequenceName, computeBatchSize, normalizeIndexDef,
  sortTablesByDependency, buildCreateTableSql, buildInsertSql, buildChecksumSql, filterTables, parsePgArray, main
};
