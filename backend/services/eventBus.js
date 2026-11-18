const { delCache, delCacheByPattern } = require('../config/redis');
const queueService = require('./queueService');

queueService.registerWorker('system.cache_and_broadcast', async (payload) => {
  const { event, data, cachePatterns } = payload;

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

  if (event.includes('plant') || event.includes('farm')) {
    if (typeof delCacheByPattern === 'function') {
      await delCacheByPattern('mvt_tile_').catch(() => {});
      await delCacheByPattern('spatial_cluster_').catch(() => {});
    }
  }

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

async function invalidateAndBroadcast(event, data = {}, cachePatterns = ['farms_', 'plants_']) {
  try {
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
