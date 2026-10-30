const {spawn}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5180','--strictPort'],{cwd:path.join(root,'frontend/openpage'),windowsHide:true,stdio:['ignore','pipe','pipe']});
let output='';server.stdout.on('data',chunk=>output+=chunk);server.stderr.on('data',chunk=>output+=chunk);
(async()=>{
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Builder server stopped: '+output);if(output.includes('Local:'))break;await new Promise(resolve=>setTimeout(resolve,150))}
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(20000);const errors=[],publications=[],versions=[];page.on('pageerror',error=>errors.push(error.message));let fail=true;
  await page.addInitScript(()=>{if(window.top!==window)return;localStorage.setItem('sts_token','builder-layout-fixture');localStorage.setItem('sts_user',JSON.stringify({id:22,role:'user'}))});
  const config={name:'Studio Aurora',theme:{bg1:'#ffffff'},blocks:[{id:'hero',type:'hero',variant:'split',props:{headline:'La mia identità originale',subheadline:'Formazione per le famiglie',primaryCta:'Contattami'}},{id:'articles',type:'articles',variant:'grid',props:{title:'Le mie storie',items:[{title:'Il mio articolo',excerpt:'Testo da conservare',url:'/aurora/guida'}]}}]};
  await page.route('**/api/**',async route=>{const req=route.request(),action=new URL(req.url()).searchParams.get('action');let data={};if(action==='site')data={user:{id:22,slug:'aurora'},site:{title:'Studio Aurora',openpage_config:JSON.stringify(config)},sources:[],posts:[]};if(action==='openpage-version'){versions.push(req.postDataJSON());data={ok:true}}if(action==='openpage-publish'){const input=req.postDataJSON();publications.push(input);const decoded=JSON.parse(input.config);assert.equal(decoded.blocks.find(block=>block.id==='hero').variant,'minimal');assert.equal(decoded.blocks.find(block=>block.id==='hero').props.headline,'La mia identità originale');assert.ok(input.html.includes('La mia identità originale'));if(fail)return route.fulfill({status:503,json:{error:'Pubblicazione temporaneamente non disponibile'}});data={ok:true,url:'/aurora',deploymentId:'layout-fixture'}}await route.fulfill({json:data})});
  await page.goto('http://127.0.0.1:5180/builder/themes?site=current');
  await page.getByRole('button',{name:/^Magazine/}).click();
  await page.getByRole('button',{name:'Applica al sito online',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Applica il layout al sito online'});
  await dialog.getByRole('button',{name:'Applica e pubblica',exact:true}).click();
  await dialog.getByRole('alert').filter({hasText:'Pubblicazione temporaneamente non disponibile'}).waitFor();
  const unchanged=await page.evaluate(()=>JSON.parse(localStorage.getItem('openpage-config')).state.config);assert.equal(unchanged.blocks.find(block=>block.id==='hero').variant,'split','Failed publication leaves the actual draft untouched');
  fail=false;await dialog.getByRole('button',{name:'Applica e pubblica',exact:true}).click();await page.getByText('Nuovo layout pubblicato sul tuo sito',{exact:true}).waitFor();
  assert.equal(publications.length,2);assert.equal(versions.length,2);assert.equal(versions[0].config.blocks.find(block=>block.id==='hero').variant,'split');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('openpage-config')).state.config);assert.equal(saved.blocks.find(block=>block.id==='hero').variant,'minimal');
  const projects=await page.evaluate(()=>JSON.parse(localStorage.getItem('openpage-projects')).state.projects);assert.equal(projects.find(project=>project.id==='social-site-22').deployUrl,'http://127.0.0.1:5180/aurora');
  fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/builder-layout-published.png',fullPage:true});assert.deepEqual(errors,[]);console.log('Builder layouts: real theme selection, source content preserved, publication retry, previous version backup and persistent applied layout passed.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);if(output)console.error(output.slice(-3000));process.exitCode=1}).finally(()=>server.kill());
