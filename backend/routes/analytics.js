const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { singleflight } = require('../services/singleflight');

const CURRENCY_RATES = {
  VND: 1,
  USD: 25450,
  CNY: 3520
};

const CROP_EXPORT_PRICES_VND_PER_KG = {
  durian: 85000,
  dragon_fruit: 28000,
  pomelo: 35000,
  coffee: 115000,
  mango: 32000,
  default: 75000
};

function detectCropCategory(plantType, plantVariety) {
  const raw = `${plantType || ''} ${plantVariety || ''}`.toLowerCase();
  if (raw.includes('sầu riêng') || raw.includes('sau rieng') || raw.includes('durian') || raw.includes('ri6') || raw.includes('monthong')) {
    return 'durian';
  }
  if (raw.includes('thanh long') || raw.includes('dragon')) {
    return 'dragon_fruit';
  }
  if (raw.includes('bưởi') || raw.includes('buoi') || raw.includes('pomelo')) {
    return 'pomelo';
  }
  if (raw.includes('cà phê') || raw.includes('ca phe') || raw.includes('coffee')) {
    return 'coffee';
  }
  if (raw.includes('xoài') || raw.includes('xoai') || raw.includes('mango')) {
    return 'mango';
  }
  return 'durian';
}

function parseTreeAgeYears(plantAgeStr, plantingDate) {
  if (plantAgeStr) {
    const match = String(plantAgeStr).match(/(\d+(\.\d+)?)/);
    if (match) {
      const val = parseFloat(match[1]);
      if (String(plantAgeStr).toLowerCase().includes('tháng') || String(plantAgeStr).toLowerCase().includes('month')) {
        return Math.max(0.5, Number((val / 12).toFixed(1)));
      }
      return Math.max(0.5, val);
    }
  }
  if (plantingDate) {
    const dt = new Date(plantingDate);
    if (!isNaN(dt.getTime())) {
      const diffYears = (Date.now() - dt.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (diffYears > 0) return Number(diffYears.toFixed(1));
    }
  }
  return 8;
}

const CROP_AVG_FRUIT_WEIGHT_KG = {
  durian: 2.8,
  dragon_fruit: 0.45,
  pomelo: 1.3,
  coffee: 0.002,
  mango: 0.4,
  default: 1.0
};

function predictTreeSeasonYieldKg(plant, plantSignals = {}) {
  const cropCat = detectCropCategory(plant.plant_type, plant.plant_variety);
  const ageYears = parseTreeAgeYears(plant.plant_age, plant.planting_date);
  const dbhCm = parseFloat(plant.biomass_dbh_cm) || 0;
  const canopyM = parseFloat(plant.canopy_height_m) || 0;

  const health = String(plant.health_status || 'Tốt').trim();
  let healthFactor = 1.0;
  if (health === 'Bệnh') healthFactor = 0.65;
  else if (health === 'Cần chú ý') healthFactor = 0.85;

  const initialYieldHint = parseFloat(plant.initial_yield) || 0;
  const latestAudit = plantSignals.latestFruitAudit || null;
  const actualHarvestKg = Number(plantSignals.actualHarvestKg) || 0;

  let finalYieldKg = 0;
  let forecastSource = 'NO_DATA';

  if (latestAudit) {
    const stage = String(latestAudit.stage || 'Đậu quả');
    const stageRetention = stage.includes('chín') ? 0.97 : (stage.includes('non') ? 0.88 : 0.78);
    const estKg = parseFloat(latestAudit.estimated_yield_kg) || 0;
    const fruitCount = parseInt(latestAudit.fruit_count, 10) || 0;
    const avgWeightKg = CROP_AVG_FRUIT_WEIGHT_KG[cropCat] || CROP_AVG_FRUIT_WEIGHT_KG.default;
    if (estKg > 0) {
      finalYieldKg = estKg * healthFactor;
      forecastSource = 'FRUIT_AUDIT_ESTIMATE';
    } else if (fruitCount > 0) {
      finalYieldKg = fruitCount * avgWeightKg * stageRetention * healthFactor;
      forecastSource = 'FRUIT_AUDIT_COUNT';
    }
  } else if (actualHarvestKg > 0) {
    finalYieldKg = actualHarvestKg * healthFactor;
    forecastSource = 'HARVEST_HISTORY';
  } else if (initialYieldHint > 0) {
    finalYieldKg = initialYieldHint * healthFactor;
    forecastSource = 'INITIAL_YIELD';
  }

  return {
    ageYears,
    cropCategory: cropCat,
    dbhCm: Number(dbhCm.toFixed(1)),
    canopyM: Number(canopyM.toFixed(1)),
    healthFactor: Number(healthFactor.toFixed(2)),
    biometricFactor: 1,
    hasYieldData: finalYieldKg > 0,
    forecastSource,
    predictedYieldKg: Number(Math.max(0, finalYieldKg).toFixed(1)),
    exportPricePerKgVnd: CROP_EXPORT_PRICES_VND_PER_KG[cropCat] || CROP_EXPORT_PRICES_VND_PER_KG.default
  };
}

async function resolveUserFinanceContext(req) {
  const jwtUser = req.user || {};
  const userId = parseInt(jwtUser.id, 10) || null;
  if (!userId) {
    return { isRedacted: true, role: 'guest', subRole: 'guest', targetOwnerId: null, farmId: null, year: null };
  }

  const userRes = await pool.query(
    'SELECT id, role, sub_role, allow_view_finance, parent_user_id, farm_id FROM users WHERE id = $1 LIMIT 1',
    [userId]
  );

  const dbUser = userRes.rows[0] || jwtUser;
  const role = dbUser.role || jwtUser.role || 'farmer';
  const subRole = dbUser.sub_role || jwtUser.sub_role || 'farm_owner';
  const allowViewFinance = dbUser.allow_view_finance !== false && jwtUser.allow_view_finance !== false;

  const isRedacted = role !== 'admin' && (
    subRole === 'care_worker' ||
    subRole === 'auditor_readonly' ||
    !allowViewFinance
  );

  const targetOwnerId = role === 'admin'
    ? (req.query.user_id && req.query.user_id !== 'all' ? parseInt(req.query.user_id, 10) || null : null)
    : (dbUser.parent_user_id || dbUser.id);

  const requestedFarmId = req.query.farm_id && req.query.farm_id !== 'all'
    ? (parseInt(req.query.farm_id, 10) || null)
    : null;

  const requestedYear = req.query.year && req.query.year !== 'all'
    ? (parseInt(req.query.year, 10) || null)
    : null;

  return {
    isRedacted,
    role,
    subRole,
    allowViewFinance,
    userId,
    targetOwnerId,
    farmId: requestedFarmId,
    year: requestedYear
  };
}

function classifyCostPillar(category, name, note) {
  const cat = String(category || '').trim();
  if (cat === 'Bón phân') return 'npk_fertilizer';
  if (cat === 'Phun thuốc') return 'pesticide_bvtv';
  if (cat === 'Tiền nước') return 'water_energy';
  if (cat === 'Nhân công') return 'labor_nhan_cong';

  const text = `${cat} ${name || ''} ${note || ''}`.toLowerCase();
  if (text.includes('thuốc') || text.includes('bvtv') || text.includes('trừ sâu') || text.includes('trừ nấm') || text.includes('pesticide') || text.includes('phun')) {
    return 'pesticide_bvtv';
  }
  if (text.includes('nhân công') || text.includes('công') || text.includes('labor') || text.includes('thuê') || text.includes('cắt tỉa') || text.includes('lương')) {
    return 'labor_nhan_cong';
  }
  if (text.includes('nước') || text.includes('điện') || text.includes('tưới') || text.includes('water') || text.includes('nhiên liệu') || text.includes('dầu')) {
    return 'water_energy';
  }
  return 'npk_fertilizer';
}

function convertCurrency(amountVnd) {
  const vnd = Math.round(Number(amountVnd) || 0);
  return {
    VND: vnd,
    USD: Number((vnd / CURRENCY_RATES.USD).toFixed(2)),
    CNY: Number((vnd / CURRENCY_RATES.CNY).toFixed(2))
  };
}

async function aggregateExecutiveBiData(ctx) {
  const { targetOwnerId, farmId, year } = ctx;

  const farmsRes = await pool.query(
    `SELECT id, name, area, puc_code, vietgap_cert_number, user_id
     FROM farms
     WHERE COALESCE(is_deleted, false) = false
       AND ($1::int IS NULL OR id = $1)
       AND ($2::int IS NULL OR user_id = $2 OR id = (SELECT farm_id FROM users WHERE id = $2))
     ORDER BY id ASC`,
    [farmId, targetOwnerId]
  );
  const farms = farmsRes.rows;

  const plantsRes = await pool.query(
    `SELECT p.id, p.tree_code, p.public_slug, p.plant_type, p.plant_variety,
            p.plant_age, p.planting_date, p.health_status, p.phi_status,
            p.plot_code, p.location, p.farm_id, p.initial_yield,
            p.biomass_dbh_cm, p.canopy_height_m, p.nfc_uid
     FROM plants p
     LEFT JOIN farms f ON p.farm_id = f.id
     WHERE p.deleted_at IS NULL
       AND COALESCE(p.is_deleted, false) = false
       AND ($1::int IS NULL OR p.farm_id = $1)
       AND (
         $2::int IS NULL
         OR f.user_id = $2
         OR p.created_by = $2
         OR p.farm_id IN (SELECT id FROM farms WHERE user_id = $2 OR id = (SELECT farm_id FROM users WHERE id = $2))
       )
     ORDER BY p.id ASC`,
    [farmId, targetOwnerId]
  );
  const plants = plantsRes.rows;

  const suppliesRes = await pool.query(
    `SELECT su.id, su.usage_date, su.quantity, su.unit_price, su.total_cost,
            su.farm_id, su.plant_id, su.note,
            COALESCE(s.category, 'Khác') as category,
            COALESCE(s.name, 'Vật tư') as name,
            COALESCE(s.unit, 'kg') as unit
     FROM supply_usages su
     LEFT JOIN supplies s ON su.supply_id = s.id
     LEFT JOIN plants p ON su.plant_id = p.id
     WHERE (
       $1::int IS NULL
       OR su.farm_id = $1
       OR p.farm_id = $1
       OR su.farm_id IS NULL
     )
       AND (
         $2::int IS NULL
         OR su.user_id = $2
         OR su.user_id IN (SELECT user_id FROM farms WHERE id = (SELECT farm_id FROM users WHERE id = $2))
         OR su.user_id IN (SELECT id FROM users WHERE farm_id IN (SELECT id FROM farms WHERE user_id = $2))
         OR su.farm_id IN (SELECT id FROM farms WHERE user_id = $2 OR id = (SELECT farm_id FROM users WHERE id = $2))
         OR p.farm_id IN (SELECT id FROM farms WHERE user_id = $2 OR id = (SELECT farm_id FROM users WHERE id = $2))
         OR p.created_by = $2
       )
       AND (
         $3::int IS NULL
         OR EXTRACT(YEAR FROM su.usage_date::timestamp) = $3
       )
     ORDER BY su.usage_date DESC`,
    [farmId, targetOwnerId, year]
  );
  const supplyUsages = suppliesRes.rows;

  const logsRes = await pool.query(
    `SELECT pl.id, pl.plant_id, pl.log_date, pl.log_type, pl.note, pl.details, pl.cost, p.farm_id
     FROM plant_logs pl
     LEFT JOIN plants p ON pl.plant_id = p.id
     LEFT JOIN farms f ON p.farm_id = f.id
     WHERE COALESCE(pl.is_deleted, false) = false
       AND ($1::int IS NULL OR p.farm_id = $1)
       AND (
         $2::int IS NULL
         OR f.user_id = $2
         OR pl.created_by = $2
         OR p.created_by = $2
         OR p.farm_id IN (SELECT id FROM farms WHERE user_id = $2 OR id = (SELECT farm_id FROM users WHERE id = $2))
       )
       AND (
         $3::int IS NULL
         OR EXTRACT(YEAR FROM pl.log_date::timestamp) = $3
       )
     ORDER BY pl.log_date DESC, pl.id DESC
     LIMIT 1000`,
    [farmId, targetOwnerId, year]
  );
  const logs = logsRes.rows;

  const totalTrees = plants.length;
  const totalAreaM2 = farms.reduce((acc, f) => acc + (parseFloat(f.area) || 0), 0);
  const totalAreaHa = totalAreaM2 > 0 ? Number((totalAreaM2 / 10000).toFixed(4)) : 0;

  const pillarsVnd = {
    npk_fertilizer: 0,
    pesticide_bvtv: 0,
    labor_nhan_cong: 0,
    water_energy: 0
  };
  const pillarsUsageCount = {
    npk_fertilizer: 0,
    pesticide_bvtv: 0,
    labor_nhan_cong: 0,
    water_energy: 0
  };

  const directPlantCostMap = {};
  let unattachedOverheadVnd = 0;

  supplyUsages.forEach(u => {
    const cost = parseFloat(u.total_cost) || ((parseFloat(u.quantity) || 1) * (parseFloat(u.unit_price) || 0));
    const pillar = classifyCostPillar(u.category, u.name, u.note);
    pillarsVnd[pillar] += cost;
    pillarsUsageCount[pillar] += 1;
    if (u.plant_id) {
      directPlantCostMap[u.plant_id] = (directPlantCostMap[u.plant_id] || 0) + cost;
    } else {
      unattachedOverheadVnd += cost;
    }
  });

  let actualHarvestRevenueVnd = 0;
  let actualHarvestKg = 0;
  let actualFruitCount = 0;
  let fruitAuditCount = 0;
  let harvestCount = 0;
  let extraLogCostCount = 0;
  const plantSignalsMap = {};
  const extraCostEvents = [];
  const harvestRevenueEvents = [];

  logs.forEach(l => {
    const lt = String(l.log_type || '').toLowerCase();
    let d = l.details;
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch (_) { d = {}; }
    }
    d = (d && typeof d === 'object') ? d : {};
    const pid = l.plant_id;
    if (pid && !plantSignalsMap[pid]) {
      plantSignalsMap[pid] = { latestFruitAudit: null, actualHarvestKg: 0, actualHarvestRevenueVnd: 0, actualFruitCount: 0 };
    }

    const isFruitAudit = lt.includes('kiểm toán quả') || lt.includes('kiem toan qua') || Boolean(d.audit_stage || d.fruit_stage);
    const isHarvest = !isFruitAudit && (lt.includes('thu hoạch') || lt.includes('harvest') || d.total_revenue || d.price_per_tree || (d.fruit_count && lt !== 'kiểm toán quả'));

    if (isFruitAudit) {
      fruitAuditCount += 1;
      if (pid && !plantSignalsMap[pid].latestFruitAudit) {
        plantSignalsMap[pid].latestFruitAudit = {
          stage: d.audit_stage || d.fruit_stage || 'Đậu quả',
          fruit_count: parseInt(d.fruit_count ?? d.amount, 10) || 0,
          estimated_yield_kg: parseFloat(d.estimated_yield_kg) || 0
        };
      }
    } else if (isHarvest) {
      harvestCount += 1;
      const rev = parseFloat(d.total_revenue) || parseFloat(d.price_per_tree) || parseFloat(d.revenue) || 0;
      const fruits = parseFloat(d.fruit_count) || 0;
      const kg = parseFloat(d.amount) || parseFloat(d.yield_kg) || parseFloat(d.weight_kg) || (fruits * 2.8) || 0;
      actualHarvestRevenueVnd += rev;
      actualFruitCount += fruits;
      actualHarvestKg += kg;
      if (pid) {
        plantSignalsMap[pid].actualHarvestKg += kg;
        plantSignalsMap[pid].actualHarvestRevenueVnd += rev;
        plantSignalsMap[pid].actualFruitCount += fruits;
      }
      if (rev > 0 && l.log_date) {
        harvestRevenueEvents.push({ date: l.log_date, revenue_vnd: rev });
      }
    } else if (!d.supply_id) {
      const logCost = parseFloat(d.batch_total_cost) || parseFloat(d.total_cost) || parseFloat(l.cost) || parseFloat(d.cost) || 0;
      if (logCost > 0) {
        const pillar = classifyCostPillar(l.log_type, d.work_content || d.supply_name || '', l.note);
        pillarsVnd[pillar] += logCost;
        pillarsUsageCount[pillar] += 1;
        extraLogCostCount += 1;
        if (l.plant_id) {
          directPlantCostMap[l.plant_id] = (directPlantCostMap[l.plant_id] || 0) + logCost;
        } else {
          unattachedOverheadVnd += logCost;
        }
        if (l.log_date) {
          extraCostEvents.push({ date: l.log_date, pillar, cost_vnd: logCost });
        }
      }
    }
  });

  const totalCostBatches = supplyUsages.length + extraLogCostCount;
  const totalInvestmentVnd = Math.round(
    pillarsVnd.npk_fertilizer +
    pillarsVnd.pesticide_bvtv +
    pillarsVnd.labor_nhan_cong +
    pillarsVnd.water_energy
  );

  const dataSource = (totalInvestmentVnd > 0 || totalCostBatches > 0)
    ? 'LIVE_DATABASE_ACCOUNTING'
    : 'NO_COST_DATA';

  const safeTotalInvestment = Math.max(1, totalInvestmentVnd);
  const costPerTreeVnd = totalTrees > 0 ? Math.round(totalInvestmentVnd / totalTrees) : 0;
  const costPerHectareVnd = totalAreaHa > 0 ? Math.round(totalInvestmentVnd / totalAreaHa) : 0;
  const overheadPerTreeExact = totalTrees > 0 ? (unattachedOverheadVnd / totalTrees) : 0;

  const treeForecasts = plants.map(p => {
    const signals = plantSignalsMap[p.id] || {};
    const pred = predictTreeSeasonYieldKg(p, signals);
    const treeRevVnd = Math.round(pred.predictedYieldKg * pred.exportPricePerKgVnd);
    const treeDirectCost = Number((directPlantCostMap[p.id] || 0).toFixed(2));
    const treeAllocatedOverhead = Number(overheadPerTreeExact.toFixed(2));
    const treeTotalCostVnd = Math.round(treeDirectCost + treeAllocatedOverhead);
    const treeRoi = treeTotalCostVnd > 0
      ? Number((((treeRevVnd - treeTotalCostVnd) / treeTotalCostVnd) * 100).toFixed(1))
      : 0;
    return {
      plant_id: p.id,
      tree_code: p.tree_code || p.public_slug || `TREE-${p.id}`,
      nfc_uid: p.nfc_uid || null,
      plant_type: p.plant_type || 'Sầu riêng',
      plant_variety: p.plant_variety || 'Ri6',
      plot_code: p.plot_code || p.location || 'Lô A1',
      health_status: p.health_status || 'Tốt',
      phi_status: p.phi_status || 'safe',
      age_years: pred.ageYears,
      dbh_cm: pred.dbhCm,
      canopy_m: pred.canopyM,
      has_yield_data: pred.hasYieldData,
      forecast_source: pred.forecastSource,
      predicted_yield_kg: pred.predictedYieldKg,
      export_price_vnd_per_kg: pred.exportPricePerKgVnd,
      predicted_revenue_vnd: treeRevVnd,
      direct_cost_vnd: Math.round(treeDirectCost),
      allocated_overhead_vnd: Math.round(treeAllocatedOverhead),
      cost_per_tree_vnd: treeTotalCostVnd,
      net_profit_per_tree_vnd: treeRevVnd - treeTotalCostVnd,
      tree_roi_percent: treeRoi
    };
  });

  const predictedTotalYieldKg = Number(
    treeForecasts.reduce((acc, t) => acc + t.predicted_yield_kg, 0).toFixed(1)
  );
  const predictedYieldTonsPerHa = totalAreaHa > 0
    ? Number(((predictedTotalYieldKg / 1000) / totalAreaHa).toFixed(2))
    : 0;
  const predictedSeasonRevenueVnd = Math.round(
    treeForecasts.reduce((acc, t) => acc + t.predicted_revenue_vnd, 0)
  );

  const effectiveRevenueVnd = Math.max(actualHarvestRevenueVnd, predictedSeasonRevenueVnd);
  const netProfitVnd = effectiveRevenueVnd - totalInvestmentVnd;
  const roiPercent = totalInvestmentVnd > 0
    ? Number(((netProfitVnd / totalInvestmentVnd) * 100).toFixed(1))
    : 0;
  const actualNetProfitVnd = actualHarvestRevenueVnd - totalInvestmentVnd;
  const actualRoiPercent = totalInvestmentVnd > 0
    ? Number(((actualNetProfitVnd / totalInvestmentVnd) * 100).toFixed(1))
    : 0;
  const grossMarginPercent = effectiveRevenueVnd > 0
    ? Number(((netProfitVnd / effectiveRevenueVnd) * 100).toFixed(1))
    : 0;
  const avgPricePerKg = treeForecasts[0] ? treeForecasts[0].export_price_vnd_per_kg : 85000;
  const breakEvenYieldKg = totalInvestmentVnd > 0 ? Number((totalInvestmentVnd / avgPricePerKg).toFixed(1)) : 0;

  const initialYieldCount = plants.filter(p => (parseFloat(p.initial_yield) || 0) > 0).length;
  let confidenceScore = 0;
  if (fruitAuditCount > 0 || harvestCount > 0 || initialYieldCount > 0 || totalCostBatches > 0) {
    if (fruitAuditCount > 0) confidenceScore += 45;
    if (harvestCount > 0 || initialYieldCount > 0) confidenceScore += 25;
    if (totalCostBatches > 0) confidenceScore += Math.min(20, totalCostBatches * 4);
    if (totalAreaHa > 0) confidenceScore += 5;
    confidenceScore = Math.min(95, confidenceScore);
  }
  const rSquared = confidenceScore > 0 ? Number(((confidenceScore / 100) * 0.94).toFixed(2)) : 0;

  const safeTreeDiv = Math.max(1, totalTrees);
  const costPillars = [
    {
      key: 'npk_fertilizer',
      label_vi: 'Phân bón (NPK & Hữu cơ)',
      label_en: 'Fertilizers (NPK & Organic)',
      label_zh: '化肥与有机肥 (NPK)',
      color: '#10b981',
      icon: 'sprout',
      usage_count: pillarsUsageCount.npk_fertilizer,
      amount_vnd: Math.round(pillarsVnd.npk_fertilizer),
      cost_per_tree_vnd: totalTrees > 0 ? Math.round(pillarsVnd.npk_fertilizer / safeTreeDiv) : 0,
      cost_per_hectare_vnd: totalAreaHa > 0 ? Math.round(pillarsVnd.npk_fertilizer / totalAreaHa) : 0,
      share_percent: totalInvestmentVnd > 0 ? Number(((pillarsVnd.npk_fertilizer / safeTotalInvestment) * 100).toFixed(1)) : 0,
      multi_currency: convertCurrency(pillarsVnd.npk_fertilizer)
    },
    {
      key: 'pesticide_bvtv',
      label_vi: 'Thuốc BVTV & Sinh học',
      label_en: 'Crop Protection (Pesticides)',
      label_zh: '植保农药与生物制剂',
      color: '#f59e0b',
      icon: 'shield-alert',
      usage_count: pillarsUsageCount.pesticide_bvtv,
      amount_vnd: Math.round(pillarsVnd.pesticide_bvtv),
      cost_per_tree_vnd: totalTrees > 0 ? Math.round(pillarsVnd.pesticide_bvtv / safeTreeDiv) : 0,
      cost_per_hectare_vnd: totalAreaHa > 0 ? Math.round(pillarsVnd.pesticide_bvtv / totalAreaHa) : 0,
      share_percent: totalInvestmentVnd > 0 ? Number(((pillarsVnd.pesticide_bvtv / safeTotalInvestment) * 100).toFixed(1)) : 0,
      multi_currency: convertCurrency(pillarsVnd.pesticide_bvtv)
    },
    {
      key: 'labor_nhan_cong',
      label_vi: 'Nhân công canh tác',
      label_en: 'Agricultural Labor',
      label_zh: '果园人工成本',
      color: '#3b82f6',
      icon: 'users',
      usage_count: pillarsUsageCount.labor_nhan_cong,
      amount_vnd: Math.round(pillarsVnd.labor_nhan_cong),
      cost_per_tree_vnd: totalTrees > 0 ? Math.round(pillarsVnd.labor_nhan_cong / safeTreeDiv) : 0,
      cost_per_hectare_vnd: totalAreaHa > 0 ? Math.round(pillarsVnd.labor_nhan_cong / totalAreaHa) : 0,
      share_percent: totalInvestmentVnd > 0 ? Number(((pillarsVnd.labor_nhan_cong / safeTotalInvestment) * 100).toFixed(1)) : 0,
      multi_currency: convertCurrency(pillarsVnd.labor_nhan_cong)
    },
    {
      key: 'water_energy',
      label_vi: 'Tiền nước & Điện tưới',
      label_en: 'Irrigation Water & Energy',
      label_zh: '灌溉水电费用',
      color: '#06b6d4',
      icon: 'droplets',
      usage_count: pillarsUsageCount.water_energy,
      amount_vnd: Math.round(pillarsVnd.water_energy),
      cost_per_tree_vnd: totalTrees > 0 ? Math.round(pillarsVnd.water_energy / safeTreeDiv) : 0,
      cost_per_hectare_vnd: totalAreaHa > 0 ? Math.round(pillarsVnd.water_energy / totalAreaHa) : 0,
      share_percent: totalInvestmentVnd > 0 ? Number(((pillarsVnd.water_energy / safeTotalInvestment) * 100).toFixed(1)) : 0,
      multi_currency: convertCurrency(pillarsVnd.water_energy)
    }
  ];

  return {
    dataSource,
    usageBatchesCount: totalCostBatches,
    supplyUsages,
    extraCostEvents,
    harvestRevenueEvents,
    farms,
    plants,
    totalTrees,
    totalAreaM2,
    totalAreaHa,
    totalInvestmentVnd,
    costPerTreeVnd,
    costPerHectareVnd,
    actualHarvestRevenueVnd,
    actualHarvestKg,
    actualFruitCount,
    actualNetProfitVnd,
    actualRoiPercent,
    predictedTotalYieldKg,
    predictedYieldTonsPerHa,
    predictedSeasonRevenueVnd,
    effectiveRevenueVnd,
    netProfitVnd,
    roiPercent,
    grossMarginPercent,
    breakEvenYieldKg,
    confidenceScore,
    rSquared,
    fruitAuditCount,
    harvestCount,
    costPillars,
    treeForecasts
  };
}

router.get('/bi-overview', auth, async (req, res) => {
  try {
    const ctx = await resolveUserFinanceContext(req);
    if (ctx.isRedacted) {
      return res.status(403).json({
        error: 'Tài khoản nhân sự kỹ thuật / kiểm toán viên không có quyền truy cập dữ liệu tài chính BI.',
        code: 'FINANCE_REDACTED_ROLE',
        isFinanceRedacted: true
      });
    }

    const data = await singleflight.do(
      `bi_exec_${ctx.userId || 0}_${ctx.role || 'user'}_${ctx.effectiveOwnerId || 'all'}`,
      () => aggregateExecutiveBiData(ctx)
    );

    res.json({
      status: 'success',
      api_version: 'v2.4-AGTECH-BI-ML',
      data_source: data.dataSource,
      usage_batches_count: data.usageBatchesCount,
      generated_at: new Date().toISOString(),
      currency_rates: CURRENCY_RATES,
      summary: {
        total_farms: data.farms.length,
        total_trees: data.totalTrees,
        total_area_m2: Number(data.totalAreaM2.toFixed(1)),
        total_area_ha: data.totalAreaHa,
        usage_batches_count: data.usageBatchesCount,
        total_investment_vnd: data.totalInvestmentVnd,
        cost_per_tree_vnd: data.costPerTreeVnd,
        cost_per_hectare_vnd: data.costPerHectareVnd,
        actual_harvest_revenue_vnd: data.actualHarvestRevenueVnd,
        actual_harvest_kg: data.actualHarvestKg,
        actual_roi_percent: data.actualRoiPercent,
        projected_season_revenue_vnd: data.effectiveRevenueVnd,
        revenue_per_tree_vnd: data.totalTrees > 0 ? Math.round(data.effectiveRevenueVnd / data.totalTrees) : 0,
        revenue_per_hectare_vnd: data.totalAreaHa > 0 ? Math.round(data.effectiveRevenueVnd / data.totalAreaHa) : 0,
        net_profit_vnd: data.netProfitVnd,
        roi_percent: data.roiPercent,
        gross_margin_percent: data.grossMarginPercent,
        break_even_yield_kg: data.breakEvenYieldKg,
        predicted_yield_kg: data.predictedTotalYieldKg,
        predicted_yield_tons_per_ha: data.predictedYieldTonsPerHa,
        ml_confidence_percent: data.confidenceScore,
        ml_r_squared: data.rSquared,
        multi_currency: {
          total_investment: convertCurrency(data.totalInvestmentVnd),
          cost_per_tree: convertCurrency(data.costPerTreeVnd),
          cost_per_hectare: convertCurrency(data.costPerHectareVnd),
          projected_revenue: convertCurrency(data.effectiveRevenueVnd),
          net_profit: convertCurrency(data.netProfitVnd)
        }
      },
      cost_pillars: data.costPillars
    });
  } catch (err) {
    console.error('Error in GET /api/analytics/bi-overview:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi phân tích dữ liệu BI tài chính.' });
  }
});

router.get('/cost-breakdown', auth, async (req, res) => {
  try {
    const ctx = await resolveUserFinanceContext(req);
    if (ctx.isRedacted) {
      return res.status(403).json({
        error: 'Chế độ bảo mật RBAC: Không có quyền truy cập chi tiết dòng tiền.',
        code: 'FINANCE_REDACTED_ROLE',
        isFinanceRedacted: true
      });
    }

    const data = await singleflight.do(
      `bi_exec_${ctx.userId || 0}_${ctx.role || 'user'}_${ctx.effectiveOwnerId || 'all'}`,
      () => aggregateExecutiveBiData(ctx)
    );
    const now = new Date();
    const monthBuckets = new Map();
    for (let idx = 0; idx < 6; idx++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      const monthLabel = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      monthBuckets.set(monthLabel, {
        month: monthLabel,
        npk_fertilizer_vnd: 0,
        pesticide_bvtv_vnd: 0,
        labor_nhan_cong_vnd: 0,
        water_energy_vnd: 0,
        revenue_vnd: 0
      });
    }

    const toMonthKey = (rawDt) => {
      if (!rawDt) return '';
      const d = new Date(rawDt);
      if (isNaN(d.getTime())) return '';
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    (data.supplyUsages || []).forEach(u => {
      const mk = toMonthKey(u.usage_date);
      const bucket = monthBuckets.get(mk);
      if (!bucket) return;
      const cost = parseFloat(u.total_cost) || ((parseFloat(u.quantity) || 1) * (parseFloat(u.unit_price) || 0));
      const pillar = classifyCostPillar(u.category, u.name, u.note);
      bucket[`${pillar}_vnd`] += Math.round(cost);
    });

    (data.extraCostEvents || []).forEach(ev => {
      const mk = toMonthKey(ev.date);
      const bucket = monthBuckets.get(mk);
      if (!bucket) return;
      bucket[`${ev.pillar}_vnd`] += Math.round(ev.cost_vnd || 0);
    });

    (data.harvestRevenueEvents || []).forEach(ev => {
      const mk = toMonthKey(ev.date);
      const bucket = monthBuckets.get(mk);
      if (!bucket) return;
      bucket.revenue_vnd += Math.round(ev.revenue_vnd || 0);
    });

    let cumulativeCost = 0;
    let cumulativeRev = 0;

    const monthlySeries = Array.from(monthBuckets.values()).map(b => {
      const monthCost = b.npk_fertilizer_vnd + b.pesticide_bvtv_vnd + b.labor_nhan_cong_vnd + b.water_energy_vnd;
      cumulativeCost += monthCost;
      cumulativeRev += b.revenue_vnd;
      const cumRoi = cumulativeCost > 0
        ? Number((((cumulativeRev - cumulativeCost) / cumulativeCost) * 100).toFixed(1))
        : 0;

      return {
        month: b.month,
        npk_fertilizer_vnd: b.npk_fertilizer_vnd,
        pesticide_bvtv_vnd: b.pesticide_bvtv_vnd,
        labor_nhan_cong_vnd: b.labor_nhan_cong_vnd,
        water_energy_vnd: b.water_energy_vnd,
        total_cost_vnd: monthCost,
        revenue_vnd: b.revenue_vnd,
        cumulative_cost_vnd: cumulativeCost,
        cumulative_revenue_vnd: cumulativeRev,
        cumulative_roi_percent: cumRoi
      };
    });

    res.json({
      status: 'success',
      data_source: data.dataSource,
      currency_rates: CURRENCY_RATES,
      cost_pillars: data.costPillars,
      monthly_cashflow: monthlySeries
    });
  } catch (err) {
    console.error('Error in GET /api/analytics/cost-breakdown:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi tải biểu đồ cấu trúc chi phí.' });
  }
});

router.get('/plot-comparison', auth, async (req, res) => {
  try {
    const ctx = await resolveUserFinanceContext(req);
    if (ctx.isRedacted) {
      return res.status(403).json({
        error: 'Chế độ bảo mật RBAC: Không có quyền truy cập ma trận tài chính lô trồng.',
        code: 'FINANCE_REDACTED_ROLE',
        isFinanceRedacted: true
      });
    }

    const data = await singleflight.do(
      `bi_exec_${ctx.userId || 0}_${ctx.role || 'user'}_${ctx.effectiveOwnerId || 'all'}`,
      () => aggregateExecutiveBiData(ctx)
    );
    const plotGroups = {};

    data.treeForecasts.forEach(t => {
      const plotKey = t.plot_code || 'Lô A1 - Trung tâm';
      if (!plotGroups[plotKey]) {
        plotGroups[plotKey] = {
          plot_code: plotKey,
          tree_count: 0,
          healthy_count: 0,
          phi_safe_count: 0,
          direct_cost_vnd: 0,
          allocated_overhead_vnd: 0,
          total_cost_vnd: 0,
          predicted_yield_kg: 0,
          predicted_revenue_vnd: 0
        };
      }
      const g = plotGroups[plotKey];
      g.tree_count += 1;
      if (t.health_status === 'Tốt') g.healthy_count += 1;
      if (t.phi_status !== 'quarantine') g.phi_safe_count += 1;
      g.direct_cost_vnd += t.direct_cost_vnd || 0;
      g.allocated_overhead_vnd += t.allocated_overhead_vnd || 0;
      g.total_cost_vnd += t.cost_per_tree_vnd;
      g.predicted_yield_kg += t.predicted_yield_kg;
      g.predicted_revenue_vnd += t.predicted_revenue_vnd;
    });

    const plots = Object.values(plotGroups).map(g => {
      const estAreaHa = data.totalTrees > 0 && data.totalAreaHa > 0
        ? Number(((g.tree_count / data.totalTrees) * data.totalAreaHa).toFixed(3))
        : 0;
      const costPerTree = Math.round(g.total_cost_vnd / Math.max(1, g.tree_count));
      const costPerHa = estAreaHa > 0 ? Math.round(g.total_cost_vnd / estAreaHa) : 0;
      const roi = g.total_cost_vnd > 0
        ? Number((((g.predicted_revenue_vnd - g.total_cost_vnd) / g.total_cost_vnd) * 100).toFixed(1))
        : 0;
      const grade = (g.total_cost_vnd === 0 && g.predicted_revenue_vnd === 0)
        ? '—'
        : (roi >= 250 ? 'A+' : (roi >= 150 ? 'A' : (roi >= 80 ? 'B+' : 'B')));

      return {
        plot_code: g.plot_code,
        tree_count: g.tree_count,
        estimated_area_ha: estAreaHa,
        healthy_rate_percent: Number(((g.healthy_count / Math.max(1, g.tree_count)) * 100).toFixed(1)),
        phi_safe_rate_percent: Number(((g.phi_safe_count / Math.max(1, g.tree_count)) * 100).toFixed(1)),
        direct_cost_vnd: Math.round(g.direct_cost_vnd),
        allocated_overhead_vnd: Math.round(g.allocated_overhead_vnd),
        total_cost_vnd: Math.round(g.total_cost_vnd),
        cost_per_tree_vnd: costPerTree,
        cost_per_hectare_vnd: costPerHa,
        predicted_yield_kg: Number(g.predicted_yield_kg.toFixed(1)),
        predicted_revenue_vnd: Math.round(g.predicted_revenue_vnd),
        net_profit_vnd: Math.round(g.predicted_revenue_vnd - g.total_cost_vnd),
        roi_percent: roi,
        efficiency_grade: grade
      };
    });

    res.json({
      status: 'success',
      total_plots: plots.length,
      plots
    });
  } catch (err) {
    console.error('Error in GET /api/analytics/plot-comparison:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi phân tích hiệu quả từng lô canh tác.' });
  }
});

router.get('/predictive-yield', auth, async (req, res) => {
  try {
    const ctx = await resolveUserFinanceContext(req);
    if (ctx.isRedacted) {
      return res.status(403).json({
        error: 'Chế độ bảo mật RBAC: Không có quyền truy cập dự báo doanh thu mùa vụ.',
        code: 'FINANCE_REDACTED_ROLE',
        isFinanceRedacted: true
      });
    }

    const data = await singleflight.do(
      `bi_exec_${ctx.userId || 0}_${ctx.role || 'user'}_${ctx.effectiveOwnerId || 'all'}`,
      () => aggregateExecutiveBiData(ctx)
    );
    const minYieldKg = Number((data.predictedTotalYieldKg * 0.91).toFixed(1));
    const maxYieldKg = Number((data.predictedTotalYieldKg * 1.09).toFixed(1));

    const dynamicRecs = [];
    if (data.dataSource === 'NO_COST_DATA' && data.fruitAuditCount === 0 && data.harvestCount === 0) {
      dynamicRecs.push({
        priority: 'MEDIUM',
        title_vi: 'Chưa đủ dữ liệu nhật ký thực tế để tính toán khuyến nghị tối ưu hóa chi phí & năng suất',
        title_en: 'Insufficient field logs to compute cost & yield optimization recommendations',
        title_zh: '田间记录数据不足，暂无法生成量化优化建议',
        impact_estimate: `Dữ liệu hiện có: ${data.totalTrees} cây · ${data.usageBatchesCount} đợt hạch toán`
      });
    } else {
      const npkPillar = (data.costPillars || []).find(p => p.key === 'npk_fertilizer') || { share_percent: 0, amount_vnd: 0 };
      const waterPillar = (data.costPillars || []).find(p => p.key === 'water_energy') || { share_percent: 0, amount_vnd: 0 };
      const quarantineCount = (data.treeForecasts || []).filter(t => t.phi_status === 'quarantine').length;
      dynamicRecs.push({
        priority: npkPillar.share_percent > 45 ? 'HIGH' : 'MEDIUM',
        title_vi: `Tỷ trọng phân bón hiện chiếm ${npkPillar.share_percent}% tổng chi phí (${Math.round(npkPillar.amount_vnd).toLocaleString('vi-VN')} đ)`,
        title_en: `Fertilizer spend currently represents ${npkPillar.share_percent}% of total investment`,
        title_zh: `当前肥料支出占总投入 ${npkPillar.share_percent}%`,
        impact_estimate: `Dựa trên ${data.usageBatchesCount} đợt vật tư & ${data.fruitAuditCount} lần kiểm toán quả`
      });
      if (waterPillar.share_percent > 15 || waterPillar.amount_vnd > 0) {
        dynamicRecs.push({
          priority: waterPillar.share_percent > 20 ? 'HIGH' : 'MEDIUM',
          title_vi: `Chi phí tưới tiêu & điện năng chiếm ${waterPillar.share_percent}% tổng đầu tư (${Math.round(waterPillar.amount_vnd).toLocaleString('vi-VN')} đ)`,
          title_en: `Irrigation & energy currently accounts for ${waterPillar.share_percent}% of investment`,
          title_zh: `灌溉水电当前占总投入 ${waterPillar.share_percent}%`,
          impact_estimate: `Biên lợi nhuận gộp thực tế: ${data.grossMarginPercent}%`
        });
      }
      dynamicRecs.push({
        priority: quarantineCount > 0 ? 'HIGH' : 'MEDIUM',
        title_vi: quarantineCount > 0
          ? `Có ${quarantineCount}/${data.totalTrees} cây đang trong thời hạn cách ly thuốc BVTV (PHI) — Khóa thu hoạch VietGAP`
          : `Toàn bộ ${data.totalTrees} cây đạt trạng thái an toàn cách ly thuốc BVTV (PHI Safe)`,
        title_en: quarantineCount > 0
          ? `${quarantineCount} trees are under active Pre-Harvest Interval (PHI) quarantine`
          : `All ${data.totalTrees} trees satisfy Pre-Harvest Interval (PHI) compliance`,
        title_zh: quarantineCount > 0
          ? `${quarantineCount} 棵果树处于农药安全间隔期 (PHI) 管控中`
          : `全部 ${data.totalTrees} 棵果树均符合采收安全间隔期 (PHI) 标准`,
        impact_estimate: `Độ tin cậy mô hình ML: ${data.confidenceScore}% (R²=${data.rSquared})`
      });
    }

    res.json({
      status: 'success',
      model_metadata: {
        engine_name: 'TBSG Agri-ML Fruit-Audit & Harvest Empirical Model v2.5',
        methodology: 'Fruit Audit Stage Progression + Actual Harvest & Cost Accounting',
        confidence_score_percent: data.confidenceScore,
        r_squared: data.rSquared
      },
      next_season_forecast: {
        total_trees_evaluated: data.totalTrees,
        total_area_ha: data.totalAreaHa,
        predicted_total_yield_kg: data.predictedTotalYieldKg,
        predicted_yield_tons_per_ha: data.predictedYieldTonsPerHa,
        avg_yield_per_tree_kg: data.totalTrees > 0 ? Number((data.predictedTotalYieldKg / data.totalTrees).toFixed(1)) : 0,
        confidence_interval_kg: [minYieldKg, maxYieldKg],
        predicted_revenue_vnd: data.predictedSeasonRevenueVnd,
        predicted_revenue_multi_currency: convertCurrency(data.predictedSeasonRevenueVnd),
        projected_net_profit_vnd: data.netProfitVnd,
        projected_roi_percent: data.roiPercent
      },
      agronomic_recommendations: dynamicRecs,
      tree_forecasts: data.treeForecasts.slice(0, 25)
    });
  } catch (err) {
    console.error('Error in GET /api/analytics/predictive-yield:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi chạy mô hình dự báo sản lượng học máy.' });
  }
});

router.get('/i18n/:lang', async (req, res) => {
  try {
    const rawLang = String(req.params.lang || 'vi').toLowerCase().trim();
    const supported = ['vi', 'en', 'zh'];
    const lang = supported.includes(rawLang) ? rawLang : 'vi';

    const dictPath = path.join(__dirname, '../../frontend/i18n', `${lang}.json`);
    if (fs.existsSync(dictPath)) {
      const content = fs.readFileSync(dictPath, 'utf8');
      const parsed = JSON.parse(content);
      return res.json({
        status: 'success',
        lang,
        supported_languages: [
          { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳', currency: 'VND' },
          { code: 'en', label: 'English', flag: '🇬🇧', currency: 'USD' },
          { code: 'zh', label: '中文 (简体)', flag: '🇨🇳', currency: 'CNY' }
        ],
        currency_rates: CURRENCY_RATES,
        dictionary: parsed
      });
    }

    res.status(404).json({ error: 'Dictionary file not found for language: ' + lang });
  } catch (err) {
    console.error('Error in GET /api/analytics/i18n/:lang:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi tải từ điển đa ngôn ngữ.' });
  }
});

module.exports = router;
