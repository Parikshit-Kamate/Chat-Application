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

module.exports = {
  OWNER_ID, OTHER_OWNER_ID, MESSAGE_ID, UPLOAD_ID, SECOND_UPLOAD_ID, baseServiceOptions,
};
