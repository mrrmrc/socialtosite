const https = require('https');

const data = JSON.stringify({
  usernames: ["zuck"],
  resultsLimit: 2
});

const options = {
  hostname: 'api.socialcrawl.dev',
  port: 443,
  path: '/instagram/profile',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'sc_czKzcDGDFAyhYQ0DCGmESZW_pMN39JuWIjOD3UEVXfE',
    'Content-Length': data.length
  }
};

console.log('Sending request to /instagram/profile...');
const req = https.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  let responseData = '';
  
  res.on('data', d => {
    responseData += d;
  });

  res.on('end', () => {
    console.log('Response body:', responseData.substring(0, 500) + '...');
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
