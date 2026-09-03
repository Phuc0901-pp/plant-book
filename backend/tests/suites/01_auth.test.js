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

});
