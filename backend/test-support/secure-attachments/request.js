const http = require('node:http');

function requestBytes(server, path, token) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port: server.address().port, path,
      headers: token ? { Authorization: `Bearer ${token}` } : {} }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers,
        body: Buffer.concat(chunks) }));
    });
    request.on('error', reject);
  });
}

module.exports = { requestBytes };
