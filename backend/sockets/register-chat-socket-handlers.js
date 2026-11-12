const { registerAuthentication } = require('./security/authentication');
const { createUserRateLimiters } = require('./security/user-rate-limiters');
const { createPresenceReconciler } = require('./presence');
const { connectSocket } = require('./connection');

function registerChatSocketHandlers(options) {
  const { authHelpers, io, realtime } = options;
  const environment = {
    ...options,
    userRateLimiters: createUserRateLimiters(),
    joinSocketToChat: realtime.joinSocketToChat || ((socket, chatId) => {
      socket.join(`chat:${chatId}`);
      return true;
    }),
    runChatOperationExclusive: realtime.runChatOperationExclusive ||
      (async (_chatId, operation) => operation()),
  };
  environment.reconcilePresence = createPresenceReconciler(environment);
  registerAuthentication(io, authHelpers);
  io.on('connection', (socket) => connectSocket(environment, socket));
}

module.exports = { registerChatSocketHandlers };
