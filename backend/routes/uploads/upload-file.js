const { activeUploadsByUser, MAX_CONCURRENT_UPLOADS_PER_USER } = require('./dependencies');

function createUploadFile({
  validateUploadRequest,
  isCloudinaryConfigured,
  createCloudinaryUploadIntent,
  createFallbackUpload,
  reserveUploadQuota,
  completeRemoteUpload,
  discardUploadAsset
}) {
  return async function uploadFile(req, res) {
    const userId = String(req.auth?.sub || 'unknown');
    let uploadSlotAcquired = false;
    let uploadIntent = null;
    let fallbackFile = null;
    let pendingUploadRecorded = false;
    try {
      const validation = validateUploadRequest(req.body);
      if (validation.error) {
        return res.status(validation.status).json({ error: validation.error });
      }
      const { fileName, dataUrl, dataUrlMetadata } = validation;
      if (isCloudinaryConfigured) {
        const activeUploadCount = activeUploadsByUser.get(userId) || 0;
        if (activeUploadCount >= MAX_CONCURRENT_UPLOADS_PER_USER) {
          return res.status(429).json({ error: 'Too many uploads in progress. Please wait and try again.' });
        }
        activeUploadsByUser.set(userId, activeUploadCount + 1);
        uploadSlotAcquired = true;
      }
      if (isCloudinaryConfigured) {
        uploadIntent = await createCloudinaryUploadIntent({
          ownerId: userId,
          fileName,
          mediaType: dataUrlMetadata.mediaType,
          bytes: dataUrlMetadata.bytes
        });
      } else {
        fallbackFile = await createFallbackUpload({ userId, fileName, dataUrl, dataUrlMetadata });
        uploadIntent = { uploadId: fallbackFile.uploadId };
      }
      await reserveUploadQuota(userId, dataUrlMetadata.bytes, { reservationId: uploadIntent.uploadId });
      if (isCloudinaryConfigured) {
        const file = await completeRemoteUpload({ uploadIntent, userId, dataUrl, fileName, dataUrlMetadata });
        pendingUploadRecorded = true;
        return res.status(201).json({ file });
      }
      pendingUploadRecorded = true;
      return res.status(201).json({
        file: fallbackFile,
        fallback: true,
        note: 'Cloudinary is not configured. File is stored as a temporary data URL.'
      });
    } catch (error) {
      if (!pendingUploadRecorded && uploadIntent?.uploadId && error?.code !== 'CLOUDINARY_UPLOAD_AMBIGUOUS') {
        try {
          await discardUploadAsset({ uploadId: uploadIntent.uploadId, ownerId: userId });
        } catch (cleanupError) {
          console.error('Failed to roll back Cloudinary upload:', cleanupError.message);
        }
      }
      if (error?.code === 'UPLOAD_QUOTA_EXCEEDED') {
        return res.status(429).json({ error: error.message });
      }
      if (error?.code === 'INVALID_UPLOAD') {
        return res.status(400).json({ error: 'Invalid uploaded asset metadata.' });
      }
      console.error('Upload error:', error);
      return res.status(502).json({ error: 'File upload failed.' });
    } finally {
      if (uploadSlotAcquired) {
        const remainingUploads = Math.max(0, (activeUploadsByUser.get(userId) || 1) - 1);
        if (remainingUploads === 0) {
          activeUploadsByUser.delete(userId);
        } else {
          activeUploadsByUser.set(userId, remainingUploads);
        }
      }
    }
  };
}

module.exports = createUploadFile;
