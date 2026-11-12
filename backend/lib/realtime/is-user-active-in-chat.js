function createIsUserActiveInChat({ getLiveSocketIdsForUser, io }) {
  return function isUserActiveInChat(userId, chatId) {
    const socketIds = getLiveSocketIdsForUser(userId);
    if (socketIds.length === 0) {
      return false;
    }
    for (const socketId of socketIds) {
      const connectedSocket = io.sockets.sockets.get(socketId);
      if (connectedSocket?.data?.activeChatId === chatId) {
        return true;
      }
    }
    return false;
  };
}

module.exports = createIsUserActiveInChat;
