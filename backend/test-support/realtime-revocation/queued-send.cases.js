const assert = require('node:assert/strict');
const test = require('node:test');
const { objectId, deferred, query } = require('./query');
const { registerHarness } = require('./harness');

test('a send queued behind member removal rechecks membership before persisting', async () => {
  const userId = objectId();
  const peerId = objectId();
  const chatId = objectId();
  const chat = {
    _id: chatId,
    members: [{ user: userId }, { user: peerId }],
  };
  let createCalls = 0;
  const Chat = {
    find() {
      return query([chat]);
    },
    findById() {
      return query(chat);
    },
  };
  const Message = {
    async create() {
      createCalls += 1;
      return null;
    },
    findOne() {
      return query(null);
    },
  };
  const harness = registerHarness({
    Chat,
    Message,
    User: { async findByIdAndUpdate() {} },
    userId,
  });
  await harness.io.connectionHandler(harness.socket);

  const removalMayFinish = deferred();
  const removalStarted = deferred();
  const removalPromise = harness.realtime.runChatOperationExclusive(chatId, async () => {
    removalStarted.resolve();
    await removalMayFinish.promise;
    chat.members = [{ user: peerId }];
  });
  await removalStarted.promise;

  const responsePromise = new Promise((resolve) => {
    harness.socketHandlers['message:send'](
      {
        chatId,
        clientMessageId: 'send-after-removal-0001',
        text: 'must not persist',
      },
      resolve
    );
  });

  removalMayFinish.resolve();
  await removalPromise;
  const response = await responsePromise;

  assert.equal(response.error, 'Chat not found.');
  assert.equal(createCalls, 0);
  assert.equal(
    harness.emittedEvents.some((event) => event.eventName === 'message:new'),
    false
  );
});
