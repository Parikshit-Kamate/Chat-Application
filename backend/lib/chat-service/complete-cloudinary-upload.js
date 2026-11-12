const { normalizeObjectId } = require('../object-id');
const { PERSISTED_UPLOAD_RESOURCE_TYPES } = require('./constants');
const { createCodedError } = require('./create-coded-error');

function createCompleteCloudinaryUpload({
  requireUploadModels,
  normalizeProviderAttachment,
  UploadAsset,
  resolvedUploadLimits,
  serializeUploadAsset
}) {
  async function completeCloudinaryUpload({ uploadId, ownerId, file, mediaType }) {
    requireUploadModels();
    const normalizedUploadId = normalizeObjectId(uploadId);
    const normalizedOwnerId = normalizeObjectId(ownerId);
    const normalizedFile = normalizeProviderAttachment(file);
    if (!normalizedUploadId ||
      !normalizedOwnerId ||
      !normalizedFile ||
      !PERSISTED_UPLOAD_RESOURCE_TYPES.has(normalizedFile.resourceType) ||
      !Number.isSafeInteger(normalizedFile.bytes) ||
      normalizedFile.bytes < 1) {
      throw createCodedError('Invalid uploaded asset metadata.', 'INVALID_UPLOAD');
    }
    const asset = await UploadAsset.findOneAndUpdate({
      _id: normalizedUploadId,
      owner: normalizedOwnerId,
      provider: 'cloudinary',
      deliveryType: 'authenticated',
      status: 'uploading',
      bytes: normalizedFile.bytes,
      publicId: normalizedFile.publicId,
      resourceType: normalizedFile.resourceType
    }, {
      $set: {
        status: 'pending',
        url: normalizedFile.url,
        secureUrl: normalizedFile.secureUrl,
        fileName: normalizedFile.fileName,
        mediaType,
        format: normalizedFile.format,
        pendingExpiresAt: new Date(Date.now() + resolvedUploadLimits.pendingTtlSeconds * 1000)
      }
    }, { new: true });
    if (!asset) {
      throw createCodedError('Upload intent is unavailable.', 'INVALID_UPLOAD');
    }
    return serializeUploadAsset(asset);
  }
  return completeCloudinaryUpload;
}

module.exports = createCompleteCloudinaryUpload;
