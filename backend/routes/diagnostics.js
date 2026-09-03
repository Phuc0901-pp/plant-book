const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
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
router.post('/run-tests', authenticateToken, requireAdmin, async (req, res) => {
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

module.exports = router;
