const assert = require('node:assert/strict');
const test = require('node:test');
const { createChatService } = require('../../lib/chat-service');
const { OWNER_ID, UPLOAD_ID, baseServiceOptions } = require('./options');

test('Cloudinary upload intent is durable before the remote request', async () => {
  let createdAsset = null;
  const UploadAsset = {
    async create(data) {
      createdAsset = { _id: UPLOAD_ID, ...data };
      return createdAsset;
    },
  };
  const service = createChatService(
    baseServiceOptions({
      models: { Chat: {}, FriendRequest: {}, Message: {}, UploadAsset, UploadQuota: {} },
    })
  );

  const intent = await service.createCloudinaryUploadIntent({
    ownerId: OWNER_ID,
    fileName: 'photo.png',
    mediaType: 'image/png',
    bytes: 128,
  });

  assert.equal(createdAsset.status, 'uploading');
  assert.equal(createdAsset.deliveryType, 'authenticated');
  assert.equal(createdAsset.owner, OWNER_ID);
  assert.equal(createdAsset.publicId, intent.publicId);
  assert.equal(intent.uploadId, UPLOAD_ID);
  assert.match(intent.publicId, new RegExp(`^confabulate/${OWNER_ID}/`));
});
