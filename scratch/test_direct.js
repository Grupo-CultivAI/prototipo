const https = require('https');
require('dotenv').config({ path: '.env.local' });

const key = process.env.GEMINI_API_KEY;
const data = JSON.stringify({
    content: {
        parts: [{ text: "O milho é uma cultura importante." }]
    }
});

const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/text-embedding-004:embedContent?key=${key}`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (d) => { body += d; });
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Body: ${body}`);
    });
});

req.on('error', (e) => {
    console.error(e);
});

req.write(data);
req.end();
