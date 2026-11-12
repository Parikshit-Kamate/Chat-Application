function createCloudinaryClient({
  UploadAsset,
  UploadQuota,
  cloudinaryApiSecret,
  cloudinaryApiKey,
  cloudinaryCloudName,
  cloudinaryUploadPreset
}) {
  const requireUploadModels = require('./require-upload-models')({ UploadAsset, UploadQuota });
  const getUtcDayStart = require('./get-utc-day-start');
  const createCloudinarySignature = require('./create-cloudinary-signature')({ cloudinaryApiSecret });
  const performCloudinaryRequest = require('./perform-cloudinary-request')({
    cloudinaryApiKey,
    createCloudinarySignature
  });
  const uploadToCloudinary = require('./upload-to-cloudinary')({
    cloudinaryCloudName,
    cloudinaryApiKey,
    cloudinaryApiSecret,
    cloudinaryUploadPreset,
    performCloudinaryRequest
  });
  const destroyCloudinaryAsset = require('./destroy-cloudinary-asset')({
    cloudinaryCloudName,
    performCloudinaryRequest
  });
  const serializeUploadAsset = require('./serialize-upload-asset');
  return {
    requireUploadModels,
    getUtcDayStart,
    createCloudinarySignature,
    performCloudinaryRequest,
    uploadToCloudinary,
    destroyCloudinaryAsset,
    serializeUploadAsset
  };
}

module.exports = createCloudinaryClient;
