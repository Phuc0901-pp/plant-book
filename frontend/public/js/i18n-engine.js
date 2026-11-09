/* Plant Book Agtech (c) 2026 TBSG Agtech. All Rights Reserved. Enterprise Protected Asset */
/* ═══════════════════════════════════════════════════════════════════════════
   Universal Export Multi-Language (i18n) & Multi-Currency Engine (VI | EN | ZH)
   Features:
   - Full-DOM TextNode TreeWalker + Real-Time MutationObserver (0ms Instant Translation)
   - Translates User Portal (Dashboard, Supplies & Cost ERP, Farms, Logs, Settings),
     Admin Portal, and Public QR/NFC Traceability Portal
   - Automatic Inline Currency Conversion (VNĐ / ₫ -> USD $ / CNY ¥)
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
        btn_verify_api: 'Kiểm tra Live API BI & ML',
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
        btn_verify_api: 'Verify Live BI & ML APIs',
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
        btn_verify_api: '验证后端 BI 与机器学习 API',
        redacted_notice: 'RBAC 权限安全保护：企业财务 BI 数据仅对庄园主、合作社理事长及系统管理员开放。'
      }
    }
  };

  // Exact Phrase Map for Full-DOM Translation across Sidebar, Topbar, Supplies, Dashboard, Admin & QR Portal
  const EXACT_PHRASE_MAP = {
    'Hệ thống quản lý cây trồng': { en: 'Enterprise Crop Management ERP', zh: '数字化果园与作物管理系统' },
    'Chức năng': { en: 'Navigation', zh: '系统功能导航' },
    'Trang chủ': { en: 'Dashboard', zh: '首页看板' },
    'Trang trại': { en: 'Farms & GIS', zh: '果园与 GIS' },
    'Vật tư': { en: 'Supplies & Costs', zh: '农资与成本' },
    'Vật tư & Tồn kho': { en: 'Supplies & Inventory', zh: '农资与库存管理' },
    'Lịch sử': { en: 'Care Ledger', zh: '农事记录' },
    'Tính năng nâng cao & HDSD': { en: 'Advanced Features & Guide', zh: '高级功能与操作指南' },
    'Cài đặt': { en: 'Settings', zh: '系统设置' },
    'Đăng xuất': { en: 'Sign Out', zh: '退出登录' },
    'Trực tuyến': { en: 'Online', zh: '实时在线' },
    'Làm mới': { en: 'Refresh', zh: '刷新' },
    'Làm mới dữ liệu': { en: 'Refresh Data', zh: '刷新数据' },
    'Xin chào,': { en: 'Welcome,', zh: '您好，' },
    'Gói Nông Hộ PRO': { en: 'PRO Farm Enterprise', zh: 'PRO 庄园企业版' },
    '· Cổng Nông Hộ': { en: '· Farmer Portal', zh: '· 庄园管理端' },
    'HỒ SƠ NÔNG HỘ': { en: 'FARMER & ORCHARD DOSSIER', zh: '庄园主与果园档案' },
    'Thông tin chủ hộ': { en: 'Farm Owner Profile', zh: '庄园主信息' },
    'Phân quyền Nhân sự Vườn (RBAC)': { en: 'Orchard Team RBAC', zh: '果园团队权限管理 (RBAC)' },
    'Phân quyền Tài khoản Dưới quyền': { en: 'Manage Sub-Accounts (RBAC)', zh: '管理下属账号权限 (RBAC)' },
    'Trung Tâm Giám Sát Cảnh Báo & Sức Khỏe Vườn Cây': { en: 'Orchard Health & Risk Monitoring Center', zh: '果园健康与风险预警监控中心' },
    'Hệ thống quan trắc dịch hại, sức khỏe sinh lý & khuyến nghị kỹ thuật VietGAP thời gian thực': { en: 'Real-time pest telemetry, physiological health & VietGAP agronomic recommendations', zh: '实时病虫害监测、果树生理健康与 VietGAP 农艺建议' },
    'Danh Sách Cây Trồng Tiêu Biểu': { en: 'Featured Registered Trees', zh: '核心登记果树列表' },
    'Hồ sơ định danh số, thẻ NFC & quản trị canh tác VietGAP': { en: 'Digital twin identity, NFC tags & VietGAP cultivation governance', zh: '数字孪生身份、NFC 芯片与 VietGAP 农事管控' },
    'Mở Toàn Bộ Danh Sách Cây & Không Gian GIS': { en: 'Open Full Tree Registry & GIS Map', zh: '打开全部果树档案与 GIS 卫星地图' },
    'Quản Trị Tồn Kho & Chuỗi Cung Ứng': { en: 'Inventory & Supply Chain Governance', zh: '农资库存与供应链管控' },
    'Quản Trị Tồn Kho & Chi Phí Vật Tư AgTech ERP': { en: 'AgTech ERP Inventory & Supply Cost Management', zh: 'AgTech ERP 农资库存与成本管控系统' },
    'Hệ thống định lượng tồn kho thời gian thực, định giá tài sản lưu kho, thẻ kho minh bạch và kiểm soát chi phí VietGAP.': { en: 'Real-time stock quantification, inventory valuation, transparent stock ledger & VietGAP cost accounting.', zh: '实时库存量化、库存资产估值、透明出入库台账与 VietGAP 成本精算。' },
    '+ Nhập Kho Vật Tư': { en: '+ Stock In Supplies', zh: '+ 农资入库' },
    'Thêm Mặt Hàng': { en: 'Add Supply Item', zh: '新增农资品项' },
    '+ Thêm Mặt Hàng': { en: '+ Add Supply Item', zh: '+ 新增农资品项' },
    'BỘ LỌC HẠCH TOÁN CHI PHÍ & DOANH THU': { en: 'COST & REVENUE ACCOUNTING FILTER', zh: '成本与营收核算筛选器' },
    'Hạch toán theo trang trại sở hữu và niên vụ canh tác': { en: 'Accounting by owned farm and cultivation season', zh: '按所属庄园与产季年份进行财务核算' },
    'Trang trại:': { en: 'Farm:', zh: '庄园：' },
    'Tất cả trang trại': { en: 'All Farms', zh: '全部庄园' },
    'Năm:': { en: 'Year:', zh: '年份：' },
    'Tất cả các năm': { en: 'All Years', zh: '全部年份' },
    'Năm 2026': { en: 'Year 2026', zh: '2026年' },
    'Năm 2025': { en: 'Year 2025', zh: '2025年' },
    'Năm 2024': { en: 'Year 2024', zh: '2024年' },
    'Năm 2023': { en: 'Year 2023', zh: '2023年' },
    'Lọc dữ liệu': { en: 'Apply Filter', zh: '筛选数据' },
    'GIÁ TRỊ NHẬP KHO VẬT TƯ': { en: 'TOTAL STOCK-IN VALUATION', zh: '农资入库总价值' },
    'Tổng vốn mua hàng nhập vào trang trại': { en: 'Total capital invested in farm supplies', zh: '采购农资入库总投入资金' },
    'Tồn kho thực tế:': { en: 'Current Stock Value:', zh: '当前实际库存价值：' },
    'TIÊU HAO VẬT TƯ LŨY KẾ': { en: 'CUMULATIVE SUPPLY CONSUMPTION', zh: '累计农资消耗总成本' },
    'Bón phân:': { en: 'Fertilizer:', zh: '化肥 (NPK)：' },
    'Phun thuốc:': { en: 'Pesticides:', zh: '植保农药：' },
    'Tiền nước:': { en: 'Water/Energy:', zh: '灌溉水电：' },
    'Nhân công:': { en: 'Labor:', zh: '人工成本：' },
    'Bón phân': { en: 'Fertilizer', zh: '施肥 (NPK)' },
    'Phun thuốc': { en: 'Pesticides', zh: '植保喷药' },
    'Tiền nước': { en: 'Water & Energy', zh: '灌溉水电' },
    'Nhân công': { en: 'Labor', zh: '人工成本' },
    'Tất cả': { en: 'All Categories', zh: '全部类别' },
    'Hạch toán thực tế trên cây': { en: 'Actual per-tree cost accounting', zh: '单株果树实际成本核算' },
    'DOANH THU THU HOẠCH CÂY TRỒNG': { en: 'CROP HARVEST REVENUE', zh: '果树采收总营收' },
    'ĐÓNG GÓP THEO TỪNG CÂY:': { en: 'CONTRIBUTION PER TREE:', zh: '单株果树营收贡献：' },
    'Chưa có dữ liệu thu hoạch trong kỳ': { en: 'No harvest recorded in this period (See ML Forecast below)', zh: '本期暂无实际采收 (请查看下方机器学习产季预测)' },
    'Lợi nhuận ròng (Net Profit):': { en: 'Net Profit:', zh: '净利润 (Net Profit)：' },
    '1. Tồn kho Thực tế': { en: '1. Physical Inventory', zh: '1. 实时库存矩阵' },
    '2. Sổ Thẻ Kho': { en: '2. Stock Ledger', zh: '2. 出入库台账' },
    '3. Chi phí Mùa vụ': { en: '3. Seasonal Cost & Executive BI', zh: '3. 产季成本与 BI 预测' },
    'Chế độ hiển thị:': { en: 'View Mode:', zh: '视图模式：' },
    'Phân tích BI & Dự báo Học máy (ML)': { en: 'Executive BI & ML Forecast', zh: '财务 BI 与机器学习预测' },
    'Chi phí Theo Kỳ (Ngày / Tháng / Quý)': { en: 'Cost by Period (Day / Month / Quarter)', zh: '按周期成本统计 (日/月/季)' },
    'Xem gộp': { en: 'Combined View', zh: '合并全景视图' },
    'Bộ Lọc Giám Sát Chi Phí Theo Mùa Vụ:': { en: 'Seasonal Cost Filter:', zh: '产季成本监控筛选：' },
    'Ma Trận Quản Trị Tồn Kho Thực Tế': { en: 'Real-Time Physical Inventory Matrix', zh: '实时农资库存管理矩阵' },
    'Giám sát số lượng tồn, vốn hàng tồn và quy cách đóng gói chuẩn ERP.': { en: 'Monitor stock quantities, inventory capital & ERP packaging specs.', zh: '监控实时库存数量、库存资金占用与 ERP 包装规格。' },
    'Ghi nhận tiêu hao': { en: 'Record Usage', zh: '登记农资消耗' },
    'Khai báo vật tư mới': { en: 'Register New Supply', zh: '申报新农资' },
    'Đã chiết xuất sử dụng:': { en: 'Extracted usage:', zh: '已出库使用：' },
    'Đã ghi nhận chăm sóc:': { en: 'Recorded care:', zh: '已记录农事：' },
    'đợt canh tác': { en: 'cultivation batches', zh: '次农事操作' },
    'Sản lượng:': { en: 'Harvest Yield:', zh: '采收产量：' },
    'Tất cả mức tồn kho': { en: 'All Stock Levels', zh: '全部库存状态' },
    'Còn hàng dồi dào': { en: 'Abundant Stock (>=50%)', zh: '库存充足 (>=50%)' },
    'Sắp hết hàng (< 20%)': { en: 'Low Stock (< 20%)', zh: '库存预警 (< 20%)' },
    'Đã hết hàng trong kho': { en: 'Out of Stock', zh: '已缺货' },
    'Vật tư vĩnh cửu (Nước/Công)': { en: 'Continuous Utility (Water/Labor)', zh: '持续性资源 (水电/人工)' },
    'Mã SKU': { en: 'SKU Code', zh: 'SKU 编码' },
    'Tên Vật Tư & Quy Cách': { en: 'Supply Name & Spec', zh: '农资名称与规格' },
    'Tồn Kho & Mức Dự Trữ': { en: 'Physical Stock & Reserve', zh: '实际库存与储备' },
    'Đơn Giá Mua': { en: 'Unit Price', zh: '采购单价' },
    'Vốn Lưu Kho': { en: 'Stock Valuation', zh: '库存资金' },
    'Chuẩn VietGAP': { en: 'VietGAP Status', zh: 'VietGAP 标准' },
    'Thao Tác': { en: 'Actions', zh: '操作' },
    'Mức tồn:': { en: 'Stock Level:', zh: '库存状态：' },
    '≥ 50% (Dồi dào)': { en: '≥ 50% (Abundant)', zh: '≥ 50% (充足)' },
    '20% - 49% (Trung bình)': { en: '20% - 49% (Moderate)', zh: '20% - 49% (适中)' },
    '< 20% (Báo động)': { en: '< 20% (Low Alert)', zh: '< 20% (预警)' },
    'Vô tận (Nước / Nhân công)': { en: 'Utility (Water / Labor)', zh: '持续供应 (水电/人工)' },
    'Sổ Thẻ Kho & Lịch Sử Biến Động Nhập - Xuất': { en: 'Stock Ledger & In/Out Transaction History', zh: '出入库台账与农资变动历史' },
    'Minh bạch dòng vật tư từ lúc nhập vào kho cho đến khi xuất bón từng cây trồng.': { en: 'Transparent supply chain tracking from stock-in to single-tree application.', zh: '从采购入库到单株果树施肥喷药的全流程透明追踪。' },
    'Bộ Lọc Giám Sát Chi Phí Theo Mùa Vụ': { en: 'Seasonal Cost Monitoring Filter', zh: '产季成本监控筛选器' },
    'Theo Ngày': { en: 'By Day', zh: '按日统计' },
    'Theo Tháng': { en: 'By Month', zh: '按月统计' },
    'Theo Quý': { en: 'By Quarter', zh: '按季度统计' },
    'Theo Năm': { en: 'By Year', zh: '按年度统计' },
    'Từ:': { en: 'From:', zh: '从：' },
    'Đến:': { en: 'To:', zh: '至：' },
    'Từ năm:': { en: 'From Year:', zh: '起始年份：' },
    'Đến năm:': { en: 'To Year:', zh: '截止年份：' },
    '7 ngày': { en: '7 Days', zh: '近7天' },
    '30 ngày': { en: '30 Days', zh: '近30天' },
    'Tháng này': { en: 'This Month', zh: '本月' },
    'TỔNG CHI PHÍ TIÊU HAO': { en: 'TOTAL CONSUMPTION COST', zh: '累计消耗总成本' },
    'CHI PHÍ BÓN PHÂN': { en: 'FERTILIZER COST (NPK)', zh: '化肥投入成本 (NPK)' },
    'CHI PHÍ TIỀN NƯỚC': { en: 'IRRIGATION WATER COST', zh: '灌溉水电成本' },
    'PHUN THUỐC & NHÂN CÔNG': { en: 'PESTICIDES & LABOR COST', zh: '农药与人工成本' },
    'Biểu Đồ Nhiệt Chi Phí Tiêu Hao (Expenditure Heatmap)': { en: 'Expenditure Trajectory & Heatmap Chart', zh: '农资成本消耗趋势与热力图' },
    'Ít:': { en: 'Low:', zh: '低：' },
    'Vừa:': { en: 'Med:', zh: '中：' },
    'Nhiều:': { en: 'High:', zh: '高：' },
    'Chưa có dữ liệu tiêu hao chi phí trong khoảng thời gian này.': { en: 'No expenditure records found in this time range.', zh: '该时间段内暂无农资消耗成本记录。' },
    'Không có dữ liệu tiêu hao vật tư trong khoảng thời gian này.': { en: 'No supply usage records found in this time range.', zh: '该时间段内暂无农资使用明细。' },
    'Bảng Tổng Hợp Chi Tiết Tiêu Hao Theo Thời Gian': { en: 'Detailed Time-Series Cost Breakdown Table', zh: '按时间维度农资消耗明细汇总表' },
    'Khoảng thời gian': { en: 'Time Period', zh: '时间周期' },
    'Hạng mục vật tư': { en: 'Supply Category', zh: '农资类别' },
    'Tổng số lượng dùng': { en: 'Total Quantity Used', zh: '消耗总数量' },
    'Tổng thành tiền (VNĐ)': { en: 'Total Amount', zh: '总金额' },
    'Tỷ lệ chi phí': { en: 'Cost Share (%)', zh: '成本占比 (%)' },
    'Trung Tâm Điều Hành Chuỗi Trang Trại': { en: 'Enterprise Farm Chain Command Center', zh: '农业集团庄园链指挥中心' },
    'Nông Hộ Liên Kết': { en: 'Affiliated Farmers', zh: '合作庄园主' },
    'Trang Trại Trực Tuyến': { en: 'Online GIS Farms', zh: '在线 GIS 庄园' },
    'Chủng Loại Cây Trồng': { en: 'Crop Species', zh: '作物品类' },
    'Địa Bàn Trọng Điểm': { en: 'Key Growing Regions', zh: '核心种植产区' }
  };

  const LOWER_PHRASE_MAP = {};
  Object.keys(EXACT_PHRASE_MAP).forEach(k => {
    LOWER_PHRASE_MAP[k.toLowerCase()] = EXACT_PHRASE_MAP[k];
  });

  // Dynamic Pattern Replacers for strings with embedded numbers/variables
  const DYNAMIC_PATTERNS = {
    en: [
      [/^Đã chiết xuất sử dụng:\s*(\d+)\s*đợt canh tác$/i, 'Extracted usage: $1 cultivation batches'],
      [/^(\d+)\s*mặt hàng lưu kho$/i, '$1 items in stock'],
      [/^Hiển thị\s*(\d+)\s*mặt hàng$/i, 'Showing $1 items'],
      [/^Sản lượng:\s*([\d.,]+)\s*kg\s*\(([\d.,]+)\s*quả\)$/i, 'Harvest Yield: $1 kg ($2 fruits)'],
      [/^\(([\d.,]+)\s*quả\)$/i, '($1 fruits)'],
      [/^Phân bổ:\s*Tất cả trang trại\s*·\s*Năm\s*(\d+)$/i, 'Scope: All Farms · Year $1'],
      [/^Phân bổ:\s*Tất cả trang trại\s*·\s*Tất cả các năm$/i, 'Scope: All Farms · All Years'],
      [/^Phân bổ:\s*(.+?)\s*·\s*Năm\s*(\d+)$/i, 'Scope: $1 · Year $2'],
      [/^Tổng chi phí:\s*(.+)$/i, 'Total Cost: $1'],
      [/^BIỂU ĐỒ ĐƯỜNG CHI PHÍ TIÊU HAO\s*\((\d+)\s*KỲ CHỌN\)$/i, 'EXPENDITURE TRAJECTORY CHART ($1 PERIODS)'],
      [/^Bảng tổng hợp chi phí vật tư\s*\((.+)\)$/i, 'Detailed Supply Cost Breakdown ($1)'],
      [/^Tổng số:\s*(\d+)\s*cây$/i, 'Total: $1 trees'],
      [/Sầu riêng Ri6/gi, 'Ri6 Premium Durian'],
      [/Sầu riêng Monthong/gi, 'Monthong Export Durian'],
      [/Sầu riêng/gi, 'Durian'],
      [/Thanh long ruột đỏ/gi, 'Red-Flesh Dragon Fruit'],
      [/Thanh long ruột trắng/gi, 'White-Flesh Dragon Fruit'],
      [/Thanh long/gi, 'Dragon Fruit'],
      [/An toàn thu hoạch/gi, 'Safe for Harvest (PHI Verified)']
    ],
    zh: [
      [/^Đã chiết xuất sử dụng:\s*(\d+)\s*đợt canh tác$/i, '已出库使用：$1 次农事操作'],
      [/^(\d+)\s*mặt hàng lưu kho$/i, '$1 项库存农资'],
      [/^Hiển thị\s*(\d+)\s*mặt hàng$/i, '显示 $1 项农资'],
      [/^Sản lượng:\s*([\d.,]+)\s*kg\s*\(([\d.,]+)\s*quả\)$/i, '采收产量：$1 公斤 ($2 颗果)'],
      [/^\(([\d.,]+)\s*quả\)$/i, '($1 颗果)'],
      [/^Phân bổ:\s*Tất cả trang trại\s*·\s*Năm\s*(\d+)$/i, '核算范围：全部庄园 · $1年'],
      [/^Phân bổ:\s*Tất cả trang trại\s*·\s*Tất cả các năm$/i, '核算范围：全部庄园 · 全部年份'],
      [/^Phân bổ:\s*(.+?)\s*·\s*Năm\s*(\d+)$/i, '核算范围：$1 · $2年'],
      [/^Tổng chi phí:\s*(.+)$/i, '总成本：$1'],
      [/^BIỂU ĐỒ ĐƯỜNG CHI PHÍ TIÊU HAO\s*\((\d+)\s*KỲ CHỌN\)$/i, '农资消耗成本趋势图 ($1 个周期)'],
      [/^Bảng tổng hợp chi phí vật tư\s*\((.+)\)$/i, '农资消耗成本汇总表 ($1)'],
      [/^Tổng số:\s*(\d+)\s*cây$/i, '总计：$1 棵果树'],
      [/Sầu riêng Ri6/gi, '越南干尧榴莲 (Ri6 出口特级)'],
      [/Sầu riêng Monthong/gi, '越南金枕头榴莲 (Monthong)'],
      [/Sầu riêng/gi, '越南出口榴莲 (Durian)'],
      [/Thanh long ruột đỏ/gi, '越南红心火龙果'],
      [/Thanh long ruột trắng/gi, '越南白心火龙果'],
      [/Thanh long/gi, '越南出口火龙果'],
      [/An toàn thu hoạch/gi, '符合采收安全标准 (已过安全间隔期 PHI)']
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
  let isApplyingDom = false;

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

  function formatCurrency(amountVnd, currencyOverride) {
    const curr = (currencyOverride || currentCurrency || 'VND').toUpperCase();
    const numVnd = Number(amountVnd) || 0;
    const sign = numVnd < 0 ? '-' : '';
    const absVnd = Math.abs(numVnd);
    if (curr === 'USD') {
      const val = absVnd / CURRENCY_RATES.USD;
      return sign + '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (curr === 'CNY') {
      const val = absVnd / CURRENCY_RATES.CNY;
      return sign + '¥' + val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return sign + Math.round(absVnd).toLocaleString('vi-VN') + ' ₫';
  }

  // Convert inline Vietnamese currency strings like "3.407.600 VNĐ" or "-3.407.600 VNĐ" or "0 VNĐ"
  function convertInlineVndString(str) {
    if (!str || currentCurrency === 'VND') return str;
    return String(str).replace(/([+-]?\s*\d[\d.]*)\s*(?:VNĐ|VND|đ|₫)\b/g, function (match, numPart) {
      const cleanDigits = numPart.replace(/\s+/g, '').replace(/\./g, '');
      const parsed = parseFloat(cleanDigits);
      if (isNaN(parsed)) return match;
      const prefixPlus = numPart.trim().startsWith('+') ? '+' : '';
      return prefixPlus + formatCurrency(parsed, currentCurrency);
    });
  }

  function translateDynamicTerm(rawText, langOverride) {
    const lang = langOverride || currentLang;
    if (!rawText) return rawText;
    const rawStr = String(rawText);
    const trimmed = rawStr.trim();
    if (!trimmed) return rawStr;

    let translated = trimmed;

    if (lang !== 'vi') {
      // 1. Check exact or case-insensitive phrase dictionary
      const lowerKey = trimmed.toLowerCase();
      if (EXACT_PHRASE_MAP[trimmed] && EXACT_PHRASE_MAP[trimmed][lang]) {
        translated = EXACT_PHRASE_MAP[trimmed][lang];
      } else if (LOWER_PHRASE_MAP[lowerKey] && LOWER_PHRASE_MAP[lowerKey][lang]) {
        translated = LOWER_PHRASE_MAP[lowerKey][lang];
      } else {
        // 2. Apply regex patterns
        const rules = DYNAMIC_PATTERNS[lang] || [];
        for (let i = 0; i < rules.length; i++) {
          translated = translated.replace(rules[i][0], rules[i][1]);
        }
      }
    }

    // 3. Apply inline currency conversion if currency !== VND
    if (currentCurrency !== 'VND' && /(?:VNĐ|VND|₫|\d+\s*đ\b)/.test(translated)) {
      translated = convertInlineVndString(translated);
    }

    const leadingSpace = rawStr.match(/^\s*/)[0];
    const trailingSpace = rawStr.match(/\s*$/)[0];
    return leadingSpace + translated + trailingSpace;
  }

  function translateAllDomTextNodes() {
    if (!document.body) return;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'CODE' || tag === 'PRE') {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.hasAttribute('data-lang-btn') || parent.hasAttribute('data-currency-btn')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let textNode;
    while ((textNode = walker.nextNode())) {
      const currentVal = textNode.nodeValue;
      if (!currentVal || !currentVal.trim()) continue;

      // If node was updated by application JS with a new Vietnamese string, capture new original
      if (textNode._origVi === undefined || (currentVal !== textNode._lastApplied && currentLang !== 'vi')) {
        // Only overwrite _origVi if currentVal looks like a fresh source update
        if (textNode._origVi === undefined || currentVal !== textNode._lastApplied) {
          textNode._origVi = currentVal;
        }
      }

      const sourceVi = textNode._origVi;
      const nextVal = (currentLang === 'vi' && currentCurrency === 'VND')
        ? sourceVi
        : translateDynamicTerm(sourceVi, currentLang);

      if (textNode.nodeValue !== nextVal) {
        textNode.nodeValue = nextVal;
      }
      textNode._lastApplied = nextVal;
    }

    // Translate input placeholders
    document.querySelectorAll('input[placeholder]').forEach(inp => {
      const curPh = inp.getAttribute('placeholder') || '';
      if (!inp._origPhVi) inp._origPhVi = curPh;
      if (currentLang === 'vi') {
        inp.setAttribute('placeholder', inp._origPhVi);
      } else if (inp._origPhVi.includes('Tìm kiếm SKU')) {
        inp.setAttribute('placeholder', currentLang === 'zh' ? '搜索 SKU 编号、农资名称...' : 'Search SKU, supply name...');
      }
    });
  }

  function applyDomTranslations() {
    if (isApplyingDom) return;
    isApplyingDom = true;
    try {
      document.documentElement.setAttribute('lang', currentLang);

      // 1. Update all elements with [data-i18n]
      const nodes = document.querySelectorAll('[data-i18n]');
      nodes.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translated = t(key, null);
        if (translated) {
          el.textContent = translated;
          if (el.firstChild && el.firstChild.nodeType === 3) {
            el.firstChild._lastApplied = translated;
          }
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

      // 4. Full-DOM TextNode & Currency Translation across all pages
      translateAllDomTextNodes();
    } finally {
      isApplyingDom = false;
    }
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

  // Real-time debounced MutationObserver so dynamically rendered pages (Supplies, Logs, Dashboard) auto-translate
  let mutationTimer = null;
  function setupMutationObserver() {
    if (!document.body || typeof MutationObserver === 'undefined') return;
    const obs = new MutationObserver(() => {
      if (isApplyingDom) return;
      if (currentLang === 'vi' && currentCurrency === 'VND') return;
      if (mutationTimer) clearTimeout(mutationTimer);
      mutationTimer = setTimeout(() => {
        applyDomTranslations();
      }, 30);
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
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
      setupMutationObserver();
      hydrateRemoteDictionary(currentLang);
    });
  } else {
    applyDomTranslations();
    setupMutationObserver();
    hydrateRemoteDictionary(currentLang);
  }
})();
