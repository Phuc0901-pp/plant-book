class SingleflightGroup {
  constructor() {
    this.calls = new Map();
  }

  async do(key, fn) {
    if (this.calls.has(key)) {
      return this.calls.get(key);
    }

    const promise = (async () => {
      try {
        return await fn();
      } finally {
        this.calls.delete(key);
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
