const token = process.env.APIFY_API_TOKEN;
if (!token) throw new Error('Imposta APIFY_API_TOKEN nell’ambiente prima di eseguire il test.');
fetch('https://api.apify.com/v2/store?search=facebook', { headers: { 'Authorization': 'Bearer ' + token }})
.then(r => r.json())
.then(d => {
    d.data.items.slice(0, 30).forEach(i => console.log(i.name));
})
.catch(console.error);
