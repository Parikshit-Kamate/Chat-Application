const assert = require('node:assert/strict');
const test = require('node:test');
const normalizeAttachment = require('../lib/chat-service/normalize-attachment');
const createProviderNormalizer = require('../lib/chat-service/normalize-provider-attachment');
const { createChatService } = require('../lib/chat-service');
const { UPLOAD_ID, baseServiceOptions } = require('../test-support/upload-ledger/options');
const normalizeProviderAttachment = createProviderNormalizer({
  allowDataUrlFallback: true, cloudinaryCloudName: 'trusted-cloud'
});

test('provider metadata accepts only validated local fallback data', () => {
  const validPng = normalizeProviderAttachment({
    url: 'data:image/png;base64,iVBORw0KGgo=', fileName: 'pixel.png'
  });
  assert.equal(validPng.resourceType, 'image');
  for (const url of ['data:image/png;base64,====', 'data:image/png;base64,PGgxPkJhZDwvaDE+',
    'data:text/html;base64,PGgxPkJhZDwvaDE+']) {
    assert.equal(normalizeProviderAttachment({ url }), null);
  }
});

test('provider metadata requires authenticated delivery in this Cloudinary account', () => {
  const validUrl = 'https://res.cloudinary.com/trusted-cloud/image/authenticated/v1/pixel.png';
  assert.equal(normalizeProviderAttachment({ url: validUrl }).url, validUrl);
  for (const url of ['https://cdn.example.com/pixel.png',
    'https://res.cloudinary.com/other-cloud/image/authenticated/v1/pixel.png',
    'https://res.cloudinary.com/trusted-cloud/image/upload/v1/pixel.png',
    'https://res.cloudinary.com/trusted-cloud/image/fetch/https://example.com/pixel.png']) {
    assert.equal(normalizeProviderAttachment({ url }), null);
  }
});

test('public attachment and message serializers never expose provider identifiers or delivery URLs', () => {
  const source = { uploadId: UPLOAD_ID, fileName: 'pixel.png', resourceType: 'image', bytes: 8,
    url: 'https://res.cloudinary.com/trusted-cloud/image/upload/v1/pixel.png',
    secureUrl: 'data:image/png;base64,iVBORw0KGgo=', publicId: 'provider-private-id' };
  const attachment = normalizeAttachment(source);
  assert.equal(attachment.downloadUrl, `/api/uploads/${UPLOAD_ID}/content`);
  const service = createChatService(baseServiceOptions());
  const message = service.serializeMessage({ _id: UPLOAD_ID, chat: UPLOAD_ID,
    sender: UPLOAD_ID, attachments: [source] });
  const serialized = JSON.stringify({ attachment, message });
  assert.equal(serialized.includes('res.cloudinary.com'), false);
  assert.equal(serialized.includes('base64'), false);
  assert.equal(serialized.includes('provider-private-id'), false);
  for (const key of ['url', 'secureUrl', 'publicId']) assert.equal(key in attachment, false);
  assert.equal(normalizeAttachment({ url: source.url }), null);
});

test('a batch of legacy stored messages never serializes old public URLs', () => {
  const service = createChatService(baseServiceOptions());
  const messages = Array.from({ length: 20 }, (_, index) => ({
    _id: UPLOAD_ID, chat: UPLOAD_ID, sender: UPLOAD_ID,
    attachments: [{ uploadId: index % 2 ? UPLOAD_ID : null,
      url: `https://res.cloudinary.com/trusted-cloud/image/upload/v1/legacy-${index}.png`,
      secureUrl: `https://res.cloudinary.com/trusted-cloud/image/upload/v1/legacy-${index}.png`,
      publicId: `legacy-${index}` }]
  }));
  const serialized = JSON.stringify(messages.map(service.serializeMessage));
  assert.equal(serialized.includes('res.cloudinary.com'), false);
  assert.equal(serialized.includes('legacy-'), false);
  assert.equal(serialized.includes('secureUrl'), false);
});
