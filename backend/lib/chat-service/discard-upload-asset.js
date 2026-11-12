const { normalizeObjectId } = require('../object-id');

function createDiscardUploadAsset({ UploadAsset, deleteTrackedUploadAsset }) {
  async function discardUploadAsset({ uploadId, ownerId }) {
    if (!UploadAsset) {
      return false;
    }
    const normalizedUploadId = normalizeObjectId(uploadId);
    const normalizedOwnerId = normalizeObjectId(ownerId);
    if (!normalizedUploadId || !normalizedOwnerId) {
      return false;
    }
    const now = new Date();
    const asset = await UploadAsset.findOneAndUpdate({
      _id: normalizedUploadId,
      owner: normalizedOwnerId,
      status: { $in: ['uploading', 'pending'] }
    }, { $set: { status: 'deleting', deletionStartedAt: now } }, { new: true });
    return asset ? deleteTrackedUploadAsset(asset, { now }) : false;
  }
  return discardUploadAsset;
}

module.exports = createDiscardUploadAsset;
