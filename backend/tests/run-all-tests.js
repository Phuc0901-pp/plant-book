/**
 * ═══════════════════════════════════════════════════════════════
 * Master Test Suite Runner (CLI Entry Point)
 * ═══════════════════════════════════════════════════════════════
 */

require('dotenv').config();
const { run } = require('./test-framework');

// Load all test suites in order
require('./suites/01_auth.test');
require('./suites/02_farms_gis.test');
require('./suites/03_plants_qr.test');
require('./suites/04_supplies.test');
require('./suites/05_vietgap.test');
require('./suites/06_iot_notifications.test');
require('./suites/07_html_integrity.test');
require('./suites/08_durian_ri6_sample_data.test');

async function main() {
  try {
    const results = await run(false);
    if (results.failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test execution failure:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runAllTests: () => run(true) };
