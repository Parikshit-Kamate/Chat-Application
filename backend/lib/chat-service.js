function createChatService(options) {
  const {
    models,
    realtime,
    cloudinaryCloudName,
    cloudinaryUploadPreset,
    cloudinaryApiKey = '',
    cloudinaryApiSecret = '',
    allowDataUrlFallback = false,
    uploadLimits = {}
  } = options;
  const resolvedUploadLimits = {
    cleanupIntervalSeconds: Number(uploadLimits.cleanupIntervalSeconds) || 60 * 60,
    dailyMaxBytes: Number(uploadLimits.dailyMaxBytes) || 100 * 1024 * 1024,
    dailyMaxFiles: Number(uploadLimits.dailyMaxFiles) || 50,
    pendingTtlSeconds: Number(uploadLimits.pendingTtlSeconds) || 24 * 60 * 60,
    totalMaxBytes: Number(uploadLimits.totalMaxBytes) || 500 * 1024 * 1024,
    totalMaxFiles: Number(uploadLimits.totalMaxFiles) || 500
  };
  const dependencies = {
    ...options,
    ...models,
    realtime,
    cloudinaryCloudName,
    cloudinaryUploadPreset,
    cloudinaryApiKey,
    cloudinaryApiSecret,
    allowDataUrlFallback,
    resolvedUploadLimits
  };
  Object.assign(dependencies, require('./chat-service/serialization')(dependencies));
  Object.assign(dependencies, require('./chat-service/chat-queries')(dependencies));
  Object.assign(dependencies, require('./chat-service/message-status')(dependencies));
  Object.assign(dependencies, require('./chat-service/cloudinary-client')(dependencies));
  Object.assign(dependencies, require('./chat-service/upload-quota')(dependencies));
  Object.assign(dependencies, require('./chat-service/upload-records')(dependencies));
  Object.assign(dependencies, require('./chat-service/message-attachments')(dependencies));
  Object.assign(dependencies, require('./chat-service/upload-cleanup')(dependencies));
  return require('./chat-service/public-methods')(dependencies);
}

module.exports = { createChatService };
