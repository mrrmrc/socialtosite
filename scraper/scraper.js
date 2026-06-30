const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error(JSON.stringify({ error: "Uso: node scraper.js <platform> <url> [limit]" }));
    process.exit(1);
}

const platform = args[0].toLowerCase();
const url = args[1];
const limit = parseInt(args[2]) || 0; // 0 = resolve single post, >0 = discover recent posts

(async () => {
    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'] 
        });
        const page = await browser.newPage();
        
        // Randomize viewport
        await page.setViewport({ width: 1366, height: 768 });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        let result = [];

        if (limit > 0) {
            // DISCOVERY: Find recent post URLs
            const links = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a'));
                return anchors.map(a => a.href).filter(href => {
                    return href.includes('/p/') || href.includes('/reel/') || href.includes('/video/') || href.includes('/posts/');
                });
            });
            // Unique
            const uniqueLinks = [...new Set(links)];
            
            for (let i = 0; i < Math.min(uniqueLinks.length, limit); i++) {
                result.push({ url: uniqueLinks[i] });
            }
        } else {
            // RESOLVE: Get single post media and caption
            const data = await page.evaluate(() => {
                // Try to get meta tags for caption
                const getMeta = (prop) => {
                    const el = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
                    return el ? el.getAttribute('content') : '';
                };
                
                let caption = getMeta('og:description') || getMeta('description') || '';
                
                // Try to get video source
                let videoUrl = getMeta('og:video') || getMeta('og:video:secure_url') || '';
                if (!videoUrl) {
                    const videoEl = document.querySelector('video');
                    if (videoEl) videoUrl = videoEl.src;
                }
                
                // Try to get image source if no video
                let imageUrl = '';
                if (!videoUrl) {
                    imageUrl = getMeta('og:image') || getMeta('og:image:secure_url') || '';
                }

                // Tiktok specific meta description often has the title
                if (caption.includes('TikTok video')) {
                    caption = getMeta('og:title') + ' ' + caption;
                }
                
                return {
                    caption: caption,
                    video: videoUrl,
                    image: imageUrl
                };
            });
            
            result = data;
        }

        console.log(JSON.stringify(result));
    } catch (err) {
        console.error(JSON.stringify({ error: err.message }));
    } finally {
        if (browser) await browser.close();
    }
})();
