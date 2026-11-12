const express = require('express');
const createContext = require('./chats/context');

function createChatsRouter(options) {
  const router = express.Router();
  const context = createContext(options);
  const {
    authRequired,
    chatListRateLimit,
    groupMutationRateLimit,
    messageHistoryRateLimit,
    limitInChatSearch
  } = context;
  router.get('/chats', authRequired, chatListRateLimit, require('./chats/list-chats')(context));
  router.post('/chats/direct', authRequired, require('./chats/create-direct-chat')(context));
  router.post('/chats/group', authRequired, groupMutationRateLimit, require('./chats/create-group-chat')(context));
  router.patch('/chats/:chatId', authRequired, groupMutationRateLimit, require('./chats/update-group-chat')(context));
  router.post('/chats/:chatId/members', authRequired, groupMutationRateLimit, require('./chats/add-group-members')(context));
  router.delete('/chats/:chatId/members/:memberId', authRequired, groupMutationRateLimit, require('./chats/remove-group-member')(context));
  router.get(
    '/chats/:chatId/messages',
    authRequired,
    messageHistoryRateLimit,
    limitInChatSearch,
    require('./chats/message-history')(context)
  );
  router.post('/chats/:chatId/read', authRequired, require('./chats/mark-chat-read')(context));
  return router;
}

module.exports = { createChatsRouter };
