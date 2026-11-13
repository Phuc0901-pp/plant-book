/**
 * PlantBook AgTech — Real Browser E2E Verification Suite (Playwright Core)
 * Tests actual DOM interactions, CORS headers, form submissions & step transitions
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

async function runE2E() {
  const targetUrl = (process.env.E2E_TARGET_URL || 'https://dev-plantbook.onrender.com').replace(/\/+$/, '');
  const executablePath = resolveBrowserExecutable();

  console.log(`\n🌐 [E2E Browser QA] Target: ${targetUrl}`);
  console.log(`🧭 [E2E Browser QA] Browser: ${executablePath || 'Default Playwright Chromium'}`);

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

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  page.on('requestfailed', (req) => {
    const errText = req.failure()?.errorText || '';
    // Ignore navigation aborts when moving between pages quickly, fail on real API/CORS/5xx errors
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
      console.log(`  ✅ PASS (${Date.now() - start}ms): ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL (${Date.now() - start}ms): ${name}`);
      console.error(`     Reason: ${err.message}`);
      failed++;
    }
  }

  try {
    // Test 1: Load /sub portal
    await assertStep('E2E-01: Load /sub portal without fatal page errors', async () => {
      const res = await page.goto(`${targetUrl}/sub`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (!res || res.status() !== 200) throw new Error(`Expected HTTP 200, got ${res ? res.status() : 'null'}`);
      await page.waitForSelector('#btn-opt-existing', { state: 'visible', timeout: 10000 });
    });

    // Test 2: Click "ĐÃ CÓ TÀI KHOẢN" card
    await assertStep('E2E-02: Click "ĐÃ CÓ TÀI KHOẢN" navigates cleanly to Login View', async () => {
      await page.click('#btn-opt-existing');
      await page.waitForSelector('#view-login.active', { state: 'visible', timeout: 5000 });
    });

    // Test 3: Login submission with real credentials (0908904895 / 123456)
    await assertStep('E2E-03: Submit login form -> No "?" reload, No CORS error, advance to Step 2 (view-farm-hub)', async () => {
      await page.fill('#login-email', '0908904895');
      await page.fill('#login-password', '123456');

      await page.click('#btn-submit-login');

      // Wait for Step 2 (#view-farm-hub.active)
      await page.waitForSelector('#view-farm-hub.active', { state: 'visible', timeout: 15000 });

      const currentUrl = page.url();
      if (currentUrl.includes('?')) {
        throw new Error(`Native form reload detected! URL contains "?": ${currentUrl}`);
      }

      // Check error alert is NOT visible
      const alertVisible = await page.isVisible('#login-feedback-alert');
      if (alertVisible) {
        const alertText = await page.textContent('#login-feedback-alert');
        if (alertText && alertText.includes('❌')) {
          throw new Error(`Login error box shown: ${alertText}`);
        }
      }

      // Verify farms dropdown loaded
      await page.waitForFunction(() => {
        const sel = document.getElementById('select-farm-hub');
        return sel && sel.options && sel.options.length > 0 && sel.options[0].value !== '';
      }, null, { timeout: 10000 });
    });

    // Test 4: Navigate Step 2 -> Step 3 (Tạo Cây)
    await assertStep('E2E-04: Step 2 -> Step 3 ("Tạo Cây Mới") transition works cleanly', async () => {
      await page.click('#btn-action-new-plant');
      await page.waitForSelector('#view-plant-form.active', { state: 'visible', timeout: 5000 });
    });

    // Test 5: Check Admin & Farmer portals load cleanly
    await assertStep('E2E-05: Admin Portal (/) & Farmer Portal (/user/) return HTTP 200 without JS errors', async () => {
      const rAdmin = await page.goto(`${targetUrl}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      if (!rAdmin || rAdmin.status() !== 200) throw new Error(`Admin / returned ${rAdmin?.status()}`);
      const rUser = await page.goto(`${targetUrl}/user/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      if (!rUser || rUser.status() !== 200) throw new Error(`Farmer /user/ returned ${rUser?.status()}`);
    });

    // Test 6: Verify 0 fatal pageerrors & 0 failed API requests
    await assertStep('E2E-06: Zero uncaught page errors and zero failed same-origin requests', async () => {
      if (pageErrors.length > 0) {
        throw new Error(`Uncaught JS pageErrors: ${pageErrors.join(' | ')}`);
      }
      if (failedRequests.length > 0) {
        throw new Error(`Failed network requests: ${failedRequests.join(' | ')}`);
      }
    });

  } finally {
    await browser.close();
  }

  console.log(`\n📊 [E2E SUMMARY] Passed: ${passed} | Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runE2E().catch((err) => {
  console.error('❌ [E2E Fatal]', err);
  process.exit(1);
});
