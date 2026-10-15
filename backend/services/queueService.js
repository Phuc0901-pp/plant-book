/* ═══════════════════════════════════════════════════════════════
   Plant Book – Backend Enterprise Architecture
   services/queueService.js — High-Reliability Distributed Event Stream & Message Queue
   Supports: Redis Streams (XADD/XREADGROUP) + Redis Pub/Sub + In-Memory Resilient Fallback
   ═══════════════════════════════════════════════════════════════ */

const { EventEmitter } = require('events');
let redisModule = null;
try {
  redisModule = require('../config/redis');
} catch (_) {}

class DistributedQueueService extends EventEmitter {
  constructor() {
    super();
    this.inMemoryStreams = new Map(); // topic -> Array of { id, payload, timestamp, status, retries }
    this.workers = new Map();          // topic -> Array of async handlers
    this.deadLetterQueue = [];         // Array of failed jobs after max retries
    this.isProcessing = false;
    this.metrics = {
      published: 0,
      processed: 0,
      failed: 0,
      deadLetter: 0
    };

    // Auto-start async processor loop for in-memory queue
    this.startWorkerLoop();
  }

  /**
   * Phát sự kiện vào hàng đợi phân tán
   * @param {string} topic - Tên stream/hàng đợi (ví dụ: 'plants.updated', 'care_log.created')
   * @param {object} payload - Dữ liệu sự kiện
   * @param {object} options - Cấu hình { maxRetries: 3, delayMs: 0 }
   * @returns {Promise<string>} ID của bản ghi sự kiện
   */
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

    // 1. Thử gửi qua Redis Streams nếu có TCP connection
    let publishedToRedis = false;
    try {
      const client = redisModule ? redisModule.redisClient : null;
      if (client && client.status === 'ready' && typeof client.xadd === 'function') {
        const streamKey = `pb:stream:${topic}`;
        await client.xadd(streamKey, '*', 'payload', JSON.stringify(payload), 'timestamp', String(eventRecord.timestamp));
        publishedToRedis = true;
      }
    } catch (redisErr) {
      console.warn(`[QueueService] Redis Stream fallback to in-memory:`, redisErr.message);
    }

    // 2. Lưu vào in-memory stream buffer để xử lý an toàn
    if (!this.inMemoryStreams.has(topic)) {
      this.inMemoryStreams.set(topic, []);
    }
    const stream = this.inMemoryStreams.get(topic);
    stream.push(eventRecord);

    // Giới hạn kích thước bộ đệm (giữ 2.000 sự kiện gần nhất để tránh tràn RAM)
    if (stream.length > 2000) {
      stream.splice(0, stream.length - 2000);
    }

    this.emit('message_enqueued', { topic, id: msgId });
    return msgId;
  }

  /**
   * Đăng ký worker xử lý cho một chủ đề cụ thể
   * @param {string} topic - Tên chủ đề
   * @param {Function} handler - Hàm async xử lý (job) => Promise<void>
   */
  registerWorker(topic, handler) {
    if (!this.workers.has(topic)) {
      this.workers.set(topic, []);
    }
    this.workers.get(topic).push(handler);
    console.log(`👷 [QueueWorker] Registered worker for topic: '${topic}'`);
  }

  /**
   * Vòng lặp tiêu thụ sự kiện liên tục không khóa luồng (Non-blocking worker loop)
   */
  startWorkerLoop() {
    setInterval(async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;

      try {
        for (const [topic, stream] of this.inMemoryStreams.entries()) {
          const handlers = this.workers.get(topic) || [];
          if (handlers.length === 0) continue;

          // Lấy danh sách tác vụ đang pending
          const pendingJobs = stream.filter(job => job.status === 'pending');
          for (const job of pendingJobs) {
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
                  // Giới hạn DLQ 500 bản ghi
                  if (this.deadLetterQueue.length > 500) this.deadLetterQueue.shift();
                } else {
                  job.status = 'pending'; // Thử lại ở lần duyệt kế tiếp
                }
              }
            }
          }

          // Dọn dẹp các job đã completed sau 60 giây
          const now = Date.now();
          const filtered = stream.filter(j => !(j.status === 'completed' && now - j.timestamp > 60000));
          this.inMemoryStreams.set(topic, filtered);
        }
      } catch (loopErr) {
        console.error('[QueueWorker Fatal Loop Error]:', loopErr);
      } finally {
        this.isProcessing = false;
      }
    }, 250); // Duyệt hàng đợi mỗi 250ms
  }

  /**
   * Truy xuất trạng thái và số liệu thống kê của Message Queue
   */
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

// Khởi tạo Singleton
const queueService = new DistributedQueueService();

module.exports = queueService;
