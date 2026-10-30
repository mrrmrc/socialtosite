// Compare the two real application shells, with every account API mocked.
// Optional origin tests the compiled staging release instead of local Vite.
const {spawn}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),published=process.argv[2],servers=[];
async function serve(directory,port){
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:path.join(root,directory),windowsHide:true,stdio:['ignore','pipe','pipe']});
  servers.push(server);let output='';server.stdout.on('data',chunk=>output+=chunk);server.stderr.on('data',chunk=>output+=chunk);
  for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(output);if(output.replace(/\u001b\[[0-9;]*m/g,'').includes('Local:'))return;await new Promise(resolve=>setTimeout(resolve,150));}
  throw Error('Server not ready: '+output);
}
(async()=>{
  if(!published){await serve('frontend',5182);await serve('frontend/openpage',5183);}
  const dashboard=published||'http://127.0.0.1:5182',builder=published||'http://127.0.0.1:5183';
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  try{
    const user={id:22,role:'user',plan:'professional',name:'Maria',slug:'aurora',email:'maria@example.test'};
    const config={name:'Studio Aurora',theme:{bg1:'#102030',text0:'#fefefe',accent:'#ff9300',fontSans:'Georgia',fontDisplay:'Georgia'},blocks:[{id:'hero',type:'hero',variant:'minimal',props:{headline:'La mia identità originale',subheadline:'Formazione per le famiglie',primaryCta:'Contattami'}}]};
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.addInitScript(user=>{if(window.top!==window)return;localStorage.setItem('sts_token','builder-shell-fixture');localStorage.setItem('sts_user',JSON.stringify(user));},user);
    const errors=[],writes=[];
    await context.route('**/api/**',async route=>{
      const req=route.request(),url=new URL(req.url()),action=url.pathname.endsWith('current_plan.php')?'current_plan':url.searchParams.get('action');
      if(req.method()==='POST')writes.push(action);
      let data={};if(['me','current_plan'].includes(action))data={user};
      if(action==='site')data={user,site:{title:'Studio Aurora',bio:'Formazione per le famiglie',openpage_config:JSON.stringify(config)},sources:[],posts:[],visibility:{}};
      if(['drafts','pending-posts'].includes(action))data=[];
      if(action==='lia-agenda')data={agenda:{tasks:[]}};
      if(action==='lia-assistant')data={reply:'Partiamo dalla tua presentazione.',next_step:{title:'Raccontiamo la tua attività',reason:'Aiuta chi visita il sito.',prompt:'Aiutami a raccontare la mia attività.'},actions:[]};
      await route.fulfill({json:data});
    });
    const home=await context.newPage();home.on('pageerror',error=>errors.push(error.message));
    await home.goto(dashboard+'/dashboard');await home.locator('.lw-briefing-report').waitFor();
    const mainStyle=await home.locator('.customer-sidebar-layout').evaluate(el=>{const style=getComputedStyle(el);return{font:style.fontFamily,primary:style.getPropertyValue('--primary').trim(),background:style.getPropertyValue('--bg').trim()};});
    const mainSidebar=await home.locator('.customer-left-menu').boundingBox();
    const mainHeader=await home.locator('.backend-header').boundingBox();
    const activeBackground=await home.locator('.backend-tab.is-active').evaluate(el=>getComputedStyle(el).backgroundColor);
    const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
    await page.goto(builder+'/builder/editor?site=current');await page.locator('.site-render').waitFor();
    assert.equal(await page.locator('.platform-brand img').evaluate(async image=>{try{await image.decode();}catch{throw Error('Brand logo did not load: '+image.currentSrc);}return image.naturalWidth>0;}),true,'The shared brand logo loads in both applications');
    const shellStyle=await page.locator('.builder-shell').evaluate(el=>{const style=getComputedStyle(el);return{font:style.fontFamily,primary:style.getPropertyValue('--color-green').trim(),background:style.getPropertyValue('--color-bg-0').trim()};});
    assert.deepEqual(shellStyle,mainStyle,'Dashboard and builder use the same actual font and palette');
    assert.equal((await page.locator('.platform-sidebar').boundingBox()).width,mainSidebar.width,'Both applications reserve the same left navigation column');
    assert.equal((await page.locator('.platform-header').boundingBox()).height,mainHeader.height,'Brand headers align at the same height');
    assert.equal(await page.locator('.platform-nav-active').evaluate(el=>getComputedStyle(el).backgroundColor),activeBackground,'Active navigation uses the same light accent');
    assert.deepEqual(await page.locator('.platform-main-nav a span').allTextContents(),['Home','Contenuti','Il sito','Risultati','Canali'],'Menu vocabulary matches the dashboard');
    const preview=await page.locator('.site-render').evaluate(el=>({background:getComputedStyle(el).backgroundColor,font:getComputedStyle(el).fontFamily}));
    assert.equal(preview.background,'rgb(16, 32, 48)','Canvas retains the customer dark background');assert.ok(preview.font.includes('Georgia'),'Customer typography is isolated from the Inter application shell');
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('openpage-config')).state.config);
    assert.equal(saved.blocks[0].props.headline,config.blocks[0].props.headline);
    fs.mkdirSync('artifacts',{recursive:true});
    await page.screenshot({path:'artifacts/builder-shell-editor-desktop.png',fullPage:true,animations:'disabled'});
    await page.getByRole('link',{name:'Scegli la grafica',exact:true}).click();
    await page.getByRole('heading',{name:'Temi e layout',exact:true}).waitFor();
    await page.frameLocator('.themes-preview-frame').locator('.site-render').waitFor();
    await page.screenshot({path:'artifacts/builder-shell-themes-desktop.png',fullPage:true,animations:'disabled'});
    for(const width of [1024,390,360]){
      await page.setViewportSize({width,height:844});
      const toggle=page.getByRole('button',{name:'Menu e strumenti',exact:true});await toggle.click();
      await page.getByRole('link',{name:'Modifica sito',exact:true}).click();await page.locator('.site-render').waitFor();
      assert.equal(await toggle.getAttribute('aria-expanded'),'false','Choosing a builder tool closes the mobile menu');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Builder chrome fits '+width);
      await page.getByRole('button',{name:'Apri menu utente',exact:true}).click();
      const account=await page.locator('.platform-account-menu').boundingBox();assert.ok(account.x>=0&&account.x+account.width<=width+1,'Account menu fits '+width);
      await page.getByRole('button',{name:'Apri menu utente',exact:true}).press('Escape');
      await page.screenshot({path:`artifacts/builder-shell-editor-${width}.png`,fullPage:true,animations:'disabled'});
    }
    assert.equal(writes.some(action=>/publish|version|generate|update/.test(action||'')),false,'Changing application chrome never changes or publishes the customer site');
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('openpage-config')).state.config),saved,'Navigation preserves the existing draft');
    assert.deepEqual(errors,[]);await context.close();
    console.log('Builder shell: shared dashboard font, colors, header, left menus, isolated customer theme, preserved draft, account menu and desktop/mobile passed.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>servers.forEach(server=>server.kill()));
