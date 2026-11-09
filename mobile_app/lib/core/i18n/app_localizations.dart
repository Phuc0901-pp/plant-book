/// Plant Book AgTech (c) 2026 TBSG Agtech.
/// Enterprise Multi-Language (i18n: VI | EN | ZH) & Executive BI Analytics Engine
/// Supports:
/// - Vietnamese (vi-VN / VND ₫)
/// - English (en-US / USD $)
/// - Chinese Simplified (zh-CN / CNY ¥) for Durian & Dragon Fruit Export Traceability (GACC)

class AppLocalizations {
  static const List<String> supportedLocales = <String>['vi', 'en', 'zh'];

  static const Map<String, double> currencyRates = <String, double>{
    'VND': 1.0,
    'USD': 25450.0,
    'CNY': 3520.0,
  };

  static const Map<String, Map<String, String>> _dictionaries = <String, Map<String, String>>{
    'vi': <String, String>{
      'app_title': 'Sổ Nông Điện Tử - TBSG AgTech',
      'bi_panel_title': 'Bảng Điều Khiển Tài Chính Doanh Nghiệp (BI) & Dự Báo Mùa Vụ',
      'kpi_total_investment': 'Tổng Chi Phí Đầu Tư',
      'kpi_cost_per_tree': 'Chi Phí / Cá Thể Cây',
      'kpi_cost_per_ha': 'Chi Phí / Hecta (Ha)',
      'kpi_roi': 'Tỷ Suất Sinh Lời (ROI)',
      'kpi_predicted_yield': 'Dự Báo Sản Lượng Vụ Tới',
      'pillar_npk': 'Phân bón (NPK & Hữu cơ)',
      'pillar_pesticide': 'Thuốc BVTV & Sinh học',
      'pillar_labor': 'Nhân công canh tác',
      'pillar_water': 'Tiền nước & Điện tưới',
      'crop_durian_ri6': 'Sầu riêng Ri6 xuất khẩu',
      'crop_dragon_fruit': 'Thanh long xuất khẩu',
      'trace_puc_code': 'Mã số vùng trồng xuất khẩu (PUC / GACC)',
      'trace_phi_safe': 'An toàn thu hoạch (Đạt chuẩn PHI)',
    },
    'en': <String, String>{
      'app_title': 'Digital Farm Book - TBSG AgTech',
      'bi_panel_title': 'Enterprise Financial BI & ML Harvest Forecast',
      'kpi_total_investment': 'Total Farm Investment',
      'kpi_cost_per_tree': 'Unit Cost / Tree',
      'kpi_cost_per_ha': 'Cost / Hectare (Ha)',
      'kpi_roi': 'Return on Investment (ROI)',
      'kpi_predicted_yield': 'Next-Season Yield Forecast',
      'pillar_npk': 'Fertilizers (NPK & Organic)',
      'pillar_pesticide': 'Crop Protection (Pesticides)',
      'pillar_labor': 'Cultivation Labor',
      'pillar_water': 'Irrigation Water & Energy',
      'crop_durian_ri6': 'Ri6 Premium Export Durian',
      'crop_dragon_fruit': 'Export Dragon Fruit (Pitaya)',
      'trace_puc_code': 'Export Production Unit Code (PUC / GACC)',
      'trace_phi_safe': 'Safe for Harvest (PHI Compliant)',
    },
    'zh': <String, String>{
      'app_title': '数字化果园溯源档案 - 新宝西贡农业科技',
      'bi_panel_title': '农业企业财务 BI 看板与下一产季产量预测',
      'kpi_total_investment': '果园总投入成本',
      'kpi_cost_per_tree': '单株果树成本',
      'kpi_cost_per_ha': '每公顷成本 (Ha)',
      'kpi_roi': '投资回报率 (ROI)',
      'kpi_predicted_yield': '下一产季预计产量',
      'pillar_npk': '化肥与有机肥 (NPK)',
      'pillar_pesticide': '植保农药与生物制剂',
      'pillar_labor': '果园人工成本',
      'pillar_water': '灌溉水电费用',
      'crop_durian_ri6': '越南干尧榴莲 (Ri6 出口特级)',
      'crop_dragon_fruit': '越南出口火龙果 (Dragon Fruit)',
      'trace_puc_code': '出口注册果园代码 (PUC / 中国海关 GACC 备案号)',
      'trace_phi_safe': '符合采收安全标准 (已过农药安全间隔期 PHI)',
    },
  };

  static String translate(String key, {String lang = 'vi'}) {
    final String normalized = supportedLocales.contains(lang) ? lang : 'vi';
    return _dictionaries[normalized]?[key] ?? _dictionaries['vi']?[key] ?? key;
  }

  static String formatCurrency(double amountVnd, {String currency = 'VND'}) {
    final String curr = currency.toUpperCase();
    if (curr == 'USD') {
      final double usd = amountVnd / (currencyRates['USD'] ?? 25450.0);
      return '\$${usd.toStringAsFixed(2)}';
    }
    if (curr == 'CNY') {
      final double cny = amountVnd / (currencyRates['CNY'] ?? 3520.0);
      return '¥${cny.toStringAsFixed(2)}';
    }
    return '${amountVnd.round()} ₫';
  }

  /// Calculates Executive BI ROI (%) and Cost per Tree / Hectare
  static Map<String, double> computeExecutiveBiMetrics({
    required double npkCostVnd,
    required double pesticideCostVnd,
    required double laborCostVnd,
    required double waterCostVnd,
    required int totalTrees,
    required double totalAreaHa,
    required double projectedRevenueVnd,
  }) {
    final double totalInvestment = npkCostVnd + pesticideCostVnd + laborCostVnd + waterCostVnd;
    final int safeTrees = totalTrees > 0 ? totalTrees : 1;
    final double safeHa = totalAreaHa > 0.05 ? totalAreaHa : 0.1;
    final double costPerTree = totalInvestment / safeTrees;
    final double costPerHa = totalInvestment / safeHa;
    final double netProfit = projectedRevenueVnd - totalInvestment;
    final double roiPercent = totalInvestment > 0 ? ((netProfit / totalInvestment) * 100.0) : 0.0;

    return <String, double>{
      'total_investment_vnd': totalInvestment,
      'cost_per_tree_vnd': costPerTree,
      'cost_per_hectare_vnd': costPerHa,
      'net_profit_vnd': netProfit,
      'roi_percent': double.parse(roiPercent.toStringAsFixed(1)),
    };
  }
}
