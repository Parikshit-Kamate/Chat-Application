const { createChatService } = require('../../lib/chat-service');
const { OWNER_ID, UPLOAD_ID, baseServiceOptions } = require('./options');

function createPendingFixture() {
  const asset = {
    _id: UPLOAD_ID,
    owner: OWNER_ID,
    provider: 'data-url',
    status: 'pending',
    pendingExpiresAt: new Date(Date.now() + 60_000),
    url: 'data:image/png;base64,iVBORw0KGgo=',
    secureUrl: '',
    publicId: '',
    fileName: 'trusted.png',
    resourceType: 'image',
    bytes: 8,
    format: '',
  };
  const UploadAsset = {
    async findOneAndUpdate(filters, update) {
      if (
        filters._id !== asset._id ||
        filters.owner !== asset.owner ||
        filters.status !== asset.status ||
        asset.pendingExpiresAt <= filters.pendingExpiresAt.$gt
      ) {
        return null;
      }

      Object.assign(asset, update.$set);
      return asset;
    },
    async updateMany(filters, update) {
      if (
        filters.owner === asset.owner &&
        filters.status === asset.status &&
        filters.message === asset.message
      ) {
        Object.assign(asset, update.$set);
        Object.keys(update.$unset || {}).forEach((key) => delete asset[key]);
      }
    },
  };
  const service = createChatService(
    baseServiceOptions({
      models: { Chat: {}, FriendRequest: {}, Message: {}, UploadAsset, UploadQuota: {} },
    })
  );
  return { asset, service };
}

module.exports = { createPendingFixture };
