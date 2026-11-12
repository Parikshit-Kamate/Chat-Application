const assert = require('node:assert/strict');
const { objectId, deferred, query } = require('./query');
const { makeAuth } = require('./auth');
const { createJsonApp } = require('./http');
const { createMessagesRouter } = require('../../routes/messages-routes');

async function createCleanupResponseFixture() {
  const authHelpers = makeAuth();
  const userId = objectId();
  const peerId = objectId();
  const chatId = objectId();
  const messageId = objectId();
  const calls = [];
  const cleanupStarted = deferred();
  const cleanupMayFinish = deferred();
  let messageDeleted = false;
  const message = { _id: messageId, chat: chatId, sender: userId };
  const chat = {
    _id: chatId,
    createdAt: new Date(),
    members: [{ user: userId }, { user: peerId }],
  };
  const Message = {
    findById() {
      return query(messageDeleted ? null : message);
    },
    async deleteOne() {
      calls.push('delete-message');
      messageDeleted = true;
      return { deletedCount: 1 };
    },
  };
  const Chat = {
    findById() {
      return query(chat);
    },
  };
  const app = createJsonApp(
    '/api',
    createMessagesRouter({
      authHelpers,
      chatService: {
        async deleteMessageAttachments() {
          calls.push('delete-attachments');
          cleanupStarted.resolve();
          await cleanupMayFinish.promise;
          return { deleted: 1, failed: 0 };
        },
        isChatMember(chatDocument, currentUserId) {
          return chatDocument.members.some((member) => member.user.toString() === currentUserId);
        },
        async prepareMessageAttachmentsForDeletion() {
          calls.push('prepare-attachments');
        },
        async restoreMessageAttachments() {
          calls.push('restore-attachments');
        },
        async syncChatLastMessage() {
          calls.push('sync-last-message');
        },
      },
      io: { to: () => ({ emit() {} }) },
      models: { Chat, Message },
      realtime: {
        emitUserEvent() {},
        async runChatOperationExclusive(lockedChatId, operation) {
          assert.equal(lockedChatId, chatId);
          calls.push('lock');
          return operation();
        },
      },
    })
  );
  return {
    app,
    authHelpers,
    userId,
    messageId,
    calls,
    cleanupStarted,
    cleanupMayFinish,
  };
}

module.exports = { createCleanupResponseFixture };
