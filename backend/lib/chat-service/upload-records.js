function createUploadRecords({
  requireUploadModels,
  UploadAsset,
  resolvedUploadLimits,
  allowDataUrlFallback,
  cloudinaryCloudName,
  serializeUploadAsset
}) {
  const normalizeProviderAttachment = require('./normalize-provider-attachment')({
    allowDataUrlFallback,
    cloudinaryCloudName
  });
  const createCloudinaryUploadIntent = require('./create-cloudinary-upload-intent')({
    requireUploadModels,
    UploadAsset,
    resolvedUploadLimits
  });
  const completeCloudinaryUpload = require('./complete-cloudinary-upload')({
    requireUploadModels,
    normalizeProviderAttachment,
    UploadAsset,
    resolvedUploadLimits,
    serializeUploadAsset
  });
  const recordPendingUpload = require('./record-pending-upload')({
    requireUploadModels,
    normalizeProviderAttachment,
    UploadAsset,
    resolvedUploadLimits,
    serializeUploadAsset
  });
  return { createCloudinaryUploadIntent, completeCloudinaryUpload, recordPendingUpload };
}

module.exports = createUploadRecords;
