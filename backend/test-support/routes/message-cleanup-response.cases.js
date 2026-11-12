const assert = require('node:assert/strict');
const test = require('node:test');
const { withServer, requestJson } = require('./http');
const { createCleanupResponseFixture } = require('./message-cleanup-response-fixture');

test('message deletion is serialized without waiting for remote attachment cleanup', async () => {
  const {
    app,
    authHelpers,
    userId,
    messageId,
    calls,
    cleanupStarted,
    cleanupMayFinish,
  } = await createCleanupResponseFixture();

  await withServer(app, async (server) => {
    const token = authHelpers.createJwtToken({ sub: userId, username: 'owner' });
    const responsePromise = requestJson(server, {
      method: 'DELETE',
      path: `/api/messages/${messageId}`,
      token,
    });
    await cleanupStarted.promise;
    const responseBeforeCleanup = await Promise.race([
      responsePromise.then((response) => ({ response })),
      new Promise((resolve) => setTimeout(() => resolve(null), 500)),
    ]);
    cleanupMayFinish.resolve();
    const response = responseBeforeCleanup?.response || (await responsePromise);

    assert.ok(responseBeforeCleanup, 'The HTTP response should not wait for attachment storage cleanup.');
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [
      'lock',
      'prepare-attachments',
      'delete-message',
      'sync-last-message',
      'delete-attachments',
    ]);
  });
});
