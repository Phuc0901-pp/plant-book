/* ═══════════════════════════════════════════════════════════════
   Plant Book – Backend Enterprise
   services/eventBus.js — Event-Driven Cache Invalidation, Distributed Streaming & WebSocket Broadcast
   ═══════════════════════════════════════════════════════════════ */

const { delCache, delCacheByPattern } = require('../config/redis');
const queueService = require('./queueService');

// Đăng ký Worker cốt lõi xử lý Cache Invalidation & WebSocket Broadcast từ Distributed Queue
queueService.registerWorker('system.cache_and_broadcast', async (payload) => {
  const { event, data, cachePatterns } = payload;

  // 1. Dọn dẹp cache Redis / In-Memory
  if (cachePatterns) {
    const patterns = Array.isArray(cachePatterns) ? cachePatterns : [cachePatterns];
    for (const pattern of patterns) {
      if (typeof delCacheByPattern === 'function') {
        await delCacheByPattern(pattern).catch(err => {
          console.warn(`⚠️ [EventBus Worker] Lỗi xóa cache pattern '${pattern}':`, err.message);
        });
      }
    }
  }

  // 2. Xóa cache Vector Tiles MVT nếu có thay đổi cây trồng/nông trại
  if (event.includes('plant') || event.includes('farm')) {
    if (typeof delCacheByPattern === 'function') {
      await delCacheByPattern('mvt_tile_').catch(() => {});
      await delCacheByPattern('spatial_cluster_').catch(() => {});
    }
  }

  // 3. Phát sóng WebSocket Real-time
  const broadcastPayload = {
    event,
    data: {
      ...data,
      timestamp: Date.now(),
      serverTime: new Date().toISOString()
    }
  };

  if (global.broadcastWS && typeof global.broadcastWS === 'function') {
    global.broadcastWS(event, broadcastPayload.data);
    console.log(`📡 [EventBus Worker] Broadcasted '${event}' | Invalidated cache:`, cachePatterns);
  }
});

/**
 * Xóa cache theo mẫu và phát sóng sự kiện qua WebSockets tới mọi client đang kết nối
 * @param {string} event Tên sự kiện (ví dụ: 'plants_updated', 'farms_updated', 'new_care_log')
 * @param {object} data Dữ liệu payload đính kèm
 * @param {Array<string>|string} cachePatterns Các pattern cache cần xóa (ví dụ: 'farms_', 'plants_')
 */
async function invalidateAndBroadcast(event, data = {}, cachePatterns = ['farms_', 'plants_']) {
  try {
    // Đẩy sự kiện vào Distributed Message Queue để xử lý bất đồng bộ
    await queueService.publish('system.cache_and_broadcast', {
      event,
      data,
      cachePatterns
    });

    return true;
  } catch (err) {
    console.error('❌ [EventBus Error]:', err.message);
    return false;
  }
}

module.exports = {
  invalidateAndBroadcast,
  queueService
};
