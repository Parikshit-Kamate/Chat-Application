const { ALLOWED_ATTACHMENT_RESOURCE_TYPES } = require('./constants');

function createDestroyCloudinaryAsset({ cloudinaryCloudName, performCloudinaryRequest }) {
  async function destroyCloudinaryAsset({ publicId, resourceType, deliveryType = 'authenticated' }) {
    if (!publicId || !ALLOWED_ATTACHMENT_RESOURCE_TYPES.has(resourceType) ||
      !['authenticated', 'upload'].includes(deliveryType)) {
      throw new Error('Invalid Cloudinary asset metadata.');
    }
    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinaryCloudName)}/${resourceType}/destroy`;
    const signedParameters = {
      invalidate: 'true',
      public_id: publicId,
      type: deliveryType,
      timestamp: Math.floor(Date.now() / 1000)
    };
    const result = await performCloudinaryRequest(endpoint, signedParameters);
    if (result?.result !== 'ok' && result?.result !== 'not found') {
      throw new Error('Cloudinary asset deletion failed.');
    }
    return result;
  }
  return destroyCloudinaryAsset;
}

module.exports = createDestroyCloudinaryAsset;
