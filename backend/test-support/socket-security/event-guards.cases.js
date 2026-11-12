const assert = require('node:assert/strict');
const test = require('node:test');
const { createSocketHarness } = require('./harness');

test('socket guards normalize malformed payloads and acknowledgement arguments', async () => {
  const harness = createSocketHarness();
  await harness.connect();

  await assert.doesNotReject(() => harness.socketHandlers['chat:close'](null, 'not-a-function'));
  await assert.doesNotReject(() => harness.socketHandlers['typing:start'](null, 'not-a-function'));
  await assert.doesNotReject(() => harness.socketHandlers['typing:stop'](null));
  await assert.doesNotReject(() => harness.socketHandlers['chat:open'](null, 'not-a-function'));

  const response = await new Promise((resolve) => {
    harness.socketHandlers['chat:open'](null, resolve);
  });

  assert.equal(response.error, 'Invalid chat ID.');
});

test('socket guard catches rejected async event handlers', async () => {
  const harness = createSocketHarness({ chatLookupError: new Error('database unavailable') });
  await harness.connect();

  await assert.doesNotReject(() => harness.socketHandlers['typing:start']({ chatId: harness.chatId }));
});

test('socket event rate limiter rejects message floods before database work', async () => {
  const harness = createSocketHarness();
  await harness.connect();
  const responses = [];

  for (let index = 0; index < 14; index += 1) {
    const response = await new Promise((resolve) => {
      harness.socketHandlers['message:send']({ chatId: 'invalid-chat-id', text: 'flood' }, resolve);
    });
    responses.push(response);
  }

  assert.equal(responses[0].error, 'Invalid chat ID.');
  assert.equal(
    responses.some((response) => response.code === 'RATE_LIMITED'),
    true
  );
});
