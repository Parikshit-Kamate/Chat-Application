const assert = require('node:assert/strict');
const test = require('node:test');
const { createChatService } = require('../../lib/chat-service');
const { OWNER_ID, UPLOAD_ID, baseServiceOptions } = require('./options');

test('upload quota release is idempotent when cleanup retries', async () => {
  const quota = {
    owner: OWNER_ID,
    totalFiles: 1,
    totalBytes: 8,
    reservations: [UPLOAD_ID],
  };
  const UploadQuota = {
    async findOneAndUpdate(filters, update) {
      const reservationId = filters.reservations.toString();
      const reservationIndex = quota.reservations.findIndex(
        (value) => value.toString() === reservationId
      );
      if (filters.owner !== quota.owner || reservationIndex === -1) {
        return null;
      }

      assert.equal(Array.isArray(update), true);
      quota.reservations.splice(reservationIndex, 1);
      quota.totalFiles = Math.max(0, quota.totalFiles - 1);
      quota.totalBytes = Math.max(0, quota.totalBytes - 8);
      return quota;
    },
  };
  const service = createChatService(
    baseServiceOptions({
      models: { Chat: {}, FriendRequest: {}, Message: {}, UploadAsset: {}, UploadQuota },
    })
  );
  const reservation = {
    ownerId: OWNER_ID,
    bytes: 8,
    reservationId: UPLOAD_ID,
  };

  assert.equal(await service.releaseUploadQuota(reservation), true);
  assert.equal(await service.releaseUploadQuota(reservation), false);
  assert.equal(quota.totalFiles, 0);
  assert.equal(quota.totalBytes, 0);
  assert.deepEqual(quota.reservations, []);
});
