/* ═══════════════════════════════════════════════════════════════
   Plant Book – Backend
   config/redis.js — Dual-Support Redis Caching (Upstash REST + ioredis TCP + In-Memory Fallback)
   ═══════════════════════════════════════════════════════════════ */

const Redis = require('ioredis');

let redisClient = null;
let isRedisConnected = false;
const inMemoryCache = new Map();

const REDIS_URL = process.env.REDIS_URL;
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const isUpstashConfigured = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

if (REDIS_URL) {
  try {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('⚠️ Redis TCP connection retry limit reached. Falling back to in-memory cache.');
          return null;
        }
        return Math.min(times * 200, 1000);
      }
    });

    redisClient.on('connect', () => {
      isRedisConnected = true;
      console.log('⚡ [REDIS] Connected via ioredis TCP successfully!');
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      console.warn('⚠️ [REDIS TCP] Connection warning:', err.message);
    });
  } catch (err) {
    console.warn('⚠️ [REDIS TCP] Initialization error:', err.message);
  }
} else if (isUpstashConfigured) {
  console.log('⚡ [REDIS] Configured with Upstash Cloud REST API:', UPSTASH_URL);
} else {
  console.log('ℹ️ [REDIS] Running with high-performance In-Memory Caching.');
}

/**
 * Upstash REST helper
 */
async function upstashFetch(commandArray) {
  if (!isUpstashConfigured) return null;
  try {
    const res = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commandArray)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.error) {
        console.warn('⚠️ [UPSTASH REST] Response warning:', data.error);
        return null;
      }
      return data.result;
    }
  } catch (err) {
    console.warn('⚠️ [UPSTASH REST] Fetch error:', err.message);
  }
  return null;
}

/**
 * Cache Get Helper (Redis TCP primary -> Upstash REST -> In-Memory fallback)
 * @param {string} key 
 */
async function getCache(key) {
  // 1. Try ioredis TCP if connected
  try {
    if (isRedisConnected && redisClient) {
      const val = await redisClient.get(key);
      if (val) return JSON.parse(val);
    }
  } catch (_) {}

  // 2. Try Upstash REST API if configured
  if (isUpstashConfigured) {
    try {
      const res = await upstashFetch(['GET', key]);
      if (res) return typeof res === 'string' ? JSON.parse(res) : res;
    } catch (_) {}
  }

  // 3. Fallback to in-memory Map
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
 * Cache Set Helper (Redis TCP primary -> Upstash REST -> In-Memory fallback)
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds Default 300s (5 mins)
 */
async function setCache(key, value, ttlSeconds = 300) {
  const jsonStr = JSON.stringify(value);

  // 1. Try ioredis TCP if connected
  try {
    if (isRedisConnected && redisClient) {
      await redisClient.set(key, jsonStr, 'EX', ttlSeconds);
      return;
    }
  } catch (_) {}

  // 2. Try Upstash REST API if configured
  if (isUpstashConfigured) {
    try {
      await upstashFetch(['SET', key, jsonStr, 'EX', ttlSeconds.toString()]);
    } catch (_) {}
  }

  // 3. Fallback to in-memory Map
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
 * Cache Delete Helper
 * @param {string} key 
 */
async function delCache(key) {
  try {
    if (isRedisConnected && redisClient) {
      await redisClient.del(key);
    }
  } catch (_) {}

  if (isUpstashConfigured) {
    try {
      await upstashFetch(['DEL', key]);
    } catch (_) {}
  }

  inMemoryCache.delete(key);
}

module.exports = {
  redisClient,
  isRedisConnected: () => isRedisConnected || isUpstashConfigured,
  getCache,
  setCache,
  delCache
};
