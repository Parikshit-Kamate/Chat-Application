const { MAX_ATTACHMENT_FILE_NAME_LENGTH } = require('./constants');

function sanitizeAttachmentFileName(value) {
  return String(value || '').trim().replace(/[\\/\0\r\n\t]/g, '_').slice(0, MAX_ATTACHMENT_FILE_NAME_LENGTH);
}

module.exports = { sanitizeAttachmentFileName };
