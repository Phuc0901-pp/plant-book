// -*- coding: utf-8 -*-
/**
 * Script tự động kết nối và tạo toàn bộ bảng CSDL trên NAS
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const nasIp = process.argv[2] || '192.168.1.100';
const dbName = process.argv[3] || 'plant_book';
const user = process.argv[4] || 'postgresadmin';
const password = process.argv[5] || 'Tbsg@Postgres2026';

const connStr = `postgresql://${user}:${encodeURIComponent(password)}@${nasIp}:5432/${dbName}`;

console.log('====================================================');
console.log(`📡 Đang kết nối tới NAS tại IP: ${nasIp}...`);
console.log(`🎯 Database: ${dbName} | User: ${user}`);
console.log('====================================================\n');

const pool = new Pool({
  connectionString: connStr,
  ssl: false,
  connectionTimeoutMillis: 5000
});

async function main() {
  try {
    const client = await pool.connect();
    console.log('✅ Đã kết nối tới PostgreSQL trên NAS thành công!');

    const sqlPath = path.join(__dirname, 'database_init_nas.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('⏳ Đang khởi tạo toàn bộ 12 bảng dữ liệu và chỉ mục...');
    await client.query(sqlContent);

    console.log('✅ ĐÃ TẠO XONG TOÀN BỘ CƠ SỞ DỮ LIỆU TRÊN NAS THÀNH CÔNG 100%!\n');

    // Kiểm tra danh sách bảng
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('📋 Danh sách các bảng đã tạo trên NAS:');
    res.rows.forEach((r, idx) => {
      console.log(`   ${idx + 1}. ${r.table_name}`);
    });

    console.log('\n🎉 Hoàn tất! Bạn có thể sử dụng CSDL trên NAS ngay bây giờ.');
    client.release();
    await pool.end();
  } catch (err) {
    console.error('❌ Lỗi:', err.message);
    if (err.message.includes('connect ECONNREFUSED') || err.message.includes('timeout')) {
      console.log('\n💡 Gợi ý: Hãy kiểm tra xem bạn đã nhập đúng địa chỉ IP của NAS chưa.');
      console.log('   Ví dụ chạy lại: node create_tables_on_nas.js 192.168.1.50');
    }
  }
}

main();
