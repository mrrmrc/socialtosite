// Local fixture only. No live account, AI provider or publication requests.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], operations = [];
    page.on('pageerror', error => errors.push(error.message));
    const card = { id:'reuse-7', title:'Riporta sui social un contenuto utile', reason:'Un tuo lavoro già pubblicato può aiutare le persone a capire ciò che fai.', evidence:{kind:'observed',label:'Contenuto proprio pubblicato'}, next_action:{type:'reuse_content',post_id:7}, measurement:'Osserva visite e clic dopo la condivisione.' };
    let fail = false;
    await page.route('**/api/**', async route => {
      const action = new URL(route.request().url()).searchParams.get('action');
      operations.push({ action, body: route.request().postDataJSON() });
      if (action === 'opportunity-prepare') return route.fulfill(fail ? {status:502,json:{error:'Provider temporaneamente non disponibile'}} : {json:{opportunity:card,brief:{title:'Un progetto raccontato bene',reason:'Presenta il lavoro con informazioni verificate.',objective:'Mostrare competenze',social_angle:'Mostra un dettaglio concreto.',format:'Carosello',questions:['Quale dettaglio posso citare?'],source_post_id:7}}});
      return route.fulfill({json:{ok:true}});
    });
    await page.route('**/opportunity-fixture', route => route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;</script><script type="module">import React from '/node_modules/.vite/deps/react.js'; import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js'; import {OpportunityWorkspace} from '/src/components/OpportunityWorkspace.jsx'; import '/src/index.css'; window.calls=[]; const card=${JSON.stringify(card)}; ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(OpportunityWorkspace,{data:{site:{profile_summary:'Studio',site_understanding:{declared_strategy:{primary_goal:'Presentare lavori e competenze'}}},opportunities:[card,{...card,id:'hypothesis',title:'Prova una domanda',evidence:{kind:'hypothesis',label:'Da verificare'}}],visibility:{}},token:'fixture',onRefresh:async()=>{},onNavigate:v=>window.calls.push(['navigate',v]),onCreateWeb:async b=>window.calls.push(['web',b]),onCreateSocial:async(b,p)=>window.calls.push(['social',b,p]),onOpenPost:(id,b)=>window.calls.push(['open',id,b])}));</script></body></html>`}));
    await page.goto('http://127.0.0.1:5178/opportunity-fixture');
    await page.getByRole('heading',{name:'Il tuo prossimo passo per farti trovare.'}).waitFor();
    assert.equal(operations.length,0,'No paid generation on initial load');
    await page.getByText('Ipotesi da verificare',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Prepara con LIA'}).first().click();
    await page.getByLabel('Proposta preparata da LIA',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'IDEA: prepara il post social'}).isDisabled(),true,'Missing facts block generation');
    await page.getByLabel('Quale dettaglio posso citare?').fill('Il progetto usa materiali recuperati.');
    await page.getByLabel('Social per la proposta',{exact:true}).selectOption('linkedin');
    await page.getByRole('button',{name:'IDEA: prepara il post social'}).click();
    const calls=await page.evaluate(()=>window.calls);
    assert.equal(calls[0][0],'social'); assert.equal(calls[0][2],'linkedin'); assert.equal(calls[0][1].source_post_id,7); assert.match(calls[0][1].reason,/materiali recuperati/);
    await page.getByRole('button',{name:'Prepara la bozza web'}).click();
    assert.equal((await page.evaluate(()=>window.calls))[1][0],'web');
    await page.getByLabel('Che cosa vuoi ottenere adesso?').fill('Ricevere richieste per un nuovo servizio');
    await Promise.all([page.waitForResponse(response=>response.url().includes('action=site-update')),page.getByRole('button',{name:'Salva obiettivo'}).click()]);
    assert.equal(operations.find(item=>item.action==='site-update').body.site_understanding_corrections.declared_strategy.primary_goal,'Ricevere richieste per un nuovo servizio');
    fs.mkdirSync('artifacts',{recursive:true});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'artifacts/opportunities-mobile.png',fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No mobile horizontal overflow');
    await page.getByRole('button',{name:'Chiudi proposta'}).click();
    fail=true;
    await page.getByRole('button',{name:'Prepara con LIA'}).first().click();
    await page.getByRole('alert').filter({hasText:'Provider temporaneamente non disponibile'}).waitFor();
    assert.equal(await page.getByLabel('Proposta preparata da LIA',{exact:true}).count(),0,'Failed generation cannot leave an executable proposal');
    assert.equal(operations.filter(item=>/publish|create-idea|social-content/.test(item.action)).length,0,'Only explicit callbacks, no hidden publication');
    assert.deepEqual(errors,[]);
    console.log('Opportunity browser: evidence labels, no auto-generation, source retention, missing facts, goal save, social/web actions, failure and mobile passed.');
  } finally { await browser.close(); }
})().catch(error=>{ console.error(error); process.exit(1); });
