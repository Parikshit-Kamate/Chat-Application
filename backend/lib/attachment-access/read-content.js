const { ALLOWED_UPLOAD_MEDIA_TYPES, MAX_UPLOAD_BYTES, hasExpectedFileSignature,
  parseDataUrlMetadata } = require('../file-validation');
const { createCloudinaryDownloadUrl } = require('./cloudinary-url');

async function readAttachmentContent(asset, config) {
  if (!ALLOWED_UPLOAD_MEDIA_TYPES.has(asset.mediaType) || !Number.isSafeInteger(asset.bytes) ||
    asset.bytes < 1 || asset.bytes > MAX_UPLOAD_BYTES) {
    throw new Error('Invalid attachment metadata.');
  }
  let buffer;
  if (asset.provider === 'data-url') {
    const metadata = config.allowDataUrlFallback &&
      parseDataUrlMetadata(asset.url, { maxBytes: 128 * 1024 });
    if (!metadata || metadata.mediaType !== asset.mediaType) throw new Error('Invalid local attachment.');
    buffer = Buffer.from(asset.url.slice(asset.url.indexOf(',') + 1), 'base64');
  } else if (asset.provider === 'cloudinary') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    timeout.unref?.();
    try {
      const response = await fetch(createCloudinaryDownloadUrl(asset, config), {
        redirect: 'error', signal: controller.signal, cache: 'no-store',
        headers: { 'Accept-Encoding': 'identity' }
      });
      if (response.status !== 200 || !response.body ||
        Number(response.headers.get('content-length')) > asset.bytes) {
        throw new Error('Attachment download failed.');
      }
      const chunks = [];
      let bytes = 0;
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > asset.bytes) throw new Error('Attachment exceeds its recorded size.');
        chunks.push(Buffer.from(chunk));
      }
      buffer = Buffer.concat(chunks, bytes);
    } finally {
      controller.abort();
      clearTimeout(timeout);
    }
  } else {
    throw new Error('Unsupported attachment storage.');
  }
  if (buffer.length !== asset.bytes || !hasExpectedFileSignature(asset.mediaType, buffer)) {
    throw new Error('Invalid attachment contents.');
  }
  return buffer;
}

module.exports = { readAttachmentContent };
