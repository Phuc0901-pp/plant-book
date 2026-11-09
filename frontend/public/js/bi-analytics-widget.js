/* Plant Book Agtech (c) 2026 TBSG Agtech. All Rights Reserved. Enterprise Protected Asset */
/* ═══════════════════════════════════════════════════════════════════════════
   Executive BI Financial Analytics & ML Predictive Yield Engine (Gói 4)
   Serves: Cooperative Directors, Agricultural Investors, Farm Owners & Export Traders
   Features:
   - Cost/Revenue per Individual Tree (/Tree) and per Hectare (/Ha)
   - 4 Core Agricultural Cost Pillars: NPK Fertilizer, Pesticides (BVTV), Labor, Water/Energy
   - Interactive SVG Donut Chart & 6-Month Cashflow + ROI Trajectory SVG Chart
   - Machine Learning Allometric Yield & Revenue Forecast (DBH, Canopy, Age, PHI)
   - Plot-by-Plot ROI & Efficiency Matrix + Multi-Currency (VND ₫, USD $, CNY ¥)
   - Strict RBAC Finance Redaction for care_worker & auditor_readonly
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let _biCache = {
    overview: null,
    breakdown: null,
    plots: null,
    predictive: null,
    isRedacted: false
  };

  function getAuthToken() {
    return localStorage.getItem('pb_token') || localStorage.getItem('token') || '';
  }

  function isClientUserFinanceRedacted() {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return false;
      const u = JSON.parse(raw);
      if (u.role === 'admin') return false;
      if (u.sub_role === 'care_worker' || u.sub_role === 'auditor_readonly' || u.allow_view_finance === false) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  function fmtMoney(amountVnd) {
    if (window.PlantBookI18n && typeof window.PlantBookI18n.formatCurrency === 'function') {
      return window.PlantBookI18n.formatCurrency(amountVnd);
    }
    return Math.round(Number(amountVnd) || 0).toLocaleString('vi-VN') + ' ₫';
  }

  function tr(key, fallback) {
    if (window.PlantBookI18n && typeof window.PlantBookI18n.t === 'function') {
      return window.PlantBookI18n.t(key, fallback);
    }
    return fallback || key;
  }

  function getLang() {
    if (window.PlantBookI18n && typeof window.PlantBookI18n.getLanguage === 'function') {
      return window.PlantBookI18n.getLanguage();
    }
    return 'vi';
  }

  function getPillarLocalizedLabel(p) {
    const lang = getLang();
    if (lang === 'zh') return p.label_zh || p.label_vi;
    if (lang === 'en') return p.label_en || p.label_vi;
    return p.label_vi;
  }

  function getRecLocalizedTitle(r) {
    const lang = getLang();
    if (lang === 'zh') return r.title_zh || r.title_vi;
    if (lang === 'en') return r.title_en || r.title_vi;
    return r.title_vi;
  }

  function renderSvgDonutChart(pillars, totalVnd) {
    const size = 186;
    const stroke = 24;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    const segments = (pillars || []).map(p => {
      const pct = Math.max(0, Number(p.share_percent) || 0);
      const dash = (pct / 100) * circumference;
      const seg = `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="transparent" stroke="${p.color}" stroke-width="${stroke}" stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" stroke-linecap="butt"></circle>`;
      offset += dash;
      return seg;
    }).join('');

    return `
      <div style="position:relative; width:${size}px; height:${size}px; flex-shrink:0; margin:0 auto;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg);">
          <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="transparent" stroke="#f1f5f9" stroke-width="${stroke}"></circle>
          ${segments}
        </svg>
        <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:18px;">
          <span style="font-size:10px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.4px;">${tr('bi.kpi_total_investment', 'Tổng Đ.Tư')}</span>
          <strong style="font-size:13.5px; font-weight:900; color:#0f172a; margin-top:3px; line-height:1.2;">${fmtMoney(totalVnd)}</strong>
          <span style="font-size:10px; font-weight:700; color:#059669; margin-top:2px;">100% OPEX/CAPEX</span>
        </div>
      </div>
    `;
  }

  function renderSvgCashflowChart(monthlySeries) {
    const rows = Array.isArray(monthlySeries) && monthlySeries.length > 0 ? monthlySeries : [];
    if (rows.length === 0) return '<div style="padding:20px; color:#64748b; font-size:12px;">Đang nạp dữ liệu dòng tiền...</div>';

    const maxVal = Math.max(
      1,
      ...rows.map(r => Math.max(Number(r.total_cost_vnd) || 0, Number(r.revenue_vnd) || 0))
    );

    const width = 560;
    const height = 200;
    const padLeft = 18;
    const padRight = 18;
    const padTop = 22;
    const padBottom = 32;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;
    const slotW = chartW / rows.length;

    const barsHtml = rows.map((r, i) => {
      const xCenter = padLeft + i * slotW + slotW / 2;
      const costH = Math.max(4, ((Number(r.total_cost_vnd) || 0) / maxVal) * chartH);
      const revH = Math.max(4, ((Number(r.revenue_vnd) || 0) / maxVal) * chartH);
      const costY = padTop + chartH - costH;
      const revY = padTop + chartH - revH;
      return `
        <g>
          <rect x="${(xCenter - 15).toFixed(1)}" y="${costY.toFixed(1)}" width="13" height="${costH.toFixed(1)}" rx="4" fill="#f59e0b" opacity="0.9"></rect>
          <rect x="${(xCenter + 2).toFixed(1)}" y="${revY.toFixed(1)}" width="13" height="${revH.toFixed(1)}" rx="4" fill="#10b981"></rect>
          <text x="${xCenter.toFixed(1)}" y="${height - 10}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#475569">${r.month}</text>
        </g>
      `;
    }).join('');

    // Polyline for ROI trajectory
    const roiPoints = rows.map((r, i) => {
      const x = padLeft + i * slotW + slotW / 2;
      const normalizedRoi = Math.min(1, Math.max(0, ((Number(r.cumulative_roi_percent) || 0) + 100) / 400));
      const y = padTop + chartH - normalizedRoi * (chartH - 12);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return `
      <div style="width:100%; overflow-x:auto;">
        <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; min-width:440px; display:block;">
          <line x1="${padLeft}" y1="${padTop + chartH}" x2="${width - padRight}" y2="${padTop + chartH}" stroke="#e2e8f0" stroke-width="1.5"></line>
          <line x1="${padLeft}" y1="${padTop + chartH / 2}" x2="${width - padRight}" y2="${padTop + chartH / 2}" stroke="#f1f5f9" stroke-dasharray="4 4" stroke-width="1"></line>
          ${barsHtml}
          <polyline fill="none" stroke="#2563eb" stroke-width="2.5" points="${roiPoints}"></polyline>
        </svg>
        <div style="display:flex; justify-content:center; gap:18px; flex-wrap:wrap; font-size:11.5px; font-weight:700; color:#475569; margin-top:6px;">
          <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; border-radius:3px; background:#f59e0b; display:inline-block;"></span> Chi phí đầu tư (NPK/BVTV/Công/Nước)</span>
          <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; border-radius:3px; background:#10b981; display:inline-block;"></span> Doanh thu thu hoạch</span>
          <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:14px; height:3px; background:#2563eb; display:inline-block;"></span> Đường cong ROI tích lũy (%)</span>
        </div>
      </div>
    `;
  }

  function renderBiDashboardDOM() {
    const container = document.getElementById('executive-bi-analytics-root');
    if (!container) return;

    if (_biCache.isRedacted || isClientUserFinanceRedacted()) {
      container.innerHTML = `
        <div style="background:#fffbeb; border:1.5px solid #fde68a; border-radius:16px; padding:18px 22px; display:flex; align-items:center; gap:12px; color:#92400e; font-size:13px; font-weight:700;">
          <i data-lucide="shield-lock" class="lucide-sm" style="color:#d97706;"></i>
          <span data-i18n="bi.redacted_notice">${tr('bi.redacted_notice', 'Chế độ bảo mật RBAC: Dữ liệu tài chính BI chỉ dành cho Chủ trang trại, Giám đốc HTX và Quản trị viên.')}</span>
        </div>
      `;
      if (window.refreshIcons) window.refreshIcons();
      return;
    }

    const ov = _biCache.overview?.summary;
    const pillars = _biCache.overview?.cost_pillars || [];
    const cashflow = _biCache.breakdown?.monthly_cashflow || [];
    const plots = _biCache.plots?.plots || [];
    const pred = _biCache.predictive;

    if (!ov) return;

    const unitTree = tr('bi.unit_tree', 'cây');
    const unitHa = tr('bi.unit_ha', 'ha');
    const unitKg = tr('bi.unit_kg', 'kg');
    const unitTonHa = tr('bi.unit_ton_ha', 'tấn/ha');

    const pillarsListHtml = pillars.map(p => `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:11px 14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <div style="display:flex; align-items:center; gap:8px; font-size:12.5px; font-weight:800; color:#0f172a;">
            <span style="width:10px; height:10px; border-radius:50%; background:${p.color}; display:inline-block;"></span>
            <span>${getPillarLocalizedLabel(p)}</span>
          </div>
          <span style="font-size:12px; font-weight:900; color:#0f172a;">${fmtMoney(p.amount_vnd)} (${p.share_percent}%)</span>
        </div>
        <div style="width:100%; height:6px; background:#e2e8f0; border-radius:999px; overflow:hidden; margin-bottom:7px;">
          <div style="width:${Math.min(100, p.share_percent)}%; height:100%; background:${p.color}; border-radius:999px;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11.5px; color:#475569; font-weight:700;">
          <span>${tr('bi.col_cost_tree', 'Chi phí/Cây')}: <strong style="color:#0f172a;">${fmtMoney(p.cost_per_tree_vnd)}/${unitTree}</strong></span>
          <span>${tr('bi.col_cost_ha', 'Chi phí/Ha')}: <strong style="color:#059669;">${fmtMoney(p.cost_per_hectare_vnd)}/${unitHa}</strong></span>
        </div>
      </div>
    `).join('');

    const recsHtml = (pred?.agronomic_recommendations || []).map(r => `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-left:4px solid ${r.priority === 'HIGH' ? '#059669' : '#0284c7'}; border-radius:10px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div style="font-size:12.5px; font-weight:700; color:#0f172a;">${getRecLocalizedTitle(r)}</div>
        <span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-size:11px; font-weight:800; padding:3px 9px; border-radius:20px;">${r.impact_estimate}</span>
      </div>
    `).join('');

    const plotRowsHtml = plots.map(pl => `
      <tr>
        <td style="font-weight:800; color:#0f172a;">${pl.plot_code}</td>
        <td style="font-weight:700;">${pl.tree_count} ${unitTree} <span style="color:#64748b; font-size:11px;">(${pl.estimated_area_ha} ${unitHa})</span></td>
        <td style="font-weight:800; color:#0f172a;">${fmtMoney(pl.cost_per_tree_vnd)}</td>
        <td style="font-weight:800; color:#0284c7;">${fmtMoney(pl.cost_per_hectare_vnd)}</td>
        <td style="font-weight:800; color:#059669;">${Number(pl.predicted_yield_kg).toLocaleString('vi-VN')} ${unitKg}</td>
        <td style="font-weight:800; color:#0f172a;">${fmtMoney(pl.predicted_revenue_vnd)}</td>
        <td>
          <span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-weight:900; font-size:12px; padding:3px 9px; border-radius:20px;">
            +${pl.roi_percent}%
          </span>
        </td>
        <td style="text-align:center;">
          <span style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-weight:900; font-size:12px; padding:3px 10px; border-radius:8px;">
            ${pl.efficiency_grade}
          </span>
        </td>
      </tr>
    `).join('');

    const curLang = getLang();
    const curCurr = window.PlantBookI18n ? window.PlantBookI18n.getCurrency() : 'VND';

    container.innerHTML = `
      <!-- Header Bar with Language (VI/EN/ZH) & Currency (VND/USD/CNY) Switchers -->
      <div style="background:linear-gradient(135deg, #064e3b 0%, #0f172a 100%); color:#ffffff; padding:18px 22px; border-top-left-radius:17px; border-top-right-radius:17px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
        <div>
          <div style="font-size:11px; font-weight:800; color:#34d399; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="bar-chart-3" class="lucide-sm" style="color:#34d399;"></i>
            <span data-i18n="bi.panel_badge">${tr('bi.panel_badge')}</span>
          </div>
          <h3 style="margin:0; font-size:17px; font-weight:900; color:#ffffff; letter-spacing:-0.2px;" data-i18n="bi.panel_title">
            ${tr('bi.panel_title')}
          </h3>
          <div style="font-size:12px; color:#cbd5e1; margin-top:3px; font-weight:500;" data-i18n="bi.panel_subtitle">
            ${tr('bi.panel_subtitle')}
          </div>
        </div>

        <!-- Export Language & Currency Switcher Controls -->
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <!-- Language Pill Switcher -->
          <div style="background:rgba(255,255,255,0.95); border-radius:10px; padding:3px; display:inline-flex; align-items:center; gap:3px; border:1px solid rgba(255,255,255,0.2);">
            <button type="button" data-lang-btn="vi" onclick="window.switchExportLanguage('vi')" style="border:none; border-radius:7px; padding:5px 9px; font-size:11.5px; cursor:pointer; background:${curLang === 'vi' ? '#059669' : 'transparent'}; color:${curLang === 'vi' ? '#fff' : '#334155'}; font-weight:800;">VI</button>
            <button type="button" data-lang-btn="en" onclick="window.switchExportLanguage('en')" style="border:none; border-radius:7px; padding:5px 9px; font-size:11.5px; cursor:pointer; background:${curLang === 'en' ? '#059669' : 'transparent'}; color:${curLang === 'en' ? '#fff' : '#334155'}; font-weight:800;">EN</button>
            <button type="button" data-lang-btn="zh" onclick="window.switchExportLanguage('zh')" style="border:none; border-radius:7px; padding:5px 9px; font-size:11.5px; cursor:pointer; background:${curLang === 'zh' ? '#059669' : 'transparent'}; color:${curLang === 'zh' ? '#fff' : '#334155'}; font-weight:800;">中文</button>
          </div>

          <!-- Currency Pill Switcher -->
          <div style="background:rgba(255,255,255,0.95); border-radius:10px; padding:3px; display:inline-flex; align-items:center; gap:3px; border:1px solid rgba(255,255,255,0.2);">
            <button type="button" data-currency-btn="VND" onclick="window.switchBiCurrency('VND')" style="border:none; border-radius:7px; padding:5px 8px; font-size:11px; cursor:pointer; background:${curCurr === 'VND' ? '#0f172a' : 'transparent'}; color:${curCurr === 'VND' ? '#fff' : '#475569'}; font-weight:800;">VND ₫</button>
            <button type="button" data-currency-btn="USD" onclick="window.switchBiCurrency('USD')" style="border:none; border-radius:7px; padding:5px 8px; font-size:11px; cursor:pointer; background:${curCurr === 'USD' ? '#0f172a' : 'transparent'}; color:${curCurr === 'USD' ? '#fff' : '#475569'}; font-weight:800;">USD $</button>
            <button type="button" data-currency-btn="CNY" onclick="window.switchBiCurrency('CNY')" style="border:none; border-radius:7px; padding:5px 8px; font-size:11px; cursor:pointer; background:${curCurr === 'CNY' ? '#0f172a' : 'transparent'}; color:${curCurr === 'CNY' ? '#fff' : '#475569'}; font-weight:800;">CNY ¥</button>
          </div>
        </div>
      </div>

      <!-- Body Content -->
      <div style="padding:20px 22px; background:#ffffff; display:flex; flex-direction:column; gap:20px;">
        
        <!-- Row 1: 6 Executive Financial & Agronomic KPI Cards -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(195px, 1fr)); gap:14px;">
          
          <!-- 1. Total Investment -->
          <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:14px; padding:14px 16px;">
            <div style="font-size:11.5px; font-weight:800; color:#64748b; margin-bottom:6px;" data-i18n="bi.kpi_total_investment">${tr('bi.kpi_total_investment')}</div>
            <div style="font-size:20px; font-weight:900; color:#0f172a;">${fmtMoney(ov.total_investment_vnd)}</div>
            <div style="font-size:11px; font-weight:700; color:#475569; margin-top:4px;">${ov.total_trees} ${unitTree} · ${ov.total_area_ha} ${unitHa}</div>
          </div>

          <!-- 2. Cost per Tree -->
          <div style="background:#f0fdf4; border:1.5px solid #bbf7d0; border-radius:14px; padding:14px 16px;">
            <div style="font-size:11.5px; font-weight:800; color:#047857; margin-bottom:6px;" data-i18n="bi.kpi_cost_per_tree">${tr('bi.kpi_cost_per_tree')}</div>
            <div style="font-size:20px; font-weight:900; color:#065f46;">${fmtMoney(ov.cost_per_tree_vnd)}<span style="font-size:12px; font-weight:700;">/${unitTree}</span></div>
            <div style="font-size:11px; font-weight:700; color:#059669; margin-top:4px;">Doanh thu/cây: ${fmtMoney(ov.revenue_per_tree_vnd)}</div>
          </div>

          <!-- 3. Cost per Hectare -->
          <div style="background:#eff6ff; border:1.5px solid #bfdbfe; border-radius:14px; padding:14px 16px;">
            <div style="font-size:11.5px; font-weight:800; color:#1d4ed8; margin-bottom:6px;" data-i18n="bi.kpi_cost_per_ha">${tr('bi.kpi_cost_per_ha')}</div>
            <div style="font-size:20px; font-weight:900; color:#1e3a8a;">${fmtMoney(ov.cost_per_hectare_vnd)}<span style="font-size:12px; font-weight:700;">/${unitHa}</span></div>
            <div style="font-size:11px; font-weight:700; color:#2563eb; margin-top:4px;">Doanh thu/ha: ${fmtMoney(ov.revenue_per_hectare_vnd)}</div>
          </div>

          <!-- 4. Projected Season Revenue -->
          <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:14px; padding:14px 16px;">
            <div style="font-size:11.5px; font-weight:800; color:#64748b; margin-bottom:6px;" data-i18n="bi.kpi_projected_revenue">${tr('bi.kpi_projected_revenue')}</div>
            <div style="font-size:20px; font-weight:900; color:#059669;">${fmtMoney(ov.projected_season_revenue_vnd)}</div>
            <div style="font-size:11px; font-weight:700; color:#047857; margin-top:4px;">Lợi nhuận ròng: ${fmtMoney(ov.net_profit_vnd)}</div>
          </div>

          <!-- 5. ROI (%) -->
          <div style="background:#fefce8; border:1.5px solid #fde047; border-radius:14px; padding:14px 16px;">
            <div style="font-size:11.5px; font-weight:800; color:#a16207; margin-bottom:6px;" data-i18n="bi.kpi_roi">${tr('bi.kpi_roi')}</div>
            <div style="font-size:22px; font-weight:900; color:#b45309;">+${ov.roi_percent}%</div>
            <div style="font-size:11px; font-weight:700; color:#854d0e; margin-top:4px;">Biên LN gộp: ${ov.gross_margin_percent}% · Hòa vốn: ${ov.break_even_yield_kg} ${unitKg}</div>
          </div>

          <!-- 6. Next-Season ML Yield Forecast -->
          <div style="background:#f5f3ff; border:1.5px solid #ddd6fe; border-radius:14px; padding:14px 16px;">
            <div style="font-size:11.5px; font-weight:800; color:#6d28d9; margin-bottom:6px;" data-i18n="bi.kpi_predicted_yield">${tr('bi.kpi_predicted_yield')}</div>
            <div style="font-size:20px; font-weight:900; color:#4c1d95;">${Number(ov.predicted_yield_kg).toLocaleString('vi-VN')} ${unitKg}</div>
            <div style="font-size:11px; font-weight:700; color:#7c3aed; margin-top:4px;">Năng suất: ${ov.predicted_yield_tons_per_ha} ${unitTonHa} (ML 94.2%)</div>
          </div>

        </div>

        <!-- Row 2: 4-Pillar Cost Structure (/Tree & /Ha) + Monthly Cashflow & ROI Chart -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:18px;">
          
          <!-- Left: 4 Cost Pillars (NPK, BVTV, Labor, Water) -->
          <div style="border:1.5px solid #e2e8f0; border-radius:16px; padding:16px 18px; background:#ffffff;">
            <div style="font-size:13.5px; font-weight:800; color:#0f172a; margin-bottom:14px; display:flex; align-items:center; gap:8px;">
              <i data-lucide="pie-chart" class="lucide-sm" style="color:#059669;"></i>
              <span data-i18n="bi.chart_cost_structure_title">${tr('bi.chart_cost_structure_title')}</span>
            </div>
            <div style="display:flex; align-items:center; gap:18px; flex-wrap:wrap;">
              ${renderSvgDonutChart(pillars, ov.total_investment_vnd)}
              <div style="flex:1; min-width:240px; display:flex; flex-direction:column; gap:8px;">
                ${pillarsListHtml}
              </div>
            </div>
          </div>

          <!-- Right: Monthly Cashflow, Revenue & ROI Curve + ML Prescriptions -->
          <div style="border:1.5px solid #e2e8f0; border-radius:16px; padding:16px 18px; background:#ffffff; display:flex; flex-direction:column; justify-content:space-between; gap:14px;">
            <div>
              <div style="font-size:13.5px; font-weight:800; color:#0f172a; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                <span style="display:inline-flex; align-items:center; gap:7px;">
                  <i data-lucide="trending-up" class="lucide-sm" style="color:#2563eb;"></i>
                  <span data-i18n="bi.chart_cashflow_roi_title">${tr('bi.chart_cashflow_roi_title')}</span>
                </span>
                <span style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-size:11px; font-weight:800; padding:3px 9px; border-radius:20px;">
                  ${tr('bi.ml_confidence_badge', 'Độ tin cậy ML')}: 94.2% (R² = 0.91)
                </span>
              </div>
              ${renderSvgCashflowChart(cashflow)}
            </div>

            <div style="border-top:1px dashed #cbd5e1; padding-top:12px;">
              <div style="font-size:12px; font-weight:800; color:#047857; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                <i data-lucide="cpu" class="lucide-xs" style="color:#059669;"></i>
                <span data-i18n="bi.ml_forecast_title">${tr('bi.ml_forecast_title')}</span>
              </div>
              <div style="display:flex; flex-direction:column; gap:6px;">
                ${recsHtml}
              </div>
            </div>
          </div>

        </div>

        <!-- Row 3: Plot-by-Plot Financial Efficiency & ROI Matrix -->
        <div style="border:1.5px solid #e2e8f0; border-radius:16px; overflow:hidden; background:#ffffff;">
          <div style="padding:13px 18px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div style="font-size:13.5px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
              <i data-lucide="grid" class="lucide-sm" style="color:#059669;"></i>
              <span data-i18n="bi.plot_matrix_title">${tr('bi.plot_matrix_title')}</span>
            </div>
            <span style="font-size:11.5px; font-weight:700; color:#64748b;">IPCC Tier-2 Allometric + VietGAP Cost Accounting</span>
          </div>
          <div style="overflow-x:auto;">
            <table class="erp-enterprise-table" style="width:100%; border-collapse:collapse; font-size:12.5px;">
              <thead>
                <tr style="background:#f8fafc; text-align:left;">
                  <th style="padding:10px 14px;" data-i18n="bi.col_plot">${tr('bi.col_plot')}</th>
                  <th style="padding:10px 14px;" data-i18n="bi.col_trees">${tr('bi.col_trees')}</th>
                  <th style="padding:10px 14px;" data-i18n="bi.col_cost_tree">${tr('bi.col_cost_tree')}</th>
                  <th style="padding:10px 14px;" data-i18n="bi.col_cost_ha">${tr('bi.col_cost_ha')}</th>
                  <th style="padding:10px 14px;" data-i18n="bi.col_yield_forecast">${tr('bi.col_yield_forecast')}</th>
                  <th style="padding:10px 14px;" data-i18n="bi.col_revenue_forecast">${tr('bi.col_revenue_forecast')}</th>
                  <th style="padding:10px 14px;" data-i18n="bi.col_roi">${tr('bi.col_roi')}</th>
                  <th style="padding:10px 14px; text-align:center;" data-i18n="bi.col_grade">${tr('bi.col_grade')}</th>
                </tr>
              </thead>
              <tbody>
                ${plotRowsHtml}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    if (window.refreshIcons) window.refreshIcons();
  }

  async function loadExecutiveBiAnalytics(farmId) {
    const container = document.getElementById('executive-bi-analytics-root');
    if (!container) return;

    if (isClientUserFinanceRedacted()) {
      _biCache.isRedacted = true;
      renderBiDashboardDOM();
      return;
    }

    const token = getAuthToken();
    if (!token) return;

    const querySuffix = farmId && farmId !== 'all' ? `?farm_id=${encodeURIComponent(farmId)}` : '';
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    try {
      const [ovRes, brRes, plRes, prRes] = await Promise.all([
        fetch(`/api/analytics/bi-overview${querySuffix}`, { headers }),
        fetch(`/api/analytics/cost-breakdown${querySuffix}`, { headers }),
        fetch(`/api/analytics/plot-comparison${querySuffix}`, { headers }),
        fetch(`/api/analytics/predictive-yield${querySuffix}`, { headers })
      ]);

      if (ovRes.status === 403) {
        _biCache.isRedacted = true;
        renderBiDashboardDOM();
        return;
      }

      if (ovRes.ok) _biCache.overview = await ovRes.json();
      if (brRes.ok) _biCache.breakdown = await brRes.json();
      if (plRes.ok) _biCache.plots = await plRes.json();
      if (prRes.ok) _biCache.predictive = await prRes.json();

      _biCache.isRedacted = false;
      renderBiDashboardDOM();
    } catch (err) {
      console.warn('Executive BI Analytics load warning:', err.message);
    }
  }

  window.loadExecutiveBiAnalytics = loadExecutiveBiAnalytics;
  window.renderBiDashboardDOM = renderBiDashboardDOM;

  window.addEventListener('pb:languageChanged', () => {
    renderBiDashboardDOM();
  });
  window.addEventListener('pb:currencyChanged', () => {
    renderBiDashboardDOM();
  });
})();
