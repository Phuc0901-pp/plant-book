/* Plant Book AgTech (c) 2026 TBSG AgTech. All Rights Reserved.
   modules/sub-nfc-bridge.js — Web NFC Hardware Read/Write Bridge & Feedback
   ======================================================================== */

export class SubNfcBridge {
  constructor() {
    this.hasNfc = 'NDEFReader' in window;
    this.reader = null;
    this.isScanning = false;
    this.lastScannedUid = null;
  }

  isSupported() {
    return this.hasNfc;
  }

  getLastScannedUid() {
    return this.lastScannedUid;
  }

  /**
   * Play audio chime when write is successful
   */
  playSuccessChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1); // A5
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.2); // D6

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (_) {}
  }

  /**
   * Trigger haptic vibration feedback
   */
  triggerHaptic(type = 'success') {
    if (!('vibrate' in navigator)) return;
    try {
      if (type === 'success') {
        navigator.vibrate([100, 50, 150]);
      } else if (type === 'error') {
        navigator.vibrate([200, 100, 200]);
      } else {
        navigator.vibrate(60);
      }
    } catch (_) {}
  }

  /**
   * Listen continuously for an NFC tag to read its UID
   */
  async scanTag(onReadCallback, onErrorCallback) {
    if (!this.hasNfc) {
      if (onErrorCallback) onErrorCallback(new Error('Trình duyệt không hỗ trợ Web NFC API.'));
      return;
    }

    try {
      if (!this.reader) {
        this.reader = new NDEFReader();
      }
      await this.reader.scan();
      this.isScanning = true;

      this.reader.addEventListener('reading', ({ serialNumber, message }) => {
        let cleanUid = serialNumber ? serialNumber.replace(/:/g, '').toUpperCase() : '';
        this.lastScannedUid = cleanUid;
        this.triggerHaptic('tap');
        if (onReadCallback) onReadCallback({ serialNumber, cleanUid, message });
      });

      this.reader.addEventListener('readingerror', (err) => {
        this.triggerHaptic('error');
        if (onErrorCallback) onErrorCallback(err);
      });
    } catch (err) {
      if (onErrorCallback) onErrorCallback(err);
    }
  }

  /**
   * Scan once with a Promise resolution or timeout
   */
  async scanTagOnce(timeoutMs = 12000) {
    if (!this.hasNfc) {
      throw new Error('Trình duyệt không hỗ trợ Web NFC API.');
    }

    return new Promise(async (resolve, reject) => {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Hết thời gian chờ quét thẻ (Timeout).'));
      }, timeoutMs);

      try {
        const reader = new NDEFReader();
        await reader.scan({ signal: controller.signal });
        reader.addEventListener('reading', ({ serialNumber, message }) => {
          clearTimeout(timer);
          controller.abort();
          let cleanUid = serialNumber ? serialNumber.replace(/:/g, '').toUpperCase() : '';
          this.lastScannedUid = cleanUid;
          this.triggerHaptic('tap');
          resolve({ serialNumber, cleanUid, message });
        }, { once: true });

        reader.addEventListener('readingerror', (err) => {
          clearTimeout(timer);
          controller.abort();
          this.triggerHaptic('error');
          reject(err);
        }, { once: true });
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  /**
   * Write NDEF URI Record directly to physical NFC tag
   */
  async writeTagUrl(publicUrl) {
    if (!this.hasNfc) {
      throw new Error('Trình duyệt không hỗ trợ ghi Web NFC.');
    }

    const writer = new NDEFReader();
    await writer.write({
      records: [
        {
          recordType: 'url',
          data: publicUrl
        }
      ]
    });

    this.triggerHaptic('success');
    this.playSuccessChime();
    return true;
  }
}
