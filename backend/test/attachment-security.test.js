const assert = require('node:assert/strict');
const test = require('node:test');

const { createChatService } = require('../lib/chat-service');

function createService() {
  return createChatService({
    io: { to: () => ({ emit() {} }) },
    models: { Chat: {}, FriendRequest: {}, Message: {} },
    realtime: { getLiveSocketIdsForUser: () => [] },
    cloudinaryCloudName: 'trusted-cloud',
    cloudinaryUploadPreset: 'unsigned-preset',
    allowDataUrlFallback: true,
  });
}

test('attachment normalization accepts only validated local fallback data', () => {
  const { normalizeAttachment } = createService();
  const validPng = normalizeAttachment({
    url: 'data:image/png;base64,iVBORw0KGgo=',
    fileName: 'pixel.png',
  });

  assert.equal(validPng.resourceType, 'image');
  assert.equal(normalizeAttachment({ url: 'data:image/png;base64,====' }), null);
  assert.equal(normalizeAttachment({ url: `data:image/png;base64,${' '.repeat(1024)}iVBORw0KGgo=` }), null);
  assert.equal(normalizeAttachment({ url: 'data:image/png;base64,PGgxPkJhZDwvaDE+' }), null);
  assert.equal(normalizeAttachment({ url: 'data:text/html;base64,PGgxPkJhZDwvaDE+' }), null);
});

test('attachment normalization restricts remote files to this Cloudinary account', () => {
  const { normalizeAttachment } = createService();
  const validUrl = 'https://res.cloudinary.com/trusted-cloud/image/upload/v1/pixel.png';
  const validFolderUrl = 'https://res.cloudinary.com/trusted-cloud/image/upload/v1/chat/user/pixel.png';

  assert.equal(normalizeAttachment({ url: validUrl }).url, validUrl);
  assert.equal(normalizeAttachment({ url: validFolderUrl }).url, validFolderUrl);
  assert.equal(normalizeAttachment({ url: 'https://cdn.example.com/pixel.png' }), null);
  assert.equal(
    normalizeAttachment({ url: 'https://res.cloudinary.com/other-cloud/image/upload/v1/pixel.png' }),
    null
  );
  assert.equal(
    normalizeAttachment({ url: 'https://res.cloudinary.com/trusted-cloud/image/fetch/https://example.com/pixel.png' }),
    null
  );
  assert.equal(
    normalizeAttachment({
      url: 'https://res.cloudinary.com/trusted-cloud/image/upload/l_fetch:aHR0cHM6Ly9leGFtcGxlLmNvbQ/v1/pixel.png',
    }),
    null
  );
});
