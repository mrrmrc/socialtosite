const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
  });

  console.log('Navigating to https://socialtosite.sviluppo.host/ ...');
  // Pass a cache-busting param just in case, but first let's try WITHOUT it to see what the user sees
  await page.goto('https://socialtosite.sviluppo.host/', { waitUntil: 'networkidle0' });
  
  await browser.close();
})();
