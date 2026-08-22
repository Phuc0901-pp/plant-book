import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/theme.dart';
import '../../components/loading_indicator.dart';
import '../../components/admin_drawer.dart';

class AdminUserPage extends StatefulWidget {
  const AdminUserPage({super.key});

  @override
  State<AdminUserPage> createState() => _AdminUserPageState();
}

class _AdminUserPageState extends State<AdminUserPage> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  List<dynamic> _users = [];
  String _filterTab = 'all'; // 'all', 'pending', 'pro'

  @override
  void initState() {
    super.initState();
    _loadUsers();
  }

  Future<void> _loadUsers() async {
    setState(() => _isLoading = true);
    try {
      final list = await _apiService.fetchUsers();
      setState(() {
        _users = list;
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  List<dynamic> get _filteredUsers {
    if (_filterTab == 'pending') {
      return _users.where((u) => u['approved'] == false).toList();
    }
    if (_filterTab == 'pro') {
      return _users.where((u) => u['account_tier'] == 'pro').toList();
    }
    return _users;
  }

  Future<void> _approveUser(int userId) async {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('⚡ Đã phê duyệt kích hoạt tài khoản Nông hộ thành công!'), backgroundColor: AppTheme.green),
    );
    _loadUsers();
  }

  Future<void> _toggleProTier(int userId, bool isCurrentPro) async {
    final newTier = isCurrentPro ? 'normal' : 'pro';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('⚡ Đã chuyển đổi hạng tài khoản thành ${newTier.toUpperCase()}!'), backgroundColor: AppTheme.green),
    );
    _loadUsers();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      drawer: const AdminDrawer(activeRoute: 'users'),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: const Text('Quản lý Nông hộ & PRO Tier', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _loadUsers),
        ],
      ),
      body: Column(
        children: [
          // Filter Tabs (Tất cả, Chờ duyệt ⏳, Nông hộ PRO 👑)
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                _tabChip('all', 'Tất cả (${_users.length})'),
                const SizedBox(width: 8),
                _tabChip('pending', 'Chờ duyệt ⏳ (${_users.where((u) => u['approved'] == false).length})'),
                const SizedBox(width: 8),
                _tabChip('pro', 'Hạng PRO 👑 (${_users.where((u) => u['account_tier'] == 'pro').length})'),
              ],
            ),
          ),

          Expanded(
            child: _isLoading
                ? const LoadingIndicator(message: 'Đang tải danh sách Nông hộ...')
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _filteredUsers.length,
                    itemBuilder: (context, idx) {
                      final u = _filteredUsers[idx];
                      final bool isApproved = u['approved'] ?? true;
                      final bool isPro = u['account_tier'] == 'pro';
                      final userId = u['id'] as int;

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: isApproved ? Colors.grey.shade200 : Colors.amber.shade300, width: isApproved ? 1 : 1.5),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 3))
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                CircleAvatar(
                                  radius: 20,
                                  backgroundColor: isPro ? AppTheme.greenDark : Colors.grey.shade200,
                                  child: Icon(isPro ? Icons.workspace_premium_rounded : Icons.person_rounded, color: isPro ? Colors.amber : Colors.grey.shade600, size: 20),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(u['full_name'] ?? u['name'] ?? 'Nông hộ', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A))),
                                      Text(u['phone'] ?? u['email'] ?? '—', style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: isPro ? Colors.amber.shade100 : Colors.grey.shade100,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: isPro ? Colors.amber : Colors.grey.shade300),
                                  ),
                                  child: Text(isPro ? 'PRO 👑' : 'NORMAL', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: isPro ? Colors.amber.shade900 : Colors.grey.shade700)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                if (!isApproved)
                                  Expanded(
                                    child: ElevatedButton.icon(
                                      onPressed: () => _approveUser(userId),
                                      icon: const Icon(Icons.check_circle_rounded, size: 16),
                                      label: const Text('Phê duyệt ngay ⏳'),
                                      style: ElevatedButton.styleFrom(backgroundColor: AppTheme.green, padding: const EdgeInsets.symmetric(vertical: 8)),
                                    ),
                                  )
                                else
                                  Expanded(
                                    child: OutlinedButton.icon(
                                      onPressed: () => _toggleProTier(userId, isPro),
                                      icon: Icon(isPro ? Icons.arrow_downward_rounded : Icons.star_rounded, size: 16),
                                      label: Text(isPro ? 'Hạ xuống NORMAL' : 'Nâng cấp PRO 👑'),
                                      style: OutlinedButton.styleFrom(foregroundColor: isPro ? Colors.grey.shade700 : AppTheme.greenDark, padding: const EdgeInsets.symmetric(vertical: 8)),
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _tabChip(String key, String label) {
    final bool active = _filterTab == key;
    return GestureDetector(
      onTap: () => setState(() => _filterTab = key),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? AppTheme.greenDark : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(label, style: TextStyle(color: active ? Colors.white : Colors.grey.shade700, fontSize: 12, fontWeight: FontWeight.bold)),
      ),
    );
  }
}
