const ALLOWED_UPLOAD_MEDIA_TYPES = new Set([
  'application/pdf',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
]);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function hasExpectedFileSignature(mediaType, buffer) {
  if (mediaType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mediaType === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (mediaType === 'image/gif') {
    const signature = buffer.subarray(0, 6).toString('ascii');
    return signature === 'GIF87a' || signature === 'GIF89a';
  }

  if (mediaType === 'image/webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }

  if (mediaType === 'application/pdf') {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }

  if (mediaType === 'text/plain') {
    if (buffer.includes(0)) {
      return false;
    }

    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      return true;
    } catch (_error) {
      return false;
    }
  }

  return false;
}

function parseDataUrlMetadata(dataUrl, { maxBytes = MAX_UPLOAD_BYTES } = {}) {
  const match = String(dataUrl || '').match(/^data:([^;,]+);base64,([a-z0-9+/=]+)$/i);

  if (!match) {
    return null;
  }

  const encodedPayload = match[2];
  const maximumEncodedLength = Math.ceil(maxBytes / 3) * 4;
  if (
    !encodedPayload ||
    encodedPayload.length > maximumEncodedLength ||
    encodedPayload.length % 4 !== 0 ||
    !/^[a-z0-9+/]*={0,2}$/i.test(encodedPayload)
  ) {
    return null;
  }

  const buffer = Buffer.from(encodedPayload, 'base64');
  const mediaType = match[1].toLowerCase();
  if (buffer.length === 0 || buffer.length > maxBytes) {
    return null;
  }

  if (ALLOWED_UPLOAD_MEDIA_TYPES.has(mediaType) && !hasExpectedFileSignature(mediaType, buffer)) {
    return null;
  }

  return {
    bytes: buffer.length,
    mediaType,
  };
}

module.exports = {
  ALLOWED_UPLOAD_MEDIA_TYPES,
  MAX_UPLOAD_BYTES,
  hasExpectedFileSignature,
  parseDataUrlMetadata,
};
