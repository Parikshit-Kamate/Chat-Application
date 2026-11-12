function createContext({ authHelpers, chatService, config }) {
  const { completeCloudinaryUpload, recordPendingUpload, uploadToCloudinary } = chatService;
  const isCloudinaryConfigured = Boolean(config.cloudName && config.apiKey && config.apiSecret);
  const validateUploadRequest = require('./validate-upload-request')({ isCloudinaryConfigured, config });
  const completeRemoteUpload = require('./complete-remote-upload')({
    uploadToCloudinary,
    completeCloudinaryUpload
  });
  const createFallbackUpload = require('./create-fallback-upload')({ recordPendingUpload });
  return {
    ...authHelpers,
    ...chatService,
    config,
    isCloudinaryConfigured,
    validateUploadRequest,
    completeRemoteUpload,
    createFallbackUpload
  };
}

module.exports = createContext;
