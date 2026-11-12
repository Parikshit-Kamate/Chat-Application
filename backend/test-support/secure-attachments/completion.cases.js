const assert = require('node:assert/strict');
const test = require('node:test');
const { createChatService } = require('../../lib/chat-service');
const { OWNER_ID, UPLOAD_ID, baseServiceOptions } = require('../upload-ledger/options');

test('completed authenticated uploads return only protected API metadata', async () => {
  let capturedQuery;
  const models = { Chat: {}, Message: {}, FriendRequest: {}, UploadQuota: {}, UploadAsset: {
    async findOneAndUpdate(query, update) {
      capturedQuery = query;
      return { _id: UPLOAD_ID, ...query, ...update.$set, bytes: 8 };
    }
  } };
  const service = createChatService(baseServiceOptions({ models }));
  const file = { url: 'https://res.cloudinary.com/trusted-cloud/image/authenticated/v1/asset.png',
    publicId: 'asset', resourceType: 'image', bytes: 8, fileName: 'pixel.png', format: 'png' };
  const result = await service.completeCloudinaryUpload({
    uploadId: UPLOAD_ID, ownerId: OWNER_ID, file, mediaType: 'image/png'
  });
  assert.equal(capturedQuery.deliveryType, 'authenticated');
  assert.equal(capturedQuery.bytes, 8);
  assert.equal(result.downloadUrl, `/api/uploads/${UPLOAD_ID}/content`);
  for (const key of ['url', 'secureUrl', 'publicId']) assert.equal(key in result, false);
  await assert.rejects(service.completeCloudinaryUpload({ uploadId: UPLOAD_ID, ownerId: OWNER_ID,
    file: { ...file, url: file.url.replace('/authenticated/', '/upload/') }, mediaType: 'image/png'
  }), error => error.code === 'INVALID_UPLOAD');
});

test('real message schema accepts claimed protected metadata without provider URLs', () => {
  const Message = require('../../Chat/application');
  const metadata = { uploadId: UPLOAD_ID, downloadUrl: `/api/uploads/${UPLOAD_ID}/content`,
    fileName: 'private.png', resourceType: 'image', bytes: 8, format: 'png' };
  const message = new Message({ chat: UPLOAD_ID, sender: OWNER_ID, attachments: [metadata] });
  assert.equal(message.validateSync(), undefined);
  assert.equal(message.attachments[0].url, '');
  assert.equal(message.attachments[0].uploadId.toString(), UPLOAD_ID);
  const service = createChatService(baseServiceOptions());
  assert.equal(service.serializeMessage(message).attachments[0].downloadUrl, metadata.downloadUrl);
  assert.equal('url' in service.serializeMessage(message).attachments[0], false);
});
