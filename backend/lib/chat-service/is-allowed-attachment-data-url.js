const { ALLOWED_UPLOAD_MEDIA_TYPES, parseDataUrlMetadata } = require('../file-validation');
const { MAX_ATTACHMENT_DATA_URL_BYTES } = require('./constants');

function isAllowedAttachmentDataUrl(value) {
  const metadata = parseDataUrlMetadata(value, { maxBytes: MAX_ATTACHMENT_DATA_URL_BYTES });
  return Boolean(metadata && ALLOWED_UPLOAD_MEDIA_TYPES.has(metadata.mediaType));
}

module.exports = { isAllowedAttachmentDataUrl };
