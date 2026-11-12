const { createFixedWindowRateLimiter } = require('./dependencies');

function createContext({ authHelpers, chatService, models, realtime }) {
  const friendOverviewRateLimit = createFixedWindowRateLimiter({
    windowMs: 60 * 1000,
    maxAttempts: 60,
    message: 'Too many friend list requests. Please try again later.',
    getKey: req => `friends-read:${req.auth?.sub || 'unknown'}`
  });
  const friendMutationRateLimit = createFixedWindowRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxAttempts: 30,
    message: 'Too many friend request changes. Please try again later.',
    getKey: req => `friends-write:${req.auth?.sub || 'unknown'}`
  });
  return {
    ...authHelpers,
    ...chatService,
    ...models,
    ...realtime,
    friendOverviewRateLimit,
    friendMutationRateLimit
  };
}

module.exports = createContext;
