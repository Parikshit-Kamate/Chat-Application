function createChatServiceStub() {
  return {
    idList(values = []) {
      return values.map(String);
    },
    isChatMember(chat, userId) {
      return (chat.members || []).some((member) => member.user.toString() === userId);
    },
    async markMessagesDelivered() {
      return [];
    },
    async markMessagesSeen() {
      return [];
    },
    normalizeAttachment(attachment) {
      return attachment;
    },
    serializeMessage(message) {
      if (!message) {
        return null;
      }

      const senderId = message.sender?._id?.toString?.() || message.sender?.toString?.() || '';
      return {
        id: message._id.toString(),
        chatId: message.chat.toString(),
        sender: { id: senderId },
        text: message.text,
        attachments: message.attachments || [],
        deliveredTo: (message.deliveredTo || []).map(String),
        seenBy: (message.seenBy || []).map(String),
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      };
    },
  };
}

module.exports = { createChatServiceStub };
