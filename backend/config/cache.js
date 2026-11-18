class MemoryCacheEngine {
  constructor() {
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0, sets: 0 };

    setInterval(() => this.cleanupExpiredKeys(), 60000);
  }

  set(key, value, ttlSeconds = 300) {
    const expireAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expireAt });
    this.stats.sets++;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > item.expireAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return item.value;
  }

  del(key) {
    this.cache.delete(key);
  }

  invalidatePattern(patternPrefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(patternPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  cleanupExpiredKeys() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expireAt) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? ((this.stats.hits / totalRequests) * 100).toFixed(1) + '%' : '0%';
    return {
      keysCount: this.cache.size,
      hitRate,
      ...this.stats
    };
  }

  flushAll() {
    this.cache.clear();
  }

  flush() {
    this.cache.clear();
  }

  clear() {
    this.cache.clear();
  }
}

const memoryCache = new MemoryCacheEngine();

module.exports = memoryCache;
