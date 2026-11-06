// The real application with synthetic account data; no live account writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const user={id:22,role:'user',plan:'professional',name:'Studio Aurora',slug:'aurora',email:'fixture@example.test'};
  await context.addInitScript(user=>{localStorage.setItem('sts_user',JSON.stringify(user));localStorage.setItem('sts_token','agenda-fixture')},user);
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
  let agenda={tasks:[]},failPlan=false;
  const posts=[{id:321,platform:'manual',edited_title:'Una guida per le famiglie',edited_body:'<p>Una guida concreta.</p>',published:0,seo_score:80}];
  await page.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),action=url.pathname.endsWith('current_plan.php')?'current_plan':url.searchParams.get('action');const payload=req.method()==='POST'?req.postDataJSON():null;calls.push({action,payload});let data={};
   if(['me','current_plan'].includes(action))data={user};
   if(action==='site')data={site:{title:'Studio Aurora',bio:'Formazione per le famiglie.',openpage_config:'',site_understanding:'{}'},posts,sources:[{id:1,platform:'instagram',url:'https://instagram.com/fixture',label:'Instagram Aurora'}],visibility:{}};
   if(['drafts','pending-posts'].includes(action))data=[];
   if(action==='lia-reading')data={reading:{sources:[],samples:[],sample_count:0,limited:true,mode:'stored_sample',warnings:[]}};
   if(action==='lia-agenda'){
    if(payload?.operation==='generate'){
     if(failPlan)return route.fulfill({status:502,json:{error:'Piano non disponibile. Il precedente è conservato.'}});
     agenda={id:'plan-fixture',goal:payload.goal,timezone:'Europe/Rome',schedule_mode:'suggested',strategy:{status:'proposed',summary:'Una guida utile, promossa sui social.',audience:'Genitori',positioning:'Percorsi di formazione chiari',tone:'Rassicurante',resources:'Due ore alla settimana',goals:payload.goal,pillars:['Scelte consapevoli'],channels:['Sito web','Instagram'],frequency:['Un articolo e due post'],kpis:['Richieste ricevute'],evidence:['Profilo dello studio'],assumptions:['Disponibilità da confermare'],missing_info:['Materiali fotografici da fornire']},tasks:['editorial','social','seo','geo'].map((role,i)=>({id:'task-'+i,role,title:['Rivedi la guida per le famiglie','Prepara un post Instagram','Migliora il titolo della guida','Chiarisci la presentazione dello studio'][i],reason:'Una priorità basata sui tuoi contenuti.',brief:'Lavora su un risultato concreto per le famiglie.',date:'2026-11-0'+(i===2?6:6+i),time:i===1?'18:30':'',channel:i===1?'instagram':'site',format:i===1?'Post':'Articolo',campaign:'Percorsi per le famiglie',deliverable:i===1?'Post che promuove la guida sul sito':'Guida utile alle famiglie',measure:'Confrontare le richieste ricevute',post_id:i===0?321:null,status:'todo',kind:i<2?'content':'activity',audience:'Genitori',objective:'Conoscere i percorsi',copy:'Una guida per scegliere con consapevolezza.',materials:'Foto autorizzate',visual_brief:'Una copertina chiara',owner:'Responsabile studio',execution_mode:'ai',evidence:'Profilo disponibile',missing_info:'Verificare le disponibilità'}))};
    }
    if(payload?.operation==='approve_strategy')agenda={...agenda,strategy:{...agenda.strategy,status:'approved'}};
    if(payload?.operation==='revise_task'){const resultsOnly=Object.keys(payload.changes).every(key=>['result_notes','results_source','results_period'].includes(key));agenda={...agenda,tasks:agenda.tasks.map(task=>task.id===payload.task_id?{...task,...payload.changes,status:resultsOnly?task.status:'in_progress'}:task)}};
    if(payload?.operation==='update')agenda={...agenda,tasks:agenda.tasks.map(task=>task.id===payload.task_id?{...task,status:payload.status}:task)};
    data={agenda};
   }
   if(action==='lia-assistant')data={reply:'Ecco una bozza concreta per il tuo canale.',question:null,options:[],actions:payload.intent==='social'?[{id:'social-1',type:'social_draft',platform:'instagram',caption:'Una scelta consapevole parte dalle domande giuste. Scopri la nostra guida per le famiglie.',hashtags:['#formazione','#famiglie']}]:[]};
   if(action==='post-create')data={ok:true,id:555};
   await route.fulfill({json:data});
  });
  await page.goto('http://127.0.0.1:5178/dashboard');
  await page.getByRole('heading',{name:'Facciamo un passo insieme.',exact:true}).waitFor();
  assert.equal(await page.locator('.lw-statistics-panel').isVisible(),false,'Statistics stay in their menu panel, outside the initial guided workspace');
  await page.locator('.lw-briefing-report').waitFor();
  assert.equal(calls.filter(call=>call.payload).length,1,'Opening the workspace prepares one briefing without generating or saving a plan');
  assert.equal(calls.find(call=>call.payload).payload.intent,'briefing');
  await page.getByRole('button',{name:'Apri il calendario editoriale',exact:true}).click();
  await page.getByLabel('Il risultato su cui lavoriamo',{exact:true}).fill('Aiutare le famiglie a conoscere i nostri percorsi');
  await page.getByRole('button',{name:'Prepara il calendario con LIA',exact:true}).click();
  await page.getByRole('list',{name:'Piano di lavoro di LIA'}).waitFor();
  assert.equal(await page.locator('.lia-agenda-tasks>li').count(),4);
  await page.getByRole('heading',{name:'La strategia proposta da LIA',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Lavora con LIA su questa priorità',exact:true}).isDisabled(),true,'A proposed strategy gates task execution');
  assert.equal(await page.getByLabel('Stato: Rivedi la guida per le famiglie',{exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Approva la strategia',exact:true}).click();
  await page.locator('.lia-strategy-toggle>summary').filter({hasText:'Strategia approvata'}).waitFor();
  assert.equal(await page.locator('.lia-strategy-toggle').getAttribute('open'),null,'Approved strategy collapses after approval');
  const calendar=page.locator('.lia-editorial-calendar');
  assert.equal(await calendar.locator('.lec-days.is-week .lec-day').count(),7);
  assert.equal(await calendar.locator('[data-calendar-day="2026-11-06"] .lec-task').count(),2,'Multiple tasks share their correct day');
  await calendar.getByLabel('Filtra per canale',{exact:true}).selectOption('instagram');assert.equal(await calendar.locator('.lec-task').count(),1);
  await calendar.getByLabel('Filtra per stato',{exact:true}).selectOption('approved');await calendar.getByText('Nessuna attività corrisponde ai filtri selezionati.',{exact:true}).waitFor();
  await calendar.getByLabel('Filtra per canale',{exact:true}).selectOption('all');await calendar.getByLabel('Filtra per stato',{exact:true}).selectOption('all');
  await calendar.getByRole('button',{name:'Settimana successiva',exact:true}).click();await calendar.getByRole('button',{name:'Apri attività: Chiarisci la presentazione dello studio',exact:true}).waitFor();
  await calendar.getByRole('button',{name:'Settimana precedente',exact:true}).click();
  await calendar.getByRole('button',{name:'Oggi',exact:true}).click();assert.equal(await calendar.locator('.lec-day.is-today').count(),1);
  await calendar.getByRole('button',{name:'Torna al piano',exact:true}).click();
  await calendar.getByRole('button',{name:'Mese',exact:true}).click();assert.ok((await calendar.locator('.lec-days.is-month .lec-day').count())>=28);
  const monthTitle=await calendar.locator('.lec-navigation>strong').innerText();await calendar.getByRole('button',{name:'Mese successivo',exact:true}).click();assert.notEqual(await calendar.locator('.lec-navigation>strong').innerText(),monthTitle);await calendar.getByRole('button',{name:'Mese precedente',exact:true}).click();assert.equal(await calendar.locator('.lec-navigation>strong').innerText(),monthTitle);
  await page.setViewportSize({width:360,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Month grid fits mobile');
  await calendar.getByRole('button',{name:'Mostra giorno: 6 novembre 2026, 2 attività',exact:true}).click();assert.equal(await calendar.locator('.lec-selected-day .lec-task').count(),2);
  await calendar.screenshot({path:'artifacts/lia-editorial-calendar-month-mobile.png',style:'.backend-header{visibility:hidden!important}'});
  await page.setViewportSize({width:1440,height:1000});await calendar.getByRole('button',{name:'Settimana',exact:true}).click();
  await calendar.getByRole('button',{name:'Apri attività: Rivedi la guida per le famiglie',exact:true}).click();
  assert.equal(await page.locator('#lia-plan-task-task-0>.lia-task-card').getAttribute('open'),'','Clicking the calendar opens the matching task card');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'lia-plan-task-task-0','Calendar task selection moves keyboard focus to its card');
  assert.ok(await page.locator('.lia-agenda-tasks').innerText().then(value=>value.includes('18:30')&&value.includes('Come lo verifichiamo')));
  assert.ok((await page.locator('.lia-agenda-schedule-note').allTextContents()).some(value=>value.includes('non programma pubblicazioni')));
  fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/lia-proactive-plan-desktop.png',fullPage:true});
  await calendar.screenshot({path:'artifacts/lia-editorial-calendar-week.png',style:'.backend-header{visibility:hidden!important}'});await page.locator('.lia-agenda-tasks>li').first().screenshot({path:'artifacts/lia-smm-task.png'});
  await page.setViewportSize({width:360,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Plan and campaign details fit mobile');await page.screenshot({path:'artifacts/lia-proactive-plan-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
  const first=page.locator('.lia-agenda-tasks>li').first();await first.locator('.lia-task-editor>summary').click();
  await first.getByLabel('Testo proposto',{exact:true}).fill('Testo della guida rivisto con LIA.');
  await first.getByLabel('Risultati osservati',{exact:true}).fill('Tre richieste annotate dal responsabile.');await first.getByLabel('Fonte dei risultati',{exact:true}).fill('Registro manuale contatti');await first.getByLabel('Periodo osservato',{exact:true}).fill('Settimana precedente');
  await first.getByLabel('Data proposta',{exact:true}).fill('2026-11-08');await first.getByLabel('Orario proposto',{exact:true}).fill('09:30');
  await first.getByRole('button',{name:'Salva la revisione',exact:true}).click();
  await first.locator('dd').filter({hasText:'Testo della guida rivisto con LIA.'}).waitFor();
  const revised=calls.find(call=>call.payload?.operation==='revise_task').payload;assert.equal(revised.changes.copy,'Testo della guida rivisto con LIA.');assert.equal(revised.changes.time,'09:30');assert.equal('kind' in revised.changes,false,'Unchanged content fields are omitted');
  assert.equal(revised.changes.results_source,'Registro manuale contatti');assert.equal(revised.changes.results_period,'Settimana precedente');assert.ok(revised.changes.result_notes.includes('Tre richieste'));await first.getByText('Risultati dichiarati manualmente dal responsabile; non verificati dalla piattaforma.',{exact:true}).waitFor();
  const status=page.getByLabel('Stato: Rivedi la guida per le famiglie',{exact:true});
  assert.notEqual(await status.locator('option[value="done"]').getAttribute('disabled'),null,'A content task must pass revision and approval before completion');
  await Promise.all([page.waitForResponse(response=>response.request().method()==='POST'&&response.request().postDataJSON()?.status==='in_review'),status.selectOption('in_review')]);
  await Promise.all([page.waitForResponse(response=>response.request().method()==='POST'&&response.request().postDataJSON()?.status==='approved'),status.selectOption('approved')]);
  await status.selectOption('done');
  await page.getByText('1/4 attività completate',{exact:true}).waitFor();
  await page.reload();await page.getByRole('button',{name:'Piano delle attività',exact:true}).click();await page.locator('.lia-editorial-calendar').getByRole('button',{name:'Apri attività: Rivedi la guida per le famiglie',exact:true}).click();await page.getByLabel('Stato: Rivedi la guida per le famiglie',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Stato: Rivedi la guida per le famiglie',{exact:true}).inputValue(),'done','Progress survives reload');
  const completed=page.locator('.lia-agenda-tasks>li').first();await completed.locator('.lia-task-editor>summary').click();await completed.getByLabel('Risultati osservati',{exact:true}).fill('Quattro richieste annotate dal responsabile.');await completed.getByRole('button',{name:'Salva la revisione',exact:true}).click();await completed.locator('dd').filter({hasText:'Quattro richieste annotate dal responsabile.'}).waitFor();assert.deepEqual(Object.keys(calls.filter(call=>call.payload?.operation==='revise_task').at(-1).payload.changes),['result_notes']);assert.equal(await page.getByLabel('Stato: Rivedi la guida per le famiglie',{exact:true}).inputValue(),'done','Recording results preserves task completion');
  failPlan=true;await page.getByRole('button',{name:'Riorganizza i prossimi 7 giorni',exact:true}).click();await page.getByRole('alert').filter({hasText:'Piano non disponibile'}).waitFor();assert.equal(await page.locator('.lia-agenda-tasks>li').count(),4,'Provider errors retain the previous plan');
  await page.locator('.lia-editorial-calendar').getByRole('button',{name:'Apri attività: Prepara un post Instagram',exact:true}).click();await page.locator('.lia-agenda-tasks>li').nth(1).getByRole('button',{name:'Lavora su questo',exact:true}).click();await page.getByRole('heading',{name:'La tua bozza social',exact:true}).waitFor();
  assert.equal(calls.filter(call=>call.action==='lia-assistant').at(-1).payload.intent,'social');
  assert.equal(calls.filter(call=>call.action==='lia-assistant').at(-1).payload.context_plan_id,'plan-fixture');assert.equal(calls.filter(call=>call.action==='lia-assistant').at(-1).payload.context_task_id,'task-1');
  const taskRequest=calls.filter(call=>call.action==='lia-assistant').at(-1).payload.messages.at(-1).text;
  assert.ok(taskRequest.includes('18:30')&&taskRequest.includes('Post che promuove la guida sul sito')&&taskRequest.includes('Percorsi per le famiglie'),'Starting a task keeps its campaign, deliverable and suggested timing');
  await page.getByRole('button',{name:'Salva la bozza social',exact:true}).click();await page.getByText('Bozza salvata nei contenuti.',{exact:true}).waitFor();assert.ok(calls.find(call=>call.action==='post-create').payload.edited_body.includes('Una scelta consapevole'));
  const saved=calls.find(call=>call.action==='post-create').payload;assert.equal(saved.content_type,'social');assert.equal(saved.platform,'instagram');assert.equal(saved.noindex,1);assert.ok(saved.tags.includes('lia-social:instagram'));
  await page.getByRole('button',{name:'Piano delle attività',exact:true}).click();
  await page.getByText('Altre competenze di LIA',{exact:true}).click();
  await Promise.all([page.waitForResponse(response=>new URL(response.url()).searchParams.get('action')==='lia-assistant'),page.getByRole('button',{name:/Community manager Risposte/}).click()]);
  const community=calls.filter(call=>call.action==='lia-assistant').at(-1).payload;assert.equal(community.intent,'community');assert.equal(community.context_task_id,null,'Generic competence clears task context');
  assert.equal(calls.some(call=>/publish|delete/.test(call.action||'')),false,'Planning and social draft preparation do not publish or delete');
  fs.mkdirSync('artifacts',{recursive:true});await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0)});await page.screenshot({path:'artifacts/lia-agenda-desktop.png',fullPage:true});
  for(const width of [390,360]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Agenda fits mobile');await page.screenshot({path:`artifacts/lia-agenda-${width}.png`,fullPage:true})}
  assert.deepEqual(errors,[]);await context.close();console.log('LIA agenda browser: week/month calendar, navigation, filters, same-day tasks, card focus, mobile month, strategy approval, task lifecycle, manual results, server task context and social draft passed.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
