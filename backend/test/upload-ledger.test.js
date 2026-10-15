const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const { createChatService } = require('../lib/chat-service');

const OWNER_ID = '64b000000000000000000001';
const OTHER_OWNER_ID = '64b000000000000000000002';
const MESSAGE_ID = '64b000000000000000000003';
const UPLOAD_ID = '64b000000000000000000004';
const SECOND_UPLOAD_ID = '64b000000000000000000005';

function baseServiceOptions(overrides = {}) {
  return {
    io: { to: () => ({ emit() {} }) },
    models: { Chat: {}, FriendRequest: {}, Message: {} },
    realtime: { getLiveSocketIdsForUser: () => [] },
    cloudinaryCloudName: 'trusted-cloud',
    cloudinaryApiKey: 'api-key',
    cloudinaryApiSecret: 'api-secret',
    cloudinaryUploadPreset: 'signed-preset',
    allowDataUrlFallback: true,
    ...overrides,
  };
}

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
    .update(`public_id=${publicId}&timestamp=${timestamp}&upload_preset=signed-presetapi-secret`)
    .digest('hex');

  assert.equal(capturedRequest.url, 'https://api.cloudinary.com/v1_1/trusted-cloud/image/upload');
  assert.equal(requestBody.get('api_key'), 'api-key');
  assert.equal(requestBody.get('signature'), expectedSignature);
  assert.equal(requestBody.get('upload_preset'), 'signed-preset');
  assert.equal(requestBody.get('public_id'), publicId);
});

test('Cloudinary upload intent is durable before the remote request', async () => {
  let createdAsset = null;
  const UploadAsset = {
    async create(data) {
      createdAsset = { _id: UPLOAD_ID, ...data };
      return createdAsset;
    },
  };
  const service = createChatService(
    baseServiceOptions({
      models: { Chat: {}, FriendRequest: {}, Message: {}, UploadAsset, UploadQuota: {} },
    })
  );

  const intent = await service.createCloudinaryUploadIntent({
    ownerId: OWNER_ID,
    fileName: 'photo.png',
    mediaType: 'image/png',
    bytes: 128,
  });

  assert.equal(createdAsset.status, 'uploading');
  assert.equal(createdAsset.owner, OWNER_ID);
  assert.equal(createdAsset.publicId, intent.publicId);
  assert.equal(intent.uploadId, UPLOAD_ID);
  assert.match(intent.publicId, new RegExp(`^confabulate/${OWNER_ID}/`));
});

test('pending uploads are owner-bound, single-use, and authoritative', async () => {
  const asset = {
    _id: UPLOAD_ID,
    owner: OWNER_ID,
    status: 'pending',
    pendingExpiresAt: new Date(Date.now() + 60_000),
    url: 'data:image/png;base64,iVBORw0KGgo=',
    secureUrl: '',
    publicId: '',
    fileName: 'trusted.png',
    resourceType: 'image',
    bytes: 8,
    format: '',
  };
  const UploadAsset = {
    async findOneAndUpdate(filters, update) {
      if (
        filters._id !== asset._id ||
        filters.owner !== asset.owner ||
        filters.status !== asset.status ||
        asset.pendingExpiresAt <= filters.pendingExpiresAt.$gt
      ) {
        return null;
      }

      Object.assign(asset, update.$set);
      return asset;
    },
    async updateMany(filters, update) {
      if (
        filters.owner === asset.owner &&
        filters.status === asset.status &&
        filters.message === asset.message
      ) {
        Object.assign(asset, update.$set);
        Object.keys(update.$unset || {}).forEach((key) => delete asset[key]);
      }
    },
  };
  const service = createChatService(
    baseServiceOptions({
      models: { Chat: {}, FriendRequest: {}, Message: {}, UploadAsset, UploadQuota: {} },
    })
  );

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
      url: asset.url,
      secureUrl: '',
      publicId: '',
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

test('durable upload quota reservations reject requests beyond configured totals', async () => {
  let quota = null;
  const UploadQuota = {
    async updateOne(filters, update, options = {}) {
      if (!quota && options.upsert) {
        quota = { ...update.$setOnInsert };
      }

      if (quota && filters.dailyWindowStart?.$lt && quota.dailyWindowStart < filters.dailyWindowStart.$lt) {
        Object.assign(quota, update.$set);
      }
    },
    async findOneAndUpdate(filters, update) {
      const reservationId = filters.reservations.$ne.toString();
      const fits =
        quota.owner === filters.owner &&
        quota.dailyWindowStart.getTime() === filters.dailyWindowStart.getTime() &&
        quota.dailyFiles < filters.dailyFiles.$lt &&
        quota.dailyBytes <= filters.dailyBytes.$lte &&
        quota.totalFiles < filters.totalFiles.$lt &&
        quota.totalBytes <= filters.totalBytes.$lte &&
        !quota.reservations.some((value) => value.toString() === reservationId);

      if (!fits) {
        return null;
      }

      Object.entries(update.$inc).forEach(([key, value]) => {
        quota[key] += value;
      });
      quota.reservations.push(update.$addToSet.reservations);
      return quota;
    },
  };
  const service = createChatService(
    baseServiceOptions({
      models: { Chat: {}, FriendRequest: {}, Message: {}, UploadAsset: {}, UploadQuota },
      uploadLimits: {
        dailyMaxBytes: 10,
        dailyMaxFiles: 1,
        totalMaxBytes: 10,
        totalMaxFiles: 1,
      },
    })
  );

  const reservation = await service.reserveUploadQuota(OWNER_ID, 8, {
    reservationId: UPLOAD_ID,
  });
  assert.equal(reservation.bytes, 8);
  assert.equal(reservation.reservationId, UPLOAD_ID);
  assert.equal(quota.totalFiles, 1);
  assert.equal(quota.totalBytes, 8);

  await assert.rejects(
    service.reserveUploadQuota(OWNER_ID, 1, { reservationId: SECOND_UPLOAD_ID }),
    (error) => error.code === 'UPLOAD_QUOTA_EXCEEDED'
  );
});

test('upload quota release is idempotent when cleanup retries', async () => {
  const quota = {
    owner: OWNER_ID,
    totalFiles: 1,
    totalBytes: 8,
    reservations: [UPLOAD_ID],
  };
  const UploadQuota = {
    async findOneAndUpdate(filters, update) {
      const reservationId = filters.reservations.toString();
      const reservationIndex = quota.reservations.findIndex(
        (value) => value.toString() === reservationId
      );
      if (filters.owner !== quota.owner || reservationIndex === -1) {
        return null;
      }

      assert.equal(Array.isArray(update), true);
      quota.reservations.splice(reservationIndex, 1);
      quota.totalFiles = Math.max(0, quota.totalFiles - 1);
      quota.totalBytes = Math.max(0, quota.totalBytes - 8);
      return quota;
    },
  };
  const service = createChatService(
    baseServiceOptions({
      models: { Chat: {}, FriendRequest: {}, Message: {}, UploadAsset: {}, UploadQuota },
    })
  );
  const reservation = {
    ownerId: OWNER_ID,
    bytes: 8,
    reservationId: UPLOAD_ID,
  };

  assert.equal(await service.releaseUploadQuota(reservation), true);
  assert.equal(await service.releaseUploadQuota(reservation), false);
  assert.equal(quota.totalFiles, 0);
  assert.equal(quota.totalBytes, 0);
  assert.deepEqual(quota.reservations, []);
});

test('cleanup removes expired pending fallback assets and releases total quota', async () => {
  const now = new Date('2026-07-21T12:00:00.000Z');
  const expiredAsset = {
    _id: UPLOAD_ID,
    owner: OWNER_ID,
    provider: 'data-url',
    status: 'pending',
    pendingExpiresAt: new Date(now.getTime() - 1),
    deletionStartedAt: null,
    bytes: 8,
  };
  let quotaReleaseUpdate = null;
  const UploadAsset = {
    find() {
      return {
        sort() {
          return this;
        },
        async limit() {
          return [expiredAsset];
        },
      };
    },
    async findOneAndUpdate(_filters, update) {
      Object.assign(expiredAsset, update.$set);
      return expiredAsset;
    },
    async deleteOne() {
      return { deletedCount: 1 };
    },
    async updateOne() {},
  };
  const UploadQuota = {
    async findOneAndUpdate(filters, update) {
      quotaReleaseUpdate = { filters, update };
      return { owner: OWNER_ID };
    },
  };
  const service = createChatService(
    baseServiceOptions({
      models: { Chat: {}, FriendRequest: {}, Message: {}, UploadAsset, UploadQuota },
    })
  );

  const result = await service.cleanupAbandonedUploads({ now });

  assert.deepEqual(result, { deleted: 1, failed: 0 });
  assert.equal(quotaReleaseUpdate.filters.owner, OWNER_ID);
  assert.equal(quotaReleaseUpdate.filters.reservations.toString(), UPLOAD_ID);
  assert.equal(Array.isArray(quotaReleaseUpdate.update), true);
});

test('cleanup removes a stale attachment claim when its message was never created', async () => {
  const now = new Date('2026-07-21T12:00:00.000Z');
  const asset = {
    _id: UPLOAD_ID,
    owner: OWNER_ID,
    provider: 'data-url',
    status: 'claiming',
    message: MESSAGE_ID,
    claimStartedAt: new Date(now.getTime() - 20 * 60 * 1000),
    bytes: 8,
  };
  let deleted = false;
  const UploadAsset = {
    find() {
      return {
        sort() {
          return this;
        },
        async limit() {
          return [asset];
        },
      };
    },
    async findOneAndUpdate(_filters, update) {
      Object.assign(asset, update.$set);
      return asset;
    },
    async deleteOne() {
      deleted = true;
      return { deletedCount: 1 };
    },
    async updateOne() {},
  };
  const UploadQuota = {
    async findOneAndUpdate(filters) {
      assert.equal(filters.owner, OWNER_ID);
      assert.equal(filters.reservations.toString(), UPLOAD_ID);
      return { owner: OWNER_ID };
    },
  };
  const Message = { async exists() { return null; } };
  const service = createChatService(
    baseServiceOptions({
      models: { Chat: {}, FriendRequest: {}, Message, UploadAsset, UploadQuota },
    })
  );

  const result = await service.cleanupAbandonedUploads({ now });

  assert.deepEqual(result, { deleted: 1, failed: 0 });
  assert.equal(deleted, true);
  assert.equal(asset.status, 'deleting');
});
