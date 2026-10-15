const express = require('express');
const {
  ALLOWED_UPLOAD_MEDIA_TYPES,
  MAX_UPLOAD_BYTES,
  parseDataUrlMetadata,
} = require('../lib/file-validation');
const MAX_FILE_NAME_LENGTH = 180;
const MAX_FALLBACK_BYTES = 128 * 1024;
const MAX_CONCURRENT_UPLOADS_PER_USER = 2;
const activeUploadsByUser = new Map();

function sanitizeFileName(value) {
  const fileName = String(value || 'attachment')
    .trim()
    .replace(/[\\/\0\r\n\t]/g, '_')
    .slice(0, MAX_FILE_NAME_LENGTH);

  return fileName || 'attachment';
}

function createUploadsRouter({ authHelpers, chatService, config }) {
  const router = express.Router();
  const { authRequired } = authHelpers;
  const {
    completeCloudinaryUpload,
    createCloudinaryUploadIntent,
    discardUploadAsset,
    recordPendingUpload,
    reserveUploadQuota,
    uploadToCloudinary,
  } = chatService;
  const isCloudinaryConfigured = Boolean(config.cloudName && config.apiKey && config.apiSecret);

  router.post('/uploads', authRequired, async (req, res) => {
    const userId = String(req.auth?.sub || 'unknown');
    let uploadSlotAcquired = false;
    let uploadIntent = null;
    let fallbackFile = null;
    let pendingUploadRecorded = false;

    try {
      const fileName = sanitizeFileName(req.body.fileName);
      const dataUrl = String(req.body.dataUrl || '').trim();
      const dataUrlMetadata = parseDataUrlMetadata(dataUrl, { maxBytes: MAX_UPLOAD_BYTES });

      if (!dataUrlMetadata) {
        return res.status(400).json({ error: 'Invalid file payload.' });
      }

      if (!ALLOWED_UPLOAD_MEDIA_TYPES.has(dataUrlMetadata.mediaType)) {
        return res.status(415).json({ error: 'Unsupported file type.' });
      }

      if (!isCloudinaryConfigured && !config.allowDataUrlFallback) {
        return res.status(503).json({
          error:
            'File upload storage is not configured. Set Cloudinary signing credentials, or enable ALLOW_DATA_URL_UPLOAD_FALLBACK=true for local-only testing.',
        });
      }

      if (!isCloudinaryConfigured && dataUrlMetadata.bytes > MAX_FALLBACK_BYTES) {
        return res.status(413).json({ error: 'Local fallback attachments must be 128KB or smaller.' });
      }

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
          bytes: dataUrlMetadata.bytes,
        });
      } else {
        fallbackFile = await recordPendingUpload({
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
            format: '',
          },
        });
        uploadIntent = { uploadId: fallbackFile.uploadId };
      }

      await reserveUploadQuota(userId, dataUrlMetadata.bytes, {
        reservationId: uploadIntent.uploadId,
      });

      if (isCloudinaryConfigured) {
        const uploadResult = await uploadToCloudinary({
          dataUrl,
          publicId: uploadIntent.publicId,
          resourceType: uploadIntent.resourceType,
        });
        const extension = uploadResult.format ? `.${uploadResult.format}` : '';
        const file = await completeCloudinaryUpload({
          uploadId: uploadIntent.uploadId,
          ownerId: userId,
          mediaType: dataUrlMetadata.mediaType,
          file: {
            url: uploadResult.secure_url,
            secureUrl: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            fileName: uploadResult.original_filename ? `${uploadResult.original_filename}${extension}` : fileName,
            resourceType: uploadResult.resource_type || 'raw',
            bytes: uploadResult.bytes || dataUrlMetadata.bytes,
            format: uploadResult.format || '',
          },
        });
        pendingUploadRecorded = true;

        return res.status(201).json({
          file,
        });
      }

      pendingUploadRecorded = true;

      return res.status(201).json({
        file: fallbackFile,
        fallback: true,
        note: 'Cloudinary is not configured. File is stored as a temporary data URL.',
      });
    } catch (error) {
      if (
        !pendingUploadRecorded &&
        uploadIntent?.uploadId &&
        error?.code !== 'CLOUDINARY_UPLOAD_AMBIGUOUS'
      ) {
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
  });

  return router;
}

module.exports = {
  createUploadsRouter,
};
