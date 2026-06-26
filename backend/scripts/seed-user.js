/**
 * Script tạo tài khoản user test
 * Chạy: node scripts/seed-user.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

async function seedUser() {
  const email    = process.env.USER_EMAIL    || 'user@tanbaocorp.vn';
  const password = process.env.USER_PASSWORD || 'User@123';
  const fullName = 'Người dùng Tanbao';

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows.length > 0) {
      console.log(`ℹ️  User đã tồn tại: ${email}`);
      process.exit(0);
    }

    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1,$2,$3,$4)',
      [email, hash, fullName, 'user']
    );

    console.log(`✅ Tạo user thành công!`);
    console.log(`   Email   : ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role    : user`);
  } catch (err) {
    console.error('❌ Lỗi:', err.message);
  } finally {
    await pool.end();
  }
}

seedUser();
