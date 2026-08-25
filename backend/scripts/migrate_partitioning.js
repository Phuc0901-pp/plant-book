const { writeQuery, readQuery } = require('../config/db');
const memoryCache = require('../config/cache');

async function runDatabaseOptimization() {
  console.log('🚀 Bắt đầu quá trình Tối Ưu Hóa CSDL & Thiết Lập Index Hiệu Năng Cao ($0)...');

  try {
    // 1. Đánh chỉ mục hiệu năng cao (B-Tree Indexes) trên các bảng cốt lõi
    console.log('📦 1. Đang kiểm tra & tạo B-Tree Indexes...');
    await writeQuery(`
      CREATE INDEX IF NOT EXISTS idx_plants_farm_id ON plants(farm_id);
      CREATE INDEX IF NOT EXISTS idx_plants_tree_code ON plants(tree_code);
      CREATE INDEX IF NOT EXISTS idx_plants_health_status ON plants(health_status);
      CREATE INDEX IF NOT EXISTS idx_plant_logs_plant_date ON plant_logs(plant_id, log_date DESC);
      CREATE INDEX IF NOT EXISTS idx_plant_logs_created_by ON plant_logs(created_by);
      CREATE INDEX IF NOT EXISTS idx_supply_usages_farm_user ON supply_usages(farm_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_supplies_farm_id ON supplies(farm_id);
      CREATE INDEX IF NOT EXISTS idx_farms_user_id ON farms(user_id);
    `);
    console.log('✅ Đã thiết lập hoàn tất toàn bộ Indexes!');

    // 2. Kiểm thử cơ chế Read-Write Splitting
    console.log('⚖️ 2. Kiểm thử phân luồng ReadQuery & WriteQuery...');
    const testRead = await readQuery('SELECT COUNT(*) as total_farms FROM farms WHERE is_deleted IS NOT TRUE');
    console.log(`✅ ReadPool hoạt động hoàn hảo! Tổng số trang trại đang quản lý: ${testRead.rows[0]?.total_farms || 0}`);

    // 3. Kiểm thử RAM In-Memory Cache
    console.log('🧠 3. Kiểm thử In-Memory Cache Engine...');
    memoryCache.set('system_health_check', { status: 'OPTIMAL', timestamp: Date.now() }, 60);
    const cachedItem = memoryCache.get('system_health_check');
    console.log('✅ In-Memory Cache phản hồi:', cachedItem);
    console.log('📊 Cache Stats:', memoryCache.getStats());

    console.log('\n🎉 HOÀN TẤT TỐI ƯU HÓA HẠ TẦNG CSDL VÀ PHÂN LUỒNG $0!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi trong quá trình tối ưu:', err.message);
    process.exit(1);
  }
}

runDatabaseOptimization();
