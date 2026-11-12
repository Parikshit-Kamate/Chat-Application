const { normalizeObjectId } = require('../object-id');

function createFinalizeMessageAttachments({ UploadAsset }) {
  async function finalizeMessageAttachments({ messageId, ownerId }) {
    if (!UploadAsset) {
      return;
    }
    const normalizedOwnerId = normalizeObjectId(ownerId);
    const normalizedMessageId = normalizeObjectId(messageId);
    if (!normalizedOwnerId || !normalizedMessageId) {
      return;
    }
    await UploadAsset.updateMany({
      owner: normalizedOwnerId,
      status: 'claiming',
      message: normalizedMessageId
    }, {
      $set: { status: 'attached', attachedAt: new Date() },
      $unset: { claimStartedAt: '', pendingExpiresAt: '' }
    });
  }
  return finalizeMessageAttachments;
}

module.exports = createFinalizeMessageAttachments;
