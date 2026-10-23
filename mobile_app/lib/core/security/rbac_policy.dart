/// Chính sách Phân quyền Đa tầng (Enterprise RBAC & Sub-Role Policy Engine)
/// Đồng bộ 100% với Web App `v1.3.5` (`admin.js` / `user_dashboard.js`) và Backend (`routes/auth.js`, `routes/plants.js`).
///
/// 4 Sub-Role chuẩn trong hệ thống:
/// - `farm_owner`: Chủ trang trại / Quản lý toàn quyền (Xem tài chính, chỉnh sửa cây, kho, sổ cái).
/// - `care_worker`: Kỹ thuật viên hiện trường (Quét NFC/QR, ghi nhật ký VietGAP, đồng bộ Offline; **Ẩn số liệu tài chính/doanh thu**).
/// - `warehouse_manager`: Quản lý kho vật tư (Quản lý nhập/xuất vật tư, theo dõi PHI; **Ẩn doanh thu mùa vụ**).
/// - `auditor_readonly`: Kiểm định viên độc lập VietGAP / Carbon MRV (Chỉ đọc toàn bộ hồ sơ + Sổ cái SHA-256; **Không chỉnh sửa, ẩn số liệu tài chính nội bộ**).
class RbacPolicy {
  static const String subRoleFarmOwner = 'farm_owner';
  static const String subRoleCareWorker = 'care_worker';
  static const String subRoleWarehouseManager = 'warehouse_manager';
  static const String subRoleAuditorReadonly = 'auditor_readonly';

  /// Giải mã `sub_role` chuẩn từ thông tin người dùng đăng nhập.
  static String resolveSubRole(Map<String, dynamic>? user) {
    if (user == null) return subRoleFarmOwner;
    final String rawRole =
        (user['role'] ?? '').toString().trim().toLowerCase();
    final String rawSubRole =
        (user['sub_role'] ?? user['subRole'] ?? '')
            .toString()
            .trim()
            .toLowerCase();

    if (rawRole == 'admin' || rawRole == 'superadmin') {
      return subRoleFarmOwner;
    }
    if (rawSubRole == subRoleCareWorker ||
        rawSubRole == 'worker' ||
        rawSubRole == 'field_worker') {
      return subRoleCareWorker;
    }
    if (rawSubRole == subRoleWarehouseManager ||
        rawSubRole == 'warehouse') {
      return subRoleWarehouseManager;
    }
    if (rawSubRole == subRoleAuditorReadonly ||
        rawSubRole == 'auditor' ||
        rawSubRole == 'readonly') {
      return subRoleAuditorReadonly;
    }
    return subRoleFarmOwner;
  }

  /// Kiểm tra xem người dùng hiện tại có bị ẩn số liệu Tài chính / Chi phí / Doanh thu (`isFinanceRedacted`) hay không.
  /// Theo chuẩn bảo mật `v1.3.5`: Chỉ `admin` hoặc `farm_owner` mới được xem đầy đủ chi phí & doanh thu.
  static bool isFinanceRedacted(Map<String, dynamic>? user) {
    if (user == null) return false;
    if (user['is_finance_redacted'] == true ||
        user['isFinanceRedacted'] == true) {
      return true;
    }
    final String resolved = resolveSubRole(user);
    return resolved == subRoleCareWorker ||
        resolved == subRoleWarehouseManager ||
        resolved == subRoleAuditorReadonly;
  }

  /// Quyền thêm/sửa thông tin cây trồng và tọa độ GPS.
  static bool canEditPlants(Map<String, dynamic>? user) {
    final String resolved = resolveSubRole(user);
    return resolved == subRoleFarmOwner || resolved == subRoleCareWorker;
  }

  /// Quyền ghi nhật ký chăm sóc VietGAP (Online & Offline).
  static bool canRecordCareLogs(Map<String, dynamic>? user) {
    final String resolved = resolveSubRole(user);
    return resolved == subRoleFarmOwner || resolved == subRoleCareWorker;
  }

  /// Quyền xóa mềm (Soft-Delete) hoặc khóa nhật ký.
  static bool canDeleteOrLockLogs(Map<String, dynamic>? user) {
    final String resolved = resolveSubRole(user);
    return resolved == subRoleFarmOwner;
  }

  /// Quyền quản lý kho vật tư nông nghiệp (Nhập kho / Chỉnh sửa đơn giá).
  static bool canManageSupplies(Map<String, dynamic>? user) {
    final String resolved = resolveSubRole(user);
    return resolved == subRoleFarmOwner ||
        resolved == subRoleWarehouseManager;
  }

  /// Quyền phát hành mới hoặc thu hồi thẻ NFC NTAG213 (`IssueLevel++`).
  static bool canIssueOrRevokeNfcCard(Map<String, dynamic>? user) {
    final String resolved = resolveSubRole(user);
    return resolved == subRoleFarmOwner;
  }

  /// Quyền truy cập Sổ cái Bất biến SHA-256 & Báo cáo Carbon MRV.
  static bool canAuditHashChainLedger(Map<String, dynamic>? user) {
    return true; // Mọi vai trò đều được phép kiểm chứng tính toàn vẹn SHA-256
  }

  /// Nhãn hiển thị Tiếng Việt chuẩn cho từng vai trò.
  static String getRoleDisplayLabel(Map<String, dynamic>? user) {
    final String rawRole =
        (user?['role'] ?? '').toString().trim().toLowerCase();
    if (rawRole == 'admin' || rawRole == 'superadmin') {
      return 'Quản trị Hệ thống (Enterprise Admin)';
    }
    switch (resolveSubRole(user)) {
      case subRoleCareWorker:
        return 'Kỹ thuật viên Hiện trường (Care Worker)';
      case subRoleWarehouseManager:
        return 'Quản lý Kho Vật tư (Warehouse Manager)';
      case subRoleAuditorReadonly:
        return 'Kiểm định viên Độc lập (ISO/VietGAP Auditor)';
      case subRoleFarmOwner:
      default:
        return 'Chủ Trang trại (Farm Owner)';
    }
  }

  /// Mã định danh ngắn hiển thị trên Huy hiệu Bảo mật (Security Badge).
  static String getRoleBadgeCode(Map<String, dynamic>? user) {
    final String rawRole =
        (user?['role'] ?? '').toString().trim().toLowerCase();
    if (rawRole == 'admin' || rawRole == 'superadmin') {
      return 'ROOT_ADMIN';
    }
    return resolveSubRole(user).toUpperCase();
  }

  /// Định dạng hiển thị tiền tệ có áp dụng chính sách Che giấu Tài chính (`isFinanceRedacted`).
  static String formatCurrencyWithPolicy(
    num? amount,
    Map<String, dynamic>? user, {
    String suffix = ' đ',
  }) {
    if (isFinanceRedacted(user)) {
      return '*** (Bảo mật RBAC)';
    }
    final num safeVal = amount ?? 0;
    final String formatted = safeVal
        .round()
        .toString()
        .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (Match m) => '.');
    return '$formatted$suffix';
  }
}
