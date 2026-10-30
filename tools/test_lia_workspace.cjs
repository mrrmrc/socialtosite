// Real App and customer shell, synthetic account, every API request intercepted.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = 'http://127.0.0.1:5178';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const user = { id: 22, role: 'user', plan: 'base', name: 'Cliente', email: 'cliente@example.test', slug: 'cliente' };
    await context.addInitScript(user => { localStorage.setItem('sts_token', 'lia-fixture-token'); localStorage.setItem('sts_user', JSON.stringify(user)); }, user);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    let mode = 'article', failChat = false, failGeneration = true;
    const article = { title: 'Come scegliere un percorso di formazione', excerpt: 'Una guida concreta per le famiglie.', content: '<p>' + Array(420).fill('formazione').join(' ') + '</p>', tags: ['formazione'], word_count: 420 };
    const fixture = { site: { title: 'Studio Aurora', bio: 'Formazione per le famiglie.', profile_summary: 'Formazione per le famiglie.' }, sources: [], posts: [], visibility: {} };
    const brief = { subject: 'Come scegliere un percorso di formazione per i propri figli', title: article.title, objective: 'Aiutare i genitori a scegliere', audience: 'Genitori', style: 'Chiaro e pratico', length: '400-600 parole' };
    await page.route('**/api/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const action = url.pathname.endsWith('current_plan.php') ? 'current_plan' : url.searchParams.get('action');
      const payload = request.method() === 'POST' ? request.postDataJSON() : null;
      requests.push({ action, payload });
      let data = {};
      if (action === 'me' || action === 'current_plan') data = { user };
      if (action === 'site') data = fixture;
      if (action === 'drafts' || action === 'pending-posts') data = [];
      if (action === 'lia-assistant') {
        if (failChat) return route.fulfill({ status: 502, json: { error: 'LIA è temporaneamente indisponibile. Le tue parole restano qui.' } });
        if (mode === 'revision') {
          assert.equal(payload.work.article.title, article.title);
          assert.ok(payload.work.article.content.includes('formazione'), 'The actual draft is supplied for a follow-up request');
          assert.equal('id' in payload.work.article, false, 'Draft context carries content, not an editable account identifier');
        }
        data = { version: 1, reply: mode !== 'profile' ? 'Ti propongo una guida pratica per aiutare le famiglie a scegliere.' : 'Ti propongo una presentazione più chiara usando le informazioni che mi hai dato.', question: null, options: [], operations_executed: [], actions: mode !== 'profile'
          ? [{ id: 'prepare-article-1', type: 'prepare_article', label: 'Prepara la bozza', brief: mode === 'revision' ? { ...brief, revise_current: true, instructions: 'Aggiungi un esempio concreto.', source_text: article.content.replace(/<[^>]+>/g, '') } : brief, requires_confirmation: true }]
          : [{ id: 'propose-profile-1', type: 'propose_profile', label: 'Rivedi la presentazione', changes: { title: 'Studio Aurora Formazione', bio: 'Aiutiamo le famiglie a scegliere percorsi di formazione.' }, requires_confirmation: true, affects_public_site: true }] };
      }
      if (action === 'article-studio') {
        assert.equal(payload.mode, 'articles'); assert.equal(payload.subject, brief.subject); assert.equal(payload.proposal.title, brief.title);
        if (mode === 'revision') assert.ok(payload.source_text.includes('formazione') && payload.instructions.includes('Aggiungi un esempio concreto.'), 'Generation receives the original article and the requested changes');
        await new Promise(resolve => setTimeout(resolve, 150));
        if (failGeneration) return route.fulfill({ status: 502, json: { error: 'La preparazione non è riuscita. Puoi riprovare.' } });
        data = { articles: [article], brief: payload };
      }
      if (action === 'post-create') {
        assert.equal(payload.edited_title, article.title);
        assert.equal(payload.published === 1, false);
        await new Promise(resolve => setTimeout(resolve, 150));
        fixture.posts = [{ id: 321, ...payload, tags: article.tags, published: 0, seo_score: 10, processing_status: 'done' }];
        data = { ok: true, id: 321 };
      }
      if (action === 'site-update') {
        assert.deepEqual(Object.keys(payload).sort(), ['bio', 'title']);
        await new Promise(resolve => setTimeout(resolve, 150));
        Object.assign(fixture.site, payload); data = { ok: true };
      }
      await route.fulfill({ json: data });
    });
    const appModule = await (await fetch(base + '/src/App.jsx')).text();
    const mainModule = await (await fetch(base + '/src/main.jsx')).text();
    const reactHash = appModule.match(/react\.js\?v=([a-z0-9]+)/)?.[1];
    const rendererHash = mainModule.match(/react-dom_client\.js\?v=([a-z0-9]+)/)?.[1];
    assert.ok(reactHash && rendererHash);
    const document = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module">import React from '/node_modules/.vite/deps/react.js?v=${reactHash}';import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js?v=${rendererHash}';import App from '/src/App.jsx';ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));</script></body></html>`;
    await page.route('**/*', async route => { if (route.request().resourceType() === 'document' && new URL(route.request().url()).origin === base) return route.fulfill({ contentType: 'text/html', body: document }); return route.fallback(); });
    await page.goto(base + '/dashboard');
    await page.getByRole('heading', { name: 'La tua redazione, ogni giorno.', exact: true }).waitFor();
    await page.waitForTimeout(150);
    assert.equal(requests.filter(item => item.payload).length, 0, 'Opening a project does not launch AI or save changes');
    const nav = page.getByRole('navigation', { name: 'Sezioni della piattaforma' });
    assert.deepEqual(await nav.locator('.tab-label').allTextContents(), ['LIA', 'Contenuti', 'Il sito', 'SEO e GEO', 'Canali']);
    fs.mkdirSync('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/lia-entry-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Non so da dove iniziare', exact: true }).click();
    assert.equal(requests.some(item => item.action === 'lia-assistant'), false, 'A beginner can choose a path before spending AI credit');
    await page.getByRole('textbox', { name: 'Scrivi a LIA', exact: true }).fill('Vorrei spiegare ai genitori come scegliere un percorso di formazione per i figli.');
    await page.getByRole('button', { name: 'Invia a LIA', exact: true }).click();
    const prepare = page.locator('button[data-lia-action="prepare_article"]');
    await prepare.waitFor();
    assert.equal(requests.some(item => ['article-studio', 'post-create', 'site-update'].includes(item.action)), false, 'An AI proposal does not execute itself');
    await prepare.evaluate(button => { button.click(); button.click(); });
    await page.getByRole('alert').filter({ hasText: 'La preparazione non è riuscita' }).waitFor();
    assert.equal(requests.filter(item => item.action === 'article-studio').length, 1, 'A rapid double click causes only one generation');
    failGeneration = false;
    await page.getByRole('button', { name: /Riprova/ }).click();
    await page.getByRole('heading', { name: 'La tua bozza', exact: true }).waitFor();
    assert.equal(requests.some(item => item.action === 'post-create'), false, 'Reading the generated text does not save or publish it');
    await page.getByRole('button', { name: 'Salva bozza', exact: true }).evaluate(button => { button.click(); button.click(); });
    await page.waitForResponse(response => new URL(response.url()).searchParams.get('action') === 'site');
    assert.equal(requests.filter(item => item.action === 'post-create').length, 1, 'The draft is saved once after explicit intent');
    await nav.getByRole('button', { name: 'Contenuti', exact: true }).click();
    await nav.getByRole('button', { name: 'LIA', exact: true }).click();
    await page.getByRole('heading', { name: 'La tua bozza', exact: true }).waitFor();
    assert.equal(requests.filter(item => item.action === 'article-studio').length, 2, 'Returning to LIA preserves the result without regenerating it');
    mode = 'revision';
    await page.getByRole('textbox', { name: 'Scrivi a LIA', exact: true }).fill('Rendi questa bozza più pratica e aggiungi un esempio concreto.');
    await page.getByRole('button', { name: 'Invia a LIA', exact: true }).click();
    const revise = page.locator('button[data-lia-action="prepare_article"]').last();
    await revise.waitFor();
    assert.equal(requests.filter(item => item.action === 'article-studio').length, 2, 'A refinement proposal waits for the user to start writing');
    await revise.click();
    await page.getByRole('heading', { name: 'La tua bozza', exact: true }).nth(1).waitFor();
    assert.equal(requests.filter(item => item.action === 'post-create').length, 1, 'A revised preview does not overwrite or automatically save the previous draft');
    mode = 'profile'; failChat = true;
    await page.getByRole('textbox', { name: 'Scrivi a LIA', exact: true }).fill('Vorrei presentare meglio la mia attività sul sito.');
    await page.getByRole('button', { name: 'Invia a LIA', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'LIA è temporaneamente indisponibile' }).waitFor();
    failChat = false;
    await page.getByRole('button', { name: /Riprova/ }).click();
    const confirm = page.getByRole('button', { name: 'Conferma e salva la presentazione', exact: true });
    await confirm.waitFor();
    assert.equal(requests.some(item => item.action === 'site-update'), false, 'Public presentation changes wait for confirmation');
    await confirm.evaluate(button => { button.click(); button.click(); });
    await page.waitForResponse(response => new URL(response.url()).searchParams.get('action') === 'site');
    assert.equal(requests.filter(item => item.action === 'site-update').length, 1);
    assert.equal(requests.some(item => /publish|toggle-publish|delete/.test(item.action)), false, 'The conversation never silently publishes or deletes content');
    const chatCalls = requests.filter(item => item.action === 'lia-assistant').length;
    await nav.getByRole('button', { name: 'Il sito', exact: true }).click();
    await Promise.all([page.waitForResponse(response => new URL(response.url()).searchParams.get('action') === 'lia-assistant'), page.getByRole('button', { name: 'Chiedi una modifica a LIA', exact: true }).click()]);
    assert.equal(requests.filter(item => item.action === 'lia-assistant').length, chatCalls + 1, 'The explicit contextual action starts the assistant once');
    await page.getByRole('textbox', { name: 'Scrivi a LIA', exact: true }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#lia-workspace-input').disabled);
    mode = 'selected';
    await Promise.all([page.waitForResponse(response => new URL(response.url()).searchParams.get('action') === 'lia-assistant'), page.getByRole('button', { name: 'Analizza e migliora', exact: true }).click()]);
    assert.equal(requests.filter(item => item.action === 'lia-assistant').at(-1).payload.context_post_id, 321, 'Review sends the selected article ID so its actual source is loaded by the server');
    await page.getByText('Al lavoro su', { exact: false }).waitFor();
    await page.waitForFunction(() => !document.querySelector('#lia-workspace-input').disabled);
    await page.getByRole('textbox', { name: 'Scrivi a LIA', exact: true }).fill('Proponimi anche due titoli alternativi per questo articolo.');
    await Promise.all([page.waitForResponse(response => new URL(response.url()).searchParams.get('action') === 'lia-assistant'), page.getByRole('button', { name: 'Invia a LIA', exact: true }).click()]);
    assert.equal(requests.filter(item => item.action === 'lia-assistant').at(-1).payload.context_post_id, 321, 'Follow-up keeps the selected article as working context');
    await page.waitForFunction(() => !document.querySelector('#lia-workspace-input').disabled);
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); });
    await page.screenshot({ path: 'artifacts/lia-workspace-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'artifacts/lia-workspace-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Guided conversation fits mobile');
    assert.deepEqual(errors, [], 'No runtime errors through guided chat, retry, draft and presentation confirmation');
    await page.getByRole('button', { name: 'Nuova conversazione', exact: true }).click();
    await page.getByRole('button', { name: 'Non so da dove iniziare', exact: true }).waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'artifacts/lia-entry-mobile.png', fullPage: true });
    await context.close();
    console.log('LIA workspace: novice entry, no automatic actions, generation/retry, grounded draft revisions, single explicit save, preserved conversation, public-change confirmation and mobile passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
