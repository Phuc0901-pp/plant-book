const crypto = require('crypto');

const MAX_LATENCY_SAMPLES = 5000;
const SLOW_REQUEST_THRESHOLD_MS = parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS, 10) || 500;

const metricsState = {
  startedAtMs: Date.now(),
  requestsTotal: 0,
  clientErrorsTotal: 0,
  errorsTotal: 0,
  slowRequestsTotal: 0,
  latenciesMs: [],
  byRoute: new Map()
};

function normalizeRoutePath(rawUrl) {
  const pathOnly = String(rawUrl || '/').split('?')[0];
  return pathOnly
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
    .replace(/\/usr-\d+/gi, '/usr-:id')
    .replace(/\/adm-\d+/gi, '/adm-:id')
    .replace(/\/\d+/g, '/:id');
}

function recordHttpMetric(method, rawUrl, statusCode, durationMs) {
  metricsState.requestsTotal++;
  if (statusCode >= 500) metricsState.errorsTotal++;
  else if (statusCode >= 400) metricsState.clientErrorsTotal++;
  if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) metricsState.slowRequestsTotal++;

  if (metricsState.latenciesMs.length >= MAX_LATENCY_SAMPLES) {
    metricsState.latenciesMs.shift();
  }
  metricsState.latenciesMs.push(durationMs);

  const routeKey = `${String(method || 'GET').toUpperCase()} ${normalizeRoutePath(rawUrl)}`;
  if (!metricsState.byRoute.has(routeKey)) {
    if (metricsState.byRoute.size >= 500) {
      const oldest = metricsState.byRoute.keys().next().value;
      if (oldest !== undefined) metricsState.byRoute.delete(oldest);
    }
    metricsState.byRoute.set(routeKey, { count: 0, errors: 0, sumMs: 0, maxMs: 0 });
  }
  const bucket = metricsState.byRoute.get(routeKey);
  bucket.count++;
  if (statusCode >= 500) bucket.errors++;
  bucket.sumMs += durationMs;
  if (durationMs > bucket.maxMs) bucket.maxMs = durationMs;
}

function apmRequestMiddleware(req, res, next) {
  const startNs = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1e6;
    const roundedMs = Number(elapsedMs.toFixed(2));
    const url = req.originalUrl || req.url || '/';
    recordHttpMetric(req.method, url, res.statusCode || 200, roundedMs);
    if (roundedMs >= SLOW_REQUEST_THRESHOLD_MS) {
      console.warn(`[APM SLOW_REQUEST_WARN] ${req.method} ${normalizeRoutePath(url)} -> ${res.statusCode} in ${roundedMs}ms`);
    }
  });
  next();
}

function computePercentile(sortedArr, p) {
  if (!sortedArr || sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.max(0, Math.ceil((p / 100) * sortedArr.length) - 1));
  return Number(sortedArr[idx].toFixed(2));
}

function getApmSummary(pool, wss) {
  const sorted = [...metricsState.latenciesMs].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avg = sorted.length > 0 ? Number((sum / sorted.length).toFixed(2)) : 0;

  const mem = process.memoryUsage();
  const topRoutes = Array.from(metricsState.byRoute.entries())
    .map(([route, s]) => ({
      route,
      count: s.count,
      errors: s.errors,
      avg_ms: s.count > 0 ? Number((s.sumMs / s.count).toFixed(2)) : 0,
      max_ms: Number(s.maxMs.toFixed(2))
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);

  const errorRate = metricsState.requestsTotal > 0
    ? Number(((metricsState.errorsTotal / metricsState.requestsTotal) * 100).toFixed(2))
    : 0;

  return {
    status: 'ok',
    uptime_seconds: Math.round((Date.now() - metricsState.startedAtMs) / 1000),
    requests_total: metricsState.requestsTotal,
    client_errors_total: metricsState.clientErrorsTotal,
    errors_total: metricsState.errorsTotal,
    slow_requests_total: metricsState.slowRequestsTotal,
    error_rate_pct: errorRate,
    latency_ms: {
      p50: computePercentile(sorted, 50),
      p95: computePercentile(sorted, 95),
      p99: computePercentile(sorted, 99),
      avg
    },
    db_pool: {
      total: pool && typeof pool.totalCount === 'number' ? pool.totalCount : 0,
      idle: pool && typeof pool.idleCount === 'number' ? pool.idleCount : 0,
      waiting: pool && typeof pool.waitingCount === 'number' ? pool.waitingCount : 0
    },
    websocket_clients: wss && wss.clients ? wss.clients.size : 0,
    memory_mb: {
      rss: Number((mem.rss / (1024 * 1024)).toFixed(2)),
      heapUsed: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
      heapTotal: Number((mem.heapTotal / (1024 * 1024)).toFixed(2))
    },
    top_routes: topRoutes
  };
}

function renderPrometheusMetrics(pool, wss) {
  const s = getApmSummary(pool, wss);
  const mem = process.memoryUsage();
  const lines = [
    '# HELP plantbook_http_requests_total Total HTTP requests handled',
    '# TYPE plantbook_http_requests_total counter',
    `plantbook_http_requests_total ${s.requests_total}`,
    '# HELP plantbook_http_errors_total Total HTTP 5xx responses',
    '# TYPE plantbook_http_errors_total counter',
    `plantbook_http_errors_total ${s.errors_total}`,
    '# HELP plantbook_http_slow_requests_total Total slow HTTP requests',
    '# TYPE plantbook_http_slow_requests_total counter',
    `plantbook_http_slow_requests_total ${s.slow_requests_total}`,
    '# HELP plantbook_http_request_duration_ms HTTP latency percentiles in ms',
    '# TYPE plantbook_http_request_duration_ms summary',
    `plantbook_http_request_duration_ms{quantile="0.5"} ${s.latency_ms.p50}`,
    `plantbook_http_request_duration_ms{quantile="0.95"} ${s.latency_ms.p95}`,
    `plantbook_http_request_duration_ms{quantile="0.99"} ${s.latency_ms.p99}`,
    '# HELP plantbook_db_pool_connections PostgreSQL pool connection counts',
    '# TYPE plantbook_db_pool_connections gauge',
    `plantbook_db_pool_connections{state="total"} ${s.db_pool.total}`,
    `plantbook_db_pool_connections{state="idle"} ${s.db_pool.idle}`,
    `plantbook_db_pool_connections{state="waiting"} ${s.db_pool.waiting}`,
    '# HELP plantbook_ws_active_clients Connected WebSocket clients',
    '# TYPE plantbook_ws_active_clients gauge',
    `plantbook_ws_active_clients ${s.websocket_clients}`,
    '# HELP plantbook_process_heap_bytes Node.js heap used bytes',
    '# TYPE plantbook_process_heap_bytes gauge',
    `plantbook_process_heap_bytes ${mem.heapUsed}`
  ];
  return lines.join('\n') + '\n';
}

function metricsAuthGuard(authMiddleware, adminMiddleware) {
  return (req, res, next) => {
    const expected = process.env.APM_METRICS_TOKEN ? String(process.env.APM_METRICS_TOKEN) : '';
    const authHeader = String(req.headers.authorization || '');
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (expected && bearer) {
      const a = Buffer.from(bearer);
      const b = Buffer.from(expected);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return next();
      }
    }
    return authMiddleware(req, res, (err) => {
      if (err) return next(err);
      return adminMiddleware(req, res, next);
    });
  };
}

function resetApmMetricsForTest() {
  metricsState.requestsTotal = 0;
  metricsState.clientErrorsTotal = 0;
  metricsState.errorsTotal = 0;
  metricsState.slowRequestsTotal = 0;
  metricsState.latenciesMs = [];
  metricsState.byRoute.clear();
}

module.exports = {
  normalizeRoutePath,
  recordHttpMetric,
  apmRequestMiddleware,
  computePercentile,
  getApmSummary,
  renderPrometheusMetrics,
  metricsAuthGuard,
  resetApmMetricsForTest
};
