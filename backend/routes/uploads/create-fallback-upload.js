function createCreateFallbackUpload({ recordPendingUpload }) {
  return async function createFallbackUpload({ userId, fileName, dataUrl, dataUrlMetadata }) {
    return await recordPendingUpload({
      ownerId: userId,
      provider: 'data-url',
      mediaType: dataUrlMetadata.mediaType,
      file: {
        url: dataUrl,
        secureUrl: '',
        publicId: '',
        fileName,
        resourceType: dataUrlMetadata.mediaType.startsWith('image/') ? 'image' : 'raw',
        bytes: dataUrlMetadata.bytes,
        format: ''
      }
    });
  };
}

module.exports = createCreateFallbackUpload;
