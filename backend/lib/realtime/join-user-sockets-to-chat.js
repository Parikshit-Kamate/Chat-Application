function createJoinUserSocketsToChat({ getLiveSocketIdsForUser, io, getRevokedChatIdsForSocket }) {
  return function joinUserSocketsToChat(userIds, chatId) {
    const roomName = `chat:${chatId}`;
    userIds.forEach(rawUserId => {
      const userId = String(rawUserId);
      const socketIds = getLiveSocketIdsForUser(userId);
      if (socketIds.length === 0) {
        return;
      }
      socketIds.forEach(socketId => {
        const connectedSocket = io.sockets.sockets.get(socketId);
        if (!connectedSocket) {
          return;
        }
        getRevokedChatIdsForSocket(connectedSocket).delete(String(chatId));
        connectedSocket.join(roomName);
      });
    });
  };
}

module.exports = createJoinUserSocketsToChat;
