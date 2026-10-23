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
require('./suites/09_phase1_phase2_verification.test');
require('./suites/10_meteo_weather_service.test');
require('./suites/11_nfc_gps_lifecycle.test');
require('./suites/12_nfc_security_geofence.test');
require('./suites/12_soft_delete_and_audit.test');
require('./suites/13_ai_training_security.test');
require('./suites/13_zalo_and_data_scrubbing.test');
require('./suites/14_data_streaming_and_ingestion.test');
require('./suites/15_rate_limit_and_anti_freeze.test');
require('./suites/16_smart_performance_and_sync.test');
require('./suites/17_v135_hashchain_offline_migration.test');
require('./suites/18_flutter_mobile_v135_security_sync.test');

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
