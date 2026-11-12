function createAddUserSocket({ onlineSocketsByUser }) {
  return function addUserSocket(userId, socketId) {
    const normalizedUserId = String(userId || '');
    const socketIds = onlineSocketsByUser.get(normalizedUserId) || new Set();
    socketIds.add(socketId);
    onlineSocketsByUser.set(normalizedUserId, socketIds);
  };
}

module.exports = createAddUserSocket;
