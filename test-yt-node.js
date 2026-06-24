const https = require('https');

https.get('https://www.youtube.com/@videoduemme', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const m1 = data.match(/"browseId":"(UC[a-zA-Z0-9_-]{22})"/);
        const m2 = data.match(/<meta\s+itemprop="identifier"\s+content="(UC[a-zA-Z0-9_-]{22})"/i);
        if (m1) console.log("Found: " + m1[1]);
        else if (m2) console.log("Found: " + m2[1]);
        else console.log("Not found.");
    });
}).on('error', err => console.log(err));
