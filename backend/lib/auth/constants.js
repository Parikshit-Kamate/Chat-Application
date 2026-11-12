const crypto = require('crypto');
const { normalizeObjectId } = require('../object-id');
const CURRENT_PASSWORD_ITERATIONS = 220_000;
const LEGACY_PASSWORD_ITERATIONS = 120_000;
const PASSWORD_DIGEST = 'sha512';
const PASSWORD_KEY_BYTES = 64;
const PASSWORD_SCHEME = 'pbkdf2-sha512';
const JWT_CLOCK_SKEW_SECONDS = 60;
const MAX_JWT_LENGTH = 4096;

module.exports = {
  crypto,
  normalizeObjectId,
  CURRENT_PASSWORD_ITERATIONS,
  LEGACY_PASSWORD_ITERATIONS,
  PASSWORD_DIGEST,
  PASSWORD_KEY_BYTES,
  PASSWORD_SCHEME,
  JWT_CLOCK_SKEW_SECONDS,
  MAX_JWT_LENGTH
};
