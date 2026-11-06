// Real application, synthetic owner and provider responses. No live imports.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 try {
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  const user={id:22,role:'user',plan:'professional',name:'Studio Aurora',slug:'aurora',email:'fixture@example.test'};
  await context.addInitScript(user=>{localStorage.setItem('sts_user',JSON.stringify(user));localStorage.setItem('sts_token','reading-fixture')},user);
  const page=await context.newPage(); page.setDefaultTimeout(15000);
  const calls=[],errors=[]; page.on('pageerror',error=>errors.push(error.message));
  let failReading=true,failScan=false,scanned=false;
  const reading=()=>({mode:'stored_sample',limited:true,sample_count:1,sources:[{id:1,platform:'instagram',name:'Instagram dello studio',status:'imported',sample_count:1,sample_scope:'platform',last_scan_at:'2026-11-04 15:00:00',last_scan_note:'Un contenuto acquisito.'},{id:2,platform:'website',name:'Sito dello studio',sample_count:0,status:scanned?'error':'never_verified',last_scan_note:scanned?'Scansione non riuscita: sito non accessibile.':''}],samples:[{id:9,platform:'instagram',title:'Come scegliere un percorso',text:'Parti dai bisogni della tua famiglia. <img src=x onerror=alert(1)>',imported_at:'2026-11-04 15:00:00'}],warnings:['Campioni parziali, non una lettura completa.']});
  await page.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),action=url.pathname.endsWith('current_plan.php')?'current_plan':url.searchParams.get('action'),payload=req.method()==='POST'?req.postDataJSON():null;
   calls.push({action,payload});let data={};
   if(['me','current_plan'].includes(action))data={user};
   if(action==='site')data={site:{title:'Studio Aurora',bio:'Formazione per le famiglie.',site_understanding:'{}'},posts:[],sources:[{id:1,platform:'instagram',label:'Instagram dello studio'}],visibility:{}};
   if(['drafts','pending-posts'].includes(action))data=[];
   if(action==='lia-agenda')data={agenda:{tasks:[]}};
   if(action==='lia-reading'){
    if(failReading)return route.fulfill({status:502,json:{error:'Controllo non disponibile.'}});
    data={reading:reading()};
   }
   if(action==='sync'){
    if(failScan)return route.fulfill({status:502,json:{error:'Lettura interrotta.'}});
    scanned=true;data={ok:true,results:[{platform:'instagram',new:1,error:null},{platform:'website',new:0,error:'Sito non accessibile'}]};
   }
   if(action==='lia-assistant')data=payload.intent==='briefing'?{reply:'Partiamo dai contenuti disponibili.',next_step:{title:'Leggiamo cosa racconti già',reason:'Per evitare doppioni.',prompt:'Analizza i testi disponibili.',context_post_id:null},question:null,options:[],actions:[]}:{reply:'Nell’estratto Come scegliere un percorso parli dei bisogni delle famiglie. Il sito resta da leggere.',question:null,options:[],actions:[]};
   await route.fulfill({json:data});
  });
  await page.goto('http://127.0.0.1:5178/dashboard');
  await page.getByRole('button',{name:'Riprova il controllo',exact:true}).waitFor();failReading=false;await page.getByRole('button',{name:'Riprova il controllo',exact:true}).click();
  await page.getByRole('button',{name:'Leggi sito e social',exact:true}).waitFor();
  assert.equal(calls.filter(call=>call.action==='sync').length,0,'Opening or retrying coverage never starts a provider scan');
  await page.locator('.lia-reading-details>summary').click();
  await page.locator('.lia-reading-samples').getByText('Come scegliere un percorso',{exact:true}).waitFor();
  assert.equal(await page.locator('.lia-reading-samples img').count(),0,'Untrusted imported text is displayed as text');
  assert.ok((await page.locator('.lia-reading-details').innerText()).includes('account esatto da verificare'));
  await page.getByRole('button',{name:'Leggi sito e social',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Lettura parziale:'}).waitFor();
  assert.deepEqual(calls.find(call=>call.action==='sync').payload,{limit:10});
  await page.getByText('Ultima lettura non riuscita',{exact:false}).waitFor();
  assert.equal(calls.filter(call=>call.action==='lia-assistant'&&call.payload?.intent!=='briefing').length,0,'A scan does not create an AI plan or analysis automatically');
  failScan=true;await page.getByRole('button',{name:'Leggi sito e social',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Lettura interrotta.'}).waitFor();
  assert.equal(await page.locator('.lia-reading-samples>li').count(),1,'Failed update retains previous samples');
  await page.getByRole('button',{name:'Analizza ciò che hai letto',exact:true}).click();
  await page.getByText('Nell’estratto Come scegliere un percorso parli dei bisogni delle famiglie. Il sito resta da leggere.',{exact:true}).waitFor();
  assert.ok(calls.filter(call=>call.action==='lia-assistant').at(-1).payload.messages.at(-1).text.includes('testi che hai letto'));
  assert.equal(calls.some(call=>/publish|post-create|delete/.test(call.action||'')),false);
  fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/lia-reading-desktop.png',fullPage:true});
  await page.setViewportSize({width:360,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'artifacts/lia-reading-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);await context.close();
  console.log('LIA reading browser: explicit scan, coverage retry, real excerpts, escaped content, partial failure, preserved samples, explicit analysis and mobile passed.');
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
