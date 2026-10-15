const path = require('path');
const crypto = require('crypto');
const net = require('net');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const isProduction = process.env.NODE_ENV === 'production';
const configuredJwtSecret = process.env.JWT_SECRET;
const INSECURE_JWT_SECRETS = new Set([
  'change-me',
  'replace-me',
  'replace-with-a-long-random-secret',
  'your-secret-key',
]);
const DEFAULT_JWT_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60;
const MAX_JWT_EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60;
const MEBIBYTE = 1024 * 1024;

function parseIntegerSetting(name, rawValue, { defaultValue, min, max }) {
  const value = rawValue === undefined || rawValue === '' ? defaultValue : Number(rawValue);

  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }

  return value;
}

if (!configuredJwtSecret && isProduction) {
  throw new Error('JWT_SECRET is required when NODE_ENV=production.');
}

if (
  configuredJwtSecret &&
  isProduction &&
  (Buffer.byteLength(configuredJwtSecret, 'utf8') < 32 || INSECURE_JWT_SECRETS.has(configuredJwtSecret.trim().toLowerCase()))
) {
  throw new Error('JWT_SECRET must be a non-placeholder secret containing at least 32 bytes in production.');
}

if (!configuredJwtSecret) {
  console.warn('JWT_SECRET is not set. Using an ephemeral development-only secret for this process.');
}

function parseClientOrigin(value) {
  const rawOrigin = String(value || '').trim();

  if (!rawOrigin) {
    return ['http://localhost:5173', 'http://127.0.0.1:5173'];
  }

  if (rawOrigin === '*') {
    return '*';
  }

  return rawOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseHost(value) {
  const host = String(value || '').trim();
  if (!host) {
    return isProduction ? '0.0.0.0' : '127.0.0.1';
  }

  if (host === 'localhost' || net.isIP(host)) {
    return host;
  }

  throw new Error('HOST must be localhost or a valid IPv4/IPv6 address.');
}

const clientOrigin = parseClientOrigin(process.env.CLIENT_ORIGIN);
const port = parseIntegerSetting('PORT', process.env.PORT, { defaultValue: 8000, min: 1, max: 65_535 });
const host = parseHost(process.env.HOST);
const jwtExpiresInSeconds = parseIntegerSetting('JWT_EXPIRES_IN_SECONDS', process.env.JWT_EXPIRES_IN_SECONDS, {
  defaultValue: DEFAULT_JWT_EXPIRES_IN_SECONDS,
  min: 60,
  max: MAX_JWT_EXPIRES_IN_SECONDS,
});
const allowDataUrlUploadFallback = process.env.ALLOW_DATA_URL_UPLOAD_FALLBACK === 'true';
const configuredMongoUri = String(process.env.MONGO_URI || '').trim();
const cloudinaryCloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
const cloudinaryApiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
const cloudinaryApiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();
const cloudinaryUploadPreset = String(process.env.CLOUDINARY_UPLOAD_PRESET || '').trim();
const cloudinaryRequiredValues = [cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret];
const hasPartialCloudinaryConfiguration = cloudinaryRequiredValues.some(Boolean) && !cloudinaryRequiredValues.every(Boolean);
const uploadDailyMaxFiles = parseIntegerSetting('UPLOAD_DAILY_MAX_FILES', process.env.UPLOAD_DAILY_MAX_FILES, {
  defaultValue: 50,
  min: 1,
  max: 10_000,
});
const uploadDailyMaxBytes = parseIntegerSetting('UPLOAD_DAILY_MAX_BYTES', process.env.UPLOAD_DAILY_MAX_BYTES, {
  defaultValue: 100 * MEBIBYTE,
  min: MEBIBYTE,
  max: 10 * 1024 * MEBIBYTE,
});
const uploadTotalMaxFiles = parseIntegerSetting('UPLOAD_TOTAL_MAX_FILES', process.env.UPLOAD_TOTAL_MAX_FILES, {
  defaultValue: 500,
  min: 1,
  max: 100_000,
});
const uploadTotalMaxBytes = parseIntegerSetting('UPLOAD_TOTAL_MAX_BYTES', process.env.UPLOAD_TOTAL_MAX_BYTES, {
  defaultValue: 500 * MEBIBYTE,
  min: MEBIBYTE,
  max: 100 * 1024 * MEBIBYTE,
});
const uploadPendingTtlSeconds = parseIntegerSetting(
  'UPLOAD_PENDING_TTL_SECONDS',
  process.env.UPLOAD_PENDING_TTL_SECONDS,
  {
    defaultValue: 24 * 60 * 60,
    min: 15 * 60,
    max: 7 * 24 * 60 * 60,
  }
);
const uploadCleanupIntervalSeconds = parseIntegerSetting(
  'UPLOAD_CLEANUP_INTERVAL_SECONDS',
  process.env.UPLOAD_CLEANUP_INTERVAL_SECONDS,
  {
    defaultValue: 60 * 60,
    min: 60,
    max: 24 * 60 * 60,
  }
);

if (hasPartialCloudinaryConfiguration || (cloudinaryUploadPreset && !cloudinaryRequiredValues.every(Boolean))) {
  throw new Error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must be configured together.');
}

if (uploadDailyMaxFiles > uploadTotalMaxFiles || uploadDailyMaxBytes > uploadTotalMaxBytes) {
  throw new Error('Daily upload quotas cannot exceed total upload quotas.');
}

if (isProduction && clientOrigin === '*') {
  throw new Error('CLIENT_ORIGIN cannot be "*" when NODE_ENV=production.');
}

if (isProduction && allowDataUrlUploadFallback) {
  throw new Error('ALLOW_DATA_URL_UPLOAD_FALLBACK cannot be enabled in production.');
}

if (isProduction && !configuredMongoUri) {
  throw new Error('MONGO_URI is required when NODE_ENV=production.');
}

module.exports = {
  IS_PRODUCTION: isProduction,
  HOST: host,
  PORT: port,
  MONGO_URI: configuredMongoUri || 'mongodb://127.0.0.1:27017/conversation',
  CLIENT_ORIGIN: clientOrigin,
  JWT_SECRET: configuredJwtSecret || crypto.randomBytes(32).toString('hex'),
  JWT_EXPIRES_IN_SECONDS: jwtExpiresInSeconds,
  CLOUDINARY_CLOUD_NAME: cloudinaryCloudName,
  CLOUDINARY_API_KEY: cloudinaryApiKey,
  CLOUDINARY_API_SECRET: cloudinaryApiSecret,
  CLOUDINARY_UPLOAD_PRESET: cloudinaryUploadPreset,
  ALLOW_DATA_URL_UPLOAD_FALLBACK: allowDataUrlUploadFallback,
  UPLOAD_DAILY_MAX_FILES: uploadDailyMaxFiles,
  UPLOAD_DAILY_MAX_BYTES: uploadDailyMaxBytes,
  UPLOAD_TOTAL_MAX_FILES: uploadTotalMaxFiles,
  UPLOAD_TOTAL_MAX_BYTES: uploadTotalMaxBytes,
  UPLOAD_PENDING_TTL_SECONDS: uploadPendingTtlSeconds,
  UPLOAD_CLEANUP_INTERVAL_SECONDS: uploadCleanupIntervalSeconds,
};
