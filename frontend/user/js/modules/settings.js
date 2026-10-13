/* Plant Book Agtech (c) 2026 TBSG Agtech. All Rights Reserved. Enterprise Protected Asset */
/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/settings.js — Account settings & Threshold Rules Engine
   ═══════════════════════════════════════════════════════════════ */

import { api, API, token } from '../core/api.js';
import { toast, esc } from '../core/utils.js';

let _currentRules = [];

// ── Khởi tạo trang Cài đặt ──────────────────────────────────────
export async function loadUserSettings() {
  try {
    const user = await api('/auth/me');
    window._currentUserProfile = user;
    applySubRoleUiRestrictions(user);
    _populateProfileForm(user);
    _renderAvatar(user.avatar_url, user.full_name);
    _bindEvents();
    loadThresholdRules();
  } catch (err) {
    toast('Không thể tải thông tin tài khoản.', 'error');
  }
}

// ── Sub-Tab Switching ──────────────────────────────────────────
export function switchSettingsSubtab(subtab) {
  const paneThresholds = document.getElementById('subtab-pane-thresholds');
  const paneTeam = document.getElementById('subtab-pane-team');
  const paneProfile = document.getElementById('subtab-pane-profile');
  const btnThresholds = document.getElementById('subtab-btn-thresholds');
  const btnTeam = document.getElementById('subtab-btn-team-rbac');
  const btnProfile = document.getElementById('subtab-btn-profile');

  if (!paneThresholds || !paneProfile || !btnThresholds || !btnProfile) return;

  const setBtnState = (btn, active) => {
    if (!btn) return;
    if (active) {
      btn.classList.add('active');
      btn.style.color = '#059669';
      btn.style.borderBottomColor = '#059669';
      btn.style.fontWeight = '800';
    } else {
      btn.classList.remove('active');
      btn.style.color = '#64748b';
      btn.style.borderBottomColor = 'transparent';
      btn.style.fontWeight = '700';
    }
  };

  if (subtab === 'profile') {
    paneThresholds.style.display = 'none';
    if (paneTeam) paneTeam.style.display = 'none';
    paneProfile.style.display = 'block';
    setBtnState(btnThresholds, false);
    setBtnState(btnTeam, false);
    setBtnState(btnProfile, true);
  } else if (subtab === 'team') {
    paneThresholds.style.display = 'none';
    if (paneTeam) paneTeam.style.display = 'block';
    paneProfile.style.display = 'none';
    setBtnState(btnThresholds, false);
    setBtnState(btnTeam, true);
    setBtnState(btnProfile, false);
    loadFarmerTeamRbac();
  } else {
    paneThresholds.style.display = 'block';
    if (paneTeam) paneTeam.style.display = 'none';
    paneProfile.style.display = 'none';
    setBtnState(btnThresholds, true);
    setBtnState(btnTeam, false);
    setBtnState(btnProfile, false);
    loadThresholdRules();
  }
  if (typeof window.refreshIcons === 'function') window.refreshIcons();
}
window.switchSettingsSubtab = switchSettingsSubtab;

// ── Threshold Rules CRUD ──────────────────────────────────────
export async function loadThresholdRules() {
  const container = document.getElementById('threshold-rules-list');
  if (!container) return;

  try {
    const res = await api('/notifications/rules');
    if (res && res.success) {
      _currentRules = res.rules || [];
      renderThresholdRulesUI(_currentRules);
    }
  } catch (err) {
    console.warn('Lỗi tải quy tắc ngưỡng:', err);
    container.innerHTML = `
      <div style="text-align:center; padding:24px; color:#ef4444; font-size:13px;">
        Không thể tải danh sách quy tắc cài đặt ngưỡng.
      </div>
    `;
  }
}
window.loadThresholdRules = loadThresholdRules;

// ── Device & Metric Hierarchy Catalog ──────────────────────────
const DEVICE_GROUPS = {
  soil: {
    id: 'soil',
    name: 'Cảm biến Đất Đa tầng (Multilayer 7-in-1)',
    badge: 'Đất đa tầng',
    metrics: {
      soil_moisture_10cm: { name: 'Độ ẩm đất tầng 10cm', unit: '%' },
      soil_moisture_20cm: { name: 'Độ ẩm đất tầng 20cm', unit: '%' },
      soil_moisture_30cm: { name: 'Độ ẩm đất tầng 30cm', unit: '%' },
      soil_moisture_50cm: { name: 'Độ ẩm đất tầng 50cm', unit: '%' },
      soil_temp_10cm:     { name: 'Nhiệt độ đất tầng 10cm', unit: '°C' },
      soil_temp_20cm:     { name: 'Nhiệt độ đất tầng 20cm', unit: '°C' },
      soil_ph:            { name: 'Độ pH Đất', unit: 'pH' },
      soil_ec:            { name: 'Độ EC dẫn điện đất', unit: 'mS/cm' },
      soil_salinity:      { name: 'Độ mặn đất', unit: '‰' },
      soil_nitrogen:      { name: 'Dinh dưỡng Nitơ (N)', unit: 'mg/kg' },
      soil_phosphorus:    { name: 'Dinh dưỡng Phốt pho (P)', unit: 'mg/kg' },
      soil_potassium:     { name: 'Dinh dưỡng Kali (K)', unit: 'mg/kg' }
    }
  },
  air: {
    id: 'air',
    name: 'Trạm Môi trường Không khí (Air Station #01)',
    badge: 'Không khí',
    metrics: {
      air_temp:           { name: 'Nhiệt độ không khí', unit: '°C' },
      air_humidity:       { name: 'Độ ẩm không khí', unit: '%' },
      wind_speed:         { name: 'Tốc độ gió', unit: 'km/h' },
      rainfall:           { name: 'Lượng & Cường độ mưa', unit: 'mm' },
      uv_index:           { name: 'Chỉ số bức xạ UV', unit: 'Index' },
      solar_radiation:    { name: 'Cường độ nắng / Bức xạ', unit: 'W/m²' }
    }
  },
  water: {
    id: 'water',
    name: 'Môi trường Nước tưới (Bể tưới IoT)',
    badge: 'Nước tưới',
    metrics: {
      water_ph:           { name: 'pH Nước tưới', unit: 'pH' },
      water_do:           { name: 'Oxy hòa tan (DO)', unit: 'mg/L' },
      water_turbidity:    { name: 'Độ đục nước', unit: 'NTU' },
      water_level:        { name: 'Mực nước bể lưu', unit: '%' }
    }
  },
  weather: {
    id: 'weather',
    name: 'Dự báo Khí tượng & Thời tiết Nông nghiệp',
    badge: 'Khí tượng',
    metrics: {
      rain_chance:        { name: 'Khả năng mưa ngày mai', unit: '%' },
      forecast_temp_max:  { name: 'Dự báo Nhiệt độ cao nhất', unit: '°C' },
      forecast_temp_min:  { name: 'Dự báo Nhiệt độ thấp nhất', unit: '°C' },
      forecast_humidity:  { name: 'Dự báo Độ ẩm không khí', unit: '%' },
      forecast_wind:      { name: 'Dự báo Tốc độ gió', unit: 'km/h' }
    }
  },
  custom: {
    id: 'custom',
    name: 'Nguồn dữ liệu Khác (Tự nhập tay)',
    badge: 'Tự nhập',
    metrics: {}
  }
};

function _findDeviceGroupForMetric(metricKey) {
  if (!metricKey) return 'soil';
  for (const [devKey, dev] of Object.entries(DEVICE_GROUPS)) {
    if (dev.metrics && dev.metrics[metricKey]) return devKey;
  }
  return 'custom';
}

function _getMetricInfo(devKey, metricKey) {
  return DEVICE_GROUPS[devKey]?.metrics?.[metricKey] || null;
}

// ── Dynamic Multi-Condition Builder Helpers ───────────────────
export function addConditionRow(data = null) {
  const container = document.getElementById('rule-conditions-list');
  if (!container) return;

  const rowId = 'cond-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  
  let devKey = data?.device_source || (data?.metric_key ? _findDeviceGroupForMetric(data.metric_key) : 'soil');
  if (data?.is_custom) devKey = 'custom';

  const isCustom = devKey === 'custom';
  const customName = data?.custom_name || (isCustom ? data?.metric_name || '' : '');
  const customUnit = data?.custom_unit || (isCustom ? data?.unit || '' : '');

  const metricKey = isCustom ? '' : (data?.metric_key || Object.keys(DEVICE_GROUPS[devKey]?.metrics || {})[0] || 'soil_moisture_10cm');
  const operator = data?.operator || '<';
  const thresholdVal = data?.threshold_value !== undefined ? data.threshold_value : 50;
  
  const metricInfo = isCustom ? { name: customName, unit: customUnit } : (DEVICE_GROUPS[devKey]?.metrics?.[metricKey] || { name: metricKey, unit: '%' });
  const unit = metricInfo?.unit || (isCustom ? customUnit : '%');

  const row = document.createElement('div');
  row.id = rowId;
  row.className = 'rule-condition-row';
  row.style.cssText = 'background:#ffffff; border:1.5px solid #cbd5e1; border-radius:14px; padding:12px 14px; display:flex; flex-direction:column; gap:10px; box-shadow:0 2px 8px rgba(0,0,0,0.03); transition:all 0.2s ease;';

  row.innerHTML = `
    <!-- Row Header -->
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed #e2e8f0; padding-bottom:8px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="condition-index-badge" style="font-size:11.5px; font-weight:800; color:#047857; background:#dcfce7; padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">
          <i data-lucide="git-commit" class="lucide-sm"></i> Điều kiện <span class="cond-num"></span>
        </span>
        <span class="cond-device-badge" style="font-size:11px; font-weight:700; color:#475569; background:#f1f5f9; padding:3px 8px; border-radius:6px;">
          ${DEVICE_GROUPS[devKey]?.badge || 'Đất'}
        </span>
      </div>
      <button type="button" onclick="removeConditionRow('${rowId}')" title="Xóa điều kiện này" style="background:#fee2e2; border:none; color:#dc2626; width:26px; height:26px; border-radius:6px; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:background 0.2s;">
        <i data-lucide="trash-2" class="lucide-sm"></i>
      </button>
    </div>

    <!-- Step 1: Device Source Selector -->
    <div>
      <span style="font-size:11.5px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">
        1. Chọn Thiết bị IoT / Nguồn dữ liệu:
      </span>
      <select class="cond-device" onchange="onConditionDeviceChange('${rowId}')" style="width:100%; padding:8px 10px; border:1.5px solid #cbd5e1; border-radius:8px; font-size:12.5px; font-weight:700; color:#0f172a; outline:none; background:#f8fafc;">
        ${Object.entries(DEVICE_GROUPS).map(([k, v]) => `
          <option value="${k}" ${k === devKey ? 'selected' : ''}>${v.name}</option>
        `).join('')}
      </select>
    </div>

    <!-- Step 2: Metric Field & Comparison -->
    <div style="display:grid; grid-template-columns: 1.8fr 1fr 1.2fr; gap:8px; align-items:center;">
      
      <!-- Metric Selector or Custom Inputs -->
      <div class="cond-metric-wrapper">
        <select class="cond-metric" onchange="onConditionMetricChange('${rowId}')" style="width:100%; padding:9px 10px; border:1.5px solid #cbd5e1; border-radius:8px; font-size:12.5px; font-weight:600; outline:none; display:${isCustom ? 'none' : 'block'};">
          ${!isCustom && DEVICE_GROUPS[devKey]?.metrics ? Object.entries(DEVICE_GROUPS[devKey].metrics).map(([k, v]) => `
            <option value="${k}" ${k === metricKey ? 'selected' : ''}>${v.name} (${v.unit})</option>
          `).join('') : ''}
        </select>

        <div class="cond-custom-fields" style="display:${isCustom ? 'flex' : 'none'}; gap:6px;">
          <input type="text" class="cond-custom-name" value="${customName}" placeholder="Tên chỉ số (VD: CO2)" oninput="updateRuleConditionsSummary()" style="flex:1; padding:8px 10px; border:1.5px solid #cbd5e1; border-radius:8px; font-size:12px; font-weight:600; outline:none;" />
          <input type="text" class="cond-custom-unit" value="${customUnit}" placeholder="Đơn vị (ppm)" oninput="onCustomUnitInput('${rowId}')" style="width:75px; padding:8px 8px; border:1.5px solid #cbd5e1; border-radius:8px; font-size:12px; font-weight:700; outline:none; text-align:center;" />
        </div>
      </div>

      <!-- Operator -->
      <div>
        <select class="cond-operator" onchange="updateRuleConditionsSummary()" style="width:100%; padding:9px 10px; border:1.5px solid #cbd5e1; border-radius:8px; font-size:12.5px; font-weight:600; outline:none;">
          <option value="<" ${operator === '<' ? 'selected' : ''}>Nhỏ hơn (&lt;)</option>
          <option value="<=" ${operator === '<=' ? 'selected' : ''}>Nhỏ hơn hoặc bằng (&le;)</option>
          <option value=">" ${operator === '>' ? 'selected' : ''}>Lớn hơn (&gt;)</option>
          <option value=">=" ${operator === '>=' ? 'selected' : ''}>Lớn hơn hoặc bằng (&ge;)</option>
          <option value="=" ${operator === '=' ? 'selected' : ''}>Bằng (=)</option>
        </select>
      </div>

      <!-- Threshold Value & Unit -->
      <div style="display:flex; align-items:center; gap:4px;">
        <input type="number" step="any" class="cond-value" value="${thresholdVal}" placeholder="50" oninput="updateRuleConditionsSummary()" style="width:100%; min-width:60px; padding:9px 10px; border:1.5px solid #cbd5e1; border-radius:8px; font-size:12.5px; font-weight:700; outline:none;" />
        <span class="cond-unit" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:7px 10px; border-radius:8px; font-size:12px; font-weight:800; color:#475569; min-width:32px; text-align:center;">${unit || '%'}</span>
      </div>
    </div>
  `;

  container.appendChild(row);
  _renumberConditionRows();
  updateRuleConditionsSummary();
}
window.addConditionRow = addConditionRow;

export function onConditionDeviceChange(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;

  const devSel = row.querySelector('.cond-device');
  const metricSel = row.querySelector('.cond-metric');
  const customFields = row.querySelector('.cond-custom-fields');
  const unitSpan = row.querySelector('.cond-unit');
  const badgeEl = row.querySelector('.cond-device-badge');

  if (!devSel) return;
  const devKey = devSel.value;
  if (badgeEl) badgeEl.textContent = DEVICE_GROUPS[devKey]?.badge || 'Cảm biến';

  if (devKey === 'custom') {
    if (metricSel) metricSel.style.display = 'none';
    if (customFields) customFields.style.display = 'flex';
    const customUnitInput = row.querySelector('.cond-custom-unit');
    if (unitSpan && customUnitInput) unitSpan.textContent = customUnitInput.value || '';
  } else {
    if (metricSel) {
      metricSel.style.display = 'block';
      const groupMetrics = DEVICE_GROUPS[devKey]?.metrics || {};
      metricSel.innerHTML = Object.entries(groupMetrics).map(([k, v]) => `
        <option value="${k}">${v.name} (${v.unit})</option>
      `).join('');

      const firstKey = Object.keys(groupMetrics)[0];
      const unit = groupMetrics[firstKey]?.unit || '%';
      if (unitSpan) unitSpan.textContent = unit;
    }
    if (customFields) customFields.style.display = 'none';
  }

  updateRuleConditionsSummary();
}
window.onConditionDeviceChange = onConditionDeviceChange;

export function onCustomUnitInput(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const customUnitInput = row.querySelector('.cond-custom-unit');
  const unitSpan = row.querySelector('.cond-unit');
  if (customUnitInput && unitSpan) {
    unitSpan.textContent = customUnitInput.value.trim() || '';
  }
  updateRuleConditionsSummary();
}
window.onCustomUnitInput = onCustomUnitInput;

export function removeConditionRow(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const container = document.getElementById('rule-conditions-list');
  if (container && container.querySelectorAll('.rule-condition-row').length <= 1) {
    toast('Cần duy trì ít nhất 1 điều kiện cảm biến.', 'info');
    return;
  }
  row.remove();
  _renumberConditionRows();
  updateRuleConditionsSummary();
}
window.removeConditionRow = removeConditionRow;

export function onConditionMetricChange(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const devSel = row.querySelector('.cond-device');
  const metricSel = row.querySelector('.cond-metric');
  const unitSpan = row.querySelector('.cond-unit');
  if (devSel && metricSel && unitSpan) {
    const devKey = devSel.value;
    const metricKey = metricSel.value;
    const unit = DEVICE_GROUPS[devKey]?.metrics?.[metricKey]?.unit || '%';
    unitSpan.textContent = unit;
  }
  updateRuleConditionsSummary();
}
window.onConditionMetricChange = onConditionMetricChange;

function _renumberConditionRows() {
  const container = document.getElementById('rule-conditions-list');
  if (!container) return;
  const rows = container.querySelectorAll('.rule-condition-row');
  rows.forEach((r, idx) => {
    const numEl = r.querySelector('.cond-num');
    if (numEl) numEl.textContent = `#${idx + 1}`;
  });
}

export function getConditionsFromUI() {
  const container = document.getElementById('rule-conditions-list');
  if (!container) return [];

  const rows = container.querySelectorAll('.rule-condition-row');
  const conditions = [];

  rows.forEach(r => {
    const devKey = r.querySelector('.cond-device')?.value || 'soil';
    const isCustom = devKey === 'custom';
    const operator = r.querySelector('.cond-operator')?.value || '<';
    const thresholdVal = parseFloat(r.querySelector('.cond-value')?.value) || 0;

    if (isCustom) {
      const customName = r.querySelector('.cond-custom-name')?.value.trim() || 'Chỉ số tự nhập';
      const customUnit = r.querySelector('.cond-custom-unit')?.value.trim() || '';
      conditions.push({
        device_source: 'custom',
        is_custom: true,
        metric_key: 'custom_' + Date.now(),
        metric_name: `✍️ ${customName}`,
        operator: operator,
        threshold_value: thresholdVal,
        unit: customUnit
      });
    } else {
      const metricKey = r.querySelector('.cond-metric')?.value || 'soil_moisture_10cm';
      const metricInfo = DEVICE_GROUPS[devKey]?.metrics?.[metricKey] || { name: metricKey, unit: '%' };
      conditions.push({
        device_source: devKey,
        is_custom: false,
        metric_key: metricKey,
        metric_name: metricInfo.name,
        operator: operator,
        threshold_value: thresholdVal,
        unit: metricInfo.unit
      });
    }
  });

  return conditions;
}
window.getConditionsFromUI = getConditionsFromUI;

export function updateRuleConditionsSummary() {
  const summaryEl = document.getElementById('rule-conditions-summary');
  if (!summaryEl) return;

  const matchRadio = document.querySelector('input[name="rule_match_type"]:checked');
  const matchType = matchRadio ? matchRadio.value : 'AND';
  const matchWord = matchType === 'OR' ? ' HOẶC ' : ' VÀ ';

  const conditions = getConditionsFromUI();
  const parts = [];

  conditions.forEach(c => {
    parts.push(`[${c.metric_name} ${c.operator} ${c.threshold_value}${c.unit}]`);
  });

  const offIot = document.getElementById('rule-check-offline-iot')?.checked;
  if (offIot) parts.push(`[Quét IoT mất kết nối/0]`);

  const weatherTom = document.getElementById('rule-check-weather-tomorrow')?.checked;
  if (weatherTom) parts.push(`[Sáng mai có mưa rào]`);

  const disHist = document.getElementById('rule-check-disease-history')?.checked;
  if (disHist) parts.push(`[Tra lịch sử bệnh cây]`);

  if (parts.length === 0) {
    summaryEl.textContent = 'Chưa thiết lập điều kiện nào.';
  } else {
    summaryEl.textContent = parts.join(matchWord);
  }

  updateRuleLivePreview();
}
window.updateRuleConditionsSummary = updateRuleConditionsSummary;


export function renderThresholdRulesUI(rules) {
  const container = document.getElementById('threshold-rules-list');
  if (!container) return;

  if (!rules || rules.length === 0) {
    container.innerHTML = `
      <div style="background:#ffffff; border:2px dashed #cbd5e1; border-radius:18px; padding:36px 20px; text-align:center;">
        <i data-lucide="bell" class="lucide-sm" style="font-size:36px; color:#cbd5e1; margin-bottom:12px; display:block;"></i>
        <h4 style="margin:0 0 6px 0; color:#334155; font-size:16px; font-weight:800;">Chưa có quy tắc cài đặt thông báo tự động nào</h4>
        <p style="margin:0 0 18px 0; color:#64748b; font-size:13px;">Bấm nút bên dưới để khởi tạo quy tắc Cảnh báo, Khuyến cáo hoặc Thông báo tự động.</p>
        <button onclick="openAddThresholdRuleModal()" style="background:linear-gradient(135deg, #10b981, #047857); color:white; border:none; padding:10px 22px; font-size:13.5px; font-weight:800; border-radius:12px; cursor:pointer; box-shadow:0 4px 14px rgba(16,185,129,0.35);">
          + Thêm quy tắc đầu tiên
        </button>
      </div>
    `;
    return;
  }

  const categoryStyles = {
    danger: {
      bg: '#fef2f2',
      border: '#fecaca',
      badgeBg: '#fee2e2',
      badgeText: '#dc2626',
      icon: 'alert-triangle',
      label: 'Cảnh báo'
    },
    warning: {
      bg: '#fff7ed',
      border: '#fed7aa',
      badgeBg: '#ffedd5',
      badgeText: '#d97706',
      icon: 'megaphone',
      label: 'Khuyến cáo'
    },
    info: {
      bg: '#f0fdf4',
      border: '#bbf7d0',
      badgeBg: '#dcfce7',
      badgeText: '#16a34a',
      icon: 'info',
      label: 'Thông báo'
    }
  };

  container.innerHTML = rules.map(r => {
    const cat = r.category_type || r.alert_level || 'warning';
    const st = categoryStyles[cat] || categoryStyles.info;
    const isEnabled = r.is_enabled;
    const ruleTitle = r.title || r.metric_name || 'Quy tắc Cài đặt Ngưỡng';

    // Parse multi-conditions
    let conditions = [];
    if (r.conditions_json) {
      try {
        conditions = typeof r.conditions_json === 'string' ? JSON.parse(r.conditions_json) : r.conditions_json;
      } catch (_) { conditions = []; }
    }
    if (!Array.isArray(conditions) || conditions.length === 0) {
      if (r.metric_name && r.operator) {
        conditions = [{ metric_name: r.metric_name, operator: r.operator, threshold_value: r.threshold_value, unit: r.unit }];
      }
    }

    const matchWord = (r.match_type === 'OR') ? 'HOẶC' : 'VÀ';

    return `
      <div style="background:#ffffff; border:1.5px solid ${isEnabled ? st.border : '#e2e8f0'}; border-radius:18px; padding:20px; box-shadow:0 3px 12px rgba(0,0,0,0.03); opacity:${isEnabled ? 1 : 0.65}; transition:all 0.25s ease; position:relative; overflow:hidden;">
        <div style="position:absolute; top:0; left:0; width:5px; height:100%; background:${st.badgeText};"></div>
        
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; padding-left:6px;">
          <div style="flex:1; min-width:280px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
              <span class="badge" style="background:${st.badgeBg}; color:${st.badgeText}; border:1px solid ${st.border}; font-size:11.5px; font-weight:800; display:inline-flex; align-items:center; gap:5px;">
                <i data-lucide="${st.icon}" class="lucide-sm"></i> ${st.label}
              </span>
              
              <span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:11px; font-weight:700;">
                <i data-lucide="sprout" class="lucide-sm"></i> ${r.action_type || 'Canh tác'}
              </span>

              ${r.check_offline_iot ? `<span class="badge" style="background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; font-size:10.5px; font-weight:800;"><i data-lucide="radio" class="lucide-sm"></i> Quét IoT Offline/0</span>` : ''}
              ${r.check_disease_history ? `<span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-size:10.5px; font-weight:800;"><i data-lucide="bug" class="lucide-sm"></i> Tra lịch sử bệnh cây</span>` : ''}
              ${r.reconfirm_event_type ? `<span class="badge" style="background:#dcfce7; color:#166534; border:1px solid #86efac; font-size:10.5px; font-weight:800;"><i data-lucide="check-square" class="lucide-sm"></i> Reconfirm Hệ thống</span>` : ''}

              <span style="font-size:12px; color:#64748b; font-weight:600;">
                Tạo lúc: ${new Date(r.created_at || Date.now()).toLocaleDateString('vi-VN')}
              </span>
            </div>

            <h4 style="margin:0 0 8px 0; font-size:16px; font-weight:800; color:#0f172a;">${esc(ruleTitle)}</h4>

            <!-- Conditions Badges -->
            ${conditions.length > 0 ? `
              <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; align-items:center;">
                <span style="font-size:12px; font-weight:700; color:#475569;">Điều kiện kích hoạt:</span>
                ${conditions.map((c, i) => `
                  ${i > 0 ? `<span style="font-size:11px; font-weight:800; color:#6366f1; background:#e0e7ff; padding:2px 6px; border-radius:4px;">${matchWord}</span>` : ''}
                  <span class="badge" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1; font-weight:700; font-size:11.5px;">
                    ${c.metric_name || c.metric_key}: ${c.operator} ${c.threshold_value} ${c.unit || ''}
                  </span>
                `).join('')}
              </div>
            ` : ''}

            <p style="margin:6px 0 0 0; font-size:13px; color:#334155; line-height:1.55; background:${st.bg}; padding:10px 14px; border-radius:12px; border:1px solid ${st.border}; border-left:4px solid ${st.badgeText};">
              <strong>Nội dung thông báo tự động:</strong> ${r.action_recommendation}
            </p>
          </div>

          <div style="display:flex; align-items:center; gap:10px;">
            <!-- Toggle Switch -->
            <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:12px; font-weight:800; color:${isEnabled ? '#059669' : '#94a3b8'}; background:#f8fafc; padding:6px 12px; border-radius:10px; border:1px solid #e2e8f0;">
              <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleThresholdRuleEnabled(${r.id}, this.checked)" style="width:18px; height:18px; accent-color:#059669; cursor:pointer;" />
              ${isEnabled ? 'Đang kích hoạt' : 'Tắt quy tắc'}
            </label>

            <button onclick="editThresholdRule(${r.id})" style="background:#ffffff; border:1.5px solid #cbd5e1; color:#334155; padding:7px 14px; border-radius:10px; font-size:12px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
              <i data-lucide="edit-3" class="lucide-sm"></i> Sửa
            </button>

            <button onclick="deleteThresholdRule(${r.id})" style="background:#fef2f2; border:1.5px solid #fecaca; color:#dc2626; padding:7px 14px; border-radius:10px; font-size:12px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
              <i data-lucide="trash-2" class="lucide-sm"></i> Xóa
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

export function onRuleCategoryChange(category) {
  const iotPane = document.getElementById('rule-pane-iot');
  const infoPane = document.getElementById('rule-pane-info');
  const dangerBox = document.getElementById('rule-box-danger-options');
  const warningBox = document.getElementById('rule-box-warning-options');
  const matchBox = document.getElementById('rule-match-type-box');
  const previewBox = document.getElementById('rule-live-preview-box');
  const previewIcon = document.getElementById('preview-icon');

  if (category === 'info') {
    if (iotPane) iotPane.style.display = 'none';
    if (infoPane) infoPane.style.display = 'flex';
    if (dangerBox) dangerBox.style.display = 'none';
    if (warningBox) warningBox.style.display = 'none';
    if (matchBox) matchBox.style.display = 'none';
  } else {
    if (iotPane) iotPane.style.display = 'flex';
    if (infoPane) infoPane.style.display = 'none';
    if (matchBox) matchBox.style.display = 'flex';
  }

  if (category === 'danger') {
    if (dangerBox) dangerBox.style.display = 'flex';
    if (warningBox) warningBox.style.display = 'none';
    if (previewBox) {
      previewBox.style.background = '#fef2f2';
      previewBox.style.borderColor = '#fecaca';
    }
    if (previewIcon) {
      previewIcon.setAttribute('data-lucide', 'alert-triangle');
      previewIcon.style.color = '#dc2626';
      if (window.lucide) lucide.createIcons({ targets: [previewIcon.parentElement || previewIcon] });
    }
  } else if (category === 'warning') {
    if (dangerBox) dangerBox.style.display = 'none';
    if (warningBox) warningBox.style.display = 'flex';
    if (previewBox) {
      previewBox.style.background = '#fff7ed';
      previewBox.style.borderColor = '#fed7aa';
    }
    if (previewIcon) {
      previewIcon.setAttribute('data-lucide', 'megaphone');
      previewIcon.style.color = '#d97706';
      if (window.lucide) lucide.createIcons({ targets: [previewIcon.parentElement || previewIcon] });
    }
  } else if (category === 'info') {
    if (previewBox) {
      previewBox.style.background = '#f0fdf4';
      previewBox.style.borderColor = '#bbf7d0';
    }
    if (previewIcon) {
      previewIcon.setAttribute('data-lucide', 'info');
      previewIcon.style.color = '#16a34a';
      if (window.lucide) lucide.createIcons({ targets: [previewIcon.parentElement || previewIcon] });
    }
  }
  updateRuleConditionsSummary();
}
window.onRuleCategoryChange = onRuleCategoryChange;

export function updateRuleLivePreview() {
  const titleInput = document.getElementById('rule-title');
  const recInput = document.getElementById('rule-recommendation');
  const pTitle = document.getElementById('preview-title');
  const pMsg = document.getElementById('preview-message');

  if (pTitle && titleInput) {
    pTitle.textContent = titleInput.value.trim() || 'Tên quy tắc thông báo';
  }
  if (pMsg && recInput) {
    pMsg.textContent = recInput.value.trim() || 'Nội dung thông báo tự động hiển thị cho nông hộ...';
  }
}
window.updateRuleLivePreview = updateRuleLivePreview;

// ── Notification Timing Helper ────────────────────────────────
export function onNotifyTimeTypeChange() {
  const typeSel = document.getElementById('rule-notify-time-type');
  const customWrapper = document.getElementById('rule-custom-time-wrapper');
  if (!typeSel || !customWrapper) return;
  customWrapper.style.display = typeSel.value === 'custom' ? 'block' : 'none';
}
window.onNotifyTimeTypeChange = onNotifyTimeTypeChange;

export function openAddThresholdRuleModal() {
  const modal = document.getElementById('threshold-rule-modal');
  if (!modal) {
    console.error('[ThresholdRule] Modal #threshold-rule-modal không tìm thấy trong DOM.');
    return;
  }

  // Show modal FIRST — guaranteed, before any optional DOM manipulation
  modal.style.display = 'flex';
  modal.style.zIndex = '99999';

  try {
    const form = document.getElementById('threshold-rule-form');
    const titleEl = document.getElementById('threshold-modal-title');

    if (form) form.reset();

    const ruleId = document.getElementById('rule-id');
    const ruleTitleInput = document.getElementById('rule-title');
    const ruleRec = document.getElementById('rule-recommendation');

    if (ruleId) ruleId.value = '';
    if (ruleTitleInput) ruleTitleInput.value = 'Cảnh báo Độ ẩm Đất Tầng 10cm & Dự báo Mưa rào';
    if (ruleRec) ruleRec.value = 'Độ ẩm đất tầng 10cm < 50% & Sáng mai dự báo mưa rào. Khuyến nghị tưới bổ sung đến khi độ ẩm đất >= 50%!';

    // Default to 'danger' category
    if (form) {
      const radDanger = form.querySelector('input[name="rule_category"][value="danger"]');
      if (radDanger) radDanger.checked = true;
      const radAnd = form.querySelector('input[name="rule_match_type"][value="AND"]');
      if (radAnd) radAnd.checked = true;
    }

    // Reset notification timing
    const notifyTimeSel = document.getElementById('rule-notify-time-type');
    if (notifyTimeSel) notifyTimeSel.value = 'instant';
    const customTimeInput = document.getElementById('rule-custom-time');
    if (customTimeInput) customTimeInput.value = '07:00';
    const freqSel = document.getElementById('rule-frequency');
    if (freqSel) freqSel.value = 'always';
    onNotifyTimeTypeChange();

    if (titleEl) titleEl.textContent = 'Cấu hình Quy tắc Thông báo Tự động';

    // Clear dynamic condition container and seed with default initial condition
    const conditionsContainer = document.getElementById('rule-conditions-list');
    if (conditionsContainer) {
      conditionsContainer.innerHTML = '';
      addConditionRow({
        metric_key: 'soil_moisture_10cm',
        operator: '<',
        threshold_value: 50,
        unit: '%'
      });
    }

    // Safe call to optional helpers
    try { onRuleCategoryChange('danger'); } catch(_) {}
    try { updateRuleConditionsSummary(); } catch(_) {}

    // Bind live typing listeners
    if (ruleTitleInput) ruleTitleInput.oninput = updateRuleLivePreview;
    if (ruleRec) ruleRec.oninput = updateRuleLivePreview;

  } catch (err) {
    console.warn('[ThresholdRule] openAddThresholdRuleModal helper error (modal already open):', err);
  }
}
window.openAddThresholdRuleModal = openAddThresholdRuleModal;

export function editThresholdRule(id) {
  const rule = _currentRules.find(r => r.id === id);
  if (!rule) {
    toast('Không tìm thấy quy tắc cần chỉnh sửa.', 'error');
    return;
  }

  const modal = document.getElementById('threshold-rule-modal');
  if (!modal) {
    console.error('[ThresholdRule] Modal #threshold-rule-modal không tìm thấy trong DOM.');
    return;
  }

  // Show modal FIRST — guaranteed before any DOM manipulation
  modal.style.display = 'flex';
  modal.style.zIndex = '99999';

  try {
    const form = document.getElementById('threshold-rule-form');
    const titleEl = document.getElementById('threshold-modal-title');

    const ruleIdEl = document.getElementById('rule-id');
    const ruleTitleEl = document.getElementById('rule-title');
    const ruleRecEl = document.getElementById('rule-recommendation');

    if (ruleIdEl) ruleIdEl.value = rule.id;
    if (ruleTitleEl) ruleTitleEl.value = rule.title || rule.metric_name || '';
    if (ruleRecEl) ruleRecEl.value = rule.action_recommendation || '';

    const cat = rule.category_type || rule.alert_level || 'warning';
    if (form) {
      const rad = form.querySelector(`input[name="rule_category"][value="${cat}"]`);
      if (rad) rad.checked = true;

      const matchVal = rule.match_type || 'AND';
      const radMatch = form.querySelector(`input[name="rule_match_type"][value="${matchVal}"]`);
      if (radMatch) radMatch.checked = true;
    }

    const actionTypeEl = document.getElementById('rule-action-type');
    if (actionTypeEl && rule.action_type) actionTypeEl.value = rule.action_type;

    const notifyTimeSel = document.getElementById('rule-notify-time-type');
    if (notifyTimeSel) notifyTimeSel.value = rule.notify_time_type || 'instant';
    const customTimeInput = document.getElementById('rule-custom-time');
    if (customTimeInput) customTimeInput.value = rule.custom_time || '07:00';
    const freqSel = document.getElementById('rule-frequency');
    if (freqSel) freqSel.value = rule.frequency || 'always';
    onNotifyTimeTypeChange();

    const offIot = document.getElementById('rule-check-offline-iot');
    if (offIot) offIot.checked = Boolean(rule.check_offline_iot);

    const disHist = document.getElementById('rule-check-disease-history');
    if (disHist) disHist.checked = Boolean(rule.check_disease_history);

    if (rule.reconfirm_event_type) {
      const recEv = document.getElementById('rule-reconfirm-event');
      if (recEv) recEv.value = rule.reconfirm_event_type;
    }

    // Populate dynamic condition rows
    const conditionsContainer = document.getElementById('rule-conditions-list');
    if (conditionsContainer) {
      conditionsContainer.innerHTML = '';
      let conds = [];
      if (rule.conditions_json) {
        try {
          conds = typeof rule.conditions_json === 'string' ? JSON.parse(rule.conditions_json) : rule.conditions_json;
        } catch (_) { conds = []; }
      }
      if (!Array.isArray(conds) || conds.length === 0) {
        conds = [{
          metric_key: rule.metric_key || 'soil_moisture_10cm',
          operator: rule.operator || '<',
          threshold_value: rule.threshold_value !== undefined ? rule.threshold_value : 50,
          unit: rule.unit || '%'
        }];
      }

      conds.forEach(c => addConditionRow(c));
    }

    if (titleEl) titleEl.textContent = 'Chỉnh sửa Quy tắc Cài đặt Ngưỡng';

    // Safe call to optional helpers
    try { onRuleCategoryChange(cat); } catch(_) {}
    try { updateRuleConditionsSummary(); } catch(_) {}

    // Bind live typing listeners
    if (ruleTitleEl) ruleTitleEl.oninput = updateRuleLivePreview;
    if (ruleRecEl) ruleRecEl.oninput = updateRuleLivePreview;

  } catch (err) {
    console.warn('[ThresholdRule] editThresholdRule helper error (modal already open):', err);
  }
}
window.editThresholdRule = editThresholdRule;

export function closeThresholdRuleModal() {
  const modal = document.getElementById('threshold-rule-modal');
  if (modal) modal.style.display = 'none';
}
window.closeThresholdRuleModal = closeThresholdRuleModal;

export async function saveThresholdRule(e) {
  if (e && e.preventDefault) e.preventDefault();

  const form = document.getElementById('threshold-rule-form');
  const id = document.getElementById('rule-id').value;
  const catRad = form ? form.querySelector('input[name="rule_category"]:checked') : null;
  const category = catRad ? catRad.value : 'warning';

  const matchRad = form ? form.querySelector('input[name="rule_match_type"]:checked') : null;
  const matchType = matchRad ? matchRad.value : 'AND';

  const titleVal = document.getElementById('rule-title').value.trim();
  const recVal = document.getElementById('rule-recommendation').value.trim();

  if (!titleVal || !recVal) {
    toast('Vui lòng điền đầy đủ Tên quy tắc và Nội dung khuyến nghị.', 'error');
    return;
  }

  const conditions = getConditionsFromUI();
  const primaryCond = conditions[0] || {
    metric_key: 'soil_moisture_10cm',
    operator: '<',
    threshold_value: 50,
    unit: '%'
  };

  const payload = {
    title: titleVal,
    category_type: category,
    alert_level: category,
    match_type: matchType,
    metric_key: primaryCond.metric_key,
    operator: primaryCond.operator,
    threshold_value: primaryCond.threshold_value,
    action_type: document.getElementById('rule-action-type')?.value || 'Canh tác',
    action_recommendation: recVal,
    conditions_json: conditions,
    notify_time_type: document.getElementById('rule-notify-time-type')?.value || 'instant',
    custom_time: document.getElementById('rule-custom-time')?.value || '07:00',
    frequency: document.getElementById('rule-frequency')?.value || 'always',
    check_offline_iot: document.getElementById('rule-check-offline-iot') ? document.getElementById('rule-check-offline-iot').checked : false,
    check_disease_history: document.getElementById('rule-check-disease-history') ? document.getElementById('rule-check-disease-history').checked : false,
    reconfirm_event_type: document.getElementById('rule-reconfirm-event') ? document.getElementById('rule-reconfirm-event').value : null
  };

  try {
    let res;
    if (id) {
      res = await api(`/notifications/rules/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      res = await api('/notifications/rules', { method: 'POST', body: JSON.stringify(payload) });
    }

    if (res && res.success) {
      toast(res.message || 'Đã lưu quy tắc thành công!', 'success');
      closeThresholdRuleModal();
      loadThresholdRules();
    }
  } catch (err) {
    toast('Lỗi lưu quy tắc: ' + err.message, 'error');
  }
}
window.saveThresholdRule = saveThresholdRule;

export async function toggleThresholdRuleEnabled(id, isEnabled) {
  try {
    await api(`/notifications/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_enabled: isEnabled })
    });
    toast(isEnabled ? 'Đã bật quy tắc cảnh báo.' : 'Đã tắt quy tắc cảnh báo.', 'info');
    loadThresholdRules();
  } catch (err) {
    toast('Lỗi cập nhật trạng thái quy tắc: ' + err.message, 'error');
  }
}
window.toggleThresholdRuleEnabled = toggleThresholdRuleEnabled;

export async function deleteThresholdRule(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa quy tắc cài đặt ngưỡng này?\n\nLưu ý: Sau khi xóa, quy tắc sẽ bị xóa vĩnh viễn và không được tạo lại tự động.')) return;

  // Optimistic UI: remove from local array and rerender immediately
  const ruleIndex = _currentRules.findIndex(r => r.id === id);
  const removedRule = ruleIndex !== -1 ? _currentRules[ruleIndex] : null;

  if (ruleIndex !== -1) {
    _currentRules.splice(ruleIndex, 1);
    renderThresholdRulesUI(_currentRules);
  }

  try {
    const res = await api(`/notifications/rules/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      toast('✅ Đã xóa quy tắc thành công.', 'success');
    } else {
      throw new Error(res?.error || 'Phản hồi không hợp lệ từ server.');
    }
  } catch (err) {
    // Rollback: re-add rule if API failed
    if (removedRule) {
      _currentRules.splice(ruleIndex, 0, removedRule);
      renderThresholdRulesUI(_currentRules);
    }
    toast('❌ Lỗi xóa quy tắc: ' + (err.message || 'Lỗi không xác định'), 'error');
  }
}
window.deleteThresholdRule = deleteThresholdRule;


// ── Điền thông tin vào form ─────────────────────────────────────
function _populateProfileForm(user) {
  _setVal('settings-fullname',  user.full_name  || '');
  _setVal('settings-email',     user.email      || '');
  _setVal('settings-phone',     user.phone      || '');
  _setVal('settings-city',      user.city       || '');
  _setVal('settings-country',   user.country    || '');
  const genderSel = document.getElementById('settings-gender');
  if (genderSel) genderSel.value = user.gender || '';
  const joinEl = document.getElementById('settings-joined');
  if (joinEl && user.created_at) {
    joinEl.textContent = new Date(user.created_at).toLocaleDateString('vi-VN', { year:'numeric', month:'long', day:'numeric' });
  }
}

function _setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

// ── Render avatar ───────────────────────────────────────────────
function _renderAvatar(url, name) {
  const img  = document.getElementById('settings-avatar-img');
  const init = document.getElementById('settings-avatar-initials');
  if (!img || !init) return;
  if (url) {
    img.src = url;
    img.classList.remove('hidden');
    init.classList.add('hidden');
  } else {
    img.classList.add('hidden');
    init.classList.remove('hidden');
    init.textContent = (name || 'N').charAt(0).toUpperCase();
  }
}

// ── Gắn sự kiện một lần ─────────────────────────────────────────
let _bound = false;
function _bindEvents() {
  if (_bound) return;
  _bound = true;

  // Avatar click
  const avatarWrap = document.getElementById('settings-avatar-wrap');
  const avatarInput = document.getElementById('settings-avatar-input');
  if (avatarWrap && avatarInput) {
    avatarWrap.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) uploadUserAvatar(e.target.files[0]);
    });
  }

  // Save profile
  const saveBtn = document.getElementById('settings-save-profile');
  if (saveBtn) saveBtn.addEventListener('click', saveUserProfile);

  // Change password
  const pwBtn = document.getElementById('settings-change-password');
  if (pwBtn) pwBtn.addEventListener('click', changeUserPassword);
}

// ── Upload avatar ────────────────────────────────────────────────
export async function uploadUserAvatar(file) {
  const preview = document.getElementById('settings-avatar-img');
  const wrap    = document.getElementById('settings-avatar-wrap');

  // Show instant local preview
  const reader = new FileReader();
  reader.onload = (e) => {
    if (preview) { preview.src = e.target.result; preview.classList.remove('hidden'); }
    const init = document.getElementById('settings-avatar-initials');
    if (init) init.classList.add('hidden');
  };
  reader.readAsDataURL(file);

  // Spinner on wrap
  wrap && wrap.classList.add('uploading');

  try {
    const form = new FormData();
    form.append('avatar', file);
    const res = await fetch(`${API}/auth/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('pb_token') || ''}` },
      body: form
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi tải ảnh');
    toast('✅ Đã cập nhật ảnh đại diện!', 'success');
  } catch (err) {
    toast('Lỗi: ' + err.message, 'error');
  } finally {
    wrap && wrap.classList.remove('uploading');
  }
}

// ── Lưu thông tin cá nhân ───────────────────────────────────────
export async function saveUserProfile() {
  const btn = document.getElementById('settings-save-profile');
  const orig = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang lưu...'; }

  try {
    const payload = {
      full_name: _getVal('settings-fullname'),
      phone:     _getVal('settings-phone'),
      city:      _getVal('settings-city'),
      country:   _getVal('settings-country'),
      gender:    _getVal('settings-gender'),
    };
    if (!payload.full_name.trim()) { toast('Họ và tên không được bỏ trống.', 'error'); return; }

    const data = await api('/auth/me', { method: 'PUT', body: JSON.stringify(payload) });
    if (data.success) {
      toast('Đã cập nhật thông tin cá nhân!', 'success');
      if (btn) {
        btn.innerHTML = '<i data-lucide="check" class="lucide-sm"></i> Đã lưu';
        btn.classList.add('saved');
        setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('saved'); btn.disabled = false; }, 2500);
      }
    }
  } catch (err) {
    toast('Lỗi: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
  }
}

// ── Đổi mật khẩu ────────────────────────────────────────────────
export async function changeUserPassword() {
  const btn = document.getElementById('settings-change-password');
  const orig = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang xử lý...'; }

  const oldPw  = _getVal('settings-old-password');
  const newPw  = _getVal('settings-new-password');
  const confPw = _getVal('settings-confirm-password');

  if (!oldPw || !newPw || !confPw) {
    toast('Vui lòng điền đầy đủ các trường mật khẩu.', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    return;
  }
  if (newPw !== confPw) {
    toast('Mật khẩu mới và xác nhận không khớp.', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    return;
  }
  if (newPw.length < 6) {
    toast('Mật khẩu mới phải có ít nhất 6 ký tự.', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    return;
  }

  try {
    const data = await api('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw })
    });
    if (data.success) {
      toast('✅ Đổi mật khẩu thành công!', 'success');
      ['settings-old-password','settings-new-password','settings-confirm-password'].forEach(id => _setVal(id,''));
      if (btn) {
        btn.innerHTML = '<i data-lucide="check" class="lucide-sm"></i> Thành công';
        btn.classList.add('saved');
        setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('saved'); btn.disabled = false; }, 2500);
      }
    }
  } catch (err) {
    toast('Lỗi: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
  }
}

function _getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

// ═══════════════════════════════════════════════════════════════════════════
// FARMER SUB-ACCOUNT RBAC ENGINE (QUẢN LÝ & PHÂN QUYỀN TÀI KHOẢN DƯỚI QUYỀN NÔNG HỘ)
// Chuẩn Gallagher 8.30 Field Privilege · 100% Lucide Icons
// ═══════════════════════════════════════════════════════════════════════════

let _cachedTeamData = { farms: [], plants: [], members: [], can_manage_team: true };
let _selectedPlantIdsForMember = new Set();

const SUB_ROLE_META = {
  farm_owner: {
    label: 'Chủ Trang Trại (Owner)',
    icon: 'crown',
    bg: '#ecfdf5',
    border: '#6ee7b7',
    color: '#065f46'
  },
  manager: {
    label: 'Quản Đốc / Kỹ Sư (manager)',
    icon: 'user-check',
    bg: '#f0fdf4',
    border: '#86efac',
    color: '#166534'
  },
  care_worker: {
    label: 'Nhân Công Chăm Sóc (care_worker)',
    icon: 'eye-off',
    bg: '#fffbeb',
    border: '#fcd34d',
    color: '#b45309'
  },
  auditor_readonly: {
    label: 'Kiểm Định Viên VietGAP (auditor_readonly)',
    icon: 'shield',
    bg: '#eff6ff',
    border: '#93c5fd',
    color: '#1e40af'
  }
};

function _extractPlotLabel(plant) {
  if (!plant) return 'Chưa phân lô';
  if (plant.plot_code && String(plant.plot_code).trim()) {
    const pc = String(plant.plot_code).trim();
    return /^lô\s+/i.test(pc) ? pc : `Lô ${pc}`;
  }
  if (plant.location && String(plant.location).trim()) {
    const firstPart = String(plant.location).split(',')[0].trim();
    if (firstPart) return firstPart;
  }
  return 'Chưa phân lô';
}

function _getPlantsForSelectedFarm(farmId) {
  const allPlants = Array.isArray(_cachedTeamData.plants) ? _cachedTeamData.plants : [];
  if (!farmId) return allPlants;
  return allPlants.filter(p => String(p.farm_id) === String(farmId));
}

export function applySubRoleUiRestrictions(user) {
  if (!user) return;
  const subRole = user.sub_role || 'farm_owner';
  const hideFinance = user.role !== 'admin' && (
    user.allow_view_finance === false ||
    ['care_worker', 'auditor_readonly'].includes(subRole)
  );
  window._isFinanceRedactedForCurrentUser = hideFinance;

  const ownerActions = document.getElementById('farmer-team-owner-actions');
  if (ownerActions) {
    ownerActions.style.display = (user.parent_user_id || ['care_worker', 'auditor_readonly'].includes(subRole)) ? 'none' : 'flex';
  }

  if (hideFinance) {
    const finIds = [
      'erp-harvest-total-revenue',
      'erp-harvest-net-profit',
      'erp-cost-total-amount',
      'erp-cost-fertilizer-amount',
      'erp-cost-pesticide-amount',
      'erp-cost-water-amount'
    ];
    finIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<span style="font-size:12px; color:#b45309;"><i data-lucide="eye-off" class="lucide-xs"></i> Đã ẩn (Redacted)</span>';
    });
  }
}
window.applySubRoleUiRestrictions = applySubRoleUiRestrictions;

export async function loadFarmerTeamRbac() {
  const container = document.getElementById('farmer-team-members-list');
  if (container) {
    container.innerHTML = `
      <div style="text-align:center; padding:28px; color:#64748b; font-size:13px;">
        <i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang tải danh sách tài khoản nhân sự &amp; cây trồng trang trại...
      </div>
    `;
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  }

  try {
    const data = await api('/users/my-team');
    if (data && data.success) {
      _cachedTeamData = {
        ...data,
        farms: data.farms || [],
        plants: data.plants || [],
        members: data.members || []
      };
      renderFarmerTeamListUI(_cachedTeamData);
    }
  } catch (err) {
    if (container) {
      container.innerHTML = `
        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:14px; padding:18px; color:#b91c1c; font-size:13px; text-align:center;">
          <i data-lucide="alert-triangle" class="lucide-sm"></i> Không thể tải danh sách nhân sự: ${esc(err.message)}
        </div>
      `;
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
    }
  }
}
window.loadFarmerTeamRbac = loadFarmerTeamRbac;

function renderFarmerTeamListUI(data) {
  const container = document.getElementById('farmer-team-members-list');
  if (!container) return;

  const members = data.members || [];
  const allPlants = data.plants || [];
  const plantMap = new Map(allPlants.map(p => [Number(p.id), p]));
  const canManage = data.can_manage_team !== false;
  const primaryFarmId = (data.farms && data.farms[0]) ? data.farms[0].id : '';

  if (members.length === 0) {
    container.innerHTML = `
      <div style="background:#ffffff; border:1.5px dashed #cbd5e1; border-radius:18px; padding:34px 22px; text-align:center;">
        <div style="width:54px; height:54px; border-radius:15px; background:#ecfdf5; color:#059669; display:flex; align-items:center; justify-content:center; margin:0 auto 12px auto; border:1px solid #a7f3d0;">
          <i data-lucide="users" class="lucide-md"></i>
        </div>
        <h4 style="margin:0 0 6px 0; font-size:16px; font-weight:800; color:#0f172a;">Chưa có tài khoản nhân sự dưới quyền nào</h4>
        <p style="margin:0 auto 18px auto; max-width:540px; font-size:13px; color:#64748b; line-height:1.55;">
          Hãy tạo tài khoản riêng cho <strong>Nhân công chăm sóc (<code>care_worker</code>)</strong> hoặc <strong>Kiểm định viên (<code>auditor_readonly</code>)</strong>, giao phụ trách từng lô/cây cụ thể để họ ghi nhật ký thực địa mà không nhìn thấy đơn giá vật tư, chi phí đầu tư và doanh thu của trang trại.
        </p>
        ${canManage ? `
          <button type="button" onclick="openFarmerTeamMemberModal()" style="background:linear-gradient(135deg, #10b981, #047857); color:#ffffff; border:none; padding:11px 22px; font-size:13px; font-weight:800; border-radius:11px; cursor:pointer; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 14px rgba(5,150,105,0.28);">
            <i data-lucide="user-plus" class="lucide-sm"></i> Tạo Tài Khoản Nhân Công Đầu Tiên
          </button>
        ` : ''}
      </div>
    `;
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
    return;
  }

  container.innerHTML = members.map(m => {
    const roleMeta = SUB_ROLE_META[m.sub_role] || SUB_ROLE_META.care_worker;
    const isFinanceHidden = !m.allow_view_finance;
    const assignedIds = Array.isArray(m.assigned_plant_ids) ? m.assigned_plant_ids.map(Number).filter(Boolean) : [];
    const assignedPlants = assignedIds.map(id => plantMap.get(id)).filter(Boolean);

    const scopeLabel = m.view_plants_scope === 'assigned'
      ? `Giao phụ trách riêng (${assignedIds.length} cây)`
      : 'Toàn bộ cây trong vườn';
    const farmIdForLink = m.farm_id || primaryFarmId || 1;

    let assignedBadgesHtml = '';
    if (m.view_plants_scope === 'assigned') {
      if (assignedPlants.length > 0) {
        const previewPlants = assignedPlants.slice(0, 8);
        const remainingCount = assignedPlants.length - previewPlants.length;
        assignedBadgesHtml = `
          <div style="margin-top:8px; padding:8px 10px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span style="font-size:11px; font-weight:800; color:#065f46; display:inline-flex; align-items:center; gap:4px;">
              <i data-lucide="trees" class="lucide-xs" style="color:#059669;"></i> Cây phụ trách:
            </span>
            ${previewPlants.map(p => {
              const code = p.tree_code ? `#${p.tree_code}` : `#ID-${p.id}`;
              const plot = _extractPlotLabel(p);
              return `<span style="font-size:11px; font-weight:700; background:#ffffff; color:#047857; border:1px solid #86efac; padding:2px 8px; border-radius:6px;">${esc(code)} · ${esc(plot)}</span>`;
            }).join('')}
            ${remainingCount > 0 ? `<span style="font-size:11px; font-weight:800; color:#047857; background:#dcfce7; padding:2px 8px; border-radius:6px;">+${remainingCount} cây khác</span>` : ''}
          </div>
        `;
      } else {
        assignedBadgesHtml = `
          <div style="margin-top:8px; padding:6px 10px; background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; font-size:11.5px; color:#c2410c; font-weight:700; display:inline-flex; align-items:center; gap:6px;">
            <i data-lucide="alert-circle" class="lucide-xs"></i> Chưa chọn cây phụ trách cụ thể — Bấm "Sửa quyền" để giao cây
          </div>
        `;
      }
    }

    return `
      <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:16px; padding:18px 20px; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:14px; box-shadow:0 4px 12px rgba(15,23,42,0.03); transition:all 0.15s;">
        <div style="display:flex; align-items:flex-start; gap:14px; min-width:260px; flex:1;">
          <div style="width:46px; height:46px; border-radius:13px; background:${roleMeta.bg}; border:1.5px solid ${roleMeta.border}; color:${roleMeta.color}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <i data-lucide="${roleMeta.icon}" class="lucide-sm"></i>
          </div>
          <div style="min-width:0; flex:1;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <strong style="font-size:15.5px; font-weight:800; color:#0f172a;">${esc(m.full_name)}</strong>
              <span style="font-size:11px; font-weight:800; background:${roleMeta.bg}; color:${roleMeta.color}; border:1px solid ${roleMeta.border}; padding:2px 9px; border-radius:999px; display:inline-flex; align-items:center; gap:4px;">
                <i data-lucide="${roleMeta.icon}" class="lucide-xs"></i> ${esc(roleMeta.label)}
              </span>
              <span style="font-size:11px; font-family:monospace; color:#64748b; background:#f1f5f9; padding:2px 7px; border-radius:6px;">
                ${esc(m.public_id || ('usr-' + m.id))}
              </span>
            </div>

            <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-top:6px; font-size:12.5px; color:#475569;">
              <span style="display:inline-flex; align-items:center; gap:5px;">
                <i data-lucide="phone" class="lucide-xs" style="color:#059669;"></i>
                <strong>${esc(m.phone || m.email || '—')}</strong>
              </span>
              <span style="display:inline-flex; align-items:center; gap:5px;">
                <i data-lucide="map-pin" class="lucide-xs" style="color:#0284c7;"></i>
                ${esc(m.farm_name || 'Trang trại nông hộ')}
              </span>
              <span style="display:inline-flex; align-items:center; gap:5px; font-weight:700; color:${m.view_plants_scope === 'assigned' ? '#047857' : '#334155'};">
                <i data-lucide="sprout" class="lucide-xs" style="color:#16a34a;"></i>
                ${esc(scopeLabel)}
              </span>
            </div>

            ${assignedBadgesHtml}

            <!-- Privilege Badges -->
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:8px;">
              ${isFinanceHidden ? `
                <span style="font-size:11.5px; font-weight:800; background:#fef3c7; color:#b45309; border:1px solid #fde68a; padding:3px 10px; border-radius:8px; display:inline-flex; align-items:center; gap:5px;">
                  <i data-lucide="eye-off" class="lucide-xs"></i> Tự động ẩn Đơn giá, Chi phí &amp; Doanh thu (redacted: true)
                </span>
              ` : `
                <span style="font-size:11.5px; font-weight:700; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:3px 10px; border-radius:8px; display:inline-flex; align-items:center; gap:5px;">
                  <i data-lucide="eye" class="lucide-xs"></i> Được phép xem Chi phí &amp; Doanh thu
                </span>
              `}
              <span style="font-size:11.5px; font-weight:700; background:#f8fafc; color:#334155; border:1px solid #cbd5e1; padding:3px 10px; border-radius:8px; display:inline-flex; align-items:center; gap:5px;">
                <i data-lucide="package" class="lucide-xs"></i> Kho vật tư kỹ thuật: ${m.allow_view_supplies !== false ? 'Cho phép' : 'Hạn chế'}
              </span>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <button type="button" onclick="copyTeamMemberRoleApiLink('${esc(m.sub_role)}', '${esc(String(farmIdForLink))}')" title="Sao chép Link Live API phân quyền theo vai trò của nhân sự này" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:7px 12px; border-radius:9px; font-size:12px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
            <i data-lucide="webhook" class="lucide-xs"></i> Link API (?role=${esc(m.sub_role)})
          </button>
          ${canManage ? `
            <button type="button" onclick="toggleTeamMemberFinance(${m.id}, ${!m.allow_view_finance})" title="Bật/Tắt nhanh quyền xem giá & doanh thu" style="background:${isFinanceHidden ? '#fffbeb' : '#f0fdf4'}; color:${isFinanceHidden ? '#b45309' : '#047857'}; border:1px solid ${isFinanceHidden ? '#fde68a' : '#a7f3d0'}; padding:7px 12px; border-radius:9px; font-size:12px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
              <i data-lucide="${isFinanceHidden ? 'eye-off' : 'eye'}" class="lucide-xs"></i> ${isFinanceHidden ? 'Đang ẩn giá' : 'Đang hiện giá'}
            </button>
            <button type="button" onclick="openFarmerTeamMemberModal(${m.id})" style="background:#ecfdf5; color:#065f46; border:1px solid #6ee7b7; padding:7px 12px; border-radius:9px; font-size:12px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
              <i data-lucide="edit-3" class="lucide-xs"></i> Sửa quyền / Giao cây
            </button>
            <button type="button" onclick="deleteFarmerTeamMember(${m.id}, '${esc(m.full_name)}')" style="background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:7px 10px; border-radius:9px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
              <i data-lucide="trash-2" class="lucide-xs"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (typeof window.refreshIcons === 'function') window.refreshIcons();
}

export function selectTeamMemberRoleCard(roleVal) {
  const roleSel = document.getElementById('team-member-subrole');
  if (roleSel) {
    roleSel.value = roleVal;
  }
  onTeamMemberSubRoleChange();
}
window.selectTeamMemberRoleCard = selectTeamMemberRoleCard;

export function onTeamMemberSubRoleChange() {
  const roleSel = document.getElementById('team-member-subrole');
  const finChk = document.getElementById('team-member-allow-finance');
  const descBox = document.getElementById('team-member-role-desc');
  if (!roleSel) return;

  const val = roleSel.value || 'care_worker';

  // Highlight active visual role card
  const cardConfigs = {
    care_worker: { activeBorder: '#f59e0b', activeBg: '#fffbeb' },
    manager: { activeBorder: '#10b981', activeBg: '#ecfdf5' },
    auditor_readonly: { activeBorder: '#3b82f6', activeBg: '#eff6ff' }
  };
  ['care_worker', 'manager', 'auditor_readonly'].forEach(r => {
    const card = document.getElementById(`role-card-${r}`);
    if (!card) return;
    if (r === val) {
      card.style.border = `2px solid ${cardConfigs[r].activeBorder}`;
      card.style.background = cardConfigs[r].activeBg;
      card.style.boxShadow = '0 4px 12px rgba(15,23,42,0.06)';
    } else {
      card.style.border = '1.5px solid #e2e8f0';
      card.style.background = '#f8fafc';
      card.style.boxShadow = 'none';
    }
  });

  if (val === 'care_worker') {
    if (finChk) finChk.checked = false;
    if (descBox) {
      descBox.style.background = '#fffbeb';
      descBox.style.borderColor = '#fde68a';
      descBox.style.color = '#b45309';
      descBox.innerHTML = `<i data-lucide="eye-off" class="lucide-sm" style="flex-shrink:0;"></i><span><strong>Nhân công chăm sóc (care_worker):</strong> Chỉ xem thông số kỹ thuật &amp; ghi nhật ký thực địa. Tự động ẩn (<code>redacted: true</code>) đơn giá vật tư, tổng chi phí đầu tư và doanh thu thu hoạch.</span>`;
    }
  } else if (val === 'auditor_readonly') {
    if (finChk) finChk.checked = false;
    if (descBox) {
      descBox.style.background = '#eff6ff';
      descBox.style.borderColor = '#bfdbfe';
      descBox.style.color = '#1e40af';
      descBox.innerHTML = `<i data-lucide="shield" class="lucide-sm" style="flex-shrink:0;"></i><span><strong>Kiểm định viên VietGAP (auditor_readonly):</strong> Chỉ xem hồ sơ kỹ thuật, lịch sử canh tác, chuỗi băm SHA-256 và tín chỉ Carbon MRV. Tự động ẩn toàn bộ chi phí &amp; doanh thu nhạy cảm.</span>`;
    }
  } else {
    if (finChk) finChk.checked = true;
    if (descBox) {
      descBox.style.background = '#f0fdf4';
      descBox.style.borderColor = '#86efac';
      descBox.style.color = '#065f46';
      descBox.innerHTML = `<i data-lucide="user-check" class="lucide-sm" style="flex-shrink:0;"></i><span><strong>Quản đốc / Kỹ sư trưởng (manager):</strong> Hỗ trợ chủ vườn quản lý kỹ thuật, kho vật tư và theo dõi chi phí vận hành trang trại.</span>`;
    }
  }
  if (typeof window.refreshIcons === 'function') window.refreshIcons();
}
window.onTeamMemberSubRoleChange = onTeamMemberSubRoleChange;

export function setTeamMemberPlantScope(scopeVal) {
  const scopeSel = document.getElementById('team-member-plant-scope');
  if (scopeSel) {
    scopeSel.value = scopeVal === 'assigned' ? 'assigned' : 'all';
  }
  onTeamMemberFarmOrScopeChange();
}
window.setTeamMemberPlantScope = setTeamMemberPlantScope;

export async function onTeamMemberFarmOrScopeChange() {
  const scopeSel = document.getElementById('team-member-plant-scope');
  const farmSel = document.getElementById('team-member-farm-id');
  const pickerBox = document.getElementById('team-member-plant-picker-box');
  const btnAll = document.getElementById('btn-scope-all');
  const btnAssigned = document.getElementById('btn-scope-assigned');

  const scope = scopeSel ? scopeSel.value : 'all';
  const farmId = farmSel ? farmSel.value : '';

  if (btnAll && btnAssigned) {
    if (scope === 'assigned') {
      btnAssigned.style.background = '#059669';
      btnAssigned.style.color = '#ffffff';
      btnAssigned.style.boxShadow = '0 2px 8px rgba(5,150,105,0.28)';
      btnAll.style.background = 'transparent';
      btnAll.style.color = '#475569';
      btnAll.style.boxShadow = 'none';
    } else {
      btnAll.style.background = '#ffffff';
      btnAll.style.color = '#065f46';
      btnAll.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
      btnAssigned.style.background = 'transparent';
      btnAssigned.style.color = '#475569';
      btnAssigned.style.boxShadow = 'none';
    }
  }

  if (!pickerBox) return;

  if (scope !== 'assigned') {
    pickerBox.style.display = 'none';
    return;
  }

  pickerBox.style.display = 'block';

  // Ensure we have plants loaded for this farm
  let farmPlants = _getPlantsForSelectedFarm(farmId);
  if (farmPlants.length === 0 && farmId) {
    try {
      const fetched = await api(`/plants?farm_id=${encodeURIComponent(farmId)}`);
      if (Array.isArray(fetched) && fetched.length > 0) {
        const existingIds = new Set((_cachedTeamData.plants || []).map(p => Number(p.id)));
        fetched.forEach(p => {
          if (!existingIds.has(Number(p.id))) {
            if (!Array.isArray(_cachedTeamData.plants)) _cachedTeamData.plants = [];
            _cachedTeamData.plants.push(p);
          }
        });
      }
    } catch (_) {}
  }

  renderTeamMemberPlantGrid();
}
window.onTeamMemberFarmOrScopeChange = onTeamMemberFarmOrScopeChange;

export function renderTeamMemberPlantGrid() {
  const farmSel = document.getElementById('team-member-farm-id');
  const gridEl = document.getElementById('team-member-plants-grid');
  const countEl = document.getElementById('team-member-selected-plants-count');
  const plotWrap = document.getElementById('team-member-plot-chips-wrap');
  const plotChipsEl = document.getElementById('team-member-plot-chips');
  const searchInput = document.getElementById('team-member-plant-search');
  const editMemberId = Number(document.getElementById('team-member-edit-id')?.value || 0);

  if (!gridEl) return;

  const farmId = farmSel ? farmSel.value : '';
  const farmPlants = _getPlantsForSelectedFarm(farmId);

  // Filter selected IDs that belong to this farm for accurate counter
  const selectedInFarmCount = farmPlants.filter(p => _selectedPlantIdsForMember.has(Number(p.id))).length;
  if (countEl) {
    countEl.textContent = `Đã chọn ${selectedInFarmCount} / ${farmPlants.length} cây`;
  }

  if (farmPlants.length === 0) {
    if (plotWrap) plotWrap.style.display = 'none';
    gridEl.innerHTML = `
      <div style="grid-column:1 / -1; text-align:center; padding:22px 14px; background:#ffffff; border:1px dashed #cbd5e1; border-radius:10px; color:#64748b; font-size:12.5px;">
        <i data-lucide="sprout" class="lucide-sm" style="color:#94a3b8; margin-bottom:4px;"></i>
        <div>Trang trại này hiện chưa có cây trồng nào được khởi tạo.</div>
      </div>
    `;
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
    return;
  }

  // Group by Plot for Plot Quick-Select Chips
  const plotGroups = new Map();
  farmPlants.forEach(p => {
    const plotName = _extractPlotLabel(p);
    if (!plotGroups.has(plotName)) plotGroups.set(plotName, []);
    plotGroups.get(plotName).push(p);
  });

  if (plotWrap && plotChipsEl) {
    if (plotGroups.size > 0) {
      plotWrap.style.display = 'block';
      plotChipsEl.innerHTML = Array.from(plotGroups.entries()).map(([plotName, pList]) => {
        const selCount = pList.filter(p => _selectedPlantIdsForMember.has(Number(p.id))).length;
        const allSelected = selCount === pList.length && pList.length > 0;
        const someSelected = selCount > 0 && !allSelected;
        const safePlot = esc(plotName).replace(/'/g, "\\'");
        return `
          <button type="button" onclick="togglePlotPlantsForMember('${safePlot}')" style="padding:5px 11px; border-radius:999px; font-size:11.5px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:all 0.15s; border:1.5px solid ${allSelected ? '#059669' : (someSelected ? '#0284c7' : '#cbd5e1')}; background:${allSelected ? '#059669' : (someSelected ? '#e0f2fe' : '#ffffff')}; color:${allSelected ? '#ffffff' : (someSelected ? '#0369a1' : '#334155')};">
            <i data-lucide="${allSelected ? 'check-circle-2' : 'layers'}" class="lucide-xs"></i>
            <span>${esc(plotName)}</span>
            <span style="font-size:10.5px; opacity:0.88;">(${selCount}/${pList.length})</span>
          </button>
        `;
      }).join('');
    } else {
      plotWrap.style.display = 'none';
    }
  }

  // Filter by search keyword
  const kw = (searchInput ? searchInput.value : '').trim().toLowerCase();
  const filteredPlants = kw
    ? farmPlants.filter(p => {
        const code = String(p.tree_code || p.id || '').toLowerCase();
        const type = String(p.plant_type || '').toLowerCase();
        const variety = String(p.plant_variety || '').toLowerCase();
        const loc = String(p.location || '').toLowerCase();
        const plot = _extractPlotLabel(p).toLowerCase();
        return code.includes(kw) || type.includes(kw) || variety.includes(kw) || loc.includes(kw) || plot.includes(kw);
      })
    : farmPlants;

  if (filteredPlants.length === 0) {
    gridEl.innerHTML = `
      <div style="grid-column:1 / -1; text-align:center; padding:18px; color:#64748b; font-size:12px;">
        Không tìm thấy cây trồng nào khớp với từ khóa "${esc(kw)}".
      </div>
    `;
    return;
  }

  gridEl.innerHTML = filteredPlants.map((p, idx) => {
    const pid = Number(p.id);
    const isChecked = _selectedPlantIdsForMember.has(pid);
    const codeLabel = p.tree_code ? `#${p.tree_code}` : `#Cây-${idx + 1}`;
    const plotLabel = _extractPlotLabel(p);
    const rowLabel = p.row_number ? ` · Hàng ${p.row_number}` : '';
    const typeVariety = [p.plant_type || 'Cây trồng', p.plant_variety || ''].filter(Boolean).join(' · ');
    const health = p.health_status || 'Tốt';
    const healthColor = health === 'Tốt' ? '#10b981' : (health.includes('Bệnh') ? '#ef4444' : '#f59e0b');
    const assignedOther = p.assigned_to_user_id && Number(p.assigned_to_user_id) !== editMemberId
      ? (p.assigned_to_name || `NV #${p.assigned_to_user_id}`)
      : null;

    return `
      <div onclick="toggleSinglePlantForMember(${pid})" style="cursor:pointer; user-select:none; border-radius:11px; padding:9px 11px; border:${isChecked ? '2px solid #059669' : '1.5px solid #e2e8f0'}; background:${isChecked ? '#ecfdf5' : '#ffffff'}; display:flex; align-items:flex-start; gap:9px; transition:all 0.12s; box-shadow:${isChecked ? '0 3px 10px rgba(5,150,105,0.12)' : 'none'};">
        <div style="width:20px; height:20px; border-radius:6px; border:1.5px solid ${isChecked ? '#059669' : '#cbd5e1'}; background:${isChecked ? '#059669' : '#f8fafc'}; color:#ffffff; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px;">
          ${isChecked ? '<i data-lucide="check" class="lucide-xs"></i>' : ''}
        </div>
        <div style="min-width:0; flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:4px;">
            <strong style="font-size:12.5px; font-weight:800; color:${isChecked ? '#064e3b' : '#0f172a'}; font-family:monospace;">${esc(codeLabel)}</strong>
            <span style="width:7px; height:7px; border-radius:50%; background:${healthColor}; flex-shrink:0;" title="Sức khỏe: ${esc(health)}"></span>
          </div>
          <div style="font-size:11.5px; font-weight:700; color:#334155; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px;">
            ${esc(typeVariety)}
          </div>
          <div style="font-size:10.5px; font-weight:700; color:#0284c7; margin-top:2px;">
            ${esc(plotLabel)}${esc(rowLabel)}
          </div>
          ${assignedOther ? `
            <div style="font-size:10px; color:#b45309; background:#fef3c7; padding:1px 5px; border-radius:4px; margin-top:3px; display:inline-block;">
              Đang giao: ${esc(assignedOther)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (typeof window.refreshIcons === 'function') window.refreshIcons();
}
window.renderTeamMemberPlantGrid = renderTeamMemberPlantGrid;

export function toggleSinglePlantForMember(plantId) {
  const pid = Number(plantId);
  if (_selectedPlantIdsForMember.has(pid)) {
    _selectedPlantIdsForMember.delete(pid);
  } else {
    _selectedPlantIdsForMember.add(pid);
  }
  renderTeamMemberPlantGrid();
}
window.toggleSinglePlantForMember = toggleSinglePlantForMember;

export function togglePlotPlantsForMember(plotName) {
  const farmId = document.getElementById('team-member-farm-id')?.value || '';
  const farmPlants = _getPlantsForSelectedFarm(farmId);
  const plotPlants = farmPlants.filter(p => _extractPlotLabel(p) === plotName);
  if (plotPlants.length === 0) return;

  const allSelected = plotPlants.every(p => _selectedPlantIdsForMember.has(Number(p.id)));
  plotPlants.forEach(p => {
    const pid = Number(p.id);
    if (allSelected) {
      _selectedPlantIdsForMember.delete(pid);
    } else {
      _selectedPlantIdsForMember.add(pid);
    }
  });
  renderTeamMemberPlantGrid();
}
window.togglePlotPlantsForMember = togglePlotPlantsForMember;

export function selectAllFarmPlantsForMember(selectAll = true) {
  const farmId = document.getElementById('team-member-farm-id')?.value || '';
  const farmPlants = _getPlantsForSelectedFarm(farmId);
  farmPlants.forEach(p => {
    const pid = Number(p.id);
    if (selectAll) {
      _selectedPlantIdsForMember.add(pid);
    } else {
      _selectedPlantIdsForMember.delete(pid);
    }
  });
  renderTeamMemberPlantGrid();
}
window.selectAllFarmPlantsForMember = selectAllFarmPlantsForMember;

export function selectFarmPlantRangeForMember() {
  const fromVal = parseInt(document.getElementById('team-member-range-from')?.value || '', 10);
  const toVal = parseInt(document.getElementById('team-member-range-to')?.value || '', 10);
  if (isNaN(fromVal) || isNaN(toVal) || fromVal > toVal) {
    toast('Vui lòng nhập dải STT hợp lệ (VD: Từ 1 đến 20).', 'error');
    return;
  }
  const farmId = document.getElementById('team-member-farm-id')?.value || '';
  const farmPlants = _getPlantsForSelectedFarm(farmId);
  let matched = 0;

  farmPlants.forEach((p, index) => {
    const stt = index + 1;
    const codeNum = p.tree_code && /^\d+$/.test(String(p.tree_code).trim()) ? parseInt(String(p.tree_code).trim(), 10) : null;
    if ((stt >= fromVal && stt <= toVal) || (codeNum !== null && codeNum >= fromVal && codeNum <= toVal)) {
      _selectedPlantIdsForMember.add(Number(p.id));
      matched++;
    }
  });

  renderTeamMemberPlantGrid();
  toast(`Đã tích chọn ${matched} cây trong dải [${fromVal} - ${toVal}].`, 'success');
}
window.selectFarmPlantRangeForMember = selectFarmPlantRangeForMember;

export async function openFarmerTeamMemberModal(memberId = null) {
  const modal = document.getElementById('farmer-team-member-modal');
  if (!modal) return;

  // Ensure team & farm plants data is loaded
  if (!_cachedTeamData.farms || _cachedTeamData.farms.length === 0 || !_cachedTeamData.plants || _cachedTeamData.plants.length === 0) {
    try {
      const data = await api('/users/my-team');
      if (data && data.success) {
        _cachedTeamData = {
          ...data,
          farms: data.farms || [],
          plants: data.plants || [],
          members: data.members || []
        };
      }
    } catch (_) {}
  }

  const farmSel = document.getElementById('team-member-farm-id');
  const farms = (_cachedTeamData && _cachedTeamData.farms && _cachedTeamData.farms.length > 0)
    ? _cachedTeamData.farms
    : ((typeof window.getFarmsCache === 'function' ? window.getFarmsCache() : []) || []);

  if (farmSel) {
    farmSel.innerHTML = farms.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('') || `<option value="">Trang trại mặc định</option>`;
  }

  const editIdInput = document.getElementById('team-member-edit-id');
  const titleEl = document.getElementById('farmer-team-modal-title');
  const nameInput = document.getElementById('team-member-fullname');
  const phoneInput = document.getElementById('team-member-phone');
  const emailInput = document.getElementById('team-member-email');
  const passInput = document.getElementById('team-member-password');
  const passLabel = document.getElementById('team-member-pass-label');
  const subRoleSel = document.getElementById('team-member-subrole');
  const scopeSel = document.getElementById('team-member-plant-scope');
  const supChk = document.getElementById('team-member-allow-supplies');
  const finChk = document.getElementById('team-member-allow-finance');
  const searchInput = document.getElementById('team-member-plant-search');
  if (searchInput) searchInput.value = '';

  _selectedPlantIdsForMember = new Set();

  if (memberId) {
    const member = (_cachedTeamData.members || []).find(m => Number(m.id) === Number(memberId));
    if (!member) return;
    if (editIdInput) editIdInput.value = String(member.id);
    if (titleEl) titleEl.textContent = `Cập Nhật Phân Quyền: ${member.full_name}`;
    if (nameInput) nameInput.value = member.full_name || '';
    if (phoneInput) phoneInput.value = member.phone || '';
    if (emailInput) emailInput.value = member.email || '';
    if (passInput) {
      passInput.value = '';
      passInput.required = false;
      passInput.placeholder = 'Để trống nếu giữ nguyên mật khẩu cũ';
    }
    if (passLabel) passLabel.innerHTML = `<i data-lucide="key-round" class="lucide-xs" style="color:#059669;"></i> Đổi mật khẩu (Tùy chọn)`;
    if (subRoleSel) subRoleSel.value = member.sub_role || 'care_worker';
    if (farmSel && member.farm_id) farmSel.value = String(member.farm_id);
    if (scopeSel) scopeSel.value = member.view_plants_scope || 'all';
    if (supChk) supChk.checked = member.allow_view_supplies !== false;
    if (Array.isArray(member.assigned_plant_ids)) {
      member.assigned_plant_ids.forEach(id => {
        if (id) _selectedPlantIdsForMember.add(Number(id));
      });
    }
    onTeamMemberSubRoleChange();
    if (finChk) finChk.checked = Boolean(member.allow_view_finance);
  } else {
    if (editIdInput) editIdInput.value = '';
    if (titleEl) titleEl.textContent = 'Thêm Tài Khoản Nhân Sự Dưới Quyền';
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (emailInput) emailInput.value = '';
    if (passInput) {
      passInput.value = '';
      passInput.required = true;
      passInput.placeholder = 'Nhập mật khẩu cấp cho nhân sự';
    }
    if (passLabel) passLabel.innerHTML = `<i data-lucide="key-round" class="lucide-xs" style="color:#059669;"></i> Mật khẩu đăng nhập <span style="color:#ef4444">*</span>`;
    if (subRoleSel) subRoleSel.value = 'care_worker';
    if (scopeSel) scopeSel.value = 'all';
    if (supChk) supChk.checked = true;
    onTeamMemberSubRoleChange();
  }

  modal.style.display = 'flex';
  await onTeamMemberFarmOrScopeChange();
  if (typeof window.refreshIcons === 'function') window.refreshIcons();
}
window.openFarmerTeamMemberModal = openFarmerTeamMemberModal;

export function closeFarmerTeamMemberModal() {
  const modal = document.getElementById('farmer-team-member-modal');
  if (modal) modal.style.display = 'none';
}
window.closeFarmerTeamMemberModal = closeFarmerTeamMemberModal;

export async function submitFarmerTeamMemberForm() {
  const editId = document.getElementById('team-member-edit-id')?.value;
  const full_name = document.getElementById('team-member-fullname')?.value.trim();
  const phone = document.getElementById('team-member-phone')?.value.trim();
  const email = document.getElementById('team-member-email')?.value.trim();
  const password = document.getElementById('team-member-password')?.value;
  const sub_role = document.getElementById('team-member-subrole')?.value || 'care_worker';
  const farm_id = document.getElementById('team-member-farm-id')?.value || null;
  const view_plants_scope = document.getElementById('team-member-plant-scope')?.value || 'all';
  const allow_view_supplies = document.getElementById('team-member-allow-supplies')?.checked !== false;
  const allow_view_finance = Boolean(document.getElementById('team-member-allow-finance')?.checked);

  if (!full_name) {
    toast('Vui lòng nhập họ và tên nhân sự.', 'error');
    return;
  }
  if (!editId && (!password || !password.trim())) {
    toast('Vui lòng nhập mật khẩu cấp cho tài khoản nhân sự.', 'error');
    return;
  }

  const assigned_plant_ids = view_plants_scope === 'assigned'
    ? Array.from(_selectedPlantIdsForMember)
    : [];

  if (view_plants_scope === 'assigned' && assigned_plant_ids.length === 0) {
    toast('Bạn đang chọn "Giao cây cụ thể" — Vui lòng tích chọn ít nhất 1 cây trồng hoặc chọn nhanh theo Lô bên dưới!', 'error');
    return;
  }

  const btn = document.getElementById('btn-submit-team-member');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang lưu...`;
  }

  try {
    const endpoint = editId ? `/users/my-team/${editId}` : '/users/my-team';
    const method = editId ? 'PUT' : 'POST';
    const res = await api(endpoint, {
      method,
      body: JSON.stringify({
        full_name,
        phone,
        email,
        password,
        sub_role,
        farm_id,
        view_plants_scope,
        allow_view_supplies,
        allow_view_finance,
        assigned_plant_ids
      })
    });

    if (res && res.success) {
      toast(res.message || 'Đã lưu phân quyền nhân sự thành công!', 'success');
      closeFarmerTeamMemberModal();
      loadFarmerTeamRbac();
    }
  } catch (err) {
    toast(err.message || 'Lỗi khi lưu tài khoản nhân sự.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
    }
  }
}
window.submitFarmerTeamMemberForm = submitFarmerTeamMemberForm;

export async function toggleTeamMemberFinance(memberId, nextVal) {
  try {
    const res = await api(`/users/my-team/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ allow_view_finance: Boolean(nextVal) })
    });
    if (res && res.success) {
      toast(
        nextVal
          ? 'Đã CHO PHÉP tài khoản này xem đơn giá vật tư & doanh thu.'
          : 'Đã ẨN TỰ ĐỘNG (redacted: true) đơn giá vật tư, chi phí & doanh thu đối với tài khoản này.',
        'success'
      );
      loadFarmerTeamRbac();
    }
  } catch (err) {
    toast('Lỗi cập nhật quyền tài chính: ' + err.message, 'error');
  }
}
window.toggleTeamMemberFinance = toggleTeamMemberFinance;

export async function copyTeamMemberRoleApiLink(subRole, farmId) {
  try {
    const targetFarmId = farmId || ((_cachedTeamData.farms && _cachedTeamData.farms[0]) ? _cachedTeamData.farms[0].id : 1);
    const keyRes = await api(`/farms/${targetFarmId}/live-api-key`);
    const baseUrl = keyRes.live_api_url || `${window.location.origin}/api/farms/${targetFarmId}/live-stream?api_key=${keyRes.api_key}`;
    const roleUrl = `${baseUrl}&role=${encodeURIComponent(subRole || 'care_worker')}`;
    await navigator.clipboard.writeText(roleUrl);
    toast(`Đã sao chép Link Live API phân quyền (?role=${subRole}) — Tự động ẩn tài chính (redacted: true)!`, 'success');
  } catch (err) {
    toast('Không thể sao chép Link API: ' + err.message, 'error');
  }
}
window.copyTeamMemberRoleApiLink = copyTeamMemberRoleApiLink;

export async function deleteFarmerTeamMember(memberId, memberName) {
  if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản nhân sự "${memberName}" khỏi trang trại không?`)) return;
  try {
    const res = await api(`/users/my-team/${memberId}`, { method: 'DELETE' });
    if (res && res.success) {
      toast(res.message || 'Đã xóa tài khoản nhân sự.', 'success');
      loadFarmerTeamRbac();
    }
  } catch (err) {
    toast('Lỗi khi xóa nhân sự: ' + err.message, 'error');
  }
}
window.deleteFarmerTeamMember = deleteFarmerTeamMember;


