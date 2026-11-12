const { ALLOWED_ATTACHMENT_RESOURCE_TYPES } = require('./constants');

function getAttachmentResourceType(safeUrl) {
  if (safeUrl.toLowerCase().startsWith('data:')) {
    return safeUrl.toLowerCase().startsWith('data:image/') ? 'image' : 'raw';
  }
  try {
    const resourceType = new URL(safeUrl).pathname.split('/').filter(Boolean)[1] || '';
    return ALLOWED_ATTACHMENT_RESOURCE_TYPES.has(resourceType) ? resourceType : 'raw';
  } catch (_error) {
    return 'raw';
  }
}

module.exports = { getAttachmentResourceType };
