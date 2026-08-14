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
const parsedLimit = Number.parseInt(args[2], 10);
const limit = Number.isNaN(parsedLimit) ? 0 : parsedLimit; // -1 = profile visuals, 0 = resolve single post, >0 = discover recent posts

(async () => {
    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'] 
        });
        const page = await browser.newPage();
        
        // Randomize viewport and user agent to simulate mobile/desktop better
        await page.setViewport({ width: 1366, height: 768 });
        
        if (platform === 'instagram') {
            // Use a mobile user agent for Instagram to sometimes bypass strict desktop login walls
            await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1');
        }

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Attendi un attimo aggiuntivo per il rendering di JS pesanti
        await new Promise(r => setTimeout(r, 3000));

        let result = [];

        if (limit < 0) {
            result = await page.evaluate(() => {
                const getMeta = (prop) => {
                    const el = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
                    return el ? el.getAttribute('content') : '';
                };

                const images = Array.from(document.images || [])
                    .map(img => ({
                        src: img.currentSrc || img.src || '',
                        width: img.naturalWidth || img.width || 0,
                        height: img.naturalHeight || img.height || 0,
                    }))
                    .filter(img => img.src && /^https?:\/\//i.test(img.src))
                    .filter(img => !/emoji|sprite|icon|static\.xx|blank/i.test(img.src))
                    .sort((a, b) => (b.width * b.height) - (a.width * a.height));

                const unique = [];
                for (const img of images) {
                    if (!unique.some(existing => existing.src === img.src)) unique.push(img);
                    if (unique.length >= 6) break;
                }

                const profileImage = getMeta('og:image') || getMeta('og:image:secure_url') || unique[0]?.src || '';
                const coverImage = unique.find(img => img.src !== profileImage && img.width >= 600)?.src || unique[1]?.src || profileImage;

                return {
                    pageTitle: document.title || getMeta('og:title') || '',
                    profileImage,
                    coverImage,
                    images: unique.map(img => img.src),
                };
            });
        } else if (limit > 0) {
            // DISCOVERY: Find recent post URLs
            const links = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a'));
                let foundLinks = anchors.map(a => a.href).filter(href => {
                    return href.includes('/p/') || href.includes('/reel/') || href.includes('/reels/') || href.includes('/video/') || href.includes('/videos/') || href.includes('/posts/') || href.includes('/watch/?v=') || href.includes('/photos/');
                });
                // Prova anche a cercare se ci sono script tags con JSON-LD o window._sharedData
                try {
                    const scripts = document.querySelectorAll('script');
                    for (const script of scripts) {
                        if (script.innerHTML.includes('GraphImage') || script.innerHTML.includes('GraphVideo')) {
                            const match = script.innerHTML.match(/"shortcode":"([^"]+)"/g);
                            if (match) {
                                match.forEach(m => {
                                    const code = m.split(':')[1].replace(/"/g, '');
                                    foundLinks.push('https://www.instagram.com/p/' + code + '/');
                                });
                            }
                        }
                    }
                } catch (e) {}
                
                return foundLinks;
            });
            if (platform === 'facebook') {
                for (let i = 0; i < 3; i++) {
                    await page.evaluate((scrollIndex) => window.scrollTo(0, document.body.scrollHeight * (0.35 + (scrollIndex * 0.2))), i);
                    await new Promise(r => setTimeout(r, 1500));
                    const extraLinks = await page.evaluate(() =>
                        Array.from(document.querySelectorAll('a'))
                            .map(a => a.href)
                            .filter(href => href.includes('/posts/') || href.includes('/videos/') || href.includes('/reel/') || href.includes('/watch/?v=') || href.includes('/photos/'))
                    );
                    links.push(...extraLinks);
                    if (new Set(links).size >= limit && limit > 0) break;
                }
            }

            // Unique
            let uniqueLinks = [...new Set(links)];
            if (platform === 'facebook') {
                uniqueLinks = uniqueLinks
                    .filter(href => !/\/(photos|about|reviews|community|events|mentions)(\/|$)/i.test(href))
                    .map(href => href.replace(/[?&]refsrc=[^&]+/g, '').replace(/[?&]__tn__=[^&]+/g, ''));
            }
            
            // Fallback for Instagram if no links found: try the ?__a=1&__d=dis endpoint
            if (uniqueLinks.length === 0 && platform === 'instagram') {
                try {
                    const apiUrl = url.split('?')[0] + '?__a=1&__d=dis';
                    await page.goto(apiUrl, { waitUntil: 'networkidle2' });
                    const text = await page.evaluate(() => document.body.innerText);
                    const json = JSON.parse(text);
                    if (json && json.graphql && json.graphql.user && json.graphql.user.edge_owner_to_timeline_media) {
                        const edges = json.graphql.user.edge_owner_to_timeline_media.edges;
                        uniqueLinks = edges.map(e => 'https://www.instagram.com/p/' + e.node.shortcode + '/');
                    }
                } catch(e) {}
            }
            
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
