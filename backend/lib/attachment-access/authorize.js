const { normalizeObjectId } = require('../object-id');

async function authorizeAttachment(models, rawUploadId, rawUserId) {
  const uploadId = normalizeObjectId(rawUploadId);
  const userId = normalizeObjectId(rawUserId);
  if (!uploadId || !userId || !models?.UploadAsset) return null;
  const asset = await models.UploadAsset.findOne({ _id: uploadId, status: 'attached' });
  if (!asset?.message) return null;
  const message = await models.Message.findOne({
    _id: asset.message,
    'attachments.uploadId': asset._id
  });
  if (!message) return null;
  const chat = await models.Chat.findOne({ _id: message.chat, 'members.user': userId });
  return chat ? asset : null;
}

module.exports = { authorizeAttachment };
