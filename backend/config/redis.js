/* ═══════════════════════════════════════════════════════════════
   Plant Book – Backend
   config/redis.js — Redis Caching & Memory Protection Layer
   ═══════════════════════════════════════════════════════════════ */

const Redis = require('ioredis');

let redisClient = null;
let isRedisConnected = false;
const inMemoryCache = new Map();

const REDIS_URL = process.env.REDIS_URL;

if (REDIS_URL) {
  try {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('⚠️ Redis connection attempts exceeded limit. Falling back to high-speed in-memory cache.');
          return null; // Stop retrying
        }
        return Math.min(times * 200, 1000);
      }
    });

    redisClient.on('connect', () => {
      isRedisConnected = true;
      console.log('⚡ [REDIS] Connected to Redis Cache Cluster successfully!');
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      console.warn('⚠️ [REDIS] Connection warning (fallback to in-memory):', err.message);
    });
  } catch (err) {
    console.warn('⚠️ [REDIS] Initialization error:', err.message);
  }
} else {
  console.log('ℹ️ [REDIS] REDIS_URL not set in env. Platform running with high-performance In-Memory Caching.');
}

/**
 * Cache Get Helper (Redis primary, In-Memory fallback)
 * @param {string} key 
 */
async function getCache(key) {
  try {
    if (isRedisConnected && redisClient) {
      const val = await redisClient.get(key);
      if (val) return JSON.parse(val);
    }
  } catch (err) {
    console.warn(`Redis GET key "${key}" error:`, err.message);
  }

  // Fallback to in-memory
  if (inMemoryCache.has(key)) {
    const item = inMemoryCache.get(key);
    if (item.expireAt && Date.now() > item.expireAt) {
      inMemoryCache.delete(key);
      return null;
    }
    return item.value;
  }
  return null;
}

/**
 * Cache Set Helper (Redis primary, In-Memory fallback)
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds Default 300s (5 mins)
 */
async function setCache(key, value, ttlSeconds = 300) {
  try {
    if (isRedisConnected && redisClient) {
      await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return;
    }
  } catch (err) {
    console.warn(`Redis SET key "${key}" error:`, err.message);
  }

  // Fallback to in-memory
  if (inMemoryCache.size > 1000) {
    const firstKey = inMemoryCache.keys().next().value;
    inMemoryCache.delete(firstKey);
  }
  inMemoryCache.set(key, {
    value,
    expireAt: Date.now() + (ttlSeconds * 1000)
  });
}

/**
 * Cache Invalidate Helper
 * @param {string} key 
 */
async function delCache(key) {
  try {
    if (isRedisConnected && redisClient) {
      await redisClient.del(key);
    }
  } catch (_) {}
  inMemoryCache.delete(key);
}

module.exports = {
  redisClient,
  isRedisConnected: () => isRedisConnected,
  getCache,
  setCache,
  delCache
};
