const crypto = require('crypto');
const { parseIntegerSetting } = require('./parsers');
const isProduction = process.env.NODE_ENV === 'production';
const configuredJwtSecret = process.env.JWT_SECRET;
const INSECURE_JWT_SECRETS = new Set(['change-me', 'replace-me', 'replace-with-a-long-random-secret', 'your-secret-key']);
const DEFAULT_JWT_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60;
const MAX_JWT_EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60;
if (!configuredJwtSecret && isProduction) {
  throw new Error('JWT_SECRET is required when NODE_ENV=production.');
}
if (configuredJwtSecret &&
  isProduction && (
  Buffer.byteLength(configuredJwtSecret, 'utf8') < 32 ||
  INSECURE_JWT_SECRETS.has(configuredJwtSecret.trim().toLowerCase()))) {
  throw new Error('JWT_SECRET must be a non-placeholder secret containing at least 32 bytes in production.');
}
if (!configuredJwtSecret) {
  console.warn('JWT_SECRET is not set. Using an ephemeral development-only secret for this process.');
}
const jwtExpiresInSeconds = parseIntegerSetting('JWT_EXPIRES_IN_SECONDS', process.env.JWT_EXPIRES_IN_SECONDS, {
  defaultValue: DEFAULT_JWT_EXPIRES_IN_SECONDS,
  min: 60,
  max: MAX_JWT_EXPIRES_IN_SECONDS
});

module.exports = {
  JWT_SECRET: configuredJwtSecret || crypto.randomBytes(32).toString('hex'),
  JWT_EXPIRES_IN_SECONDS: jwtExpiresInSeconds
};
