const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const moduleSource = await (await fetch('http://127.0.0.1:5178/src/screens/DashboardScreen.jsx')).text();
    const reactHash = moduleSource.match(/react\.js\?v=([a-z0-9]+)/)[1];
    const mainSource = await (await fetch('http://127.0.0.1:5178/src/main.jsx')).text();
    const rendererHash = mainSource.match(/react-dom_client\.js\?v=([a-z0-9]+)/)[1];
    await page.route('https://media.example/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6kAAAAABJRU5ErkJggg==', 'base64') }));
    const posts = [
      { media_url: 'https://media.example/one.png', media_type: 'image', image_urls: ['https://media.example/one.png','https://media.example/two.png'] },
      { media_url: 'https://media.example/video.mp4', media_type: 'video', poster_url: 'https://media.example/one.png' },
      { media_url: 'https://www.facebook.com/reel/123', media_type: 'video', poster_url: 'https://media.example/two.png', source_url: 'https://www.facebook.com/reel/123' },
      { media_url: 'javascript:alert(1)', media_type: 'image' },
    ];
    await page.route('**/media-fixture', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module">import React from '/node_modules/.vite/deps/react.js?v=${reactHash}';import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js?v=${rendererHash}';import {PostMediaPreview} from '/src/components/PostMediaPreview.jsx';ReactDOM.createRoot(document.getElementById('root')).render(React.createElement('main',null,...${JSON.stringify(posts)}.map((post,i)=>React.createElement(PostMediaPreview,{post,key:i}))));</script>` }));
    await page.goto('http://127.0.0.1:5178/media-fixture');
    await page.getByText('2 foto importate', { exact: true }).waitFor();
    assert.equal(await page.locator('.post-media-gallery img').count(), 2);
    assert.equal(await page.locator('video').count(), 1);
    assert.equal(await page.locator('video').getAttribute('poster'), 'https://media.example/one.png');
    assert.equal(await page.getByRole('link', { name: /Guarda il video originale/ }).getAttribute('href'), 'https://www.facebook.com/reel/123');
    assert.equal(await page.locator('[src^="javascript:"]').count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    fs.mkdirSync('artifacts', { recursive: true }); await page.screenshot({ path: 'artifacts/imported-media-mobile.png', fullPage: true });
    console.log('Imported media browser checks passed: gallery, playable video, poster, social fallback, safe URLs and mobile layout.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
