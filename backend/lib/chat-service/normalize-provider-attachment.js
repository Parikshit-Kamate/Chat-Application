const { normalizeObjectId } = require('../object-id');
const { MAX_ATTACHMENT_PUBLIC_ID_LENGTH, MAX_ATTACHMENT_BYTES } = require('./constants');
const { getSafeAttachmentUrl } = require('./get-safe-attachment-url');
const { sanitizeAttachmentFileName } = require('./sanitize-attachment-file-name');
const { getAttachmentResourceType } = require('./get-attachment-resource-type');

function createNormalizeProviderAttachment({ allowDataUrlFallback, cloudinaryCloudName }) {
  function normalizeProviderAttachment(attachment) {
    if (!attachment) {
      return null;
    }
    const attachmentUrlOptions = { allowDataUrlFallback, cloudinaryCloudName };
    const safeUrl = getSafeAttachmentUrl(attachment.url, attachmentUrlOptions);
    const safeSecureUrl = getSafeAttachmentUrl(attachment.secureUrl, attachmentUrlOptions);
    const resolvedUrl = safeSecureUrl || safeUrl;
    const bytes = Number(attachment.bytes || 0);
    if (!resolvedUrl) {
      return null;
    }
    return {
      uploadId: normalizeObjectId(attachment.uploadId || attachment._id) || null,
      url: resolvedUrl,
      secureUrl: resolvedUrl.toLowerCase().startsWith('data:') ? '' : resolvedUrl,
      publicId: String(attachment.publicId || '').trim().slice(0, MAX_ATTACHMENT_PUBLIC_ID_LENGTH),
      fileName: sanitizeAttachmentFileName(attachment.fileName),
      resourceType: getAttachmentResourceType(resolvedUrl),
      bytes: Number.isFinite(bytes) && bytes > 0 && bytes <= MAX_ATTACHMENT_BYTES ? Math.floor(bytes) : 0,
      format: String(attachment.format || '').trim().slice(0, 40)
    };
  }
  return normalizeProviderAttachment;
}

module.exports = createNormalizeProviderAttachment;
