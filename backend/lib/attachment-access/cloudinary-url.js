const { createDeliverySignature } = require('./signature');
const { getSafeAttachmentUrl } = require('../chat-service/get-safe-attachment-url');

function createCloudinaryDownloadUrl(asset, config) {
  if (asset.deliveryType !== 'authenticated' || !config.apiSecret) {
    throw new Error('Protected attachment storage is unavailable.');
  }
  const safeUrl = getSafeAttachmentUrl(asset.secureUrl || asset.url, {
    allowDataUrlFallback: false,
    cloudinaryCloudName: config.cloudName
  });
  if (!safeUrl) throw new Error('Invalid protected attachment reference.');
  const url = new URL(safeUrl);
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[1] !== asset.resourceType) throw new Error('Invalid attachment resource.');
  const deliveryPath = segments.slice(3).join('/');
  // Match Cloudinary's Node SDK: the version is emitted, but is not part of source_to_sign.
  const signature = createDeliverySignature(segments.slice(4).join('/'), config.apiSecret);
  return `${url.origin}/${segments.slice(0, 3).join('/')}/s--${signature}--/${deliveryPath}`;
}

module.exports = { createCloudinaryDownloadUrl };
