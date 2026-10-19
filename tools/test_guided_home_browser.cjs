// Local dashboard fixtures only: no live account, provider or publishing traffic.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    const mutations = [];
    page.on('pageerror', error => errors.push(error.message));
    let fixture = { site: { title: 'Studio Aurora', profile_summary: 'Consulenza e formazione' }, posts: [], sources: [] };
    let failLoad = false, delayLoad = false;
    const moduleSource = await (await fetch('http://127.0.0.1:5178/src/screens/DashboardScreen.jsx')).text();
    const reactHash = moduleSource.match(/react\.js\?v=([a-z0-9]+)/)[1];
    const mainSource = await (await fetch('http://127.0.0.1:5178/src/main.jsx')).text();
    const rendererHash = mainSource.match(/react-dom_client\.js\?v=([a-z0-9]+)/)[1];
    await page.route('**/api/**', async route => {
      const action = new URL(route.request().url()).searchParams.get('action');
      if (route.request().method() !== 'GET' && action !== 'lia-profile-review') mutations.push(action);
      if (action === 'site') {
        if (delayLoad) await new Promise(resolve => setTimeout(resolve, 600));
        return route.fulfill(failLoad ? { status: 503, json: { error: 'Servizio non disponibile' } } : { json: fixture });
      }
      if (action === 'lia-profile-review') return route.fulfill({ json: { review: { reviewed: false, fields: [] } } });
      return route.fulfill({ json: {} });
    });
    await page.route('**/guided-home-fixture', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div>
      <script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;</script>
      <script type="module">import React from '/node_modules/.vite/deps/react.js?v=${reactHash}'; import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js?v=${rendererHash}'; import {DashboardScreen} from '/src/screens/DashboardScreen.jsx'; import '/src/index.css'; import '/src/premium.css'; ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(DashboardScreen,{token:'fixture',user:{id:999,name:'Studio Aurora',slug:'studio-aurora',plan:'professional',role:'user'},onLogout:()=>{}}));</script></body></html>` }));
    const open = () => page.goto('http://127.0.0.1:5178/guided-home-fixture');
    await open();
    await page.getByRole('heading', { name: 'Partiamo da un tuo social.' }).waitFor();
    assert.equal(await page.locator('.guided-home .btn-primary').count(), 1);
    assert.equal(await page.locator('.guided-home-details').getAttribute('open'), null);
    await page.getByRole('button', { name: 'Lo faccio più tardi' }).click();
    await page.getByRole('button', { name: 'Crea con LIA', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Crea con LIA', exact: true }).click();
    await page.getByRole('heading', { name: 'Idee e nuovi contenuti', exact: true }).waitFor();
    fixture = { ...fixture, posts: [{ id: 77, published: 0, generated_title: 'Una guida per la tua attività', generated_excerpt: 'Una guida pratica.', seo_score: 82, platform: 'instagram' }] };
    await open();
    await page.getByRole('heading', { name: 'C’è una bozza da rivedere.' }).waitFor();
    fs.mkdirSync('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/guided-home-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Rivedi le bozze', exact: true }).click();
    await page.getByRole('heading', { name: /^(Articoli|Contenuti)$/, exact: true }).first().waitFor();
    await open();
    await page.getByRole('heading', { name: 'C’è una bozza da rivedere.' }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'artifacts/guided-home-mobile.png', fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal mobile overflow');
    await page.getByText('Dettagli e impostazioni del progetto', { exact: true }).click();
    await page.getByRole('button', { name: 'Il mio profilo e intervista', exact: true }).click();
    await page.getByRole('heading', { name: 'LIA ti conosce, una risposta alla volta.', exact: true }).waitFor();
    fixture = { site: {}, posts: [], sources: [] };
    await open();
    await page.getByRole('button', { name: 'Rispondi a LIA', exact: true }).click();
    await page.getByRole('heading', { name: 'LIA ti conosce, una risposta alla volta.', exact: true }).waitFor();
    failLoad = true;
    await open();
    await page.getByRole('heading', { name: 'Non riesco a caricare il progetto.' }).waitFor();
    failLoad = false; delayLoad = true;
    await page.getByRole('button', { name: 'Riprova', exact: true }).click();
    await page.getByRole('button', { name: 'Caricamento…', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Rispondi a LIA', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Il mio sito', exact: false }).click();
    if (await page.locator('.pro-site-builder').count()) {
      await page.locator('.pro-site-builder').waitFor();
    } else {
      await page.getByRole('heading', { name: 'Il tuo sito, le tue scelte', exact: true }).waitFor();
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(mutations, [], 'home navigation never publishes or generates content');
    console.log('Guided Home browser: primary action, skip, drafts, profile, collapsed details, load failure/retry and mobile layout passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
