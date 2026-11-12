const assert = require('node:assert/strict');
const { objectId, query } = require('./query');
const { makeAuth } = require('./auth');
const { createJsonApp } = require('./http');
const { createChatsRouter } = require('../../routes/chats-routes');
const { createGroupChatService } = require('./group-service');

async function createGroupFixture() {
  const authHelpers = makeAuth();
  const creatorId = objectId();
  const memberId = objectId();
  const secondMemberId = objectId();
  const addedMemberId = objectId();
  const chatId = objectId();
  const messageId = objectId();
  const emittedUserEvents = [];
  const emittedStatusUpdates = [];
  const evictedUserSockets = [];
  const exclusiveChatOperations = [];
  let insideExclusiveChatOperation = false;
  const state = { createdChat: null };

  const User = {
    find(filters) {
      const users = [creatorId, memberId, secondMemberId, addedMemberId].map((id) => ({ _id: id }));
      const selectedIds = new Set((filters._id?.$in || []).map(String));
      return query(users.filter((user) => selectedIds.has(user._id)));
    },
  };

  const Chat = {
    async create(data) {
      state.createdChat = {
        _id: chatId,
        ...data,
        async save() {},
      };
      return state.createdChat;
    },
    async findById(id) {
      return id === chatId ? state.createdChat : null;
    },
  };

  const chatService = createGroupChatService({ state, chatId, messageId, creatorId, emittedStatusUpdates });

  const app = createJsonApp(
    '/api',
    createChatsRouter({
      authHelpers,
      chatService,
      models: { Chat, Message: {}, User },
      realtime: {
        emitUserEvent(userIds, eventName) {
          emittedUserEvents.push({ userIds: userIds.map(String), eventName });
        },
        joinUserSocketsToChat() {
          assert.equal(insideExclusiveChatOperation, true);
        },
        leaveUserSocketsFromChat(userId, chatIdValue) {
          evictedUserSockets.push({ userId, chatId: chatIdValue });
        },
        async runChatOperationExclusive(chatIdValue, operation) {
          exclusiveChatOperations.push(chatIdValue);
          insideExclusiveChatOperation = true;
          try {
            return await operation();
          } finally {
            insideExclusiveChatOperation = false;
          }
        },
      },
    })
  );
  return {
    app,
    authHelpers,
    creatorId,
    memberId,
    secondMemberId,
    addedMemberId,
    chatId,
    messageId,
    emittedUserEvents,
    emittedStatusUpdates,
    evictedUserSockets,
    exclusiveChatOperations,
    state,
  };
}

module.exports = { createGroupFixture };
