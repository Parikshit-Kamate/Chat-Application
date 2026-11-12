const assert = require('node:assert/strict');
const test = require('node:test');
const { OWNER_ID, OTHER_OWNER_ID, MESSAGE_ID, UPLOAD_ID } = require('./options');

const { createPendingFixture } = require('./pending-fixture');
test('pending uploads are owner-bound, single-use, and authoritative', async () => {
  const { asset, service } = createPendingFixture();

  await assert.rejects(
    service.claimPendingAttachments({
      attachments: [{ uploadId: UPLOAD_ID }],
      messageId: MESSAGE_ID,
      ownerId: OTHER_OWNER_ID,
    }),
    (error) => error.code === 'INVALID_UPLOAD_ATTACHMENT'
  );

  const attachments = await service.claimPendingAttachments({
    attachments: [
      {
        uploadId: UPLOAD_ID,
        url: 'https://attacker.example/changed.png',
        fileName: 'spoofed.exe',
        bytes: 1,
      },
    ],
    messageId: MESSAGE_ID,
    ownerId: OWNER_ID,
  });

  assert.deepEqual(attachments, [
    {
      uploadId: UPLOAD_ID,
      downloadUrl: `/api/uploads/${UPLOAD_ID}/content`,
      fileName: 'trusted.png',
      resourceType: 'image',
      bytes: 8,
      format: '',
    },
  ]);
  assert.equal(asset.status, 'claiming');
  assert.equal(asset.message, MESSAGE_ID);

  await service.finalizeMessageAttachments({ messageId: MESSAGE_ID, ownerId: OWNER_ID });
  assert.equal(asset.status, 'attached');

  await assert.rejects(
    service.claimPendingAttachments({
      attachments: [{ uploadId: UPLOAD_ID }],
      messageId: '64b000000000000000000005',
      ownerId: OWNER_ID,
    }),
    (error) => error.code === 'INVALID_UPLOAD_ATTACHMENT'
  );
});
