const { objectId, query } = require('./query');
const { makeAuth } = require('./auth');
const { createJsonApp } = require('./http');
const { createMessagesRouter } = require('../../routes/messages-routes');

async function createAmbiguousDeletionFixture() {
  const authHelpers = makeAuth();
  const userId = objectId();
  const peerId = objectId();
  const chatId = objectId();
  const messageId = objectId();
  const calls = [];
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
      throw new Error('simulated acknowledgement loss');
    },
    async exists() {
      calls.push('verify-message-deleted');
      return null;
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
        async runChatOperationExclusive(_lockedChatId, operation) {
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
  };
}

module.exports = { createAmbiguousDeletionFixture };
