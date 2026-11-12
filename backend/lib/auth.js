function createAuthHelpers({ jwtSecret, jwtExpiresInSeconds }) {
  const hashPassword = require('./auth/hash-password');
  const verifyPassword = require('./auth/verify-password');
  const needsPasswordHashUpgrade = require('./auth/needs-password-hash-upgrade');
  const createJwtToken = require('./auth/create-jwt-token')({ jwtExpiresInSeconds, jwtSecret });
  const verifyJwtToken = require('./auth/verify-jwt-token')({ jwtSecret });
  const getBearerToken = require('./auth/get-bearer-token');
  const authRequired = require('./auth/auth-required')({ getBearerToken, verifyJwtToken });
  return {
    hashPassword,
    needsPasswordHashUpgrade,
    verifyPassword,
    createJwtToken,
    verifyJwtToken,
    getBearerToken,
    authRequired
  };
}

module.exports = { createAuthHelpers };
