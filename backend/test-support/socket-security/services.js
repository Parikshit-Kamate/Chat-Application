function createChatService() {
  return {
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
      return [];
    },
    normalizeAttachment(attachment) {
      return attachment;
    },
    serializeMessage(message) {
      return message;
    },
  };
}

function createRealtime(presenceEvents) {
  const onlineSocketIds = new Set();
  return {
    addUserSocket(_userId, socketId) {
      onlineSocketIds.add(socketId);
    },
    emitUserEvent(userIds, eventName, payload) {
      presenceEvents.push({ userIds: userIds.map(String), eventName, payload });
    },
    isUserActiveInChat() {
      return false;
    },
    getLiveSocketIdsForUser() {
      return Array.from(onlineSocketIds);
    },
    isUserOnline() {
      return onlineSocketIds.size > 0;
    },
    removeUserSocket(_userId, socketId) {
      onlineSocketIds.delete(socketId);
    },
  };
}

module.exports = { createChatService, createRealtime };
