const assert = require('node:assert/strict');
const test = require('node:test');
const { readAttachmentContent } = require('../../lib/attachment-access/read-content');
const { createCloudinaryDownloadUrl } = require('../../lib/attachment-access/cloudinary-url');
const { createDeliverySignature } = require('../../lib/attachment-access/signature');

function cloudAsset() {
  return { provider: 'cloudinary', deliveryType: 'authenticated', resourceType: 'raw',
    url: 'https://res.cloudinary.com/trusted-cloud/raw/authenticated/v1/asset.txt',
    bytes: 5, mediaType: 'text/plain' };
}
const config = { cloudName: 'trusted-cloud', apiSecret: 'secret' };

test('delivery signatures match independent Cloudinary and NIST vectors', () => {
  // https://cloudinary.com/documentation/delivery_url_signatures
  assert.equal(createDeliverySignature(
    'c_fill,w_300,h_250/e_grayscale/sample-authenticated.png', 'abcd', 'sha1'), 'iDy_JeBq');
  // SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223... (NIST example).
  assert.equal(createDeliverySignature('a', 'bc'), 'ungWv48B');
});

test('protected provider requests use a signed pinned URL and reject redirects', async t => {
  const asset = cloudAsset();
  // Frozen SDK-compatible SHA-256 vector: source_to_sign="asset.txt", secret="secret".
  const signature = '70zpedB-';
  const signedUrl = createCloudinaryDownloadUrl(asset, config);
  assert.equal(signedUrl,
    `https://res.cloudinary.com/trusted-cloud/raw/authenticated/s--${signature}--/v1/asset.txt`);
  assert.equal(createCloudinaryDownloadUrl({ ...asset, url: asset.url.replace('/v1/', '/v2/') }, config),
    signedUrl.replace('/v1/', '/v2/'));
  const previousFetch = global.fetch;
  t.after(() => { global.fetch = previousFetch; });
  global.fetch = async (url, options) => {
    assert.equal(url, signedUrl);
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    return new Response('hello');
  };
  assert.equal((await readAttachmentContent(asset, config)).toString(), 'hello');
  global.fetch = async () => new Response('', { status: 302 });
  await assert.rejects(readAttachmentContent(asset, config), /download failed/);
});

test('provider references cannot target another host, cloud, or public delivery', () => {
  const asset = cloudAsset();
  for (const url of ['http://127.0.0.1/private',
    'https://res.cloudinary.com/other-cloud/raw/authenticated/v1/asset.txt',
    'https://res.cloudinary.com/trusted-cloud/raw/upload/v1/asset.txt']) {
    assert.throws(() => createCloudinaryDownloadUrl({ ...asset, url }, config));
  }
});

test('provider reads reject oversized bodies and mismatched file signatures', async t => {
  const asset = cloudAsset();
  const previousFetch = global.fetch;
  t.after(() => { global.fetch = previousFetch; });
  global.fetch = async () => new Response('too-long');
  await assert.rejects(readAttachmentContent(asset, config), /recorded size/);
  global.fetch = async () => new Response('hello');
  await assert.rejects(readAttachmentContent({ ...asset, mediaType: 'image/png' }, config), /contents/);
});

module.exports = { cloudAsset };
