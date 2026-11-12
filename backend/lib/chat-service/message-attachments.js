function createMessageAttachments({
  requireUploadModels,
  UploadAsset,
  serializeUploadAsset,
  resolvedUploadLimits,
  destroyCloudinaryAsset,
  releaseUploadQuota
}) {
  const claimPendingAttachments = require('./claim-pending-attachments')({
    requireUploadModels,
    UploadAsset,
    serializeUploadAsset,
    resolvedUploadLimits
  });
  const finalizeMessageAttachments = require('./finalize-message-attachments')({ UploadAsset });
  const releaseMessageAttachments = require('./release-message-attachments')({
    UploadAsset,
    resolvedUploadLimits
  });
  const deleteTrackedUploadAsset = require('./delete-tracked-upload-asset')({
    destroyCloudinaryAsset,
    releaseUploadQuota,
    UploadAsset
  });
  const discardUploadAsset = require('./discard-upload-asset')({ UploadAsset, deleteTrackedUploadAsset });
  const prepareMessageAttachmentsForDeletion = require('./prepare-message-attachments-for-deletion')({
    UploadAsset
  });
  const restoreMessageAttachments = require('./restore-message-attachments')({ UploadAsset });
  const deleteMessageAttachments = require('./delete-message-attachments')({
    UploadAsset,
    deleteTrackedUploadAsset
  });
  return {
    claimPendingAttachments,
    finalizeMessageAttachments,
    releaseMessageAttachments,
    deleteTrackedUploadAsset,
    discardUploadAsset,
    prepareMessageAttachmentsForDeletion,
    restoreMessageAttachments,
    deleteMessageAttachments
  };
}

module.exports = createMessageAttachments;
