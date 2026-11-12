const assert = require('node:assert/strict');
const test = require('node:test');
const { createChatService } = require('../../lib/chat-service');
const { OWNER_ID, baseServiceOptions } = require('./options');

const crypto = require('node:crypto');
test('Cloudinary uploads sign a server-selected public ID', async (t) => {
  const originalFetch = global.fetch;
  let capturedRequest = null;
  global.fetch = async (url, options) => {
    capturedRequest = { url, options };
    return {
      ok: true,
      async json() {
        return { public_id: 'generated-id', resource_type: 'image', secure_url: 'https://example.invalid' };
      },
    };
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const service = createChatService(baseServiceOptions());
  const publicId = `confabulate/${OWNER_ID}/server-generated-id`;
  await service.uploadToCloudinary({
    dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    publicId,
    resourceType: 'image',
  });

  const requestBody = capturedRequest.options.body;
  const timestamp = requestBody.get('timestamp');
  const expectedSignature = crypto
    .createHash('sha1')
    .update(`public_id=${publicId}&timestamp=${timestamp}&type=authenticated&upload_preset=signed-presetapi-secret`)
    .digest('hex');

  assert.equal(capturedRequest.url, 'https://api.cloudinary.com/v1_1/trusted-cloud/image/upload');
  assert.equal(requestBody.get('api_key'), 'api-key');
  assert.equal(requestBody.get('signature'), expectedSignature);
  assert.equal(requestBody.get('upload_preset'), 'signed-preset');
  assert.equal(requestBody.get('public_id'), publicId);
  assert.equal(requestBody.get('type'), 'authenticated');
});
