const express = require('express');
const { makeAuth } = require('../routes/auth');
const { createUploadsRouter } = require('../../routes/uploads-routes');
const { OWNER_ID, OTHER_OWNER_ID, MESSAGE_ID, UPLOAD_ID } = require('../upload-ledger/options');

function createAttachmentFixture() {
  const authHelpers = makeAuth();
  const asset = { _id: UPLOAD_ID, owner: OWNER_ID, status: 'attached', message: MESSAGE_ID,
    provider: 'data-url', url: 'data:text/plain;base64,aGVsbG8=', mediaType: 'text/plain',
    fileName: 'hello.txt', resourceType: 'raw', bytes: 5, format: 'txt' };
  const state = { messageExists: true, members: new Set([OWNER_ID]), findCount: 0 };
  const models = {
    UploadAsset: { async findOne(query) {
      state.findCount += 1;
      return query._id === UPLOAD_ID && query.status === asset.status ? asset : null;
    } },
    Message: { async findOne(query) {
      return state.messageExists && query._id === MESSAGE_ID &&
        query['attachments.uploadId'] === UPLOAD_ID ? { chat: MESSAGE_ID } : null;
    } },
    Chat: { async findOne(query) {
      return query._id === MESSAGE_ID && state.members.has(query['members.user']) ? {} : null;
    } }
  };
  const config = { allowDataUrlFallback: true, cloudName: 'trusted-cloud', apiKey: 'key', apiSecret: 'secret' };
  const app = express();
  require('../../runtime/upload-middleware')(app, authHelpers);
  app.use('/api', createUploadsRouter({ authHelpers, models, config, chatService: {} }));
  const token = authHelpers.createJwtToken({ sub: OWNER_ID });
  const outsiderToken = authHelpers.createJwtToken({ sub: OTHER_OWNER_ID });
  return { app, asset, state, models, token, outsiderToken, config,
    path: `/api/uploads/${UPLOAD_ID}/content` };
}

module.exports = { createAttachmentFixture };
