const https = require('https');

const agent = new https.Agent({
  rejectUnauthorized: false
});

https.get('https://127.0.0.1:7252/api/papersubmissions', { agent }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('127.0.0.1 GET status:', res.statusCode, 'data:', data.substring(0, 100)));
}).on('error', err => console.error('127.0.0.1 Error:', err.message));

https.get('https://localhost:7252/api/papersubmissions', { agent }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('localhost GET status:', res.statusCode, 'data:', data.substring(0, 100)));
}).on('error', err => console.error('localhost Error:', err.message));
