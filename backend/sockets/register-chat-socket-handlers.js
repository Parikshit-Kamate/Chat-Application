const mongoose = require('mongoose');
const { normalizeObjectId } = require('../lib/object-id');

const MAX_AUTH_TIMER_DELAY_MS = 2_147_483_647;
const MAX_SOCKETS_PER_USER = 8;
const MAX_USER_RATE_LIMITERS = 10_000;
const USER_RATE_LIMITER_RETENTION_MS = 5 * 60 * 1000;
const CLIENT_MESSAGE_ID_PATTERN = /^[a-z0-9_-]{16,64}$/i;
const SOCKET_CONNECTION_RATE_LIMIT = { capacity: 12, refillPerSecond: 0.1 };
const AUTH_EXPIRED_RESPONSE = {
  error: 'Authentication token expired.',
  code: 'AUTH_EXPIRED',
};
const RATE_LIMITED_RESPONSE = {
  error: 'Too many realtime requests. Please slow down.',
  code: 'RATE_LIMITED',
};
const SOCKET_EVENT_RATE_LIMITS = {
  'chat:open': { bucket: 'chat-navigation', capacity: 12, refillPerSecond: 0.5 },
  'chat:close': { bucket: 'chat-navigation', capacity: 12, refillPerSecond: 0.5 },
  'typing:start': { bucket: 'typing', capacity: 20, refillPerSecond: 3 },
  'typing:stop': { bucket: 'typing', capacity: 20, refillPerSecond: 3 },
  'messages:mark_seen': { bucket: 'message-status', capacity: 40, refillPerSecond: 2 },
  'message:delivered': { bucket: 'message-status', capacity: 40, refillPerSecond: 2 },
  'message:seen': { bucket: 'message-status', capacity: 40, refillPerSecond: 2 },
  'message:send': { bucket: 'message-send', capacity: 10, refillPerSecond: 0.5 },
};
const SOCKET_EVENT_ERROR_MESSAGES = {
  'chat:open': 'Unable to open chat.',
  'chat:close': 'Unable to close chat.',
  'typing:start': 'Unable to update typing status.',
  'typing:stop': 'Unable to update typing status.',
  'messages:mark_seen': 'Unable to mark messages as seen.',
  'message:delivered': 'Unable to update delivery status.',
  'message:seen': 'Unable to update seen status.',
  'message:send': 'Unable to send message.',
};

function normalizeSocketPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value : {};
}

function findAcknowledgement(args) {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    if (typeof args[index] === 'function') {
      return args[index];
    }
  }

  return null;
}

function createSafeAcknowledgement(candidate) {
  let acknowledged = false;

  return (payload) => {
    if (acknowledged || typeof candidate !== 'function') {
      return;
    }

    acknowledged = true;

    try {
      candidate(payload);
    } catch (error) {
      console.error('Socket acknowledgement error:', error);
    }
  };
}

function normalizeClientMessageId(value) {
  const clientMessageId = typeof value === 'string' ? value.trim() : '';
  return CLIENT_MESSAGE_ID_PATTERN.test(clientMessageId) ? clientMessageId : '';
}

function createSocketRateLimiter() {
  const buckets = new Map();

  return (eventName) => {
    const config = SOCKET_EVENT_RATE_LIMITS[eventName];
    if (!config) {
      return { allowed: true, retryAfterMs: 0 };
    }

    const now = Date.now();
    const previous = buckets.get(config.bucket) || {
      tokens: config.capacity,
      updatedAt: now,
    };
    const elapsedSeconds = Math.max(0, now - previous.updatedAt) / 1000;
    const tokens = Math.min(config.capacity, previous.tokens + elapsedSeconds * config.refillPerSecond);

    if (tokens < 1) {
      buckets.set(config.bucket, { tokens, updatedAt: now });
      return {
        allowed: false,
        retryAfterMs: Math.max(1, Math.ceil(((1 - tokens) / config.refillPerSecond) * 1000)),
      };
    }

    buckets.set(config.bucket, {
      tokens: tokens - 1,
      updatedAt: now,
    });

    return { allowed: true, retryAfterMs: 0 };
  };
}

function createConnectionRateLimiter() {
  let tokens = SOCKET_CONNECTION_RATE_LIMIT.capacity;
  let updatedAt = Date.now();

  return () => {
    const now = Date.now();
    const elapsedSeconds = Math.max(0, now - updatedAt) / 1000;
    tokens = Math.min(
      SOCKET_CONNECTION_RATE_LIMIT.capacity,
      tokens + elapsedSeconds * SOCKET_CONNECTION_RATE_LIMIT.refillPerSecond
    );
    updatedAt = now;

    if (tokens < 1) {
      return {
        allowed: false,
        retryAfterMs: Math.max(
          1,
          Math.ceil(((1 - tokens) / SOCKET_CONNECTION_RATE_LIMIT.refillPerSecond) * 1000)
        ),
      };
    }

    tokens -= 1;
    return { allowed: true, retryAfterMs: 0 };
  };
}

function getChatCoMemberIds(chats, userId) {
  const coMemberIds = new Set();

  (chats || []).forEach((chat) => {
    (chat.members || []).forEach((member) => {
      const memberId = member.user?._id?.toString?.() || member.user?.toString?.() || '';
      if (memberId && memberId !== userId) {
        coMemberIds.add(memberId);
      }
    });
  });

  return Array.from(coMemberIds);
}

function registerChatSocketHandlers({ authHelpers, chatService, io, models, realtime }) {
  const { Chat, Message, User } = models;
  const { getBearerToken, verifyJwtToken } = authHelpers;
  const {
    claimPendingAttachments,
    finalizeMessageAttachments,
    idList,
    isChatMember,
    markMessagesDelivered,
    markMessagesSeen,
    releaseMessageAttachments,
    serializeMessage,
  } = chatService;
  const {
    addUserSocket,
    getLiveSocketIdsForUser,
    isUserActiveInChat,
    isUserOnline,
    removeUserSocket,
  } = realtime;
  const joinSocketToChat = realtime.joinSocketToChat || ((socket, chatId) => {
    socket.join(`chat:${chatId}`);
    return true;
  });
  const runChatOperationExclusive =
    realtime.runChatOperationExclusive || (async (_chatId, operation) => operation());
  const userEventRateLimiters = new Map();
  const presenceUpdateQueues = new Map();

  function pruneUserEventRateLimiters(now = Date.now()) {
    userEventRateLimiters.forEach((record, recordUserId) => {
      if (record.expiresAt && record.expiresAt <= now) {
        userEventRateLimiters.delete(recordUserId);
      }
    });

    while (userEventRateLimiters.size >= MAX_USER_RATE_LIMITERS) {
      const oldestUserId = userEventRateLimiters.keys().next().value;
      if (oldestUserId === undefined) {
        break;
      }
      userEventRateLimiters.delete(oldestUserId);
    }
  }

  function getUserRateLimiters(userId) {
    pruneUserEventRateLimiters();
    const existingRecord = userEventRateLimiters.get(userId);
    if (existingRecord) {
      existingRecord.expiresAt = 0;
      return existingRecord;
    }

    const record = {
      consumeConnection: createConnectionRateLimiter(),
      consumeEvent: createSocketRateLimiter(),
      expiresAt: 0,
    };
    userEventRateLimiters.set(userId, record);
    return record;
  }

  function retainUserEventRateLimiter(userId) {
    const record = userEventRateLimiters.get(userId);
    if (record) {
      record.expiresAt = Date.now() + USER_RATE_LIMITER_RETENTION_MS;
    }
  }

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        getBearerToken(socket.handshake.headers?.authorization || '');

      if (!token) {
        return next(new Error('Authentication token missing.'));
      }

      const payload = verifyJwtToken(token);
      if (!Number.isSafeInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
        return next(new Error('Invalid authentication token.'));
      }

      socket.data.userId = payload.sub;
      socket.data.username = payload.username || '';
      socket.data.activeChatId = null;
      socket.data.authExpiresAtMs = payload.exp * 1000;

      return next();
    } catch (_error) {
      return next(new Error('Invalid authentication token.'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    const username = socket.data.username;
    const liveSocketIds =
      typeof getLiveSocketIdsForUser === 'function' ? getLiveSocketIdsForUser(userId) : [];
    const userRateLimiters = getUserRateLimiters(userId);
    const connectionRateLimit = userRateLimiters.consumeConnection();

    if (!connectionRateLimit.allowed) {
      if (liveSocketIds.length === 0) {
        retainUserEventRateLimiter(userId);
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

    const consumeEventToken = createSocketRateLimiter();
    const consumeUserEventToken = userRateLimiters.consumeEvent;
    let authExpiryTimer = null;
    let authDisconnectStarted = false;
    let socketCleanupPromise = null;

    function isAuthenticationExpired() {
      return !Number.isFinite(socket.data.authExpiresAtMs) || Date.now() >= socket.data.authExpiresAtMs;
    }

    function disconnectExpiredAuthentication() {
      if (authDisconnectStarted) {
        return;
      }

      authDisconnectStarted = true;
      socket.data.activeChatId = null;

      if (authExpiryTimer) {
        clearTimeout(authExpiryTimer);
        authExpiryTimer = null;
      }

      if (typeof socket.disconnect === 'function') {
        socket.disconnect(true);
      }
    }

    function scheduleAuthenticationExpiry() {
      if (authExpiryTimer) {
        clearTimeout(authExpiryTimer);
      }

      const remainingMs = socket.data.authExpiresAtMs - Date.now();
      if (remainingMs <= 0) {
        disconnectExpiredAuthentication();
        return;
      }

      authExpiryTimer = setTimeout(() => {
        authExpiryTimer = null;
        scheduleAuthenticationExpiry();
      }, Math.min(remainingMs, MAX_AUTH_TIMER_DELAY_MS));
      authExpiryTimer.unref?.();
    }

    function emitPresenceToChatCoMembers(coMemberIds, payload) {
      if (coMemberIds.length === 0) {
        return;
      }

      if (typeof realtime.emitUserEvent === 'function') {
        realtime.emitUserEvent(coMemberIds, 'presence:update', payload);
        return;
      }

      coMemberIds.forEach((coMemberId) => {
        io.to(`user:${coMemberId}`).emit('presence:update', payload);
      });
    }

    function registerSocketEvent(eventName, handler) {
      socket.on(eventName, (...args) => {
        const payload = normalizeSocketPayload(args[0]);
        const acknowledge = createSafeAcknowledgement(findAcknowledgement(args));

        if (isAuthenticationExpired()) {
          acknowledge(AUTH_EXPIRED_RESPONSE);
          disconnectExpiredAuthentication();
          return Promise.resolve();
        }

        const socketRateLimit = consumeEventToken(eventName);
        const rateLimit = socketRateLimit.allowed ? consumeUserEventToken(eventName) : socketRateLimit;
        if (!rateLimit.allowed) {
          acknowledge({
            ...RATE_LIMITED_RESPONSE,
            retryAfterMs: rateLimit.retryAfterMs,
          });
          return Promise.resolve();
        }

        const handleFailure = (error) => {
          console.error(`${eventName} error:`, error);
          acknowledge({
            error: SOCKET_EVENT_ERROR_MESSAGES[eventName] || 'Unable to process realtime request.',
          });
        };

        try {
          return Promise.resolve(handler(payload, acknowledge)).catch(handleFailure);
        } catch (error) {
          handleFailure(error);
          return Promise.resolve();
        }
      });
    }

    function reconcileUserPresence(preloadedChats = null) {
      const previousUpdate = presenceUpdateQueues.get(userId) || Promise.resolve();
      const queuedUpdate = previousUpdate
        .catch(() => {})
        .then(async () => {
          const isOnlineAtStart = isUserOnline(userId);
          const lastSeen = isOnlineAtStart ? null : new Date();

          await User.findByIdAndUpdate(userId, {
            $set: {
              isOnline: isOnlineAtStart,
              lastSeen,
            },
          });

          const currentUserChats =
            preloadedChats ||
            (await Chat.find({ 'members.user': userId })
              .select('members.user')
              .limit(200));

          if (isUserOnline(userId) !== isOnlineAtStart) {
            return;
          }

          emitPresenceToChatCoMembers(getChatCoMemberIds(currentUserChats, userId), {
            userId,
            isOnline: isOnlineAtStart,
            lastSeen,
          });
        });
      const trackedUpdate = queuedUpdate
        .catch((error) => {
          console.error('Presence reconciliation error:', error);
        })
        .finally(() => {
          if (presenceUpdateQueues.get(userId) === trackedUpdate) {
            presenceUpdateQueues.delete(userId);
          }
        });

      presenceUpdateQueues.set(userId, trackedUpdate);
      return trackedUpdate;
    }

    function cleanupSocketState() {
      if (socketCleanupPromise) {
        return socketCleanupPromise;
      }

      socketCleanupPromise = (async () => {
        authDisconnectStarted = true;
        if (authExpiryTimer) {
          clearTimeout(authExpiryTimer);
          authExpiryTimer = null;
        }

        try {
          removeUserSocket(userId, socket.id);

          if (!isUserOnline(userId)) {
            retainUserEventRateLimiter(userId);
            await reconcileUserPresence();
          }
        } catch (error) {
          console.error('Disconnect cleanup error:', error);
        }
      })();

      return socketCleanupPromise;
    }

    socket.on('disconnect', cleanupSocketState);

    scheduleAuthenticationExpiry();

    if (isAuthenticationExpired()) {
      disconnectExpiredAuthentication();
      return;
    }

    try {
      addUserSocket(userId, socket.id);
      socket.join(`user:${userId}`);

      const userChats = await Chat.find({ 'members.user': userId })
        .select('_id members.user')
        .limit(200);

      if (!socket.connected || socketCleanupPromise) {
        await cleanupSocketState();
        return;
      }

      userChats.forEach((chat) => {
        joinSocketToChat(socket, chat._id.toString());
      });

      if (liveSocketIds.length === 0) {
        await reconcileUserPresence(userChats);
      }

      if (!socket.connected || socketCleanupPromise) {
        await cleanupSocketState();
        return;
      }

      socket.emit('chat:list:refresh');

      registerSocketEvent('chat:open', async (payload = {}, callback = () => {}) => {
        try {
          const chatId = normalizeObjectId(payload.chatId);
          if (!chatId) {
            callback({ error: 'Invalid chat ID.' });
            return;
          }

          const chat = await Chat.findById(chatId);
          if (!chat || !isChatMember(chat, userId)) {
            callback({ error: 'Chat not found.' });
            return;
          }

          socket.data.activeChatId = chatId;
          if (!joinSocketToChat(socket, chatId)) {
            socket.data.activeChatId = null;
            callback({ error: 'Chat not found.' });
            return;
          }

          const deliveredUpdates = await markMessagesDelivered(chatId, userId);
          const seenUpdates = await markMessagesSeen(chatId, userId);

          deliveredUpdates.forEach((status) => {
            io.to(`chat:${chatId}`).emit('message:status', status);
          });

          seenUpdates.forEach((status) => {
            io.to(`chat:${chatId}`).emit('message:status', status);
          });

          io.to(`user:${userId}`).emit('chat:list:refresh');

          callback({ ok: true });
        } catch (error) {
          console.error('chat:open error:', error);
          callback({ error: 'Unable to open chat.' });
        }
      });

      registerSocketEvent('chat:close', (payload = {}) => {
        const chatId = normalizeObjectId(payload.chatId);
        if (socket.data.activeChatId === chatId) {
          socket.data.activeChatId = null;
        }
      });

      registerSocketEvent('typing:start', async (payload = {}) => {
        const chatId = normalizeObjectId(payload.chatId);
        if (!chatId) {
          return;
        }

        const chat = await Chat.findById(chatId).select('_id members.user');
        if (!chat || !isChatMember(chat, userId)) {
          return;
        }

        socket.to(`chat:${chatId}`).emit('typing:update', {
          chatId,
          userId,
          username,
          isTyping: true,
        });
      });

      registerSocketEvent('typing:stop', async (payload = {}) => {
        const chatId = normalizeObjectId(payload.chatId);
        if (!chatId) {
          return;
        }

        const chat = await Chat.findById(chatId).select('_id members.user');
        if (!chat || !isChatMember(chat, userId)) {
          return;
        }

        socket.to(`chat:${chatId}`).emit('typing:update', {
          chatId,
          userId,
          username,
          isTyping: false,
        });
      });

      registerSocketEvent('messages:mark_seen', async (payload = {}, callback = () => {}) => {
        try {
          const chatId = normalizeObjectId(payload.chatId);
          if (!chatId) {
            callback({ error: 'Invalid chat ID.' });
            return;
          }

          const chat = await Chat.findById(chatId).select('_id members.user');
          if (!chat || !isChatMember(chat, userId)) {
            callback({ error: 'Chat not found.' });
            return;
          }

          const seenUpdates = await markMessagesSeen(chatId, userId);
          seenUpdates.forEach((status) => {
            io.to(`chat:${chatId}`).emit('message:status', status);
          });

          io.to(`user:${userId}`).emit('chat:list:refresh');

          callback({ ok: true, count: seenUpdates.length });
        } catch (error) {
          console.error('messages:mark_seen error:', error);
          callback({ error: 'Unable to mark messages as seen.' });
        }
      });

      registerSocketEvent('message:delivered', async (payload = {}, callback = () => {}) => {
        try {
          const chatId = normalizeObjectId(payload.chatId);
          const messageId = normalizeObjectId(payload.messageId);

          if (!chatId || !messageId) {
            callback({ error: 'Invalid payload.' });
            return;
          }

          const chat = await Chat.findById(chatId).select('_id members.user');
          if (!chat || !isChatMember(chat, userId)) {
            callback({ error: 'Chat not found.' });
            return;
          }

          const message = await Message.findOneAndUpdate(
            { _id: messageId, chat: chatId },
            { $addToSet: { deliveredTo: userId } },
            { new: true }
          );

          if (!message) {
            callback({ error: 'Message not found.' });
            return;
          }

          const status = {
            chatId,
            messageId,
            deliveredTo: idList(message.deliveredTo),
            seenBy: idList(message.seenBy),
          };

          io.to(`chat:${chatId}`).emit('message:status', status);

          callback({ ok: true });
        } catch (error) {
          console.error('message:delivered error:', error);
          callback({ error: 'Unable to update delivery status.' });
        }
      });

      registerSocketEvent('message:seen', async (payload = {}, callback = () => {}) => {
        try {
          const chatId = normalizeObjectId(payload.chatId);
          const messageId = normalizeObjectId(payload.messageId);

          if (!chatId || !messageId) {
            callback({ error: 'Invalid payload.' });
            return;
          }

          const chat = await Chat.findById(chatId).select('_id members.user');
          if (!chat || !isChatMember(chat, userId)) {
            callback({ error: 'Chat not found.' });
            return;
          }

          const message = await Message.findOneAndUpdate(
            { _id: messageId, chat: chatId },
            {
              $addToSet: {
                seenBy: userId,
                deliveredTo: userId,
              },
            },
            { new: true }
          );

          if (!message) {
            callback({ error: 'Message not found.' });
            return;
          }

          await Chat.updateOne(
            { _id: chatId, 'members.user': userId },
            { $set: { 'members.$.lastReadAt': new Date() } }
          );

          const status = {
            chatId,
            messageId,
            deliveredTo: idList(message.deliveredTo),
            seenBy: idList(message.seenBy),
          };

          io.to(`chat:${chatId}`).emit('message:status', status);
          io.to(`user:${userId}`).emit('chat:list:refresh');

          callback({ ok: true });
        } catch (error) {
          console.error('message:seen error:', error);
          callback({ error: 'Unable to update seen status.' });
        }
      });

      registerSocketEvent('message:send', async (payload = {}, callback = () => {}) => {
        let persistedMessage = null;

        try {
          const chatId = normalizeObjectId(payload.chatId);
          const clientMessageId = normalizeClientMessageId(payload.clientMessageId);
          const text = String(payload.text || '').trim();
          const replyToId = normalizeObjectId(payload.replyToId);
          const rawAttachments = Array.isArray(payload.attachments)
            ? payload.attachments
            : [];
          const uploadIds = rawAttachments.map((attachment) =>
            normalizeObjectId(attachment?.uploadId)
          );

          if (!chatId) {
            callback({ error: 'Invalid chat ID.' });
            return;
          }

          if (!clientMessageId) {
            callback({ error: 'Invalid client message ID.' });
            return;
          }

          if (
            rawAttachments.length > 8 ||
            uploadIds.some((uploadId) => !uploadId) ||
            new Set(uploadIds).size !== uploadIds.length
          ) {
            callback({ error: 'One or more attachments are not allowed.' });
            return;
          }

          if (!text && rawAttachments.length === 0) {
            callback({ error: 'Message cannot be empty.' });
            return;
          }

          if (text.length > 5000) {
            callback({ error: 'Message text is too long.' });
            return;
          }

          const sendResult = await runChatOperationExclusive(chatId, async () => {
            const chat = await Chat.findById(chatId);
            if (!chat || !isChatMember(chat, userId)) {
              return { error: 'Chat not found.' };
            }

            let replyMessageId = null;
            if (replyToId) {
              const replyMessage = await Message.findOne({ _id: replyToId, chat: chatId }).select('_id');
              if (replyMessage) {
                replyMessageId = replyMessage._id;
              }
            }

            const findExistingMessage = async () => {
              const existingMessage = await Message.findOne({
                sender: userId,
                clientMessageId,
              });
              const existingSenderId =
                existingMessage?.sender?._id?.toString?.() || existingMessage?.sender?.toString?.() || '';
              const existingChatId = existingMessage?.chat?.toString?.() || '';
              const existingReplyToId =
                existingMessage?.replyTo?._id?.toString?.() ||
                existingMessage?.replyTo?.toString?.() ||
                '';
              const existingUploadIds = Array.isArray(existingMessage?.attachments)
                ? existingMessage.attachments.map((attachment) =>
                    attachment?.uploadId?.toString?.() || String(attachment?.uploadId || '')
                  )
                : [];

              if (!existingMessage) {
                return null;
              }

              if (
                existingSenderId !== userId ||
                existingChatId !== chatId ||
                existingMessage.clientMessageId !== clientMessageId ||
                String(existingMessage.text || '') !== text ||
                (existingReplyToId
                  ? existingReplyToId !== (replyToId || '')
                  : Boolean(replyMessageId)) ||
                existingUploadIds.length !== uploadIds.length ||
                existingUploadIds.some((uploadId, index) => uploadId !== uploadIds[index])
              ) {
                return false;
              }

              return existingMessage;
            };

            let message = await findExistingMessage();
            if (message === false) {
              return {
                error: 'This message draft changed before delivery was confirmed. Please send it again.',
                code: 'CLIENT_MESSAGE_ID_CONFLICT',
              };
            }

            let isNewMessage = !message;

            if (isNewMessage) {
              if (
                rawAttachments.length > 0 &&
                (typeof claimPendingAttachments !== 'function' ||
                  typeof finalizeMessageAttachments !== 'function' ||
                  typeof releaseMessageAttachments !== 'function')
              ) {
                return { error: 'Attachments are temporarily unavailable.' };
              }

              const messageId = new mongoose.Types.ObjectId();
              let attachments = [];
              const finalizeClaimedAttachments = async () => {
                if (attachments.length === 0) {
                  return;
                }

                try {
                  await finalizeMessageAttachments({ messageId, ownerId: userId });
                } catch (finalizeError) {
                  console.error('Message attachment finalization error:', finalizeError);
                }
              };

              try {
                if (rawAttachments.length > 0) {
                  attachments = await claimPendingAttachments({
                    attachments: rawAttachments,
                    messageId,
                    ownerId: userId,
                  });
                }

                message = await Message.create({
                  _id: messageId,
                  chat: chatId,
                  sender: userId,
                  clientMessageId,
                  text,
                  attachments,
                  replyTo: replyMessageId,
                  deliveredTo: [userId],
                  seenBy: [userId],
                });
                await finalizeClaimedAttachments();
              } catch (error) {
                let committedMessage = null;

                try {
                  committedMessage = await Message.findOne({
                    _id: messageId,
                    chat: chatId,
                    sender: userId,
                    clientMessageId,
                  });
                } catch (verificationError) {
                  console.error('Message persistence verification error:', verificationError);
                  throw error;
                }

                if (committedMessage) {
                  message = committedMessage;
                  await finalizeClaimedAttachments();
                } else if (rawAttachments.length > 0) {
                  try {
                    await releaseMessageAttachments({ messageId, ownerId: userId });
                  } catch (releaseError) {
                    console.error('Message attachment release error:', releaseError);
                  }
                }

                if (!committedMessage) {
                  if (error?.code === 'INVALID_UPLOAD_ATTACHMENT') {
                    return { error: 'One or more attachments are not allowed.' };
                  }

                  if (error?.code !== 11000) {
                    throw error;
                  }

                  message = await findExistingMessage();
                  if (!message) {
                    return {
                      error: 'This message draft changed before delivery was confirmed. Please send it again.',
                      code: 'CLIENT_MESSAGE_ID_CONFLICT',
                    };
                  }

                  isNewMessage = false;
                }

              }
            }

            persistedMessage = message;

            if (isNewMessage) {
              try {
                await Chat.findByIdAndUpdate(chatId, {
                  $set: {
                    lastMessage: message._id,
                    updatedAt: new Date(),
                  },
                });
              } catch (error) {
                console.error('Message chat metadata update error:', error);
              }
            }

            let hydratedMessage = null;
            try {
              hydratedMessage = await Message.findById(message._id)
                .populate('sender', 'username firstName lastName isOnline lastSeen')
                .populate({
                  path: 'replyTo',
                  populate: [
                    {
                      path: 'sender',
                      select: 'username firstName lastName isOnline lastSeen',
                    },
                  ],
                });
            } catch (error) {
              console.error('Message hydration error:', error);
            }

            const outgoingMessage = serializeMessage(
              hydratedMessage || {
                _id: message._id,
                chat: message.chat,
                sender: {
                  _id: userId,
                  username,
                  firstName: '',
                  lastName: '',
                  isOnline: true,
                  lastSeen: null,
                },
                text: message.text,
                attachments: message.attachments,
                replyTo: null,
                deliveredTo: message.deliveredTo,
                seenBy: message.seenBy,
                createdAt: message.createdAt,
                updatedAt: message.updatedAt,
              }
            );

            if (!isNewMessage) {
              return { ok: true, duplicate: true, message: outgoingMessage };
            }

            const chatRoom = `chat:${chatId}`;
            const memberIds = chat.members.map((member) => member.user.toString());
            const onlineRecipients = memberIds.filter(
              (memberId) => memberId !== userId && isUserOnline(memberId)
            );
            const activeRecipients = onlineRecipients.filter((memberId) =>
              isUserActiveInChat(memberId, chatId)
            );

            io.to(chatRoom).emit('message:new', outgoingMessage);

            if (onlineRecipients.length > 0) {
              try {
                const addToSet = {
                  deliveredTo: { $each: onlineRecipients },
                };

                if (activeRecipients.length > 0) {
                  addToSet.seenBy = { $each: activeRecipients };
                }

                const updatedStatusMessage = await Message.findByIdAndUpdate(
                  message._id,
                  {
                    $addToSet: addToSet,
                  },
                  {
                    new: true,
                  }
                );

                if (activeRecipients.length > 0) {
                  const seenAt = new Date();

                  await Chat.updateOne(
                    { _id: chatId },
                    {
                      $set: {
                        'members.$[member].lastReadAt': seenAt,
                      },
                    },
                    {
                      arrayFilters: [
                        {
                          'member.user': {
                            $in: activeRecipients.map((memberId) => new mongoose.Types.ObjectId(memberId)),
                          },
                        },
                      ],
                    }
                  );
                }

                io.to(chatRoom).emit('message:status', {
                  chatId,
                  messageId: outgoingMessage.id,
                  deliveredTo: idList(updatedStatusMessage?.deliveredTo || outgoingMessage.deliveredTo),
                  seenBy: idList(updatedStatusMessage?.seenBy || outgoingMessage.seenBy),
                });
              } catch (error) {
                console.error('Message status update error:', error);
              }
            }

            memberIds.forEach((memberId) => {
              io.to(`user:${memberId}`).emit('chat:list:refresh');
            });

            for (const memberId of memberIds) {
              if (memberId !== userId && !isUserActiveInChat(memberId, chatId)) {
                io.to(`user:${memberId}`).emit('notification:new_message', {
                  chatId,
                  message: outgoingMessage,
                });
              }
            }

            return { ok: true, message: outgoingMessage };
          });

          callback(sendResult);
        } catch (error) {
          console.error('message:send error:', error);
          if (persistedMessage) {
            callback({
              ok: true,
              persisted: true,
              message: serializeMessage(persistedMessage),
            });
            return;
          }

          callback({ error: 'Unable to send message.' });
        }
      });
    } catch (error) {
      console.error('Socket connection setup error:', error);
      await cleanupSocketState();
      socket.disconnect(true);
    }
  });
}

module.exports = {
  registerChatSocketHandlers,
};
