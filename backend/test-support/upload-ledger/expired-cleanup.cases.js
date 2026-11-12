const assert = require('node:assert/strict');
const test = require('node:test');
const { createChatService } = require('../../lib/chat-service');
const { OWNER_ID, UPLOAD_ID, baseServiceOptions } = require('./options');

test('cleanup removes expired pending fallback assets and releases total quota', async () => {
  const now = new Date('2026-07-21T12:00:00.000Z');
  const expiredAsset = {
    _id: UPLOAD_ID,
    owner: OWNER_ID,
    provider: 'data-url',
    status: 'pending',
    pendingExpiresAt: new Date(now.getTime() - 1),
    deletionStartedAt: null,
    bytes: 8,
  };
  let quotaReleaseUpdate = null;
  const UploadAsset = {
    find() {
      return {
        sort() {
          return this;
        },
        async limit() {
          return [expiredAsset];
        },
      };
    },
    async findOneAndUpdate(_filters, update) {
      Object.assign(expiredAsset, update.$set);
      return expiredAsset;
    },
    async deleteOne() {
      return { deletedCount: 1 };
    },
    async updateOne() {},
  };
  const UploadQuota = {
    async findOneAndUpdate(filters, update) {
      quotaReleaseUpdate = { filters, update };
      return { owner: OWNER_ID };
    },
  };
  const service = createChatService(
    baseServiceOptions({
      models: { Chat: {}, FriendRequest: {}, Message: {}, UploadAsset, UploadQuota },
    })
  );

  const result = await service.cleanupAbandonedUploads({ now });

  assert.deepEqual(result, { deleted: 1, failed: 0 });
  assert.equal(quotaReleaseUpdate.filters.owner, OWNER_ID);
  assert.equal(quotaReleaseUpdate.filters.reservations.toString(), UPLOAD_ID);
  assert.equal(Array.isArray(quotaReleaseUpdate.update), true);
});
