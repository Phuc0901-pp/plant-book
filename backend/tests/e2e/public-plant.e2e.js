/**
 * PlantBook AgTech — Public Plant Profile & Chibi ISO + Labor Modal E2E Suite
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

async function runPublicPlantE2E() {
  const targetUrl = (process.env.E2E_TARGET_URL || 'https://dev-plantbook.onrender.com').replace(/\/+$/, '');
  const plantPath = '/17/109/04%3A51%3AA0%3A5A%3A25%3A20%3A91';
  const executablePath = resolveBrowserExecutable();

  console.log(`\n🌱 [Public Plant E2E] Target: ${targetUrl}${plantPath}`);
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
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
    await assertStep('PUB-E2E-01: Load Public Plant Profile & modular JS without page errors', async () => {
      const resp = await page.goto(`${targetUrl}${plantPath}`, { waitUntil: 'networkidle', timeout: 30000 });
      if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp ? resp.status() : 'null'}`);
      const hasHelpers = await page.evaluate(() => (
        typeof window.openModal === 'function' &&
        typeof window.toggleCustomInput === 'function' &&
        typeof window.ChibiIcons === 'object'
      ));
      if (!hasHelpers) throw new Error('Modular functions (openModal/toggleCustomInput/ChibiIcons) missing on window');
    });

    await assertStep('PUB-E2E-02: Authenticate field session via /api/auth/login & reload profile', async () => {
      const loginRes = await page.evaluate(async (base) => {
        const res = await fetch(`${base}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: '0908904895', password: '123456' })
        });
        const data = await res.json();
        if (!res.ok || !data.token) return { ok: false, status: res.status, error: data.error || data.message };
        localStorage.setItem('pb_token', data.token);
        localStorage.setItem('token', data.token);
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
        return { ok: true };
      }, targetUrl);
      if (!loginRes.ok) throw new Error(`Login failed on live server (${loginRes.status}): ${loginRes.error}`);
      await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForSelector('.care-btn-labor', { timeout: 15000 });
    });

    await assertStep('PUB-E2E-03: Verify 6 Chibi ISO SVG icons, unique SVG IDs & "Thuê nhân công" button', async () => {
      const audit = await page.evaluate(() => {
        const careButtons = document.querySelectorAll('.care-actions-grid svg.chibi-iso-svg').length;
        const laborBtn = document.querySelector('.care-btn-labor');
        const laborText = laborBtn ? laborBtn.textContent.trim() : '';
        const gridText = document.querySelector('.care-actions-grid')?.textContent || '';
        const allIds = [...document.querySelectorAll('svg [id]')].map(el => el.id);
        const dupIds = allIds.filter((id, idx) => allIds.indexOf(id) !== idx);
        return { careButtons, laborText, gridText, dupIds };
      });
      if (audit.careButtons !== 6) throw new Error(`Expected 6 Chibi SVGs in care grid, got ${audit.careButtons}`);
      if (!audit.laborText.includes('Thuê nhân công')) throw new Error(`Unexpected labor button text: ${audit.laborText}`);
      if (audit.gridText.includes('Cắt cành/lá') || audit.gridText.includes('Tỉa hoa/quả')) {
        throw new Error('Old pruning buttons still visible in care-actions-grid');
      }
      if (audit.dupIds.length > 0) throw new Error(`Duplicate SVG element IDs detected: ${audit.dupIds.join(', ')}`);
    });

    await assertStep('PUB-E2E-04: Click ".care-btn-labor" opens #modal-labor & custom input toggle works', async () => {
      await page.click('.care-btn-labor');
      await page.waitForFunction(() => {
        const m = document.getElementById('modal-labor');
        return m && getComputedStyle(m).display === 'flex';
      }, { timeout: 5000 });
      await page.selectOption('#labor-work-select', '__custom__');
      const customVisible = await page.evaluate(() => {
        const el = document.getElementById('labor-work-custom');
        return el && getComputedStyle(el).display !== 'none';
      });
      if (!customVisible) throw new Error('#labor-work-custom did not appear when selecting __custom__');
    });

    await assertStep('PUB-E2E-05: Zero uncaught page errors and zero failed same-origin requests', async () => {
      if (pageErrors.length > 0) throw new Error(`Uncaught page errors: ${pageErrors.join(' | ')}`);
      if (failedRequests.length > 0) throw new Error(`Failed requests: ${failedRequests.join(' | ')}`);
    });
  } finally {
    await browser.close();
  }

  console.log(`\n📊 [PUBLIC PLANT E2E SUMMARY] Passed: ${passed} | Failed: ${failed}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runPublicPlantE2E().catch((err) => {
  console.error('Fatal Public Plant E2E Error:', err);
  process.exit(1);
});
