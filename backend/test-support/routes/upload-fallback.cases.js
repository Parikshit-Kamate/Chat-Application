const assert = require('node:assert/strict');
const test = require('node:test');
const { withServer, requestJson } = require('./http');
const { createFallbackUploadFixture } = require('./upload-fallback-fixture');

test('upload route validates payloads and supports local fallback uploads', async () => {
  const {
    app,
    token,
  } = await createFallbackUploadFixture();

  await withServer(app, async (server) => {
    const invalidResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/uploads',
      token,
      body: {
        fileName: 'notes.txt',
        dataUrl: 'not-a-data-url',
      },
    });

    assert.equal(invalidResponse.status, 400);

    const unsupportedResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/uploads',
      token,
      body: {
        fileName: 'unsafe.html',
        dataUrl: 'data:text/html;base64,PGgxPkJhZDwvaDE+',
      },
    });

    assert.equal(unsupportedResponse.status, 415);

    const uploadResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/uploads',
      token,
      body: {
        fileName: 'pixel.png',
        dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      },
    });

    assert.equal(uploadResponse.status, 201);
    assert.equal(uploadResponse.body.fallback, true);
    assert.equal(uploadResponse.body.file.resourceType, 'image');
    assert.equal(uploadResponse.body.file.fileName, 'pixel.png');
    assert.match(uploadResponse.body.file.uploadId, /^[a-f0-9]{24}$/);
  });
});
