const token = process.env.APIFY_API_TOKEN;
if (!token) throw new Error('Imposta APIFY_API_TOKEN nell’ambiente prima di eseguire il test.');
const url = 'https://api.apify.com/v2/acts/apify~facebook-posts-scraper/run-sync-get-dataset-items?token=' + token;

const payload = {
    startUrls: [{ url: 'https://www.facebook.com/Apple/' }],
    resultsLimit: 2
};

fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
})
.then(res => res.json())
.then(data => {
    console.log(JSON.stringify(data).substring(0, 500));
})
.catch(err => console.error(err));
