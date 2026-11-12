const { LEGACY_PASSWORD_ITERATIONS, PASSWORD_SCHEME } = require('./constants');

function parsePasswordHash(storedValue) {
  const parts = String(storedValue || '').split(':');
  let iterations;
  let salt;
  let digest;
  if (parts.length === 2) {
    [salt, digest] = parts;
    iterations = LEGACY_PASSWORD_ITERATIONS;
  } else if (parts.length === 4 && parts[0] === PASSWORD_SCHEME) {
    iterations = Number(parts[1]);
    salt = parts[2];
    digest = parts[3];
  } else {
    return null;
  }
  if (!Number.isSafeInteger(iterations) ||
    iterations < LEGACY_PASSWORD_ITERATIONS ||
    iterations > 1_000_000 ||
    !/^[a-f0-9]{32}$/i.test(salt) ||
    !/^[a-f0-9]{128}$/i.test(digest)) {
    return null;
  }
  return { digest: Buffer.from(digest, 'hex'), iterations, salt };
}

module.exports = parsePasswordHash;
