// Run against Vite on 127.0.0.1:5178. All API traffic uses fixtures.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  console.log('Browser launched');
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = [], mutations = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('Page error:', e.message); });
    let rejectSave = false, rejectCreate = true;
    let fixture = {
      site: { title: 'Studio Aurora', profile_summary: 'Formazione' }, sources: [],
      posts: [{ id: 77, platform: 'manual', generated_title: 'Titolo iniziale', generated_body: '<p>Testo iniziale</p>', edited_excerpt: 'Parolachiaveunica', tags: [], seo_score: 82, published: 0 }],
      visibility: { impressions: 0, clicks: 0, latest_search_date: null },
    };
    const moduleSource = await (await fetch('http://127.0.0.1:5178/src/screens/DashboardScreen.jsx')).text();
    const reactHash = moduleSource.match(/react\.js\?v=([a-z0-9]+)/)[1];
    const mainSource = await (await fetch('http://127.0.0.1:5178/src/main.jsx')).text();
    const rendererHash = mainSource.match(/react-dom_client\.js\?v=([a-z0-9]+)/)[1];
    await page.route('**/api/**', async route => {
      const request = route.request(), action = new URL(request.url()).searchParams.get('action');
      if (request.method() !== 'GET' && action !== 'lia-profile-review') mutations.push({ action, body: request.postDataJSON() });
      if (action === 'site') return route.fulfill({ json: fixture });
      if (action === 'post-create') {
        if (rejectCreate) return route.fulfill({ status: 503, json: { error: 'Creazione non disponibile' } });
        const payload = request.postDataJSON();
        fixture.posts.push({ id: 78, ...payload, platform: 'manual', published: 0, tags: [] });
        return route.fulfill({ json: { ok: true, id: 78 } });
      }
      if (action === 'post-update') return route.fulfill(rejectSave ? { status: 503, json: { error: 'Salvataggio non disponibile' } } : { json: { ok: true } });
      if (action === 'lia-profile-review') return route.fulfill({ json: { review: { reviewed: false, fields: [], error: { code: 'provider_credit_exhausted', message: 'Il credito del servizio IA è esaurito.' } } } });
      return route.fulfill({ json: {} });
    });
    await page.route('**/usability-fixture*', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div>
      <script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;</script>
      <script type="module">import React from '/node_modules/.vite/deps/react.js?v=${reactHash}'; import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js?v=${rendererHash}'; import {DashboardScreen} from '/src/screens/DashboardScreen.jsx'; import '/src/index.css'; import '/src/premium.css'; ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(DashboardScreen,{token:'fixture',user:{id:999,name:'Studio Aurora',slug:'studio-aurora',plan:'professional',role:'user'},onLogout:()=>{}})));</script></body></html>` }));
    await page.goto('http://127.0.0.1:5178/usability-fixture');
    console.log('Dashboard loaded');
    await page.getByText('Puoi comunque aggiungere, modificare e pubblicare i tuoi contenuti.', { exact: true }).waitFor();
    await page.getByRole('button', { name: '+ Aggiungi contenuto', exact: true }).click();
    const manual = page.getByRole('dialog', { name: 'Aggiungi un contenuto', exact: true });
    await manual.getByRole('textbox', { name: 'Titolo', exact: true }).fill('Il mio progetto');
    await manual.getByRole('textbox', { name: 'Il tuo testo', exact: true }).fill('Testo mio & originale.\n\n<script>non eseguire</script>');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'manual editor fits mobile');
    fs.mkdirSync('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/manual-content-mobile.png', fullPage: true, animations: 'disabled' });
    const manualBounds = await manual.boundingBox();
    assert.ok(manualBounds.y >= -1 && manualBounds.y + manualBounds.height <= 845, 'manual dialog stays inside the viewport');
    page.once('dialog', d => d.dismiss());
    await manual.getByRole('button', { name: 'Chiudi nuovo contenuto' }).click();
    assert.ok(await manual.isVisible(), 'discard cancellation preserves new content');
    await manual.getByRole('button', { name: 'Salva bozza e continua' }).click();
    await manual.getByRole('alert').filter({ hasText: 'Creazione non disponibile' }).waitFor();
    assert.match(await manual.getByRole('textbox', { name: 'Il tuo testo' }).inputValue(), /Testo mio/);
    rejectCreate = false;
    await manual.getByRole('button', { name: 'Salva bozza e continua' }).click();
    await manual.waitFor({ state: 'hidden' });
    const createdEditor = page.getByRole('dialog', { name: 'Modifica il contenuto' });
    await createdEditor.waitFor();
    assert.equal(await createdEditor.getByRole('textbox', { name: 'Titolo principale', exact: true }).inputValue(), 'Il mio progetto');
    await createdEditor.getByRole('button', { name: 'Chiudi editor' }).click();
    const creation = mutations.filter(m => m.action === 'post-create').at(-1).body;
    assert.equal(creation.edited_body, '<p>Testo mio &amp; originale.</p><p>&lt;script&gt;non eseguire&lt;/script&gt;</p>');
    assert.equal(creation.published, undefined, 'creation never requests publishing');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('http://127.0.0.1:5178/usability-fixture');
    await page.getByRole('button', { name: 'Rivedi le bozze', exact: true }).click({ timeout: 30000 });
    assert.equal(new URL(page.url()).searchParams.get('tab'), 'site');
    await page.reload();
    await page.getByRole('heading', { name: /^(Contenuti|Articoli)$/ }).waitFor();
    await page.getByRole('button', { name: 'Social collegati', exact: true }).click();
    await page.getByRole('textbox', { name: 'URL pubblico del canale' }).waitFor();
    await page.goBack();
    await page.getByRole('heading', { name: /^(Contenuti|Articoli)$/ }).waitFor();
    const search = page.getByRole('searchbox', { name: 'Cerca nei contenuti' });
    await search.fill('Parolachiaveunica');
    await page.getByRole('heading', { name: 'Titolo iniziale', exact: true }).waitFor();
    await search.fill('nessunrisultato');
    await page.getByRole('button', { name: 'Azzera i filtri' }).click();
    await page.getByRole('button', { name: /Modifica/, exact: false }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Modifica il contenuto' });
    await dialog.waitFor();
    assert.equal(await dialog.locator('.ql-toolbar').count(), 1, 'StrictMode has one Quill toolbar');
    await dialog.getByRole('textbox', { name: 'Titolo principale', exact: true }).fill('Titolo conservato');
    const body = dialog.getByRole('textbox', { name: 'Testo dell’articolo' });
    await body.press('End'); await body.pressSequentially(' nuovo testo');
    assert.equal(await dialog.getByRole('textbox', { name: 'Titolo principale', exact: true }).inputValue(), 'Titolo conservato', 'body changes preserve title');
    page.once('dialog', d => d.dismiss());
    await dialog.getByRole('button', { name: 'Chiudi editor', exact: true }).click();
    assert.ok(await dialog.isVisible(), 'cancel discard keeps edits');
    rejectSave = true;
    await dialog.getByRole('button', { name: /SALVA MODIFICHE/ }).click();
    await dialog.getByRole('alert').filter({ hasText: 'Salvataggio non disponibile' }).waitFor();
    assert.ok(await dialog.isVisible());
    rejectSave = false;
    await dialog.getByRole('button', { name: /SALVA MODIFICHE/ }).click();
    await dialog.waitFor({ state: 'hidden' });
    const save = mutations.filter(m => m.action === 'post-update').at(-1).body;
    assert.equal(save.edited_title, 'Titolo conservato');
    assert.match(save.edited_body, /nuovo testo/);
    await page.getByRole('button', { name: 'Monitoraggio e SEO', exact: true }).click();
    assert.equal(await page.getByText('In attesa di dati', { exact: true }).count(), 2);
    fixture.visibility.latest_search_date = '2026-10-19';
    await page.reload();
    await page.getByRole('heading', { name: 'Visibilità', exact: true }).waitFor();
    await page.getByText('Quante volte i tuoi contenuti sono apparsi nelle ricerche', { exact: true }).waitFor();
    assert.equal(await page.getByText('In attesa di dati', { exact: true }).count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    fs.mkdirSync('artifacts', { recursive: true });
    const navButtons = page.getByRole('navigation', { name: 'Sezioni della piattaforma' }).getByRole('button');
    for (let index = 0; index < await navButtons.count(); index++) {
      const button = navButtons.nth(index), name = await button.innerText();
      await button.click();
      assert.equal(await button.getAttribute('aria-current'), 'page');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no horizontal overflow: ${name}`);
    }
    await page.screenshot({ path: 'artifacts/usability-mobile.png', fullPage: true });
    assert.deepEqual(errors, []);
    assert.deepEqual(mutations.map(m => m.action), ['post-create', 'post-create', 'post-update', 'post-update'], 'manual creation and editing have no accidental publishing or AI generation');
    const login = await browser.newPage();
    await login.route('**/api/**', route => route.fulfill({ status: 401, json: { error: 'Credenziali non valide' } }));
    await login.goto('http://127.0.0.1:5178/accedi');
    assert.equal(await login.getByLabel('Email', { exact: true }).getAttribute('type'), 'email');
    assert.equal(await login.getByLabel('Password', { exact: true }).getAttribute('autocomplete'), 'current-password');
    await login.getByLabel('Email', { exact: true }).fill('test@example.com');
    await login.getByLabel('Password', { exact: true }).fill('fixture-only');
    await login.getByRole('button', { name: /Entra nello spazio/ }).click();
    await login.getByRole('alert').filter({ hasText: 'Credenziali non valide' }).waitFor({ timeout: 10000 }).catch(async error => { console.error('Login state:', await login.locator('body').innerText()); throw error; });
    assert.ok(await login.getByLabel('Password', { exact: true }).isEnabled());
    console.log('Platform usability passed: manual creation despite exhausted AI credit, escaping pasted HTML, retry without text loss, saved draft in editor, history/reload, search/reset, editing, mobile sections and login failure.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
