// Run against local Vite (port 5178). All API responses are fixtures; no production traffic.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const users = [
  { id: 11, name: 'Studio Aurora', email: 'studio@example.test', slug: 'aurora', plan: 'professional', posts_count: 28, sources_count: 2 },
  { id: 12, name: 'Casa del Borgo', email: 'casa@example.test', slug: 'borgo', plan: 'base', posts_count: 2, sources_count: 1 },
];
function room(id) {
  return { user: { ...users.find(u => u.id === id), site_title: id === 11 ? 'Consulenza e formazione' : 'Ospitalità nel borgo', harmonize_agent: 'content_editor', profile_summary: 'Uno studio che condivide esperienza e consigli concreti.', role_mission: 'Aiutare le persone a scegliere con consapevolezza.', editorial_settings: '{"min_posts":8,"enabled":true}', editorial_last_run: id === 11 ? '2026-09-23 10:30:00' : null },
    stats: { published_posts: id === 11 ? 28 : 2, eligible_posts: id === 11 ? 28 : 2, pending_posts: 3, failed_posts: 0 },
    sources: [{ id: 1, label: 'Il blog dello studio', platform: 'website', url: 'https://example.test/blog', topic_summary: 'Guide e approfondimenti per i clienti' }],
    posts: [{ id: id * 10, generated_title: 'Come preparare il prossimo passo della tua attività', generated_excerpt: 'Una guida pratica per definire priorità e obiettivi partendo dalle informazioni che hai già.', published_at: '2026-09-22 09:30:00', seo_score: 82, noindex: 0 }],
  };
}
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
    let failRoom = false;
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()); const action = url.searchParams.get('action');
      let data = {};
      if (action === 'admin-users') data = { users };
      if (action === 'admin-editorial-room') {
        const id = Number(url.searchParams.get('user_id'));
        await new Promise(r => setTimeout(r, id === 12 ? 600 : 50));
        if (failRoom) return route.fulfill({ status: 503, json: { error: 'Servizio temporaneamente non disponibile' } });
        data = room(id);
      }
      await route.fulfill({ json: data });
    });
    await page.route('**/control-room-fixture', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      </script><script type="module">
      import React from '/node_modules/.vite/deps/react.js';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
      import {AdminScreen} from '/src/screens/AdminScreen.jsx'; import '/src/index.css';
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AdminScreen,{token:'fixture',currentUser:{id:1},adminPrompts:[{id:1,agent_name:'content_editor',label:'Redattore editoriale',instructions:'Mantieni i fatti e la voce del cliente.'}],updatePrompt:async()=>{}}));
      </script></body></html>` }));
    await page.goto('http://127.0.0.1:5178/control-room-fixture');
    await page.locator('.admin-navigation button').filter({ hasText: 'Control Room' }).click();
    await page.getByRole('heading', { name: 'Studio Aurora', exact: true }).waitFor();
    assert.equal(await page.getByText('AI Mail Control Room').count(), 0);
    assert.equal(await page.locator('.cr-metrics strong').nth(1).textContent(), '28');
    assert.equal(await page.getByRole('button', { name: 'Esegui analisi editoriale' }).isEnabled(), true);
    fs.mkdirSync('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/control-room-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Contenuti', exact: true }).last().click();
    await page.getByRole('heading', { name: 'Articoli pubblicati di recente' }).waitFor();
    await page.getByRole('button', { name: 'Configurazione AI', exact: true }).click();
    assert.equal(await page.locator('.cr-technical').getAttribute('open'), null);
    await page.getByRole('button', { name: /Casa del Borgo casa/ }).click();
    await page.getByRole('button', { name: /Studio Aurora studio/ }).click();
    await page.waitForTimeout(800);
    await page.getByRole('heading', { name: 'Studio Aurora', exact: true }).waitFor();
    await page.getByRole('button', { name: /Casa del Borgo casa/ }).click();
    await page.getByRole('heading', { name: 'Casa del Borgo', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Esegui analisi editoriale' }).isDisabled(), true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'artifacts/control-room-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no mobile horizontal overflow');
    assert.ok((await page.locator('.cr-detail').boundingBox()).width > 350, 'mobile detail uses full width');
    await page.getByLabel('Cerca cliente').fill('nessun-risultato');
    await page.getByText('Nessun cliente corrisponde alla ricerca.').waitFor();
    failRoom = true;
    await page.getByRole('button', { name: 'Aggiorna', exact: true }).click();
    await page.getByRole('heading', { name: 'Impossibile caricare il cliente' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Esegui analisi editoriale' }).count(), 0);
    assert.deepEqual(errors, []);
    console.log('Control Room: navigation, totals, stale responses, disabled actions, empty search, loading errors and mobile layout passed.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
