const assert = require('node:assert/strict');
const test = require('node:test');
const { createChatService } = require('../../lib/chat-service');
const { OWNER_ID, MESSAGE_ID, UPLOAD_ID, baseServiceOptions } = require('./options');

test('cleanup removes a stale attachment claim when its message was never created', async () => {
  const now = new Date('2026-07-21T12:00:00.000Z');
  const asset = {
    _id: UPLOAD_ID,
    owner: OWNER_ID,
    provider: 'data-url',
    status: 'claiming',
    message: MESSAGE_ID,
    claimStartedAt: new Date(now.getTime() - 20 * 60 * 1000),
    bytes: 8,
  };
  let deleted = false;
  const UploadAsset = {
    find() {
      return {
        sort() {
          return this;
        },
        async limit() {
          return [asset];
        },
      };
    },
    async findOneAndUpdate(_filters, update) {
      Object.assign(asset, update.$set);
      return asset;
    },
    async deleteOne() {
      deleted = true;
      return { deletedCount: 1 };
    },
    async updateOne() {},
  };
  const UploadQuota = {
    async findOneAndUpdate(filters) {
      assert.equal(filters.owner, OWNER_ID);
      assert.equal(filters.reservations.toString(), UPLOAD_ID);
      return { owner: OWNER_ID };
    },
  };
  const Message = { async exists() { return null; } };
  const service = createChatService(
    baseServiceOptions({
      models: { Chat: {}, FriendRequest: {}, Message, UploadAsset, UploadQuota },
    })
  );

  const result = await service.cleanupAbandonedUploads({ now });

  assert.deepEqual(result, { deleted: 1, failed: 0 });
  assert.equal(deleted, true);
  assert.equal(asset.status, 'deleting');
});
