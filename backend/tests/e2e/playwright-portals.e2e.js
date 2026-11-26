const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const BASE_URL = (process.env.E2E_BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');

async function resolveBrowserExecutable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  const candidates = [
    process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

async function run() {
  const execPath = await resolveBrowserExecutable();
  const browser = await chromium.launch({
    ...(execPath ? { executablePath: execPath } : {}),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const pageErrors = [];
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', err => pageErrors.push(err.message));

  try {
    await page.goto(`${BASE_URL}/user/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#login-page, #app', { timeout: 15000 });

    const uniq = `${Date.now()}`;
    const email = `pw_e2e_${uniq}@tanbao.vn`;
    const password = 'PlaywrightIso@2026';

    const regRes = await page.evaluate(async ({ emailVal, passVal, u }) => {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: 'Playwright Farmer', email: emailVal, password: passVal, phone: `09${u.slice(-8)}` })
      });
      return { status: r.status, body: await r.json() };
    }, { emailVal: email, passVal: password, u: uniq });
    assert.ok([200, 201].includes(regRes.status));

    const loginRes = await page.evaluate(async ({ emailVal, passVal }) => {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: emailVal, password: passVal })
      });
      const d = await r.json();
      if (d.token) {
        localStorage.setItem('pb_token', d.token);
        localStorage.setItem('pb_user', JSON.stringify(d.user));
      }
      return { status: r.status, token: Boolean(d.token) };
    }, { emailVal: email, passVal: password });
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.token, true);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#page-home.active, #app', { timeout: 15000 });

    await page.evaluate(() => {
      if (typeof window.showPage === 'function') window.showPage('logs');
    });
    await page.waitForTimeout(300);
    const logsActive = await page.evaluate(() => {
      const el = document.getElementById('page-logs');
      return Boolean(el && el.classList.contains('active'));
    });
    assert.strictEqual(logsActive, true, 'User logs page failed to activate');

    await page.evaluate(() => {
      if (typeof window.openUserExportLogsModal === 'function') window.openUserExportLogsModal('csv');
    });
    await page.waitForSelector('#user-export-logs-modal', { state: 'visible', timeout: 8000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const modalHiddenAfterEsc = await page.evaluate(() => {
      const m = document.getElementById('user-export-logs-modal');
      return !m || m.style.display === 'none';
    });
    assert.strictEqual(modalHiddenAfterEsc, true, 'Escape key did not close #user-export-logs-modal');

    await page.goto(`${BASE_URL}/admin/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const adminTitle = await page.title();
    assert.ok(adminTitle.length > 0, 'Admin portal failed to load');

    await page.goto(`${BASE_URL}/report.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    assert.strictEqual(pageErrors.length, 0, `Uncaught browser errors: ${pageErrors.join(' | ')}`);
    console.log(JSON.stringify({ success: true, e2e: 'playwright-portals', pageErrors: 0 }));
  } catch (err) {
    const outDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    await page.screenshot({ path: path.join(outDir, 'playwright-e2e-failure.png'), fullPage: true }).catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('Playwright E2E failed:', err);
  process.exit(1);
});
