function createUploadCleanup({
  Message,
  UploadAsset,
  restoreMessageAttachments,
  UploadQuota,
  deleteTrackedUploadAsset
}) {
  const reconcileUploadCandidate = require('./reconcile-upload-candidate')({
    Message,
    UploadAsset,
    restoreMessageAttachments
  });
  const cleanupAbandonedUploads = require('./cleanup-abandoned-uploads')({
    UploadAsset,
    UploadQuota,
    reconcileUploadCandidate,
    deleteTrackedUploadAsset
  });
  return { reconcileUploadCandidate, cleanupAbandonedUploads };
}

module.exports = createUploadCleanup;
