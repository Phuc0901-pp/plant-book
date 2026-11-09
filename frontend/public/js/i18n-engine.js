/* Plant Book Agtech (c) 2026 TBSG Agtech. All Rights Reserved. Enterprise Protected Asset */
/* ═══════════════════════════════════════════════════════════════════════════
   Universal Export Multi-Language (i18n) & Multi-Currency Engine (VI | EN | ZH)
   Supports:
   - Vietnamese (vi-VN / VND ₫)
   - English (en-US / USD $) — GlobalG.A.P. Auditors & International Buyers
   - Chinese Simplified (zh-CN / CNY ¥) — Durian & Dragon Fruit Export Traders (GACC)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CURRENCY_RATES = {
    VND: 1,
    USD: 25450,
    CNY: 3520
  };

  const CORE_DICTIONARIES = {
    vi: {
      common: {
        portal_traceability: 'Cổng Thông Tin Truy Xuất Nguồn Gốc Cây Trồng Chuẩn VietGAP / Xuất Khẩu',
        print_dossier: 'In hồ sơ',
        share_link: 'Chia sẻ',
        farmer_login: 'Nông hộ',
        refresh_data: 'Làm mới dữ liệu',
        verified: 'Đã xác thực',
        safe_for_harvest: 'An toàn thu hoạch (Đạt chuẩn PHI)',
        phi_quarantine: 'Đang trong thời gian cách ly thuốc (PHI)',
        language_label: 'Ngôn ngữ',
        currency_label: 'Tiền tệ'
      },
      traceability: {
        badge_verified_origin: 'HỒ SƠ ĐỊNH DANH SỐ CÂY TRỒNG XUẤT KHẨU',
        section_tree_identity: 'Lý Lịch Cá Thể Cây & Định Danh Vệ Tinh',
        section_farm_origin: 'Nguồn Gốc Vùng Trồng & Chứng Nhận Xuất Khẩu',
        section_vietgap_safety: 'An Toàn Thực Phẩm & Thời Gian Cách Ly (PHI)',
        section_carbon_passport: 'Hộ Chiếu Carbon (IPCC Tier-2) & Chuỗi Băm ISO 27001',
        section_care_diary: 'Nhật Ký Canh Tác Bất Biến (SHA-256 Hash-Chain)',
        field_tree_code: 'Mã số cá thể cây',
        field_nfc_uid: 'Mã chip phần cứng NFC',
        field_global_did: 'Định danh toàn cầu W3C DID',
        field_crop_type: 'Chủng loại cây trồng',
        field_crop_variety: 'Giống thương phẩm',
        field_plant_age: 'Tuổi sinh trưởng',
        field_health_status: 'Tình trạng sinh lý',
        field_puc_code: 'Mã số vùng trồng xuất khẩu (PUC / GACC)',
        field_vietgap_cert: 'Mã chứng nhận VietGAP / GlobalG.A.P.',
        field_farm_name: 'Đơn vị canh tác / Hợp tác xã',
        export_ready_banner: 'Đạt tiêu chuẩn xuất khẩu chính ngạch (Nghị định thư GACC Hải Quan Trung Quốc & GlobalG.A.P.)'
      },
      bi: {
        panel_badge: 'EXECUTIVE BI ANALYTICS · QUẢN TRỊ TÀI CHÍNH & DỰ BÁO MÙA VỤ',
        panel_title: 'Bảng Điều Khiển Tài Chính Doanh Nghiệp (BI) & Dự Báo Sản Lượng Học Máy',
        panel_subtitle: 'Phân tích chi phí/doanh thu theo từng cá thể cây và từng hecta (NPK, BVTV, Nhân công, Tiền nước) · Mô hình dự báo ROI & sản lượng thu hoạch vụ tới',
        kpi_total_investment: 'Tổng Chi Phí Đầu Tư',
        kpi_cost_per_tree: 'Chi Phí / Cá Thể Cây',
        kpi_cost_per_ha: 'Chi Phí / Hecta (Ha)',
        kpi_projected_revenue: 'Doanh Thu Dự Báo Mùa Vụ',
        kpi_roi: 'Tỷ Suất Sinh Lời (ROI)',
        kpi_predicted_yield: 'Dự Báo Sản Lượng Vụ Tới',
        pillar_npk: 'Phân bón (NPK & Hữu cơ)',
        pillar_pesticide: 'Thuốc BVTV & Sinh học',
        pillar_labor: 'Nhân công canh tác',
        pillar_water: 'Tiền nước & Điện tưới',
        chart_cost_structure_title: 'Cơ Cấu 4 Nhóm Chi Phí Canh Tác Trọng Yếu (/Cây & /Ha)',
        chart_cashflow_roi_title: 'Biểu Đồ Dòng Tiền Đầu Tư, Doanh Thu & Đường Cong Sinh Lời (ROI)',
        ml_forecast_title: 'Mô Hình Học Máy Dự Báo Sản Lượng & Doanh Thu Vụ Kế Tiếp',
        ml_confidence_badge: 'Độ tin cậy mô hình ML',
        plot_matrix_title: 'Ma Trận Hiệu Quả Tài Chính & ROI Theo Từng Lô Canh Tác',
        col_plot: 'Mã Lô / Khu Vực',
        col_trees: 'Số Cây',
        col_cost_tree: 'Chi Phí / Cây',
        col_cost_ha: 'Chi Phí / Ha',
        col_yield_forecast: 'Dự Báo Sản Lượng',
        col_revenue_forecast: 'Doanh Thu Dự Kiến',
        col_roi: 'Tỷ Suất ROI',
        col_grade: 'Hạng Hiệu Quả',
        unit_tree: 'cây',
        unit_ha: 'ha',
        unit_kg: 'kg',
        unit_ton_ha: 'tấn/ha',
        redacted_notice: 'Chế độ bảo mật RBAC: Dữ liệu tài chính BI chỉ dành cho Chủ trang trại, Giám đốc HTX và Quản trị viên.'
      }
    },
    en: {
      common: {
        portal_traceability: 'GlobalG.A.P. & Export Agricultural Origin Traceability Portal',
        print_dossier: 'Print Dossier',
        share_link: 'Share',
        farmer_login: 'Farmer Portal',
        refresh_data: 'Refresh Data',
        verified: 'Cryptographically Verified',
        safe_for_harvest: 'Safe for Harvest (PHI Compliant)',
        phi_quarantine: 'Active Pre-Harvest Interval (PHI) Quarantine',
        language_label: 'Language',
        currency_label: 'Currency'
      },
      traceability: {
        badge_verified_origin: 'EXPORT DIGITAL TWIN & ORIGIN DOSSIER',
        section_tree_identity: 'Single-Tree Biometric Identity & Satellite Telemetry',
        section_farm_origin: 'Production Unit Code (PUC) & Export Certifications',
        section_vietgap_safety: 'Food Safety & Pre-Harvest Interval (PHI) Status',
        section_carbon_passport: 'Carbon Credit Passport (IPCC Tier-2) & ISO 27001 Hash-Chain',
        section_care_diary: 'Immutable Cultivation Ledger (SHA-256 Hash-Chain)',
        field_tree_code: 'Individual Tree Code',
        field_nfc_uid: 'Hardware NFC Tag UID',
        field_global_did: 'Global W3C DID Identifier',
        field_crop_type: 'Crop Species',
        field_crop_variety: 'Commercial Cultivar',
        field_plant_age: 'Tree Maturity Age',
        field_health_status: 'Physiological Health',
        field_puc_code: 'Export Production Unit Code (PUC / GACC)',
        field_vietgap_cert: 'VietGAP / GlobalG.A.P. Certificate',
        field_farm_name: 'Certified Farm / Cooperative',
        export_ready_banner: 'Certified for International Official Export (GACC Protocol & GlobalG.A.P. Compliant)'
      },
      bi: {
        panel_badge: 'EXECUTIVE BI ANALYTICS · FINANCIAL GOVERNANCE & ML YIELD FORECAST',
        panel_title: 'Enterprise Financial BI Dashboard & Machine Learning Harvest Forecast',
        panel_subtitle: 'Granular Cost/Revenue analytics per tree & per hectare (NPK, Crop Protection, Labor, Water) · Next-season ROI & Allometric Yield Projection',
        kpi_total_investment: 'Total Farm Investment',
        kpi_cost_per_tree: 'Unit Cost / Tree',
        kpi_cost_per_ha: 'Cost / Hectare (Ha)',
        kpi_projected_revenue: 'Projected Season Revenue',
        kpi_roi: 'Return on Investment (ROI)',
        kpi_predicted_yield: 'Next-Season Yield Forecast',
        pillar_npk: 'Fertilizers (NPK & Organic)',
        pillar_pesticide: 'Crop Protection (Pesticides)',
        pillar_labor: 'Cultivation Labor',
        pillar_water: 'Irrigation Water & Energy',
        chart_cost_structure_title: '4-Pillar Agricultural Cost Breakdown (/Tree & /Hectare)',
        chart_cashflow_roi_title: 'Monthly Investment Cashflow, Harvest Revenue & ROI Trajectory',
        ml_forecast_title: 'Machine Learning Next-Season Yield & Revenue Forecast Engine',
        ml_confidence_badge: 'ML Model Confidence',
        plot_matrix_title: 'Plot-by-Plot Financial Efficiency & ROI Matrix',
        col_plot: 'Plot / Zone',
        col_trees: 'Trees',
        col_cost_tree: 'Cost / Tree',
        col_cost_ha: 'Cost / Ha',
        col_yield_forecast: 'Projected Yield',
        col_revenue_forecast: 'Projected Revenue',
        col_roi: 'Net ROI',
        col_grade: 'Efficiency Rating',
        unit_tree: 'trees',
        unit_ha: 'ha',
        unit_kg: 'kg',
        unit_ton_ha: 'tons/ha',
        redacted_notice: 'RBAC Security Policy: Executive BI financial data is restricted to Farm Owners, Cooperative Directors, and Administrators.'
      }
    },
    zh: {
      common: {
        portal_traceability: '进出口水果原产地溯源与质量安全监管平台 (VietGAP / GACC)',
        print_dossier: '打印溯源档案',
        share_link: '分享链接',
        farmer_login: '庄园管理端',
        refresh_data: '刷新数据',
        verified: '区块链与硬件加密已验证',
        safe_for_harvest: '符合采收安全标准 (已过农药安全间隔期 PHI)',
        phi_quarantine: '处于农药安全间隔期 (PHI 禁采期)',
        language_label: '语言切换',
        currency_label: '结算币种'
      },
      traceability: {
        badge_verified_origin: '出口水果单株数字孪生与海关溯源档案',
        section_tree_identity: '果树单株身份识别与卫星定位档案',
        section_farm_origin: '注册果园代码 (PUC / GACC) 与出口认证资质',
        section_vietgap_safety: '食品安全检测与农药安全间隔期 (PHI) 监控',
        section_carbon_passport: '碳足迹护照 (IPCC Tier-2) 与 ISO 27001 哈希链',
        section_care_diary: '不可篡改农事操作全记录 (SHA-256 区块链存证)',
        field_tree_code: '果树单株编号',
        field_nfc_uid: 'NFC 硬件防伪芯片 UID',
        field_global_did: '全球 W3C DID 数字身份',
        field_crop_type: '水果品类',
        field_crop_variety: '商业出口品种',
        field_plant_age: '果树树龄',
        field_health_status: '生长健康状态',
        field_puc_code: '出口注册果园代码 (PUC / 中国海关 GACC 备案号)',
        field_vietgap_cert: 'VietGAP / GlobalG.A.P. 认证编号',
        field_farm_name: '生产庄园 / 农业合作社',
        export_ready_banner: '符合中国海关总署 (GACC) 植物检疫议定书与 GlobalG.A.P. 出口标准'
      },
      bi: {
        panel_badge: '企业级商业智能 (BI) · 农业财务管控与机器学习产量预测',
        panel_title: '农业企业财务 BI 看板与下一产季产量/营收机器学习预测',
        panel_subtitle: '单株果树与每公顷成本/收益精算 (化肥NPK、植保农药、人工、水电) · 投资回报率 (ROI) 与生物量预测模型',
        kpi_total_investment: '果园总投入成本',
        kpi_cost_per_tree: '单株果树成本',
        kpi_cost_per_ha: '每公顷成本 (Ha)',
        kpi_projected_revenue: '产季预计总营收',
        kpi_roi: '投资回报率 (ROI)',
        kpi_predicted_yield: '下一产季预计产量',
        pillar_npk: '化肥与有机肥 (NPK)',
        pillar_pesticide: '植保农药与生物制剂',
        pillar_labor: '果园人工成本',
        pillar_water: '灌溉水电费用',
        chart_cost_structure_title: '四大核心农资与人工成本结构分析 (单株 & 每公顷)',
        chart_cashflow_roi_title: '月度资金投入、采收营收与投资回报率 (ROI) 曲线',
        ml_forecast_title: '机器学习 (ML) 下一产季单株与园区产量/营收预测引擎',
        ml_confidence_badge: '机器学习模型置信度',
        plot_matrix_title: '各种植分区 (Plot) 财务效益与 ROI 对比矩阵',
        col_plot: '种植分区 (Plot)',
        col_trees: '果树数量',
        col_cost_tree: '单株成本',
        col_cost_ha: '每公顷成本',
        col_yield_forecast: '预计采收产量',
        col_revenue_forecast: '预计采收营收',
        col_roi: '净投资回报率 (ROI)',
        col_grade: '效益评级',
        unit_tree: '棵',
        unit_ha: '公顷',
        unit_kg: '公斤',
        unit_ton_ha: '吨/公顷',
        redacted_notice: 'RBAC 权限安全保护：企业财务 BI 数据仅对庄园主、合作社理事长及系统管理员开放。'
      }
    }
  };

  // Dynamic Agronomic Term Translator for QR Traceability Cards (Durian, Dragon Fruit, Care Logs)
  const AGRI_TERM_MAP = {
    en: [
      [/Sầu riêng Ri6/gi, 'Ri6 Premium Durian'],
      [/Sầu riêng Monthong/gi, 'Monthong Export Durian'],
      [/Sầu riêng/gi, 'Durian (Durio zibethinus)'],
      [/Thanh long ruột đỏ/gi, 'Red-Flesh Dragon Fruit'],
      [/Thanh long ruột trắng/gi, 'White-Flesh Dragon Fruit'],
      [/Thanh long/gi, 'Dragon Fruit (Pitaya)'],
      [/Bưởi da xanh/gi, 'Green-Skin Export Pomelo'],
      [/Cà phê/gi, 'Specialty Coffee'],
      [/Bón phân/gi, 'Fertilization (NPK / Organic)'],
      [/Phun thuốc/gi, 'Crop Protection Spraying'],
      [/Tưới nước/gi, 'Precision Irrigation'],
      [/Thu hoạch/gi, 'Commercial Harvest'],
      [/Cắt lá/gi, 'Canopy Pruning'],
      [/Tỉa hoa/gi, 'Blossom Thinning'],
      [/Thụ phấn/gi, 'Assisted Pollination'],
      [/Bệnh cây/gi, 'Phytosanitary Inspection'],
      [/An toàn thu hoạch/gi, 'Safe for Harvest (PHI Verified)'],
      [/Đang cách ly/gi, 'Active PHI Quarantine'],
      [/Tốt/g, 'Healthy (Grade A)'],
      [/Cần chú ý/g, 'Monitor Required'],
      [/năm tuổi/gi, 'years old'],
      [/năm/g, 'yrs']
    ],
    zh: [
      [/Sầu riêng Ri6/gi, '越南干尧榴莲 (Ri6 出口特级)'],
      [/Sầu riêng Monthong/gi, '越南金枕头榴莲 (Monthong)'],
      [/Sầu riêng/gi, '越南出口榴莲 (Durian)'],
      [/Thanh long ruột đỏ/gi, '越南红心火龙果 (出口一级)'],
      [/Thanh long ruột trắng/gi, '越南白心火龙果 (出口一级)'],
      [/Thanh long/gi, '越南出口火龙果 (Dragon Fruit)'],
      [/Bưởi da xanh/gi, '越南青皮蜜柚'],
      [/Cà phê/gi, '越南精品咖啡'],
      [/Bón phân/gi, '科学施肥 (有机肥/NPK)'],
      [/Phun thuốc/gi, '绿色植保喷药'],
      [/Tưới nước/gi, '精准滴灌浇水'],
      [/Thu hoạch/gi, '成熟采收出园'],
      [/Cắt lá/gi, '修剪枝叶整形'],
      [/Tỉa hoa/gi, '疏花保果管理'],
      [/Thụ phấn/gi, '人工辅助授粉'],
      [/Bệnh cây/gi, '植保病虫害巡检'],
      [/An toàn thu hoạch/gi, '符合采收安全标准 (已过安全间隔期 PHI)'],
      [/Đang cách ly/gi, '处于农药安全间隔期 (PHI)'],
      [/Tốt/g, '生长优良 (A级)'],
      [/Cần chú ý/g, '重点关注'],
      [/năm tuổi/gi, '年树龄'],
      [/năm/g, '年']
    ]
  };

  function detectInitialLanguage() {
    try {
      const params = new URLSearchParams(window.location.search);
      const qLang = (params.get('lang') || '').toLowerCase().trim();
      if (['vi', 'en', 'zh'].includes(qLang)) {
        localStorage.setItem('pb_locale', qLang);
        return qLang;
      }
      const saved = (localStorage.getItem('pb_locale') || '').toLowerCase().trim();
      if (['vi', 'en', 'zh'].includes(saved)) {
        return saved;
      }
    } catch (_) {}
    return 'vi';
  }

  function detectInitialCurrency(lang) {
    try {
      const savedCurr = (localStorage.getItem('pb_currency') || '').toUpperCase().trim();
      if (['VND', 'USD', 'CNY'].includes(savedCurr)) return savedCurr;
    } catch (_) {}
    if (lang === 'zh') return 'CNY';
    if (lang === 'en') return 'USD';
    return 'VND';
  }

  let currentLang = detectInitialLanguage();
  let currentCurrency = detectInitialCurrency(currentLang);

  function t(keyPath, fallback) {
    const dict = CORE_DICTIONARIES[currentLang] || CORE_DICTIONARIES.vi;
    const parts = String(keyPath || '').split('.');
    let cur = dict;
    for (let i = 0; i < parts.length; i++) {
      if (cur && typeof cur === 'object' && parts[i] in cur) {
        cur = cur[parts[i]];
      } else {
        cur = null;
        break;
      }
    }
    if (typeof cur === 'string') return cur;
    return fallback !== undefined ? fallback : keyPath;
  }

  function translateDynamicTerm(rawText, langOverride) {
    const lang = langOverride || currentLang;
    if (!rawText || lang === 'vi') return rawText;
    let out = String(rawText);
    const rules = AGRI_TERM_MAP[lang] || [];
    for (let i = 0; i < rules.length; i++) {
      out = out.replace(rules[i][0], rules[i][1]);
    }
    return out;
  }

  function formatCurrency(amountVnd, currencyOverride) {
    const curr = (currencyOverride || currentCurrency || 'VND').toUpperCase();
    const numVnd = Number(amountVnd) || 0;
    if (curr === 'USD') {
      const val = numVnd / CURRENCY_RATES.USD;
      return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (curr === 'CNY') {
      const val = numVnd / CURRENCY_RATES.CNY;
      return '¥' + val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return Math.round(numVnd).toLocaleString('vi-VN') + ' ₫';
  }

  function applyDomTranslations() {
    document.documentElement.setAttribute('lang', currentLang);
    // 1. Update all elements with [data-i18n]
    const nodes = document.querySelectorAll('[data-i18n]');
    nodes.forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translated = t(key, null);
      if (translated) {
        el.textContent = translated;
      }
    });

    // 2. Update active state on language switcher buttons
    const langBtns = document.querySelectorAll('[data-lang-btn]');
    langBtns.forEach(btn => {
      const code = btn.getAttribute('data-lang-btn');
      const isActive = code === currentLang;
      btn.classList.toggle('active', isActive);
      btn.style.background = isActive ? '#059669' : 'transparent';
      btn.style.color = isActive ? '#ffffff' : '#334155';
      btn.style.fontWeight = isActive ? '800' : '700';
    });

    // 3. Update active state on currency switcher buttons
    const currBtns = document.querySelectorAll('[data-currency-btn]');
    currBtns.forEach(btn => {
      const code = btn.getAttribute('data-currency-btn');
      const isActive = code === currentCurrency;
      btn.classList.toggle('active', isActive);
      btn.style.background = isActive ? '#0f172a' : 'transparent';
      btn.style.color = isActive ? '#ffffff' : '#475569';
      btn.style.fontWeight = isActive ? '800' : '700';
    });

    // 4. Translate dynamic elements with [data-i18n-dynamic]
    const dynNodes = document.querySelectorAll('[data-i18n-dynamic]');
    dynNodes.forEach(el => {
      const orig = el.getAttribute('data-orig-vi') || el.textContent;
      if (!el.getAttribute('data-orig-vi')) {
        el.setAttribute('data-orig-vi', orig);
      }
      el.textContent = currentLang === 'vi' ? orig : translateDynamicTerm(orig, currentLang);
    });
  }

  function setLanguage(lang, syncCurrency) {
    const clean = String(lang || 'vi').toLowerCase().trim();
    if (!['vi', 'en', 'zh'].includes(clean)) return;
    currentLang = clean;
    try {
      localStorage.setItem('pb_locale', currentLang);
    } catch (_) {}

    if (syncCurrency !== false) {
      currentCurrency = clean === 'zh' ? 'CNY' : (clean === 'en' ? 'USD' : 'VND');
      try {
        localStorage.setItem('pb_currency', currentCurrency);
      } catch (_) {}
    }

    applyDomTranslations();
    window.dispatchEvent(new CustomEvent('pb:languageChanged', {
      detail: { lang: currentLang, currency: currentCurrency }
    }));
  }

  function setCurrency(curr) {
    const clean = String(curr || 'VND').toUpperCase().trim();
    if (!['VND', 'USD', 'CNY'].includes(clean)) return;
    currentCurrency = clean;
    try {
      localStorage.setItem('pb_currency', currentCurrency);
    } catch (_) {}
    applyDomTranslations();
    window.dispatchEvent(new CustomEvent('pb:currencyChanged', {
      detail: { lang: currentLang, currency: currentCurrency }
    }));
  }

  // Async dictionary hydration from /i18n/{lang}.json
  async function hydrateRemoteDictionary(lang) {
    try {
      const res = await fetch(`/i18n/${lang}.json`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        CORE_DICTIONARIES[lang] = Object.assign({}, CORE_DICTIONARIES[lang] || {}, json);
        if (lang === currentLang) applyDomTranslations();
      }
    } catch (_) {}
  }

  window.PlantBookI18n = {
    getLanguage: () => currentLang,
    getCurrency: () => currentCurrency,
    setLanguage,
    setCurrency,
    t,
    translateDynamicTerm,
    formatCurrency,
    applyDomTranslations,
    hydrateRemoteDictionary,
    CURRENCY_RATES
  };

  window.switchExportLanguage = function (lang) {
    setLanguage(lang, true);
  };

  window.switchBiCurrency = function (curr) {
    setCurrency(curr);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyDomTranslations();
      hydrateRemoteDictionary(currentLang);
    });
  } else {
    applyDomTranslations();
    hydrateRemoteDictionary(currentLang);
  }
})();
