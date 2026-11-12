function registerAuthentication(io, authHelpers) {
  const { getBearerToken, verifyJwtToken } = authHelpers;

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token ||
        getBearerToken(socket.handshake.headers?.authorization || '');
      if (!token) {
        return next(new Error('Authentication token missing.'));
      }

      const payload = verifyJwtToken(token);
      if (!Number.isSafeInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
        return next(new Error('Invalid authentication token.'));
      }

      socket.data.userId = payload.sub;
      socket.data.username = payload.username || '';
      socket.data.activeChatId = null;
      socket.data.authExpiresAtMs = payload.exp * 1000;
      return next();
    } catch (_error) {
      return next(new Error('Invalid authentication token.'));
    }
  });
}

module.exports = { registerAuthentication };
