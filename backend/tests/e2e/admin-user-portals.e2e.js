/**
 * PlantBook AgTech — Admin (/) & Farmer (/user/) Portals Live E2E Suite
 */

const { chromium } = require('playwright-core');
const fs = require('fs');

function resolveBrowserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

async function runPortalsE2E() {
  const targetUrl = (process.env.E2E_TARGET_URL || 'https://dev-plantbook.onrender.com').replace(/\/+$/, '');
  const executablePath = resolveBrowserExecutable();

  console.log(`\n🏢 [Portals E2E] Target: ${targetUrl}`);
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  const pageErrors = [];
  const failedRequests = [];

  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('requestfailed', (req) => {
    const errText = req.failure()?.errorText || '';
    if (req.url().startsWith(targetUrl) && !errText.includes('ERR_ABORTED')) {
      failedRequests.push(`${req.method()} ${req.url()} => ${errText}`);
    }
  });

  let passed = 0;
  let failed = 0;

  async function assertStep(name, fn) {
    const start = Date.now();
    try {
      await fn();
      passed++;
      console.log(`  ✅ PASS (${Date.now() - start}ms): ${name}`);
    } catch (err) {
      failed++;
      console.error(`  ❌ FAIL (${Date.now() - start}ms): ${name}\n     ↳ ${err.message}`);
    }
  }

  try {
    await assertStep('PORTAL-E2E-01: Farmer Portal (/user/) loads modular ES assets & authenticates cleanly', async () => {
      const resp = await page.goto(`${targetUrl}/user/`, { waitUntil: 'networkidle', timeout: 30000 });
      if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp ? resp.status() : 'null'}`);
      const loginRes = await page.evaluate(async (base) => {
        const res = await fetch(`${base}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: '0908904895', password: '123456' })
        });
        const data = await res.json();
        if (!res.ok || !data.token) return { ok: false, status: res.status };
        localStorage.setItem('pb_token', data.token);
        localStorage.setItem('token', data.token);
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
        return { ok: true };
      }, targetUrl);
      if (!loginRes.ok) throw new Error(`Login failed (${loginRes.status})`);
      await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
      const hasFarmerBindings = await page.evaluate(() => (
        typeof window.openPlantProfileModal === 'function' &&
        typeof window.renderIoTDemoData === 'function'
      ));
      if (!hasFarmerBindings) throw new Error('Modular Farmer ES exports missing on window');
    });

    await assertStep('PORTAL-E2E-02: Admin Portal (/) loads modular GIS scripts (gis, gis-gps-tools, gis-export)', async () => {
      const resp = await page.goto(`${targetUrl}/`, { waitUntil: 'networkidle', timeout: 30000 });
      if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp ? resp.status() : 'null'}`);
      const hasGisBindings = await page.evaluate(() => (
        typeof window.removeContourLinesFromMap === 'function' &&
        typeof window.pingGpsLocationOnMap === 'function' &&
        typeof window.openLiveApiGuidelineModal === 'function'
      ));
      if (!hasGisBindings) throw new Error('Modular Admin GIS global bindings missing');
    });

    await assertStep('PORTAL-E2E-03: Zero uncaught page errors and zero failed same-origin requests across portals', async () => {
      if (pageErrors.length > 0) throw new Error(`Uncaught page errors: ${pageErrors.join(' | ')}`);
      if (failedRequests.length > 0) throw new Error(`Failed requests: ${failedRequests.join(' | ')}`);
    });
  } finally {
    await browser.close();
  }

  console.log(`\n📊 [PORTALS E2E SUMMARY] Passed: ${passed} | Failed: ${failed}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runPortalsE2E().catch((err) => {
  console.error('Fatal Portals E2E Error:', err);
  process.exit(1);
});
