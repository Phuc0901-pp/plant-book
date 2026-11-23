const { EventEmitter } = require('events');
let redisModule = null;
try {
  redisModule = require('../config/redis');
} catch (_) {}

class DistributedQueueService extends EventEmitter {
  constructor() {
    super();
    this.inMemoryStreams = new Map();
    this.workers = new Map();
    this.deadLetterQueue = [];
    this.isProcessing = false;
    this.maxConcurrency = 5;
    this.workerTimer = null;
    this.metrics = {
      published: 0,
      processed: 0,
      failed: 0,
      deadLetter: 0
    };

    this.startWorkerLoop();
  }

  async publish(topic, payload = {}, options = {}) {
    const msgId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const eventRecord = {
      id: msgId,
      topic,
      payload,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: options.maxRetries || 3,
      status: 'pending'
    };

    this.metrics.published++;

    try {
      const client = redisModule ? redisModule.redisClient : null;
      if (client && client.status === 'ready' && typeof client.xadd === 'function') {
        const streamKey = `pb:stream:${topic}`;
        await client.xadd(streamKey, 'MAXLEN', '~', '10000', '*', 'payload', JSON.stringify(payload), 'timestamp', String(eventRecord.timestamp));
      }
    } catch (redisErr) {
      console.warn(`[QueueService] Redis Stream fallback to in-memory:`, redisErr.message);
    }

    if (!this.inMemoryStreams.has(topic)) {
      this.inMemoryStreams.set(topic, []);
    }
    const stream = this.inMemoryStreams.get(topic);
    stream.push(eventRecord);

    if (stream.length > 2000) {
      stream.splice(0, stream.length - 2000);
    }

    this.emit('message_enqueued', { topic, id: msgId });
    return msgId;
  }

  registerWorker(topic, handler) {
    if (!this.workers.has(topic)) {
      this.workers.set(topic, []);
    }
    this.workers.get(topic).push(handler);
    console.log(`👷 [QueueWorker] Registered worker for topic: '${topic}'`);
  }

  async processSingleJob(topic, job, handlers) {
    job.status = 'processing';
    for (const handler of handlers) {
      try {
        await handler(job.payload, job);
        job.status = 'completed';
        this.metrics.processed++;
      } catch (handlerErr) {
        job.retries++;
        console.error(`❌ [QueueWorker Error] Topic: ${topic} Job: ${job.id} Retry: ${job.retries}/${job.maxRetries}:`, handlerErr.message);

        if (job.retries >= job.maxRetries) {
          job.status = 'failed';
          this.metrics.failed++;
          this.metrics.deadLetter++;
          this.deadLetterQueue.push({
            ...job,
            error: handlerErr.message,
            failedAt: Date.now()
          });
          if (this.deadLetterQueue.length > 500) this.deadLetterQueue.shift();
        } else {
          job.status = 'pending';
        }
      }
    }
  }

  startWorkerLoop() {
    this.workerTimer = setInterval(async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;

      try {
        for (const [topic, stream] of this.inMemoryStreams.entries()) {
          const handlers = this.workers.get(topic) || [];
          if (handlers.length === 0) continue;

          const pendingJobs = stream.filter(job => job.status === 'pending');
          for (let i = 0; i < pendingJobs.length; i += this.maxConcurrency) {
            const batch = pendingJobs.slice(i, i + this.maxConcurrency);
            await Promise.allSettled(batch.map(job => this.processSingleJob(topic, job, handlers)));
          }

          const now = Date.now();
          const filtered = stream.filter(j => !(j.status === 'completed' && now - j.timestamp > 60000));
          this.inMemoryStreams.set(topic, filtered);
        }
      } catch (loopErr) {
        console.error('[QueueWorker Fatal Loop Error]:', loopErr);
      } finally {
        this.isProcessing = false;
      }
    }, 250);
    if (typeof this.workerTimer.unref === 'function') {
      this.workerTimer.unref();
    }
  }

  shutdown() {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
    }
  }

  getMetrics() {
    let pendingCount = 0;
    for (const stream of this.inMemoryStreams.values()) {
      pendingCount += stream.filter(j => j.status === 'pending' || j.status === 'processing').length;
    }

    return {
      activeTopics: Array.from(this.inMemoryStreams.keys()),
      activeWorkers: Array.from(this.workers.keys()),
      pendingJobs: pendingCount,
      deadLetterCount: this.deadLetterQueue.length,
      ...this.metrics
    };
  }
}

const queueService = new DistributedQueueService();

queueService.registerWorker('gis.spatial_index_refresh', async (payload) => {
  if (redisModule && typeof redisModule.delCacheByPattern === 'function') {
    await redisModule.delCacheByPattern('spatial_cluster_');
    await redisModule.delCacheByPattern('mvt_tile_');
  }
  if (global.broadcastWS) {
    global.broadcastWS('gis_clusters_updated', { farm_id: payload?.farm_id || null, timestamp: Date.now() });
  }
});

queueService.registerWorker('care_log.batch_synced', async (payload) => {
  if (redisModule && typeof redisModule.delCacheByPattern === 'function') {
    await redisModule.delCacheByPattern('plants_');
    await redisModule.delCacheByPattern('farms_');
  }
  if (global.broadcastWS) {
    global.broadcastWS('offline_batch_synced', {
      user_id: payload?.user_id || null,
      synced_logs: payload?.synced_logs || 0,
      synced_mutations: payload?.synced_mutations || 0,
      timestamp: Date.now()
    });
  }
});

module.exports = queueService;
