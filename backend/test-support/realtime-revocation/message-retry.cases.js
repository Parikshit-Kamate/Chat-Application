const assert = require('node:assert/strict');
const test = require('node:test');
const { createRetryFixture } = require('./retry-fixture');

test('message retries reuse one persisted message and post-persistence metadata failures still acknowledge success', async () => {
  const { chatId, messages, harness, getMetadataUpdateCalls } = await createRetryFixture();

  const payload = {
    chatId,
    clientMessageId: 'retry-safe-message-0001',
    text: 'send once',
  };
  const firstResponse = await new Promise((resolve) => {
    harness.socketHandlers['message:send'](payload, resolve);
  });
  const secondResponse = await new Promise((resolve) => {
    harness.socketHandlers['message:send'](payload, resolve);
  });
  const changedDraftResponse = await new Promise((resolve) => {
    harness.socketHandlers['message:send']({ ...payload, text: 'edited after retry' }, resolve);
  });

  assert.equal(firstResponse.ok, true);
  assert.equal(secondResponse.ok, true);
  assert.equal(secondResponse.duplicate, true);
  assert.equal(changedDraftResponse.code, 'CLIENT_MESSAGE_ID_CONFLICT');
  assert.equal(messages.size, 1);
  assert.equal(getMetadataUpdateCalls(), 1);
  assert.equal(
    harness.emittedEvents.filter((event) => event.eventName === 'message:new').length,
    1
  );
});
