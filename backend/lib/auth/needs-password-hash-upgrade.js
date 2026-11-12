const { CURRENT_PASSWORD_ITERATIONS } = require('./constants');
const parsePasswordHash = require('./parse-password-hash');

function needsPasswordHashUpgrade(storedValue) {
  const parsedHash = parsePasswordHash(storedValue);
  return !parsedHash || parsedHash.iterations < CURRENT_PASSWORD_ITERATIONS;
}

module.exports = needsPasswordHashUpgrade;
