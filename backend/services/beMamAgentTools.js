const weatherService = require('./weatherService');
const { loadKnowledgeBaseCached, rankKnowledgeArticles } = require('./beMamAgentEngine');
const { sanitizeUntrustedDbText, compactToolPayload } = require('./aiAgentSecurity');

const AGENT_TOOL_DECLARATIONS = [
  {
    name: 'get_farm_overview',
    description: 'Lấy tổng quan trang trại từ cơ sở dữ liệu thật (tên vườn, diện tích, số cây, tỷ lệ khỏe/bệnh, mã PUC/VietGAP).',
    parameters: {
      type: 'OBJECT',
      properties: {
        farm_id: {
          type: 'INTEGER',
          description: 'ID trang trại cụ thể (bỏ trống để lấy danh sách các trang trại được phép)'
        }
      }
    }
  },
  {
    name: 'get_plant_dossier',
    description: 'Tra cứu hồ sơ chi tiết 1 cây trồng theo mã cây hoặc ID (giống, tuổi, trạng thái sức khỏe, trạng thái cách ly PHI, nhật ký chăm sóc gần nhất).',
    parameters: {
      type: 'OBJECT',
      properties: {
        farm_id: {
          type: 'INTEGER',
          description: 'ID trang trại chứa cây'
        },
        tree_code: {
          type: 'STRING',
          description: 'Mã cây hoặc số cây (ví dụ: 001, SR-01, TREE-1)'
        }
      },
      required: ['tree_code']
    }
  },
  {
    name: 'get_care_history',
    description: 'Lấy lịch sử nhật ký canh tác thực tế của vườn trong N ngày gần đây (Phun thuốc, Bón phân, Tưới nước, Bệnh cây, Kiểm toán quả, Thu hoạch).',
    parameters: {
      type: 'OBJECT',
      properties: {
        farm_id: {
          type: 'INTEGER',
          description: 'ID trang trại cần xem nhật ký'
        },
        days: {
          type: 'INTEGER',
          description: 'Số ngày gần nhất cần tra cứu (mặc định 14, tối đa 90)'
        },
        log_type: {
          type: 'STRING',
          description: 'Lọc theo loại nhật ký (Phun thuốc, Bón phân, Bệnh cây, Kiểm toán quả, Thu hoạch)'
        }
      }
    }
  },
  {
    name: 'check_supply_inventory',
    description: 'Kiểm tra vật tư phân bón, thuốc BVTV, chế phẩm vi sinh đang còn tồn kho trong vườn để ưu tiên kê đơn đúng thuốc sẵn có.',
    parameters: {
      type: 'OBJECT',
      properties: {
        farm_id: {
          type: 'INTEGER',
          description: 'ID trang trại'
        },
        category: {
          type: 'STRING',
          description: 'Nhóm vật tư (Phân bón, Thuốc BVTV, Vi sinh, Tiền nước, Nhân công)'
        },
        keyword: {
          type: 'STRING',
          description: 'Từ khóa tìm tên hoạt chất hoặc tên vật tư'
        }
      }
    }
  },
  {
    name: 'get_farm_weather_forecast',
    description: 'Lấy dự báo thời tiết theo tọa độ GPS thực tế của trang trại để cảnh báo mưa/gió trước khi phun thuốc hoặc bón phân.',
    parameters: {
      type: 'OBJECT',
      properties: {
        farm_id: {
          type: 'INTEGER',
          description: 'ID trang trại cần kiểm tra thời tiết'
        }
      }
    }
  },
  {
    name: 'calculate_agro_dosage',
    description: 'Tính toán chính xác tổng lượng thuốc BVTV hoặc phân bón cần pha theo số phuy/bình và định mức chuẩn.',
    parameters: {
      type: 'OBJECT',
      properties: {
        rate_amount: { type: 'NUMBER', description: 'Định mức hoạt chất/thuốc cho 1 đơn vị nước chuẩn' },
        rate_unit: { type: 'STRING', description: 'Đơn vị định mức (ml, g, gam, cc, kg, lít)' },
        base_water_liters: { type: 'NUMBER', description: 'Thể tích nước chuẩn tương ứng định mức (vd: 200 hoặc 16)' },
        container_count: { type: 'NUMBER', description: 'Số phuy hoặc bình cần pha' },
        container_volume_liters: { type: 'NUMBER', description: 'Dung tích mỗi phuy hoặc bình (lít)' }
      },
      required: ['rate_amount', 'rate_unit', 'base_water_liters', 'container_count', 'container_volume_liters']
    }
  },
  {
    name: 'search_agronomy_kb',
    description: 'Tra cứu kho tri thức nông học và quy trình VietGAP Tân Bảo để đối chiếu phác đồ, hoạt chất và nguyên tắc cách ly.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Câu hỏi hoặc từ khóa bệnh cây / kỹ thuật canh tác'
        }
      },
      required: ['query']
    }
  }
];

async function runTimedQuery(pool, sql, params = [], timeoutMs = 3000) {
  if (!pool) return { rows: [] };
  const execFn = typeof pool.readQuery === 'function'
    ? pool.readQuery.bind(pool)
    : pool.query.bind(pool);

  let timerId = null;
  try {
    return await Promise.race([
      Promise.resolve(execFn(sql, params)),
      new Promise((_, reject) => {
        timerId = setTimeout(() => reject(new Error('DB_QUERY_TIMEOUT')), timeoutMs);
      })
    ]);
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}

function resolveAuthorizedFarmScope(args = {}, ctx = {}) {
  const isAdmin = Boolean(ctx.isAdmin);
  const allowedList = Array.isArray(ctx.allowedFarmIds)
    ? ctx.allowedFarmIds.map(id => parseInt(id, 10)).filter(Number.isFinite)
    : [];
  const allowedSet = new Set(allowedList);

  const hasArgFarm = args && args.farm_id !== undefined && args.farm_id !== null && String(args.farm_id).trim() !== '';
  if (hasArgFarm) {
    const requestedId = parseInt(args.farm_id, 10);
    if (!Number.isFinite(requestedId) || (!isAdmin && !allowedSet.has(requestedId))) {
      return {
        authorized: false,
        effectiveFarmId: null,
        scopedFarmIds: []
      };
    }
    return {
      authorized: true,
      effectiveFarmId: requestedId,
      scopedFarmIds: [requestedId]
    };
  }

  if (ctx.activeFarmId) {
    const activeId = parseInt(ctx.activeFarmId, 10);
    if (Number.isFinite(activeId)) {
      if (!isAdmin && !allowedSet.has(activeId)) {
        return {
          authorized: false,
          effectiveFarmId: null,
          scopedFarmIds: []
        };
      }
      return {
        authorized: true,
        effectiveFarmId: activeId,
        scopedFarmIds: [activeId]
      };
    }
  }

  if (!isAdmin) {
    return {
      authorized: true,
      effectiveFarmId: allowedList.length === 1 ? allowedList[0] : null,
      scopedFarmIds: allowedList
    };
  }

  return {
    authorized: true,
    effectiveFarmId: null,
    scopedFarmIds: null
  };
}

function stripFinanceFromDetails(rawDetails) {
  if (!rawDetails) return undefined;
  let d = rawDetails;
  if (typeof d === 'string') {
    try {
      d = JSON.parse(d);
    } catch (_) {
      return { note: sanitizeUntrustedDbText(d, 160) };
    }
  }
  if (!d || typeof d !== 'object') return undefined;
  const copy = { ...d };
  delete copy.cost;
  delete copy.total_cost;
  delete copy.batch_total_cost;
  delete copy.unit_price;
  delete copy.package_price;
  if (copy.work_content) copy.work_content = sanitizeUntrustedDbText(copy.work_content, 160);
  if (copy.reason) copy.reason = sanitizeUntrustedDbText(copy.reason, 160);
  return copy;
}

async function executeNativeToolCall(name, args = {}, ctx = {}) {
  try {
    if (name === 'calculate_agro_dosage') {
      const rateAmount = Number(args.rate_amount);
      const baseWaterL = Number(args.base_water_liters);
      const containerCount = Number(args.container_count);
      const containerVolL = Number(args.container_volume_liters);
      const rateUnit = sanitizeUntrustedDbText(args.rate_unit || 'ml', 16);

      if (!Number.isFinite(rateAmount) || rateAmount <= 0 || !Number.isFinite(baseWaterL) || baseWaterL <= 0 ||
          !Number.isFinite(containerCount) || containerCount <= 0 || !Number.isFinite(containerVolL) || containerVolL <= 0) {
        return compactToolPayload({ ok: false, error: 'INVALID_DOSAGE_INPUT', message: 'Tham số định mức hoặc dung tích phải lớn hơn 0.' });
      }

      const totalWaterL = Number((containerCount * containerVolL).toFixed(2));
      const totalChemical = Number(((totalWaterL / baseWaterL) * rateAmount).toFixed(2));
      return compactToolPayload({
        ok: true,
        rate_amount: rateAmount,
        rate_unit: rateUnit,
        base_water_liters: baseWaterL,
        container_count: containerCount,
        container_volume_liters: containerVolL,
        total_water_liters: totalWaterL,
        total_chemical_amount: totalChemical,
        total_chemical_unit: rateUnit
      });
    }

    if (name === 'search_agronomy_kb') {
      const q = sanitizeUntrustedDbText(args.query || '', 300);
      const bundle = ctx.kbBundle || await loadKnowledgeBaseCached(ctx.pool);
      const ranked = rankKnowledgeArticles(q, bundle.articleRows || []);
      return compactToolPayload({
        ok: true,
        matched_synonyms: ranked.matchedSynonyms || [],
        articles: (ranked.topArticles || []).slice(0, 3).map(a => ({
          title: sanitizeUntrustedDbText(a.title, 120),
          category: sanitizeUntrustedDbText(a.category, 60),
          score: a.matchScore,
          content: sanitizeUntrustedDbText(a.content, 500)
        }))
      });
    }

    const scope = resolveAuthorizedFarmScope(args, ctx);
    if (!scope.authorized) {
      return compactToolPayload({
        ok: false,
        error: 'ACCESS_DENIED_CROSS_TENANT',
        message: 'Không có quyền truy cập dữ liệu trang trại này.'
      });
    }

    if (!ctx.isAdmin && Array.isArray(scope.scopedFarmIds) && scope.scopedFarmIds.length === 0) {
      return compactToolPayload({
        ok: true,
        items: [],
        message: 'Tài khoản chưa được gán trang trại nào.'
      });
    }

    const pool = ctx.pool;
    const filterFarmId = scope.effectiveFarmId;
    const allowedIdsParam = scope.scopedFarmIds;

    if (name === 'get_farm_overview') {
      const farmRowsRes = await runTimedQuery(
        pool,
        `SELECT f.id, f.name, f.area, f.puc_code, f.vietgap_cert_number, f.latitude, f.longitude
         FROM farms f
         WHERE COALESCE(f.is_deleted, false) = false
           AND ($1::int IS NULL OR f.id = $1)
           AND ($2::int[] IS NULL OR f.id = ANY($2::int[]))
         ORDER BY f.id ASC
         LIMIT 20`,
        [filterFarmId, allowedIdsParam]
      );
      const plantStatsRes = await runTimedQuery(
        pool,
        `SELECT p.farm_id, p.health_status, p.phi_status, COUNT(*)::int as cnt
         FROM plants p
         WHERE p.deleted_at IS NULL
           AND COALESCE(p.is_deleted, false) = false
           AND ($1::int IS NULL OR p.farm_id = $1)
           AND ($2::int[] IS NULL OR p.farm_id = ANY($2::int[]))
         GROUP BY p.farm_id, p.health_status, p.phi_status`,
        [filterFarmId, allowedIdsParam]
      );

      const statsByFarm = new Map();
      (plantStatsRes.rows || []).forEach(r => {
        const key = Number(r.farm_id);
        if (!statsByFarm.has(key)) {
          statsByFarm.set(key, { total_plants: 0, healthy_plants: 0, sick_plants: 0, quarantine_plants: 0 });
        }
        const entry = statsByFarm.get(key);
        const cnt = Number(r.cnt) || 0;
        entry.total_plants += cnt;
        if (!r.health_status || r.health_status === 'Tốt' || r.health_status === 'Khỏe mạnh') {
          entry.healthy_plants += cnt;
        } else {
          entry.sick_plants += cnt;
        }
        if (r.phi_status === 'quarantine') {
          entry.quarantine_plants += cnt;
        }
      });

      const farms = (farmRowsRes.rows || []).map(f => {
        const st = statsByFarm.get(Number(f.id)) || { total_plants: 0, healthy_plants: 0, sick_plants: 0, quarantine_plants: 0 };
        const areaM2 = Number(f.area) || 0;
        return {
          farm_id: f.id,
          name: sanitizeUntrustedDbText(f.name, 100),
          area_m2: Math.round(areaM2),
          area_ha: Number((areaM2 / 10000).toFixed(3)),
          puc_code: f.puc_code || undefined,
          vietgap_cert: f.vietgap_cert_number || undefined,
          ...st
        };
      });

      return compactToolPayload({ ok: true, farm_count: farms.length, farms });
    }

    if (name === 'get_plant_dossier') {
      const treeCode = sanitizeUntrustedDbText(args.tree_code || '', 60);
      if (!treeCode) {
        return compactToolPayload({ ok: false, error: 'MISSING_TREE_CODE', message: 'Cần cung cấp mã cây để tra cứu.' });
      }
      const plantRes = await runTimedQuery(
        pool,
        `SELECT p.id, p.tree_code, p.farm_id, f.name as farm_name, p.plot_code,
                p.plant_type, p.plant_variety, p.plant_age, p.health_status,
                p.phi_status, p.nfc_uid
         FROM plants p
         LEFT JOIN farms f ON p.farm_id = f.id
         WHERE p.deleted_at IS NULL
           AND COALESCE(p.is_deleted, false) = false
           AND ($1::int IS NULL OR p.farm_id = $1)
           AND ($2::int[] IS NULL OR p.farm_id = ANY($2::int[]))
           AND (
             LOWER(COALESCE(p.tree_code, '')) = LOWER($3)
             OR p.id::text = $3
             OR LOWER(COALESCE(p.tree_code, '')) LIKE LOWER($4)
           )
         ORDER BY p.id ASC
         LIMIT 5`,
        [filterFarmId, allowedIdsParam, treeCode, `%${treeCode}%`]
      );

      const plants = plantRes.rows || [];
      if (plants.length === 0) {
        return compactToolPayload({ ok: true, found: false, message: `Không tìm thấy cây "${treeCode}" trong phạm vi được phép.` });
      }

      const targetPlant = plants[0];
      const logsRes = await runTimedQuery(
        pool,
        `SELECT id, log_date, log_type, note, details
         FROM plant_logs
         WHERE plant_id = $1 AND (is_deleted IS NOT TRUE)
         ORDER BY log_date DESC, created_at DESC
         LIMIT 20`,
        [targetPlant.id]
      );

      return compactToolPayload({
        ok: true,
        found: true,
        plant: {
          plant_id: targetPlant.id,
          tree_code: targetPlant.tree_code,
          farm_id: targetPlant.farm_id,
          farm_name: sanitizeUntrustedDbText(targetPlant.farm_name, 100),
          plot_code: sanitizeUntrustedDbText(targetPlant.plot_code, 60),
          plant_type: sanitizeUntrustedDbText(targetPlant.plant_type, 60),
          plant_variety: sanitizeUntrustedDbText(targetPlant.plant_variety, 60),
          health_status: targetPlant.health_status,
          phi_status: targetPlant.phi_status || 'safe',
          has_nfc: Boolean(targetPlant.nfc_uid)
        },
        recent_logs: (logsRes.rows || []).map(l => ({
          log_date: l.log_date,
          log_type: l.log_type,
          note: sanitizeUntrustedDbText(l.note, 180),
          details: ctx.hideFinance ? stripFinanceFromDetails(l.details) : l.details
        }))
      });
    }

    if (name === 'get_care_history') {
      const rawDays = parseInt(args.days, 10);
      const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(90, rawDays) : 14;
      const logType = args.log_type ? sanitizeUntrustedDbText(args.log_type, 60) : null;

      const logsRes = await runTimedQuery(
        pool,
        `SELECT pl.log_date, pl.log_type, pl.note, pl.details,
                p.tree_code, p.farm_id, p.phi_status, f.name as farm_name
         FROM plant_logs pl
         JOIN plants p ON pl.plant_id = p.id
         LEFT JOIN farms f ON p.farm_id = f.id
         WHERE (pl.is_deleted IS NOT TRUE)
           AND p.deleted_at IS NULL
           AND ($1::int IS NULL OR p.farm_id = $1)
           AND ($2::int[] IS NULL OR p.farm_id = ANY($2::int[]))
           AND ($3::text IS NULL OR LOWER(pl.log_type) LIKE LOWER($3))
           AND pl.log_date >= (CURRENT_DATE - ($4::int || ' days')::interval)
         ORDER BY pl.log_date DESC, pl.created_at DESC
         LIMIT 20`,
        [filterFarmId, allowedIdsParam, logType ? `%${logType}%` : null, days]
      );

      return compactToolPayload({
        ok: true,
        days_window: days,
        count: (logsRes.rows || []).length,
        logs: (logsRes.rows || []).map(l => ({
          log_date: l.log_date,
          log_type: l.log_type,
          tree_code: l.tree_code,
          farm_id: l.farm_id,
          farm_name: sanitizeUntrustedDbText(l.farm_name, 100),
          phi_status: l.phi_status,
          note: sanitizeUntrustedDbText(l.note, 180),
          details: ctx.hideFinance ? stripFinanceFromDetails(l.details) : l.details
        }))
      });
    }

    if (name === 'check_supply_inventory') {
      const cat = args.category ? sanitizeUntrustedDbText(args.category, 60) : null;
      const kw = args.keyword ? sanitizeUntrustedDbText(args.keyword, 80) : null;

      const supRes = await runTimedQuery(
        pool,
        `SELECT s.id, s.name, s.category, s.stock_quantity, s.unit,
                s.unit_price, s.package_price, s.expiry_date, s.farm_id, f.name as farm_name
         FROM supplies s
         LEFT JOIN farms f ON s.farm_id = f.id
         WHERE COALESCE(s.is_deleted, false) = false
           AND ($1::int IS NULL OR s.farm_id = $1)
           AND ($2::int[] IS NULL OR s.farm_id = ANY($2::int[]))
           AND ($3::text IS NULL OR LOWER(s.category) LIKE LOWER($3))
           AND ($4::text IS NULL OR LOWER(s.name) LIKE LOWER($4))
         ORDER BY s.stock_quantity DESC, s.id DESC
         LIMIT 20`,
        [filterFarmId, allowedIdsParam, cat ? `%${cat}%` : null, kw ? `%${kw}%` : null]
      );

      const items = (supRes.rows || []).map(s => {
        const base = {
          supply_id: s.id,
          name: sanitizeUntrustedDbText(s.name, 100),
          category: sanitizeUntrustedDbText(s.category, 60),
          stock_quantity: Number(s.stock_quantity) || 0,
          unit: s.unit || 'đơn vị',
          expiry_date: s.expiry_date || undefined,
          farm_id: s.farm_id,
          farm_name: sanitizeUntrustedDbText(s.farm_name, 100)
        };
        if (ctx.hideFinance) {
          base.finance_redacted = true;
        } else {
          base.unit_price = Number(s.unit_price) || 0;
          base.package_price = Number(s.package_price) || 0;
        }
        return base;
      });

      return compactToolPayload({ ok: true, count: items.length, supplies: items });
    }

    if (name === 'get_farm_weather_forecast') {
      const farmRes = await runTimedQuery(
        pool,
        `SELECT id, name, latitude, longitude
         FROM farms
         WHERE COALESCE(is_deleted, false) = false
           AND ($1::int IS NULL OR id = $1)
           AND ($2::int[] IS NULL OR id = ANY($2::int[]))
         ORDER BY id ASC
         LIMIT 1`,
        [filterFarmId, allowedIdsParam]
      );
      const farm = (farmRes.rows || [])[0];
      const lat = farm && farm.latitude ? Number(farm.latitude) : 10.2415;
      const lng = farm && farm.longitude ? Number(farm.longitude) : 106.3752;
      const locationName = farm ? sanitizeUntrustedDbText(farm.name, 100) : 'Vùng nông nghiệp';

      let weatherData = null;
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 3500);
        try {
          const url = weatherService.buildOpenMeteoUrl(lat, lng);
          const resp = await fetch(url, { signal: controller.signal });
          if (resp && resp.ok) {
            const rawJson = await resp.json();
            weatherData = weatherService.parseMeteoResponse(rawJson, locationName);
          }
        } finally {
          clearTimeout(tid);
        }
      } catch (_) {}

      if (!weatherData) {
        weatherData = weatherService.getFallbackWeather(lat, lng, locationName);
      }

      return compactToolPayload({
        ok: true,
        farm_id: farm ? farm.id : filterFarmId,
        location: weatherData.location,
        is_fallback: Boolean(weatherData.isFallback),
        metrics: {
          temp: weatherData.metrics?.temp,
          humidity: weatherData.metrics?.humidity,
          windSpeed: weatherData.metrics?.windSpeed,
          rainProb: weatherData.metrics?.rainProb,
          condition: weatherData.metrics?.wmo?.label
        },
        agro: weatherData.agro
      });
    }

    return compactToolPayload({ ok: false, error: 'UNKNOWN_TOOL', message: `Công cụ "${name}" không được hỗ trợ.` });
  } catch (err) {
    return compactToolPayload({ ok: false, error: 'TOOL_EXECUTION_ERROR', message: err.message });
  }
}

async function executeToolCallsParallel(calls = [], ctx = {}) {
  if (!Array.isArray(calls) || calls.length === 0) return [];
  const uniqueMap = new Map();

  for (const call of calls) {
    if (!call || !call.name) continue;
    const args = call.args && typeof call.args === 'object' ? call.args : {};
    const dedupeKey = `${call.name}:${JSON.stringify(args)}`;
    if (!uniqueMap.has(dedupeKey)) {
      uniqueMap.set(dedupeKey, { name: call.name, args });
    }
  }

  const dedupeEntries = Array.from(uniqueMap.entries());
  const executed = await Promise.all(
    dedupeEntries.map(async ([dedupeKey, spec]) => {
      const response = await executeNativeToolCall(spec.name, spec.args, ctx);
      return [dedupeKey, response];
    })
  );
  const responseByKey = new Map(executed);

  return calls
    .filter(c => c && c.name)
    .map(c => {
      const args = c.args && typeof c.args === 'object' ? c.args : {};
      const dedupeKey = `${c.name}:${JSON.stringify(args)}`;
      return {
        name: c.name,
        args,
        response: responseByKey.get(dedupeKey)
      };
    });
}

module.exports = {
  AGENT_TOOL_DECLARATIONS,
  executeNativeToolCall,
  executeToolCallsParallel,
  resolveAuthorizedFarmScope
};
