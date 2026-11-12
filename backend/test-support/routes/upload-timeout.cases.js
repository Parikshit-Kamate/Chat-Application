const assert = require('node:assert/strict');
const test = require('node:test');
const { withServer, requestJson } = require('./http');
const { createTimeoutUploadFixture } = require('./upload-timeout-fixture');

test('an ambiguous Cloudinary timeout keeps the durable intent for delayed reconciliation', async () => {
  const {
    app,
    token,
    calls,
  } = await createTimeoutUploadFixture();

  await withServer(app, async (server) => {
    const response = await requestJson(server, {
      method: 'POST',
      path: '/api/uploads',
      token,
      body: {
        fileName: 'pixel.png',
        dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      },
    });

    assert.equal(response.status, 502);
    assert.deepEqual(calls, ['create-intent', 'reserve-quota', 'upload']);
  });
});
