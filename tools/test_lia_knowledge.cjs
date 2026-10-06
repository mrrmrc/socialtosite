// Local browser checks with fixture responses; no production or AI traffic.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge', args: ['--disable-features=LocalNetworkAccessChecks'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
    let answered = false, failSave = false, unavailable = false;
    const moduleSource = await (await fetch('http://127.0.0.1:5178/src/components/LiaKnowledge.jsx')).text();
    const dependencyHash = moduleSource.match(/react\.js\?v=([a-z0-9]+)/)[1];
    const mainSource = await (await fetch('http://127.0.0.1:5178/src/main.jsx')).text();
    const rendererHash = mainSource.match(/react-dom_client\.js\?v=([a-z0-9]+)/)[1];
    await page.route('**/api/**', async route => {
      const action = new URL(route.request().url()).searchParams.get('action');
      if (action === 'site-update') {
        if (failSave) return route.fulfill({ status: 503, json: { error: 'Salvataggio non riuscito' } });
        const updates = route.request().postDataJSON().site_understanding_corrections.declared_strategy;
        assert.equal(updates.primary_audience, 'Genitori con bambini piccoli'); answered = true;
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: { ok: true, review: { coverage: answered ? 100 : 90, score: unavailable ? null : answered ? 100 : 90, reviewed: !unavailable,
        summary: unavailable ? 'Revisione AI non disponibile.' : 'Conosco l’attività: serve precisare il pubblico.',
        fields: [{ key: 'activity_type', label: 'Attività', value: 'Consulenza educativa', status: unavailable ? 'present' : 'clear' },
          { key: 'primary_audience', label: 'Pubblico', value: answered ? 'Genitori con bambini piccoli' : '', status: answered ? 'clear' : 'missing', question: 'Quali genitori vuoi raggiungere?' }] } } });
    });
    await page.route('**/lia-fixture', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div>
      <script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;</script>
      <script type="module">import React from '/node_modules/.vite/deps/react.js?v=${dependencyHash}'; import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js?v=${rendererHash}'; import {LiaKnowledge,useLiaKnowledge} from '/src/components/LiaKnowledge.jsx'; import {apiFetch} from '/src/utils/api.js'; import '/src/index.css';
      function Fixture(){const [site,setSite]=React.useState({site_understanding:'initial'});const knowledge=useLiaKnowledge(site,'fixture');return React.createElement('main',{style:{maxWidth:1000,margin:'24px auto',padding:16}},React.createElement(LiaKnowledge,{knowledge,onProfile:()=>{},onSave:async updates=>{await apiFetch('/api/index.php?action=site-update',{method:'POST',body:JSON.stringify({site_understanding_corrections:{declared_strategy:updates}})},'fixture');setSite({site_understanding:JSON.stringify(updates)});}}));}ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Fixture));</script></body></html>` }));
    await page.goto('http://127.0.0.1:5178/lia-fixture');
    await page.getByText('90%', { exact: true }).waitFor();
    await page.getByLabel(/Per proporti contenuti più precisi/).fill('Genitori con bambini piccoli');
    failSave = true;
    await page.getByRole('button', { name: 'Salva e aggiorna la conoscenza' }).click();
    await page.getByRole('alert').filter({ hasText: 'Salvataggio non riuscito' }).waitFor();
    assert.equal(await page.locator('textarea').inputValue(), 'Genitori con bambini piccoli');
    failSave = false;
    await page.getByRole('button', { name: 'Salva e aggiorna la conoscenza' }).click();
    await page.getByText('100%', { exact: true }).waitFor();
    assert.equal(await page.locator('textarea').count(), 0);
    fs.mkdirSync('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/lia-knowledge-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'artifacts/lia-knowledge-mobile.png', fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal mobile overflow');
    unavailable = true;
    await page.getByRole('button', { name: 'Verifica di nuovo con LIA' }).click();
    await page.getByText('in attesa di verifica', { exact: true }).waitFor();
    assert.equal(await page.getByText('100%', { exact: true }).count(), 0, 'no false AI knowledge percentage when provider fails');
    assert.deepEqual(errors, []);
    const dashboard = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    dashboard.on('pageerror', error => errors.push(error.message));
    await dashboard.route('**/api/**', route => {
      const action = new URL(route.request().url()).searchParams.get('action');
      const site = { title: 'Studio educativo', site_understanding: JSON.stringify({ declared_strategy: { activity_type: 'Consulenza educativa', primary_audience: 'Genitori', primary_goal: 'Informare' } }) };
      const data = action === 'site' ? { site, posts: [], sources: [], visibility: {}, reachability: { profile: {} } } : action === 'lia-profile-review' ? { ok: true, review: { coverage: 30, score: 30, reviewed: true, summary: 'Servono altri dettagli.', fields: [] } } : { ok: true, plans: [], questions: [], sources: [], posts: [] };
      return route.fulfill({ json: data });
    });
    await dashboard.route('**/dashboard-fixture', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div>
      <script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;</script>
      <script type="module">import React from '/node_modules/.vite/deps/react.js?v=${dependencyHash}'; import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js?v=${rendererHash}'; import {DashboardScreen} from '/src/screens/DashboardScreen.jsx'; import '/src/index.css'; ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(DashboardScreen,{token:'fixture',user:{id:1,name:'Studio educativo',slug:'studio',plan:'professional',role:'user'},onLogout:()=>{}}));</script></body></html>` }));
    await dashboard.goto('http://127.0.0.1:5178/dashboard-fixture');
    await dashboard.getByRole('button', { name: /LIA conosce il profilo al 30/ }).click();
    await dashboard.getByRole('heading', { name: 'Cosa prepariamo oggi?' }).waitFor();
    await dashboard.getByRole('heading', { name: 'LIA, quanto conosci il mio profilo?' }).waitFor();
    assert.equal(await dashboard.getByLabel('Focus del momento').count(), 1);
    await dashboard.screenshot({ path: 'artifacts/lia-ideas-dashboard.png', fullPage: true });
    await dashboard.setViewportSize({ width: 390, height: 844 });
    await dashboard.screenshot({ path: 'artifacts/lia-ideas-dashboard-mobile.png', fullPage: true });
    assert.ok(await dashboard.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'dashboard has no horizontal mobile overflow');
    assert.deepEqual(errors, []);
    console.log('PASS: questions, save failures, persisted answers, renewed review, mobile layout and unavailable AI.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
