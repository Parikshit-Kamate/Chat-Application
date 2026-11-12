const assert = require('node:assert/strict');
const test = require('node:test');
const { withServer, requestJson } = require('./http');
const { createAmbiguousDeletionFixture } = require('./message-ambiguous-deletion-fixture');

test('message deletion does not restore attachments when the database committed before reporting an error', async () => {
  const {
    app,
    authHelpers,
    userId,
    messageId,
    calls,
  } = await createAmbiguousDeletionFixture();

  await withServer(app, async (server) => {
    const token = authHelpers.createJwtToken({ sub: userId, username: 'owner' });
    const response = await requestJson(server, {
      method: 'DELETE',
      path: `/api/messages/${messageId}`,
      token,
    });

    assert.equal(response.status, 200);
    assert.equal(calls.includes('restore-attachments'), false);
    assert.deepEqual(calls, [
      'lock',
      'prepare-attachments',
      'delete-message',
      'verify-message-deleted',
      'sync-last-message',
      'delete-attachments',
    ]);
  });
});
