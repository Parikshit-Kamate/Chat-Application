const assert = require('node:assert/strict');
const test = require('node:test');
const { objectId, deferred, query } = require('./query');
const { registerHarness } = require('./harness');

test('a removal during socket setup prevents a stale membership result from rejoining the room', async () => {
  const userId = objectId();
  const peerId = objectId();
  const chatId = objectId();
  const staleChat = {
    _id: chatId,
    members: [{ user: userId }, { user: peerId }],
  };
  const chatQuery = deferred();
  const queryStarted = deferred();
  const Chat = {
    find() {
      queryStarted.resolve();
      return query(chatQuery.promise);
    },
  };
  const harness = registerHarness({
    Chat,
    Message: {},
    User: { async findByIdAndUpdate() {} },
    userId,
  });

  const connectionPromise = harness.io.connectionHandler(harness.socket);
  await queryStarted.promise;
  await harness.realtime.leaveUserSocketsFromChat(userId, chatId);
  chatQuery.resolve([staleChat]);
  await connectionPromise;

  assert.equal(harness.joinedRooms.has(`chat:${chatId}`), false);
  assert.equal(harness.socket.data.revokedChatIds.has(chatId), true);
  assert.deepEqual(harness.leftRooms, [`chat:${chatId}`]);
});
