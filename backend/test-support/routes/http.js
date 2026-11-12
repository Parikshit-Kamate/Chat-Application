const http = require('node:http');
const express = require('express');

function createJsonApp(mountPath, router) {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use(mountPath, router);
  return app;
}

async function withServer(app, run) {
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    return await run(server);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function requestJson(server, { method = 'GET', path, body, token }) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  const { port } = server.address();

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          Accept: 'application/json',
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (response) => {
        let data = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          resolve({
            status: response.statusCode,
            body: data ? JSON.parse(data) : null,
          });
        });
      }
    );

    request.on('error', reject);

    if (payload) {
      request.write(payload);
    }

    request.end();
  });
}

module.exports = { createJsonApp, withServer, requestJson };
