const { createFixedWindowRateLimiter } = require('./dependencies');

function createContext({ authHelpers, chatService, io, models, realtime }) {
  const { Chat, Message } = models;
  const {
    deleteMessageAttachments,
    isChatMember,
    prepareMessageAttachmentsForDeletion,
    restoreMessageAttachments,
    syncChatLastMessage
  } = chatService;
  const runChatOperationExclusive = realtime.runChatOperationExclusive || (async (_chatId, operation) => operation());
  const { scheduleAttachmentCleanup } = require('./attachment-cleanup-queue')({ deleteMessageAttachments });
  const messageSearchRateLimit = createFixedWindowRateLimiter({
    windowMs: 60 * 1000,
    maxAttempts: 30,
    message: 'Too many message searches. Please try again later.',
    getKey: req => `message-search:${req.auth?.sub || 'unknown'}`
  });
  const deleteMessageOperation = require('./delete-message-operation')({
    Message,
    Chat,
    isChatMember,
    prepareMessageAttachmentsForDeletion,
    restoreMessageAttachments,
    syncChatLastMessage
  });
  return {
    ...authHelpers,
    ...chatService,
    ...models,
    ...realtime,
    io,
    runChatOperationExclusive,
    messageSearchRateLimit,
    deleteMessageOperation,
    scheduleAttachmentCleanup
  };
}

module.exports = createContext;
