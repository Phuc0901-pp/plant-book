/* ═══════════════════════════════════════════════════════════════
   Plant Book – Backend
   services/eventBus.js — Event-Driven Cache Invalidation & WebSocket Broadcast
   ═══════════════════════════════════════════════════════════════ */

const { delCache, delCacheByPattern } = require('../config/redis');

/**
 * Xóa cache theo mẫu và phát sóng sự kiện qua WebSockets tới mọi client đang kết nối
 * @param {string} event Tên sự kiện (ví dụ: 'plants_updated', 'farms_updated', 'new_care_log')
 * @param {object} data Dữ liệu payload đính kèm
 * @param {Array<string>|string} cachePatterns Các pattern cache cần xóa (ví dụ: 'farms_', 'plants_')
 */
async function invalidateAndBroadcast(event, data = {}, cachePatterns = ['farms_', 'plants_']) {
  try {
    // 1. Dọn dẹp cache Redis / In-Memory
    if (cachePatterns) {
      const patterns = Array.isArray(cachePatterns) ? cachePatterns : [cachePatterns];
      for (const pattern of patterns) {
        if (typeof delCacheByPattern === 'function') {
          await delCacheByPattern(pattern).catch(err => {
            console.warn(`⚠️ [EventBus] Lỗi xóa cache pattern '${pattern}':`, err.message);
          });
        }
      }
    }

    // 2. Phát sóng WebSocket Real-time
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
      console.log(`📡 [EventBus] Broadcasted '${event}' | Invalided cache:`, cachePatterns);
    } else {
      console.log(`ℹ️ [EventBus] Event '${event}' processed (WS Server standby).`);
    }

    return true;
  } catch (err) {
    console.error('❌ [EventBus Error]:', err.message);
    return false;
  }
}

module.exports = {
  invalidateAndBroadcast
};
