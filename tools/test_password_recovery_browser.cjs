// Vite on :5178, fixture API only. Never sends real emails or changes accounts.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = [], calls = [];
    let expired = false, throttled = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.clear();
      if (location.hash.includes('reset-password=')) {
        localStorage.setItem('sts_token', 'fixture-stale-session');
        localStorage.setItem('sts_user', JSON.stringify({ id: 7, email: 'owner@example.test', role: 'user', plan: 'professional' }));
      }
    });
    await page.route('**/api/**', async route => {
      const action = new URL(route.request().url()).searchParams.get('action');
      const data = route.request().method() === 'POST' ? route.request().postDataJSON() : {};
      calls.push({ action, data });
      if (action === 'forgot-password') {
        if (throttled) return route.fulfill({ status: 429, json: { error: 'Troppe richieste. Riprova tra 15 minuti.' } });
        return route.fulfill({ status: 202, json: { ok: true, message: 'Se l’indirizzo è associato a un account, riceverai un’email con il link per reimpostare la password. Controlla anche la cartella spam.' } });
      }
      if (action === 'reset-password') {
        if (expired) return route.fulfill({ status: 422, json: { error: 'Link non valido, scaduto o già utilizzato. Richiedi un nuovo link.' } });
        return route.fulfill({ json: { ok: true, message: 'Password aggiornata. Accedi con la nuova password.' } });
      }
      await route.fulfill({ json: {} });
    });
    await page.goto('http://127.0.0.1:5178/accedi');
    await page.getByRole('heading', { name: 'Bentornato', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Password dimenticata? Recupera password' }).click();
    assert.equal(await page.getByLabel('Password', { exact: true }).count(), 0);
    await page.getByLabel('Email', { exact: true }).fill('mail@ideesitiweb.it');
    await page.getByRole('button', { name: 'Invia link di recupero' }).click();
    await page.getByRole('status').filter({ hasText: 'Se l’indirizzo' }).waitFor();
    assert.equal(calls.at(-1).data.email, 'mail@ideesitiweb.it');
    assert.equal(await page.getByRole('button', { name: 'Invia link di recupero' }).isEnabled(), true);
    await page.setViewportSize({ width: 390, height: 844 });
    fs.mkdirSync('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/password-recovery-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByRole('button', { name: 'Torna al login' }).click();
    assert.equal(await page.getByLabel('Email', { exact: true }).inputValue(), 'mail@ideesitiweb.it');
    await page.goto('http://127.0.0.1:5178/accedi?fixture=new-session#reset-password=fixture-token');
    await page.getByRole('heading', { name: 'Scegli una nuova password' }).waitFor();
    assert.equal(await page.evaluate(() => location.hash), '', 'Reset token removed from address bar');
    assert.equal(calls.filter(call => call.action === 'site').length, 0, 'Recovery does not fetch a stale logged-in account');
    await page.getByLabel('Nuova password', { exact: true }).fill('Fixture-new-password-123');
    await page.getByLabel('Conferma nuova password').fill('Fixture-wrong-password-123');
    await page.getByRole('button', { name: 'Salva nuova password' }).click();
    await page.getByRole('alert').filter({ hasText: 'Le password non coincidono.' }).waitFor();
    assert.equal(calls.filter(call => call.action === 'reset-password').length, 0);
    await page.getByLabel('Conferma nuova password').fill('Fixture-new-password-123');
    await page.getByRole('button', { name: 'Salva nuova password' }).click();
    await page.getByRole('status').filter({ hasText: 'Password aggiornata.' }).waitFor();
    assert.equal(calls.at(-1).data.token, 'fixture-token');
    assert.equal(await page.evaluate(() => localStorage.getItem('sts_token')), null, 'Old session removed');
    await page.getByRole('heading', { name: 'Bentornato', exact: true }).waitFor();
    expired = true;
    await page.goto('http://127.0.0.1:5178/accedi?fixture=new-session#reset-password=expired-fixture-token');
    await page.getByLabel('Nuova password', { exact: true }).fill('Fixture-new-password-123');
    await page.getByLabel('Conferma nuova password').fill('Fixture-new-password-123');
    await page.getByRole('button', { name: 'Salva nuova password' }).click();
    await page.getByRole('alert').filter({ hasText: 'Link non valido, scaduto o già utilizzato.' }).waitFor();
    await page.getByRole('button', { name: 'Richiedi un nuovo link' }).click();
    throttled = true;
    await page.getByLabel('Email', { exact: true }).fill('mail@ideesitiweb.it');
    await page.getByRole('button', { name: 'Invia link di recupero' }).click();
    await page.getByRole('alert').filter({ hasText: 'Troppe richieste.' }).waitFor();
    assert.deepEqual(errors, []);
    console.log('Recovery browser: login entry, email request, mobile, token scrubbing, stale session, password confirmation, success, expired link and throttling passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
