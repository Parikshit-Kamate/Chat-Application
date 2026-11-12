const { normalizeObjectId } = require('../object-id');

function createDeleteMessageAttachments({ UploadAsset, deleteTrackedUploadAsset }) {
  async function deleteMessageAttachments({ messageId, ownerId }) {
    if (!UploadAsset) {
      return { deleted: 0, failed: 0 };
    }
    const normalizedMessageId = normalizeObjectId(messageId);
    const normalizedOwnerId = normalizeObjectId(ownerId);
    if (!normalizedMessageId || !normalizedOwnerId) {
      return { deleted: 0, failed: 0 };
    }
    const assets = await UploadAsset.find({
      message: normalizedMessageId,
      owner: normalizedOwnerId,
      status: 'deleting'
    }).limit(8);
    let deleted = 0;
    let failed = 0;
    for (const asset of assets) {
      try {
        if (await deleteTrackedUploadAsset(asset)) {
          deleted += 1;
        }
      } catch (error) {
        failed += 1;
        console.error('Message attachment cleanup failed:', error.message);
      }
    }
    return { deleted, failed };
  }
  return deleteMessageAttachments;
}

module.exports = createDeleteMessageAttachments;
