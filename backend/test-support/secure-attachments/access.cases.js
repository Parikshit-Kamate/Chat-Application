const assert = require('node:assert/strict');
const test = require('node:test');
const { withServer } = require('../routes/http');
const { createAttachmentFixture } = require('./fixture');
const { requestBytes } = require('./request');

test('attachment bytes require bearer authentication and current chat membership', async () => {
  const fixture = createAttachmentFixture();
  await withServer(fixture.app, async server => {
    assert.equal((await requestBytes(server, fixture.path)).status, 401);
    assert.equal((await requestBytes(server, fixture.path, fixture.outsiderToken)).status, 404);
    const response = await requestBytes(server, fixture.path, fixture.token);
    assert.equal(response.status, 200);
    assert.equal(response.body.toString(), 'hello');
    assert.match(response.headers['cache-control'], /no-store/);
    assert.match(response.headers['content-type'], /^text\/plain(?:; charset=utf-8)?$/);
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.match(response.headers['content-disposition'], /attachment; filename\*=UTF-8''hello.txt/);
    assert.equal(response.headers.location, undefined);
    assert.equal(fixture.state.findCount, 3);
  });
});

test('image downloads do not consume the POST-only upload request limit', async () => {
  const fixture = createAttachmentFixture();
  await withServer(fixture.app, async server => {
    for (let index = 0; index < 12; index += 1) {
      assert.equal((await requestBytes(server, fixture.path, fixture.token)).status, 200);
    }
  });
});
