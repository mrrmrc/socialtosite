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
   if(action==='lia-agenda'){
    if(payload?.operation==='generate'){
     if(failPlan)return route.fulfill({status:502,json:{error:'Piano non disponibile. Il precedente è conservato.'}});
     agenda={id:'plan-fixture',goal:payload.goal,tasks:['editorial','social','seo','geo'].map((role,i)=>({id:'task-'+i,role,title:['Rivedi la guida per le famiglie','Prepara un post Instagram','Migliora il titolo della guida','Chiarisci la presentazione dello studio'][i],reason:'Una priorità basata sui tuoi contenuti.',brief:'Lavora su un risultato concreto per le famiglie.',date:'2026-10-'+(30+i>31?'31':30+i),post_id:i===0?321:null,status:'todo'}))};
    }
    if(payload?.operation==='update')agenda={...agenda,tasks:agenda.tasks.map(task=>task.id===payload.task_id?{...task,status:payload.status}:task)};
    data={agenda};
   }
   if(action==='lia-assistant')data={reply:'Ecco una bozza concreta per il tuo canale.',question:null,options:[],actions:payload.intent==='social'?[{id:'social-1',type:'social_draft',platform:'instagram',caption:'Una scelta consapevole parte dalle domande giuste. Scopri la nostra guida per le famiglie.',hashtags:['#formazione','#famiglie']}]:[]};
   if(action==='post-create')data={ok:true,id:555};
   await route.fulfill({json:data});
  });
  await page.goto('http://127.0.0.1:5178/dashboard');
  await page.getByRole('heading',{name:'La tua redazione, ogni giorno.',exact:true}).waitFor();
  assert.equal(await page.locator('.lia-results-summary').getAttribute('open'),null,'Metrics remain available without replacing the editorial workspace');
  assert.equal(calls.some(call=>call.payload),false,'Opening the workspace does not generate or save a plan');
  await page.getByLabel('Il risultato su cui lavoriamo',{exact:true}).fill('Aiutare le famiglie a conoscere i nostri percorsi');
  await page.getByRole('button',{name:'Organizza la mia settimana',exact:true}).click();
  await page.getByRole('list',{name:'Piano di lavoro di LIA'}).waitFor();
  assert.equal(await page.locator('.lia-agenda-tasks>li').count(),4);
  await page.getByRole('checkbox',{name:'Completata: Rivedi la guida per le famiglie',exact:true}).click();
  await page.getByText('1/4 attività completate',{exact:true}).waitFor();
  await page.reload();await page.getByRole('checkbox',{name:'Completata: Rivedi la guida per le famiglie',exact:true}).waitFor();
  assert.equal(await page.getByRole('checkbox',{name:'Completata: Rivedi la guida per le famiglie',exact:true}).isChecked(),true,'Progress survives reload');
  failPlan=true;await page.getByRole('button',{name:'Riorganizza i prossimi 7 giorni',exact:true}).click();await page.getByRole('alert').filter({hasText:'Piano non disponibile'}).waitFor();assert.equal(await page.locator('.lia-agenda-tasks>li').count(),4,'Provider errors retain the previous plan');
  await page.getByRole('button',{name:/Social media manager Messaggi/}).click();await page.getByRole('heading',{name:'La tua bozza social',exact:true}).waitFor();
  assert.equal(calls.filter(call=>call.action==='lia-assistant').at(-1).payload.intent,'social');
  await page.getByRole('button',{name:'Salva la bozza social',exact:true}).click();await page.getByText('Bozza salvata nei contenuti.',{exact:true}).waitFor();assert.ok(calls.find(call=>call.action==='post-create').payload.edited_body.includes('Una scelta consapevole'));
  assert.equal(calls.some(call=>/publish|delete/.test(call.action||'')),false,'Planning and social draft preparation do not publish or delete');
  fs.mkdirSync('artifacts',{recursive:true});await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0)});await page.screenshot({path:'artifacts/lia-agenda-desktop.png',fullPage:true});
  for(const width of [390,360]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Agenda fits mobile');await page.screenshot({path:`artifacts/lia-agenda-${width}.png`,fullPage:true})}
  assert.deepEqual(errors,[]);await context.close();console.log('LIA agenda browser: four roles, saved weekly plan, persistent progress, preserved plan on failure, social draft and mobile passed.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
