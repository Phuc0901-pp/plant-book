const { isUserFinanceRedacted, authorizeFarmAccess } = require('../routes/plants/helpers');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function isValidIsoDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function resolveReportDateRange(query = {}) {
  const period = String(query.period || '').toLowerCase().trim();
  const now = new Date();
  const y = parseInt(query.year, 10) || now.getFullYear();

  if (period === 'month') {
    const m = Math.min(12, Math.max(1, parseInt(query.month, 10) || (now.getMonth() + 1)));
    const lastDay = new Date(y, m, 0).getDate();
    return {
      date_from: `${y}-${pad2(m)}-01`,
      date_to: `${y}-${pad2(m)}-${pad2(lastDay)}`,
      period: 'month'
    };
  }

  if (period === 'quarter') {
    const q = Math.min(4, Math.max(1, parseInt(query.quarter, 10) || (Math.floor(now.getMonth() / 3) + 1)));
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    const lastDay = new Date(y, endMonth, 0).getDate();
    return {
      date_from: `${y}-${pad2(startMonth)}-01`,
      date_to: `${y}-${pad2(endMonth)}-${pad2(lastDay)}`,
      period: 'quarter'
    };
  }

  if (period === 'year') {
    return {
      date_from: `${y}-01-01`,
      date_to: `${y}-12-31`,
      period: 'year'
    };
  }

  const df = isValidIsoDate(query.date_from) ? query.date_from : null;
  const dt = isValidIsoDate(query.date_to) ? query.date_to : null;
  return {
    date_from: df,
    date_to: dt,
    period: period || 'custom'
  };
}

function extractTreeNumber(code) {
  if (code === undefined || code === null) return null;
  const m = String(code).match(/(\d+)/g);
  if (!m || m.length === 0) return null;
  const num = parseInt(m[m.length - 1], 10);
  return Number.isFinite(num) ? num : null;
}

function matchesTreeCodeRange(treeCode, fromCode, toCode) {
  if (!fromCode && !toCode) return true;
  const codeStr = String(treeCode || '').trim().toUpperCase();
  const fromStr = fromCode ? String(fromCode).trim().toUpperCase() : null;
  const toStr = toCode ? String(toCode).trim().toUpperCase() : null;

  const nCode = extractTreeNumber(codeStr);
  const nFrom = fromStr ? extractTreeNumber(fromStr) : null;
  const nTo = toStr ? extractTreeNumber(toStr) : null;

  if (nCode !== null && (nFrom !== null || nTo !== null)) {
    if (nFrom !== null && nCode < nFrom) return false;
    if (nTo !== null && nCode > nTo) return false;
    return true;
  }

  if (fromStr && codeStr.localeCompare(fromStr, undefined, { numeric: true }) < 0) return false;
  if (toStr && codeStr.localeCompare(toStr, undefined, { numeric: true }) > 0) return false;
  return true;
}

function parseDetailsObj(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return { ...raw };
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

async function queryIsoCareReport(pool, reqUser, query = {}) {
  const { date_from, date_to, period } = resolveReportDateRange(query);
  const financeRedacted = isUserFinanceRedacted(reqUser);
  const includeFinance = !financeRedacted && String(query.include_finance || '').toLowerCase() !== 'false';

  const rawFarmId = query.farm_id && query.farm_id !== 'all' ? parseInt(query.farm_id, 10) : null;
  const plotId = query.plot_id && query.plot_id !== 'all' ? parseInt(query.plot_id, 10) : null;
  const plantId = query.plant_id && query.plant_id !== 'all' ? parseInt(query.plant_id, 10) : null;
  const plantType = query.plant_type && query.plant_type !== 'all' ? String(query.plant_type).trim() : null;
  const treeCodeFrom = query.tree_code_from ? String(query.tree_code_from).trim() : null;
  const treeCodeTo = query.tree_code_to ? String(query.tree_code_to).trim() : null;
  const searchQ = query.search ? String(query.search).trim() : null;

  let logTypes = [];
  if (Array.isArray(query.log_types)) {
    logTypes = query.log_types.map(x => String(x).trim()).filter(Boolean);
  } else if (typeof query.log_types === 'string' && query.log_types.trim() && query.log_types.trim() !== 'all') {
    logTypes = query.log_types.split(',').map(x => x.trim()).filter(Boolean);
  } else if (typeof query.log_type === 'string' && query.log_type.trim() && query.log_type.trim() !== 'all') {
    logTypes = [query.log_type.trim()];
  }

  const limit = Math.min(5000, Math.max(1, parseInt(query.limit, 10) || 2000));
  const offset = Math.max(0, parseInt(query.offset, 10) || 0);

  const conditions = ['(pl.is_deleted IS NOT TRUE)', '(p.deleted_at IS NULL)'];
  const params = [];

  if (!reqUser || reqUser.role !== 'admin') {
    const uid = reqUser ? parseInt(reqUser.id, 10) || 0 : 0;
    const assignedFarmId = reqUser && reqUser.farm_id ? parseInt(reqUser.farm_id, 10) : null;
    const parentUid = reqUser && reqUser.parent_user_id ? parseInt(reqUser.parent_user_id, 10) : null;
    params.push(uid, assignedFarmId, parentUid);
    const pIdx1 = params.length - 2;
    const pIdx2 = params.length - 1;
    const pIdx3 = params.length;
    conditions.push(`(f.user_id = $${pIdx1} OR ($${pIdx2}::int IS NOT NULL AND p.farm_id = $${pIdx2}) OR ($${pIdx3}::int IS NOT NULL AND f.user_id = $${pIdx3}) OR p.assigned_to_user_id = $${pIdx1})`);

    if (reqUser && Array.isArray(reqUser.assigned_plant_ids) && reqUser.assigned_plant_ids.length > 0 && reqUser.sub_role === 'care_worker') {
      params.push(reqUser.assigned_plant_ids.map(Number).filter(n => !isNaN(n)));
      conditions.push(`p.id = ANY($${params.length}::int[])`);
    }
  }

  if (rawFarmId && !isNaN(rawFarmId)) {
    params.push(rawFarmId);
    conditions.push(`p.farm_id = $${params.length}`);
  }
  if (plotId && !isNaN(plotId)) {
    params.push(plotId);
    conditions.push(`p.plot_id = $${params.length}`);
  }
  if (plantId && !isNaN(plantId)) {
    params.push(plantId);
    conditions.push(`pl.plant_id = $${params.length}`);
  }
  if (plantType) {
    params.push(plantType);
    conditions.push(`LOWER(COALESCE(p.plant_type, '')) = LOWER($${params.length})`);
  }
  if (date_from) {
    params.push(date_from);
    conditions.push(`pl.log_date >= $${params.length}::date`);
  }
  if (date_to) {
    params.push(date_to);
    conditions.push(`pl.log_date <= $${params.length}::date`);
  }
  if (logTypes.length > 0) {
    params.push(logTypes);
    conditions.push(`pl.log_type = ANY($${params.length}::text[])`);
  }
  if (searchQ) {
    params.push(`%${searchQ}%`);
    const sIdx = params.length;
    conditions.push(`(p.tree_code ILIKE $${sIdx} OR pl.note ILIKE $${sIdx} OR pl.operator_name ILIKE $${sIdx} OR pl.batch_code ILIKE $${sIdx} OR pl.details::text ILIKE $${sIdx})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT pl.id, pl.plant_id, pl.log_date, pl.log_type, pl.note, pl.details,
           pl.operator_name, pl.equipment_used, pl.batch_code, pl.puc_code,
           pl.is_phi_violation, pl.cost, pl.record_hash, pl.prev_log_hash, pl.is_locked, pl.created_at,
           p.tree_code, p.plant_type, p.plant_variety, p.farm_id, p.plot_id,
           p.phi_until_date as plant_phi_until_date, p.health_status,
           f.name as farm_name, f.puc_code as farm_puc_code, f.vietgap_cert_number,
           fp.plot_code, fp.plot_name,
           u.full_name as creator_name
    FROM plant_logs pl
    JOIN plants p ON p.id = pl.plant_id
    LEFT JOIN farms f ON f.id = p.farm_id
    LEFT JOIN farm_plots fp ON fp.id = p.plot_id
    LEFT JOIN users u ON u.id = pl.created_by
    ${whereClause}
    ORDER BY pl.log_date DESC, pl.id DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const res = await pool.query(sql, [...params, limit, offset]);
  let rows = res.rows || [];

  if (treeCodeFrom || treeCodeTo) {
    rows = rows.filter(r => matchesTreeCodeRange(r.tree_code, treeCodeFrom, treeCodeTo));
  }

  const treeSet = new Set();
  const byLogType = {};
  let phiViolations = 0;
  let hashSealedCount = 0;
  let totalCost = 0;

  const formattedRows = rows.map(r => {
    const d = parseDetailsObj(r.details);
    if (financeRedacted || !includeFinance) {
      delete d.total_cost;
      delete d.cost;
      delete d.unit_price;
      delete d.package_price;
    }

    const rowCost = financeRedacted || !includeFinance
      ? null
      : (parseFloat(r.cost ?? d.total_cost ?? d.cost ?? 0) || 0);
    if (rowCost !== null) totalCost += rowCost;

    const phiUntil = d.phi_until_date || r.plant_phi_until_date || null;
    const isPhiViol = Boolean(r.is_phi_violation || d.is_phi_violation);
    if (isPhiViol) phiViolations++;
    if (r.record_hash) hashSealedCount++;
    if (r.plant_id) treeSet.add(r.plant_id);
    byLogType[r.log_type] = (byLogType[r.log_type] || 0) + 1;

    const logDateStr = r.log_date ? String(r.log_date).slice(0, 10) : '';
    let phiStatusLabel = 'An toàn PHI';
    if (isPhiViol) {
      phiStatusLabel = 'VI PHẠM PHI';
    } else if (phiUntil && logDateStr && logDateStr <= String(phiUntil).slice(0, 10)) {
      phiStatusLabel = 'Đang cách ly';
    }

    return {
      id: r.id,
      plant_id: r.plant_id,
      tree_code: r.tree_code || `#${r.plant_id}`,
      plant_type: r.plant_type || '',
      plant_variety: r.plant_variety || '',
      farm_id: r.farm_id,
      farm_name: r.farm_name || '',
      plot_id: r.plot_id || null,
      plot_code: r.plot_code || null,
      plot_name: r.plot_name || null,
      log_date: logDateStr,
      log_type: r.log_type,
      note: r.note || '',
      details: d,
      material_name: d.supply_name || d.material_name || d.fertilizer_name || d.pesticide_name || d.name || '',
      active_ingredient: d.active_ingredient || null,
      dosage: d.amount !== undefined && d.amount !== null ? `${d.amount} ${d.unit || ''}`.trim() : '',
      phi_days: d.phi_days || 0,
      phi_until_date: phiUntil ? String(phiUntil).slice(0, 10) : null,
      phi_status_label: phiStatusLabel,
      is_phi_violation: isPhiViol,
      operator_name: r.operator_name || r.creator_name || d.performed_by_name || '',
      equipment_used: r.equipment_used || d.equipment_used || null,
      batch_code: r.batch_code || d.batch_code || null,
      puc_code: r.puc_code || r.farm_puc_code || d.puc_code || null,
      vietgap_cert_number: r.vietgap_cert_number || null,
      cost: rowCost,
      record_hash: r.record_hash || null,
      prev_log_hash: r.prev_log_hash || null,
      is_locked: Boolean(r.is_locked || r.record_hash),
      created_at: r.created_at || null
    };
  });

  return {
    rows: formattedRows,
    total_count: formattedRows.length,
    summary: {
      total_logs: formattedRows.length,
      total_trees: treeSet.size,
      phi_violations: phiViolations,
      hash_sealed_count: hashSealedCount,
      total_cost: financeRedacted || !includeFinance ? null : totalCost,
      by_log_type: byLogType,
      date_from,
      date_to,
      period
    },
    filters_applied: {
      farm_id: rawFarmId,
      plot_id: plotId,
      plant_id: plantId,
      plant_type: plantType,
      tree_code_from: treeCodeFrom,
      tree_code_to: treeCodeTo,
      log_types: logTypes,
      date_from,
      date_to,
      period,
      include_finance: includeFinance
    }
  };
}

async function fetchFarmCareLogs(pool, reqUser, farmId, query = {}) {
  const access = await authorizeFarmAccess(pool, reqUser, farmId, false);
  if (!access.ok) {
    return { ok: false, status: access.status, code: access.code, error: access.error };
  }
  const report = await queryIsoCareReport(pool, reqUser, { ...query, farm_id: farmId });
  return {
    ok: true,
    logs: report.rows,
    total_count: report.total_count,
    summary: report.summary
  };
}

module.exports = {
  resolveReportDateRange,
  matchesTreeCodeRange,
  queryIsoCareReport,
  fetchFarmCareLogs
};
