const { MAX_SOCKETS_PER_USER } = require('./security/constants');
const { createAuthenticationExpiry } = require('./security/authentication-expiry');
const { createEventRegistrar } = require('./security/register-event');
const { createConnectionCleanup } = require('./connection-cleanup');
const { registerNavigationEvents } = require('./handlers/navigation');
const { registerTypingEvents } = require('./handlers/typing');
const { registerSeenMessagesEvent } = require('./handlers/seen-messages');
const { registerMessageStatusEvents } = require('./handlers/message-status');
const { registerSendMessageEvent } = require('./messages/register-send');

async function connectSocket(environment, socket) {
  const userId = socket.data.userId;
  const { realtime, userRateLimiters } = environment;
  const { getLiveSocketIdsForUser, addUserSocket } = realtime;
  const { joinSocketToChat, reconcilePresence } = environment;
  const liveSocketIds = typeof getLiveSocketIdsForUser === 'function'
    ? getLiveSocketIdsForUser(userId) : [];
  const rateLimiters = userRateLimiters.get(userId);
  const connectionRateLimit = rateLimiters.consumeConnection();
  if (!connectionRateLimit.allowed) {
    if (liveSocketIds.length === 0) {
      userRateLimiters.retain(userId);
    }
    socket.emit('security:error', {
      error: 'Too many connection attempts for this account.',
      retryAfterMs: connectionRateLimit.retryAfterMs,
    });
    socket.disconnect(true);
    return;
  }
  if (liveSocketIds.length >= MAX_SOCKETS_PER_USER) {
    socket.emit('security:error', { error: 'Too many active connections for this account.' });
    socket.disconnect(true);
    return;
  }

  const context = { ...environment, socket, userId, username: socket.data.username };
  const authentication = createAuthenticationExpiry(socket);
  const { cleanup, hasStarted } = createConnectionCleanup(context, authentication);
  const registerEvent = createEventRegistrar(socket, authentication, rateLimiters.consumeEvent);
  socket.on('disconnect', cleanup);
  authentication.schedule();
  if (authentication.isExpired()) {
    authentication.disconnect();
    return;
  }

  try {
    addUserSocket(userId, socket.id);
    socket.join(`user:${userId}`);
    const userChats = await context.models.Chat.find({ 'members.user': userId })
      .select('_id members.user').limit(200);
    if (!socket.connected || hasStarted()) {
      await cleanup();
      return;
    }
    userChats.forEach((chat) => joinSocketToChat(socket, chat._id.toString()));
    if (liveSocketIds.length === 0) {
      await reconcilePresence(userId, userChats);
    }
    if (!socket.connected || hasStarted()) {
      await cleanup();
      return;
    }

    socket.emit('chat:list:refresh');
    registerNavigationEvents(context, registerEvent);
    registerTypingEvents(context, registerEvent);
    registerSeenMessagesEvent(context, registerEvent);
    registerMessageStatusEvents(context, registerEvent);
    registerSendMessageEvent(context, registerEvent);
  } catch (error) {
    console.error('Socket connection setup error:', error);
    await cleanup();
    socket.disconnect(true);
  }
}

module.exports = { connectSocket };
