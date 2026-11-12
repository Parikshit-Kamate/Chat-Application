function createEmitUserEvent({ io }) {
  return function emitUserEvent(userIds, eventName, payload) {
    Array.from(new Set(userIds.map(userId => String(userId)))).forEach(userId => {
      io.to(`user:${userId}`).emit(eventName, payload);
    });
  };
}

module.exports = createEmitUserEvent;
