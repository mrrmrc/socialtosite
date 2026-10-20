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
    let failLoad = false, delayLoad = false, failStudio = false;
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
      if (action === 'article-studio') {
        const brief = route.request().postDataJSON();
        assert.equal(brief.objective, 'Spiegare ai docenti');
        assert.equal(brief.channel, 'Newsletter');
        assert.equal(brief.instructions, 'Niente offerte. Usa esempi di grafici.');
        if (failStudio) return route.fulfill({ status: 502, json: { error: 'Generazione temporaneamente non disponibile' } });
        if (brief.mode === 'proposals') return route.fulfill({ json: { proposals: [1,2].map(index=>({title:`Proposta specifica ${index}`,reason:'Una ricerca recente utile ai docenti.',angle:'Come ascoltare i dati in classe.',outline:['La ricerca','Un grafico','Un esempio'],source_url:'https://example.com/research',source_title:'Ricerca recente sui dati sonori',published_at:'20 ottobre 2026'})),brief } });
        if (brief.proposal) assert.match(brief.subject,/Proposta specifica 1/);
        else assert.equal(brief.subject, 'Sonificazione per studenti');
        return route.fulfill({ json: { articles: (brief.proposal ? [1] : [1,2]).map(index => ({ title: `Articolo completo ${index}`, content: `<p>${'Un esempio concreto per i docenti. '.repeat(70)}</p>`, excerpt: 'Un articolo per i docenti.', tags: ['Scuola'], word_count: 420 })), brief } });
      }
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
    await page.getByRole('heading', { name: 'La tua presenza sul web', exact: true }).waitFor();
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(mutations, [], 'home navigation never publishes or generates content');
    await open();
    await page.getByRole('button', { name: '+ Aggiungi contenuto', exact: true }).waitFor();
    await page.getByRole('navigation', { name: 'Sezioni della piattaforma' }).getByRole('button', { name: /IDEA/ }).waitFor();
    await page.getByRole('button', { name: 'IDEA: crea un articolo', exact: true }).click();
    await page.getByRole('heading', { name: 'Idee e nuovi contenuti', exact: true }).waitFor();
    assert.deepEqual(mutations, [], 'entering IDEA does not generate anything before the brief');
    await page.getByRole('button', { name: /2\. Descrivi e genera 2 articoli/ }).click();
    await page.getByLabel('Di cosa devono parlare i due articoli?').fill('Sonificazione per studenti');
    await page.getByLabel('Obiettivo', { exact: true }).fill('Spiegare ai docenti');
    await page.getByLabel('Destinazione', { exact: true }).selectOption('Newsletter');
    await page.getByLabel('Indicazioni da rispettare', { exact: true }).fill('Niente offerte. Usa esempi di grafici.');
    await page.getByRole('button', { name: 'Scrivi i 2 articoli completi', exact: true }).click();
    for (const index of [1, 2]) await page.getByRole('heading', { name: `Articolo completo ${index}`, exact: true }).waitFor();
    assert.equal(await page.locator('.article-studio-result-grid > article').count(), 2, 'two complete article previews are visible');
    assert.deepEqual(mutations, ['article-studio'], 'one generation request creates no database drafts or publications');
    await page.getByRole('button', { name: 'Apri nell’editor completo', exact: true }).first().click();
    const editor = page.getByRole('dialog', { name: 'Scrivi il tuo articolo', exact: true });
    await editor.waitFor();
    assert.ok((await editor.locator('.ql-editor').innerText()).split(/\s+/).length > 400, 'the generated article reaches the full editor, not a placeholder');
    await editor.getByRole('button', { name: 'Chiudi editor' }).click();
    await page.getByRole('button', { name: /1\. Trova 2 proposte per me/ }).click();
    failStudio = true;
    await page.getByRole('button', { name: 'Genera 2 proposte specifiche', exact: true }).click();
    await page.getByRole('alert').filter({hasText:'Generazione temporaneamente non disponibile'}).waitFor();
    assert.equal(await page.getByLabel('Tema da privilegiare (facoltativo)').inputValue(),'Sonificazione per studenti','failure preserves the exact topic');
    assert.equal(await page.locator('.article-studio-result-grid').count(),0,'a failed new request does not show old articles as new results');
    failStudio = false;
    await page.getByRole('button', { name: 'Genera 2 proposte specifiche', exact: true }).click();
    await page.getByRole('heading',{name:'Proposta specifica 1',exact:true}).waitFor();
    assert.equal(await page.locator('.article-studio-result-grid > article').count(),2,'exactly two proposals');
    assert.equal(await page.getByRole('link',{name:'Fonte recente: Ricerca recente sui dati sonori'}).count(),2,'each proposal has its source');
    await page.getByRole('button',{name:'Scrivi questo articolo completo',exact:true}).first().click();
    await page.getByRole('heading',{name:'Il tuo articolo è pronto',exact:true}).waitFor();
    assert.equal(await page.locator('.article-studio-result-grid > article').count(),1,'a selected proposal becomes one complete article');
    const mutationsBeforeManual=mutations.length;
    await page.getByRole('button',{name:/3\. Scrivi liberamente/}).click();
    await page.getByRole('dialog',{name:'Scrivi il tuo articolo',exact:true}).waitFor();
    assert.equal(mutations.length,mutationsBeforeManual,'free writing opens the full editor without AI or an empty database row');
    await page.getByRole('button',{name:'Chiudi editor',exact:true}).click();
    await page.getByRole('button',{name:'Contenuti',exact:true}).click();
    await page.getByRole('button',{name:'IDEA: crea un articolo',exact:true}).click();
    await page.getByRole('heading',{name:'Il tuo articolo è pronto',exact:true}).waitFor();
    const retainedInstructions = await page.getByLabel('Indicazioni da rispettare', {exact:true}).inputValue({timeout:5000}).catch(async error => { console.error('Navigation state:',await page.locator('body').innerText()); console.error('Fields:',await page.locator('textarea').evaluateAll(nodes=>nodes.map(node=>node.outerHTML)));throw error; });
    assert.equal(retainedInstructions,'Niente offerte. Usa esempi di grafici.','returning to IDEA preserves the brief and generated article');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'AI and manual actions fit on mobile');
    console.log('Guided Home browser: primary action, skip, drafts, profile, collapsed details, load failure/retry and mobile layout passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
