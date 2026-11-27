import '../state/app_state_and_concepts.dart';

class RbacPolicy {
  static const String subRoleFarmOwner = AppConcepts.subRoleFarmOwner;
  static const String subRoleCareWorker = AppConcepts.subRoleCareWorker;
  static const String subRoleWarehouseManager = AppConcepts.subRoleWarehouseManager;
  static const String subRoleAuditorReadonly = AppConcepts.subRoleAuditorReadonly;

  static String resolveSubRole(Map<String, dynamic>? user) {
    if (user == null) return subRoleFarmOwner;
    final String rawRole =
        (user['role'] ?? '').toString().trim().toLowerCase();
    final String rawSubRole =
        (user['sub_role'] ?? user['subRole'] ?? '')
            .toString()
            .trim()
            .toLowerCase();

    if (rawRole == AppConcepts.roleAdmin || rawRole == AppConcepts.roleSuperAdmin) {
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

  static bool canEditPlants(Map<String, dynamic>? user) {
    final String resolved = resolveSubRole(user);
    return resolved == subRoleFarmOwner || resolved == subRoleCareWorker;
  }

  static bool canRecordCareLogs(Map<String, dynamic>? user) {
    final String resolved = resolveSubRole(user);
    return resolved == subRoleFarmOwner || resolved == subRoleCareWorker;
  }

  static bool canDeleteOrLockLogs(Map<String, dynamic>? user) {
    final String resolved = resolveSubRole(user);
    return resolved == subRoleFarmOwner;
  }

  static bool canManageSupplies(Map<String, dynamic>? user) {
    final String resolved = resolveSubRole(user);
    return resolved == subRoleFarmOwner ||
        resolved == subRoleWarehouseManager;
  }

  static bool canIssueOrRevokeNfcCard(Map<String, dynamic>? user) {
    final String resolved = resolveSubRole(user);
    return resolved == subRoleFarmOwner;
  }

  static bool canAuditHashChainLedger(Map<String, dynamic>? user) {
    return true;
  }

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

  static String getRoleBadgeCode(Map<String, dynamic>? user) {
    final String rawRole =
        (user?['role'] ?? '').toString().trim().toLowerCase();
    if (rawRole == 'admin' || rawRole == 'superadmin') {
      return 'ROOT_ADMIN';
    }
    return resolveSubRole(user).toUpperCase();
  }

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
