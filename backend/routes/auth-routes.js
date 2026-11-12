const express = require('express');
const createContext = require('./auth/context');

function createAuthRouter(options) {
  const router = express.Router();
  const context = createContext(options);
  const { registerRateLimit, loginIpRateLimit, loginRateLimit, authRequired } = context;
  router.post('/register', registerRateLimit, require('./auth/register')(context));
  router.post('/login', loginIpRateLimit, loginRateLimit, require('./auth/login')(context));
  router.get('/me', authRequired, require('./auth/current-user')(context));
  return router;
}

module.exports = { createAuthRouter };
