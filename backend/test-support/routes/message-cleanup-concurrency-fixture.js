const { objectId, deferred, query } = require('./query');
const { makeAuth } = require('./auth');
const { createJsonApp } = require('./http');
const { createMessagesRouter } = require('../../routes/messages-routes');

async function createCleanupConcurrencyFixture() {
  const authHelpers = makeAuth();
  const userId = objectId();
  const peerId = objectId();
  const messageIds = [objectId(), objectId(), objectId()];
  const chats = new Map();
  const messages = new Map();
  for (const messageId of messageIds) {
    const chatId = objectId();
    chats.set(chatId, {
      _id: chatId,
      createdAt: new Date(),
      members: [{ user: userId }, { user: peerId }],
    });
    messages.set(messageId, { _id: messageId, chat: chatId, sender: userId });
  }

  const twoCleanupsStarted = deferred();
  const thirdCleanupStarted = deferred();
  const cleanupMayFinish = deferred();
  let activeCleanups = 0;
  let maxActiveCleanups = 0;
  let cleanupStarts = 0;
  const Message = {
    findById(messageId) {
      return query(messages.get(messageId.toString()) || null);
    },
    async deleteOne({ _id: messageId }) {
      const deleted = messages.delete(messageId.toString());
      return { deletedCount: deleted ? 1 : 0 };
    },
  };
  const Chat = {
    findById(chatId) {
      return query(chats.get(chatId.toString()) || null);
    },
  };
  const app = createJsonApp(
    '/api',
    createMessagesRouter({
      authHelpers,
      chatService: {
        async deleteMessageAttachments() {
          activeCleanups += 1;
          cleanupStarts += 1;
          maxActiveCleanups = Math.max(maxActiveCleanups, activeCleanups);
          if (cleanupStarts === 2) {
            twoCleanupsStarted.resolve();
          }
          if (cleanupStarts === 3) {
            thirdCleanupStarted.resolve();
          }
          await cleanupMayFinish.promise;
          activeCleanups -= 1;
        },
        isChatMember(chatDocument, currentUserId) {
          return chatDocument.members.some((member) => member.user.toString() === currentUserId);
        },
        async prepareMessageAttachmentsForDeletion() {},
        async restoreMessageAttachments() {},
        async syncChatLastMessage() {},
      },
      io: { to: () => ({ emit() {} }) },
      models: { Chat, Message },
      realtime: {
        emitUserEvent() {},
        async runChatOperationExclusive(_chatId, operation) {
          return operation();
        },
      },
    })
  );
  return {
    app,
    authHelpers,
    userId,
    messageIds,
    twoCleanupsStarted,
    thirdCleanupStarted,
    cleanupMayFinish,
    getCleanupStarts: () => cleanupStarts,
    getMaxActiveCleanups: () => maxActiveCleanups,
  };
}

module.exports = { createCleanupConcurrencyFixture };
