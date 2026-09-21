/* ═══════════════════════════════════════════════════════════════
   Plant Book – Backend
   services/singleflight.js — Request Deduplication Engine (Chống Thundering Herd)
   ═══════════════════════════════════════════════════════════════ */

class SingleflightGroup {
  constructor() {
    this.calls = new Map();
  }

  /**
   * Thực thi function fn() với key định danh.
   * Nếu có nhiều caller gọi cùng 1 key trong lúc fn() đang chạy (in-flight),
   * tất cả caller sẽ dùng chung Promise duy nhất, chỉ chạy fn() đúng 1 lần.
   * 
   * @param {string} key Khóa định danh cho câu truy vấn (ví dụ: 'plants:farm:1:range:1_20')
   * @param {Function} fn Hàm bất đồng bộ thực hiện truy vấn DB
   * @returns {Promise<any>}
   */
  async do(key, fn) {
    if (this.calls.has(key)) {
      // Tái sử dụng Promise đang chạy (In-flight request)
      return this.calls.get(key);
    }

    const promise = (async () => {
      try {
        return await fn();
      } finally {
        // Dọn dẹp key sau khi query hoàn tất
        setImmediate(() => {
          this.calls.delete(key);
        });
      }
    })();

    this.calls.set(key, promise);
    return promise;
  }

  getInflightCount() {
    return this.calls.size;
  }
}

const singleflight = new SingleflightGroup();

module.exports = {
  singleflight,
  SingleflightGroup
};
