// Smoke the actual published HTML/JS/CSS, with synthetic identities and ALL APIs mocked.
// No real account is used and no staging/production data is read or changed.
// Usage: node tools/test_admin_release_shell.cjs http://45.138.202.132:8088
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.argv[2] || 'http://45.138.202.132:8088';

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const bundles = new Set();
  try {
    const admin = { id: 70001, name: 'Verifica amministratore', email: 'admin-fixture@example.test', role: 'admin', plan: 'agency', slug: 'admin-fixture' };
    const customer = { id: 70002, name: 'Verifica cliente', email: 'customer-fixture@example.test', role: 'user', plan: 'professional', slug: 'customer-fixture' };
    for (const scenario of [
      { user: admin, cached: { ...admin, role: 'user', plan: 'base' }, viewport: { width: 1440, height: 1000 }, label: 'admin-desktop' },
      { user: { ...admin, plan: 'base' }, cached: { ...admin, plan: 'base' }, viewport: { width: 390, height: 844 }, label: 'admin-mobile' },
      { user: customer, cached: customer, viewport: { width: 1440, height: 1000 }, label: 'customer-desktop' },
    ]) {
      const context = await browser.newContext({ viewport: scenario.viewport, ignoreHTTPSErrors: true });
      await context.addInitScript(user => {
        localStorage.setItem('sts_token', 'release-fixture-token');
        localStorage.setItem('sts_user', JSON.stringify(user));
      }, scenario.cached);
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      const actions = [], errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => {
        if (/\/assets\/[^/?]+\.js(?:\?|$)/.test(response.url()) && response.status() === 200) bundles.add(response.url());
      });
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        const action = url.pathname.endsWith('current_plan.php') ? 'current_plan' : url.searchParams.get('action');
        actions.push(action);
        let data = {};
        if (action === 'me' || action === 'current_plan') data = { user: scenario.user };
        if (action === 'site') data = { site: { title: 'Cliente di verifica', profile_summary: 'Solo dati sintetici' }, sources: [], posts: [], visibility: {} };
        if (action === 'admin-prompts') data = { prompts: [] };
        if (action === 'admin-monitoring') data = { totals: { users: 3, published_posts: 12, queued_posts: 0 }, provider_settings: [], agents: [], diagnostics: [], usage_this_month: {}, cron_logs: [] };
        if (action === 'admin-settings') data = { settings: { cron_interval_sync: '6', cron_interval_seo: '24' } };
        if (action === 'admin-users') data = { users: [] };
        if (action === 'lia-assistant') data = { version: 1, reply: 'Possiamo preparare una presentazione chiara della tua attività.', question: 'Quale servizio vuoi far conoscere?', options: ['Consulenza', 'Formazione'], actions: [], operations_executed: [] };
        if (['drafts', 'pending-posts'].includes(action)) data = [];
        await route.fulfill({ json: data });
      });
      const response = await page.goto(base + '/dashboard?tab=idea&verify-admin-shell=' + Date.now(), { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200, 'Published dashboard is available');
      if (scenario.user.role === 'admin') {
        await page.getByRole('heading', { name: 'Amministrazione piattaforma', exact: true }).waitFor();
        await page.locator('.admin-navigation').waitFor();
        await page.waitForTimeout(400);
        assert.equal(await page.locator('.admin-application-shell').count(), 1, 'Published build renders dedicated admin shell');
        assert.equal(await page.locator('.sidebar-navigation, .statistics-nav-entry, .professional-builder-nav-entry').count(), 0, 'Published admin has no customer navigation');
        assert.deepEqual(actions.filter(action => !String(action).startsWith('admin-') && action !== 'me'), [], 'Published admin performs no customer API requests');
      } else {
        await page.getByRole('navigation', { name: 'Sezioni della piattaforma' }).waitFor();
        await page.getByRole('heading', { name: 'La tua redazione, ogni giorno.', exact: true }).waitFor();
        await page.waitForTimeout(400);
        assert.equal(await page.locator('.admin-application-shell').count(), 0, 'Published customer stays outside admin shell');
        assert.equal(actions.some(action => String(action).startsWith('admin-')), false, 'Published customer does not call admin APIs');
        assert.equal(actions.includes('lia-profile-review') || actions.includes('lia-assistant'), false, 'Published entry does not spend AI credit automatically');
        await page.getByRole('button', { name: 'Non so da dove iniziare', exact: true }).click();
        await page.getByRole('textbox', { name: 'Scrivi a LIA', exact: true }).fill('Aiutami a farmi conoscere dalle famiglie.');
        await page.getByRole('button', { name: 'Invia a LIA', exact: true }).click();
        await page.getByRole('button', { name: 'Consulenza', exact: true }).waitFor();
        assert.equal(actions.includes('lia-assistant'), true, 'Published LIA sends the explicit request and offers a guided answer');
      }
      assert.deepEqual(errors, [], 'Published bundle has no runtime errors');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Published layout fits viewport');
      fs.mkdirSync('artifacts', { recursive: true });
      await page.screenshot({ path: `artifacts/release-shell-${scenario.label}.png`, fullPage: true });
      await context.close();
    }
    assert.ok(bundles.size, 'Actual published JS bundle was loaded');
    console.log(JSON.stringify({ base, bundles: [...bundles], adminDesktop: 'passed', adminMobile: 'passed', customerRoleIsolation: 'passed', apiMode: 'all mocked; no live data' }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
