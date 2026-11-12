const { normalizeObjectId } = require('../object-id');
const { createCodedError } = require('./create-coded-error');

function createClaimPendingAttachments({
  requireUploadModels,
  UploadAsset,
  serializeUploadAsset,
  resolvedUploadLimits
}) {
  async function claimPendingAttachments({ attachments, messageId, ownerId }) {
    requireUploadModels();
    const normalizedOwnerId = normalizeObjectId(ownerId);
    const normalizedMessageId = normalizeObjectId(messageId);
    const requestedAttachments = Array.isArray(attachments) ? attachments : [];
    if (!normalizedOwnerId || !normalizedMessageId || requestedAttachments.length > 8) {
      throw createCodedError('Invalid message attachments.', 'INVALID_UPLOAD_ATTACHMENT');
    }
    if (requestedAttachments.length === 0) {
      return [];
    }
    const uploadIds = requestedAttachments.map(attachment => normalizeObjectId(attachment?.uploadId));
    if (uploadIds.some(uploadId => !uploadId) || new Set(uploadIds).size !== uploadIds.length) {
      throw createCodedError('Invalid message attachments.', 'INVALID_UPLOAD_ATTACHMENT');
    }
    const claimedAssetIds = [];
    const claimedAttachments = [];
    const now = new Date();
    try {
      for (const uploadId of uploadIds) {
        const asset = await UploadAsset.findOneAndUpdate({
          _id: uploadId,
          owner: normalizedOwnerId,
          $or: [{ provider: 'data-url' }, { provider: 'cloudinary', deliveryType: 'authenticated' }],
          status: 'pending',
          pendingExpiresAt: { $gt: now }
        }, { $set: { status: 'claiming', message: normalizedMessageId, claimStartedAt: now } }, { new: true });
        if (!asset) {
          throw createCodedError('An attachment is unavailable or does not belong to this user.', 'INVALID_UPLOAD_ATTACHMENT');
        }
        claimedAssetIds.push(asset._id);
        claimedAttachments.push(serializeUploadAsset(asset));
      }
      return claimedAttachments;
    } catch (error) {
      if (claimedAssetIds.length > 0) {
        await UploadAsset.updateMany({
          _id: { $in: claimedAssetIds },
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
      throw error;
    }
  }
  return claimPendingAttachments;
}

module.exports = createClaimPendingAttachments;
