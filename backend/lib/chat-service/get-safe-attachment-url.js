const { MAX_ATTACHMENT_URL_LENGTH, CLOUDINARY_DELIVERY_HOST, ALLOWED_ATTACHMENT_RESOURCE_TYPES } = require('./constants');
const { isAllowedAttachmentDataUrl } = require('./is-allowed-attachment-data-url');

function getSafeAttachmentUrl(value, { allowDataUrlFallback, cloudinaryCloudName }) {
  const rawUrl = String(value || '').trim();
  const normalizedUrl = rawUrl.toLowerCase();
  if (!rawUrl) {
    return '';
  }
  if (normalizedUrl.startsWith('data:')) {
    return allowDataUrlFallback && isAllowedAttachmentDataUrl(rawUrl) ? rawUrl : '';
  }
  if (rawUrl.length > MAX_ATTACHMENT_URL_LENGTH || !cloudinaryCloudName) {
    return '';
  }
  try {
    const parsedUrl = new URL(rawUrl);
    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    const assetCloudName = pathSegments[0] ? decodeURIComponent(pathSegments[0]) : '';
    const resourceType = pathSegments[1] || '';
    const deliveryType = pathSegments[2] || '';
    const version = pathSegments[3] || '';
    const assetPath = pathSegments.slice(4);
    const hasUnsafeAssetSegment = assetPath.some(segment => {
      try {
        const decodedSegment = decodeURIComponent(segment);
        return !decodedSegment ||
          decodedSegment === '.' ||
          decodedSegment === '..' ||
          decodedSegment.includes('/') ||
          decodedSegment.includes('\\') ||
          decodedSegment.includes('\0') ||
          decodedSegment.length > 255;
      } catch (_error) {
        return true;
      }
    });
    if (parsedUrl.protocol !== 'https:' ||
      parsedUrl.hostname.toLowerCase() !== CLOUDINARY_DELIVERY_HOST ||
      parsedUrl.port ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.search ||
      parsedUrl.hash ||
      assetCloudName !== cloudinaryCloudName ||
      !ALLOWED_ATTACHMENT_RESOURCE_TYPES.has(resourceType) ||
      deliveryType !== 'authenticated' ||
      pathSegments.length < 5 ||
      !/^v\d+$/.test(version) ||
      hasUnsafeAssetSegment) {
      return '';
    }
    return parsedUrl.toString();
  } catch (_error) {
    return '';
  }
}

module.exports = { getSafeAttachmentUrl };
