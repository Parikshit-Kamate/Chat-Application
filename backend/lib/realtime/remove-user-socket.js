function createRemoveUserSocket({ onlineSocketsByUser }) {
  return function removeUserSocket(userId, socketId) {
    const normalizedUserId = String(userId || '');
    const socketIds = onlineSocketsByUser.get(normalizedUserId);
    if (!socketIds) {
      return;
    }
    socketIds.delete(socketId);
    if (socketIds.size === 0) {
      onlineSocketsByUser.delete(normalizedUserId);
    }
  };
}

module.exports = createRemoveUserSocket;
