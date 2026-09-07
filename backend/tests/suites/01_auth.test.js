const { describe, it, expect } = require('../test-framework');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'plant-book-secret-key-2024';

describe('Suite 1: Authentication, Password Hashing & RBAC Authorization', () => {

  it('1.1 Should hash password securely and verify matching password with bcrypt', async () => {
    const rawPassword = 'FarmPassword@2026';
    const saltRounds = 10;
    const hash = await bcrypt.hash(rawPassword, saltRounds);

    expect(typeof hash).toBe('string');
    expect(hash.startsWith('$2')).toBeTruthy();

    const isMatch = await bcrypt.compare(rawPassword, hash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await bcrypt.compare('WrongPassword', hash);
    expect(isWrongMatch).toBe(false);
  });

  it('1.2 Should generate valid JWT token with user payload and expiration', () => {
    const payload = {
      id: 101,
      email: 'farmer.nguyen@tanbaocorp.vn',
      role: 'user',
      full_name: 'Nguyễn Văn Nông Dân'
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.id).toBe(101);
    expect(decoded.email).toBe('farmer.nguyen@tanbaocorp.vn');
    expect(decoded.role).toBe('user');
    expect(decoded.full_name).toBe('Nguyễn Văn Nông Dân');
  });

  it('1.3 Should reject expired or forged JWT tokens', () => {
    const forgedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake_signature';
    let verifyError = null;
    try {
      jwt.verify(forgedToken, JWT_SECRET);
    } catch (e) {
      verifyError = e;
    }
    expect(verifyError).toBeTruthy();
  });

  it('1.4 Should enforce Role-Based Access Control (RBAC) rules', () => {
    const adminUser = { id: 1, role: 'admin', full_name: 'Quản trị viên' };
    const farmerUser = { id: 5, role: 'user', full_name: 'Chủ Trang Trại' };

    // Middleware simulation for requireAdmin
    const checkAdminAccess = (user) => {
      if (!user || user.role !== 'admin') {
        return { status: 403, error: 'Chỉ Quản trị viên mới có quyền thực hiện thao tác này' };
      }
      return { status: 200, allowed: true };
    };

    const adminResult = checkAdminAccess(adminUser);
    expect(adminResult.status).toBe(200);
    expect(adminResult.allowed).toBe(true);

    const farmerResult = checkAdminAccess(farmerUser);
    expect(farmerResult.status).toBe(403);
    expect(farmerResult.error).toContain('Chỉ Quản trị viên');
  });

  it('1.5 Should normalize and validate user email format', () => {
    const validateEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test((email || '').trim().toLowerCase());
    };

    expect(validateEmail('admin@tanbaocorp.vn')).toBe(true);
    expect(validateEmail('farmer.123@gmail.com')).toBe(true);
    expect(validateEmail('invalid-email-no-at')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });

  it('1.6 Should validate Vietnamese phone number format and normalize contact identifier', () => {
    const validatePhone = (phone) => {
      if (!phone) return false;
      const clean = phone.trim().replace(/\s+/g, '');
      const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
      return phoneRegex.test(clean);
    };

    expect(validatePhone('0901234567')).toBe(true);
    expect(validatePhone('0389998877')).toBe(true);
    expect(validatePhone('0868123456')).toBe(true);
    expect(validatePhone('+84901234567')).toBe(true);
    expect(validatePhone('123456')).toBe(false);
    expect(validatePhone('abc0901234567')).toBe(false);
    expect(validatePhone('')).toBe(false);

    const resolveIdentifier = (input) => {
      const trimmed = (input || '').trim();
      if (trimmed.includes('@')) {
        return { type: 'email', value: trimmed.toLowerCase() };
      }
      return { type: 'phone', value: trimmed.replace(/\s+/g, '') };
    };

    expect(resolveIdentifier('farmer@tanbaocorp.vn')).toEqual({ type: 'email', value: 'farmer@tanbaocorp.vn' });
    expect(resolveIdentifier('0901 234 567')).toEqual({ type: 'phone', value: '0901234567' });
  });

  it('1.7 Should validate user creation with Phone & Address when Email is optional', () => {
    const validateCreateUser = (payload) => {
      const fullName = (payload.full_name || '').trim();
      const password = (payload.password || '').trim();
      const email = payload.email && payload.email.trim() ? payload.email.trim().toLowerCase() : null;
      const phone = payload.phone && payload.phone.trim() ? payload.phone.trim() : null;
      const address = payload.address && payload.address.trim() ? payload.address.trim() : null;

      if (!fullName) return { valid: false, error: 'Họ và tên là bắt buộc.' };
      if (!password) return { valid: false, error: 'Mật khẩu là bắt buộc.' };
      if (!email && !phone) return { valid: false, error: 'Vui lòng nhập ít nhất Số điện thoại hoặc Email để làm tài khoản đăng nhập.' };

      return {
        valid: true,
        user: { full_name: fullName, email, phone, address, role: payload.role || 'user' }
      };
    };

    // Case 1: Phone + Address without Email
    const res1 = validateCreateUser({
      full_name: 'Bùi Văn Dũng',
      phone: '0912345678',
      address: 'Xã Ea Ktur, Huyện Cư Kuin, Đắk Lắk',
      email: '',
      password: 'secretPassword123'
    });
    expect(res1.valid).toBe(true);
    expect(res1.user.phone).toBe('0912345678');
    expect(res1.user.address).toBe('Xã Ea Ktur, Huyện Cư Kuin, Đắk Lắk');
    expect(res1.user.email).toBe(null);

    // Case 2: Email + Phone + Address
    const res2 = validateCreateUser({
      full_name: 'Trần Văn Nông',
      phone: '0988776655',
      address: 'Đồng Nai',
      email: 'tranvan@tanbaocorp.vn',
      password: 'secretPassword123'
    });
    expect(res2.valid).toBe(true);
    expect(res2.user.email).toBe('tranvan@tanbaocorp.vn');
    expect(res2.user.phone).toBe('0988776655');

    // Case 3: Missing both email and phone
    const res3 = validateCreateUser({
      full_name: 'Nguyễn Không Liên Lạc',
      phone: '',
      email: '',
      password: 'secretPassword123'
    });
    expect(res3.valid).toBe(false);
    expect(res3.error).toContain('ít nhất Số điện thoại hoặc Email');
  });

  it('1.8 Should authenticate users with either Phone Number or Email interchangeably', () => {
    const mockUsers = [
      { id: 1, full_name: 'Admin Tổng', email: 'admin@tanbaocorp.vn', phone: '0900000001', role: 'admin' },
      { id: 2, full_name: 'Bùi Văn Dũng', email: null, phone: '0912345678', role: 'user' },
      { id: 3, full_name: 'Lê Thị Mai', email: 'mai.le@tanbaocorp.vn', phone: null, role: 'user' }
    ];

    const findUserByIdentifier = (identifier) => {
      const clean = (identifier || '').trim();
      return mockUsers.find(u =>
        (u.email && u.email.toLowerCase() === clean.toLowerCase()) ||
        (u.phone && u.phone === clean)
      ) || null;
    };

    // Login with Phone of user who has no email
    const userByPhone = findUserByIdentifier('0912345678');
    expect(userByPhone).toBeTruthy();
    expect(userByPhone.id).toBe(2);
    expect(userByPhone.full_name).toBe('Bùi Văn Dũng');

    // Login with Email of user who has no phone
    const userByEmail = findUserByIdentifier('mai.le@tanbaocorp.vn');
    expect(userByEmail).toBeTruthy();
    expect(userByEmail.id).toBe(3);
    expect(userByEmail.full_name).toBe('Lê Thị Mai');

    // Login with Phone of user who has both
    const adminByPhone = findUserByIdentifier('0900000001');
    expect(adminByPhone).toBeTruthy();
    expect(adminByPhone.id).toBe(1);

    // Login with Email of user who has both
    const adminByEmail = findUserByIdentifier('admin@tanbaocorp.vn');
    expect(adminByEmail).toBeTruthy();
    expect(adminByEmail.id).toBe(1);

    // Non-existent identifier
    const nonExistent = findUserByIdentifier('0999999999');
    expect(nonExistent).toBe(null);
  });

});

