const https = require('https');

const options = {
  hostname: 'facebook-pages-scraper2.p.rapidapi.com',
  port: 443,
  path: '/get_facebook_video_post_details?video_id=561667050148506',
  method: 'GET',
  headers: {
    'x-rapidapi-host': 'facebook-pages-scraper2.p.rapidapi.com',
    'x-rapidapi-key': '8869f727bamshd445c4fa1b0ac15p1e2845jsnc50f12b5538e'
  }
};

const req = https.request(options, res => {
  let responseData = '';
  res.on('data', d => { responseData += d; });
  res.on('end', () => {
    console.log(responseData);
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
