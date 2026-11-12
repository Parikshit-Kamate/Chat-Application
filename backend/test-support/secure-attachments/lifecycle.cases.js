const assert = require('node:assert/strict');
const test = require('node:test');
const { withServer } = require('../routes/http');
const { createAttachmentFixture } = require('./fixture');
const { requestBytes } = require('./request');

test('removed members, pending assets and deleted messages cannot download attachment bytes', async () => {
  const fixture = createAttachmentFixture();
  await withServer(fixture.app, async server => {
    fixture.state.members.clear();
    assert.equal((await requestBytes(server, fixture.path, fixture.token)).status, 404);
    fixture.state.members.add(fixture.asset.owner);
    fixture.asset.status = 'pending';
    assert.equal((await requestBytes(server, fixture.path, fixture.token)).status, 404);
    fixture.asset.status = 'attached';
    fixture.state.messageExists = false;
    assert.equal((await requestBytes(server, fixture.path, fixture.token)).status, 404);
  });
});

test('legacy public Cloudinary assets fail closed without contacting their provider', async t => {
  const fixture = createAttachmentFixture();
  const UploadAsset = require('../../Chat/uploadAsset');
  const legacy = UploadAsset.hydrate({ provider: 'cloudinary' });
  assert.equal(legacy.deliveryType, 'upload');
  fixture.asset.deliveryType = legacy.deliveryType;
  fixture.asset.provider = 'cloudinary';
  fixture.asset.url = 'https://res.cloudinary.com/trusted-cloud/raw/upload/v1/legacy.txt';
  let requests = 0;
  const previousFetch = global.fetch;
  global.fetch = async () => { requests += 1; throw new Error('Must not fetch legacy public asset'); };
  t.after(() => { global.fetch = previousFetch; });
  await withServer(fixture.app, async server => {
    const response = await requestBytes(server, fixture.path, fixture.token);
    assert.equal(response.status, 410);
    assert.equal(response.body.includes('res.cloudinary.com'), false);
    assert.equal(requests, 0);
  });
});
