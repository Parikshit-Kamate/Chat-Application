function createGetLiveSocketIdsForUser({ onlineSocketsByUser, io }) {
  return function getLiveSocketIdsForUser(userId) {
    const normalizedUserId = String(userId || '');
    if (!normalizedUserId) {
      return [];
    }
    const socketIds = onlineSocketsByUser.get(normalizedUserId);
    if (!socketIds || socketIds.size === 0) {
      return [];
    }
    const liveSocketIds = [];
    socketIds.forEach(socketId => {
      if (io.sockets.sockets.has(socketId)) {
        liveSocketIds.push(socketId);
      }
    });
    if (liveSocketIds.length === socketIds.size) {
      return liveSocketIds;
    }
    if (liveSocketIds.length === 0) {
      onlineSocketsByUser.delete(normalizedUserId);
      return [];
    }
    onlineSocketsByUser.set(normalizedUserId, new Set(liveSocketIds));
    return liveSocketIds;
  };
}

module.exports = createGetLiveSocketIdsForUser;
