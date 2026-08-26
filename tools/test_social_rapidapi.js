const https = require('https');

const key = process.env.RAPIDAPI_KEY || '';

if (!key) {
  console.error('RAPIDAPI_KEY non configurata nell\'ambiente.');
  process.exit(1);
}

function request(host, path, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
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
      timeout: timeoutMs,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        let data;
        try {
          data = JSON.parse(body);
        } catch {
          reject(new Error(`HTTP ${res.statusCode}: risposta JSON non valida`));
          return;
        }
        if ((res.statusCode || 500) >= 400 || data?.status === 'error' || data?.error) {
          const message = data?.message || data?.error?.message || data?.error || 'richiesta rifiutata';
          reject(new Error(`HTTP ${res.statusCode}: ${String(message)}`));
          return;
        }
        resolve({ data, elapsedMs: Date.now() - startedAt });
      });
    });
    req.on('timeout', () => req.destroy(new Error(`timeout dopo ${timeoutMs} ms`)));
    req.on('error', reject);
    req.end();
  });
}

function arrayCandidates(node, path = '$', depth = 0) {
  if (!node || typeof node !== 'object' || depth > 5) return [];
  const found = [];
  if (Array.isArray(node)) {
    if (node.length && node.some((item) => item && typeof item === 'object')) {
      found.push({ path, count: node.length, firstKeys: Object.keys(node.find((item) => item && typeof item === 'object') || {}) });
    }
    node.slice(0, 2).forEach((item, index) => found.push(...arrayCandidates(item, `${path}[${index}]`, depth + 1)));
    return found;
  }
  for (const [keyName, value] of Object.entries(node)) {
    found.push(...arrayCandidates(value, `${path}.${keyName}`, depth + 1));
  }
  return found;
}

async function testInstagram() {
  const host = 'instagram39.p.rapidapi.com';
  const feed = await request(host, '/getPostsByUsername?username=nike', 60000);
  return {
    feedMs: feed.elapsedMs,
    topLevelKeys: Object.keys(feed.data || {}),
    arrays: arrayCandidates(feed.data).slice(0, 8),
  };
}

async function testTikTok() {
  const host = 'tiktok-api-fast-reliable-data-scraper.p.rapidapi.com';
  const feed = await request(host, '/user/khaby.lame/feed?max_cursor=0&min_cursor=0', 60000);
  return {
    feedMs: feed.elapsedMs,
    topLevelKeys: Object.keys(feed.data || {}),
    arrays: arrayCandidates(feed.data).slice(0, 8),
  };
}

(async () => {
  const results = {};
  for (const [name, test] of [['instagram', testInstagram], ['tiktok', testTikTok]]) {
    try {
      results[name] = { ok: true, ...(await test()) };
    } catch (error) {
      results[name] = { ok: false, error: error.message };
    }
  }
  console.log(JSON.stringify(results, null, 2));
  if (Object.values(results).some((result) => !result.ok)) process.exit(1);
})();
