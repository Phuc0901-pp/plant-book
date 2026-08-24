/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/settings.js — Account settings & Threshold Rules Engine
   ═══════════════════════════════════════════════════════════════ */

import { api, API, token } from '../core/api.js';
import { toast } from '../core/utils.js';

let _currentRules = [];

// ── Khởi tạo trang Cài đặt ──────────────────────────────────────
export async function loadUserSettings() {
  try {
    const user = await api('/auth/me');
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
  const paneProfile = document.getElementById('subtab-pane-profile');
  const btnThresholds = document.getElementById('subtab-btn-thresholds');
  const btnProfile = document.getElementById('subtab-btn-profile');

  if (!paneThresholds || !paneProfile || !btnThresholds || !btnProfile) return;

  if (subtab === 'profile') {
    paneThresholds.style.display = 'none';
    paneProfile.style.display = 'block';

    btnThresholds.classList.remove('active');
    btnThresholds.style.color = '#64748b';
    btnThresholds.style.borderBottomColor = 'transparent';

    btnProfile.classList.add('active');
    btnProfile.style.color = '#059669';
    btnProfile.style.borderBottomColor = '#059669';
  } else {
    paneThresholds.style.display = 'block';
    paneProfile.style.display = 'none';

    btnProfile.classList.remove('active');
    btnProfile.style.color = '#64748b';
    btnProfile.style.borderBottomColor = 'transparent';

    btnThresholds.classList.add('active');
    btnThresholds.style.color = '#059669';
    btnThresholds.style.borderBottomColor = '#059669';

    loadThresholdRules();
  }
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

// ── Metric Catalog ─────────────────────────────────────────────
const METRIC_CATALOG = {
  soil_moisture_10cm: { name: '🌱 Độ ẩm đất tầng 10cm', unit: '%' },
  soil_moisture_20cm: { name: '🌱 Độ ẩm đất tầng 20cm', unit: '%' },
  soil_moisture_50cm: { name: '🪴 Độ ẩm đất tầng 50cm', unit: '%' },
  air_temp:           { name: '🌡️ Nhiệt độ không khí', unit: '°C' },
  air_humidity:       { name: '💧 Độ ẩm không khí', unit: '%' },
  soil_ph:            { name: '🧪 Độ pH đất', unit: 'pH' },
  soil_ec:            { name: '⚡ Độ EC dẫn điện đất', unit: 'mS/cm' },
  rain_chance:        { name: '🌦️ Khả năng mưa rào', unit: '%' },
  water_level:        { name: '🚰 Mực nước bể tưới', unit: '%' }
};

// ── Dynamic Multi-Condition Builder Helpers ───────────────────
export function addConditionRow(data = null) {
  const container = document.getElementById('rule-conditions-list');
  if (!container) return;

  const rowId = 'cond-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  const metricKey = data?.metric_key || 'soil_moisture_10cm';
  const operator = data?.operator || '<';
  const thresholdVal = data?.threshold_value !== undefined ? data.threshold_value : 50;
  const unit = METRIC_CATALOG[metricKey]?.unit || '%';

  const row = document.createElement('div');
  row.id = rowId;
  row.className = 'rule-condition-row';
  row.style.cssText = 'background:#ffffff; border:1px solid #cbd5e1; border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:8px; box-shadow:0 2px 6px rgba(0,0,0,0.02); transition:all 0.2s ease;';

  row.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
      <span class="condition-index-badge" style="font-size:11.5px; font-weight:800; color:#047857; background:#dcfce7; padding:2px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">
        <i class="fa-solid fa-code-commit"></i> Điều kiện <span class="cond-num"></span>
      </span>
      <button type="button" onclick="removeConditionRow('${rowId}')" title="Xóa điều kiện này" style="background:#fee2e2; border:none; color:#dc2626; width:26px; height:26px; border-radius:6px; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>

    <div style="display:grid; grid-template-columns: 1.8fr 1fr 1.2fr; gap:8px; align-items:center;">
      <div>
        <select class="cond-metric" onchange="onConditionMetricChange('${rowId}')" style="width:100%; padding:9px 10px; border:1.5px solid #cbd5e1; border-radius:8px; font-size:12.5px; font-weight:600; outline:none;">
          ${Object.entries(METRIC_CATALOG).map(([k, v]) => `
            <option value="${k}" ${k === metricKey ? 'selected' : ''}>${v.name} (${v.unit})</option>
          `).join('')}
        </select>
      </div>

      <div>
        <select class="cond-operator" onchange="updateRuleConditionsSummary()" style="width:100%; padding:9px 10px; border:1.5px solid #cbd5e1; border-radius:8px; font-size:12.5px; font-weight:600; outline:none;">
          <option value="<" ${operator === '<' ? 'selected' : ''}>Nhỏ hơn (&lt;)</option>
          <option value="<=" ${operator === '<=' ? 'selected' : ''}>Nhỏ hơn hoặc bằng (&le;)</option>
          <option value=">" ${operator === '>' ? 'selected' : ''}>Lớn hơn (&gt;)</option>
          <option value=">=" ${operator === '>=' ? 'selected' : ''}>Lớn hơn hoặc bằng (&ge;)</option>
          <option value="=" ${operator === '=' ? 'selected' : ''}>Bằng (=)</option>
        </select>
      </div>

      <div style="display:flex; align-items:center; gap:4px;">
        <input type="number" step="any" class="cond-value" value="${thresholdVal}" placeholder="50" oninput="updateRuleConditionsSummary()" style="width:100%; min-width:60px; padding:9px 10px; border:1.5px solid #cbd5e1; border-radius:8px; font-size:12.5px; font-weight:700; outline:none;" />
        <span class="cond-unit" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:7px 10px; border-radius:8px; font-size:12px; font-weight:800; color:#475569; min-width:32px; text-align:center;">${unit}</span>
      </div>
    </div>
  `;

  container.appendChild(row);
  _renumberConditionRows();
  updateRuleConditionsSummary();
}
window.addConditionRow = addConditionRow;

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
  const metricSel = row.querySelector('.cond-metric');
  const unitSpan = row.querySelector('.cond-unit');
  if (metricSel && unitSpan) {
    const unit = METRIC_CATALOG[metricSel.value]?.unit || '%';
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
    const metricKey = r.querySelector('.cond-metric')?.value || 'soil_moisture_10cm';
    const operator = r.querySelector('.cond-operator')?.value || '<';
    const thresholdVal = parseFloat(r.querySelector('.cond-value')?.value) || 0;
    const metricInfo = METRIC_CATALOG[metricKey] || { name: metricKey, unit: '%' };

    conditions.push({
      metric_key: metricKey,
      metric_name: metricInfo.name,
      operator: operator,
      threshold_value: thresholdVal,
      unit: metricInfo.unit
    });
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
  if (offIot) parts.push(`[📡 Quét IoT mất kết nối/0]`);

  const weatherTom = document.getElementById('rule-check-weather-tomorrow')?.checked;
  if (weatherTom) parts.push(`[🌦️ Sáng mai có mưa rào]`);

  const disHist = document.getElementById('rule-check-disease-history')?.checked;
  if (disHist) parts.push(`[🐛 Tra lịch sử bệnh cây]`);

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
        <i class="fa-solid fa-bell-concierge" style="font-size:36px; color:#cbd5e1; margin-bottom:12px; display:block;"></i>
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
      icon: 'fa-triangle-exclamation',
      label: '🚨 Cảnh báo (Màu Đỏ - Icon ⚠️)'
    },
    warning: {
      bg: '#fff7ed',
      border: '#fed7aa',
      badgeBg: '#ffedd5',
      badgeText: '#d97706',
      icon: 'fa-bullhorn',
      label: '📢 Khuyến cáo (Màu Cam - Icon 📢 Cái loa)'
    },
    info: {
      bg: '#f0fdf4',
      border: '#bbf7d0',
      badgeBg: '#dcfce7',
      badgeText: '#16a34a',
      icon: 'fa-circle-info',
      label: 'ℹ️ Thông báo (Màu Xanh lá - Icon ℹ️)'
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
                <i class="fa-solid ${st.icon}"></i> ${st.label}
              </span>
              
              <span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:11px; font-weight:700;">
                <i class="fa-solid fa-seedling"></i> ${r.action_type || 'Canh tác'}
              </span>

              ${r.check_offline_iot ? `<span class="badge" style="background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; font-size:10.5px; font-weight:800;"><i class="fa-solid fa-rss"></i> Quét IoT Offline/0</span>` : ''}
              ${r.check_disease_history ? `<span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-size:10.5px; font-weight:800;"><i class="fa-solid fa-bug"></i> Tra lịch sử bệnh cây</span>` : ''}
              ${r.reconfirm_event_type ? `<span class="badge" style="background:#dcfce7; color:#166534; border:1px solid #86efac; font-size:10.5px; font-weight:800;"><i class="fa-solid fa-square-check"></i> Reconfirm Hệ thống</span>` : ''}
              
              <span class="badge" style="background:#f3e8ff; color:#6b21a8; border:1px solid #e9d5ff; font-size:11px; font-weight:700;">
                <i class="fa-solid fa-clock"></i> ${r.notify_time_type === 'custom' ? (r.custom_time || '07:00') : (r.notify_time_type === 'morning' ? 'Sáng (06-08h)' : (r.notify_time_type === 'noon' ? 'Trưa (11-13h)' : (r.notify_time_type === 'afternoon' ? 'Chiều (16-18h)' : (r.notify_time_type === 'evening' ? 'Tối (19-21h)' : 'Ngay lập tức'))))}
              </span>
            </div>
            
            <h4 style="margin:0 0 6px 0; font-size:15.5px; font-weight:900; color:#0f172a; display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
              <span>${ruleTitle}</span>
            </h4>

            <!-- Conditions Badges List -->
            ${conditions.length > 0 ? `
              <div style="display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin:6px 0 8px 0;">
                ${conditions.map((c, i) => `
                  ${i > 0 ? `<span style="font-size:10.5px; font-weight:900; color:#059669; background:#ecfdf5; padding:2px 6px; border-radius:6px;">${matchWord}</span>` : ''}
                  <span style="background:#f1f5f9; color:#0f172a; border:1px solid #e2e8f0; padding:3px 8px; border-radius:8px; font-size:11.5px; font-weight:800;">
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
              <i class="fa-solid fa-pen"></i> Sửa
            </button>

            <button onclick="deleteThresholdRule(${r.id})" style="background:#fef2f2; border:1.5px solid #fecaca; color:#dc2626; padding:7px 14px; border-radius:10px; font-size:12px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
              <i class="fa-solid fa-trash-can"></i> Xóa
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
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
      previewIcon.className = 'fa-solid fa-triangle-exclamation';
      previewIcon.style.color = '#dc2626';
    }
  } else if (category === 'warning') {
    if (dangerBox) dangerBox.style.display = 'none';
    if (warningBox) warningBox.style.display = 'flex';
    if (previewBox) {
      previewBox.style.background = '#fff7ed';
      previewBox.style.borderColor = '#fed7aa';
    }
    if (previewIcon) {
      previewIcon.className = 'fa-solid fa-bullhorn';
      previewIcon.style.color = '#d97706';
    }
  } else if (category === 'info') {
    if (previewBox) {
      previewBox.style.background = '#f0fdf4';
      previewBox.style.borderColor = '#bbf7d0';
    }
    if (previewIcon) {
      previewIcon.className = 'fa-solid fa-circle-info';
      previewIcon.style.color = '#16a34a';
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
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...'; }

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
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã lưu';
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
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...'; }

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
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Thành công';
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
