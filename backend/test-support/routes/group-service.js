function createGroupChatService({ state, chatId, messageId, creatorId, emittedStatusUpdates }) {
  return {
    async createOrReturnDirectChat() {
      return null;
    },
    emitStatusUpdates(chatIdValue, updates) {
      emittedStatusUpdates.push({ chatId: chatIdValue, updates });
    },
    escapeRegExp(value) {
      return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },
    async fetchChatByIdForUser() {
      return {
        id: chatId,
        type: 'group',
        members: state.createdChat.members.map((member) => ({ id: member.user.toString() })),
      };
    },
    async fetchChatsForUser() {
      return [];
    },
    async findDirectChat() {
      return null;
    },
    async hasAcceptedFriendship() {
      return true;
    },
    idList(values = []) {
      return values.map((value) => value.toString());
    },
    isChatMember(chat, userId) {
      return (chat.members || []).some((member) => member.user.toString() === userId);
    },
    async markMessagesDelivered() {
      return [];
    },
    async markMessagesSeen() {
      return [
        {
          chatId,
          messageId,
          deliveredTo: [creatorId],
          seenBy: [creatorId],
        },
      ];
    },
    serializeMessage(message) {
      return message;
    },
  };
}

module.exports = { createGroupChatService };
