const assert = require('node:assert/strict');
const { serializeUser } = require('./auth');

function createSendChatService({ uploadId, senderId }) {
  return {
      async claimPendingAttachments({ attachments, messageId: claimedMessageId, ownerId }) {
        assert.deepEqual(attachments, [
          { uploadId, url: 'https://attacker.example/ignored.png', fileName: 'ignored.png' },
        ]);
        assert.match(claimedMessageId.toString(), /^[a-f0-9]{24}$/);
        assert.equal(ownerId, senderId);

        return [
          {
            uploadId,
            url: 'https://res.cloudinary.com/example/image/upload/v1/file.png',
            secureUrl: 'https://res.cloudinary.com/example/image/upload/v1/file.png',
            publicId: 'file',
            fileName: 'file.png',
            resourceType: 'image',
            bytes: 100,
            format: 'png',
          },
        ];
      },
      async finalizeMessageAttachments() {},
      idList(values = []) {
        return values.map((value) => value.toString());
      },
      isChatMember(chatDocument, userId) {
        return chatDocument.members.some((member) => member.user.toString() === userId);
      },
      async markMessagesDelivered() {
        return [];
      },
      async markMessagesSeen() {
        return [];
      },
      async releaseMessageAttachments() {},
      serializeMessage(message) {
        return {
          id: message._id.toString(),
          chatId: message.chat.toString(),
          sender: serializeUser(message.sender),
          text: message.text,
          attachments: message.attachments,
          deliveredTo: message.deliveredTo.map(String),
          seenBy: message.seenBy.map(String),
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        };
      },
    };
}

module.exports = { createSendChatService };
