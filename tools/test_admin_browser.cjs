// Local fixtures only. Vite must be running on port 5178.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], writes = [], contentRequests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', dialog => dialog.accept());
    let failProvider = false;
    let contentState = { id: 42, user_id: 2, name: 'Cliente', email: 'cliente@example.test', platform: 'website', generated_title: 'Articolo da recuperare', published: 0, seo_score: -1, processing_status: 'failed', processing_attempts: 3, noindex: 0, has_content: 0 };
    const provider = { provider: 'gemini', label: 'Google Gemini', model: '', enabled: 1, monthly_credit: 10, credential_configured: false, credential_source: 'missing', unit_cost: 0.2 };
    const monitoring = { totals: { users: 17, published_posts: 123, queued_posts: 9 }, diagnostics: [], agents: [{ agent_name: 'content_editor', label: 'Redattore', purpose: 'Articoli', prompt_configured: true }], provider_settings: [provider], usage_this_month: { total_tokens: 30, requests: 2, estimated_cost: 1.5 }, cron_logs: [{ id: 1, job_name: 'sync', status: 'success', run_at: '2026-10-21 10:00:00' }] };
    await page.route('**/api/**', async route => {
      const action = new URL(route.request().url()).searchParams.get('action');
      const payload = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
      if (payload) writes.push({ action, payload });
      let data = { ok: true };
      if (action === 'admin-monitoring') data = monitoring;
      if (action === 'admin-settings') data = { settings: { cron_interval_sync: '6', cron_interval_seo: '24' } };
      if (action === 'admin-users') data = { users: [{ id: 1, name: 'Admin', email: 'admin@example.test', role: 'admin', plan: 'agency', slug: 'admin' }, { id: 2, name: 'Cliente', email: 'cliente@example.test', role: 'user', plan: 'base', slug: 'cliente' }] };
      if (action === 'admin-content-list') { contentRequests.push(new URL(route.request().url())); data = { items: [contentState], total: 1, page: 1, pages: 1 }; }
      if (action === 'admin-content-action') {
        if (payload.operation === 'retry') contentState = { ...contentState, processing_status: 'pending', processing_attempts: 0 };
        if (payload.operation === 'publish') contentState = { ...contentState, published: 1 };
        if (payload.operation === 'unpublish') contentState = { ...contentState, published: 0 };
      }
      if (action === 'admin-editorial-room') data = { user: { id: 2, name: 'Cliente', email: 'cliente@example.test', role_mission: 'Missione originale', content_strategy: 'Strategia originale', editorial_settings: '{"enabled":true,"auto_run":true,"min_posts":8,"strict_indexing_mode":true}' }, stats: {}, sources: [], posts: [] };
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
    assert.deepEqual(await page.locator('.admin-kpi-grid strong').allTextContents(), ['17', '123', '9', '0']);
    await page.getByRole('heading', { name: 'Clienti da seguire', exact: true }).waitFor();
    await page.locator('.ap-client-section tbody tr').first().waitFor();
    assert.equal(await page.locator('.ap-client-section tbody tr').count(), 1, 'Overview excludes administrator accounts from customer supervision');
    assert.equal(await page.locator('.ap-client-section tbody').textContent().then(text => text.includes('Cliente')), true);
    assert.equal(await page.locator('.admin-global-search option[value="1"]').count(), 0, 'Administrators are not offered as customer workspaces');
    fs.mkdirSync('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/admin-platform-overview-desktop.png', fullPage: true });
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
    await page.getByRole('searchbox', { name: 'Cerca clienti' }).fill('nessuna-corrispondenza');
    assert.equal(await page.locator('.admin-user-row').count(), 0, 'Client search filters results');
    await page.getByRole('searchbox', { name: 'Cerca clienti' }).fill('');
    await page.getByRole('button', { name: 'Revoca sessioni' }).last().click();
    await page.getByRole('status').filter({ hasText: 'Sessioni revocate' }).waitFor();
    assert.equal(writes.some(write => write.action === 'admin-revoke-sessions' && write.payload.id === 2), true);
    await nav('Code e recupero').click();
    await page.getByRole('button', { name: 'Rimetti in coda' }).click();
    await page.getByRole('status').filter({ hasText: 'Contenuto rimesso' }).waitFor();
    assert.equal(writes.some(write => write.action === 'admin-content-action' && write.payload.operation === 'retry'), true);
    await page.getByText('In attesa', { exact: true }).last().waitFor();
    assert.equal(await page.getByRole('button', { name: 'Rimetti in coda' }).count(), 0, 'Pending work cannot be retried');
    contentState = { ...contentState, seo_score: 82, processing_status: 'done', has_content: 1 };
    await nav('Gestione contenuti').click();
    await Promise.all([page.waitForResponse(response => new URL(response.url()).searchParams.get('action') === 'admin-content-list' && new URL(response.url()).searchParams.get('user_id') === '2'), page.getByRole('combobox', { name: 'Filtra contenuti per cliente' }).selectOption('2')]);
    assert.equal(contentRequests.at(-1).searchParams.get('user_id'), '2', 'Archive requests are scoped to the selected customer');
    await Promise.all([page.waitForResponse(response => new URL(response.url()).searchParams.get('action') === 'admin-content-list' && !new URL(response.url()).searchParams.has('user_id')), page.getByRole('combobox', { name: 'Filtra contenuti per cliente' }).selectOption('')]);
    await page.getByRole('button', { name: 'Pubblica', exact: true }).click();
    await page.getByRole('button', { name: 'Ritira pubblicazione' }).waitFor();
    await page.getByRole('button', { name: 'Ritira pubblicazione' }).click();
    await page.getByRole('button', { name: 'Pubblica', exact: true }).waitFor();
    await page.screenshot({ path: 'artifacts/admin-content-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Content workspace fits mobile');
    await page.locator('.ao-client').click();
    await page.getByRole('heading', { name: 'Cliente', exact: true }).waitFor();
    assert.equal(await page.locator('.cr-client-list button').count(), 1, 'Control Room includes customer accounts only');
    await page.getByRole('button', { name: 'Configurazione AI', exact: true }).click();
    await page.screenshot({ path: 'artifacts/admin-client-settings.png', fullPage: true });
    if (errors.length) throw new Error(errors.join('\n'));
    await page.getByLabel('Obiettivo editoriale', { exact: true }).fill('Nuova missione');
    await page.getByRole('button', { name: 'Salva obiettivo e strategia' }).click();
    await page.getByRole('status').filter({ hasText: 'Configurazione del cliente salvata' }).waitFor();
    assert.equal(writes.some(write => write.action === 'admin-update-user' && write.payload.role_mission === 'Nuova missione'), true);
    await page.getByRole('button', { name: 'Salva motore editoriale' }).click();
    await page.getByRole('status').filter({ hasText: 'Configurazione del cliente salvata' }).waitFor();
    assert.equal(writes.some(write => write.action === 'admin-editorial-engine-save' && write.payload.min_posts === 8), true);
    await page.getByRole('button', { name: 'Contenuti', exact: true }).click();
    await page.getByRole('button', { name: 'Apri coda del cliente', exact: true }).click();
    await page.getByRole('combobox', { name: 'Filtra contenuti per cliente' }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Filtra contenuti per cliente' }).inputValue(), '2', 'Customer queue keeps the selected customer scope');
    await Promise.all([page.waitForResponse(response => new URL(response.url()).searchParams.get('action') === 'admin-content-list' && !new URL(response.url()).searchParams.has('user_id')), nav('Gestione contenuti').click()]);
    assert.equal(await page.getByRole('combobox', { name: 'Filtra contenuti per cliente' }).inputValue(), '', 'Global navigation resets the customer scope');
    assert.equal(contentRequests.at(-1).searchParams.has('user_id'), false, 'Global archive requests include every account');
    await nav('Panoramica').click();
    await page.getByRole('heading', { name: 'Clienti da seguire', exact: true }).waitFor();
    await page.screenshot({ path: 'artifacts/admin-platform-overview-mobile.png', fullPage: true });
    const overviewLayout = await page.evaluate(() => {
      const viewport = innerWidth;
      const width = document.documentElement.scrollWidth;
      const overflowing = [...document.querySelectorAll('body *')].map(element => {
        const bounds = element.getBoundingClientRect();
        if (bounds.right <= viewport + 1 && bounds.left >= -1) return null;
        const style = getComputedStyle(element);
        return { tag: element.tagName, class: String(element.className || ''), left: Math.round(bounds.left), right: Math.round(bounds.right), width: Math.round(bounds.width), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, display: style.display, minWidth: style.minWidth, gridColumns: style.gridTemplateColumns, overflowX: style.overflowX, whiteSpace: style.whiteSpace };
      }).filter(Boolean).slice(0, 40);
      return { viewport, width, overflowing };
    });
    if (overviewLayout.width > overviewLayout.viewport) console.error('Mobile overview overflow diagnostics:', JSON.stringify(overviewLayout, null, 2));
    assert.equal(overviewLayout.width <= overviewLayout.viewport, true, 'Platform overview fits mobile');
    assert.deepEqual(errors, [], 'No runtime errors across administration views');
    console.log('Admin browser: totals, prompts, providers, client search, session revocation, queue recovery, publication, client configuration and mobile passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
