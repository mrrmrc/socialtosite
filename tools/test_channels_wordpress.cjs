// Browser contract with synthetic data only; no social providers or WordPress sites are contacted.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    const errors = [], mutations = [];
    let connected = false, settings = {}, syncPass = 0;
    page.on('pageerror', e => errors.push(e.message));
    const fixture = {
      site: { title: 'Studio Aurora', profile_summary: 'Formazione' },
      sources: [{ id: 11, platform: 'website', label: 'Sito principale', url: 'https://first.example', active: 1 }, { id: 12, platform: 'website', label: 'Secondo sito', url: 'https://second.example', active: 1 }],
      posts: [], visibility: {},
    };
    const moduleSource = await (await fetch('http://127.0.0.1:5178/src/screens/DashboardScreen.jsx')).text();
    const reactHash = moduleSource.match(/react\.js\?v=([a-z0-9]+)/)[1];
    const mainSource = await (await fetch('http://127.0.0.1:5178/src/main.jsx')).text();
    const rendererHash = mainSource.match(/react-dom_client\.js\?v=([a-z0-9]+)/)[1];
    await page.route('**/api/**', async route => {
      const req = route.request(); const action = new URL(req.url()).searchParams.get('action');
      const payload = req.method() === 'POST' ? req.postDataJSON() : null;
      if (payload) mutations.push({ action, payload });
      if (action?.startsWith('wordpress-')) {
        const read = ['wordpress-status','wordpress-taxonomies','wordpress-library'].includes(action);
        assert.equal(req.method(), read ? 'GET' : 'POST', 'HTTP contract '+action);
      }
      let data = {};
      if (action === 'site') data = fixture;
      if (action === 'sync') data = { results: [{ platform: 'website', source_id: payload.source_id, new: 0, imported_ids: [], retryable_ids: [] }] };
      if (action === 'wordpress-library') data = { posts: [{ id: new URL(req.url()).searchParams.get('cursor') === '21' ? 22 : 21, title: 'Articolo archivio completo', platform: 'facebook', published: 0 }], next_cursor: 21, has_more: new URL(req.url()).searchParams.get('cursor') !== '21' };
      if (action === 'wordpress-status') data = { connected, endpoint: connected ? 'https://wordpress.example' : '', topics: ['Viaggi'], filters: settings.filters || { scope: 'all' }, archive: { total: 45, published: 30, drafts: 15, platforms: ['instagram','manual'] } };
      if (action === 'wordpress-connect') { connected = true; data = { ok: true }; }
      if (action === 'wordpress-prepare') { if (!settings.post_status) settings = { post_status: 'draft', enabled: false, category_id: 0, mappings: {}, filters: { scope: 'all', platforms: [], since_date: '', until_date: '', batch_size: 20 } }; data = { ready: true, archive_available: true, media_available: true, categories: [{ id: 7, name: 'Esperienze' }], tags: [{ id: 9, name: 'Famiglie' }], settings }; }
      if (action === 'wordpress-taxonomies') data = { archive_available: true, categories: [{ id: 7, name: 'Esperienze' }], tags: [{ id: 9, name: 'Famiglie' }], settings };
      if (action === 'wordpress-settings') { settings = payload; data = { ok: true }; }
      if (action === 'wordpress-sync') { syncPass++; data = { ok: true, imported: 2, skipped: 1, has_more: syncPass === 1 }; }
      if (action === 'wordpress-disconnect') connected = false;
      if (['drafts','pending-posts'].includes(action)) data = [];
      await route.fulfill({ json: data });
    });
    await page.route('**/channels-fixture*', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div>
      <script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;</script>
      <script type="module">import React from '/node_modules/.vite/deps/react.js?v=${reactHash}'; import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js?v=${rendererHash}'; import {DashboardScreen} from '/src/screens/DashboardScreen.jsx'; import '/src/index.css'; import '/src/premium.css'; ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(DashboardScreen,{token:'fixture',user:{id:999,name:'Studio Aurora',slug:'studio-aurora',plan:'professional',role:'user'},onLogout:()=>{}}));</script></body></html>` }));
    await page.goto('http://127.0.0.1:5178/channels-fixture?tab=sources');
    if (!await page.locator('.linked-channel').count()) await page.getByRole('button', { name: 'Canali', exact: true }).click();
    await page.getByRole('button', { name: 'Sincronizza Secondo sito', exact: true }).click();
    await page.getByText('Nessun nuovo contenuto da elaborare.', { exact: true }).waitFor();
    assert.equal(mutations.find(m => m.action === 'sync').payload.source_id, 12, 'the selected source ID reaches the server');
    // Close acquisition result if the modal covers the WordPress form.
    const dialog = page.getByRole('dialog');
    if (await dialog.count()) await dialog.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await page.getByLabel('Indirizzo WordPress', { exact: true }).fill('https://wordpress.example');
    await page.getByLabel('Codice generato dal plugin', { exact: true }).fill('a'.repeat(64));
    await page.getByRole('button', { name: 'Verifica e collega', exact: true }).click();
    await page.getByText(/Collegamento completo: l.archivio/).waitFor();
    assert.ok(mutations.some(m => m.action === 'wordpress-prepare'), 'archive bootstrap happens automatically after connecting');
    assert.equal(await page.getByRole('button', { name: 'Sincronizza WordPress', exact: true }).isEnabled(), true, 'first connection needs no second settings save');
    assert.equal(await page.getByLabel(/Archivio da sincronizzare/).inputValue(), 'all');
    await page.getByLabel(/Contenuti per passaggio/).fill('5');
    await page.getByLabel('Dalla data', { exact: true }).fill('2026-01-01');
    await page.getByLabel('Fino alla data', { exact: true }).fill('2026-12-31');
    await page.getByLabel('instagram', { exact: true }).check();
    await page.locator('.wordpress-library summary').click();
    await page.getByRole('button', { name: 'Carica altri articoli' }).click();
    await page.getByText('Fine archivio: 2 contenuti leggibili.', { exact: true }).waitFor();
    const row = page.locator('.wordpress-mapping').filter({ hasText: 'Viaggi' });
    await row.locator('select').nth(0).selectOption('7');
    await row.locator('select').nth(1).selectOption('9');
    await page.getByLabel(/Importa i contenuti come/).selectOption('publish');
    await page.getByRole('button', { name: 'Salva abbinamenti e modalità', exact: true }).click();
    assert.deepEqual(settings.mappings.Viaggi, { category_id: 7, tag_id: 9 });
    assert.equal(settings.post_status, 'publish');
    assert.deepEqual(settings.filters, { scope: 'all', platforms: ['instagram'], since_date: '2026-01-01', until_date: '2026-12-31', batch_size: 5 });
    await page.getByRole('button', { name: 'Sincronizza WordPress', exact: true }).click();
    await page.getByText(/Sincronizzazione archivio: 4 nuovi post/).waitFor();
    assert.equal(syncPass, 2, 'complete archive automatically fetches subsequent pages');
    assert.deepEqual(mutations.filter(m => m.action === 'wordpress-sync').map(m => m.payload.restart), [true,false]);
    await page.reload();
    await page.getByLabel(/Contenuti per passaggio/).waitFor();
    assert.equal(await page.getByLabel(/Contenuti per passaggio/).inputValue(), '5', 'configured connection preserves settings after reload');
    assert.equal(await row.locator('select').nth(0).inputValue(), '7');
    settings = {};
    await page.reload();
    await page.getByRole('heading', { name: 'Connettore WordPress', exact: true }).waitFor();
    await page.getByLabel(/Contenuti per passaggio/).waitFor();
    assert.equal(await page.getByLabel(/Contenuti per passaggio/).inputValue(), '20', 'incomplete existing connection bootstraps on return to channels');
    await page.getByText('Archivio collegato: https://wordpress.example', { exact: true }).waitFor();
    fs.mkdirSync('artifacts', { recursive: true });
    await page.locator('.wordpress-workspace').screenshot({ path: 'artifacts/channels-wordpress-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.wordpress-workspace').scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'mobile layout fits the viewport');
    await page.screenshot({ path: 'artifacts/channels-wordpress-mobile.png' });
    assert.deepEqual(errors, []);
    console.log('Channels and WordPress browser checks passed: selective sync, complete archive, filters, categories/tags, saved parameters after reload, multi-page import, desktop/mobile.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
