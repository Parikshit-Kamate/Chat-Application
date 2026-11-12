const { createAuthHelpers } = require('../../lib/auth');
const { registerChatSocketHandlers } = require('../../sockets/register-chat-socket-handlers');
const { objectId } = require('./query');
const { createTransport } = require('./transport');
const { createModels } = require('./models');
const { createChatService, createRealtime } = require('./services');

function createSocketHarness({ chatLookupError = null } = {}) {
  const authHelpers = createAuthHelpers({
    jwtSecret: 'socket-security-test-secret',
    jwtExpiresInSeconds: 60 * 60,
  });
  const userId = objectId();
  const peerId = objectId();
  const outsiderId = objectId();
  const chatId = objectId();
  const token = authHelpers.createJwtToken({ sub: userId, username: 'socket-user' });
  const transport = createTransport(token);
  const { io, socket } = transport;
  const presenceEvents = [];
  const chat = { _id: chatId, members: [{ user: userId }, { user: peerId }] };
  registerChatSocketHandlers({
    authHelpers,
    chatService: createChatService(),
    io,
    models: createModels(chat, chatLookupError),
    realtime: createRealtime(presenceEvents),
  });

  async function authenticate() {
    await new Promise((resolve, reject) => {
      io.middleware(socket, (error) => (error ? reject(error) : resolve()));
    });
  }

  async function connect() {
    await authenticate();
    io.sockets.sockets.set(socket.id, socket);
    await io.connectionHandler(socket);
  }

  return {
    ...transport,
    chatId,
    connect,
    authenticate,
    outsiderId,
    peerId,
    presenceEvents,
    userId,
  };
}

module.exports = { createSocketHarness };
