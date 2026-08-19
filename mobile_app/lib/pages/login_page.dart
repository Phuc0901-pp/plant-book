import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../utils/theme.dart';
import 'dashboard_page.dart';
import 'admin/admin_dashboard_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final email = _emailController.text.trim();
    final password = _passwordController.text;

    final result = await ApiService().login(email, password);

    if (!mounted) return;

    setState(() {
      _isLoading = false;
    });

    if (result['success'] == true) {
      try {
        final user = await ApiService().fetchUserInfo();
        if (!mounted) return;
        if (user != null && user['role'] == 'admin') {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const AdminDashboardPage()),
          );
        } else {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const DashboardPage()),
          );
        }
      } catch (_) {
        if (!mounted) return;
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const DashboardPage()),
        );
      }
    } else {
      setState(() {
        _errorMessage = result['message'] ?? 'Đăng nhập thất bại. Vui lòng kiểm tra lại email, mật khẩu hoặc quyền truy cập tài khoản.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.greenDark, // Dark forest background matching web brand
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Logo Header
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.2),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      )
                    ],
                  ),
                  child: Image.asset(
                    'assets/images/logo.png', // Correct asset path
                    width: 140,
                    errorBuilder: (context, error, stackTrace) {
                      return const Text(
                        'TANBAO AgTech',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.greenDark,
                        ),
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Center(
                child: Text(
                  'SỔ TAY NHẬT KÝ CÂY TRỒNG',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.white60,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
              const SizedBox(height: 36),
              
              // Login Form Card
              Card(
                elevation: 8,
                color: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Đăng nhập Nông hộ',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textMain,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Vui lòng đăng nhập để xem thông tin trang trại',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppTheme.textMuted,
                          ),
                        ),
                        const SizedBox(height: 20),
                        
                        if (_errorMessage != null) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF2F2),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppTheme.red.withOpacity(0.3)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.error_outline_rounded, color: AppTheme.red, size: 18),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    _errorMessage!,
                                    style: const TextStyle(color: AppTheme.red, fontSize: 12),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
                        
                        // Email Field
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                            labelText: 'Email',
                            hintText: 'user@tanbaocorp.vn',
                            prefixIcon: Icon(Icons.email_outlined, size: 20),
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Vui lòng nhập địa chỉ email';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        
                        // Password Field
                        TextFormField(
                          controller: _passwordController,
                          obscureText: true,
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) => _handleLogin(),
                          decoration: const InputDecoration(
                            labelText: 'Mật khẩu',
                            hintText: '••••••••',
                            prefixIcon: Icon(Icons.lock_outline_rounded, size: 20),
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Vui lòng nhập mật khẩu';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 24),
                        
                        // Login button
                        ElevatedButton(
                          onPressed: _isLoading ? null : _handleLogin,
                          child: _isLoading
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    color: Colors.white,
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Text('Đăng nhập'),
                        ),
                        const SizedBox(height: 16),

                        // Register Account Link
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text(
                              'Chưa có tài khoản Nông hộ? ',
                              style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
                            ),
                            GestureDetector(
                              onTap: _openRegisterDialog,
                              child: const Text(
                                'Đăng ký ngay',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.greenDark,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _openRegisterDialog() {
    showDialog(
      context: context,
      builder: (context) => const _FarmerRegisterWizardDialog(),
    );
  }
}

class _FarmerRegisterWizardDialog extends StatefulWidget {
  const _FarmerRegisterWizardDialog();

  @override
  State<_FarmerRegisterWizardDialog> createState() => _FarmerRegisterWizardDialogState();
}

class _FarmerRegisterWizardDialogState extends State<_FarmerRegisterWizardDialog> {
  int _currentStep = 1;
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPassController = TextEditingController();
  final _nameController = TextEditingController();
  final _dobController = TextEditingController();
  final _plantTypeController = TextEditingController();
  final _plantVarietyController = TextEditingController();
  final _plantAgeController = TextEditingController();
  final _farmAreaController = TextEditingController();
  String _selectedGender = 'Nam';
  
  bool _isSubmitting = false;
  String? _errorMsg;

  @override
  void dispose() {
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPassController.dispose();
    _nameController.dispose();
    _dobController.dispose();
    _plantTypeController.dispose();
    _plantVarietyController.dispose();
    _plantAgeController.dispose();
    _farmAreaController.dispose();
    super.dispose();
  }

  Future<void> _submitRegister() async {
    setState(() {
      _isSubmitting = true;
      _errorMsg = null;
    });

    final res = await ApiService().registerFarmerAccount({
      'phone': _phoneController.text.trim(),
      'password': _passwordController.text,
      'full_name': _nameController.text.trim(),
      'gender': _selectedGender,
      'dob': _dobController.text.trim(),
      'plant_type': _plantTypeController.text.trim(),
      'plant_variety': _plantVarietyController.text.trim(),
      'plant_age': _plantAgeController.text.trim(),
      'farm_area': _farmAreaController.text.trim(),
    });


    if (!mounted) return;
    setState(() {
      _isSubmitting = false;
    });

    if (res['success'] == true) {
      Navigator.pop(context);
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.check_circle_rounded, color: AppTheme.green, size: 28),
              SizedBox(width: 10),
              Text('Đăng ký thành công!', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ],
          ),
          content: Text(res['message'] ?? 'Tài khoản của bạn đã được gửi tới Quản trị viên phê duyệt.'),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Đã hiểu'),
            ),
          ],
        ),
      );
    } else {
      setState(() {
        _errorMsg = res['message'] ?? 'Đăng ký thất bại.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Đăng ký Nông hộ (Bước $_currentStep/3)',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textMain),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 20),
                  onPressed: () => Navigator.pop(context),
                )
              ],
            ),
            const Divider(),
            if (_errorMsg != null) ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                child: Text(_errorMsg!, style: const TextStyle(color: Colors.red, fontSize: 12)),
              ),
              const SizedBox(height: 12),
            ],

            if (_currentStep == 1) ...[
              const Text('Bước 1: Thông tin bắt buộc', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
              const SizedBox(height: 10),
              TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Số điện thoại *', hintText: '0901234567'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Mật khẩu *', hintText: 'Tối thiểu 6 ký tự'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _confirmPassController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Xác nhận mật khẩu *', hintText: 'Nhập lại mật khẩu'),
              ),
            ] else if (_currentStep == 2) ...[
              const Text('Bước 2: Thông tin cá nhân & Trang trại (Tùy chọn)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
              const SizedBox(height: 10),
              TextField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Tên người dùng / Tên Nông hộ', hintText: 'Nguyễn Văn An'),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                value: _selectedGender,
                decoration: const InputDecoration(labelText: 'Giới tính'),
                items: const [
                  DropdownMenuItem(value: 'Nam', child: Text('Nam')),
                  DropdownMenuItem(value: 'Nữ', child: Text('Nữ')),
                  DropdownMenuItem(value: 'Khác', child: Text('Khác')),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _selectedGender = val);
                },
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _plantTypeController,
                decoration: const InputDecoration(labelText: 'Loại cây đang trồng', hintText: 'Sầu riêng, Cà phê...'),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _plantVarietyController,
                      decoration: const InputDecoration(labelText: 'Giống cây', hintText: 'Ri6, Monthong'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _plantAgeController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Tuổi cây (Năm)', hintText: '5'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _farmAreaController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Diện tích vườn (ha)', hintText: 'VD: 2.5'),
              ),
            ] else ...[
              const Text('Bước 3: Xác nhận gửi đăng ký', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(10)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Số điện thoại: ${_phoneController.text.trim()}'),
                    const SizedBox(height: 4),
                    Text('Tên nông hộ: ${_nameController.text.trim().isEmpty ? 'Nông hộ ${_phoneController.text.trim()}' : _nameController.text.trim()}'),
                    const SizedBox(height: 4),
                    Text('Cây trồng: ${_plantTypeController.text.trim().isEmpty ? 'Chưa khai báo' : _plantTypeController.text.trim()}'),
                    const SizedBox(height: 4),
                    Text('Diện tích vườn: ${_farmAreaController.text.trim().isEmpty ? 'Chưa khai báo' : '${_farmAreaController.text.trim()} ha'}'),
                  ],
                ),
              ),

              const SizedBox(height: 12),
              const Text(
                'Lưu ý: Sau khi bấm gửi đăng ký, tài khoản của bạn sẽ ở trạng thái chờ Quản trị viên duyệt và mở khóa.',
                style: TextStyle(fontSize: 11, color: AppTheme.textMuted),
              ),
            ],

            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (_currentStep > 1)
                  TextButton.icon(
                    onPressed: () => setState(() => _currentStep--),
                    icon: const Icon(Icons.arrow_back_rounded, size: 16),
                    label: const Text('Quay lại'),
                  )
                else
                  const SizedBox(),
                ElevatedButton(
                  onPressed: _isSubmitting
                      ? null
                      : () {
                          if (_currentStep == 1) {
                            if (_phoneController.text.trim().isEmpty || _passwordController.text.length < 6) {
                              setState(() => _errorMsg = 'Vui lòng điền số điện thoại và mật khẩu >= 6 ký tự');
                              return;
                            }
                            if (_passwordController.text != _confirmPassController.text) {
                              setState(() => _errorMsg = 'Mật khẩu xác nhận không khớp');
                              return;
                            }

                            // Pre-check phone number existence on server
                            setState(() => _isSubmitting = true);
                            ApiService().checkPhoneExists(_phoneController.text.trim()).then((check) {
                              if (!mounted) return;
                              setState(() => _isSubmitting = false);
                              if (check['exists'] == true) {
                                setState(() => _errorMsg = check['message']);
                              } else {
                                setState(() {
                                  _errorMsg = null;
                                  _currentStep = 2;
                                });
                              }
                            });
                          } else if (_currentStep == 2) {
                            setState(() => _currentStep = 3);
                          } else {
                            _submitRegister();
                          }

                        },
                  child: _isSubmitting
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Text(_currentStep == 3 ? 'Gửi đăng ký' : 'Tiếp theo'),
                )
              ],
            )
          ],
        ),
      ),
    );
  }
}

