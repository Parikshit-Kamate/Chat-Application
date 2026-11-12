const { createFixedWindowRateLimiter, getRequestIp, MAX_CONCURRENT_PASSWORD_OPERATIONS } = require('./dependencies');

function createContext({ authHelpers, chatService, models }) {
  let activePasswordOperations = 0;
  const registerRateLimit = createFixedWindowRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxAttempts: 20,
    message: 'Too many registration attempts. Please try again later.',
    getKey: req => `register:${getRequestIp(req)}`
  });
  const loginRateLimit = createFixedWindowRateLimiter({
    windowMs: 10 * 60 * 1000,
    maxAttempts: 10,
    message: 'Too many login attempts. Please try again later.',
    getKey: req => {
      const username = String(req.body?.username || '').trim().toLowerCase().slice(0, 30);
      return `login:${getRequestIp(req)}:${username || 'unknown'}`;
    }
  });
  const loginIpRateLimit = createFixedWindowRateLimiter({
    windowMs: 10 * 60 * 1000,
    maxAttempts: 50,
    message: 'Too many login attempts from this network. Please try again later.',
    getKey: req => `login-ip:${getRequestIp(req)}`
  });
  function acquirePasswordOperation(res) {
    if (activePasswordOperations >= MAX_CONCURRENT_PASSWORD_OPERATIONS) {
      res.status(503).json({ error: 'Authentication is busy. Please try again shortly.' });
      return false;
    }
    activePasswordOperations += 1;
    return true;
  }
  function releasePasswordOperation() {
    activePasswordOperations = Math.max(0, activePasswordOperations - 1);
  }
  return {
    ...authHelpers,
    ...chatService,
    ...models,
    activePasswordOperations,
    registerRateLimit,
    loginRateLimit,
    loginIpRateLimit,
    acquirePasswordOperation,
    releasePasswordOperation
  };
}

module.exports = createContext;
