// A novice can start from one recommendation and continue using buttons alone.
// Synthetic identities; every account API is intercepted.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless:true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {}) });
  try {
    for (const newcomer of [false,true]) {
      const context = await browser.newContext({viewport:{width:1440,height:1000}});
      const user = {id:22,role:'user',plan:'base',name:'Maria',email:'maria@example.test',slug:'maria'};
      await context.addInitScript(user=>{localStorage.setItem('sts_token','guide-fixture');localStorage.setItem('sts_user',JSON.stringify(user));},user);
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const errors=[], calls=[]; page.on('pageerror',error=>errors.push(error.message));
      let fail = newcomer, answerCount=0;
      const step = newcomer
        ? {title:'Raccontiamo cosa fai',reason:'Così potrò aiutarti con idee adatte alla tua attività.',prompt:'Aiutami a raccontare la mia attività. Chiedimi soltanto cosa faccio, con parole semplici.',context_post_id:null}
        : {title:'Rendiamo più chiara la tua guida per le famiglie',reason:'Hai già un testo da cui partire: possiamo migliorarlo insieme.',prompt:'Aiutami a rendere più chiara la mia guida per le famiglie, mantenendo i fatti del testo.',context_post_id:321};
      await page.route('**/api/**',async route=>{
        const request=route.request(),url=new URL(request.url());
        const action=url.pathname.endsWith('current_plan.php')?'current_plan':url.searchParams.get('action');
        const payload=request.method()==='POST'?request.postDataJSON():null;
        calls.push({action,payload}); let data={};
        if(['me','current_plan'].includes(action))data={user};
        if(action==='site')data={site:newcomer?{}:{title:'Studio Maria',bio:'Formazione per le famiglie.'},sources:[],posts:newcomer?[]:[{id:321,edited_title:'Guida per le famiglie',edited_body:'<p>Informazioni per le famiglie.</p>',published:0,seo_score:80}],visibility:{}};
        if(['drafts','pending-posts'].includes(action))data=[];
        if(action==='lia-agenda')data={agenda:{tasks:[]}};
        if(action==='lia-assistant') {
          if(payload.intent==='briefing') {
            if(fail)return route.fulfill({status:502,json:{error:'Non riesco a preparare il consiglio. Riprova tra poco.'}});
            data={reply:newcomer?'Partiamo dalle informazioni sulla tua attività.':'Hai una guida per le famiglie ancora da completare.',next_step:step,actions:[]};
          } else {
            answerCount++;
            if(answerCount===1) {
              assert.equal(payload.messages.at(-1).text,step.prompt,'The main button continues the exact AI recommendation');
              assert.equal(payload.context_post_id,step.context_post_id,'The chosen owned article is loaded for the guided work');
              data={reply:'Ti aiuto volentieri.',question:newcomer?'Di cosa ti occupi?':'A chi vuoi spiegare meglio questo argomento?',options:newcomer?['Un negozio','Offro un servizio']:['Alle famiglie','Agli insegnanti'],actions:[]};
            } else {
              assert.equal(payload.messages.at(-1).text,newcomer?'Offro un servizio':'Alle famiglie','A visible answer button continues the conversation without typing');
              data={reply:'Prepariamo insieme un testo semplice da rivedere.',actions:[{type:'prepare_article',brief:{subject:'Una guida semplice per le famiglie',title:'La tua guida'}}]};
            }
          }
        }
        await route.fulfill({json:data});
      });
      await page.goto('http://127.0.0.1:5178/dashboard');
      await page.getByRole('heading',{name:'Facciamo un passo insieme.',exact:true}).waitFor();
      if(newcomer) {
        await page.getByRole('button',{name:'Riprova a consigliarmi',exact:true}).waitFor();
        assert.equal(await page.getByRole('textbox',{name:'Scrivi a LIA',exact:true}).isEnabled(),true,'An AI failure leaves the direct help input available');
        fail=false;await page.getByRole('button',{name:'Riprova a consigliarmi',exact:true}).click();
      }
      await page.getByRole('heading',{name:step.title,exact:true}).waitFor();
      assert.equal(await page.locator('.lw-more-tools').getAttribute('open'),null,'Roles and planning are not initial choices');
      assert.equal(await page.locator('.lia-results-summary').getAttribute('open'),null,'Statistics are secondary');
      assert.equal(await page.getByRole('button',{name:/Caporedattrice/}).count(),0,'Technical roles are absent from the accessible entry screen');
      const start=page.getByRole('button',{name:'Facciamolo insieme',exact:true});
      fs.mkdirSync('artifacts',{recursive:true});
      await page.screenshot({path:`artifacts/lia-guided-home-${newcomer?'new':'existing'}-desktop.png`,fullPage:true});
      const bounds=await start.boundingBox();assert.ok(bounds.height>=56,'Primary action is large enough to click easily: '+JSON.stringify({bounds,styles:await start.evaluate(button=>({height:getComputedStyle(button).minHeight,font:getComputedStyle(button).fontSize}))}));
      for(const width of [390,360]) {
        await page.setViewportSize({width,height:844});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Simple home fits narrow screens');
        assert.ok(await start.evaluate(button=>parseFloat(getComputedStyle(button).fontSize)>=18),'Primary label remains readable on mobile');
        await page.screenshot({path:`artifacts/lia-guided-home-${newcomer?'new':'existing'}-${width}.png`,fullPage:true});
      }
      await start.click();
      await page.getByRole('button',{name:newcomer?'Offro un servizio':'Alle famiglie',exact:true}).click();
      await page.locator('button[data-lia-action="prepare_article"]').waitFor();
      assert.equal(calls.some(call=>['post-create','site-update','article-studio'].includes(call.action)),false,'Guidance and answer buttons do not save, publish or generate an article without the next explicit action');
      assert.equal(answerCount,2,'Two clear clicks advance from recommendation to a concrete proposal');
      assert.deepEqual(errors,[]);
      await context.close();
    }
    console.log('LIA simple home: one AI recommendation, large primary button, hidden technical tools, no typing required, owned article context, new account, retry and mobile passed.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
