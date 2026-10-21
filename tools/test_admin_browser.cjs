// Local fixtures only. Vite must be running on port 5178.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], writes = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', dialog => dialog.accept());
    let failProvider = false;
    const provider = { provider: 'gemini', label: 'Google Gemini', model: '', enabled: 1, monthly_credit: 10, credential_configured: false, credential_source: 'missing', unit_cost: 0.2 };
    const monitoring = { totals: { users: 17, published_posts: 123, queued_posts: 9 }, diagnostics: [], agents: [{ agent_name: 'content_editor', label: 'Redattore', purpose: 'Articoli', prompt_configured: true }], provider_settings: [provider], usage_this_month: { total_tokens: 30, requests: 2, estimated_cost: 1.5 }, cron_logs: [{ id: 1, job_name: 'sync', status: 'success', run_at: '2026-10-21 10:00:00' }] };
    await page.route('**/api/**', async route => {
      const action = new URL(route.request().url()).searchParams.get('action');
      const payload = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
      if (payload) writes.push({ action, payload });
      let data = { ok: true };
      if (action === 'admin-monitoring') data = monitoring;
      if (action === 'admin-settings') data = { settings: { cron_interval_sync: '6', cron_interval_seo: '24' } };
      if (action === 'admin-users') data = { users: [{ id: 1, name: 'Admin', email: 'admin@example.test', role: 'admin', plan: 'agency', slug: 'admin' }] };
      if (action === 'admin-prompt-history') data = { versions: [{ id: 3, created_at: '2026-10-20 10:00:00', instructions: 'Istruzioni precedenti' }] };
      if (action === 'admin-prompt-restore') data = { ok: true, agent_name: 'content_editor', instructions: 'Istruzioni precedenti' };
      if (action === 'admin-provider-save') {
        if (failProvider) return route.fulfill({ status: 503, json: { error: 'Provider non disponibile' } });
        provider.credential_configured = true; provider.credential_source = 'database'; provider.model = payload.model; provider.enabled = payload.enabled ? 1 : 0;
      }
      await route.fulfill({ json: data });
    });
    await page.route('**/monitor.php', route => route.fulfill({ contentType: 'text/html', body: '<p>Monitor fixture</p>' }));
    await page.route('**/admin-fixture', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      </script><script type="module">
      import React from '/node_modules/.vite/deps/react.js'; import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
      import {AdminScreen} from '/src/screens/AdminScreen.jsx'; import '/src/index.css';
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AdminScreen,{token:'fixture',currentUser:{id:1},adminPrompts:[{id:1,agent_name:'content_editor',label:'Redattore',instructions:'Istruzioni correnti'}],updatePrompt:async()=>{}}));
      </script></body></html>` }));
    await page.goto('http://127.0.0.1:5178/admin-fixture');
    const nav = name => page.locator('.admin-navigation button').filter({ hasText: name });
    await page.locator('.admin-kpi-grid strong').first().filter({ hasText: '17' }).waitFor();
    assert.deepEqual(await page.locator('.admin-kpi-grid strong').allTextContents(), ['17', '123', '9', '1']);
    await nav('Agenti AI').click();
    await page.getByText('Apri editor istruzioni').click();
    await page.getByRole('button', { name: 'Cronologia', exact: true }).click();
    await page.getByText('Istruzioni precedenti', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Ripristina versione' }).click();
    await page.getByRole('status').filter({ hasText: 'Versione ripristinata' }).waitFor();
    assert.equal(await page.locator('.admin-agent-editor textarea').inputValue(), 'Istruzioni precedenti');
    await nav('Cron e provider').click();
    const card = page.getByRole('form', { name: 'Collegamento Google Gemini' });
    await card.getByText('Credenziale mancante').waitFor();
    // Rendering cron logs and settings previously referenced an undefined style.
    await page.getByRole('heading', { name: 'Esecuzioni Cron Recenti' }).waitFor();
    await card.getByLabel('Nuova chiave API').fill('fixture-secret-never-returned');
    await card.getByLabel('Modello (vuoto = predefinito)').fill('gemini-test');
    await card.getByRole('button', { name: 'Salva collegamento' }).click();
    await card.getByText('Credenziale salvata e cifrata').waitFor();
    assert.equal(await card.getByLabel('Nuova chiave API').inputValue(), '');
    assert.equal(writes.find(w => w.action === 'admin-provider-save').payload.monthly_credit, 10);
    failProvider = true;
    await card.getByRole('button', { name: 'Salva collegamento' }).click();
    await page.getByRole('alert').filter({ hasText: 'Provider non disponibile' }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    fs.mkdirSync('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/admin-provider-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Provider settings fit mobile');
    await nav('Clienti').click();
    const selfProfile = page.getByRole('combobox', { name: 'Profilo di Admin' });
    assert.equal(await selfProfile.locator('option[value=base]').isDisabled(), true);
    assert.deepEqual(errors, [], 'No runtime errors across administration views');
    console.log('Admin browser: initial totals, prompt history/restore, cron rendering, provider save/error/secret clearing, self-role guard and mobile passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
