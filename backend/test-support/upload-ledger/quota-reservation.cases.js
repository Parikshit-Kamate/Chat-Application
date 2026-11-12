const assert = require('node:assert/strict');
const test = require('node:test');
const { createChatService } = require('../../lib/chat-service');
const { OWNER_ID, UPLOAD_ID, SECOND_UPLOAD_ID, baseServiceOptions } = require('./options');

test('durable upload quota reservations reject requests beyond configured totals', async () => {
  let quota = null;
  const UploadQuota = {
    async updateOne(filters, update, options = {}) {
      if (!quota && options.upsert) {
        quota = { ...update.$setOnInsert };
      }

      if (quota && filters.dailyWindowStart?.$lt && quota.dailyWindowStart < filters.dailyWindowStart.$lt) {
        Object.assign(quota, update.$set);
      }
    },
    async findOneAndUpdate(filters, update) {
      const reservationId = filters.reservations.$ne.toString();
      const fits =
        quota.owner === filters.owner &&
        quota.dailyWindowStart.getTime() === filters.dailyWindowStart.getTime() &&
        quota.dailyFiles < filters.dailyFiles.$lt &&
        quota.dailyBytes <= filters.dailyBytes.$lte &&
        quota.totalFiles < filters.totalFiles.$lt &&
        quota.totalBytes <= filters.totalBytes.$lte &&
        !quota.reservations.some((value) => value.toString() === reservationId);

      if (!fits) {
        return null;
      }

      Object.entries(update.$inc).forEach(([key, value]) => {
        quota[key] += value;
      });
      quota.reservations.push(update.$addToSet.reservations);
      return quota;
    },
  };
  const service = createChatService(
    baseServiceOptions({
      models: { Chat: {}, FriendRequest: {}, Message: {}, UploadAsset: {}, UploadQuota },
      uploadLimits: {
        dailyMaxBytes: 10,
        dailyMaxFiles: 1,
        totalMaxBytes: 10,
        totalMaxFiles: 1,
      },
    })
  );

  const reservation = await service.reserveUploadQuota(OWNER_ID, 8, {
    reservationId: UPLOAD_ID,
  });
  assert.equal(reservation.bytes, 8);
  assert.equal(reservation.reservationId, UPLOAD_ID);
  assert.equal(quota.totalFiles, 1);
  assert.equal(quota.totalBytes, 8);

  await assert.rejects(
    service.reserveUploadQuota(OWNER_ID, 1, { reservationId: SECOND_UPLOAD_ID }),
    (error) => error.code === 'UPLOAD_QUOTA_EXCEEDED'
  );
});
