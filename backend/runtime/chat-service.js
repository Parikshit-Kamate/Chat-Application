const { createChatService } = require('../lib/chat-service');

module.exports = function createConfiguredChatService({ io, models, realtime, config }) {
  return createChatService({
    io,
    models,
    realtime,
    cloudinaryCloudName: config.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: config.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: config.CLOUDINARY_API_SECRET,
    cloudinaryUploadPreset: config.CLOUDINARY_UPLOAD_PRESET,
    allowDataUrlFallback: config.ALLOW_DATA_URL_UPLOAD_FALLBACK,
    uploadLimits: {
      cleanupIntervalSeconds: config.UPLOAD_CLEANUP_INTERVAL_SECONDS,
      dailyMaxBytes: config.UPLOAD_DAILY_MAX_BYTES,
      dailyMaxFiles: config.UPLOAD_DAILY_MAX_FILES,
      pendingTtlSeconds: config.UPLOAD_PENDING_TTL_SECONDS,
      totalMaxBytes: config.UPLOAD_TOTAL_MAX_BYTES,
      totalMaxFiles: config.UPLOAD_TOTAL_MAX_FILES
    }
  });
};
