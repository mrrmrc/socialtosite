// Exercise the real App boundary, not just the embedded AdminScreen.
// Run against local Vite on port 5178; every API response is a fixture.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = 'http://127.0.0.1:5178';
const forbiddenAdminRequests = ['site', 'admin-seo', 'current_plan', 'lia-profile-review', 'sync', 'drafts', 'pending-posts'];

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const appModule = await (await fetch(base + '/src/App.jsx')).text();
    const mainModule = await (await fetch(base + '/src/main.jsx')).text();
    const reactHash = appModule.match(/react\.js\?v=([a-z0-9]+)/)?.[1];
    const rendererHash = mainModule.match(/react-dom_client\.js\?v=([a-z0-9]+)/)?.[1];
    assert.ok(reactHash && rendererHash, 'Vite dependency versions available');
    async function openApp(user, pathname, viewport = { width: 1440, height: 1000 }, serverUser = user) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript(user => {
        localStorage.setItem('sts_token', 'fixture-token');
        localStorage.setItem('sts_user', JSON.stringify(user));
      }, user);
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const actions = [], errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        const action = url.pathname.endsWith('current_plan.php') ? 'current_plan' : url.searchParams.get('action');
        actions.push(action);
        let data = {};
        if (action === 'me') {
          if (serverUser === null) return route.fulfill({ status: 503, json: { error: 'Verifica temporaneamente non disponibile' } });
          data = { user: serverUser };
        }
        if (action === 'site') data = { site: { title: 'Cliente esempio', profile_summary: 'Studio di consulenza' }, sources: [], posts: [], visibility: {} };
        if (action === 'current_plan') data = { user: serverUser };
        if (action === 'admin-prompts') data = { prompts: [] };
        if (action === 'admin-monitoring') data = { totals: { users: 3, published_posts: 12, queued_posts: 0 }, provider_settings: [], agents: [], diagnostics: [], usage_this_month: {}, cron_logs: [] };
        if (action === 'admin-settings') data = { settings: { cron_interval_sync: '6', cron_interval_seo: '24' } };
        if (action === 'admin-users') data = { users: [] };
        if (action === 'admin-seo') data = { stats: [] };
        if (['drafts', 'pending-posts'].includes(action)) data = [];
        await route.fulfill({ json: data });
      });
      const document = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div>
        <script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;</script>
        <script type="module">import React from '/node_modules/.vite/deps/react.js?v=${reactHash}';import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js?v=${rendererHash}';import App from '/src/App.jsx';ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(App)));</script></body></html>`;
      await page.route('**/*', async route => {
        if (route.request().resourceType() === 'document' && new URL(route.request().url()).origin === base) return route.fulfill({ contentType: 'text/html', body: document });
        await route.fallback();
      });
      await page.goto(base + pathname);
      return { context, page, actions, errors };
    }

    const admin = { id: 1, name: 'Amministratore', email: 'admin@example.test', slug: 'admin', plan: 'agency', role: 'admin' };
    for (const scenario of [
      { user: admin, url: '/dashboard?tab=idea', mobile: false },
      { user: { ...admin, plan: 'base' }, url: '/connect', mobile: true },
      { user: admin, url: '/dashboard?tab=profile', mobile: false },
      { user: { ...admin, role: 'user', plan: 'base' }, serverUser: admin, url: '/dashboard', mobile: false },
    ]) {
      const { context, page, actions, errors } = await openApp(scenario.user, scenario.url, scenario.mobile ? { width: 390, height: 844 } : undefined, scenario.serverUser || scenario.user);
      await page.getByRole('heading', { name: 'Amministrazione piattaforma', exact: true }).waitFor();
      await page.locator('.admin-navigation').waitFor();
      await page.waitForTimeout(400);
      assert.equal(await page.locator('.admin-application-shell').count(), 1, 'Admin has its own application shell');
      assert.equal(await page.locator('.sidebar-navigation, .statistics-nav-entry, .professional-builder-nav-entry').count(), 0, 'Customer navigation and DOM-injected entries never mount for admin');
      for (const label of ['Il mio profilo', 'IDEA · articoli', 'Sito pubblico', 'Piano e servizi', 'Social collegati']) assert.equal(await page.getByRole('button', { name: label, exact: true }).count(), 0, 'No customer menu: ' + label);
      assert.deepEqual(actions.filter(action => forbiddenAdminRequests.includes(action)), [], 'Admin never starts customer APIs or onboarding');
      assert.ok(actions.includes('admin-prompts') && actions.includes('admin-monitoring'), 'Admin data loads without a customer site');
      assert.deepEqual(errors, [], 'Admin shell has no runtime errors');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Admin shell fits viewport');
      fs.mkdirSync('artifacts', { recursive: true });
      await page.screenshot({ path: `artifacts/admin-shell-${scenario.mobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
      if (scenario.mobile) {
        await page.getByRole('button', { name: 'Sicurezza account', exact: true }).click();
        await page.getByRole('heading', { name: 'Sicurezza account amministratore', exact: true }).waitFor();
        assert.equal(await page.locator('.sidebar-navigation').count(), 0, 'Security stays in the administration workspace');
        await page.getByRole('button', { name: 'Chiudi sicurezza', exact: true }).click();
        await page.getByRole('button', { name: 'Esci', exact: true }).click();
        await page.locator('.admin-application-shell').waitFor({ state: 'detached' });
        assert.equal(await page.evaluate(() => localStorage.getItem('sts_token')), null, 'Logout clears administrative token');
      }
      await context.close();
    }

    const { context, page, actions, errors } = await openApp({ id: 2, name: 'Cliente esempio', email: 'cliente@example.test', slug: 'cliente', plan: 'professional', role: 'user' }, '/dashboard');
    await page.getByRole('navigation', { name: 'Sezioni della piattaforma' }).waitFor();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.admin-application-shell').count(), 0, 'Customer does not enter admin shell');
    await page.getByRole('heading', { name: 'La tua redazione, ogni giorno.', exact: true }).waitFor();
    const customerNav = page.getByRole('navigation', { name: 'Sezioni della piattaforma' });
    assert.deepEqual(await customerNav.locator('.tab-label').allTextContents(), ['LIA', 'Contenuti', 'Il sito', 'SEO e GEO', 'Canali'], 'Customer navigation is limited to three clear destinations');
    assert.equal(actions.includes('lia-profile-review'), false, 'Entering LIA does not start background AI reviews');
    assert.ok(actions.includes('site'), 'Customer loads its own site');
    assert.equal(actions.some(action => String(action).startsWith('admin-')), false, 'Customer never requests admin APIs');
    assert.deepEqual(errors, [], 'Customer shell remains functional');
    await context.close();
    const baseCustomer = await openApp({ id: 3, name: 'Cliente Base', email: 'base@example.test', slug: 'cliente-base', plan: 'base', role: 'user' }, '/dashboard?tab=idea');
    await baseCustomer.page.getByRole('heading', { name: 'La tua redazione, ogni giorno.', exact: true }).waitFor();
    assert.equal(new URL(baseCustomer.page.url()).searchParams.get('tab'), 'overview', 'Old IDEA bookmarks enter the guided LIA workspace');
    assert.equal(await baseCustomer.page.locator('.admin-application-shell').count(), 0, 'Base customer without sources enters LIA directly');
    assert.ok(baseCustomer.actions.includes('me') && baseCustomer.actions.includes('site'), 'LIA verifies identity and loads the current account');
    assert.equal(baseCustomer.actions.some(action => String(action).startsWith('admin-')), false, 'Base onboarding does not call admin APIs');
    assert.deepEqual(baseCustomer.errors, [], 'Base onboarding remains functional');
    await baseCustomer.context.close();
    const demoted = await openApp(admin, '/dashboard?tab=admin', undefined, { id: 1, name: 'Amministratore', email: 'admin@example.test', slug: 'admin', plan: 'professional', role: 'user' });
    await demoted.page.getByRole('navigation', { name: 'Sezioni della piattaforma' }).waitFor();
    await demoted.page.waitForTimeout(300);
    assert.equal(new URL(demoted.page.url()).searchParams.has('tab'), false, 'Customer legacy admin bookmark is normalized before mounting');
    assert.equal(await demoted.page.locator('.admin-application-shell').count(), 0, 'Server role revocation wins over cached admin role');
    assert.equal(demoted.actions.some(action => String(action).startsWith('admin-')), false, 'Revoked admin does not request privileged APIs');
    assert.deepEqual(demoted.errors, [], 'Demoted user has no runtime errors');
    await demoted.context.close();
    const unavailable = await openApp(admin, '/dashboard', undefined, null);
    await unavailable.page.getByRole('alert').filter({ hasText: 'Impossibile verificare la sessione' }).waitFor();
    await unavailable.page.getByRole('button', { name: 'Riprova verifica sessione', exact: true }).waitFor();
    assert.equal(await unavailable.page.locator('.admin-application-shell, .sidebar-navigation').count(), 0, 'Unverified identity cannot mount admin or customer workspaces');
    assert.deepEqual(unavailable.actions.filter(action => action !== 'me'), [], 'Session failure starts no workspace APIs');
    assert.deepEqual(unavailable.errors, [], 'Session failure is handled explicitly');
    await unavailable.context.close();
    console.log('Admin shell: real App role boundary, legacy deep links, base admin onboarding bypass, base customer onboarding, customer API isolation and desktop/mobile navigation passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
