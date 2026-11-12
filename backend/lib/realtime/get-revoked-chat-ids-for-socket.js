function getRevokedChatIdsForSocket(socket) {
  if (!socket.data) {
    socket.data = {};
  }
  if (!(socket.data.revokedChatIds instanceof Set)) {
    socket.data.revokedChatIds = new Set();
  }
  return socket.data.revokedChatIds;
}

module.exports = getRevokedChatIdsForSocket;
