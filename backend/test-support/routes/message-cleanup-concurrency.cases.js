const assert = require('node:assert/strict');
const test = require('node:test');
const { withServer, requestJson } = require('./http');
const { createCleanupConcurrencyFixture } = require('./message-cleanup-concurrency-fixture');

test('message deletion bounds concurrent remote attachment cleanup jobs', async () => {
  const {
    app,
    authHelpers,
    userId,
    messageIds,
    twoCleanupsStarted,
    thirdCleanupStarted,
    cleanupMayFinish,
    getCleanupStarts,
    getMaxActiveCleanups,
  } = await createCleanupConcurrencyFixture();

  await withServer(app, async (server) => {
    const token = authHelpers.createJwtToken({ sub: userId, username: 'owner' });
    const responsePromises = messageIds.map((messageId) =>
      requestJson(server, {
        method: 'DELETE',
        path: `/api/messages/${messageId}`,
        token,
      })
    );

    await twoCleanupsStarted.promise;
    const responses = await Promise.all(responsePromises);
    assert.deepEqual(responses.map((response) => response.status), [200, 200, 200]);
    assert.equal(getCleanupStarts(), 2);
    assert.equal(getMaxActiveCleanups(), 2);

    cleanupMayFinish.resolve();
    await thirdCleanupStarted.promise;
    assert.equal(getMaxActiveCleanups(), 2);
  });
});
