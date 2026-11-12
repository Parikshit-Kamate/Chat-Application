function createCompleteRemoteUpload({ uploadToCloudinary, completeCloudinaryUpload }) {
  return async function completeRemoteUpload({ uploadIntent, userId, dataUrl, fileName, dataUrlMetadata }) {
    const uploadResult = await uploadToCloudinary({
      dataUrl,
      publicId: uploadIntent.publicId,
      resourceType: uploadIntent.resourceType
    });
    const file = await completeCloudinaryUpload({
      uploadId: uploadIntent.uploadId,
      ownerId: userId,
      mediaType: dataUrlMetadata.mediaType,
      file: {
        url: uploadResult.secure_url,
        secureUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        fileName,
        resourceType: uploadResult.resource_type || 'raw',
        bytes: uploadResult.bytes || dataUrlMetadata.bytes,
        format: uploadResult.format || ''
      }
    });
    return file;
  };
}

module.exports = createCompleteRemoteUpload;
