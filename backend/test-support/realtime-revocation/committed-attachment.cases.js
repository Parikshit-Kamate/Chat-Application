const assert = require('node:assert/strict');
const test = require('node:test');
const { createCommittedAttachmentFixture } = require('./committed-attachment-fixture');

test('a message committed before an acknowledgement error keeps and finalizes its claimed attachments', async () => {
  const fixture = await createCommittedAttachmentFixture();
  const { chatId, uploadId, harness, getFinalizeCalls, getReleaseCalls } = fixture;

  const response = await new Promise((resolve) => {
    harness.socketHandlers['message:send'](
      {
        chatId,
        clientMessageId: 'ambiguous-create-message-0001',
        text: 'persist exactly once',
        attachments: [{ uploadId }],
      },
      resolve
    );
  });

  assert.equal(response.ok, true);
  assert.equal(getFinalizeCalls(), 1);
  assert.equal(getReleaseCalls(), 0);
  assert.equal(
    harness.emittedEvents.filter((event) => event.eventName === 'message:new').length,
    1
  );
});
