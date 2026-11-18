/* Plant Book Agtech (c) 2026 TBSG Agtech. All Rights Reserved. Enterprise Protected Asset */
/* ═══════════════════════════════════════════════════════════════════════════
   Universal Export Multi-Language (i18n) & Multi-Currency Engine (VI | EN | ZH)
   Features:
   - Full-DOM TextNode TreeWalker + Real-Time MutationObserver (0ms Instant Translation)
   - Colon/Bracket-Tolerant Normalization + Multi-Segment Compound Translator
   - Attribute & Option Translation (placeholder, title, aria-label, select <option>)
   - Translates User Portal (incl. ERP Plant Profile Modal), Admin Portal,
     Public QR/NFC Traceability Portal, and Report Export Portal
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

  // Exact Phrase Dictionary covering User Portal, ERP Modal (Hình 1), Public Portal (Hình 2), Admin Portal & Report
  const EXACT_PHRASE_MAP = {
    // ── Core Navigation & Common Chrome ──
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
    'Tải Lại Dữ Liệu': { en: 'Reload Data', zh: '重新加载数据' },
    'Xin chào,': { en: 'Welcome,', zh: '您好，' },
    'Gói Nông Hộ PRO': { en: 'PRO Farm Enterprise', zh: 'PRO 庄园企业版' },
    'Nông hộ NORMAL': { en: 'Farmer Account', zh: '标准庄园账号' },
    '· Cổng Nông Hộ': { en: '· Farmer Portal', zh: '· 庄园管理端' },
    'HỒ SƠ NÔNG HỘ': { en: 'FARMER & ORCHARD DOSSIER', zh: '庄园主与果园档案' },
    'Thông tin chủ hộ': { en: 'Farm Owner Profile', zh: '庄园主信息' },
    'Phân quyền Nhân sự Vườn (RBAC)': { en: 'Orchard Team RBAC', zh: '果园团队权限管理 (RBAC)' },
    'Phân quyền Tài khoản Dưới quyền': { en: 'Manage Sub-Accounts (RBAC)', zh: '管理下属账号权限 (RBAC)' },
    'Phân quyền (RBAC)': { en: 'Permissions (RBAC)', zh: '权限管理 (RBAC)' },
    'Quay lại': { en: 'Back', zh: '返回' },
    'Tiếp theo': { en: 'Next', zh: '下一步' },
    'Đóng': { en: 'Close', zh: '关闭' },
    'Hủy': { en: 'Cancel', zh: '取消' },
    'Hủy bỏ': { en: 'Cancel', zh: '取消' },
    'Lưu': { en: 'Save', zh: '保存' },
    'Sửa': { en: 'Edit', zh: '编辑' },
    'Xóa': { en: 'Delete', zh: '删除' },
    'Mở': { en: 'Open', zh: '打开' },
    'Sao chép': { en: 'Copy', zh: '复制' },
    'Chi tiết': { en: 'Details', zh: '详情' },
    'Đặt lại': { en: 'Reset', zh: '重置' },
    'Tất cả': { en: 'All', zh: '全部' },
    'Đang tải...': { en: 'Loading...', zh: '正在加载...' },
    'Đang tải': { en: 'Loading', zh: '正在加载' },
    'Đang kết nối': { en: 'Connecting', zh: '正在连接' },
    'Tất cả các năm': { en: 'All Years', zh: '全部年份' },
    'Tất cả trang trại': { en: 'All Farms', zh: '全部庄园' },
    'Tất cả hạng mục': { en: 'All Categories', zh: '全部农事类别' },
    'Tất cả hoạt động': { en: 'All Activities', zh: '全部农事活动' },
    'Tất cả vật tư': { en: 'All Supplies', zh: '全部农资' },
    'Tất cả cây trồng': { en: 'All Trees', zh: '全部果树' },

    // ── Notification Center ──
    'Trung Tâm Thông Báo': { en: 'Notification Center', zh: '消息通知中心' },
    'Đã đọc hết': { en: 'Mark all read', zh: '全部标为已读' },
    'Chưa đọc': { en: 'Unread', zh: '未读' },
    'Cảnh báo': { en: 'Alerts', zh: '预警通知' },
    'Đang tải thông báo...': { en: 'Loading notifications...', zh: '正在加载通知...' },
    'Âm Khuyến Nghị': { en: 'Advisory Chime', zh: '建议提示音' },
    'Còi Báo Động': { en: 'Alert Siren', zh: '警报铃声' },
    'Bật Thông Báo Đẩy Màn Hình': { en: 'Enable Push Notifications', zh: '开启桌面推送通知' },

    // ── Hình 1: ERP Plant Profile Modal ──
    'Khỏe mạnh': { en: 'Healthy', zh: '健康良好' },
    'Cần chăm sóc': { en: 'Needs Attention', zh: '需关注护理' },
    'Cần chú ý': { en: 'Needs Attention', zh: '需重点关注' },
    'Nhiễm bệnh': { en: 'Infected', zh: '发现病害' },
    'Bình thường': { en: 'Normal', zh: '生长正常' },
    'Tốt': { en: 'Good', zh: '优良' },
    'Bệnh': { en: 'Diseased', zh: '感染病虫害' },
    'Ghi nhật ký': { en: 'Log Care', zh: '记录农事' },
    'Tuổi cây & Ngày trồng': { en: 'Tree Age & Planting Date', zh: '树龄与定植日期' },
    'Lô & Hàng vị trí': { en: 'Plot & Row Location', zh: '种植分区与行号' },
    'Năng suất mùa trước': { en: 'Prior Season Yield', zh: '上季产量记录' },
    'Thẻ NFC RFID': { en: 'NFC RFID Tag', zh: 'NFC 射频芯片' },
    'Chưa gán thẻ': { en: 'Unassigned', zh: '未绑定芯片' },
    'Chưa gán thẻ RFID': { en: 'RFID Tag Unassigned', zh: '未绑定 RFID 芯片' },
    'Chưa phân lô': { en: 'Unassigned Plot', zh: '未分配种植区' },
    'Chưa ghi nhận': { en: 'Not recorded', zh: '暂无记录' },
    'Chưa cập nhật': { en: 'Not updated', zh: '尚未更新' },
    'Chưa thu hoạch': { en: 'No harvest yet', zh: '暂无采收' },
    'Chưa phân loại': { en: 'Unclassified', zh: '未分类' },
    '1. Thông Số Nông Học & GPS': { en: '1. Agronomic Specs & GPS', zh: '1. 农艺参数与 GPS' },
    '2. Lịch Sử Canh Tác': { en: '2. Cultivation History', zh: '2. 农事操作记录' },
    '3. Chi Phí & Vật Tư Tiêu Hao': { en: '3. Costs & Supply Consumption', zh: '3. 成本与农资消耗' },
    'Giống cây trồng nông hộ': { en: 'Registered Commercial Cultivar', zh: '庄园登记商业品种' },
    'Ảnh Chụp Thực Tế': { en: 'Field Photo', zh: '实地实拍图' },
    'Ảnh Giống Cây Trồng': { en: 'Cultivar Reference Image', zh: '品种标准参考图' },
    'Hình ảnh định danh mô tả cây trồng': { en: 'Standard identification image for crop variety', zh: '果树品种标准识别参考图片' },
    'Ảnh chụp hiện trường sinh trưởng gần nhất của cây': { en: 'Latest field growth photo of this tree', zh: '本株果树最新实地生长拍照' },
    'Lịch Sử Ảnh Sinh Trưởng & Hiện Trường': { en: 'Growth & Field Photo Timeline', zh: '实地生长与农事影像档案' },
    'Lưu trữ bất biến qua các mùa vụ (Append-Only) · Tự động dùng ảnh giống khi chưa có ảnh thực tế': {
      en: 'Immutable append-only multi-season archive · Falls back to cultivar image when no field photo exists',
      zh: '跨产季不可篡改只增档案 (Append-Only) · 暂无实拍图时自动显示品种标准图'
    },
    '+ Chụp / Tải ảnh mới': { en: '+ Capture / Upload Photo', zh: '+ 拍照 / 上传新照片' },
    'Chưa có ảnh chụp sinh trưởng thực tế': { en: 'No field growth photos uploaded yet', zh: '暂无实地生长拍照记录' },
    'Thuộc Tính Canh Tác Chi Tiết': { en: 'Detailed Agronomic Attributes', zh: '详细农艺与种植属性' },
    'Mã định danh': { en: 'Tree Identifier', zh: '单株编号' },
    'Loài cây': { en: 'Crop Species', zh: '作物品类' },
    'Giống cây': { en: 'Cultivar / Variety', zh: '商业品种' },
    'Ngày trồng': { en: 'Planting Date', zh: '定植日期' },
    'Lô trồng': { en: 'Plot / Block', zh: '种植分区' },
    'Số thứ tự hàng': { en: 'Row Number', zh: '所在行号' },
    'Tiền Sử Dịch Bệnh & Vấn Đề Sức Khỏe Trước Đây': { en: 'Prior Pest & Health History', zh: '既往病虫害与健康史' },
    'Cây khỏe mạnh, chưa từng ghi nhận bệnh dịch trước đây': { en: 'Healthy tree — no prior disease history recorded', zh: '果树健康，既往无病虫害记录' },
    'Tọa Độ Định Vị Vệ Tinh (GPS)': { en: 'Satellite GPS Telemetry', zh: '卫星 GPS 精准定位' },
    'BẢO TOÀN TỌA ĐỘ': { en: 'LOCKED COORDINATES', zh: '坐标防篡改锁定' },
    'Tọa độ GPS WGS84': { en: 'WGS84 GPS Coordinates', zh: 'WGS84 卫星经纬度' },
    'Tọa độ này được khóa an toàn để quản lý tài sản cây trồng trên bản đồ GIS nội bộ nông hộ.': {
      en: 'Coordinates are securely locked for single-tree GIS asset governance.',
      zh: '该坐标已安全锁定，用于果园内部 GIS 地图单株资产管理。'
    },
    'Định Danh Không Dây NFC': { en: 'Wireless NFC Identity', zh: 'NFC 无线芯片防伪识别' },
    'Quản lý thẻ': { en: 'Manage Tag', zh: '管理芯片' },
    'Toàn Bộ Hoạt Động Canh Tác Của Cây Này': { en: 'Complete Single-Tree Cultivation Ledger', zh: '本株果树全部农事操作记录' },
    'Truy xuất hồ sơ VietGAP thời gian thực từ cơ sở dữ liệu': { en: 'Real-time VietGAP traceability ledger from database', zh: '数据库实时 VietGAP 农事溯源档案' },
    'Thêm nhật ký mới': { en: 'Add New Log', zh: '新增农事记录' },
    'Đang tải lịch sử canh tác...': { en: 'Loading cultivation history...', zh: '正在加载农事操作历史...' },
    'Chưa có dữ liệu nhật ký canh tác': { en: 'No cultivation logs recorded yet', zh: '暂无农事操作记录' },
    'Không có nhật ký phù hợp với bộ lọc': { en: 'No logs match the selected filters', zh: '没有符合筛选条件的农事记录' },
    'Tổng Doanh Thu Thu Hoạch': { en: 'Total Harvest Revenue', zh: '累计采收总营收' },
    'Lợi Nhuận Ròng (Lãi/Lỗ)': { en: 'Net Profit (P&L)', zh: '单株净利润 (盈亏)' },
    'Tổng Chi Phí Chăm Sóc': { en: 'Total Cultivation Cost', zh: '累计护理投入成本' },
    'Toàn bộ vật tư tiêu hao': { en: 'All consumed farm inputs', zh: '全部农资与水肥消耗' },
    'Phân Bón': { en: 'Fertilizers', zh: '化肥投入' },
    'Thuốc BVTV': { en: 'Pesticides', zh: '植保农药' },
    'Nước Tưới': { en: 'Irrigation Water', zh: '灌溉水费' },
    'Lịch sử các đợt thu hoạch của cây': { en: 'Single-Tree Harvest History', zh: '单株果树采收批次明细' },
    'Chưa có đợt thu hoạch nào được ghi nhận cho cây này.': { en: 'No harvest events recorded for this tree yet.', zh: '本株果树暂未登记采收记录。' },
    'Chi tiết bóc tách vật tư đã dùng cho cây': { en: 'Itemized Supplies Consumed by Tree', zh: '单株农资投入消耗明细表' },
    'Chưa phát sinh chi phí vật tư riêng biệt cho cây này.': { en: 'No tree-specific supply expenditure recorded yet.', zh: '暂未发生针对本株果树的农资成本记录。' },
    'Hồ sơ nông hộ ERP nội bộ · Bảo toàn GPS 100%': { en: 'Internal Farmer ERP Dossier · 100% Locked GPS Integrity', zh: '内部庄园 ERP 档案 · 100% GPS 坐标完整性保护' },
    'Đóng hồ sơ': { en: 'Close Dossier', zh: '关闭档案' },

    // ── Filter Bars (Hình 1 & Hình 2) ──
    'Hạng mục canh tác': { en: 'Cultivation Category', zh: '农事类别' },
    'Từ ngày': { en: 'From Date', zh: '开始日期' },
    'Đến ngày': { en: 'To Date', zh: '结束日期' },
    'Vật tư sử dụng': { en: 'Supply / Material', zh: '使用农资' },
    'Tìm kiếm từ khóa': { en: 'Keyword Search', zh: '关键词搜索' },

    // ── Log Card Labels, Roles, Notes & Special Fields (Hình 1 & Hình 2) ──
    'Kiểm toán quả': { en: 'Fruit Audit', zh: '结果审计盘点' },
    'KIỂM TOÁN QUẢ': { en: 'FRUIT AUDIT', zh: '结果审计盘点' },
    'Tưới nước': { en: 'Irrigation', zh: '灌溉浇水' },
    'TƯỚI NƯỚC': { en: 'IRRIGATION', zh: '灌溉浇水' },
    'Bón phân': { en: 'Fertilization', zh: '施肥作业' },
    'BÓN PHÂN': { en: 'FERTILIZATION', zh: '施肥作业' },
    'Phun thuốc': { en: 'Pesticide Spray', zh: '植保喷药' },
    'PHUN THUỐC': { en: 'PESTICIDE SPRAY', zh: '植保喷药' },
    'Nhân công': { en: 'Labor', zh: '人工成本' },
    'NHÂN CÔNG': { en: 'LABOR', zh: '人工成本' },
    'Thuê nhân công': { en: 'Hire Labor', zh: '雇用人工' },
    'Bệnh cây': { en: 'Plant Disease', zh: '病虫害监测' },
    'BỆNH CÂY': { en: 'PLANT DISEASE', zh: '病虫害监测' },
    'Thu hoạch': { en: 'Harvest', zh: '采收归集' },
    'THU HOẠCH': { en: 'HARVEST', zh: '采收归集' },
    'Cắt lá': { en: 'Pruning', zh: '修剪枝叶' },
    'Tỉa hoa': { en: 'Thinning', zh: '疏花疏果' },
    'Thụ phấn': { en: 'Pollination', zh: '人工授粉' },
    'Đậu quả': { en: 'Fruit Set', zh: '坐果期' },
    'Quả non': { en: 'Young Fruit', zh: '幼果期' },
    'Quả chín': { en: 'Ripe Fruit', zh: '成熟期' },
    'Giai đoạn': { en: 'Stage', zh: '挂果阶段' },
    'Đếm': { en: 'Count', zh: '实盘数量' },
    'Số quả đếm': { en: 'Counted Fruits', zh: '实盘果数' },
    'Rụng/Tỉa bỏ': { en: 'Dropped / Culled', zh: '落果/疏果' },
    'Giờ kiểm đếm': { en: 'Audit Time', zh: '盘点时间' },
    'Lý do': { en: 'Reason', zh: '原因说明' },
    'Ước tính': { en: 'Est. Yield', zh: '预计产量' },
    'Ghi chú': { en: 'Note', zh: '田间备注' },
    'Không có ghi chú chi tiết.': { en: 'No detailed notes recorded.', zh: '暂无详细田间备注。' },
    'Nhân sự': { en: 'Operator', zh: '操作人员' },
    'Người thực hiện': { en: 'Performed By', zh: '执行人员' },
    'Thiết bị': { en: 'Equipment', zh: '作业设备' },
    'Vật tư': { en: 'Supply', zh: '使用农资' },
    'Tiêu hao': { en: 'Cost', zh: '消耗费用' },
    'Phương pháp': { en: 'Method', zh: '作业方式' },
    'Lượng nước': { en: 'Water Volume', zh: '灌水量' },
    'Thời lượng': { en: 'Duration', zh: '作业时长' },
    'Nguồn nước': { en: 'Water Source', zh: '水源' },
    'Liều lượng': { en: 'Dosage', zh: '施用剂量' },
    'Thành phần': { en: 'Composition', zh: '成分配方' },
    'Hoạt chất': { en: 'Active Ingredient', zh: '有效成分' },
    'Nước pha': { en: 'Dilution Water', zh: '兑水量' },
    'Đối tượng': { en: 'Target Pest', zh: '防治对象' },
    'Cách ly PHI': { en: 'PHI Period', zh: '安全间隔期 (PHI)' },
    'Công việc': { en: 'Task', zh: '作业内容' },
    'Số công': { en: 'Workers', zh: '出工人数' },
    'Ca làm': { en: 'Shift', zh: '作业时段' },
    'Bệnh hại': { en: 'Disease', zh: '病害名称' },
    'Tên bệnh': { en: 'Disease Name', zh: '病害名称' },
    'Mức độ': { en: 'Severity', zh: '严重程度' },
    'Triệu chứng': { en: 'Symptoms', zh: '田间症状' },
    'Xử lý': { en: 'Treatment', zh: '防治措施' },
    'Sản lượng': { en: 'Yield', zh: '采收产量' },
    'Số quả': { en: 'Fruits', zh: '采收果数' },
    'Phẩm cấp': { en: 'Grade', zh: '果品等级' },
    'Mã lô VietGAP': { en: 'VietGAP Batch Code', zh: 'VietGAP 溯源批次号' },
    'Mã Lô VietGAP': { en: 'VietGAP Batch Code', zh: 'VietGAP 溯源批次号' },
    'Lô': { en: 'Batch', zh: '批次' },
    'Kỹ thuật viên trang trại': { en: 'Orchard Technician', zh: '庄园农技员' },
    'Chủ trang trại': { en: 'Farm Owner', zh: '庄园主' },
    'Nước tưới gốc': { en: 'Root irrigation water', zh: '根部灌溉用水' },
    'Tưới nhỏ giọt': { en: 'Drip irrigation', zh: '滴灌' },
    'Tưới tay thủ công': { en: 'Manual watering', zh: '人工手浇' },
    'Tưới phun mưa': { en: 'Sprinkler irrigation', zh: '喷灌' },
    'Tưới gốc': { en: 'Root watering', zh: '根部浇灌' },
    'Tự động': { en: 'Automated', zh: '自动控制' },
    'Béc bù áp IoT': { en: 'IoT Pressure-Compensated Emitter', zh: 'IoT 压力补偿滴头' },

    // ── Hình 2: Public Plant Traceability Portal (/plant.html) ──
    'Sổ Nông Số Hóa': { en: 'Digital Farm Book', zh: '数字化果园台账' },
    'Cổng Thông Tin Truy Xuất Nguồn Gốc Cây Trồng Chuẩn VietGAP / ERP': {
      en: 'GlobalG.A.P. & VietGAP Crop Traceability Portal',
      zh: 'VietGAP / ERP 出口水果原产地数字溯源平台'
    },
    'In hồ sơ': { en: 'Print Dossier', zh: '打印档案' },
    'Chia sẻ': { en: 'Share', zh: '分享' },
    'Nông hộ': { en: 'Farmer Login', zh: '庄园登录' },
    'Đăng nhập nông hộ': { en: 'Farmer Login', zh: '庄园管理员登录' },
    'I. Thông Tin Chi Tiết Cây Trồng & Hộ Chiếu Số': {
      en: 'I. Detailed Tree Profile & Digital Passport',
      zh: '一、单株果树档案与数字通行证'
    },
    'Hồ sơ gốc & Hộ chiếu số': { en: 'Origin Dossier & Digital Passport', zh: '原始档案与数字护照' },
    'II. Thông Tin Mở Rộng': { en: 'II. Extended Telemetry & Financials', zh: '二、扩展信息 (卫星地图 · 成本 · 影像)' },
    'GPS · Chi phí ERP · Minh chứng thực địa': {
      en: 'GPS · ERP Financials · Field Evidence',
      zh: 'GPS 定位 · ERP 成本 · 实地影像存证'
    },
    'III. Nhật Ký Canh Tác': { en: 'III. Cultivation Logbook', zh: '三、农事操作日志' },
    'IV. Thao Tác Canh Tác Nhanh': { en: 'IV. Quick Field Actions', zh: '四、田间快捷农事登记' },
    'Xem chi tiết': { en: 'Expand Details', zh: '展开详情' },
    'Thu gọn': { en: 'Collapse', zh: '收起' },
    'Thu gọn thông tin mở rộng': { en: 'Collapse Extended Section', zh: '收起扩展信息' },
    'Thu gọn nhật ký canh tác': { en: 'Collapse Cultivation Ledger', zh: '收起农事操作日志' },
    'Thu gọn về 3 ngày gần nhất': { en: 'Collapse to Latest 3 Days', zh: '收起至最近3天记录' },
    'Trang trước': { en: 'Previous Page', zh: '上一页' },
    'Trang tiếp': { en: 'Next Page', zh: '下一页' },
    'Quyền ghi nhận thực địa': { en: 'Field Logging Enabled', zh: '实地登记权限已启用' },
    'Cổng minh bạch công khai': { en: 'Public Transparency Portal', zh: '公开透明溯源门户' },
    'Chọn quy trình chăm sóc bên dưới để hạch toán vật tư và ghi nhật ký tức thời vào hồ sơ cây:': {
      en: 'Select an operation below to record cultivation logs and supply consumption onto this tree ledger:',
      zh: '请选择下方农事作业类型，实时记入本株果树溯源台账并核算农资：'
    },
    'Đăng nhập nông hộ để ghi nhận canh tác': {
      en: 'Sign in as Farm Staff to Record Care Logs',
      zh: '登录庄园账号以录入田间农事记录'
    },
    'HỘ CHIẾU CÂY TRỒNG SỐ': { en: 'DIGITAL PLANT PASSPORT', zh: '果树数字通行证' },
    'ĐÃ XÁC THỰC': { en: 'VERIFIED', zh: '已认证校验' },
    'MÃ VÙNG TRỒNG (PUC)': { en: 'PRODUCTION UNIT CODE (PUC)', zh: '出口注册果园代码 (PUC)' },
    'CHỨNG NHẬN VIETGAP': { en: 'VIETGAP CERTIFICATE', zh: 'VIETGAP 认证证书' },
    'Mã Lô VietGAP': { en: 'VietGAP Batch Code', zh: 'VietGAP 批次编码' },
    'Giống & Cấp giống': { en: 'Cultivar & Seed Class', zh: '品种与种苗等级' },
    'Nông hộ & Liên hệ': { en: 'Grower & Contact', zh: '庄园主及联系方式' },
    'Phân lô & GIS RTK': { en: 'Plot & RTK GPS', zh: '种植分区与 RTK 定位' },
    'An toàn PHI': { en: 'PHI Safety', zh: '安全间隔期 (PHI)' },
    'An Toàn Thu Hoạch': { en: 'Safe for Harvest', zh: '可安全采收 (符合 PHI)' },
    '0 ngày cách ly PHI · Đạt chuẩn sạch': { en: '0 PHI days remaining · Residue compliant', zh: '剩余安全间隔期 0 天 · 符合出口农残标准' },
    'Thẻ chip NFC': { en: 'NFC Chip', zh: 'NFC 防伪芯片' },
    'Mã băm bảo chứng SHA-256': { en: 'SHA-256 Integrity Hash', zh: 'SHA-256 防篡改哈希存证' },
    'Chuẩn Quốc Gia VietGAP & Cấp Mã Vùng Trồng PUC Xuất Khẩu': {
      en: 'National VietGAP & Export PUC Traceability Certified',
      zh: '符合国家 VietGAP 与出口注册果园代码 (PUC) 标准'
    },
    'Giống & Độ Tuổi': { en: 'Cultivar & Age', zh: '品种与树龄' },
    'Tọa Độ Vệ Tinh RTK': { en: 'RTK Satellite Coordinates', zh: 'RTK 卫星坐标' },
    'Tiêu Chuẩn Canh Tác': { en: 'Cultivation Standard', zh: '种植认证标准' },
    'An Toàn Cách Ly PHI': { en: 'PHI Quarantine Status', zh: '农药安全间隔期状态' },
    'Tổng Đầu Tư Cây': { en: 'Tree Investment Ledger', zh: '单株累计投入成本' },
    'Tổng Nhật Ký Canh Tác': { en: 'Total Cultivation Logs', zh: '累计农事操作总条数' },
    'Hoạt Động Gần Nhất': { en: 'Latest Field Activity', zh: '最近一次农事活动' },
    'Vị Trí Bản Đồ GIS': { en: 'GIS Satellite Location', zh: 'GIS 卫星地图位置' },
    'Hạch Toán Đầu Tư Cây': { en: 'Tree Cost Accounting', zh: '单株投入成本核算' },
    'Minh Chứng Thực Địa': { en: 'Field Media Evidence', zh: '实地影像与图片存证' },
    'Vị Trí GPS Của Cây Trên Bản Đồ & Ranh Giới Lô Canh Tác': {
      en: 'Single-Tree GPS Location & Plot Boundary Map',
      zh: '单株果树 GPS 卫星位置与种植区边界地图'
    },
    'Chi Phí Đầu Tư (Vật Tư & Hạch Toán Chi Phí Canh Tác)': {
      en: 'Cultivation Cost Accounting & Farm Input Ledger',
      zh: '投入成本与农资消耗台账核算'
    },
    'Chi Phí Đã Hạch Toán': { en: 'Accounted Care Costs', zh: '已核算农资成本' },
    'Đợt Tiêu Hao Vật Tư': { en: 'Supply Usage Batches', zh: '农资投入次数' },
    'Kho Vật Tư Trang Trại': { en: 'Farm Supply Catalog', zh: '庄园农资目录数' },
    '1. Lịch Sử Tiêu Hao Vật Tư Trực Tiếp Trên Cây': { en: '1. Single-Tree Input Consumption History', zh: '1. 单株果树直接农资消耗记录' },
    '2. Danh Mục Vật Tư Tồn Kho Trang Trại (ERP Inventory)': { en: '2. Farm Supply Inventory Catalog (ERP)', zh: '2. 庄园农资库存清单 (ERP)' },
    'Minh Chứng Hình Ảnh Thực Địa (Ảnh Sinh Trưởng, Bệnh Cây & Video)': {
      en: 'Field Media Archive (Growth Photos, Disease & Videos)',
      zh: '实地影像存证库 (生长实拍、病虫害与视频)'
    },
    'VỀ ỨNG DỤNG CHÍNH': { en: 'MAIN APPLICATION PORTAL', zh: '进入主管理系统' },
    'WEBSITE DOANH NGHIỆP': { en: 'CORPORATE WEBSITE', zh: '企业官方网站' },
    'HỆ THỐNG QUẢN TRỊ': { en: 'MANAGEMENT ERP', zh: '企业管理后台' },
    'CỔNG THÔNG TIN DOANH NGHIỆP': { en: 'ENTERPRISE PORTAL', zh: '企业信息门户' },
    'Truy cập hệ thống quản trị và sổ nông số hóa': { en: 'Access ERP governance & digital farm book', zh: '访问企业管理后台与数字化农事台账' },
    'Truy cập cổng thông tin doanh nghiệp TBSG Agtech': { en: 'Visit TBSG AgTech official corporate portal', zh: '访问新宝西贡农业科技官方网站' },
    'Truy cập hệ thống': { en: 'Open System', zh: '进入系统' },
    'Xem website công ty': { en: 'Visit Website', zh: '访问企业网站' },
    'CÔNG TY TNHH CÔNG NGHỆ NÔNG NGHIỆP TÂN BẢO SÀI GÒN – TBSG AGTECH': {
      en: 'TAN BAO SAI GON AGRITECH CO., LTD – TBSG AGTECH',
      zh: '新宝西贡农业科技有限公司 – TBSG AGTECH'
    },

    // ── Report Portal (/report.html) ──
    'Sổ Nông Tân Bảo Agtech — Báo cáo lịch trình canh tác': {
      en: 'Tan Bao AgTech Farm Book — Cultivation Schedule Report',
      zh: '新宝农业科技数字农事本 — 农事栽培历程报告'
    },
    'Báo cáo lịch trình canh tác': { en: 'Cultivation Traceability Report', zh: '农事种植追溯报告' },
    'Sao chép liên kết': { en: 'Copy Link', zh: '复制链接' },
    'Xuất CSV (Excel)': { en: 'Export CSV (Excel)', zh: '导出 CSV (Excel)' },
    'In báo cáo / Tải PDF': { en: 'Print / Export PDF', zh: '打印报告 / 导出 PDF' },
    'Thông tin cây trồng': { en: 'Tree Identification Summary', zh: '果树档案基本信息' },
    'Mã số cây': { en: 'Tree Code', zh: '果树编号' },
    'Loại cây': { en: 'Crop Species', zh: '作物品类' },
    'Tuổi cây': { en: 'Tree Age', zh: '果树树龄' },
    'Vị trí / Lô': { en: 'Location / Plot', zh: '种植分区 / 位置' },
    'Tọa độ GPS': { en: 'GPS Coordinates', zh: 'GPS 卫星坐标' },
    'Bản đồ vị trí & Ranh giới trang trại': { en: 'Tree Location & Farm Boundary Map', zh: '果树坐标与庄园边界地图' },
    'Nhật ký hoạt động canh tác': { en: 'Cultivation Activity Ledger', zh: '农事作业操作明细' },
    'Báo cáo được tạo tự động bởi hệ sinh thái số Tanbao AgTech': {
      en: 'Generated automatically by Tanbao AgTech Digital Agricultural Ecosystem',
      zh: '由新宝农业科技 (Tanbao AgTech) 数字化农业生态系统自动生成'
    },

    // ── User & Admin Portal Key Views & Tables ──
    'Dashboard': { en: 'Dashboard', zh: '管理仪表盘' },
    'Tổng quan': { en: 'Overview', zh: '系统总览' },
    'Tổng quan & Vận hành': { en: 'Overview & Operations', zh: '总览与日常运维' },
    'Quản trị Nông nghiệp & CSDL': { en: 'Agri Governance & Database', zh: '农业管控与数据库' },
    'Cơ sở dữ liệu': { en: 'Database Explorer', zh: '农业综合数据库' },
    'Huấn luyện trí tuệ nhân tạo': { en: 'AI Studio (Bé Mầm)', zh: 'AI 智能农技训练中心' },
    'Hệ thống & Nhân sự': { en: 'System & Access Control', zh: '系统与人员权限' },
    'Người dùng': { en: 'Users & RBAC', zh: '用户与权限管理' },
    'Dữ liệu canh tác': { en: 'Cultivation Ledger', zh: '田间农事数据库' },
    'Kho Thẻ NFC': { en: 'NFC Tag Inventory', zh: 'NFC 芯片库存' },
    'Thiết bị IoT & Cảm biến': { en: 'IoT Sensors & Devices', zh: '物联网传感器设备' },
    'Cấu hình & Quy trình Loại cây': { en: 'Crop Schemas & SOP', zh: '作物品种结构与 SOP 规范' },
    'Thư viện media': { en: 'Media Library', zh: '现场媒体影像库' },
    'Lịch sử biến động': { en: 'Audit Trail', zh: '数据变更审计日志' },
    'Phiên bản Ứng dụng': { en: 'App Versioning (SSOT)', zh: '应用版本统一发布' },
    'Tân Bảo AgTech Admin': { en: 'Tan Bao AgTech Admin', zh: '新宝农业科技管理中心' },
    'CSDL Nông Nghiệp & Danh Mục Master Data ERP': {
      en: 'Agricultural Master Database & ERP Governance',
      zh: '农业核心数据库与 ERP 主数据治理中心'
    },
    'Cơ Sở Dữ Liệu Nông Nghiệp & Vận Hành': { en: 'Agricultural Operations Database', zh: '农业生产与运营数据库' },
    'Danh sách Trang Trại Nông Hộ': { en: 'Registered Orchards & GIS', zh: '名下果园与 GIS 列表' },
    'Danh Sách Trang Trại Nông Hộ': { en: 'Registered Orchards & GIS', zh: '名下果园与 GIS 列表' },
    'Khởi tạo Trang trại mới (GPS)': { en: 'Initialize New Farm (GPS)', zh: '新建庄园与 GPS 测绘' },
    'Thêm Cây Mới': { en: 'Add New Tree', zh: '新增登记果树' },
    'Chỉnh sửa Trang trại': { en: 'Edit Farm Profile', zh: '编辑庄园资料' },
    'Bản đồ & Cây trồng': { en: 'GIS Map & Trees', zh: 'GIS 地图与果树档案' },
    'Thiết bị IoT & Dự báo thời tiết': { en: 'IoT Telemetry & Weather Forecast', zh: 'IoT 物联网与气象预测' },
    'Thẻ NFC Trang trại': { en: 'Farm NFC Tags', zh: '庄园 NFC 芯片' },
    'Xem danh sách thẻ': { en: 'View Tag List', zh: '查看芯片清单' },
    'Đi Vườn Gán Thẻ & GPS': { en: 'Field NFC Tagging & GPS', zh: '田间巡检绑卡与 GPS' },
    'Sổ Ghi Chép Canh Tác Điện Tử': { en: 'Digital Cultivation Ledger', zh: '电子农事操作台账' },
    'Lịch Sử Hoạt Động Canh Tác': { en: 'Cultivation Activity History', zh: '农事操作历史全记录' },
    'Xuất Excel': { en: 'Export Excel', zh: '导出 Excel' },
    'Chọn nhiều': { en: 'Multi-Select', zh: '批量选择' },
    'Xóa chọn lọc': { en: 'Selective Delete', zh: '条件筛选删除' },
    'Thời gian': { en: 'Time', zh: '时间' },
    'Cây trồng': { en: 'Tree', zh: '果树' },
    'Hoạt động': { en: 'Activity', zh: '农事操作' },
    'Chi tiết / Ghi chú': { en: 'Details / Note', zh: '作业明细 / 备注' },
    'Thao tác': { en: 'Actions', zh: '操作' },
    'Mã Cây & Thẻ NFC': { en: 'Tree ID & NFC', zh: '果树编号与 NFC' },
    'Loại & Giống Cây': { en: 'Crop & Variety', zh: '作物品种' },
    'Tuổi Cây': { en: 'Age', zh: '树龄' },
    'Tọa Độ & Vị Trí': { en: 'GPS & Plot', zh: 'GPS 与位置' },
    'Cổng Công Khai': { en: 'Public QR', zh: '公开溯源页' },
    'Thao Tác Quản Trị': { en: 'Admin Actions', zh: '管理操作' },
    'Giai đoạn:': { en: 'Stage:', zh: '挂果阶段：' },
    'Đếm:': { en: 'Count:', zh: '实盘：' },
    'Không gian GIS': { en: 'GIS Workspace', zh: 'GIS 空间工作台' }
  };

  // Core agronomic glossary for fallback segment-by-segment cleanup when compound phrases are encountered
  const SEGMENT_GLOSSARY = {
    en: [
      ['Kiểm toán quả', 'Fruit Audit'],
      ['Thu hoạch', 'Harvest'],
      ['Tưới nước', 'Irrigation'],
      ['Bón phân', 'Fertilization'],
      ['Phun thuốc', 'Pesticide Spray'],
      ['Nhân công', 'Labor'],
      ['Bệnh cây', 'Plant Disease'],
      ['Đậu quả', 'Fruit Set'],
      ['Quả non', 'Young Fruit'],
      ['Quả chín', 'Ripe Fruit'],
      ['Trang trại', 'Farm'],
      ['Vườn', 'Orchard'],
      ['Giống', 'Variety'],
      ['Sầu riêng', 'Durian'],
      ['Thanh long', 'Dragon Fruit'],
      ['Bưởi da xanh', 'Green Pomelo'],
      ['Cà phê', 'Coffee'],
      ['Xoài', 'Mango'],
      ['Ghi chú', 'Note'],
      ['Nhân sự', 'Operator'],
      ['Người thực hiện', 'Performed By'],
      ['Thiết bị', 'Equipment'],
      ['Vật tư', 'Supply'],
      ['Tiêu hao', 'Cost'],
      ['Phương pháp', 'Method'],
      ['Lượng nước', 'Water Volume'],
      ['Liều lượng', 'Dosage'],
      ['Hoạt chất', 'Active Ingredient'],
      ['Cách ly PHI', 'PHI Period'],
      ['Lý do', 'Reason'],
      ['Giờ kiểm đếm', 'Audit Time'],
      ['Rụng/Tỉa bỏ', 'Dropped/Culled'],
      ['Sản lượng', 'Yield'],
      ['Phẩm cấp', 'Grade']
    ],
    zh: [
      ['Kiểm toán quả', '结果审计'],
      ['Thu hoạch', '采收归集'],
      ['Tưới nước', '灌溉浇水'],
      ['Bón phân', '施肥作业'],
      ['Phun thuốc', '植保喷药'],
      ['Nhân công', '人工成本'],
      ['Bệnh cây', '病虫害'],
      ['Đậu quả', '坐果期'],
      ['Quả non', '幼果期'],
      ['Quả chín', '成熟期'],
      ['Trang trại', '庄园'],
      ['Vườn', '果园'],
      ['Giống', '品种'],
      ['Sầu riêng', '越南出口榴莲'],
      ['Thanh long', '红心火龙果'],
      ['Bưởi da xanh', '青皮蜜柚'],
      ['Cà phê', '罗布斯塔咖啡'],
      ['Xoài', '芒果'],
      ['Ghi chú', '田间备注'],
      ['Nhân sự', '操作人员'],
      ['Người thực hiện', '执行人员'],
      ['Thiết bị', '作业设备'],
      ['Vật tư', '农资'],
      ['Tiêu hao', '消耗费用'],
      ['Phương pháp', '作业方式'],
      ['Lượng nước', '灌水量'],
      ['Liều lượng', '施用剂量'],
      ['Hoạt chất', '有效成分'],
      ['Cách ly PHI', '安全间隔期 PHI'],
      ['Lý do', '原因'],
      ['Giờ kiểm đếm', '盘点时间'],
      ['Rụng/Tỉa bỏ', '落果/疏果'],
      ['Sản lượng', '采收产量'],
      ['Phẩm cấp', '等级']
    ]
  };

  const LOWER_PHRASE_MAP = {};
  Object.keys(EXACT_PHRASE_MAP).forEach(k => {
    LOWER_PHRASE_MAP[k.toLowerCase()] = EXACT_PHRASE_MAP[k];
  });

  // Helper: map Vietnamese fruit stage & irrigation methods cleanly
  const STAGE_MAP = {
    en: { 'Đậu quả': 'Fruit Set', 'Quả non': 'Young Fruit', 'Quả chín': 'Ripe Fruit', 'Đậu trái': 'Fruit Set' },
    zh: { 'Đậu quả': '坐果期', 'Quả non': '幼果期', 'Quả chín': '成熟期', 'Đậu trái': '坐果期' }
  };

  function mapStage(stage, lang) {
    return (STAGE_MAP[lang] && STAGE_MAP[lang][stage]) ? STAGE_MAP[lang][stage] : stage;
  }

  // Dynamic Pattern Replacers for structured sentences, counts, ages, logs & Fruit Audit comparisons
  const DYNAMIC_PATTERNS = {
    en: [
      [/^Hồ Sơ Cây Trồng\s*#\s*(.+)$/i, 'Tree Dossier #$1'],
      [/^2\.\s*Lịch Sử Canh Tác\s*\((\d+)\)$/i, '2. Cultivation History ($1)'],
      [/^Sầu riêng\s*—\s*Cây\s*#(.+)$/i, 'Durian — Tree #$1'],
      [/^(.+?)\s*—\s*Cây\s*#(.+)$/i, '$1 — Tree #$2'],
      [/^Cây\s*#(.+?)\s*\((.+)\)$/i, 'Tree #$1 ($2)'],
      [/^(\d+)\.\s*Thông Số Nông Học\s*&\s*GPS$/i, '$1. Agronomic Specs & GPS'],
      [/^Hiển thị\s*(\d+)\s*\/\s*(\d+)\s*nhật ký canh tác$/i, 'Showing $1 / $2 cultivation logs'],
      [/^Hiển thị\s*(\d+)\s*\/\s*(\d+)\s*nhật ký\s*\((\d+)\s*ngày canh tác\)$/i, 'Showing $1 / $2 logs ($3 cultivation days)'],
      [/^Xem tất cả nhật ký\s*\(Tổng\s*(\d+)\s*ngày canh tác\)$/i, 'View All Logs ($1 Cultivation Days Total)'],
      [/^Chuẩn VietGAP\s*·\s*Tổng\s*(\d+)\s*ngày canh tác$/i, 'VietGAP Certified · $1 cultivation days'],
      [/^(\d+)\s*sự kiện\s*\((\d+)\s*ngày canh tác VietGAP\)$/i, '$1 events ($2 VietGAP cultivation days)'],
      [/^Trang\s*(\d+)\s*\/\s*(\d+)\s*\((\d+)\s*ngày\)$/i, 'Page $1 / $2 ($3 days)'],
      [/^Khởi tạo mốc\s*(Đậu quả|Quả non|Quả chín)\s*\(([^)]+)\):\s*(\d+)\s*quả$/i, (_, st, dt, c) => `Initialized ${mapStage(st, 'en')} baseline (${dt}): ${c} fruits`],
      [/^(Đậu quả|Quả non|Quả chín)\s*\(([^)]+)\):\s*(\d+)\s*quả\s*→\s*(Đậu quả|Quả non|Quả chín)\s*\(([^)]+)\):\s*(\d+)\s*quả\s*\((.+)\)$/i,
        (_, s1, d1, c1, s2, d2, c2, delta) => `${mapStage(s1, 'en')} (${d1}): ${c1} fruits → ${mapStage(s2, 'en')} (${d2}): ${c2} fruits (${translateDynamicTerm(delta, 'en')})`],
      [/^So với Kiểm toán\s*(Đậu quả|Quả non|Quả chín)\s*\(([^)]+?):\s*(\d+)\s*quả\):\s*Thu hoạch\s*(\d+)\s*quả\s*\((.+)\)$/i,
        (_, st, dt, c1, c2, delta) => `Vs. ${mapStage(st, 'en')} Audit (${dt}: ${c1} fruits): Harvested ${c2} fruits (${translateDynamicTerm(delta, 'en')})`],
      [/^Suy giảm\s*(\d+)\s*quả\s*\(([^)]+)\)$/i, 'Decreased by $1 fruits ($2)'],
      [/^Tăng\s*(\d+)\s*quả\s*\(([^)]+)\)$/i, 'Increased by $1 fruits ($2)'],
      [/^Giữ nguyên số quả\s*\(([^)]+)\)$/i, 'Unchanged ($1)'],
      [/^Khớp 100% số quả$/i, '100% fruit count match'],
      [/^\[?(Đậu quả|Quả non|Quả chín)\]?\s*(\d+)\s*quả(?:\s*·\s*(.+))?$/i,
        (_, st, c, tail) => `[${mapStage(st, 'en')}] ${c} fruits${tail ? ' · ' + translateDynamicTerm(tail, 'en') : ''}`],
      [/^Tưới nước bằng\s+(.+?)\s*\(([\d.,]+)\s*(Lít|lít|L|m³)\)$/i,
        (_, method, qty, u) => `Irrigated via ${translateDynamicTerm(method, 'en')} (${qty} ${/m³/i.test(u) ? 'm³' : 'L'})`],
      [/^Lô\s+([A-Za-z0-9-]+)$/i, 'Plot $1'],
      [/^Hàng số\s*(\d+)$/i, 'Row $1'],
      [/^Trang trại:\s*(.+)$/i, 'Farm: $1'],
      [/^Lô:\s*(.+)$/i, (_, p) => `Plot: ${translateDynamicTerm(p, 'en')}`],
      [/^Giống:\s*Sầu riêng\s*\(durian\)\s*\((.+)\)$/i, 'Variety: Durian ($1)'],
      [/^Giống:\s*(.+)$/i, (_, v) => `Variety: ${translateDynamicTerm(v, 'en')}`],
      [/^(\d+(?:\.\d+)?)\s*năm$/i, '$1 years'],
      [/^(\d+(?:\.\d+)?)\s*năm tuổi$/i, '$1 yrs old'],
      [/^(\d+)\s*tháng tuổi$/i, '$1 mos old'],
      [/^(\d+(?:[.,]\d+)?)\s*kg\/năm$/i, '$1 kg/year'],
      [/^(\d+)\s*đợt thu hoạch$/i, '$1 harvests'],
      [/^(\d+)\s*ảnh(?:\/video)?$/i, '$1 media'],
      [/^(\d+)\s*lần(?:\s*ghi nhận)?$/i, '$1 records'],
      [/^(\d+)\s*loại$/i, '$1 types'],
      [/^(\d+)\s*ngày$/i, '$1 days'],
      [/^(\d+)\s*người$/i, '$1 workers'],
      [/^(\d+)\s*(?:quả|trái)$/i, '$1 fruits'],
      [/^([\d.,]+)\s*(?:Lít|lít)$/i, '$1 L'],
      [/^([\d.,]+)\s*lần\s*dùng$/i, '$1 usages'],
      [/^Tổng\s*(\d+)\s*loại vật tư khai báo$/i, 'Total $1 registered supplies'],
      [/^Tổng\s*(\d+)\s*tư liệu thực địa$/i, '$1 field media items total'],
      [/^Tất cả\s*\((\d+)\)$/i, 'All ($1)'],
      [/^Ảnh sinh trưởng\s*\((\d+)\)$/i, 'Growth Photos ($1)'],
      [/^Ảnh bệnh cây\s*\((\d+)\)$/i, 'Disease Photos ($1)'],
      [/^Video thực địa\s*\((\d+)\)$/i, 'Field Videos ($1)'],
      [/^Độ chính xác:\s*(.+)$/i, 'Accuracy: $1'],
      [/^Tọa độ RTK:\s*(.+)$/i, 'RTK Coords: $1'],
      [/^Cập nhật:\s*(.+)$/i, 'Updated: $1'],
      [/^Đã chiết xuất sử dụng:\s*(\d+)\s*đợt canh tác$/i, 'Extracted usage: $1 cultivation batches'],
      [/^(\d+)\s*mặt hàng lưu kho$/i, '$1 items in stock'],
      [/^Hiển thị\s*(\d+)\s*mặt hàng$/i, 'Showing $1 items'],
      [/^Sản lượng:\s*([\d.,]+)\s*kg\s*\(([\d.,]+)\s*quả\)$/i, 'Harvest Yield: $1 kg ($2 fruits)'],
      [/^\(([\d.,]+)\s*quả\)$/i, '($1 fruits)'],
      [/^Phân bổ:\s*Tất cả trang trại\s*·\s*Năm\s*(\d+)$/i, 'Scope: All Farms · Year $1'],
      [/^Phân bổ:\s*Tất cả trang trại\s*·\s*Tất cả các năm$/i, 'Scope: All Farms · All Years'],
      [/^Phân bổ:\s*(.+?)\s*·\s*Năm\s*(\d+)$/i, 'Scope: $1 · Year $2'],
      [/^Tổng chi phí:\s*(.+)$/i, 'Total Cost: $1'],
      [/^Tổng đầu tư:\s*(.+)$/i, 'Total Investment: $1'],
      [/^BIỂU ĐỒ ĐƯỜNG CHI PHÍ TIÊU HAO\s*\((\d+)\s*KỲ CHỌN\)$/i, 'EXPENDITURE TRAJECTORY CHART ($1 PERIODS)'],
      [/^Bảng tổng hợp chi phí vật tư\s*\((.+)\)$/i, 'Detailed Supply Cost Breakdown ($1)'],
      [/^Tổng số:\s*(\d+)\s*cây$/i, 'Total: $1 trees'],
      [/^Minh chứng hình ảnh & video thực địa\s*\((\d+)\):$/i, 'Field Photo & Video Evidence ($1):'],
      [/Sầu riêng\s*\(durian\)\s*\(([^)]+)\)/gi, 'Durian ($1)'],
      [/Sầu riêng\s*\(durian\)/gi, 'Durian'],
      [/Sầu riêng Ri6/gi, 'Ri6 Premium Durian'],
      [/Sầu riêng Monthong/gi, 'Monthong Export Durian'],
      [/Sầu riêng/gi, 'Durian'],
      [/Thanh long ruột đỏ/gi, 'Red-Flesh Dragon Fruit'],
      [/Thanh long ruột trắng/gi, 'White-Flesh Dragon Fruit'],
      [/Thanh long/gi, 'Dragon Fruit'],
      [/An toàn thu hoạch/gi, 'Safe for Harvest (PHI Verified)']
    ],
    zh: [
      [/^Hồ Sơ Cây Trồng\s*#\s*(.+)$/i, '果树数字档案 #$1'],
      [/^2\.\s*Lịch Sử Canh Tác\s*\((\d+)\)$/i, '2. 农事操作记录 ($1)'],
      [/^Sầu riêng\s*—\s*Cây\s*#(.+)$/i, '越南榴莲 — 第 $1 号果树'],
      [/^(.+?)\s*—\s*Cây\s*#(.+)$/i, '$1 — 第 $2 号果树'],
      [/^Cây\s*#(.+?)\s*\((.+)\)$/i, '果树 #$1 ($2)'],
      [/^(\d+)\.\s*Thông Số Nông Học\s*&\s*GPS$/i, '$1. 农艺参数与 GPS 定位'],
      [/^Hiển thị\s*(\d+)\s*\/\s*(\d+)\s*nhật ký canh tác$/i, '显示 $1 / $2 条农事记录'],
      [/^Hiển thị\s*(\d+)\s*\/\s*(\d+)\s*nhật ký\s*\((\d+)\s*ngày canh tác\)$/i, '显示 $1 / $2 条农事记录 (共 $3 个农事日)'],
      [/^Xem tất cả nhật ký\s*\(Tổng\s*(\d+)\s*ngày canh tác\)$/i, '查看全部农事日志 (共计 $1 个农事日)'],
      [/^Chuẩn VietGAP\s*·\s*Tổng\s*(\d+)\s*ngày canh tác$/i, 'VietGAP 标准 · 共计 $1 个农事日'],
      [/^(\d+)\s*sự kiện\s*\((\d+)\s*ngày canh tác VietGAP\)$/i, '$1 次农事记录 ($2 个 VietGAP 作业日)'],
      [/^Trang\s*(\d+)\s*\/\s*(\d+)\s*\((\d+)\s*ngày\)$/i, '第 $1 / $2 页 ($3 天)'],
      [/^Khởi tạo mốc\s*(Đậu quả|Quả non|Quả chín)\s*\(([^)]+)\):\s*(\d+)\s*quả$/i, (_, st, dt, c) => `初始化${mapStage(st, 'zh')}基准 (${dt}): ${c} 颗果`],
      [/^(Đậu quả|Quả non|Quả chín)\s*\(([^)]+)\):\s*(\d+)\s*quả\s*→\s*(Đậu quả|Quả non|Quả chín)\s*\(([^)]+)\):\s*(\d+)\s*quả\s*\((.+)\)$/i,
        (_, s1, d1, c1, s2, d2, c2, delta) => `${mapStage(s1, 'zh')} (${d1}): ${c1} 颗果 → ${mapStage(s2, 'zh')} (${d2}): ${c2} 颗果 (${translateDynamicTerm(delta, 'zh')})`],
      [/^So với Kiểm toán\s*(Đậu quả|Quả non|Quả chín)\s*\(([^)]+?):\s*(\d+)\s*quả\):\s*Thu hoạch\s*(\d+)\s*quả\s*\((.+)\)$/i,
        (_, st, dt, c1, c2, delta) => `对比${mapStage(st, 'zh')}审计 (${dt}: ${c1} 颗果): 实收 ${c2} 颗果 (${translateDynamicTerm(delta, 'zh')})`],
      [/^Suy giảm\s*(\d+)\s*quả\s*\(([^)]+)\)$/i, '减少 $1 颗果 ($2)'],
      [/^Tăng\s*(\d+)\s*quả\s*\(([^)]+)\)$/i, '增加 $1 颗果 ($2)'],
      [/^Giữ nguyên số quả\s*\(([^)]+)\)$/i, '数量持平 ($1)'],
      [/^Khớp 100% số quả$/i, '100% 数量吻合'],
      [/^\[?(Đậu quả|Quả non|Quả chín)\]?\s*(\d+)\s*quả(?:\s*·\s*(.+))?$/i,
        (_, st, c, tail) => `[${mapStage(st, 'zh')}] ${c} 颗果${tail ? ' · ' + translateDynamicTerm(tail, 'zh') : ''}`],
      [/^Tưới nước bằng\s+(.+?)\s*\(([\d.,]+)\s*(Lít|lít|L|m³)\)$/i,
        (_, method, qty, u) => `通过${translateDynamicTerm(method, 'zh')}浇水 (${qty} ${/m³/i.test(u) ? '立方米' : '升'})`],
      [/^Lô\s+([A-Za-z0-9-]+)$/i, '$1区'],
      [/^Hàng số\s*(\d+)$/i, '第 $1 行'],
      [/^Trang trại:\s*(.+)$/i, '庄园：$1'],
      [/^Lô:\s*(.+)$/i, (_, p) => `种植区：${translateDynamicTerm(p, 'zh')}`],
      [/^Giống:\s*Sầu riêng\s*\(durian\)\s*\((.+)\)$/i, '品种：越南出口榴莲 ($1)'],
      [/^Giống:\s*(.+)$/i, (_, v) => `品种：${translateDynamicTerm(v, 'zh')}`],
      [/^(\d+(?:\.\d+)?)\s*năm$/i, '$1 年'],
      [/^(\d+(?:\.\d+)?)\s*năm tuổi$/i, '$1 年树龄'],
      [/^(\d+)\s*tháng tuổi$/i, '$1 个月树龄'],
      [/^(\d+(?:[.,]\d+)?)\s*kg\/năm$/i, '$1 公斤/年'],
      [/^(\d+)\s*đợt thu hoạch$/i, '$1 次采收'],
      [/^(\d+)\s*ảnh(?:\/video)?$/i, '$1 个影像文件'],
      [/^(\d+)\s*lần(?:\s*ghi nhận)?$/i, '$1 次记录'],
      [/^(\d+)\s*loại$/i, '$1 种'],
      [/^(\d+)\s*ngày$/i, '$1 天'],
      [/^(\d+)\s*người$/i, '$1 人'],
      [/^(\d+)\s*(?:quả|trái)$/i, '$1 颗果'],
      [/^([\d.,]+)\s*(?:Lít|lít)$/i, '$1 升'],
      [/^([\d.,]+)\s*lần\s*dùng$/i, '$1 次施用'],
      [/^Tổng\s*(\d+)\s*loại vật tư khai báo$/i, '共登记 $1 种农资'],
      [/^Tổng\s*(\d+)\s*tư liệu thực địa$/i, '共 $1 份实地影像资料'],
      [/^Tất cả\s*\((\d+)\)$/i, '全部 ($1)'],
      [/^Ảnh sinh trưởng\s*\((\d+)\)$/i, '生长实拍 ($1)'],
      [/^Ảnh bệnh cây\s*\((\d+)\)$/i, '病害影像 ($1)'],
      [/^Video thực địa\s*\((\d+)\)$/i, '实地视频 ($1)'],
      [/^Độ chính xác:\s*(.+)$/i, '定位精度：$1'],
      [/^Tọa độ RTK:\s*(.+)$/i, 'RTK 坐标：$1'],
      [/^Cập nhật:\s*(.+)$/i, '更新时间：$1'],
      [/^Đã chiết xuất sử dụng:\s*(\d+)\s*đợt canh tác$/i, '已出库使用：$1 次农事操作'],
      [/^(\d+)\s*mặt hàng lưu kho$/i, '$1 项库存农资'],
      [/^Hiển thị\s*(\d+)\s*mặt hàng$/i, '显示 $1 项农资'],
      [/^Sản lượng:\s*([\d.,]+)\s*kg\s*\(([\d.,]+)\s*quả\)$/i, '采收产量：$1 公斤 ($2 颗果)'],
      [/^\(([\d.,]+)\s*quả\)$/i, '($1 颗果)'],
      [/^Phân bổ:\s*Tất cả trang trại\s*·\s*Năm\s*(\d+)$/i, '核算范围：全部庄园 · $1年'],
      [/^Phân bổ:\s*Tất cả trang trại\s*·\s*Tất cả các năm$/i, '核算范围：全部庄园 · 全部年份'],
      [/^Phân bổ:\s*(.+?)\s*·\s*Năm\s*(\d+)$/i, '核算范围：$1 · $2年'],
      [/^Tổng chi phí:\s*(.+)$/i, '总成本：$1'],
      [/^Tổng đầu tư:\s*(.+)$/i, '累计投入总成本：$1'],
      [/^BIỂU ĐỒ ĐƯỜNG CHI PHÍ TIÊU HAO\s*\((\d+)\s*KỲ CHỌN\)$/i, '农资消耗成本趋势图 ($1 个周期)'],
      [/^Bảng tổng hợp chi phí vật tư\s*\((.+)\)$/i, '农资消耗成本汇总表 ($1)'],
      [/^Tổng số:\s*(\d+)\s*cây$/i, '总计：$1 棵果树'],
      [/^Minh chứng hình ảnh & video thực địa\s*\((\d+)\):$/i, '实地照片与视频存证 ($1):'],
      [/Sầu riêng\s*\(durian\)\s*\(([^)]+)\)/gi, '越南出口榴莲 ($1)'],
      [/Sầu riêng\s*\(durian\)/gi, '越南出口榴莲'],
      [/Sầu riêng Ri6/gi, '越南干尧榴莲 (Ri6 出口特级)'],
      [/Sầu riêng Monthong/gi, '越南金枕头榴莲 (Monthong)'],
      [/Sầu riêng/gi, '越南出口榴莲 (Durian)'],
      [/Thanh long ruột đỏ/gi, '越南红心火龙果'],
      [/Thanh long ruột trắng/gi, '越南白心火龙果'],
      [/Thanh long/gi, '越南出口火龙果'],
      [/An toàn thu hoạch/gi, '符合采收安全标准 (已过安全间隔期 PHI)']
    ]
  };

  function hasVietnameseDiacritics(str) {
    return /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(str);
  }

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
    return String(str).replace(/([+-]?\s*\d[\d.]*)\s*(?:VNĐ|VND|₫|\bđ)\b/g, function (match, numPart) {
      const cleanDigits = numPart.replace(/\s+/g, '').replace(/\./g, '');
      const parsed = parseFloat(cleanDigits);
      if (isNaN(parsed)) return match;
      const prefixPlus = numPart.trim().startsWith('+') ? '+' : '';
      return prefixPlus + formatCurrency(parsed, currentCurrency);
    });
  }

  function _lookupSingleChunk(trimmed, lang) {
    if (!trimmed) return trimmed;
    const lowerKey = trimmed.toLowerCase();
    if (EXACT_PHRASE_MAP[trimmed] && EXACT_PHRASE_MAP[trimmed][lang]) {
      return EXACT_PHRASE_MAP[trimmed][lang];
    }
    if (LOWER_PHRASE_MAP[lowerKey] && LOWER_PHRASE_MAP[lowerKey][lang]) {
      return LOWER_PHRASE_MAP[lowerKey][lang];
    }

    // Punctuation-tolerant core lookup (handles trailing ':' or leading '· ' or '[...]')
    const bulletColon = trimmed.match(/^([·•]\s*)?(.+?)(\s*:)?$/);
    if (bulletColon) {
      const lead = bulletColon[1] || '';
      const core = bulletColon[2] || '';
      const colon = bulletColon[3] || '';
      const cLower = core.toLowerCase();
      const hit = EXACT_PHRASE_MAP[core] || LOWER_PHRASE_MAP[cLower];
      if (hit && hit[lang]) {
        const mappedColon = colon ? (lang === 'zh' ? '：' : ':') : '';
        return `${lead}${hit[lang]}${mappedColon}`;
      }
    }

    const bracketMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (bracketMatch) {
      const inner = bracketMatch[1].trim();
      const innerMapped = _lookupSingleChunk(inner, lang);
      if (innerMapped !== inner) return `[${innerMapped}]`;
    }

    // Regex pattern rules
    let candidate = trimmed;
    const rules = DYNAMIC_PATTERNS[lang] || [];
    for (let i = 0; i < rules.length; i++) {
      candidate = candidate.replace(rules[i][0], rules[i][1]);
    }
    return candidate;
  }

  function translateDynamicTerm(rawText, langOverride) {
    const lang = langOverride || currentLang;
    if (!rawText) return rawText;
    const rawStr = String(rawText);
    const trimmed = rawStr.trim();
    if (!trimmed) return rawStr;

    let translated = trimmed;

    if (lang !== 'vi') {
      // 1. Direct / punctuation-tolerant / regex match on full trimmed string
      translated = _lookupSingleChunk(trimmed, lang);

      // 2. Compound segment decomposition for ' · ' / ' • ' / ' | ' separated lines
      if (translated === trimmed || hasVietnameseDiacritics(translated)) {
        const parts = translated.split(/(\s*(?:·|•|\|)\s*)/);
        if (parts.length > 1) {
          translated = parts.map((seg, idx) => {
            if (idx % 2 === 1) return seg; // separator
            return _lookupSingleChunk(seg.trim(), lang);
          }).join('');
        }
      }

      // 3. Final safe glossary pass if Vietnamese terms remain embedded in dynamic strings
      if (hasVietnameseDiacritics(translated)) {
        const glossary = SEGMENT_GLOSSARY[lang] || [];
        for (let i = 0; i < glossary.length; i++) {
          const [viTerm, targetTerm] = glossary[i];
          if (translated.includes(viTerm)) {
            translated = translated.split(viTerm).join(targetTerm);
          }
        }
      }
    }

    // 4. Inline currency conversion when currency !== VND
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
          if (parent.closest && (parent.closest('[data-lang-btn]') || parent.closest('[data-currency-btn]') || parent.closest('.notranslate'))) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.hasAttribute && parent.hasAttribute('data-i18n')) {
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

      if (textNode._origVi === undefined || currentVal !== textNode._lastApplied) {
        textNode._origVi = currentVal;
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

    // Translate <option> elements (display text only, preserving option.value for filters)
    document.querySelectorAll('select option').forEach(opt => {
      if (opt._origViText === undefined || opt.textContent !== opt._lastAppliedText) {
        opt._origViText = opt.textContent;
      }
      const nextOptText = currentLang === 'vi'
        ? opt._origViText
        : translateDynamicTerm(opt._origViText, currentLang);
      if (opt.textContent !== nextOptText) {
        opt.textContent = nextOptText;
      }
      opt._lastAppliedText = nextOptText;
    });

    // Translate placeholders across input & textarea
    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(inp => {
      const curPh = inp.getAttribute('placeholder') || '';
      if (inp._origPhVi === undefined || curPh !== inp._lastAppliedPh) {
        inp._origPhVi = curPh;
      }
      let nextPh = inp._origPhVi;
      if (currentLang !== 'vi') {
        if (inp._origPhVi.includes('Tìm kiếm SKU')) {
          nextPh = currentLang === 'zh' ? '搜索 SKU 编号、农资名称...' : 'Search SKU, supply name...';
        } else if (inp._origPhVi.includes('Ghi chú, người nhập')) {
          nextPh = currentLang === 'zh' ? '搜索备注、操作员、阶段...' : 'Notes, operator, stage...';
        } else if (inp._origPhVi.includes('Vật tư, ghi chú')) {
          nextPh = currentLang === 'zh' ? '农资、备注、操作员...' : 'Supply, notes, operator...';
        } else {
          nextPh = translateDynamicTerm(inp._origPhVi, currentLang);
        }
      }
      if (curPh !== nextPh) {
        inp.setAttribute('placeholder', nextPh);
      }
      inp._lastAppliedPh = nextPh;
    });

    // Translate [title] tooltips (excluding language/currency buttons)
    document.querySelectorAll('[title]').forEach(el => {
      if (el.hasAttribute('data-lang-btn') || el.hasAttribute('data-currency-btn')) return;
      const curTitle = el.getAttribute('title') || '';
      if (!curTitle.trim()) return;
      if (el._origTitleVi === undefined || curTitle !== el._lastAppliedTitle) {
        el._origTitleVi = curTitle;
      }
      const nextTitle = currentLang === 'vi' ? el._origTitleVi : translateDynamicTerm(el._origTitleVi, currentLang);
      if (curTitle !== nextTitle) {
        el.setAttribute('title', nextTitle);
      }
      el._lastAppliedTitle = nextTitle;
    });
  }

  function applyDomTranslations() {
    if (isApplyingDom) return;
    isApplyingDom = true;
    try {
      if (document.documentElement) {
        document.documentElement.setAttribute('lang', currentLang);
      }

      // 1. Update all elements with [data-i18n]
      const nodes = document.querySelectorAll('[data-i18n]');
      nodes.forEach(el => {
        if (!el._origViI18n) el._origViI18n = el.textContent;
        const key = el.getAttribute('data-i18n');
        const translated = currentLang === 'vi'
          ? (t(key, null) || el._origViI18n)
          : t(key, null);
        if (translated && el.textContent !== translated) {
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

      // 4. Full-DOM TextNode, Option, Attribute & Currency Translation across all pages
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

  // Real-time debounced MutationObserver so dynamically rendered modals/timelines/tables auto-translate
  let mutationTimer = null;
  function setupMutationObserver() {
    if (!document.body || typeof MutationObserver === 'undefined') return;
    const obs = new MutationObserver(() => {
      if (isApplyingDom) return;
      if (currentLang === 'vi' && currentCurrency === 'VND') return;
      if (mutationTimer) clearTimeout(mutationTimer);
      mutationTimer = setTimeout(() => {
        applyDomTranslations();
      }, 25);
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
    CURRENCY_RATES,
    EXACT_PHRASE_MAP
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
