const assert = require('node:assert/strict');
const { objectId } = require('./query');
const { makeAuth } = require('./auth');
const { createJsonApp } = require('./http');
const { createUploadsRouter } = require('../../routes/uploads-routes');

async function createTimeoutUploadFixture() {
  const authHelpers = makeAuth();
  const userId = objectId();
  const uploadId = objectId();
  const token = authHelpers.createJwtToken({ sub: userId, username: 'uploader' });
  const calls = [];
  const app = createJsonApp(
    '/api',
    createUploadsRouter({
      authHelpers,
      chatService: {
        async completeCloudinaryUpload() {
          throw new Error('Upload completion should not run after a timeout.');
        },
        async createCloudinaryUploadIntent() {
          calls.push('create-intent');
          return {
            uploadId,
            publicId: `confabulate/${userId}/server-id`,
            resourceType: 'image',
          };
        },
        async discardUploadAsset({ uploadId: discardedUploadId, ownerId }) {
          calls.push('discard-intent');
          assert.equal(discardedUploadId, uploadId);
          assert.equal(ownerId, userId);
          return true;
        },
        async recordPendingUpload() {
          throw new Error('Fallback upload should not run.');
        },
        async releaseUploadQuota() {
          calls.push('direct-quota-release');
        },
        async reserveUploadQuota(ownerId, bytes, { reservationId }) {
          calls.push('reserve-quota');
          assert.equal(ownerId, userId);
          assert.equal(bytes, 8);
          assert.equal(reservationId, uploadId);
          return { ownerId: userId, bytes, reservationId, dailyWindowStart: new Date() };
        },
        async uploadToCloudinary({ publicId }) {
          calls.push('upload');
          assert.equal(publicId, `confabulate/${userId}/server-id`);
          const error = new Error('Cloudinary request timed out.');
          error.code = 'CLOUDINARY_UPLOAD_AMBIGUOUS';
          throw error;
        },
      },
      config: {
        cloudName: 'trusted-cloud',
        apiKey: 'api-key',
        apiSecret: 'api-secret',
        allowDataUrlFallback: false,
      },
    })
  );
  return {
    app,
    token,
    calls,
  };
}

module.exports = { createTimeoutUploadFixture };
