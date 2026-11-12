function createFetchChatByIdForUser({ Chat, isChatMember, computeUnreadCount, serializeChat }) {
  async function fetchChatByIdForUser(chatId, userId) {
    const chat = await Chat.findById(chatId).populate('members.user', 'username firstName lastName isOnline lastSeen').populate({
      path: 'lastMessage',
      populate: [{ path: 'sender', select: 'username firstName lastName isOnline lastSeen' }]
    });
    if (!chat || !isChatMember(chat, userId)) {
      return null;
    }
    const unreadCount = await computeUnreadCount(chat, userId);
    return serializeChat(chat, userId, unreadCount);
  }
  return fetchChatByIdForUser;
}

module.exports = createFetchChatByIdForUser;
