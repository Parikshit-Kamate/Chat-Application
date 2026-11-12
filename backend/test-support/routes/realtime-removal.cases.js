const assert = require('node:assert/strict');
const test = require('node:test');
const { createRealtimeHelpers } = require('../../lib/realtime');
const { objectId } = require('./query');

test('realtime helper removes every live user socket from a chat room', async () => {
  const userId = objectId();
  const chatId = objectId();
  const otherChatId = objectId();
  const leftRooms = [];
  const sockets = new Map([
    [
      'socket-1',
      {
        data: { activeChatId: chatId },
        leave(roomName) {
          leftRooms.push({ socketId: 'socket-1', roomName });
        },
      },
    ],
    [
      'socket-2',
      {
        data: { activeChatId: otherChatId },
        leave(roomName) {
          leftRooms.push({ socketId: 'socket-2', roomName });
        },
      },
    ],
  ]);
  const realtime = createRealtimeHelpers({ sockets: { sockets } });

  realtime.addUserSocket(userId, 'socket-1');
  realtime.addUserSocket(userId, 'socket-2');
  await realtime.leaveUserSocketsFromChat(userId, chatId);

  assert.deepEqual(leftRooms, [
    { socketId: 'socket-1', roomName: `chat:${chatId}` },
    { socketId: 'socket-2', roomName: `chat:${chatId}` },
  ]);
  assert.equal(sockets.get('socket-1').data.activeChatId, null);
  assert.equal(sockets.get('socket-2').data.activeChatId, otherChatId);
});
