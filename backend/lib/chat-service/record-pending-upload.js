const { normalizeObjectId } = require('../object-id');
const { PERSISTED_UPLOAD_RESOURCE_TYPES } = require('./constants');
const { createCodedError } = require('./create-coded-error');

function createRecordPendingUpload({
  requireUploadModels,
  normalizeProviderAttachment,
  UploadAsset,
  resolvedUploadLimits,
  serializeUploadAsset
}) {
  async function recordPendingUpload({ ownerId, provider, file, mediaType }) {
    requireUploadModels();
    const normalizedOwnerId = normalizeObjectId(ownerId);
    const normalizedFile = normalizeProviderAttachment(file);
    if (!normalizedOwnerId ||
      !normalizedFile ||
      !PERSISTED_UPLOAD_RESOURCE_TYPES.has(normalizedFile.resourceType) ||
      !Number.isSafeInteger(normalizedFile.bytes) ||
      normalizedFile.bytes < 1) {
      throw createCodedError('Invalid uploaded asset metadata.', 'INVALID_UPLOAD');
    }
    const asset = await UploadAsset.create({
      owner: normalizedOwnerId,
      provider,
      deliveryType: provider === 'cloudinary' ? 'authenticated' : 'upload',
      status: 'pending',
      url: normalizedFile.url,
      secureUrl: normalizedFile.secureUrl,
      publicId: normalizedFile.publicId,
      fileName: normalizedFile.fileName,
      mediaType,
      resourceType: normalizedFile.resourceType,
      bytes: normalizedFile.bytes,
      format: normalizedFile.format,
      pendingExpiresAt: new Date(Date.now() + resolvedUploadLimits.pendingTtlSeconds * 1000)
    });
    return serializeUploadAsset(asset);
  }
  return recordPendingUpload;
}

module.exports = createRecordPendingUpload;
