const https = require('https');

const host = 'facebook-scraper7.p.rapidapi.com';
const key = process.env.RAPIDAPI_KEY || '';
const username = process.argv[2] || 'Mercedes-AMG';

if (!key) {
  console.error('RAPIDAPI_KEY non configurata nell\'ambiente.');
  process.exit(1);
}

function request(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      port: 443,
      path,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-rapidapi-host': host,
        'x-rapidapi-key': key,
      },
      timeout: 45000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          reject(new Error(`Risposta JSON non valida (HTTP ${res.statusCode})`));
          return;
        }
        if ((res.statusCode || 500) >= 400 || parsed.status === 'error' || parsed.error) {
          const message = parsed.message || parsed.error?.message || parsed.error || 'richiesta rifiutata';
          reject(new Error(`HTTP ${res.statusCode}: ${String(message)}`));
          return;
        }
        resolve(parsed);
      });
    });
    req.on('timeout', () => req.destroy(new Error('Timeout RapidAPI')));
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const page = await request(`/api/pages/id?username=${encodeURIComponent(username)}`);
  const pageId = page.data?.id;
  if (!pageId) throw new Error('ID pagina assente nella risposta');

  const result = await request(`/api/pages/${encodeURIComponent(pageId)}/posts?cursor=${encodeURIComponent('{}')}`);
  const posts = Array.isArray(result.data?.posts) ? result.data.posts : [];
  console.log(JSON.stringify({
    ok: true,
    username,
    posts: posts.length,
    first: posts[0] ? {
      url: posts[0].url || '',
      hasText: Boolean(posts[0].text),
      creationTime: posts[0].creation_time || null,
    } : null,
  }, null, 2));
})().catch((error) => {
  console.error(`Test RapidAPI fallito: ${error.message}`);
  process.exit(1);
});
