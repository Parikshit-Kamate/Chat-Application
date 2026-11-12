const { objectId } = require('./query');
const { makeAuth } = require('./auth');
const { registerChatSocketHandlers } = require('../../sockets/register-chat-socket-handlers');
const { createSendTransport } = require('./socket-transport');
const { createSendModels } = require('./socket-models');
const { createSendChatService } = require('./socket-service');

async function createSocketSendFixture() {
  const authHelpers = makeAuth();
  const senderId = objectId();
  const recipientId = objectId();
  const chatId = objectId();
  const uploadId = objectId();
  const token = authHelpers.createJwtToken({ sub: senderId, username: 'sender' });
  const chat = {
    _id: chatId,
    members: [{ user: senderId }, { user: recipientId }],
  };
  const state = { savedMessage: null, chatUpdate: null };
  const transport = createSendTransport(token);
  const { io, socket } = transport;

  registerChatSocketHandlers({
    authHelpers,
    chatService: createSendChatService({ uploadId, senderId }),
    io,
    models: createSendModels({ state, chatId, chat, senderId }),
    realtime: {
      addUserSocket() {},
      isUserActiveInChat(userId, activeChatId) {
        return userId === recipientId && activeChatId === chatId;
      },
      isUserOnline(userId) {
        return userId === recipientId;
      },
      removeUserSocket() {},
    },
  });

  io.sockets.sockets.set(socket.id, socket);

  await new Promise((resolve, reject) => {
    io.middleware(socket, (error) => (error ? reject(error) : resolve()));
  });

  await io.connectionHandler(socket);
  return { ...transport, senderId, recipientId, chatId, uploadId, state };
}

module.exports = { createSocketSendFixture };
