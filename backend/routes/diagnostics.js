const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { runAllTests } = require('../tests/run-all-tests');
const os = require('os');

/**
 * GET /api/diagnostics/health
 * Public system health check endpoint
 */
router.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
    memory: {
      rssMb: (memoryUsage.rss / (1024 * 1024)).toFixed(2),
      heapUsedMb: (memoryUsage.heapUsed / (1024 * 1024)).toFixed(2),
      heapTotalMb: (memoryUsage.heapTotal / (1024 * 1024)).toFixed(2)
    },
    system: {
      freeMemMb: (os.freemem() / (1024 * 1024)).toFixed(2),
      totalMemMb: (os.totalmem() / (1024 * 1024)).toFixed(2),
      cpuCount: os.cpus().length
    }
  });
});

/**
 * POST /api/diagnostics/run-tests
 * Trigger all 7 automated test suites and return structured report
 * Protected: Requires Admin authentication
 */
router.post('/run-tests', auth, admin, async (req, res) => {
  try {
    const results = await runAllTests();
    res.json({
      success: true,
      data: results
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Lỗi thực thi kiểm thử: ' + err.message
    });
  }
});

/**
 * POST /api/diagnostics/seed-durian-lk
 * Initialize sample dataset for Durian Ri6 STT 1 (20 years old) at Long Khanh Farm
 * Protected: Requires Admin authentication
 */
router.post('/seed-durian-lk', auth, admin, async (req, res) => {
  try {
    const { seedDurianRi6LK } = require('../scripts/seed_durian_ri6_lk');
    const result = await seedDurianRi6LK();
    res.json({
      success: true,
      message: 'Đã khởi tạo dữ liệu mẫu Cây Sầu Riêng Ri6 STT 1 (20 năm tuổi) trang trại Long Khánh thành công!',
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Lỗi khởi tạo dữ liệu mẫu: ' + err.message
    });
  }
});

module.exports = router;
