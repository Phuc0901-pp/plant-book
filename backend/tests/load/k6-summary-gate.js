const fs = require('fs');

const DEFAULT_SLA = {
  maxErrorRate: 0.01,
  maxP95Ms: 400,
  maxP99Ms: 800
};

function evaluateK6Summary(summary, sla = DEFAULT_SLA) {
  if (!summary || !summary.metrics) {
    return { passed: false, reasons: ['Missing k6 metrics payload'] };
  }
  const metrics = summary.metrics;
  const failedRate = metrics.http_req_failed && metrics.http_req_failed.values
    ? Number(metrics.http_req_failed.values.rate || 0)
    : 0;
  const durValues = metrics.http_req_duration && metrics.http_req_duration.values
    ? metrics.http_req_duration.values
    : {};
  const p95 = Number(durValues['p(95)'] || 0);
  const p99 = Number(durValues['p(99)'] || 0);

  const reasons = [];
  if (failedRate >= sla.maxErrorRate) {
    reasons.push(`Error rate ${failedRate} >= ${sla.maxErrorRate}`);
  }
  if (p95 >= sla.maxP95Ms) {
    reasons.push(`p95 ${p95}ms >= ${sla.maxP95Ms}ms`);
  }
  if (p99 >= sla.maxP99Ms) {
    reasons.push(`p99 ${p99}ms >= ${sla.maxP99Ms}ms`);
  }

  return {
    passed: reasons.length === 0,
    errorRate: failedRate,
    p95Ms: p95,
    p99Ms: p99,
    reasons
  };
}

if (require.main === module) {
  const summaryPath = process.argv[2];
  if (!summaryPath || !fs.existsSync(summaryPath)) {
    console.error('Usage: node k6-summary-gate.js <summary.json>');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const verdict = evaluateK6Summary(raw);
  console.log(JSON.stringify(verdict, null, 2));
  if (!verdict.passed) process.exit(1);
}

module.exports = {
  DEFAULT_SLA,
  evaluateK6Summary
};
