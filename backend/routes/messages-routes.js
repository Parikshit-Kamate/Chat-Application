const express = require('express');
const createContext = require('./messages/context');

function createMessagesRouter(options) {
  const router = express.Router();
  const context = createContext(options);
  const { authRequired, messageSearchRateLimit } = context;
  router.delete('/messages/:messageId', authRequired, require('./messages/delete-message')(context));
  router.get('/search/messages', authRequired, messageSearchRateLimit, require('./messages/search-messages')(context));
  return router;
}

module.exports = { createMessagesRouter };
