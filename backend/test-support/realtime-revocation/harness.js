const { createRealtimeHelpers } = require('../../lib/realtime');
const { registerChatSocketHandlers } = require('../../sockets/register-chat-socket-handlers');
const { createIoAndSocket } = require('./transport');
const { createChatServiceStub } = require('./chat-service');

function registerHarness({ Chat, Message, User, chatServiceOverrides = {}, userId }) {
  const transport = createIoAndSocket({ userId });
  const realtime = createRealtimeHelpers(transport.io);

  registerChatSocketHandlers({
    authHelpers: {
      getBearerToken() {
        return '';
      },
      verifyJwtToken() {
        throw new Error('Authentication middleware is not used by this harness.');
      },
    },
    chatService: { ...createChatServiceStub(), ...chatServiceOverrides },
    io: transport.io,
    models: { Chat, Message, User },
    realtime,
  });

  return { ...transport, realtime };
}

module.exports = { registerHarness };
