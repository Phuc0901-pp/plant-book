const { describe, it, expect } = require('../test-framework');
const fs = require('fs');
const path = require('path');
const { singleflight } = require('../../services/singleflight');
const { invalidateAndBroadcast } = require('../../services/eventBus');
const { calculateSmartReminders } = require('../../services/agriReminder');
const { getCache, setCache } = require('../../config/redis');

describe('Suite 16: Smart Performance, Range Querying, Deduplication & Live Sync', () => {

  it('16.1 Should verify Singleflight request deduplication collapses 50 concurrent queries to 1 DB execution', async () => {
    let dbExecutionCount = 0;
    const testKey = 'test:suite16:singleflight:plants_1_20';
    const concurrentRequests = 50;
    const startTime = Date.now();

    const tasks = Array.from({ length: concurrentRequests }, () => {
      return singleflight.do(testKey, async () => {
        dbExecutionCount++;
        await new Promise(r => setTimeout(r, 5));
        return { success: true, count: 20, chunk: '1-20' };
      });
    });

    const results = await Promise.all(tasks);
    const elapsed = Date.now() - startTime;

    expect(dbExecutionCount).toBe(1);
    expect(results.length).toBe(50);
    expect(results[0].success).toBe(true);
    expect(elapsed < 100).toBe(true);
  });

  it('16.2 Should verify range chunk filtering splits 80 plants accurately (1..20, 21..40, 41..60, 61..80)', () => {
    const mockPlants = Array.from({ length: 80 }, (_, i) => ({
      id: i + 1,
      tree_code: String(i + 1)
    }));

    const filterRange = (plants, min, max) => {
      return plants.filter(p => {
        const num = parseInt(p.tree_code, 10);
        return num >= min && num <= max;
      });
    };

    const c1 = filterRange(mockPlants, 1, 20);
    const c2 = filterRange(mockPlants, 21, 40);
    const c3 = filterRange(mockPlants, 41, 60);
    const c4 = filterRange(mockPlants, 61, 80);

    expect(c1.length).toBe(20);
    expect(c2.length).toBe(20);
    expect(c3.length).toBe(20);
    expect(c4.length).toBe(20);
    expect(c1[0].tree_code).toBe('1');
    expect(c4[19].tree_code).toBe('80');
  });

  it('16.3 Should verify EventBus cache invalidation and WebSocket packet dispatching', async () => {
    await setCache('plants_test_16', [{ id: 1, tree_code: '1' }], 100);
    const before = await getCache('plants_test_16');
    expect(before !== null).toBe(true);

    let wsPacket = null;
    global.broadcastWS = (event, data) => {
      wsPacket = { event, data };
    };

    const ok = await invalidateAndBroadcast('plants_updated', { plant_id: 1, action: 'update' }, ['plants_']);
    expect(ok).toBe(true);

    const after = await getCache('plants_test_16');
    expect(after).toBe(null);
    expect(wsPacket !== null).toBe(true);
    expect(wsPacket.event).toBe('plants_updated');
    expect(wsPacket.data.action).toBe('update');
  });

  it('16.4 Should verify Haversine GPS proximity formula sorts trees by physical distance', () => {
    const userLat = 10.925000;
    const userLng = 107.240000;

    const sampleTrees = [
      { id: 1, tree_code: '1', latitude: 10.925050, longitude: 107.240050 }, // ~7.5m
      { id: 2, tree_code: '2', latitude: 10.926000, longitude: 107.240000 }, // ~111m
      { id: 3, tree_code: '3', latitude: 10.925010, longitude: 107.240010 }, // ~1.5m
    ];

    const haversine = (lat1, lon1, lat2, lon2) => {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return Math.round(R * c * 10) / 10;
    };

    const sorted = sampleTrees.map(t => ({
      ...t,
      dist: haversine(userLat, userLng, t.latitude, t.longitude)
    })).sort((a, b) => a.dist - b.dist);

    expect(sorted[0].tree_code).toBe('3');
    expect(sorted[1].tree_code).toBe('1');
    expect(sorted[2].tree_code).toBe('2');
  });

  it('16.5 Should verify Soft Delete and Restore lifecycle structure in backend routes', () => {
    const plantsRoutePath = path.join(__dirname, '../../routes/plants.js');
    const initPath = path.join(__dirname, '../../db/init.js');

    const plantsRoute = fs.readFileSync(plantsRoutePath, 'utf8');
    const initDb = fs.readFileSync(initPath, 'utf8');

    expect(plantsRoute.includes('deleted_at = NOW()')).toBe(true);
    expect(plantsRoute.includes('/:id/restore')).toBe(true);
    expect(plantsRoute.includes('/nearby-gps')).toBe(true);
    expect(plantsRoute.includes('singleflight.do')).toBe(true);
    expect(initDb.includes('deleted_at TIMESTAMPTZ NULL')).toBe(true);
    expect(initDb.includes('CREATE TABLE IF NOT EXISTS audit_logs')).toBe(true);
  });

  it('16.6 Should verify Smart Agronomic Reminders cycle calculation engine', () => {
    const plants = [{ id: 1, tree_code: '1', plant_type: 'Sầu riêng' }];
    const now = new Date();
    const sixteenDaysAgo = new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000);

    const logs = [
      {
        plant_id: 1,
        log_type: 'Bón phân hữu cơ vi sinh / NPK',
        created_at: sixteenDaysAgo.toISOString()
      }
    ];

    const reminders = calculateSmartReminders(plants, logs);
    expect(reminders.length > 0).toBe(true);
    const fertilizerTask = reminders.find(r => r.taskType.includes('Bón phân'));
    expect(fertilizerTask !== undefined).toBe(true);
    expect(fertilizerTask.isOverdue).toBe(true);
  });

});
