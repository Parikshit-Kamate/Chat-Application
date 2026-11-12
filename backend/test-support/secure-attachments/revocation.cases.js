const assert = require('node:assert/strict');
const test = require('node:test');
const { withServer } = require('../routes/http');
const { createAttachmentFixture } = require('./fixture');
const { requestBytes } = require('./request');

test('membership and message existence are rechecked after fetching attachment bytes', async t => {
  const fixture = createAttachmentFixture();
  Object.assign(fixture.asset, { provider: 'cloudinary', deliveryType: 'authenticated',
    url: 'https://res.cloudinary.com/trusted-cloud/raw/authenticated/v1/asset.txt' });
  const previousFetch = global.fetch;
  t.after(() => { global.fetch = previousFetch; });
  global.fetch = async () => {
    fixture.state.members.clear();
    return new Response('hello');
  };
  await withServer(fixture.app, async server => {
    const response = await requestBytes(server, fixture.path, fixture.token);
    assert.equal(response.status, 404);
    assert.equal(response.body.toString().includes('hello'), false);
    assert.match(response.headers['cache-control'], /no-store/);
  });
});
