const express = require('express');
const createContext = require('./friends/context');

function createFriendsRouter(options) {
  const router = express.Router();
  const context = createContext(options);
  const { authRequired, friendOverviewRateLimit, friendMutationRateLimit } = context;
  router.get('/', authRequired, friendOverviewRateLimit, require('./friends/friend-overview')(context));
  router.post('/requests', authRequired, friendMutationRateLimit, require('./friends/send-friend-request')(context));
  router.post('/requests/:requestId/accept', authRequired, friendMutationRateLimit, require('./friends/accept-friend-request')(context));
  router.post('/requests/:requestId/reject', authRequired, friendMutationRateLimit, require('./friends/reject-friend-request')(context));
  return router;
}

module.exports = { createFriendsRouter };
