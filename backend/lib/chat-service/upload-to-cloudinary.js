const { PERSISTED_UPLOAD_RESOURCE_TYPES, MAX_ATTACHMENT_PUBLIC_ID_LENGTH } = require('./constants');
const { createCodedError } = require('./create-coded-error');

function createUploadToCloudinary({
  cloudinaryCloudName,
  cloudinaryApiKey,
  cloudinaryApiSecret,
  cloudinaryUploadPreset,
  performCloudinaryRequest
}) {
  async function uploadToCloudinary({ dataUrl, publicId, resourceType }) {
    if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
      throw new Error('Cloudinary signing credentials are not configured.');
    }
    if (!publicId ||
      !PERSISTED_UPLOAD_RESOURCE_TYPES.has(resourceType) ||
      String(publicId).length > MAX_ATTACHMENT_PUBLIC_ID_LENGTH) {
      throw createCodedError('Invalid Cloudinary upload intent.', 'INVALID_UPLOAD');
    }
    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinaryCloudName)}/${resourceType}/upload`;
    const signedParameters = {
      public_id: publicId,
      timestamp: Math.floor(Date.now() / 1000),
      type: 'authenticated'
    };
    if (cloudinaryUploadPreset) {
      signedParameters.upload_preset = cloudinaryUploadPreset;
    }
    try {
      return await performCloudinaryRequest(endpoint, signedParameters, { file: dataUrl });
    } catch (error) {
      if (error?.code === 'CLOUDINARY_REQUEST_REJECTED') {
        throw error;
      }
      const ambiguousError = createCodedError('Cloudinary upload status could not be confirmed.', 'CLOUDINARY_UPLOAD_AMBIGUOUS');
      ambiguousError.cause = error;
      throw ambiguousError;
    }
  }
  return uploadToCloudinary;
}

module.exports = createUploadToCloudinary;
