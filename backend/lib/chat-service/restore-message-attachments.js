const { normalizeObjectId } = require('../object-id');

function createRestoreMessageAttachments({ UploadAsset }) {
  async function restoreMessageAttachments({ messageId, ownerId }) {
    if (!UploadAsset) {
      return;
    }
    const normalizedMessageId = normalizeObjectId(messageId);
    const normalizedOwnerId = normalizeObjectId(ownerId);
    if (!normalizedMessageId || !normalizedOwnerId) {
      return;
    }
    await UploadAsset.updateMany({
      message: normalizedMessageId,
      owner: normalizedOwnerId,
      status: 'deleting'
    }, {
      $set: { status: 'attached', attachedAt: new Date() },
      $unset: { deletionStartedAt: '', pendingExpiresAt: '' }
    });
  }
  return restoreMessageAttachments;
}

module.exports = createRestoreMessageAttachments;
