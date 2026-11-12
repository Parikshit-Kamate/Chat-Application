const {
  sanitizeFileName,
  parseDataUrlMetadata,
  MAX_UPLOAD_BYTES,
  ALLOWED_UPLOAD_MEDIA_TYPES,
  MAX_FALLBACK_BYTES
} = require('./dependencies');

function createValidateUploadRequest({ isCloudinaryConfigured, config }) {
  return function validateUploadRequest(body) {
    const fileName = sanitizeFileName(body.fileName);
    const dataUrl = String(body.dataUrl || '').trim();
    const dataUrlMetadata = parseDataUrlMetadata(dataUrl, { maxBytes: MAX_UPLOAD_BYTES });
    if (!dataUrlMetadata) {
      return { status: 400, error: 'Invalid file payload.' };
    }
    if (!ALLOWED_UPLOAD_MEDIA_TYPES.has(dataUrlMetadata.mediaType)) {
      return { status: 415, error: 'Unsupported file type.' };
    }
    if (!isCloudinaryConfigured && !config.allowDataUrlFallback) {
      return {
        status: 503,
        error: 'File upload storage is not configured. Set Cloudinary signing credentials, ' +
          'or enable ALLOW_DATA_URL_UPLOAD_FALLBACK=true for local-only testing.'
      };
    }
    if (!isCloudinaryConfigured && dataUrlMetadata.bytes > MAX_FALLBACK_BYTES) {
      return { status: 413, error: 'Local fallback attachments must be 128KB or smaller.' };
    }
    return { fileName, dataUrl, dataUrlMetadata };
  };
}

module.exports = createValidateUploadRequest;
