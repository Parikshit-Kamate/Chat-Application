const assert = require('node:assert/strict');
const test = require('node:test');
const { createSocketSendFixture } = require('./socket-send-fixture');

test('socket message sending persists messages and emits delivery status', async () => {
  const fixture = await createSocketSendFixture();
  const { socketHandlers, senderId, recipientId, chatId, uploadId, state, roomEvents, clientEvents } = fixture;

  const sendResponse = await new Promise((resolve) => {
    socketHandlers['message:send'](
      {
        chatId,
        clientMessageId: 'routes-socket-message-0001',
        text: '  Hello team  ',
        attachments: [
          { uploadId, url: 'https://attacker.example/ignored.png', fileName: 'ignored.png' },
        ],
      },
      resolve
    );
  });

  assert.equal(sendResponse.ok, true);
  assert.equal(sendResponse.message.text, 'Hello team');
  assert.equal(state.savedMessage.text, 'Hello team');
  assert.equal(state.savedMessage.attachments[0].uploadId, uploadId);
  assert.equal(
    state.savedMessage.attachments[0].url,
    'https://res.cloudinary.com/example/image/upload/v1/file.png'
  );
  assert.deepEqual(state.savedMessage.deliveredTo.map(String).sort(), [recipientId, senderId].sort());
  assert.deepEqual(state.savedMessage.seenBy.map(String).sort(), [recipientId, senderId].sort());
  assert.equal(state.chatUpdate.id, chatId);
  assert.equal(roomEvents.some((event) => event.room === `chat:${chatId}` && event.eventName === 'message:new'), true);
  assert.equal(roomEvents.some((event) => event.room === `chat:${chatId}` && event.eventName === 'message:status'), true);
  assert.equal(clientEvents.some((event) => event.eventName === 'chat:list:refresh'), true);

  const acceptedMessage = state.savedMessage;
  const unsafeSendResponse = await new Promise((resolve) => {
    socketHandlers['message:send'](
      {
        chatId,
        clientMessageId: 'routes-socket-unsafe-0001',
        text: 'unsafe',
        attachments: [{ url: 'javascript:alert(1)', fileName: 'unsafe.html' }],
      },
      resolve
    );
  });

  assert.equal(unsafeSendResponse.error, 'One or more attachments are not allowed.');
  assert.strictEqual(state.savedMessage, acceptedMessage);
});
