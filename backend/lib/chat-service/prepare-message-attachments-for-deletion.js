const { normalizeObjectId } = require('../object-id');

function createPrepareMessageAttachmentsForDeletion({ UploadAsset }) {
  async function prepareMessageAttachmentsForDeletion({ messageId, ownerId }) {
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
      status: { $in: ['claiming', 'attached'] }
    }, { $set: { status: 'deleting', deletionStartedAt: new Date() }, $unset: { claimStartedAt: '' } });
  }
  return prepareMessageAttachmentsForDeletion;
}

module.exports = createPrepareMessageAttachmentsForDeletion;
