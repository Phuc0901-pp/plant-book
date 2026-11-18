export class SubGpsEngine {
  constructor(options = {}) {
    this.targetAccuracy = options.targetAccuracy || 2.0;
    this.maxSamples = options.maxSamples || 12;
    this.samples = [];
    this.watchId = null;
    this.active = false;
    this.locked = false;
    this.lockedCoord = null;
    this.smoothedLat = null;
    this.smoothedLng = null;
    this.onUpdateCallback = options.onUpdate || (() => {});
    this.onLockCallback = options.onLock || (() => {});
  }

  start() {
    if (!('geolocation' in navigator)) {
      this.onUpdateCallback({
        error: 'Thiết bị không hỗ trợ định vị GPS.'
      });
      return;
    }

    this.samples = [];
    this.locked = false;
    this.lockedCoord = null;
    this.smoothedLat = null;
    this.smoothedLng = null;
    this.active = true;

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 25000,
      maximumAge: 0
    };

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._handlePosition(pos),
      (err) => this._handleError(err),
      geoOptions
    );
  }

  _handlePosition(pos) {
    if (!this.active || this.locked) return;

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const rawAcc = pos.coords.accuracy || 20;

    if (this.smoothedLat !== null && rawAcc > 100) {
    }

    this.samples.push({
      latitude: lat,
      longitude: lng,
      accuracy: rawAcc,
      timestamp: pos.timestamp
    });

    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    const computed = this._computeOptimalCoordinate();

    let quality = 'poor';
    let statusText = '';

    if (computed.accuracy <= 2.0) {
      quality = 'excellent';
      statusText = 'Tín hiệu vệ tinh xuất sắc (< ±2m)';
    } else if (computed.accuracy <= 10.0) {
      quality = 'good';
      statusText = 'Đang tinh chỉnh vệ tinh (Khá tốt)';
    } else if (computed.accuracy <= 30.0) {
      quality = 'warning';
      statusText = 'Đang hội tụ vệ tinh. Giữ yên máy...';
    } else {
      quality = 'poor';
      statusText = 'Định vị Wifi/IP trong nhà. Ra ngoài trời để đạt ±1m!';
    }

    const payload = {
      latitude: computed.latitude,
      longitude: computed.longitude,
      accuracy: computed.accuracy,
      sampleCount: this.samples.length,
      quality,
      statusText,
      isOptimal: computed.accuracy <= this.targetAccuracy
    };

    this.onUpdateCallback(payload);
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

    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLng = 0;
    let minAcc = Infinity;

    for (const s of this.samples) {
      const w = 1 / Math.max(0.1, Math.pow(s.accuracy, 2));
      totalWeight += w;
      weightedLat += s.latitude * w;
      weightedLng += s.longitude * w;
      if (s.accuracy < minAcc) minAcc = s.accuracy;
    }

    const optimalLat = weightedLat / totalWeight;
    const optimalLng = weightedLng / totalWeight;

    if (this.smoothedLat === null) {
      this.smoothedLat = optimalLat;
      this.smoothedLng = optimalLng;
    } else {
      const alpha = 0.65;
      this.smoothedLat = this.smoothedLat * (1 - alpha) + optimalLat * alpha;
      this.smoothedLng = this.smoothedLng * (1 - alpha) + optimalLng * alpha;
    }

    const compositeAcc = Math.min(minAcc, Math.sqrt(1 / totalWeight));
    const finalAcc = Math.round(compositeAcc * 10) / 10;

    return {
      latitude: this.smoothedLat,
      longitude: this.smoothedLng,
      accuracy: finalAcc
    };
  }

  _handleError(err) {
    let msg = 'Không thể lấy tín hiệu GPS.';
    if (err.code === 1) msg = 'Quyền GPS bị từ chối. Hãy cho phép vị trí trong Cài đặt trình duyệt.';
    else if (err.code === 2) msg = 'Không tìm thấy vệ tinh GPS. Vui lòng ra nơi thoáng.';
    else if (err.code === 3) msg = 'Hết thời gian chờ định vị GPS.';

    this.onUpdateCallback({ error: msg, code: err.code });
  }

  setManualCoord(lat, lng) {
    this.locked = true;
    this.lockedCoord = {
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      accuracy: 1.0,
      isManual: true
    };
    this.stop();
    this.onLockCallback(this.lockedCoord);
    return this.lockedCoord;
  }

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

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.active = false;
  }
}
