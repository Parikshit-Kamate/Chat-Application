const assert = require('node:assert/strict');
const test = require('node:test');
const { createChatService } = require('../../lib/chat-service');
const { baseServiceOptions } = require('../upload-ledger/options');

test('Cloudinary destruction signs authenticated delivery and explicitly purges legacy public assets', async t => {
  const requests = [];
  const previousFetch = global.fetch;
  t.after(() => { global.fetch = previousFetch; });
  global.fetch = async (_url, options) => {
    requests.push(options.body);
    return { ok: true, async json() { return { result: 'ok' }; } };
  };
  const service = createChatService(baseServiceOptions());
  await service.destroyCloudinaryAsset({ publicId: 'asset', resourceType: 'image' });
  await service.destroyCloudinaryAsset({ publicId: 'legacy', resourceType: 'raw', deliveryType: 'upload' });
  assert.equal(requests[0].get('type'), 'authenticated');
  assert.equal(requests[1].get('type'), 'upload');
  assert.equal(requests[0].get('invalidate'), 'true');
  assert.equal(requests[1].get('invalidate'), 'true');
});
