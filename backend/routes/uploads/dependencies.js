const express = require('express');
const { ALLOWED_UPLOAD_MEDIA_TYPES, MAX_UPLOAD_BYTES, parseDataUrlMetadata } = require('../../lib/file-validation');
const MAX_FILE_NAME_LENGTH = 180;
const MAX_FALLBACK_BYTES = 128 * 1024;
const MAX_CONCURRENT_UPLOADS_PER_USER = 2;
const activeUploadsByUser = new Map();

function sanitizeFileName(value) {
  const fileName = String(value || 'attachment').trim().replace(/[\\/\0\r\n\t]/g, '_').slice(0, MAX_FILE_NAME_LENGTH);
  return fileName || 'attachment';
}

module.exports = {
  express,
  ALLOWED_UPLOAD_MEDIA_TYPES,
  MAX_UPLOAD_BYTES,
  parseDataUrlMetadata,
  MAX_FILE_NAME_LENGTH,
  MAX_FALLBACK_BYTES,
  MAX_CONCURRENT_UPLOADS_PER_USER,
  activeUploadsByUser,
  sanitizeFileName
};
