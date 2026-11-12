function createConnectionCleanup(context, authentication) {
  const { socket, userId, realtime, userRateLimiters, reconcilePresence } = context;
  const { removeUserSocket, isUserOnline } = realtime;
  let cleanupPromise = null;

  function cleanup() {
    if (cleanupPromise) {
      return cleanupPromise;
    }

    cleanupPromise = (async () => {
      authentication.clear();
      try {
        removeUserSocket(userId, socket.id);
        if (!isUserOnline(userId)) {
          userRateLimiters.retain(userId);
          await reconcilePresence(userId);
        }
      } catch (error) {
        console.error('Disconnect cleanup error:', error);
      }
    })();
    return cleanupPromise;
  }

  function hasStarted() {
    return Boolean(cleanupPromise);
  }

  return { cleanup, hasStarted };
}

module.exports = { createConnectionCleanup };
