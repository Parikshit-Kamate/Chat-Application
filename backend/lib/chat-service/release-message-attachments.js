const { normalizeObjectId } = require('../object-id');

function createReleaseMessageAttachments({ UploadAsset, resolvedUploadLimits }) {
  async function releaseMessageAttachments({ messageId, ownerId }) {
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
      $set: {
        status: 'pending',
        pendingExpiresAt: new Date(Date.now() + resolvedUploadLimits.pendingTtlSeconds * 1000)
      },
      $unset: { message: '', claimStartedAt: '' }
    });
  }
  return releaseMessageAttachments;
}

module.exports = createReleaseMessageAttachments;
