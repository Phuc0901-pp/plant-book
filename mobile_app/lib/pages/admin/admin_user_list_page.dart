import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/theme.dart';
import '../../components/loading_indicator.dart';

class AdminUserListPage extends StatefulWidget {
  const AdminUserListPage({super.key});

  @override
  State<AdminUserListPage> createState() => _AdminUserListPageState();
}

class _AdminUserListPageState extends State<AdminUserListPage> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  List<Map<String, dynamic>> _users = [];

  @override
  void initState() {
    super.initState();
    _loadUsers();
  }

  Future<void> _loadUsers() async {
    setState(() => _isLoading = true);
    final list = await _apiService.fetchUsers();
    setState(() {
      _users = list;
      _isLoading = false;
    });
  }

  void _openCreateUserDialog() {
    final emailController = TextEditingController();
    final passwordController = TextEditingController();
    final nameController = TextEditingController();
    String role = 'user';
    final formKey = GlobalKey<FormState>();

    showDialog<bool>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: const Text('Thêm tài khoản mới', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
              content: Form(
                key: formKey,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      TextFormField(
                        controller: nameController,
                        decoration: const InputDecoration(labelText: 'Họ và tên *', border: OutlineInputBorder()),
                        validator: (v) => v == null || v.isEmpty ? 'Nhập họ và tên' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: emailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(labelText: 'Email *', border: OutlineInputBorder()),
                        validator: (v) => v == null || !v.contains('@') ? 'Nhập email hợp lệ' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: passwordController,
                        obscureText: true,
                        decoration: const InputDecoration(labelText: 'Mật khẩu *', border: OutlineInputBorder()),
                        validator: (v) => v == null || v.length < 6 ? 'Mật khẩu từ 6 ký tự' : null,
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        value: role,
                        decoration: const InputDecoration(labelText: 'Vai trò', border: OutlineInputBorder()),
                        items: const [
                          DropdownMenuItem(value: 'user', child: Text('Nông hộ (User)')),
                          DropdownMenuItem(value: 'admin', child: Text('Quản trị viên (Admin)')),
                        ],
                        onChanged: (val) {
                          if (val != null) {
                            setDialogState(() => role = val);
                          }
                        },
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Hủy', style: TextStyle(color: AppTheme.textMuted)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.green),
                  onPressed: () async {
                    if (!formKey.currentState!.validate()) return;
                    Navigator.pop(context, true);
                    
                    final success = await _apiService.createUser(
                      emailController.text.trim(),
                      passwordController.text,
                      nameController.text.trim(),
                      role,
                    );

                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(success ? 'Thêm tài khoản thành công!' : 'Lỗi khi tạo tài khoản.'),
                          backgroundColor: success ? AppTheme.green : AppTheme.red,
                        ),
                      );
                      _loadUsers();
                    }
                  },
                  child: const Text('Thêm mới', style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: const Text('Quản lý người dùng', style: TextStyle(fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadUsers,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Đang tải danh sách người dùng...')
          : _users.isEmpty
              ? const Center(child: Text('Không có tài khoản nào.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _users.length,
                  itemBuilder: (context, index) {
                    final u = _users[index];
                    final name = u['full_name'] ?? 'Chưa cập nhật';
                    final email = u['email'] ?? '—';
                    final role = u['role'] == 'admin' ? 'Quản trị viên' : 'Nông hộ';
                    final isOnline = u['is_online'] == true;

                    return Card(
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: AppTheme.grayBorder),
                      ),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: isOnline ? AppTheme.green.withOpacity(0.1) : AppTheme.grayBorder,
                          child: Icon(
                            Icons.person_rounded,
                            color: isOnline ? AppTheme.green : AppTheme.textMuted,
                          ),
                        ),
                        title: Row(
                          children: [
                            Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                            const SizedBox(width: 8),
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: isOnline ? AppTheme.green : Colors.grey.shade400,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ],
                        ),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Email: $email', style: const TextStyle(fontSize: 11)),
                              const SizedBox(height: 2),
                              Text('Vai trò: $role', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppTheme.green,
        onPressed: _openCreateUserDialog,
        child: const Icon(Icons.add_rounded, color: Colors.white),
      ),
    );
  }
}
