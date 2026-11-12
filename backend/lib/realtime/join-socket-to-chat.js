function createJoinSocketToChat({ getRevokedChatIdsForSocket }) {
  return function joinSocketToChat(socket, chatId) {
    const normalizedChatId = String(chatId || '');
    if (!normalizedChatId || !socket) {
      return false;
    }
    if (getRevokedChatIdsForSocket(socket).has(normalizedChatId)) {
      return false;
    }
    socket.join(`chat:${normalizedChatId}`);
    return true;
  };
}

module.exports = createJoinSocketToChat;
