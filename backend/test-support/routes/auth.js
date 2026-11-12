const { createAuthHelpers } = require('../../lib/auth');

function serializeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user._id?.toString?.() || user.id?.toString?.() || String(user),
    username: user.username || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    isOnline: Boolean(user.isOnline),
    lastSeen: user.lastSeen || null,
  };
}

function makeAuth() {
  return createAuthHelpers({
    jwtSecret: 'route-test-secret',
    jwtExpiresInSeconds: 60 * 60,
  });
}

module.exports = { serializeUser, makeAuth };
