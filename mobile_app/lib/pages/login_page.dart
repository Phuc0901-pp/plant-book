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
  bool _obscurePassword = true;
  bool _rememberMe = true;
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
        _errorMessage = result['message'] ?? 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF042F2E), // Deep Emerald & Slate
      body: Stack(
        children: [
          // Background Gradient & Subtle ERP Elements
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFF064E3B),
                    Color(0xFF042F2E),
                    Color(0xFF0F172A),
                  ],
                ),
              ),
            ),
          ),

          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // ERP Brand Header
                    Column(
                      children: [
                        Container(
                          width: 72,
                          height: 72,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(22),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.25),
                                blurRadius: 20,
                                offset: const Offset(0, 8),
                              ),
                              BoxShadow(
                                color: const Color(0xFF10B981).withOpacity(0.35),
                                blurRadius: 15,
                                offset: const Offset(0, 4),
                              ),
                            ],
                            border: Border.all(color: Colors.white.withOpacity(0.9), width: 2),
                          ),
                          child: Center(
                            child: Image.asset(
                              'assets/images/logo.png',
                              fit: BoxFit.contain,
                              errorBuilder: (_, __, ___) => const Icon(Icons.eco_rounded, color: AppTheme.greenDark, size: 38),
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        const Text(
                          'TBSG AGTECH ERP',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            letterSpacing: 1.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: Colors.white.withOpacity(0.15)),
                          ),
                          child: const Text(
                            'HỆ THỐNG QUẢN TRỊ NÔNG NGHIỆP SỐ & AI',
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF6EE7B7),
                              letterSpacing: 0.8,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Main Enterprise Login Card
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.3),
                            blurRadius: 25,
                            offset: const Offset(0, 10),
                          ),
                        ],
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      padding: const EdgeInsets.all(24),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: const [
                                    Text(
                                      'Đăng Nhập Cổng Số',
                                      style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.textMain,
                                      ),
                                    ),
                                    SizedBox(height: 2),
                                    Text(
                                      'Nông hộ & Quản trị viên',
                                      style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                                    ),
                                  ],
                                ),
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFECFDF5),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(Icons.lock_person_rounded, color: AppTheme.green, size: 22),
                                ),
                              ],
                            ),
                            const SizedBox(height: 20),

                            if (_errorMessage != null) ...[
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFEF2F2),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: AppTheme.red.withOpacity(0.3)),
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Icon(Icons.error_outline_rounded, color: AppTheme.red, size: 18),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        _errorMessage!,
                                        style: const TextStyle(color: AppTheme.red, fontSize: 12, height: 1.3),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],

                            // Email / Phone Field
                            TextFormField(
                              controller: _emailController,
                              keyboardType: TextInputType.emailAddress,
                              textInputAction: TextInputAction.next,
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                              decoration: InputDecoration(
                                labelText: 'Email hoặc Số điện thoại',
                                hintText: 'admin@tanbaocorp.vn',
                                prefixIcon: const Icon(Icons.person_outline_rounded, size: 20, color: AppTheme.green),
                                filled: true,
                                fillColor: const Color(0xFFF8FAFC),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  borderSide: const BorderSide(color: AppTheme.green, width: 1.8),
                                ),
                              ),
                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return 'Vui lòng nhập Email hoặc Số điện thoại';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 16),

                            // Password Field with Eye Toggle
                            TextFormField(
                              controller: _passwordController,
                              obscureText: _obscurePassword,
                              textInputAction: TextInputAction.done,
                              onFieldSubmitted: (_) => _handleLogin(),
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                              decoration: InputDecoration(
                                labelText: 'Mật khẩu bảo mật',
                                hintText: '••••••••',
                                prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20, color: AppTheme.green),
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                    size: 20,
                                    color: AppTheme.textMuted,
                                  ),
                                  onPressed: () {
                                    setState(() => _obscurePassword = !_obscurePassword);
                                  },
                                ),
                                filled: true,
                                fillColor: const Color(0xFFF8FAFC),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  borderSide: const BorderSide(color: AppTheme.green, width: 1.8),
                                ),
                              ),
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return 'Vui lòng nhập mật khẩu';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 12),

                            // Remember me & Forgot Password Row
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    SizedBox(
                                      height: 24,
                                      width: 24,
                                      child: Checkbox(
                                        value: _rememberMe,
                                        activeColor: AppTheme.green,
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                        onChanged: (val) => setState(() => _rememberMe = val ?? true),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    const Text('Ghi nhớ', style: TextStyle(fontSize: 12.5, color: AppTheme.textMuted)),
                                  ],
                                ),
                                TextButton(
                                  onPressed: () {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Vui lòng liên hệ Quản trị viên để đặt lại mật khẩu.')),
                                    );
                                  },
                                  child: const Text(
                                    'Quên mật khẩu?',
                                    style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppTheme.green),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 18),

                            // Primary Login Button
                            Container(
                              height: 50,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(14),
                                gradient: const LinearGradient(
                                  colors: [Color(0xFF064E3B), Color(0xFF047857)],
                                  begin: Alignment.centerLeft,
                                  end: Alignment.centerRight,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFF047857).withOpacity(0.35),
                                    blurRadius: 10,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: ElevatedButton(
                                onPressed: _isLoading ? null : _handleLogin,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.transparent,
                                  shadowColor: Colors.transparent,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                ),
                                child: _isLoading
                                    ? const SizedBox(
                                        height: 20,
                                        width: 20,
                                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                      )
                                    : Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: const [
                                          Icon(Icons.login_rounded, size: 18, color: Colors.white),
                                          SizedBox(width: 8),
                                          Text(
                                            'ĐĂNG NHẬP HỆ THỐNG',
                                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                                          ),
                                        ],
                                      ),
                              ),
                            ),
                            const SizedBox(height: 18),

                            // Register Farmer Link
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Text('Chưa có tài khoản? ', style: TextStyle(fontSize: 13, color: AppTheme.textMuted)),
                                GestureDetector(
                                  onTap: _openRegisterDialog,
                                  child: const Text(
                                    'Đăng ký Nông hộ',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: AppTheme.green,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Responsive Footer — Guaranteed NO OVERFLOW
                    Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 6,
                      runSpacing: 4,
                      children: const [
                        Icon(Icons.verified_user_outlined, size: 13, color: Color(0xFF6EE7B7)),
                        Text(
                          'Bảo mật SSL 256-Bit · Bản quyền © 2026 TBSG Agtech',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.white60,
                            fontWeight: FontWeight.w500,
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
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
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
              const Text('Bước 1: Thông tin bảo mật bắt buộc', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
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
              const Text('Bước 2: Thông tin cá nhân & Trang trại', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
              const SizedBox(height: 10),
              TextField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Tên người dùng / Nông hộ', hintText: 'Nguyễn Văn An'),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                value: _selectedGender,
                decoration: const InputDecoration(labelText: 'Giới tính'),
                items: ['Nam', 'Nữ', 'Khác'].map((g) => DropdownMenuItem(value: g, child: Text(g))).toList(),
                onChanged: (v) => setState(() => _selectedGender = v ?? 'Nam'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _dobController,
                decoration: const InputDecoration(labelText: 'Năm sinh / Ngày sinh', hintText: '1985 hoặc 15/08/1985'),
              ),
            ] else ...[
              const Text('Bước 3: Chi tiết cây trồng chính (Khởi tạo)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
              const SizedBox(height: 10),
              TextField(
                controller: _plantTypeController,
                decoration: const InputDecoration(labelText: 'Loại cây trồng chính', hintText: 'Sầu riêng, Bưởi da xanh...'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _plantVarietyController,
                decoration: const InputDecoration(labelText: 'Giống cây trồng', hintText: 'Ri6, Monthong, Năm Roi...'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _plantAgeController,
                decoration: const InputDecoration(labelText: 'Tuổi cây trung bình', hintText: '5 năm tuổi, 10 năm tuổi...'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _farmAreaController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Diện tích canh tác (ha / sào)', hintText: '2.5 ha'),
              ),
            ],

            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (_currentStep > 1)
                  OutlinedButton(
                    onPressed: () => setState(() => _currentStep--),
                    child: const Text('Quay lại'),
                  )
                else
                  const SizedBox(),
                
                if (_currentStep < 3)
                  ElevatedButton(
                    onPressed: () {
                      if (_currentStep == 1) {
                        if (_phoneController.text.trim().isEmpty || _passwordController.text.isEmpty) {
                          setState(() => _errorMsg = 'Vui lòng nhập đầy đủ Số điện thoại & Mật khẩu');
                          return;
                        }
                        if (_passwordController.text != _confirmPassController.text) {
                          setState(() => _errorMsg = 'Mật khẩu xác nhận không khớp');
                          return;
                        }
                      }
                      setState(() {
                        _errorMsg = null;
                        _currentStep++;
                      });
                    },
                    child: const Text('Tiếp tục ➔'),
                  )
                else
                  ElevatedButton(
                    onPressed: _isSubmitting ? null : _submitRegister,
                    style: ElevatedButton.styleFrom(backgroundColor: AppTheme.green),
                    child: _isSubmitting
                        ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Hoàn tất Đăng ký'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
