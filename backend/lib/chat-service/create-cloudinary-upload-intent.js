const { normalizeObjectId } = require('../object-id');
const crypto = require('crypto');
const { MAX_ATTACHMENT_BYTES } = require('./constants');
const { createCodedError } = require('./create-coded-error');
const { sanitizeAttachmentFileName } = require('./sanitize-attachment-file-name');

function bindCreateCloudinaryUploadIntent({ requireUploadModels, UploadAsset, resolvedUploadLimits }) {
  async function createCloudinaryUploadIntent({ ownerId, fileName, mediaType, bytes }) {
    requireUploadModels();
    const normalizedOwnerId = normalizeObjectId(ownerId);
    const normalizedBytes = Number(bytes);
    const resourceType = String(mediaType || '').startsWith('image/') ? 'image' : 'raw';
    if (!normalizedOwnerId ||
      !Number.isSafeInteger(normalizedBytes) ||
      normalizedBytes < 1 ||
      normalizedBytes > MAX_ATTACHMENT_BYTES) {
      throw createCodedError('Invalid upload intent.', 'INVALID_UPLOAD');
    }
    const publicId = `confabulate/${normalizedOwnerId}/${crypto.randomUUID()}`;
    const asset = await UploadAsset.create({
      owner: normalizedOwnerId,
      provider: 'cloudinary',
      deliveryType: 'authenticated',
      status: 'uploading',
      url: '',
      secureUrl: '',
      publicId,
      fileName: sanitizeAttachmentFileName(fileName) || 'attachment',
      mediaType,
      resourceType,
      bytes: normalizedBytes,
      format: '',
      pendingExpiresAt: new Date(Date.now() + resolvedUploadLimits.pendingTtlSeconds * 1000)
    });
    return { uploadId: asset._id.toString(), publicId, resourceType };
  }
  return createCloudinaryUploadIntent;
}

module.exports = bindCreateCloudinaryUploadIntent;
