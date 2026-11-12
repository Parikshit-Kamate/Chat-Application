const assert = require('node:assert/strict');
const test = require('node:test');
const { createSocketHarness } = require('./harness');

test('socket authentication expiry rejects events and disconnects the socket', async () => {
  const harness = createSocketHarness();
  await harness.connect();

  assert.equal(Number.isFinite(harness.socket.data.authExpiresAtMs), true);
  harness.socket.data.authExpiresAtMs = Date.now() - 1;

  const response = await new Promise((resolve) => {
    harness.socketHandlers['chat:open']({ chatId: harness.chatId }, resolve);
  });

  assert.equal(response.code, 'AUTH_EXPIRED');
  assert.deepEqual(harness.disconnectCalls, [true]);
});

test('socket authentication expiry timer disconnects at the retained deadline', async () => {
  const harness = createSocketHarness();
  await harness.authenticate();
  harness.socket.data.authExpiresAtMs = Date.now() + 25;
  await harness.io.connectionHandler(harness.socket);

  await new Promise((resolve) => setTimeout(resolve, 75));

  assert.deepEqual(harness.disconnectCalls, [true]);
  await harness.socket.disconnectCleanup;
});
