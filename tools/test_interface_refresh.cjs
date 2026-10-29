// Exercise the actual entry point and the new UI; all account data is synthetic.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = 'http://127.0.0.1:5178';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  fs.mkdirSync('artifacts', { recursive: true });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.getByRole('heading', { name: 'Il tuo mondo, raccontato meglio.' }).waitFor();
    await page.getByRole('tab', { name: 'Studio legale' }).click();
    await page.getByRole('tabpanel').getByText('Studio Ferri', { exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Studio legale' }).press('ArrowRight');
    assert.equal(await page.getByRole('tab', { name: 'Blog', exact: true }).getAttribute('aria-selected'), 'true');
    await page.getByRole('button', { name: 'LIA pubblica al posto mio?' }).click();
    assert.equal(await page.getByRole('button', { name: 'LIA pubblica al posto mio?' }).getAttribute('aria-expanded'), 'true');
    for (const width of [1440, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => { document.activeElement?.blur(); document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Public page fits ' + width);
      await page.screenshot({ path: `artifacts/refresh-public-${width}.png`, fullPage: true, animations: 'disabled' });
    }
    await page.getByRole('button', { name: 'Inizia con LIA', exact: true }).click();
    await page.getByRole('heading', { name: 'Bentornato', exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Login fits mobile');
    await page.screenshot({ path: 'artifacts/refresh-login-mobile.png', fullPage: true, animations: 'disabled' });
    await page.close();

    for (const role of ['user', 'admin']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const user = { id: role === 'admin' ? 1 : 22, role, plan: 'base', name: 'Studio Aurora', email: 'fixture@example.test', slug: 'studio-aurora' };
      await context.addInitScript(user => { localStorage.setItem('sts_token', 'refresh-fixture'); localStorage.setItem('sts_user', JSON.stringify(user)); }, user);
      const app = await context.newPage();
      app.on('pageerror', error => errors.push(error.message));
      const requests = [];
      await app.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        const action = url.pathname.endsWith('current_plan.php') ? 'current_plan' : url.searchParams.get('action');
        requests.push(action);
        let data = {};
        if (['me', 'current_plan'].includes(action)) data = { user };
        if (action === 'site') data = { site: { title: 'Studio Aurora', bio: 'Formazione per le famiglie' }, sources: [], posts: [], visibility: {} };
        if (action === 'account-update') { const payload = route.request().postDataJSON(); data = { user: { ...user, name: payload.name, email: payload.email } }; }
        if (action === 'admin-users') data = { users: [user, { id: 23, role: 'user', plan: 'professional', name: 'Studio Aurora Formazione e consulenza per famiglie', email: 'informazioni.clienti@studio-aurora.example.test', slug: 'studio-aurora-formazione-consulenza', posts_count: 12, sources_count: 1, sources: [{ platform: 'website', url: 'https://studio-aurora.example.test/approfondimenti/formazione-per-le-famiglie' }] }] };
        if (action === 'admin-prompts') data = { prompts: [] };
        if (action === 'admin-settings') data = { settings: {} };
        if (action === 'admin-monitoring') data = { totals: { users: 0, published_posts: 0, queued_posts: 0 }, agents: [], provider_settings: [], usage_this_month: {} };
        if (['drafts', 'pending-posts'].includes(action)) data = [];
        await route.fulfill({ json: data });
      });
      await app.goto(base + '/dashboard');
      if (role === 'user') {
        await app.getByRole('heading', { name: 'Cosa facciamo oggi?' }).waitFor();
        await app.getByRole('heading', { name: 'Le tue idee. Più visibili.' }).waitFor();
        assert.equal(await app.locator('.pulse-metrics strong').first().innerText(), '—', 'Missing Google data is not displayed as zero');
        await app.getByText('Le citazioni e la presenza nelle risposte IA non sono ancora misurate.', { exact: false }).waitFor();
        await app.getByRole('button', { name: 'Apri menu utente', exact: true }).click();
        await app.getByRole('button', { name: 'Modifica i miei dati', exact: true }).click();
        await app.getByRole('textbox', { name: 'Nome e cognome', exact: true }).fill('Aurora aggiornata');
        await app.getByRole('button', { name: 'Salva i miei dati', exact: true }).click();
        await app.getByText('Dati account aggiornati.', { exact: true }).waitFor();
        assert.equal(await app.locator('.user-trigger-name strong').innerText(), 'Aurora aggiornata', 'Saved profile updates the user menu');
        await app.getByRole('button', { name: 'Apri menu utente', exact: true }).click();
        await app.locator('.user-menu-panel').getByRole('button', { name: 'Password e accessi', exact: true }).waitFor();
        await app.getByRole('button', { name: 'Apri menu utente', exact: true }).press('Escape');
        assert.equal(await app.getByRole('button', { name: 'Apri menu utente', exact: true }).getAttribute('aria-expanded'), 'false');
        await app.getByRole('navigation', { name: 'Sezioni della piattaforma' }).getByRole('button', { name: 'LIA', exact: true }).click();
        assert.equal(await app.locator('.lw-work-area').evaluate(el => getComputedStyle(el).display), 'grid', 'Shared theme is loaded by the real entry point');
        const task = app.getByRole('button', { name: /Da un’idea a un contenuto/ });
        await task.click();
        assert.match(await app.getByRole('textbox', { name: 'Scrivi a LIA', exact: true }).inputValue(), /argomento, pubblico e obiettivo/);
        assert.ok(!requests.includes('lia-assistant'), 'Choosing a task does not spend AI credit or send a request');
        await app.getByRole('button', { name: 'Contenuti', exact: true }).click();
        await app.getByRole('button', { name: 'Lavora con LIA', exact: true }).click();
        assert.match(await app.getByRole('textbox', { name: 'Scrivi a LIA', exact: true }).inputValue(), /prossimo contenuto/);
        assert.ok(!requests.includes('lia-assistant'), 'Context entry prepares the request without sending it');
      } else {
        await app.getByRole('heading', { name: 'Amministrazione piattaforma', exact: true }).waitFor();
        await app.locator('.lia-admin-guide summary').click();
        await app.getByRole('button', { name: 'Configura gli agenti IA', exact: true }).click();
        await app.getByRole('heading', { name: 'Agenti AI', exact: true }).waitFor();
        assert.ok(!requests.includes('lia-assistant') && !requests.includes('site'), 'Administrative guide preserves account isolation');
        await app.locator('.admin-navigation').getByRole('button', { name: 'Panoramica', exact: true }).click();
        const sectionHeading = await app.locator('.admin-section-heading h3').first().evaluate(el => ({ fontSize: getComputedStyle(el).fontSize, fontWeight: getComputedStyle(el).fontWeight, fontFamily: getComputedStyle(el).fontFamily }));
        await app.locator('.admin-navigation').getByRole('button', { name: 'Clienti', exact: true }).click();
        await app.getByRole('heading', { name: 'Account, piani e accessi', exact: true }).waitFor();
        const clientHeading = await app.locator('#admin-accounts-heading').evaluate(el => ({ fontSize: getComputedStyle(el).fontSize, fontWeight: getComputedStyle(el).fontWeight, fontFamily: getComputedStyle(el).fontFamily }));
        assert.deepEqual(clientHeading, sectionHeading, 'Clients headings share the overview type scale');
        const controls = await app.locator('.admin-clients input, .admin-clients select, .admin-clients .btn').evaluateAll(elements => elements.map(el => { const style = getComputedStyle(el); return { fontFamily: style.fontFamily, fontSize: style.fontSize, minHeight: style.minHeight }; }));
        assert.ok(controls.length > 12, 'Create, search, account actions and password controls are covered');
        for (const control of controls) assert.deepEqual(control, controls[0], 'All Clients controls use one font, size and minimum height');
        await app.getByRole('searchbox', { name: 'Cerca clienti' }).fill('non-esiste');
        await app.getByText('Nessun account corrisponde ai filtri selezionati.', { exact: true }).waitFor();
        await app.getByRole('searchbox', { name: 'Cerca clienti' }).fill('');
        for (const width of [1440, 768, 390, 360]) {
          await app.setViewportSize({ width, height: 1000 });
          await app.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
          await app.screenshot({ path: `artifacts/refresh-admin-clients-${width}.png`, fullPage: true, animations: 'disabled' });
          assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Client accounts fit ' + width);
        }
        await app.locator('.admin-navigation').getByRole('button', { name: 'Panoramica', exact: true }).click();
      }
      for (const width of [1440, 768, 390, 360]) {
        await app.setViewportSize({ width, height: 1000 });
        await app.getByRole('button', { name: 'Apri menu utente', exact: true }).click();
        const menuBounds = await app.locator('.user-menu-panel').boundingBox();
        assert.ok(menuBounds.x >= 0 && menuBounds.x + menuBounds.width <= width + 1, role + ' user menu fits ' + width);
        await app.getByRole('button', { name: 'Apri menu utente', exact: true }).press('Escape');
        await app.evaluate(() => window.scrollTo(0, 0));
        await app.screenshot({ path: `artifacts/refresh-${role}-${width}.png`, fullPage: true, animations: 'disabled' });
        const overflow = await app.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('body *')].filter(el => { const rect = el.getBoundingClientRect(); return rect.width > 0 && rect.right > innerWidth + 1; }).slice(0, 12).map(el => ({ tag: el.tagName, class: el.className, right: el.getBoundingClientRect().right })) }));
        assert.ok(overflow.scroll <= width + 1, role + ' fits ' + width + ': ' + JSON.stringify(overflow));
      }
      await context.close();
    }
    assert.deepEqual(errors, [], 'No runtime errors');
    console.log('Interface refresh: public examples, keyboard tabs, FAQ, login, LIA task/context navigation, admin isolation and four viewport sizes passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
