function createEmitStatusUpdates({ io }) {
  function emitStatusUpdates(chatId, statusUpdates = []) {
    statusUpdates.forEach(status => {
      io.to(`chat:${chatId}`).emit('message:status', status);
    });
  }
  return emitStatusUpdates;
}

module.exports = createEmitStatusUpdates;
