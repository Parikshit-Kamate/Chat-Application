const crypto = require('crypto');

function bindCreateCloudinarySignature({ cloudinaryApiSecret }) {
  function createCloudinarySignature(parameters) {
    if (!cloudinaryApiSecret) {
      throw new Error('Cloudinary signing credentials are not configured.');
    }
    const signaturePayload = Object.entries(parameters)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return crypto.createHash('sha1').update(`${signaturePayload}${cloudinaryApiSecret}`).digest('hex');
  }
  return createCloudinarySignature;
}

module.exports = bindCreateCloudinarySignature;
