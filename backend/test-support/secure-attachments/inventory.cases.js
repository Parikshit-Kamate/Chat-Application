const assert = require('node:assert/strict');
const test = require('node:test');
const { inventoryPublicAttachments } = require('../../maintenance/public-attachment-inventory');
const { removePublicRecords } = require('../../maintenance/remove-public-records');

test('legacy cleanup inventories public records and both embedded URL fields without deleting anything', async () => {
  const publicUrl = 'https://res.cloudinary.com/trusted-cloud/image/upload/v1/old.png';
  const authenticatedUrl = publicUrl.replace('/upload/', '/authenticated/');
  const models = {
    UploadAsset: { find() { return { cursor() { return [
      { publicId: 'old', resourceType: 'image', provider: 'cloudinary', url: publicUrl },
      { publicId: 'private', resourceType: 'image', deliveryType: 'authenticated', url: authenticatedUrl }
    ]; } }; } },
    Message: { find() { return { cursor() { return [{ attachments: [
      { publicId: 'old', url: publicUrl },
      { publicId: 'other-old', url: publicUrl, secureUrl: authenticatedUrl },
      { url: publicUrl }
    ] }]; } }; } }
  };
  const result = await inventoryPublicAttachments(models, 'trusted-cloud');
  assert.deepEqual(result.assets.map(asset => asset.publicId).sort(), ['old', 'other-old']);
  assert.equal(result.unresolved, 1);
});

test('legacy record removal releases quota and never targets authenticated rows', async () => {
  const calls = [];
  const models = { UploadAsset: {
    async find(query) {
      assert.deepEqual(query.deliveryType, { $ne: 'authenticated' });
      return [{ _id: 'upload-id', owner: 'owner-id', bytes: 5 }];
    },
    async deleteOne(query) {
      assert.deepEqual(query.deliveryType, { $ne: 'authenticated' });
      calls.push('remove-record');
    }
  } };
  const service = { async releaseUploadQuota(reservation) {
    assert.equal(reservation.reservationId, 'upload-id');
    calls.push('release-quota');
  } };
  await removePublicRecords(models, service, { publicId: 'old', resourceType: 'image' });
  assert.deepEqual(calls, ['release-quota', 'remove-record']);
});
