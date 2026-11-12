function createLeaveUserSocketsFromChat({ getLiveSocketIdsForUser, io, getRevokedChatIdsForSocket }) {
  return async function leaveUserSocketsFromChat(userId, chatId) {
    const normalizedChatId = String(chatId || '');
    if (!normalizedChatId) {
      return;
    }
    const roomName = `chat:${normalizedChatId}`;
    const socketIds = getLiveSocketIdsForUser(userId);
    await Promise.all(socketIds.map(async socketId => {
      const connectedSocket = io.sockets.sockets.get(socketId);
      if (!connectedSocket) {
        return;
      }
      getRevokedChatIdsForSocket(connectedSocket).add(normalizedChatId);
      if (connectedSocket.data?.activeChatId === normalizedChatId) {
        connectedSocket.data.activeChatId = null;
      }
      try {
        await connectedSocket.leave(roomName);
      } catch (error) {
        console.error('Unable to remove socket from chat room:', error);
        connectedSocket.disconnect?.(true);
      }
    }));
  };
}

module.exports = createLeaveUserSocketsFromChat;
