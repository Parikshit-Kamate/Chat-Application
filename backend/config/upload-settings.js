const { parseIntegerSetting } = require('./parsers');
const MEBIBYTE = 1024 * 1024;
const cloudinaryCloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
const cloudinaryApiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
const cloudinaryApiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();
const cloudinaryUploadPreset = String(process.env.CLOUDINARY_UPLOAD_PRESET || '').trim();
const cloudinaryRequiredValues = [cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret];
const hasPartialCloudinaryConfiguration = cloudinaryRequiredValues.some(Boolean) && !cloudinaryRequiredValues.every(Boolean);
const uploadDailyMaxFiles = parseIntegerSetting('UPLOAD_DAILY_MAX_FILES', process.env.UPLOAD_DAILY_MAX_FILES, {
  defaultValue: 50,
  min: 1,
  max: 10_000
});
const uploadDailyMaxBytes = parseIntegerSetting('UPLOAD_DAILY_MAX_BYTES', process.env.UPLOAD_DAILY_MAX_BYTES, {
  defaultValue: 100 * MEBIBYTE,
  min: MEBIBYTE,
  max: 10 * 1024 * MEBIBYTE
});
const uploadTotalMaxFiles = parseIntegerSetting('UPLOAD_TOTAL_MAX_FILES', process.env.UPLOAD_TOTAL_MAX_FILES, {
  defaultValue: 500,
  min: 1,
  max: 100_000
});
const uploadTotalMaxBytes = parseIntegerSetting('UPLOAD_TOTAL_MAX_BYTES', process.env.UPLOAD_TOTAL_MAX_BYTES, {
  defaultValue: 500 * MEBIBYTE,
  min: MEBIBYTE,
  max: 100 * 1024 * MEBIBYTE
});
const uploadPendingTtlSeconds = parseIntegerSetting('UPLOAD_PENDING_TTL_SECONDS', process.env.UPLOAD_PENDING_TTL_SECONDS, {
  defaultValue: 24 * 60 * 60,
  min: 15 * 60,
  max: 7 * 24 * 60 * 60
});
const uploadCleanupIntervalSeconds = parseIntegerSetting('UPLOAD_CLEANUP_INTERVAL_SECONDS', process.env.UPLOAD_CLEANUP_INTERVAL_SECONDS, {
  defaultValue: 60 * 60,
  min: 60,
  max: 24 * 60 * 60
});
if (hasPartialCloudinaryConfiguration || cloudinaryUploadPreset && !cloudinaryRequiredValues.every(Boolean)) {
  throw new Error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must be configured together.');
}
if (uploadDailyMaxFiles > uploadTotalMaxFiles || uploadDailyMaxBytes > uploadTotalMaxBytes) {
  throw new Error('Daily upload quotas cannot exceed total upload quotas.');
}

module.exports = {
  CLOUDINARY_CLOUD_NAME: cloudinaryCloudName,
  CLOUDINARY_API_KEY: cloudinaryApiKey,
  CLOUDINARY_API_SECRET: cloudinaryApiSecret,
  CLOUDINARY_UPLOAD_PRESET: cloudinaryUploadPreset,
  UPLOAD_DAILY_MAX_FILES: uploadDailyMaxFiles,
  UPLOAD_DAILY_MAX_BYTES: uploadDailyMaxBytes,
  UPLOAD_TOTAL_MAX_FILES: uploadTotalMaxFiles,
  UPLOAD_TOTAL_MAX_BYTES: uploadTotalMaxBytes,
  UPLOAD_PENDING_TTL_SECONDS: uploadPendingTtlSeconds,
  UPLOAD_CLEANUP_INTERVAL_SECONDS: uploadCleanupIntervalSeconds
};
