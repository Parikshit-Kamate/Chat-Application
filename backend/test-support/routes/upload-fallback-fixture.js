const { objectId } = require('./query');
const { makeAuth } = require('./auth');
const { createJsonApp } = require('./http');
const { createUploadsRouter } = require('../../routes/uploads-routes');

async function createFallbackUploadFixture() {
  const authHelpers = makeAuth();
  const userId = objectId();
  const token = authHelpers.createJwtToken({ sub: userId, username: 'uploader' });
  const app = createJsonApp(
    '/api',
    createUploadsRouter({
      authHelpers,
      chatService: {
        async destroyCloudinaryAsset() {},
        async recordPendingUpload({ file }) {
          return { uploadId: objectId(), ...file };
        },
        async releaseUploadQuota() {},
        async reserveUploadQuota(ownerId, bytes) {
          return { ownerId, bytes, dailyWindowStart: new Date() };
        },
        async uploadToCloudinary() {
          throw new Error('Cloudinary should not be used in fallback mode.');
        },
      },
      config: {
        cloudName: '',
        apiKey: '',
        apiSecret: '',
        allowDataUrlFallback: true,
      },
    })
  );
  return {
    app,
    token,
  };
}

module.exports = { createFallbackUploadFixture };
