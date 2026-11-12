const { createFixedWindowRateLimiter } = require('./dependencies');

function createContext({ authHelpers, chatService, models, realtime }) {
  const { Chat, User } = models;
  const { hasAcceptedFriendship, idList, isChatMember } = chatService;
  const { joinUserSocketsToChat, leaveUserSocketsFromChat } = realtime;
  const runChatOperationExclusive = realtime.runChatOperationExclusive || (async (_chatId, operation) => operation());
  const DEFAULT_MESSAGE_PAGE_SIZE = 40;
  const MAX_MESSAGE_PAGE_SIZE = 80;
  const groupMutationRateLimit = createFixedWindowRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxAttempts: 30,
    message: 'Too many group changes. Please try again later.',
    getKey: req => `group:${req.auth?.sub || 'unknown'}`
  });
  const chatListRateLimit = createFixedWindowRateLimiter({
    windowMs: 60 * 1000,
    maxAttempts: 30,
    message: 'Too many chat list requests. Please try again later.',
    getKey: req => `chat-list:${req.auth?.sub || 'unknown'}`
  });
  const messageHistoryRateLimit = createFixedWindowRateLimiter({
    windowMs: 60 * 1000,
    maxAttempts: 120,
    message: 'Too many message history requests. Please try again later.',
    getKey: req => `message-history:${req.auth?.sub || 'unknown'}`
  });
  const inChatSearchRateLimit = createFixedWindowRateLimiter({
    windowMs: 60 * 1000,
    maxAttempts: 30,
    message: 'Too many message searches. Please try again later.',
    getKey: req => `chat-search:${req.auth?.sub || 'unknown'}`
  });
  const limitInChatSearch = require('./limit-in-chat-search')({ inChatSearchRateLimit });
  const areAcceptedFriends = require('./are-accepted-friends')({ hasAcceptedFriendship });
  const getGroupMemberIds = require('./get-group-member-ids');
  const isGroupAdmin = require('./is-group-admin')({ idList });
  const getMessagePageSize = require('./get-message-page-size')({
    DEFAULT_MESSAGE_PAGE_SIZE,
    MAX_MESSAGE_PAGE_SIZE
  });
  const encodeMessageCursor = require('./encode-message-cursor');
  const decodeMessageCursor = require('./decode-message-cursor');
  const updateGroupOperation = require('./update-group-operation')({ Chat, isChatMember, idList });
  const addMembersOperation = require('./add-members-operation')({
    Chat,
    isChatMember,
    isGroupAdmin,
    getGroupMemberIds,
    User,
    areAcceptedFriends,
    joinUserSocketsToChat
  });
  const removeMemberOperation = require('./remove-member-operation')({
    Chat,
    isChatMember,
    getGroupMemberIds,
    isGroupAdmin,
    leaveUserSocketsFromChat
  });
  return {
    ...authHelpers,
    ...chatService,
    ...models,
    ...realtime,
    runChatOperationExclusive,
    DEFAULT_MESSAGE_PAGE_SIZE,
    MAX_MESSAGE_PAGE_SIZE,
    groupMutationRateLimit,
    chatListRateLimit,
    messageHistoryRateLimit,
    inChatSearchRateLimit,
    limitInChatSearch,
    areAcceptedFriends,
    getGroupMemberIds,
    isGroupAdmin,
    getMessagePageSize,
    encodeMessageCursor,
    decodeMessageCursor,
    updateGroupOperation,
    addMembersOperation,
    removeMemberOperation
  };
}

module.exports = createContext;
