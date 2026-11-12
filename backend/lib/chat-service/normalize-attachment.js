const { normalizeObjectId } = require('../object-id');
const { sanitizeAttachmentFileName } = require('./sanitize-attachment-file-name');

function normalizeAttachment(attachment) {
  const uploadId = normalizeObjectId(attachment?.uploadId || attachment?._id);
  if (!uploadId) {
    return null;
  }
  return {
    uploadId,
    downloadUrl: `/api/uploads/${uploadId}/content`,
    fileName: sanitizeAttachmentFileName(attachment.fileName),
    resourceType: attachment.resourceType === 'image' ? 'image' : 'raw',
    bytes: Number(attachment.bytes) || 0,
    format: String(attachment.format || '').trim().slice(0, 40)
  };
}

module.exports = normalizeAttachment;
