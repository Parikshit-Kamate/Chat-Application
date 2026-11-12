const { PASSWORD_KEY_BYTES, CURRENT_PASSWORD_ITERATIONS, crypto } = require('./constants');
const parsePasswordHash = require('./parse-password-hash');
const derivePassword = require('./derive-password');
async function verifyPassword(password, storedValue) {
  const parsedHash = parsePasswordHash(storedValue);
  const comparisonHash = parsedHash || {
    digest: Buffer.alloc(PASSWORD_KEY_BYTES),
    iterations: CURRENT_PASSWORD_ITERATIONS,
    salt: '0'.repeat(32)
  };
  const computedDigest = await derivePassword(String(password), comparisonHash.salt, comparisonHash.iterations);
  const matches = crypto.timingSafeEqual(comparisonHash.digest, computedDigest);
  return Boolean(parsedHash && matches);
}

module.exports = verifyPassword;
