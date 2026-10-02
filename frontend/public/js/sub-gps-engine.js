/* Plant Book AgTech (c) 2026 TBSG AgTech. All Rights Reserved.
   modules/sub-gps-engine.js — Sub-1-Meter High-Precision GPS Engine
   ================================================================== */

export class SubGpsEngine {
  constructor(options = {}) {
    this.targetAccuracy = options.targetAccuracy || 1.0; // Target < +-1.0m
    this.maxSamples = options.maxSamples || 10;
    this.samples = [];
    this.watchId = null;
    this.active = false;
    this.locked = false;
    this.lockedCoord = null;
    this.onUpdateCallback = options.onUpdate || (() => {});
    this.onLockCallback = options.onLock || (() => {});
  }

  /**
   * Start listening for high precision GPS positions
   */
  start() {
    if (!('geolocation' in navigator)) {
      this.onUpdateCallback({
        error: 'Thiết bị không hỗ trợ định vị GPS (Geolocation API).'
      });
      return;
    }

    this.samples = [];
    this.locked = false;
    this.lockedCoord = null;
    this.active = true;

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    };

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._handlePosition(pos),
      (err) => this._handleError(err),
      geoOptions
    );
  }

  /**
   * Process incoming position sample and compute Kalman/Weighted Average
   */
  _handlePosition(pos) {
    if (!this.active || this.locked) return;

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const rawAcc = pos.coords.accuracy || 10;

    // Add to buffer
    this.samples.push({
      latitude: lat,
      longitude: lng,
      accuracy: rawAcc,
      timestamp: pos.timestamp
    });

    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    // Compute weighted average
    const computed = this._computeOptimalCoordinate();

    // Determine status rating
    let quality = 'poor'; // Red > 3m
    if (computed.accuracy <= this.targetAccuracy) {
      quality = 'excellent'; // Green <= 1.0m
    } else if (computed.accuracy <= 3.0) {
      quality = 'good'; // Yellow 1.0m - 3.0m
    }

    const payload = {
      latitude: computed.latitude,
      longitude: computed.longitude,
      accuracy: computed.accuracy,
      sampleCount: this.samples.length,
      quality,
      isOptimal: computed.accuracy <= this.targetAccuracy
    };

    this.onUpdateCallback(payload);

    // Auto-lock if accuracy is <= 1.0m and we have at least 3 samples
    if (computed.accuracy <= this.targetAccuracy && this.samples.length >= 3) {
      // Allow user manual confirmation or auto-recommend
    }
  }

  _computeOptimalCoordinate() {
    if (this.samples.length === 0) {
      return { latitude: 0, longitude: 0, accuracy: 999 };
    }

    if (this.samples.length === 1) {
      return {
        latitude: this.samples[0].latitude,
        longitude: this.samples[0].longitude,
        accuracy: Math.round(this.samples[0].accuracy * 10) / 10
      };
    }

    // Inverse-variance weighted average: w_i = 1 / (acc_i ^ 2)
    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLng = 0;
    let minAcc = Infinity;

    for (const s of this.samples) {
      const w = 1 / Math.max(0.01, Math.pow(s.accuracy, 2));
      totalWeight += w;
      weightedLat += s.latitude * w;
      weightedLng += s.longitude * w;
      if (s.accuracy < minAcc) minAcc = s.accuracy;
    }

    const optimalLat = weightedLat / totalWeight;
    const optimalLng = weightedLng / totalWeight;

    // Improved composite accuracy estimation
    const compositeAcc = Math.min(minAcc, Math.sqrt(1 / totalWeight));
    const finalAcc = Math.round(compositeAcc * 10) / 10;

    return {
      latitude: optimalLat,
      longitude: optimalLng,
      accuracy: finalAcc
    };
  }

  _handleError(err) {
    let msg = 'Không thể lấy tín hiệu GPS.';
    if (err.code === 1) msg = 'Người dùng đã từ chối quyền truy cập vị trí GPS.';
    else if (err.code === 2) msg = 'Không tìm thấy vệ tinh GPS. Vui lòng ra nơi thoáng đãng.';
    else if (err.code === 3) msg = 'Hết thời gian chờ định vị GPS.';

    this.onUpdateCallback({ error: msg, code: err.code });
  }

  /**
   * Lock current optimal coordinate
   */
  lock() {
    const computed = this._computeOptimalCoordinate();
    this.locked = true;
    this.lockedCoord = {
      latitude: computed.latitude,
      longitude: computed.longitude,
      accuracy: computed.accuracy
    };
    this.stop();
    this.onLockCallback(this.lockedCoord);
    return this.lockedCoord;
  }

  /**
   * Stop watching
   */
  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.active = false;
  }
}
