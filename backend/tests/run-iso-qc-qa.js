/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ISO/IEC 29119-3 & ISO/IEC 25010 Enterprise QC/QA Master Test Runner
 * ═══════════════════════════════════════════════════════════════════════════════
 * Executes all 21 automated test suites and generates formal audit artifacts:
 *   - backend/tests/reports/ISO_29119_QC_QA_REPORT.md
 *   - backend/tests/reports/ISO_29119_QC_QA_REPORT.json
 */

const fs = require('fs');
const path = require('path');
const { runAllTests } = require('./run-all-tests');

async function generateIsoReport() {
  const startedAt = new Date().toISOString();
  const results = await runAllTests();
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const passRate = ((results.passed / (results.totalTests || 1)) * 100).toFixed(1);
  const statusBadge = results.failed === 0 ? 'PASSED (100% ISO COMPLIANT)' : `FAILED (${results.failed} DEFECTS)`;

  const jsonReport = {
    standard: 'ISO/IEC 29119-3 / ISO/IEC 25010 / ISO/IEC 27001',
    generatedAt: startedAt,
    summary: {
      totalSuites: results.totalSuites,
      totalTests: results.totalTests,
      passed: results.passed,
      failed: results.failed,
      passRate: `${passRate}%`,
      durationMs: results.durationMs,
      verdict: statusBadge
    },
    suites: results.suites
  };

  fs.writeFileSync(
    path.join(reportDir, 'ISO_29119_QC_QA_REPORT.json'),
    JSON.stringify(jsonReport, null, 2),
    'utf8'
  );

  const mdLines = [
    '# BÁO CÁO KIỂM THỬ QC/QA CHUẨN QUỐC TẾ (ISO/IEC 29119-3 & ISO/IEC 25010)',
    '',
    `- **Thời điểm chạy:** \`${startedAt}\``,
    `- **Trạng thái tổng thể:** **${statusBadge}**`,
    `- **Tổng số Suites:** ${results.totalSuites} | **Tổng Test Cases:** ${results.totalTests} | **Passed:** ${results.passed} | **Failed:** ${results.failed} (${passRate}%)`,
    `- **Tổng thời gian thực thi:** ${results.durationMs}ms`,
    '',
    '## Kết quả chi tiết theo từng Suite',
    '',
    '| STT | Test Suite | Passed | Failed | Thời gian | Trạng thái |',
    '| :---: | :--- | :---: | :---: | :---: | :---: |',
    ...results.suites.map((s, idx) => {
      const st = s.failed === 0 ? '✅ PASS' : '❌ FAIL';
      return `| ${idx + 1} | ${s.name} | ${s.passed} | ${s.failed} | ${s.durationMs}ms | ${st} |`;
    }),
    ''
  ];

  fs.writeFileSync(
    path.join(reportDir, 'ISO_29119_QC_QA_REPORT.md'),
    mdLines.join('\n'),
    'utf8'
  );

  console.log(`\n📄 [ISO 29119-3 REPORT] Generated:\n   - ${path.join(reportDir, 'ISO_29119_QC_QA_REPORT.md')}\n   - ${path.join(reportDir, 'ISO_29119_QC_QA_REPORT.json')}\n`);

  if (results.failed > 0) process.exit(1);
  process.exit(0);
}

if (require.main === module) {
  generateIsoReport().catch(err => {
    console.error('ISO QC/QA Runner fatal error:', err);
    process.exit(1);
  });
}
